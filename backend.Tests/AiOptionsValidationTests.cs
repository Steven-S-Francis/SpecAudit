using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace backend.Tests;

public class AiOptionsValidationTests
{
    [Fact]
    public void Startup_MissingApiKey_ThrowsInvalidOperationException()
    {
        var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
            builder.ConfigureAppConfiguration((_, cfg) =>
                cfg.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Ai:BaseUrl"]  = "https://test.example.com/v1",
                    ["Ai:ModelId"]  = "test-model",
                    ["Ai:ApiKey"]   = ""
                })
            )
        );

        var act = () => factory.CreateClient();
        act.Should().Throw<Exception>()
            .WithMessage("*ApiKey*");
    }

    [Fact]
    public void Startup_MissingBaseUrl_DoesNotThrow_WhenProvidersConfigured()
    {
        var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
            builder.ConfigureAppConfiguration((_, cfg) =>
                cfg.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Ai:BaseUrl"]           = "",
                    ["Ai:ModelId"]           = "fallback-model",
                    ["Ai:ApiKey"]            = "test-key",
                    ["AiProviders:Providers:groq:baseUrl"] = "https://api.groq.com/openai/v1/chat/completions",
                    ["AiProviders:Providers:groq:defaultModel"] = "llama-3.3-70b-versatile",
                    ["AiProviders:Providers:groq:models:0"] = "llama-3.3-70b-versatile"
                })
            )
        );

        var act = () => factory.CreateClient();
        act.Should().NotThrow();
    }

    [Fact]
    public void Startup_MissingModelId_DoesNotThrow_WhenProvidersConfigured()
    {
        var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
            builder.ConfigureAppConfiguration((_, cfg) =>
                cfg.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Ai:BaseUrl"]           = "https://test.example.com/v1",
                    ["Ai:ModelId"]           = "",
                    ["Ai:ApiKey"]            = "test-key",
                    ["AiProviders:Providers:groq:baseUrl"] = "https://api.groq.com/openai/v1/chat/completions",
                    ["AiProviders:Providers:groq:defaultModel"] = "llama-3.3-70b-versatile",
                    ["AiProviders:Providers:groq:models:0"] = "llama-3.3-70b-versatile"
                })
            )
        );

        var act = () => factory.CreateClient();
        act.Should().NotThrow();
    }
}
