export function assertSafeNonnegativeInteger(
  value: number,
  label: string,
): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer, got ${value}`);
  }
}

export function addSafeNonnegativeIntegers(
  left: number,
  right: number,
  label: string,
): number {
  assertSafeNonnegativeInteger(left, label);
  assertSafeNonnegativeInteger(right, label);
  const sum = left + right;
  assertSafeNonnegativeInteger(sum, label);
  return sum;
}
