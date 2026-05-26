namespace SpecAudit.Models.Requests;

public sealed record AuditRequest(
    string Spec,
    string? SpecFormat
);
