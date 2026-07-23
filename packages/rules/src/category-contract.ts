import type { CategoryNode } from './types.js';

export interface CanonicalCategory {
  category: string;
  subcategory?: string;
}

export interface CategoryResolution {
  value?: CanonicalCategory;
  error?: 'empty' | 'unknown' | 'ambiguous_leaf' | 'invalid_pair' | 'wildcard_not_allowed';
}

export interface ResolveCategoryOptions {
  allowBareLeaf?: boolean;
  allowWildcard?: boolean;
}

function normalizeToken(token: string): string {
  return token.trim().toLowerCase().replace(/\s+/g, '_');
}

export function buildCategoryKey(category: string, subcategory?: string): string {
  return subcategory ? `${category}.${subcategory}` : category;
}

/**
 * Taxonomy-derived category resolver shared by catalog validation and runtime
 * categorization. It retains parent/child relationships instead of flattening
 * leaf IDs into impossible top-level categories.
 */
export class CategoryRegistry {
  private readonly parents = new Set<string>();
  private readonly qualified = new Map<string, CanonicalCategory>();
  private readonly leaves = new Map<string, CanonicalCategory[]>();

  constructor(nodes: CategoryNode[]) {
    for (const node of nodes) {
      this.addRoot(node);
    }
  }

  private addRoot(node: CategoryNode): void {
    const parent = normalizeToken(node.id);
    if (!parent || parent.includes('.')) {
      throw new Error(`Invalid top-level category id: "${node.id}"`);
    }
    if (this.parents.has(parent)) {
      throw new Error(`Duplicate top-level category id: "${parent}"`);
    }
    this.parents.add(parent);
    this.qualified.set(parent, { category: parent });

    for (const child of node.subcategories ?? []) {
      this.addChild(parent, child);
    }
  }

  private addChild(parent: string, node: CategoryNode): void {
    const leaf = normalizeToken(node.id);
    if (!leaf || leaf.includes('.')) {
      throw new Error(`Invalid subcategory id under "${parent}": "${node.id}"`);
    }

    const key = buildCategoryKey(parent, leaf);
    if (this.qualified.has(key)) {
      throw new Error(`Duplicate category pair: "${key}"`);
    }

    const value = { category: parent, subcategory: leaf };
    this.qualified.set(key, value);
    const candidates = this.leaves.get(leaf) ?? [];
    candidates.push(value);
    this.leaves.set(leaf, candidates);

    // The current reward contract is parent + one leaf. Reject deeper trees
    // rather than silently flattening a grandchild against the wrong parent.
    if ((node.subcategories?.length ?? 0) > 0) {
      throw new Error(`Nested subcategories deeper than one level are unsupported: "${key}"`);
    }
  }

  resolve(token: string, options: ResolveCategoryOptions = {}): CategoryResolution {
    const normalized = normalizeToken(token);
    if (!normalized) return { error: 'empty' };
    if (normalized === '*') {
      return options.allowWildcard
        ? { value: { category: '*' } }
        : { error: 'wildcard_not_allowed' };
    }

    const direct = this.qualified.get(normalized);
    if (direct) return { value: { ...direct } };

    if (options.allowBareLeaf !== false) {
      const candidates = this.leaves.get(normalized) ?? [];
      if (candidates.length === 1) return { value: { ...candidates[0]! } };
      if (candidates.length > 1) return { error: 'ambiguous_leaf' };
    }

    return { error: 'unknown' };
  }

  resolvePair(category: string, subcategory?: string): CategoryResolution {
    const parent = normalizeToken(category);
    if (parent === '*') {
      return subcategory
        ? { error: 'invalid_pair' }
        : { value: { category: '*' } };
    }

    if (subcategory !== undefined) {
      const child = normalizeToken(subcategory);
      const direct = this.qualified.get(buildCategoryKey(parent, child));
      return direct ? { value: { ...direct } } : { error: 'invalid_pair' };
    }

    const direct = this.qualified.get(parent);
    if (direct && direct.subcategory === undefined) {
      return { value: { ...direct } };
    }

    // Legacy YAML sometimes placed a leaf in category without subcategory.
    // Resolve it only when it is unambiguous so publication can canonicalize
    // existing data without ever emitting the leaf as a parent.
    return this.resolve(parent, { allowBareLeaf: true, allowWildcard: true });
  }

  hasParent(category: string): boolean {
    return this.parents.has(normalizeToken(category));
  }

  canonicalKeys(): string[] {
    return [...this.qualified.keys()];
  }

  parentIds(): string[] {
    return [...this.parents];
  }
}

export function canonicalizeCategory(
  registry: CategoryRegistry,
  category: string,
  subcategory?: string,
): CanonicalCategory {
  const resolved = registry.resolvePair(category, subcategory);
  if (!resolved.value) {
    const authored = buildCategoryKey(category, subcategory);
    throw new Error(`Invalid category reference "${authored}": ${resolved.error ?? 'unknown'}`);
  }
  return resolved.value;
}
