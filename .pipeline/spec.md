# Expandable/Collapsible Findings Grouped by Severity

## OPEN QUESTIONS

1. **Per-finding severity badge inside collapsed sections**: Should the individual finding's severity badge (e.g. `[CRITICAL]` inside the styled `.wrapper` div) remain visible when inside a collapsible group whose header already shows the severity? **Assumption**: Keep the per-finding badge as-is. The group header is for collapse control; the per-finding badge provides visual consistency within each finding card. No changes to the existing `h3` handler in `ReactMarkdown` components.

2. **Count computation**: Where should the finding count per severity be computed? **Assumption**: Pre-compute by scanning `blocks` once after filtering, before rendering. Store in a `Record<SeverityLevel, number>`.

---

## Files to Modify

| Action | Path |
|--------|------|
| **MODIFY** | `frontend/src/components/features/ResultPanel.tsx` |
| **MODIFY** | `frontend/src/components/features/__tests__/ResultPanel.test.tsx` |

No backend changes. No new files. No type changes.

---

## 1. `frontend/src/components/features/ResultPanel.tsx` — Changes

### 1a. New State

Add after `const [copiedBlockText, setCopiedBlockText] = useState...` (line 95):

```typescript
const [expandedGroups, setExpandedGroups] = useState<Set<SeverityLevel>>(
  () => new Set<SeverityLevel>(['CRITICAL', 'WARNING', 'INFO'])
);
```

- Default: all three severity groups expanded.
- Resets on every mount (i.e., every new audit produces a new `ResultPanel` instance via React key or parent state change).

### 1b. Toggle Handler

```typescript
const toggleGroup = useCallback((severity: SeverityLevel) => {
  setExpandedGroups((prev) => {
    const next = new Set(prev);
    if (next.has(severity)) {
      next.delete(severity);
    } else {
      next.add(severity);
    }
    return next;
  });
}, []);
```

### 1c. Pre-compute Finding Counts Per Severity

After the existing `const blocks = splitIntoBlocks(filteredContent);` (line 108), add:

```typescript
const findingCounts = useMemo(() => {
  const counts: Record<SeverityLevel, number> = { CRITICAL: 0, WARNING: 0, INFO: 0 };
  for (const block of blocks) {
    if (block.severity) counts[block.severity]++;
  }
  return counts;
}, [blocks]);
```

This must be `useMemo` to avoid re-computation on every render. Import `useMemo` from React (add to the existing import on line 1).

### 1d. Grouped Rendering Logic

Replace the existing `blocks.map(...)` at line 185 with a grouped render that tracks severity group transitions.

**Approach**: Walk `blocks` linearly. Track `currentGroup: SeverityLevel | null`. When a block's severity differs from `currentGroup`:
- If the block has a severity, and this is the first block of that severity in the current walk, emit a **group header** before the block.
- If the block has NO severity (non-finding), it always renders as-is and resets `currentGroup` to null.

**Pseudo-structure**:

```
let currentGroup: SeverityLevel | null = null;

{blocks.map((block, index) => {
  const isFinding = block.severity !== null;
  const isNewGroup = isFinding && block.severity !== currentGroup;

  // Update tracker
  const prevGroup = currentGroup;
  currentGroup = isFinding ? block.severity : null;

  return (
    <Fragment key={index}>
      {/* Group header at transition into a new severity */}
      {isNewGroup && block.severity && (
        <SeverityGroupHeader
          severity={block.severity}
          count={findingCounts[block.severity]}
          isExpanded={expandedGroups.has(block.severity)}
          onToggle={() => toggleGroup(block.severity!)}
        />
      )}
      
      {/* Finding block — conditionally visible */}
      {(!isFinding || expandedGroups.has(block.severity!)) && (
        <div className={isFinding ? 'relative group overflow-hidden transition-all duration-300' : ''}
          style={!isFinding ? undefined : {
            maxHeight: expandedGroups.has(block.severity!) ? '2000px' : '0',
            opacity: expandedGroups.has(block.severity!) ? 1 : 0,
            paddingTop: expandedGroups.has(block.severity!) ? undefined : '0',
            paddingBottom: expandedGroups.has(block.severity!) ? undefined : '0',
          }}
        >
          {/* EXISTING finding rendering (copy button + ReactMarkdown) — unchanged */}
          ...
        </div>
      )}
    </Fragment>
  );
})}
```

**Key detail**: The existing `isFinding` check on line 191 and the copy button rendering inside that block must be preserved. Only the outer wrapper changes.

