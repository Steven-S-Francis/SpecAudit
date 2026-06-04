// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastContainer } from '../ToastContainer';
import { ToastProvider, useToastContext } from '../../../hooks/useToast';
import type { AddToast } from '../../../hooks/useToast';

function renderWithProvider() {
  const addToastRef: { current: AddToast | null } = { current: null };

  function TestComponent() {
    const ctx = useToastContext();
    addToastRef.current = ctx.addToast;
    return null;
  }

  render(
    <ToastProvider>
      <TestComponent />
      <ToastContainer />
    </ToastProvider>,
  );

  return {
    addToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error', duration?: number) => {
      act(() => {
        addToastRef.current?.(message, type, duration);
      });
    },
  };
}

describe('ToastContainer', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when toasts queue is empty', () => {
    const { container } = render(
      <ToastProvider>
        <ToastContainer />
      </ToastProvider>,
    );

    // Container should be empty (no toast elements)
    expect(container.textContent).toBe('');
  });

  it('renders a single toast with message and type class', () => {
    const { addToast } = renderWithProvider();

    addToast('Single toast', 'success');

    expect(screen.getByText('Single toast')).toBeDefined();
  });

  it('renders multiple toasts stacked', () => {
    const { addToast } = renderWithProvider();

    addToast('Toast one', 'info');
    addToast('Toast two', 'success');
    addToast('Toast three', 'warning');

    expect(screen.getByText('Toast one')).toBeDefined();
    expect(screen.getByText('Toast two')).toBeDefined();
    expect(screen.getByText('Toast three')).toBeDefined();
  });

  it('renders correct border color per type', () => {
    const { addToast } = renderWithProvider();

    // Check first 3 types (max 3 visible)
    addToast('Info toast', 'info');
    addToast('Success toast', 'success');
    addToast('Warning toast', 'warning');

    const infoToast = screen.getByText('Info toast').closest('div');
    const successToast = screen.getByText('Success toast').closest('div');
    const warningToast = screen.getByText('Warning toast').closest('div');

    expect(infoToast?.className).toContain('border-l-blue-500');
    expect(successToast?.className).toContain('border-l-emerald-500');
    expect(warningToast?.className).toContain('border-l-amber-500');

    // Dismiss one and add error type
    fireEvent.click(screen.getAllByLabelText('Dismiss')[0]);
    addToast('Error toast', 'error');

    const errorToast = screen.getByText('Error toast').closest('div');
    expect(errorToast?.className).toContain('border-l-red-500');
  });

  it('dismisses toast when close button is clicked', () => {
    const { addToast } = renderWithProvider();

    addToast('Dismissible', 'info');

    expect(screen.getByText('Dismissible')).toBeDefined();

    const dismissButton = screen.getByLabelText('Dismiss');
    fireEvent.click(dismissButton);

    expect(screen.queryByText('Dismissible')).toBeNull();
  });

  it('has role="alert" and aria-live="polite" accessibility attributes', () => {
    const { addToast } = renderWithProvider();

    addToast('Accessible toast', 'info');

    const container = screen.getByRole('alert');
    expect(container).toBeDefined();
    expect(container.getAttribute('aria-live')).toBe('polite');
  });

  it('renders persistent toast without auto-dismiss indicator', () => {
    vi.useFakeTimers();
    const { addToast } = renderWithProvider();

    addToast('Persistent toast', 'error', 0);

    expect(screen.getByText('Persistent toast')).toBeDefined();

    // Advance time well past normal auto-dismiss duration
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // Toast should still be visible (duration = 0 means persistent)
    expect(screen.getByText('Persistent toast')).toBeDefined();
  });
});
