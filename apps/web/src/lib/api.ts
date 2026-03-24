import type { AnalysisResult, AnalyzeOptions } from './store.svelte.js';

const BASE = '';

export interface UploadResult {
  success: boolean;
  fileName: string;
  size: number;
  type: string;
  detection: {
    format: string;
    bank: string | null;
    confidence: number;
    encoding?: string;
  };
}

export interface CardSummary {
  id: string;
  issuer: string;
  issuerNameKo: string;
  issuerNameEn: string;
  name: string;
  nameKo: string;
  type: string;
  annualFee: { domestic: number; international: number };
  url?: string;
  lastUpdated: string;
  source: string;
  rewardCategories: string[];
}

export interface PerformanceTier {
  id: string;
  label: string;
  minSpending: number;
  maxSpending: number | null;
}

export interface RewardTier {
  performanceTier: string;
  rate: number;
  monthlyCap: number | null;
  perTransactionCap: number | null;
}

export interface RewardEntry {
  category: string;
  type: string;
  tiers: RewardTier[];
  conditions?: {
    excludeOnline?: boolean;
    specificMerchants?: string[];
    minAmount?: number;
  };
}

export interface CardDetail extends CardSummary {
  performanceTiers: PerformanceTier[];
  performanceExclusions: string[];
  rewards: RewardEntry[];
  globalConstraints?: unknown;
}

export async function uploadStatement(file: File): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE}/api/upload`, { method: 'POST', body: formData });
  if (!res.ok) {
    let message = res.statusText || '업로드 실패';
    try {
      const err = (await res.json()) as { error?: string };
      if (err.error) message = err.error;
    } catch { /* non-JSON response */ }
    throw new Error(message);
  }
  return res.json() as Promise<UploadResult>;
}

export async function analyzeStatement(
  fileName: string,
  options?: AnalyzeOptions,
): Promise<AnalysisResult> {
  const res = await fetch(`${BASE}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName, ...options }),
  });
  if (!res.ok) {
    let message = res.statusText || '분석 실패';
    try {
      const err = (await res.json()) as { error?: string };
      if (err.error) message = err.error;
    } catch { /* non-JSON response */ }
    throw new Error(message);
  }
  return res.json() as Promise<AnalysisResult>;
}

export async function getCards(filters?: {
  issuer?: string;
  type?: string;
}): Promise<CardSummary[]> {
  const params = new URLSearchParams();
  if (filters?.issuer) params.set('issuer', filters.issuer);
  if (filters?.type) params.set('type', filters.type);
  const query = params.size > 0 ? `?${params.toString()}` : '';
  const res = await fetch(`${BASE}/api/cards${query}`);
  if (!res.ok) {
    let message = res.statusText || '카드 목록 로드 실패';
    try {
      const err = (await res.json()) as { error?: string };
      if (err.error) message = err.error;
    } catch { /* non-JSON response */ }
    throw new Error(message);
  }
  const data = (await res.json()) as { cards: CardSummary[] };
  return data.cards;
}

export async function getCardDetail(cardId: string): Promise<CardDetail> {
  const res = await fetch(`${BASE}/api/cards/${encodeURIComponent(cardId)}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error('카드를 찾을 수 없습니다');
    let message = res.statusText || '카드 정보 로드 실패';
    try {
      const err = (await res.json()) as { error?: string };
      if (err.error) message = err.error;
    } catch { /* non-JSON response */ }
    throw new Error(message);
  }
  return res.json() as Promise<CardDetail>;
}
