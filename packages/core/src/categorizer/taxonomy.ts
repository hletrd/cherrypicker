import {
  CategoryRegistry,
  type CategoryNode,
} from '@cherrypicker/rules/browser';

interface CategoryMatch {
  category: string;
  subcategory?: string;
  confidence: number;
}

interface FlatEntry {
  category: string;
  subcategory?: string;
  keywords: string[];
}

export const TAXONOMY_KEYWORD_OVERRIDES: Readonly<Record<string, string>> = {
  '식당': 'dining.restaurant',
  '음식점': 'dining.restaurant',
  '레스토랑': 'dining.restaurant',
  '주유': 'transportation.fuel',
  '병원': 'medical.hospital',
  '의원': 'medical.hospital',
  '약국': 'medical.pharmacy',
  '학원': 'education.academy',
  '영화': 'entertainment.movie',
  '호텔': 'travel.hotel',
  '관리비': 'utilities.apartment_mgmt',
};

export interface TaxonomyKeywordConflict {
  keyword: string;
  candidates: string[];
  selectedCategory: string;
}

interface CategoryTaxonomyOptions {
  keywordOverrides?: Readonly<Record<string, string>>;
}

export class CategoryTaxonomy {
  private readonly nodes: CategoryNode[];
  private readonly registry: CategoryRegistry;
  /** keyword (lowercase) → { category, subcategory } */
  private readonly keywordMap: Map<string, { category: string; subcategory?: string }>;
  private readonly resolvedKeywordConflicts: TaxonomyKeywordConflict[] = [];

  constructor(
    nodes: CategoryNode[],
    options: CategoryTaxonomyOptions = {},
  ) {
    this.nodes = nodes;
    this.registry = new CategoryRegistry(nodes);
    this.keywordMap = this.buildKeywordMap(
      nodes,
      options.keywordOverrides ?? TAXONOMY_KEYWORD_OVERRIDES,
    );
  }

  private buildKeywordMap(
    nodes: CategoryNode[],
    overrides: Readonly<Record<string, string>>,
  ): Map<string, { category: string; subcategory?: string }> {
    const definitions = new Map<
      string,
      Map<string, { category: string; subcategory?: string }>
    >();

    const flatten = (node: CategoryNode, parentId?: string): FlatEntry[] => {
      const entry: FlatEntry = {
        category: parentId ?? node.id,
        subcategory: parentId ? node.id : undefined,
        keywords: node.keywords,
      };
      const entries: FlatEntry[] = [entry];
      if (node.subcategories) {
        for (const child of node.subcategories) {
          entries.push(...flatten(child, parentId ?? node.id));
        }
      }
      return entries;
    };

    for (const root of nodes) {
      for (const entry of flatten(root)) {
        for (const kw of entry.keywords) {
          const keyword = kw.trim().toLowerCase();
          if (!keyword) continue;
          const canonicalKey = entry.subcategory
            ? `${entry.category}.${entry.subcategory}`
            : entry.category;
          const candidates = definitions.get(keyword) ?? new Map();
          candidates.set(canonicalKey, {
            category: entry.category,
            subcategory: entry.subcategory,
          });
          definitions.set(keyword, candidates);
        }
      }
    }

    const map = new Map<string, { category: string; subcategory?: string }>();
    for (const [keyword, candidates] of definitions) {
      const candidateKeys = [...candidates.keys()].sort();
      let selectedKey = candidateKeys[0]!;
      if (candidateKeys.length > 1) {
        const override = overrides[keyword];
        if (!override) {
          throw new Error(
            `Taxonomy keyword "${keyword}" has unresolved categories: ` +
              candidateKeys.join(', '),
          );
        }
        if (!candidates.has(override)) {
          throw new Error(
            `Taxonomy keyword override "${keyword}" selects "${override}", ` +
              `but candidates are: ${candidateKeys.join(', ')}`,
          );
        }
        selectedKey = override;
        this.resolvedKeywordConflicts.push({
          keyword,
          candidates: candidateKeys,
          selectedCategory: selectedKey,
        });
      }
      map.set(keyword, candidates.get(selectedKey)!);
    }
    return map;
  }

  getResolvedKeywordConflicts(): readonly TaxonomyKeywordConflict[] {
    return this.resolvedKeywordConflicts;
  }

  findCategory(merchantName: string): CategoryMatch {
    const lower = merchantName.toLowerCase();

    // 1. Exact keyword match
    const exact = this.keywordMap.get(lower);
    if (exact) {
      return { ...exact, confidence: 1.0 };
    }

    // 2. Substring match — keyword is contained in merchant name
    //    Skip single-character keywords to avoid false positives (e.g., a
    //    1-char Korean particle matching every merchant name containing it).
    let bestSubstring: { category: string; subcategory?: string; kwLen: number } | undefined;
    for (const [kw, mapping] of this.keywordMap) {
      if (kw.trim().length < 2) continue;
      if (lower.includes(kw)) {
        if (!bestSubstring || kw.length > bestSubstring.kwLen) {
          bestSubstring = { ...mapping, kwLen: kw.length };
        }
      }
    }
    if (bestSubstring) {
      return {
        category: bestSubstring.category,
        subcategory: bestSubstring.subcategory,
        confidence: 0.8,
      };
    }

    // 3. Fuzzy match — merchant name is contained in keyword (partial reverse)
    // Prefer the shortest keyword that contains the merchant name
    // (shorter keyword = tighter fit, more likely correct)
    // Only apply when merchant name is >= 3 chars to avoid false positives
    // (e.g., "스타" matching "스타벅스" — too short to be meaningful)
    let bestFuzzy: { category: string; subcategory?: string; kwLen: number } | undefined;
    if (lower.length >= 3) {
      for (const [kw, mapping] of this.keywordMap) {
        if (kw.includes(lower)) {
          if (!bestFuzzy || kw.length < bestFuzzy.kwLen) {
            bestFuzzy = { ...mapping, kwLen: kw.length };
          }
        }
      }
    }
    if (bestFuzzy) {
      return {
        category: bestFuzzy.category,
        subcategory: bestFuzzy.subcategory,
        confidence: 0.6,
      };
    }

    return { category: 'uncategorized', confidence: 0.0 };
  }

  getAllCategories(): string[] {
    const ids = new Set<string>();
    const collect = (node: CategoryNode) => {
      ids.add(node.id);
      if (node.subcategories) {
        for (const child of node.subcategories) {
          collect(child);
        }
      }
    };
    for (const root of this.nodes) {
      collect(root);
    }
    return [...ids];
  }

  /** Resolve a parent, qualified child, or unambiguous legacy leaf to the
   * canonical runtime parent/subcategory pair. */
  resolveCategoryToken(token: string): { category: string; subcategory?: string } | undefined {
    return this.registry.resolve(token, {
      allowBareLeaf: true,
      allowWildcard: false,
    }).value;
  }

  getCategoryLabel(id: string): { ko: string; en: string } {
    const find = (node: CategoryNode): CategoryNode | undefined => {
      if (node.id === id) return node;
      if (node.subcategories) {
        for (const child of node.subcategories) {
          const found = find(child);
          if (found) return found;
        }
      }
      return undefined;
    };

    for (const root of this.nodes) {
      const found = find(root);
      if (found) {
        return { ko: found.labelKo, en: found.labelEn };
      }
    }
    return { ko: id, en: id };
  }
}
