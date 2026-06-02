import type { AuditRequest, Finding, AuditSummary } from '../types/audit';
import { parseSSEChunks } from '../utils/parseSSEChunks';

export async function auditStream(
  payload: AuditRequest,
  onChunk: (chunk: string) => void,
  signal: AbortSignal,
  onStructured?: (data: { findings: Finding[]; summary: AuditSummary }) => void
): Promise<void> {
  const response = await fetch('/api/audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Audit failed (${response.status}): ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Response body is not readable.');

  const decoder = new TextDecoder();
  let buffer = '';

  const STRUCTURED_PREFIX = '[SPECAUDIT_STRUCTURED]';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const { chunks, remainingBuffer } = parseSSEChunks(
      buffer,
      decoder.decode(value, { stream: true })
    );
    buffer = remainingBuffer;

    for (const rawChunk of chunks) {
      if (!rawChunk.trim()) continue;

      const chunk: string = JSON.parse(rawChunk);

      if (chunk.startsWith('[SPECAUDIT_ERROR]')) {
        const message = chunk.replace('[SPECAUDIT_ERROR]', '').trim();
        const isRateLimit = /rate limit/i.test(message);
        const err = new Error(message);
        err.name = isRateLimit ? 'RateLimitError' : 'Error';
        throw err;
      }

      if (chunk.startsWith(STRUCTURED_PREFIX)) {
        if (onStructured) {
          try {
            const jsonStr = chunk.slice(STRUCTURED_PREFIX.length);
            const data = JSON.parse(jsonStr);
            onStructured(data);
          } catch {
            // Ignore invalid JSON in structured sentinel
          }
        }
        continue;
      }

      onChunk(chunk);
    }
  }
}
