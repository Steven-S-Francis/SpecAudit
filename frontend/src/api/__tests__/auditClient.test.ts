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
});
