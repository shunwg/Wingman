import { ToggleChip } from '@design/primitives/Chip';
import { Button } from '@design/primitives/Button';
import type { Trip } from '@domain/index';
import { tripCode } from '@domain/trip';
import { SEED_CIRCLES } from '@data/seed/circles';
import { NO_FILTERS, useStore } from '@state/store';

/**
 * Narrowing the board.
 *
 * One distinction runs through this whole component and it is worth stating in
 * the interface rather than only in a comment: **these are a lens, not a
 * policy.** "Women only" here changes what you see and has no effect whatever
 * on who can see you. The setting that does both — atomically, in both
 * directions — lives under You, and confusing the two is precisely the bug the
 * two-rule privacy model exists to prevent. Someone who filters this board and
 * believes they have made themselves invisible to men has been misled by the
 * product, so the screen says which one this is.
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
        <div className="filters__row" role="group" aria-label="Which trip">
          <span className="filters__label">Trip</span>
          <ToggleChip
            selected={filters.tripId === 'all'}
            onClick={() => setFilters({ tripId: 'all' })}
          >
            All
          </ToggleChip>
          {openTrips.map((t) => (
            <ToggleChip
              key={String(t.id)}
              selected={filters.tripId === String(t.id)}
              onClick={() => setFilters({ tripId: String(t.id) })}
            >
              {tripCode(t)}
            </ToggleChip>
          ))}
        </div>
      )}

      {myCircles.length > 0 && (
        <div className="filters__row" role="group" aria-label="Circle">
          <span className="filters__label">Circle</span>
          <ToggleChip
            selected={filters.circleId === 'any'}
            onClick={() => setFilters({ circleId: 'any' })}
          >
            Anyone
          </ToggleChip>
          {myCircles.map((c) => (
            <ToggleChip
              key={String(c.id)}
              selected={filters.circleId === String(c.id)}
              onClick={() => setFilters({ circleId: String(c.id) })}
            >
              {c.shortName}
            </ToggleChip>
          ))}
        </div>
      )}

      <div className="filters__row" role="group" aria-label="Heading the same way">
        <span className="filters__label">Going</span>
        <ToggleChip
          selected={filters.withinKm === null}
          onClick={() => setFilters({ withinKm: null })}
        >
          Anywhere
        </ToggleChip>
        {/* "Within 5km" wrapped the row onto three lines at 390px and pushed
            the first card below the fold. The unit carries the meaning; the
            preposition was costing a third of the screen. */}
        {RADII.map((km) => (
          <ToggleChip
            key={km}
            selected={filters.withinKm === km}
            onClick={() => setFilters({ withinKm: km })}
          >
            <span className="visually-hidden">Within </span>
            {km} km
          </ToggleChip>
        ))}
      </div>

      <div className="filters__row">
        <span className="filters__label">Who</span>
        <ToggleChip
          selected={filters.womenOnly}
          onClick={() => setFilters({ womenOnly: !filters.womenOnly })}
        >
          Women only
        </ToggleChip>
        {dirty && (
          <Button size="sm" variant="secondary" onClick={() => setFilters(NO_FILTERS)}>
            Clear
          </Button>
        )}
      </div>

      {filters.womenOnly && (
        <p className="filters__note">
          This changes what you see, not who sees you. To be visible to women only, use{' '}
          <a href="#/you">Who can see you</a>.
        </p>
      )}
    </div>
  );
}
