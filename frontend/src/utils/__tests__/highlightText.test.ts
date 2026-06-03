import { describe, it, expect } from 'vitest';
import { highlightText } from '../highlightText';

describe('highlightText', () => {
  it('returns text unchanged for empty query', () => {
    expect(highlightText('hello world', '')).toBe('hello world');
  });

  it('wraps matching text in <mark> tags', () => {
    expect(highlightText('hello world', 'world'))
      .toBe('hello <mark class="search-highlight">world</mark>');
  });

  it('is case-insensitive', () => {
    expect(highlightText('Hello World', 'world'))
      .toBe('Hello <mark class="search-highlight">World</mark>');
  });

  it('highlights all occurrences', () => {
    expect(highlightText('test test test', 'test'))
      .toBe(
        '<mark class="search-highlight">test</mark> '
        + '<mark class="search-highlight">test</mark> '
        + '<mark class="search-highlight">test</mark>'
      );
  });

  it('escapes regex special characters', () => {
    expect(highlightText('cost (total)', '(total)'))
      .toBe('cost <mark class="search-highlight">(total)</mark>');
  });

  it('returns empty string for empty text', () => {
    expect(highlightText('', 'test')).toBe('');
  });

  it('returns text unchanged when query not found', () => {
    expect(highlightText('hello world', 'xyz')).toBe('hello world');
  });
});
