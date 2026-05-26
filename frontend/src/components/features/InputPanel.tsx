import { useState } from 'react';
import type { AuditStatus } from '../../types/audit';
import { Button } from '../ui/Button';

interface Props {
  status: AuditStatus;
  onSubmit: (spec: string, format?: 'yaml' | 'json') => void;
  onAbort: () => void;
}

export function InputPanel({ status, onSubmit, onAbort }: Props) {
  const [spec, setSpec] = useState('');
  const [format, setFormat] = useState<'yaml' | 'json' | undefined>();

  const count = spec.length;
  const isOverLimit = count > 100000;
  const isEmpty = spec.trim().length === 0;

  const countColor = count > 100000
    ? 'text-red-400'
    : count > 80000
      ? 'text-amber-400'
      : 'text-slate-400';

  return (
    <div className="flex flex-col gap-4">
      <textarea
        value={spec}
        onChange={(e) => setSpec(e.target.value)}
        placeholder="Paste your OpenAPI spec here (YAML or JSON)..."
        className="bg-slate-950 border border-slate-700 rounded-lg p-4 text-slate-200 text-sm font-mono w-full resize-y min-h-[300px] focus:outline-none focus:border-indigo-500"
      />

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <span className={`text-xs ${countColor}`}>
            {count.toLocaleString()} / 100,000 characters
          </span>
          {isOverLimit && (
            <span className="text-xs text-red-400 ml-2">
              This spec exceeds the 100,000 character limit. Consider splitting into smaller service specs.
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setFormat(format === 'yaml' ? undefined : 'yaml')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${format === 'yaml' ? 'border-indigo-500 text-indigo-300' : 'border-slate-600 hover:border-slate-400 text-slate-300'}`}
          >
            YAML
          </button>
          <button
            onClick={() => setFormat(format === 'json' ? undefined : 'json')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${format === 'json' ? 'border-indigo-500 text-indigo-300' : 'border-slate-600 hover:border-slate-400 text-slate-300'}`}
          >
            JSON
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          variant="primary"
          disabled={isEmpty || isOverLimit || status === 'streaming'}
          onClick={() => onSubmit(spec, format)}
        >
          Run Audit
        </Button>
        {status === 'streaming' && (
          <Button variant="danger" onClick={onAbort}>
            Stop
          </Button>
        )}
      </div>
    </div>
  );
}
