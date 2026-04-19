// Korean date pattern (anchored to match standalone dates)
const DATE_PATTERN = /^\d{4}[.\-\/]\d{1,2}[.\-\/]\d{1,2}$/;
// Korean amount pattern
const AMOUNT_PATTERN = /[\d,]+원?/;

interface Column {
  start: number;
  end: number;
}

/**
 * Detect column boundaries from whitespace analysis across multiple lines.
 * Finds positions that are consistently whitespace (column separators).
 */
function detectColumnBoundaries(lines: string[]): Column[] {
  if (lines.length === 0) return [];

  const maxLen = lines.reduce((max, l) => Math.max(max, l.length), 0);
  if (maxLen === 0) return [];
  // Count non-space characters at each position
  const charCount = new Array<number>(maxLen).fill(0);

  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      if (line[i] !== ' ') charCount[i] = (charCount[i] ?? 0) + 1;
    }
  }

  // A column boundary is a position where most lines have a space
  const threshold = lines.length * 0.3;
  const boundaries: number[] = [0];

  for (let i = 1; i < maxLen - 1; i++) {
    const count = charCount[i] ?? 0;
    const prevCount = charCount[i - 1] ?? 0;
    const nextCount = charCount[i + 1] ?? 0;

    // Transition from dense chars to sparse = column boundary
    if (prevCount > threshold && count <= threshold) {
      boundaries.push(i);
    }
  }
  boundaries.push(maxLen);

  const columns: Column[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i] ?? 0;
    const end = boundaries[i + 1] ?? maxLen;
    if (end - start > 1) {
      columns.push({ start, end });
    }
  }

  return columns;
}

/**
 * Split a line into cells based on detected column boundaries.
 */
function splitByColumns(line: string, columns: Column[]): string[] {
  return columns.map((col) => line.slice(col.start, col.end).trim());
}

/**
 * Parse table structure from raw PDF text.
 * Returns a 2D array of cell values.
 */
export function parseTable(text: string): string[][] {
  const lines = text.split('\n');
  const result: string[][] = [];

  // Find lines that look like table rows (contain dates or amounts)
  const tableLines: string[] = [];
  let inTable = false;
  let consecutiveBlankLines = 0;

  for (const line of lines) {
    const hasDate = DATE_PATTERN.test(line);
    const hasAmount = AMOUNT_PATTERN.test(line);

    if (hasDate || hasAmount) {
      inTable = true;
      consecutiveBlankLines = 0;
    }

    if (inTable && line.trim()) {
      tableLines.push(line);
      consecutiveBlankLines = 0;
    } else if (inTable && !line.trim()) {
      consecutiveBlankLines++;
      // End of table: 2+ consecutive blank lines after content.
      // A single blank line may be a gap within the table (e.g., between
      // monthly groups in Korean credit card PDFs), not the end.
      if (consecutiveBlankLines >= 2 && tableLines.length > 3) break;
    }
  }

  if (tableLines.length === 0) {
    // Fall back: split all non-empty lines by whitespace clusters
    for (const line of lines) {
      if (!line.trim()) continue;
      const cells = line.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
      if (cells.length > 1) result.push(cells);
    }
    return result;
  }

  // Detect column structure from table lines
  const columns = detectColumnBoundaries(tableLines);

  if (columns.length <= 1) {
    // Fall back to whitespace splitting
    for (const line of tableLines) {
      const cells = line.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
      if (cells.length > 0) result.push(cells);
    }
    return result;
  }

  for (const line of tableLines) {
    const cells = splitByColumns(line, columns);
    if (cells.some((c) => c.length > 0)) {
      result.push(cells);
    }
  }

  return result;
}

/**
 * Find rows in parsed table that look like transaction rows.
 */
export function filterTransactionRows(rows: string[][]): string[][] {
  return rows.filter((row) => {
    const hasDate = row.some((cell) => DATE_PATTERN.test(cell));
    const hasAmount = row.some((cell) => AMOUNT_PATTERN.test(cell));
    return hasDate && hasAmount;
  });
}
