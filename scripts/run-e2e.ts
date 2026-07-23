import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import {
  assertE2EPortAvailable,
  cleanupCurrentRun,
  cleanupStaleE2EProcesses,
  createOwnershipRecord,
  inspectE2EStatus,
  resolveRepositoryRoot,
  selectE2EPort,
  writeOwnershipRecord,
} from './e2e-processes.js';
import { buildE2EBaseURL, E2E_DEFAULT_PORT } from './e2e-runtime.js';
import type {
  E2EOwnershipRecord,
  E2ESuite,
  OwnedCommandKind,
} from './e2e-processes.js';

type RunnerCommand = E2ESuite | 'status';

const SIGNAL_EXIT_CODES: Partial<Record<NodeJS.Signals, number>> = {
  SIGINT: 130,
  SIGTERM: 143,
};

function usage(): never {
  console.error(
    'Usage: bun scripts/run-e2e.ts <regression|screenshots|status> [--assert-clean]',
  );
  process.exit(2);
}

export function exitCodeForSignal(signal: NodeJS.Signals): number {
  return SIGNAL_EXIT_CODES[signal] ?? 1;
}

export function normalizeExitCode(
  code: number | null,
  signal: NodeJS.Signals | null,
): number {
  if (signal) return exitCodeForSignal(signal);
  return code ?? 1;
}

export async function runWithGuaranteedCleanup(
  run: () => Promise<number>,
  cleanup: () => Promise<void>,
): Promise<number> {
  let exitCode = 1;
  let runError: unknown;
  try {
    exitCode = await run();
  } catch (error) {
    runError = error;
  }

  try {
    await cleanup();
  } catch (cleanupError) {
    if (runError !== undefined) {
      throw new AggregateError(
        [runError, cleanupError],
        'E2E command and scoped cleanup both failed.',
      );
    }
    if (exitCode !== 0) {
      console.error(
        `E2E cleanup also failed after command exit ${exitCode}:`,
        cleanupError,
      );
      return exitCode;
    }
    throw cleanupError;
  }

  if (runError !== undefined) throw runError;
  return exitCode;
}

export function formatStatus(
  status: Awaited<ReturnType<typeof inspectE2EStatus>>,
): string {
  if (status.clean && status.defaultPortAvailable) {
    return `E2E status: repository clean (no owned runs; default port ${E2E_DEFAULT_PORT} is available)`;
  }
  if (status.clean) {
    return [
      `E2E status: repository clean (no owned runs; default port ${E2E_DEFAULT_PORT} is unavailable, so the runner will select an alternate)`,
      ...status.diagnostics.map((diagnostic) => `- ${diagnostic}`),
    ].join('\n');
  }
  return [
    'E2E status: repository not clean',
    ...status.diagnostics.map((diagnostic) => `- ${diagnostic}`),
  ].join('\n');
}

async function assertClean(repoRoot: string): Promise<void> {
  const status = await inspectE2EStatus(repoRoot);
  if (!status.clean) throw new Error(formatStatus(status));
}

function commandFor(kind: OwnedCommandKind, suite: E2ESuite): string[] {
  if (kind === 'build') {
    return [
      'bunx',
      'turbo',
      'run',
      'build',
      '--filter=@cherrypicker/core',
      '--filter=@cherrypicker/rules',
      '--filter=@cherrypicker/web',
    ];
  }

  const config = suite === 'screenshots'
    ? 'playwright.screenshots.config.ts'
    : 'playwright.config.ts';
  return ['bunx', 'playwright', 'test', '--config', config];
}

