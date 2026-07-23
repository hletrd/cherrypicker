import { describe, test, expect } from 'bun:test';
import type Anthropic from '@anthropic-ai/sdk';
import {
  buildPDFLLMRequest,
  parsePDFLLMResponse,
  parsePDFWithLLM,
  PDF_LLM_MAX_OUTPUT_TOKENS,
} from '../src/pdf/llm-fallback.js';

function message(
  text: string,
  stopReason: Anthropic.Message['stop_reason'] = 'end_turn',
): Anthropic.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text, citations: null }],
    model: 'claude-sonnet-5',
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  } as Anthropic.Message;
}

describe('parsePDFWithLLM API key validation', () => {
  const originalKey = process.env['ANTHROPIC_API_KEY'];

  function restoreKey(): void {
    if (originalKey !== undefined) {
      process.env['ANTHROPIC_API_KEY'] = originalKey;
    } else {
      delete process.env['ANTHROPIC_API_KEY'];
    }
  }

  test('throws when API key is missing', async () => {
    delete process.env['ANTHROPIC_API_KEY'];
    await expect(parsePDFWithLLM('test')).rejects.toThrow('API 키가 설정되지 않아');
    restoreKey();
  });

  test('throws when API key has invalid prefix', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'invalid-key-12345';
    await expect(parsePDFWithLLM('test')).rejects.toThrow('sk-ant-');
    restoreKey();
  });

  test('throws when API key is too short', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-short';
    await expect(parsePDFWithLLM('test')).rejects.toThrow('sk-ant-');
    restoreKey();
  });

  test('accepts a well-formed key without making a live API request', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-api03-' + 'a'.repeat(95);
    const result = await parsePDFWithLLM('test', {
      createMessage: async () =>
        message('[{"date":"2026-07-23","merchant":"테스트","amount":1000}]'),
    });
    expect(result).toEqual([
      { date: '2026-07-23', merchant: '테스트', amount: 1000 },
    ]);
    restoreKey();
  });
});

describe('PDF Sonnet output contract', () => {
  test('disables thinking and reserves the structured-output budget', () => {
    const request = buildPDFLLMRequest('statement text', 'claude-sonnet-5');
    expect(request.model).toBe('claude-sonnet-5');
    expect(request.thinking).toEqual({ type: 'disabled' });
    expect(request.max_tokens).toBe(PDF_LLM_MAX_OUTPUT_TOKENS);
    expect(request.max_tokens).toBe(8192);
  });

  test('reports truncation before JSON parsing', () => {
    expect(() =>
      parsePDFLLMResponse(message('[{"partial":', 'max_tokens')),
    ).toThrow('토큰 한도에서 잘렸습니다');
  });

  test('keeps structural filtering for complete JSON responses', () => {
    const parsed = parsePDFLLMResponse(
      message(JSON.stringify([
        { date: '2026-07-23', merchant: '유효', amount: 1200, installments: 3 },
        { date: 'bad-date', merchant: '제외', amount: 500 },
        { date: '2026-02-31', merchant: '불가능한 날짜', amount: 500 },
        { date: '2026-07-24', merchant: '환불', amount: -100 },
        { date: '2026-07-24', merchant: '소수 금액', amount: 100.5 },
        {
          date: '2026-07-24',
          merchant: '안전하지 않은 정수',
          amount: Number.MAX_SAFE_INTEGER + 1,
        },
      ])),
    );
    expect(parsed).toEqual([
      {
        date: '2026-07-23',
        merchant: '유효',
        amount: 1200,
        installments: 3,
      },
    ]);
  });
});
