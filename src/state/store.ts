import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  AdmissionRule,
  DenialRecord,
  JourneyStage,
  MeetMessage,
  MeetRequest,
  MeetRequestStatus,
  Circle,
  MembershipDisplay,
  Person,
  PersonId,
  PrivacyPolicy,
  Trip,
  VerificationRecord,
} from '@domain/index';
import { asCircleId, asMeetRequestId, asUtc } from '@domain/index';
import type { ISODateTime } from '@domain/time';
import { ME, MY_TRIPS, SEED_NOW } from '@data/seed/trips';
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

// Bumped for `myTrip` -> `myTrips`. A v1 blob has a shape v2 cannot read, and
// the migration below discards rather than guesses.
export const STORE_VERSION = 2;

/**
 * What the board is currently being filtered to.
 *
 * A *lens*, not a policy, and the distinction is load-bearing. `womenOnly` here
 * changes what you see and has no effect whatever on who can see you — that is
 * the `women_only` preset under You, which compiles both halves atomically.
 * Conflating them is the bug the whole two-rule model exists to prevent, so the
 * screen says so in as many words.
 *
 * Deliberately not persisted. Reopening the app to a board silently narrowed by
 * a filter set last week is indistinguishable from a broken product.
 */
export interface BoardFilters {
  /** A specific trip, or every open one. */
  tripId: string | 'all';
  circleId: string | 'any';
  womenOnly: boolean;
  /** Kilometres between where the two of you are actually headed. */
  withinKm: number | null;
}

export const NO_FILTERS: BoardFilters = {
  tripId: 'all',
  circleId: 'any',
  womenOnly: false,
  withinKm: null,
};

export interface WingmanState {
  /** The signed-in person. Onboarding overwrites the seeded default. */
  me: Person;
  /**
   * Every trip, open or settled.
   *
   * A list rather than a single trip because people book more than one journey
   * at a time, and because "which trip is this person for" is unanswerable —
   * and the board unreadable — when the app can only hold one.
   */
  myTrips: Trip[];
  requests: MeetRequest[];
  /**
   * Everything said in a meet room, flat and append-only.
   *
   * One list rather than a map keyed by request, because messages are read in
   * time order far more often than they are read per-room, and a flat log makes
   * "what happened, in order" the cheap query rather than the expensive one.
   */
  messages: MeetMessage[];
  /**
   * Circles opened from inside the app.
   *
   * Separate from SEED_CIRCLES because those are fixtures and these are the
   * user's own — merging them into one list would make "can I delete this?"
   * ambiguous, and the seed is not the user's to delete.
   */
  myCircles: Circle[];
  /** Candidates shown and not acted on — feeds the fairness fatigue penalty. */
  seenCounts: Record<string, number>;
  /** The simulated clock. Real builds would use the wall clock here. */
  now: ISODateTime;
  onboarded: boolean;
  filters: BoardFilters;

  setMe: (patch: Partial<Person>) => void;
  setPrivacy: (patch: Partial<PrivacyPolicy>) => void;
  upsertTrip: (trip: Trip) => void;
  removeTrip: (tripId: string) => void;
  setFilters: (patch: Partial<BoardFilters>) => void;
  /** Re-open a settled trip. Changing your mind is allowed. */
  reopenTrip: (tripId: string) => void;
  markSeen: (id: PersonId) => void;
  completeOnboarding: () => void;

  /**
   * Circle membership.
   *
   * These live in the store rather than in the screen because "am I in this
   * circle, and does it show" is a fact about a person, not about a view. The
   * screen that renders it is not the only thing that will ever ask.
   */
  /** A stamp that was just earned. Replaces any previous one from the same provider. */
  addVerification: (record: VerificationRecord) => void;
  revokeVerification: (providerId: string) => void;

  createCircle: (circle: Circle) => void;
  joinCircle: (circleId: string, admittedBy: AdmissionRule['kind']) => void;
  leaveCircle: (circleId: string) => void;
  setMembershipDisplay: (circleId: string, display: MembershipDisplay) => void;

