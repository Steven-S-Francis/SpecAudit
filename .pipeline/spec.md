# Configurable AI Provider/Model Dropdown in UI

## OPEN QUESTIONS

1. **Provider name badge source**: Currently `GET /api/config` returns `{ providerName }` from `AiOptions.ProviderName`. After this change, should the badge reflect the *currently selected* provider (from the dropdown) rather than the server-configured default? **Recommendation**: Yes — once user selects a provider, the badge should show the selected provider's `name` field. The initial value (before user selection) should come from the first provider returned by `GET /api/providers` (or from localStorage if previously persisted).

2. **`GET /api/config` repurposing**: With the new `GET /api/providers` endpoint, the old `/api/config` endpoint can either be removed (breaking change risk) or kept as a fallback. **Recommendation**: Keep `/api/config` for backward compatibility but the UI should switch to `/api/providers` for its primary data.

3. **Existing test count**: The feature request says "all 29 tests pass" — verify exact count after changes. Current backend tests are across 6 files; frontend tests are in `__tests__` directories. Count may vary.

---

## Files to Create or Modify

| Action | Path |
|--------|------|
| **MODIFY** | `backend/appsettings.json` — add `AiProviders` section |
| **CREATE** | `backend/src/Configuration/AiProviderOptions.cs` — provider config model |
| **MODIFY** | `backend/src/Configuration/AiOptions.cs` — keep existing, no changes needed |
| **MODIFY** | `backend/src/Models/Requests/AuditRequest.cs` — add `provider` and `model` fields |
| **MODIFY** | `backend/src/Services/SpecAuditService.cs` — accept provider/model, use dynamic config |
| **MODIFY** | `backend/src/Endpoints/AuditEndpoints.cs` — add `/api/providers` endpoint, pass provider/model to service |
| **MODIFY** | `backend/Program.cs` — register `AiProviders` config section |
| **MODIFY** | `frontend/src/types/audit.ts` — add `provider` and `model` to `AuditRequest` |
| **MODIFY** | `frontend/src/api/auditClient.ts` — no payload change needed (already uses `AuditRequest`) |
| **MODIFY** | `frontend/src/hooks/useAudit.ts` — accept provider/model and pass through |
| **MODIFY** | `frontend/src/App.tsx` — add provider/model state, dropdowns, fetch `/api/providers`, persist to localStorage |
| **CREATE** | `frontend/src/components/ui/ProviderSelector.tsx` — provider + model dropdown component |
| **CREATE** | `frontend/src/components/ui/__tests__/ProviderSelector.test.tsx` |
| **MODIFY** | `frontend/src/components/features/__tests__/App.test.tsx` — update mocks for new fetch call |
| **MODIFY** | `backend.Tests/EndpointValidationTests.cs` — add tests for `/api/providers` endpoint |

---

## 1. `backend/appsettings.json` — Add `AiProviders` Section

Replace the existing `"Ai"` section with the new structure. Keep the existing `"Ai"` section for backward-compatible defaults but add `"AiProviders"`:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "Ai": {
    "ProviderName": "Groq",
    "BaseUrl": "https://api.groq.com/openai/v1",
    "ModelId": "llama-3.3-70b-versatile",
    "MaxTokens": 4096,
    "MaxInputLength": 100000
  },
  "AiProviders": {
    "groq": {
      "baseUrl": "https://api.groq.com/openai/v1/chat/completions",
      "defaultModel": "llama-3.3-70b-versatile",
      "models": ["llama-3.3-70b-versatile", "mixtral-8x7b-32768", "gemma2-9b-it", "llama-3.3-70b-specdec", "llama-guard-3-8b"]
    },
    "together": {
      "baseUrl": "https://api.together.xyz/v1/chat/completions",
      "defaultModel": "mistralai/Mixtral-8x7B-Instruct-v0.1",
      "models": ["mistralai/Mixtral-8x7B-Instruct-v0.1", "meta-llama/Llama-3.3-70B-Instruct-Turbo"]
    },
    "openai": {
      "baseUrl": "https://api.openai.com/v1/chat/completions",
      "defaultModel": "gpt-4o-mini",
      "models": ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo"]
    }
  }
}
```

The provider ID is the key (e.g. `"groq"`). The `baseUrl` is the full chat completions URL (not the base API URL). The `models` array lists available models for the dropdown.

---

## 2. `backend/src/Configuration/AiProviderOptions.cs` — New File

```csharp
namespace SpecAudit.Configuration;

