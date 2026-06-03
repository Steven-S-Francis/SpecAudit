# Monitoring / Error Tracking (Sentry Integration)

## Overview

Add Sentry SDK to both backend (ASP.NET Core) and frontend (React) for proactive error monitoring and outage detection. Sentry is only active when a DSN is configured — no DSN = no-op initialization.

## OPEN QUESTIONS

1. **Sentry JS SDK version**: The spec uses `@sentry/react ^9.0.0`. Check the latest stable version at `npm info @sentry/react versions --json`. If v8 is latest, adjust the import paths accordingly (`Sentry.replayIntegration()` vs `new Replay()`). The spec assumes the v9 API shape.
2. **`@sentry/vite-plugin`**: This spec does NOT include `@sentry/vite-plugin` for source map upload. Sentry recommends it for production builds to get readable stack traces. Should it be included? It would require a Sentry auth token in CI and modifies `vite.config.ts`. If omitted, stack traces in Sentry will be minified.
3. **Sentry.AspNetCore version for .NET 10**: Confirm `Sentry.AspNetCore 5.*` is compatible with .NET 10. Check `nuget.org` for the latest version that targets `net10.0`. If `5.*` is not yet compatible, use `4.*` instead.

---

## Files to Create or Modify

| Action | Path | Description |
|--------|------|-------------|
| MODIFY | `backend/backend.csproj` | Add `<PackageReference Include="Sentry.AspNetCore" />` |
| MODIFY | `backend/Program.cs` | Add Sentry configuration with data scrubbing |
| MODIFY | `frontend/package.json` | Add `@sentry/react` dependency |
| MODIFY | `frontend/src/main.tsx` | Initialize Sentry frontend SDK |
| MODIFY | `docker-compose.yml` | Add `Sentry__Dsn` and `VITE_SENTRY_DSN` environment variables |
| MODIFY | `.env` | Add commented-out placeholder entries for Sentry DSNs |

---

## 1. Backend Changes

### 1.1 `backend/backend.csproj` — Add Package

Add after the existing `<PackageReference Include="OpenAI" />`:

```xml
<PackageReference Include="Sentry.AspNetCore" Version="5.*" />
```

Use version `5.*` (latest stable 5.x for .NET 10 compatibility). The `Sentry.AspNetCore` meta-package includes `Sentry` and all ASP.NET Core integrations.

### 1.2 `backend/Program.cs` — Sentry Configuration

**Pattern to follow:** The existing `builder.Services.Configure<AiOptions>` and `builder.Configuration` usage in `Program.cs`.

Add Sentry *before* `var builder = WebApplication.CreateBuilder(args)` chain, because Sentry hooks into the `IHostBuilder`:

```csharp
// Add at the top, after the existing using statements
// No new using needed — Sentry uses extension methods

var builder = WebApplication.CreateBuilder(args);

// --- Sentry (only if DSN is configured) ---
var sentryDsn = builder.Configuration["Sentry:Dsn"];
if (!string.IsNullOrWhiteSpace(sentryDsn))
{
    builder.WebHost.UseSentry(sentryDsn, options =>
    {
        // Performance tracking — traces sample rate (0.0 = no trace, 0.25 = 25%)
        options.TracesSampleRate = 0.25;

        // Security: never send PII
        options.SendDefaultPii = false;

        // Security: scrub the AI API key from all captured data
        options.BeforeSend = @event =>
        {
            // Scrub from extra/context
            if (@event.Contexts.TryGetValue("Ai", out var aiContext))
            {
                foreach (var key in new[] { "ApiKey", "apiKey" })
                {
                    if (aiContext.ContainsKey(key))
                        aiContext[key] = "[redacted]";
                }
            }

            // Scrub from breadcrumb data
            foreach (var breadcrumb in @event.Breadcrumbs)
            {
                if (breadcrumb.Data?.ContainsKey("ApiKey") == true)
                    breadcrumb.Data["ApiKey"] = "[redacted]";
            }

            return @event;
        };

        // Send only errors and above by default (can be configured per-environment)
        options.MinimumBreadcrumbLevel = Microsoft.Extensions.Logging.LogLevel.Warning;
        options.MinimumEventLevel = Microsoft.Extensions.Logging.LogLevel.Error;
    });
}
```

