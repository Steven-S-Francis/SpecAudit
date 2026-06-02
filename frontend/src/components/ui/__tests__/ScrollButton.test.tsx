// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScrollButton } from '../ScrollButton';

describe('ScrollButton', () => {
  it('renders down chevron and fires onClick', () => {
    const onClick = vi.fn();
    render(<ScrollButton onClick={onClick} direction="down" />);

    const button = screen.getByRole('button', { name: /scroll to bottom/i });
    expect(button).toBeInTheDocument();

    // SVG chevron should be inside
    expect(button.querySelector('svg')).toBeInTheDocument();

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders up chevron with correct aria-label', () => {
    const onClick = vi.fn();
    render(<ScrollButton onClick={onClick} direction="up" />);

    const button = screen.getByRole('button', { name: /scroll to top/i });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
