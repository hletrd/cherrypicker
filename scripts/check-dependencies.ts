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

interface PackageManifest {
  name: string;
  dependencies?: Record<string, string>;
}

export interface UndeclaredImport {
  workspace: string;
  sourceFile: string;
  specifier: string;
  packageName: string;
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
    remoteReferences,
    vendorReferenceMismatches,
  ] = await Promise.all([
    findUndeclaredProductionImports(repoRoot),
    findVendorDigestMismatches(repoRoot),
    findRemoteDependencyReferences(repoRoot),
    findVendorReferenceMismatches(repoRoot),
  ]);
  return [
    ...undeclared.map(
      (issue) =>
        `${issue.sourceFile}: ${issue.specifier} is not a direct production dependency of ${issue.workspace}`,
    ),
    ...digestMismatches,
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
    console.log('Dependency manifests, imports, and vendored archives are valid.');
  }
}
