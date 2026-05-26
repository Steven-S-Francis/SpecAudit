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

var app = builder.Build();
app.UseCors("FrontendPolicy");
app.MapAuditEndpoints();
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

var aiOptions = app.Services.GetRequiredService<IOptions<AiOptions>>().Value;
if (string.IsNullOrWhiteSpace(aiOptions.BaseUrl) || string.IsNullOrWhiteSpace(aiOptions.ModelId))
    throw new InvalidOperationException("Ai:BaseUrl and Ai:ModelId must be configured in appsettings.json.");

app.Run("http://+:5000");
