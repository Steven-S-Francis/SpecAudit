import { useCallback, useEffect, useState } from 'react';
import { useAudit } from './hooks/useAudit';
import { useTheme } from './hooks/useTheme';
import { InputPanel } from './components/features/InputPanel';
import { ResultPanel } from './components/features/ResultPanel';
import { Spinner } from './components/ui/Spinner';
import { Button } from './components/ui/Button';
import { Card } from './components/ui/Card';
import { ThemeToggle } from './components/ui/ThemeToggle';

function App() {
  const { state, audit, abort } = useAudit();
  const { theme, toggle } = useTheme();
  const [providerName, setProviderName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(state.result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — silently ignore
    }
  }, [state.result]);

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
              <Button
                variant="ghost"
                size="sm"
                disabled={state.status === 'streaming'}
                onClick={handleCopy}
              >
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            )}
          </h2>

          {state.status === 'error' && (
            <Card className="border-red-800 bg-red-950/20 light:border-red-200 light:bg-red-50">
              <p className="text-red-400 text-sm light:text-red-600">{state.error}</p>
            </Card>
          )}

          <ResultPanel
            content={state.result}
            isStreaming={state.status === 'streaming'}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
