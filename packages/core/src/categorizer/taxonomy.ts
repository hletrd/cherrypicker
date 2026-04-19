import type { CategoryNode } from '@cherrypicker/rules';

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

export class CategoryTaxonomy {
  private readonly nodes: CategoryNode[];
  /** keyword (lowercase) → { category, subcategory } */
  private readonly keywordMap: Map<string, { category: string; subcategory?: string }>;

  constructor(nodes: CategoryNode[]) {
    this.nodes = nodes;
    this.keywordMap = this.buildKeywordMap(nodes);
  }

  private buildKeywordMap(
    nodes: CategoryNode[],
  ): Map<string, { category: string; subcategory?: string }> {
    const map = new Map<string, { category: string; subcategory?: string }>();

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
          map.set(kw.toLowerCase(), {
            category: entry.category,
            subcategory: entry.subcategory,
          });
        }
      }
    }
    return map;
  }

  findCategory(merchantName: string): CategoryMatch {
    const lower = merchantName.toLowerCase();

    // 1. Exact keyword match
    const exact = this.keywordMap.get(lower);
    if (exact) {
      return { ...exact, confidence: 1.0 };
    }

    // 2. Substring match — keyword is contained in merchant name
    let bestSubstring: { category: string; subcategory?: string; kwLen: number } | undefined;
    for (const [kw, mapping] of this.keywordMap) {
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
