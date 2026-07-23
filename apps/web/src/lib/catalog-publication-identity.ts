export interface CatalogPublicationIdentity {
  sourceHash: string;
}

const SOURCE_HASH_PATTERN = /^[a-f0-9]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readCatalogSourceHash(
  value: unknown,
  label: string,
): string {
  if (
    !isRecord(value) ||
    typeof value.sourceHash !== 'string' ||
    !SOURCE_HASH_PATTERN.test(value.sourceHash)
  ) {
    throw new Error(`${label}의 게시 버전 정보가 올바르지 않아요`);
  }
  return value.sourceHash;
}
