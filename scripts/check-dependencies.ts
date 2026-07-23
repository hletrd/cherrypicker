import { createHash } from 'node:crypto';
import { builtinModules } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKSPACE_PARENTS = ['apps', 'packages', 'tools'] as const;
const SOURCE_EXTENSIONS = new Set([
  '.astro',
  '.cjs',
  '.js',
  '.jsx',
  '.mjs',
  '.svelte',
  '.ts',
  '.tsx',
]);
const EXPECTED_VENDOR_DIGESTS = new Map<string, {
  sha256: string;
  sha512: string;
}>([
  [
    'vendor/xlsx-0.20.3.tgz',
    {
      sha256:
        '8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8',
      sha512:
        'a0b0eade3c3b01c2ea2961f60210a9553665f267fa5f661178ff8d7a1d12254cd5fc1759623b61f78b46e6da22301d4f3eb62dc4e09f6a850292fb6e1fedc024',
    },
  ],
]);
const XLSX_VENDOR_SPECIFIER = 'file:../../vendor/xlsx-0.20.3.tgz';
const XLSX_CONSUMER_MANIFESTS = [
  'apps/web/package.json',
  'packages/parser/package.json',
] as const;
const NODE_BUILTINS = new Set(
  builtinModules.flatMap((name) => [name, name.replace(/^node:/, '')]),
);
const SEMVER_NUMBER = String.raw`(?:0|[1-9]\d*)`;
const SEMVER_PRERELEASE_IDENTIFIER = String.raw`(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)`;
const SEMVER_PRERELEASE = String.raw`${SEMVER_PRERELEASE_IDENTIFIER}(?:\.${SEMVER_PRERELEASE_IDENTIFIER})*`;
const SEMVER_BUILD = String.raw`[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*`;
const EXACT_SEMVER = new RegExp(
  String.raw`^${SEMVER_NUMBER}\.${SEMVER_NUMBER}\.${SEMVER_NUMBER}(?:-${SEMVER_PRERELEASE})?(?:\+${SEMVER_BUILD})?$`,
  'u',
);
const SEMVER_WILDCARD = String.raw`(?:[xX*])`;
const SEMVER_PARTIAL = String.raw`(?:${SEMVER_WILDCARD}|${SEMVER_NUMBER}(?:\.(?:${SEMVER_WILDCARD}|${SEMVER_NUMBER}(?:\.(?:${SEMVER_WILDCARD}|${SEMVER_NUMBER}))?))?)`;
const SEMVER_RANGE_VERSION = String.raw`(?:${SEMVER_NUMBER}\.${SEMVER_NUMBER}\.${SEMVER_NUMBER}(?:-${SEMVER_PRERELEASE})?(?:\+${SEMVER_BUILD})?|${SEMVER_PARTIAL})`;
const SEMVER_COMPARATOR = new RegExp(
  String.raw`^(?:\^|~|<=|>=|<|>|=)?${SEMVER_RANGE_VERSION}$`,
  'u',
);
const SEMVER_HYPHEN_RANGE = new RegExp(
  String.raw`^${SEMVER_RANGE_VERSION}\s+-\s+${SEMVER_RANGE_VERSION}$`,
  'u',
);

interface PackageManifest {
  name: string;
  dependencies?: Record<string, string>;
}

interface LockPeerMetadata {
  optionalPeers?: unknown;
  peerDependencies?: unknown;
}

interface LockWorkspace extends LockPeerMetadata {
  name?: unknown;
  version?: unknown;
}

interface ParsedTextLock {
  packages?: unknown;
  workspaces?: unknown;
}

