// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportPdf, markdownToContent } from '../exportPdf';

// Mock pdfmake (no VFS fonts needed in tests)
vi.mock('pdfmake/build/pdfmake', () => {
  const mockDownload = vi.fn().mockResolvedValue(undefined);
  const mockCreatePdf = vi.fn(() => ({ download: mockDownload }));
  const mockAddVirtualFileSystem = vi.fn();
  return {
    default: {
      createPdf: mockCreatePdf,
      addVirtualFileSystem: mockAddVirtualFileSystem,
      fonts: {},
    },
  };
});

// Mock vfs_fonts to avoid import error
vi.mock('pdfmake/build/vfs_fonts', () => ({
  default: {},
}));

// Import the mocked module for assertions
import pdfMake from 'pdfmake/build/pdfmake';

const mockCreatePdf = pdfMake.createPdf as ReturnType<typeof vi.fn>;

describe('exportPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports both functions', () => {
    expect(exportPdf).toBeInstanceOf(Function);
    expect(markdownToContent).toBeInstanceOf(Function);
  });

  it('returns early when content is empty', async () => {
    await exportPdf('');
    expect(mockCreatePdf).not.toHaveBeenCalled();
  });

  it('creates PDF with correct docDefinition structure', async () => {
    await exportPdf('Hello world');

    expect(mockCreatePdf).toHaveBeenCalledTimes(1);
    const docDef = mockCreatePdf.mock.calls[0][0];

    expect(docDef).toHaveProperty('pageSize', 'A4');
    expect(docDef).toHaveProperty('pageMargins');
    expect(docDef).toHaveProperty('content');
    expect(Array.isArray(docDef.content)).toBe(true);
  });

  it('uses custom filename', async () => {
    const mockDownload = vi.fn().mockResolvedValue(undefined);
    mockCreatePdf.mockReturnValue({ download: mockDownload });

    await exportPdf('Some content', 'my-report.pdf');
    expect(mockDownload).toHaveBeenCalledWith('my-report.pdf');
  });

  it('uses default filename format', async () => {
    const mockDownload = vi.fn().mockResolvedValue(undefined);
    mockCreatePdf.mockReturnValue({ download: mockDownload });

    await exportPdf('Some content');
    expect(mockDownload).toHaveBeenCalledWith(
      expect.stringMatching(/^specaudit-report-\d+\.pdf$/)
    );
  });

  it('includes title block as first content element', () => {
    const content = markdownToContent('Hello');
    // markdownToContent itself doesn't add the title block — exportPdf does
    // Verify markdownToContent returns only the parsed content
    expect(content.length).toBeGreaterThan(0);
  });

  it('includes SpecAudit Report in the full docDefinition title block', async () => {
    await exportPdf('Hello');
    const docDef = mockCreatePdf.mock.calls[0][0];
    const firstContent = docDef.content[0] as Record<string, unknown>;
    expect(firstContent).toHaveProperty('stack');
    const stack = firstContent.stack as Record<string, unknown>[];
    expect(stack[0]).toHaveProperty('text', 'SpecAudit Report');
  });

  it('propagates error when createPdf throws', async () => {
    mockCreatePdf.mockImplementation(() => {
      throw new Error('PDF error');
    });

    await expect(exportPdf('Content')).rejects.toThrow('PDF error');
  });

  it('propagates error when download rejects', async () => {
    const mockDownload = vi.fn().mockRejectedValue(new Error('Download failed'));
    mockCreatePdf.mockReturnValue({ download: mockDownload });

    await expect(exportPdf('Content')).rejects.toThrow('Download failed');
  });
});

