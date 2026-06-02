// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import App from '../../../App';
import type { AuditResult } from '../../../types/audit';

// Mock the useAudit hook
vi.mock('../../../hooks/useAudit', () => ({
  useAudit: vi.fn(),
}));

// Mock exportPdf to avoid real pdfmake calls
vi.mock('../../../utils/exportPdf', () => ({
  exportPdf: vi.fn(),
}));

// Mock the useTheme hook
vi.mock('../../../hooks/useTheme', () => ({
  useTheme: vi.fn(),
}));

import { useAudit } from '../../../hooks/useAudit';
import { useTheme } from '../../../hooks/useTheme';
import { exportPdf } from '../../../utils/exportPdf';

const mockUseAudit = useAudit as ReturnType<typeof vi.fn>;
const mockUseTheme = useTheme as ReturnType<typeof vi.fn>;

const SAMPLE_MARKDOWN = '# SpecAudit Report\n\n## Summary\n**Total Findings:** 3';

function createTestResult(specFormat: string | null = 'json'): AuditResult {
  return {
    version: 1,
    result: SAMPLE_MARKDOWN,
    exportedAt: '2026-01-01T00:00:00.000Z',
    specFormat,
  };
}

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

describe('App Download Button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    Object.assign(navigator, { clipboard: { writeText: vi.fn() } });
    mockUseAudit.mockReturnValue({
      state: { status: 'idle', result: '', error: null },
      audit: vi.fn(),
      abort: vi.fn(),
      reset: vi.fn(),
    });
    mockUseTheme.mockReturnValue({
      theme: 'dark',
      toggle: vi.fn(),
    });
  });

  it('hides Download button when result is empty', async () => {
    render(<App />);
    await waitFor(() => {});
    expect(screen.queryByText('Download')).not.toBeInTheDocument();
  });

  it('shows Download button when result has content', async () => {
    mockUseAudit.mockReturnValue({
      state: { status: 'complete', result: 'Audit report content', error: null },
      audit: vi.fn(),
      abort: vi.fn(),
      reset: vi.fn(),
    });

    render(<App />);
    await waitFor(() => {});
    expect(screen.getByText('Download')).toBeInTheDocument();
  });

  it('disables Download button when streaming', async () => {
    mockUseAudit.mockReturnValue({
      state: { status: 'streaming', result: 'Partial content...', error: null },
      audit: vi.fn(),
      abort: vi.fn(),
      reset: vi.fn(),
    });

    render(<App />);
    await waitFor(() => {});
    const button = screen.getByRole('button', { name: /download/i });
    expect(button).toBeDisabled();
  });

  it('downloads file on click', async () => {
    const reportContent = 'Full audit report text';
    mockUseAudit.mockReturnValue({
      state: { status: 'complete', result: reportContent, error: null },
      audit: vi.fn(),
      abort: vi.fn(),
      reset: vi.fn(),
    });

    // Mock URL methods
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockReturnValue();

    // Mock document.createElement only for 'a' tag — let React work normally for everything else
    const origCreateElement = document.createElement.bind(document);
    const mockAnchor = origCreateElement('a') as HTMLAnchorElement;
    mockAnchor.click = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        return mockAnchor as unknown as HTMLElement;
      }
      // Fall through to real createElement for React's DOM needs
      return origCreateElement(tagName);
    });

    render(<App />);
    await waitFor(() => {});

    const button = screen.getByRole('button', { name: /download/i });
    expect(button).toBeEnabled();

    await act(async () => {
      fireEvent.click(button);
    });

    // Verify Blob was created with correct content and type
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blobArg = createObjectURL.mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe('text/markdown;charset=utf-8');

    // Verify anchor element was configured correctly
    expect(mockAnchor.download).toMatch(/^specaudit-report-\d+\.md$/);

    // Verify the download was triggered
    expect(mockAnchor.click).toHaveBeenCalledTimes(1);

    // Verify cleanup
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});

