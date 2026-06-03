import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';

// pdfmake 0.3.x UMD build exports { default: instance } where the instance
// has createPdf, addVirtualFileSystem, fonts, etc. The type declarations
// describe named exports (not a default export), so we use a module-level
// assertion to match the runtime shape.
import pdfMakeModule from 'pdfmake/build/pdfmake';

interface PdfMakeInstance {
  createPdf(docDefinition: TDocumentDefinitions): { download: (name: string) => Promise<void> };
  addVirtualFileSystem(vfs: Record<string, string>): void;
  fonts: Record<string, unknown>;
  vfs: Record<string, string>;
}

const pdfMake = pdfMakeModule as unknown as PdfMakeInstance;

// Load built-in Roboto fonts from the bundled VFS
import pdfFonts from 'pdfmake/build/vfs_fonts';
pdfMake.addVirtualFileSystem(pdfFonts);

const SEVERITY_COLORS: Record<string, { border: string; badge: string; bg: string }> = {
  CRITICAL: { border: '#ef4444', badge: '#dc2626', bg: '#fef2f2' },
  WARNING: { border: '#f59e0b', badge: '#d97706', bg: '#fffbeb' },
  INFO: { border: '#3b82f6', badge: '#2563eb', bg: '#eff6ff' },
};

/**
 * Parses a plain-text line into pdfmake inline content segments,
 * handling **bold** and `inline code` spans.
 */
function parseParagraph(line: string): Record<string, unknown> {
  // Two-pass: first extract code spans (backtick-delimited), then parse bold
  const codeSplitRegex = /(`[^`]+`)/;
  const segments = line.split(codeSplitRegex);
  const textParts: Record<string, unknown>[] = [];

  for (const segment of segments) {
    if (segment.startsWith('`') && segment.endsWith('`')) {
      // Inline code span
      textParts.push({
        text: segment.slice(1, -1),
        background: '#f1f5f9',
        color: '#b45309',
      });
    } else if (segment) {
      // Parse bold in non-code segments
      const boldSplitRegex = /(\*\*[^*]+\*\*)/;
      const boldSegments = segment.split(boldSplitRegex);
      for (const boldSegment of boldSegments) {
        if (boldSegment.startsWith('**') && boldSegment.endsWith('**')) {
          textParts.push({
            text: boldSegment.slice(2, -2),
            bold: true,
          });
        } else if (boldSegment) {
          textParts.push({ text: boldSegment });
        }
      }
    }
  }

  // If only one simple text part, return simple form
  if (textParts.length === 1 && !textParts[0].bold && !textParts[0].background) {
    return {
      text: textParts[0].text as string,
      fontSize: 11,
      lineHeight: 1.5,
      margin: [0, 4, 0, 4],
    };
  }

  return {
    text: textParts,
    fontSize: 11,
    lineHeight: 1.5,
    margin: [0, 4, 0, 4],
  };
}

/**
 * Converts a severity block line (`### [SEVERITY] Title`) into a
 * pdfmake table node with a colored left-border accent.
 */
function buildSeverityBlock(severity: string, title: string): Record<string, unknown> {
  const colors = SEVERITY_COLORS[severity] ?? SEVERITY_COLORS.INFO;
  return {
    table: {
      widths: [4, 'auto', '*'],
      body: [[
        { text: '', fillColor: colors.border },
        {
          text: severity,
          fillColor: colors.bg,
          color: colors.badge,
          bold: true,
          fontSize: 10,
          margin: [6, 4, 6, 4],
        },
        {
          text: title,
          fillColor: colors.bg,
          color: colors.badge,
          bold: true,
          fontSize: 11,
          margin: [0, 4, 8, 4],
        },
      ]],
    },
    layout: 'noBorders',
    margin: [0, 6, 0, 6],
  };
}

/**
 * Converts raw markdown content into a pdfmake content array.
 *
 * Handles: h1, h2, severity blocks `### [CRITICAL|WARNING|INFO]`,
 * fenced code blocks, inline code, bold, horizontal rules, and paragraphs.
 *
 * Exported for testing.
 */
export function markdownToContent(markdown: string): Record<string, unknown>[] {
  const lines = markdown.split('\n');
  const content: Record<string, unknown>[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];

  const flushCodeBlock = (): void => {
    if (codeBuffer.length > 0) {
      content.push({
        text: codeBuffer.join('\n'),
        background: '#1e293b',
        color: '#e2e8f0',
        fontSize: 9,
        margin: [0, 8, 0, 8],
      });
      codeBuffer = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine;

    // --- Code fence handling ---
    const codeFenceMatch = line.trimEnd().match(/^```(\w*)$/);
    if (codeFenceMatch) {
      if (inCodeBlock) {
        flushCodeBlock();
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    // --- Skip empty lines ---
    if (line.trim() === '') continue;

    // --- Severity blocks (`### [CRITICAL|WARNING|INFO] Title`) ---
    const severityMatch = line.match(/^###\s+\[(CRITICAL|WARNING|INFO)\]\s*(.*)$/);
    if (severityMatch) {
      content.push(buildSeverityBlock(severityMatch[1], severityMatch[2]));
      continue;
    }

    // --- h1 (`# Title`) ---
    const h1Match = line.match(/^#\s+(.+)$/);
    if (h1Match) {
      content.push({
        text: h1Match[1],
        fontSize: 18,
        bold: true,
        margin: [0, 16, 0, 8],
        color: '#0f172a',
      });
      continue;
    }

    // --- h2 (`## Title`) ---
    const h2Match = line.match(/^##\s+(.+)$/);
    if (h2Match) {
      content.push({
        text: h2Match[1],
        fontSize: 14,
        bold: true,
        margin: [0, 14, 0, 6],
        color: '#0f172a',
      });
      continue;
    }

    // --- Horizontal rule (`---`) ---
    if (line.trim() === '---') {
      content.push({
        canvas: [
          { type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#e2e8f0' },
        ],
        margin: [0, 12, 0, 12],
      });
      continue;
    }

    // --- Regular paragraph with inline formatting ---
    content.push(parseParagraph(line));
  }

  // Flush unclosed code block (treat remaining lines as code)
  if (inCodeBlock) {
    flushCodeBlock();
  }

  return content;
}

/**
 * Converts audit result markdown into a downloadable PDF and triggers save.
 *
 * Uses pdfmake for native PDF generation (no DOM, no screenshots).
 *
 * @param content - Raw markdown string (same as state.result)
 * @param filename - Optional output filename (default: `specaudit-report-<timestamp>.pdf`)
 */
export async function exportPdf(content: string, filename?: string): Promise<void> {
  if (!content) return;

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 60],
    info: {
      title: 'SpecAudit Report',
      author: 'SpecAudit',
      subject: 'OpenAPI Contract Audit Report',
    },
    content: [
      {
        stack: [
          {
            text: 'SpecAudit Report',
            fontSize: 22,
            bold: true,
            color: '#1e40af',
            margin: [0, 0, 0, 4],
          },
          {
            text: `Generated ${new Date().toLocaleString()}`,
            fontSize: 10,
            color: '#64748b',
            margin: [0, 0, 0, 24],
          },
        ],
      } as unknown as Content,
      ...(markdownToContent(content) as unknown as Content[]),
    ],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 11,
      color: '#334155',
    },
  };

  const pdfInstance = pdfMake.createPdf(docDefinition);
  await pdfInstance.download(filename ?? `specaudit-report-${Date.now()}.pdf`);
}
