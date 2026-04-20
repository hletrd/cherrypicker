# Plan -- High-Priority Fixes (Cycle 9 Re-Re-Review)

**Priority:** HIGH
**Findings addressed:** C8-01, C9R-02
**Status:** DONE

---

## Task 1: Gate dead AI categorization code in TransactionReview (C8-01)

**Finding:** `apps/web/src/components/dashboard/TransactionReview.svelte:6-10,46-151` -- The AI categorizer is disabled (categorizer-ai.ts `isAvailable()` always returns `false`), but TransactionReview still imports it and has 65+ lines of unreachable code (lines 46-151: `aiAvailable` state, `aiStatus`, `aiProgress`, `aiRunning`, `runAICategorization()` function, and the AI button template at line 269).

**Files:**
- `apps/web/src/components/dashboard/TransactionReview.svelte`

**Implementation:**
1. Remove the `aiCategorizer` import (line 10) and replace with a comment referencing categorizer-ai.ts
2. Remove the dead state variables: `aiStatus`, `aiProgress`, `aiRunning`, `aiAvailable`
3. Remove the `runAICategorization()` function (lines 84-151)
4. Remove the AI button block in the template (lines 269-287)
5. Add a comment in the template where the AI button was, noting that AI categorization can be re-enabled by updating categorizer-ai.ts and adding back the UI elements

**Commit:** `refactor(web): ♻️ gate dead AI categorization code in TransactionReview`

---

## Task 2: Add AbortController to CardDetail.svelte fetch (C9R-02 / C8-02)

**Finding:** `apps/web/src/components/cards/CardDetail.svelte:77-93` -- The `$effect` uses a `cancelled` flag for cleanup, but the `getCardDetail(cardId)` fetch is not abortable. When the user navigates away or cardId changes, the network request continues to completion.

**Files:**
- `apps/web/src/components/cards/CardDetail.svelte`
- `apps/web/src/lib/api.ts`
- `apps/web/src/lib/cards.ts`

**Implementation:**
1. In `cards.ts`, update `loadCardsData()` to accept an optional `AbortSignal`:
   ```ts
   export async function loadCardsData(signal?: AbortSignal): Promise<CardsJson> {
     if (!cardsPromise) {
       cardsPromise = fetch(`${getBaseUrl()}data/cards.json`, { signal })
         .then(res => {
           if (!res.ok) throw new Error('카드 데이터를 불러올 수 없습니다');
           return res.json() as Promise<CardsJson>;
         })
         .catch(err => {
           cardsPromise = null;
           throw err;
         });
     }
     return cardsPromise;
   }
   ```
   Note: The signal only applies to the first fetch; subsequent calls reuse the cached promise. This is acceptable because the data is static within a session.

2. In `api.ts`, update `getCardDetail()` to accept and forward options:
   ```ts
   export async function getCardDetail(cardId: string, options?: { signal?: AbortSignal }) {
     const card = await getCardById(cardId, options);
     if (!card) throw new Error('카드를 찾을 수 없어요');
     return card;
   }
   ```

3. In `cards.ts`, update `getCardById()` to forward signal:
   ```ts
   export async function getCardById(cardId: string, options?: { signal?: AbortSignal }): Promise<CardDetail | null> {
     const data = await loadCardsData(options?.signal);
     // ... rest unchanged
   }
   ```

4. In `CardDetail.svelte`, use `AbortController` in the `$effect`:
   ```ts
   $effect(() => {
     if (!cardId) { loading = false; return; }
     loading = true; error = null;
     const gen = ++fetchGeneration;
     const controller = new AbortController();
     getCardDetail(cardId, { signal: controller.signal })
       .then((result) => {
         if (!controller.signal.aborted && gen === fetchGeneration) card = result;
       })
       .catch((e) => {
         if (!controller.signal.aborted && gen === fetchGeneration) {
           error = e instanceof Error && e.name !== 'AbortError'
             ? e.message
             : '카드 정보를 불러올 수 없어요';
         }
       })
       .finally(() => {
         if (!controller.signal.aborted && gen === fetchGeneration) loading = false;
       });
     return () => { controller.abort(); };
   });
   ```
   Remove the `cancelled` flag since `AbortController` handles both cleanup and network-level cancellation.

**Commit:** `fix(web): 🛡️ add AbortController to CardDetail fetch for proper cleanup`

---

## Progress

- [x] Task 1: Gate dead AI categorization code (commit: 0000000c39)
- [x] Task 2: Add AbortController to CardDetail fetch (commit: 0000000912)
