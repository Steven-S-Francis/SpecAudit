# Permanent Fix for Docker Build Failure (TS2304: Cannot find name 'vi')

## OPEN QUESTION

**Q1 (nul file location):** The stray `nul` file (Windows reserved device name) has been reported in the project root. It cannot be found via glob right now, but it sporadically reappears. Should `nul` be added to the root `.gitignore` only, or also to `frontend/.gitignore` and `frontend/.dockerignore`? The implementer should check the actual working directory before merging and add `nul` to whatever `.gitignore` / `.dockerignore` files are relevant to the directory where the file appears.

---

## Overview

The Docker build (`npm run build` → `tsc -b && vite build`) fails because `tsconfig.app.json` includes `"include": ["src"]`, which pulls in all test files under `src/`. Test files use `vi` (vitest global), which is unavailable during `tsc -b` compilation. This is the same class of bug as the `declare module '*.md?raw'` issue that was previously fixed in `filterMarkdown.test.ts` (see `frontend/src/vite-env.d.ts`).

**Root cause:** `tsconfig.app.json` line 24: `"include": ["src"]` — no exclusion for test files. Test code is not app code and should not be type-checked by the app tsconfig.

**Fix summary:**
1. Exclude test files from `tsconfig.app.json` (permanent solution that prevents this class of bug for ALL future test files)
2. Add `import { vi } from 'vitest'` to `useTheme.test.tsx` (correct practice for self-contained tests)
3. Add `nul` to `.gitignore` (and optionally `.dockerignore`) to prevent stray Windows reserved-device-name files from breaking Docker builds

| # | Change | Type | Files touched |
|---|--------|------|---------------|
| 1 | Exclude test files from app tsconfig | Config fix | `frontend/tsconfig.app.json` |
| 2 | Add explicit `vi` import in test | Code hygiene | `frontend/src/hooks/__tests__/useTheme.test.tsx` |
| 3 | Gitignore stray `nul` file | Housekeeping | `.gitignore` (root), possibly `frontend/.gitignore`, `frontend/.dockerignore` |

---

## Fix 1 — Exclude test files from app tsconfig

**Problem:** `tsconfig.app.json` has `"include": ["src"]` which compiles ALL `.ts`/`.tsx` files under `src/`, including test files in `__tests__/` directories and `*.test.ts` / `*.test.tsx` files. These files use vitest globals (`vi`, `describe`, `it`, etc.) that are not available to `tsc -b`. The same issue will recur for any future test file that uses vitest-specific APIs.

**File:** `frontend/tsconfig.app.json`

**Changes:**

Add an `"exclude"` block to the existing JSON object. The current file (line 24) is:
```json
"include": ["src"]
```

Change to:
```json
"include": ["src"],
"exclude": [
  "src/**/__tests__",
  "src/**/*.test.ts",
  "src/**/*.test.tsx",
  "src/test-setup.ts"
]
```

This excludes:
- All `__tests__` directories anywhere under `src/`
- All `.test.ts` and `.test.tsx` files anywhere under `src/`
- The Vitest setup file `src/test-setup.ts`

