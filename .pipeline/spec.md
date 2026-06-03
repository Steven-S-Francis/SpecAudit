# Code Review Fixes — Spec v3 (Findings 1–3)

## OPEN QUESTIONS

**Q1 (Finding 1 — Bash permission ordering):** OpenCode's bash permission matching is unclear on whether it uses exact match, prefix match, or glob match, and whether JSON key ordering matters. The proposed config lists general patterns (`"npx": "allow"`, `"node": "allow"`) alongside more specific ones (`"npx tsc --noEmit": "allow"`, `"npx vitest run": "allow"`). If OpenCode matches by prefix and processes in any order, `"npx": "allow"` would already allow `npx tsc --noEmit` before the more specific rule is reached. The implementer should check OpenCode docs or test empirically. If the matching is prefix-based with first-match-wins, the specific patterns should be listed before the general ones AND the general ones should be omitted (since they'd already cover everything). If matching is exact-string, then all patterns are needed and redundant general patterns can simply be removed. Resolution: remove `"node": "allow"` and `"npx": "allow"` and only keep the explicit command allowlist, unless OpenCode requires prefix matching — in which case keep all of them ordered specific-first. See `.opencode/agents/ship.md` for the existing `"git *": "allow"` pattern (prefix/glob matching) which suggests OpenCode does prefix matching.

**Q2 (Finding 3 — `window.matchMedia` availability in test environment):** The jsdom test environment used by vitest may not support `window.matchMedia`. The implementer should either (a) mock `window.matchMedia` in the test, or (b) guard the call with a try-catch or typeof check. The spec below assumes (a) with a Vitest setup file or inline mock. Confirm approach with the team.

---

## Overview

Three independent fixes from a code review. They do not touch the same files and can be applied in any order.

| # | Finding | Theme | Files touched |
|---|---------|-------|---------------|
| 1 | Build agent bash bypasses permission model | Security (permissions) | `.opencode/opencode.json` |
| 2 | JSON export fallback serializes raw markdown with ```json fence | Bug (data integrity) | `frontend/src/App.tsx` |
| 3 | Dark mode ignores OS-level `prefers-color-scheme` | Accessibility (WCAG) | `frontend/src/hooks/useTheme.ts` |

---

## Finding 1 — Build agent bash bypasses permission model

**Problem:** The `build` agent in `.opencode/opencode.json` has `"bash": { "*": "allow" }` — unrestricted shell access. This makes the `write: deny` and `edit: deny` rules on `.pipeline/spec.md` trivially bypassable (agent can run `echo "content" > .pipeline/spec.md` via bash).

**File:** `.opencode/opencode.json`

**Changes:**

Replace the entire `"bash"` block inside the `build` agent's `permission` object (lines 20–22):

```json
"bash": {
  "*": "deny",
  "dotnet build": "allow",
  "dotnet test": "allow",
  "dotnet restore": "allow",
  "npm run build": "allow",
  "npm run test": "allow",
  "npx tsc --noEmit": "allow",
  "npx vitest run": "allow"
}
```

Note: `"node": "allow"` and standalone `"npx": "allow"` are intentionally **omitted** from the allowlist. The build agent's prompt (in the same file) already invokes commands like `npx tsc --noEmit` and `dotnet build` explicitly. The agent never runs arbitrary `node` scripts or bare `npx` without a subcommand. If OpenCode requires prefix matching (see OPEN QUESTION Q1), the implementer should test with just the explicit commands above first, and only add broader patterns if the explicit ones fail in practice.

**Edge cases:**
- If OpenCode's permission system uses **exact string matching**, `"dotnet build"` must match the exact command string. The build agent's prompt uses `dotnet build` (no extra flags), so this is fine.
- If OpenCode uses **prefix matching**, `"dotnet build"` would also match `dotnet build --project Foo.csproj`. Verify this is acceptable (it is — allowing all `dotnet build` variants is safe).
- Commands not in the allowlist (e.g., `rm`, `curl`, `python`, `cat`, `echo`, `git`) are denied.
- The `"*": "deny"` catch-all ensures any unlisted command is blocked.

---

## Finding 2 — JSON export fallback serializes raw markdown with ```json fence

**Problem:** In `handleExportJson` (line 66), the fallback path `auditResult.result = state.result` uses the raw AI stream content which still contains the trailing ` ```json...``` ` code fence. Every other consumer (copy, download, PDF export, ResultPanel display) uses `strippedResult` which strips this fence via regex on line 19.

