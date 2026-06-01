using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace backend.Tests;

public class EndpointValidationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;
    private const string ProviderName = "TestProvider";

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
                    ["Ai:MaxInputLength"] = "100000"
                })
            )
        ).CreateClient();
    }

    [Fact]
    public async Task PostAudit_EmptySpec_Returns400()
    {
        var response = await _client.PostAsJsonAsync("/api/audit", new { spec = "" });
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task PostAudit_WhitespaceOnlySpec_Returns400()
    {
        var response = await _client.PostAsJsonAsync("/api/audit", new { spec = "   " });
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task PostAudit_SpecExceedsMaxLength_Returns413()
    {
        var oversized = new string('a', 100_001);
        var response  = await _client.PostAsJsonAsync("/api/audit", new { spec = oversized });
        response.StatusCode.Should().Be(HttpStatusCode.RequestEntityTooLarge);
    }

    [Fact]
    public async Task PostAudit_TrimmedSpec_AcceptsSpec()
    {
        // Spec with leading/trailing whitespace — after Trim() it becomes valid
        var response = await _client.PostAsJsonAsync("/api/audit", new { spec = "  openapi: 3.0.3  " });
        // After trimming, the spec is not empty and not oversized, so it proceeds to SSE streaming.
        // Since there is no real AI endpoint, it will return 200 with an error sentinel in the body.
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetConfig_ReturnsProviderName()
    {
        var response = await _client.GetAsync("/api/config");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        doc.RootElement.GetProperty("providerName").GetString().Should().Be(ProviderName);
    }

    [Fact]
    public async Task GetConfig_DoesNotReturnApiKey()
    {
        var response = await _client.GetAsync("/api/config");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);

        // providerName must be present
        doc.RootElement.TryGetProperty("providerName", out _).Should().BeTrue();

        // apiKey must NOT be present in the response
        doc.RootElement.TryGetProperty("apiKey", out _).Should().BeFalse();
        doc.RootElement.TryGetProperty("ApiKey", out _).Should().BeFalse();
    }
}
