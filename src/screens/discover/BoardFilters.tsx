import type { Trip } from '@domain/index';
import { tripCode } from '@domain/trip';
import { tripHueClass } from '@design/tokens/tripHue';
import { SEED_CIRCLES } from '@data/seed/circles';
import { NO_FILTERS, useStore } from '@state/store';

/**
 * Narrowing the board.
 *
 * Rebuilt to cost two rows instead of six. The first version spent a fixed
 * label column on every row, which forced the radius options to wrap onto three
 * lines, and it gave every option a 44px pill — including "Anyone" and
 * "Anywhere", which are just the absence of a filter. Between them that pushed
 * the first person below the fold on a 390px screen, which is a strange thing
 * for a screen whose entire job is showing you people.
 *
 * Two changes fixed it. The trip picker became a segmented control, because
 * "exactly one of these" is what a segmented control means and it reads
 * instantly without a label. Everything else became a flat toggle that clears
 * itself when tapped again — so the off-states stopped needing chips of their
 * own, and nine controls became five.
 *
 * One distinction runs through all of it and is stated in the interface rather
 * than only in a comment: **these are a lens, not a policy.** "Women only" here
 * changes what you see and has no effect whatever on who can see you. The
 * setting that does both — atomically, in both directions — lives under You.
 * Someone who filters this board and believes they have made themselves
 * invisible to men has been misled by the product.
 */

const RADII = [5, 15, 40] as const;

export function BoardFilters({ openTrips }: { openTrips: Trip[] }) {
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);
  const me = useStore((s) => s.me);

  // Only circles you are actually in. Offering to filter by a circle you cannot
  // see into would return nothing and read as a bug.
  const myCircles = SEED_CIRCLES.filter((c) =>
    me.memberships.some((m) => String(m.circleId) === String(c.id)),
  );

  const dirty =
    filters.tripId !== 'all' ||
    filters.circleId !== 'any' ||
    filters.womenOnly ||
    filters.withinKm !== null;

  return (
    <div className="filters">
      {openTrips.length > 1 && (
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
      )}

      {/*
        Two short rows rather than one long one. Everything fits on a single
        line at 390px only if "Women only" is cut to "Women", and a filter about
        who you meet is the wrong place to save eleven pixels. Split by meaning —
        who, then where — both rows stay short and the grouping reads without
        needing labels or dividers.
      */}
      <div className="filterbar">
        {myCircles.map((c) => (
          <button
            key={String(c.id)}
            type="button"
            // Tapping an active filter clears it, which is why there is no
            // "Anyone" chip taking up space to mean "no filter".
            className={`filterchip ${filters.circleId === String(c.id) ? 'is-on' : ''}`}
            aria-pressed={filters.circleId === String(c.id)}
            onClick={() =>
              setFilters({
                circleId: filters.circleId === String(c.id) ? 'any' : String(c.id),
              })
            }
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

        {dirty && (
          <button
            type="button"
            className="filterchip filterchip--clear"
            onClick={() => setFilters(NO_FILTERS)}
          >
            Clear
          </button>
        )}
      </div>

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
          Changes what you see, not who sees you — that&rsquo;s{' '}
          <a href="#/you">Who can see you</a>.
        </p>
      )}
    </div>
  );
}
