// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../Button';

describe('Button', () => {
  it('renders with md size by default', () => {
    render(
      <Button variant="ghost">
        Click Me
      </Button>
    );
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button.className).toContain('text-sm');
    expect(button.className).toContain('px-4');
    expect(button.className).toContain('py-2');
  });

  it('renders with sm size when specified', () => {
    render(
      <Button variant="ghost" size="sm">
        Click Me
      </Button>
    );
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button.className).toContain('text-xs');
    expect(button.className).toContain('px-2');
    expect(button.className).toContain('py-1');
  });

  it('renders with custom className merged', () => {
    render(
      <Button variant="ghost" className="extra">
        Click Me
      </Button>
    );
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button.className).toContain('extra');
    // Base classes should still be present
    expect(button.className).toContain('text-sm');
    expect(button.className).toContain('px-4');
    expect(button.className).toContain('py-2');
    expect(button.className).toContain('rounded-lg');
  });
});
