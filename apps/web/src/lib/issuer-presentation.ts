import type { BankId } from './parser/types.js';

export interface UploadBankOption {
  value: BankId;
  label: string;
}

/**
 * Statement parsers intentionally share one BNK adapter because the exported
 * formats overlap. These labels describe parser coverage, not catalog issuer
 * identity.
 */
export const UPLOAD_BANK_OPTIONS = [
  { value: 'hyundai', label: '현대카드' },
  { value: 'kb', label: 'KB국민' },
  { value: 'samsung', label: '삼성카드' },
  { value: 'shinhan', label: '신한카드' },
  { value: 'lotte', label: '롯데카드' },
  { value: 'hana', label: '하나카드' },
  { value: 'woori', label: '우리카드' },
  { value: 'ibk', label: 'IBK기업' },
  { value: 'nh', label: 'NH농협' },
  { value: 'bc', label: 'BC카드' },
  { value: 'kakao', label: '카카오뱅크' },
  { value: 'toss', label: '토스뱅크' },
  { value: 'kbank', label: '케이뱅크' },
  { value: 'bnk', label: 'BNK부산·경남' },
  { value: 'dgb', label: 'DGB대구' },
  { value: 'suhyup', label: '수협은행' },
  { value: 'jb', label: '전북은행' },
  { value: 'kwangju', label: '광주은행' },
  { value: 'jeju', label: '제주은행' },
  { value: 'sc', label: 'SC제일' },
  { value: 'mg', label: '새마을금고' },
  { value: 'cu', label: '신협' },
  { value: 'kdb', label: 'KDB산업' },
  { value: 'epost', label: '우체국' },
] as const satisfies readonly UploadBankOption[];

const CATALOG_ISSUER_NAME_KO: Readonly<Record<string, string>> = {
  hyundai: '현대카드',
  kb: 'KB국민카드',
  samsung: '삼성카드',
  shinhan: '신한카드',
  lotte: '롯데카드',
  hana: '하나카드',
  woori: '우리카드',
  ibk: 'IBK기업은행',
  nh: 'NH농협카드',
  bc: 'BC카드',
  kakao: '카카오뱅크',
  toss: '토스뱅크',
  kbank: '케이뱅크',
  bnk: 'BNK부산은행',
  dgb: 'iM뱅크(대구은행)',
  suhyup: 'Sh수협은행',
  jb: '전북은행',
  kwangju: '광주은행',
  jeju: '제주은행',
  sc: 'SC제일은행',
  mg: 'MG새마을금고',
  cu: '신협',
  kdb: 'KDB산업은행',
  epost: '우체국',
};

export function formatCatalogIssuerNameKo(
  issuer: string,
  publishedName?: string,
): string {
  const canonicalPublishedName = publishedName?.trim();
  if (canonicalPublishedName) return canonicalPublishedName;
  return CATALOG_ISSUER_NAME_KO[issuer] ?? issuer;
}

export function formatUploadBankName(bankId: BankId): string {
  return (
    UPLOAD_BANK_OPTIONS.find(({ value }) => value === bankId)?.label ?? bankId
  );
}
