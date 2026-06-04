// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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

  it('disables Run button when status is loading', () => {
    render(<InputPanel status="loading" onSubmit={noop} onAbort={noop} />);
    const textarea = screen.getByPlaceholderText(/paste your openapi spec/i);
    fireEvent.change(textarea, { target: { value: 'spec: test' } });
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

  it('calls onSubmit when Ctrl+Enter is pressed with valid input', () => {
    const onSubmit = vi.fn();
    render(<InputPanel status="idle" onSubmit={onSubmit} onAbort={noop} />);
    const textarea = screen.getByPlaceholderText(/paste your openapi spec/i);
    fireEvent.change(textarea, { target: { value: 'openapi: 3.0.3' } });
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
    expect(onSubmit).toHaveBeenCalledWith('openapi: 3.0.3', undefined);
  });

  it('calls onSubmit when Cmd+Enter is pressed with valid input', () => {
    const onSubmit = vi.fn();
    render(<InputPanel status="idle" onSubmit={onSubmit} onAbort={noop} />);
    const textarea = screen.getByPlaceholderText(/paste your openapi spec/i);
    fireEvent.change(textarea, { target: { value: 'openapi: 3.0.3' } });
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });
    expect(onSubmit).toHaveBeenCalledWith('openapi: 3.0.3', undefined);
  });

  it('does not call onSubmit when Enter alone is pressed (newline)', () => {
    const onSubmit = vi.fn();
    render(<InputPanel status="idle" onSubmit={onSubmit} onAbort={noop} />);
    const textarea = screen.getByPlaceholderText(/paste your openapi spec/i);
    fireEvent.change(textarea, { target: { value: 'openapi: 3.0.3' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not call onSubmit when Ctrl+Enter and input is empty', () => {
    const onSubmit = vi.fn();
    render(<InputPanel status="idle" onSubmit={onSubmit} onAbort={noop} />);
    const textarea = screen.getByPlaceholderText(/paste your openapi spec/i);
    // textarea is empty
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not call onSubmit when Ctrl+Enter and status is loading', () => {
    const onSubmit = vi.fn();
    render(<InputPanel status="loading" onSubmit={onSubmit} onAbort={noop} />);
    const textarea = screen.getByPlaceholderText(/paste your openapi spec/i);
    fireEvent.change(textarea, { target: { value: 'openapi: 3.0.3' } });
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not call onSubmit when Ctrl+Enter and status is streaming', () => {
    const onSubmit = vi.fn();
    render(<InputPanel status="streaming" onSubmit={onSubmit} onAbort={noop} />);
    const textarea = screen.getByPlaceholderText(/paste your openapi spec/i);
    fireEvent.change(textarea, { target: { value: 'openapi: 3.0.3' } });
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not call onSubmit when Ctrl+Enter and input exceeds limit', () => {
    const onSubmit = vi.fn();
    render(<InputPanel status="idle" onSubmit={onSubmit} onAbort={noop} />);
    const textarea = screen.getByPlaceholderText(/paste your openapi spec/i);
    fireEvent.change(textarea, { target: { value: 'x'.repeat(100_001) } });
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows Ctrl+Enter hint on Run Audit button', () => {
    render(<InputPanel status="idle" onSubmit={noop} onAbort={noop} />);
    const button = screen.getByRole('button', { name: /run audit/i });
    const kbd = button.querySelector('kbd');
    expect(kbd).toBeInTheDocument();
    expect(kbd).toHaveTextContent('Ctrl+Enter');
  });

  it('shows Escape hint on Stop button', () => {
    render(<InputPanel status="streaming" onSubmit={noop} onAbort={noop} />);
    const button = screen.getByRole('button', { name: /stop/i });
    const kbd = button.querySelector('kbd');
    expect(kbd).toBeInTheDocument();
    expect(kbd).toHaveTextContent('Esc');
  });

  // ---- File upload tests ----

  function getDropZone(): HTMLElement {
    // The hidden file input is a direct child of the drop zone div
    const input = document.querySelector('input[type="file"]')!;
    return input.parentElement!;
  }

  function setupMockFileReader() {
    const original = globalThis.FileReader;
    const readers: Array<{
      onload: ((e: any) => void) | null;
      onerror: (() => void) | null;
      readAsText: ReturnType<typeof vi.fn>;
    }> = [];

    class MockFileReader {
      onload: ((e: any) => void) | null = null;
      onerror: (() => void) | null = null;
      readAsText = vi.fn();

      constructor() {
        readers.push(this);
      }
    }

    globalThis.FileReader = MockFileReader as unknown as typeof FileReader;

    return {
      original,
      readers,
      restore() {
        globalThis.FileReader = original;
      },
    };
  }

  it('renders drag-and-drop zone with instruct text', () => {
    render(<InputPanel status="idle" onSubmit={noop} onAbort={noop} />);
    expect(screen.getByText(/browse files/i)).toBeInTheDocument();
    expect(screen.getByText(/drag & drop here/i)).toBeInTheDocument();
    expect(screen.getByText(/supports .yaml/i)).toBeInTheDocument();
  });

  it('clicking drag zone opens file picker (verify hidden input exists)', () => {
    render(<InputPanel status="idle" onSubmit={noop} onAbort={noop} />);
    const hiddenInput = document.querySelector('input[type="file"]');
    expect(hiddenInput).toBeInTheDocument();
    expect(hiddenInput).toHaveAttribute('accept', '.yaml,.yml,.json');
    expect(hiddenInput).toHaveClass('hidden');
  });

  it('shows file info (name + size) after dropping a valid .yaml file', () => {
    render(<InputPanel status="idle" onSubmit={noop} onAbort={noop} />);
    const zone = getDropZone();

    const fr = setupMockFileReader();

    const file = new File(['openapi: 3.0.3'], 'spec.yaml', { type: 'application/x-yaml' });
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });

    expect(fr.readers[0].readAsText).toHaveBeenCalledWith(file);

    // Simulate successful load
    act(() => {
      fr.readers[0].onload?.({ target: { result: 'openapi: 3.0.3' } });
    });

    // File info should show after loading
    expect(screen.getByText('spec.yaml')).toBeInTheDocument();
    expect(screen.getByText(/\d+ B/)).toBeInTheDocument();

    fr.restore();
  });

  it('shows file info after dropping a valid .json file', () => {
    render(<InputPanel status="idle" onSubmit={noop} onAbort={noop} />);
    const zone = getDropZone();

    const fr = setupMockFileReader();

    const file = new File(['{"openapi":"3.0.3"}'], 'spec.json', { type: 'application/json' });
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });

    act(() => {
      fr.readers[0].onload?.({ target: { result: '{"openapi":"3.0.3"}' } });
    });

    expect(screen.getByText('spec.json')).toBeInTheDocument();

    fr.restore();
  });

  it('populates textarea with file content after drop', () => {
    render(<InputPanel status="idle" onSubmit={noop} onAbort={noop} />);
    const zone = getDropZone();

    const fr = setupMockFileReader();

    const file = new File(['openapi: 3.0.3'], 'spec.yaml', { type: 'application/x-yaml' });
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });

    act(() => {
      fr.readers[0].onload?.({ target: { result: 'openapi: 3.0.3' } });
    });

    const textarea = screen.getByPlaceholderText(/paste your openapi spec/i) as HTMLTextAreaElement;
    expect(textarea.value).toBe('openapi: 3.0.3');

    fr.restore();
  });

  it('shows loading state while reading', () => {
    render(<InputPanel status="idle" onSubmit={noop} onAbort={noop} />);
    const zone = getDropZone();

    const fr = setupMockFileReader();

    const file = new File(['content'], 'spec.yaml', { type: 'application/x-yaml' });
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });

    // Should be loading - text "Reading file..." should appear
    expect(screen.getByText(/reading file/i)).toBeInTheDocument();

    // Complete the read
    act(() => {
      fr.readers[0].onload?.({ target: { result: 'content' } });
    });

    // Loading should be gone
    expect(screen.queryByText(/reading file/i)).not.toBeInTheDocument();

    fr.restore();
  });

  it('shows error for non-YAML/JSON file type', () => {
    render(<InputPanel status="idle" onSubmit={noop} onAbort={noop} />);
    const zone = getDropZone();

    const file = new File(['some content'], 'readme.txt', { type: 'text/plain' });
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });

    expect(screen.getByText(/unsupported file type/i)).toBeInTheDocument();
  });

  it('shows error for file exceeding size limit', () => {
    render(<InputPanel status="idle" onSubmit={noop} onAbort={noop} />);
    const zone = getDropZone();

    // Create a file that exceeds 500 KB
    const largeContent = 'x'.repeat(600_000);
    const file = new File([largeContent], 'large.yaml', { type: 'application/x-yaml' });
    // Override the size property since File constructor might not honor it exactly
    Object.defineProperty(file, 'size', { value: 600_000 });

    fireEvent.drop(zone, { dataTransfer: { files: [file] } });

    expect(screen.getByText(/file too large/i)).toBeInTheDocument();
  });

  it('shows error when FileReader fails', () => {
    render(<InputPanel status="idle" onSubmit={noop} onAbort={noop} />);
    const zone = getDropZone();

    const fr = setupMockFileReader();

    const file = new File(['content'], 'spec.yaml', { type: 'application/x-yaml' });
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });

    // Trigger error
    act(() => {
      fr.readers[0].onerror?.();
    });

    expect(screen.getByText(/failed to read file/i)).toBeInTheDocument();

    fr.restore();
  });

  it('drag-over class toggles on dragover/dragleave events', () => {
    render(<InputPanel status="idle" onSubmit={noop} onAbort={noop} />);
    const zone = getDropZone();

    // Initially no drag-over class (border-indigo-400 appears when dragOver is true)
    expect(zone.className).not.toContain('border-indigo-400');

    // Fire dragover
    fireEvent.dragOver(zone);
    expect(zone.className).toContain('border-indigo-400');

    // Fire dragleave
    fireEvent.dragLeave(zone);
    expect(zone.className).not.toContain('border-indigo-400');
  });

  it('replacing file works (drop a second file after first)', () => {
    render(<InputPanel status="idle" onSubmit={noop} onAbort={noop} />);
    const zone = getDropZone();

    const fr = setupMockFileReader();

    // Drop first file
    const file1 = new File(['content1'], 'first.yaml', { type: 'application/x-yaml' });
    fireEvent.drop(zone, { dataTransfer: { files: [file1] } });

    // Complete first read
    act(() => {
      fr.readers[0].onload?.({ target: { result: 'content1' } });
    });

    // Verify first file info appears
    expect(screen.getByText('first.yaml')).toBeInTheDocument();
    const textarea1 = screen.getByPlaceholderText(/paste your openapi spec/i) as HTMLTextAreaElement;
    expect(textarea1.value).toBe('content1');

    // Drop second file — this creates a new FileReader instance
    const file2 = new File(['content2'], 'second.yaml', { type: 'application/x-yaml' });
    fireEvent.drop(zone, { dataTransfer: { files: [file2] } });

    // Complete second read
    act(() => {
      fr.readers[1].onload?.({ target: { result: 'content2' } });
    });

    expect(screen.getByText('second.yaml')).toBeInTheDocument();
    expect(screen.queryByText('first.yaml')).not.toBeInTheDocument();

    const textarea2 = screen.getByPlaceholderText(/paste your openapi spec/i) as HTMLTextAreaElement;
    expect(textarea2.value).toBe('content2');

    fr.restore();
  });

  it('browse button triggers hidden input click', () => {
    render(<InputPanel status="idle" onSubmit={noop} onAbort={noop} />);
    const hiddenInput = document.querySelector('input[type="file"]')!;
    const clickSpy = vi.spyOn(hiddenInput, 'click');

    // Click the zone
    const zone = getDropZone();
    fireEvent.click(zone);

    expect(clickSpy).toHaveBeenCalled();
  });
});
