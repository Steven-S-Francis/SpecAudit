import { useState, useCallback, useDeferredValue, isValidElement, Children, type ReactNode, type ComponentPropsWithoutRef } from 'react';
import ReactMarkdown from 'react-markdown';
import type { ExtraProps } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema, type Options as SanitizeOptions } from 'rehype-sanitize';
import type { SeverityLevel } from '../../types/audit';
import { parseSeverity } from '../../utils/parseSeverity';
import { filterMarkdownBySeverity, splitIntoBlocks } from '../../utils/filterMarkdown';
import { highlightText } from '../../utils/highlightText';
import { useAutoScroll } from '../../hooks/useAutoScroll';
import { ScrollButton } from '../ui/ScrollButton';

interface Props {
  content: string;
  isStreaming: boolean;
}

type HeadingProps = ComponentPropsWithoutRef<'h3'> & ExtraProps;
type CodeProps = ComponentPropsWithoutRef<'code'> & ExtraProps;
type HrProps = ComponentPropsWithoutRef<'hr'> & ExtraProps;
type StrongProps = ComponentPropsWithoutRef<'strong'> & ExtraProps;
type ParaProps = ComponentPropsWithoutRef<'p'> & ExtraProps;

const SEVERITY_STYLES: Record<SeverityLevel, {
  wrapper: string;
  badge: string;
  label: string;
}> = {
  CRITICAL: {
    wrapper: 'border-l-4 border-red-500 bg-red-950/40 rounded-r-lg px-4 py-3 mb-3 light:bg-red-50',
    badge:   'inline-block text-xs font-bold text-red-300 light:text-red-600 bg-red-500/20 px-2 py-0.5 rounded mr-2',
    label:   'text-red-300 light:text-red-600',
  },
  WARNING: {
    wrapper: 'border-l-4 border-amber-500 bg-amber-950/40 rounded-r-lg px-4 py-3 mb-3 light:bg-amber-50',
    badge:   'inline-block text-xs font-bold text-amber-300 light:text-amber-600 bg-amber-500/20 px-2 py-0.5 rounded mr-2',
    label:   'text-amber-300 light:text-amber-600',
  },
  INFO: {
    wrapper: 'border-l-4 border-blue-400 bg-blue-950/40 rounded-r-lg px-4 py-3 mb-3 light:bg-blue-50',
    badge:   'inline-block text-xs font-bold text-blue-300 light:text-blue-600 bg-blue-400/20 px-2 py-0.5 rounded mr-2',
    label:   'text-blue-300 light:text-blue-600',
  },
};

const SANITIZE_SCHEMA: SanitizeOptions = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'mark'],
  attributes: {
    ...defaultSchema.attributes,
    mark: ['className'],
  },
};

/**
 * Recursively extracts plain text from React children, handling
 * React elements (like <mark> from search highlighting) correctly.
 */
function extractTextContent(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractTextContent).join('');
  }
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    return extractTextContent(props.children);
  }
  return '';
}

