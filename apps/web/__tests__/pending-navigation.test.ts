import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('explicit upload destination', () => {
  test('the dropzone keeps admitted mutations centralized without timed navigation', async () => {
    const dropzone = await readFile(
      resolve(webRoot, 'src/components/upload/FileDropzone.svelte'),
      'utf8',
    );

    expect(dropzone).toContain('function beginAdmittedFileMutation()');
    expect(dropzone).toMatch(
      /if \(admission\.accepted\.length > 0\) \{[\s\S]*?beginAdmittedFileMutation\(\);[\s\S]*?uploadedFiles =/,
    );
    expect(dropzone).toContain('async function openDashboard()');
    expect(dropzone).toContain('onclick={openDashboard}');
    expect(dropzone).toContain('dashboardButtonEl?.focus()');
    expect(dropzone).toContain('대시보드 보기');
    expect(dropzone).not.toContain('PendingNavigation');
    expect(dropzone).not.toContain('pendingNavigation.schedule');
    expect(dropzone).not.toContain('setTimeout(');
    expect(dropzone).not.toContain('1_200');
    expect(dropzone).not.toContain('navigateTimeout');
  });
});
