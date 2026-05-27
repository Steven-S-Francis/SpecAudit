import { describe, it, expect } from 'vitest';
import { parseSSEChunks } from '../parseSSEChunks';

describe('parseSSEChunks', () => {
  it('extracts a single complete data line', () => {
    const { chunks, remainingBuffer } = parseSSEChunks('', 'data: hello world\n\n');
    expect(chunks).toEqual(['hello world']);
    expect(remainingBuffer).toBe('');
  });

  it('holds an incomplete line in the buffer', () => {
    const { chunks, remainingBuffer } = parseSSEChunks('', 'data: incom');
    expect(chunks).toEqual([]);
    expect(remainingBuffer).toBe('data: incom');
  });

  it('reassembles a line split across two network calls', () => {
    const first = parseSSEChunks('', 'data: hel');
    expect(first.chunks).toEqual([]);
    const second = parseSSEChunks(first.remainingBuffer, 'lo\n\n');
    expect(second.chunks).toEqual(['hello']);
  });

  it('extracts multiple data lines from a single chunk', () => {
    const { chunks } = parseSSEChunks('', 'data: first\ndata: second\ndata: third\n');
    expect(chunks).toEqual(['first', 'second', 'third']);
  });

  it('ignores non-data lines', () => {
    const { chunks } = parseSSEChunks('', 'event: ping\ndata: payload\n: comment\n');
    expect(chunks).toEqual(['payload']);
  });

  it('returns empty chunks and preserves buffer when incoming is empty', () => {
    const { chunks, remainingBuffer } = parseSSEChunks('partial', '');
    expect(chunks).toEqual([]);
    expect(remainingBuffer).toBe('partial');
  });
});
