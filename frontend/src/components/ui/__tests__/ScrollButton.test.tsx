// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScrollButton } from '../ScrollButton';

describe('ScrollButton', () => {
  it('renders button with chevron and fires onClick', () => {
    const onClick = vi.fn();
    render(<ScrollButton onClick={onClick} />);

    const button = screen.getByRole('button', { name: /scroll to bottom/i });
    expect(button).toBeInTheDocument();

    // SVG chevron should be inside
    expect(button.querySelector('svg')).toBeInTheDocument();

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
