import { describe, it, expect } from 'vitest';
import { filterMarkdownBySeverity } from '../filterMarkdown';

const CRITICAL_FINDING = `### [CRITICAL] Missing Auth Scheme
**Category:** Security
**Location:** /api/endpoint
**Issue:** No authentication defined
**Recommendation:** Add auth scheme`;

const WARNING_FINDING = `### [WARNING] Missing 404 Response
**Category:** REST Conformance
**Location:** /api/users
**Issue:** No 404 response defined
**Recommendation:** Add 404 response`;

const INFO_FINDING = `### [INFO] Missing Contact Block
**Category:** Documentation
**Location:** info.contact
**Issue:** Contact info missing
**Recommendation:** Add contact block`;

const NON_FINDING_BLOCK = `### Summary
This is a summary section that should always be visible.`;

const GOVERNANCE_BLOCK = `## Governance Score
Score: 8.5/10`;

describe('filterMarkdownBySeverity', () => {
  it('returns content unchanged when no severities are hidden', () => {
    const content = [CRITICAL_FINDING, WARNING_FINDING, INFO_FINDING].join('\n---\n');
    const result = filterMarkdownBySeverity(content, new Set());
    expect(result).toBe(content);
  });

  it('removes CRITICAL finding blocks', () => {
    const content = [CRITICAL_FINDING, WARNING_FINDING, INFO_FINDING].join('\n---\n');
    const result = filterMarkdownBySeverity(content, new Set(['CRITICAL']));
    expect(result).not.toContain('[CRITICAL]');
    expect(result).toContain('[WARNING]');
    expect(result).toContain('[INFO]');
  });

  it('removes WARNING finding blocks', () => {
    const content = [CRITICAL_FINDING, WARNING_FINDING, INFO_FINDING].join('\n---\n');
    const result = filterMarkdownBySeverity(content, new Set(['WARNING']));
    expect(result).toContain('[CRITICAL]');
    expect(result).not.toContain('[WARNING]');
    expect(result).toContain('[INFO]');
  });

  it('removes INFO finding blocks', () => {
    const content = [CRITICAL_FINDING, WARNING_FINDING, INFO_FINDING].join('\n---\n');
    const result = filterMarkdownBySeverity(content, new Set(['INFO']));
    expect(result).toContain('[CRITICAL]');
    expect(result).toContain('[WARNING]');
    expect(result).not.toContain('[INFO]');
  });

  it('removes multiple severity types simultaneously', () => {
    const content = [CRITICAL_FINDING, WARNING_FINDING, INFO_FINDING].join('\n---\n');
    const result = filterMarkdownBySeverity(content, new Set(['CRITICAL', 'INFO']));
    expect(result).not.toContain('[CRITICAL]');
    expect(result).toContain('[WARNING]');
    expect(result).not.toContain('[INFO]');
  });

  it('keeps non-finding sections (Summary, Governance Score)', () => {
    const content = [NON_FINDING_BLOCK, CRITICAL_FINDING, GOVERNANCE_BLOCK].join('\n---\n');
    const result = filterMarkdownBySeverity(content, new Set(['CRITICAL', 'WARNING', 'INFO']));
    expect(result).toContain('Summary');
    expect(result).toContain('Governance Score');
    expect(result).not.toContain('[CRITICAL]');
  });

  it('keeps plain h3 headings without severity', () => {
    const content = '### Some Title\nSome description\n---\n' + CRITICAL_FINDING;
    const result = filterMarkdownBySeverity(content, new Set(['CRITICAL']));
    expect(result).toContain('### Some Title');
    expect(result).not.toContain('[CRITICAL]');
  });

  it('handles empty content', () => {
    const result = filterMarkdownBySeverity('', new Set(['CRITICAL']));
    expect(result).toBe('');
  });

  it('handles content with no findings at all', () => {
    const content = '## Governance Score\nScore: 9/10';
    const result = filterMarkdownBySeverity(content, new Set(['CRITICAL']));
    expect(result).toBe(content);
  });

  it('handles content with one finding', () => {
    const result = filterMarkdownBySeverity(CRITICAL_FINDING, new Set(['CRITICAL']));
    expect(result).toBe('');
  });

  it('handles malformed severity header (partial streaming)', () => {
    const content = '### [CRITI\nSome partial content';
    const result = filterMarkdownBySeverity(content, new Set(['CRITICAL']));
    // Not matched, passes through
    expect(result).toBe(content);
  });

  it('preserves block order when filtering', () => {
    const content = [WARNING_FINDING, CRITICAL_FINDING, INFO_FINDING].join('\n---\n');
    const result = filterMarkdownBySeverity(content, new Set(['CRITICAL']));
    // Warning should come first, then Info (CRITICAL removed from middle)
    const warningIdx = result.indexOf('[WARNING]');
    const infoIdx = result.indexOf('[INFO]');
    expect(warningIdx).toBeGreaterThanOrEqual(0);
    expect(infoIdx).toBeGreaterThan(warningIdx);
  });

  it('handles --- appearing in Governance Score section (non-finding separator)', () => {
    const content = [CRITICAL_FINDING, GOVERNANCE_BLOCK + '\n\nSome text with --- dashes'].join('\n---\n');
    const result = filterMarkdownBySeverity(content, new Set(['CRITICAL']));
    expect(result).not.toContain('[CRITICAL]');
    expect(result).toContain('Governance Score');
  });
});
