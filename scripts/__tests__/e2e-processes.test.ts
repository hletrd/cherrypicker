import { describe, expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertE2EPortAvailable,
  assertRecordedPortReleased,
  cleanupStaleE2EProcesses,
  descendantsOf,
  getE2EStateDirectory,
  inspectE2EStatus,
  isPathWithin,
  ownedProcessesForRecord,
  parsePsOutput,
  readE2EOwnershipInventory,
  selectE2EPort,
  summarizeE2EStatus,
  terminateOwnedGroup,
  OWNERSHIP_FILE,
} from '../e2e-processes.js';
import type {
  E2EOwnershipRecord,
  ProcessInfo,
} from '../e2e-processes.js';
import {
  buildOwnedCommandEnvironment,
  exitCodeForSignal,
  formatStatus,
  normalizeExitCode,
  runWithGuaranteedCleanup,
} from '../run-e2e.js';
import {
  buildE2EBaseURL,
  E2E_DEFAULT_PORT,
  resolveE2ERuntime,
} from '../e2e-runtime.js';

const repoRoot = '/workspace/cherrypicker';
const runDir = `${repoRoot}/test-results/cherrypicker-e2e/run-1`;

function record(
  overrides: Partial<E2EOwnershipRecord> = {},
): E2EOwnershipRecord {
  return {
    schemaVersion: 2,
    repoRoot,
    runId: 'run-1',
    suite: 'regression',
    port: E2E_DEFAULT_PORT,
    wrapperPid: 10,
    runDir,
    tempDir: `${runDir}/tmp`,
    startedAt: '2026-07-23T00:00:00.000Z',
    childPid: 20,
    processGroupId: 20,
    commandKind: 'playwright',
    command: ['bunx', 'playwright', 'test'],
    ...overrides,
  };
}

