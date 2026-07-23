import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { createConnection, createServer } from 'node:net';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  E2E_DEFAULT_PORT,
  E2E_HOST,
  isValidE2EPort,
} from './e2e-runtime.js';

const execFileAsync = promisify(execFile);

export { E2E_HOST };
export const E2E_PORT = E2E_DEFAULT_PORT;
export const OWNERSHIP_FILE = 'ownership.json';
export const STATE_DIRECTORY_PARTS = ['test-results', 'cherrypicker-e2e'] as const;

export type E2ESuite = 'regression' | 'screenshots';
export type OwnedCommandKind = 'build' | 'playwright';

export interface ProcessInfo {
  pid: number;
  ppid: number;
  pgid: number;
  command: string;
  cwd?: string;
}

export interface E2EOwnershipRecord {
  schemaVersion: 2;
  repoRoot: string;
  runId: string;
  suite: E2ESuite;
  port: number;
  wrapperPid: number;
  runDir: string;
  tempDir: string;
  startedAt: string;
  childPid: number | null;
  processGroupId: number | null;
  commandKind: OwnedCommandKind | null;
  command: string[];
}

export interface E2EStatus {
  clean: boolean;
  ownedPids: number[];
  ownedPorts: number[];
  portPids: number[];
  defaultPortAvailable: boolean;
  defaultPortPids: number[];
  staleRunIds: string[];
  invalidRunIds: string[];
  attributionAvailable: boolean;
  diagnostics: string[];
}

export interface InvalidE2EOwnershipRecord {
  runId: string;
  reason: string;
}

export interface E2EOwnershipInventory {
  records: E2EOwnershipRecord[];
  invalidRecords: InvalidE2EOwnershipRecord[];
}

export interface PortInspection {
  port: number;
  pids: number[];
  attributionAvailable: boolean;
  portOpen: boolean;
}

interface ExecFailure extends Error {
  code?: number | string;
  stdout?: string;
  stderr?: string;
}

export interface TerminationController {
  signalGroup: (processGroupId: number, signal: NodeJS.Signals) => void;
  signalPid: (pid: number, signal: NodeJS.Signals) => void;
  waitForExit: (pids: number[], timeoutMs: number) => Promise<number[]>;
}

