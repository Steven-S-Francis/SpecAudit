import type { SeverityLevel } from '../types/audit';

/**
 * Removes finding blocks whose severity is in `hiddenSeverities`.
 * Non-finding blocks (Summary, Governance Score, etc.) are always kept.
 * Each finding block starts with `### [SEVERITY]` and is split from surrounding
 * content by matching a newline followed by a severity header.
 */
export function filterMarkdownBySeverity(
  content: string,
  hiddenSeverities: Set<SeverityLevel>
): string {
  if (hiddenSeverities.size === 0) return content;

  const blockSplitter = /\n(?=### \[(?:CRITICAL|WARNING|INFO)\])/;
  const blocks = content.split(blockSplitter);

  const filtered = blocks.filter((block) => {
    const severity = extractSeverityFromBlock(block);
    return !severity || !hiddenSeverities.has(severity);
  });

  return filtered.join('\n');
}

/**
 * Extract severity from a finding block header, or null if this is not a finding block.
 */
function extractSeverityFromBlock(block: string): SeverityLevel | null {
  if (/^### \[CRITICAL\]/m.test(block)) return 'CRITICAL';
  if (/^### \[WARNING\]/m.test(block))  return 'WARNING';
  if (/^### \[INFO\]/m.test(block))     return 'INFO';
  return null;
}
