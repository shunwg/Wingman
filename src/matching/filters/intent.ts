import type { IntentAxis, IntentProfile, MeetKind, Trip } from '@domain/index';
import type { MatchConfig, TravelOverlap } from '../types';

/**
 * Which meets are physically possible, and then which both people want.
 *
 * This is the rule that makes the product feel like it understands travel
 * rather than like a location filter. Geometry decides first: nobody has dinner
 * during a 50-minute connection, nobody coworks on a 737, and a layover with a
 * terminal change and 70 usable minutes is not a coffee — it is a walk to
 * another gate.
 *
 * Only after geometry has spoken do preferences intersect. Two people on the
 * same flight who have both only ticked `coworking` produce an empty set and
 * disappear from each other's boards, correctly.
 */

/** The kinds an overlap shape can physically support. */
export function feasibleMeetKinds(overlap: TravelOverlap, config: MatchConfig): MeetKind[] {
  switch (overlap.kind) {
    case 'same_flight': {
      // You are already sitting together for hours; the meet is the flight, and
      // whatever you do on either side of it.
      if (overlap.durationMin < config.minSameFlightMin) return [];
      return ['gate_coffee', 'business_intro', 'ride_share'];
    }

    case 'shared_layover': {
      const { usableMin, bothAirside, sameTerminal } = overlap;
      if (usableMin < config.minUsableMin) return [];

      if (!bothAirside || !sameTerminal) {
        // Different terminals, or one of you has to clear immigration. Only
        // worth proposing anything at all if there is real time to burn.
        return usableMin >= 120 ? ['gate_coffee', 'business_intro'] : [];
      }

      const kinds: MeetKind[] = ['gate_coffee', 'business_intro'];
      if (usableMin >= 45) kinds.push('lounge', 'terminal_walk');
      if (usableMin >= 90) kinds.push('meal');
      return kinds;
    }

    case 'same_airport_window': {
      // Landside — arriving, departing, or waiting. This is the shared-transfer
      // case: two people landing within half an hour heading the same way.
      if (overlap.usableMin < config.minUsableMin) return [];
      const kinds: MeetKind[] = ['ride_share', 'gate_coffee'];
      if (overlap.usableMin >= 60) kinds.push('business_intro');
      return kinds;
    }

    case 'same_city_night':
      return ['meal', 'drinks', 'business_intro'];

    case 'overlapping_stay': {
      const kinds: MeetKind[] = ['meal', 'drinks', 'business_intro'];
      if (overlap.days >= 2) kinds.push('coworking');
      return kinds;
    }
  }
}

/** The union across every overlap two people share. */
export function feasibleAcross(overlaps: TravelOverlap[], config: MatchConfig): MeetKind[] {
  const set = new Set<MeetKind>();
  for (const o of overlaps) for (const k of feasibleMeetKinds(o, config)) set.add(k);
  return [...set];
}

/** A trip may narrow the standing openTo set without changing the profile. */
export function effectiveOpenTo(intent: IntentProfile, trip: Trip): MeetKind[] {
  const tripOverride = trip.visibility.openTo ?? trip.intent?.openTo;
  const base = intent.openTo;
  if (!tripOverride) return base;
  return base.filter((k) => tripOverride.includes(k));
}

/**
 * What can actually be proposed: possible ∩ mine ∩ theirs.
 *
 * An empty result is a hard filter, not a low score. Showing someone a person
 * they cannot arrange anything with is a worse experience than showing them
 * nobody.
 */
export function proposableKinds(
  overlaps: TravelOverlap[],
  mine: MeetKind[],
  theirs: MeetKind[],
  config: MatchConfig,
): MeetKind[] {
  const possible = new Set(feasibleAcross(overlaps, config));
  const theirSet = new Set(theirs);
  return mine.filter((k) => possible.has(k) && theirSet.has(k));
}

/**
 * Intent alignment, 0–1.
 *
 * Cosine of the two appetite vectors, scaled by how much of what they want
 * overlaps with what I want. Someone strongly professional and someone strongly
 * social score low even when their calendars align perfectly — which is right,
 * because the meet would disappoint them both.
 */
export function intentAlignment(a: IntentProfile, b: IntentProfile, shared: MeetKind[]): number {
  const axes: IntentAxis[] = ['social', 'professional'];
  const av = axes.map((x) => a.appetite[x] ?? 0);
  const bv = axes.map((x) => b.appetite[x] ?? 0);

  const dot = av.reduce((s, v, i) => s + v * (bv[i] ?? 0), 0);
  const magA = Math.hypot(...av);
  const magB = Math.hypot(...bv);
  const cosine = magA > 0 && magB > 0 ? dot / (magA * magB) : 0;

  const union = new Set([...a.openTo, ...b.openTo]).size;
  const jaccard = union > 0 ? shared.length / union : 0;

  return clamp01(cosine * 0.7 + jaccard * 0.3);
}

/** Which axes a person has any appetite for at all. */
export function activeAxes(intent: IntentProfile): IntentAxis[] {
  return (['social', 'professional'] as IntentAxis[]).filter((a) => (intent.appetite[a] ?? 0) > 0);
}

export const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
