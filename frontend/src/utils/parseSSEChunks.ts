export interface SSEParseResult {
  chunks: string[];
  remainingBuffer: string;
}

export function parseSSEChunks(buffer: string, incoming: string): SSEParseResult {
  const combined = buffer + incoming;
  const lines = combined.split('\n');
  const remainingBuffer = lines.pop() ?? '';

  const chunks: string[] = [];
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      chunks.push(line.slice(6));
    }
  }

  return { chunks, remainingBuffer };
}
