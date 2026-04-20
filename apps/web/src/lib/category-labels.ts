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
        // Only set the dot-notation key for subcategories — the optimizer
        // uses buildCategoryKey() which produces "dining.cafe", and
        // categoryLabels.get() must find these entries. The bare sub ID
        // (e.g. "cafe") is NOT set here because it could shadow a
        // top-level category with the same ID if the taxonomy ever
        // introduces a collision (C49-02). Components that need bare
        // subcategory labels (e.g. TransactionReview's categoryMap)
        // build their own maps directly from the category nodes.
        labels.set(`${node.id}.${sub.id}`, sub.labelKo);
      }
    }
  }
  return labels;
}
