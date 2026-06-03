using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using SpecAudit.Configuration;
using SpecAudit.Endpoints;
using SpecAudit.Services;

var builder = WebApplication.CreateBuilder(args);

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