**File:** `frontend/src/App.tsx`

**Changes:**

1. **Line 66** — Change the fallback assignment to use `strippedResult`:
   ```typescript
   // Before:
   auditResult.result = state.result;

   // After:
   auditResult.result = strippedResult;
   ```

2. **Line 81** — Update the `useCallback` dependency array to use `strippedResult` instead of `state.result`:
   ```typescript
   // Before:
   }, [state.result, state.findings, state.summary, state.specFormat]);

   // After:
   }, [strippedResult, state.findings, state.summary, state.specFormat]);
   ```

   This is necessary because:
   - `handleExportJson` now references `strippedResult` (not `state.result`)
   - React's exhaustive-deps lint rule requires all captured variables to be in the deps array
   - `strippedResult` is a derived value from `state.result`, so replacing `state.result` with `strippedResult` in deps is correct

**No other changes in this file.** The `handleCopy`, `handleDownload`, `handleExportPdf` callbacks already use `strippedResult` correctly.

**Edge cases:**
- `state.result` is empty string → `strippedResult` is also empty string, `auditResult.result` is empty string → `JSON.stringify` produces `"result": ""` — same behavior as before
- `state.result` has no ` ```json ` fence → `strippedResult` is same as `state.result` (regex doesn't match) → behavior identical to before
- `state.result` has multiple ` ```json ` fences → regex with `$` anchor matches only the last trailing one → `strippedResult` correctly removes only the terminal fence
- `auditResult.result` remains optional (`result?: string` in the `AuditResult` type), so setting it to an empty string is valid
- The `findings.length === 0 && state.summary === null` guard is unchanged — the fix only changes what value is assigned

---

## Finding 3 — Dark mode ignores OS-level `prefers-color-scheme`

**Problem:** `useTheme.ts` defaults to `'dark'` unconditionally. Users with OS-level light mode are forced into dark until they manually toggle. This violates WCAG Success Criterion 1.4.1 (Use of Color) and the general principle of respecting user preferences.

**File:** `frontend/src/hooks/useTheme.ts`

**Changes to the `useTheme` function:**

1. **Replace the `useState` initializer** (lines 6–14) to check `window.matchMedia` before falling back to `'dark'`:

```typescript
const [theme, setTheme] = useState<Theme>(() => {
  try {
    const stored = localStorage.getItem('specaudit-theme');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage unavailable (SSR, privacy mode)
  }
  // Respect OS-level preference before defaulting to dark
  try {
    if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
  } catch {
    // matchMedia unavailable (SSR, older browsers)
  }
  return 'dark';
});
```

2. **The `useEffect` and `toggle` functions stay exactly the same** (lines 16–27). No changes needed.

3. **No changes to `frontend/src/index.css`.** The `@custom-variant light (&:where(.light, .light *))` approach already works correctly regardless of which theme is the default.

**Edge cases:**
- **No localStorage and no `matchMedia` support** (SSR, very old browser): falls through both try-catch blocks → returns `'dark'` (safe default)
- **No localStorage, `matchMedia` returns `false` for both dark and light** (OS has no preference, or `matchMedia` returns a `MediaQueryList` with `matches: false`): falls through to `return 'dark'` — correct, dark is the app's default
- **No localStorage, OS set to light mode**: `window.matchMedia('(prefers-color-scheme: light)').matches` is `true` → returns `'light'`
- **No localStorage, OS set to dark mode**: `window.matchMedia('(prefers-color-scheme: dark)').matches` would also be true, but we check light first. If light is false, falls through → returns `'dark'`. Correct.
- **User has manually set a preference in localStorage**: always takes priority over `matchMedia` — the explicit user choice wins
- **`matchMedia` throws** (some test environments): caught by try-catch, falls through to `return 'dark'`
- **`localStorage.setItem` throws in the useEffect** (privacy mode): already caught by existing try-catch on lines 19–22 — no change needed

---

## Test Requirements

### Finding 1 — Build agent permissions

**No new tests needed.** The change is to configuration only. Verify by:
- Confirming the JSON is valid (run through a JSON parser)
- Checking that the existing build agent still works by running the pipeline (manual smoke test)

The implementer should also verify there are no other agents with `"bash": { "*": "allow" }` in `.opencode/opencode.json` or `.opencode/agents/*.md`.

