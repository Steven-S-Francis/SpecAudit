import html2pdf from 'html2pdf.js';

/**
 * Converts markdown content to a clean HTML string with white-background
 * styling suitable for PDF output.
 */
function markdownToHtml(markdown: string): string {
  let html = markdown;

  // Escape HTML entities first to prevent XSS/injection
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Severity blocks: ### [CRITICAL|WARNING|INFO] Title
  html = html.replace(
    /###\s+\[(CRITICAL|WARNING|INFO)\]\s*(.*?)(?:\n|$)/g,
    (_match, severity: string, title: string) => {
      const colors: Record<string, { border: string; bg: string; badge: string; text: string }> = {
        CRITICAL: { border: '#ef4444', bg: '#fef2f2', badge: '#dc2626', text: '#dc2626' },
        WARNING:  { border: '#f59e0b', bg: '#fffbeb', badge: '#d97706', text: '#d97706' },
        INFO:     { border: '#3b82f6', bg: '#eff6ff', badge: '#2563eb', text: '#2563eb' },
      };
      const s = colors[severity];
      return `<div style="border-left:4px solid ${s.border};background:${s.bg};padding:12px 16px;margin:12px 0;border-radius:0 8px 8px 0;">
        <span style="display:inline-block;font-size:11px;font-weight:700;color:${s.badge};background:${s.badge}22;padding:2px 8px;border-radius:4px;margin-right:8px;">${severity}</span>
        <span style="font-weight:600;color:${s.text};">${title}</span>
      </div>`;
    }
  );

  // Fenced code blocks
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, _lang: string, code: string) => {
    const escaped = code.trim();
    return `<pre style="background:#1e293b;color:#e2e8f0;padding:16px;border-radius:8px;overflow-x:auto;font-size:12px;line-height:1.5;margin:12px 0;"><code>${escaped}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code style="background:#f1f5f9;color:#b45309;padding:2px 6px;border-radius:4px;font-size:12px;">$1</code>');

  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;" />');

  // Headings (h1, h2)
  html = html.replace(/^## (.+)$/gm, '<h2 style="font-size:16px;font-weight:700;margin:16px 0 8px;color:#0f172a;">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 style="font-size:20px;font-weight:700;margin:20px 0 12px;color:#0f172a;">$1</h1>');

  // Remaining lines as paragraphs (skip empty lines and already-converted blocks)
  const lines = html.split('\n');
  const result: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Skip lines already wrapped in block-level tags
    if (/^<(div|pre|h[12]|hr|strong|code)/i.test(trimmed)) {
      result.push(trimmed);
    } else if (/^<\/(div|pre|h[12]|hr)>/i.test(trimmed)) {
      result.push(trimmed);
    } else {
      result.push(`<p style="font-size:12px;line-height:1.6;margin:6px 0;color:#334155;">${trimmed}</p>`);
    }
  }

  return result.join('\n');
}

/**
 * Converts audit result markdown into a downloadable PDF and triggers save.
 *
 * Uses html2pdf.js to render clean HTML on a white background with readable
 * serif/sans-serif fonts, suitable for printing and sharing.
 *
 * @param content - Raw markdown string (same as state.result)
 * @param filename - Optional output filename (default: `specaudit-report-<timestamp>.pdf`)
 */
export async function exportPdf(content: string, filename?: string): Promise<void> {
  if (!content) return;

  const element = document.createElement('div');
  element.style.cssText =
    'position:fixed;left:-9999px;top:0;width:800px;padding:40px;' +
    'font-family:Arial,Helvetica,sans-serif;color:#000;background:#fff;' +
    'line-height:1.5;font-size:12px;';

  element.innerHTML = `
    <div style="border-bottom:2px solid #1e40af;padding-bottom:12px;margin-bottom:20px;">
      <h1 style="font-size:22px;font-weight:700;color:#1e40af;margin:0;">SpecAudit Report</h1>
      <p style="font-size:11px;color:#64748b;margin:4px 0 0;">Generated ${new Date().toLocaleString()}</p>
    </div>
    ${markdownToHtml(content)}
  `;

  document.body.appendChild(element);

  try {
    await html2pdf()
      .set({
        margin: [0.4, 0.4, 0.4, 0.4],
        filename: filename ?? `specaudit-report-${Date.now()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: false,
          backgroundColor: '#ffffff',
          logging: false,
        },
        jsPDF: {
          unit: 'in',
          format: 'a4',
          orientation: 'portrait',
        },
      })
      .from(element)
      .save();
  } finally {
    document.body.removeChild(element);
  }
}
