import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PendingNavigation,
  type NavigationTimerScheduler,
} from '../src/lib/pending-navigation.js';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

class FakeTimerScheduler implements NavigationTimerScheduler {
  now = 0;
  nextHandle = 1;
  tasks = new Map<number, { at: number; callback: () => void }>();

  setTimeout(callback: () => void, delayMs: number): number {
    const handle = this.nextHandle++;
    this.tasks.set(handle, { at: this.now + delayMs, callback });
    return handle;
  }

  clearTimeout(handle: unknown): void {
    this.tasks.delete(handle as number);
  }

  advanceBy(milliseconds: number): void {
    const end = this.now + milliseconds;
    while (true) {
      const next = [...this.tasks.entries()]
        .filter(([, task]) => task.at <= end)
        .sort((left, right) => left[1].at - right[1].at)[0];
      if (!next) break;
      const [handle, task] = next;
      this.tasks.delete(handle);
      this.now = task.at;
      task.callback();
    }
    this.now = end;
  }
}

describe('pending navigation ownership', () => {
  test('an admitted file mutation cancels the old success countdown', () => {
    const timers = new FakeTimerScheduler();
    const pending = new PendingNavigation(timers);
    const navigations: string[] = [];
    pending.schedule(() => {
      navigations.push('old-dashboard');
    }, 1_200);

    timers.advanceBy(1_199);
    pending.cancel(); // the production admitted-file mutation boundary
    timers.advanceBy(1);

    expect(navigations).toEqual([]);
    expect(timers.tasks.size).toBe(0);
  });

  test('an async callback can recheck ownership after its await', async () => {
    const timers = new FakeTimerScheduler();
    const pending = new PendingNavigation(timers);
    let continueNavigation!: () => void;
    const dependency = new Promise<void>((resolve) => {
      continueNavigation = resolve;
    });
    const navigations: string[] = [];

    pending.schedule(async (owner) => {
      await dependency;
      if (pending.isCurrent(owner)) {
        navigations.push('dashboard');
      }
    }, 1_200);
    timers.advanceBy(1_200);
    pending.cancel();
    continueNavigation();
    await dependency;
    await Promise.resolve();

    expect(navigations).toEqual([]);
  });

  test('the dropzone centralizes admitted mutations and rechecks async navigation ownership', async () => {
    const dropzone = await readFile(
      resolve(webRoot, 'src/components/upload/FileDropzone.svelte'),
      'utf8',
    );

    expect(dropzone).toContain('function beginAdmittedFileMutation()');
    expect(dropzone).toMatch(
      /if \(admission\.accepted\.length > 0\) \{[\s\S]*?beginAdmittedFileMutation\(\);[\s\S]*?uploadedFiles =/,
    );
    expect(dropzone).toContain('pendingNavigation.schedule(async (owner)');
    expect(
      dropzone.match(/pendingNavigation\.isCurrent\(owner\)/g),
    ).toHaveLength(3);
    expect(dropzone).not.toContain('navigateTimeout');
  });
});
