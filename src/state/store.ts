import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  DenialRecord,
  MeetRequest,
  MeetRequestStatus,
  Person,
  PersonId,
  PrivacyPolicy,
  Trip,
} from '@domain/index';
import { asMeetRequestId, asUtc } from '@domain/index';
import type { ISODateTime } from '@domain/time';
import { ME, MY_TRIP, SEED_NOW } from '@data/seed/trips';
import { transition } from './machines/meetRequest';

/**
 * The store.
 *
 * Two rules matter more than the library choice, and both are load-bearing:
 *
 *  · **Nothing derived is stored.** Candidate lists, audience reports and
 *    visibility verdicts are recomputed on read, in selectors, by calling the
 *    pure engines. A cached match list is a privacy incident waiting to happen —
 *    a policy change has to invalidate visibility instantly, and it does, as
 *    long as nothing stale is kept.
 *
 *  · **All request writes go through the FSM.** `state/machines/meetRequest.ts`
 *    throws on an illegal transition rather than accepting a bad status.
 *
 * Persistence is versioned from day one. The previous prototype kept one
 * unversioned localStorage blob, and the missing version — not the blob — is
 * what made it unmaintainable.
 */

export const STORE_VERSION = 1;

export interface WingmanState {
  /** The signed-in person. Onboarding overwrites the seeded default. */
  me: Person;
  myTrip: Trip | null;
  requests: MeetRequest[];
  /** Candidates shown and not acted on — feeds the fairness fatigue penalty. */
  seenCounts: Record<string, number>;
  /** The simulated clock. Real builds would use the wall clock here. */
  now: ISODateTime;
  onboarded: boolean;

  setMe: (patch: Partial<Person>) => void;
  setPrivacy: (patch: Partial<PrivacyPolicy>) => void;
  setTrip: (trip: Trip | null) => void;
  markSeen: (id: PersonId) => void;
  completeOnboarding: () => void;

  sendRequest: (input: Omit<MeetRequest, 'id' | 'status' | 'history' | 'createdAt'>) => MeetRequest;
  advanceRequest: (id: string, to: MeetRequestStatus, by: PersonId | 'system', note?: string) => void;
  denyRequest: (id: string, denial: DenialRecord) => void;
  blockPerson: (id: PersonId) => void;
  reset: () => void;
}

let requestCounter = 0;

/**
 * One request already waiting.
 *
 * Seeded so the decline flow is reachable on a first run. Being able to say no
 * is a stated requirement, and a requirement you cannot reach without first
 * persuading a stranger to message you is not really testable.
 */
const seededInbound = (): MeetRequest => ({
  id: asMeetRequestId('req_seed_priya'),
  fromPersonId: 'priya' as never,
  toPersonId: ME.id,
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

const initial = () => ({
  me: ME,
  myTrip: MY_TRIP,
  requests: [seededInbound()],
  seenCounts: {} as Record<string, number>,
  now: SEED_NOW,
  onboarded: false,
});

export const useStore = create<WingmanState>()(
  persist(
    (set, get) => ({
      ...initial(),

      setMe: (patch) => set((s) => ({ me: { ...s.me, ...patch } })),

      setPrivacy: (patch) =>
        set((s) => ({ me: { ...s.me, privacy: { ...s.me.privacy, ...patch } } })),

      setTrip: (trip) => set({ myTrip: trip }),

      markSeen: (id) =>
        set((s) => ({ seenCounts: { ...s.seenCounts, [id]: (s.seenCounts[id] ?? 0) + 1 } })),

      completeOnboarding: () => set({ onboarded: true }),

      sendRequest: (input) => {
        const now = get().now;
        const request: MeetRequest = {
          ...input,
          id: asMeetRequestId(`req_${++requestCounter}_${Date.parse(now)}`),
          status: 'draft',
          history: [],
          createdAt: now,
        };
        const sent = transition(request, { to: 'sent', by: get().me.id, at: now });
        set((s) => ({ requests: [...s.requests, sent] }));
        return sent;
      },

      advanceRequest: (id, to, by, note) =>
        set((s) => ({
          requests: s.requests.map((r) =>
            String(r.id) === id
              ? transition(r, { to, by, at: s.now, ...(note ? { note } : {}) })
              : r,
          ),
        })),

      denyRequest: (id, denial) =>
        set((s) => ({
          requests: s.requests.map((r) =>
            String(r.id) === id
              ? transition(r, { to: 'denied', by: r.toPersonId, at: s.now, denial })
              : r,
          ),
          // A denial that also blocks has to take effect immediately, not at
          // the next refresh — the whole point is that they go away now.
          me: denial.alsoBlock
            ? {
                ...s.me,
                blocked: [
                  ...s.me.blocked,
                  ...s.requests.filter((r) => String(r.id) === id).map((r) => r.fromPersonId),
                ],
              }
            : s.me,
        })),

      blockPerson: (id) =>
        set((s) => ({
          me: { ...s.me, blocked: [...new Set([...s.me.blocked, id])] },
          // Any live request between you dies with the block.
          requests: s.requests.map((r) =>
            (r.fromPersonId === id || r.toPersonId === id) &&
            !['accepted', 'denied', 'withdrawn', 'expired', 'revoked_by_policy'].includes(r.status)
              ? transition(r, { to: 'revoked_by_policy', by: 'system', at: s.now })
              : r,
          ),
        })),

      reset: () => set({ ...initial(), onboarded: false }),
    }),
    {
      name: 'wingman',
      version: STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      /**
       * Only durable facts are persisted. Nothing derived, and nothing that
       * privacy depends on being fresh.
       */
      partialize: (s) => ({
        me: s.me,
        myTrip: s.myTrip,
        requests: s.requests,
        seenCounts: s.seenCounts,
        onboarded: s.onboarded,
      }),
      migrate: (persisted, version) => {
        // v0 had no schema version at all. Anything from before this chain
        // started is discarded rather than guessed at — a half-migrated
        // privacy policy is worse than a fresh one.
        if (version < STORE_VERSION) return initial() as never;
        return persisted as never;
      },
    },
  ),
);

/** Reset helper for tests and the dev menu. */
export const resetStore = () => useStore.getState().reset();

export const nowOf = (): ISODateTime => useStore.getState().now ?? asUtc(SEED_NOW);
