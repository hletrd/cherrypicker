import { describe, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { declaredBunVersion } from '../check-toolchain.js';

const repoRoot = resolve(import.meta.dir, '../..');
interface WorkflowStep {
  uses?: string;
  with?: Record<string, unknown>;
}

interface WorkflowJob {
  environment?: string | { name?: string };
  uses?: string;
  permissions?: Record<string, string>;
  steps?: WorkflowStep[];
}

interface WorkflowDefinition {
  permissions?: Record<string, string>;
  jobs: Record<string, WorkflowJob>;
}

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
const workflowDefinition = parse(workflow) as WorkflowDefinition;
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
  test('pins every action to a full commit SHA and scopes write permissions to deploy', () => {
    const actionReferences = Object.values(workflowDefinition.jobs).flatMap(
      (job) => [
        ...(job.uses ? [job.uses] : []),
        ...(job.steps ?? []).flatMap((step) =>
          step.uses ? [step.uses] : []
        ),
      ],
    );

    expect(actionReferences.length).toBeGreaterThan(0);
    for (const reference of actionReferences) {
      expect(reference).toMatch(/^[^@\s]+@[0-9a-f]{40}$/);
    }

    expect(
      Object.values(workflowDefinition.permissions ?? {}),
    ).not.toContain('write');
    expect(workflowDefinition.jobs.build?.permissions).toEqual({
      contents: 'read',
    });
    expect(workflowDefinition.jobs.deploy?.permissions).toEqual({
      pages: 'write',
      'id-token': 'write',
    });
    for (const [jobName, job] of Object.entries(workflowDefinition.jobs)) {
      if (jobName === 'deploy') continue;
      expect(
        Object.entries(job.permissions ?? {}).filter(
          ([, permission]) => permission === 'write',
        ),
      ).toEqual([]);
    }
    const deployEnvironment = workflowDefinition.jobs.deploy?.environment;
    expect(
      typeof deployEnvironment === 'string'
        ? deployEnvironment
        : deployEnvironment?.name,
    ).toBe('github-pages');

    const checkout = workflowDefinition.jobs.build?.steps?.find(
      (step) => step.uses?.startsWith('actions/checkout@'),
    );
    expect(checkout?.with?.['persist-credentials']).toBe(false);
  });

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

describe('public product identity', () => {
  test('keeps the retired CardPick name out of tracked production surfaces', () => {
    const trackedFiles = execFileSync(
      'git',
      [
        'ls-files',
        '-z',
        '--',
        'README.md',
        '.github',
        'apps',
        'packages',
        'tools',
        'scripts',
      ],
      { cwd: repoRoot, encoding: 'utf8' },
    )
      .split('\0')
      .filter(Boolean)
      .filter((path) => !path.includes('/__tests__/'))
      .filter((path) => !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path))
      .filter((path) =>
        /\.(?:astro|css|html|js|json|md|mjs|svelte|toml|ts|yaml|yml)$/.test(
          path,
        )
      );

    const offenders = trackedFiles.filter((path) =>
      /\bCardPick\b/.test(readFileSync(resolve(repoRoot, path), 'utf8'))
    );
    expect(offenders).toEqual([]);
  });
});
