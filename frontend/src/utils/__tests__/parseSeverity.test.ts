import { describe, it, expect } from 'vitest';
import { parseSeverity } from '../parseSeverity';

describe('parseSeverity', () => {
  it('returns CRITICAL for a [CRITICAL] heading', () => {
    expect(parseSeverity('[CRITICAL] Missing Auth Scheme')).toBe('CRITICAL');
  });

  it('returns WARNING for a [WARNING] heading', () => {
    expect(parseSeverity('[WARNING] Missing 404 Response')).toBe('WARNING');
  });

  it('returns INFO for an [INFO] heading', () => {
    expect(parseSeverity('[INFO] Missing Contact Block')).toBe('INFO');
  });

  it('returns null for a plain heading with no severity tag', () => {
    expect(parseSeverity('Summary')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parseSeverity('')).toBeNull();
  });

  it('CRITICAL takes precedence when multiple tags appear in the same string', () => {
    expect(parseSeverity('[CRITICAL] something with [WARNING] in text')).toBe('CRITICAL');
  });
});