export function buildOwnedCommandEnvironment(
  record: E2EOwnershipRecord,
  kind: OwnedCommandKind,
  baseEnvironment: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    ...baseEnvironment,
    TMPDIR: record.tempDir,
    TMP: record.tempDir,
    TEMP: record.tempDir,
    CHERRYPICKER_E2E_RUN_DIR: record.runDir,
    CHERRYPICKER_E2E_RUN_ID: record.runId,
    CHERRYPICKER_E2E_PORT: String(record.port),
    PLAYWRIGHT_BASE_URL: buildE2EBaseURL(record.port),
  };

  // Playwright forces color output for its web server and workers. Passing
  // through NO_COLOR makes Node warn in every one of those child processes,
  // even though Playwright ignores it there.
  if (kind === 'playwright') delete environment.NO_COLOR;

  return environment;
}

interface LaunchedOwnedCommand {
  completion: Promise<number>;
}

async function launchOwnedCommand(
  record: E2EOwnershipRecord,
  kind: OwnedCommandKind,
): Promise<LaunchedOwnedCommand> {
  const command = commandFor(kind, record.suite);
  const child = spawn(command[0]!, command.slice(1), {
    cwd: record.repoRoot,
    detached: true,
    env: buildOwnedCommandEnvironment(record, kind),
    stdio: 'inherit',
  });
  const completion = waitForChild(child);

  if (child.pid === undefined) {
    try {
      await completion;
    } catch (error) {
      throw error;
    }
    throw new Error(`Failed to launch E2E ${kind} command.`);
  }

  record.childPid = child.pid;
  record.processGroupId = child.pid;
  record.commandKind = kind;
  record.command = command;
  await writeOwnershipRecord(record);

  return { completion };
}

function waitForChild(child: ChildProcess): Promise<number> {
  return new Promise((resolveChild, rejectChild) => {
    child.once('error', rejectChild);
    child.once('exit', (code, signal) => {
      resolveChild(normalizeExitCode(code, signal));
    });
  });
}

async function runSuite(repoRoot: string, suite: E2ESuite): Promise<number> {
  await cleanupStaleE2EProcesses(repoRoot);
  await assertClean(repoRoot);

  const port = await selectE2EPort();
  const record = await createOwnershipRecord(repoRoot, suite, port);
  console.log(`E2E run ${record.runId}: selected ${buildE2EBaseURL(port)}`);
  let interruptedBy: NodeJS.Signals | null = null;
  let resolveInterruption: ((exitCode: number) => void) | null = null;
  const interruption = new Promise<number>((resolveSignal) => {
    resolveInterruption = resolveSignal;
  });
  const onSignal = (signal: NodeJS.Signals) => {
    if (interruptedBy !== null) return;
    interruptedBy = signal;
    resolveInterruption?.(exitCodeForSignal(signal));
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  try {
    return await runWithGuaranteedCleanup(
      async () => {
        const build = await launchOwnedCommand(record, 'build');
        const buildExit = await Promise.race([
          build.completion,
          interruption,
        ]);
        if (buildExit !== 0 || interruptedBy !== null) return buildExit;

        await assertE2EPortAvailable(record.port);
        if (interruptedBy !== null) return exitCodeForSignal(interruptedBy);
        const playwright = await launchOwnedCommand(record, 'playwright');
        return Promise.race([
          playwright.completion,
          interruption,
        ]);
      },
      async () => {
        await cleanupCurrentRun(record);
        await assertClean(repoRoot);
      },
    );
  } finally {
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
  }
}

async function main(): Promise<void> {
  const [commandArg, ...flags] = process.argv.slice(2);
  if (
    commandArg !== 'regression' &&
    commandArg !== 'screenshots' &&
    commandArg !== 'status'
  ) {
    usage();
  }
  const command: RunnerCommand = commandArg;
  const unknownFlags = flags.filter((flag) => flag !== '--assert-clean');
  if (unknownFlags.length > 0) usage();

  const repoRoot = await resolveRepositoryRoot();
  if (command === 'status') {
    const status = await inspectE2EStatus(repoRoot);
    console.log(formatStatus(status));
    if (flags.includes('--assert-clean') && !status.clean) process.exitCode = 1;
    return;
  }

  process.exitCode = await runSuite(repoRoot, command);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
