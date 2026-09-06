import type { TravelContextSummary } from '@matching/index';
import { bucket, bucketLabel } from '@lib/bucket';

/**
 * "Where the people are."
 *
 * Counts only survivors — telling somebody "3 on your flight" and then showing
 * one is worse than saying nothing, because it reads as a bug in a place where
 * the honest answer was available.
 */
export function ContextStrip({ context }: { context: TravelContextSummary }) {
  /*
   * At most two facts, on one line.
   *
   * This was four stat blocks at display size, which wrapped to two rows and
   * took more vertical space than the filters underneath it — on a screen whose
   * job is showing people. It is context, not the content.
   *
   * "Overlapping days" is also dropped whenever it equals the city count, which
   * in practice is almost always: printing "18 in your city · 18 overlapping"
   * asks the reader to work out whether those are the same eighteen people. They
   * are.
   */
  const all = [
    { n: context.onYourFlight, label: 'on your flight' },
    { n: context.inYourLayover, label: 'in your layover' },
    { n: context.inYourCity, label: 'in your city' },
    { n: context.overlappingDates, label: 'overlapping' },
  ].filter((i) => i.n > 0);

  const deduped = all.filter(
    (i, idx) => idx === 0 || !all.slice(0, idx).some((prev) => prev.n === i.n),
  );
  const items = deduped.slice(0, 2);

  if (items.length === 0) return null;

  return (
    <div className="cstrip">
      {items.map((i) => (
        <div className="cstrip__item" key={i.label}>
          <span className="cstrip__n mono">{bucketLabel(bucket(i.n))}</span>
          <span className="cstrip__label">{i.label}</span>
        </div>
      ))}
    </div>
  );
}
