import { describe, it, expect } from 'vitest';
import { splitIntoBlocks } from '../filterMarkdown';

const CRITICAL_BLOCK = '### [CRITICAL] Missing Auth\n\nDetails.';
const WARNING_BLOCK  = '### [WARNING] Missing 404\n\nDetails.';
const INFO_BLOCK     = '### [INFO] Missing Contact\n\nDetails.';
const NON_FINDING    = '## Governance Score\nScore: 8.5';

describe('splitIntoBlocks', () => {
  it('splits multiple severity blocks', () => {
    const content = [CRITICAL_BLOCK, WARNING_BLOCK, INFO_BLOCK].join('\n---\n');
    const blocks = splitIntoBlocks(content);
    expect(blocks).toHaveLength(3);
    expect(blocks[0].severity).toBe('CRITICAL');
    expect(blocks[1].severity).toBe('WARNING');
    expect(blocks[2].severity).toBe('INFO');
  });

  it('returns null severity for non-finding content', () => {
    const blocks = splitIntoBlocks(NON_FINDING);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].severity).toBeNull();
  });

  it('handles mixed content: non-finding followed by findings', () => {
    const content = [NON_FINDING, CRITICAL_BLOCK, WARNING_BLOCK].join('\n---\n');
    const blocks = splitIntoBlocks(content);
    expect(blocks).toHaveLength(3);
    expect(blocks[0].severity).toBeNull();
    expect(blocks[1].severity).toBe('CRITICAL');
    expect(blocks[2].severity).toBe('WARNING');
  });

  it('handles empty string', () => {
    const blocks = splitIntoBlocks('');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe('');
    expect(blocks[0].severity).toBeNull();
  });

  it('preserves block text content', () => {
    const blocks = splitIntoBlocks(CRITICAL_BLOCK);
    expect(blocks[0].text).toBe(CRITICAL_BLOCK);
  });

  it('does not split on partial/incomplete severity headers', () => {
    const content = '### [CRITI\nSome content\n### [WARNING] Real warning';
    const blocks = splitIntoBlocks(content);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].severity).toBeNull();  // Not matched
    expect(blocks[1].severity).toBe('WARNING');
  });
});
