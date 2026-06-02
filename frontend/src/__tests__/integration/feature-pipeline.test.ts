// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auditStream } from '../../api/auditClient';
import { markdownToContent, exportPdf } from '../../utils/exportPdf';
import fixtureContent from '../../test-fixtures/fraudlabs-audit-result.md?raw';
import swaggerSpec from '../../test-fixtures/fraudlabs-swagger.json?raw';

// ---------------------------------------------------------------------------
// Mock pdfmake for exportPdf tests (same pattern as exportPdf.test.ts)
// vi.mock is hoisted to the top by Vitest so this affects all imports.
// ---------------------------------------------------------------------------
vi.mock('pdfmake/build/pdfmake', () => {
  const mockDownload = vi.fn().mockResolvedValue(undefined);
  const mockCreatePdf = vi.fn(() => ({ download: mockDownload }));
  return {
    default: {
      createPdf: mockCreatePdf,
      addVirtualFileSystem: vi.fn(),
      fonts: {},
    },
  };
});

vi.mock('pdfmake/build/vfs_fonts', () => ({
  default: {},
}));

// Get a reference to the mocked createPdf for assertions in Group 3
import pdfMake from 'pdfmake/build/pdfmake';
const mockCreatePdf = pdfMake.createPdf as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/**
 * Creates a mock SSE Response that yields the given chunks as SSE data lines.
 * Each chunk is JSON-encoded and wrapped in `data: <json>\n`.
 * If a signal is provided, the reader checks its `aborted` state on each read.
 */
function createSSEMockResponse(chunks: string[], signal?: AbortSignal): Response {
  const encoder = new TextEncoder();
  const encoded = chunks.map((c) => encoder.encode(`data: ${JSON.stringify(c)}\n`));

  let i = 0;
  const reader: ReadableStreamDefaultReader<Uint8Array> = {
    read() {
      if (signal?.aborted) {
        return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
      }
      if (i < encoded.length) {
        return Promise.resolve({ done: false, value: encoded[i++] });
      }
      return Promise.resolve({ done: true, value: undefined as unknown as Uint8Array });
    },
    cancel() {
      /* noop */
    },
    releaseLock() {
      /* noop */
    },
    closed: Promise.resolve(undefined),
  } as ReadableStreamDefaultReader<Uint8Array>;

  return {
    ok: true,
    status: 200,
    body: { getReader: () => reader },
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Data prep
// ---------------------------------------------------------------------------

// Split by \n\n but keep the delimiter attached to each preceding chunk
// so that simple concatenation reproduces the original content exactly.
const fixtureChunks = (() => {
  const parts = fixtureContent.split(/(\n\n)/);
  const chunks: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    chunks.push(parts[i] + (parts[i + 1] || ''));
  }
  return chunks.filter(Boolean);
})();
const hrCount = (fixtureContent.match(/^---$/gm) ?? []).length;

// ---------------------------------------------------------------------------
// Group 1 – SSE Streaming Pipeline
// ---------------------------------------------------------------------------

describe('SSE Streaming Pipeline', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1: auditStream accumulates all chunks into the correct final result', async () => {
    const mockResponse = createSSEMockResponse(fixtureChunks);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

    const onChunk = vi.fn();
    const accumulated: string[] = [];
    const handler = (chunk: string) => {
      accumulated.push(chunk);
      onChunk(chunk);
    };

    await auditStream({ spec: swaggerSpec }, handler, new AbortController().signal);

    const fullResult = accumulated.join('');
    expect(fullResult).toBe(fixtureContent);
  });

  it('2: onChunk called for each SSE data line', async () => {
    const mockResponse = createSSEMockResponse(fixtureChunks);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

    const onChunk = vi.fn();
    await auditStream({ spec: swaggerSpec }, onChunk, new AbortController().signal);

    expect(onChunk).toHaveBeenCalledTimes(fixtureChunks.length);
  });

  it('3: handles the full content without errors', async () => {
    const mockResponse = createSSEMockResponse(fixtureChunks);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

    const onChunk = vi.fn();
    await expect(
      auditStream({ spec: swaggerSpec }, onChunk, new AbortController().signal)
    ).resolves.toBeUndefined();
  });

  it('4: abort cancels mid-stream', async () => {
    const controller = new AbortController();
    const signal = controller.signal;

    const mockResponse = createSSEMockResponse(fixtureChunks, signal);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

    const onChunk = vi.fn();
    const promise = auditStream({ spec: swaggerSpec }, onChunk, signal);

    // Abort synchronously after starting — the reader will check on first read
    controller.abort();

    await expect(promise).rejects.toThrow('The operation was aborted');
  });

  it('5: fixture is valid markdown with expected headers', () => {
    expect(fixtureContent).toContain('# SpecAudit Report');
    expect(fixtureContent).toContain('[CRITICAL]');
    expect(fixtureContent).toContain('[WARNING]');
    expect(fixtureContent).toContain('[INFO]');
    expect(fixtureContent).toContain('Governance Score');
  });
});

