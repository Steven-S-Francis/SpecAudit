using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Sentry;
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

            var loggerFactory = httpContext.RequestServices.GetRequiredService<ILoggerFactory>();
            var logger = loggerFactory.CreateLogger("SpecAudit.Endpoints.AuditEndpoints");
            logger.LogInformation("Audit request: {SpecLength} chars, format: {Format}",
                spec.Length, request.SpecFormat ?? "none");

            httpContext.Response.ContentType = "text/event-stream";
            httpContext.Response.Headers.CacheControl = "no-cache";
            httpContext.Response.Headers.Connection = "keep-alive";

            var sanitizedRequest = new AuditRequest(spec, request.SpecFormat);

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(45));
            var token = cts.Token;

            try
            {
                await foreach (var chunk in auditService.AuditAsync(sanitizedRequest, token))
                {
                    token.ThrowIfCancellationRequested();  // Check timeout between chunks

                    var encoded = JsonSerializer.Serialize(chunk);
                    await httpContext.Response.WriteAsync($"data: {encoded}\n\n", token);
                    await httpContext.Response.Body.FlushAsync(token);
                }
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                // Client aborted the connection — silent no-op
                logger.LogInformation("Client disconnected (Escape/abort)");
            }
            catch (OperationCanceledException)
            {
                // Server-side 45-second timeout — send error to client
                logger.LogInformation("Request timed out after 45s");
                var sentinel = JsonSerializer.Serialize("[SPECAUDIT_ERROR] The request timed out. Please try again.");
                await httpContext.Response.WriteAsync($"data: {sentinel}\n\n", CancellationToken.None);
                await httpContext.Response.Body.FlushAsync(CancellationToken.None);
            }
            catch (Exception ex)
            {
                // Capture the caught exception in Sentry so it's not lost
                logger.LogError(ex, "Audit error: {Message}", ex.Message);
                SentrySdk.CaptureException(ex);

                var message = ex.Message.Contains("429")
                    ? "Rate limit reached. Please wait a moment and try again, or switch to a provider with higher limits."
                    : ex is OperationCanceledException
                        ? "The request timed out. Please try again."
                        : "An error occurred. Please try again.";
                var sentinel = JsonSerializer.Serialize($"[SPECAUDIT_ERROR] {message}");
                await httpContext.Response.WriteAsync($"data: {sentinel}\n\n", ct);
                await httpContext.Response.Body.FlushAsync(ct);
            }

            logger.LogInformation("Audit request completed");
            return Results.Empty;
        }).RequireRateLimiting("AuditPolicy");

        app.MapGet("/api/config", (IOptions<AiOptions> options) =>
            Results.Ok(new { providerName = options.Value.ProviderName }));

        app.MapGet("/api/diagnose", async (IOptions<AiOptions> options, ILoggerFactory loggerFactory) =>
        {
            var logger = loggerFactory.CreateLogger("SpecAudit.Diagnose");
            var aiOptions = options.Value;

            using var client = new HttpClient();
            client.BaseAddress = new Uri(aiOptions.BaseUrl);
            client.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", aiOptions.ApiKey);
            client.Timeout = TimeSpan.FromSeconds(10);

            var sw = System.Diagnostics.Stopwatch.StartNew();
            try
            {
                var response = await client.GetAsync("models");
                sw.Stop();
                var statusCode = (int)response.StatusCode;
                logger.LogInformation(
                    "Diagnose: Groq models endpoint returned {StatusCode} in {Elapsed}ms",
                    statusCode, sw.ElapsedMilliseconds);
                return Results.Ok(new
                {
                    groqStatus = statusCode,
                    elapsedMs = sw.ElapsedMilliseconds,
                    ok = statusCode == 200
                });
            }
            catch (Exception ex)
            {
                sw.Stop();
                logger.LogError(ex,
                    "Diagnose: Groq models endpoint failed after {Elapsed}ms",
                    sw.ElapsedMilliseconds);
                return Results.Ok(new
                {
                    groqStatus = 0,
                    elapsedMs = sw.ElapsedMilliseconds,
                    ok = false,
                    error = ex.Message
                });
            }
        });

        app.MapGet("/api/test-error", () =>
        {
            throw new Exception("This is a SpecAudit test exception to verify Sentry integration.");
        });
    }
}