function repositoryRootFromModule(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

export async function resolveRepositoryRoot(): Promise<string> {
  return realpath(repositoryRootFromModule());
}

export function getE2EStateDirectory(repoRoot: string): string {
  return join(repoRoot, ...STATE_DIRECTORY_PARTS);
}

export function isPathWithin(parent: string, candidate: string): boolean {
  const rel = relative(resolve(parent), resolve(candidate));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

export function parsePsOutput(output: string): ProcessInfo[] {
  const processes: ProcessInfo[] = [];
  for (const line of output.split('\n')) {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/);
    if (!match) continue;
    processes.push({
      pid: Number(match[1]),
      ppid: Number(match[2]),
      pgid: Number(match[3]),
      command: match[4]!,
    });
  }
  return processes;
}

export function descendantsOf(rootPid: number, processes: ProcessInfo[]): ProcessInfo[] {
  const byParent = new Map<number, ProcessInfo[]>();
  for (const processInfo of processes) {
    const children = byParent.get(processInfo.ppid) ?? [];
    children.push(processInfo);
    byParent.set(processInfo.ppid, children);
  }

  const descendants: ProcessInfo[] = [];
  const queue = [...(byParent.get(rootPid) ?? [])];
  while (queue.length > 0) {
    const current = queue.shift()!;
    descendants.push(current);
    queue.push(...(byParent.get(current.pid) ?? []));
  }
  return descendants;
}

function hasRepositoryMarker(processInfo: ProcessInfo, record: E2EOwnershipRecord): boolean {
  return (
    processInfo.command.includes(record.runDir) ||
    processInfo.command.includes(record.tempDir) ||
    (processInfo.cwd !== undefined && isPathWithin(record.repoRoot, processInfo.cwd))
  );
}

function hasExpectedCommand(processInfo: ProcessInfo, kind: OwnedCommandKind | null): boolean {
  if (kind === 'build') return /\bturbo\b/.test(processInfo.command);
  if (kind === 'playwright') {
    return /\bplaywright\b/.test(processInfo.command) || /\bastro\b.*\bpreview\b/.test(processInfo.command);
  }
  return false;
}

/**
 * Classify a recorded process group conservatively.
 *
 * A matching PGID alone is never enough because an old PGID can eventually be
 * reused. At least one live member must also carry the run's temporary-path
 * marker, or a known build/Playwright command must have a cwd inside this
 * checkout. Once that proof exists, every member of the still-live process
 * group belongs to the same recorded job.
 */
export function ownedProcessesForRecord(
  record: E2EOwnershipRecord,
  actualRepoRoot: string,
  processes: ProcessInfo[],
): ProcessInfo[] {
  if (record.repoRoot !== actualRepoRoot || record.processGroupId === null) return [];
  if (!isPathWithin(getE2EStateDirectory(actualRepoRoot), record.runDir)) return [];
  if (!isPathWithin(record.runDir, record.tempDir)) return [];

  const group = processes.filter((processInfo) => processInfo.pgid === record.processGroupId);
  if (group.length === 0) return [];

  const proven = group.some(
    (processInfo) =>
      processInfo.command.includes(record.runDir) ||
      processInfo.command.includes(record.tempDir) ||
      (hasRepositoryMarker(processInfo, record) &&
        hasExpectedCommand(processInfo, record.commandKind)),
  );

  return proven ? group : [];
}

async function listProcesses(): Promise<ProcessInfo[]> {
  const { stdout } = await execFileAsync(
    'ps',
    ['-axo', 'pid=,ppid=,pgid=,command='],
    { maxBuffer: 16 * 1024 * 1024 },
  );
  return parsePsOutput(stdout);
}

async function readProcessCwd(pid: number): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync(
      'lsof',
      ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'],
      { maxBuffer: 1024 * 1024 },
    );
    const pathLine = stdout.split('\n').find((line) => line.startsWith('n/'));
    return pathLine?.slice(1);
  } catch {
    return undefined;
  }
}

async function enrichCwds(processes: ProcessInfo[]): Promise<ProcessInfo[]> {
  return Promise.all(
    processes.map(async (processInfo) => ({
      ...processInfo,
      cwd: await readProcessCwd(processInfo.pid),
    })),
  );
}

async function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolvePort) => {
    const socket = createConnection({ host: E2E_HOST, port });
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolvePort(value);
    };
    socket.setTimeout(300, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

async function inspectPort(port: number): Promise<PortInspection> {
  try {
    const { stdout } = await execFileAsync(
      'lsof',
      ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fp'],
      { maxBuffer: 1024 * 1024 },
    );
    const pids = [
      ...new Set(
        stdout
          .split('\n')
          .filter((line) => /^p\d+$/.test(line))
          .map((line) => Number(line.slice(1))),
      ),
    ];
    const portOpen = await isPortOpen(port);
    return {
      port,
      pids: portOpen ? pids : [],
      attributionAvailable: !portOpen || pids.length > 0,
      portOpen,
    };
  } catch (error) {
    const failure = error as ExecFailure;
    if (failure.code === 1) {
      const portOpen = await isPortOpen(port);
      return {
        port,
        pids: [],
        attributionAvailable: !portOpen,
        portOpen,
      };
    }
    if (failure.code === 'ENOENT') {
      return {
        port,
        pids: [],
        attributionAvailable: false,
        portOpen: await isPortOpen(port),
      };
    }
    throw error;
  }
}

export type LoopbackPortBinder = (
  requestedPort: number,
) => Promise<number | null>;

async function bindAndReleaseLoopbackPort(
  requestedPort: number,
): Promise<number | null> {
  return new Promise((resolvePort, rejectPort) => {
    const server = createServer();
    let settled = false;
    const finish = (error: Error | null, port: number | null) => {
      if (settled) return;
      settled = true;
      if (error) rejectPort(error);
      else resolvePort(port);
    };

    server.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE' || error.code === 'EACCES') {
        finish(null, null);
      } else {
        finish(error, null);
      }
    });
    server.listen(
      { host: E2E_HOST, port: requestedPort, exclusive: true },
      () => {
        const address = server.address();
        if (address === null || typeof address === 'string') {
          server.close(() => finish(
            new Error('Could not resolve the selected E2E loopback port.'),
            null,
          ));
          return;
        }
        server.close((error) =>
          finish(error ?? null, error ? null : address.port),
        );
      },
    );
  });
}

