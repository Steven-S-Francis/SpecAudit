// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeToggle } from '../ThemeToggle';

describe('ThemeToggle', () => {
  it('renders sun icon in dark mode', () => {
    render(<ThemeToggle theme="dark" onToggle={() => {}} />);
    const button = screen.getByRole('button', { name: /switch to light mode/i });
    // Sun icon contains a <circle> element
    expect(button.innerHTML).toContain('<circle');
  });

  it('renders moon icon in light mode', () => {
    render(<ThemeToggle theme="light" onToggle={() => {}} />);
    const button = screen.getByRole('button', { name: /switch to dark mode/i });
    // Moon icon contains a <path> with crescent shape
    expect(button.innerHTML).toContain('M21 12.79');
  });

  it('calls onToggle on click', () => {
    const onToggle = vi.fn();
    render(<ThemeToggle theme="dark" onToggle={onToggle} />);
    const button = screen.getByRole('button', { name: /switch to light mode/i });
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
