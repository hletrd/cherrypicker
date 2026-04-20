/** Build a Map from category IDs (including dot-notation subcategory keys)
 *  to their Korean labels. Used by the analyzer, store, and CardDetail
 *  to avoid duplicating the Map construction logic (C36-03). */

import type { CategoryNode } from './cards.js';

export function buildCategoryLabelMap(nodes: CategoryNode[]): Map<string, string> {
  const labels = new Map<string, string>();
  for (const node of nodes) {
    labels.set(node.id, node.labelKo);
    if (node.subcategories) {
      for (const sub of node.subcategories) {
        labels.set(sub.id, sub.labelKo);
        // Dot-notation key for optimizer lookups — buildCategoryKey
        // produces "dining.cafe" but the taxonomy only has "cafe" as
        // the sub ID; without this entry, categoryLabels.get() misses.
        labels.set(`${node.id}.${sub.id}`, sub.labelKo);
      }
    }
  }
  return labels;
}
