import Anthropic from '@anthropic-ai/sdk';
import type { RawTransaction } from '../types.js';

const SYSTEM_PROMPT = `You are a Korean credit card statement parser.
Extract transaction records from the provided text.

For each transaction, extract:
- date: ISO 8601 date string (YYYY-MM-DD)
- merchant: merchant/store name (Korean text OK)
- amount: integer amount in Korean Won (positive integer, no commas)
- installments: number of installment months (optional, omit if 일시불 or 1)

Return a JSON array of transaction objects. Example:
[
  { "date": "2024-01-15", "merchant": "스타벅스", "amount": 6500 },
  { "date": "2024-01-20", "merchant": "이마트", "amount": 45000, "installments": 3 }
]

Rules:
- Only include actual purchase transactions, not payments or fees
- Amounts are always positive integers (no decimal points)
- If installment is 1 or 일시불, omit the installments field
- If you cannot determine a field, omit it
- Return ONLY the JSON array, no other text`;

interface LLMTransaction {
  date?: string;
  merchant?: string;
  amount?: number;
  installments?: number;
}

export async function parsePDFWithLLM(text: string): Promise<RawTransaction[]> {
  if (typeof window !== 'undefined') {
    throw new Error('LLM fallback is not available in browser environments');
  }

  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    throw new Error('API 키가 설정되지 않아 LLM 폴백을 사용할 수 없습니다.');
  }

  const client = new Anthropic({ apiKey });

  const model = process.env['ANTHROPIC_MODEL'] ?? 'claude-opus-4-5';

  // Truncate text to avoid token limits — take first 8000 chars
  const truncated = text.length > 8000 ? text.slice(0, 8000) + '\n...(truncated)' : text;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
  const message = await client.messages.create(
    {
      model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `다음은 신용카드 명세서에서 추출한 텍스트입니다. 거래 내역을 JSON 배열로 파싱해 주세요:\n\n${truncated}`,
        },
      ],
    },
    { signal: controller.signal },
  );

  const responseText = message.content
    .filter((block) => block.type === 'text')
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('');

  // Extract JSON from response — use greedy match to capture the longest
  // possible bracket-delimited content, then validate by parsing. The greedy
  // quantifier avoids mis-matching on incidental bracketed text (e.g., "[note]")
  // that may appear before the actual transaction array. If the greedy match
  // fails to parse, progressively trim from the end and retry.
  const jsonMatch = responseText.match(/\[[\s\S]*\](?=\s*$|\s*```)/);
  if (!jsonMatch) {
    throw new Error('LLM 응답에서 JSON 배열을 찾을 수 없습니다.');
  }

  let parsed: LLMTransaction[];
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    // Greedy match may have captured too much (e.g., trailing text after the
    // JSON array). Try progressively shorter matches by finding earlier `]`
    // positions and re-parsing until one succeeds.
    let candidate = jsonMatch[0];
    let parsedOk = false;
    while (candidate.length > 2) {
      // Find the previous `]` position
      const lastBracket = candidate.lastIndexOf(']', candidate.length - 2);
      if (lastBracket <= 0) break;
      candidate = candidate.slice(0, lastBracket + 1);
      try {
        parsed = JSON.parse(candidate);
        parsedOk = true;
        break;
      } catch {
        continue;
      }
    }
    if (!parsedOk) {
      throw new Error('LLM이 올바른 JSON을 반환하지 않았습니다.');
    }
  }

  return parsed
    .filter((tx): tx is Required<Pick<LLMTransaction, 'date' | 'merchant' | 'amount'>> & LLMTransaction =>
      typeof tx.date === 'string' && typeof tx.merchant === 'string' && typeof tx.amount === 'number'
    )
    .map((tx) => {
      const result: RawTransaction = {
        date: tx.date,
        merchant: tx.merchant,
        amount: Math.round(tx.amount),
      };
      if (typeof tx.installments === 'number' && tx.installments > 1) {
        result.installments = tx.installments;
      }
      return result;
    });
  } finally {
    clearTimeout(timeout);
  }
}
