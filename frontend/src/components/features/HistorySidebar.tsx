import { useState, useEffect, useCallback } from 'react';
import type { HistoryRecord } from '../../hooks/useHistory';
import { Button } from '../ui/Button';

interface Props {
  records: HistoryRecord[];
  onLoad: (record: HistoryRecord) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  const date = new Date(ts);
  const now = new Date();
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatSpecPreview(spec: string, specName: string | null, max = 50): string {
  if (specName) {
    return specName.length > 60 ? specName.slice(0, 60) + '...' : specName;
  }
  return spec.length > max ? spec.slice(0, max) + '...' : spec;
}

export function HistorySidebar({ records, onLoad, onDelete, onClearAll }: Props) {
  const [open, setOpen] = useState(true);

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [open, handleEscape]);

  return (
    <>
      {/* Toggle button — always visible in top-left corner */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`
          fixed top-4 left-4 z-50 p-2 rounded-lg
          bg-slate-900 border border-slate-700 text-slate-400
          hover:text-slate-200 hover:border-slate-500
          transition-colors
          light:bg-white light:border-slate-300 light:text-slate-500
        `}
        aria-label={open ? 'Close history sidebar' : 'Open history sidebar'}
        title={open ? 'Close history sidebar' : 'Open history sidebar'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {open ? (
            // X icon when open
            <>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </>
          ) : (
            // Hamburger icon when closed
            <>
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </>
          )}
        </svg>
      </button>

      {/* Backdrop — only on mobile (< md) when open */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          w-72 h-full flex-shrink-0
          bg-slate-900 border-r border-slate-800
          light:bg-slate-50 light:border-slate-200

          /* Mobile (< 768px / md): fixed overlay drawer that slides */
          fixed inset-y-0 left-0 z-40
          transition-transform duration-200 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full'}

          /* Desktop (>= 768px / md): static in flex layout */
          md:static md:z-auto md:transition-none
          ${open ? 'md:block' : 'md:hidden'}
        `}
      >
        <div className="flex flex-col h-full pt-16 md:pt-4">
          {/* Header */}
          <div className="flex items-center justify-between px-4 pb-3 border-b border-slate-800 light:border-slate-200">
            <h2 className="text-sm font-semibold text-slate-200 light:text-slate-700">History</h2>
            {records.length > 0 && (
              <Button variant="ghost" size="sm" onClick={onClearAll} className="text-red-400 hover:text-red-300 light:text-red-500 light:hover:text-red-600">
                Clear all
              </Button>
            )}
          </div>

          {/* Record list */}
          <div className="flex-1 overflow-y-auto">
            {records.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-sm text-slate-500 light:text-slate-400">
                No past audits
              </div>
            ) : (
              <ul className="divide-y divide-slate-800 light:divide-slate-200">
                {records.map((record) => (
                  <li
                    key={record.id}
                    onClick={() => onLoad(record)}
                    className="group flex items-start gap-2 px-4 py-3 cursor-pointer hover:bg-slate-800 light:hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate light:text-slate-700">
                        {formatSpecPreview(record.spec, record.specName)}
                        {record.result === null && (
                          <span className="text-yellow-400 text-xs ml-2">(pending)</span>
                        )}
                      </p>
                      {record.result === null ? (
                        <p className="text-xs text-yellow-400 mt-0.5">
                          Running...
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500 mt-0.5 light:text-slate-400" title={new Date(record.timestamp).toLocaleString()}>
                          {relativeTime(record.timestamp)}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(record.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700 light:hover:bg-slate-200"
                      aria-label={`Delete record ${record.id}`}
                      title="Delete"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
