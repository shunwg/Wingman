import type { TravelContextSummary } from '@matching/index';

/**
 * "Where the people are."
 *
 * Counts only survivors — telling somebody "3 on your flight" and then showing
 * one is worse than saying nothing, because it reads as a bug in a place where
 * the honest answer was available.
 */
export function ContextStrip({ context }: { context: TravelContextSummary }) {
  const items = [
    { n: context.onYourFlight, label: 'on your flight' },
    { n: context.inYourLayover, label: 'in your layover' },
    { n: context.inYourCity, label: 'in your city' },
    { n: context.overlappingDates, label: 'overlapping days' },
  ].filter((i) => i.n > 0);

  if (items.length === 0) return null;

  return (
    <div className="cstrip">
      {items.map((i) => (
        <div className="cstrip__item" key={i.label}>
          <span className="cstrip__n mono">{i.n}</span>
          <span className="cstrip__label">{i.label}</span>
        </div>
      ))}
    </div>
  );
}
