import type { CategoryNode } from '@cherrypicker/rules';
import { CategoryTaxonomy } from './taxonomy.js';
import { MERCHANT_KEYWORDS } from './keywords.js';

interface MatchResult {
  category: string;
  subcategory?: string;
  confidence: number;
}

export class MerchantMatcher {
  private readonly taxonomy: CategoryTaxonomy;

  constructor(categoryNodes: CategoryNode[]) {
    this.taxonomy = new CategoryTaxonomy(categoryNodes);
  }

  match(merchantName: string, rawCategory?: string): MatchResult {
    const lower = merchantName.toLowerCase().trim();

    // 1. Exact match against static MERCHANT_KEYWORDS (confidence 1.0)
    const staticExact = MERCHANT_KEYWORDS[lower];
    if (staticExact !== undefined) {
      const [category, subcategory] = staticExact.includes('.')
        ? staticExact.split('.') as [string, string]
        : [staticExact, undefined];
      return { category, subcategory, confidence: 1.0 };
    }

    // 2. Substring match against MERCHANT_KEYWORDS keys (confidence 0.8)
    let bestStaticKw: { category: string; subcategory?: string; kwLen: number } | undefined;
    for (const [kw, categoryStr] of Object.entries(MERCHANT_KEYWORDS)) {
      if (lower.includes(kw) || kw.includes(lower)) {
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
    if (rawCategory && rawCategory.trim().length > 0) {
      const normalised = rawCategory.trim().toLowerCase().replace(/\s+/g, '_');
      return { category: normalised, confidence: 0.5 };
    }

    // 5. Fallback
    return { category: 'uncategorized', confidence: 0.0 };
  }
}