**Key design decisions:**
- Sentry is only configured when `Sentry:Dsn` is present and non-empty. This means local dev with no DSN runs Sentry-free, emitting zero Sentry-related log noise.
- `TracesSampleRate = 0.25` — captures 25% of requests for performance monitoring without overwhelming the quota.
- `SendDefaultPii = false` — ensures no personal info (IP addresses, etc.) is sent.
- `BeforeSend` callback scrubs `Ai:ApiKey` from any context or breadcrumb data that Sentry might have captured.
- `MinimumEventLevel = Error` — only sends error-level events, not warnings.
- The existing `/health` endpoint (line 45) remains unchanged — Railway uses it for uptime health checks, and any failure there will automatically be captured as an error by Sentry.

**Placement within `Program.cs`:**
- Insert AFTER line 8 (`var builder = WebApplication.CreateBuilder(args);`)
- Insert BEFORE line 10 (`builder.Services.Configure<AiOptions>(...)`)
- This ensures Sentry is bootstrapped before any service configuration.

---

## 2. Frontend Changes

### 2.1 `frontend/package.json` — Add Dependencies

Add to `dependencies`:

```json
"@sentry/react": "^9.0.0",
"@sentry/browser": "^9.0.0"
```

`@sentry/react` is the main package for React integration (includes ErrorBoundary, Profiler, etc.).  
`@sentry/browser` provides the core browser SDK (includes Replay, BrowserTracing, etc.).

> **Note:** In Sentry v9+, `@sentry/react` re-exports everything from `@sentry/browser`. However, for Replay functionality, the import path is explicit. Check the final `package.json` after install to verify exact version.

### 2.2 `frontend/src/main.tsx` — Sentry Initialization

**Replace the existing `main.tsx` content** with:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import './index.css';

// Sentry initialization — only if DSN is set
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,  // 'development' | 'production'
    integrations: [
      // Session replay — captures user interactions for error replay
      Sentry.replayIntegration({
        // Only record replays in production to save bandwidth in dev
        sessionSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 0.0,
        errorSampleRate: import.meta.env.MODE === 'production' ? 1.0 : 0.0,
      }),
    ],
    // Send only errors, not warnings
    beforeSend(event) {
      // Never send PII — scrub any potential personally identifiable data
      if (event.request?.headers) {
        event.request.headers = {};
      }
      return event;
    },
    // Performance monitoring — traces sample rate
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.25 : 0.0,
    // Replays sampling
    replaysSessionSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 0.0,
    replaysOnErrorSampleRate: 1.0,
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<div className="p-8 text-center text-red-400">An unexpected error occurred.</div>}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
);
```

**Key design decisions:**
- `VITE_SENTRY_DSN` env var follows Vite's convention (`VITE_` prefix). This is replaced at build time by Vite.
- `environment: import.meta.env.MODE` — distinguishes dev/production errors in Sentry dashboard.
- `replayIntegration` with `sessionSampleRate: 0.1` (10% in production) — captures enough replays for debugging without overwhelming storage. Dev replays are disabled (0.0).
- `errorSampleRate: 1.0` — always capture a replay when an error occurs.
- `tracesSampleRate: 0.25` (production only) — 25% trace sampling for performance monitoring.
- `Sentry.ErrorBoundary` wraps the entire `<App />` — catches any uncaught React errors with a minimal fallback UI.
- The `beforeSend` callback strips request headers to prevent accidental PII leakage.
- If `VITE_SENTRY_DSN` is not set, Sentry is never initialized — no network requests, no side effects.

**Edge cases:**
1. **`VITE_SENTRY_DSN` is empty string**: The `if (sentryDsn)` check handles this — empty string is falsy.
2. **`import.meta.env.MODE` is undefined**: Falls back gracefully — Sentry receives `undefined` for environment and uses its default.
3. **Replay fails to load**: Replay is an optional integration — if it fails to initialize, Sentry core still works.
4. **`Sentry.ErrorBoundary` catches an error during initial render**: The fallback component renders a centered red error message. No Sentry upload loop — ErrorBoundary only shows fallback once.

---

## 3. Environment Variables / Configuration

### 3.1 `.env` (local Docker compose)

Add commented-out placeholders after the existing `AI_API_KEY` line (line 1):

```env
AI_API_KEY=your-api-key-here

