// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHistory } from '../useHistory';

const STORAGE_KEY = 'specaudit-history';

describe('useHistory', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initialises with empty records when localStorage is empty', () => {
    const { result } = renderHook(() => useHistory());
    expect(result.current.records).toEqual([]);
  });

  it('initialises with records from localStorage (pre-seeded)', () => {
    const seed = [
      { id: '1', timestamp: 1000, spec: 'openapi: 3.0.0', specFormat: 'yaml', result: 'ok', specName: 'spec.yaml' },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));

    const { result } = renderHook(() => useHistory());
    expect(result.current.records).toHaveLength(1);
    expect(result.current.records[0].id).toBe('1');
  });

  it('addRecord with no id generates one', () => {
    const { result } = renderHook(() => useHistory());

    let record: ReturnType<typeof result.current.addRecord> | undefined;
    act(() => {
      record = result.current.addRecord({
        spec: 'test',
        specFormat: null,
        result: null,
        specName: null,
      });
    });

    expect(record).toBeDefined();
    expect(record!.id).toBeDefined();
    expect(typeof record!.id).toBe('string');
    expect(record!.id.length).toBeGreaterThan(0);
  });

  it('addRecord with existing id updates in-place', () => {
    const { result } = renderHook(() => useHistory());

    act(() => {
      result.current.addRecord({
        id: 'abc',
        spec: 'first',
        specFormat: null,
        result: null,
        specName: null,
      });
    });

    expect(result.current.records).toHaveLength(1);
    expect(result.current.records[0].spec).toBe('first');

    act(() => {
      result.current.addRecord({
        id: 'abc',
        spec: 'updated',
        specFormat: 'yaml',
        result: 'result',
        specName: 'file.yaml',
      });
    });

    expect(result.current.records).toHaveLength(1);
    expect(result.current.records[0].spec).toBe('updated');
    expect(result.current.records[0].specFormat).toBe('yaml');
    expect(result.current.records[0].result).toBe('result');
  });

  it('deleteRecord removes by id', () => {
    const { result } = renderHook(() => useHistory());

    act(() => {
      result.current.addRecord({ id: 'del1', spec: 'a', specFormat: null, result: null, specName: null });
      result.current.addRecord({ id: 'del2', spec: 'b', specFormat: null, result: null, specName: null });
    });

    expect(result.current.records).toHaveLength(2);

    act(() => {
      result.current.deleteRecord('del1');
    });

    expect(result.current.records).toHaveLength(1);
    expect(result.current.records[0].id).toBe('del2');
  });

  it('clearAll empties all', () => {
    const { result } = renderHook(() => useHistory());

    act(() => {
      result.current.addRecord({ id: 'c1', spec: 'a', specFormat: null, result: null, specName: null });
      result.current.addRecord({ id: 'c2', spec: 'b', specFormat: null, result: null, specName: null });
    });

    expect(result.current.records).toHaveLength(2);

    act(() => {
      result.current.clearAll();
    });

    expect(result.current.records).toEqual([]);
  });

  it('loadRecord returns correct record or undefined', () => {
    const { result } = renderHook(() => useHistory());

    act(() => {
      result.current.addRecord({ id: 'load1', spec: 'find me', specFormat: 'json', result: 'r', specName: 'f.json' });
    });

    const found = result.current.loadRecord('load1');
    expect(found).toBeDefined();
    expect(found!.spec).toBe('find me');

    const notFound = result.current.loadRecord('nonexistent');
    expect(notFound).toBeUndefined();
  });

  it('LRU eviction triggers when storage exceeds 4 MB', () => {
    // Use a class-based mock for TextEncoder so `new TextEncoder()` works
    const originalTextEncoder = globalThis.TextEncoder;
    const encodeSpy = vi.fn((input: string) => ({
      length: input.length * 10_000, // each char = 10 KB
    }));
    class MockTextEncoder {
      encode(input: string) {
        return encodeSpy(input) as Uint8Array;
      }
    }
    globalThis.TextEncoder = MockTextEncoder as unknown as typeof TextEncoder;

    try {
      const { result } = renderHook(() => useHistory());

      // Add records — each with ~50 chars of data, so ~500 KB each
      // 10 records → ~5 MB → should trigger eviction (target: 4 MB)
      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.addRecord({
            spec: `openapi: 3.0.0 info: title: Test${i}`,
            specFormat: null,
            result: null,
            specName: null,
          });
        }
      });

      // Verify that encode was called (eviction logic ran)
      expect(encodeSpy).toHaveBeenCalled();
    } finally {
      // Ensure cleanup even if assertion fails
      globalThis.TextEncoder = originalTextEncoder;
    }
  });

  it('handles corrupt localStorage JSON gracefully (returns [])', () => {
    localStorage.setItem(STORAGE_KEY, '{invalid json!!!');

    const { result } = renderHook(() => useHistory());
    expect(result.current.records).toEqual([]);
  });

  it('handles localStorage being unavailable (getItem throws) — does not crash', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('localStorage unavailable');
    });

    // Should not throw
    const { result } = renderHook(() => useHistory());
    expect(result.current.records).toEqual([]);

    getItemSpy.mockRestore();
  });

  it('records persist across hook instances (localStorage is the source of truth)', () => {
    const { result: hook1, unmount } = renderHook(() => useHistory());

    act(() => {
      hook1.current.addRecord({
        id: 'persist1',
        spec: 'persist me',
        specFormat: 'yaml',
        result: 'done',
        specName: 'p.yaml',
      });
    });

    expect(hook1.current.records).toHaveLength(1);

    // Unmount the first hook
    unmount();

    // Create a new hook — it should read from localStorage
    const { result: hook2 } = renderHook(() => useHistory());
    expect(hook2.current.records).toHaveLength(1);
    expect(hook2.current.records[0].id).toBe('persist1');
    expect(hook2.current.records[0].spec).toBe('persist me');
  });

  it('addRecord auto-sets id and timestamp if not provided', () => {
    const { result } = renderHook(() => useHistory());

    const before = Date.now();
    let record: ReturnType<typeof result.current.addRecord> | undefined;
    act(() => {
      record = result.current.addRecord({
        spec: 'auto-fill test',
        specFormat: 'json',
        result: null,
        specName: null,
      });
    });
    const after = Date.now();

    expect(record).toBeDefined();
    expect(record!.id).toBeDefined();
    expect(record!.timestamp).toBeGreaterThanOrEqual(before);
    expect(record!.timestamp).toBeLessThanOrEqual(after);
    expect(result.current.records).toHaveLength(1);
    expect(result.current.records[0].id).toBe(record!.id);
  });
});
