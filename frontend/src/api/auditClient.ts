import type { AuditRequest } from '../types/audit';
import { parseSSEChunks } from '../utils/parseSSEChunks';

export async function auditStream(
  payload: AuditRequest,
  onChunk: (chunk: string) => void,
  signal: AbortSignal
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
        throw new Error(chunk.replace('[SPECAUDIT_ERROR]', '').trim());
      }
      onChunk(chunk);
    }
  }
}
