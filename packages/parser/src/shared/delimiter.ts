export const DELIMITER_SAMPLE_LINE_LIMIT = 30;

export interface DelimiterLineSample {
  lines: string[];
  /**
   * Exclusive end offset of the input prefix inspected by the sampler.
   * Exposed so parity tests can lock the bounded-read contract.
   */
  consumedLength: number;
}

export function sampleNonEmptyDelimitedLines(
  content: string,
  maxLines = DELIMITER_SAMPLE_LINE_LIMIT,
): DelimiterLineSample {
  if (maxLines <= 0 || content.length === 0) {
    return { lines: [], consumedLength: 0 };
  }

  const lines: string[] = [];
  let offset = 0;
  let consumedLength = 0;

  while (offset <= content.length && lines.length < maxLines) {
    const newline = content.indexOf('\n', offset);
    const end = newline === -1 ? content.length : newline;
    const line = content.slice(offset, end).trim();
    consumedLength = newline === -1 ? end : end + 1;
    if (line.length > 0) lines.push(line);
    if (newline === -1) break;
    offset = newline + 1;
  }

  return { lines, consumedLength };
}

export function detectDelimitedTextDelimiter(content: string): string {
  const { lines } = sampleNonEmptyDelimitedLines(content);
  let totalComma = 0;
  let totalTab = 0;
  let totalPipe = 0;
  let totalSemicolon = 0;

  for (const line of lines) {
    for (let index = 0; index < line.length; index++) {
      switch (line.charCodeAt(index)) {
        case 0x2c:
          totalComma++;
          break;
        case 0x09:
          totalTab++;
          break;
        case 0x7c:
          totalPipe++;
          break;
        case 0x3b:
          totalSemicolon++;
          break;
      }
    }
  }

  if (
    totalComma === 0
    && totalTab === 0
    && totalPipe === 0
    && totalSemicolon === 0
  ) {
    return ',';
  }
  if (
    totalTab > totalComma
    && totalTab >= totalPipe
    && totalTab >= totalSemicolon
  ) {
    return '\t';
  }
  if (totalPipe > totalComma && totalPipe >= totalSemicolon) return '|';
  if (totalSemicolon > totalComma) return ';';
  return ',';
}
