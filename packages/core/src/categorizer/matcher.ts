import type { CategoryNode } from '@cherrypicker/rules';
import { CategoryTaxonomy } from './taxonomy.js';
import { MERCHANT_KEYWORDS } from './keywords.js';
import { LOCATION_KEYWORDS } from './keywords-locations.js';
import { ENGLISH_KEYWORDS } from './keywords-english.js';
import { NICHE_KEYWORDS } from './keywords-niche.js';
import { EXPLICIT_KEYWORD_OVERRIDES } from './keyword-overrides.js';
import {
  compileNormalizedMerchantTerm,
  compiledNormalizedMerchantTermMatches,
  normalizeMerchantText,
  type CompiledNormalizedMerchantTerm,
} from './normalize.js';

interface KeywordSource {
  name: string;
  values: Record<string, string>;
}

export interface KeywordConflict {
  keyword: string;
  candidates: string[];
  selectedSource: string;
  selectedCategory: string;
  resolution: 'explicit_override';
}

const KEYWORD_SOURCES: KeywordSource[] = [
  { name: 'base', values: MERCHANT_KEYWORDS },
  { name: 'locations', values: LOCATION_KEYWORDS },
  { name: 'english', values: ENGLISH_KEYWORDS },
  { name: 'niche', values: NICHE_KEYWORDS },
];

// Curated migrations for legacy keyword-map values that predate the current
// taxonomy. Keeping these aliases explicit makes the semantic change visible
// and prevents an invalid leaf/pair from reaching runtime output.
const LEGACY_CATEGORY_ALIASES: Readonly<Record<string, string>> = {
  'dining.bar': 'dining.restaurant',
  'travel.accommodation': 'travel.hotel',
  'travel.flight': 'travel.airline',
};

let latestResolvedConflicts: readonly KeywordConflict[] = [];

export function getResolvedKeywordConflicts(): readonly KeywordConflict[] {
  return latestResolvedConflicts;
}

interface MatchResult {
  category: string;
  subcategory?: string;
  confidence: number;
}

export class MerchantMatcher {
  private readonly taxonomy: CategoryTaxonomy;
  private readonly exactKeywords = new Map<string, { category: string; subcategory?: string }>();
  private readonly substringEntries: Array<[
    term: CompiledNormalizedMerchantTerm,
    value: { category: string; subcategory?: string },
  ]> = [];
  /** LRU cache keyed by normalized merchant name + rawCategory. */
  private readonly cache = new Map<string, MatchResult>();
  private static readonly MAX_CACHE_SIZE = 500;

  constructor(
    categoryNodes: CategoryNode[],
    options: { strict?: boolean } = {},
  ) {
    this.taxonomy = new CategoryTaxonomy(categoryNodes);

    const invalidMappings: string[] = [];
    const definitions = new Map<
      string,
      Map<
        string,
        {
          category: string;
          subcategory?: string;
          sources: Set<string>;
        }
      >
    >();

    for (const source of KEYWORD_SOURCES) {
      for (const [authoredKeyword, authoredCategory] of Object.entries(
        source.values,
      )) {
        const keyword = normalizeMerchantText(authoredKeyword);
        if (!keyword) continue;
        const categoryToken =
          LEGACY_CATEGORY_ALIASES[authoredCategory] ?? authoredCategory;
        const canonical = this.taxonomy.resolveCategoryToken(categoryToken);
        if (!canonical) {
          invalidMappings.push(
            `${keyword} -> ${authoredCategory} (${source.name})`,
          );
          continue;
        }
        const canonicalKey = canonical.subcategory
          ? `${canonical.category}.${canonical.subcategory}`
          : canonical.category;
        const byCategory =
          definitions.get(keyword) ??
          new Map<
            string,
            {
              category: string;
              subcategory?: string;
              sources: Set<string>;
            }
          >();
        const definition = byCategory.get(canonicalKey) ?? {
          ...canonical,
          sources: new Set<string>(),
        };
        definition.sources.add(source.name);
        byCategory.set(canonicalKey, definition);
        definitions.set(keyword, byCategory);
      }
    }

    if (options.strict && invalidMappings.length > 0) {
      throw new Error(
        `Invalid production keyword mappings:\n${invalidMappings.join('\n')}`,
      );
    }

    const resolvedConflicts: KeywordConflict[] = [];
    const usedOverrides = new Set<string>();
    for (const [keyword, byCategory] of definitions) {
      const candidates = [...byCategory.keys()].sort();
      let selectedKey = candidates[0]!;
      if (candidates.length > 1) {
        const override = EXPLICIT_KEYWORD_OVERRIDES[keyword];
        if (!override) {
          throw new Error(
            `Keyword "${keyword}" has unresolved categories: ${candidates.join(', ')}`,
          );
        }
        if (!byCategory.has(override)) {
          throw new Error(
            `Keyword override "${keyword}" selects "${override}", ` +
              `but candidates are: ${candidates.join(', ')}`,
          );
        }
        selectedKey = override;
        usedOverrides.add(keyword);
        resolvedConflicts.push({
          keyword,
          candidates,
          selectedSource: [...byCategory.get(selectedKey)!.sources]
            .sort()
            .join(','),
          selectedCategory: selectedKey,
          resolution: 'explicit_override',
        });
      }
      const selected = byCategory.get(selectedKey)!;
      this.exactKeywords.set(keyword, {
        category: selected.category,
        subcategory: selected.subcategory,
      });
      if (keyword.length >= 2) {
        this.substringEntries.push([
          compileNormalizedMerchantTerm(keyword),
          {
            category: selected.category,
            subcategory: selected.subcategory,
          },
        ]);
      }
    }

    if (options.strict) {
      const staleOverrides = Object.keys(EXPLICIT_KEYWORD_OVERRIDES).filter(
        (keyword) => !usedOverrides.has(keyword),
      );
      if (staleOverrides.length > 0) {
        throw new Error(
          `Stale keyword overrides without a live conflict: ${staleOverrides.join(', ')}`,
        );
      }
    }
    latestResolvedConflicts = resolvedConflicts;
  }