describe('E2E process ownership', () => {
  test('parses process tables and finds the exact descendant tree', () => {
    const processes = parsePsOutput(
      ' 10 1 10 wrapper\n 20 10 20 bunx playwright test\n 21 20 20 chromium\n 99 1 99 Chrome\n',
    );
    expect(descendantsOf(20, processes).map(({ pid }) => pid)).toEqual([21]);
  });

  test('accepts a recorded group only with checkout and command proof', () => {
    const processes: ProcessInfo[] = [
      {
        pid: 20,
        ppid: 10,
        pgid: 20,
        command: 'bunx playwright test',
        cwd: repoRoot,
      },
      {
        pid: 21,
        ppid: 20,
        pgid: 20,
        command: 'chromium --headless',
      },
    ];
    expect(ownedProcessesForRecord(record(), repoRoot, processes)).toEqual(processes);
  });

  test('refuses a reused group id without a repository marker', () => {
    const processes: ProcessInfo[] = [
      {
        pid: 20,
        ppid: 1,
        pgid: 20,
        command: 'bunx playwright test',
        cwd: '/workspace/other-checkout',
      },
    ];
    expect(ownedProcessesForRecord(record(), repoRoot, processes)).toEqual([]);
  });

  test('refuses records for another checkout or an unsafe run directory', () => {
    const processes: ProcessInfo[] = [
      {
        pid: 20,
        ppid: 1,
        pgid: 20,
        command: `chromium --user-data-dir=${runDir}/tmp`,
      },
    ];
    expect(
      ownedProcessesForRecord(record({ repoRoot: '/workspace/other' }), repoRoot, processes),
    ).toEqual([]);
    expect(
      ownedProcessesForRecord(record({ runDir: '/tmp/run-1' }), repoRoot, processes),
    ).toEqual([]);
  });

  test('path containment rejects sibling-prefix paths', () => {
    expect(isPathWithin(repoRoot, `${repoRoot}/apps/web`)).toBe(true);
    expect(isPathWithin(repoRoot, `${repoRoot}-copy/apps/web`)).toBe(false);
    expect(getE2EStateDirectory(repoRoot)).toBe(
      `${repoRoot}/test-results/cherrypicker-e2e`,
    );
  });

  test('selects the default only when free and otherwise verifies an alternate', async () => {
    const defaultRequests: number[] = [];
    expect(await selectE2EPort(async (requestedPort) => {
      defaultRequests.push(requestedPort);
      return requestedPort;
    })).toBe(E2E_DEFAULT_PORT);
    expect(defaultRequests).toEqual([E2E_DEFAULT_PORT]);

    const alternateRequests: number[] = [];
    expect(await selectE2EPort(async (requestedPort) => {
      alternateRequests.push(requestedPort);
      return requestedPort === E2E_DEFAULT_PORT ? null : 49_321;
    })).toBe(49_321);
    expect(alternateRequests).toEqual([E2E_DEFAULT_PORT, 0]);

    await expect(
      assertE2EPortAvailable(49_321, async () => 49_321),
    ).resolves.toBeUndefined();
    await expect(
      assertE2EPortAvailable(49_321, async () => null),
    ).rejects.toThrow('no longer available');
  });

  test('validates selected-port runtime metadata and exact base URL', () => {
    expect(resolveE2ERuntime({
      CHERRYPICKER_E2E_PORT: '49321',
      PLAYWRIGHT_BASE_URL: buildE2EBaseURL(49_321),
    })).toEqual({
      host: '127.0.0.1',
      port: 49_321,
      basePath: '/cherrypicker/',
      baseURL: 'http://127.0.0.1:49321/cherrypicker/',
    });
    expect(() => resolveE2ERuntime({
      CHERRYPICKER_E2E_PORT: '49321',
      PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:4173/cherrypicker/',
    })).toThrow('must match');
    expect(() => resolveE2ERuntime({
      CHERRYPICKER_E2E_PORT: '70000',
      PLAYWRIGHT_BASE_URL: undefined,
    })).toThrow('safe TCP range');

    const environment = buildOwnedCommandEnvironment(
      record({ port: 49_321 }),
      'playwright',
      { PATH: '/test/bin' },
    );
    expect(environment).toMatchObject({
      PATH: '/test/bin',
      CHERRYPICKER_E2E_PORT: '49321',
      PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:49321/cherrypicker/',
      CHERRYPICKER_E2E_RUN_DIR: runDir,
      CHERRYPICKER_E2E_RUN_ID: 'run-1',
    });
  });

  test('removes inherited NO_COLOR only from the Playwright process tree', () => {
    const inheritedEnvironment = {
      PATH: '/test/bin',
      NO_COLOR: '1',
      FORCE_COLOR: '2',
    };

    const playwrightEnvironment = buildOwnedCommandEnvironment(
      record(),
      'playwright',
      inheritedEnvironment,
    );
    const buildEnvironment = buildOwnedCommandEnvironment(
      record(),
      'build',
      inheritedEnvironment,
    );

    expect(playwrightEnvironment.NO_COLOR).toBeUndefined();
    expect(playwrightEnvironment.FORCE_COLOR).toBe('2');
    expect(buildEnvironment.NO_COLOR).toBe('1');
    expect(inheritedEnvironment.NO_COLOR).toBe('1');
  });

  test('treats a foreign default listener as unavailable but repository-clean', () => {
    const status = summarizeE2EStatus(
      [],
      [],
      new Map(),
      new Map([
        [
          E2E_DEFAULT_PORT,
          {
            port: E2E_DEFAULT_PORT,
            pids: [999],
            attributionAvailable: true,
            portOpen: true,
          },
        ],
      ]),
    );

    expect(status.clean).toBe(true);
    expect(status.defaultPortAvailable).toBe(false);
    expect(status.defaultPortPids).toEqual([999]);
    expect(status.ownedPorts).toEqual([]);
    expect(status.portPids).toEqual([]);
    expect(formatStatus(status)).toContain('runner will select an alternate');
    expect(formatStatus(status)).toContain('were not signaled');
  });

  test('never promotes an open recorded port into listener-kill authority', () => {
    const alternateRecord = record({ port: 49_321 });
    expect(() =>
      assertRecordedPortReleased(alternateRecord, {
        port: 49_321,
        pids: [777],
        attributionAvailable: true,
        portOpen: true,
      }),
    ).toThrow('refusing to signal');
    expect(() =>
      assertRecordedPortReleased(alternateRecord, {
        port: 49_322,
        pids: [],
        attributionAvailable: true,
        portOpen: false,
      }),
    ).toThrow('inspection mismatch');
    expect(() =>
      assertRecordedPortReleased(alternateRecord, {
        port: 49_321,
        pids: [],
        attributionAvailable: true,
        portOpen: false,
      }),
    ).not.toThrow();
  });

  test('reports malformed, missing, and truncated records as unclean without trusting them', async () => {
    const temporaryRepo = mkdtempSync(join(tmpdir(), 'cherrypicker-e2e-records-'));
    const stateDir = getE2EStateDirectory(temporaryRepo);
    const validRunDir = join(stateDir, 'valid-run');
    const malformedRunDir = join(stateDir, 'malformed-run');
    const badPortRunDir = join(stateDir, 'bad-port-run');
    const legacyRunDir = join(stateDir, 'legacy-run');
    const missingRunDir = join(stateDir, 'missing-run');
    const truncatedRunDir = join(stateDir, 'truncated-run');
    try {
      mkdirSync(validRunDir, { recursive: true });
      mkdirSync(malformedRunDir, { recursive: true });
      mkdirSync(badPortRunDir, { recursive: true });
      mkdirSync(legacyRunDir, { recursive: true });
      mkdirSync(missingRunDir, { recursive: true });
      mkdirSync(truncatedRunDir, { recursive: true });
      writeFileSync(
        join(validRunDir, OWNERSHIP_FILE),
        JSON.stringify(record({
          repoRoot: temporaryRepo,
          runId: 'valid-run',
          runDir: validRunDir,
          tempDir: join(validRunDir, 'tmp'),
        })),
      );
      writeFileSync(
        join(malformedRunDir, OWNERSHIP_FILE),
        JSON.stringify({ schemaVersion: 2, repoRoot: temporaryRepo }),
      );
      writeFileSync(
        join(badPortRunDir, OWNERSHIP_FILE),
        JSON.stringify(record({
          repoRoot: temporaryRepo,
          runId: 'bad-port-run',
          runDir: badPortRunDir,
          tempDir: join(badPortRunDir, 'tmp'),
          port: 70_000,
        })),
      );
      writeFileSync(
        join(legacyRunDir, OWNERSHIP_FILE),
        JSON.stringify({
          ...record({
            repoRoot: temporaryRepo,
            runId: 'legacy-run',
            runDir: legacyRunDir,
            tempDir: join(legacyRunDir, 'tmp'),
          }),
          schemaVersion: 1,
        }),
      );
      writeFileSync(
        join(truncatedRunDir, OWNERSHIP_FILE),
        '{"schemaVersion":1',
      );

      const inventory = await readE2EOwnershipInventory(temporaryRepo);
      expect(inventory.records.map(({ runId }) => runId)).toEqual(['valid-run']);
      expect(inventory.invalidRecords.map(({ runId }) => runId)).toEqual([
        'bad-port-run',
        'legacy-run',
        'malformed-run',
        'missing-run',
        'truncated-run',
      ]);

      const status = await inspectE2EStatus(temporaryRepo);
      expect(status.clean).toBe(false);
      expect(status.invalidRunIds).toEqual([
        'bad-port-run',
        'legacy-run',
        'malformed-run',
        'missing-run',
        'truncated-run',
      ]);
      expect(status.staleRunIds).toEqual([
        'bad-port-run',
        'legacy-run',
        'malformed-run',
        'missing-run',
        'truncated-run',
        'valid-run',
      ]);
      expect(status.diagnostics.some((line) => line.includes('no process ownership can be proven'))).toBe(true);

      await expect(
        cleanupStaleE2EProcesses(temporaryRepo),
      ).rejects.toThrow('ownership cannot be proven');
      expect(existsSync(validRunDir)).toBe(true);
      expect(existsSync(badPortRunDir)).toBe(true);
      expect(existsSync(legacyRunDir)).toBe(true);
      expect(existsSync(malformedRunDir)).toBe(true);
      expect(existsSync(missingRunDir)).toBe(true);
      expect(existsSync(truncatedRunDir)).toBe(true);
    } finally {
      rmSync(temporaryRepo, { recursive: true, force: true });
    }
  });

  test('escalates only surviving owned PIDs after the TERM grace period', async () => {
    const events: string[] = [];
    let waitCount = 0;
    await terminateOwnedGroup(
      20,
      [
        { pid: 20, ppid: 10, pgid: 20, command: 'bunx playwright test' },
        { pid: 21, ppid: 20, pgid: 20, command: 'chromium --headless' },
      ],
      {
        signalGroup: (pgid, signal) => events.push(`group:${pgid}:${signal}`),
        signalPid: (pid, signal) => events.push(`pid:${pid}:${signal}`),
        waitForExit: async () => {
          waitCount += 1;
          return waitCount === 1 ? [21] : [];
        },
      },
    );
    expect(events).toEqual(['group:20:SIGTERM', 'pid:21:SIGKILL']);
  });
});

describe('runner exit status', () => {
  test('preserves command failures and conventional signal statuses', () => {
    expect(normalizeExitCode(7, null)).toBe(7);
    expect(normalizeExitCode(null, 'SIGINT')).toBe(130);
    expect(normalizeExitCode(null, 'SIGTERM')).toBe(143);
    expect(exitCodeForSignal('SIGHUP')).toBe(1);
  });

  test('runs cleanup after a simulated command failure and preserves its code', async () => {
    let cleaned = false;
    const exitCode = await runWithGuaranteedCleanup(
      async () => 7,
      async () => {
        cleaned = true;
      },
    );
    expect(cleaned).toBe(true);
    expect(exitCode).toBe(7);
  });
});
