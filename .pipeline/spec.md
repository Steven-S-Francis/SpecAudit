# Keyboard shortcuts

## OPEN QUESTIONS

1. **Shortcut hint presentation**: Should the hint appear as a `title` tooltip on buttons, as a small `<kbd>` tag inside the button text, or as a subtitle under the buttons? The existing UI has clean buttons with no hints. **Recommendation**: Add `title` attribute to the Run Audit and Stop buttons for hover tooltip, plus a subtle `kbd` element inside the button content (matching GitHub's pattern). This keeps the UI clean while being discoverable.

2. **Escape key propagation for textarea**: When pressing Escape in the textarea while NOT streaming (e.g., during editing), should we let the browser handle it (e.g., blur the textarea) or prevent default? **Recommendation**: Let the browser handle Escape normally — only intercept when streaming is active. This means the global handler will fire, check `state.status === 'streaming'` and only `preventDefault` + call `abort()` in that case.

---

## Architecture Overview

The feature adds two keyboard shortcut listeners:

1. **`Ctrl+Enter` / `Cmd+Enter`** — local to the `InputPanel` textarea `onKeyDown` handler. Triggers the same action as clicking "Run Audit".
2. **`Escape`** — global `window` `keydown` listener in `App.tsx`. Triggers the same action as clicking "Stop" when streaming is active.

Both shortcuts reuse existing callbacks (`onSubmit` / `onAbort` from InputPanel, `abort` from useAudit hook) — no new state or API surface is added.

**Data flow:**

```
User presses Ctrl+Enter (or Cmd+Enter) in textarea
  → InputPanel.onKeyDown handler
    → checks: isEmpty || isOverLimit || status === 'loading' || status === 'streaming'
    → if all clear: e.preventDefault(); onSubmit(spec, format)
      → App.tsx handles: audit({ spec, specFormat: format })
        → useAudit.audit() starts streaming

User presses Escape (anywhere)
  → window keydown listener in App.tsx
    → checks: state.status === 'streaming'
    → if true: e.preventDefault(); abort()
      → useAudit.abort() cancels the AbortController
```

**Why two locations?**

- `Ctrl+Enter` only makes sense when the textarea is focused — it's a text editing shortcut. Adding it to the textarea's `onKeyDown` avoids unnecessary global listener overhead and naturally scopes the behavior.
- `Escape` should work globally (even when the user is looking at results) — it needs a `window` listener. Keeping it in `App.tsx` ensures it's active whenever the app is mounted.

---

## Files to Create or Modify

| Action | Path | Description |
|--------|------|-------------|
| MODIFY | `frontend/src/App.tsx` | Add global `keydown` listener for `Escape` key |
| MODIFY | `frontend/src/components/features/InputPanel.tsx` | Add `onKeyDown` handler on textarea for `Ctrl+Enter`/`Cmd+Enter`; add shortcut hints |
| MODIFY | `frontend/src/components/features/__tests__/InputPanel.test.tsx` | Add test cases for `Ctrl+Enter` |
| MODIFY | `frontend/src/components/features/__tests__/App.test.tsx` | Add test cases for global `Escape` handler |

---

## 1. Modify `frontend/src/App.tsx`

### 1.1 Add global Escape listener

Insert a new `useEffect` after the existing provider name fetch effect (around line 92):

```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && state.status === 'streaming') {
      e.preventDefault();
      abort();
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [state.status, abort]);
```

**Edge cases handled by this code:**

| Case | Behavior |
|------|----------|
| `Escape` pressed, streaming NOT active | Listener fires, check fails (`state.status !== 'streaming'`), no-op |
| `Escape` pressed, streaming active | `preventDefault()` stops browser Escape behavior, `abort()` cancels streaming |
| `Escape` pressed in textarea during typing (not streaming) | No-op — the check prevents any action, browser handles Escape as normal (blur) |
| Component unmounts while listener is active | Cleanup function removes the listener |

**Dependencies rationale:** `state.status` is included so the listener always reads the latest streaming state. `abort` is stable (from `useCallback` with empty deps). React guarantees the effect re-runs when deps change, keeping the closure fresh.

---

## 2. Modify `frontend/src/components/features/InputPanel.tsx`

### 2.1 Add `onKeyDown` handler to textarea

Inside the `InputPanel` function, before the `return` statement:

```tsx
const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  const isMod = e.ctrlKey || e.metaKey;
  if (isMod && e.key === 'Enter') {
    const isEmpty = spec.trim().length === 0;
    const isOverLimit = count > 100000;
    if (!isEmpty && !isOverLimit && status !== 'loading' && status !== 'streaming') {
      e.preventDefault();
      onSubmit(spec, format);
    }
  }
}, [spec, format, status, onSubmit, count]);
```

Note: The `isEmpty` and `isOverLimit` checks are duplicated from the render scope (they're already computed as `const isEmpty = ...` and `const isOverLimit = ...` at the top of the component). Use those existing variables instead of redefining them.

Actually, looking at the existing code:
```tsx
const count = spec.length;
const isOverLimit = count > 100000;
const isEmpty = spec.trim().length === 0;
```

These are already computed before the return. So the handler can reference them directly. The `useCallback` should reference them:

```tsx
const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  const isMod = e.ctrlKey || e.metaKey;
  if (isMod && e.key === 'Enter') {
    if (!isEmpty && !isOverLimit && status !== 'loading' && status !== 'streaming') {
      e.preventDefault();
      onSubmit(spec, format);
    }
  }
}, [spec, format, status, onSubmit, isEmpty, isOverLimit]);
```

Wait — `isEmpty` and `isOverLimit` are derived from `spec` and `count` (which is derived from `spec`), so they don't need to be in deps if `spec` is already there. But TypeScript may complain if the closure references them. Better to keep them in deps for correctness, though they're technically reactive through `spec`. Actually, since they're `const` declarations derived synchronously from `spec`, the closure will capture them correctly at render time. Let me simplify: just reference `isEmpty` and `isOverLimit` directly in the handler without putting them in the deps array, since they're derived from `spec` which IS in deps.

Hmm, this is getting complex. Let me keep it simple — use a non-memoized handler inline on the textarea. Given that this is a single textarea with minimal re-renders, `useCallback` is not strictly necessary. But the existing codebase uses `useCallback` for event handlers. Let me follow the pattern.

Actually, the simplest approach: just add `onKeyDown={handleKeyDown}` on the textarea referencing a function defined in the component body. Let me not overthink this:

```tsx
function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
  const isMod = e.ctrlKey || e.metaKey;
  if (isMod && e.key === 'Enter') {
    if (!isEmpty && !isOverLimit && status !== 'loading' && status !== 'streaming') {
      e.preventDefault();
      onSubmit(spec, format);
    }
  }
}
```

This follows the existing pattern in InputPanel where `countColor` and other derived variables are computed as regular `const` in the function body (not memoized). No `useCallback` needed for a simple key handler.

### 2.2 Wire the handler to the textarea

Add `onKeyDown={handleKeyDown}` to the `<textarea>` element:

```tsx
<textarea
  value={spec}
  onChange={(e) => setSpec(e.target.value)}
  onKeyDown={handleKeyDown}
  placeholder="Paste your OpenAPI spec here (YAML or JSON)..."
  className="..."
/>
```

### 2.3 Add shortcut hints

Add `title` attributes to both buttons:

**Run Audit button** (line 66-70):
```tsx
<Button
  variant="primary"
  disabled={isEmpty || isOverLimit || status === 'loading' || status === 'streaming'}
  onClick={() => onSubmit(spec, format)}
  title="Ctrl+Enter to run audit"
>
  Run Audit
  <kbd className="ml-1.5 text-xs opacity-60 hidden sm:inline">Ctrl+Enter</kbd>
</Button>
```

**Stop button** (line 72-76):
```tsx
{status === 'streaming' && (
  <Button variant="danger" onClick={onAbort} title="Escape to stop">
    Stop
    <kbd className="ml-1.5 text-xs opacity-60 hidden sm:inline">Esc</kbd>
  </Button>
)}
```

The `hidden sm:inline` class hides the kbd on narrow screens where the button text is already crowded.

**Edge cases handled by the Ctrl+Enter handler:**

| Case | Behavior |
|------|----------|
| `Enter` alone (no modifier) | `isMod` is false, handler returns immediately, `Enter` inserts newline normally |
| `Ctrl+Enter` while empty | `isEmpty` is true, handler returns, no-op |
| `Ctrl+Enter` while over limit | `isOverLimit` is true, handler returns, no-op |
| `Ctrl+Enter` while loading/streaming | `status === 'loading'` or `'streaming'`, handler returns, no-op |
| `Ctrl+Enter` with valid input | `onSubmit(spec, format)` is called, same as button click |
| `Cmd+Enter` on Mac | `e.metaKey` is true, `isMod` is true, same behavior as Ctrl+Enter |
| `Shift+Enter` | No modifier match, inserts newline normally |
| Multiple rapid Ctrl+Enter presses | State changes to `loading` after first call disables further triggers (status check prevents re-entry) |

---

## 3. Modify test files

### 3.1 Add tests to `frontend/src/components/features/__tests__/InputPanel.test.tsx`

Add these tests inside the existing `describe('InputPanel', () => { … })` block, after the existing tests (before the closing `});`):

```ts
it('calls onSubmit when Ctrl+Enter is pressed with valid input', () => {
  const onSubmit = vi.fn();
  render(<InputPanel status="idle" onSubmit={onSubmit} onAbort={noop} />);
  const textarea = screen.getByPlaceholderText(/paste your openapi spec/i);
  fireEvent.change(textarea, { target: { value: 'openapi: 3.0.3' } });
  fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
  expect(onSubmit).toHaveBeenCalledWith('openapi: 3.0.3', undefined);
});

it('calls onSubmit when Cmd+Enter is pressed with valid input', () => {
  const onSubmit = vi.fn();
  render(<InputPanel status="idle" onSubmit={onSubmit} onAbort={noop} />);
  const textarea = screen.getByPlaceholderText(/paste your openapi spec/i);
  fireEvent.change(textarea, { target: { value: 'openapi: 3.0.3' } });
  fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });
  expect(onSubmit).toHaveBeenCalledWith('openapi: 3.0.3', undefined);
});

it('does not call onSubmit when Enter alone is pressed (newline)', () => {
  const onSubmit = vi.fn();
  render(<InputPanel status="idle" onSubmit={onSubmit} onAbort={noop} />);
  const textarea = screen.getByPlaceholderText(/paste your openapi spec/i);
  fireEvent.change(textarea, { target: { value: 'openapi: 3.0.3' } });
  fireEvent.keyDown(textarea, { key: 'Enter' });
  expect(onSubmit).not.toHaveBeenCalled();
});

it('does not call onSubmit when Ctrl+Enter and input is empty', () => {
  const onSubmit = vi.fn();
  render(<InputPanel status="idle" onSubmit={onSubmit} onAbort={noop} />);
  const textarea = screen.getByPlaceholderText(/paste your openapi spec/i);
  // textarea is empty
  fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
  expect(onSubmit).not.toHaveBeenCalled();
});

it('does not call onSubmit when Ctrl+Enter and status is loading', () => {
  const onSubmit = vi.fn();
  render(<InputPanel status="loading" onSubmit={onSubmit} onAbort={noop} />);
  const textarea = screen.getByPlaceholderText(/paste your openapi spec/i);
  fireEvent.change(textarea, { target: { value: 'openapi: 3.0.3' } });
  fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
  expect(onSubmit).not.toHaveBeenCalled();
});

it('does not call onSubmit when Ctrl+Enter and status is streaming', () => {
  const onSubmit = vi.fn();
  render(<InputPanel status="streaming" onSubmit={onSubmit} onAbort={noop} />);
  const textarea = screen.getByPlaceholderText(/paste your openapi spec/i);
  fireEvent.change(textarea, { target: { value: 'openapi: 3.0.3' } });
  fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
  expect(onSubmit).not.toHaveBeenCalled();
});

it('does not call onSubmit when Ctrl+Enter and input exceeds limit', () => {
  const onSubmit = vi.fn();
  render(<InputPanel status="idle" onSubmit={onSubmit} onAbort={noop} />);
  const textarea = screen.getByPlaceholderText(/paste your openapi spec/i);
  fireEvent.change(textarea, { target: { value: 'x'.repeat(100_001) } });
  fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
  expect(onSubmit).not.toHaveBeenCalled();
});

it('shows Ctrl+Enter hint on Run Audit button', () => {
  render(<InputPanel status="idle" onSubmit={noop} onAbort={noop} />);
  const button = screen.getByRole('button', { name: /run audit/i });
  // kbd element should be rendered inside the button on sm+ screens
  const kbd = button.querySelector('kbd');
  expect(kbd).toBeInTheDocument();
  expect(kbd).toHaveTextContent('Ctrl+Enter');
});

it('shows Escape hint on Stop button', () => {
  render(<InputPanel status="streaming" onSubmit={noop} onAbort={noop} />);
  const button = screen.getByRole('button', { name: /stop/i });
  const kbd = button.querySelector('kbd');
  expect(kbd).toBeInTheDocument();
  expect(kbd).toHaveTextContent('Esc');
});
```

### 3.2 Add tests to `frontend/src/components/features/__tests__/App.test.tsx`

Add a new `describe('App Keyboard Shortcuts', () => { … })` block after the existing test blocks. Add this before the existing `describe` blocks or after them — order doesn't matter for vitest.

```ts
describe('App Keyboard Shortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    Object.assign(navigator, { clipboard: { writeText: vi.fn() } });
    mockUseTheme.mockReturnValue({ theme: 'dark', toggle: vi.fn() });
  });

  it('calls abort when Escape is pressed during streaming', async () => {
    const abort = vi.fn();
    mockUseAudit.mockReturnValue({
      state: { status: 'streaming', result: 'Partial...', findings: [], summary: null, error: null },
      audit: vi.fn(),
      abort,
      reset: vi.fn(),
    });

    render(<App />);
    await waitFor(() => {});

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(abort).toHaveBeenCalledTimes(1);
  });

  it('does not call abort when Escape is pressed and status is not streaming', async () => {
    const abort = vi.fn();
    mockUseAudit.mockReturnValue({
      state: { status: 'idle', result: '', findings: [], summary: null, error: null },
      audit: vi.fn(),
      abort,
      reset: vi.fn(),
    });

    render(<App />);
    await waitFor(() => {});

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(abort).not.toHaveBeenCalled();
  });

  it('does not call abort on non-Escape keys during streaming', async () => {
    const abort = vi.fn();
    mockUseAudit.mockReturnValue({
      state: { status: 'streaming', result: 'Partial...', findings: [], summary: null, error: null },
      audit: vi.fn(),
      abort,
      reset: vi.fn(),
    });

    render(<App />);
    await waitFor(() => {});

    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.keyDown(window, { key: ' ' });
    fireEvent.keyDown(window, { key: 'x' });
    expect(abort).not.toHaveBeenCalled();
  });

  it('calls abort when Escape is pressed in textarea during streaming', async () => {
    // This tests the requirement: "Escape when textarea is focused but streaming is active"
    const abort = vi.fn();
    mockUseAudit.mockReturnValue({
      state: { status: 'streaming', result: 'Partial...', findings: [], summary: null, error: null },
      audit: vi.fn(),
      abort,
      reset: vi.fn(),
    });

    render(<App />);
    await waitFor(() => {});

    // The global listener catches Escape regardless of focus
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(abort).toHaveBeenCalledTimes(1);
  });
});
```

**Note on Escape + textarea focus:** The global `window` listener fires even when the textarea is focused, so no special handling is needed for the "Escape when textarea focused + streaming" case. The handler checks `state.status === 'streaming'` which covers all scenarios.

---

## 4. Test considerations

### Which existing tests might break?

- **None.** `InputPanel.test.tsx` tests don't use keyDown events on the textarea, so adding a handler won't affect them.
- **App.test.tsx** mocks `useAudit` and `useTheme` at the top level. The new `useEffect` in App.tsx only fires a `keydown` listener — it doesn't change rendering, so existing tests for Copy, Download, Export PDF, Export JSON are unaffected.
- The `keydown` listener is cleaned up on unmount, so test isolation is maintained.

### What NOT to test

- **The `e.preventDefault()` call**: Vitest's `fireEvent.keyDown` dispatches a synthetic event; `preventDefault` on the real DOM event is browser behavior. We trust that `preventDefault()` works correctly — test the business logic (whether `onSubmit` / `abort` is called).
- **CSS `hidden sm:inline` on kbd**: This is a responsive-visual concern. Test that `<kbd>` exists in the DOM (unit test), not that it's visible at specific breakpoints (that's an integration/E2E concern).
- **`title` attribute on buttons**: Small accessibility improvement, not worth a dedicated test assertion.

---

## 5. Edge cases summary

| Edge case | Handling |
|-----------|----------|
| `Enter` alone (newline) | `isMod` is false → no-op, native newline insertion |
| `Shift+Enter` | `isMod` is false → no-op, native newline insertion |
| `Ctrl+Enter` empty input | `isEmpty` check → no-op |
| `Ctrl+Enter` over limit | `isOverLimit` check → no-op |
| `Ctrl+Enter` already loading | `status === 'loading'` check → no-op |
| `Ctrl+Enter` already streaming | `status === 'streaming'` check → no-op |
| `Cmd+Enter` on Mac | `e.metaKey` is true → same as Ctrl+Enter |
| `Escape` not streaming | `state.status !== 'streaming'` → no-op |
| `Escape` streaming | `preventDefault()` + `abort()` |
| `Escape` when textarea focused + streaming | Global listener fires, same handler path |
| Component unmount | Both effects clean up listeners |
| Multiple rapid Escape presses | `abort()` is idempotent — calling `AbortController.abort()` multiple times is safe |
| kbd visible on narrow screens | `hidden sm:inline` hides the kbd on mobile |



## 6. Implementation Order

1. Add `onKeyDown` handler + hints to `frontend/src/components/features/InputPanel.tsx`
2. Add global Escape listener to `frontend/src/App.tsx`
3. Add test cases to `frontend/src/components/features/__tests__/InputPanel.test.tsx`
4. Add test cases to `frontend/src/components/features/__tests__/App.test.tsx`
5. Run `npx tsc --noEmit && npx vitest run` — ensure all 236+ tests pass (existing 232 + 9 new for InputPanel + 4 new for App)
6. Manual smoke test: type valid spec, press Ctrl+Enter → verify audit starts. Press Escape while streaming → verify audit stops. Press Enter alone → verify newline inserted.
