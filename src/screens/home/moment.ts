/**
 * The moment of serendipity plays once per person.
 *
 * "Your paths cross in Copenhagen" is a discovery the first time and noise the
 * second. The same memory-only one-shot as the meet room's arrival: a refresh
 * or a return visit shows the ordinary card.
 */
const shown = new Set<string>();

export function takeMoment(personId: string): boolean {
  if (shown.has(personId)) return false;
  shown.add(personId);
  return true;
}

/** Test seam. */
export function resetMoments(): void {
  shown.clear();
}