**Animation**: Use CSS transition on `max-height` and `opacity` for a simple expand/collapse. The class `overflow-hidden transition-all duration-300` with dynamic `maxHeight` (0 vs a large value like `2000px`) and `opacity` (0 vs 1) achieves a smooth effect. Do NOT use `display: none` because it cannot be animated.

**Edge case — single finding group spanning multiple blocks**: Only one header is emitted at the transition. All consecutive blocks of the same severity share one group header.

**Edge case — non-finding block between two CRITICAL groups**: Because `currentGroup` resets to null on non-finding blocks, if a CRITICAL block appears again later, a new group header is emitted. This is correct.

### 1e. `SeverityGroupHeader` Component (Inline or Co-located)

Define a helper component inside the same file (before `ResultPanel`), or as a private component following the pattern of other small UI co-located in the file:

```typescript
function SeverityGroupHeader({
  severity,
  count,
  isExpanded,
  onToggle,
}: {
  severity: SeverityLevel;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const styles = SEVERITY_STYLES[severity];

  return (
    <button
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onToggle();
        }
      }}
      aria-expanded={isExpanded}
      aria-controls={`finding-group-${severity.toLowerCase()}`}
      className={`
        flex items-center gap-2 w-full text-left cursor-pointer
        px-4 py-2 mb-2 rounded-lg border transition-colors
        ${styles.wrapper.replace('mb-3', '').replace('px-4 py-3', 'px-4 py-2')}
        hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400
      `}
    >
      <span className={`font-semibold text-sm ${styles.label}`}>
        {severity}
      </span>
      <span className="text-xs text-slate-400 light:text-slate-500 ml-1">
        ({count})
      </span>
      <span className="ml-auto transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
        {/* Chevron down SVG */}
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </span>
    </button>
  );
}
```

**Important**: The `aria-controls` attribute should reference an `id` on the wrapper div of the findings group. The wrapping container for each severity group's findings needs an `id` attribute like `finding-group-critical`.

### 1f. Group Container with `id`

When emitting the group header + findings, wrap the findings container with:
```tsx
<div
  id={`finding-group-${block.severity!.toLowerCase()}`}
  role="region"
  aria-labelledby={`finding-group-header-${block.severity!.toLowerCase()}`}
  className="overflow-hidden transition-all duration-300"
  style={{
    maxHeight: expandedGroups.has(block.severity!) ? `${findingCounts[block.severity!] * 500}px` : '0',
    opacity: expandedGroups.has(block.severity!) ? 1 : 0,
  }}
>
  {/* existing finding blocks for this severity */}
</div>
```

But this means we need to collect ALL consecutive same-severity blocks into one container. The current `blocks.map` renders each block separately with its own `<ReactMarkdown>`. To wrap them together, we need a different approach:

**Alternative approach**: After computing `blocks`, group them into "sections" where each section is either a non-finding block or a severity group. Then map over sections instead of individual blocks.

```typescript
interface BlockSection {
  type: 'finding-group';
  severity: SeverityLevel;
  blocks: MarkdownBlock[];
} | {
  type: 'non-finding';
  block: MarkdownBlock;
}
```

Compute sections:

```typescript
const sections = useMemo(() => {
  const sections: BlockSection[] = [];
  let currentSeverity: SeverityLevel | null = null;
  let currentGroup: MarkdownBlock[] = [];

  for (const block of blocks) {
    if (block.severity) {
      if (block.severity !== currentSeverity) {
        if (currentGroup.length > 0 && currentSeverity) {
          sections.push({ type: 'finding-group', severity: currentSeverity, blocks: currentGroup });
        }
        currentSeverity = block.severity;
        currentGroup = [block];
      } else {
        currentGroup.push(block);
      }
    } else {
      // Flush any pending group
      if (currentGroup.length > 0 && currentSeverity) {
        sections.push({ type: 'finding-group', severity: currentSeverity, blocks: currentGroup });
        currentSeverity = null;
        currentGroup = [];
      }
      sections.push({ type: 'non-finding', block });
    }
  }
  // Flush last group
  if (currentGroup.length > 0 && currentSeverity) {
    sections.push({ type: 'finding-group', severity: currentSeverity, blocks: currentGroup });
  }
  return sections;
}, [blocks]);
```

Then render:

