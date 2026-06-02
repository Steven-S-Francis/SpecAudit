# SpecAudit: Dark Mode Toggle (Light Theme)

## Feature Summary

Add a sun/moon toggle button in the header that switches the app between the existing dark theme and a new light theme. Preference persists in `localStorage`.

## Architecture

| Layer | File | What |
|-------|------|------|
| CSS variant | `frontend/src/index.css` | Add `@custom-variant light` |
| Theme hook | `frontend/src/hooks/useTheme.ts` | State, toggle, localStorage, `<html>` class |
| Toggle UI | `frontend/src/components/ui/ThemeToggle.tsx` | Sun/moon SVG button |
| Theme wiring | `frontend/src/App.tsx` | Use hook, add toggle in header, `light:` classes |
| Components | 4 modified files | Add `light:` variants for light mode colors |

## Files to Create

### 1. `frontend/src/hooks/useTheme.ts`

```tsx
import { useCallback, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem('specaudit-theme');
      if (stored === 'light' || stored === 'dark') return stored;
    } catch {
      // localStorage unavailable (SSR, privacy mode)
    }
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    try {
      localStorage.setItem('specaudit-theme', theme);
    } catch {
      // localStorage unavailable
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme(t => t === 'dark' ? 'light' : 'dark');
  }, []);

  return { theme, toggle };
}
```

### 2. `frontend/src/components/ui/ThemeToggle.tsx`

```tsx
interface Props {
  theme: 'dark' | 'light';
  onToggle: () => void;
}

export function ThemeToggle({ theme, onToggle }: Props) {
  return (
    <button
      onClick={onToggle}
      className="text-slate-400 hover:text-slate-200 transition-colors light:text-slate-500 light:hover:text-slate-700"
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? (
        /* Sun icon - shown in dark mode, clicking switches to light */
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        /* Moon icon - shown in light mode, clicking switches to dark */
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
```

## Files to Modify

### 3. `frontend/src/index.css`

Add the `@custom-variant` directive after the Tailwind import:
```css
@import "tailwindcss";

@custom-variant light (&:where(.light, .light *));
```

### 4. `frontend/src/App.tsx`

Changes:
- Import `useTheme` from `./hooks/useTheme`
- Import `ThemeToggle` from `./components/ui/ThemeToggle`
- Call `const { theme, toggle } = useTheme();` inside `App` body
- Add `<ThemeToggle>` in the header's right side (next to provider badge)
- Add `light:` variant classes to key elements:

| Current class | Add `light:` variant |
|---|---|
| `min-h-screen bg-slate-950 text-slate-200 p-6 lg:p-10` | `light:bg-white light:text-slate-800` |
| `text-slate-100` (h1) | `light:text-slate-900` |
| `text-slate-400` (subtitle) | `light:text-slate-500` |
| `text-slate-500 bg-slate-900 border border-slate-800` (badge) | `light:text-slate-600 light:bg-slate-100 light:border-slate-300` |
| `text-slate-300` (h2 heading) | `light:text-slate-700` |
| `border-red-800 bg-red-950/20` (error card) | `light:border-red-200 light:bg-red-50` |
| `text-red-400` (error text) | `light:text-red-600` |

### 5. `frontend/src/components/ui/Button.tsx`

Add `light:` variant to the `ghost` variant style:
```
'ghost': 'border border-slate-600 hover:border-slate-400 text-slate-300 light:border-slate-300 light:hover:border-slate-400 light:text-slate-600'
```

### 6. `frontend/src/components/ui/Card.tsx`

Add `light:` variant classes to the wrapper:
```
bg-slate-900 border border-slate-800 rounded-xl p-6
  ↓
bg-slate-900 border border-slate-800 rounded-xl p-6 light:bg-white light:border-slate-200
```

### 7. `frontend/src/components/features/InputPanel.tsx`

Add `light:` variant classes:

| Current | Add |
|---------|-----|
| `bg-slate-950 border border-slate-700 rounded-lg p-4 text-slate-200` (textarea) | `light:bg-white light:border-slate-300 light:text-slate-800` |
| `text-slate-400` (char counter) | `light:text-slate-500` |

### 8. `frontend/src/components/features/ResultPanel.tsx`

Add `light:` variant classes:

| Current | Add |
|---------|-----|
| `text-slate-200` (outer div) | `light:text-slate-800` |
| `text-slate-100` (h3 default) | `light:text-slate-900` |
| `bg-slate-900 border border-slate-700 text-slate-300` (code block) | `light:bg-slate-100 light:border-slate-300 light:text-slate-600` |
| `bg-slate-800 text-amber-300` (inline code) | `light:bg-slate-200 light:text-amber-700` |
| `border-slate-700` (hr) | `light:border-slate-300` |
| `text-slate-400` (paragraph) | `light:text-slate-500` |
| `bg-slate-800 animate-pulse` (skeleton) | `light:bg-slate-200` |
| `bg-slate-400 animate-pulse` (blinking cursor) | `light:bg-slate-500` |
| `bg-red-950/40` (CRITICAL wrapper) | `light:bg-red-50` |
| `text-red-300` (CRITICAL label) | `light:text-red-600` |
| `bg-amber-950/40` (WARNING wrapper) | `light:bg-amber-50` |
| `text-amber-300` (WARNING label) | `light:text-amber-600` |
| `bg-blue-950/40` (INFO wrapper) | `light:bg-blue-50` |
| `text-blue-300` (INFO label) | `light:text-blue-600` |

## Tests

### 9. `frontend/src/hooks/__tests__/useTheme.test.tsx` (new)

4 tests:

| Test | What it verifies |
|------|-----------------|
| `defaults to dark theme` | theme is 'dark' on first render |
| `toggle switches to light and back` | toggle() flips, toggle() again flips back |
| `persists to localStorage` | After toggle, localStorage.getItem('specaudit-theme') === 'light' |
| `applies light class to html element` | document.documentElement has .light when theme='light' |

Use `renderHook` from `@testing-library/react`.

Mock `localStorage`:
```ts
beforeEach(() => {
  localStorage.clear();
});
```

### 10. `frontend/src/components/ui/__tests__/ThemeToggle.test.tsx` (new)

3 tests:

| Test | What it verifies |
|------|-----------------|
| `renders sun icon in dark mode` | SVG with circle element present |
| `renders moon icon in light mode` | SVG with path d="M21..." present |
| `calls onToggle on click` | fireEvent.click triggers the callback |

### 11. Update `frontend/src/components/features/__tests__/App.test.tsx`

Add 1 test: `renders theme toggle button in header` — verify the toggle button (by aria-label) is present.

## Completion Criteria

- [ ] `npm run build` — zero TypeScript errors
- [ ] `npm run test -- --run` — all existing + new tests pass (expect 55 → 63 total)
- [ ] `dotnet test SpecAudit.slnx` — backend tests still pass
- [ ] Click sun icon → page switches to light (white bg, dark text)
- [ ] Click moon icon → page switches back to dark
- [ ] Refresh page → preference persists from localStorage
- [ ] Audit results render correctly in both themes
- [ ] All severity badges (CRITICAL/WARNING/INFO) visible in light mode
