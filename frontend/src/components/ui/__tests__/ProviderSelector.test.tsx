// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProviderSelector } from '../ProviderSelector';
import type { ProviderInfo } from '../ProviderSelector';

const mockProviders: ProviderInfo[] = [
  {
    id: 'groq',
    name: 'Groq',
    models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
    defaultModel: 'llama-3.3-70b-versatile',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    models: ['gpt-4o-mini', 'gpt-4o'],
    defaultModel: 'gpt-4o-mini',
  },
];

describe('ProviderSelector', () => {
  it('renders provider dropdown with given providers', () => {
    render(
      <ProviderSelector
        providers={mockProviders}
        selectedProvider="groq"
        selectedModel="llama-3.3-70b-versatile"
        onProviderChange={vi.fn()}
        onModelChange={vi.fn()}
      />
    );

    const providerSelect = screen.getByLabelText('Select AI provider');
    expect(providerSelect).toBeInTheDocument();

    const options = providerSelect.querySelectorAll('option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent('Groq');
    expect(options[1]).toHaveTextContent('OpenAI');
  });

  it('renders model dropdown with models of selected provider', () => {
    render(
      <ProviderSelector
        providers={mockProviders}
        selectedProvider="groq"
        selectedModel="llama-3.3-70b-versatile"
        onProviderChange={vi.fn()}
        onModelChange={vi.fn()}
      />
    );

    const modelSelect = screen.getByLabelText('Select model');
    expect(modelSelect).toBeInTheDocument();

    const options = modelSelect.querySelectorAll('option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveValue('llama-3.3-70b-versatile');
    expect(options[1]).toHaveValue('mixtral-8x7b-32768');
  });

  it('calls onProviderChange when provider is changed', () => {
    const onProviderChange = vi.fn();
    const onModelChange = vi.fn();

    render(
      <ProviderSelector
        providers={mockProviders}
        selectedProvider="groq"
        selectedModel="llama-3.3-70b-versatile"
        onProviderChange={onProviderChange}
        onModelChange={onModelChange}
      />
    );

    const providerSelect = screen.getByLabelText('Select AI provider');
    fireEvent.change(providerSelect, { target: { value: 'openai' } });

    expect(onProviderChange).toHaveBeenCalledWith('openai');
  });

  it('calls onModelChange when model is changed', () => {
    const onModelChange = vi.fn();

    render(
      <ProviderSelector
        providers={mockProviders}
        selectedProvider="groq"
        selectedModel="llama-3.3-70b-versatile"
        onProviderChange={vi.fn()}
        onModelChange={onModelChange}
      />
    );

    const modelSelect = screen.getByLabelText('Select model');
    fireEvent.change(modelSelect, { target: { value: 'mixtral-8x7b-32768' } });

    expect(onModelChange).toHaveBeenCalledWith('mixtral-8x7b-32768');
  });

  it('updates models when provider changes', () => {
    const onProviderChange = vi.fn();
    const onModelChange = vi.fn();

    const { rerender } = render(
      <ProviderSelector
        providers={mockProviders}
        selectedProvider="groq"
        selectedModel="llama-3.3-70b-versatile"
        onProviderChange={onProviderChange}
        onModelChange={onModelChange}
      />
    );

    // Change provider to OpenAI
    rerender(
      <ProviderSelector
        providers={mockProviders}
        selectedProvider="openai"
        selectedModel="gpt-4o-mini"
        onProviderChange={onProviderChange}
        onModelChange={onModelChange}
      />
    );

    const modelSelect = screen.getByLabelText('Select model');
    const options = modelSelect.querySelectorAll('option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveValue('gpt-4o-mini');
    expect(options[1]).toHaveValue('gpt-4o');
  });

  it('renders nothing when providers array is empty', () => {
    const { container } = render(
      <ProviderSelector
        providers={[]}
        selectedProvider=""
        selectedModel=""
        onProviderChange={vi.fn()}
        onModelChange={vi.fn()}
      />
    );

    expect(container.innerHTML).toBe('');
  });

  it('shows "No models available" when model list is empty', () => {
    const providersWithNoModels: ProviderInfo[] = [
      { id: 'custom', name: 'Custom', models: [], defaultModel: '' },
    ];

    render(
      <ProviderSelector
        providers={providersWithNoModels}
        selectedProvider="custom"
        selectedModel=""
        onProviderChange={vi.fn()}
        onModelChange={vi.fn()}
      />
    );

    const modelSelect = screen.getByLabelText('No models available');
    expect(modelSelect).toBeInTheDocument();
    expect(modelSelect).toBeDisabled();
    expect(screen.getByText('No models available')).toBeInTheDocument();
  });

  it('displays selected provider and model as current values', () => {
    render(
      <ProviderSelector
        providers={mockProviders}
        selectedProvider="openai"
        selectedModel="gpt-4o"
        onProviderChange={vi.fn()}
        onModelChange={vi.fn()}
      />
    );

    const providerSelect = screen.getByLabelText('Select AI provider');
    expect(providerSelect).toHaveValue('openai');

    const modelSelect = screen.getByLabelText('Select model');
    expect(modelSelect).toHaveValue('gpt-4o');
  });
});
