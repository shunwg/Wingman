/**
 * Deferred acceptance (Gale–Shapley).
 *
 * The one genuinely good idea from the dating world, and the mechanism behind
 * Hinge's "Most Compatible": a matching where no two people would both rather
 * be with each other than with whom they were given. Pure, deterministic,
 * and order-independent given the same preference lists.
 *
 * Proposers propose down their lists; a receiver holds the best proposal so
 * far and releases the rest. Terminates in at most |P|·|R| proposals. The
 * result is proposer-optimal among stable matchings, which is the right bias
 * for a viewer's board: it favours the person doing the looking.
 */
export interface Preferences {
  /** Each proposer's receivers, best first. Unlisted receivers are unacceptable. */
  proposers: Record<string, string[]>;
  /** Each receiver's proposers, best first. Unlisted proposers are unacceptable. */
  receivers: Record<string, string[]>;
}

export interface Matching {
  /** proposer → receiver */
  pairs: Record<string, string>;
}

export function deferredAcceptance(prefs: Preferences): Matching {
  const rank = new Map<string, Map<string, number>>();
  for (const [r, list] of Object.entries(prefs.receivers)) {
    rank.set(r, new Map(list.map((p, i) => [p, i])));
  }

  const next = new Map<string, number>();
  const held = new Map<string, string>(); // receiver → proposer
  const free = Object.keys(prefs.proposers).sort();

  while (free.length > 0) {
    const p = free.shift()!;
    const list = prefs.proposers[p] ?? [];
    const i = next.get(p) ?? 0;
    if (i >= list.length) continue; // exhausted; stays unmatched
    next.set(p, i + 1);
    const r = list[i]!;
    const ranks = rank.get(r);
    if (!ranks || !ranks.has(p)) {
      free.push(p);
      continue;
    }
    const current = held.get(r);
    if (current === undefined) {
      held.set(r, p);
    } else if (ranks.get(p)! < ranks.get(current)!) {
      held.set(r, p);
      free.push(current);
    } else {
      free.push(p);
    }
    free.sort();
  }

  const pairs: Record<string, string> = {};
  for (const [r, p] of held) pairs[p] = r;
  return { pairs };
}

/** A pair that would both rather be together than as matched. */
export function blockingPairs(prefs: Preferences, m: Matching): [string, string][] {
  const out: [string, string][] = [];
  const holderOf = new Map<string, string>();
  for (const [p, r] of Object.entries(m.pairs)) holderOf.set(r, p);
  const prefers = (list: string[] | undefined, a: string, b: string | undefined): boolean => {
    if (!list) return false;
    const ia = list.indexOf(a);
    if (ia < 0) return false;
    if (b === undefined) return true;
    const ib = list.indexOf(b);
    return ib < 0 || ia < ib;
  };
  for (const [p, plist] of Object.entries(prefs.proposers)) {
    for (const r of plist) {
      if (m.pairs[p] === r) continue;
      if (prefers(plist, r, m.pairs[p]) && prefers(prefs.receivers[r], p, holderOf.get(r))) out.push([p, r]);
    }
  }
  return out;
}