### Finding 2 — JSON export stripped result

**Update existing test file** `frontend/src/__tests__/integration/feature-pipeline.test.ts` or add a focused test in a new location:

**Option A:** Add a test in `frontend/src/components/features/__tests__/App.test.tsx`:
- Test: "handleExportJson uses stripped result when no structured findings"
  - Render `App`, set state with `result` containing a trailing ` ```json{"key":"value"}``` ` block and empty `findings`/`summary`
  - Trigger `handleExportJson` (via button click)
  - Intercept `JSON.stringify` or assert on the download blob content
  - Verify the exported JSON's `result` field does NOT contain the ` ```json ` fence

**Option B:** Add a unit test directly in `frontend/src/__tests__/App.test.tsx` or the existing integration test file.

The key assertion: `JSON.parse(blobText).result` should NOT contain ` ```json `.

### Finding 3 — OS-level prefers-color-scheme

**Update existing test file:** `frontend/src/hooks/__tests__/useTheme.test.tsx`

1. **Update the `"defaults to dark theme"` test** to set up `window.matchMedia` to return `matches: false` for both light and dark before asserting dark:
   ```typescript
   it('defaults to dark theme when no OS preference', () => {
     window.matchMedia = vi.fn().mockImplementation((query: string) => ({
       matches: query === '(prefers-color-scheme: dark)', // dark: true, light: false
       media: query,
       onchange: null,
       addListener: vi.fn(),
       removeListener: vi.fn(),
       addEventListener: vi.fn(),
       removeEventListener: vi.fn(),
       dispatchEvent: vi.fn(),
     }));
     const { result } = renderHook(() => useTheme());
     expect(result.current.theme).toBe('dark');
   });
   ```

2. **Add a new test:** `"defaults to light theme when OS prefers light mode"`:
   ```typescript
   it('defaults to light theme when OS prefers light mode', () => {
     window.matchMedia = vi.fn().mockImplementation((query: string) => ({
       matches: query === '(prefers-color-scheme: light)',
       media: query,
       onchange: null,
       addListener: vi.fn(),
       removeListener: vi.fn(),
       addEventListener: vi.fn(),
       removeEventListener: vi.fn(),
       dispatchEvent: vi.fn(),
     }));
     const { result } = renderHook(() => useTheme());
     expect(result.current.theme).toBe('light');
   });
   ```

3. **Add a new test:** `"localStorage preference overrides OS preference"`:
   ```typescript
   it('localStorage preference overrides OS preference', () => {
     localStorage.setItem('specaudit-theme', 'light');
     window.matchMedia = vi.fn().mockImplementation(() => ({
       matches: false, // OS prefers dark
       ...
     }));
     const { result } = renderHook(() => useTheme());
     expect(result.current.theme).toBe('light');
   });
   ```

4. **Update the `beforeEach`** to reset `window.matchMedia` mocks if using `vi.fn()`.

**Implementation note:** The test file currently uses `@vitest-environment jsdom`. The `window.matchMedia` mock must be set up **before** `renderHook` is called for the "defaults to light" test. Use `vi.fn().mockImplementation()` in the test body, or use a `beforeEach`/`beforeAll` setup.

---

## Commit Strategy

**Single commit** for all 3 findings — they are independent with no overlapping files:

| Message | Files |
|---------|-------|
| `fix: restrict build agent bash to allowlist; fix JSON export stripped result; respect prefers-color-scheme for theme default` | `.opencode/opencode.json`, `frontend/src/App.tsx`, `frontend/src/hooks/useTheme.ts`, `frontend/src/hooks/__tests__/useTheme.test.tsx`, `+ optional test additions for Finding 2` |

**Commit order within the single commit**: apply in any order. No merge conflicts between the three files.

---

## Files Summary

| Action | Path | Finding |
|--------|------|---------|
| MODIFY | `.opencode/opencode.json` | 1 |
| MODIFY | `frontend/src/App.tsx` | 2 |
| MODIFY | `frontend/src/hooks/useTheme.ts` | 3 |
| MODIFY | `frontend/src/hooks/__tests__/useTheme.test.tsx` | 3 (tests) |
| CREATE/MODIFY | `frontend/src/__tests__/App.test.tsx` or `frontend/src/components/features/__tests__/App.test.tsx` | 2 (tests) — if adding tests |

**Total: 3–5 files touched (3 source, 0–2 test).**
