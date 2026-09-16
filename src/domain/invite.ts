/**
 * Invite codes, and the badge a link may carry.
 *
 * `ABC123` is the circle's door key; `ABC123-speaker` is the same key with a
 * role attached, so an organiser can hand speakers a link that makes them
 * findable as speakers without ever editing a member list. The badge id is
 * only honoured if the circle actually defines it — a made-up suffix grants
 * nothing.
 */
export interface ParsedInvite {
  code: string;
  badgeId?: string;
}

const CODE = /^([A-Z0-9]{6})(?:-([a-z0-9_-]{1,24}))?$/i;

export function parseInvite(raw: string): ParsedInvite | null {
  const m = CODE.exec(raw.trim());
  if (!m) return null;
  const code = m[1]!.toUpperCase();
  return m[2] ? { code, badgeId: m[2].toLowerCase() } : { code };
}

export function inviteWithBadge(code: string, badgeId?: string): string {
  return badgeId ? `${code}-${badgeId}` : code;
}

/**
 * A six-character door key derived from a seed string.
 *
 * Deterministic, and that is the point twice over: the code for a thing can be
 * recomputed from the thing rather than stored beside it and drifting, and a
 * code that cannot be reproduced from state cannot be asserted in a test.
 * `Math.random()` is banned inside the engines for exactly this reason.
 *
 * The alphabet omits I, O, 0 and 1 — these get read aloud in taxi queues and
 * typed from a photograph of a screen.
 */
export function codeFromSeed(seed: string): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  }
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += alphabet[h % alphabet.length];
    h = Math.floor(h / alphabet.length) + i * 7919;
  }
  return out;
}