export interface UndeclaredImport {
  workspace: string;
  sourceFile: string;
  specifier: string;
  packageName: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPackageName(value: string): boolean {
  if (value.startsWith('@')) {
    return /^@[^/]+\/[^/]+$/u.test(value);
  }
  return value.length > 0 && !value.includes('/');
}

function splitPackagePath(path: string): string[] | null {
  const rawSegments = path.split('/');
  const packages: string[] = [];
  for (let index = 0; index < rawSegments.length; index += 1) {
    const segment = rawSegments[index];
    if (!segment) return null;
    if (segment.startsWith('@')) {
      const packageSegment = rawSegments[index + 1];
      if (!packageSegment || packageSegment.startsWith('@')) return null;
      packages.push(`${segment}/${packageSegment}`);
      index += 1;
    } else {
      packages.push(segment);
    }
  }
  return packages;
}

function packageNameFromPath(path: string): string | null {
  return splitPackagePath(path)?.at(-1) ?? null;
}

function isSemverVersion(value: string): boolean {
  if (!EXACT_SEMVER.test(value)) return false;
  try {
    return Bun.semver.order(value, value) === 0;
  } catch {
    return false;
  }
}

function isSupportedSemverRange(value: string): boolean {
  if (!value.trim()) return false;
  return value.split('||').every((rawClause) => {
    const clause = rawClause.trim();
    if (!clause) return false;
    if (SEMVER_HYPHEN_RANGE.test(clause)) return true;
    return clause
      .split(/\s+/u)
      .every((comparator) => SEMVER_COMPARATOR.test(comparator));
  });
}

function packageOwnerLabel(key: string, row: unknown): string {
  if (Array.isArray(row) && typeof row[0] === 'string') return row[0];
  return key;
}

function packagePeerMetadata(
  row: unknown[],
): LockPeerMetadata | null | undefined {
  if (isRecord(row[1])) return row[1];
  if (row[1] !== undefined && typeof row[1] !== 'string') return undefined;
  if (row[2] === undefined) return null;
  return isRecord(row[2]) ? row[2] : undefined;
}

function workspaceOwnerLabel(path: string, workspace: LockWorkspace): string {
  const name =
    typeof workspace.name === 'string' ? workspace.name : `workspace:${path}`;
  return typeof workspace.version === 'string'
    ? `${name}@${workspace.version}`
    : name;
}

function findNearestPackage(
  packages: Record<string, unknown>,
  ownerPath: string,
  peerName: string,
): { key: string; row: unknown } | null {
  const ownerPackages = splitPackagePath(ownerPath);
  if (!ownerPackages || !isPackageName(peerName)) return null;
  for (let length = ownerPackages.length; length >= 0; length -= 1) {
    const candidate = [...ownerPackages.slice(0, length), peerName].join('/');
    if (Object.hasOwn(packages, candidate)) {
      return { key: candidate, row: packages[candidate] };
    }
  }
  return null;
}

type ResolvedPackageVersion =
  | { kind: 'resolved'; version: string }
  | { kind: 'malformed' }
  | { kind: 'unsupported'; locator: string };

function resolvedPackageVersion(
  key: string,
  row: unknown,
  workspaces: Record<string, unknown>,
): ResolvedPackageVersion {
  if (!Array.isArray(row) || typeof row[0] !== 'string') {
    return { kind: 'malformed' };
  }
  const locator = row[0];
  const packageName = packageNameFromPath(key);
  if (!packageName) return { kind: 'unsupported', locator };

  const workspacePrefix = `${packageName}@workspace:`;
  if (locator.startsWith(workspacePrefix)) {
    const workspacePath = locator.slice(workspacePrefix.length);
    const workspace = workspaces[workspacePath];
    if (
      !isRecord(workspace) ||
      workspace.name !== packageName ||
      typeof workspace.version !== 'string' ||
      !isSemverVersion(workspace.version)
    ) {
      return { kind: 'unsupported', locator };
    }
    return { kind: 'resolved', version: workspace.version };
  }

  const registryPrefix = `${packageName}@`;
  if (!locator.startsWith(registryPrefix)) {
    return { kind: 'unsupported', locator };
  }
  const version = locator.slice(registryPrefix.length);
  if (!isSemverVersion(version)) {
    return { kind: 'unsupported', locator };
  }
  return { kind: 'resolved', version };
}

function peerMetadata(
  ownerLabel: string,
  metadata: LockPeerMetadata,
  issues: Set<string>,
): {
  optionalPeers: Set<string>;
  peerDependencies: Record<string, string>;
} | null {
  if (
    metadata.peerDependencies !== undefined &&
    !isRecord(metadata.peerDependencies)
  ) {
    issues.add(
      `bun.lock: ${ownerLabel} has malformed peerDependencies metadata`,
    );
    return null;
  }

  const peerDependencies: Record<string, string> = {};
  for (const [peerName, range] of Object.entries(
    metadata.peerDependencies ?? {},
  )) {
    if (!isPackageName(peerName) || typeof range !== 'string') {
      issues.add(
        `bun.lock: ${ownerLabel} has malformed peer dependency metadata`,
      );
      return null;
    }
    peerDependencies[peerName] = range;
  }

  if (
    metadata.optionalPeers !== undefined &&
    (!Array.isArray(metadata.optionalPeers) ||
      metadata.optionalPeers.some(
        (peer) => typeof peer !== 'string' || !isPackageName(peer),
      ))
  ) {
    issues.add(`bun.lock: ${ownerLabel} has malformed optionalPeers metadata`);
    return null;
  }
  const optionalPeers = new Set(
    (metadata.optionalPeers as string[] | undefined) ?? [],
  );
  for (const optionalPeer of optionalPeers) {
    if (!Object.hasOwn(peerDependencies, optionalPeer)) {
      issues.add(
        `bun.lock: ${ownerLabel} marks undeclared peer ${optionalPeer} as optional`,
      );
    }
  }
  return { optionalPeers, peerDependencies };
}

function validateOwnerPeers(
  ownerLabel: string,
  ownerPath: string,
  metadata: LockPeerMetadata,
  packages: Record<string, unknown>,
  workspaces: Record<string, unknown>,
  issues: Set<string>,
  referencedMalformedRows: Set<string>,
): void {
  const parsedMetadata = peerMetadata(ownerLabel, metadata, issues);
  if (!parsedMetadata) return;

  for (const [peerName, range] of Object.entries(
    parsedMetadata.peerDependencies,
  )) {
    const optional = parsedMetadata.optionalPeers.has(peerName);
    const requirement = optional ? 'optional' : 'required';
    if (!isSupportedSemverRange(range)) {
      issues.add(
        `bun.lock: ${ownerLabel} ${requirement} peer ${peerName} has unsupported range ${range}`,
      );
      continue;
    }
    const resolved = findNearestPackage(packages, ownerPath, peerName);
    if (!resolved) {
      if (!optional) {
        issues.add(
          `bun.lock: ${ownerLabel} required peer ${peerName} requires ${range}, but it is missing`,
        );
      }
      continue;
    }

    const resolution = resolvedPackageVersion(
      resolved.key,
      resolved.row,
      workspaces,
    );
    if (resolution.kind === 'malformed') {
      referencedMalformedRows.add(resolved.key);
      issues.add(
        `bun.lock: ${ownerLabel} ${requirement} peer ${peerName} requires ${range}, but ${peerName} has a malformed package row`,
      );
      continue;
    }
    if (resolution.kind === 'unsupported') {
      issues.add(
        `bun.lock: ${ownerLabel} ${requirement} peer ${peerName} requires ${range}, but ${resolution.locator} is an unsupported locator`,
      );
      continue;
    }

    let satisfies = false;
    try {
      satisfies = Bun.semver.satisfies(resolution.version, range);
    } catch {
      issues.add(
        `bun.lock: ${ownerLabel} ${requirement} peer ${peerName} has unsupported range ${range}`,
      );
      continue;
    }
    if (!satisfies) {
      issues.add(
        `bun.lock: ${ownerLabel} ${requirement} peer ${peerName} requires ${range}, resolved ${resolution.version}`,
      );
    }
  }
}

export function findPeerDependencyMismatchesInLock(lockText: string): string[] {
  let parsed: unknown;
  try {
    parsed = Bun.JSONC.parse(lockText);
  } catch {
    return ['bun.lock: invalid JSONC'];
  }
  if (!isRecord(parsed)) return ['bun.lock: expected a root object'];

  const lock = parsed as ParsedTextLock;
  if (!isRecord(lock.packages)) {
    return ['bun.lock: expected a packages object'];
  }
  if (!isRecord(lock.workspaces)) {
    return ['bun.lock: expected a workspaces object'];
  }

  const packages = lock.packages;
  const workspaces = lock.workspaces;
  const issues = new Set<string>();
  const malformedPackageRows = new Set<string>();
  const referencedMalformedRows = new Set<string>();

  for (const [key, row] of Object.entries(packages)) {
    if (
      !Array.isArray(row) ||
      typeof row[0] !== 'string' ||
      row[0].length === 0
    ) {
      malformedPackageRows.add(key);
      continue;
    }
    const metadata = packagePeerMetadata(row);
    if (metadata === null) continue;
    if (metadata === undefined) {
      issues.add(
        `bun.lock: ${packageOwnerLabel(key, row)} has malformed metadata`,
      );
      continue;
    }
    validateOwnerPeers(
      packageOwnerLabel(key, row),
      key,
      metadata,
      packages,
      workspaces,
      issues,
      referencedMalformedRows,
    );
  }

  for (const [path, workspace] of Object.entries(workspaces)) {
    if (!isRecord(workspace)) {
      issues.add(
        `bun.lock: workspace ${path || '<root>'} has malformed metadata`,
      );
      continue;
    }
    if (
      workspace.peerDependencies === undefined &&
      workspace.optionalPeers === undefined
    ) {
      continue;
    }
    const ownerLabel = workspaceOwnerLabel(path, workspace);
    const ownerPath =
      typeof workspace.name === 'string' ? workspace.name : `workspace:${path}`;
    validateOwnerPeers(
      ownerLabel,
      ownerPath,
      workspace,
      packages,
      workspaces,
      issues,
      referencedMalformedRows,
    );
  }

  for (const key of malformedPackageRows) {
    if (!referencedMalformedRows.has(key)) {
      issues.add(`bun.lock: package ${key} has a malformed package row`);
    }
  }

  return [...issues].sort();
}

export async function findPeerDependencyMismatches(
  repoRoot = REPO_ROOT,
): Promise<string[]> {
  const lockText = await readFile(join(repoRoot, 'bun.lock'), 'utf8');
  return findPeerDependencyMismatchesInLock(lockText);
}

async function listDirectories(path: string): Promise<string[]> {
  return (await readdir(path, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(path, entry.name))
    .sort();
}

async function listSourceFiles(path: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await listSourceFiles(child)));
    } else if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name))) {
      result.push(child);
    }
  }
  return result.sort();
}

