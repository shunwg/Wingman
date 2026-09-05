import type { ChannelKind } from '@domain/index';

/**
 * Scripted replies, so the demo feels alive without pretending to be a server.
 *
 * One per channel kind per turn, chosen by how many messages the channel
 * already holds — deterministic, and honest: nobody is typing on the other
 * end, and the copy on the screen says so.
 */
const REPLIES: Record<ChannelKind, string[]> = {
  meet: [
    'Perfect. I am by the window seats near the coffee place.',
    'Got it. Two minutes away.',
    'See you there.',
  ],
  circle: [
    'Good to know, thanks for posting.',
    'Count me in for that.',
    'Someone said the same thing in the lounge earlier.',
  ],
  group: [
    'Works for me.',
    'I can do that time.',
    'Sounds good, see you all there.',
  ],
};

export function scriptedReply(kind: ChannelKind, turn: number): string {
  const list = REPLIES[kind];
  return list[turn % list.length]!;
}
