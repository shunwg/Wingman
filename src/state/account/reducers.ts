import type {
  Channel,
  Circle,
  GuardianSession,
  ISODateTime,
  MeetRequest,
  Message,
  Person,
  Rating,
  SafetyReport,
  Trip,
} from '@domain/index';
import { asMeetRequestId, asUtc } from '@domain/index';
import { ME, MY_TRIPS, SEED_NOW } from '@data/seed/trips';
import { blankPerson } from './blank';
import type { Account } from './types';

/**
 * The persisted part of the store, and the three transitions between the
 * states a device can be in. Pure functions over that slice, so they test
 * without zustand and the store only wires them.
 */
export interface PersistedSlice {
  me: Person;
  myTrips: Trip[];
  requests: MeetRequest[];
  /** Groups opened on this device. Meet and circle channels are derived. */
  channels: Channel[];
  messages: Message[];
  /** When you last opened each channel — a fact about the reader, so it persists. */
  readAt: Record<string, ISODateTime>;
  myCircles: Circle[];
  seenCounts: Record<string, number>;
  reports: SafetyReport[];
  muted: string[];
  guardian: GuardianSession | null;
  ratings: Rating[];
  /** The organiser's pinned note per circle, shown on its General. */
  announcements: Record<string, { text: string; at: ISODateTime }>;
  onboarded: boolean;
  account: Account;
}

/**
 * One request already waiting, in the demo.
 *
 * Seeded so the decline flow is reachable on a first run. Being able to say no
 * is a stated requirement, and a requirement you cannot reach without first
 * persuading a stranger to message you is not really testable.
 */
export const seededInbound = (): MeetRequest => ({
  id: asMeetRequestId('req_seed_priya'),
  fromPersonId: 'priya' as never,
  toPersonId: ME.id,
  tripId: MY_TRIPS[0]!.id,
  overlapRef: { kind: 'same_airport_window', airport: 'LHR' as never },
  proposal: {
    kind: 'gate_coffee',
    window: { from: asUtc('2026-09-02T18:10:00Z'), to: asUtc('2026-09-02T19:20:00Z') },
  },
  message: 'Long layover and no lounge access — coffee before you board?',
  status: 'sent',
  history: [
    {
      at: asUtc('2026-09-02T16:05:00Z'),
      by: 'priya' as never,
      from: 'draft',
      to: 'sent',
    },
  ],
  createdAt: asUtc('2026-09-02T16:05:00Z'),
  expiresAt: asUtc('2026-09-02T19:25:00Z'),
});

/** A fresh install: nobody here yet, welcome screen next. */
export function blankState(deviceId: string, now: ISODateTime): PersistedSlice {
  return {
    me: blankPerson(deviceId, now),
    myTrips: [],
    requests: [],
    channels: [],
    messages: [],
    readAt: {},
    myCircles: [],
    seenCounts: {},
    reports: [],
    muted: [],
    guardian: null,
    ratings: [],
    announcements: {},
    onboarded: false,
    account: { mode: 'none', deviceId, provider: 'device' },
  };
}

/** Alex, three trips, Priya waiting — the stakeholder demo. */
export function demoState(deviceId: string, returnTo?: string): PersistedSlice {
  return {
    me: ME,
    myTrips: MY_TRIPS,
    requests: [seededInbound()],
    channels: [],
    messages: [],
    readAt: {},
    myCircles: [],
    seenCounts: {},
    reports: [],
    muted: [],
    guardian: null,
    ratings: [],
    announcements: {},
    onboarded: true,
    account: {
      mode: 'demo',
      deviceId,
      provider: 'device',
      createdAt: SEED_NOW,
      ...(returnTo ? { returnTo } : {}),
    },
  };
}

export function applyStartDemo(s: PersistedSlice): PersistedSlice {
  return demoState(s.account.deviceId, s.account.returnTo);
}

/**
 * Start a profile of your own. From the demo or a fresh install this is a
 * clean slate; if a local profile is already half-made, resume it rather than
 * throw away what they typed.
 */
export function applyBeginSignup(
  s: PersistedSlice,
  deviceId: string,
  now: ISODateTime,
): PersistedSlice {
  if (s.account.mode === 'local') return s;
  const blank = blankState(deviceId, now);
  return {
    ...blank,
    account: {
      ...blank.account,
      mode: 'local',
      ...(s.account.returnTo ? { returnTo: s.account.returnTo } : {}),
    },
  };
}

/** Returns the new state and where to go next; the return-to is consumed. */
export function applyCompleteOnboarding(
  s: PersistedSlice,
  now: ISODateTime,
): [PersistedSlice, string] {
  const to = s.account.returnTo ?? '#/';
  const account: Account = {
    ...s.account,
    mode: s.account.mode === 'none' ? 'local' : s.account.mode,
    createdAt: s.account.createdAt ?? now,
  };
  delete account.returnTo;
  return [{ ...s, onboarded: true, account }, to];
}