function packageNameFromSpecifier(specifier: string): string | null {
  if (specifier.startsWith('astro:')) return 'astro';
  if (
    specifier.startsWith('.') ||
    specifier.startsWith('/') ||
    specifier.startsWith('#') ||
    specifier.startsWith('node:') ||
    specifier.startsWith('bun:')
  ) {
    return null;
  }
  const [first, second] = specifier.split('/');
  const packageName = first?.startsWith('@')
    ? `${first}/${second ?? ''}`
    : first;
  if (!packageName || NODE_BUILTINS.has(packageName)) return null;
  return packageName;
}

function collectModuleSpecifiers(sourceText: string, fileName: string): string[] {
  const extension = extname(fileName);
  const moduleSources: string[] = [];
  if (extension === '.svelte') {
    for (const match of sourceText.matchAll(
      /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/giu,
    )) {
      moduleSources.push(match[1] ?? '');
    }
  } else if (extension === '.astro') {
    const frontmatter = sourceText.match(/^---\s*\n([\s\S]*?)\n---/u);
    if (frontmatter) moduleSources.push(frontmatter[1] ?? '');
    for (const match of sourceText.matchAll(
      /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/giu,
    )) {
      moduleSources.push(match[1] ?? '');
    }
  } else {
    moduleSources.push(sourceText);
  }

  const scriptKind =
    extension === '.tsx'
      ? ts.ScriptKind.TSX
      : extension === '.jsx'
        ? ts.ScriptKind.JSX
        : extension === '.js' ||
            extension === '.mjs' ||
            extension === '.cjs'
          ? ts.ScriptKind.JS
          : ts.ScriptKind.TS;
  const specifiers = new Set<string>();

  function addStringLiteral(node: ts.Node | undefined): void {
    if (node && ts.isStringLiteralLike(node)) specifiers.add(node.text);
  }

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      addStringLiteral(node.moduleSpecifier);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      addStringLiteral(node.moduleReference.expression);
    } else if (ts.isImportTypeNode(node)) {
      const argument = node.argument;
      if (ts.isLiteralTypeNode(argument)) addStringLiteral(argument.literal);
    } else if (ts.isCallExpression(node) && node.arguments.length > 0) {
      if (
        node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require')
      ) {
        addStringLiteral(node.arguments[0]);
      }
    }
    ts.forEachChild(node, visit);
  }

  for (const moduleSource of moduleSources) {
    visit(
      ts.createSourceFile(
        fileName,
        moduleSource,
        ts.ScriptTarget.Latest,
        true,
        scriptKind,
      ),
    );
  }
  return [...specifiers].sort();
}

