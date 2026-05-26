import { useCallback, useRef, useState } from 'react';
import { auditStream } from '../api/auditClient';
import type { AuditRequest, AuditState } from '../types/audit';

export function useAudit() {
  const [state, setState] = useState<AuditState>({
    status: 'idle',
    result: '',
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);

  const audit = useCallback(async (payload: AuditRequest) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setState({ status: 'loading', result: '', error: null });

    try {
      setState(s => ({ ...s, status: 'streaming' }));
      await auditStream(
        payload,
        (chunk) => setState(s => ({ ...s, result: s.result + chunk })),
        abortRef.current.signal
      );
      setState(s => ({ ...s, status: 'complete' }));
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setState(s => ({ ...s, status: 'idle' }));
      } else {
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
    setState({ status: 'idle', result: '', error: null });
  }, []);

  return { state, audit, abort, reset };
}
