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
  SUMMARY_ROW_PATTERN,
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

  it('strips tab characters (U+0009)', () => {
    expect(normalizeHeader('이용\t일')).toBe('이용일');
    expect(normalizeHeader('\t이용금액\t')).toBe('이용금액');
  });

  it('strips newline characters (U+000A, U+000D)', () => {
    expect(normalizeHeader('이용\n일')).toBe('이용일');
    expect(normalizeHeader('이용\r\n금액')).toBe('이용금액');
  });

  it('strips mixed invisible and whitespace characters', () => {
    expect(normalizeHeader('  이\t용\n 금액(원)  ')).toBe('이용금액');
  });

  it('strips no-break spaces (U+00A0)', () => {
    // NBSP commonly appears in Korean bank exports copied from web pages
    expect(normalizeHeader('이용 금액')).toBe('이용금액');
    expect(normalizeHeader(' 이용일 ')).toBe('이용일');
    expect(normalizeHeader('이용  일')).toBe('이용일');
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

  it('rejects approval total summary row as header (C25)', () => {
    expect(isValidHeaderRow(['승인합계', '100,000'])).toBe(false);
    expect(isValidHeaderRow(['결제합계', '50,000'])).toBe(false);
  });

  it('rejects total usage summary row as header (C25)', () => {
    expect(isValidHeaderRow(['총사용', '200,000'])).toBe(false);
    expect(isValidHeaderRow(['총이용', '200,000'])).toBe(false);
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
  const shouldMatch = ['이용일', '이용일자', '거래일', '거래일시', '날짜', '일시', '결제일', '승인일', '승인일자', '매출일', '작성일', 'date', 'Date', 'transaction_date', 'trans_date'];
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
  const shouldMatch = ['이용처', '가맹점', '가맹점명', '이용가맹점', '거래처', '매출처', '사용처', '결제처', '상호', '판매처', '구매처', '매장', '취급처', 'merchant', 'Merchant', 'store', 'description', 'vendor', 'item'];
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

// ---------------------------------------------------------------------------
// SUMMARY_ROW_PATTERN
// ---------------------------------------------------------------------------
describe('SUMMARY_ROW_PATTERN', () => {
  it('matches Korean summary variants', () => {
    const variants = ['총 합계', '합 계', '총 계', '소 계', '합계', '총계', '소계', '누계', '잔액', '당월', '명세'];
    for (const v of variants) {
      expect(SUMMARY_ROW_PATTERN.test(v)).toBe(true);
    }
  });

  it('matches English summary variants', () => {
    expect(SUMMARY_ROW_PATTERN.test('total')).toBe(true);
    expect(SUMMARY_ROW_PATTERN.test('Total')).toBe(true);
    expect(SUMMARY_ROW_PATTERN.test('sum')).toBe(true);
    expect(SUMMARY_ROW_PATTERN.test('SUM')).toBe(true);
  });

  it('matches summary text within longer strings', () => {
    expect(SUMMARY_ROW_PATTERN.test('총 합계 100,000원')).toBe(true);
    expect(SUMMARY_ROW_PATTERN.test('2026-02-01 합계 50,000')).toBe(true);
  });

  it('does not match normal transaction text', () => {
    expect(SUMMARY_ROW_PATTERN.test('스타벅스 강남점')).toBe(false);
    expect(SUMMARY_ROW_PATTERN.test('이마트 서초점')).toBe(false);
    expect(SUMMARY_ROW_PATTERN.test('2026-02-01')).toBe(false);
  });

  it('matches approval/payment total variants (C24)', () => {
    expect(SUMMARY_ROW_PATTERN.test('승인 합계')).toBe(true);
    expect(SUMMARY_ROW_PATTERN.test('승인합계')).toBe(true);
    expect(SUMMARY_ROW_PATTERN.test('결제 합계')).toBe(true);
    expect(SUMMARY_ROW_PATTERN.test('결제합계')).toBe(true);
  });

  it('matches total usage variants (C24)', () => {
    expect(SUMMARY_ROW_PATTERN.test('총 사용')).toBe(true);
    expect(SUMMARY_ROW_PATTERN.test('총사용')).toBe(true);
    expect(SUMMARY_ROW_PATTERN.test('총 이용')).toBe(true);
    expect(SUMMARY_ROW_PATTERN.test('총이용')).toBe(true);
    expect(SUMMARY_ROW_PATTERN.test('총 사용 100,000원')).toBe(true);
  });

  it('matches summary keywords followed by CSV delimiters (C30-01)', () => {
    expect(SUMMARY_ROW_PATTERN.test('합계,,,,123456')).toBe(true);
    expect(SUMMARY_ROW_PATTERN.test('총 합계,,,,123456')).toBe(true);
    expect(SUMMARY_ROW_PATTERN.test('합계;123456')).toBe(true);
  });

  it('does not match merchant names containing summary keywords (C30-01)', () => {
    // "합계마트" — "합계" is followed by Korean text, not a boundary
    expect(SUMMARY_ROW_PATTERN.test('합계마트')).toBe(false);
    // "소비마트" — "소비" removed from pattern entirely
    expect(SUMMARY_ROW_PATTERN.test('소비마트')).toBe(false);
    // "합계부" — "합계" followed by Korean character
    expect(SUMMARY_ROW_PATTERN.test('합계부')).toBe(false);
    // Embedded in a CSV line with merchant name
    expect(SUMMARY_ROW_PATTERN.test('2024-01-15,합계마트,5000')).toBe(false);
    expect(SUMMARY_ROW_PATTERN.test('2024-01-15,소비마트,5000')).toBe(false);
  });

  it('still matches summary keywords at line start followed by delimiters (C30-01)', () => {
    // "합계" at line start followed by commas (typical CSV summary row)
    expect(SUMMARY_ROW_PATTERN.test('합계,,,,123456')).toBe(true);
    // "합계" preceded by non-Korean text and followed by delimiter
    expect(SUMMARY_ROW_PATTERN.test('2024-01-15,합계,,123456')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isValidHeaderRow edge cases — summary rows with date-like content (C26)
// ---------------------------------------------------------------------------
describe('isValidHeaderRow rejects summary rows with date context (C26)', () => {
  it('rejects row with date-format string and summary keyword', () => {
    // A summary row that happens to contain a date-like value should not
    // be recognized as a header — it only has amount-category keywords.
    expect(isValidHeaderRow(['2024-01-15', '합계', '50000'])).toBe(false);
  });

  it('rejects row with short date and approval total keyword', () => {
    expect(isValidHeaderRow(['01/15', '승인합계', '100,000'])).toBe(false);
  });

  it('rejects row with total usage and numeric data', () => {
    expect(isValidHeaderRow(['총사용', '200,000', '1234'])).toBe(false);
  });

  it('rejects row with English total and date-like content', () => {
    expect(isValidHeaderRow(['total', '50,000', '20240115'])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Keyword Set completeness — catch drift between Sets and regex patterns
// ---------------------------------------------------------------------------
describe('Keyword Set completeness (C24)', () => {
  it('isValidHeaderRow accepts English-only headers via regex-matched keywords', () => {
    // Date + Shop + Price: Date matches DATE_KEYWORDS, Shop matches
    // MERCHANT_KEYWORDS, Price matches AMOUNT_KEYWORDS (all must be in Sets)
    expect(isValidHeaderRow(['Date', 'Shop', 'Price'])).toBe(true);
    expect(isValidHeaderRow(['Date', 'Store', 'Amount'])).toBe(true);
    expect(isValidHeaderRow(['Date', 'Merchant', 'Total'])).toBe(true);
    expect(isValidHeaderRow(['date', 'shop', 'won'])).toBe(true);
  });

  it('isValidHeaderRow accepts headers with all regex-matched English terms', () => {
    // These terms are only matched by column regex patterns, not by exact
    // HEADER_KEYWORDS list. They MUST be in the category Sets.
    expect(isValidHeaderRow(['Date', 'Description', 'Price'])).toBe(true);
    expect(isValidHeaderRow(['date', 'store', 'total'])).toBe(true);
  });

  it('AMOUNT_KEYWORDS contains all regex-matched English alternatives', () => {
    expect(AMOUNT_KEYWORDS.has('price')).toBe(true);
    expect(AMOUNT_KEYWORDS.has('won')).toBe(true);
    expect(AMOUNT_KEYWORDS.has('amount')).toBe(true);
    expect(AMOUNT_KEYWORDS.has('total')).toBe(true);
  });

  it('MERCHANT_KEYWORDS contains all regex-matched English alternatives', () => {
    expect(MERCHANT_KEYWORDS.has('shop')).toBe(true);
    expect(MERCHANT_KEYWORDS.has('store')).toBe(true);
    expect(MERCHANT_KEYWORDS.has('merchant')).toBe(true);
    expect(MERCHANT_KEYWORDS.has('description')).toBe(true);
    expect(MERCHANT_KEYWORDS.has('vendor')).toBe(true);
    expect(MERCHANT_KEYWORDS.has('item')).toBe(true);
  });

  it('DATE_KEYWORDS contains expanded Korean terms', () => {
    expect(DATE_KEYWORDS.has('작성일')).toBe(true);
    expect(DATE_KEYWORDS.has('승인일')).toBe(true);
    expect(DATE_KEYWORDS.has('매출일')).toBe(true);
  });

  it('MERCHANT_KEYWORDS contains expanded Korean terms', () => {
    expect(MERCHANT_KEYWORDS.has('판매처')).toBe(true);
    expect(MERCHANT_KEYWORDS.has('구매처')).toBe(true);
    expect(MERCHANT_KEYWORDS.has('매장')).toBe(true);
    expect(MERCHANT_KEYWORDS.has('취급처')).toBe(true);
  });

  it('isValidHeaderRow accepts headers with expanded merchant terms', () => {
    expect(isValidHeaderRow(['작성일', '판매처', '금액'])).toBe(true);
    expect(isValidHeaderRow(['거래일', '취급처', '거래금액'])).toBe(true);
    expect(isValidHeaderRow(['Date', 'Vendor', 'Amount'])).toBe(true);
    expect(isValidHeaderRow(['date', 'item', 'total'])).toBe(true);
  });

  it('findColumn matches expanded merchant patterns', () => {
    const headers = ['작성일', '판매처', '이용금액'];
    expect(findColumn(headers, undefined, DATE_COLUMN_PATTERN)).toBe(0);
    expect(findColumn(headers, undefined, MERCHANT_COLUMN_PATTERN)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Expanded amount keywords (C31)
// ---------------------------------------------------------------------------
describe('AMOUNT_COLUMN_PATTERN expanded keywords (C31)', () => {
  const shouldMatch = ['취소금액', '환불금액', '입금액', '결제액'];

  for (const name of shouldMatch) {
    it(`matches "${name}"`, () => {
      expect(AMOUNT_COLUMN_PATTERN.test(name)).toBe(true);
    });
  }

  it('findColumn detects 취소금액 as amount column', () => {
    const headers = ['이용일', '이용처', '취소금액'];
    expect(findColumn(headers, undefined, AMOUNT_COLUMN_PATTERN)).toBe(2);
  });

  it('findColumn detects 환불금액 as amount column', () => {
    const headers = ['거래일', '가맹점', '환불금액', '비고'];
    expect(findColumn(headers, undefined, AMOUNT_COLUMN_PATTERN)).toBe(2);
  });

  it('findColumn detects 결제액 as amount column', () => {
    const headers = ['이용일', '이용처', '결제액'];
    expect(findColumn(headers, undefined, AMOUNT_COLUMN_PATTERN)).toBe(2);
  });

  it('AMOUNT_KEYWORDS contains new keywords', () => {
    expect(AMOUNT_KEYWORDS.has('취소금액')).toBe(true);
    expect(AMOUNT_KEYWORDS.has('환불금액')).toBe(true);
    expect(AMOUNT_KEYWORDS.has('입금액')).toBe(true);
    expect(AMOUNT_KEYWORDS.has('결제액')).toBe(true);
  });

  it('HEADER_KEYWORDS contains new amount keywords', () => {
    expect(HEADER_KEYWORDS).toContain('취소금액');
    expect(HEADER_KEYWORDS).toContain('환불금액');
    expect(HEADER_KEYWORDS).toContain('입금액');
    expect(HEADER_KEYWORDS).toContain('결제액');
  });

  it('isValidHeaderRow accepts headers with new amount keywords', () => {
    expect(isValidHeaderRow(['이용일', '이용처', '취소금액'])).toBe(true);
    expect(isValidHeaderRow(['거래일', '가맹점', '환불금액'])).toBe(true);
    expect(isValidHeaderRow(['이용일', '이용처', '결제액'])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Expanded category keywords (C31)
// ---------------------------------------------------------------------------
describe('CATEGORY_COLUMN_PATTERN expanded keywords (C31)', () => {
  const shouldMatch = ['거래유형', '결제유형', '이용구분', '구분', '가맹점유형'];

  for (const name of shouldMatch) {
    it(`matches "${name}"`, () => {
      expect(CATEGORY_COLUMN_PATTERN.test(name)).toBe(true);
    });
  }

  it('findColumn detects 거래유형 as category column', () => {
    const headers = ['이용일', '이용처', '이용금액', '거래유형'];
    expect(findColumn(headers, undefined, CATEGORY_COLUMN_PATTERN)).toBe(3);
  });

  it('findColumn detects 결제유형 as category column', () => {
    const headers = ['이용일', '이용처', '결제유형', '이용금액'];
    expect(findColumn(headers, undefined, CATEGORY_COLUMN_PATTERN)).toBe(2);
  });

  it('findColumn detects 이용구분 as category column', () => {
    const headers = ['거래일', '가맹점', '금액', '이용구분'];
    expect(findColumn(headers, undefined, CATEGORY_COLUMN_PATTERN)).toBe(3);
  });

  it('findColumn detects 구분 as category column', () => {
    const headers = ['이용일', '구분', '이용처', '금액'];
    expect(findColumn(headers, undefined, CATEGORY_COLUMN_PATTERN)).toBe(1);
  });

  it('findColumn detects 가맹점유형 as category column', () => {
    const headers = ['거래일', '가맹점유형', '가맹점', '금액'];
    expect(findColumn(headers, undefined, CATEGORY_COLUMN_PATTERN)).toBe(1);
  });
});