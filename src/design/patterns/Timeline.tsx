import type { ReactNode } from 'react';

/**
 * A journey as a rail.
 *
 * Stops are airports; between them are legs and layovers; after the last one,
 * the stay. Each row can carry what is worth knowing at that point — people
 * nearby, an event in the city — so the trip reads as a map of who you might
 * meet rather than a list of flight numbers. Presentational only: the screen
 * decides the rows, this decides the geometry.
 */
export type TimelineRow =
  | { kind: 'stop'; code: string; city: string; time?: string; terminal?: string; note?: string }
  | { kind: 'leg'; label: string; note?: string }
  | { kind: 'layover'; label: string; note?: string; extra?: ReactNode }
  | { kind: 'stay'; label: string; note?: string; extra?: ReactNode };

export function Timeline({ rows, className }: { rows: TimelineRow[]; className?: string }) {
  return (
    <ol className={`timeline ${className ?? ''}`}>
      {rows.map((r, i) => {
        if (r.kind === 'stop') {
          return (
            <li key={i} className="timeline__row timeline__row--stop">
              <span className="timeline__dot" aria-hidden="true" />
              <div className="timeline__body">
                <div className="timeline__stop">
                  <span className="timeline__code mono">{r.code}</span>
                  <span className="timeline__city">{r.city}</span>
                  {r.time && <span className="timeline__time mono">{r.time}</span>}
                </div>
                {(r.terminal || r.note) && (
                  <span className="timeline__note">{[r.terminal, r.note].filter(Boolean).join(' · ')}</span>
                )}
              </div>
            </li>
          );
        }
        return (
          <li key={i} className={`timeline__row timeline__row--${r.kind}`}>
            <span className="timeline__line" aria-hidden="true" />
            <div className="timeline__body">
              <span className="timeline__label">{r.label}</span>
              {r.note && <span className="timeline__note">{r.note}</span>}
              {'extra' in r && r.extra}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
