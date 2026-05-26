using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using SpecAudit.Configuration;
using SpecAudit.Models.Requests;
using SpecAudit.Services;

namespace SpecAudit.Endpoints;

public static class AuditEndpoints
{
    public static void MapAuditEndpoints(this WebApplication app)
    {
        app.MapPost("/api/audit", async (
            [FromBody] AuditRequest request,
            SpecAuditService auditService,
            HttpContext httpContext,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(request.Spec))
                return Results.BadRequest(new { error = "Spec payload cannot be empty." });

            if (request.Spec.Length > auditService.MaxInputLength)
                return Results.StatusCode(413);

            httpContext.Response.ContentType = "text/event-stream";
            httpContext.Response.Headers.CacheControl = "no-cache";
            httpContext.Response.Headers.Connection = "keep-alive";

            try
            {
                await foreach (var chunk in auditService.AuditAsync(request, ct))
                {
                    var encoded = JsonSerializer.Serialize(chunk);
                    await httpContext.Response.WriteAsync($"data: {encoded}\n\n", ct);
                    await httpContext.Response.Body.FlushAsync(ct);
                }
            }
            catch (OperationCanceledException)
            {
            }
            catch (Exception ex)
            {
                var sentinel = JsonSerializer.Serialize(
                    $"[SPECAUDIT_ERROR] {ex.Message}");
                await httpContext.Response.WriteAsync($"data: {sentinel}\n\n", ct);
                await httpContext.Response.Body.FlushAsync(ct);
            }

            return Results.Empty;
        });

        app.MapGet("/api/config", (IOptions<AiOptions> options) =>
            Results.Ok(new { providerName = options.Value.ProviderName }));
    }
}
