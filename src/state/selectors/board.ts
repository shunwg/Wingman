import { useMemo } from 'react';
import { MATCH_CONFIG_V1, findCandidates, relaxations } from '@matching/index';
import type { MatchInput, MatchResult, RelaxationOutcome } from '@matching/types';
import { airportIndex } from '@data/airports/index';
import { RESPONSE_RATES } from '@data/seed/people';
import { seedPool } from '@data/seed/trips';
import { circleById } from '@data/seed/circles';
import { useStore } from '../store';

/**
 * The board, computed on read.
 *
 * Nothing here is stored. Every render recomputes visibility from the current
 * policy, which is what makes a privacy change take effect *now* rather than at
 * the next refresh. Caching this list would be the single easiest way to turn
 * a correct privacy engine into a leak.
 *
 * The screen using this contains no matching logic at all — it renders what it
 * is handed.
 */

const EMPTY: MatchResult = {
  candidates: [],
  suppressed: {
    byPrivacy: { kind: 'none' },
    byIntent: { kind: 'none' },
    byCircle: { kind: 'none' },
    byAssurance: { kind: 'none' },
    byFeasibility: { kind: 'none' },
  },
  context: { onYourFlight: 0, inYourLayover: 0, inYourCity: 0, overlappingDates: 0 },
};

export function useMatchInput(): MatchInput | null {
  const me = useStore((s) => s.me);
  const myTrip = useStore((s) => s.myTrip);
  const now = useStore((s) => s.now);
  const seenCounts = useStore((s) => s.seenCounts);
  const requests = useStore((s) => s.requests);

  return useMemo(() => {
    if (!myTrip) return null;

    // People with something live, and people who said no. Both are removed by
    // the engine — a decline is for the whole trip, whatever the pretext.
    const active: MatchInput['requestHistory'] = { active: [], denied: [] };
    for (const r of requests) {
      const other = r.fromPersonId === me.id ? r.toPersonId : r.fromPersonId;
      if (['sent', 'viewed', 'countered', 'accepted'].includes(r.status)) active.active.push(other);
      if (r.status === 'denied') active.denied.push(other);
    }

    return {
      me,
      myTrip,
      myCircleIds: me.memberships.map((m) => String(m.circleId)),
      pool: seedPool().map((e) => ({
        ...e,
        ...(RESPONSE_RATES[String(e.person.id)] !== undefined
          ? { responseRate: RESPONSE_RATES[String(e.person.id)]! }
          : {}),
      })),
      now,
      airports: airportIndex,
      config: MATCH_CONFIG_V1,
      seenCounts,
      requestHistory: active,
    };
  }, [me, myTrip, now, seenCounts, requests]);
}

/**
 * Fill in circle display names.
 *
 * `redact()` cannot do this: the privacy engine may not import from `data/`,
 * and rightly so — a visibility rule should never be able to reach a lookup
 * table. So the badge crosses the boundary carrying only its id, and the label
 * is resolved here, in the layer that is allowed to know both.
 *
 * Which circles appear at all was already decided upstream: only memberships
 * set to `show_badge` survive redaction.
 */
function withCircleNames(result: MatchResult): MatchResult {
  return {
    ...result,
    candidates: result.candidates.map((c) => ({
      ...c,
      person: {
        ...c.person,
        circles: c.person.circles.map((badge) => {
          const circle = circleById(String(badge.circleId));
          return circle
            ? { ...badge, shortName: circle.shortName, kind: circle.kind }
            : badge;
        }),
      },
    })),
  };
}

export function useBoard(): MatchResult {
  const input = useMatchInput();
  return useMemo(() => (input ? withCircleNames(findCandidates(input)) : EMPTY), [input]);
}

/**
 * What widening would actually unlock.
 *
 * Computed by re-running the engine, not estimated, so the empty state's
 * promise is checkable. Only offered when it changes the answer — a suggestion
 * that unlocks nobody teaches people the suggestions are noise.
 */
export function useRelaxations(): RelaxationOutcome[] {
  const input = useMatchInput();
  return useMemo(() => (input ? relaxations(input) : []), [input]);
}
