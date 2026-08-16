import type { AssuranceLevel, ISODateTime, VerificationRecord } from '@domain/index';

/**
 * From a pile of records to one number.
 *
 * This is the entire surface the privacy engine sees. Nothing downstream knows
 * that BankID exists, which is what makes providers swappable — a new eID in a
 * new country is a registry line, not a change to the rules that decide who can
 * see whom.
 */

/** A record only counts while it is live: not revoked, not lapsed. */
export function isActive(record: VerificationRecord, now: ISODateTime): boolean {
  if (record.revokedAt) return false;
  if (record.expiresAt && String(now) > String(record.expiresAt)) return false;
  return true;
}

/**
 * The highest live assurance, which is a max rather than a sum.
 *
 * Three social accounts do not add up to a government eID. Anyone can hold
 * three social accounts; that is the point of them. Treating assurance as
 * cumulative would let someone reach the level that protects women-only rooms
 * by signing up for Instagram twice, so the ladder takes the maximum and the
 * count is never a factor.
 */
export function assuranceOf(
  records: readonly VerificationRecord[],
  now: ISODateTime,
): AssuranceLevel {
  let best: AssuranceLevel = 0;
  for (const r of records) {
    if (isActive(r, now) && r.assurance > best) best = r.assurance;
  }
  return best;
}

/** Records that have lapsed and want re-checking — drives the nudge on You. */
export function lapsed(
  records: readonly VerificationRecord[],
  now: ISODateTime,
): VerificationRecord[] {
  return records.filter((r) => !r.revokedAt && r.expiresAt && String(now) > String(r.expiresAt));
}

export function revoke(record: VerificationRecord, at: ISODateTime): VerificationRecord {
  return { ...record, revokedAt: at };
}