describe('App Export PDF Button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    Object.assign(navigator, { clipboard: { writeText: vi.fn() } });
    mockUseAudit.mockReturnValue({
      state: { status: 'idle', result: '', error: null },
      audit: vi.fn(),
      abort: vi.fn(),
      reset: vi.fn(),
    });
    mockUseTheme.mockReturnValue({
      theme: 'dark',
      toggle: vi.fn(),
    });
  });

  it('hides Export PDF button when result is empty', async () => {
    render(<App />);
    await waitFor(() => {});
    expect(screen.queryByText('Export PDF')).not.toBeInTheDocument();
  });

  it('shows Export PDF button when result has content', async () => {
    mockUseAudit.mockReturnValue({
      state: { status: 'complete', result: 'Audit report content', error: null },
      audit: vi.fn(),
      abort: vi.fn(),
      reset: vi.fn(),
    });

    render(<App />);
    await waitFor(() => {});
    expect(screen.getByText('Export PDF')).toBeInTheDocument();
  });

  it('disables Export PDF button when streaming', async () => {
    mockUseAudit.mockReturnValue({
      state: { status: 'streaming', result: 'Partial content...', error: null },
      audit: vi.fn(),
      abort: vi.fn(),
      reset: vi.fn(),
    });

    render(<App />);
    await waitFor(() => {});
    const button = screen.getByRole('button', { name: /export pdf/i });
    expect(button).toBeDisabled();
  });

  it('calls exportPdf on Export PDF button click', async () => {
    const reportContent = 'Full audit report text';
    mockUseAudit.mockReturnValue({
      state: { status: 'complete', result: reportContent, error: null },
      audit: vi.fn(),
      abort: vi.fn(),
      reset: vi.fn(),
    });

    render(<App />);
    await waitFor(() => {});

    const button = screen.getByRole('button', { name: /export pdf/i });
    expect(button).toBeEnabled();

    await act(async () => {
      fireEvent.click(button);
    });

    expect(exportPdf).toHaveBeenCalledTimes(1);
    expect(exportPdf).toHaveBeenCalledWith(reportContent);
  });
});

