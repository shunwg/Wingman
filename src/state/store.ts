import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  AdmissionRule,
  Channel,
  DenialRecord,
  GuardianContact,
  GuardianSession,
  IntentProfile,
  MeetRequest,
  MeetRequestStatus,
  Message,
  MessageBody,
  Circle,
  MembershipDisplay,
  Person,
  PersonId,
  PrivacyPolicy,
  ProfessionalCard,
  Rating,
  SafetyReport,
  Trip,
  VerificationRecord,
} from '@domain/index';
import {
  asChannelId,
  asCircleId,
  asGuardianSessionId,
  asMeetId,
  asMeetRequestId,
  asMessageId,
  asRatingId,
  asUtc,
  meetChannelId,
  TEXT_CAP,
} from '@domain/index';
import {
  armGuardian,
  endGuardian,
  escalateGuardian,
  GUARDIAN_PRESETS,
  type GuardianPresetId,
} from '@privacy/index';
import { scriptedReply } from '@data/seed/replies';
import { SEED_MESSAGES } from '@data/seed/channels';
import type { ISODateTime } from '@domain/time';
import { SEED_NOW } from '@data/seed/trips';
import { layoversFor, MATCH_CONFIG_V1 } from '@matching/index';
import { transition } from './machines/meetRequest';
import type { Account } from './account/types';
import {
  applyBeginSignup,
  applyCompleteOnboarding,
  applyStartDemo,
  blankState,
  type PersistedSlice,
} from './account/reducers';
import { migratePersisted } from './persist/migrate';

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

// v2 → v3: the store starts blank and an `account` slice says how a person
// came to be here. v3 → v4: meet messages become messages in channels, and
// the safety slices (reports, muted, guardian, ratings) appear. A v2 blob is
// by construction the seeded demo and migrates to demo mode with its session
// intact; v1 and earlier are discarded.
export const STORE_VERSION = 4;

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
  /** Scan, then read. Rows are for the scan. */
  layout: 'feed' | 'row';
  industry: string | 'any';
  /** Only people you saved for later. */
  savedOnly: boolean;
}

