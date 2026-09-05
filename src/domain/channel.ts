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

export type MessageBody = MeetMessageBody | { kind: 'system'; text: string };

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

/** Free text caps. A meet is arranged in a sentence; a channel gets a paragraph. */
export const TEXT_CAP: Record<ChannelKind, number> = { meet: 240, circle: 500, group: 500 };
