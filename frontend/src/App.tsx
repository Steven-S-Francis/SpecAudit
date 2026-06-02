import { useCallback, useEffect, useState } from 'react';
import { useAudit } from './hooks/useAudit';
import { useTheme } from './hooks/useTheme';
import { InputPanel } from './components/features/InputPanel';
import { ResultPanel } from './components/features/ResultPanel';
import { Spinner } from './components/ui/Spinner';
import { Button } from './components/ui/Button';
import { Card } from './components/ui/Card';
import { ThemeToggle } from './components/ui/ThemeToggle';
import { exportPdf } from './utils/exportPdf';
import type { AuditResult } from './types/audit';

function App() {
  const { state, audit, abort } = useAudit();
  const { theme, toggle } = useTheme();
  const [providerName, setProviderName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Strip trailing ```json...``` block from displayed markdown (it's for JSON export only)
  const displayContent = state.result.replace(/```json[\s\S]*?```\s*$/gm, '');

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(state.result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable â€” silently ignore
    }
  }, [state.result]);

  const handleDownload = useCallback(() => {
    try {
      const blob = new Blob([state.result], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `specaudit-report-${Date.now()}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Download API unavailable â€” silently ignore
    }
  }, [state.result]);

  const handleExportPdf = useCallback(async () => {
    try {
      await exportPdf(state.result);
    } catch {
      // PDF generation failed â€” silently ignore
    }
  }, [state.result]);

  const handleExportJson = useCallback(() => {
    try {
      const auditResult: AuditResult = {
        version: 1,
        findings: state.findings,
        summary: state.summary,
        exportedAt: new Date().toISOString(),
        specFormat: state.specFormat,
      };
      // Only include result field if no structured data (fallback)
      if (state.findings.length === 0 && state.summary === null) {
        auditResult.result = state.result;
      }
      const jsonString = JSON.stringify(auditResult, null, 2) + '\n';
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `specaudit-report-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // JSON export API unavailable â€” silently ignore
    }
  }, [state.result, state.findings, state.summary, state.specFormat]);

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(data => setProviderName(data.providerName))
      .catch(() => setProviderName(null));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 lg:p-10 light:bg-white light:text-slate-800">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 light:text-slate-900">SpecAudit</h1>
          <p className="text-sm text-slate-400 light:text-slate-500">OpenAPI Contract Auditor</p>
        </div>
        <div className="flex items-center gap-3">
          {providerName && (
            <span className="text-xs text-slate-500 bg-slate-900 border border-slate-800 rounded px-2 py-1 light:text-slate-600 light:bg-slate-100 light:border-slate-300">
              {providerName}
            </span>
          )}
          <ThemeToggle theme={theme} onToggle={toggle} />
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-2 lg:gap-8 mt-8">
        <div>
          <InputPanel
            status={state.status}
            onSubmit={(spec, format) => audit({ spec, specFormat: format })}
            onAbort={abort}
          />
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2 light:text-slate-700">
            Audit Results
            {state.status === 'loading' && <Spinner size="sm" />}
              {state.result && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={state.status === 'streaming'}
                    onClick={handleCopy}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={state.status === 'streaming'}
                    onClick={handleDownload}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={state.status === 'streaming'}
                    onClick={handleExportPdf}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                    Export PDF
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={state.status === 'streaming'}
                    onClick={handleExportJson}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                      <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1" />
                      <path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1" />
                    </svg>
                    Export JSON
                  </Button>
                </>
              )}
          </h2>

          {state.status === 'error' && (
            <Card className="border-red-800 bg-red-950/20 light:border-red-200 light:bg-red-50">
              <p className="text-red-400 text-sm light:text-red-600">{state.error}</p>
            </Card>
          )}

          <ResultPanel
            content={displayContent}
            isStreaming={state.status === 'streaming'}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
