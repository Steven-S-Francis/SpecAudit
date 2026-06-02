// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import App from '../../../App';

// Mock the useAudit hook
vi.mock('../../../hooks/useAudit', () => ({
  useAudit: vi.fn(),
}));

// Mock the useTheme hook
vi.mock('../../../hooks/useTheme', () => ({
  useTheme: vi.fn(),
}));

import { useAudit } from '../../../hooks/useAudit';
import { useTheme } from '../../../hooks/useTheme';

const mockUseAudit = useAudit as ReturnType<typeof vi.fn>;
const mockUseTheme = useTheme as ReturnType<typeof vi.fn>;

describe('App Copy Button', () => {
  const writeText = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock fetch for /api/config so it never settles — avoids act warnings from setProviderName
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));

    // Mock clipboard
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    // Default mock for useAudit — idle, no result
    mockUseAudit.mockReturnValue({
      state: { status: 'idle', result: '', error: null },
      audit: vi.fn(),
      abort: vi.fn(),
      reset: vi.fn(),
    });

    // Default mock for useTheme — dark mode
    mockUseTheme.mockReturnValue({
      theme: 'dark',
      toggle: vi.fn(),
    });
  });

  it('hides Copy button when result is empty', async () => {
    render(<App />);
    await waitFor(() => {});
    expect(screen.queryByText('Copy')).not.toBeInTheDocument();
    expect(screen.queryByText('Copied!')).not.toBeInTheDocument();
  });

  it('shows Copy button when result has content', async () => {
    mockUseAudit.mockReturnValue({
      state: { status: 'complete', result: 'Audit report content', error: null },
      audit: vi.fn(),
      abort: vi.fn(),
      reset: vi.fn(),
    });

    render(<App />);
    await waitFor(() => {});
    expect(screen.getByText('Copy')).toBeInTheDocument();
  });

  it('disables Copy button when streaming', async () => {
    mockUseAudit.mockReturnValue({
      state: { status: 'streaming', result: 'Partial content...', error: null },
      audit: vi.fn(),
      abort: vi.fn(),
      reset: vi.fn(),
    });

    render(<App />);
    await waitFor(() => {});
    const button = screen.getByRole('button', { name: /copy/i });
    expect(button).toBeDisabled();
  });

  it('copies content and shows Copied feedback', async () => {
    writeText.mockResolvedValue(undefined);

    mockUseAudit.mockReturnValue({
      state: { status: 'complete', result: 'Full audit report text', error: null },
      audit: vi.fn(),
      abort: vi.fn(),
      reset: vi.fn(),
    });

    render(<App />);
    await waitFor(() => {});

    const button = screen.getByRole('button', { name: /copy/i });
    expect(button).toBeEnabled();

    await act(async () => {
      fireEvent.click(button);
    });

    // Clipboard writeText should have been called with the result
    expect(writeText).toHaveBeenCalledWith('Full audit report text');
    expect(writeText).toHaveBeenCalledTimes(1);

    // Button text should have changed to "Copied!"
    expect(screen.getByText('Copied!')).toBeInTheDocument();
    // "Copy" should no longer be visible
    expect(screen.queryByText('Copy')).not.toBeInTheDocument();
  });

  it('renders theme toggle button in header', async () => {
    render(<App />);
    await waitFor(() => {});
    // Toggle button has aria-label containing "Switch to"
    const toggle = screen.getByRole('button', { name: /switch to/i });
    expect(toggle).toBeInTheDocument();
  });
});
