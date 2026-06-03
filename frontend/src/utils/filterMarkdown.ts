import type { SeverityLevel } from '../types/audit';

/**
 * Removes finding blocks whose severity is in `hiddenSeverities`.
 * Non-finding blocks (Summary, Governance Score, etc.) are always kept.
 * A finding block starts with `### [SEVERITY]` and is separated by `\n---\n`.
 */
export function filterMarkdownBySeverity(
  content: string,
  hiddenSeverities: Set<SeverityLevel>
): string {
  if (hiddenSeverities.size === 0) return content;

  const separator = '\n---\n';
  const blocks = content.split(separator);

  const filtered = blocks.filter((block) => {
    const severity = extractSeverityFromBlock(block);
    return !severity || !hiddenSeverities.has(severity);
  });

  return filtered.join(separator);
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
