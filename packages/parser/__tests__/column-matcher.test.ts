import { describe, it, expect } from 'bun:test';
import {
  normalizeHeader,
  findColumn,
  isValidHeaderRow,
  DATE_COLUMN_PATTERN,
  MERCHANT_COLUMN_PATTERN,
  AMOUNT_COLUMN_PATTERN,
  INSTALLMENTS_COLUMN_PATTERN,
  CATEGORY_COLUMN_PATTERN,
  MEMO_COLUMN_PATTERN,
  HEADER_KEYWORDS,
  DATE_KEYWORDS,
  MERCHANT_KEYWORDS,
  AMOUNT_KEYWORDS,
} from '../src/csv/column-matcher';

// ---------------------------------------------------------------------------
// normalizeHeader
// ---------------------------------------------------------------------------
describe('normalizeHeader', () => {
  it('trims whitespace', () => {
    expect(normalizeHeader('  이용일  ')).toBe('이용일');
  });

  it('collapses internal whitespace', () => {
    expect(normalizeHeader('이용 금액')).toBe('이용금액');
  });

  it('removes parenthetical suffixes', () => {
    expect(normalizeHeader('이용금액(원)')).toBe('이용금액');
    expect(normalizeHeader('거래금액(Won)')).toBe('거래금액');
  });

  it('strips zero-width spaces (U+200B)', () => {
    expect(normalizeHeader('이​용​일')).toBe('이용일');
  });

  it('strips zero-width non-joiners (U+200C)', () => {
    expect(normalizeHeader('이‌용‌일')).toBe('이용일');
  });

  it('strips zero-width joiners (U+200D)', () => {
    expect(normalizeHeader('이‍용‍일')).toBe('이용일');
  });

  it('strips soft hyphens (U+00AD)', () => {
    expect(normalizeHeader('이­용­일')).toBe('이용일');
  });

  it('handles empty string', () => {
    expect(normalizeHeader('')).toBe('');
  });

  it('handles combination of issues', () => {
    expect(normalizeHeader('  이​용  금액(원)  ')).toBe('이용금액');
  });
});