export const NO_FILTERS: BoardFilters = {
  tripId: 'all',
  circleId: 'any',
  womenOnly: false,
  withinKm: null,
  layout: 'feed',
  industry: 'any',
  savedOnly: false,
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
   * Groups opened on this device. Meet channels are derived from accepted
   * requests and circle channels from memberships, so neither is stored — a
   * stored copy of a derived thing is the first place two facts disagree.
   */
  channels: Channel[];
  /**
   * Everything said, in every channel, flat and append-only.
   *
   * One list rather than a map keyed by channel, because messages are read in
   * time order far more often than they are read per-room, and a flat log makes
   * "what happened, in order" the cheap query rather than the expensive one.
   */
  messages: Message[];
  /** When you last opened each channel. A fact about the reader; persisted. */
  readAt: Record<string, ISODateTime>;
  /** Kept on this device until there is a server to send them to. */
  reports: SafetyReport[];
  muted: string[];
  /** At most one live guardian session — a meet is one thing at a time. */
  guardian: GuardianSession | null;
  ratings: Rating[];
  /** The organiser's pinned note per circle, shown on its General. */
  announcements: Record<string, { text: string; at: ISODateTime }>;
  /** People saved for later — a shortlist, not a signal. */
  saved: PersonId[];
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
  /** How this device came to have a person on it. See account/types.ts. */
  account: Account;
  filters: BoardFilters;

  /** Alex, three trips, Priya waiting. Returns where to go next. */
  startDemo: () => string;
  /** A profile of your own, from nothing. Resumes a half-made one. */
  beginSignup: () => void;
  /** Onboarding is done. Returns the deferred destination, or the board. */
  completeOnboarding: () => string;
  /** Back to the welcome screen with nothing kept. */
  signOut: () => void;
  setReturnTo: (hash: string | null) => void;

  setMe: (patch: Partial<Person>) => void;
  setProfessional: (patch: Partial<ProfessionalCard>) => void;
  setIntent: (patch: Partial<IntentProfile>) => void;
  /** A resized data URL, or null to go back to the generated portrait. */
  setPhoto: (dataUrl: string | null) => void;
  /** Add a trip typed by hand. Attaches layovers the way the seed does. */
  addTrip: (trip: Trip) => void;
  setPrivacy: (patch: Partial<PrivacyPolicy>) => void;
  upsertTrip: (trip: Trip) => void;
  removeTrip: (tripId: string) => void;
  setFilters: (patch: Partial<BoardFilters>) => void;
  /** Re-open a settled trip. Changing your mind is allowed. */
  reopenTrip: (tripId: string) => void;
  markSeen: (id: PersonId) => void;
  toggleSaved: (id: PersonId) => void;

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
  /** The organiser's edits — mark, badges, admission. Only circles you opened. */
  updateCircle: (circle: Circle) => void;
  joinCircle: (circleId: string, admittedBy: AdmissionRule['kind'], badgeIds?: string[]) => void;
  /** Pin a note on the circle's General. Organiser only, enforced by the screen. */
  announce: (circleId: string, text: string) => void;
  /** Stop a circle matching from today. */
  closeCircle: (circleId: string) => void;
  leaveCircle: (circleId: string) => void;
  setMembershipDisplay: (circleId: string, display: MembershipDisplay) => void;

  /** Say something in a channel. Text is capped by kind; a stage carries its terminal. */
  post: (channel: Channel, body: MessageBody) => void;
  /** A group inside a circle, with an explicit member list. */
  openGroup: (circleId: string, title: string, memberIds: PersonId[]) => Channel;
  markRead: (channelId: string) => void;
  muteChannel: (channelId: string) => void;
  unmuteChannel: (channelId: string) => void;

  /** Report them; hide them too unless told otherwise. Silent either way. */
  reportPerson: (
    personId: PersonId,
    reason: SafetyReport['reason'],
    note?: string,
    alsoBlock?: boolean,
  ) => void;
  reportMessage: (message: Message, reason: SafetyReport['reason'], note?: string) => void;
  unblockPerson: (personId: PersonId) => void;

  /** Let someone watch over one meet, for its window and a grace period. */
  armGuardianFor: (
    channelId: string,
    contact: GuardianContact,
    preset: GuardianPresetId,
    window: { from: ISODateTime; to: ISODateTime },
  ) => void;
  checkOut: () => void;
  escalate: () => void;
  /** After a meet: conduct, not quality. */
  rate: (
    channelId: string,
    rateeId: PersonId,
    input: Pick<Rating, 'showedUp' | 'respectedBoundaries' | 'accurateProfile' | 'wouldMeetAgain' | 'flags'>,
  ) => void;

  sendRequest: (input: Omit<MeetRequest, 'id' | 'status' | 'history' | 'createdAt'>) => MeetRequest;
  advanceRequest: (id: string, to: MeetRequestStatus, by: PersonId | 'system', note?: string) => void;
  denyRequest: (id: string, denial: DenialRecord) => void;
  blockPerson: (id: PersonId) => void;
  reset: () => void;
}

let requestCounter = 0;

/**
 * Minted once per install. The store is the impure edge, so a random id is
 * fine here — the engines never generate one.
 */
const mintDeviceId = () => crypto.randomUUID();

/** The persisted facts, as the pure reducers see them. */
const slice = (s: WingmanState): PersistedSlice => ({
  me: s.me,
  myTrips: s.myTrips,
  requests: s.requests,
  channels: s.channels,
  messages: s.messages,
  readAt: s.readAt,
  myCircles: s.myCircles,
  seenCounts: s.seenCounts,
  reports: s.reports,
  muted: s.muted,
  guardian: s.guardian,
  ratings: s.ratings,
  announcements: s.announcements,
  saved: s.saved,
  onboarded: s.onboarded,
  account: s.account,
});

/** A fresh install. The welcome screen is what a person sees next. */
const initial = () => ({
  ...blankState(mintDeviceId(), SEED_NOW),
  now: SEED_NOW,
  filters: NO_FILTERS,
});

