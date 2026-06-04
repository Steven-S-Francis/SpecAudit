import { useEffect, useRef } from 'react';

export interface ProviderInfo {
  id: string;
  name: string;
  models: string[];
  defaultModel: string;
}

interface ProviderSelectorProps {
  providers: ProviderInfo[];
  selectedProvider: string;
  selectedModel: string;
  onProviderChange: (providerId: string) => void;
  onModelChange: (model: string) => void;
}

export function ProviderSelector({
  providers,
  selectedProvider,
  selectedModel,
  onProviderChange,
  onModelChange,
}: ProviderSelectorProps) {
  const initialSyncDone = useRef(false);

  // If providers list is empty, render nothing
  if (providers.length === 0) {
    return null;
  }

  // Find the current provider object
  const currentProvider = providers.find(p => p.id === selectedProvider);
  const currentModels = currentProvider?.models ?? [];
  const modelIsValid = currentModels.includes(selectedModel);

  // If selectedProvider is not in the list, reset to first available provider
  useEffect(() => {
    if (providers.length > 0 && !providers.some(p => p.id === selectedProvider)) {
      const first = providers[0];
      onProviderChange(first.id);
      onModelChange(first.defaultModel);
    }
  }, [providers, selectedProvider, onProviderChange, onModelChange]);

  // When selectedProvider changes, ensure model is valid for the new provider
  useEffect(() => {
    if (!currentProvider) return;

    if (!currentModels.includes(selectedModel)) {
      onModelChange(currentProvider.defaultModel);
    }
  }, [selectedProvider]); // eslint-disable-line react-hooks/exhaustive-deps

  // On initial load, if selectedModel is empty, set to current provider's default
  useEffect(() => {
    if (!initialSyncDone.current && currentProvider && !selectedModel) {
      initialSyncDone.current = true;
      onModelChange(currentProvider.defaultModel);
    }
  }, [currentProvider, selectedModel, onModelChange]);

  const selectClassName =
    'text-xs bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-400 light:text-slate-600 light:bg-slate-100 light:border-slate-300 cursor-pointer focus:outline-none focus:border-slate-500';

  return (
    <div className="flex items-center gap-2">
      <select
        className={selectClassName}
        value={selectedProvider}
        onChange={(e) => {
          const newProviderId = e.target.value;
          const newProvider = providers.find(p => p.id === newProviderId);
          if (newProvider) {
            onProviderChange(newProviderId);
            onModelChange(newProvider.defaultModel);
          }
        }}
        aria-label="Select AI provider"
      >
        {providers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      {currentModels.length > 0 ? (
        <select
          className={selectClassName}
          value={modelIsValid ? selectedModel : (currentProvider?.defaultModel ?? '')}
          onChange={(e) => onModelChange(e.target.value)}
          aria-label="Select model"
        >
          {currentModels.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      ) : (
        <select
          className={selectClassName}
          disabled
          aria-label="No models available"
        >
          <option value="" disabled>
            No models available
          </option>
        </select>
      )}
    </div>
  );
}
