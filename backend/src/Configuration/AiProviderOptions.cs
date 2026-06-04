namespace SpecAudit.Configuration;

public sealed class AiProviderOptions
{
    public string BaseUrl { get; init; } = string.Empty;
    public string DefaultModel { get; init; } = string.Empty;
    public List<string> Models { get; init; } = new();
}

public sealed class AiProvidersConfig
{
    public Dictionary<string, AiProviderOptions> Providers { get; init; } = new();
}