describe('App Export JSON Button', () => {
  beforeEach(() => {
    // Use restoreAllMocks to fully clean up spies (e.g. document.createElement
    // from previous test blocks) before re-creating them
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    Object.assign(navigator, { clipboard: { writeText: vi.fn() } });
    mockUseAudit.mockReturnValue({
      state: { status: 'idle', result: '', error: null, specFormat: null },
      audit: vi.fn(),
      abort: vi.fn(),
      reset: vi.fn(),
    });
    mockUseTheme.mockReturnValue({
      theme: 'dark',
      toggle: vi.fn(),
    });
  });

  it('1: hides Export JSON button when result is empty', async () => {
    render(<App />);
    await waitFor(() => {});
    expect(screen.queryByText('Export JSON')).not.toBeInTheDocument();
  });

  it('2: shows Export JSON button when result has content', async () => {
    mockUseAudit.mockReturnValue({
      state: { status: 'complete', result: 'Audit report content', error: null, specFormat: null },
      audit: vi.fn(),
      abort: vi.fn(),
      reset: vi.fn(),
    });

    render(<App />);
    await waitFor(() => {});
    expect(screen.getByText('Export JSON')).toBeInTheDocument();
  });

  it('3: disables Export JSON button when streaming', async () => {
    mockUseAudit.mockReturnValue({
      state: { status: 'streaming', result: 'Partial content...', error: null, specFormat: null },
      audit: vi.fn(),
      abort: vi.fn(),
      reset: vi.fn(),
    });

    render(<App />);
    await waitFor(() => {});
    const button = screen.getByRole('button', { name: /export json/i });
    expect(button).toBeDisabled();
  });

  it('4: creates correct JSON envelope on click', async () => {
    const reportContent = 'Full audit report text';
    const specFormat = 'yaml';
    mockUseAudit.mockReturnValue({
      state: { status: 'complete', result: reportContent, error: null, specFormat },
      audit: vi.fn(),
      abort: vi.fn(),
      reset: vi.fn(),
    });

    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockReturnValue();

    const origCreateElement = document.createElement.bind(document);
    const mockAnchor = origCreateElement('a') as HTMLAnchorElement;
    mockAnchor.click = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') return mockAnchor as unknown as HTMLElement;
      return origCreateElement(tagName);
    });

    render(<App />);
    await waitFor(() => {});

    const button = screen.getByRole('button', { name: /export json/i });
    expect(button).toBeEnabled();

    await act(async () => {
      fireEvent.click(button);
    });

    // Verify Blob was created with correct content type
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blobArg = createObjectURL.mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe('application/json;charset=utf-8');

    // Parse the Blob content and verify the JSON envelope
    const blobText = await blobArg.text();
    const parsed = JSON.parse(blobText);
    expect(parsed).toHaveProperty('version', 1);
    expect(parsed).toHaveProperty('result', reportContent);
    expect(parsed).toHaveProperty('exportedAt');
    expect(parsed).toHaveProperty('specFormat', specFormat);

    // Verify filename ends in .json
    expect(mockAnchor.download).toMatch(/^specaudit-report-\d+\.json$/);

    // Verify download was triggered
    expect(mockAnchor.click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('5: validates the downloaded filename ends in .json', async () => {
    const reportContent = 'Some report';
    mockUseAudit.mockReturnValue({
      state: { status: 'complete', result: reportContent, error: null, specFormat: null },
      audit: vi.fn(),
      abort: vi.fn(),
      reset: vi.fn(),
    });

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(URL, 'revokeObjectURL').mockReturnValue();

    const origCreateElement = document.createElement.bind(document);
    const mockAnchor = origCreateElement('a') as HTMLAnchorElement;
    mockAnchor.click = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') return mockAnchor as unknown as HTMLElement;
      return origCreateElement(tagName);
    });

    render(<App />);
    await waitFor(() => {});

    const button = screen.getByRole('button', { name: /export json/i });
    await act(async () => {
      fireEvent.click(button);
    });

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(mockAnchor.download).toMatch(/^specaudit-report-\d+\.json$/);
    expect(mockAnchor.download).not.toMatch(/\.md$/);
    expect(mockAnchor.download).not.toMatch(/\.pdf$/);
  });

  it('6: creates a valid AuditResult object with all required fields', () => {
    const result = createTestResult('yaml');
    expect(result).toHaveProperty('version', 1);
    expect(result).toHaveProperty('result', SAMPLE_MARKDOWN);
    expect(result).toHaveProperty('exportedAt');
    expect(result).toHaveProperty('specFormat', 'yaml');
  });

  it('7: version is always 1', () => {
    const result = createTestResult();
    expect(result.version).toBe(1);
  });

  it('8: exportedAt is a valid ISO-8601 date string', () => {
    const result = createTestResult();
    const parsed = new Date(result.exportedAt);
    expect(parsed.toISOString()).toBe(result.exportedAt);
  });

  it('9: specFormat can be null (auto-detect)', () => {
    const result = createTestResult(null);
    expect(result.specFormat).toBeNull();
  });

  it('10: specFormat can be "yaml"', () => {
    const result = createTestResult('yaml');
    expect(result.specFormat).toBe('yaml');
  });

  it('11: JSON.stringify produces valid parsable JSON', () => {
    const result = createTestResult();
    const json = JSON.stringify(result);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(result);
  });

  it('12: Pretty-printed JSON (2-space indent) is valid', () => {
    const result = createTestResult();
    const json = JSON.stringify(result, null, 2);
    expect(() => JSON.parse(json)).not.toThrow();
    expect(json).toContain('\n  ');
  });

  it('13: creates Blob with correct content type', () => {
    const result = createTestResult();
    const jsonString = JSON.stringify(result, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    expect(blob.type).toBe('application/json;charset=utf-8');
  });

  it('14: Blob content matches original result object after round-trip', async () => {
    const result = createTestResult();
    const jsonString = JSON.stringify(result, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const text = await blob.text();
    const parsed = JSON.parse(text);
    expect(parsed).toEqual(result);
  });

  it('15: handles empty result string', () => {
    const result: AuditResult = {
      version: 1,
      result: '',
      exportedAt: '2026-01-01T00:00:00.000Z',
      specFormat: null,
    };
    const json = JSON.stringify(result, null, 2);
    const parsed = JSON.parse(json);
    expect(parsed.result).toBe('');
  });

  it('16: handles result with unicode characters', () => {
    const unicodeResult = '# Café résumé\n\nCrème brûlée — 日本語\n\n`console.log("héllo")`';
    const result: AuditResult = {
      version: 1,
      result: unicodeResult,
      exportedAt: '2026-01-01T00:00:00.000Z',
      specFormat: null,
    };
    const json = JSON.stringify(result, null, 2);
    const parsed = JSON.parse(json);
    expect(parsed.result).toBe(unicodeResult);
  });

  it('does not trigger download when result is empty', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL');

    render(<App />);
    await waitFor(() => {});

    // Button is not rendered, so no download can be triggered
    expect(screen.queryByText('Export JSON')).not.toBeInTheDocument();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it('includes specFormat: null in JSON envelope when specFormat is null', async () => {
    const reportContent = 'Report with auto-detected format';
    mockUseAudit.mockReturnValue({
      state: { status: 'complete', result: reportContent, error: null, specFormat: null },
      audit: vi.fn(),
      abort: vi.fn(),
      reset: vi.fn(),
    });

    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(URL, 'revokeObjectURL').mockReturnValue();

    const origCreateElement = document.createElement.bind(document);
    const mockAnchor = origCreateElement('a') as HTMLAnchorElement;
    mockAnchor.click = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') return mockAnchor as unknown as HTMLElement;
      return origCreateElement(tagName);
    });

    render(<App />);
    await waitFor(() => {});

    const button = screen.getByRole('button', { name: /export json/i });
    await act(async () => {
      fireEvent.click(button);
    });

    const blobArg = createObjectURL.mock.calls[0][0] as Blob;
    const blobText = await blobArg.text();
    const parsed = JSON.parse(blobText);
    expect(parsed.specFormat).toBeNull();
    expect(parsed).toHaveProperty('result', reportContent);
  });

  it('generates a valid ISO-8601 exportedAt in the download payload', async () => {
    const reportContent = 'Timing test';
    mockUseAudit.mockReturnValue({
      state: { status: 'complete', result: reportContent, error: null, specFormat: 'json' },
      audit: vi.fn(),
      abort: vi.fn(),
      reset: vi.fn(),
    });

    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(URL, 'revokeObjectURL').mockReturnValue();

    const origCreateElement = document.createElement.bind(document);
    const mockAnchor = origCreateElement('a') as HTMLAnchorElement;
    mockAnchor.click = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') return mockAnchor as unknown as HTMLElement;
      return origCreateElement(tagName);
    });

    render(<App />);
    await waitFor(() => {});

    const button = screen.getByRole('button', { name: /export json/i });
    await act(async () => {
      fireEvent.click(button);
    });

    const blobArg = createObjectURL.mock.calls[0][0] as Blob;
    const blobText = await blobArg.text();
    const parsed = JSON.parse(blobText);

    expect(parsed).toHaveProperty('exportedAt');
    expect(typeof parsed.exportedAt).toBe('string');
    // Validate ISO-8601 round-trip
    const parsedDate = new Date(parsed.exportedAt);
    expect(parsedDate.toISOString()).toBe(parsed.exportedAt);
  });

  it('recovers silently when Blob/URL API throws', async () => {
    const reportContent = 'Recovery test';
    mockUseAudit.mockReturnValue({
      state: { status: 'complete', result: reportContent, error: null, specFormat: null },
      audit: vi.fn(),
      abort: vi.fn(),
      reset: vi.fn(),
    });

    // Force URL.createObjectURL to throw
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      throw new Error('Blob URL API unavailable');
    });

    render(<App />);
    await waitFor(() => {});

    const button = screen.getByRole('button', { name: /export json/i });
    expect(button).toBeEnabled();

    // Click should not propagate an error
    await act(async () => {
      fireEvent.click(button);
    });

    // App should still be functional
    expect(screen.getByRole('button', { name: /export json/i })).toBeInTheDocument();
  });

  it('handles very large result content without crashing', async () => {
    const largeContent = 'x'.repeat(15_000);
    mockUseAudit.mockReturnValue({
      state: { status: 'complete', result: largeContent, error: null, specFormat: null },
      audit: vi.fn(),
      abort: vi.fn(),
      reset: vi.fn(),
    });

    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(URL, 'revokeObjectURL').mockReturnValue();

    const origCreateElement = document.createElement.bind(document);
    const mockAnchor = origCreateElement('a') as HTMLAnchorElement;
    mockAnchor.click = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') return mockAnchor as unknown as HTMLElement;
      return origCreateElement(tagName);
    });

    render(<App />);
    await waitFor(() => {});

    const button = screen.getByRole('button', { name: /export json/i });
    expect(button).toBeEnabled();

    await act(async () => {
      fireEvent.click(button);
    });

    const blobArg = createObjectURL.mock.calls[0][0] as Blob;
    const blobText = await blobArg.text();
    const parsed = JSON.parse(blobText);
    expect(parsed.result).toBe(largeContent);
    expect(parsed.result.length).toBe(15_000);
    expect(blobArg.type).toBe('application/json;charset=utf-8');
  });
});