# Sentry DSN (optional — leave empty to disable Sentry)
# Get from https://specaudit.sentry.io/ → Project Settings → Client Keys (DSN)
# SENTRY_DSN=
# VITE_SENTRY_DSN=
```

### 3.2 `docker-compose.yml`

Add Sentry env vars under `environment`:

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "5000:5000"
    environment:
      - ASPNETCORE_ENVIRONMENT=Production
      - Ai__ApiKey=${AI_API_KEY}
      - Sentry__Dsn=${SENTRY_DSN}
      # VITE_SENTRY_DSN is a build-time arg, not runtime env var
      # It's baked into the frontend JS during npm run build
    restart: unless-stopped
```

> **Note on `VITE_SENTRY_DSN`:** Unlike the backend DSN, the frontend DSN is a **build-time** environment variable. Vite replaces `import.meta.env.VITE_SENTRY_DSN` at build time. In Railway, this would be set in the build command env or passed as a Docker build arg. For local Docker Compose, it would need to be passed as a build argument if Sentry is desired in the frontend. For Railway, add `VITE_SENTRY_DSN` to the Railway project's environment variables (Railway injects VITE_ prefixed variables at build time for frontend frameworks).

### 3.3 Railway Setup (documentation only — no files changed)

Railway needs these env vars configured in the dashboard:

| Variable | Purpose | Required? | Scoping |
|----------|---------|-----------|---------|
| `Sentry__Dsn` | Backend Sentry DSN | No | Runtime |
| `VITE_SENTRY_DSN` | Frontend Sentry DSN | No | Build-time (Vite injects into JS bundle) |

Both are optional. If omitted, Sentry is a no-op in both layers.

---

## 4. Security Considerations

### 4.1 API Key Scrubbing (Backend)

The `BeforeSend` callback in Program.cs handles:

1. **`options.Contexts`**: If Sentry captures the `Ai` configuration section, `ApiKey` and `apiKey` keys are replaced with `[redacted]`.
2. **Breadcrumb data**: Any breadcrumb that contains an `ApiKey` key is scrubbed.
3. **`SendDefaultPii = false`**: Prevents IP addresses, usernames, and other PII from being included.

### 4.2 Request Header Stripping (Frontend)

The `beforeSend` callback in `main.tsx` sets `event.request.headers = {}` to ensure no authorization headers or cookies leak into Sentry.

### 4.3 Frontend DSN Is Public

The frontend DSN is embedded in the client-side JS bundle. This is by design for Sentry — the DSN identifies the project but is not a secret. Anyone can see it in the browser's network tab. Sentry uses it only for routing events. Rate limits and project access are controlled via DSN restrictions in the Sentry dashboard.

### 4.4 No PII by Default

- `SendDefaultPii = false` is explicit
- Request headers are cleared on the frontend
- No user context is attached
- Breadcrumb levels are set to `Warning` minimum (no debug-level data)

---

## 5. Test Approach

### 5.1 Backend: Verify No Crash When DSN Is Missing

**Existing test pattern to follow:** `backend.Tests/EndpointValidationTests.cs` uses `WebApplicationFactory<Program>` with in-memory configuration.

Add a new test file: `backend.Tests/SentryStartupTests.cs`:

```csharp
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace backend.Tests;

public class SentryStartupTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public SentryStartupTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task HealthEndpoint_Works_WhenSentryDsnIsNotSet()
    {
        // Arrange: no Sentry:Dsn in config
        var client = _factory.WithWebHostBuilder(builder =>
            builder.ConfigureAppConfiguration((_, cfg) =>
                cfg.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Ai:ProviderName"]   = "Test",
                    ["Ai:BaseUrl"]        = "https://test.example.com/v1",
                    ["Ai:ModelId"]        = "test-model",
                    ["Ai:ApiKey"]         = "test-key",
                    ["Ai:MaxInputLength"] = "100000"
                    // NOTE: Sentry__Dsn is intentionally absent
                })
            )
        ).CreateClient();

        // Act
        var response = await client.GetAsync("/health");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task HealthEndpoint_Works_WhenSentryDsnIsSet()
    {
        // Arrange: with Sentry:Dsn set (fake DSN — no actual connection)
        var client = _factory.WithWebHostBuilder(builder =>
            builder.ConfigureAppConfiguration((_, cfg) =>
                cfg.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Ai:ProviderName"]   = "Test",
                    ["Ai:BaseUrl"]        = "https://test.example.com/v1",
                    ["Ai:ModelId"]        = "test-model",
                    ["Ai:ApiKey"]         = "test-key",
                    ["Ai:MaxInputLength"] = "100000",
                    ["Sentry:Dsn"]        = "https://fake@example.com/1"  // Fake DSN — SDK won't connect
                })
            )
        ).CreateClient();

        // Act
        var response = await client.GetAsync("/health");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
```

