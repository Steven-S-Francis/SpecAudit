# Toast / Snackbar Notification System

## OPEN QUESTIONS

1. **Context vs. Props**: The existing codebase does not use React context — everything is passed as props. For toast, should we introduce a `ToastProvider` + `useToastContext` (extensible, avoids prop-drilling if other components need toasts later), or keep `useToast` as a local hook in `App.tsx` and wire `addToast` into handlers directly? **Recommendation: Use a lightweight `ToastProvider` context** so that any component can call `addToast` without prop-drilling. This is the standard pattern for toast systems in React.
2. **Debounce threshold**: Exact debounce window for duplicate messages — **propose 2000ms** (matching the existing `setCopied` timeout pattern in `App.tsx`). Confirm if acceptable.

---

## Files to Create or Modify

| Action | Path |
|--------|------|
| **CREATE** | `frontend/src/hooks/useToast.ts` — hook + context provider |
| **CREATE** | `frontend/src/components/ui/ToastContainer.tsx` — rendering component |
| **MODIFY** | `frontend/src/App.tsx` — add `<ToastProvider>`, `<ToastContainer>`, wire into handlers |
| **CREATE** | `frontend/src/hooks/__tests__/useToast.test.tsx` — hook tests |
| **CREATE** | `frontend/src/components/ui/__tests__/ToastContainer.test.tsx` — component tests |

---

## 1. `frontend/src/hooks/useToast.ts` — Hook + Provider

### Exports

```ts
// --- Types ---

type ToastType = 'info' | 'success' | 'warning' | 'error';

type Toast = {
  id: string;           // crypto.randomUUID()
  message: string;
  type: ToastType;
  duration: number;     // ms; 0 = persistent
  timestamp: number;    // Date.now()
};

type AddToast = (message: string, type?: ToastType, duration?: number) => void;

// --- Hook ---
function useToast(): {
  toasts: Toast[];
  addToast: AddToast;
  dismissToast: (id: string) => void;
}

// --- Provider ---
function ToastProvider({ children }: { children: React.ReactNode }): JSX.Element;

// --- Context consumer ---
function useToastContext(): {
  toasts: Toast[];
  addToast: AddToast;
  dismissToast: (id: string) => void;
}
```

### Behaviour

- `useToast()` is the **internal** hook (used by `ToastProvider` and directly in `App.tsx` if context is deemed unnecessary).
- `useToastContext()` is the public consumer — throws if used outside `<ToastProvider>`.
- `addToast(message, type?, duration?)`:
  - Generates `id` via `crypto.randomUUID()`.
  - Sets `timestamp = Date.now()`.
  - **Debounce**: If the same `message` string was added within the last 2000ms, skip silently (do not add duplicate).
  - Enforces **max 3 visible** toasts: after adding, if `toasts.length > 3`, dismiss the oldest (lowest timestamp) by removing it from the queue.
  - If `duration` is 0, the toast is *persistent* — never auto-dismissed.
  - If `duration` is omitted, defaults to **4000ms**.
  - When `duration > 0`, sets a `setTimeout` to auto-dismiss after `duration` ms.
  - Returns the generated `id` (for potential programmatic dismissal).
- `dismissToast(id)`:
  - Removes the toast with matching `id` from the queue.
  - Clears the associated timeout if one exists.
- Cleanup: on unmount, all pending timeouts are cleared.

### Edge cases

| Scenario | Behaviour |
|----------|-----------|
| Duplicate message within 2s | Silently dropped; no duplicate toast |
| >3 toasts added rapidly | Oldest dismissed first (by timestamp) |
| `duration: 0` | Persistent — never auto-dismissed; must be manually dismissed |
| Component unmount with active toasts | All timeouts cleared; no memory leak |
| `crypto.randomUUID()` unavailable | Fallback: `Date.now().toString(36) + Math.random().toString(36).slice(2)` |

---

## 2. `frontend/src/components/ui/ToastContainer.tsx`

### Exports

```ts
function ToastContainer(): JSX.Element | null;
```

### Behaviour

- Reads `toasts` and `dismissToast` from `useToastContext()`.
- Renders **only** when `toasts.length > 0`; otherwise returns `null`.
- Container element:
  - `<div>` with classes: `fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none`
  - `role="alert"` and `aria-live="polite"` for accessibility.
  - `pointer-events-none` so clicks pass through the container; individual toasts have `pointer-events-auto`.
- Each toast:
  - `<div>` with:
    - Colored left border via `border-l-4`:
      - `success` → `border-l-emerald-500`
      - `error` → `border-l-red-500`
      - `warning` → `border-l-amber-500`
      - `info` → `border-l-blue-500`
    - Background: `bg-slate-800` dark / `light:bg-white` light
    - Text: `text-slate-200` dark / `light:text-slate-800` light
    - Border: `border border-slate-700` dark / `light:border-slate-300` light
    - Rounded: `rounded-lg`
    - Shadow: `shadow-xl`
    - Padding: `p-3 pr-10` (leave room for close button)
    - `pointer-events-auto`
    - Close button: `<button>` absolutely positioned `top-2 right-2`, text `×`, `text-slate-400 hover:text-slate-200` dark / `light:text-slate-500 light:hover:text-slate-700` light, `aria-label="Dismiss"`
  - **Animation**: Use CSS `@keyframes` (defined in a `<style>` tag or via Tailwind arbitrary values):
    - Slide in from right: `translate-x-full → translate-x-0` over 200ms ease-out.
    - On dismiss: immediately removed from array (state-driven removal).
    - Use a CSS transition on `opacity` and `transform` for smooth exit? **Simpler**: just remove from state — React's reconciliation will unmount the element. If smoother exit is desired, implement a `leaving` state with 150ms fade-out before actual removal.
    - **Proposed**: Keep it simple — instant removal on dismiss. Slide-in only on appear via `@starting-style` or a brief `animate-[slideIn_200ms_ease-out]` utility.

  ### Animation (detail)

  Add a `<style>` block with:
  ```css
  @keyframes toast-slide-in {
    from { transform: translateX(100%); opacity: 0; }
    to   { transform: translateX(0); opacity: 1; }
  }
  .animate-toast-in {
    animation: toast-slide-in 200ms ease-out;
  }
  ```
  Apply `animate-toast-in` to each rendered toast `<div>`.