  match(merchantName: string, rawCategory?: string): MatchResult {
    const lower = normalizeMerchantText(merchantName);
    const cacheKey = `${lower}|${rawCategory?.trim().toLowerCase() ?? ''}`;

    // Check LRU cache first
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(cacheKey);
      this.cache.set(cacheKey, cached);
      return cached;
    }

    // Guard: empty or single-character merchant names cannot be meaningfully
    // categorized by keyword matching. Return uncategorized immediately.
    if (lower.length < 2) {
      const result: MatchResult = { category: 'uncategorized', confidence: 0.0 };
      this.setCache(cacheKey, result);
      return result;
    }

    const compiledMerchant = compileNormalizedMerchantTerm(lower);

    // 1. An exact canonical keyword is authoritative when both sources define
    //    the same merchant.
    const canonicalMatch =
      this.taxonomy.findExactOrSubstringCompiledMerchant(compiledMerchant);
    if (canonicalMatch?.matchType === 'exact') {
      const result: MatchResult = {
        category: canonicalMatch.category,
        subcategory: canonicalMatch.subcategory,
        confidence: canonicalMatch.confidence,
      };
      this.setCache(cacheKey, result);
      return result;
    }

    // 2. A more-specific exact legacy keyword beats a broad canonical
    //    substring (for example 자동차세 over 자동차).
    const staticExact = this.exactKeywords.get(lower);
    if (staticExact !== undefined) {
      const result: MatchResult = { ...staticExact, confidence: 1.0 };
      this.setCache(cacheKey, result);
      return result;
    }

    // 3. Compare substring candidates across both sources. Preserve the
    //    legacy reverse-substring convenience match for names of at least
    //    three characters; longest wins and canonical taxonomy wins ties.
    let bestStaticKw:
      | {
          category: string;
          subcategory?: string;
          keyword: string;
          kwLen: number;
        }
      | undefined;
    for (const [term, categoryValue] of this.substringEntries) {
      const kw = term.text;
      const merchantContainsKeyword =
        compiledNormalizedMerchantTermMatches(lower, term);
      const keywordContainsMerchant =
        lower.length >= 3 &&
        compiledNormalizedMerchantTermMatches(kw, compiledMerchant);
      if (merchantContainsKeyword || keywordContainsMerchant) {
        if (
          !bestStaticKw ||
          kw.length > bestStaticKw.kwLen ||
          (kw.length === bestStaticKw.kwLen && kw < bestStaticKw.keyword)
        ) {
          bestStaticKw = {
            ...categoryValue,
            keyword: kw,
            kwLen: kw.length,
          };
        }
      }
    }
    if (
      canonicalMatch?.matchType === 'substring' &&
      (!bestStaticKw || canonicalMatch.keyword.length >= bestStaticKw.kwLen)
    ) {
      const result: MatchResult = {
        category: canonicalMatch.category,
        subcategory: canonicalMatch.subcategory,
        confidence: canonicalMatch.confidence,
      };
      this.setCache(cacheKey, result);
      return result;
    }
    if (bestStaticKw !== undefined) {
      const result: MatchResult = {
        category: bestStaticKw.category,
        subcategory: bestStaticKw.subcategory,
        confidence: 0.8,
      };
      this.setCache(cacheKey, result);
      return result;
    }

    // 4. Taxonomy reverse-fuzzy keyword fallback
    const taxonomyMatch =
      this.taxonomy.findCompiledCategory(compiledMerchant);
    if (taxonomyMatch.confidence > 0) {
      this.setCache(cacheKey, taxonomyMatch);
      return taxonomyMatch;
    }

    // 5. Use rawCategory from bank as a weak signal (confidence 0.5)
    //    Validate that the normalized value matches a known taxonomy ID.
    //    Korean text labels (e.g., "온라인 쇼핑") would create phantom
    //    categories that match no reward rules — better to fall through
    //    to uncategorized than to assign a category that yields 0 reward.
    if (rawCategory && rawCategory.trim().length > 0) {
      const canonical = this.taxonomy.resolveCategoryToken(rawCategory);
      if (canonical) {
        const result: MatchResult = { ...canonical, confidence: 0.5 };
        this.setCache(cacheKey, result);
        return result;
      }
    }

    // 6. Fallback
    const result: MatchResult = { category: 'uncategorized', confidence: 0.0 };
    this.setCache(cacheKey, result);
    return result;
  }

  private setCache(key: string, result: MatchResult): void {
    if (this.cache.size >= MerchantMatcher.MAX_CACHE_SIZE) {
      // Evict oldest (first entry in Map iteration order = least recently used)
      // because getCache promotes accessed entries to the end (C32-V07).
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, result);
  }
}
