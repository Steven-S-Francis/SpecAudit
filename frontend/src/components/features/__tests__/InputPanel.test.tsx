// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InputPanel } from '../InputPanel';

function noop() {}

describe('InputPanel', () => {
  it('renders the textarea and buttons', () => {
    render(
      <InputPanel status="idle" onSubmit={noop} onAbort={noop} />
    );
    expect(screen.getByPlaceholderText(/paste your openapi spec/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /run audit/i })).toBeInTheDocument();
  });

  it('shows character count as 0 by default', () => {
    render(<InputPanel status="idle" onSubmit={noop} onAbort={noop} />);
    expect(screen.getByText(/0 \/ 100,000 characters/i)).toBeInTheDocument();
  });

  it('updates character count as user types', () => {
    render(<InputPanel status="idle" onSubmit={noop} onAbort={noop} />);
    const textarea = screen.getByPlaceholderText(/paste your openapi spec/i);
    fireEvent.change(textarea, { target: { value: 'hello' } });
    expect(screen.getByText(/5 \/ 100,000 characters/i)).toBeInTheDocument();
  });

  it('shows amber count color above 80,000 characters', () => {
    render(<InputPanel status="idle" onSubmit={noop} onAbort={noop} />);
    const textarea = screen.getByPlaceholderText(/paste your openapi spec/i);
    fireEvent.change(textarea, { target: { value: 'x'.repeat(80_001) } });
    const counter = screen.getByText(/80,001 \/ 100,000 characters/i);
    expect(counter).toBeInTheDocument();
    expect(counter.className).toContain('text-amber-400');
  });

  it('shows red count color above 100,000 characters', () => {
    render(<InputPanel status="idle" onSubmit={noop} onAbort={noop} />);
    const textarea = screen.getByPlaceholderText(/paste your openapi spec/i);
    fireEvent.change(textarea, { target: { value: 'x'.repeat(100_001) } });
    const counter = screen.getByText(/100,001 \/ 100,000 characters/i);
    expect(counter).toBeInTheDocument();
    expect(counter.className).toContain('text-red-400');
  });

  it('shows overflow message when count exceeds 100,000', () => {
    render(<InputPanel status="idle" onSubmit={noop} onAbort={noop} />);
    const textarea = screen.getByPlaceholderText(/paste your openapi spec/i);
    fireEvent.change(textarea, { target: { value: 'x'.repeat(100_001) } });
    expect(
      screen.getByText(/this spec exceeds the 100,000 character limit/i)
    ).toBeInTheDocument();
  });

  it('disables Run button when input is empty', () => {
    render(<InputPanel status="idle" onSubmit={noop} onAbort={noop} />);
    expect(screen.getByRole('button', { name: /run audit/i })).toBeDisabled();
  });

  it('disables Run button when count exceeds 100,000', () => {
    render(<InputPanel status="idle" onSubmit={noop} onAbort={noop} />);
    const textarea = screen.getByPlaceholderText(/paste your openapi spec/i);
    fireEvent.change(textarea, { target: { value: 'x'.repeat(100_001) } });
    expect(screen.getByRole('button', { name: /run audit/i })).toBeDisabled();
  });

  it('disables Run button when streaming', () => {
    render(<InputPanel status="streaming" onSubmit={noop} onAbort={noop} />);
    const textarea = screen.getByPlaceholderText(/paste your openapi spec/i);
    fireEvent.change(textarea, { target: { value: 'spec: test' } });
    expect(screen.getByRole('button', { name: /run audit/i })).toBeDisabled();
  });

  it('enables Run button when valid input and not streaming', () => {
    render(<InputPanel status="idle" onSubmit={noop} onAbort={noop} />);
    const textarea = screen.getByPlaceholderText(/paste your openapi spec/i);
    fireEvent.change(textarea, { target: { value: 'openapi: 3.0.3' } });
    expect(screen.getByRole('button', { name: /run audit/i })).not.toBeDisabled();
  });

  it('shows Stop button only when streaming', () => {
    const { rerender } = render(
      <InputPanel status="idle" onSubmit={noop} onAbort={noop} />
    );
    expect(screen.queryByRole('button', { name: /stop/i })).not.toBeInTheDocument();

    rerender(<InputPanel status="streaming" onSubmit={noop} onAbort={noop} />);
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();

    rerender(<InputPanel status="complete" onSubmit={noop} onAbort={noop} />);
    expect(screen.queryByRole('button', { name: /stop/i })).not.toBeInTheDocument();
  });

  it('calls onSubmit with spec and format when Run is clicked', () => {
    const onSubmit = vi.fn();
    render(<InputPanel status="idle" onSubmit={onSubmit} onAbort={noop} />);
    const textarea = screen.getByPlaceholderText(/paste your openapi spec/i);
    fireEvent.change(textarea, { target: { value: 'openapi: 3.0.3' } });

    // Select YAML format
    fireEvent.click(screen.getByRole('button', { name: /yaml/i }));
    fireEvent.click(screen.getByRole('button', { name: /run audit/i }));

    expect(onSubmit).toHaveBeenCalledWith('openapi: 3.0.3', 'yaml');
  });

  it('calls onAbort when Stop is clicked', () => {
    const onAbort = vi.fn();
    render(<InputPanel status="streaming" onSubmit={noop} onAbort={onAbort} />);
    fireEvent.click(screen.getByRole('button', { name: /stop/i }));
    expect(onAbort).toHaveBeenCalledOnce();
  });

  it('toggles YAML format button selection', () => {
    render(<InputPanel status="idle" onSubmit={noop} onAbort={noop} />);
    const yamlButton = screen.getByRole('button', { name: /yaml/i });

    // Click to select
    fireEvent.click(yamlButton);
    expect(yamlButton.className).toContain('border-indigo-500');

    // Click again to deselect
    fireEvent.click(yamlButton);
    expect(yamlButton.className).not.toContain('border-indigo-500');
  });

  it('toggles JSON format button selection', () => {
    render(<InputPanel status="idle" onSubmit={noop} onAbort={noop} />);
    const jsonButton = screen.getByRole('button', { name: /json/i });

    // Click to select
    fireEvent.click(jsonButton);
    expect(jsonButton.className).toContain('border-indigo-500');

    // Click again to deselect
    fireEvent.click(jsonButton);
    expect(jsonButton.className).not.toContain('border-indigo-500');
  });
});
