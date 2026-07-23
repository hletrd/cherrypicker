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

/**
 * Multiply an exactly represented non-negative integer by the decimal spelling
 * of a JavaScript number, divide by an integer divisor, and floor the result.
 *
 * `Number#toString()` gives the shortest decimal that round-trips to the
 * supplied number. Converting that spelling to a rational before multiplying
 * avoids an additional binary floating-point rounding step at whole-Won
 * boundaries. `null` means either the inputs or the floored product cannot be
 * represented as a non-negative safe integer.
 */
export function floorSafeIntegerDecimalProduct(
  integer: number,
  decimal: number,
  divisor = 1,
): number | null {
  if (
    !Number.isSafeInteger(integer) ||
    integer < 0 ||
    !Number.isFinite(decimal) ||
    decimal < 0 ||
    !Number.isSafeInteger(divisor) ||
    divisor <= 0
  ) {
    return null;
  }

  const [coefficient, exponentText] = decimal.toString().toLowerCase().split('e');
  if (coefficient === undefined) return null;

  const exponent = exponentText === undefined ? 0 : Number(exponentText);
  if (!Number.isSafeInteger(exponent)) return null;

  const decimalPoint = coefficient.indexOf('.');
  const fractionalDigits =
    decimalPoint === -1 ? 0 : coefficient.length - decimalPoint - 1;
  const digits = coefficient.replace('.', '');
  if (!/^\d+$/.test(digits)) return null;

  let numerator = BigInt(digits);
  let denominator = 1n;
  const scale = fractionalDigits - exponent;
  if (scale > 0) {
    denominator = 10n ** BigInt(scale);
  } else if (scale < 0) {
    numerator *= 10n ** BigInt(-scale);
  }

  denominator *= BigInt(divisor);
  const result = (BigInt(integer) * numerator) / denominator;
  const maximum = BigInt(Number.MAX_SAFE_INTEGER);
  return result <= maximum ? Number(result) : null;
}