**Why this is safe:**
- `npm run build` uses `tsc -b && vite build`. After this change, `tsc -b` only type-checks app code (non-test files). Test files don't need to be compiled for the app build — they are executed by vitest (which has its own compilation pipeline via `vite.config.ts` with `globals: true`).
- `vite build` does not bundle test files; they are never imported by app code.
- vitest resolves its own tsconfig via `vite.config.ts`, which already has `globals: true`.
- Future test files won't accidentally break `tsc -b` with vitest-specific syntax.
- This also prevents the `declare module '*.md?raw'` pattern from recurring (the type declaration in `vite-env.d.ts` is already correct, but other `declare module` patterns in test files won't pollute app compilation).

**Edge cases:**
- If a test file exists outside `src/` (e.g., `src/../tests/`), it wouldn't match the exclude patterns. Currently no such files exist. If one is added in the future, the exclude should be updated.
- Files named `*.spec.ts` / `*.spec.tsx` are not excluded (current convention uses `__tests__` directories, not spec files). If spec files are used in the future, they must be added to the exclude list.
- Shared type definitions in `__tests__` directories (e.g., `src/__tests__/types.ts`) will also be excluded. If any app code imports them, it will break. Currently no app code imports from `__tests__` directories — this is a standard convention.

---

## Fix 2 — Add explicit `vi` import to `useTheme.test.tsx`

**Problem:** `useTheme.test.tsx` uses `vi.fn()` (lines 17, 21–25, 35, 39–43, 70, 74–78) but only imports `describe, it, expect, beforeEach` from vitest. It relies on vitest globals (`globals: true` in `vite.config.ts`), which works at runtime but is bad practice — it breaks IDE intellisense and makes the test dependent on global configuration.

**File:** `frontend/src/hooks/__tests__/useTheme.test.tsx`

**Changes:**

Line 2, change:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
```
to:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
```

No other changes to this file. The `vi` references throughout the file will now be resolved by the explicit import rather than the global.

**Note:** This change is technically unnecessary once Fix 1 is applied (the test file won't be compiled by `tsc -b`), but it is correct practice for vitest tests. It makes the test self-contained and avoids reliance on globals, which helps with IDE intellisense, linters, and future tsconfig changes.

**Edge cases:**
- If `vitest` package is missing from `devDependencies`, the import will fail at the module resolution level. Currently it is present (see `frontend/package.json`).
- The `@vitest-environment jsdom` doc comment (line 1) is unaffected and should remain.

---

## Fix 3 — Gitignore stray `nul` file

**Problem:** A zero-length file named `nul` (Windows reserved device name) sporadically appears in the working directory, likely as a PowerShell piping artifact. On Windows, `nul` is a reserved DOS device name and cannot be deleted with normal commands. This file gets picked up by `COPY frontend/ .` in the Dockerfile, causing build issues or at minimum wasting Docker cache.

**Files to modify:**
- `.gitignore` (root) — add `nul` to prevent git tracking
- `frontend/.gitignore` — add `nul` in case it appears in the frontend subdirectory
- `frontend/.dockerignore` — add `nul` to prevent it from being copied into Docker build context

**Changes:**

1. **Root `.gitignore`** (D:\Work\Personal\SpecAudit\.gitignore) — append a new line:
   ```
   nul
   ```

2. **`frontend/.gitignore`** (D:\Work\Personal\SpecAudit\frontend\.gitignore) — append a new line:
   ```
   nul
   ```

3. **`frontend/.dockerignore`** (D:\Work\Personal\SpecAudit\frontend\.dockerignore) — append a new line:
   ```
   nul
   ```

**Edge cases:**
- The `nul` file may not exist at the time of implementation. That's fine — the `.gitignore`/`.dockerignore` entries are prophylactic.
- If the `nul` file does exist, attempt to delete it with: `git rm --cached nul` (if tracked) then `del nul` (on Windows, this may fail due to the reserved name; use `\\.\C:\full\path\to\nul` syntax or `Remove-Item -Path "nul" -Force` in PowerShell). If deletion fails, the `.gitignore` entry at least prevents future tracking.
- No other reserved Windows names (CON, PRN, AUX, etc.) have been observed in this project. Only `nul` is addressed.

---

## Test Requirements

### Fix 1 — tsconfig exclusion

- Run `npm run build` from the `frontend/` directory. It should succeed with 0 errors.
- Run `npx tsc --noEmit` from the `frontend/` directory. It should succeed with 0 errors.
- Run `npx vitest run` from the `frontend/` directory. All existing tests should pass.
- Specifically verify that `tsc -b` no longer errors on `useTheme.test.tsx` or any other test file.

### Fix 2 — vi import

- No behavioral change. Run the existing test suite to confirm all `useTheme` tests still pass:
  ```bash
  cd frontend && npx vitest run src/hooks/__tests__/useTheme.test.tsx
  ```
- All 6 tests in the file should pass.

### Fix 3 — nul ignore

- Run `git status` and confirm no `nul` file appears in untracked files.
- If a `nul` file is present in the working directory, verify that `git check-ignore nul` returns the file path (confirming it is ignored).
- Run `docker build .` from the project root and verify it succeeds (specifically the `COPY frontend/ .` step does not report copying `nul`).
- If the `nul` file exists, try to delete it. If deletion fails on Windows, document the exact command used so future maintainers can clean it up.

---

## Build Verification

Tie everything together by running the full build pipeline locally:

```bash
# 1. From project root
cd frontend

# 2. Type-check app code only (should pass, excluding test files)
npx tsc --noEmit

# 3. Full production build (tsc -b + vite build)
npm run build

# 4. Run all vitest tests
npx vitest run

# 5. Check git status is clean (no stray files)
git status
```

Expected results:
- `tsc --noEmit`: 0 errors, 0 warnings
- `npm run build`: Build succeeded (0 errors)
- `npx vitest run`: All tests pass (203+ frontend tests)
- `git status`: Clean, no untracked `nul` file

---

## Files Summary

| Action | Path | Description |
|--------|------|-------------|
| MODIFY | `frontend/tsconfig.app.json` | Add `"exclude"` block for test files |
| MODIFY | `frontend/src/hooks/__tests__/useTheme.test.tsx` | Add `vi` to vitest import |
| MODIFY | `.gitignore` | Add `nul` |
| MODIFY | `frontend/.gitignore` | Add `nul` |
| MODIFY | `frontend/.dockerignore` | Add `nul` |

**Total: 5 files modified.**
