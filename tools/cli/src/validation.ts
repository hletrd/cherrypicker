import { existsSync } from 'node:fs';

/** Validate a file path argument before parsing.
 *  Rejects paths containing '..' segments (directory traversal).
 *  For input files, verifies the file exists on disk.
 *  Throws descriptive errors for invalid paths. */
export function validateFilePath(path: string, options: { mustExist?: boolean; label?: string } = {}): void {
  const label = options.label ?? '파일';

  if (!path || path.trim().length === 0) {
    throw new Error(`${label} 경로가 비어 있습니다.`);
  }

  const normalized = path.replace(/\\/g, '/');
  const segments = normalized.split('/');
  if (segments.includes('..')) {
    throw new Error(
      `${label} 경로에 '..' (상위 디렉토리 참조)가 포함되어 있습니다: ${path}\n` +
      '상대 경로 traversal은 보안상 허용되지 않습니다. 절대 경로나 현재 디렉토리 내의 경로를 사용하세요.',
    );
  }

  if (options.mustExist && !existsSync(path)) {
    throw new Error(
      `${label}을 찾을 수 없습니다: ${path}\n` +
      '경로가 올바른지 확인하고 파일이 존재하는지 확인하세요.',
    );
  }
}