export function ResultPanel({ content, isStreaming }: Props) {
  const showSkeleton = content === '' && !isStreaming;
  const { containerRef, isAtBottom, scrollToBottom, scrollToTop } = useAutoScroll({ deps: [content], isStreaming });

  const [severityFilter, setSeverityFilter] = useState<Record<SeverityLevel, boolean>>({
    CRITICAL: true,
    WARNING: true,
    INFO: true,
  });

  const toggleSeverity = useCallback((severity: SeverityLevel) => {
    setSeverityFilter((prev) => ({ ...prev, [severity]: !prev[severity] }));
  }, []);

  const hiddenSeverities = new Set(
    (Object.keys(severityFilter) as SeverityLevel[]).filter((s) => !severityFilter[s])
  );

  const [searchQuery, setSearchQuery] = useState('');
  const deferredQuery = useDeferredValue(searchQuery);

  const [copiedBlockText, setCopiedBlockText] = useState<string | null>(null);

  const handleCopyBlock = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedBlockText(text);
      setTimeout(() => setCopiedBlockText(null), 2000);
    } catch {
      // Clipboard API unavailable — silently ignore (matches existing pattern)
    }
  }, []);

  const filteredContent = filterMarkdownBySeverity(content, hiddenSeverities);
  const blocks = splitIntoBlocks(filteredContent);

  return (
    <div
      ref={containerRef}
      className="relative w-full mt-6 max-h-[60vh] overflow-y-auto rounded-lg"
      style={{ padding: '5px' }}
    >
      {showSkeleton ? (
        <>
          <div className="bg-slate-800 animate-pulse rounded h-4 mb-3 w-full light:bg-slate-200" />
          <div className="bg-slate-800 animate-pulse rounded h-4 mb-3 w-5/6 light:bg-slate-200" />
          <div className="bg-slate-800 animate-pulse rounded h-4 mb-3 w-4/6 light:bg-slate-200" />
        </>
      ) : (
        <>
        {content && (
          <>
          <div className="flex gap-2 mb-3">
            {(['CRITICAL', 'WARNING', 'INFO'] as const).map((severity) => {
              const active = severityFilter[severity];
              const base = SEVERITY_STYLES[severity];
              return (
                <button
                  key={severity}
                  onClick={() => toggleSeverity(severity)}
                  className={`
                    text-xs font-bold px-2 py-0.5 rounded border transition-opacity
                    ${active
                      ? `${base.badge} border-transparent`
                      : 'text-slate-500 border-slate-600 bg-transparent opacity-50 light:text-slate-400 light:border-slate-300'
                    }
                  `}
                >
                  {severity}
                </button>
              );
            })}
          </div>
          {/* Search input */}
          <div className="relative mb-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search results…"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 pl-8 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 light:bg-white light:border-slate-300 light:text-slate-800"
              aria-label="Search within results"
            />
            {/* Search icon (magnifying glass) */}
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none"
              xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            {/* Clear button — only visible when query is non-empty */}
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 light:hover:text-slate-600"
                aria-label="Clear search"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
          </>
        )}
        <div className="font-mono text-sm text-slate-200 light:text-slate-800">
          {blocks.map((block, index) => {
            const highlightedBlock = highlightText(block.text, deferredQuery);
            const isFinding = block.severity !== null;

            return (
              <div key={index} className={isFinding ? 'relative group' : ''}>
                {isFinding && (
                  <button
                    onClick={() => handleCopyBlock(block.text)}
                    className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 light:bg-slate-200 light:hover:bg-slate-300 light:border-slate-300 text-slate-400 hover:text-slate-200 light:text-slate-500 light:hover:text-slate-700"
                    aria-label={copiedBlockText === block.text ? 'Copied!' : 'Copy finding'}
                    title={copiedBlockText === block.text ? 'Copied!' : 'Copy finding'}
                  >
                    {copiedBlockText === block.text ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    )}
                  </button>
                )}
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[
                    [rehypeRaw],
                    [rehypeSanitize, SANITIZE_SCHEMA],
                  ]}
                  components={{
                    h3({ children }: HeadingProps) {
                      const text = extractTextContent(children);
                      const severity = parseSeverity(text);

                      if (severity) {
                        const styles = SEVERITY_STYLES[severity];
                        const prefix = `[${severity}]`;
                        // Filter out the severity prefix from children to keep
                        // <mark> highlighting elements intact when search is active
                        const contentChildren = Children.map(children, (child) => {
                          if (typeof child === 'string' && child.startsWith(prefix)) {
                            const rest = child.slice(prefix.length).trimStart();
                            return rest || undefined;
                          }
                          return child;
                        });
                        return (
                          <div className={styles.wrapper}>
                            <span className={styles.badge}>{severity}</span>
                            <span className={`font-semibold ${styles.label}`}>{contentChildren}</span>
                          </div>
                        );
                      }
                      return <h3 className="text-slate-100 font-semibold text-base mt-6 mb-2 light:text-slate-900">{children}</h3>;
                    },
                    code({ children, className }: CodeProps) {
                      const isBlock = className?.includes('language-');
                      return isBlock
                        ? <pre className="bg-slate-900 border border-slate-700 rounded-lg p-4 overflow-x-auto my-3 text-xs text-slate-300 light:bg-slate-100 light:border-slate-300 light:text-slate-600"><code>{children}</code></pre>
                        : <code className="bg-slate-800 text-amber-300 px-1.5 py-0.5 rounded text-xs light:bg-slate-200 light:text-amber-700">{children}</code>;
                    },
                    hr(_props: HrProps) {
                      return <hr className="border-slate-700 my-4 light:border-slate-300" />;
                    },
                    strong({ children }: StrongProps) {
                      return <strong className="text-slate-100 font-semibold light:text-slate-900">{children}</strong>;
                    },
                    p({ children }: ParaProps) {
                      return <p className="text-slate-400 text-sm leading-relaxed mb-2 light:text-slate-500">{children}</p>;
                    },
                  }}
                >
                  {highlightedBlock}
                </ReactMarkdown>
              </div>
            );
          })}
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-slate-400 animate-pulse ml-1 align-text-bottom light:bg-slate-500" />
          )}
        </div>
          {content && (
            <div className="sticky bottom-3 z-10 flex justify-end pr-3 pointer-events-none">
              <ScrollButton
                onClick={isAtBottom ? scrollToTop : scrollToBottom}
                direction={isAtBottom ? 'up' : 'down'}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
