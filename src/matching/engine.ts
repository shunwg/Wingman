import type { DisclosureLevel, IntentAxis } from '@domain/index';
import { compilePolicy, disclosureLevelFor, redact } from '@privacy/index';
import type { PersonFacets, PolicySubject } from '@privacy/types';
import { bucket } from '@lib/bucket';
import type {
  Candidate,
  MatchInput,
  MatchResult,
  SuppressionSummary,
  TravelContextSummary,
} from './types';
import { applyHardFilters, maxAssurance, type DenialReason } from './filters/hardFilters';
import { activeAxes } from './filters/intent';
import { strongest } from './travel/overlap';
import { proximityClasses } from './travel/proximity';
import { buildReceipt } from './explain/receipt';
import { compareCandidates, dayKeyOf, scoreCandidate } from './rank/score';
import { deferredAcceptance } from './rank/stable';
import type { SignalContext } from './rank/signals';

/**
 * The matching engine.
 *
 * Orchestration only — every decision lives in a filter, a signal or the
 * privacy engine. Pure: `now`, `config` and `airports` all arrive as
 * parameters, so the whole thing runs under plain Node and the same input
 * always produces the same output.
 *
 * The shape is deliberate: **filter, then rank, then redact**. Filtering first
 * means an ineligible person cannot appear at any position. Redacting last
 * means the engine returns `RedactedPerson`, so no caller can accidentally hold
 * a full record.
 */
export function findCandidates(input: MatchInput): MatchResult {
  const { me, myTrip, pool, now, airports, config } = input;
  const myCircleIds = input.myCircleIds ?? [];
  const dayKey = dayKeyOf(now);

  const myFacets: PersonFacets = {
    id: me.id,
    gender: me.gender,
    assurance: maxAssurance(me),
    stampKinds: me.verifications.filter((v) => !v.revokedAt).map((v) => v.kind),
    circleIds: myCircleIds as PersonFacets['circleIds'],
    intents: activeAxes(me.intent),
    blocked: me.blocked,
    proximity: 'none',
    channel: 'app',
    onTrip: true,
  };
  const mySubject: PolicySubject = {
    facets: myFacets,
    policy: compilePolicy(me.privacy, myCircleIds),
  };

  const suppressionCounts: Record<DenialReason, number> = {
    self: 0,
    blocked: 0,
    trip_hidden: 0,
    trip_past: 0,
    no_overlap: 0,
    privacy: 0,
    assurance: 0,
    circle: 0,
    intent: 0,
    feasibility: 0,
    request_history: 0,
  };

  const context: TravelContextSummary = {
    onYourFlight: 0,
    inYourLayover: 0,
    inYourCity: 0,
    overlappingDates: 0,
  };

  const scored: (Candidate & { _id: string; _mutual: number })[] = [];

  for (const entry of pool) {
    const outcome = applyHardFilters({
      me,
      myTrip,
      myFacets,
      mySubject,
      myCircleIds,
      entry,
      airports,
      config,
      now,
      ...(input.requestHistory ? { requestHistory: input.requestHistory } : {}),
    });

    if (!outcome.ok) {
      if (outcome.reason) suppressionCounts[outcome.reason]++;
      continue;
    }

    const top = strongest(outcome.overlaps);
    if (!top) continue;

    // Context strip counts only survivors — telling someone "3 on your flight"
    // and then showing one is worse than saying nothing.
    for (const cls of proximityClasses(outcome.overlaps)) {
      if (cls === 'same_flight') context.onYourFlight++;
      else if (cls === 'same_terminal') context.inYourLayover++;
      else if (cls === 'same_city') context.inYourCity++;
      else if (cls === 'same_dates') context.overlappingDates++;
    }

    const ctx: SignalContext = {
      me,
      them: entry.person,
      overlaps: outcome.overlaps,
      strongest: top,
      proposable: outcome.proposable,
      myCircleIds,
      theirCircleIds: entry.circleIds ?? [],
      ...(entry.responseRate !== undefined ? { responseRate: entry.responseRate } : {}),
      seenCount: input.seenCounts?.[entry.person.id] ?? 0,
      config,
      dayKey,
    };

    const { score, signals } = scoreCandidate(ctx);

    /*
     * How they would rank you: the same signals with the roles swapped. Their
     * conduct signal has no data about you (you are the viewer), so it sits at
     * neutral; fairness re-seeds on the swapped pair. The harmonic mean of the
     * two views is the mutual score deferred acceptance runs on — a pair only
     * scores well if it scores well from both sides.
     */
    const theirView = scoreCandidate({
      ...ctx,
      me: entry.person,
      them: me,
      myCircleIds: entry.circleIds ?? [],
      theirCircleIds: myCircleIds,
      seenCount: 0,
      responseRate: undefined as never,
    }).score;
    const mutual = score + theirView > 0 ? (2 * score * theirView) / (score + theirView) : 0;

    // Browsing a board is the stranger relationship. Anything further up the
    // ladder is earned through the request flow, not through appearing here.
    const level: DisclosureLevel = disclosureLevelFor('stranger', {
      visible: true,
      level: 3,
      deniedBy: [],
      reasons: [],
    });

    const intentFit: Record<IntentAxis, number> = {
      social: Math.min(me.intent.appetite.social, entry.person.intent.appetite.social),
      professional: Math.min(
        me.intent.appetite.professional,
        entry.person.intent.appetite.professional,
      ),
    };

    scored.push({
      _id: entry.person.id,
      _mutual: mutual,
      person: redact(entry.person, level),
      overlap: top,
      allOverlaps: outcome.overlaps,
      proposableKinds: outcome.proposable,
      intentFit,
      score,
      signals,
      receipt: buildReceipt({
        me,
        them: entry.person,
        strongest: top,
        allOverlaps: outcome.overlaps,
        proposable: outcome.proposable,
        airports,
      }),
    });
  }

  scored.sort((a, b) => compareCandidates({ score: a.score, id: a._id }, { score: b.score, id: b._id }));

  /*
   * The stable pick. One proposer (you), every survivor a receiver, each
   * receiver's list holding only you: deferred acceptance then reduces to the
   * viewer's own top-by-mutual choice, which is exactly the "Most Compatible"
   * mechanic — and running it through the general algorithm keeps the door
   * open for the pool-wide version a server would run.
   */
  if (scored.length > 0) {
    const byMutual = [...scored].sort((a, b) => b._mutual - a._mutual || a._id.localeCompare(b._id));
    const m = deferredAcceptance({
      proposers: { [String(me.id)]: byMutual.map((c) => c._id) },
      receivers: Object.fromEntries(byMutual.map((c) => [c._id, [String(me.id)]])),
    });
    const pick = m.pairs[String(me.id)];
    for (const c of scored) if (c._id === pick) c.mostCompatible = true;
  }

  const suppressed: SuppressionSummary = {
    // Privacy suppression is reported as one bucket rather than itemised.
    // "2 people hidden by privacy" on a four-passenger flight identifies both.
    byPrivacy: bucket(suppressionCounts.privacy),
    byIntent: bucket(suppressionCounts.intent),
    byCircle: bucket(suppressionCounts.circle),
    byAssurance: bucket(suppressionCounts.assurance),
    byFeasibility: bucket(suppressionCounts.feasibility),
  };

  return {
    candidates: scored.slice(0, config.limit).map(({ _id: _, _mutual: _m, ...c }) => c),
    suppressed,
    context,
  };
}