  /** One tap: where you have got to. Terminal is attached by the caller. */
  postStage: (requestId: string, stage: JourneyStage, at?: { terminal?: string; airportIata?: string }) => void;
  postText: (requestId: string, text: string) => void;

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

const initial = () => ({
  me: ME,
  myTrips: MY_TRIPS,
  requests: [seededInbound()],
  messages: [] as MeetMessage[],
  myCircles: [] as Circle[],
  seenCounts: {} as Record<string, number>,
  now: SEED_NOW,
  onboarded: false,
  filters: NO_FILTERS,
});

export const useStore = create<WingmanState>()(
  persist(
    (set, get) => ({
      ...initial(),

      setMe: (patch) => set((s) => ({ me: { ...s.me, ...patch } })),

      setPrivacy: (patch) =>
        set((s) => ({ me: { ...s.me, privacy: { ...s.me.privacy, ...patch } } })),

      upsertTrip: (trip) =>
        set((s) => ({
          myTrips: s.myTrips.some((t) => t.id === trip.id)
            ? s.myTrips.map((t) => (t.id === trip.id ? trip : t))
            : [...s.myTrips, trip],
        })),

      removeTrip: (tripId) =>
        set((s) => ({ myTrips: s.myTrips.filter((t) => String(t.id) !== tripId) })),

      setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),

      reopenTrip: (tripId) =>
        set((s) => ({
          myTrips: s.myTrips.map((t) => {
            if (String(t.id) !== tripId) return t;
            // Drop the outcome rather than flag it re-opened. A trip is open
            // exactly when it has no outcome, and keeping a second field in
            // sync with that is how the two end up disagreeing.
            const rest = { ...t };
            delete rest.outcome;
            return rest;
          }),
        })),

      markSeen: (id) =>
        set((s) => ({ seenCounts: { ...s.seenCounts, [id]: (s.seenCounts[id] ?? 0) + 1 } })),

      completeOnboarding: () => set({ onboarded: true }),

      postStage: (requestId, stage, at) =>
        set((s) => ({
          messages: [
            ...s.messages,
            {
              id: `m_${s.messages.length + 1}_${Date.parse(String(s.now))}`,
              requestId: asMeetRequestId(requestId),
              from: s.me.id,
              at: s.now,
              body: {
                kind: 'stage' as const,
                stage,
                ...(at?.terminal ? { terminal: at.terminal } : {}),
                ...(at?.airportIata ? { airportIata: at.airportIata as never } : {}),
              },
            },
          ],
        })),

      postText: (requestId, text) =>
        set((s) => {
          const trimmed = text.trim().slice(0, 240);
          if (!trimmed) return s;
          return {
            messages: [
              ...s.messages,
              {
                id: `m_${s.messages.length + 1}_${Date.parse(String(s.now))}`,
                requestId: asMeetRequestId(requestId),
                from: s.me.id,
                at: s.now,
                body: { kind: 'text' as const, text: trimmed },
              },
            ],
          };
        }),

      addVerification: (record) =>
        set((s) => ({
          me: {
            ...s.me,
            // One live stamp per provider. Verifying LinkedIn twice should
            // replace the record, not stack a second badge onto the card.
            verifications: [
              ...s.me.verifications.filter((v) => v.providerId !== record.providerId),
              record,
            ],
          },
        })),

      revokeVerification: (providerId) =>
        set((s) => ({
          me: {
            ...s.me,
            // Removed outright rather than marked revoked: this is the person
            // un-linking their own account, not trust-and-safety withdrawing a
            // stamp, and keeping a tombstone of an account somebody chose to
            // disconnect is exactly the kind of quiet retention this app is
            // meant not to do.
            verifications: s.me.verifications.filter((v) => v.providerId !== providerId),
          },
        })),

      createCircle: (circle) =>
        set((s) => ({
          myCircles: [...s.myCircles.filter((c) => c.id !== circle.id), circle],
          // The person who opens a circle is in it, and is its admin. A circle
          // whose creator has to then join their own circle is a bug wearing a
          // flow's clothing.
          me: {
            ...s.me,
            memberships: [
              ...s.me.memberships.filter((m) => m.circleId !== circle.id),
              {
                circleId: circle.id,
                personId: s.me.id,
                display: 'show_badge' as const,
                joinedAt: s.now,
                admittedBy: circle.admission.kind,
                role: 'admin' as const,
              },
            ],
          },
        })),

      joinCircle: (circleId, admittedBy) =>
        set((s) => {
          if (s.me.memberships.some((m) => String(m.circleId) === circleId)) return s;
          return {
            me: {
              ...s.me,
              memberships: [
                ...s.me.memberships,
                {
                  circleId: asCircleId(circleId),
                  personId: s.me.id,
                  // Badge off by default. Joining a circle is a decision about
                  // who you match with; wearing it is a separate decision, and
                  // defaulting it on would make that choice for people who
                  // never open this screen again.
                  display: 'match_only' as const,
                  joinedAt: s.now,
                  admittedBy,
                  role: 'member' as const,
                },
              ],
            },
          };
        }),

      leaveCircle: (circleId) =>
        set((s) => ({
          me: {
            ...s.me,
            memberships: s.me.memberships.filter((m) => String(m.circleId) !== circleId),
          },
        })),

      setMembershipDisplay: (circleId, display) =>
        set((s) => ({
          me: {
            ...s.me,
            memberships: s.me.memberships.map((m) =>
              String(m.circleId) === circleId ? { ...m, display } : m,
            ),
          },
        })),

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
        set((s) => {
          const requests = s.requests.map((r) =>
            String(r.id) === id
              ? transition(r, { to, by, at: s.now, ...(note ? { note } : {}) })
              : r,
          );

          if (to !== 'accepted') return { requests };

          /*
           * Saying yes closes that trip.
           *
           * You were looking for someone for a particular journey and you found
           * them; continuing to serve alternatives turns the board into an
           * invitation to trade up on a person who has already agreed to meet
           * you. It closes exactly one trip — the one the request came from —
           * which is the whole reason MeetRequest carries a tripId.
           *
           * Reversible from the Trip screen, because plans fall through.
           */
          const accepted = requests.find((r) => String(r.id) === id);
          if (!accepted) return { requests };
          const other =
            accepted.fromPersonId === s.me.id ? accepted.toPersonId : accepted.fromPersonId;

          return {
            requests,
            myTrips: s.myTrips.map((t) =>
              t.id === accepted.tripId
                ? { ...t, outcome: { settledWith: other, at: s.now } }
                : t,
            ),
          };
        }),

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
        myTrips: s.myTrips,
        requests: s.requests,
        messages: s.messages,
        myCircles: s.myCircles,
        seenCounts: s.seenCounts,
        onboarded: s.onboarded,
        // `filters` is absent on purpose. It is a lens on this session, not a
        // durable fact, and reopening the app to a board silently narrowed by
        // a filter set last week is indistinguishable from a broken product.
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
