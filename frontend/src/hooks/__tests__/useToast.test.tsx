// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast } from '../useToast';

describe('useToast', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with empty toast queue', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toasts).toHaveLength(0);
  });

  it('adds a toast with default type (info) and duration (4000ms)', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('Hello');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Hello');
    expect(result.current.toasts[0].type).toBe('info');
    expect(result.current.toasts[0].duration).toBe(4000);
  });

  it('adds a toast with custom type and duration', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('Warning!', 'warning', 6000);
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Warning!');
    expect(result.current.toasts[0].type).toBe('warning');
    expect(result.current.toasts[0].duration).toBe(6000);
  });

  it('dismisses a toast by id', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('Dismiss me', 'info', 0);
    });

    const id = result.current.toasts[0].id;
    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      result.current.dismissToast(id);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('auto-dismisses a toast after duration expires', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('Auto dismiss', 'info', 1000);
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('does NOT auto-dismiss a persistent toast (duration: 0)', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('Persistent', 'info', 0);
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(result.current.toasts).toHaveLength(1);
  });

  it('debounces duplicate messages within 2s window', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('Duplicate', 'info', 10000);
    });

    act(() => {
      result.current.addToast('Duplicate', 'info', 10000);
    });

    expect(result.current.toasts).toHaveLength(1);
    vi.useRealTimers();
  });

  it('allows same message after debounce window expires', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('Debounced', 'info', 10000);
    });

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    act(() => {
      result.current.addToast('Debounced', 'info', 10000);
    });

    // 2nd call happens after the 2s debounce window, so it should be added
    expect(result.current.toasts).toHaveLength(2);
    vi.useRealTimers();
  });

  it('enforces max 3 visible toasts — oldest dismissed first', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('First', 'info', 0);
    });
    act(() => {
      result.current.addToast('Second', 'info', 0);
    });
    act(() => {
      result.current.addToast('Third', 'info', 0);
    });

    expect(result.current.toasts).toHaveLength(3);

    // Add a 4th toast — oldest (First) should be removed
    act(() => {
      result.current.addToast('Fourth', 'info', 0);
    });

    expect(result.current.toasts).toHaveLength(3);
    expect(result.current.toasts.find(t => t.message === 'First')).toBeUndefined();
    expect(result.current.toasts.find(t => t.message === 'Fourth')).toBeDefined();
  });

  it('allows maximum 3 toasts when they have unique messages', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('Alpha', 'info', 0);
    });
    act(() => {
      result.current.addToast('Beta', 'info', 0);
    });
    act(() => {
      result.current.addToast('Gamma', 'info', 0);
    });

    expect(result.current.toasts).toHaveLength(3);
  });

  it('clears all timeouts on unmount', () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    const { result, unmount } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('Test', 'info', 5000);
    });

    expect(result.current.toasts).toHaveLength(1);

    unmount();

    // Should have cleared the pending timeout
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);

    clearTimeoutSpy.mockRestore();
    vi.useRealTimers();
  });
});