describe('markdownToContent', () => {
  it('converts h1 heading', () => {
    const result = markdownToContent('# Title');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      text: 'Title',
      fontSize: 18,
      bold: true,
    });
  });

  it('converts h2 heading', () => {
    const result = markdownToContent('## Subtitle');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      text: 'Subtitle',
      fontSize: 14,
      bold: true,
    });
  });

  it('converts severity block to table with noBorders', () => {
    const result = markdownToContent('### [CRITICAL] This is critical');
    expect(result).toHaveLength(1);
    const node = result[0] as Record<string, unknown>;
    expect(node).toHaveProperty('table');
    expect(node).toHaveProperty('layout', 'noBorders');
  });

  it('converts severity block with WARNING severity', () => {
    const result = markdownToContent('### [WARNING] Warning message');
    expect(result).toHaveLength(1);
    const body = (result[0] as Record<string, unknown>).table as Record<string, unknown>;
    const cells = (body.body as Record<string, unknown>[][])[0];
    // Col 1: empty with fillColor, Col 2: 'WARNING', Col 3: 'Warning message'
    expect(cells[1]).toHaveProperty('text', 'WARNING');
    expect(cells[2]).toHaveProperty('text', 'Warning message');
  });

  it('converts severity block with INFO severity', () => {
    const result = markdownToContent('### [INFO] Info message');
    expect(result).toHaveLength(1);
    const body = (result[0] as Record<string, unknown>).table as Record<string, unknown>;
    const cells = (body.body as Record<string, unknown>[][])[0];
    expect(cells[1]).toHaveProperty('text', 'INFO');
    expect(cells[2]).toHaveProperty('text', 'Info message');
  });

  it('converts fenced code block', () => {
    const result = markdownToContent('```\nconst x = 1;\n```');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      text: 'const x = 1;',
      background: '#1e293b',
      color: '#e2e8f0',
    });
  });

  it('converts code block with language tag', () => {
    const result = markdownToContent('```yaml\nkey: value\n```');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      text: 'key: value',
    });
  });

  it('handles unclosed code block (treats remaining lines as code)', () => {
    const result = markdownToContent('```\nline1\nline2');
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('text', 'line1\nline2');
  });

  it('converts horizontal rule', () => {
    const result = markdownToContent('---');
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('canvas');
  });

  it('converts inline bold in paragraph', () => {
    const result = markdownToContent('This is **bold** text');
    expect(result).toHaveLength(1);
    const text = result[0] as Record<string, unknown>;
    expect(text).toHaveProperty('fontSize', 11);
    // Should be an array of segments
    expect(Array.isArray(text.text)).toBe(true);
    const parts = text.text as Record<string, unknown>[];
    expect(parts).toContainEqual({ text: 'bold', bold: true });
  });

  it('converts inline code in paragraph', () => {
    const result = markdownToContent('Use the `print()` function');
    expect(result).toHaveLength(1);
    const text = result[0] as Record<string, unknown>;
    expect(Array.isArray(text.text)).toBe(true);
    const parts = text.text as Record<string, unknown>[];
    expect(parts).toContainEqual({
      text: 'print()',
      background: '#f1f5f9',
      color: '#b45309',
    });
  });

  it('converts plain paragraph (no inline formatting)', () => {
    const result = markdownToContent('Just a regular line of text.');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      text: 'Just a regular line of text.',
      fontSize: 11,
    });
    // Single text node should NOT be an array
    expect(typeof (result[0] as Record<string, unknown>).text).toBe('string');
  });

  it('handles inline code at start of line', () => {
    const result = markdownToContent('`code` starts the line');
    expect(result).toHaveLength(1);
    const parts = (result[0] as Record<string, unknown>).text as Record<string, unknown>[];
    expect(parts[0]).toMatchObject({ text: 'code', background: '#f1f5f9' });
  });

  it('handles inline code at end of line', () => {
    const result = markdownToContent('Ends with `code`');
    expect(result).toHaveLength(1);
    const parts = (result[0] as Record<string, unknown>).text as Record<string, unknown>[];
    const last = parts[parts.length - 1];
    expect(last).toMatchObject({ text: 'code', background: '#f1f5f9' });
  });

  it('skips empty lines', () => {
    const result = markdownToContent('Line 1\n\n\nLine 2');
    expect(result).toHaveLength(2);
  });

  it('processes mixed content in order', () => {
    const md = '# Heading\n\nSome paragraph\n\n```\ncode\n```\n\n---';
    const result = markdownToContent(md);
    expect(result).toHaveLength(4);
    expect(result[0]).toHaveProperty('fontSize', 18); // h1
    expect(result[1]).toHaveProperty('fontSize', 11);  // paragraph
    expect(result[2]).toHaveProperty('background', '#1e293b'); // code
    expect(result[3]).toHaveProperty('canvas');                 // HR
  });

  it('handles content with only severity blocks', () => {
    const md = '### [CRITICAL] High severity\n### [WARNING] Medium severity\n### [INFO] Low severity';
    const result = markdownToContent(md);
    expect(result).toHaveLength(3);
    for (const node of result) {
      expect(node).toHaveProperty('table');
      expect(node).toHaveProperty('layout', 'noBorders');
    }
    // Verify each severity appears
    const bodies = result.map((n) => ((n as Record<string, unknown>).table as Record<string, unknown>).body as Record<string, unknown>[][]);
    expect(bodies[0][0][1]).toHaveProperty('text', 'CRITICAL');
    expect(bodies[1][0][1]).toHaveProperty('text', 'WARNING');
    expect(bodies[2][0][1]).toHaveProperty('text', 'INFO');
  });

  it('handles content with only code blocks', () => {
    const md = '```\ncode block 1\n```\n```\ncode block 2\n```';
    const result = markdownToContent(md);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty('background', '#1e293b');
    expect(result[1]).toHaveProperty('background', '#1e293b');
    expect(result[0]).toHaveProperty('text', 'code block 1');
    expect(result[1]).toHaveProperty('text', 'code block 2');
  });

  it('handles content with only horizontal rules', () => {
    const md = '---\n---\n---';
    const result = markdownToContent(md);
    expect(result).toHaveLength(3);
    for (const node of result) {
      expect(node).toHaveProperty('canvas');
    }
  });

  it('handles consecutive horizontal rules', () => {
    const md = 'Text before\n---\n---\n---\nText after';
    const result = markdownToContent(md);
    expect(result).toHaveLength(5);
    expect(result[0]).toHaveProperty('text', 'Text before');
    expect(result[1]).toHaveProperty('canvas');
    expect(result[2]).toHaveProperty('canvas');
    expect(result[3]).toHaveProperty('canvas');
    expect(result[4]).toHaveProperty('text', 'Text after');
  });

  it('skips whitespace-only lines', () => {
    const result = markdownToContent('Line 1\n   \n\t\nLine 2');
    expect(result).toHaveLength(2);
  });

  it('detects code fence with CRLF line endings', () => {
    const result = markdownToContent('```\r\ncode\r\n```\r\n');
    expect(result).toHaveLength(1);
    // codeBuffer pushes the un-trimmed line, so \r is retained in content
    expect(result[0]).toHaveProperty('text', 'code\r');
  });

  it('detects code fence with trailing spaces', () => {
    const result = markdownToContent('```   \ncode\n```');
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('text', 'code');
  });

  it('handles unicode and special characters', () => {
    const md = '# Café résumé\n\nCrème brûlée cost: $10 — 日本語\n\n`console.log("héllo")`';
    const result = markdownToContent(md);
    expect(result).toHaveLength(3);
    expect(result[0]).toHaveProperty('text', 'Café résumé');
    expect(result[1]).toHaveProperty('text');
    // The paragraph text should contain unicode chars
    const paraText = (result[1] as Record<string, unknown>).text as string;
    expect(paraText).toContain('日本語');
    expect(paraText).toContain('—');
    // Inline code with unicode content retains its full backtick-delimited content
    expect(result[2]).toHaveProperty('text');
    const codeParts = (result[2] as Record<string, unknown>).text as Record<string, unknown>[];
    expect(codeParts[0]).toHaveProperty('text', 'console.log("héllo")');
  });

  it('handles bold inside inline code (bold pattern inside backticks)', () => {
    // Bold pattern `**bold**` inside backticks should be treated as code, not bold
    const result = markdownToContent('Use `**bold**` in your code');
    expect(result).toHaveLength(1);
    const parts = (result[0] as Record<string, unknown>).text as Record<string, unknown>[];
    // Find the code part
    const codeParts = parts.filter((p) => p.background === '#f1f5f9');
    expect(codeParts).toHaveLength(1);
    expect(codeParts[0]).toHaveProperty('text', '**bold**');
    // No part should have bold: true
    const boldParts = parts.filter((p) => p.bold === true);
    expect(boldParts).toHaveLength(0);
  });

  it('handles multiple inline formatting elements in one line', () => {
    const result = markdownToContent('**bold1** plain `code1` **bold2** `code2` end');
    expect(result).toHaveLength(1);
    const parts = (result[0] as Record<string, unknown>).text as Record<string, unknown>[];
    // Should have: bold1, plain text, code1, bold2, code2, end text
    expect(parts).toContainEqual({ text: 'bold1', bold: true });
    expect(parts).toContainEqual({ text: 'bold2', bold: true });
    expect(parts).toContainEqual({ text: 'code1', background: '#f1f5f9', color: '#b45309' });
    expect(parts).toContainEqual({ text: 'code2', background: '#f1f5f9', color: '#b45309' });
    expect(parts).toContainEqual({ text: ' plain ' });
    expect(parts).toContainEqual({ text: ' end' });
  });

  it('uses CRITICAL severity colors', () => {
    const result = markdownToContent('### [CRITICAL] Danger');
    const body = ((result[0] as Record<string, unknown>).table as Record<string, unknown>).body as Record<string, unknown>[][];
    const cells = body[0];
    // Column 1: empty fill with red border color
    expect(cells[0]).toHaveProperty('fillColor', '#ef4444');
    // Column 2: CRITICAL badge with specific colors
    expect(cells[1]).toHaveProperty('color', '#dc2626');
    expect(cells[1]).toHaveProperty('fillColor', '#fef2f2');
    // Column 3: title with matching colors
    expect(cells[2]).toHaveProperty('color', '#dc2626');
    expect(cells[2]).toHaveProperty('fillColor', '#fef2f2');
  });

  it('handles severity block with empty title', () => {
    const result = markdownToContent('### [WARNING]');
    expect(result).toHaveLength(1);
    const body = ((result[0] as Record<string, unknown>).table as Record<string, unknown>).body as Record<string, unknown>[][];
    expect(body[0][2]).toHaveProperty('text', '');
  });
});
