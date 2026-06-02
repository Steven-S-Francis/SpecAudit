# SpecAudit: Copy to Clipboard Button

## Feature Summary

Add a "Copy" button next to the "Audit Results" heading in `App.tsx` that copies the full audit report to the system clipboard. Provide brief "Copied!" visual feedback.

## Files to Modify

### 1. `frontend/src/components/ui/Button.tsx` — Add `size` prop

Add an optional `size` prop to the existing `Props` type:

```tsx
size?: 'sm' | 'md';  // default: 'md'
```

**Size styles:**

| Size | Classes |
|------|---------|
| `sm` | `px-2 py-1 text-xs` |
| `md` | `px-4 py-2 text-sm` *(existing, unchanged)* |

**Implementation:**
```tsx
export function Button({ variant, disabled, onClick, children, className = '', size = 'md' }: Props) {
  const sizeStyles = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-4 py-2 text-sm',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </button>
  );
}
```

### 2. `frontend/src/App.tsx` — Add Copy button

**What to add:**

1. Import `useCallback`, `useState` from React (add to existing `useEffect` import).
2. Import `Button` component (already used via `InputPanel`).
3. Add `copied` state and `handleCopy` handler inside `App`:
4. Add the Copy button in the "Audit Results" heading row.

**Copy handler logic:**
```tsx
const [copied, setCopied] = useState(false);

const handleCopy = useCallback(async () => {
  try {
    await navigator.clipboard.writeText(state.result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  } catch {
    // Clipboard API unavailable — silently ignore
  }
}, [state.result]);
```

**Button placement** — inside the `<h2>` flex container, after the `Spinner`:
```tsx
<h2 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
  Audit Results
  {state.status === 'loading' && <Spinner size="sm" />}
  {state.result && (
    <Button
      variant="ghost"
      size="sm"
      disabled={state.status === 'streaming'}
      onClick={handleCopy}
    >
      {copied ? 'Copied!' : 'Copy'}
    </Button>
  )}
</h2>
```

**Key behaviors:**

| Condition | Button state |
|-----------|-------------|
| `state.result === ''` (no audit yet) | Not rendered |
| `state.status === 'streaming'` | Rendered, `disabled={true}` |
| `state.status === 'complete'` or `'error'` | Rendered, enabled |
| After click | Shows "Copied!" for 2 seconds, then reverts to "Copy" |
| Clipboard API fails | Silently caught — no error displayed |

## Files to Create

### 3. `frontend/src/components/ui/__tests__/Button.test.tsx`

Three tests using `@testing-library/react`:

| Test | What it verifies |
|------|------------------|
| `renders with md size by default` | Default class includes `text-sm`, `px-4`, `py-2` |
| `renders with sm size when specified` | `size="sm"` produces `text-xs`, `px-2`, `py-1` |
| `renders with custom className merged` | `className="extra"` appears alongside base classes |

### 4. `frontend/src/components/features/__tests__/App.test.tsx`

Four tests using `@testing-library/react`:

| Test | What it verifies |
|------|------------------|
| `hides Copy button when result is empty` | No "Copy" text rendered initially |
| `shows Copy button when result is present` | After setting result, "Copy" appears |
| `disables Copy button when streaming` | `state.status === 'streaming'` → button `disabled` |
| `copies content and shows Copied feedback` | Click triggers `navigator.clipboard.writeText`, button text changes to "Copied!" |

**Clipboard mock pattern:**
```tsx
const writeText = vi.fn();
Object.assign(navigator, { clipboard: { writeText } });
```

Since `App.tsx` uses `fetch('/api/config')` on mount, the test setup may need to mock `fetch` as well (returning `{ providerName: 'Test' }`).

## Completion Criteria

- [ ] `npm run build` — zero TypeScript errors
- [ ] `npm run test -- --run` — all existing + new tests pass (expect 48 → 55 total)
- [ ] `dotnet test SpecAudit.slnx` — backend tests still pass
- [ ] Manual verification: Run an audit, see "Copy" button, click it, paste into a text editor — full report appears
- [ ] Button says "Copied!" for ~2 seconds after click, then reverts
- [ ] No "Copy" button visible before any audit is run
- [ ] Button is disabled during streaming