export async function selectE2EPort(
  binder: LoopbackPortBinder = bindAndReleaseLoopbackPort,
): Promise<number> {
  const defaultResult = await binder(E2E_PORT);
  if (defaultResult === E2E_PORT) return E2E_PORT;
  if (defaultResult !== null) {
    throw new Error(
      `Default-port probe returned an unexpected port: ${defaultResult}`,
    );
  }

  const alternate = await binder(0);
  if (!isValidE2EPort(alternate) || alternate === E2E_PORT) {
    throw new Error('Could not allocate a verified free alternate E2E port.');
  }
  return alternate;
}

export async function assertE2EPortAvailable(
  port: number,
  binder: LoopbackPortBinder = bindAndReleaseLoopbackPort,
): Promise<void> {
  if (!isValidE2EPort(port) || await binder(port) !== port) {
    throw new Error(
      `Selected E2E port ${port} is no longer available on ${E2E_HOST}.`,
    );
  }
}

function assertSafeRunDirectory(repoRoot: string, runDir: string): void {
  const stateDir = getE2EStateDirectory(repoRoot);
  if (runDir === stateDir || !isPathWithin(stateDir, runDir)) {
    throw new Error(`Refusing to remove unsafe E2E run directory: ${runDir}`);
  }
}

export async function createOwnershipRecord(
  repoRoot: string,
  suite: E2ESuite,
  port: number,
): Promise<E2EOwnershipRecord> {
  if (!isValidE2EPort(port)) {
    throw new Error(`Refusing invalid E2E ownership port: ${String(port)}`);
  }
  const stateDir = getE2EStateDirectory(repoRoot);
  const runId = `${Date.now()}-${randomUUID()}`;
  const runDir = join(stateDir, runId);
  const tempDir = join(runDir, 'tmp');
  await mkdir(tempDir, { recursive: true });

  const record: E2EOwnershipRecord = {
    schemaVersion: 2,
    repoRoot,
    runId,
    suite,
    port,
    wrapperPid: process.pid,
    runDir,
    tempDir,
    startedAt: new Date().toISOString(),
    childPid: null,
    processGroupId: null,
    commandKind: null,
    command: [],
  };
  await writeOwnershipRecord(record);
  return record;
}

