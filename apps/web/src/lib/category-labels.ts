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

/** Fallback category labels used when categories.json fails to load
 *  (e.g., AbortError during View Transition). Ensures CardDetail and
 *  TransactionReview show Korean labels instead of raw English IDs (C1-01).
 *  Must be updated in lockstep with categories.yaml taxonomy. */
export const FALLBACK_CATEGORY_LABELS: ReadonlyMap<string, string> = new Map([
  // Parent categories
  ['dining', '외식'],
  ['restaurant', '음식점'],
  ['cafe', '카페'],
  ['fast_food', '패스트푸드'],
  ['delivery', '배달'],
  ['grocery', '식료품'],
  ['supermarket', '대형마트'],
  ['traditional_market', '전통시장'],
  ['online_grocery', '온라인장보기'],
  ['convenience_store', '편의점'],
  ['online_shopping', '온라인쇼핑'],
  ['offline_shopping', '오프라인쇼핑'],
  ['department_store', '백화점'],
  ['fashion', '패션'],
  ['public_transit', '대중교통'],
  ['subway', '지하철'],
  ['bus', '버스'],
  ['taxi', '택시'],
  ['transportation', '교통'],
  ['fuel', '주유'],
  ['parking', '주차'],
  ['toll', '통행료'],
  ['telecom', '통신'],
  ['insurance', '보험'],
  ['medical', '의료'],
  ['hospital', '병원'],
  ['pharmacy', '약국'],
  ['education', '교육'],
  ['academy', '학원'],
  ['books', '도서'],
  ['entertainment', '엔터테인먼트'],
  ['movie', '영화'],
  ['streaming', '스트리밍'],
  ['subscription', '구독'],
  ['travel', '여행'],
  ['hotel', '숙박'],
  ['airline', '항공'],
  ['travel_agency', '여행사'],
  ['utilities', '공과금'],
  ['electricity', '전기'],
  ['gas', '가스'],
  ['water', '수도'],
  ['apartment_mgmt', '관리비'],
  ['uncategorized', '기타'],
  // Dot-notation subcategory keys
  ['dining.restaurant', '일반음식점'],
  ['dining.cafe', '카페'],
  ['dining.fast_food', '패스트푸드'],
  ['dining.delivery', '배달'],
  ['grocery.supermarket', '대형마트'],
  ['grocery.traditional_market', '전통시장'],
  ['grocery.online_grocery', '온라인식품'],
  ['grocery.convenience_store', '편의점'],
  ['online_shopping.general', '종합쇼핑몰'],
  ['online_shopping.fashion', '패션'],
  ['offline_shopping.department_store', '백화점'],
  ['public_transit.bus', '버스'],
  ['public_transit.subway', '지하철'],
  ['public_transit.taxi', '택시'],
  ['transportation.fuel', '주유'],
  ['transportation.parking', '주차'],
  ['transportation.toll', '고속도로통행료'],
  ['medical.hospital', '병원'],
  ['medical.pharmacy', '약국'],
  ['education.academy', '학원'],
  ['education.books', '도서'],
  ['entertainment.movie', '영화'],
  ['entertainment.streaming', '스트리밍'],
  ['entertainment.subscription', '구독'],
  ['travel.airline', '항공'],
  ['travel.hotel', '호텔/숙박'],
  ['travel.travel_agency', '여행사'],
  ['subscription.general', '전체'],
  ['utilities.electricity', '전기요금'],
  ['utilities.gas', '가스요금'],
  ['utilities.water', '수도요금'],
  ['utilities.apartment_mgmt', '관리비'],
]);
