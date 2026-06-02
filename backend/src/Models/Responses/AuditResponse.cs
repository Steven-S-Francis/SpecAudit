namespace SpecAudit.Models.Responses;

public sealed record StructuredFinding(
    string Severity,      // "CRITICAL" | "WARNING" | "INFO"
    string Title,
    string Category,
    string Location,
    string Issue,
    string Recommendation
);

public sealed record StructuredDimensions(
    int Security,
    int RestConformance,
    int SchemaCompleteness,
    int DocumentationQuality
);

public sealed record StructuredSummary(
    int TotalFindings,
    int Critical,
    int Warnings,
    int Info,
    string Verdict,
    int GovernanceScore,
    int EndpointsAnalyzed,
    StructuredDimensions Dimensions
);

public sealed record StructuredData(
    List<StructuredFinding> Findings,
    StructuredSummary Summary
);
