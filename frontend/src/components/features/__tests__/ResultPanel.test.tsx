// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
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
    const { container } = render(<ResultPanel content={markdown} isStreaming={false} />);
    // Scope query to the markdown content area to find the badge (not the toggle button)
    const markdownArea = container.querySelector<HTMLElement>('.font-mono');
    const badge = within(markdownArea!).getByText('CRITICAL');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-red-300');
    expect(badge.className).toContain('bg-red-500/20');
    // Clean title should not have the [CRITICAL] tag
    expect(screen.getByText('Missing Auth')).toBeInTheDocument();
  });

  it('renders WARNING severity with amber styling', () => {
    const markdown = '### [WARNING] Missing 404 Response';
    const { container } = render(<ResultPanel content={markdown} isStreaming={false} />);
    const markdownArea = container.querySelector<HTMLElement>('.font-mono');
    const badge = within(markdownArea!).getByText('WARNING');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-amber-300');
    expect(badge.className).toContain('bg-amber-500/20');
    expect(screen.getByText('Missing 404 Response')).toBeInTheDocument();
  });

  it('renders INFO severity with blue styling', () => {
    const markdown = '### [INFO] Missing Contact Block';
    const { container } = render(<ResultPanel content={markdown} isStreaming={false} />);
    const markdownArea = container.querySelector<HTMLElement>('.font-mono');
    const badge = within(markdownArea!).getByText('INFO');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-blue-300');
    expect(badge.className).toContain('bg-blue-400/20');
    expect(screen.getByText('Missing Contact Block')).toBeInTheDocument();
  });

  it('renders a plain H3 without severity as a standard heading', () => {
    const markdown = '### Summary';
    const { container } = render(<ResultPanel content={markdown} isStreaming={false} />);
    expect(screen.getByText('Summary')).toBeInTheDocument();
    // No severity badge should be rendered inside the markdown area
    const markdownArea = container.querySelector<HTMLElement>('.font-mono');
    expect(within(markdownArea!).queryByText('CRITICAL')).not.toBeInTheDocument();
    expect(within(markdownArea!).queryByText('WARNING')).not.toBeInTheDocument();
    expect(within(markdownArea!).queryByText('INFO')).not.toBeInTheDocument();
  });

  // --- Severity filter toggle tests ---

  it('renders three filter toggle buttons when content is present', () => {
    render(<ResultPanel content="# Test" isStreaming={false} />);
    expect(screen.getByRole('button', { name: 'CRITICAL' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'WARNING' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'INFO' })).toBeInTheDocument();
  });

  it('does not render filter buttons when content is empty', () => {
    render(<ResultPanel content="" isStreaming={false} />);
    expect(screen.queryByRole('button', { name: 'CRITICAL' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'WARNING' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'INFO' })).not.toBeInTheDocument();
  });

  it('clicking CRITICAL toggle hides CRITICAL findings', () => {
    const markdown = '### [CRITICAL] Missing Auth\n---\n### [WARNING] Missing 404';
    render(<ResultPanel content={markdown} isStreaming={false} />);
    // Initially both badges are visible
    expect(screen.getByText('Missing Auth')).toBeInTheDocument();
    expect(screen.getByText('Missing 404')).toBeInTheDocument();
    // Click CRITICAL toggle to hide CRITICAL findings
    const criticalBtn = screen.getByRole('button', { name: 'CRITICAL' });
    fireEvent.click(criticalBtn);
    expect(screen.queryByText('Missing Auth')).not.toBeInTheDocument();
    expect(screen.getByText('Missing 404')).toBeInTheDocument();
  });

  it('clicking WARNING toggle hides WARNING findings', () => {
    const markdown = '### [CRITICAL] Missing Auth\n---\n### [WARNING] Missing 404';
    render(<ResultPanel content={markdown} isStreaming={false} />);
    expect(screen.getByText('Missing Auth')).toBeInTheDocument();
    expect(screen.getByText('Missing 404')).toBeInTheDocument();
    const warningBtn = screen.getByRole('button', { name: 'WARNING' });
    fireEvent.click(warningBtn);
    expect(screen.getByText('Missing Auth')).toBeInTheDocument();
    expect(screen.queryByText('Missing 404')).not.toBeInTheDocument();
  });

  it('clicking INFO toggle hides INFO findings', () => {
    const markdown = '### [CRITICAL] Missing Auth\n---\n### [INFO] Missing Contact';
    render(<ResultPanel content={markdown} isStreaming={false} />);
    expect(screen.getByText('Missing Auth')).toBeInTheDocument();
    expect(screen.getByText('Missing Contact')).toBeInTheDocument();
    const infoBtn = screen.getByRole('button', { name: 'INFO' });
    fireEvent.click(infoBtn);
    expect(screen.getByText('Missing Auth')).toBeInTheDocument();
    expect(screen.queryByText('Missing Contact')).not.toBeInTheDocument();
  });

  it('clicking toggle again re-shows findings', () => {
    const markdown = '### [CRITICAL] Missing Auth';
    render(<ResultPanel content={markdown} isStreaming={false} />);
    expect(screen.getByText('Missing Auth')).toBeInTheDocument();
    const criticalBtn = screen.getByRole('button', { name: 'CRITICAL' });
    // First click hides
    fireEvent.click(criticalBtn);
    expect(screen.queryByText('Missing Auth')).not.toBeInTheDocument();
    // Second click shows again
    fireEvent.click(criticalBtn);
    expect(screen.getByText('Missing Auth')).toBeInTheDocument();
  });

  it('non-finding content (Governance Score) unaffected by filter', () => {
    const markdown = '## Governance Score\nScore: 8.5\n---\n### [CRITICAL] Missing Auth';
    render(<ResultPanel content={markdown} isStreaming={false} />);
    expect(screen.getByText('Governance Score')).toBeInTheDocument();
    expect(screen.getByText('Missing Auth')).toBeInTheDocument();
    // Hide all severities
    fireEvent.click(screen.getByRole('button', { name: 'CRITICAL' }));
    fireEvent.click(screen.getByRole('button', { name: 'WARNING' }));
    fireEvent.click(screen.getByRole('button', { name: 'INFO' }));
    // Governance Score should still be visible
    expect(screen.getByText('Governance Score')).toBeInTheDocument();
    expect(screen.queryByText('Missing Auth')).not.toBeInTheDocument();
  });

  it('filter works during streaming', () => {
    const markdown = '### [CRITICAL] Missing Auth\n---\n### [WARNING] Missing 404';
    render(<ResultPanel content={markdown} isStreaming={true} />);
    expect(screen.getByText('Missing Auth')).toBeInTheDocument();
    expect(screen.getByText('Missing 404')).toBeInTheDocument();
    // Click CRITICAL toggle
    fireEvent.click(screen.getByRole('button', { name: 'CRITICAL' }));
    expect(screen.queryByText('Missing Auth')).not.toBeInTheDocument();
    expect(screen.getByText('Missing 404')).toBeInTheDocument();
    // Streaming cursor should still be present
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });
});