```tsx
{sections.map((section, index) => {
  if (section.type === 'non-finding') {
    return (
      <div key={index} className="">
        {renderBlock(section.block, deferredQuery, copiedBlockText, handleCopyBlock)}
      </div>
    );
  }

  const isExpanded = expandedGroups.has(section.severity);
  return (
    <div key={index} className="mb-4">
      <SeverityGroupHeader
        severity={section.severity}
        count={section.blocks.length}
        isExpanded={isExpanded}
        onToggle={() => toggleGroup(section.severity)}
        headerId={`finding-group-header-${section.severity.toLowerCase()}`}
      />
      <div
        id={`finding-group-${section.severity.toLowerCase()}`}
        role="region"
        aria-labelledby={`finding-group-header-${section.severity.toLowerCase()}`}
        className="overflow-hidden transition-all duration-300"
        style={{
          maxHeight: isExpanded ? `${section.blocks.length * 500}px` : '0',
          opacity: isExpanded ? 1 : 0,
        }}
      >
        {section.blocks.map((block, bi) => (
          <div key={bi} className="relative group">
            {renderBlock(block, deferredQuery, copiedBlockText, handleCopyBlock)}
          </div>
        ))}
      </div>
    </div>
  );
})}
```

**Recommendation**: Use the `sections` approach — it is cleaner, produces correct DOM, and enables proper `aria-controls` / `role="region"` relationships.

### 1g. Extraction of Block Rendering Logic

To avoid duplicating the block rendering code, extract the inner block JSX into a helper function (inside `ResultPanel` or as a separate component). The existing code between lines 186 and 263 (inside `blocks.map`) becomes the body of `renderBlock(block, deferredQuery, copiedBlockText, handleCopyBlock)`.

### 1h. Import Changes

Add `useMemo` and `Fragment` to the React import on line 1:

```typescript
import { useState, useCallback, useMemo, useDeferredValue, Fragment, isValidElement, Children, type ReactNode, type ComponentPropsWithoutRef } from 'react';
```

### 1i. Streaming Behavior

No special handling. The user can toggle freely even during streaming. If findings are mid-arrival, the `blocks` array updates, `sections` recomputes via `useMemo`, and the UI updates accordingly. If a new severity appears mid-stream and the group was previously collapsed, it stays collapsed. This matches the "toggle freely" requirement.

---

## 2. `frontend/src/components/features/__tests__/ResultPanel.test.tsx` — New Tests

Add the following test cases after the existing "search works together with severity filter" block (after line 256).

### Test: Renders severity group headers

```typescript
it('renders collapsible group headers for each severity present', () => {
  const markdown = '### [CRITICAL] Missing Auth\n---\n### [WARNING] Missing 404\n---\n### [INFO] Missing Contact';
  render(<ResultPanel content={markdown} isStreaming={false} />);
  // Each severity should have a group header button
  expect(screen.getByRole('button', { name: /CRITICAL/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /WARNING/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /INFO/i })).toBeInTheDocument();
});
```

### Test: Group headers show finding count

```typescript
it('group header shows finding count', () => {
  const markdown = '### [CRITICAL] Missing Auth\n### [CRITICAL] No Rate Limit\n---\n### [WARNING] Missing 404';
  render(<ResultPanel content={markdown} isStreaming={false} />);
  // CRITICAL header should show (2)
  expect(screen.getByText('(2)')).toBeInTheDocument();
  // WARNING header should show (1)
  expect(screen.getByText('(1)')).toBeInTheDocument();
});
```

### Test: Clicking group header collapses findings

```typescript
it('clicking severity group header hides its findings', () => {
  const markdown = '### [CRITICAL] Missing Auth\n---\n### [WARNING] Missing 404';
  render(<ResultPanel content={markdown} isStreaming={false} />);
  expect(screen.getByText('Missing Auth')).toBeInTheDocument();
  // Click the CRITICAL group header (find the button that also matches the role pattern)
  const criticalHeaders = screen.getAllByRole('button').filter(b => b.textContent?.includes('CRITICAL'));
  fireEvent.click(criticalHeaders[0]);
  // CRITICAL finding should be hidden
  expect(screen.queryByText('Missing Auth')).not.toBeInTheDocument();
  // WARNING should still be visible
  expect(screen.getByText('Missing 404')).toBeInTheDocument();
});
```

### Test: Clicking again re-expands

```typescript
it('clicking collapsed group header re-shows findings', () => {
  const markdown = '### [CRITICAL] Missing Auth';
  render(<ResultPanel content={markdown} isStreaming={false} />);
  const criticalHeaders = screen.getAllByRole('button').filter(b => b.textContent?.includes('CRITICAL'));
  // Collapse
  fireEvent.click(criticalHeaders[0]);
  expect(screen.queryByText('Missing Auth')).not.toBeInTheDocument();
  // Expand
  fireEvent.click(criticalHeaders[0]);
  expect(screen.getByText('Missing Auth')).toBeInTheDocument();
});
```

