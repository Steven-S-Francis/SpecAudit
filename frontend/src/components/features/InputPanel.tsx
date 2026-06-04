import { useState, useRef } from 'react';
import type { AuditStatus } from '../../types/audit';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';

interface Props {
  status: AuditStatus;
  onSubmit: (spec: string, format?: 'yaml' | 'json') => void;
  onAbort: () => void;
}

export function InputPanel({ status, onSubmit, onAbort }: Props) {
  const [spec, setSpec] = useState('');
  const [format, setFormat] = useState<'yaml' | 'json' | undefined>();
  const [dragOver, setDragOver] = useState(false);
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null);
  const [fileLoadStatus, setFileLoadStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const count = spec.length;
  const isOverLimit = count > 100000;
  const isEmpty = spec.trim().length === 0;

  const countColor = count > 100000
    ? 'text-red-400'
    : count > 80000
      ? 'text-amber-400'
      : 'text-slate-400 light:text-slate-500';

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const isMod = e.ctrlKey || e.metaKey;
    if (isMod && e.key === 'Enter') {
      if (!isEmpty && !isOverLimit && status !== 'loading' && status !== 'streaming') {
        e.preventDefault();
        onSubmit(spec, format);
      }
    }
  }

  const ALLOWED_EXTENSIONS = ['.yaml', '.yml', '.json'];
  const MAX_FILE_SIZE = 500_000; // 500 KB

  function isValidFile(file: File): boolean {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    return ALLOWED_EXTENSIONS.includes(ext);
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function handleFile(file: File) {
    // Reset state
    setFileError(null);
    setFileLoadStatus('loading');

    // Validate extension
    if (!isValidFile(file)) {
      setFileError(`Unsupported file type. Accepted: .yaml, .yml, .json`);
      setFileLoadStatus('error');
      return;
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      setFileError(`File too large (${formatFileSize(file.size)}). Max: ${formatFileSize(MAX_FILE_SIZE)}.`);
      setFileLoadStatus('error');
      return;
    }

    // Show file info
    setFileInfo({ name: file.name, size: file.size });

    // Read content
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') {
        setSpec(text);
        setFileLoadStatus('idle');
      }
    };
    reader.onerror = () => {
      setFileError('Failed to read file. Please try again.');
      setFileLoadStatus('error');
      setFileInfo(null);
    };
    reader.readAsText(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
    // Reset so re-selecting the same file triggers onChange again
    e.target.value = '';
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Drag-and-drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
          transition-colors duration-150
          ${dragOver
            ? 'border-indigo-400 bg-indigo-950/30'
            : 'border-slate-600 hover:border-slate-400 bg-slate-900/50'
          }
          light:${dragOver
            ? 'border-indigo-400 bg-indigo-50'
            : 'border-slate-300 hover:border-slate-400 bg-slate-50'
          }
        `}
        onClick={() => fileInputRef.current?.click()}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".yaml,.yml,.json"
          className="hidden"
          onChange={handleFileInputChange}
        />

        {fileLoadStatus === 'loading' ? (
          <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
            <Spinner size="sm" />
            Reading file...
          </div>
        ) : fileInfo ? (
          <div className="text-sm text-slate-300">
            <span className="font-medium text-indigo-300">{fileInfo.name}</span>
            <span className="text-slate-500 ml-2">({formatFileSize(fileInfo.size)})</span>
            <span className="block text-xs text-slate-500 mt-1">Click or drag to replace</span>
          </div>
        ) : (
          <>
            <div className="text-slate-400 text-sm">
              <span className="text-indigo-400 font-medium">Browse files</span>
              <span className="text-slate-500"> or drag & drop here</span>
            </div>
            <div className="text-xs text-slate-600 mt-1">Supports .yaml, .yml, .json (max 500 KB)</div>
          </>
        )}
      </div>

      {/* Error message */}
      {fileError && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/30 border border-red-800/50 rounded-lg px-3 py-2 light:text-red-600 light:bg-red-50 light:border-red-200">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {fileError}
        </div>
      )}

      <textarea
        value={spec}
        onChange={(e) => setSpec(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Paste your OpenAPI spec here (YAML or JSON)..."
        className="bg-slate-950 border border-slate-700 rounded-lg p-4 text-slate-200 text-sm font-mono w-full resize-y min-h-[300px] focus:outline-none focus:border-indigo-500 light:bg-white light:border-slate-300 light:text-slate-800"
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
          <Button
            variant="ghost"
            className={format === 'yaml' ? 'border-indigo-500 text-indigo-300' : ''}
            onClick={() => setFormat(format === 'yaml' ? undefined : 'yaml')}
          >
            YAML
          </Button>
          <Button
            variant="ghost"
            className={format === 'json' ? 'border-indigo-500 text-indigo-300' : ''}
            onClick={() => setFormat(format === 'json' ? undefined : 'json')}
          >
            JSON
          </Button>
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          variant="primary"
          disabled={isEmpty || isOverLimit || status === 'loading' || status === 'streaming'}
          onClick={() => onSubmit(spec, format)}
          title="Ctrl+Enter to run audit"
        >
          Run Audit
          <kbd className="ml-1.5 text-xs opacity-60 hidden sm:inline">Ctrl+Enter</kbd>
        </Button>
        {status === 'streaming' && (
          <Button variant="danger" onClick={onAbort} title="Escape to stop">
            Stop
            <kbd className="ml-1.5 text-xs opacity-60 hidden sm:inline">Esc</kbd>
          </Button>
        )}
      </div>
    </div>
  );
}
