using FluentAssertions;
using SpecAudit.Services;
using Xunit;

namespace backend.Tests;

public class ExtractStructuredJsonTests
{
    [Fact]
    public void ExtractStructuredJson_WithValidJsonBlock_ReturnsJsonString()
    {
        var markdown = """
            # SpecAudit Report

            ## Summary
            **Total Findings:** 1

            ```json
            {"findings":[],"summary":{"totalFindings":1,"critical":0,"warnings":0,"info":0,"verdict":"PASS","governanceScore":100,"endpointsAnalyzed":1,"dimensions":{"security":25,"restConformance":25,"schemaCompleteness":25,"documentationQuality":25}}}
            ```
            """;

        var result = SpecAuditService.ExtractStructuredJson(markdown);

        result.Should().NotBeNull();
        result.Should().Contain("findings");
        result.Should().Contain("summary");
    }

    [Fact]
    public void ExtractStructuredJson_WithNoJsonBlock_ReturnsNull()
    {
        var markdown = """
            # SpecAudit Report

            ## Summary
            **Total Findings:** 0
            """;

        var result = SpecAuditService.ExtractStructuredJson(markdown);

        result.Should().BeNull();
    }

    [Fact]
    public void ExtractStructuredJson_WithInvalidJson_ReturnsNull()
    {
        var markdown = """
            # SpecAudit Report

            ```json
            { invalid json here }
            ```
            """;

        var result = SpecAuditService.ExtractStructuredJson(markdown);

        result.Should().BeNull();
    }

    [Fact]
    public void ExtractStructuredJson_WithMultipleJsonBlocks_ExtractsOnlyLast()
    {
        var markdown = "# SpecAudit Report\n\nSome text with a code block:\n\n```json\n{\"early\": true}\n```\n\nMore text and the final block:\n\n```json\n{\"findings\":[],\"summary\":{\"totalFindings\":0,\"critical\":0,\"warnings\":0,\"info\":0,\"verdict\":\"PASS\",\"governanceScore\":100,\"endpointsAnalyzed\":0,\"dimensions\":{\"security\":0,\"restConformance\":0,\"schemaCompleteness\":0,\"documentationQuality\":0}}}\n```\n";

        var result = SpecAuditService.ExtractStructuredJson(markdown);

        result.Should().NotBeNull();
        result.Should().Contain("findings");
        result.Should().NotContain("early");
    }

    [Fact]
    public void ExtractStructuredJson_WithEmptyCodeBlock_ReturnsNull()
    {
        var markdown = """
            # SpecAudit Report

            ```json
            ```
            """;

        var result = SpecAuditService.ExtractStructuredJson(markdown);

        result.Should().BeNull();
    }

    [Fact]
    public void ExtractStructuredJson_WithWhitespaceOnlyBlock_ReturnsNull()
    {
        var markdown = """
            # SpecAudit Report

            ```json
            
            
            ```
            """;

        var result = SpecAuditService.ExtractStructuredJson(markdown);

        result.Should().BeNull();
    }

    [Fact]
    public void ExtractStructuredJson_WithTextAfterJsonBlock_ReturnsJsonString()
    {
        var markdown = "# SpecAudit Report\n\n```json\n{\"findings\":[]}\n```\n\nSome trailing text after the code block.\n";

        var result = SpecAuditService.ExtractStructuredJson(markdown);

        // LastIndexOf approach allows text after the JSON block
        result.Should().NotBeNull();
        result.Should().Contain("findings");
    }
}