export async function findUndeclaredProductionImports(
  repoRoot = REPO_ROOT,
): Promise<UndeclaredImport[]> {
  const issues: UndeclaredImport[] = [];
  for (const parent of WORKSPACE_PARENTS) {
    for (const workspacePath of await listDirectories(join(repoRoot, parent))) {
      const manifestPath = join(workspacePath, 'package.json');
      const sourcePath = join(workspacePath, 'src');
      let manifest: PackageManifest;
      let sourceFiles: string[];
      try {
        manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as PackageManifest;
        sourceFiles = await listSourceFiles(sourcePath);
      } catch (error) {
        if (
          error instanceof Error &&
          'code' in error &&
          error.code === 'ENOENT'
        ) {
          continue;
        }
        throw error;
      }

      const declared = new Set(Object.keys(manifest.dependencies ?? {}));
      declared.add(manifest.name);
      for (const sourceFile of sourceFiles) {
        const sourceText = await readFile(sourceFile, 'utf8');
        for (const specifier of collectModuleSpecifiers(sourceText, sourceFile)) {
          const packageName = packageNameFromSpecifier(specifier);
          if (packageName && !declared.has(packageName)) {
            issues.push({
              workspace: manifest.name,
              sourceFile: relative(repoRoot, sourceFile),
              specifier,
              packageName,
            });
          }
        }
      }
    }
  }
  return issues;
}

