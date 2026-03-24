import type { AnalysisResult, AnalyzeOptions } from './store.js';

const BASE = '';

export interface UploadResult {
  success: boolean;
  fileName: string;
  filePath: string;
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

export async function uploadStatement(file: File): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE}/api/upload`, { method: 'POST', body: formData });
  if (!res.ok) {
    const err = (await res.json()) as { error?: string };
    throw new Error(err.error ?? '업로드 실패');
  }
  return res.json() as Promise<UploadResult>;
}

export async function analyzeStatement(
  filePath: string,
  options?: AnalyzeOptions,
): Promise<AnalysisResult> {
  const res = await fetch(`${BASE}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath, ...options }),
  });
  if (!res.ok) {
    const err = (await res.json()) as { error?: string };
    throw new Error(err.error ?? '분석 실패');
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
  if (!res.ok) throw new Error('카드 목록 로드 실패');
  const data = (await res.json()) as { cards: CardSummary[] };
  return data.cards;
}
