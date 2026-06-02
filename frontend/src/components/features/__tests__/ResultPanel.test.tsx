// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResultPanel } from '../ResultPanel';

describe('ResultPanel', () => {
  it('renders loading skeleton when not streaming and content is empty', () => {
    const { container } = render(<ResultPanel content="" isStreaming={false} />);
    // Should render skeleton divs, not the streaming layout
    const skeletonDivs = container.querySelectorAll('.animate-pulse');
    expect(skeletonDivs.length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText(/specaudit report/i)).not.toBeInTheDocument();
  });

  it('renders content when provided even if not streaming', () => {
    render(<ResultPanel content="# SpecAudit Report" isStreaming={false} />);
    expect(screen.getByText('SpecAudit Report')).toBeInTheDocument();
    // No skeleton when content is present
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });

  it('renders blinking cursor when streaming', () => {
    const { container } = render(<ResultPanel content="test" isStreaming={true} />);
    const cursor = container.querySelector('.animate-pulse');
    expect(cursor).toBeInTheDocument();
  });

  it('does not render blinking cursor when not streaming', () => {
    const { container } = render(<ResultPanel content="test" isStreaming={false} />);
    const cursor = container.querySelector('.animate-pulse');
    // The pulse divs in the skeleton are not present when content is provided
    // And the blinking cursor span only renders when isStreaming is true
    expect(cursor).not.toBeInTheDocument();
  });

  it('renders CRITICAL severity with red styling', () => {
    const markdown = '### [CRITICAL] Missing Auth';
    render(<ResultPanel content={markdown} isStreaming={false} />);
    const badge = screen.getByText('CRITICAL');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-red-300');
    expect(badge.className).toContain('bg-red-500/20');
    // Clean title should not have the [CRITICAL] tag
    expect(screen.getByText('Missing Auth')).toBeInTheDocument();
  });

  it('renders WARNING severity with amber styling', () => {
    const markdown = '### [WARNING] Missing 404 Response';
    render(<ResultPanel content={markdown} isStreaming={false} />);
    const badge = screen.getByText('WARNING');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-amber-300');
    expect(badge.className).toContain('bg-amber-500/20');
    expect(screen.getByText('Missing 404 Response')).toBeInTheDocument();
  });

  it('renders INFO severity with blue styling', () => {
    const markdown = '### [INFO] Missing Contact Block';
    render(<ResultPanel content={markdown} isStreaming={false} />);
    const badge = screen.getByText('INFO');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-blue-300');
    expect(badge.className).toContain('bg-blue-400/20');
    expect(screen.getByText('Missing Contact Block')).toBeInTheDocument();
  });

  it('renders a plain H3 without severity as a standard heading', () => {
    const markdown = '### Summary';
    render(<ResultPanel content={markdown} isStreaming={false} />);
    expect(screen.getByText('Summary')).toBeInTheDocument();
    // No severity badge should be rendered
    expect(screen.queryByText('CRITICAL')).not.toBeInTheDocument();
    expect(screen.queryByText('WARNING')).not.toBeInTheDocument();
    expect(screen.queryByText('INFO')).not.toBeInTheDocument();
  });
});
