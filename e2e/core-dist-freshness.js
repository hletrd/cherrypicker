const fs = require('node:fs');
const path = require('node:path');

function listTypeScriptSources(directory) {
  const sources = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      sources.push(...listTypeScriptSources(absolute));
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.d.ts')
    ) {
      sources.push(absolute);
    }
  }
  return sources;
}

function coreDistFreshnessFailures(coreRoot) {
  const sourceRoot = path.join(coreRoot, 'src');
  const distRoot = path.join(coreRoot, 'dist');
  if (!fs.existsSync(distRoot)) {
    return ['dist/ is missing'];
  }

  const failures = [];
  for (const sourcePath of listTypeScriptSources(sourceRoot)) {
    const relative = path.relative(sourceRoot, sourcePath);
    const distPath = path.join(
      distRoot,
      relative.replace(/\.ts$/, '.js'),
    );
    if (!fs.existsSync(distPath)) {
      failures.push(`${relative}: compiled peer is missing`);
      continue;
    }
    if (fs.statSync(sourcePath).mtimeMs > fs.statSync(distPath).mtimeMs) {
      failures.push(`${relative}: source is newer than compiled peer`);
    }
  }
  return failures;
}

function assertFreshCoreDist(coreRoot) {
  const failures = coreDistFreshnessFailures(coreRoot);
  if (failures.length === 0) return;
  throw new Error(
    'packages/core/src is not fully represented by a fresh dist/. ' +
    'Run the suite through `bun run test:e2e` so the current core package is built first.\n' +
    failures.map((failure) => `- ${failure}`).join('\n'),
  );
}

module.exports = {
  assertFreshCoreDist,
  coreDistFreshnessFailures,
};
