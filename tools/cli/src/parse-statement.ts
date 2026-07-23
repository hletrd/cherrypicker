import { parseStatement } from '@cherrypicker/parser/statement';
import type { BankId, ParseResult } from '@cherrypicker/parser/types';
import {
  authorizeRemoteLLMFallback,
  type RemoteLLMConsentOptions,
} from './consent.js';

export const REMOTE_LLM_REQUIRED = 'REMOTE_LLM_REQUIRED';

export interface LocalFirstParseOptions {
  filePath: string;
  bank?: BankId;
  allowRemoteLLM: boolean;
  yes: boolean;
}

export type StatementParser = typeof parseStatement;
export type RemoteFallbackAuthorizer = (options: RemoteLLMConsentOptions) => Promise<void>;

export interface LocalFirstParseDependencies {
  parseStatement?: StatementParser;
  authorizeRemoteFallback?: RemoteFallbackAuthorizer;
}

function requiresRemoteLLM(result: ParseResult): boolean {
  if (result.transactions.length > 0) {
    return false;
  }

  return result.errors.some((error) => {
    const errorWithCode = error as typeof error & { code?: unknown };
    return errorWithCode.code === REMOTE_LLM_REQUIRED;
  });
}

/**
 * Parse locally first and retry remotely only after the parser returns the
 * typed fallback signal and the caller authorizes data transmission.
 */
export async function parseStatementLocalFirst(
  options: LocalFirstParseOptions,
  dependencies: LocalFirstParseDependencies = {},
): Promise<ParseResult> {
  const parse = dependencies.parseStatement ?? parseStatement;
  const authorize = dependencies.authorizeRemoteFallback ?? authorizeRemoteLLMFallback;
  const parserOptions = options.bank ? { bank: options.bank } : {};

  const localResult = await parse(options.filePath, {
    ...parserOptions,
    allowRemoteLLM: false,
  });

  if (!requiresRemoteLLM(localResult)) {
    return localResult;
  }

  await authorize({
    allowRemoteLLM: options.allowRemoteLLM,
    yes: options.yes,
  });

  return parse(options.filePath, {
    ...parserOptions,
    allowRemoteLLM: true,
  });
}
