# Changes Summary — Configurable Provider/Model in UI

## Overview
Added provider and model dropdowns in the page header. Backend now accepts `provider`/`model` in audit requests and exposes a `GET /api/providers` endpoint. Frontend fetches providers, persists selection in localStorage, passes selected provider/model with each audit request.

---

## Files Changed

### Backend

| File | Action | Description |
|------|--------|-------------|
| `backend/src/Configuration/AiProviderOptions.cs` | **CREATE** | Defines `AiProviderOptions` (BaseUrl, DefaultModel, Models) and `AiProvidersConfig` (wraps `Dictionary<string, AiProviderOptions>`). Follows existing `init`-only property pattern. |
| `backend/appsettings.json` | **MODIFY** | Added `"AiProviders"` section with `"Providers"` containing groq, together, and openai provider configs (baseUrl, defaultModel, models list). |
| `backend/src/Models/Requests/AuditRequest.cs` | **MODIFY** | Added optional `Provider` and `Model` fields to the record. |
| `backend/src/Endpoints/AuditEndpoints.cs` | **MODIFY** | Added `GET /api/providers` endpoint that returns configured providers (id, name, models, defaultModel — without baseUrl). Passes `request.Provider` and `request.Model` through to sanitized request. Added `FormatProviderName` helper. |
| `backend/src/Services/SpecAuditService.cs` | **MODIFY** | Injects `IOptions<AiProvidersConfig>`. `AuditAsync` now resolves provider config dynamically — looks up provider ID in `_providerConfig.Providers`, uses its `BaseUrl` (full chat completions URL) and `DefaultModel`/requested model. Falls back to `AiOptions` legacy config. |
| `backend/Program.cs` | **MODIFY** | Registered `AiProvidersConfig` with `.Configure<AiProvidersConfig>(builder.Configuration.GetSection("AiProviders"))`. Relaxed startup validation to only require `Ai:ApiKey` (no longer requires BaseUrl and ModelId). |
| `backend.Tests/EndpointValidationTests.cs` | **MODIFY** | Added `AiProviders` in-memory config entries to test factory constructor. Added `GetProviders_ReturnsConfiguredProviders` test that validates `/api/providers` response shape. |
| `backend.Tests/AiOptionsValidationTests.cs` | **MODIFY** | Updated `MissingBaseUrl` and `MissingModelId` tests to verify they DO NOT throw when AiProviders are configured (since validation is relaxed). |

### Frontend

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/types/audit.ts` | **MODIFY** | Added optional `provider` and `model` fields to `AuditRequest` interface. |
| `frontend/src/components/ui/ProviderSelector.tsx` | **CREATE** | New component with two `<select>` dropdowns (provider + model). Exports `ProviderInfo` interface. Handles edge cases: empty providers (renders nothing), unknown provider (resets to first), empty model list (shows disabled "No models available"), invalid model (falls back to defaultModel). Matches existing header badge styling. |
| `frontend/src/components/ui/__tests__/ProviderSelector.test.tsx` | **CREATE** | 8 tests covering render, provider/model change callbacks, model updates on provider change, empty providers, empty model list, and display of current selections. |
| `frontend/src/App.tsx` | **MODIFY** | Replaced `providerName` state with `providers`, `selectedProvider`, `selectedModel` states. Fetches `/api/providers` on mount (instead of `/api/config`). Persists selection to localStorage (`specaudit-provider`, `specaudit-model`). Passes `provider` and `model` in audit requests. Replaced static provider badge with `ProviderSelector` component + dynamic badge showing selected provider's name. |

### Files NOT changed (no changes needed)

| File | Reason |
|------|--------|
| `frontend/src/api/auditClient.ts` | Already serializes `AuditRequest` as JSON body — `provider`/`model` fields pass through automatically. |
| `frontend/src/hooks/useAudit.ts` | Already accepts `AuditRequest` payload — no signature change needed. |
| `frontend/src/components/features/__tests__/App.test.tsx` | Existing hanging fetch mock prevents provider state updates; tests pass unchanged (Option B from spec). |
| `backend/src/Configuration/AiOptions.cs` | No changes needed — legacy config kept as fallback. |

---

## Testing Focus

1. **Backend `/api/providers` endpoint**: Returns configured providers with id, name, models, defaultModel (no baseUrl exposed).
2. **Provider resolution in service**: Unknown provider ID falls back to default (`groq`). Null model falls back to provider's defaultModel, then `_options.ModelId`.
3. **URL construction**: Provider config's `baseUrl` used directly (already full chat completions URL). Legacy `_options.BaseUrl` has `/chat/completions` appended.
4. **Frontend ProviderSelector**: Edge cases for empty providers, unknown provider, empty model list, invalid model.
5. **localStorage persistence**: Selection survives page reload.
6. **Audit request payload**: `provider` and `model` fields are sent in POST body when present.

---

## Verification Results

- `cd backend && dotnet build` — ✅ 0 errors
- `cd backend && dotnet test` — ✅ 30 passed (29 existing + 1 new)
- `cd frontend && npm run build` — ✅ 0 errors
- `cd frontend && npm test` — ✅ 306 passed (all 298 existing + 8 new ProviderSelector tests)
