import Anthropic from '@anthropic-ai/sdk';
import { isValidISODate } from '../date-utils.js';
import type { RawTransaction } from '../types.js';
import {
  normalizeRequiredMerchant,
  REQUIRED_MERCHANT_ERROR_CODE,
} from '../shared/required-fields.js';

/** Sanitize raw text before sending to LLM to mitigate prompt injection.
 *  Removes or neutralizes common injection patterns found in malicious
 *  PDFs or crafted statements (C33-F3). */
function sanitizeLLMInput(text: string): string {
  // Strip common prompt injection prefixes and instructions.
  // This is defense-in-depth; the system prompt also constrains behavior.
  const injectionPatterns = [
    /ignore\s+(all|previous)\s+(instructions?|prompts?)/gi,
    /forget\s+(all|your)\s+(instructions?|prompts?)/gi,
    /you\s+are\s+now\s+a/gi,
    / disregard\s+the\s+above/gi,
    /\[system\s*:\s*[^\]]*\]/gi,
    /<\/?system>/gi,
    /new\s+instructions?:/gi,
    /override\s+previous/gi,
  ];
  let cleaned = text;
  for (const pattern of injectionPatterns) {
    cleaned = cleaned.replace(pattern, '[REDACTED]');
  }
  return cleaned;
}

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

// The request is sent as one complete prompt. Do not advertise a larger
// ceiling than we can transmit without truncation.
export const PDF_LLM_MAX_INPUT_CHARS = 8_000;
export const PDF_LLM_MAX_OUTPUT_TOKENS = 8_192;

export function buildPDFLLMRequest(
  text: string,
  model = process.env['ANTHROPIC_MODEL'] ?? 'claude-sonnet-5',
): Anthropic.MessageCreateParamsNonStreaming {
  if (text.length > PDF_LLM_MAX_INPUT_CHARS) {
    throw new Error(
      `PDF 텍스트가 너무 깁니다 (${text.length} > ${PDF_LLM_MAX_INPUT_CHARS} 글자). LLM 폴백을 사용할 수 없습니다.`,
    );
  }

  const sanitized = sanitizeLLMInput(text);

  return {
    model,
    // Complete machine-readable JSON is more important than hidden reasoning
    // here, so reserve the full ceiling for output.
    thinking: { type: 'disabled' },
    max_tokens: PDF_LLM_MAX_OUTPUT_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `다음은 신용카드 명세서에서 추출한 텍스트입니다. 거래 내역을 JSON 배열로 파싱해 주세요:\n\n${sanitized}`,
      },
    ],
  };
}

export function parsePDFLLMResponse(message: Anthropic.Message): RawTransaction[] {
  if (message.stop_reason === 'max_tokens') {
    throw new Error(
      `Claude PDF 파싱 응답이 ${PDF_LLM_MAX_OUTPUT_TOKENS} 토큰 한도에서 잘렸습니다.`,
    );
  }

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

  // Guard against extremely large responses that could cause memory issues (C31-SEC02)
  const MAX_JSON_LENGTH = 100_000;
  if (jsonMatch[0].length > MAX_JSON_LENGTH) {
    throw new Error(`LLM 응답이 너무 깁니다 (${jsonMatch[0].length} > ${MAX_JSON_LENGTH}).`);
  }

  let parsed: LLMTransaction[] = [];
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

  // Structural validation: must be an array of objects (C31-SEC02/C31-CR05)
  if (!Array.isArray(parsed) || !parsed.every((tx) => tx !== null && typeof tx === 'object')) {
    throw new Error('LLM 응답이 객체 배열이 아닙니다.');
  }

  const invalidRows: number[] = [];
  const missingMerchantRows: number[] = [];
  for (const [index, tx] of parsed.entries()) {
    const merchant = normalizeRequiredMerchant(tx.merchant);
    if (!merchant) missingMerchantRows.push(index + 1);
    if (
      typeof tx.date !== 'string' ||
      typeof tx.merchant !== 'string' ||
      !merchant ||
      typeof tx.amount !== 'number' ||
      !isValidISODate(tx.date) ||
      !Number.isSafeInteger(tx.amount) ||
      tx.amount <= 0 ||
      (tx.installments !== undefined &&
        (typeof tx.installments !== 'number' ||
          !Number.isInteger(tx.installments) ||
          tx.installments <= 0))
    ) {
      invalidRows.push(index + 1);
    }
  }
  if (invalidRows.length > 0) {
    const error = new Error(
      `LLM 응답 ${parsed.length}개 행 중 ${invalidRows.length}개가 올바르지 않습니다: ${invalidRows.join(', ')}행`,
    );
    if (missingMerchantRows.length > 0) {
      Object.assign(error, { code: REQUIRED_MERCHANT_ERROR_CODE });
    }
    throw error;
  }

  return parsed.map((tx) => {
      const result: RawTransaction = {
        date: tx.date!,
        merchant: normalizeRequiredMerchant(tx.merchant),
        amount: tx.amount!,
      };
      if (typeof tx.installments === 'number' && tx.installments > 1) {
        result.installments = tx.installments;
      }
      return result;
    });
}

export type PDFMessageCreate = (
  request: Anthropic.MessageCreateParamsNonStreaming,
  options: { signal: AbortSignal },
) => Promise<Anthropic.Message>;

export interface PDFLLMOptions {
  createMessage?: PDFMessageCreate;
}

export async function parsePDFWithLLM(
  text: string,
  options: PDFLLMOptions = {},
): Promise<RawTransaction[]> {
  if (typeof window !== 'undefined') {
    throw new Error('LLM fallback is not available in browser environments');
  }

  const apiKey = process.env['ANTHROPIC_API_KEY']?.trim();
  if (!apiKey) {
    throw new Error('API 키가 설정되지 않아 LLM 폴백을 사용할 수 없습니다.');
  }
  // Stricter regex matching Anthropic key format: sk-ant-api03-... (90+ chars after hyphen)
  if (!/^sk-ant-api[0-9]{2,}-[A-Za-z0-9_-]{90,}$/.test(apiKey)) {
    throw new Error(
      'ANTHROPIC_API_KEY 형식이 올바르지 않습니다. 키는 "sk-ant-api03-..." 형식이어야 합니다.'
    );
  }

  const request = buildPDFLLMRequest(text);
  const client = options.createMessage ? undefined : new Anthropic({ apiKey });
  const createMessage = options.createMessage ??
    ((params: Anthropic.MessageCreateParamsNonStreaming, requestOptions: { signal: AbortSignal }) =>
      client!.messages.create(params, requestOptions));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const message = await createMessage(
      request,
      { signal: controller.signal },
    );
    return parsePDFLLMResponse(message);
  } finally {
    clearTimeout(timeout);
  }
}
