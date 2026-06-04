namespace SpecAudit.Models.Requests;

public sealed record AuditRequest(
    string Spec,
    string? SpecFormat,
    string? Provider = null,
    string? Model = null
);