export const useStore = create<WingmanState>()(
  persist(
    (set, get) => ({
      ...initial(),

      startDemo: () => {
        const next = applyStartDemo(slice(get()));
        const to = next.account.returnTo ?? '#/';
        const account = { ...next.account };
        delete account.returnTo;
        set({ ...next, account });
        return to;
      },

      beginSignup: () =>
        set((s) => applyBeginSignup(slice(s), s.account.deviceId, s.now)),

      completeOnboarding: () => {
        const [next, to] = applyCompleteOnboarding(slice(get()), get().now);
        set(next);
        return to;
      },

      signOut: () => set(initial()),

      setReturnTo: (hash) =>
        set((s) => {
          const account = { ...s.account };
          delete account.returnTo;
          return { account: hash ? { ...account, returnTo: hash } : account };
        }),

      setMe: (patch) => set((s) => ({ me: { ...s.me, ...patch } })),

      setProfessional: (patch) =>
        set((s) => ({ me: { ...s.me, professional: { ...s.me.professional, ...patch } } })),

      setIntent: (patch) =>
        set((s) => ({ me: { ...s.me, intent: { ...s.me.intent, ...patch } } })),

      setPhoto: (dataUrl) =>
        set((s) => {
          // localStorage is ~5 MB per origin and persist fails silently past
          // it, so an unresized photo is refused rather than quietly dropped.
          if (dataUrl && dataUrl.length > 200_000) {
            throw new Error('Photo too large — resize before storing.');
          }
          const avatar = { ...s.me.avatar };
          delete avatar.photoUrl;
          return { me: { ...s.me, avatar: dataUrl ? { ...avatar, photoUrl: dataUrl } : avatar } };
        }),

      addTrip: (trip) => {
        const withLayovers = { ...trip, layovers: layoversFor(trip, MATCH_CONFIG_V1) };
        get().upsertTrip(withLayovers);
      },

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

      toggleSaved: (id) =>
        set((s) => ({
          saved: s.saved.includes(id) ? s.saved.filter((x) => x !== id) : [...s.saved, id],
        })),

      markSeen: (id) =>
        set((s) => ({ seenCounts: { ...s.seenCounts, [id]: (s.seenCounts[id] ?? 0) + 1 } })),

      post: (channel, body) =>
        set((s) => {
          let b = body;
          if (b.kind === 'text') {
            const trimmed = b.text.trim().slice(0, TEXT_CAP[channel.kind]);
            if (!trimmed) return s;
            b = { kind: 'text', text: trimmed };
          }
          const stamp = Date.parse(String(s.now));
          const mine: Message = {
            id: asMessageId('m_' + (s.messages.length + 1) + '_' + stamp),
            channelId: channel.id,
            from: s.me.id,
            at: s.now,
            body: b,
          };
          const out = [...s.messages, mine];

          /*
           * A scripted reply, so the demo answers back. Deterministic, and
           * honest: the other party is a seeded person, never a server. Stage
           * updates get no reply — "Priya is through security" is not a thing
           * anyone answers.
           */
          if (b.kind === 'text' && s.account.mode === 'demo') {
            // A circle's General has no member list; whoever has spoken there
            // in the seed stands in.
            const others = (
              channel.memberIds.length > 0
                ? channel.memberIds
                : [...new Set(SEED_MESSAGES.filter((m) => m.channelId === channel.id).map((m) => m.from))]
            ).filter((id) => id !== s.me.id);
            const turn = s.messages.filter(
              (m) => m.channelId === channel.id && m.from === s.me.id,
            ).length;
            const from = others[turn % Math.max(others.length, 1)];
            if (from) {
              out.push({
                id: asMessageId('m_' + (s.messages.length + 2) + '_' + stamp),
                channelId: channel.id,
                from,
                at: s.now,
                body: { kind: 'text', text: scriptedReply(channel.kind, turn) },
              });
            }
          }
          return { messages: out, readAt: { ...s.readAt, [String(channel.id)]: s.now } };
        }),

      openGroup: (circleId, title, memberIds) => {
        const s = get();
        const channel: Channel = {
          id: asChannelId('group:' + circleId + ':' + Date.parse(String(s.now)) + ':' + (s.channels.length + 1)),
          kind: 'group',
          title: title.trim().slice(0, 40) || 'Group',
          memberIds: [...new Set([s.me.id, ...memberIds])],
          circleId: asCircleId(circleId),
          createdBy: s.me.id,
          createdAt: s.now,
        };
        set({ channels: [...s.channels, channel] });
        return channel;
      },

      markRead: (channelId) => set((s) => ({ readAt: { ...s.readAt, [channelId]: s.now } })),

      muteChannel: (channelId) => set((s) => ({ muted: [...new Set([...s.muted, channelId])] })),

      unmuteChannel: (channelId) => set((s) => ({ muted: s.muted.filter((c) => c !== channelId) })),

      reportPerson: (personId, reason, note, alsoBlock = true) => {
        const s = get();
        const report: SafetyReport = {
          id: 'r_' + (s.reports.length + 1) + '_' + Date.parse(String(s.now)),
          personId,
          reason,
          ...(note?.trim() ? { note: note.trim().slice(0, 240) } : {}),
          at: s.now,
        };
        set({ reports: [...s.reports, report] });
        if (alsoBlock) get().blockPerson(personId);
      },

      reportMessage: (message, reason, note) => {
        const s = get();
        const report: SafetyReport = {
          id: 'r_' + (s.reports.length + 1) + '_' + Date.parse(String(s.now)),
          personId: message.from,
          channelId: message.channelId,
          messageId: message.id,
          reason,
          ...(note?.trim() ? { note: note.trim().slice(0, 240) } : {}),
          at: s.now,
        };
        set({ reports: [...s.reports, report] });
      },

      unblockPerson: (personId) =>
        set((s) => ({ me: { ...s.me, blocked: s.me.blocked.filter((id) => id !== personId) } })),

      armGuardianFor: (channelId, contact, preset, window) => {
        const s = get();
        const session = armGuardian({
          id: asGuardianSessionId('g_' + Date.parse(String(s.now))),
          meetId: asMeetId(channelId),
          travellerId: s.me.id,
          guardian: contact,
          scope: GUARDIAN_PRESETS[preset].build(window.to),
          meetWindow: window,
          // The engine never generates randomness; the store is the impure edge.
          shareToken: crypto.randomUUID(),
          now: s.now,
        });
        set({ guardian: session });
      },

      checkOut: () =>
        set((s) => ({ guardian: s.guardian ? endGuardian(s.guardian, s.now) : null })),

      escalate: () =>
        set((s) => ({ guardian: s.guardian ? escalateGuardian(s.guardian, s.now) : null })),

      rate: (channelId, rateeId, input) =>
        set((s) => ({
          ratings: [
            ...s.ratings.filter((r) => String(r.meetId) !== channelId),
            {
              id: asRatingId('rt_' + Date.parse(String(s.now))),
              meetId: asMeetId(channelId),
              raterId: s.me.id,
              rateeId,
              submittedAt: s.now,
              ...input,
            },
          ],
        })),

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
                // The creator wears the organiser badge if the circle has one.
                ...(circle.badges?.some((b) => b.id === 'organiser')
                  ? { badgeIds: ['organiser'] }
                  : {}),
              },
            ],
          },
        })),

      updateCircle: (circle) =>
        set((s) => ({
          myCircles: s.myCircles.map((c) => (c.id === circle.id ? circle : c)),
        })),

      announce: (circleId, text) =>
        set((s) => ({
          announcements: {
            ...s.announcements,
            [circleId]: { text: text.trim().slice(0, 280), at: s.now },
          },
        })),

      closeCircle: (circleId) =>
        set((s) => {
          const today = String(s.now).slice(0, 10) as never;
          return {
            myCircles: s.myCircles.map((c) =>
              String(c.id) === circleId ? { ...c, runs: { from: c.runs?.from ?? today, to: today } } : c,
            ),
          };
        }),

      joinCircle: (circleId, admittedBy, badgeIds) =>
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
                  ...(badgeIds && badgeIds.length > 0 ? { badgeIds } : {}),
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
            messages: [
              ...s.messages,
              {
                id: asMessageId('m_' + (s.messages.length + 1) + '_' + Date.parse(String(s.now))),
                channelId: meetChannelId(accepted.id),
                from: s.me.id,
                at: s.now,
                body: {
                  kind: 'system',
                  text: 'You both said yes. Nothing else is shared until you choose to.',
                },
              },
            ],
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

      reset: () => set(initial()),
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
        channels: s.channels,
        messages: s.messages,
        readAt: s.readAt,
        myCircles: s.myCircles,
        seenCounts: s.seenCounts,
        reports: s.reports,
        muted: s.muted,
        guardian: s.guardian,
        ratings: s.ratings,
        announcements: s.announcements,
        saved: s.saved,
        onboarded: s.onboarded,
        account: s.account,
        // `filters` is absent on purpose. It is a lens on this session, not a
        // durable fact, and reopening the app to a board silently narrowed by
        // a filter set last week is indistinguishable from a broken product.
      }),
      migrate: (persisted, version) =>
        migratePersisted(persisted, version, mintDeviceId, SEED_NOW) as never,
    },
  ),
);

/** Reset helper for tests and the dev menu. Yields a fresh install. */
export const resetStore = () => useStore.getState().reset();

export const nowOf = (): ISODateTime => useStore.getState().now ?? asUtc(SEED_NOW);
