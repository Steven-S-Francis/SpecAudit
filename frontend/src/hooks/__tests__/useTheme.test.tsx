// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../useTheme';

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('light');
  });

  it('defaults to dark theme', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
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
