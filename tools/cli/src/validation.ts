import { existsSync, lstatSync } from 'node:fs';

/** Parse a previous-month spending argument as an exact non-negative KRW
 * integer. Reject partial `parseInt` matches, fractions, and integers that
 * cannot be represented safely. */
export function parsePreviousSpendingArgument(raw: string | undefined): number {
  if (raw === undefined || !/^\d+$/.test(raw)) {
    throw new Error(`전월실적은 0 이상의 정수여야 합니다: ${raw ?? '(값 없음)'}`);
  }

  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`전월실적은 안전한 정수 범위여야 합니다: ${raw}`);
  }
  return parsed;
}

/** Validate a file path argument before parsing.
 *  Rejects paths containing '..' segments (directory traversal) and null bytes.
 *  Rejects symbolic links to prevent indirect traversal.
 *  For input files, verifies the file exists on disk.
 *  Throws descriptive errors for invalid paths. */
export function validateFilePath(path: string, options: { mustExist?: boolean; label?: string } = {}): void {
  const label = options.label ?? '파일';

  if (!path || path.trim().length === 0) {
    throw new Error(`${label} 경로가 비어 있습니다.`);
  }

  // Strip null bytes to prevent injection attacks (e.g., /etc/passwd\x00.txt)
  const cleaned = path.replace(/\x00/g, '');
  const normalized = cleaned.replace(/\\/g, '/');
  const segments = normalized.split('/');
  if (segments.includes('..')) {
    throw new Error(
      `${label} 경로에 '..' (상위 디렉토리 참조)가 포함되어 있습니다: ${cleaned}\n` +
      '상대 경로 traversal은 보안상 허용되지 않습니다. 절대 경로나 현재 디렉토리 내의 경로를 사용하세요.',
    );
  }

  if (options.mustExist && !existsSync(cleaned)) {
    throw new Error(
      `${label}을 찾을 수 없습니다: ${cleaned}\n` +
      '경로가 올바른지 확인하고 파일이 존재하는지 확인하세요.',
    );
  }

  // Reject symbolic links to prevent indirect path traversal.
  // Check separately from throwing so lstat errors don't mask symlink detection.
  let isSymlink = false;
  if (options.mustExist && existsSync(cleaned)) {
    try {
      isSymlink = lstatSync(cleaned).isSymbolicLink();
    } catch {
      // lstatSync may throw on unusual paths; treat as non-symlink and let
      // downstream operations surface their own errors.
    }
  }
  if (isSymlink) {
    throw new Error(
      `${label}은 심볼릭 링크를 지원하지 않습니다: ${cleaned}\n` +
      '심볼릭 링크를 통한 간접 경로 접근은 보안상 허용되지 않습니다.',
    );
  }
}
