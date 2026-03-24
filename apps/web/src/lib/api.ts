const BASE = '';

export async function uploadStatement(file: File): Promise<{ filePath: string; fileName: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE}/api/upload`, { method: 'POST', body: formData });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? '업로드 실패');
  }
  return res.json();
}

export async function analyzeStatement(
  filePath: string,
  options?: { bank?: string; previousMonthSpending?: number },
): Promise<unknown> {
  const res = await fetch(`${BASE}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath, ...options }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? '분석 실패');
  }
  return res.json();
}

export async function getCards(): Promise<unknown[]> {
  const res = await fetch(`${BASE}/api/cards`);
  if (!res.ok) throw new Error('카드 목록 로드 실패');
  const data = await res.json();
  return data.cards;
}
