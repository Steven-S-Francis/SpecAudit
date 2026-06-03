// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../useTheme';

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('light');
    // Reset matchMedia mock if set by a previous test
    (window as any).matchMedia = undefined;
  });

  it('defaults to dark theme when no OS preference', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
  });

  it('defaults to light theme when OS prefers light mode', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: light)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
  });

  it('toggle switches to light and back', () => {
    const { result } = renderHook(() => useTheme());

    // Toggle to light
    act(() => {
      result.current.toggle();
    });
    expect(result.current.theme).toBe('light');

    // Toggle back to dark
    act(() => {
      result.current.toggle();
    });
    expect(result.current.theme).toBe('dark');
  });

  it('localStorage preference overrides OS preference', () => {
    localStorage.setItem('specaudit-theme', 'light');
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
  });

  it('persists to localStorage', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.toggle();
    });

    expect(localStorage.getItem('specaudit-theme')).toBe('light');
  });

  it('applies light class to html element', () => {
    const { result } = renderHook(() => useTheme());

    // Initially dark — class should not be present
    expect(document.documentElement.classList.contains('light')).toBe(false);

    // Toggle to light — class should be present
    act(() => {
      result.current.toggle();
    });
    expect(document.documentElement.classList.contains('light')).toBe(true);

    // Toggle back to dark — class should be removed
    act(() => {
      result.current.toggle();
    });
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });
});