---

## 3. `frontend/src/App.tsx` — Modifications

### Changes

1. **Wrap root content** with `<ToastProvider>`:
   ```tsx
   // Near top-level return
   return (
     <ToastProvider>
       <div className="min-h-screen ...">
         {/* existing content */}
         <ToastContainer />   {/* add near end of root div */}
       </div>
     </ToastProvider>
   );
   ```
2. **Add `addToast` import** from `'./hooks/useToast'` (or use `useToastContext` inside App if it's inside the provider).
   - Simplest: Inside App (which is rendered under `<ToastProvider>`), call `const { addToast } = useToastContext()`.
3. **Wire the handlers:**

   **`handleCopy`** — add `addToast('Copied to clipboard', 'success')` after successful copy. Keep existing `setCopied(true); setTimeout(...)` for the button label feedback; toast is additive.
   ```
   // After await navigator.clipboard.writeText(...)
   addToast('Copied to clipboard', 'success');
   ```

   **`handleDownload`** — add `addToast('Report downloaded', 'success')` after successful download.
   ```
   // After URL.revokeObjectURL(url)
   addToast('Report downloaded', 'success');
   ```

   **`handleExportPdf`** — add `addToast('PDF exported', 'success')` after successful export.
   ```
   // After await exportPdf(...)
   addToast('PDF exported', 'success');
   ```
   Also add a `catch` block that calls `addToast('PDF export failed', 'error')`.

   **`handleExportJson`** — add `addToast('JSON exported', 'success')` after successful export.
   ```
   // After URL.revokeObjectURL(url)
   addToast('JSON exported', 'success');
   ```
   Also add a `catch` block that calls `addToast('JSON export failed', 'error')`.

4. **Audit error toast** — add a `useEffect` that watches `state.status === 'error'`:
   ```tsx
   useEffect(() => {
     if (state.status === 'error' && state.error) {
       addToast(state.error, 'error', 0); // persistent until dismissed
     }
   }, [state.status]); // only fire on status change, not on every render
   ```

---

## 4. `frontend/src/hooks/__tests__/useToast.test.tsx`

### Test cases (follow pattern from `useTheme.test.tsx`)

```
describe('useToast')
  ├── it('starts with empty toast queue')
  ├── it('adds a toast with default type (info) and duration (4000ms)')
  ├── it('adds a toast with custom type and duration')
  ├── it('dismisses a toast by id')
  ├── it('auto-dismisses a toast after duration expires')
  ├── it('does NOT auto-dismiss a persistent toast (duration: 0)')
  ├── it('debounces duplicate messages within 2s window')
  ├── it('allows same message after debounce window expires')
  ├── it('enforces max 3 visible toasts — oldest dismissed first')
  ├── it('allows maximum 3 toasts when they have unique messages')
  └── it('clears all timeouts on unmount')
```

Use `vi.useFakeTimers()` for timeout tests. Use `renderHook` from `@testing-library/react`.

---

## 5. `frontend/src/components/ui/__tests__/ToastContainer.test.tsx`

### Test cases (follow pattern from `Button.test.tsx`)

```
describe('ToastContainer')
  ├── it('renders nothing when toasts queue is empty')
  ├── it('renders a single toast with message and type class')
  ├── it('renders multiple toasts stacked')
  ├── it('renders correct border color per type')
  ├── it('dismisses toast when close button is clicked')
  ├── it('has role="alert" and aria-live="polite" accessibility attributes')
  └── it('renders persistent toast without auto-dismiss indicator')
```

Wrap `<ToastContainer />` in a `<ToastProvider>` for tests. Use `render`, `screen`, `fireEvent` from `@testing-library/react`. Access `addToast` via a small helper component or by rendering the provider and using `renderHook` in a coordinated way.

---

## Implementation Notes

- **Follow existing patterns**:
  - Named exports (no default exports).
  - Props type defined as local `type Props = ...` (see `Card.tsx` for reference).
  - Tailwind v4 class ordering: functional classes then color/size, as seen in `Button.tsx`.
  - Dark mode via `light:` prefix (matching `.light` class toggled on `<html>` by `useTheme`).
- **No additional dependencies** — use `crypto.randomUUID()` (available in all modern browsers); fallback for older environments.
- **No backend changes.**
- **No layout shift** — `fixed bottom-4 right-4` removes from document flow entirely.
- **Streaming** — toasts are absolutely positioned, so they never block or shift audit result content while streaming.

## Verification

1. `cd frontend && npm run build` — 0 errors.
2. `cd frontend && npm test` — all tests pass.
3. Manual: trigger copy, download, export PDF, export JSON — toast appears, auto-dismisses after ~4s.
4. Manual: trigger audit that errors — persistent error toast appears with the error message, dismissible via X button.