**Note:** Add `using FluentAssertions;` and `using System.Net;` to the file.

### 5.2 Frontend: Verify App Renders When VITE_SENTRY_DSN Is Not Set

The existing test setup in `App.test.tsx` already mocks all hooks. Sentry initialization in `main.tsx` is a side effect — `App.tsx` itself does not import Sentry. The tests render `<App />` directly (not via `main.tsx`), so Sentry has no effect on existing tests.

**No new frontend tests are needed** because:

1. `main.tsx` is not unit-tested (it's the bootstrap entry point)
2. The `if (sentryDsn)` guard means Sentry is a no-op when DSN is missing
3. The app component tree is unchanged — `Sentry.ErrorBoundary` is in `main.tsx`, not `App.tsx`

**Manual verification steps:**

```bash
# Frontend dev build — ensure no Sentry errors in console
VITE_SENTRY_DSN="" npm run dev
# Verify app loads without any Sentry-related console errors

# Frontend production build with DSN
VITE_SENTRY_DSN="https://key@o1.ingest.sentry.io/123" npm run build
# Verify build succeeds and contains "Sentry.init" in the bundle
```

### 5.3 Verification Without Real DSN

To verify Sentry initialization without a real DSN:

**Backend:**
- Set `Sentry__Dsn` to a fake value: `https://fake@sentry.io/123`
- Start the app and trigger an error (e.g., hit `/api/audit` with an empty body)
- Check the logs — Sentry should log a warning about invalid DSN but not crash

**Frontend:**
- Set `VITE_SENTRY_DSN` to a fake value and rebuild
- Open the app, trigger an error (e.g., access a broken route)
- Check the browser console for Sentry error messages (expected: "Sentry: Unable to send event")
- Verify the app still renders normally despite Sentry errors

Neither test requires a real Sentry account.

---

## 6. Edge Cases

### 6.1 `Sentry__Dsn` Has Invalid Format
- The `Sentry.AspNetCore` SDK validates DSN format at startup. If invalid, it logs a warning (not an exception) and disables itself.
- No startup crash — the app continues without monitoring.

### 6.2 `VITE_SENTRY_DSN` Has Invalid Format
- `Sentry.init()` validates the DSN on the client side. If invalid, it logs a console error and disables itself.
- No crash — the app continues without monitoring.

### 6.3 Sentry Backend Unreachable
- The Sentry SDK sends events asynchronously with retry logic and exponential backoff.
- If the Sentry ingest endpoint is unreachable, events are queued in memory and retried. If all retries fail, events are dropped silently.
- No impact on user-facing functionality — the app continues to work normally.

### 6.4 Multiple `ApiKey`-Like Config Keys
- The `BeforeSend` callback scrubs `ApiKey` and `apiKey` keys. If any other config keys contain API keys (e.g., `Sentry__ApiKey`), they are not scrubbed — but Sentry does not capture configuration values unless explicitly added to the scope.
- This is acceptably safe: the only API key in the app is `Ai:ApiKey`, which IS scrubbed.

### 6.5 Frontend DSN Leaked in Git
- `VITE_SENTRY_DSN` goes into the Railway dashboard, not into source code. No `.env` file with the real DSN is committed.
- The `.env` file is already in `.gitignore` (confirmed).

### 6.6 Large Trace Volume / Quota Exhaustion
- `tracesSampleRate: 0.25` limits traces to 25% of requests.
- `MinimumEventLevel: Error` limits events to errors only.
- If the Sentry quota is reached, Sentry stops sending and logs warnings — no app impact.

---

## 7. Summary of Implementation Order

1. **Backend:**
   - `dotnet add backend/backend.csproj package Sentry.AspNetCore`
   - Edit `backend/Program.cs` to add Sentry configuration block
   - Add `backend.Tests/SentryStartupTests.cs` with startup resilience tests

2. **Frontend:**
   - `npm install @sentry/react @sentry/browser` in `frontend/`
   - Edit `frontend/src/main.tsx` with Sentry init + ErrorBoundary

3. **Configuration/Docs:**
   - Edit `docker-compose.yml` to add `Sentry__Dsn` env var
   - Edit `.env` to add commented-out Sentry DSN placeholders

4. **Verify:**
   - `dotnet build && dotnet test` on backend
   - `npx tsc --noEmit && npx vitest run && npm run build` on frontend
   - Manual smoke test without DSN (both layers)
