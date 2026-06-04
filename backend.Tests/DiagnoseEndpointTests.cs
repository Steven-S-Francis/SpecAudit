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
    public async Task GetDiagnose_HandlesUnreachableEndpointGracefully()
    {
        // Test 3: Verify the endpoint handles missing/invalid API key or
        // unreachable endpoint gracefully (returns ok: false without throwing).
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
}
