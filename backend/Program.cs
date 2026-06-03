using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using SpecAudit.Configuration;
using SpecAudit.Endpoints;
using SpecAudit.Services;
using Sentry;
using Sentry.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// Sentry error tracking (optional — only active when Sentry__Dsn is set)
if (!string.IsNullOrWhiteSpace(builder.Configuration["Sentry:Dsn"]))
{
    // Use explicit delegate type to disambiguate Action<SentryAspNetCoreOptions>
    // from Action<ISentryBuilder> (both exist on the same method)
    builder.WebHost.UseSentry((Action<SentryAspNetCoreOptions>)(options =>
    {
        options.Dsn = builder.Configuration["Sentry:Dsn"]!;
        options.SendDefaultPii = false;
        options.TracesSampleRate = 0.25;
        options.SetBeforeSend(sentryEvent =>
        {
            var apiKey = builder.Configuration["Ai:ApiKey"];
            if (!string.IsNullOrEmpty(apiKey) && sentryEvent != null)
            {
                // Flag if API key appears in the exception message (cannot safely mutate Exception.Message)
                if (sentryEvent.Exception?.Message?.Contains(apiKey, StringComparison.OrdinalIgnoreCase) == true)
                {
                    sentryEvent.SetExtra("api_key_redacted", true);
                }

                // Redact from message formatted text (mutable)
                if (sentryEvent.Message?.Formatted?.Contains(apiKey, StringComparison.OrdinalIgnoreCase) == true)
                {
                    sentryEvent.Message.Formatted = sentryEvent.Message.Formatted.Replace(
                        apiKey, "[REDACTED]", StringComparison.OrdinalIgnoreCase);
                }

                // Flag if API key found in any breadcrumb (Breadcrumb.Message is init-only, so we cannot mutate it)
                if (sentryEvent.Breadcrumbs?.Any(
                        b => b.Message?.Contains(apiKey, StringComparison.OrdinalIgnoreCase) == true) == true)
                {
                    sentryEvent.SetExtra("api_key_in_breadcrumbs", true);
                }

                // Scrub extra data values (use SetExtra which replaces the internal dictionary)
                if (sentryEvent.Extra?.Count > 0)
                {
                    var keys = sentryEvent.Extra.Keys.ToList();
                    foreach (var key in keys)
                    {
                        if (sentryEvent.Extra[key] is string str && str.Contains(apiKey, StringComparison.OrdinalIgnoreCase))
                        {
                            sentryEvent.SetExtra(key, str.Replace(apiKey, "[REDACTED]", StringComparison.OrdinalIgnoreCase));
                        }
                    }
                }
            }
            return sentryEvent;
        });
    }));
}

builder.Services.Configure<AiOptions>(builder.Configuration.GetSection("Ai"));
builder.Services.AddSingleton<SpecAuditService>();
builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyMethod()
              .AllowAnyHeader());
});

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;
    options.AddPolicy("AuditPolicy", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            }));
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseCors("FrontendPolicy");
}
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseRateLimiter();
app.MapAuditEndpoints();
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));
app.MapFallbackToFile("index.html");

var aiOptions = app.Services.GetRequiredService<IOptions<AiOptions>>().Value;
if (string.IsNullOrWhiteSpace(aiOptions.BaseUrl) || string.IsNullOrWhiteSpace(aiOptions.ModelId) || string.IsNullOrWhiteSpace(aiOptions.ApiKey))
    throw new InvalidOperationException("Ai:BaseUrl, Ai:ModelId, and Ai:ApiKey must be configured in appsettings.json or user-secrets.");

app.Run("http://+:5000");

public partial class Program { }
