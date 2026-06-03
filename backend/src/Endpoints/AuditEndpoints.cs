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
            var spec = request.Spec.Trim();

            if (string.IsNullOrWhiteSpace(spec))
                return Results.BadRequest(new { error = "Spec payload cannot be empty." });

            if (spec.Length > auditService.MaxInputLength)
                return Results.StatusCode(413);

            httpContext.Response.ContentType = "text/event-stream";
            httpContext.Response.Headers.CacheControl = "no-cache";
            httpContext.Response.Headers.Connection = "keep-alive";

            var sanitizedRequest = new AuditRequest(spec, request.SpecFormat);

            try
            {
                await foreach (var chunk in auditService.AuditAsync(sanitizedRequest, ct))
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
                var message = ex.Message.Contains("429")
                    ? "Rate limit reached. Please wait a moment and try again, or switch to a provider with higher limits."
                    : "An error occurred. Please try again.";
                var sentinel = JsonSerializer.Serialize($"[SPECAUDIT_ERROR] {message}");
                await httpContext.Response.WriteAsync($"data: {sentinel}\n\n", ct);
                await httpContext.Response.Body.FlushAsync(ct);
            }

            return Results.Empty;
        });

        app.MapGet("/api/config", (IOptions<AiOptions> options) =>
            Results.Ok(new { providerName = options.Value.ProviderName }));
    }
}
