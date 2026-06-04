// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HistorySidebar } from '../HistorySidebar';
import type { HistoryRecord } from '../../../hooks/useHistory';

function noop() {}

const mockRecords: HistoryRecord[] = [
  {
    id: 'rec1',
    timestamp: Date.now() - 120_000, // 2 min ago
    spec: 'openapi: 3.0.0 info: version: "1.0.0"',
    specFormat: 'yaml',
    result: 'Audit completed',
    specName: 'spec.yaml',
  },
  {
    id: 'rec2',
    timestamp: Date.now() - 3_600_000, // 1 hour ago
    spec: '{"openapi":"3.0.0"}',
    specFormat: 'json',
    result: null,
    specName: null,
  },
];

describe('HistorySidebar', () => {
  it('renders "No past audits" when empty', () => {
    render(
      <HistorySidebar records={[]} onLoad={noop} onDelete={noop} onClearAll={noop} />
    );
    expect(screen.getByText('No past audits')).toBeInTheDocument();
  });

  it('renders list of records', () => {
    render(
      <HistorySidebar records={mockRecords} onLoad={noop} onDelete={noop} onClearAll={noop} />
    );
    // The first record shows specName
    expect(screen.getByText('spec.yaml')).toBeInTheDocument();
    // The second record shows spec preview (first 50 chars)
    expect(screen.getByText('{"openapi":"3.0.0"}')).toBeInTheDocument();
  });

  it('clicking a record calls onLoad with that record', () => {
    const onLoad = vi.fn();
    render(
      <HistorySidebar records={mockRecords} onLoad={onLoad} onDelete={noop} onClearAll={noop} />
    );

    fireEvent.click(screen.getByText('spec.yaml'));
    expect(onLoad).toHaveBeenCalledWith(mockRecords[0]);
  });

  it('delete button calls onDelete with the record id', () => {
    const onDelete = vi.fn();
    render(
      <HistorySidebar records={mockRecords} onLoad={noop} onDelete={onDelete} onClearAll={noop} />
    );

    // Find all delete buttons and click the first one
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    fireEvent.click(deleteButtons[0]);

    expect(onDelete).toHaveBeenCalledWith('rec1');
  });

  it('Clear all button calls onClearAll', () => {
    const onClearAll = vi.fn();
    render(
      <HistorySidebar records={mockRecords} onLoad={noop} onDelete={noop} onClearAll={onClearAll} />
    );

    fireEvent.click(screen.getByText('Clear all'));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it('toggle button opens/closes the sidebar', () => {
    render(
      <HistorySidebar records={mockRecords} onLoad={noop} onDelete={noop} onClearAll={noop} />
    );

    // Sidebar should be visible initially (open state)
    expect(screen.getByText('History')).toBeInTheDocument();

    // Click toggle to close
    const toggleButton = screen.getByRole('button', { name: /close history/i });
    fireEvent.click(toggleButton);

    // After closing, the sidebar content should not be visible
    // The aside still exists but is translated off-screen; history label not visible
    // We can check that the toggle button label changed
    expect(screen.getByRole('button', { name: /open history/i })).toBeInTheDocument();
  });

  it('shows relative timestamps and pending state', () => {
    render(
      <HistorySidebar records={mockRecords} onLoad={noop} onDelete={noop} onClearAll={noop} />
    );

    // First record: 2 min ago
    expect(screen.getByText('2 min ago')).toBeInTheDocument();
    // Second record: result is null → shows "Running..." + (pending) badge
    expect(screen.getByText('Running...')).toBeInTheDocument();
    expect(screen.getByText('(pending)')).toBeInTheDocument();
  });

  it('Escape key closes the sidebar', () => {
    render(
      <HistorySidebar records={mockRecords} onLoad={noop} onDelete={noop} onClearAll={noop} />
    );

    // Sidebar should be open initially
    expect(screen.getByText('History')).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(window, { key: 'Escape' });

    // Sidebar should close
    expect(screen.getByRole('button', { name: /open history/i })).toBeInTheDocument();
  });
});
