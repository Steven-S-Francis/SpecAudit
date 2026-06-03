// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auditStream } from '../auditClient';

function createMockResponse(
  ok: boolean,
  status: number,
  body: string,
  statusText?: string
): Response {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body));
      controller.close();
    },
  });
  return {
    ok,
    status,
    statusText: statusText ?? '',
    headers: new Headers(),
    body: stream,
    text: () => Promise.resolve(body),
    json: () => Promise.resolve(body),
  } as Response;
}

describe('auditStream', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('throws an error for a 400 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createMockResponse(false, 400, 'Bad Request')
    );
    const onChunk = vi.fn();
    const signal = new AbortController().signal;

    await expect(
      auditStream({ spec: 'test' }, onChunk, signal)
    ).rejects.toThrow('Audit failed (400): Bad Request');
    expect(onChunk).not.toHaveBeenCalled();
  });

  it('throws an error for a 413 response (payload too large)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createMockResponse(false, 413, 'Payload Too Large')
    );
    const onChunk = vi.fn();
    const signal = new AbortController().signal;

    await expect(
      auditStream({ spec: 'x'.repeat(100_001) }, onChunk, signal)
    ).rejects.toThrow('Audit failed (413): Payload Too Large');
    expect(onChunk).not.toHaveBeenCalled();
  });

  it('throws an error for a 500 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createMockResponse(false, 500, 'Internal Server Error')
    );
    const onChunk = vi.fn();
    const signal = new AbortController().signal;

    await expect(
      auditStream({ spec: 'test' }, onChunk, signal)
    ).rejects.toThrow('Audit failed (500): Internal Server Error');
    expect(onChunk).not.toHaveBeenCalled();
  });

  it('calls onChunk for each SSE data frame in a successful response', async () => {
    const sseBody = 'data: "chunk1"\n\ndata: "chunk2"\n\ndata: "chunk3"\n\n';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createMockResponse(true, 200, sseBody)
    );
    const onChunk = vi.fn();
    const signal = new AbortController().signal;

    await auditStream({ spec: 'test' }, onChunk, signal);
    expect(onChunk).toHaveBeenCalledTimes(3);
    expect(onChunk).toHaveBeenNthCalledWith(1, 'chunk1');
    expect(onChunk).toHaveBeenNthCalledWith(2, 'chunk2');
    expect(onChunk).toHaveBeenNthCalledWith(3, 'chunk3');
  });

  it('throws an error when SSE data contains an error sentinel', async () => {
    const sseBody = 'data: "chunk1"\n\ndata: "[SPECAUDIT_ERROR] Invalid API key"\n\n';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createMockResponse(true, 200, sseBody)
    );
    const onChunk = vi.fn();
    const signal = new AbortController().signal;

    await expect(
      auditStream({ spec: 'test' }, onChunk, signal)
    ).rejects.toThrow('Invalid API key');
    // The first chunk should have been delivered before the error
    expect(onChunk).toHaveBeenNthCalledWith(1, 'chunk1');
  });

  it('throws with name RateLimitError for rate limit sentinel', async () => {
    const sseBody = 'data: "[SPECAUDIT_ERROR] Rate limit reached. Please wait..."\n\n';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createMockResponse(true, 200, sseBody)
    );
    const onChunk = vi.fn();
    const signal = new AbortController().signal;

    let thrown: Error | null = null;
    try {
      await auditStream({ spec: 'test' }, onChunk, signal);
    } catch (err) {
      thrown = err as Error;
    }
    expect(thrown).not.toBeNull();
    expect(thrown!.name).toBe('RateLimitError');
  });

  it('throws with name Error for non-rate-limit sentinel', async () => {
    const sseBody = 'data: "[SPECAUDIT_ERROR] Invalid API key"\n\n';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createMockResponse(true, 200, sseBody)
    );
    const onChunk = vi.fn();
    const signal = new AbortController().signal;

    let thrown: Error | null = null;
    try {
      await auditStream({ spec: 'test' }, onChunk, signal);
    } catch (err) {
      thrown = err as Error;
    }
    expect(thrown).not.toBeNull();
    expect(thrown!.name).toBe('Error');
  });

  it('throws an error when the response body is null', async () => {
    const response = {
      ok: true,
      status: 200,
      headers: new Headers(),
      body: null,
      text: () => Promise.resolve(''),
    } as Response;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

    const onChunk = vi.fn();
    const signal = new AbortController().signal;

    await expect(
      auditStream({ spec: 'test' }, onChunk, signal)
    ).rejects.toThrow('Response body is not readable');
  });

  describe('structured event handling', () => {
    it('calls onStructured when chunk contains [SPECAUDIT_STRUCTURED] prefix', async () => {
      const structuredPayload = {
        findings: [{ severity: 'CRITICAL', title: 'Test', category: 'Security', location: '/test', issue: 'Issue', recommendation: 'Fix' }],
        summary: { totalFindings: 1, critical: 1, warnings: 0, info: 0, verdict: 'FAIL', governanceScore: 50, endpointsAnalyzed: 1, dimensions: { security: 10, restConformance: 10, schemaCompleteness: 10, documentationQuality: 20 } },
      };
      const structuredJson = JSON.stringify(structuredPayload);
      // The data line must be JSON-encoded so that JSON.parse(rawChunk) produces the correct string
      const dataValue = JSON.stringify(`[SPECAUDIT_STRUCTURED]${structuredJson}`);
      const sseBody = `data: "chunk1"\n\ndata: ${dataValue}\n\n`;
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        createMockResponse(true, 200, sseBody)
      );
      const onChunk = vi.fn();
      const onStructured = vi.fn();
      const signal = new AbortController().signal;

      await auditStream({ spec: 'test' }, onChunk, signal, onStructured);

      expect(onStructured).toHaveBeenCalledTimes(1);
      expect(onStructured).toHaveBeenCalledWith(structuredPayload);
      // The structured chunk should NOT be passed to onChunk
      expect(onChunk).toHaveBeenCalledTimes(1);
      expect(onChunk).toHaveBeenCalledWith('chunk1');
    });

    it('does not pass structured chunk to onChunk', async () => {
      const structuredPayload = {
        findings: [{ severity: 'CRITICAL', title: 'Test', category: 'Security', location: '/test', issue: 'Issue', recommendation: 'Fix' }],
        summary: { totalFindings: 1, critical: 1, warnings: 0, info: 0, verdict: 'FAIL', governanceScore: 50, endpointsAnalyzed: 1, dimensions: { security: 10, restConformance: 10, schemaCompleteness: 10, documentationQuality: 20 } },
      };
      const dataValue = JSON.stringify(`[SPECAUDIT_STRUCTURED]${JSON.stringify(structuredPayload)}`);
      const sseBody = `data: "normal"\n\ndata: ${dataValue}\n\n`;
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        createMockResponse(true, 200, sseBody)
      );
      const onChunk = vi.fn();
      const onStructured = vi.fn();
      const signal = new AbortController().signal;

      await auditStream({ spec: 'test' }, onChunk, signal, onStructured);

      expect(onChunk).toHaveBeenCalledTimes(1);
      expect(onChunk).toHaveBeenCalledWith('normal');
      expect(onStructured).toHaveBeenCalled();
    });

    it('ignores invalid JSON in structured sentinel', async () => {
      const sseBody = 'data: "normal"\n\ndata: "[SPECAUDIT_STRUCTURED]{invalid}"\n\n';
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        createMockResponse(true, 200, sseBody)
      );
      const onChunk = vi.fn();
      const onStructured = vi.fn();
      const signal = new AbortController().signal;

      await expect(
        auditStream({ spec: 'test' }, onChunk, signal, onStructured)
      ).resolves.toBeUndefined();

      // onChunk should still receive the normal chunk
      expect(onChunk).toHaveBeenCalledTimes(1);
      expect(onChunk).toHaveBeenCalledWith('normal');
      // onStructured should NOT be called for invalid JSON
      expect(onStructured).not.toHaveBeenCalled();
    });

    it('does not call onStructured when callback not provided', async () => {
      const dataValue = JSON.stringify('[SPECAUDIT_STRUCTURED]{"findings":[]}');
      const sseBody = `data: "normal"\n\ndata: ${dataValue}\n\n`;
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        createMockResponse(true, 200, sseBody)
      );
      const onChunk = vi.fn();
      const signal = new AbortController().signal;

      await auditStream({ spec: 'test' }, onChunk, signal);

      // Should not throw even without onStructured
      expect(onChunk).toHaveBeenCalledTimes(1);
      expect(onChunk).toHaveBeenCalledWith('normal');
    });
  });
});