public sealed class AiProviderOptions
{
    public string BaseUrl { get; init; } = string.Empty;
    public string DefaultModel { get; init; } = string.Empty;
    public List<string> Models { get; init; } = new();
}

public sealed class AiProvidersConfig
{
    public Dictionary<string, AiProviderOptions> Providers { get; init; } = new();
}
```

Follow the same `init`-only property pattern as `AiOptions.cs`.

**Note**: The `appsettings.json` section is named `"AiProviders"` with each provider ID as a key. The configuration binding matches `Dictionary<string, AiProviderOptions>` directly because ASP.NET Core's `IConfiguration` can bind nested keys to a dictionary.

---

## 3. `backend/src/Models/Requests/AuditRequest.cs` — Add `provider` and `model`

```csharp
namespace SpecAudit.Models.Requests;

public sealed record AuditRequest(
    string Spec,
    string? SpecFormat,
    string? Provider,     // new — e.g. "groq", "together", "openai"
    string? Model         // new — e.g. "llama-3.3-70b-versatile"
);
```

- Both are optional (`string?`).
- Defaults are handled server-side (provider falls back to config default, model falls back to provider's defaultModel).
- **Existing callers** that construct `AuditRequest` without these fields (e.g. in `AuditEndpoints.cs` line 44 where `new AuditRequest(spec, request.SpecFormat)` is used) must be updated to pass through `request.Provider` and `request.Model`.

---

## 4. `backend/src/Services/SpecAuditService.cs` — Accept Provider/Model

### Constructor Changes

Inject `IOptions<AiProvidersConfig>` in addition to the existing `IOptions<AiOptions>`:

```csharp
private readonly AiOptions _options;
private readonly AiProvidersConfig _providerConfig;
private readonly ILogger<SpecAuditService> _logger;

public SpecAuditService(
    IOptions<AiOptions> options,
    IOptions<AiProvidersConfig> providerConfig,
    ILogger<SpecAuditService> logger)
{
    _options = options.Value;
    _providerConfig = providerConfig.Value;
    _logger = logger;
    // ...
}
```

### `AuditAsync` Signature Change

```csharp
public async IAsyncEnumerable<string> AuditAsync(
    AuditRequest request,
    [EnumeratorCancellation] CancellationToken ct)
```

No signature change — the provider/model are now part of `AuditRequest`.

### Logic Changes Inside `AuditAsync`

Replace the hardcoded `_options.ModelId` and `_options.BaseUrl` usage with dynamic resolution:

```csharp
// Resolve provider and model
var providerId = request.Provider ?? "groq";
var model = request.Model ?? _options.ModelId;

// Look up provider config
if (!_providerConfig.Providers.TryGetValue(providerId, out var providerCfg))
{
    // Fall back to the configured default if unknown provider ID
    providerCfg = _providerConfig.Providers.GetValueOrDefault("groq");
}

var baseUrl = providerCfg?.BaseUrl ?? _options.BaseUrl.TrimEnd('/');
var resolvedModel = model ?? providerCfg?.DefaultModel ?? _options.ModelId;

// Use baseUrl and resolvedModel in the HTTP request construction
// e.g.:
var payload = new
{
    model = resolvedModel,
    messages = new[] { systemMessage, userMessage },
    max_tokens = _options.MaxTokens,
    temperature = 0.1f,
    stream = true
};

// URL construction:
$"{baseUrl.TrimEnd('/')}"  // baseUrl is already the full chat completions URL
```

**Key change**: The `baseUrl` in `AiProviderOptions` is the **full chat completions URL** (e.g. `https://api.groq.com/openai/v1/chat/completions`), so the existing code's `$"{_options.BaseUrl.TrimEnd('/')}/chat/completions"` pattern must be adjusted. When using a provider config's `baseUrl`, DO NOT append `/chat/completions` again. When falling back to `_options.BaseUrl` (old config), DO append `/chat/completions` as before.

**Edge cases**:
- Unknown provider ID → fall back to `"groq"` provider config
- Provider config missing `baseUrl` → fall back to `_options.BaseUrl` with `/chat/completions` appended
- Null model → use provider's `defaultModel`, then `_options.ModelId`
- Empty `models` list → dropdown shows nothing; user can still type (if we made it a text input, but we use a select, so ensure at least defaultModel is in the list in config)

---

## 5. `backend/src/Endpoints/AuditEndpoints.cs` — Changes

### a) Pass provider/model from request to sanitized request

