import { defineConfig, type Plugin } from 'vitest/config';
import { resolve, dirname } from 'path';

/**
 * Vite plugin that replaces `import.meta.dir` (Bun-specific) with
 * `import.meta.dirname` (Node/vitest standard) in test files.
 * This allows test files written for `bun test` to also run under vitest.
 */
function bunMetaDirPlugin(): Plugin {
  return {
    name: 'bun-meta-dir-shim',
    enforce: 'pre',
    transform(code, id) {
      // Only transform test files that use import.meta.dir
      if (id.includes('__tests__') && code.includes('import.meta.dir')) {
        return code.replace(/\bimport\.meta\.dir\b/g, 'import.meta.dirname');
      }
    },
  };
}

export default defineConfig({
  plugins: [bunMetaDirPlugin()],
  resolve: {
    alias: {
      'bun:test': resolve(__dirname, 'vitest-bun-shim.ts'),
    },
  },
  test: {
    include: [
      'packages/core/__tests__/**/*.test.ts',
      'packages/parser/__tests__/detect.test.ts',
      'packages/parser/__tests__/csv.test.ts',
      'packages/rules/__tests__/**/*.test.ts',
      'packages/viz/__tests__/**/*.test.ts',
    ],
    // Test files that use Bun-only APIs beyond bun:test + import.meta.dir
    // (readFileSync with Bun paths, loadCardRule, etc.) may still fail
    // under vitest and only run under `bun test`.
  },
});
