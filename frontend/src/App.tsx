import { useEffect, useState } from 'react';
import { useAudit } from './hooks/useAudit';
import { InputPanel } from './components/features/InputPanel';
import { ResultPanel } from './components/features/ResultPanel';
import { Spinner } from './components/ui/Spinner';
import { Card } from './components/ui/Card';

function App() {
  const { state, audit, abort } = useAudit();
  const [providerName, setProviderName] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(data => setProviderName(data.providerName))
      .catch(() => setProviderName(null));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 lg:p-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">SpecAudit</h1>
          <p className="text-sm text-slate-400">OpenAPI Contract Auditor</p>
        </div>
        {providerName && (
          <span className="text-xs text-slate-500 bg-slate-900 border border-slate-800 rounded px-2 py-1">
            {providerName}
          </span>
        )}
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
          <h2 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
            Audit Results
            {state.status === 'loading' && <Spinner size="sm" />}
          </h2>

          {state.status === 'error' && (
            <Card className="border-red-800 bg-red-950/20">
              <p className="text-red-400 text-sm">{state.error}</p>
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
