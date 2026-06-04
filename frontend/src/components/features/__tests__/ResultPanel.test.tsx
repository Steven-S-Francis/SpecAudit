// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
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
    // Scope query to the markdown content area to find the badge (not the group header)
    const markdownArea = container.querySelector<HTMLElement>('.font-mono');
    const badges = within(markdownArea!).getAllByText('CRITICAL');
    // The finding badge has the bg-red-500/20 class; the group header label doesn't
    const badge = badges.find((el) => el.className.includes('bg-red-500/20'))!;
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
    const badges = within(markdownArea!).getAllByText('WARNING');
    const badge = badges.find((el) => el.className.includes('bg-amber-500/20'))!;
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-amber-300');
    expect(badge.className).toContain('bg-amber-500/20');
    expect(screen.getByText('Missing 404 Response')).toBeInTheDocument();
  });

  it('renders INFO severity with blue styling', () => {
    const markdown = '### [INFO] Missing Contact Block';
    const { container } = render(<ResultPanel content={markdown} isStreaming={false} />);
    const markdownArea = container.querySelector<HTMLElement>('.font-mono');
    const badges = within(markdownArea!).getAllByText('INFO');
    const badge = badges.find((el) => el.className.includes('bg-blue-400/20'))!;
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

  // --- Search within results tests ---

  it('renders search input when content is present', () => {
    render(<ResultPanel content="# Test" isStreaming={false} />);
    expect(screen.getByPlaceholderText('Search results…')).toBeInTheDocument();
  });

  it('does not render search input when content is empty', () => {
    render(<ResultPanel content="" isStreaming={false} />);
    expect(screen.queryByPlaceholderText('Search results…')).not.toBeInTheDocument();
  });

  it('highlights matching text in rendered output', async () => {
    const markdown = '## Governance Score\nScore: 8.5';
    const { container } = render(<ResultPanel content={markdown} isStreaming={false} />);
    const input = screen.getByPlaceholderText('Search results…');
    fireEvent.change(input, { target: { value: 'Governance' } });
    // The <mark> element should contain 'Governance'
    await waitFor(() => {
      const highlights = container.querySelectorAll('mark.search-highlight');
      expect(highlights.length).toBeGreaterThanOrEqual(1);
      expect(highlights[0]).toHaveTextContent('Governance');
      expect(highlights[0].className).toContain('search-highlight');
    });
  });

  it('highlight is case-insensitive', async () => {
    const markdown = '### [CRITICAL] Missing Auth';
    const { container } = render(<ResultPanel content={markdown} isStreaming={false} />);
    const input = screen.getByPlaceholderText('Search results…');
    fireEvent.change(input, { target: { value: 'missing' } });
    await waitFor(() => {
      const highlights = container.querySelectorAll('mark.search-highlight');
      expect(highlights.length).toBeGreaterThanOrEqual(1);
      expect(highlights[0]).toHaveTextContent('Missing');
    });
  });

  it('clear button removes highlighting', () => {
    const markdown = '## Governance Score\nScore: 8.5';
    const { container } = render(<ResultPanel content={markdown} isStreaming={false} />);
    const input = screen.getByPlaceholderText('Search results…');
    fireEvent.change(input, { target: { value: 'Governance' } });
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(input).toHaveValue('');
    const highlights = container.querySelectorAll('mark.search-highlight');
    expect(highlights.length).toBe(0);
  });

  it('search works together with severity filter', async () => {
    const markdown = '### [CRITICAL] Missing Auth\n---\n### [WARNING] Missing 404';
    const { container } = render(<ResultPanel content={markdown} isStreaming={false} />);
    // Hide CRITICAL
    fireEvent.click(screen.getByRole('button', { name: 'CRITICAL' }));
    // Search for 'Missing'
    const input = screen.getByPlaceholderText('Search results…');
    fireEvent.change(input, { target: { value: 'Missing' } });
    // Only WARNING finding should be visible
    expect(screen.queryByText('Missing Auth')).not.toBeInTheDocument();
    // The WARNING text should be present (check via container to handle DOM structure)
    await waitFor(() => {
      const markdownArea = container.querySelector<HTMLElement>('.font-mono');
      expect(markdownArea?.textContent).toContain('Missing 404');
      expect(markdownArea?.textContent).not.toContain('Missing Auth');
    });
  });

  it('empty search query shows no highlights', () => {
    const markdown = '## Governance Score\nScore: 8.5';
    const { container } = render(<ResultPanel content={markdown} isStreaming={false} />);
    const highlights = container.querySelectorAll('mark.search-highlight');
    expect(highlights.length).toBe(0);
  });

  it('unmatched search term renders normally', () => {
    const markdown = '## Governance Score\nScore: 8.5';
    const { container } = render(<ResultPanel content={markdown} isStreaming={false} />);
    const input = screen.getByPlaceholderText('Search results…');
    fireEvent.change(input, { target: { value: 'ZZZNOTFOUND' } });
    const highlights = container.querySelectorAll('mark.search-highlight');
    expect(highlights.length).toBe(0);
    expect(screen.getByText('Governance Score')).toBeInTheDocument();
  });

  // --- Collapsible severity group tests ---

  it('renders collapsible group headers for each severity present', () => {
    const markdown = '### [CRITICAL] Missing Auth\n---\n### [WARNING] Missing 404\n---\n### [INFO] Missing Contact';
    render(<ResultPanel content={markdown} isStreaming={false} />);
    // Each severity should have a group header button — filter by aria-expanded
    // to distinguish from the severity toggle filter buttons
    const headers = screen.getAllByRole('button', { expanded: true });
    expect(headers.some(h => h.textContent?.includes('CRITICAL'))).toBe(true);
    expect(headers.some(h => h.textContent?.includes('WARNING'))).toBe(true);
    expect(headers.some(h => h.textContent?.includes('INFO'))).toBe(true);
  });

  it('group header shows finding count', () => {
    const markdown = '### [CRITICAL] Missing Auth\n### [CRITICAL] No Rate Limit\n---\n### [WARNING] Missing 404';
    render(<ResultPanel content={markdown} isStreaming={false} />);
    // CRITICAL header should show (2)
    expect(screen.getByText('(2)')).toBeInTheDocument();
    // WARNING header should show (1)
    expect(screen.getByText('(1)')).toBeInTheDocument();
  });

  it('clicking severity group header hides its findings', () => {
    const markdown = '### [CRITICAL] Missing Auth\n---\n### [WARNING] Missing 404';
    render(<ResultPanel content={markdown} isStreaming={false} />);
    expect(screen.getByText('Missing Auth')).toBeInTheDocument();
    // Click the CRITICAL group header (find the button by its aria-controls)
    const criticalHeader = screen.getByRole('button', { name: /CRITICAL/i, expanded: true });
    fireEvent.click(criticalHeader);
    // CRITICAL finding is hidden via CSS (opacity: 0, max-height: 0)
    const groupContainer = document.getElementById('finding-group-critical')!;
    expect(groupContainer).toHaveStyle({ opacity: '0', maxHeight: '0px' });
    // WARNING should still be visible
    expect(screen.getByText('Missing 404')).toBeInTheDocument();
  });

  it('clicking collapsed group header re-shows findings', () => {
    const markdown = '### [CRITICAL] Missing Auth';
    render(<ResultPanel content={markdown} isStreaming={false} />);
    const criticalHeader = screen.getByRole('button', { name: /CRITICAL/i, expanded: true });
    // Collapse
    fireEvent.click(criticalHeader);
    const groupContainer = document.getElementById('finding-group-critical')!;
    expect(groupContainer).toHaveStyle({ opacity: '0', maxHeight: '0px' });
    // Re-expand (same button now has aria-expanded false)
    const collapsedHeader = screen.getByRole('button', { name: /CRITICAL/i, expanded: false });
    fireEvent.click(collapsedHeader);
    expect(groupContainer).toHaveStyle({ opacity: '1' });
  });

  it('group header toggles on Enter key', () => {
    const markdown = '### [CRITICAL] Missing Auth';
    render(<ResultPanel content={markdown} isStreaming={false} />);
    const criticalHeader = screen.getByRole('button', { name: /CRITICAL/i, expanded: true });
    fireEvent.keyDown(criticalHeader, { key: 'Enter' });
    const groupContainer = document.getElementById('finding-group-critical')!;
    expect(groupContainer).toHaveStyle({ opacity: '0', maxHeight: '0px' });
    // Second Enter re-expands
    const collapsedHeader = screen.getByRole('button', { name: /CRITICAL/i, expanded: false });
    fireEvent.keyDown(collapsedHeader, { key: 'Enter' });
    expect(groupContainer).toHaveStyle({ opacity: '1' });
  });

  it('group header toggles on Space key', () => {
    const markdown = '### [CRITICAL] Missing Auth';
    render(<ResultPanel content={markdown} isStreaming={false} />);
    const criticalHeader = screen.getByRole('button', { name: /CRITICAL/i, expanded: true });
    fireEvent.keyDown(criticalHeader, { key: ' ' });
    const groupContainer = document.getElementById('finding-group-critical')!;
    expect(groupContainer).toHaveStyle({ opacity: '0', maxHeight: '0px' });
  });

  it('non-finding content remains visible when severity groups are collapsed', () => {
    const markdown = '## Governance Score\nScore: 8.5\n---\n### [CRITICAL] Missing Auth';
    render(<ResultPanel content={markdown} isStreaming={false} />);
    const criticalHeader = screen.getByRole('button', { name: /CRITICAL/i, expanded: true });
    fireEvent.click(criticalHeader);
    expect(screen.getByText('Governance Score')).toBeInTheDocument();
    // Finding text still in DOM but hidden
    expect(screen.getByText('Missing Auth')).toBeInTheDocument();
    const groupContainer = document.getElementById('finding-group-critical')!;
    expect(groupContainer).toHaveStyle({ opacity: '0', maxHeight: '0px' });
  });

  it('group header has correct aria-expanded state', () => {
    const markdown = '### [CRITICAL] Missing Auth';
    render(<ResultPanel content={markdown} isStreaming={false} />);
    const criticalHeader = screen.getByRole('button', { name: /CRITICAL/i, expanded: true });
    expect(criticalHeader).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(criticalHeader);
    const collapsedHeader = screen.getByRole('button', { name: /CRITICAL/i, expanded: false });
    expect(collapsedHeader).toHaveAttribute('aria-expanded', 'false');
  });

  // --- Individual copy feature tests ---

  it('renders copy button on severity finding block', () => {
    const markdown = '### [CRITICAL] Missing Auth\n\nDetails about the issue.';
    const { container } = render(<ResultPanel content={markdown} isStreaming={false} />);
    const markdownArea = container.querySelector<HTMLElement>('.font-mono');
    const copyBtn = within(markdownArea!).getByLabelText('Copy finding');
    expect(copyBtn).toBeInTheDocument();
  });

  it('does not render copy button on non-severity block', () => {
    const markdown = '## Governance Score\nScore: 8.5';
    const { container } = render(<ResultPanel content={markdown} isStreaming={false} />);
    const markdownArea = container.querySelector<HTMLElement>('.font-mono');
    expect(within(markdownArea!).queryByLabelText('Copy finding')).not.toBeInTheDocument();
  });

  it('clicking copy button copies the finding block text', async () => {
    // Mock clipboard API
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });

    const markdown = '### [CRITICAL] Missing Auth\n\n**Issue:** No authentication.';
    render(<ResultPanel content={markdown} isStreaming={false} />);
    const copyBtn = screen.getByLabelText('Copy finding');
    fireEvent.click(copyBtn);
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
      // The copied text should be the block without <mark> tags
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('### [CRITICAL] Missing Auth'));
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('**Issue:** No authentication.'));
    });
  });

  it('shows checkmark icon after copy', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(() => Promise.resolve()) } });

    const markdown = '### [CRITICAL] Missing Auth';
    render(<ResultPanel content={markdown} isStreaming={false} />);
    const copyBtn = screen.getByLabelText('Copy finding');
    fireEvent.click(copyBtn);
    await waitFor(() => {
      // After copy, label changes to "Copied!"
      expect(screen.getByLabelText('Copied!')).toBeInTheDocument();
    });
  });

  it('hides copy button when severity is filtered out', () => {
    const markdown = '### [CRITICAL] Missing Auth\n\n---\n### [WARNING] Missing 404';
    render(<ResultPanel content={markdown} isStreaming={false} />);
    // Click CRITICAL toggle to hide CRITICAL findings
    fireEvent.click(screen.getByRole('button', { name: 'CRITICAL' }));
    // The CRITICAL finding's copy button should not exist
    // Only the WARNING block should have a copy button
    const copyButtons = screen.getAllByLabelText('Copy finding');
    expect(copyButtons).toHaveLength(1);
    // The remaining copy button should be on the WARNING block
    expect(screen.getByText('Missing 404')).toBeInTheDocument();
  });

  it('renders copy buttons during streaming', () => {
    const markdown = '### [WARNING] Incomplete spec';
    render(<ResultPanel content={markdown} isStreaming={true} />);
    expect(screen.getByLabelText('Copy finding')).toBeInTheDocument();
    // Streaming cursor should still be present
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });
});