### Test: Keyboard accessibility

```typescript
it('group header toggles on Enter key', () => {
  const markdown = '### [CRITICAL] Missing Auth';
  render(<ResultPanel content={markdown} isStreaming={false} />);
  const criticalHeaders = screen.getAllByRole('button').filter(b => b.textContent?.includes('CRITICAL'));
  fireEvent.keyDown(criticalHeaders[0], { key: 'Enter' });
  expect(screen.queryByText('Missing Auth')).not.toBeInTheDocument();
  fireEvent.keyDown(criticalHeaders[0], { key: 'Enter' });
  expect(screen.getByText('Missing Auth')).toBeInTheDocument();
});

it('group header toggles on Space key', () => {
  const markdown = '### [CRITICAL] Missing Auth';
  render(<ResultPanel content={markdown} isStreaming={false} />);
  const criticalHeaders = screen.getAllByRole('button').filter(b => b.textContent?.includes('CRITICAL'));
  fireEvent.keyDown(criticalHeaders[0], { key: ' ' });
  expect(screen.queryByText('Missing Auth')).not.toBeInTheDocument();
});
```

### Test: Non-finding content unaffected by collapse

```typescript
it('non-finding content remains visible when severity groups are collapsed', () => {
  const markdown = '## Governance Score\nScore: 8.5\n---\n### [CRITICAL] Missing Auth';
  render(<ResultPanel content={markdown} isStreaming={false} />);
  const criticalHeaders = screen.getAllByRole('button').filter(b => b.textContent?.includes('CRITICAL'));
  fireEvent.click(criticalHeaders[0]);
  expect(screen.getByText('Governance Score')).toBeInTheDocument();
  expect(screen.queryByText('Missing Auth')).not.toBeInTheDocument();
});
```

### Test: `aria-expanded` attribute reflects state

```typescript
it('group header has correct aria-expanded state', () => {
  const markdown = '### [CRITICAL] Missing Auth';
  render(<ResultPanel content={markdown} isStreaming={false} />);
  const criticalHeaders = screen.getAllByRole('button').filter(b => b.textContent?.includes('CRITICAL'));
  expect(criticalHeaders[0]).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(criticalHeaders[0]);
  expect(criticalHeaders[0]).toHaveAttribute('aria-expanded', 'false');
});
```

---

## Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| All findings filtered out via existing severity toggle | Group headers are also filtered out (because `filterMarkdownBySeverity` removes those blocks before they reach `splitIntoBlocks`) |
| Zero findings of a severity | No group header rendered for that severity |
| Only non-finding content (no findings) | No group headers rendered at all |
| Streaming mid-finding | `useMemo` recomputes sections when blocks change; collapsed groups stay collapsed, expanded groups show new findings as they arrive |
| Consecutive same-severity findings separated by non-finding content | Each run gets its own group header (not merged across non-finding content) |
| Search + collapse interaction | Hidden findings cannot be searched; visible findings highlight normally. No further coupling needed |
| Single finding | Group header shows `(1)` and wraps the single finding |
| Very large number of findings in one group | `maxHeight` is computed as `count * 500px` which should accommodate most cases. For extreme cases, set to a very large number (e.g. `9999px`) |
| Multiple severity groups in sequence | Each group has its own header, findings wrapped separately |

---

## Patterns to Follow

- **Component structure**: Named export `ResultPanel`, no default exports (same as `ResultPanel.tsx`).
- **State management**: `useState` for UI toggle state (same as `severityFilter`), `useCallback` for handlers (same as `toggleSeverity`), `useMemo` for derived data (same pattern as `hiddenSeverities`).
- **Dark mode**: Use existing `light:` prefix classes and `SEVERITY_STYLES` map for color values.
- **Tailwind v4**: Use `@import "tailwindcss"` (already configured). Use functional-first class ordering.
- **Tests**: Follow existing patterns in `ResultPanel.test.tsx` — `@testing-library/react`, `fireEvent`, `screen.getByText`, `container.querySelector`, `waitFor` where needed.

---

## Verification

1. `cd frontend && npm run build` — 0 errors
2. `cd frontend && npm test` — all existing + new tests pass
3. Manual: audit loads → Findings appear grouped with severity headers → Click a severity header → Findings collapse with animation → Click again → Re-expand → Keyboard Space/Enter works → Non-finding content unaffected → New audit mounts → Groups default to expanded
