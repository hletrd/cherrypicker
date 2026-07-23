import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { declaredBunVersion } from '../check-toolchain.js';

const repoRoot = resolve(import.meta.dir, '../..');
const packageJson = JSON.parse(
  readFileSync(resolve(repoRoot, 'package.json'), 'utf8'),
) as {
  packageManager: string;
  scripts: Record<string, string>;
};
const workflow = readFileSync(
  resolve(repoRoot, '.github/workflows/deploy.yml'),
  'utf8',
);
const e2eRunner = readFileSync(
  resolve(repoRoot, 'scripts/run-e2e.ts'),
  'utf8',
);
const playwrightConfigs = [
  'playwright.config.ts',
  'playwright.screenshots.config.ts',
].map((path) => readFileSync(resolve(repoRoot, path), 'utf8'));
const browserSpecs = [
  'e2e/web-regressions.spec.js',
  'e2e/security-regressions.spec.js',
  'e2e/ui-ux-review.spec.js',
  'e2e/ui-ux-screenshots.spec.js',
].map((path) => readFileSync(resolve(repoRoot, path), 'utf8'));

describe('deployment workflow consistency', () => {
  test('pins the workflow to the packageManager Bun version', () => {
    const declared = declaredBunVersion(packageJson.packageManager);
    const workflowPin = workflow.match(/bun-version:\s*([0-9.]+)/)?.[1];
    expect(workflowPin).toBe(declared);
    expect(workflow.indexOf('bun run toolchain:check')).toBeLessThan(
      workflow.indexOf('bun install --frozen-lockfile'),
    );
  });

  test('runs regression E2E before Pages upload and never substitutes screenshots', () => {
    expect(packageJson.scripts['test:e2e']).toBe(
      'bun scripts/run-e2e.ts regression',
    );
    expect(workflow).toContain('run: bun run test:e2e');
    expect(workflow).not.toContain('test:e2e:screenshots');
    expect(workflow.indexOf('run: bun run test:e2e')).toBeLessThan(
      workflow.indexOf('actions/upload-pages-artifact'),
    );
  });

  test('threads the runner-selected loopback port through both configs and browser specs', () => {
    expect(e2eRunner).toContain('CHERRYPICKER_E2E_PORT: String(record.port)');
    expect(e2eRunner).toContain('PLAYWRIGHT_BASE_URL: buildE2EBaseURL(record.port)');
    for (const config of playwrightConfigs) {
      expect(config).toContain('resolveE2ERuntime()');
      expect(config).toContain('reuseExistingServer: false');
      expect(config).not.toContain('const port = 4173');
    }
    for (const spec of browserSpecs) {
      expect(spec).toContain('process.env.PLAYWRIGHT_BASE_URL');
    }
  });

  test('runs workspace quality gates without recursively invoking the root scripts', () => {
    expect(packageJson.scripts.lint).toBe(
      "bun run --filter '@cherrypicker/*' lint",
    );
    expect(packageJson.scripts.typecheck).toBe(
      "bun run --filter '@cherrypicker/*' typecheck",
    );
  });
});