At line 44, change:
```csharp
var sanitizedRequest = new AuditRequest(spec, request.SpecFormat);
```
to:
```csharp
var sanitizedRequest = new AuditRequest(spec, request.SpecFormat, request.Provider, request.Model);
```

### b) Add `GET /api/providers` Endpoint

```csharp
app.MapGet("/api/providers", (IOptions<AiProvidersConfig> providerConfig) =>
{
    var providers = providerConfig.Value.Providers.Select(kvp => new
    {
        id = kvp.Key,
        name = FormatProviderName(kvp.Key),  // "groq" → "Groq", "openai" → "OpenAI"
        models = kvp.Value.Models,
        defaultModel = kvp.Value.DefaultModel
    });
    return Results.Ok(providers);
});
```

Helper method:
```csharp
private static string FormatProviderName(string id) =>
    id switch
    {
        "groq" => "Groq",
        "together" => "Together AI",
        "openai" => "OpenAI",
        _ => id   // fallback: return raw ID
    };
```

Or keep it simpler — just capitalize the first letter: `char.ToUpper(id[0]) + id[1..]`.

### c) Update `/api/diagnose` endpoints

The diagnose endpoints (`DiagnoseRawMode` and `DiagnoseSdkMode`) currently use `aiOptions.BaseUrl` and `aiOptions.ModelId`. They should NOT be modified for this feature — they are diagnostic tools that test the configured default. If desired, they could accept optional `provider`/`model` query params as a future enhancement, but that is **out of scope** for this spec.

---

## 6. `backend/Program.cs` — Register `AiProviders` Config

Add after line 72:
```csharp
builder.Services.Configure<AiProvidersConfig>(
    builder.Configuration.GetSection("AiProviders"));
```

Also update the startup validation (lines 110-112) to be less strict — since the app can now work with just `AiProviders` config:
```csharp
// Relaxed validation: require either Ai:ApiKey is set, or at least one provider exists
// The ApiKey check is still critical
var aiOptions = app.Services.GetRequiredService<IOptions<AiOptions>>().Value;
if (string.IsNullOrWhiteSpace(aiOptions.ApiKey))
    throw new InvalidOperationException("Ai:ApiKey must be configured in user-secrets or env vars.");
```

---

## 7. `frontend/src/types/audit.ts` — Add `provider` and `model`

```typescript
export interface AuditRequest {
  spec: string;
  specFormat?: 'yaml' | 'json';
  provider?: string;    // new
  model?: string;       // new
}
```

No other types need changes.

---

## 8. `frontend/src/hooks/useAudit.ts` — Pass Through Provider/Model

The `audit` function already accepts `AuditRequest` as its payload. Since `AuditRequest` now includes `provider` and `model`, they are automatically passed through to `auditStream`. No hook changes needed.

---

## 9. `frontend/src/components/ui/ProviderSelector.tsx` — New Component

### Exports

```typescript
interface ProviderInfo {
  id: string;
  name: string;
  models: string[];
  defaultModel: string;
}

interface ProviderSelectorProps {
  providers: ProviderInfo[];
  selectedProvider: string;
  selectedModel: string;
  onProviderChange: (providerId: string) => void;
  onModelChange: (model: string) => void;
}

function ProviderSelector(props: ProviderSelectorProps): JSX.Element;
```

### Behaviour

- Renders two `<select>` elements side by side (or stacked on small screens):
  - Provider dropdown: populated from `providers` prop, shows `provider.name` as display text, `provider.id` as value.
  - Model dropdown: populated from `providers.find(p => p.id === selectedProvider)?.models ?? []`, shows each model string as both value and display text.
- When the user changes the provider, automatically update the selected model to the new provider's `defaultModel` (call `onModelChange` with the default model).
- When providers list changes (e.g., on re-fetch), if the current `selectedModel` is not in the new models list, reset to `defaultModel`.
- Styling (Tailwind v4, matching the existing badge pattern in App.tsx):
  ```tsx
  <select className="text-xs bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-400 light:text-slate-600 light:bg-slate-100 light:border-slate-300 cursor-pointer focus:outline-none focus:border-slate-500" />
  ```

### Edge cases

| Scenario | Behaviour |
|----------|-----------|
| `providers` is empty or not loaded yet | Render nothing (return `null`) |
| Selected provider ID not in providers list | Reset to first available provider |
| Model list for selected provider is empty | Show a single `<option>` with "No models available" (disabled) |
| `selectedModel` not in current model list | Reset to `defaultModel` of current provider |