export async function writeOwnershipRecord(record: E2EOwnershipRecord): Promise<void> {
  const runId = record.runId;
  if (!isOwnershipRecordForRun(record, record.repoRoot, record.runId)) {
    throw new Error(`Refusing to write invalid E2E ownership record: ${runId}`);
  }
  assertSafeRunDirectory(record.repoRoot, record.runDir);
  await mkdir(record.runDir, { recursive: true });
  const target = join(record.runDir, OWNERSHIP_FILE);
  const temporary = `${target}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  await rename(temporary, target);
}

export async function removeOwnershipRecord(record: E2EOwnershipRecord): Promise<void> {
  assertSafeRunDirectory(record.repoRoot, record.runDir);
  await rm(record.runDir, { recursive: true, force: true });
}

function isPositiveInteger(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 0
  );
}

function isOwnershipRecordForRun(
  value: unknown,
  repoRoot: string,
  runId: string,
): value is E2EOwnershipRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Partial<E2EOwnershipRecord>;
  const runDir = join(getE2EStateDirectory(repoRoot), runId);
  const validSuite = record.suite === 'regression' || record.suite === 'screenshots';
  const validCommandKind =
    record.commandKind === null ||
    record.commandKind === 'build' ||
    record.commandKind === 'playwright';
  const command = Array.isArray(record.command) ? record.command : null;
  const validCommand =
    command !== null &&
    command.every((part) => typeof part === 'string' && part.length > 0);
  const validLifecycleState = validCommand && command !== null && (
    (
      record.commandKind === null &&
      record.childPid === null &&
      record.processGroupId === null &&
      command.length === 0
    ) ||
    (
      record.commandKind !== null &&
      isPositiveInteger(record.childPid) &&
      isPositiveInteger(record.processGroupId) &&
      command.length > 0
    )
  );

  return (
    record.schemaVersion === 2 &&
    record.repoRoot === repoRoot &&
    record.runId === runId &&
    validSuite &&
    isValidE2EPort(record.port) &&
    isPositiveInteger(record.wrapperPid) &&
    record.runDir === runDir &&
    record.tempDir === join(runDir, 'tmp') &&
    typeof record.startedAt === 'string' &&
    Number.isFinite(Date.parse(record.startedAt)) &&
    validCommandKind &&
    validLifecycleState
  );
}

export async function readE2EOwnershipInventory(
  repoRoot: string,
): Promise<E2EOwnershipInventory> {
  const stateDir = getE2EStateDirectory(repoRoot);
  let entries;
  try {
    entries = await readdir(stateDir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { records: [], invalidRecords: [] };
    }
    throw error;
  }

  const records: E2EOwnershipRecord[] = [];
  const invalidRecords: InvalidE2EOwnershipRecord[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isDirectory()) continue;
    try {
      const raw = await readFile(join(stateDir, entry.name, OWNERSHIP_FILE), 'utf8');
      const parsed: unknown = JSON.parse(raw);
      if (isOwnershipRecordForRun(parsed, repoRoot, entry.name)) {
        records.push(parsed);
      } else {
        invalidRecords.push({
          runId: entry.name,
          reason: 'ownership record has an invalid or foreign schema',
        });
      }
    } catch {
      invalidRecords.push({
        runId: entry.name,
        reason: 'ownership record is missing, unreadable, or truncated',
      });
    }
  }
  return { records, invalidRecords };
}

export async function readOwnershipRecords(repoRoot: string): Promise<E2EOwnershipRecord[]> {
  return (await readE2EOwnershipInventory(repoRoot)).records;
}

function signalProcessGroup(processGroupId: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-processGroupId, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
  }
}

function signalExactPid(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
  }
}

async function waitForPidsToExit(pids: number[], timeoutMs: number): Promise<number[]> {
  const deadline = Date.now() + timeoutMs;
  let remaining = [...pids];
  while (remaining.length > 0 && Date.now() < deadline) {
    remaining = remaining.filter((pid) => {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    });
    if (remaining.length > 0) {
      await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    }
  }
  return remaining;
}

const systemTerminationController: TerminationController = {
  signalGroup: signalProcessGroup,
  signalPid: signalExactPid,
  waitForExit: waitForPidsToExit,
};

export async function terminateOwnedGroup(
  processGroupId: number,
  ownedProcesses: ProcessInfo[],
  controller: TerminationController = systemTerminationController,
): Promise<void> {
  if (ownedProcesses.length === 0) return;
  const pids = ownedProcesses.map((processInfo) => processInfo.pid);
  controller.signalGroup(processGroupId, 'SIGTERM');
  const remaining = await controller.waitForExit(pids, 5_000);
  for (const pid of remaining) controller.signalPid(pid, 'SIGKILL');
  const survivors = await controller.waitForExit(remaining, 1_000);
  if (survivors.length > 0) {
    throw new Error(
      `Repository-owned E2E process(es) did not exit: ${survivors.join(', ')}`,
    );
  }
}

async function inspectOwnedState(
  repoRoot: string,
  suppliedInventory?: E2EOwnershipInventory,
): Promise<{
  records: E2EOwnershipRecord[];
  invalidRecords: InvalidE2EOwnershipRecord[];
  processes: ProcessInfo[];
  ownedByRun: Map<string, ProcessInfo[]>;
}> {
  const inventory =
    suppliedInventory ?? await readE2EOwnershipInventory(repoRoot);
  const { records, invalidRecords } = inventory;
  const rawProcesses = await listProcesses();
  const candidatePids = new Set<number>();
  for (const record of records) {
    if (record.processGroupId === null) continue;
    for (const processInfo of rawProcesses) {
      if (processInfo.pgid === record.processGroupId) candidatePids.add(processInfo.pid);
    }
  }
  const candidates = await enrichCwds(
    rawProcesses.filter((processInfo) => candidatePids.has(processInfo.pid)),
  );
  const byPid = new Map(candidates.map((processInfo) => [processInfo.pid, processInfo]));
  const processes = rawProcesses.map((processInfo) => byPid.get(processInfo.pid) ?? processInfo);
  const ownedByRun = new Map<string, ProcessInfo[]>();
  for (const record of records) {
    ownedByRun.set(
      record.runId,
      ownedProcessesForRecord(record, repoRoot, processes),
    );
  }
  return { records, invalidRecords, processes, ownedByRun };
}

export function summarizeE2EStatus(
  records: E2EOwnershipRecord[],
  invalidRecords: InvalidE2EOwnershipRecord[],
  ownedByRun: Map<string, ProcessInfo[]>,
  portInspections: Map<number, PortInspection>,
): E2EStatus {
  const ownedPids = [
    ...new Set([...ownedByRun.values()].flat().map((processInfo) => processInfo.pid)),
  ].sort((a, b) => a - b);
  const ownedPorts = [...new Set(records.map(({ port }) => port))]
    .sort((a, b) => a - b);
  const diagnostics = invalidRecords.map(
    ({ runId, reason }) =>
      `run ${JSON.stringify(runId)}: ${reason}; no process ownership can be proven`,
  );

  for (const record of records) {
    const owned = ownedByRun.get(record.runId) ?? [];
    diagnostics.push(
      owned.length > 0
        ? `run ${record.runId}: recorded port ${record.port}; owned pids ${owned.map((processInfo) => processInfo.pid).join(', ')}`
        : `run ${record.runId}: recorded port ${record.port}; ownership record has no proven live process`,
    );
    const recordedPort = portInspections.get(record.port);
    if (recordedPort?.portOpen) {
      diagnostics.push(
        recordedPort.attributionAvailable
          ? `run ${record.runId}: recorded port ${record.port} still has listener pids ${recordedPort.pids.join(', ')}`
          : `run ${record.runId}: recorded port ${record.port} is open, but lsof is unavailable for safe attribution`,
      );
    }
  }

  const invalidRunIds = invalidRecords.map(({ runId }) => runId);
  const staleRunIds = [
    ...records.map((record) => record.runId),
    ...invalidRunIds,
  ].sort();
  const defaultPort = portInspections.get(E2E_PORT) ?? {
    port: E2E_PORT,
    pids: [],
    attributionAvailable: false,
    portOpen: true,
  };
  const defaultPortOwned = records.some((record) => record.port === E2E_PORT);
  if (defaultPort.portOpen && !defaultPortOwned) {
    diagnostics.push(
      defaultPort.attributionAvailable
        ? `default port ${E2E_PORT}: unavailable to new E2E runs; unowned listener pids ${defaultPort.pids.join(', ')} were not signaled`
        : `default port ${E2E_PORT}: unavailable to new E2E runs and cannot be safely attributed; it was not signaled`,
    );
  }

  const portPids = [
    ...new Set(
      ownedPorts.flatMap((port) => portInspections.get(port)?.pids ?? []),
    ),
  ].sort((a, b) => a - b);
  const clean = ownedPids.length === 0 && staleRunIds.length === 0;
  return {
    clean,
    ownedPids,
    ownedPorts,
    portPids,
    defaultPortAvailable: !defaultPort.portOpen,
    defaultPortPids: defaultPort.pids,
    staleRunIds,
    invalidRunIds,
    attributionAvailable: [...portInspections.values()]
      .every(({ attributionAvailable }) => attributionAvailable),
    diagnostics,
  };
}

export async function inspectE2EStatus(repoRoot: string): Promise<E2EStatus> {
  const { records, invalidRecords, ownedByRun } = await inspectOwnedState(repoRoot);
  const ports = [
    ...new Set([E2E_PORT, ...records.map(({ port }) => port)]),
  ];
  const inspections = await Promise.all(ports.map((port) => inspectPort(port)));
  return summarizeE2EStatus(
    records,
    invalidRecords,
    ownedByRun,
    new Map(inspections.map((inspection) => [inspection.port, inspection])),
  );
}

export async function cleanupStaleE2EProcesses(repoRoot: string): Promise<void> {
  const inventory = await readE2EOwnershipInventory(repoRoot);
  if (inventory.invalidRecords.length > 0) {
    const runIds = inventory.invalidRecords
      .map(({ runId }) => JSON.stringify(runId))
      .join(', ');
    throw new Error(
      `Refusing E2E cleanup because ownership cannot be proven for run(s) ${runIds}. ` +
      'Inspect and remove only the exact stale run directories manually.',
    );
  }

  const initial = await inspectOwnedState(repoRoot, inventory);

  for (const record of initial.records) {
    const owned = initial.ownedByRun.get(record.runId) ?? [];
    if (owned.length > 0 && record.processGroupId !== null) {
      await terminateOwnedGroup(record.processGroupId, owned);
    }

    const refreshed = await listProcesses();
    const stillMarked = refreshed.filter(
      (processInfo) =>
        processInfo.command.includes(record.runDir) ||
        processInfo.command.includes(record.tempDir),
    );
    for (const processInfo of stillMarked) {
      signalExactPid(processInfo.pid, 'SIGTERM');
    }
    const remaining = await waitForPidsToExit(
      stillMarked.map((processInfo) => processInfo.pid),
      5_000,
    );
    for (const pid of remaining) signalExactPid(pid, 'SIGKILL');
    const survivors = await waitForPidsToExit(remaining, 1_000);
    if (survivors.length > 0) {
      throw new Error(
        `Stale E2E process(es) did not exit: ${survivors.join(', ')}`,
      );
    }
  }

  const inspectedPorts = new Map<number, PortInspection>();
  for (const record of initial.records) {
    let inspection = inspectedPorts.get(record.port);
    if (!inspection) {
      inspection = await inspectPort(record.port);
      inspectedPorts.set(record.port, inspection);
    }
    assertRecordedPortReleased(record, inspection);
  }

  for (const record of initial.records) {
    await removeOwnershipRecord(record);
  }
}

export function assertRecordedPortReleased(
  record: Pick<E2EOwnershipRecord, 'runId' | 'port'>,
  inspection: PortInspection,
): void {
  if (inspection.port !== record.port) {
    throw new Error(
      `Port inspection mismatch for E2E run ${record.runId}: ` +
      `recorded ${record.port}, inspected ${inspection.port}.`,
    );
  }
  if (!inspection.portOpen) return;

  const listener = inspection.attributionAvailable && inspection.pids.length > 0
    ? ` listener PID(s) ${inspection.pids.join(', ')}`
    : ' an unattributed listener';
  throw new Error(
    `Recorded E2E port ${record.port} for run ${record.runId} still has${listener}; ` +
    'refusing to signal a listener without recorded process-group or profile proof.',
  );
}

export async function cleanupCurrentRun(record: E2EOwnershipRecord): Promise<void> {
  const table = await listProcesses();
  const group = record.processGroupId === null
    ? []
    : table.filter((processInfo) => processInfo.pgid === record.processGroupId);
  const enriched = await enrichCwds(group);
  const owned = ownedProcessesForRecord(record, record.repoRoot, enriched);
  if (owned.length > 0 && record.processGroupId !== null) {
    await terminateOwnedGroup(record.processGroupId, owned);
  }

  const remainingTable = await listProcesses();
  const marked = remainingTable.filter(
    (processInfo) =>
      processInfo.command.includes(record.runDir) ||
      processInfo.command.includes(record.tempDir),
  );
  for (const processInfo of marked) signalExactPid(processInfo.pid, 'SIGTERM');
  const remaining = await waitForPidsToExit(
    marked.map((processInfo) => processInfo.pid),
    5_000,
  );
  for (const pid of remaining) signalExactPid(pid, 'SIGKILL');
  const survivors = await waitForPidsToExit(remaining, 1_000);
  if (survivors.length > 0) {
    throw new Error(
      `Current E2E process(es) did not exit: ${survivors.join(', ')}`,
    );
  }

  const port = await inspectPort(record.port);
  assertRecordedPortReleased(record, port);
  await removeOwnershipRecord(record);
}