// ---------------------------------------------------------------------------
// findColumn
// ---------------------------------------------------------------------------
describe('findColumn', () => {
  const headers = ['이용일', '이용처', '이용금액', '할부', '비고'];

  it('finds column by exact name', () => {
    expect(findColumn(headers, '이용일', DATE_COLUMN_PATTERN)).toBe(0);
    expect(findColumn(headers, '이용처', MERCHANT_COLUMN_PATTERN)).toBe(1);
    expect(findColumn(headers, '이용금액', AMOUNT_COLUMN_PATTERN)).toBe(2);
  });

  it('finds column by regex when exact name does not match', () => {
    // '거래일' is not in headers but matches DATE_COLUMN_PATTERN
    expect(findColumn(headers, '거래일', DATE_COLUMN_PATTERN)).toBe(0);
  });

  it('returns -1 when neither exact nor regex matches', () => {
    expect(findColumn(headers, 'nonexistent', CATEGORY_COLUMN_PATTERN)).toBe(-1);
  });

  it('prefers exact match over regex', () => {
    const mixed = ['날짜', '이용일', '거래일'];
    // '이용일' exact match should find index 1
    expect(findColumn(mixed, '이용일', DATE_COLUMN_PATTERN)).toBe(1);
  });

  it('handles undefined exactName by falling back to regex', () => {
    expect(findColumn(headers, undefined, DATE_COLUMN_PATTERN)).toBe(0);
  });

  it('handles empty headers array', () => {
    expect(findColumn([], '이용일', DATE_COLUMN_PATTERN)).toBe(-1);
  });

  it('normalizes headers before matching', () => {
    const spaced = ['이용 일', '이용 처', '이용 금액'];
    expect(findColumn(spaced, '이용일', DATE_COLUMN_PATTERN)).toBe(0);
    expect(findColumn(spaced, '이용금액', AMOUNT_COLUMN_PATTERN)).toBe(2);
  });

  it('handles parenthetical suffixes in headers', () => {
    const withSuffixes = ['이용일', '이용처', '이용금액(원)'];
    expect(findColumn(withSuffixes, '이용금액', AMOUNT_COLUMN_PATTERN)).toBe(2);
  });

  it('matches English column names case-insensitively', () => {
    const english = ['Date', 'Merchant', 'Amount'];
    expect(findColumn(english, undefined, DATE_COLUMN_PATTERN)).toBe(0);
    expect(findColumn(english, undefined, MERCHANT_COLUMN_PATTERN)).toBe(1);
    expect(findColumn(english, undefined, AMOUNT_COLUMN_PATTERN)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// isValidHeaderRow
// ---------------------------------------------------------------------------
describe('isValidHeaderRow', () => {
  it('accepts a standard Korean header row', () => {
    expect(isValidHeaderRow(['이용일', '이용처', '이용금액'])).toBe(true);
  });

  it('accepts a row with bank-specific column names', () => {
    expect(isValidHeaderRow(['거래일시', '가맹점명', '이용금액', '할부개월', '업종'])).toBe(true);
  });

  it('rejects a row with only amount keywords (summary row)', () => {
    expect(isValidHeaderRow(['이용금액', '거래금액', '합계'])).toBe(false);
  });

  it('rejects a row with only date keywords', () => {
    expect(isValidHeaderRow(['이용일', '거래일', '날짜'])).toBe(false);
  });

  it('rejects a row with no header keywords', () => {
    expect(isValidHeaderRow(['2024-01-15', '스타벅스', '5000'])).toBe(false);
  });

  it('accepts English header keywords', () => {
    expect(isValidHeaderRow(['Date', 'Merchant', 'Amount'])).toBe(true);
  });

  it('accepts mixed Korean and English', () => {
    expect(isValidHeaderRow(['이용일', 'Merchant', 'Amount'])).toBe(true);
  });

  it('requires at least 2 distinct categories', () => {
    // Only date + merchant = 2 categories (should pass)
    expect(isValidHeaderRow(['이용일', '이용처'])).toBe(true);
    // Only date = 1 category (should fail)
    expect(isValidHeaderRow(['이용일', '비고', '메모'])).toBe(false);
  });

  it('handles empty row', () => {
    expect(isValidHeaderRow([])).toBe(false);
  });

  it('normalizes headers before matching', () => {
    expect(isValidHeaderRow(['이용 일', '이용 처', '이용 금액'])).toBe(true);
  });

  it('handles parenthetical suffixes', () => {
    expect(isValidHeaderRow(['이용일', '이용처', '이용금액(원)'])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Column pattern constants
// ---------------------------------------------------------------------------
describe('DATE_COLUMN_PATTERN', () => {
  const shouldMatch = ['이용일', '이용일자', '거래일', '거래일시', '날짜', '일시', '결제일', '승인일', '승인일자', '매출일', 'date', 'Date', 'transaction_date', 'trans_date'];
  const shouldNotMatch = ['이용처', '금액', '할부', '스타벅스'];

  for (const name of shouldMatch) {
    it(`matches "${name}"`, () => {
      expect(DATE_COLUMN_PATTERN.test(name)).toBe(true);
    });
  }

  for (const name of shouldNotMatch) {
    it(`does not match "${name}"`, () => {
      expect(DATE_COLUMN_PATTERN.test(name)).toBe(false);
    });
  }
});

describe('MERCHANT_COLUMN_PATTERN', () => {
  const shouldMatch = ['이용처', '가맹점', '가맹점명', '이용가맹점', '거래처', '매출처', '사용처', '결제처', '상호', 'merchant', 'Merchant', 'store', 'description'];
  const shouldNotMatch = ['이용일', '금액', '할부', '날짜'];

  for (const name of shouldMatch) {
    it(`matches "${name}"`, () => {
      expect(MERCHANT_COLUMN_PATTERN.test(name)).toBe(true);
    });
  }

  for (const name of shouldNotMatch) {
    it(`does not match "${name}"`, () => {
      expect(MERCHANT_COLUMN_PATTERN.test(name)).toBe(false);
    });
  }
});

describe('AMOUNT_COLUMN_PATTERN', () => {
  const shouldMatch = ['이용금액', '거래금액', '금액', '결제금액', '승인금액', '매출금액', '이용액', 'amount', 'Amount', 'total'];
  const shouldNotMatch = ['이용일', '이용처', '할부', '날짜'];

  for (const name of shouldMatch) {
    it(`matches "${name}"`, () => {
      expect(AMOUNT_COLUMN_PATTERN.test(name)).toBe(true);
    });
  }

  for (const name of shouldNotMatch) {
    it(`does not match "${name}"`, () => {
      expect(AMOUNT_COLUMN_PATTERN.test(name)).toBe(false);
    });
  }
});

describe('INSTALLMENTS_COLUMN_PATTERN', () => {
  const shouldMatch = ['할부', '할부개월', '할부기간', '할부월', '할부개월수', 'installment', 'installments'];
  const shouldNotMatch = ['이용일', '금액', '이용처'];

  for (const name of shouldMatch) {
    it(`matches "${name}"`, () => {
      expect(INSTALLMENTS_COLUMN_PATTERN.test(name)).toBe(true);
    });
  }

  for (const name of shouldNotMatch) {
    it(`does not match "${name}"`, () => {
      expect(INSTALLMENTS_COLUMN_PATTERN.test(name)).toBe(false);
    });
  }
});

describe('CATEGORY_COLUMN_PATTERN', () => {
  const shouldMatch = ['업종', '카테고리', '분류', '업종분류', '업종명', 'category', 'type'];
  const shouldNotMatch = ['이용일', '금액', '이용처'];

  for (const name of shouldMatch) {
    it(`matches "${name}"`, () => {
      expect(CATEGORY_COLUMN_PATTERN.test(name)).toBe(true);
    });
  }

  for (const name of shouldNotMatch) {
    it(`does not match "${name}"`, () => {
      expect(CATEGORY_COLUMN_PATTERN.test(name)).toBe(false);
    });
  }
});

describe('MEMO_COLUMN_PATTERN', () => {
  const shouldMatch = ['비고', '적요', '메모', '내용', '설명', '참고', 'memo', 'note', 'remark', 'remarks'];
  const shouldNotMatch = ['이용일', '금액', '이용처'];

  for (const name of shouldMatch) {
    it(`matches "${name}"`, () => {
      expect(MEMO_COLUMN_PATTERN.test(name)).toBe(true);
    });
  }

  for (const name of shouldNotMatch) {
    it(`does not match "${name}"`, () => {
      expect(MEMO_COLUMN_PATTERN.test(name)).toBe(false);
    });
  }
});

// ---------------------------------------------------------------------------
// Keyword Sets
// ---------------------------------------------------------------------------
describe('HEADER_KEYWORDS', () => {
  it('contains Korean date keywords', () => {
    expect(HEADER_KEYWORDS).toContain('이용일');
    expect(HEADER_KEYWORDS).toContain('거래일');
  });

  it('contains Korean merchant keywords', () => {
    expect(HEADER_KEYWORDS).toContain('이용처');
    expect(HEADER_KEYWORDS).toContain('가맹점');
  });

  it('contains Korean amount keywords', () => {
    expect(HEADER_KEYWORDS).toContain('이용금액');
    expect(HEADER_KEYWORDS).toContain('거래금액');
  });

  it('contains English keywords', () => {
    expect(HEADER_KEYWORDS).toContain('date');
    expect(HEADER_KEYWORDS).toContain('merchant');
    expect(HEADER_KEYWORDS).toContain('amount');
  });
});

describe('Keyword category Sets', () => {
  it('DATE_KEYWORDS contains expected entries', () => {
    expect(DATE_KEYWORDS.has('이용일')).toBe(true);
    expect(DATE_KEYWORDS.has('date')).toBe(true);
    expect(DATE_KEYWORDS.has('이용처')).toBe(false);
  });

  it('MERCHANT_KEYWORDS contains expected entries', () => {
    expect(MERCHANT_KEYWORDS.has('이용처')).toBe(true);
    expect(MERCHANT_KEYWORDS.has('merchant')).toBe(true);
    expect(MERCHANT_KEYWORDS.has('이용일')).toBe(false);
  });

  it('AMOUNT_KEYWORDS contains expected entries', () => {
    expect(AMOUNT_KEYWORDS.has('이용금액')).toBe(true);
    expect(AMOUNT_KEYWORDS.has('amount')).toBe(true);
    expect(AMOUNT_KEYWORDS.has('이용일')).toBe(false);
  });
});