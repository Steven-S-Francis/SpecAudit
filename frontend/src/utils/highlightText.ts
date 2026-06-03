/**
 * Wraps all case-insensitive occurrences of `query` in `<mark>` tags.
 * Returns the original string unchanged if query is empty.
 * Escapes special regex characters in query to prevent ReDoS / injection.
 */
export function highlightText(text: string, query: string): string {
  if (!query || !text) return text;

  // Escape special regex characters
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Split and rejoin with <mark> tags — avoids re-entrant matching
  return text.replace(
    new RegExp(escaped, 'gi'),
    (match) => `<mark class="search-highlight">${match}</mark>`,
  );
}