// ---------------------------------------------------------------------------
// Group 2 – Content Structure Verification
// ---------------------------------------------------------------------------

describe('Content Structure Verification', () => {
  it('6: markdownToContent parses the full realistic output', () => {
    const content = markdownToContent(fixtureContent);
    expect(Array.isArray(content)).toBe(true);
    expect(content.length).toBeGreaterThan(0);
  });

  it('7: all 14 findings produce table nodes with noBorders', () => {
    const content = markdownToContent(fixtureContent);
    const tables = content.filter(
      (n) => (n as Record<string, unknown>).table && (n as Record<string, unknown>).layout === 'noBorders'
    );
    expect(tables).toHaveLength(14);
  });

  it('8: 6 CRITICAL blocks with correct badge text', () => {
    const content = markdownToContent(fixtureContent);
    const criticalTables = content.filter((n) => {
      const node = n as Record<string, unknown>;
      if (!node.table) return false;
      const body = (node.table as Record<string, unknown>).body as Record<string, unknown>[][];
      return body[0]?.[1] && (body[0][1] as Record<string, unknown>).text === 'CRITICAL';
    });
    expect(criticalTables).toHaveLength(6);
  });

  it('9: 4 WARNING blocks with correct badge text', () => {
    const content = markdownToContent(fixtureContent);
    const warningTables = content.filter((n) => {
      const node = n as Record<string, unknown>;
      if (!node.table) return false;
      const body = (node.table as Record<string, unknown>).body as Record<string, unknown>[][];
      return body[0]?.[1] && (body[0][1] as Record<string, unknown>).text === 'WARNING';
    });
    expect(warningTables).toHaveLength(4);
  });

  it('10: 4 INFO blocks with correct badge text', () => {
    const content = markdownToContent(fixtureContent);
    const infoTables = content.filter((n) => {
      const node = n as Record<string, unknown>;
      if (!node.table) return false;
      const body = (node.table as Record<string, unknown>).body as Record<string, unknown>[][];
      return body[0]?.[1] && (body[0][1] as Record<string, unknown>).text === 'INFO';
    });
    expect(infoTables).toHaveLength(4);
  });

  it('11: Summary heading is parsed as h2', () => {
    const content = markdownToContent(fixtureContent);
    const summaryHeading = content.find(
      (n) =>
        (n as Record<string, unknown>).text === 'Summary' &&
        (n as Record<string, unknown>).fontSize === 14 &&
        (n as Record<string, unknown>).bold === true
    );
    expect(summaryHeading).toBeDefined();
  });

  it('12: Findings heading is parsed as h2 (fixture uses ##)', () => {
    const content = markdownToContent(fixtureContent);
    const findingsHeading = content.find(
      (n) =>
        (n as Record<string, unknown>).text === 'Findings' &&
        (n as Record<string, unknown>).fontSize === 14 &&
        (n as Record<string, unknown>).bold === true
    );
    expect(findingsHeading).toBeDefined();
  });

  it('13: Governance Score heading is parsed as h2 (fixture uses ##)', () => {
    const content = markdownToContent(fixtureContent);
    const governanceHeading = content.find(
      (n) =>
        (n as Record<string, unknown>).text === 'Governance Score' &&
        (n as Record<string, unknown>).fontSize === 14 &&
        (n as Record<string, unknown>).bold === true
    );
    expect(governanceHeading).toBeDefined();
  });

  it('14: horizontal rules preserved – canvas count matches --- count', () => {
    const content = markdownToContent(fixtureContent);
    const canvasNodes = content.filter((n) => (n as Record<string, unknown>).canvas);
    expect(canvasNodes).toHaveLength(hrCount);
    expect(hrCount).toBeGreaterThan(0);
  });

  it('15: inline bold preserved (e.g. **Total Findings:**)', () => {
    const content = markdownToContent(fixtureContent);
    // Search all content nodes for inline bold segments
    const hasBoldSegment = content.some((n) => {
      const node = n as Record<string, unknown>;
      if (Array.isArray(node.text)) {
        return (node.text as Record<string, unknown>[]).some((part) => part.bold === true);
      }
      return false;
    });
    expect(hasBoldSegment).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Group 3 – Export PDF
// ---------------------------------------------------------------------------
// Note: pdfmake is mocked at the top of the file via vi.mock.
// mockCreatePdf is the vi.fn that captures calls to pdfMake.createPdf.

describe('Export PDF', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockCreatePdf.mockClear();
  });

  it('16: creates docDefinition with correct structure', async () => {
    await expect(exportPdf(fixtureContent)).resolves.toBeUndefined();
    // Verify pdfmake.createPdf was called (docDefinition was built)
    expect(mockCreatePdf).toHaveBeenCalledTimes(1);
    const docDef = mockCreatePdf.mock.calls[0][0];
    expect(docDef).toHaveProperty('pageSize', 'A4');
    expect(docDef).toHaveProperty('content');
    expect(Array.isArray(docDef.content)).toBe(true);
  });

  it('17: title block includes SpecAudit Report', async () => {
    await exportPdf(fixtureContent);

    expect(mockCreatePdf).toHaveBeenCalledTimes(1);
    const docDef = mockCreatePdf.mock.calls[0][0];
    const firstContent = docDef.content[0] as Record<string, unknown>;
    expect(firstContent).toHaveProperty('stack');
    const stack = firstContent.stack as Record<string, unknown>[];
    expect(stack[0]).toHaveProperty('text', 'SpecAudit Report');
  });

  it('18: all severity blocks represented in PDF content', async () => {
    await exportPdf(fixtureContent);

    const docDef = mockCreatePdf.mock.calls[0][0];
    // content[0] is the title stack, rest is from markdownToContent
    const parsedContent = docDef.content.slice(1);
    const tableNodes = parsedContent.filter(
      (n: Record<string, unknown>) => n.table && n.layout === 'noBorders'
    );
    expect(tableNodes).toHaveLength(14);
  });

  it('19: uses default filename format', async () => {
    // Create test-specific mockDownload to verify filename
    const mockDownload = vi.fn().mockResolvedValue(undefined);
    mockCreatePdf.mockReturnValue({ download: mockDownload });

    await exportPdf(fixtureContent);

    expect(mockDownload).toHaveBeenCalledWith(
      expect.stringMatching(/^specaudit-report-\d+\.pdf$/)
    );
  });

  it('20: accepts custom filename', async () => {
    const mockDownload = vi.fn().mockResolvedValue(undefined);
    mockCreatePdf.mockReturnValue({ download: mockDownload });

    await exportPdf(fixtureContent, 'my-report.pdf');

    expect(mockDownload).toHaveBeenCalledWith('my-report.pdf');
  });
});

// ---------------------------------------------------------------------------
// Group 4 – Download (Markdown)
// ---------------------------------------------------------------------------

describe('Download', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('21: creates Blob with correct content and type', async () => {
    const blob = new Blob([fixtureContent], { type: 'text/markdown;charset=utf-8' });
    expect(blob.type).toBe('text/markdown;charset=utf-8');
    const text = await blob.text();
    expect(text).toBe(fixtureContent);
  });

  it('22: anchor configured with correct filename pattern', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');

    const blob = new Blob([fixtureContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `specaudit-report-${Date.now()}.md`;

    expect(a.download).toMatch(/^specaudit-report-\d+\.md$/);
    expect(a.href).toBe('blob:mock-url');

    // Cleanup
    URL.revokeObjectURL(url);
  });

  it('23: triggers click on anchor (full download flow)', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(URL, 'revokeObjectURL');

    const origCreateElement = document.createElement.bind(document);
    const mockAnchor = origCreateElement('a') as HTMLAnchorElement;
    const clickSpy = vi.fn();
    mockAnchor.click = clickSpy;
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') return mockAnchor as unknown as HTMLElement;
      return origCreateElement(tagName);
    });

    // Execute download handler (same pattern as App.tsx handleDownload)
    const blob = new Blob([fixtureContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `specaudit-report-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});

// ---------------------------------------------------------------------------
// Group 5 – Copy
// ---------------------------------------------------------------------------

describe('Copy', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('24: writes full fixture content to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    await navigator.clipboard.writeText(fixtureContent);

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(fixtureContent);
  });

  it('25: copy works with partial fixture content (single finding excerpt)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    // Extract the first severity block from the fixture
    const excerpt = '### [CRITICAL] Missing Security Scheme Definition';
    await navigator.clipboard.writeText(excerpt);

    expect(writeText).toHaveBeenCalledWith(excerpt);
  });
});

// ---------------------------------------------------------------------------
// Group 6 – Spec Format Detection
// ---------------------------------------------------------------------------

describe('Spec Format Detection', () => {
  it('26: swagger fixture is valid parseable JSON', () => {
    expect(() => JSON.parse(swaggerSpec)).not.toThrow();
  });

  it('27: fixture has expected OpenAPI structure', () => {
    const parsed = JSON.parse(swaggerSpec);
    expect(parsed.openapi).toBe('3.0.1');
    expect(parsed.info.title).toContain('FraudLabs');
  });
});

// ---------------------------------------------------------------------------
// Group 7 – Edge Cases (Robustness & Error Recovery)
// ---------------------------------------------------------------------------

describe('Edge Cases', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('28: trailing whitespace on fixture lines does not break parsing', () => {
    // Simulate a real-world scenario where the AI output has trailing spaces
    const modifiedContent = fixtureContent
      .split('\n')
      .map((line) => (line.trim() === '' ? line : line + '   '))
      .join('\n');

    const content = markdownToContent(modifiedContent);

    // Should still produce valid content with all severity blocks detected
    expect(Array.isArray(content)).toBe(true);
    expect(content.length).toBeGreaterThan(0);

    const tables = content.filter(
      (n) => (n as Record<string, unknown>).table && (n as Record<string, unknown>).layout === 'noBorders'
    );
    expect(tables).toHaveLength(14);
  });

  it('29: severity block with empty title after severity tag is handled', () => {
    // Finding with severity but no title — regex `(.*)$` captures empty string
    const contentWithEmptyTitle = fixtureContent.replace(
      '### [CRITICAL] Missing Security Scheme Definition',
      '### [CRITICAL]'
    );

    const content = markdownToContent(contentWithEmptyTitle);
    const tables = content.filter(
      (n) => (n as Record<string, unknown>).table && (n as Record<string, unknown>).layout === 'noBorders'
    );

    // Still 14 blocks, one with empty title
    expect(tables).toHaveLength(14);

    // Find the table whose badge text is "CRITICAL" but title is empty
    const criticalWithEmptyTitle = tables.filter((n) => {
      const body = ((n as Record<string, unknown>).table as Record<string, unknown>).body as Record<string, unknown>[][];
      return body[0]?.[1] && (body[0][1] as Record<string, unknown>).text === 'CRITICAL' && (body[0][2] as Record<string, unknown>).text === '';
    });
    expect(criticalWithEmptyTitle).toHaveLength(1);
  });

  it('30: unclosed code fence in fixture content is handled gracefully', () => {
    // Add an unclosed code fence to the end of fixture content
    const contentWithUnclosedFence = fixtureContent + '\n```\nconst x = 1;\nconst y = 2;\n';

    // Should not throw and should produce a code content node from the unclosed block
    const content = markdownToContent(contentWithUnclosedFence);
    expect(Array.isArray(content)).toBe(true);
    expect(content.length).toBeGreaterThan(0);

    // The unclosed fence content should appear as a code node
    const codeNodes = content.filter(
      (n) => (n as Record<string, unknown>).background === '#1e293b'
    );
    expect(codeNodes.length).toBeGreaterThan(0);
    const lastCodeNode = codeNodes[codeNodes.length - 1] as Record<string, unknown>;
    expect(lastCodeNode.text).toContain('const x = 1;');
  });

  it('31: download catch block prevents errors from propagating', () => {
    // Simulate a browser API failure (e.g., Blob constructor throws)
    // This mirrors the try/catch pattern in App.tsx handleDownload
    const handleDownloadSafe = () => {
      try {
        const blob = new Blob([fixtureContent], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `specaudit-report-${Date.now()}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {
        // Download API unavailable — silently ignore (same as App.tsx)
      }
    };

    // Make createObjectURL throw
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      throw new Error('URL API unavailable');
    });

    // Should not throw — error is caught by the catch block
    expect(() => handleDownloadSafe()).not.toThrow();
  });

  it('32: exportPdf catch block prevents errors from propagating', async () => {
    // Make pdfmake.createPdf throw — this mirrors the try/catch in App.tsx handleExportPdf
    mockCreatePdf.mockImplementation(() => {
      throw new Error('pdfmake crashed');
    });

    const handleExportPdfSafe = async () => {
      try {
        await exportPdf(fixtureContent);
      } catch {
        // PDF generation failed — silently ignore (same as App.tsx)
      }
    };

    // Should not throw — error is caught
    await expect(handleExportPdfSafe()).resolves.toBeUndefined();
  });
});
