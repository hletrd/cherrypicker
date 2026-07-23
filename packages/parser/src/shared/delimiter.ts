export const DELIMITER_SAMPLE_LINE_LIMIT = 30;
export const DELIMITER_SAMPLE_CHARACTER_LIMIT = 64 * 1024;
const DELIMITER_CANDIDATES = [',', '\t', '|', ';'] as const;

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
  let recordStart = 0;
  let consumedLength = 0;
  let inQuotes = false;
  let atPotentialFieldStart = true;
  const scanLimit = Math.min(content.length, DELIMITER_SAMPLE_CHARACTER_LIMIT);

  for (let index = 0; index < scanLimit && lines.length < maxLines; index++) {
    const char = content[index]!;
    if (inQuotes && char === '"') {
      if (content[index + 1] === '"') {
        index++;
      } else {
        inQuotes = false;
        atPotentialFieldStart = false;
      }
      continue;
    }
    if (inQuotes) continue;
    if (char === '"' && atPotentialFieldStart) {
      inQuotes = true;
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      const record = content.slice(recordStart, index).trim();
      const isCRLF = char === '\r' && content[index + 1] === '\n';
      if (isCRLF) index++;
      consumedLength = index + 1;
      recordStart = index + 1;
      atPotentialFieldStart = true;
      if (record.length > 0) lines.push(record);
      continue;
    }
    if ((DELIMITER_CANDIDATES as readonly string[]).includes(char)) {
      atPotentialFieldStart = true;
    } else if (!/\s/.test(char)) {
      atPotentialFieldStart = false;
    }
  }

  if (lines.length < maxLines && recordStart < scanLimit) {
    const record = content.slice(recordStart, scanLimit).trim();
    consumedLength = scanLimit;
    if (record.length > 0) lines.push(record);
  }

  return { lines, consumedLength };
}

function countDelimitedColumns(record: string, delimiter: string): number {
  let columns = 1;
  let inQuotes = false;
  let atFieldStart = true;
  for (let index = 0; index < record.length; index++) {
    const char = record[index]!;
    if (inQuotes) {
      if (char !== '"') continue;
      if (record[index + 1] === '"') {
        index++;
      } else {
        inQuotes = false;
        atFieldStart = false;
      }
    } else if (char === '"' && atFieldStart) {
      inQuotes = true;
    } else if ((DELIMITER_CANDIDATES as readonly string[]).includes(char)) {
      if (char === delimiter) columns++;
      atFieldStart = true;
    } else if (!/\s/.test(char)) {
      atFieldStart = false;
    }
  }
  return columns;
}

export function splitDelimitedRecord(
  record: string,
  delimiter: string,
): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let atFieldStart = true;

  for (let index = 0; index < record.length; index++) {
    const char = record[index]!;
    if (inQuotes) {
      if (char === '"' && record[index + 1] === '"') {
        current += '"';
        index++;
      } else if (char === '"') {
        inQuotes = false;
        atFieldStart = false;
      } else {
        current += char;
      }
    } else if (char === '"' && atFieldStart) {
      inQuotes = true;
    } else if (char === delimiter) {
      result.push(current.trim());
      current = '';
      atFieldStart = true;
    } else {
      current += char;
      if (!/\s/.test(char)) atFieldStart = false;
    }
  }

  result.push(current.trim());
  return result;
}

export interface DelimitedLogicalRecord {
  content: string;
  line: number;
}

function normalizeDelimitedRecordNewlines(record: string): string {
  return record.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function splitDelimitedRecordsWithLines(
  content: string,
  delimiter: string,
): DelimitedLogicalRecord[] {
  const records: DelimitedLogicalRecord[] = [];
  let recordStart = 0;
  let recordLine = 1;
  let physicalLine = 1;
  let inQuotes = false;
  let atFieldStart = true;

  for (let index = 0; index < content.length; index++) {
    const char = content[index]!;
    if (char === '\n' || char === '\r') {
      const recordEnd = index;
      const isCRLF = char === '\r' && content[index + 1] === '\n';
      physicalLine++;
      if (!inQuotes) {
        const record = content.slice(recordStart, recordEnd);
        if (record.trim()) {
          records.push({
            content: normalizeDelimitedRecordNewlines(record),
            line: recordLine,
          });
        }
        if (isCRLF) index++;
        recordStart = index + 1;
        recordLine = physicalLine;
        atFieldStart = true;
      } else if (isCRLF) {
        index++;
      }
      continue;
    }
    if (inQuotes) {
      if (char !== '"') continue;
      if (content[index + 1] === '"') {
        index++;
      } else {
        inQuotes = false;
        atFieldStart = false;
      }
      continue;
    }
    if (char === '"' && atFieldStart) {
      inQuotes = true;
    } else if (char === delimiter) {
      atFieldStart = true;
    } else if (!/\s/.test(char)) {
      atFieldStart = false;
    }
  }

  if (recordStart < content.length) {
    const record = content.slice(recordStart);
    if (record.trim()) {
      records.push({
        content: normalizeDelimitedRecordNewlines(record),
        line: recordLine,
      });
    }
  }
  return records;
}

export function splitDelimitedRecords(
  content: string,
  delimiter: string,
): string[] {
  return splitDelimitedRecordsWithLines(content, delimiter).map(
    (record) => record.content,
  );
}

interface DelimiterScore {
  delimiter: string;
  stableRecords: number;
  unstableRecords: number;
  columns: number;
}

function scoreDelimiter(lines: string[], delimiter: string): DelimiterScore {
  const frequencies = new Map<number, number>();
  let delimitedRecords = 0;

  for (const line of lines) {
    const columns = countDelimitedColumns(line, delimiter);
    if (columns <= 1) continue;
    delimitedRecords++;
    frequencies.set(columns, (frequencies.get(columns) ?? 0) + 1);
  }

  let columns = 1;
  let stableRecords = 0;
  for (const [candidateColumns, frequency] of frequencies) {
    if (
      frequency > stableRecords
      || (frequency === stableRecords && candidateColumns > columns)
    ) {
      columns = candidateColumns;
      stableRecords = frequency;
    }
  }

  return {
    delimiter,
    stableRecords,
    unstableRecords: delimitedRecords - stableRecords,
    columns,
  };
}

function isBetterDelimiterScore(
  candidate: DelimiterScore,
  current: DelimiterScore,
): boolean {
  if (candidate.stableRecords !== current.stableRecords) {
    return candidate.stableRecords > current.stableRecords;
  }
  if (candidate.unstableRecords !== current.unstableRecords) {
    return candidate.unstableRecords < current.unstableRecords;
  }
  return candidate.columns > current.columns;
}

export function detectDelimitedTextDelimiter(content: string): string {
  const { lines } = sampleNonEmptyDelimitedLines(content);
  let best = scoreDelimiter(lines, DELIMITER_CANDIDATES[0]);
  for (let index = 1; index < DELIMITER_CANDIDATES.length; index++) {
    const candidate = scoreDelimiter(lines, DELIMITER_CANDIDATES[index]!);
    if (isBetterDelimiterScore(candidate, best)) best = candidate;
  }
  return best.stableRecords > 0 ? best.delimiter : ',';
}