export async function digest(
  algorithm: 'sha256' | 'sha512',
  path: string,
): Promise<string> {
  return createHash(algorithm).update(await readFile(path)).digest('hex');
}

export async function findVendorDigestMismatches(
  repoRoot = REPO_ROOT,
): Promise<string[]> {
  const mismatches: string[] = [];
  for (const [path, expected] of EXPECTED_VENDOR_DIGESTS) {
    const archivePath = join(repoRoot, path);
    const [actualSha256, actualSha512] = await Promise.all([
      digest('sha256', archivePath),
      digest('sha512', archivePath),
    ]);
    if (actualSha256 !== expected.sha256) {
      mismatches.push(
        `${path}: expected SHA-256 ${expected.sha256}, received ${actualSha256}`,
      );
    }
    if (actualSha512 !== expected.sha512) {
      mismatches.push(
        `${path}: expected SHA-512 ${expected.sha512}, received ${actualSha512}`,
      );
    }
    const checksumPath = `${archivePath}.sha256`;
    const checksum = (await readFile(checksumPath, 'utf8')).trim();
    const expectedChecksum = `${expected.sha256}  ${path.split('/').at(-1)}`;
    if (checksum !== expectedChecksum) {
      mismatches.push(
        `${relative(repoRoot, checksumPath)}: expected ${expectedChecksum}`,
      );
    }
  }
  return mismatches;
}

