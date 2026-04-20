import type { CategoryNode } from '@cherrypicker/rules';
import { CategoryTaxonomy } from './taxonomy.js';
import { MERCHANT_KEYWORDS } from './keywords.js';
import { LOCATION_KEYWORDS } from './keywords-locations.js';
import { ENGLISH_KEYWORDS } from './keywords-english.js';
import { NICHE_KEYWORDS } from './keywords-niche.js';

const ALL_KEYWORDS: Record<string, string> = {
  ...MERCHANT_KEYWORDS,
  ...LOCATION_KEYWORDS,
  ...ENGLISH_KEYWORDS,
  ...NICHE_KEYWORDS,
};

// Pre-compute keyword entries once at module level instead of on every
// match() call — avoids repeated Object.entries() allocation and the
// isSubstringSafeKeyword filter for the O(n) substring scan (C33-01).
const SUBSTRING_SAFE_ENTRIES: Array<[keyword: string, categoryStr: string]> = Object.entries(ALL_KEYWORDS)
  .filter(([kw]) => kw.trim().length >= 2);

interface MatchResult {
  category: string;
  subcategory?: string;
  confidence: number;
}

export class MerchantMatcher {
  private readonly taxonomy: CategoryTaxonomy;
  /** Cached set of known taxonomy category IDs for O(1) rawCategory validation. */
  private readonly knownCategories: Set<string>;

  constructor(categoryNodes: CategoryNode[]) {
    this.taxonomy = new CategoryTaxonomy(categoryNodes);
    this.knownCategories = new Set(this.taxonomy.getAllCategories());
  }

  match(merchantName: string, rawCategory?: string): MatchResult {
    const lower = merchantName.toLowerCase().trim();

    // Guard: empty or single-character merchant names cannot be meaningfully
    // categorized by keyword matching. Return uncategorized immediately.
    if (lower.length < 2) {
      return { category: 'uncategorized', confidence: 0.0 };
    }

    // 1. Exact match against static MERCHANT_KEYWORDS (confidence 1.0)
    const staticExact = ALL_KEYWORDS[lower];
    if (staticExact !== undefined) {
      const [category, subcategory] = staticExact.includes('.')
        ? staticExact.split('.') as [string, string]
        : [staticExact, undefined];
      return { category, subcategory, confidence: 1.0 };
    }

    // 2. Substring match against MERCHANT_KEYWORDS keys (confidence 0.8)
    //    Uses precomputed SUBSTRING_SAFE_ENTRIES to avoid per-call
    //    Object.entries() allocation and filtering (C33-01).
    let bestStaticKw: { category: string; subcategory?: string; kwLen: number } | undefined;
    for (const [kw, categoryStr] of SUBSTRING_SAFE_ENTRIES) {
      // lower.includes(kw): merchant name contains keyword — always meaningful
      // kw.includes(lower): keyword contains merchant name — only meaningful when
      // the merchant name is >= 3 chars to avoid false positives (e.g., "스타"
      // matching "스타벅스" — "스타" could be short for many non-cafe words)
      const merchantContainsKw = lower.includes(kw);
      const kwContainsMerchant = kw.includes(lower) && lower.length >= 3;
      if (merchantContainsKw || kwContainsMerchant) {
        const [category, subcategory] = categoryStr.includes('.')
          ? categoryStr.split('.') as [string, string]
          : [categoryStr, undefined];
        if (!bestStaticKw || kw.length > bestStaticKw.kwLen) {
          bestStaticKw = { category, subcategory, kwLen: kw.length };
        }
      }
    }
    if (bestStaticKw) {
      return {
        category: bestStaticKw.category,
        subcategory: bestStaticKw.subcategory,
        confidence: 0.8,
      };
    }

    // 3. Taxonomy-based keyword search
    const taxonomyMatch = this.taxonomy.findCategory(merchantName);
    if (taxonomyMatch.confidence > 0) {
      return taxonomyMatch;
    }

    // 4. Use rawCategory from bank as a weak signal (confidence 0.5)
    //    Validate that the normalized value matches a known taxonomy ID.
    //    Korean text labels (e.g., "온라인 쇼핑") would create phantom
    //    categories that match no reward rules — better to fall through
    //    to uncategorized than to assign a category that yields 0 reward.
    if (rawCategory && rawCategory.trim().length > 0) {
      const normalised = rawCategory.trim().toLowerCase().replace(/\s+/g, '_');
      if (this.knownCategories.has(normalised)) {
        return { category: normalised, confidence: 0.5 };
      }
    }

    // 5. Fallback
    return { category: 'uncategorized', confidence: 0.0 };
  }
}
