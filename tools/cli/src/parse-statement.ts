import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
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
  readFile?: (filePath: string) => Promise<Uint8Array>;
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

function statementDigest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function assertSnapshotIntegrity(
  bytes: Buffer,
  expectedDigest: string,
): void {
  if (statementDigest(bytes) !== expectedDigest) {
    throw new Error(
      '명세서 바이트 스냅샷이 변경되었습니다. 원격 전송을 중단합니다.',
    );
  }
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
  const readStatementBytes = options.allowRemoteLLM
    ? (
        dependencies.readFile ??
        (dependencies.parseStatement === undefined ? readFile : undefined)
      )
    : undefined;
  const statementBytes = readStatementBytes
    ? await readStatementBytes(options.filePath)
    : undefined;
  // fs.readFile returns a uniquely owned Buffer, so production can adopt it
  // without another statement-sized copy. Copy non-Buffer views once to keep
  // an owned snapshot rather than retaining an arbitrary external backing
  // store.
  const capturedBytes = statementBytes === undefined
    ? undefined
    : Buffer.isBuffer(statementBytes)
      ? statementBytes
      : Buffer.from(statementBytes);
  const capturedDigest = capturedBytes
    ? statementDigest(capturedBytes)
    : undefined;
  const statementReadDependencies = capturedBytes
    ? {
        readFile: async () => capturedBytes,
        readPrefix: async (_filePath: string, maxBytes: number) =>
          capturedBytes.subarray(0, maxBytes),
      }
    : undefined;

  const localResult = await parse(options.filePath, {
    ...parserOptions,
    allowRemoteLLM: false,
  }, statementReadDependencies);

  if (!requiresRemoteLLM(localResult)) {
    return localResult;
  }

  if (capturedBytes && capturedDigest) {
    assertSnapshotIntegrity(capturedBytes, capturedDigest);
  }

  await authorize({
    allowRemoteLLM: options.allowRemoteLLM,
    yes: options.yes,
    documentIdentity: capturedBytes && capturedDigest
      ? `sha256:${capturedDigest} (${capturedBytes.length} bytes)`
      : undefined,
  });

  if (capturedBytes && capturedDigest) {
    assertSnapshotIntegrity(capturedBytes, capturedDigest);
  }

  const remoteResult = await parse(options.filePath, {
    ...parserOptions,
    allowRemoteLLM: true,
  }, statementReadDependencies);

  if (capturedBytes && capturedDigest) {
    assertSnapshotIntegrity(capturedBytes, capturedDigest);
  }

  return remoteResult;
}
