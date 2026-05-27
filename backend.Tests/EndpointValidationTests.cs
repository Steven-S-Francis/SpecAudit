using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace backend.Tests;

public class EndpointValidationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public EndpointValidationTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.WithWebHostBuilder(builder =>
            builder.ConfigureAppConfiguration((_, cfg) =>
                cfg.AddInMemoryCollection(new Dictionary<string, string?>
                {
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
}
