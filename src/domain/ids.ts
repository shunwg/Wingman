/**
 * Branded identifiers.
 *
 * These are strings at runtime and distinct types at compile time, which stops
 * the single most common bug in a system with this many entity kinds: passing a
 * PersonId where a MeetId was wanted. Both are strings; only one is correct.
 */

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type PersonId = Brand<string, 'PersonId'>;
export type TripId = Brand<string, 'TripId'>;
export type SegmentId = Brand<string, 'SegmentId'>;
export type CircleId = Brand<string, 'CircleId'>;
export type MeetRequestId = Brand<string, 'MeetRequestId'>;
export type MeetId = Brand<string, 'MeetId'>;
export type RatingId = Brand<string, 'RatingId'>;
export type GuardianSessionId = Brand<string, 'GuardianSessionId'>;
export type VerificationId = Brand<string, 'VerificationId'>;
export type ChannelId = Brand<string, 'ChannelId'>;
export type MessageId = Brand<string, 'MessageId'>;
/** An entry in the interest vocabulary (`domain/tags.ts`), never free text. */
export type TagId = Brand<string, 'TagId'>;

/** IATA airport code, always three uppercase letters. */
export type IataCode = Brand<string, 'IataCode'>;

/**
 * A city grouping several airports. London is one city with five airports, and
 * "we are both in London on Thursday" must be true across all of them.
 */
export type CityKey = Brand<string, 'CityKey'>;

export const asPersonId = (s: string) => s as PersonId;
export const asTripId = (s: string) => s as TripId;
export const asSegmentId = (s: string) => s as SegmentId;
export const asCircleId = (s: string) => s as CircleId;
export const asMeetRequestId = (s: string) => s as MeetRequestId;
export const asMeetId = (s: string) => s as MeetId;
export const asRatingId = (s: string) => s as RatingId;
export const asGuardianSessionId = (s: string) => s as GuardianSessionId;
export const asVerificationId = (s: string) => s as VerificationId;
export const asChannelId = (s: string) => s as ChannelId;
export const asMessageId = (s: string) => s as MessageId;
export const asTagId = (s: string) => s as TagId;
export const asCityKey = (s: string) => s as CityKey;

const IATA_RE = /^[A-Z]{3}$/;

/** Narrowing guard — the only sanctioned way to mint an IataCode from input. */
export function isIata(s: string): s is IataCode {
  return IATA_RE.test(s);
}

export function asIata(s: string): IataCode {
  const up = s.toUpperCase();
  if (!IATA_RE.test(up)) throw new Error(`Not an IATA code: ${JSON.stringify(s)}`);
  return up as IataCode;
}
