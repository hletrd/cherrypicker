const ASCII_PREFIX = new TextEncoder().encode('date,merchant,amount\n2024-01-15,');
const ASCII_SUFFIX = new TextEncoder().encode(',5000\n');
const CP949_USAGE_DATE = new Uint8Array([0xC0, 0xCC, 0xBF, 0xEB, 0xC0, 0xCF]);

export function shortCP949CSV(): Uint8Array {
  const bytes = new Uint8Array(
    ASCII_PREFIX.length + CP949_USAGE_DATE.length + ASCII_SUFFIX.length,
  );
  bytes.set(ASCII_PREFIX);
  bytes.set(CP949_USAGE_DATE, ASCII_PREFIX.length);
  bytes.set(ASCII_SUFFIX, ASCII_PREFIX.length + CP949_USAGE_DATE.length);
  return bytes;
}

export function longCP949CSV(): Uint8Array {
  const short = shortCP949CSV();
  const bytes = new Uint8Array(short.length * 4);
  for (let index = 0; index < 4; index++) bytes.set(short, index * short.length);
  return bytes;
}
