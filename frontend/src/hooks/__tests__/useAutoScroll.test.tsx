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

function TestComponent({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  const { containerRef, scrollToBottom, scrollToTop } = useAutoScroll({ deps: [content], isStreaming });
  return (
    <div>
      <div
        ref={containerRef}
        style={{ height: '100px', overflow: 'auto' }}
        data-testid="scroll-container"
      >
        <div style={{ height: '200px' }}>{content}</div>
      </div>
      <button onClick={scrollToBottom} data-testid="scroll-bottom">Scroll bottom</button>
      <button onClick={scrollToTop} data-testid="scroll-top">Scroll top</button>
    </div>
  );
}

describe('useAutoScroll', () => {
  it('scrolls to bottom when content changes and user is at bottom', () => {
    const scrollTo = vi.fn();
    const { container, rerender } = render(<TestComponent content="initial" isStreaming={false} />);
    const scrollEl = container.querySelector('[data-testid="scroll-container"]')!;

    Object.defineProperty(scrollEl, 'scrollTo', { value: scrollTo, writable: true });
    Object.defineProperty(scrollEl, 'scrollHeight', { value: 200, writable: true });
    Object.defineProperty(scrollEl, 'clientHeight', { value: 100, writable: true });
    Object.defineProperty(scrollEl, 'scrollTop', { value: 100, writable: true });

    rerender(<TestComponent content="updated" isStreaming={false} />);

    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({
      top: 200,
      behavior: 'smooth',
    });
  });

  it('does not scroll when user has scrolled up', () => {
    const scrollTo = vi.fn();
    const { container, rerender } = render(<TestComponent content="initial" isStreaming={false} />);
    const scrollEl = container.querySelector('[data-testid="scroll-container"]')!;

    Object.defineProperty(scrollEl, 'scrollTo', { value: scrollTo, writable: true });
    Object.defineProperty(scrollEl, 'scrollHeight', { value: 200, writable: true });
    Object.defineProperty(scrollEl, 'clientHeight', { value: 100, writable: true });
    Object.defineProperty(scrollEl, 'scrollTop', { value: 10, writable: true });

    fireEvent.scroll(scrollEl);

    rerender(<TestComponent content="updated" isStreaming={false} />);

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('uses auto behavior when isStreaming is true', () => {
    const scrollTo = vi.fn();
    const { container, rerender } = render(<TestComponent content="initial" isStreaming={true} />);
    const scrollEl = container.querySelector('[data-testid="scroll-container"]')!;

    Object.defineProperty(scrollEl, 'scrollTo', { value: scrollTo, writable: true });
    Object.defineProperty(scrollEl, 'scrollHeight', { value: 200, writable: true });
    Object.defineProperty(scrollEl, 'clientHeight', { value: 100, writable: true });
    Object.defineProperty(scrollEl, 'scrollTop', { value: 100, writable: true });

    rerender(<TestComponent content="updated" isStreaming={true} />);

    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({
      top: 200,
      behavior: 'auto',
    });
  });

  it('scrollToBottom scrolls to bottom and scrollToTop scrolls to top', () => {
    const scrollTo = vi.fn();
    const { container } = render(<TestComponent content="content" isStreaming={false} />);
    const scrollEl = container.querySelector('[data-testid="scroll-container"]')!;

    Object.defineProperty(scrollEl, 'scrollTo', { value: scrollTo, writable: true });
    Object.defineProperty(scrollEl, 'scrollHeight', { value: 200, writable: true });
    Object.defineProperty(scrollEl, 'clientHeight', { value: 100, writable: true });

    // Click scroll to bottom
    fireEvent.click(screen.getByTestId('scroll-bottom'));
    expect(scrollTo).toHaveBeenCalledWith({
      top: 200,
      behavior: 'smooth',
    });

    scrollTo.mockClear();

    // Click scroll to top
    fireEvent.click(screen.getByTestId('scroll-top'));
    expect(scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: 'smooth',
    });
  });
});
