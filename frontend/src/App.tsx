import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudit } from './hooks/useAudit';
import { useTheme } from './hooks/useTheme';
import { useHistory } from './hooks/useHistory';
import type { HistoryRecord } from './hooks/useHistory';
import { InputPanel } from './components/features/InputPanel';
import { ResultPanel } from './components/features/ResultPanel';
import { HistorySidebar } from './components/features/HistorySidebar';
import { Spinner } from './components/ui/Spinner';
import { Button } from './components/ui/Button';
import { Card } from './components/ui/Card';
import { ThemeToggle } from './components/ui/ThemeToggle';
import { ToastContainer } from './components/ui/ToastContainer';
import { ToastProvider, useToastContext } from './hooks/useToast';
import { ProviderSelector } from './components/ui/ProviderSelector';
import type { ProviderInfo } from './components/ui/ProviderSelector';
import { exportPdf } from './utils/exportPdf';
import type { AuditResult } from './types/audit';

function AppContent() {
  const { state, audit, abort, restore } = useAudit();
  const { theme, toggle } = useTheme();
  const history = useHistory();
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>(() =>
    localStorage.getItem('specaudit-provider') ?? 'groq'
  );
  const [selectedModel, setSelectedModel] = useState<string>(() =>
    localStorage.getItem('specaudit-model') ?? ''
  );
  const [currentAuditId, setCurrentAuditId] = useState<string | null>(null);
  const [spec, setSpec] = useState('');
  const [specFormat, setSpecFormat] = useState<'yaml' | 'json' | undefined>();
  const [copied, setCopied] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const loadKeyRef = useRef(0);
  const { addToast } = useToastContext();
  // Strip trailing ```json...``` block from displayed markdown (it's for JSON export only)
  const JSON_MARKER = '```json';
  const markerIndex = state.result.lastIndexOf(JSON_MARKER);
  const strippedResult = markerIndex === -1
    ? state.result
    : state.result.slice(0, markerIndex);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(strippedResult);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      addToast('Copied to clipboard', 'success');
    } catch {
      // Clipboard API unavailable — silently ignore
    }
  }, [strippedResult, addToast]);

  const handleDownload = useCallback(() => {
    try {
      const blob = new Blob([strippedResult], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `specaudit-report-${Date.now()}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast('Report downloaded', 'success');
    } catch {
      // Download API unavailable — silently ignore
    }
  }, [strippedResult, addToast]);

  const handleExportPdf = useCallback(async () => {
    try {
      await exportPdf(strippedResult);
      addToast('PDF exported', 'success');
    } catch {
      addToast('PDF export failed', 'error');
    }
  }, [strippedResult, addToast]);

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
        auditResult.result = strippedResult;
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
      addToast('JSON exported', 'success');
    } catch {
      addToast('JSON export failed', 'error');
    }
  }, [strippedResult, state.findings, state.summary, state.specFormat, addToast]);

  useEffect(() => {
    fetch('/api/providers')
      .then(r => r.json())
      .then(data => {
        setProviders(data);
        // If selectedProvider from localStorage is not in the list, reset
        if (data.length > 0 && !data.some((p: ProviderInfo) => p.id === selectedProvider)) {
          setSelectedProvider(data[0].id);
          setSelectedModel(data[0].defaultModel);
        }
        // If selectedModel is empty, set to default of selected provider
        const prov = data.find((p: ProviderInfo) => p.id === selectedProvider);
        if (prov && !selectedModel) {
          setSelectedModel(prov.defaultModel);
        }
      })
      .catch(() => setProviders([]));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist selected provider and model to localStorage
  useEffect(() => {
    localStorage.setItem('specaudit-provider', selectedProvider);
  }, [selectedProvider]);

  useEffect(() => {
    localStorage.setItem('specaudit-model', selectedModel);
  }, [selectedModel]);

  const handleLoadRecord = useCallback(
    (record: HistoryRecord) => {
      setSpec(record.spec);
      setSpecFormat(record.specFormat ?? undefined);
      if (record.result !== null) {
        restore(record.result, [], null, record.specFormat);
      }
      setCurrentAuditId(record.id);
      loadKeyRef.current += 1;
    },
    [restore]
  );

  const handleSubmit = useCallback(
    (submitSpec: string, format?: 'yaml' | 'json') => {
      const record = history.addRecord({
        spec: submitSpec,
        specFormat: format ?? null,
        result: null,
        specName: null,
      });
      setCurrentAuditId(record.id);
      audit({ spec: submitSpec, specFormat: format, provider: selectedProvider, model: selectedModel });
    },
    [history, audit, selectedProvider, selectedModel]
  );

  // Save to history when audit completes or errors
  useEffect(() => {
    if ((state.status === 'complete' || state.status === 'error') && currentAuditId) {
      history.addRecord({
        id: currentAuditId,
        spec,
        specFormat: specFormat ?? null,
        result: state.result,
        error: state.status === 'error' ? (state.error ?? undefined) : undefined,
        specName: null,
      });
    }
  }, [state.status, currentAuditId, spec, specFormat, state.result, state.error, history]);

  useEffect(() => {
    if (state.status === 'error' && state.error) {
      addToast(state.error, 'error', 0);
    }
  }, [state.status, state.error, addToast]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state.status === 'streaming') {
        e.preventDefault();
        abort();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.status, abort]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 light:bg-white light:text-slate-800 flex">
      <HistorySidebar
        records={history.records}
        onLoad={handleLoadRecord}
        onDelete={history.deleteRecord}
        onClearAll={history.clearAll}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 min-w-0 p-6 lg:p-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Hamburger button — opens sidebar on all screen sizes */}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors light:bg-white light:border-slate-300 light:text-slate-500"
            aria-label="Open history sidebar"
            title="Open history sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-100 light:text-slate-900">SpecAudit</h1>
            <p className="text-sm text-slate-400 light:text-slate-500">OpenAPI Contract Auditor</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {providers.length > 0 && (
            <ProviderSelector
              providers={providers}
              selectedProvider={selectedProvider}
              selectedModel={selectedModel}
              onProviderChange={setSelectedProvider}
              onModelChange={setSelectedModel}
            />
          )}
          {providers.length > 0 && (
            <span className="text-xs text-slate-500 bg-slate-900 border border-slate-800 rounded px-2 py-1 light:text-slate-600 light:bg-slate-100 light:border-slate-300">
              {providers.find(p => p.id === selectedProvider)?.name ?? selectedProvider}
            </span>
          )}
          <ThemeToggle theme={theme} onToggle={toggle} />
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-2 lg:gap-8 mt-8">
        <div>
          <InputPanel
            key={loadKeyRef.current}
            status={state.status}
            spec={spec}
            onSpecChange={setSpec}
            specFormat={specFormat}
            onSpecFormatChange={setSpecFormat}
            onSubmit={handleSubmit}
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
            content={strippedResult}
            isStreaming={state.status === 'streaming'}
          />
        </div>
      </div>
      </div>
      <ToastContainer />
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

export default App;
