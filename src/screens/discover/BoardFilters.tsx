import type { Trip } from '@domain/index';
import { tripCode } from '@domain/trip';
import { tripHueClass } from '@design/tokens/tripHue';
import { useCircles } from '@state/selectors/circles';
import { NO_FILTERS, useStore } from '@state/store';

/**
 * Narrowing the board.
 *
 * Two short rows and a density toggle, sticky under the header. Everything
 * is a flat toggle that clears itself when tapped again, so the off-states
 * need no chips of their own.
 *
 * One distinction runs through all of it and is stated in the interface rather
 * than only in a comment: **these are a lens, not a policy.** "Women only" here
 * changes what you see and has no effect whatever on who can see you. The
 * setting that does both — atomically, in both directions — lives under You.
 */

const RADII = [5, 15, 40] as const;

export function BoardFilters({
  openTrips,
  industries,
}: {
  openTrips: Trip[];
  industries: { name: string; n: number }[];
}) {
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);
  const me = useStore((s) => s.me);
  const savedCount = useStore((s) => s.saved.length);
  const circles = useCircles();

  // Only circles you are actually in. Offering to filter by a circle you cannot
  // see into would return nothing and read as a bug.
  const myCircles = circles.filter((c) => me.memberships.some((m) => String(m.circleId) === String(c.id)));

  const dirty =
    filters.tripId !== 'all' ||
    filters.circleId !== 'any' ||
    filters.womenOnly ||
    filters.withinKm !== null ||
    filters.industry !== 'any' ||
    filters.savedOnly;

  return (
    <div className="filters filters--sticky">
      <div className="filters__top">
        {openTrips.length > 1 ? (
          <div className="segmented" role="group" aria-label="Which trip">
            <button
              type="button"
              className={`segmented__item ${filters.tripId === 'all' ? 'is-on' : ''}`}
              aria-pressed={filters.tripId === 'all'}
              onClick={() => setFilters({ tripId: 'all' })}
            >
              All
            </button>
            {openTrips.map((t) => (
              <button
                key={String(t.id)}
                type="button"
                className={`segmented__item mono ${tripHueClass(tripCode(t))} ${
                  filters.tripId === String(t.id) ? 'is-on' : ''
                }`}
                aria-pressed={filters.tripId === String(t.id)}
                onClick={() => setFilters({ tripId: String(t.id) })}
              >
                <span className="tripdot" aria-hidden="true" />
                {tripCode(t)}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        <div className="segmented segmented--tight" role="group" aria-label="Density">
          <button
            type="button"
            className={`segmented__item ${filters.layout === 'feed' ? 'is-on' : ''}`}
            aria-pressed={filters.layout === 'feed'}
            onClick={() => setFilters({ layout: 'feed' })}
          >
            Cards
          </button>
          <button
            type="button"
            className={`segmented__item ${filters.layout === 'row' ? 'is-on' : ''}`}
            aria-pressed={filters.layout === 'row'}
            onClick={() => setFilters({ layout: 'row' })}
          >
            Rows
          </button>
        </div>
      </div>

      <div className="filterbar">
        {myCircles.map((c) => (
          <button
            key={String(c.id)}
            type="button"
            className={`filterchip ${filters.circleId === String(c.id) ? 'is-on' : ''}`}
            aria-pressed={filters.circleId === String(c.id)}
            onClick={() => setFilters({ circleId: filters.circleId === String(c.id) ? 'any' : String(c.id) })}
          >
            {c.shortName}
          </button>
        ))}

        <button
          type="button"
          className={`filterchip ${filters.womenOnly ? 'is-on' : ''}`}
          aria-pressed={filters.womenOnly}
          onClick={() => setFilters({ womenOnly: !filters.womenOnly })}
        >
          Women only
        </button>

        {savedCount > 0 && (
          <button
            type="button"
            className={`filterchip ${filters.savedOnly ? 'is-on' : ''}`}
            aria-pressed={filters.savedOnly}
            onClick={() => setFilters({ savedOnly: !filters.savedOnly })}
          >
            Saved
          </button>
        )}

        {dirty && (
          <button type="button" className="filterchip filterchip--clear" onClick={() => setFilters(NO_FILTERS)}>
            Clear
          </button>
        )}
      </div>

      {industries.length > 1 && (
        <div className="filterbar" role="group" aria-label="Industry">
          {industries.map((i) => (
            <button
              key={i.name}
              type="button"
              className={`filterchip ${filters.industry === i.name ? 'is-on' : ''}`}
              aria-pressed={filters.industry === i.name}
              onClick={() => setFilters({ industry: filters.industry === i.name ? 'any' : i.name })}
            >
              {i.name}
            </button>
          ))}
        </div>
      )}

      <div className="filterbar" role="group" aria-label="How far they are heading from you">
        <span className="filterbar__hint" aria-hidden="true">
          Heading
        </span>
        {RADII.map((km) => (
          <button
            key={km}
            type="button"
            className={`filterchip mono ${filters.withinKm === km ? 'is-on' : ''}`}
            aria-pressed={filters.withinKm === km}
            aria-label={`Within ${km} kilometres of where you are going`}
            onClick={() => setFilters({ withinKm: filters.withinKm === km ? null : km })}
          >
            {km}km
          </button>
        ))}
      </div>

      {filters.womenOnly && (
        <p className="filters__note">
          Changes what you see, not who sees you — that&rsquo;s <a href="#/you">Who can see you</a>.
        </p>
      )}
    </div>
  );
}
