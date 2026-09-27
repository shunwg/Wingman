import type { ChannelId, CircleId, MeetRequestId, MessageId, PersonId } from './ids';
import { asChannelId } from './ids';
import type { MeetMessageBody } from './meet';
import type { ISODateTime } from './time';

/**
 * A conversation.
 *
 * Three kinds, one shape. A meet room is a channel with two members and a
 * request behind it; a circle's General is a channel every member is in; a
 * group is a channel with an explicit member list inside a circle. The inbox
 * lists all three as rows of the same thing, which is the whole point of
 * having one type.
 */
export type ChannelKind = 'meet' | 'circle' | 'group';

export interface Channel {
  id: ChannelId;
  kind: ChannelKind;
  title: string;
  /** Meet: two. Group: explicit. Circle: empty — every member is in it. */
  memberIds: PersonId[];
  /** Circle and group channels belong to a circle. */
  circleId?: CircleId;
  /** Meet channels belong to an accepted request. */
  requestId?: MeetRequestId;
  createdBy: PersonId;
  createdAt: ISODateTime;
  /** The organiser's announcement, on a circle's General. */
  pinned?: { text: string; at: ISODateTime };
}

/**
 * Somebody's seat in a car changed. `from` on the message is that person.
 *
 * Structured rather than a sentence, because the sentence used to be built
 * from the person's own typed name and stored as text: a name like "Jonas is
 * no longer in the car. Mira" impersonated the host in everyone's room, and a
 * zero-width name made a join anonymous. Rendered at read time, the name is
 * whatever the reader's own view of that person says.
 *
 * `took` is a self-seat, `in` a host's yes, `out` any way of leaving —
 * withdrawn, removed or hidden alike, so no one can tell which.
 */
export type SeatChange = 'took' | 'in' | 'out';

export type MessageBody =
  | MeetMessageBody
  | { kind: 'system'; text: string }
  | { kind: 'seat'; change: SeatChange };

export interface Message {
  id: MessageId;
  channelId: ChannelId;
  from: PersonId;
  at: ISODateTime;
  body: MessageBody;
}

/** Channel ids are derived where the thing they belong to already has one. */
export const meetChannelId = (requestId: MeetRequestId | string): ChannelId =>
  asChannelId(`meet:${String(requestId)}`);
export const circleChannelId = (circleId: CircleId | string): ChannelId =>
  asChannelId(`circle:${String(circleId)}`);
/** A shared car's room. Derived, so the car and its room cannot disagree. */
export const rideChannelId = (rideId: string): ChannelId =>
  asChannelId(`ride:${String(rideId)}`);

/** Free text caps. A meet is arranged in a sentence; a channel gets a paragraph. */
export const TEXT_CAP: Record<ChannelKind, number> = { meet: 240, circle: 500, group: 500 };
