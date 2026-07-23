import { isSupportedStatementFile } from './supported-formats.js';

export const MAX_UPLOAD_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_TOTAL_BYTES = 50 * 1024 * 1024;
export const MAX_UPLOAD_FILE_COUNT = 50;

export interface UploadCandidate {
  name: string;
  size: number;
  type: string;
}

export interface UploadAdmission<T extends UploadCandidate> {
  accepted: T[];
  oversized: T[];
  unsupported: T[];
  duplicates: T[];
  overAggregateBytes: T[];
  overFileCount: T[];
}

function fileIdentity(file: UploadCandidate): string {
  return `${file.name}\u0000${file.size}`;
}

export function admitUploadFiles<T extends UploadCandidate>(
  existing: readonly T[],
  candidates: readonly T[],
): UploadAdmission<T> {
  const result: UploadAdmission<T> = {
    accepted: [],
    oversized: [],
    unsupported: [],
    duplicates: [],
    overAggregateBytes: [],
    overFileCount: [],
  };
  const identities = new Set(existing.map(fileIdentity));
  let totalBytes = existing.reduce((sum, file) => sum + file.size, 0);
  let totalCount = existing.length;

  for (const file of candidates) {
    if (file.size > MAX_UPLOAD_FILE_BYTES) {
      result.oversized.push(file);
      continue;
    }
    if (!isSupportedStatementFile(file)) {
      result.unsupported.push(file);
      continue;
    }
    const identity = fileIdentity(file);
    if (identities.has(identity)) {
      result.duplicates.push(file);
      continue;
    }
    if (totalCount >= MAX_UPLOAD_FILE_COUNT) {
      result.overFileCount.push(file);
      continue;
    }
    if (totalBytes + file.size > MAX_UPLOAD_TOTAL_BYTES) {
      result.overAggregateBytes.push(file);
      continue;
    }
    result.accepted.push(file);
    identities.add(identity);
    totalCount++;
    totalBytes += file.size;
  }

  return result;
}
