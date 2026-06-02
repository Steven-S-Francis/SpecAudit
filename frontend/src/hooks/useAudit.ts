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
  const retryCount = useRef(0);
  const maxRetries = 3;

  const audit = useCallback(async (payload: AuditRequest, isRetry?: boolean) => {
    if (!isRetry) {
      abortRef.current?.abort();
      retryCount.current = 0;
      abortRef.current = new AbortController();
      setState({ status: 'loading', result: '', error: null });
    }

    try {
      setState(s => ({ ...s, status: 'streaming' }));
      await auditStream(
        payload,
        (chunk) => setState(s => ({ ...s, result: s.result + chunk })),
        abortRef.current!.signal
      );
      setState(s => ({ ...s, status: 'complete' }));
      retryCount.current = 0;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setState(s => ({ ...s, status: 'idle' }));
        retryCount.current = 0;
      } else if (
        (err as Error).name === 'RateLimitError' &&
        retryCount.current < maxRetries
      ) {
        retryCount.current++;
        setState({ status: 'loading', result: '', error: null });
        const delay = 1000 * Math.pow(2, retryCount.current - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        audit(payload, true);
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
    setState({ status: 'idle', result: '', error: null });
  }, []);

  return { state, audit, abort, reset };
}
