# SpecAudit: Rate-Limit Retry with Exponential Backoff

## Feature Summary

When the AI provider returns a rate-limit error (HTTP 429), the frontend automatically retries the audit request up to 3 times with exponential backoff (1s, 2s, 4s) before showing an error. No user action required.

## Architecture

| Layer | File | Change |
|-------|------|--------|
| **SSE client** | `frontend/src/api/auditClient.ts` | Detect rate-limit sentinel, throw `RateLimitError` |
| **Hook** | `frontend/src/hooks/useAudit.ts` | Catch `RateLimitError`, retry with backoff |

No backend changes — the backend already detects 429 from the AI provider and sends `[SPECAUDIT_ERROR] Rate limit reached...` inside the SSE stream.

## No new files — only modify existing files

### 1. `frontend/src/api/auditClient.ts`

In the SSE parsing loop where `[SPECAUDIT_ERROR]` is detected, distinguish rate-limit errors from other errors:

**Current code (lines 42-44):**
```ts
if (chunk.startsWith('[SPECAUDIT_ERROR]')) {
  throw new Error(chunk.replace('[SPECAUDIT_ERROR]', '').trim());
}
```

**New code:**
```ts
if (chunk.startsWith('[SPECAUDIT_ERROR]')) {
  const message = chunk.replace('[SPECAUDIT_ERROR]', '').trim();
  const isRateLimit = /rate limit/i.test(message);
  const err = new Error(message);
  err.name = isRateLimit ? 'RateLimitError' : 'Error';
  throw err;
}
```

The `err.name` property is the only change — the hook uses it to decide whether to retry.

### 2. `frontend/src/hooks/useAudit.ts`

Add retry logic inside the hook. Three changes:

**a) Add refs after `abortRef`:**

```ts
const retryCount = useRef(0);
const maxRetries = 3;
```

**b) Reset retry count at the start of `audit()` — add after `abortRef.current?.abort()`:**

```ts
retryCount.current = 0;
```

**c) Modify the catch block to detect `RateLimitError` and retry:**

**Current catch block (lines 28-38):**
```ts
} catch (err) {
  if ((err as Error).name === 'AbortError') {
    setState(s => ({ ...s, status: 'idle' }));
  } else {
    setState(s => ({
      ...s,
      status: 'error',
      error: (err as Error).message,
    }));
  }
}
```

**New catch block:**
```ts
} catch (err) {
  if ((err as Error).name === 'AbortError') {
    setState(s => ({ ...s, status: 'idle' }));
    retryCount.current = 0;
  } else if (
    (err as Error).name === 'RateLimitError' &&
    retryCount.current < maxRetries
  ) {
    retryCount.current++;
    setState({ status: 'loading', result: '', error: null });
    const delay = 1000 * Math.pow(2, retryCount.current - 1);
    await new Promise(resolve => setTimeout(resolve, delay));
    audit(payload); // retry — payload is captured from outer scope
  } else {
    retryCount.current = 0;
    setState(s => ({
      ...s,
      status: 'error',
      error: (err as Error).message,
    }));
  }
}
```

## State transitions during retry

| State | What user sees |
|-------|---------------|
| `loading` | Skeleton (initial attempt or retrying after rate limit) |
| `streaming` | Results appear (successful retry) |
| `error` | Error card (after 3 retries or non-rate-limit error) |
| `idle` | Aborted (user clicked Stop during retry delay) |

## Edge cases

| Case | Behavior |
|------|----------|
| User clicks Stop during retry delay | `abortRef.current?.abort()` at top of `audit()` → old ref is aborted → nothing happens; new `audit()` starts fresh |
| Rate limit on first attempt, success on retry | User sees loading → error is silent → loading again → streaming completes |
| Rate limit 3 times in a row | Error card shown: "Rate limit reached. Please wait a moment and try again..." |
| Non-rate-limit error (invalid API key) | Immediately shows error — no retry |
| User submits new spec during retry delay | `abortRef.current?.abort()` cancels old pending retry, fresh `audit()` starts |
| Component unmounts during retry delay | `setState` on unmounted component warning (pre-existing pattern — acceptable) |

## Tests

### 3. `frontend/src/api/__tests__/auditClient.test.ts` — add 1 test

Add after the existing "throws an error when SSE data contains an error sentinel" test:

```ts
it('throws with name RateLimitError for rate limit sentinel', async () => {
  const sseBody = 'data: "[SPECAUDIT_ERROR] Rate limit reached. Please wait..."\n\n';
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    createMockResponse(true, 200, sseBody)
  );
  const onChunk = vi.fn();
  const signal = new AbortController().signal;

  let thrown: Error | null = null;
  try {
    await auditStream({ spec: 'test' }, onChunk, signal);
  } catch (err) {
    thrown = err as Error;
  }
  expect(thrown).not.toBeNull();
  expect(thrown!.name).toBe('RateLimitError');
});
```

### 4. `frontend/src/hooks/__tests__/useAudit.test.tsx` — add 2 tests

Add after the existing "abort cancels the ongoing audit and sets idle" test:

