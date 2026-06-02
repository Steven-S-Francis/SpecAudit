// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useAutoScroll } from '../useAutoScroll';

// Add scrollTo to HTMLDivElement for jsdom compatibility
beforeAll(() => {
  if (!HTMLDivElement.prototype.scrollTo) {
    HTMLDivElement.prototype.scrollTo = vi.fn();
  }
});

afterEach(() => {
  vi.clearAllMocks();
});

function TestComponent({ content }: { content: string }) {
  const { containerRef, showScrollButton, scrollToBottom } = useAutoScroll({ deps: [content] });
  return (
    <div
      ref={containerRef}
      style={{ height: '100px', overflow: 'auto' }}
      data-testid="scroll-container"
    >
      <div style={{ height: '200px' }}>{content}</div>
      {showScrollButton && (
        <button onClick={scrollToBottom} data-testid="scroll-button">
          Scroll to bottom
        </button>
      )}
    </div>
  );
}

describe('useAutoScroll', () => {
  it('scrolls to bottom when content changes and user is at bottom', () => {
    const scrollTo = vi.fn();
    const { container, rerender } = render(<TestComponent content="initial" />);
    const scrollEl = container.querySelector('[data-testid="scroll-container"]')!;

    // Override scrollTo on this element
    Object.defineProperty(scrollEl, 'scrollTo', { value: scrollTo, writable: true });
    Object.defineProperty(scrollEl, 'scrollHeight', { value: 200, writable: true });
    Object.defineProperty(scrollEl, 'clientHeight', { value: 100, writable: true });
    Object.defineProperty(scrollEl, 'scrollTop', { value: 100, writable: true });

    rerender(<TestComponent content="updated" />);

    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({
      top: 200,
      behavior: 'smooth',
    });
  });

  it('does not scroll when user has scrolled up', () => {
    const scrollTo = vi.fn();
    const { container, rerender } = render(<TestComponent content="initial" />);
    const scrollEl = container.querySelector('[data-testid="scroll-container"]')!;

    Object.defineProperty(scrollEl, 'scrollTo', { value: scrollTo, writable: true });
    Object.defineProperty(scrollEl, 'scrollHeight', { value: 200, writable: true });
    Object.defineProperty(scrollEl, 'clientHeight', { value: 100, writable: true });
    // User has scrolled up significantly
    Object.defineProperty(scrollEl, 'scrollTop', { value: 10, writable: true });

    // Fire a scroll event so the handler registers the position
    fireEvent.scroll(scrollEl);

    rerender(<TestComponent content="updated" />);

    // scrollTo should not have been called since user is not at bottom
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('shows scroll button when not at bottom and hides it after scrolling down', () => {
    const scrollTo = vi.fn();
    const { container } = render(<TestComponent content="initial" />);

    // No button initially (at bottom by default)
    expect(screen.queryByTestId('scroll-button')).not.toBeInTheDocument();

    const scrollEl = container.querySelector('[data-testid="scroll-container"]')!;
    Object.defineProperty(scrollEl, 'scrollTo', { value: scrollTo, writable: true });
    Object.defineProperty(scrollEl, 'scrollHeight', { value: 200, writable: true });
    Object.defineProperty(scrollEl, 'clientHeight', { value: 100, writable: true });
    Object.defineProperty(scrollEl, 'scrollTop', { value: 10, writable: true });

    // Fire scroll to trigger state update
    fireEvent.scroll(scrollEl);

    // Button should appear
    expect(screen.getByTestId('scroll-button')).toBeInTheDocument();

    // Click the button to scroll to bottom
    scrollTo.mockClear();
    fireEvent.click(screen.getByTestId('scroll-button'));

    // Button should disappear
    expect(screen.queryByTestId('scroll-button')).not.toBeInTheDocument();
    expect(scrollTo).toHaveBeenCalledWith({
      top: 200,
      behavior: 'smooth',
    });
  });

  it('does not crash when scrollTo is unavailable', () => {
    // Remove scrollTo from this element's prototype for this test
    const { container, rerender } = render(<TestComponent content="initial" />);
    const scrollEl = container.querySelector('[data-testid="scroll-container"]')!;
    Object.defineProperty(scrollEl, 'scrollTo', { value: undefined, writable: true });
    Object.defineProperty(scrollEl, 'scrollHeight', { value: 200, writable: true });
    Object.defineProperty(scrollEl, 'clientHeight', { value: 100, writable: true });
    Object.defineProperty(scrollEl, 'scrollTop', { value: 100, writable: true });

    // Should not throw
    expect(() => {
      rerender(<TestComponent content="updated" />);
    }).not.toThrow();
  });
});
