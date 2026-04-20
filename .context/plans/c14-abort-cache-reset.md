# Plan: Cycle 14 -- Fix AbortError Cache Reset

**Date:** 2026-04-20
**Status:** In Progress

---

## Finding to Address

### C14-01: `loadCardsData`/`loadCategories` catch blocks reset cache on AbortError

- **Severity:** MEDIUM
- **Confidence:** Medium
- **File:** `apps/web/src/lib/cards.ts:186-190` and `:217-220`
- **Problem:** When `loadCardsData` fetch is aborted (e.g., component unmount), the `.catch` handler unconditionally resets `cardsPromise = null` and `cardsAbortController = null`. This clears the cache for all future callers even though the abort was deliberate. The same issue exists in `loadCategories`.
- **Fix:** In the `.catch` handler, check if the error is an `AbortError` (from `DOMException` or error name check). For AbortError, reset the cache to null (allowing future re-fetches) but do NOT re-throw. For non-abort errors, reset the cache AND re-throw so callers get the error.

---

## Tasks

### Task 1: Add AbortError detection to loadCardsData catch block

**File:** `apps/web/src/lib/cards.ts:186-190`

Change the catch block from:
```ts
.catch(err => {
  cardsPromise = null;
  cardsAbortController = null;
  throw err;
});
```

To:
```ts
.catch(err => {
  cardsPromise = null;
  cardsAbortController = null;
  // AbortError is expected (component unmount) -- don't propagate it
  // to callers who didn't request the abort. Reset cache so future
  // callers can re-fetch, but swallow the abort error.
  if (err instanceof DOMException && err.name === 'AbortError') return undefined as any;
  throw err;
});
```

Wait -- this has a problem. If we return `undefined` from the catch, the promise resolves with `undefined` instead of rejecting, which would cause downstream `await loadCardsData()` to get `undefined` instead of `CardsJson`. Let me think about this more carefully.

Actually, the correct approach is simpler: just reset the cache in the catch block for ALL errors (which we already do), but don't re-throw AbortError since it's an expected cancellation. The callers who passed the signal know the request was cancelled. Other callers who are awaiting the same cached promise need to know the fetch was aborted so they can retry.

Better approach: Reset the cache for AbortError (so future callers re-fetch) but don't re-throw. Non-abort errors should re-throw as before. The key insight is that when an AbortError happens, any callers awaiting the same promise need to handle it gracefully. Since `chainAbortSignal` already connects external signals, the caller who aborted already knows. Other callers awaiting the same promise will get the AbortError -- which is correct behavior since the fetch was cancelled.

Actually, the real fix is even simpler: when the catch detects an AbortError, reset the cache but still throw it. The current behavior is actually correct for the "throw" part -- the problem is that we're resetting `cardsAbortController = null` which means future callers can't tell that the previous fetch was aborted. But we're already resetting `cardsPromise = null` which means future callers will re-fetch. So the behavior is actually correct as-is.

Let me re-analyze: The real concern from C14-01 is that an abort by component A clears the cache for component B who is also waiting. But with `chainAbortSignal`, component B's signal is also chained -- so when A aborts, B's signal fires too, and B knows the fetch was cancelled. The cache reset means B (or a new C) will re-fetch on the next call. This is actually correct behavior.

The only scenario where it's problematic is if B doesn't pass a signal -- then B's `await loadCardsData()` would reject with an AbortError that B didn't expect. Let me check the callers...

Looking at the code: `getCardList` (line 234), `getAllCardRules` (line 229) don't pass signals. They would get the AbortError rejection if another caller aborted. This is the actual bug.

So the fix should be: In the catch block, if the error is an AbortError, reset the cache but DON'T throw -- instead, resolve the promise with a fresh fetch attempt. But this creates infinite loop risk.

Simplest correct fix: Don't throw AbortError. Instead, reject the cached promise with AbortError but also immediately set `cardsPromise = null` so the next call re-fetches. This is what we already do. The issue is that callers like `getAllCardRules` will get an unexpected AbortError.

Best fix: Catch AbortError in the `.catch` handler and DON'T re-throw it. Instead, set `cardsPromise = null` and return a "never-resolving" promise, or better: just let the promise reject silently. Actually, the simplest and most correct fix is to just NOT throw AbortError at all, and reset the cache so the next call succeeds.

Let me implement this properly:

```ts
.catch(err => {
  cardsPromise = null;
  cardsAbortController = null;
  // AbortError is expected (component unmount, signal cancellation).
  // Don't propagate it -- reset cache so next call re-fetches.
  if (err instanceof DOMException && err.name === 'AbortError') {
    return undefined as unknown as CardsJson;
  }
  throw err;
});
```

Wait, this would cause `await loadCardsData()` to return `undefined` for callers who didn't abort. That's worse than the current behavior (throwing an error).

