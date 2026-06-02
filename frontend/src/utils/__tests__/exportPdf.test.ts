// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { exportPdf } from '../exportPdf';

// Mock html2pdf.js
vi.mock('html2pdf.js', () => {
  const mockSave = vi.fn().mockResolvedValue(undefined);
  const mockFrom = vi.fn().mockReturnValue({ save: mockSave });
  const mockSet = vi.fn().mockReturnValue({ from: mockFrom, save: mockSave });
  const mockInstance = vi.fn().mockReturnValue({
    set: mockSet,
    from: mockFrom,
    save: mockSave,
  });
  mockInstance.set = mockSet;
  mockInstance.from = mockFrom;
  mockInstance.save = mockSave;
  return { default: mockInstance };
});

describe('exportPdf', () => {
  it('is defined and callable', () => {
    expect(exportPdf).toBeInstanceOf(Function);
  });

  it('returns immediately when content is empty', async () => {
    // Should not throw or call html2pdf
    await expect(exportPdf('')).resolves.toBeUndefined();
  });

  it('accepts an optional custom filename', async () => {
    // Just verify the function accepts a second argument without error
    // (empty content returns early, so this is a type-check)
    await expect(exportPdf('', 'custom-report.pdf')).resolves.toBeUndefined();
  });
});
