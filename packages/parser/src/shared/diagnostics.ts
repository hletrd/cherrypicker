export const MAX_PARSE_DIAGNOSTICS = 100;
export const MAX_PARSE_DIAGNOSTIC_EXAMPLES = MAX_PARSE_DIAGNOSTICS - 1;
export const MAX_PARSE_DIAGNOSTIC_MESSAGE_LENGTH = 1_024;
export const MAX_PARSE_DIAGNOSTIC_RAW_LENGTH = 2_048;
export const PARSE_DIAGNOSTICS_OMITTED_ERROR_CODE =
  'parse_diagnostics_omitted';
export const PARSE_DIAGNOSTICS_OMITTED_MESSAGE =
  '나머지 파싱 경고를 요약했어요.';

export interface BoundedParseDiagnostic {
  message: string;
  raw?: string;
  count?: number;
}

function diagnosticCount(diagnostic: BoundedParseDiagnostic): number {
  return Number.isSafeInteger(diagnostic.count)
    && diagnostic.count !== undefined
    && diagnostic.count > 0
    ? diagnostic.count
    : 1;
}

function safeAdd(left: number, right: number): number {
  return Math.min(Number.MAX_SAFE_INTEGER, left + right);
}

function truncate(value: string | undefined, maximum: number): string | undefined {
  if (value === undefined || value.length <= maximum) return value;
  return `${value.slice(0, maximum - 1)}…`;
}

export function truncateParseDiagnosticRaw(
  value: string | undefined,
): string | undefined {
  return truncate(value, MAX_PARSE_DIAGNOSTIC_RAW_LENGTH);
}

/**
 * Creates a plain Array-compatible diagnostic sink. Keeping Array.prototype
 * preserves the public `ParseError[]` contract across assertion/clone
 * implementations, while the owned mutators bound every source append.
 */
export function createBoundedDiagnosticArray<
  T extends BoundedParseDiagnostic,
>(
  summaryFactory: (omittedCount: number) => T,
): T[] {
  const values: T[] = [];
  let omittedCount = 0;

  const push = (...diagnostics: T[]): number => {
    for (const diagnostic of diagnostics) {
      diagnostic.message =
        truncate(diagnostic.message, MAX_PARSE_DIAGNOSTIC_MESSAGE_LENGTH) ?? '';
      diagnostic.raw = truncateParseDiagnosticRaw(diagnostic.raw);
      if (values.length < MAX_PARSE_DIAGNOSTIC_EXAMPLES) {
        Array.prototype.push.call(values, diagnostic);
        continue;
      }

      omittedCount = safeAdd(
        omittedCount,
        diagnosticCount(diagnostic),
      );
      const summary = summaryFactory(omittedCount);
      if (values.length === MAX_PARSE_DIAGNOSTIC_EXAMPLES) {
        Array.prototype.push.call(values, summary);
      } else {
        values[MAX_PARSE_DIAGNOSTICS - 1] = summary;
      }
    }
    return values.length;
  };

  const unshift = (...diagnostics: T[]): number => {
    for (let index = diagnostics.length - 1; index >= 0; index -= 1) {
      const diagnostic = diagnostics[index]!;
      diagnostic.message =
        truncate(diagnostic.message, MAX_PARSE_DIAGNOSTIC_MESSAGE_LENGTH) ?? '';
      diagnostic.raw = truncateParseDiagnosticRaw(diagnostic.raw);
      if (values.length < MAX_PARSE_DIAGNOSTIC_EXAMPLES) {
        Array.prototype.unshift.call(values, diagnostic);
        continue;
      }

      if (values.length === MAX_PARSE_DIAGNOSTICS) {
        Array.prototype.pop.call(values);
      }
      const displaced = Array.prototype.pop.call(values);
      if (displaced) {
        omittedCount = safeAdd(
          omittedCount,
          diagnosticCount(displaced),
        );
      }
      Array.prototype.unshift.call(values, diagnostic);
      Array.prototype.push.call(values, summaryFactory(omittedCount));
    }
    return values.length;
  };

  Object.defineProperties(values, {
    push: { value: push },
    unshift: { value: unshift },
  });
  return values;
}
