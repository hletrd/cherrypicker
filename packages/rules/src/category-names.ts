/** Build a Record mapping category IDs (including dot-notation subcategory keys)
 *  to their Korean labels, from the taxonomy CategoryNode tree. */

import type { CategoryNode } from './types.js';

export function buildCategoryNamesKo(nodes: CategoryNode[]): Record<string, string> {
  const names: Record<string, string> = {};
  for (const node of nodes) {
    names[node.id] = node.labelKo;
    if (node.subcategories) {
      for (const sub of node.subcategories) {
        names[`${node.id}.${sub.id}`] = sub.labelKo;
      }
    }
  }
  return names;
}

/** Build a Map from category IDs to their Korean labels.
 *  Includes:
 *  - Parent category IDs (e.g., "dining" -> "외식")
 *  - Bare subcategory IDs (e.g., "cafe" -> "카페")
 *  - Dot-notation subcategory keys (e.g., "dining.cafe" -> "카페")
 *
 *  Used by the optimizer, report generator, and terminal summary to resolve
 *  category keys to human-readable Korean labels without duplicating the
 *  construction logic across packages (C6-03). */
export function buildCategoryLabelMap(nodes: CategoryNode[]): Map<string, string> {
  const labels = new Map<string, string>();
  for (const node of nodes) {
    labels.set(node.id, node.labelKo);
    if (node.subcategories) {
      for (const sub of node.subcategories) {
        labels.set(sub.id, sub.labelKo);
        labels.set(`${node.id}.${sub.id}`, sub.labelKo);
      }
    }
  }
  return labels;
}