---

## 10. `frontend/src/App.tsx` — Provider/Model State Management

### New State Variables

```typescript
const [providers, setProviders] = useState<ProviderInfo[]>([]);
const [selectedProvider, setSelectedProvider] = useState<string>(() =>
  localStorage.getItem('specaudit-provider') ?? 'groq'
);
const [selectedModel, setSelectedModel] = useState<string>(() =>
  localStorage.getItem('specaudit-model') ?? ''
);
```

### Fetch Providers on Mount

Replace the existing `fetch('/api/config')` effect (lines 103-108) with:

```typescript
useEffect(() => {
  fetch('/api/providers')
    .then(r => r.json())
    .then(data => {
      setProviders(data);
      // If selectedProvider from localStorage is not in the list, reset
      if (data.length > 0 && !data.some((p: ProviderInfo) => p.id === selectedProvider)) {
        setSelectedProvider(data[0].id);
        setSelectedModel(data[0].defaultModel);
      }
      // If selectedModel is empty, set to default of selected provider
      const prov = data.find((p: ProviderInfo) => p.id === selectedProvider);
      if (prov && !selectedModel) {
        setSelectedModel(prov.defaultModel);
      }
    })
    .catch(() => setProviders([]));
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

### Persist to localStorage

```typescript
useEffect(() => {
  localStorage.setItem('specaudit-provider', selectedProvider);
}, [selectedProvider]);

useEffect(() => {
  localStorage.setItem('specaudit-model', selectedModel);
}, [selectedModel]);
```

### Update `handleSubmit`

```typescript
const handleSubmit = useCallback(
  (submitSpec: string, format?: 'yaml' | 'json') => {
    const record = history.addRecord({ ... });
    setCurrentAuditId(record.id);
    audit({ spec: submitSpec, specFormat: format, provider: selectedProvider, model: selectedModel });
  },
  [history, audit, selectedProvider, selectedModel]
);
```

### Update Provider Name Badge

Replace the existing provider badge (lines 201-205) to show the **currently selected** provider's name:

```tsx
{providers.length > 0 && (
  <span className="text-xs text-slate-500 bg-slate-900 border border-slate-800 rounded px-2 py-1 light:text-slate-600 light:bg-slate-100 light:border-slate-300">
    {providers.find(p => p.id === selectedProvider)?.name ?? selectedProvider}
  </span>
)}
```

### Add ProviderSelector to Header

Insert the `<ProviderSelector>` into the header area, before the ThemeToggle:

```tsx
<div className="flex items-center gap-3">
  {providers.length > 0 && (
    <ProviderSelector
      providers={providers}
      selectedProvider={selectedProvider}
      selectedModel={selectedModel}
      onProviderChange={(id) => {
        setSelectedProvider(id);
        const prov = providers.find(p => p.id === id);
        if (prov) setSelectedModel(prov.defaultModel);
      }}
      onModelChange={setSelectedModel}
    />
  )}
  {providers.length > 0 && (
    <span className="text-xs ...">
      {providers.find(p => p.id === selectedProvider)?.name ?? selectedProvider}
    </span>
  )}
  <ThemeToggle theme={theme} onToggle={toggle} />
