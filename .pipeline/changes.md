# Changes Summary

## Overview
Implemented a Toast/snackbar notification system with context provider, rendering component, and full integration into App.tsx.

## Files Created

### `frontend/src/hooks/useToast.tsx` — Hook + Context Provider
- Exports types: `ToastType`, `Toast`, `AddToast`
- Exports `useToast()` — internal hook managing the toast queue with `useState` + `useRef`
- Exports `ToastProvider` — context provider wrapping children with `ToastContext.Provider`
- Exports `useToastContext()` — public consumer that throws if used outside `<ToastProvider>`
- Behaviour:
  - `addToast(message, type?, duration?)`: generates ID via `crypto.randomUUID()` (fallback: `Date.now().toString(36) + Math.random().toString(36).slice(2)`), debounces duplicates within 2000ms, enforces max 3 visible (oldest dismissed), auto-dismisses via `setTimeout` when `duration > 0`
  - `dismissToast(id)`: removes toast, clears its timeout
  - Cleanup all timeouts on unmount via `useEffect` return
- Re-export shim at `frontend/src/hooks/useToast.ts` (`.ts` → `.tsx` bridge for import compatibility)

### `frontend/src/components/ui/ToastContainer.tsx` — Toast Rendering Component
- Reads `toasts` and `dismissToast` from `useToastContext()`
- Returns `null` when no toasts
- Container: `fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none`, `role="alert"`, `aria-live="polite"`
- Each toast `<div>`:
  - Colored left border: `border-l-emerald-500` (success), `border-l-red-500` (error), `border-l-amber-500` (warning), `border-l-blue-500` (info)
  - Dark: `bg-slate-800 text-slate-200 border border-slate-700`
  - Light: `light:bg-white light:text-slate-800 light:border-slate-300`
  - `rounded-lg shadow-xl p-3 pr-10 pointer-events-auto relative`
  - Close button: absolute `top-2 right-2`, `aria-label="Dismiss"`, content `×`
- Slide-in animation via `<style>` block with `@keyframes toast-slide-in` (200ms ease-out)

### `frontend/src/hooks/__tests__/useToast.test.tsx` — Hook Tests (11 tests)
- starts with empty toast queue
- adds a toast with default type (info) and duration (4000ms)
- adds a toast with custom type and duration
- dismisses a toast by id
- auto-dismisses a toast after duration expires
- does NOT auto-dismiss a persistent toast (duration: 0)
- debounces duplicate messages within 2s window
- allows same message after debounce window expires
- enforces max 3 visible toasts — oldest dismissed first
- allows maximum 3 toasts when they have unique messages
- clears all timeouts on unmount

### `frontend/src/components/ui/__tests__/ToastContainer.test.tsx` — Component Tests (7 tests)
- renders nothing when toasts queue is empty
- renders a single toast with message and type class
- renders multiple toasts stacked
- renders correct border color per type
- dismisses toast when close button is clicked
- has `role="alert"` and `aria-live="polite"` accessibility attributes
- renders persistent toast without auto-dismiss indicator

## Files Modified

### `frontend/src/App.tsx`
- Added imports: `ToastContainer`, `ToastProvider`, `useToastContext`
- Refactored `App` into `App` (provider wrapper) + `AppContent` (consumer) to avoid rendering `<ToastProvider>` inside the same component that consumes its context
- Added `const { addToast } = useToastContext()` inside `AppContent`
- Wired `addToast` into:
  - `handleCopy`: `addToast('Copied to clipboard', 'success')` after successful copy
  - `handleDownload`: `addToast('Report downloaded', 'success')` after download
  - `handleExportPdf`: `addToast('PDF exported', 'success')` after success, `addToast('PDF export failed', 'error')` in catch
  - `handleExportJson`: `addToast('JSON exported', 'success')` after success, `addToast('JSON export failed', 'error')` in catch
- Added `useEffect` for audit errors: shows persistent error toast when `state.status === 'error'`
- Wrapped root content in `<ToastProvider>`, added `<ToastContainer />` near end of root `<div>`

## Verification
- `npx tsc --noEmit` — 0 errors
- `npm run build` — builds successfully (550 modules, 0 errors)
- `npx vitest run` — 298 tests pass across 21 test files (including 18 new tests)
