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
    public void Startup_MissingBaseUrl_ThrowsInvalidOperationException()
    {
        var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
            builder.ConfigureAppConfiguration((_, cfg) =>
                cfg.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Ai:BaseUrl"]  = "",
                    ["Ai:ModelId"]  = "test-model",
                    ["Ai:ApiKey"]   = "test-key"
                })
            )
        );

        var act = () => factory.CreateClient();
        act.Should().Throw<Exception>()
            .WithMessage("*BaseUrl*");
    }

    [Fact]
    public void Startup_MissingModelId_ThrowsInvalidOperationException()
    {
        var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
            builder.ConfigureAppConfiguration((_, cfg) =>
                cfg.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Ai:BaseUrl"]  = "https://test.example.com/v1",
                    ["Ai:ModelId"]  = "",
                    ["Ai:ApiKey"]   = "test-key"
                })
            )
        );

        var act = () => factory.CreateClient();
        act.Should().Throw<Exception>()
            .WithMessage("*ModelId*");
    }
}
