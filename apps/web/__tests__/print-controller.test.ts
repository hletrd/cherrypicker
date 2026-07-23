import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';

interface FakeEvent {
  target?: unknown;
  preventDefault(): void;
}

type Listener = (event: FakeEvent) => void;

class FakeEventTarget {
  readonly listeners = new Map<string, Listener[]>();

  addEventListener(type: string, listener: Listener): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type: string, event?: Partial<FakeEvent>): void {
    const fakeEvent: FakeEvent = {
      target: event?.target,
      preventDefault: event?.preventDefault ?? (() => {}),
    };
    for (const listener of this.listeners.get(type) ?? []) {
      listener(fakeEvent);
    }
  }
}

class FakeClassList {
  readonly values = new Set<string>();

  contains(value: string): boolean {
    return this.values.has(value);
  }

  add(value: string): void {
    this.values.add(value);
  }

  remove(value: string): void {
    this.values.delete(value);
  }

  toggle(value: string, force?: boolean): boolean {
    const enabled = force ?? !this.values.has(value);
    if (enabled) this.values.add(value);
    else this.values.delete(value);
    return enabled;
  }
}

class FakeElement {
  constructor(
    private readonly printTrigger: FakeElement | null = null,
    private readonly disabled = false,
  ) {}

  closest(selector: string): FakeElement | null {
    return selector === '[data-print-trigger]' ? this.printTrigger : null;
  }

  hasAttribute(name: string): boolean {
    return name === 'disabled' && this.disabled;
  }
}

describe('production print controller', () => {
  test('prepares a light print state, restores the exact theme, and installs once', async () => {
    const testDir = dirname(fileURLToPath(import.meta.url));
    const source = await readFile(
      resolve(testDir, '../public/scripts/print.js'),
      'utf8',
    );
    const documentEvents = new FakeEventTarget();
    const windowEvents = new FakeEventTarget() as FakeEventTarget & {
      __cherrypickerPrintInstalled?: boolean;
      print(): void;
    };
    const classList = new FakeClassList();
    let printCalls = 0;
    let preventedClicks = 0;
    windowEvents.print = () => {
      printCalls += 1;
    };
    const documentObject = Object.assign(documentEvents, {
      documentElement: { classList },
    });

    classList.add('dark');
    const context = {
      document: documentObject,
      Element: FakeElement,
      window: windowEvents,
    };
    runInNewContext(source, context);
    runInNewContext(source, context);

    expect(documentEvents.listeners.get('click')).toHaveLength(1);
    expect(windowEvents.listeners.get('beforeprint')).toHaveLength(1);
    expect(windowEvents.listeners.get('afterprint')).toHaveLength(1);

    const disabledTrigger = new FakeElement(null, true);
    documentEvents.dispatch('click', {
      target: new FakeElement(disabledTrigger),
      preventDefault: () => {
        preventedClicks += 1;
      },
    });
    expect(preventedClicks).toBe(0);
    expect(printCalls).toBe(0);
    expect(classList.contains('print-mode')).toBe(false);

    windowEvents.dispatch('beforeprint');
    expect(classList.contains('print-mode')).toBe(true);
    expect(classList.contains('dark')).toBe(false);

    // Repeated preparation remains idempotent and retains the original theme.
    windowEvents.dispatch('beforeprint');
    windowEvents.dispatch('afterprint');
    expect(classList.contains('print-mode')).toBe(false);
    expect(classList.contains('dark')).toBe(true);

    const trigger = new FakeElement();
    documentEvents.dispatch('click', {
      target: new FakeElement(trigger),
      preventDefault: () => {
        preventedClicks += 1;
      },
    });
    expect(preventedClicks).toBe(1);
    expect(printCalls).toBe(1);
    expect(classList.contains('print-mode')).toBe(true);
    expect(classList.contains('dark')).toBe(false);

    windowEvents.dispatch('afterprint');
    expect(classList.contains('print-mode')).toBe(false);
    expect(classList.contains('dark')).toBe(true);

    // A light theme must remain light after a separate print lifecycle.
    classList.remove('dark');
    windowEvents.dispatch('beforeprint');
    windowEvents.dispatch('afterprint');
    expect(classList.contains('print-mode')).toBe(false);
    expect(classList.contains('dark')).toBe(false);
  });

  test('report print control starts inert and is owned by result visibility', async () => {
    const testDir = dirname(fileURLToPath(import.meta.url));
    const [reportSource, visibilitySource] = await Promise.all([
      readFile(resolve(testDir, '../src/pages/report.astro'), 'utf8'),
      readFile(
        resolve(testDir, '../src/components/ui/VisibilityToggle.svelte'),
        'utf8',
      ),
    ]);

    expect(reportSource).toContain('id="report-print-action"');
    expect(reportSource).toMatch(
      /id="report-print-action"[\s\S]*?\bhidden\b[\s\S]*?\bdisabled\b/,
    );
    expect(reportSource).toContain('dataControlId="report-print-action"');
    expect(visibilitySource).toContain(
      "cachedDataControl.toggleAttribute('hidden', !hasData)",
    );
    expect(visibilitySource).toContain(
      "cachedDataControl.toggleAttribute('disabled', !hasData)",
    );
  });
});
