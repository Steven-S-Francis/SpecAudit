# Changes: Severity Filter

## Files changed

| Action | Path |
|--------|------|
| **MODIFY** | `frontend/src/utils/filterMarkdown.ts` |
| **MODIFY** | `frontend/src/utils/__tests__/filterMarkdown.test.ts` |

## What each change does

### Bug fix: `frontend/src/utils/filterMarkdown.ts` — block splitting strategy

The **root cause** was that `filterMarkdown.ts` split finding blocks on `\n---\n`, but the real AI output in `fraudlabs-audit-result.md` has **no** `---` between findings — findings are only separated by blank lines (`\n\n`). The only `---` is between Summary and Findings sections.

When splitting on `\n---\n`:
- Block 0 = Summary (no severity → always kept)
- Block 1 = ALL 14 findings as one giant block
- First severity in Block 1 is `CRITICAL`, so `extractSeverityFromBlock` always returned `CRITICAL`
- Result: WARNING/INFO toggles never matched, CRITICAL toggle showed/hid EVERYTHING

**Fix**: Changed block-splitting from `\n---\n` to splitting before each `### [SEVERITY]` header using the regex `/\n(?=### \[(?:CRITICAL|WARNING|INFO)\])/`. This splits the content before each finding header, making each finding its own block regardless of whether findings are separated by `---` or blank lines.

Specific changes:
1. JSDoc updated to reflect new splitting strategy
2. `const separator = '\n---\n'` → `const blockSplitter = /\n(?=### \[(?:CRITICAL|WARNING|INFO)\])/`
3. `content.split(separator)` → `content.split(blockSplitter)`
4. `filtered.join(separator)` → `filtered.join('\n')`

### Test updates: `frontend/src/utils/__tests__/filterMarkdown.test.ts`

- All test data `.join('\n---\n')` → `.join('\n\n')` to match the real AI output format
- Updated "keeps non-finding sections" test to position non-finding blocks before findings (since trailing content after the last finding header is in the same block with the new splitter)
- Updated "plain h3 headings without severity" test to use `\n\n` separator instead of `\n---\n`
- Updated "handles --- in Governance Score section" test to use proper block structure with the new splitter (findings separated by `\n\n`, `---` inside text to verify it doesn't interfere)
- **New test**: "correctly filters real audit report fixture by severity" — loads the full `fraudlabs-audit-result.md` fixture via `?raw` import and verifies each severity toggle correctly shows/hides only findings of that severity
- Added `declare module '*.md?raw'` for TypeScript type support of the raw import

### Verification

- `npx tsc --noEmit` — zero errors ✅
- `npx vitest run --reporter=verbose src/utils/__tests__/filterMarkdown.test.ts` — all **14/14** filter tests pass ✅
- Full test suite: **199/199** tests pass (15 files) ✅

## Tester focus

- Manually verify that CRITICAL toggle still works (only CRITICAL findings hidden)
- Manually verify that WARNING toggle now works (only WARNING findings hidden — this was broken before)
- Manually verify that INFO toggle now works (only INFO findings hidden — this was broken before)
- Manually verify that Governance Score section appears regardless of which severity toggle is active (it's attached to the last finding block; if the last finding is INFO and INFO is hidden, Governance Score will also be hidden — this is the current behavior with the regex splitter)
