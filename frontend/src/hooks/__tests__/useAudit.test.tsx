// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAudit } from '../useAudit';

// Mock the auditClient module
vi.mock('../../api/auditClient', () => ({
  auditStream: vi.fn(),
}));

import { auditStream } from '../../api/auditClient';

describe('useAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns initial state with idle status', () => {
    const { result } = renderHook(() => useAudit());
    expect(result.current.state).toEqual({
      status: 'idle',
      result: '',
      findings: [],
      summary: null,
      error: null,
      specFormat: null,
    });
  });

  it('sets loading then streaming when audit is called', async () => {
    // Make auditStream hang so we can observe intermediate states
    let resolvePromise: () => void = () => {};
    (auditStream as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise<void>((resolve) => { resolvePromise = resolve; })
    );

    const { result } = renderHook(() => useAudit());

    // Start the audit
    act(() => {
      result.current.audit({ spec: 'test' });
    });

    // The state transitions happen in microtasks within the same synchronous block,
    // so 'loading' is immediately followed by 'streaming' before any await.
    // React batches these, so we'll see 'streaming' as the first visible state.
    await waitFor(() => {
      expect(result.current.state.status).toBe('streaming');
    });

    // Clean up
    resolvePromise();
  });

  it('sets status to complete after auditStream resolves', async () => {
    (auditStream as ReturnType<typeof vi.fn>).mockImplementation(
      (_payload: unknown, onChunk: (chunk: string) => void, _signal: AbortSignal) => {
        onChunk('chunk1');
        return Promise.resolve();
      }
    );

    const { result } = renderHook(() => useAudit());

    await act(async () => {
      await result.current.audit({ spec: 'test' });
    });

    expect(result.current.state.status).toBe('complete');
    expect(result.current.state.result).toBe('chunk1');
  });

  it('sets error status when auditStream throws', async () => {
    (auditStream as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Something went wrong')
    );

    const { result } = renderHook(() => useAudit());

    await act(async () => {
      await result.current.audit({ spec: 'test' });
    });

    expect(result.current.state.status).toBe('error');
    expect(result.current.state.error).toBe('Something went wrong');
  });

  it('sets idle status on AbortError', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    (auditStream as ReturnType<typeof vi.fn>).mockRejectedValue(abortError);

    const { result } = renderHook(() => useAudit());

    await act(async () => {
      await result.current.audit({ spec: 'test' });
    });

    expect(result.current.state.status).toBe('idle');
    expect(result.current.state.error).toBeNull();
  });

  it('abort cancels the ongoing audit and sets idle', async () => {
    (auditStream as ReturnType<typeof vi.fn>).mockImplementation(
      (_payload: unknown, _onChunk: (chunk: string) => void, signal: AbortSignal) => {
        return new Promise<void>((_, reject) => {
          signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      }
    );

    const { result } = renderHook(() => useAudit());

    act(() => {
      result.current.audit({ spec: 'test' });
    });

    // Wait for streaming state
    await waitFor(() => {
      expect(result.current.state.status).toBe('streaming');
    });

    // Now abort
    act(() => {
      result.current.abort();
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe('idle');
    });
  });

  it('reset clears result and sets idle', () => {
    const { result } = renderHook(() => useAudit());

    act(() => {
      result.current.reset();
    });

    expect(result.current.state).toEqual({
      status: 'idle',
      result: '',
      findings: [],
      summary: null,
      error: null,
      specFormat: null,
    });
  });


  it('onStructured callback updates findings and summary in state', async () => {
    const structuredData = {
      findings: [
        {
          severity: 'CRITICAL' as const,
          title: 'Test Finding',
          category: 'Security',
          location: '/test',
          issue: 'Test issue',
          recommendation: 'Test recommendation',
        },
      ],
      summary: {
        totalFindings: 1,
        critical: 1,
        warnings: 0,
        info: 0,
        verdict: 'FAIL',
        governanceScore: 50,
        endpointsAnalyzed: 1,
        dimensions: {
          security: 10,
          restConformance: 10,
          schemaCompleteness: 10,
          documentationQuality: 20,
        },
      },
    };

    (auditStream as ReturnType<typeof vi.fn>).mockImplementation(
      (
        _payload: unknown,
        _onChunk: (chunk: string) => void,
        _signal: AbortSignal,
        onStructured?: (data: { findings: unknown[]; summary: unknown }) => void
      ) => {
        if (onStructured) {
          onStructured(structuredData);
        }
        return Promise.resolve();
      }
    );

    const { result } = renderHook(() => useAudit());

    await act(async () => {
      await result.current.audit({ spec: 'test' });
    });

    expect(result.current.state.findings).toEqual(structuredData.findings);
    expect(result.current.state.summary).toEqual(structuredData.summary);
  });
});