export async function findRemoteDependencyReferences(
  repoRoot = REPO_ROOT,
): Promise<string[]> {
  const paths = [join(repoRoot, 'package.json'), join(repoRoot, 'bun.lock')];
  for (const parent of WORKSPACE_PARENTS) {
    for (const workspace of await listDirectories(join(repoRoot, parent))) {
      paths.push(join(workspace, 'package.json'));
    }
  }

  const references: string[] = [];
  for (const path of paths) {
    let content: string;
    try {
      content = await readFile(path, 'utf8');
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        continue;
      }
      throw error;
    }
    for (const [index, line] of content.split('\n').entries()) {
      if (/https?:\/\//u.test(line)) {
        references.push(`${relative(repoRoot, path)}:${index + 1}: ${line.trim()}`);
      }
    }
  }
  return references;
}

export async function findVendorReferenceMismatches(
  repoRoot = REPO_ROOT,
): Promise<string[]> {
  const mismatches: string[] = [];
  for (const manifestPath of XLSX_CONSUMER_MANIFESTS) {
    const manifest = JSON.parse(
      await readFile(join(repoRoot, manifestPath), 'utf8'),
    ) as PackageManifest;
    const actual = manifest.dependencies?.xlsx;
    if (actual !== XLSX_VENDOR_SPECIFIER) {
      mismatches.push(
        `${manifestPath}: expected xlsx ${XLSX_VENDOR_SPECIFIER}, received ${String(actual)}`,
      );
    }
  }

  const lock = await readFile(join(repoRoot, 'bun.lock'), 'utf8');
  const resolvedArchive = '"xlsx@../../vendor/xlsx-0.20.3.tgz"';
  if (!lock.includes(resolvedArchive)) {
    mismatches.push(`bun.lock: missing ${resolvedArchive}`);
  }
  return mismatches;
}

export async function checkDependencies(repoRoot = REPO_ROOT): Promise<string[]> {
  const [
    undeclared,
    digestMismatches,
    peerDependencyMismatches,
    remoteReferences,
    vendorReferenceMismatches,
  ] = await Promise.all([
    findUndeclaredProductionImports(repoRoot),
    findVendorDigestMismatches(repoRoot),
    findPeerDependencyMismatches(repoRoot),
    findRemoteDependencyReferences(repoRoot),
    findVendorReferenceMismatches(repoRoot),
  ]);
  return [
    ...undeclared.map(
      (issue) =>
        `${issue.sourceFile}: ${issue.specifier} is not a direct production dependency of ${issue.workspace}`,
    ),
    ...digestMismatches,
    ...peerDependencyMismatches,
    ...remoteReferences.map(
      (reference) => `${reference} uses an unauthenticated remote dependency`,
    ),
    ...vendorReferenceMismatches,
  ].sort();
}

if (import.meta.main) {
  const issues = await checkDependencies();
  if (issues.length > 0) {
    console.error('Dependency policy violations:');
    for (const issue of issues) console.error(`  ${issue}`);
    process.exitCode = 1;
  } else {
    console.log(
      'Dependency manifests, imports, peer contracts, and vendored archives are valid.',
    );
  }
}
