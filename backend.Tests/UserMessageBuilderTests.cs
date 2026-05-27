using FluentAssertions;
using SpecAudit.Models.Requests;
using SpecAudit.Services;
using Xunit;

namespace backend.Tests;

public class UserMessageBuilderTests
{
    [Fact]
    public void BuildUserMessage_WithYamlHint_IncludesFormatInMessage()
    {
        var request = new AuditRequest("spec: test", "yaml");
        var result = SpecAuditService.BuildUserMessage(request);
        result.Should().Contain("yaml");
        result.Should().Contain("spec: test");
    }

    [Fact]
    public void BuildUserMessage_WithNullFormat_FallsBackToAutoDetect()
    {
        var request = new AuditRequest("spec: test", null);
        var result = SpecAuditService.BuildUserMessage(request);
        result.Should().Contain("auto-detect");
    }

    [Fact]
    public void BuildUserMessage_SpecContentAppearsAfterFormatHint()
    {
        var request = new AuditRequest("openapi: 3.0.3", "json");
        var result = SpecAuditService.BuildUserMessage(request);
        var formatIndex = result.IndexOf("json", StringComparison.OrdinalIgnoreCase);
        var specIndex   = result.IndexOf("openapi: 3.0.3", StringComparison.OrdinalIgnoreCase);
        specIndex.Should().BeGreaterThan(formatIndex,
            "the spec content must appear after the format hint, not before it");
    }
}
