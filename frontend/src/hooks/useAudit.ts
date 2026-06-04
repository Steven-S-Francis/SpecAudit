import { useCallback, useRef, useState } from 'react';
import { auditStream } from '../api/auditClient';
import type { AuditRequest, AuditState, Finding, AuditSummary } from '../types/audit';

export function useAudit() {
  const [state, setState] = useState<AuditState>({
    status: 'idle',
    result: '',
    findings: [],
    summary: null,
    error: null,
    specFormat: null,
  });

  const abortRef = useRef<AbortController | null>(null);
  const retryCount = useRef(0);

  const audit = useCallback(async (payload: AuditRequest, isRetry?: boolean) => {
    if (!isRetry) {
      abortRef.current?.abort();
      retryCount.current = 0;
      abortRef.current = new AbortController();
      setState({ status: 'loading', result: '', findings: [], summary: null, error: null, specFormat: payload.specFormat ?? null });
    }

    try {
      setState(s => ({ ...s, status: 'streaming' }));
      await auditStream(
        payload,
        (chunk) => setState(s => ({ ...s, result: s.result + chunk })),
        abortRef.current!.signal,
        (data) => setState(s => ({
          ...s,
          findings: data.findings,
          summary: data.summary,
        }))
      );
      setState(s => ({ ...s, status: 'complete' }));
      retryCount.current = 0;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setState(s => ({ ...s, status: 'idle' }));
        retryCount.current = 0;
      } else {
        retryCount.current = 0;
        setState(s => ({
          ...s,
          status: 'error',
          error: (err as Error).message,
        }));
      }
    }
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({ status: 'idle', result: '', findings: [], summary: null, error: null, specFormat: null });
  }, []);

  const restore = useCallback((result: string, findings: Finding[], summary: AuditSummary | null, specFormat: string | null) => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState({ status: 'complete', result, findings, summary, error: null, specFormat });
  }, []);

  return { state, audit, abort, reset, restore };
}