**Test 1 — retries on RateLimitError:**
```ts
it('retries audit when RateLimitError occurs', async () => {
  const auditStream = vi.fn();
  vi.mock('../../api/auditClient', () => ({ auditStream }));

  // First call throws RateLimitError, second call succeeds
  auditStream
    .mockRejectedValueOnce(Object.assign(new Error('Rate limit reached'), { name: 'RateLimitError' }))
    .mockResolvedValueOnce(undefined);

  const { result } = renderHook(() => useAudit());

  await act(async () => {
    result.current.audit({ spec: 'test' });
  });

  // Should have been called twice (first attempt + retry)
  expect(auditStream).toHaveBeenCalledTimes(2);
});

// Wait — this test won't work because of the setTimeout delay and recursive audit call
```

Actually, testing the retry with async timers is tricky. Let me use `vi.useFakeTimers()`:

```ts
it('retries audit when RateLimitError occurs', async () => {
  vi.useFakeTimers();
  const mockAuditStream = vi.fn();
  mockAuditStream
    .mockRejectedValueOnce(Object.assign(new Error('Rate limit'), { name: 'RateLimitError' }))
    .mockResolvedValueOnce(undefined);

  // We need to mock the module before importing useAudit
  // So we mock at the top of the file using vi.mock
  // Actually, auditStream is already mocked at the top level in the existing tests

  const { result } = renderHook(() => useAudit());

  act(() => {
    result.current.audit({ spec: 'test' });
  });

  // First call happened, now we're in the retry delay
  // Fast-forward past the 1s backoff
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });

  // The retry should have been attempted
  // Check status
  await waitFor(() => {
    expect(result.current.state.status).not.toBe('error');
  });

  vi.useRealTimers();
});
```

Hmm, the existing tests use a mock of `auditStream` at the module level. Let me look at the current test to understand the pattern.

Looking at the existing test structure:

```tsx
import { auditStream } from '../../api/auditClient';
// ...

vi.mock('../../api/auditClient', () => ({
  auditStream: vi.fn(),
}));
```

And in each test:
```tsx
(auditStream as ReturnType<typeof vi.fn>).mockImplementation(...)
```

So `auditStream` is already mocked at the module level. I can build on this pattern. But the test needs to handle:
1. `auditStream` throwing `RateLimitError`
2. The `setTimeout` delay during retry
3. `audit` being called recursively

This is complex to test with fake timers. Let me simplify:

**Test 1 — retries on RateLimitError:**
Use `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync()`. Mock `auditStream` to throw on first call, succeed on second. Verify state transitions through loading → error (retry) → streaming → complete.

**Test 2 — stops after max retries:**
Mock `auditStream` to always throw `RateLimitError`. Advance timers through 3 backoff periods. Verify final state is 'error'.

**Updated test plan:**

```tsx
it('retries audit after RateLimitError and succeeds', async () => {
  vi.useFakeTimers();
  const mockStream = vi.fn()
    .mockRejectedValueOnce(Object.assign(new Error('Rate limit'), { name: 'RateLimitError' }))
    .mockResolvedValueOnce(undefined);

  (auditStream as ReturnType<typeof vi.fn>).mockImplementation(mockStream);

  const { result } = renderHook(() => useAudit());

  act(() => { result.current.audit({ spec: 'test' }); });

  // Wait for first call to fail and enter retry delay
  await vi.advanceTimersByTimeAsync(100); // allow initial call to fail
  expect(result.current.state.status).toBe('loading'); // reset to loading during retry

  // Fast-forward past the 1s backoff
  await vi.advanceTimersByTimeAsync(1000);

  // Should complete successfully now
  await waitFor(() => {
    expect(result.current.state.status).toBe('complete');
  });

  vi.useRealTimers();
});
```

**Test 2 — retries exhausted:**
```tsx
it('shows error after rate limit retries are exhausted', async () => {
  vi.useFakeTimers();
  const rateLimitErr = Object.assign(new Error('Rate limit'), { name: 'RateLimitError' });
  const mockStream = vi.fn()
    .mockRejectedValueOnce(rateLimitErr) // attempt 1
    .mockRejectedValueOnce(rateLimitErr) // attempt 2
    .mockRejectedValueOnce(rateLimitErr); // attempt 3

  (auditStream as ReturnType<typeof vi.fn>).mockImplementation(mockStream);

  const { result } = renderHook(() => useAudit());

  act(() => { result.current.audit({ spec: 'test' }); });

  // Fast-forward through 1s + 2s + 4s backoffs + last attempt
  await vi.advanceTimersByTimeAsync(10000);
  await waitFor(() => {
    expect(result.current.state.status).toBe('error');
  });

  vi.useRealTimers();
});
```

## Completion Criteria

- [ ] `npm run build` — zero TypeScript errors
- [ ] `npm run test -- --run` — all existing + new tests pass (expect 63 → 66 total)
- [ ] `dotnet test SpecAudit.slnx` — backend tests still pass
- [ ] Simulate rate limit: backend returns `[SPECAUDIT_ERROR] Rate limit reached...` → frontend retries silently → audit completes
- [ ] After 3 rate limits → error card appears
