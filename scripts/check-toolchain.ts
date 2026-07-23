import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface PackageManifest {
  packageManager?: string;
}

export function declaredBunVersion(packageManager: unknown): string {
  if (typeof packageManager !== 'string') {
    throw new Error('package.json must declare packageManager as bun@<version>.');
  }
  const match = packageManager.match(/^bun@(\d+\.\d+\.\d+)$/);
  if (!match) {
    throw new Error(
      `Unsupported packageManager "${packageManager}"; expected bun@<version>.`,
    );
  }
  return match[1]!;
}

export function verifyBunVersion(
  declared: string,
  actual: string,
): void {
  if (actual !== declared) {
    throw new Error(
      `Bun version mismatch: repository requires ${declared}, but this process is ${actual}. ` +
        `Run the gate with Bun ${declared}; do not rewrite packageManager to match the host.`,
    );
  }
}

async function main(): Promise<void> {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const manifest = JSON.parse(
    await readFile(resolve(repoRoot, 'package.json'), 'utf8'),
  ) as PackageManifest;
  const declared = declaredBunVersion(manifest.packageManager);
  verifyBunVersion(declared, Bun.version);
  console.log(`Toolchain check passed: Bun ${actualVersion()}`);
}

function actualVersion(): string {
  return Bun.version;
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
