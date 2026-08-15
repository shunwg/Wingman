/**
 * Invariants.
 *
 * Used for the handful of properties that must hold or the privacy model is
 * broken — notably the two mutual-visibility rules in privacy/resolve.ts. These
 * throw loudly rather than degrading, because a privacy invariant that fails
 * quietly is worse than a crash: the crash gets fixed.
 */
export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Invariant violated: ${message}`);
  }
}

/** Assert a value is present, narrowing away null and undefined. */
export function present<T>(v: T | null | undefined, what: string): T {
  if (v === null || v === undefined) throw new Error(`Expected ${what} to be present`);
  return v;
}
