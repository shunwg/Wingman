/**
 * Count bucketing.
 *
 * This is a privacy primitive, not a formatting helper, and every count that
 * crosses into the UI goes through it.
 *
 * The attack it defends against is inferential rather than direct. Nothing
 * leaks a name; what leaks is arithmetic. "2 people are hidden from you" on a
 * flight with four passengers identifies both of them. "3 people match this
 * segment" alongside a facet tuple of `women · ID-verified · on your OSL–SIN
 * flight` is a deanonymisation. Each individual number looks harmless in
 * review, which is exactly why the defence has to be a chokepoint rather than a
 * habit.
 *
 * Below the threshold the exact figure is replaced by a phrase. Above it, the
 * number is large enough that it identifies nobody.
 */

export type BucketedCount =
  | { kind: 'none' }
  | { kind: 'few'; label: string }
  | { kind: 'several'; label: string }
  | { kind: 'exact'; value: number };

/** Below this, exact counts are suppressed. */
export const EXACT_THRESHOLD = 10;

export function bucket(n: number): BucketedCount {
  if (n <= 0) return { kind: 'none' };
  if (n < 5) return { kind: 'few', label: 'a few' };
  if (n < EXACT_THRESHOLD) return { kind: 'several', label: 'several' };
  return { kind: 'exact', value: n };
}

/** Render a bucket as a phrase — "a few", "several", "12". */
export function bucketLabel(b: BucketedCount): string {
  switch (b.kind) {
    case 'none':
      return 'nobody';
    case 'few':
    case 'several':
      return b.label;
    case 'exact':
      return String(b.value);
  }
}

/**
 * A bucketed count phrased with its noun — "a few people", "12 people".
 *
 * Kept here rather than in a component so there is exactly one place where a
 * raw number could accidentally be printed.
 */
export function bucketPhrase(n: number, noun = 'person', pluralNoun = 'people'): string {
  const b = bucket(n);
  switch (b.kind) {
    case 'none':
      return `nobody`;
    case 'few':
      return `a few ${pluralNoun}`;
    case 'several':
      return `several ${pluralNoun}`;
    case 'exact':
      return `${b.value} ${b.value === 1 ? noun : pluralNoun}`;
  }
}

/**
 * Whether a count may be shown exactly.
 *
 * Useful where the UI wants to branch on precision — e.g. showing a numeral in
 * a badge only when it is safe to do so.
 */
export const canShowExact = (n: number): boolean => n >= EXACT_THRESHOLD;
