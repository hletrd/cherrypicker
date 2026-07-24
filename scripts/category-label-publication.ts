import type { CategoryNode } from '../packages/rules/src/index.js';

export type CategoryLabelEntry = readonly [key: string, label: string];

export function fallbackCategoryLabelEntries(
  categories: readonly Pick<
    CategoryNode,
    'id' | 'labelKo' | 'subcategories'
  >[],
): CategoryLabelEntry[] {
  const entries: CategoryLabelEntry[] = [];
  for (const category of categories) {
    entries.push([category.id, category.labelKo]);
    for (const subcategory of category.subcategories ?? []) {
      entries.push([subcategory.id, subcategory.labelKo]);
      entries.push([
        `${category.id}.${subcategory.id}`,
        subcategory.labelKo,
      ]);
    }
  }
  return entries;
}

function stringifyExecutableJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function buildFallbackCategoryLabelsModule(
  categories: readonly Pick<
    CategoryNode,
    'id' | 'labelKo' | 'subcategories'
  >[],
): string {
  const entries = stringifyExecutableJson(
    fallbackCategoryLabelEntries(categories),
  );
  return `/** Auto-generated from categories.yaml by scripts/build-json.ts
 *  Do not edit manually — run 'bun run data:build' to regenerate.
 */
export const FALLBACK_CATEGORY_LABELS: ReadonlyMap<string, string> = new Map<string, string>(${entries});
`;
}
