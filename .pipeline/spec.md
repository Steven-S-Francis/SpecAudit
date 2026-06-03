# Fix JSON block flashing in UI during streaming

## Root Cause

`App.tsx` line 19 uses a regex to strip the trailing ````json```` block:

```typescript
const strippedResult = state.result.replace(/```json[\s\S]*?```\s*$/gm, '');
```

The regex requires **both** the full closing fence `\`\`\`` **and** the end-of-string anchor `$` to match. During streaming, the AI output arrives incrementally:

1. `\`\`\`json` — open marker arrives, regex does NOT match (no `\`\`\`` yet)
2. `\n{"findings":[` — JSON content arrives, regex still does NOT match
3. `...` — more JSON content, still no match
4. `\n\`\`\`` — closing fence finally arrives, regex matches and strips

At steps 1–3 the partial ````json```` and raw JSON **leaks** into `strippedResult`, which is passed to `ResultPanel`'s `ReactMarkdown` render. The user sees a flash of ````json` followed by raw JSON — confusing and ugly.

## Fix

Replace the regex on line 19 of `frontend/src/App.tsx` with a `lastIndexOf`-based approach that strips everything from the last ````json```` marker to the end, regardless of whether the closing fence is present.

### File to modify

**`frontend/src/App.tsx`** — line 19 only.

### Before (line 19)

```typescript
const strippedResult = state.result.replace(/```json[\s\S]*?```\s*$/gm, '');
```

### After

```typescript
const JSON_MARKER = '```json';
const markerIndex = state.result.lastIndexOf(JSON_MARKER);
const strippedResult = markerIndex === -1
  ? state.result
  : state.result.slice(0, markerIndex);
```

### Behavioral comparison

| Streaming phase | `state.result` | `strippedResult` (new) | `strippedResult` (old regex) |
|---|---|---|---|
| Before JSON block | `...report text...` | `...report text...` | `...report text...` |
| ` ```json ` just arrived | `...text\n\n\`\`\`json` | `...text\n\n` | `...text\n\n\`\`\`json` ❌ leaks! |
| JSON content streaming | `...\n\`\`\`json\n{...}` | `...text\n\n` | `...\n\`\`\`json\n{...` ❌ leaks! |
| Closing fence arrives | `...\n\`\`\`json\n{...}\n\`\`\`` | `...text\n\n` | `...text\n\n` ✅ |

### Why this is safe

- **`state.result`** is never mutated — only `strippedResult` (derived value) changes.
- **Copy / Download / PDF export** — all use `strippedResult`; they will now also avoid the JSON block during streaming (which is correct — you don't want to copy/export raw JSON mid-stream).
- **JSON export** — uses structured `state.findings` + `state.summary` when available, falling back to `strippedResult` only when both are empty/null (line 65–66). Unchanged.
- **Severity filter / ResultPanel** — receives `strippedResult`; no change in interface.
- **Auto-scroll** — triggers on `content` prop changes to `ResultPanel`; still fires during streaming.

### Edge cases

1. **No ````json```` marker in result**: `lastIndexOf` returns `-1`, so `strippedResult` equals `state.result` — identical to old behavior.
2. **Multiple ````json```` markers**: `lastIndexOf` picks the last occurrence, which is the trailing AI-generated JSON block. Earlier ones (e.g., inline code examples) are preserved — this is more correct than the old regex which might match a non-trailing block with a lazy quantifier.
3. **`\`\`\`json` at position 0**: `slice(0, 0)` returns `""` (empty string) — same as stripping everything, which is correct.
4. **Result is empty string**: `lastIndexOf` returns `-1`, returns `""` — identical to old behavior.
5. **`\`\`\`json` with no closing fence (streaming)**: Stripped immediately — this is the fix.
6. **`\`\`\`json` with closing fence (complete)**: Stripped — same as old behavior for completed results.

## What tested behaviors change

### Existing tests: `frontend/src/components/features/__tests__/App.test.tsx`

No existing test needs modification. All tests use static (non-streaming) result strings:

| Test | Result value | Old behavior | New behavior | Change? |
|---|---|---|---|---|
| Copy button tests | `'Audit report content'`, `'Partial content...'`, `'Full audit report text'` | No ````json```` → pass-through | Same (`lastIndexOf` returns `-1`) | No change |
| Download button tests | `'Full audit report text'` | Same | Same | No change |
| Export PDF button tests | `'Full audit report text'` | Same | Same | No change |
| Export JSON "structured data" test (line 787) | `'# Some markdown\n\`\`\`json\n{"findings":[]}\n\`\`\`'` | Regex strips the ````json```` block → `'# Some markdown\n'` | `lastIndexOf` finds `\`\`\`json` at position 15, slices → `'# Some markdown\n'` | Same result ✅ |
| Export JSON "no structured data" test (line 836) | `'Plain markdown without structured data'` | No ````json```` → pass-through | Same | No change |

### Integration tests: `frontend/src/__tests__/integration/feature-pipeline.test.ts`

None of these tests exercise `App.tsx`'s `strippedResult` directly. They test the streaming pipeline (`auditStream`), PDF generation, and content structure independently. No changes needed.

## Verification steps

Run these from `frontend/`:

```bash
# 1. Type-check (must pass with 0 errors)
npx tsc --noEmit

# 2. Run all unit tests (must pass)
npx vitest run

# 3. Full production build (must succeed)
npm run build
```

## Files summary

| Action | Path | Description |
|--------|------|-------------|
| MODIFY | `frontend/src/App.tsx` | Replace regex on line 19 with `lastIndexOf` approach |

Total: **1 file modified**.
