namespace SpecAudit.Configuration;

public sealed class AiOptions
{
    public string ApiKey { get; init; } = string.Empty;
    public string BaseUrl { get; init; } = string.Empty;
    public string ModelId { get; init; } = string.Empty;
    public string ProviderName { get; init; } = "Custom";
    public int MaxTokens { get; init; } = 4096;
    public int MaxInputLength { get; init; } = 100_000;
}
