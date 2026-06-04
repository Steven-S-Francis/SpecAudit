using System.Net.Http.Headers;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;

using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SpecAudit.Configuration;
using SpecAudit.Models.Requests;

namespace SpecAudit.Services;

public sealed class SpecAuditService
{
    private const string SystemPrompt = """
        You are a strict API Governance Architect performing a formal security and design audit of an OpenAPI specification. Your role is regulatory, not advisory. You identify violations, not suggestions.

        Analyze the provided OpenAPI YAML or JSON specification and produce a structured audit report. You must examine every path, method, parameter, response, schema, and security definition present in the spec.

        Check for ALL of the following categories without exception:

        SECURITY CHECKS:
        - Absence of a global or operation-level securitySchemes definition
        - Endpoints that mutate state (POST, PUT, PATCH, DELETE) with no security requirement
        - Use of HTTP instead of HTTPS in server URLs
        - API keys passed as query parameters instead of headers
        - Missing or overly permissive CORS definitions
        - Absence of rate limiting headers in response definitions (X-RateLimit-*)
        - JWT/OAuth scopes that are too broad or undefined

        REST CONVENTION CHECKS:
        - Resource names using verbs instead of nouns (e.g., /getUser instead of /users/{id})
        - Incorrect HTTP method usage (e.g., GET used for state-changing operations)
        - Missing plural resource naming for collection endpoints
        - Nested resource paths exceeding 3 levels of depth
        - Non-standard success status codes (e.g., 200 returned for resource creation instead of 201)
        - Missing 404 response definition on endpoints with path parameters
        - Missing 400 response definition on endpoints that accept a request body
        - Missing 401 and 403 response definitions on secured endpoints
        - Absence of a 500 response definition

        SCHEMA AND DOCUMENTATION CHECKS:
        - Request body with no schema defined
        - Response body with no schema defined (especially 200/201 responses)
        - Schema properties with no type defined
        - Missing `description` field on any path, operation, or parameter
        - Missing `summary` field on any operation
        - Absence of an `info.contact` block
        - No `tags` defined on operations (inhibits SDK generation grouping)
        - `additionalProperties: true` on response schemas (breaks strict deserialization)

        NAMING AND CONSISTENCY CHECKS:
        - Inconsistent casing in path parameters (e.g., mixing camelCase and snake_case)
        - Inconsistent casing in query parameter names across the spec
        - Inconsistent response envelope structure across endpoints
        - Duplicate operation IDs

        Respond ONLY in the following exact Markdown format. Do not include any preamble, greeting, or closing statement. Do not deviate from this structure:

        ---

        # SpecAudit Report

        ## Summary
        **Total Findings:** {N} | **Critical:** {N} | **Warnings:** {N} | **Info:** {N}

        **Spec Format:** {OpenAPI 3.x / Swagger 2.0}
        **Endpoints Analyzed:** {N}
        **Audit Verdict:** {FAIL | PASS WITH WARNINGS | PASS}

        ---

        ## Findings

        {For each finding, use one of the three blocks below. Order findings by severity: all CRITICAL first, then WARNING, then INFO.}

        ### [CRITICAL] {Finding Title}
        **Category:** {Security | REST Violation | Schema | Naming | Consistency}
        **Location:** `{path/method or "Global"}` 
        **Issue:** {One to two sentences describing the exact problem and why it is a violation.}
        **Recommendation:** {Concrete, implementable fix. Include a YAML snippet if a schema or definition change is required.}

        ---

        ### [WARNING] {Finding Title}
        **Category:** {Security | REST Violation | Schema | Naming | Consistency}
        **Location:** `{path/method or "Global"}`
        **Issue:** {One to two sentences.}
        **Recommendation:** {Concrete fix.}

        ---

        ### [INFO] {Finding Title}
        **Category:** {Security | REST Violation | Schema | Naming | Consistency}
        **Location:** `{path/method or "Global"}`
        **Issue:** {One to two sentences.}
        **Recommendation:** {Concrete fix.}

        ---

        ## Governance Score

        **API Governance Score: {0–100}/100**

        | Dimension | Score |
        |---|---|
        | Security | {0–25}/25 |
        | REST Conformance | {0–25}/25 |
        | Schema Completeness | {0–25}/25 |
        | Documentation Quality | {0–25}/25 |

        **Rationale:** {Two to three sentences explaining the score, referencing the most severe findings.}

        AFTER your complete markdown report, append a JSON code block at the very end with the structured findings summary. The JSON block must be the very last content — no text after it.

        ```json
        {
          "findings": [
            {
              "severity": "CRITICAL",
              "title": "Missing Security Scheme Definition",
              "category": "Security",
              "location": "Global",
              "issue": "description...",
              "recommendation": "fix..."
            }
          ],
          "summary": {
            "totalFindings": 14,
            "critical": 6,
            "warnings": 4,
            "info": 4,
            "verdict": "FAIL",
            "governanceScore": 60,
            "endpointsAnalyzed": 2,
            "dimensions": {
              "security": 15,
              "restConformance": 15,
              "schemaCompleteness": 10,
              "documentationQuality": 20
            }
          }
        }
        ```

        The `findings` array must contain one entry per finding block in the report, in the same order. The `summary` must reflect the same numbers as the human-readable report summary. Ensure severity values match exactly: "CRITICAL", "WARNING", or "INFO".
        """;

    private const string StructuredSentinel = "[SPECAUDIT_STRUCTURED]";

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