</div>
```

---

## 11. `backend.Tests/EndpointValidationTests.cs` — Add Tests

### New Test: `GetProviders_ReturnsConfiguredProviders`

```csharp
[Fact]
public async Task GetProviders_ReturnsConfiguredProviders()
{
    // Uses the same factory with AiProviders added to InMemoryCollection
    var response = await _client.GetAsync("/api/providers");
    response.StatusCode.Should().Be(HttpStatusCode.OK);

    var json = await response.Content.ReadAsStringAsync();
    using var doc = JsonDocument.Parse(json);
    var arr = doc.RootElement.EnumerateArray().ToList();
    
    arr.Should().NotBeEmpty();
    arr.First().GetProperty("id").GetString().Should().NotBeNullOrEmpty();
    arr.First().GetProperty("name").GetString().Should().NotBeNullOrEmpty();
    arr.First().GetProperty("models").EnumerateArray().Should().NotBeEmpty();
    arr.First().GetProperty("defaultModel").GetString().Should().NotBeNullOrEmpty();
}
```

Update the constructor of `EndpointValidationTests` to also include `AiProviders` in the in-memory config:

```csharp
public EndpointValidationTests(WebApplicationFactory<Program> factory)
{
    _client = factory.WithWebHostBuilder(builder =>
        builder.ConfigureAppConfiguration((_, cfg) =>
            cfg.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Ai:ProviderName"]   = ProviderName,
                ["Ai:BaseUrl"]        = "https://test.example.com/v1",
                ["Ai:ModelId"]        = "test-model",
                ["Ai:ApiKey"]         = "test-key",
                ["Ai:MaxInputLength"] = "100000",
                ["AiProviders:groq:baseUrl"] = "https://api.groq.com/openai/v1/chat/completions",
                ["AiProviders:groq:defaultModel"] = "llama-3.3-70b-versatile",
                ["AiProviders:groq:models:0"] = "llama-3.3-70b-versatile",
                ["AiProviders:groq:models:1"] = "mixtral-8x7b-32768"
            })
        )
    ).CreateClient();
}
```

### Existing Test Updates

- **`GetConfig_ReturnsProviderName`**: Should still pass unchanged.
- **`GetConfig_DoesNotReturnApiKey`**: Should still pass unchanged.
- **`PostAudit_*` tests**: Should still pass unchanged — the `sanitizedRequest` now includes `Provider` and `Model` which will be null from the anonymous objects `{ spec = "" }`, and the service should handle nulls by falling back to defaults.

---

## 12. `frontend/src/components/ui/__tests__/ProviderSelector.test.tsx` — New Test File

```
describe('ProviderSelector')
  ├── it('renders provider dropdown with given providers')
  ├── it('renders model dropdown with models of selected provider')
  ├── it('calls onProviderChange when provider is changed')
  ├── it('calls onModelChange when model is changed')
  ├── it('updates models when provider changes')
  ├── it('renders nothing when providers array is empty')
  ├── it('shows "No models available" when model list is empty')
  └── it('displays selected provider and model as current values')
```

Follow the same testing pattern as `Button.test.tsx` and `ThemeToggle.test.tsx`.

---

## 13. `frontend/src/components/features/__tests__/App.test.tsx` — Update Mocks

### Mock `/api/providers` fetch

The existing mock uses `vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}))` which causes the fetch to hang indefinitely. This was done to avoid `act` warnings. For the provider dropdown tests, we need the fetch to resolve. Options:

**Option A (Recommended)**: Replace the hanging promise with a resolved one pointing to `/api/providers`:

```typescript
// In beforeEach, replace:
vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));

// With:
vi.spyOn(globalThis, 'fetch').mockImplementation((url: string) => {
  if (url === '/api/providers') {
    return Promise.resolve(new Response(JSON.stringify([
      { id: 'groq', name: 'Groq', models: ['llama-3.3-70b-versatile'], defaultModel: 'llama-3.3-70b-versatile' }
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }
  return new Promise(() => {}); // hang for other requests
});
```

**Option B**: Keep the hanging mock and simply don't test provider dropdown behavior in App tests (rely on ProviderSelector unit tests instead).

---

## Implementation Notes

- **Follow existing patterns**:
  - Named exports only (no default exports).
  - Backend: `init`-only properties, records for request models, `IOptions<T>` injection, `WebApplicationFactory` for integration tests.
  - Frontend: Props type defined as `interface ProviderSelectorProps`, Tailwind v4 class ordering (functional then color/size), dark mode via `light:` prefix.
  - The `ProviderSelector` should be a **new component file**, not inline in `App.tsx`, following the pattern of `ThemeToggle.tsx`.
- **No breaking changes**: Existing API consumers that omit `provider`/`model` from the request body will get defaults (`"groq"` and `"llama-3.3-70b-versatile"`).
- **API key**: The existing `Ai:ApiKey` env var / user-secret is used for ALL providers. No per-provider key support in this change.
- **Base URL handling**: The provider config's `baseUrl` is the **full chat completions URL** (e.g. `https://api.groq.com/openai/v1/chat/completions`). The old `Ai:BaseUrl` was just the base (e.g. `https://api.groq.com/openai/v1`). The code must handle both formats correctly.

---

## Verification

1. `cd backend && dotnet build` — 0 errors
2. `cd backend && dotnet test` — all existing tests pass (update `EndpointValidationTests` constructor and add new tests)
3. `cd frontend && npm run build` — 0 errors
4. `cd frontend && npm test` — all existing + new tests pass
5. Manual: dropdown shows providers from config, selecting a provider updates the model list, submitting an audit sends the selected provider/model, preference survives page reload via localStorage
