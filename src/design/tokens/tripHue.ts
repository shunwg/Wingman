/**
 * Which colour a journey wears.
 *
 * Derived from the flight code rather than from the trip's position in a list,
 * so a trip keeps its colour when you add another one, cancel one, or settle
 * one. A colour that reshuffles the moment the list changes is worse than no
 * colour at all: the whole point is that the ticket in your Trip tab and the
 * tag on somebody's card are recognisably the same thing, and that only holds
 * if the mapping is stable.
 *
 * Five hues, which is enough that two trips in flight at once almost never
 * collide, and few enough that they stay distinguishable. On a collision the
 * flight code still separates them — colour is a shortcut here, never the
 * information itself.
 *
 * Pure and dependency-free: it is a string in, a class name out, so it can be
 * called from anywhere in the render tree without dragging state along.
 */

export const TRIP_HUE_COUNT = 5;

export function tripHueIndex(code: string): number {
  // FNV-1a. Small, fast, and — unlike summing char codes — it does not map
  // "SQ317" and "SQ371" to the same bucket.
  let h = 2166136261;
  for (let i = 0; i < code.length; i++) {
    h = Math.imul(h ^ code.charCodeAt(i), 16777619) >>> 0;
  }
  return h % TRIP_HUE_COUNT;
}

/** The class that carries `--trip-colour` and `--trip-wash` for this journey. */
export const tripHueClass = (code: string): string => `hue-${tripHueIndex(code)}`;
