# Review: Configurable Provider/Model Dropdown in UI

## VERDICT: SHIP

The implementation correctly delivers the feature as specified, with no security or correctness violations. All 336 tests pass (30 backend + 306 frontend).

---

## Checklist

| Criterion | Status | Notes |
|-----------|--------|-------|
| Spec conformance | ✅ | All files created/modified as specified. Minor JSON structure difference (see Findings). |
| `GET /api/providers` returns providers without `baseUrl` | ✅ | Returns `id`, `name`, `models`, `defaultModel` only. No `baseUrl`, no API key. |
| `POST /api/audit` passes `provider`/`model` through | ✅ | Line 44 of `AuditEndpoints.cs` passes `request.Provider` and `request.Model` to `AuditRequest`. |
| Dynamic provider resolution in service | ✅ | `SpecAuditService.AuditAsync` resolves provider config by key; falls back to `AiOptions` legacy defaults. |
| Frontend fetches providers on mount | ✅ | `App.tsx` `useEffect` fetches `/api/providers`, populates dropdowns. |
| localStorage persistence | ✅ | `specaudit-provider` and `specaudit-model` persisted on every change. |
| Selected provider/model in audit requests | ✅ | `handleSubmit` passes `selectedProvider` and `selectedModel` to `audit()`. |
| Backward compatibility (no provider/model) | ✅ | Optional `string?` fields on `AuditRequest`; service handles null via fallback. |
| No breaking changes to diagnose endpoints | ✅ | Not modified — correctly out of scope. |
| Backend tests run (30 pass) | ✅ | 30 tests across files including new `GetProviders_ReturnsConfiguredProviders`. |
| Frontend tests run (306 pass) | ✅ | 306 tests including 8 new `ProviderSelector` tests. |
| Total tests: 336 pass | ✅ | |

---

## Findings

### 1. appsettings.json structure — minor spec deviation (NOTE)

The spec's sample JSON shows:
```json
"AiProviders": {
    "groq": { ... },
    "together": { ... }
}
```

The actual implementation has:
```json
"AiProviders": {
    "Providers": {
        "groq": { ... },
        "together": { ... }
    }
}
```

This is **not a bug** — it is a necessary correction. The `AiProvidersConfig` class defined in the spec has `public Dictionary<string, AiProviderOptions> Providers { get; init; }`, requiring the `"Providers"` wrapper for correct configuration binding. The spec's own class definition and sample JSON are inconsistent with each other; the implementation correctly chose the structure that matches the class definition. No change needed.

### 2. Provider fallback behavior — equivalent design choice (NOTE)

The spec's sample code defaults `providerId = request.Provider ?? "groq"` and falls back to the `"groq"` provider config for null/unknown providers. The actual code keeps `providerId` as-is (null/empty) and falls back to `_options.BaseUrl + "/chat/completions"` (the legacy config).

In the default configuration, both approaches produce the **same final URL** (`https://api.groq.com/openai/v1/chat/completions`). The code's approach is more backward-compatible: users with custom `Ai:BaseUrl` values (not matching any provider config) will continue to work as before. This is a reasonable design choice, not a defect.

### 3. Diagnose endpoints expose `ex.Message` (NOTE)

`DiagnoseRawMode` (line 173) and `DiagnoseSdkMode` (line 241) return `error = ex.Message` in their JSON responses. These are diagnostic-only endpoints not consumed by the frontend, and the spec explicitly marks them as out-of-scope. Low risk, not blocking.

### 4. Test quality

- **ProviderSelector tests**: 8 tests covering render, callbacks, provider change → model update, empty providers, empty model list, and current value display. All behavior-driven, no implementation mocking. Good coverage.
- **Backend integration test**: `GetProviders_ReturnsConfiguredProviders` validates the `/api/providers` response shape (id, name, models, defaultModel). Ensures no sensitive fields leak.
- **AiOptionsValidationTests**: Updated to reflect relaxed validation — tests now verify that missing `BaseUrl`/`ModelId` do NOT throw when `AiProviders` are configured.
- **Gap**: `App.test.tsx` was not updated (by design — spec Option B). Provider dropdown behavior in the full App context is only tested via unit tests on the isolated `ProviderSelector` component. Acceptable given the scope.

### 5. No security issues

| Check | Result |
|-------|--------|
| `baseUrl` exposed in `/api/providers` | ❌ Not exposed — only `id`, `name`, `models`, `defaultModel` |
| API key exposed in any response | ❌ Not exposed |
| Raw exception messages to client | ❌ Sanitized — only "Rate limit", "timeout", or generic messages |
| Injection vectors | ❌ None found — input validation on spec trim/length, no SQL/shell interpolation |
| Secrets in source code | ❌ None found |

### 6. No correctness issues

| Check | Result |
|-------|--------|
| Async discipline | ✅ All async calls awaited, cancellation tokens properly linked |
| State race conditions | ✅ No concurrent state mutations; React batches state updates |
| Runtime type safety | ✅ `JSON.parse` results are validated before use in SSE parsing |
| Error swallowing | ✅ All catch blocks log the error; empty catch only for clipboard/export failures |
| localStorage persistence | ✅ Writes on every provider/model change; reads on mount with null-safe defaults |

---

## Suggested Commit Message

```
feat: configurable AI provider/model dropdown in UI

- Add AiProvidersConfig with Dictionary<string, AiProviderOptions> for
  provider configuration (baseUrl, defaultModel, models list)
- Add GET /api/providers endpoint returning id/name/models/defaultModel
  (baseUrl not exposed)
- Pass provider/model from audit request through to SpecAuditService
- Resolve provider config dynamically in service; fall back to legacy
  AiOptions defaults for backward compatibility
- Relax startup validation: only require Ai:ApiKey (BaseUrl/ModelId
  are optional when AiProviders are configured)
- Add ProviderSelector component with provider + model dropdowns,
  handling edge cases (empty/unknown provider, empty model list,
  invalid model fallback)
- Fetch providers on mount, persist selection in localStorage
- 336 tests passing (30 backend + 306 frontend)

Breaking changes: none — provider/model fields are optional with
null-safe defaults.
```

---

## Sign-off

Reviewed by: Senior Code Reviewer
Date: 2026-06-04

All criteria satisfied. Feature is ready to ship.
