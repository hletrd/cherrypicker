# Plan 25 — Medium-Priority Fixes (Cycle 15)

**Priority:** MEDIUM
**Findings addressed:** C15-02
**Status:** DONE

---

## Task 1: Add subcategory key entries to CATEGORY_NAMES_KO fallback in greedy.ts

**Finding:** C15-02 — `CATEGORY_NAMES_KO` in `greedy.ts` only has flat category IDs (e.g., `"dining"`, `"cafe"`). After the C14-01 fix, `buildAssignments` uses `categoryKey` format which includes subcategories (e.g., `"dining.cafe"`). When `categoryLabels` is not provided (CLI usage), the fallback chain `CATEGORY_NAMES_KO[categoryKey]` fails for subcategory keys, falling through to the parent category name.

**File:** `packages/core/src/optimizer/greedy.ts:7-50`

**Implementation:**
1. Add subcategory key entries to `CATEGORY_NAMES_KO` in dot-notation format:
```ts
const CATEGORY_NAMES_KO: Record<string, string> = {
  // Parent categories
  dining: '외식',
  restaurant: '음식점',
  cafe: '카페',
  // ... existing entries ...
  
  // Subcategory keys (dot notation) — for when categoryLabels is not available
  'dining.cafe': '카페',
  'dining.restaurant': '음식점',
  'dining.fast_food': '패스트푸드',
  'dining.delivery': '배달',
  'grocery.supermarket': '대형마트',
  'grocery.traditional_market': '전통시장',
  'grocery.online_grocery': '온라인장보기',
  'grocery.convenience_store': '편의점',
  'online_shopping.fashion': '패션',
  'offline_shopping.department_store': '백화점',
  'public_transit.subway': '지하철',
  'public_transit.bus': '버스',
  'public_transit.taxi': '택시',
  'transportation.fuel': '주유',
  'transportation.parking': '주차',
  'transportation.toll': '통행료',
  'medical.hospital': '병원',
  'medical.pharmacy': '약국',
  'education.academy': '학원',
  'education.books': '도서',
  'entertainment.movie': '영화',
  'entertainment.streaming': '스트리밍',
  'entertainment.subscription': '구독',
  'travel.hotel': '숙박',
  'travel.airline': '항공',
  'utilities.electricity': '전기',
  'utilities.gas': '가스',
  'utilities.water': '수도',
};
```

**Commit:** `fix(core): 🐩 add subcategory key entries to CATEGORY_NAMES_KO fallback map`

---

## Progress

- [x] Task 1: Add subcategory key entries to CATEGORY_NAMES_KO — Committed (00000009d)
