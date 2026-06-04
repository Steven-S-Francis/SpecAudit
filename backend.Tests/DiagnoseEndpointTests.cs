using System.Net;
using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace backend.Tests;

public class DiagnoseEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public DiagnoseEndpointTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.WithWebHostBuilder(builder =>
            builder.ConfigureAppConfiguration((_, cfg) =>
                cfg.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Ai:ProviderName"]   = "TestProvider",
                    ["Ai:BaseUrl"]        = "http://localhost:1",
                    ["Ai:ModelId"]        = "test-model",
                    ["Ai:ApiKey"]         = "test-key",
                    ["Ai:MaxInputLength"] = "100000"
                })
            )
        ).CreateClient();
    }

    [Fact]
    public async Task GetDiagnose_ReturnsJsonWithGroqStatusElapsedMsAndOk()
    {
        // Test 1: Verify the endpoint returns JSON with groqStatus, elapsedMs, ok fields
        var response = await _client.GetAsync("/api/diagnose");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);

        doc.RootElement.TryGetProperty("groqStatus", out var groqStatus).Should().BeTrue();
        doc.RootElement.TryGetProperty("elapsedMs", out var elapsedMs).Should().BeTrue();
        doc.RootElement.TryGetProperty("ok", out var ok).Should().BeTrue();

        groqStatus.ValueKind.Should().Be(JsonValueKind.Number);
        elapsedMs.ValueKind.Should().Be(JsonValueKind.Number);
        ok.ValueKind.Should().BeOneOf(JsonValueKind.True, JsonValueKind.False);
    }

    [Fact]
    public async Task GetDiagnose_UsesOptionsInjection()
    {
        // Test 2: Verify IOptions<AiOptions> is properly injected.
        // The endpoint reads BaseUrl and ApiKey from the injected options.
        // A 200 OK response (rather than 500 Internal Server Error) proves
        // that the dependency injection is wired correctly.
        var response = await _client.GetAsync("/api/diagnose");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);

        // Verify the endpoint actually executed by checking elapsedMs is positive
        doc.RootElement.GetProperty("elapsedMs").GetInt64().Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task GetDiagnose_HandlesChatCompletionsFailureGracefully()
    {
        // Test 3: Verify the endpoint handles chat completions failure
        // (connection refused) gracefully (returns ok: false without throwing).
        // The configured BaseUrl (http://localhost:1) will cause a connection
        // refused error, which is caught by the endpoint's catch block.
        var response = await _client.GetAsync("/api/diagnose");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);

        doc.RootElement.GetProperty("ok").GetBoolean().Should().BeFalse();
        doc.RootElement.GetProperty("groqStatus").GetInt32().Should().Be(0);

        // An error message should be present in the failure case
        doc.RootElement.TryGetProperty("error", out var error).Should().BeTrue();
        error.GetString().Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task GetDiagnose_RespondsWithinReasonableTime()
    {
        // Test 4: Verify the endpoint responds within its own 10s timeout.
        // On Windows, connecting to a closed port on localhost can take ~4s due
        // to the TCP stack behavior. We assert < 9s to leave room for CI variance
        // while still verifying the endpoint does not hang past its timeout.
        var sw = System.Diagnostics.Stopwatch.StartNew();
        var response = await _client.GetAsync("/api/diagnose");
        sw.Stop();

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        sw.ElapsedMilliseconds.Should().BeLessThan(9000);
    }

    [Fact]
    public async Task GetDiagnoseDefault_IsRawMode()
    {
        // The default (no mode param) should produce raw-mode response shape:
        // { groqStatus, elapsedMs, ok, message } — NOT { response, finishReason }
        var response = await _client.GetAsync("/api/diagnose");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);

        // Raw mode has "error" (connection fails) but not "response" or "finishReason"
        // (Since BaseUrl=http://localhost:1 always fails, raw mode returns the error shape)
        doc.RootElement.TryGetProperty("error", out _).Should().BeTrue();
        doc.RootElement.TryGetProperty("response", out _).Should().BeFalse();
        doc.RootElement.TryGetProperty("finishReason", out _).Should().BeFalse();
    }

    [Fact]
    public async Task GetDiagnoseSdkMode_ReturnsExpectedContract()
    {
        // SDK mode response shape: { groqStatus, elapsedMs, ok, error? }
        // (The configured BaseUrl http://localhost:1 triggers connection refused,
        //  so we test the failure contract.)
        var response = await _client.GetAsync("/api/diagnose?mode=sdk");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);

        doc.RootElement.TryGetProperty("groqStatus", out var groqStatus).Should().BeTrue();
        doc.RootElement.TryGetProperty("elapsedMs", out var elapsedMs).Should().BeTrue();
        doc.RootElement.TryGetProperty("ok", out var ok).Should().BeTrue();

        groqStatus.ValueKind.Should().Be(JsonValueKind.Number);
        elapsedMs.ValueKind.Should().Be(JsonValueKind.Number);
        ok.ValueKind.Should().BeOneOf(JsonValueKind.True, JsonValueKind.False);

        // Since localhost:1 will fail, ok should be false
        ok.GetBoolean().Should().BeFalse();
        groqStatus.GetInt32().Should().Be(0);

        // Error message should be present
        doc.RootElement.TryGetProperty("error", out var error).Should().BeTrue();
        error.GetString().Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task GetDiagnoseSdkMode_HandlesFailureGracefully()
    {
        // Verify SDK mode handles connection failure without throwing
        var response = await _client.GetAsync("/api/diagnose?mode=sdk");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);

        doc.RootElement.GetProperty("ok").GetBoolean().Should().BeFalse();
        doc.RootElement.GetProperty("elapsedMs").GetInt64().Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task GetDiagnose_InvalidModeFallsBackToRaw()
    {
        // An unrecognized mode value should fall back to raw
        var response = await _client.GetAsync("/api/diagnose?mode=invalid");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);

        // Should have raw-mode fields (error, since connection to localhost:1 always fails)
        doc.RootElement.TryGetProperty("error", out _).Should().BeTrue();
        doc.RootElement.TryGetProperty("response", out _).Should().BeFalse();
    }
}