Let me think about this differently. The proper fix is: when the fetch is aborted, reset the cache, and for callers who didn't request the abort, they should get a clean retry on their next call. The AbortError should be swallowed (cache reset, don't re-throw). Callers who passed a signal that triggered the abort already know. Callers who didn't pass a signal will get `undefined` from the catch -- but they should check the result.

Actually, the cleanest fix is: in the catch block, distinguish between AbortError and real errors. For AbortError, just reset the cache silently. The promise will resolve with undefined, which is not great. A better approach is to not use `.catch` at all for AbortError, and instead check `controller.signal.aborted` after the fetch.

Actually, the simplest approach that maintains correctness:

```ts
.catch(err => {
  cardsPromise = null;
  cardsAbortController = null;
  throw err;
});
```

This is what we have. The issue is callers without signals. But looking more carefully, the callers that don't pass signals (`getAllCardRules`, `getCardList`) are typically called during initial page load or from non-reactive code. They would only get AbortError if another component aborted the fetch, which is unlikely during initial load.

I think the correct minimal fix is actually: keep the current behavior (reset + rethrow), but add AbortError-aware handling at the call sites that don't use signals. However, that's a bigger change.

Let me go with a pragmatic approach: In the catch handler, check for AbortError. If it's an AbortError, reset the cache but don't re-throw. The promise will "resolve" (via catch returning), but callers who need the data should check the result. This is better than throwing an unexpected AbortError at callers who didn't request the abort.

Actually wait, I just realized: `.catch(err => { ...; throw err; })` re-throws, so callers still get the rejection. If I change it to `.catch(err => { ...; if(abort) return undefined; throw err; })`, callers who didn't abort get `undefined` which is also bad.

The REAL fix: Use a different approach where we don't share the promise between abort-aware and abort-unaware callers. But that's a bigger refactor.

OK let me just do the simplest thing that's an improvement: In the catch, if it's an AbortError, reset the cache silently. The promise rejects with AbortError, but callers who pass a signal expect this. Callers who don't pass a signal are unlikely to be affected because they typically call during mount (before any abort can happen). And the cache reset means they can retry.

This is already the current behavior! So actually C14-01 might be less severe than I thought. Let me just add a comment documenting the behavior and add a defensive check in the callers that don't use signals.

Actually, let me re-read the code more carefully to understand the exact flow...

Looking at `loadCardsData`:
1. First call creates the fetch promise with AbortController
2. Second call chains its signal via `chainAbortSignal` and returns the SAME promise
3. If the first caller aborts, the shared promise rejects with AbortError
4. The catch block resets the cache, re-throws the error
5. Both callers get the AbortError rejection

The problem: caller 2 didn't request the abort but gets AbortError rejection anyway. Caller 2 would need to catch and retry.

Fix: In the catch block, if it's an AbortError, don't re-throw. Instead, resolve with a sentinel or just return undefined. Callers should check the result. But this changes the API contract.

Simpler fix: Add a comment documenting the behavior and wrap the non-signal callers with a retry. Let me do this.

Actually, I think the best practical fix is:

In `loadCardsData` and `loadCategories`, when the catch detects AbortError, reset the cache but DON'T throw the error back. Instead, just let the promise resolve gracefully. The callers who passed a signal already know about the abort (their signal fired). The callers who didn't pass a signal can check if the data is valid.

```ts
.catch(err => {
  cardsPromise = null;
  cardsAbortController = null;
  // If the fetch was aborted (component unmount), don't propagate the
  // error -- just reset the cache so the next call can re-fetch. Callers
  // who passed a signal know about the abort; callers without signals
  // should not receive an unexpected AbortError.
  if (!(err instanceof DOMException && err.name === 'AbortError')) {
    throw err;
  }
  // Return a never-resolving promise for abort case so callers who
  // await this promise don't get an unexpected rejection or undefined.
  return new Promise<CardsJson>(() => {}); 
});
```

Hmm, a never-resolving promise is also problematic (callers hang forever).

Let me just go with the pragmatic approach: reset cache, don't throw AbortError. Return undefined. Update the callers that don't use signals to handle undefined gracefully.

Actually, the simplest correct fix that doesn't break anything:

Keep the throw, but add `AbortError` handling at the two call sites that don't use signals (`getAllCardRules` and `getCardList`), wrapping them with a retry on AbortError. This way, the existing behavior (cache reset + rethrow) is preserved, and the non-signal callers are protected.

Let me implement this approach.

### Task 1: Add AbortError retry wrapper for non-signal callers

Add a helper function that retries on AbortError:

```ts
async function withAbortRetry<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries > 0 && err instanceof DOMException && err.name === 'AbortError') {
      return withAbortRetry(fn, retries - 1);
    }
    throw err;
  }
}
```

Then use it in `getAllCardRules` and `getCardList`.

### Task 2: Add comment to loadCardsData/loadCategories catch blocks

Document the AbortError behavior in the catch blocks.

---

## Implementation Order

1. Task 1: Add AbortError retry wrapper
2. Task 2: Add documentation comments
3. Run gates: lint, typecheck, test, build
