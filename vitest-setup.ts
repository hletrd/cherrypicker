// Vitest setup file — provides shims for Bun-specific globals that test files
// use. This allows the same test files to run under both `bun test` and
// `npx vitest run` (C39-01).
//
// import.meta.dir is a Bun-specific property that returns the directory path
// of the current module. Vitest provides import.meta.filename (the file path)
// so we can derive the directory from it.

if (typeof (import.meta as any).dir === 'undefined' && typeof (import.meta as any).filename === 'string') {
  // Vitest provides import.meta.filename but not import.meta.dir
  // Derive dir from filename (equivalent to path.dirname)
  const filename = (import.meta as any).filename as string;
  const lastSep = Math.max(filename.lastIndexOf('/'), filename.lastIndexOf('\\'));
  (import.meta as any).dir = lastSep >= 0 ? filename.substring(0, lastSep) : '.';
}
