using System.Runtime.CompilerServices;
using Microsoft.Extensions.Options;
using SpecAudit.Configuration;
using SpecAudit.Models.Requests;

namespace SpecAudit.Services;

public sealed class SpecAuditService
{
    private readonly AiOptions _options;

    public SpecAuditService(IOptions<AiOptions> options)
    {
        _options = options.Value;
    }

    public int MaxInputLength => _options.MaxInputLength;

    public async IAsyncEnumerable<string> AuditAsync(
        AuditRequest request,
        [EnumeratorCancellation] CancellationToken ct)
    {
        yield return "test chunk";
    }
}