        // OpenAI client now created per-request in AuditAsync

        _logger.LogInformation("SpecAuditService initialized for model {ModelId} at {BaseUrl}",
            _options.ModelId, _options.BaseUrl);
    }

    public int MaxInputLength => _options.MaxInputLength;

    public async IAsyncEnumerable<string> AuditAsync(
        AuditRequest request,
        [EnumeratorCancellation] CancellationToken ct)
    {
        using var client = new HttpClient();
        client.Timeout = TimeSpan.FromSeconds(45);

        // Resolve provider and model
        var providerId = request.Provider;
        string? resolvedModel = request.Model;
        string baseUrl;

        if (!string.IsNullOrEmpty(providerId) &&
            _providerConfig.Providers.TryGetValue(providerId, out var providerCfg))
        {
            // Use the provider config
            baseUrl = !string.IsNullOrEmpty(providerCfg.BaseUrl)
                ? providerCfg.BaseUrl.TrimEnd('/')
                : $"{_options.BaseUrl.TrimEnd('/')}/chat/completions";
            resolvedModel ??= providerCfg.DefaultModel;
        }
        else
        {
            // Fall back to AiOptions defaults
            baseUrl = $"{_options.BaseUrl.TrimEnd('/')}/chat/completions";
        }

        resolvedModel ??= _options.ModelId;

        var systemMessage = new { role = "system", content = SystemPrompt };
        var userMessage = new { role = "user", content = BuildUserMessage(request) };

        var payload = new
        {
            model = resolvedModel,
            messages = new[] { systemMessage, userMessage },
            max_tokens = _options.MaxTokens,
            temperature = 0.1f,
            stream = true
        };

        var jsonPayload = JsonSerializer.Serialize(payload);

        _logger.LogInformation("Starting AI audit stream for provider={Provider} model={Model} ({Length} chars)",
            providerId ?? "default", resolvedModel, request.Spec.Length);

        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, baseUrl)
        {
            Content = new StringContent(jsonPayload, Encoding.UTF8, "application/json")
        };
        httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);

        using var httpResponse = await client.SendAsync(
            httpRequest,
            HttpCompletionOption.ResponseHeadersRead,
            ct);

        httpResponse.EnsureSuccessStatusCode();

        using var responseStream = await httpResponse.Content.ReadAsStreamAsync(ct);
        using var reader = new StreamReader(responseStream);

        var fullText = new StringBuilder();
        string? line;

        while ((line = await reader.ReadLineAsync(ct)) is not null)
        {
            if (string.IsNullOrEmpty(line))
                continue;

            if (!line.StartsWith("data: ", StringComparison.Ordinal))
                continue;

            var data = line.AsSpan(6);

            if (data is ['[', 'D', 'O', 'N', 'E', ']'])
                break;

            string? deltaContent = null;
            try
            {
                using var doc = JsonDocument.Parse(data.ToString());
                var root = doc.RootElement;

                if (!root.TryGetProperty("choices", out var choices) || choices.GetArrayLength() == 0)
                    continue;

                if (!choices[0].TryGetProperty("delta", out var delta))
                    continue;

                if (!delta.TryGetProperty("content", out var contentEl) ||
                    contentEl.ValueKind != JsonValueKind.String)
                    continue;

                deltaContent = contentEl.GetString();
            }
            catch (JsonException ex)
            {
                _logger.LogWarning(ex, "SSE parse warning for chunk: {Data}", data.ToString());
            }

            if (!string.IsNullOrEmpty(deltaContent))
            {
                fullText.Append(deltaContent);
                yield return deltaContent;
            }
        }

        _logger.LogInformation("AI audit stream completed ({TokenCount} chars received)", fullText.Length);

        var structuredJson = ExtractStructuredJson(fullText.ToString());
        if (structuredJson is not null)
        {
            var findingsCount = 0;
            try
            {
                using var doc = JsonDocument.Parse(structuredJson);
                if (doc.RootElement.TryGetProperty("summary", out var summary) &&
                    summary.TryGetProperty("totalFindings", out var total))
                {
                    findingsCount = total.GetInt32();
                }
            }
            catch (JsonException) { }
            _logger.LogInformation("Structured JSON extracted ({FindingsCount} findings)", findingsCount);
            yield return $"[SPECAUDIT_STRUCTURED]{structuredJson}";
        }
        else
        {
            _logger.LogInformation("No structured JSON found in response");
        }
    }

    internal static string BuildUserMessage(AuditRequest request)
    {
        var format = request.SpecFormat ?? "auto-detect";
        return $"Analyze the following OpenAPI specification (format: {format}):\n\n{request.Spec}";
    }

    internal static string? ExtractStructuredJson(string markdown)
    {
        const string openFence = "```json";
        const string closeFence = "```";

        var lastOpen = markdown.LastIndexOf(openFence, StringComparison.Ordinal);
        if (lastOpen < 0)
            return null;

        var jsonStart = lastOpen + openFence.Length;
        var closeStart = markdown.IndexOf(closeFence, jsonStart, StringComparison.Ordinal);
        if (closeStart < 0)
            return null;

        var json = markdown[jsonStart..closeStart].Trim();
        if (string.IsNullOrEmpty(json))
            return null;

        try
        {
            using var doc = JsonDocument.Parse(json);
            return json;
        }
        catch (JsonException)
        {
            return null;
        }
    }
}


