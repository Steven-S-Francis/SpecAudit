import { useState, useCallback, type ComponentPropsWithoutRef } from 'react';
import ReactMarkdown from 'react-markdown';
import type { ExtraProps } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { SeverityLevel } from '../../types/audit';
import { parseSeverity } from '../../utils/parseSeverity';
import { filterMarkdownBySeverity } from '../../utils/filterMarkdown';
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

export function ResultPanel({ content, isStreaming }: Props) {
  const showSkeleton = content === '' && !isStreaming;
  const { containerRef, isAtBottom, scrollToBottom, scrollToTop } = useAutoScroll({ deps: [content] });

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

  const filteredContent = filterMarkdownBySeverity(content, hiddenSeverities);

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
        )}
        <div className="font-mono text-sm text-slate-200 light:text-slate-800">
          <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h3({ children }: HeadingProps) {
                  const text = String(children);
                  const severity = parseSeverity(text);
                  const cleanTitle = text
                    .replace('[CRITICAL]', '')
                    .replace('[WARNING]', '')
                    .replace('[INFO]', '')
                    .trim();

                  if (severity) {
                    const styles = SEVERITY_STYLES[severity];
                    return (
                      <div className={styles.wrapper}>
                        <span className={styles.badge}>{severity}</span>
                        <span className={`font-semibold ${styles.label}`}>{cleanTitle}</span>
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
              {filteredContent}
            </ReactMarkdown>
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
