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
  Gender,
  PrivacyPolicy,
  ProfessionalCard,
  Rating,
  Ride,
  RideAudience,
  RideFare,
  RideClaim,
  RideDirection,
  RidePoint,
  JourneyStage,
  SeatChange,
  StageUpdate,
  SafetyReport,
  TimeWindow,
  TripId,
  Trip,
  IataCode,
  VerificationRecord,
} from '@domain/index';
import {
  asChannelId,
  asCircleId,
  asGuardianSessionId,
  asMeetRequestId,
  asMessageId,
  asRatingId,
  asRideId,
  asUtc,
  assertFare,
  latestClaim,
  looksLikeAddress,
  canAgree,
  codeFromSeed,
  agreedPlan,
  makeRide,
  meetIdForChannel,
  PICKUP_NOTE_CAP,
  meetChannelId,
  rideChannelId,
  rideRoute,
  riders,
  roomMembers,
  seatsAutomatically,
  seatsLeft,
  TEXT_CAP,
} from '@domain/index';
import {
  armGuardian,
  endGuardian,
  escalateGuardian,
  GUARDIAN_PRESETS,
  type GuardianPresetId,
  withMeetPreference,
} from '@privacy/index';
import { scriptedProposal, scriptedReply } from '@data/seed/replies';
import { SEED_MESSAGES } from '@data/seed/channels';
import type { ISODateTime } from '@domain/time';
import { SEED_NOW } from '@data/seed/trips';
import { layoversFor, MATCH_CONFIG_V1 } from '@matching/index';
import { transition } from './machines/meetRequest';
import { assertCanAgree, assertCanCallOff, PlanRefusedError } from './machines/plan';
import { messagesFor } from './log';
import { revokeClaimByPolicy, transitionClaim, transitionRide } from './machines/rideSeat';
import { canClaim, type RideViewer } from './rides/eligibility';
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
// intact; v1 and earlier are discarded. v4 → v5: the intent profile gains
// interests, seeking, offering and the open switch, and the women_only
// preset becomes the meet preference.
export const STORE_VERSION = 7;

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
export type BoardLens = 'all' | 'same_flight' | 'same_airport' | 'same_event' | 'shared_cars';

export interface BoardFilters {
  /**
   * For you, same flight, same airport, same event, shared cars. The first row
   * on Discover.
   *
   * `shared_cars` is the one lens that changes *what kind of thing* the board
   * lists rather than which people it lists — a car is not a person, so the
   * board renders ride cards under it. Kept in the same control anyway,
   * because "why am I seeing this" is the question the row answers and a car
   * going your way is an answer to it.
   */
  lens: BoardLens;
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
  lens: 'all',
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
   * Shared cars — hosted by you, or with a seat you asked for.
   *
   * Seat claims are facts and persist; whether a given car is *visible* to a
   * given person is not, and is recomputed on every read in
   * `selectors/rides.ts`. A cached visibility verdict is how a car that was
   * made women-only keeps a seat held by someone the new rule excludes.
   */
  rides: Ride[];
  /**
   * Where you have said you are, per trip. Yours alone until you share it.
   *
   * Not derived from the clock, deliberately — see the note on the persisted
   * slice. Rule 2 is satisfied either way: this is something you said, not
   * something computed, so storing it is storing a fact.
   */
  tripStages: Record<string, StageUpdate>;
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
  /** Who you want to meet. Symmetric by construction: writes both halves. */
  setMeetPreference: (genders: Gender[] | 'any') => void;
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
  /**
   * Say yes to a suggested time in a meet room.
   *
   * Throws if the rules in `domain/plan.ts` refuse it — your own suggestion, a
   * time that has started, one a newer suggestion replaced. The plan is then
   * whatever the log says; nothing else is written.
   */
  agreeTo: (channelId: string, proposalId: string) => void;
  /** Call off the plan that stands. Either of you can; the room stays open. */
  callOffPlan: (channelId: string) => void;
  /** A group inside a circle, with an explicit member list. */
  openGroup: (circleId: string, title: string, memberIds: PersonId[]) => Channel;

  /* ── Shared cars ──────────────────────────────────────────────────────── */

  /** Offer a car on one of your trips. Returns it, so the caller can link to it. */
  hostRide: (input: HostRideInput) => Ride;
  /**
   * Ask for a seat — or take one outright.
   *
   * Which of the two depends on the car's door and nothing else: a circle or
   * link car seats you (those people were admitted to something already), an
   * open car raises a request for the host to confirm. The decision lives in
   * `seatsAutomatically()` in the domain so no caller can make it differently.
   */
  claimSeat: (rideId: string, opts?: { note?: string; code?: string }) => void;
  /** Host: yes to a pending seat. */
  confirmSeat: (rideId: string, personId: PersonId) => void;
  /** Host: no. The claimant is told only that it closed. */
  declineSeat: (rideId: string, personId: PersonId) => void;
  /** Passenger: pull out, whether asked-for or already confirmed. */
  withdrawSeat: (rideId: string) => void;
  /**
   * Host: take back a seat you already granted.
   *
   * Separate from `declineSeat`, which refuses one that was only ever asked
   * for. A host who changes her mind about somebody she already said yes to is
   * the case a shared car most needs to support — you cannot get out of a
   * moving taxi — and collapsing the two would have hidden it.
   */
  removeSeat: (rideId: string, personId: PersonId) => void;
  /** Host: call the whole car off. */
  cancelRide: (rideId: string) => void;
  /** A line in the car's room, when it has one — the host's own fixed sentences only. */
  carLine: (rideId: string, text: string) => void;
  /** A seat changed. Structured, and rendered by each reader — see `SeatChange`. */
  seatLine: (rideId: string, personId: PersonId, change: SeatChange) => void;
  /** Host: what the whole car should cost, or null to take the estimate back. */
  setRideFare: (rideId: string, fare: RideFare | null) => void;
  /** Host: the exact spot and the car, for the people in it. Empty clears it. */
  setPickupNote: (rideId: string, note: string) => void;
  /** Open or refresh the car's group room. Called for you when a seat lands. */
  openRideRoom: (rideId: string) => void;

  /** Say where you are on a trip. Private until you tell a car. */
  setTripStage: (tripId: string, stage: JourneyStage, terminal?: string) => void;
  /** Take it back — the rail is a claim about yourself, not a log. */
  clearTripStage: (tripId: string) => void;
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
  /**
   * Demo only: the seeded person you said hello to says yes.
   *
   * Nobody is on the other end of a demo, so without this the sender's half of
   * the product — waiting, a yes arriving, the room opening — was unreachable.
   * It goes through the request FSM like any other answer. In a real account it
   * does nothing, because there nobody has answered.
   */
  answerDemoRequest: (requestId: string) => void;
  advanceRequest: (id: string, to: MeetRequestStatus, by: PersonId | 'system', note?: string) => void;
  denyRequest: (id: string, denial: DenialRecord) => void;
  blockPerson: (id: PersonId) => void;
  reset: () => void;
}


/**
 * Minted once per install. The store is the impure edge, so a random id is
 * fine here — the engines never generate one.
 */
const mintDeviceId = () => crypto.randomUUID();

/** The persisted facts, as the pure reducers see them. */
/**
 * What a screen has to supply to offer a car.
 *
 * Narrower than a `Ride` on purpose: the id, the claims, the history, the
 * status and the expiry are all the store's business, and a screen that could
 * set them could write a car that had already departed with four passengers.
 */
export interface HostRideInput {
  tripId: TripId;
  direction: RideDirection;
  airportIata: IataCode;
  point: RidePoint;
  window: TimeWindow;
  seatsTotal: number;
  audience: RideAudience;
  fareSplit?: Ride['fareSplit'];
  fare?: RideFare;
  pickupNote?: string;
}

/**
 * A name as other people will read it.
 *
 * Normalised, stripped of zero-width and control characters, whitespace
 * collapsed, capped. A name is shown in other people's rooms and on their
 * boards; an uncapped one could carry a paragraph, and a zero-width one made
 * a person anonymous.
 */
function cleanName(raw: string, max: number): string {
  const kept = Array.from(raw.normalize('NFKC'))
    .filter((ch) => !invisible(ch.codePointAt(0) ?? 0))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  // Capped by what a person sees, so an emoji is never cut in half.
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment: (s: string) => Iterable<{ segment: string }> } }).Segmenter;
  const parts = Seg ? Array.from(new Seg(undefined, { granularity: 'grapheme' }).segment(kept), (x) => x.segment) : Array.from(kept);
  return parts.slice(0, max).join('');
}

/**
 * Characters that print as nothing: controls, zero-width marks, direction
 * overrides, and the blank letters that pass for a name — the Hangul filler,
 * the braille blank, a soft hyphen alone.
 */
const invisible = (c: number): boolean =>
  c < 0x20 ||
  c === 0x7f ||
  c === 0xad ||
  c === 0x34f ||
  (c >= 0x115f && c <= 0x1160) ||
  (c >= 0x17b4 && c <= 0x17b5) ||
  (c >= 0x180b && c <= 0x180e) ||
  (c >= 0x200b && c <= 0x200f) ||
  (c >= 0x2028 && c <= 0x202e) ||
  (c >= 0x2060 && c <= 0x206f) ||
  c === 0x2800 ||
  c === 0x3164 ||
  c === 0xfeff ||
  c === 0xffa0;

const PLACE_KINDS: ReadonlySet<string> = new Set([
  'gate', 'lounge', 'terminal_landmark', 'cafe', 'restaurant', 'taxi_rank', 'station', 'hotel_lobby', 'pickup_point',
]);

/** The next message id. The simulated clock does not move, so the count keeps them apart. */
const messageId = (count: number, now: ISODateTime) => asMessageId('m_' + (count + 1) + '_' + Date.parse(String(now)));

/**
 * Whether this is a meet room you are in: a `meet:` room whose request is
 * accepted and has you on one side. A yes in anyone else's room, or in a car's
 * — whose time the host sets — is refused before the log is even read.
 */
function isMyMeetRoom(s: Pick<WingmanState, 'requests' | 'me'>, channelId: string): boolean {
  if (!channelId.startsWith('meet:')) return false;
  const r = s.requests.find((x) => String(meetChannelId(x.id)) === channelId);
  return Boolean(r && r.status === 'accepted' && (r.fromPersonId === s.me.id || r.toPersonId === s.me.id));
}

/** The two people a meet room belongs to. */
function roomPeople(s: Pick<WingmanState, 'requests'>, channelId: string): PersonId[] {
  const r = s.requests.find((x) => String(meetChannelId(x.id)) === channelId);
  return r ? [r.fromPersonId, r.toPersonId] : [];
}

/** A six-character key for a link-only car, in the circle-invite format. */
const rideCodeFrom = (seed: string): string => codeFromSeed(`ride:${seed}`);

/** The viewer, as the ride eligibility rules want them. */
const rideViewer = (s: WingmanState): RideViewer => ({
  me: s.me,
  myCircleIds: s.me.memberships.filter((m) => m.display !== 'paused').map((m) => String(m.circleId)),
  now: s.now,
  // Only your own cars' codes are yours by default; a code someone sent you
  // arrives through the link route and is passed to `claimSeat` explicitly.
  heldCodes: s.rides
    .filter((r) => r.inviteCode && String(r.hostPersonId) === String(s.me.id))
    .map((r) => String(r.inviteCode)),
});

/**
 * Move one person's seat, leaving every other seat and the car untouched.
 *
 * Returns the rides list unchanged when the move is not the caller's to make or
 * the FSM would refuse it. Silence rather than a throw, because these are
 * called straight from buttons: a host double-tapping "confirm" on a seat that
 * is already confirmed should do nothing, not crash the screen.
 */
function mapClaim(
  s: WingmanState,
  rideId: string,
  personId: PersonId,
  to: RideClaim['status'],
  by: PersonId,
): Ride[] {
  const ride = s.rides.find((r) => String(r.id) === rideId);
  if (!ride) return s.rides;

  // Only the host settles somebody else's seat; only you withdraw your own.
  // `removed_by_host` is deliberately on the host side of that line even
  // though it ends the same seat `withdrawn` would: who ended it is the fact
  // worth keeping, and the passenger is told only that it closed.
  const hostActing = String(ride.hostPersonId) === String(by);
  const ownSeat = String(personId) === String(by);
  if (to === 'withdrawn' ? !ownSeat : !hostActing) return s.rides;

  // The newest claim: a person may have asked, left and asked again.
  const claim = latestClaim(ride, personId);
  if (!claim) return s.rides;

  let moved: RideClaim;
  try {
    moved = transitionClaim(claim, { to, by, at: s.now });
  } catch {
    // An illegal move means the UI is showing a stale state; the FSM refusing
    // it is the system working. Leave the store as it was.
    return s.rides;
  }

  // That claim and only that one — matching on the person replaced every
  // claim they had ever made with the new one.
  const claims = ride.claims.map((c) => (c === claim ? moved : c));
  return s.rides.map((r) => (String(r.id) === rideId ? { ...r, claims } : r));
}

const slice = (s: WingmanState): PersistedSlice => ({
  me: s.me,
  myTrips: s.myTrips,
  requests: s.requests,
  rides: s.rides,
  tripStages: s.tripStages,
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

      setMe: (patch) =>
        set((s) => ({
          me: {
            ...s.me,
            ...patch,
            // A name that cleans to nothing keeps the one you had: a blank name
            // is an anonymous line in someone else's car.
            ...(patch.firstName !== undefined ? { firstName: cleanName(patch.firstName, 30) || s.me.firstName } : {}),
            ...(patch.displayName !== undefined ? { displayName: cleanName(patch.displayName, 60) || s.me.displayName } : {}),
          },
        })),

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

      setMeetPreference: (genders) =>
        set((s) => ({ me: { ...s.me, privacy: withMeetPreference(s.me.privacy, genders) } })),

      upsertTrip: (trip) =>
        set((s) => ({
          myTrips: s.myTrips.some((t) => t.id === trip.id)
            ? s.myTrips.map((t) => (t.id === trip.id ? trip : t))
            : [...s.myTrips, trip],
        })),

      removeTrip: (tripId) => {
        /*
         * A car hangs off a trip. Removing the trip used to leave its car live:
         * gone from Trips, still taking requests on Home and in the inbox, and
         * nobody in it told. The car is called off first, which tells them.
         */
        for (const r of get().rides) {
          // Only a car still to come: "calling off" one that already happened
          // told its riders something false and took their rating tools away.
          if (
            String(r.tripId) === tripId &&
            String(r.hostPersonId) === String(get().me.id) &&
            (r.status === 'open' || r.status === 'confirmed') &&
            String(get().now) < String(r.expiresAt)
          ) {
            get().cancelRide(String(r.id));
          }
        }
        set((s) => ({ myTrips: s.myTrips.filter((t) => String(t.id) !== tripId) }));
      },

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
          // Seat changes and system notices are written by the actions that
          // own them, never through `post` — otherwise anyone's client could
          // say "Priya is no longer in the car." in any room.
          if (b.kind === 'seat' || b.kind === 'system') return s;
          if (b.kind === 'proposal') {
            if (looksLikeAddress(b.placeLabel)) return s;
            if (b.placeKind && !PLACE_KINDS.has(b.placeKind)) return s;
            // Twelve open suggestions from one person is a conversation that
            // should be happening in person; a hundred is a flood.
            const mineHere = s.messages.filter(
              (m) => m.channelId === channel.id && m.from === s.me.id && m.body.kind === 'proposal',
            ).length;
            if (mineHere >= 12) return s;
          }
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
          /*
           * A scripted yes to a suggested time, for the same reason. It passes
           * the same `canAgree` the real write does, so the demo cannot produce
           * a plan the app would have refused.
           */
          if (b.kind === 'proposal' && s.account.mode === 'demo' && channel.kind === 'meet') {
            const other = channel.memberIds.find((id) => id !== s.me.id);
            if (other && canAgree(messagesFor(channel.id, out), String(mine.id), other, s.now) === null) {
              out.push({
                id: messageId(out.length, s.now),
                channelId: channel.id,
                from: other,
                at: s.now,
                body: { kind: 'agreed', proposalId: mine.id },
              });
            }
          }
          return { messages: out, readAt: { ...s.readAt, [String(channel.id)]: s.now } };
        }),

      agreeTo: (channelId, proposalId) => {
        const s = get();
        if (!isMyMeetRoom(s, channelId)) throw new PlanRefusedError('not_a_meet');
        assertCanAgree(messagesFor(channelId, s.messages), proposalId, s.me.id, s.now, roomPeople(s, channelId));
        set({
          messages: [
            ...s.messages,
            {
              id: messageId(s.messages.length, s.now),
              channelId: asChannelId(channelId),
              from: s.me.id,
              at: s.now,
              body: { kind: 'agreed', proposalId: asMessageId(proposalId) },
            },
          ],
          readAt: { ...s.readAt, [channelId]: s.now },
        });
      },

      callOffPlan: (channelId) => {
        const s = get();
        if (!isMyMeetRoom(s, channelId)) throw new PlanRefusedError('not_a_meet');
        const log = messagesFor(channelId, s.messages);
        const people = roomPeople(s, channelId);
        const plan = agreedPlan(log, people);
        if (!plan) throw new PlanRefusedError('no_plan');
        assertCanCallOff(log, String(plan.proposal.id), people);
        const request = s.requests.find((x) => String(meetChannelId(x.id)) === channelId);
        const other = request && (request.fromPersonId === s.me.id ? request.toPersonId : request.fromPersonId);
        set({
          messages: [
            ...s.messages,
            {
              id: messageId(s.messages.length, s.now),
              channelId: asChannelId(channelId),
              from: s.me.id,
              at: s.now,
              body: { kind: 'plan_off', proposalId: plan.proposal.id },
            },
          ],
          readAt: { ...s.readAt, [channelId]: s.now },
          // The trip this meet settled is open again: Home and Trips said
          // "Sorted · You are meeting Priya" about a meet that was off.
          myTrips: s.myTrips.map((t) => {
            if (!request || String(t.id) !== String(request.tripId)) return t;
            if (!t.outcome || String(t.outcome.settledWith) !== String(other)) return t;
            const next = { ...t };
            delete next.outcome;
            return next;
          }),
        });
      },

      hostRide: (input) => {
        const s = get();
        const ride = makeRide({
          id: asRideId(`ride_${Date.parse(String(s.now))}_${s.rides.length + 1}`),
          hostPersonId: s.me.id,
          tripId: input.tripId,
          direction: input.direction,
          airportIata: input.airportIata,
          point: input.point,
          window: input.window,
          seatsTotal: input.seatsTotal,
          audience: input.audience,
          createdAt: s.now,
          ...(input.fareSplit ? { fareSplit: input.fareSplit } : {}),
          ...(input.fare ? { fare: input.fare } : {}),
          ...(input.pickupNote ? { pickupNote: input.pickupNote } : {}),
          // A link car needs a link. Derived from the id rather than random,
          // because ESLint bans Math.random() in the engines and a code you
          // cannot reproduce from state is a code you cannot test.
          ...(input.audience.kind === 'invite'
            ? { inviteCode: rideCodeFrom(String(Date.parse(String(s.now))) + String(s.rides.length + 1)) }
            : {}),
        });
        set({ rides: [...s.rides, ride] });
        return ride;
      },

      claimSeat: (rideId, opts) => {
        const s = get();
        const ride = s.rides.find((r) => String(r.id) === rideId);
        if (!ride) return;
        const note = opts?.note;
        // A code followed from a link is the credential for a link-only car.
        // Passed in explicitly rather than inferred from what happens to be on
        // the device: "this car is here" and "I was given its link" are not
        // the same fact, and conflating them would open every link car to
        // anyone who ever received one.
        const viewer = opts?.code
          ? { ...rideViewer(s), heldCodes: [...(rideViewer(s).heldCodes ?? []), opts.code.toUpperCase()] }
          : rideViewer(s);
        // The same question the screen asked before offering the button. If
        // the two ever disagree, this is the side that must win.
        if (!canClaim(ride, viewer)) return;

        const seated = seatsAutomatically(ride.audience);
        const claim: RideClaim = {
          personId: s.me.id,
          status: 'requested',
          askedAt: s.now,
          history: [],
          ...(note ? { note: note.slice(0, 200) } : {}),
        };
        const settled = seated
          ? transitionClaim(claim, { to: 'confirmed', by: 'system', at: s.now })
          : claim;
        const next = { ...ride, claims: [...ride.claims, settled] };
        set({ rides: s.rides.map((r) => (String(r.id) === rideId ? next : r)) });
        if (seated) {
          get().openRideRoom(rideId);
          // A self-seating door skips the host's yes; it must not also skip the
          // host knowing. The room is where everyone in the car already looks.
          get().seatLine(rideId, s.me.id, 'took');
        }
      },

      confirmSeat: (rideId, personId) => {
        // Only seats that exist. Confirming counted nothing, so a host could say
        // yes to more people than the car holds.
        const car = get().rides.find((r) => String(r.id) === rideId);
        if (!car || seatsLeft(car) === 0) return;
        const before = get().rides;
        set((s) => ({ rides: mapClaim(s, rideId, personId, 'confirmed', s.me.id) }));
        // Nothing moved (not the host, a stale tap): say nothing either.
        if (get().rides === before) return;
        // A confirmed seat means the car holds more than its host, which is
        // the condition the room exists for. Idempotent, so confirming a
        // second passenger refreshes the member list rather than opening a
        // second room.
        get().openRideRoom(rideId);
        get().seatLine(rideId, personId, 'in');
      },

      declineSeat: (rideId, personId) =>
        set((s) => ({ rides: mapClaim(s, rideId, personId, 'declined', s.me.id) })),

      withdrawSeat: (rideId) => {
        const s = get();
        const was = s.rides.find((r) => String(r.id) === rideId);
        const wasIn = was ? latestClaim(was, s.me.id)?.status === 'confirmed' : false;
        // Said before the seat goes: afterwards you are not in the room.
        if (wasIn) get().seatLine(rideId, s.me.id, 'out');
        set((st) => ({ rides: mapClaim(st, rideId, st.me.id, 'withdrawn', st.me.id) }));
      },

      removeSeat: (rideId, personId) => {
        // The same line as leaving, on purpose: the others learn the seat is
        // free, not who ended it — the passenger is only told it closed. Said
        // before the seat goes, and only if it is really going.
        const car = get().rides.find((r) => String(r.id) === rideId);
        const hosting = car && String(car.hostPersonId) === String(get().me.id);
        if (!hosting || latestClaim(car, personId)?.status !== 'confirmed') return;
        get().seatLine(rideId, personId, 'out');
        set((s) => ({ rides: mapClaim(s, rideId, personId, 'removed_by_host', s.me.id) }));
      },

      seatLine: (rideId, personId, change) => {
        const s = get();
        const room = rideChannelId(rideId);
        if (!s.channels.some((c) => c.id === room)) return;
        set({
          messages: [
            ...s.messages,
            {
              id: messageId(s.messages.length, s.now),
              channelId: room,
              // The person the line is about — never the person who caused it,
              // so the log cannot say who removed whom.
              from: personId,
              at: s.now,
              body: { kind: 'seat', change },
            },
          ],
        });
      },

      carLine: (rideId, text) => {
        const s = get();
        const room = rideChannelId(rideId);
        if (!s.channels.some((c) => c.id === room)) return;
        set({
          messages: [
            ...s.messages,
            {
              id: messageId(s.messages.length, s.now),
              channelId: room,
              from: s.me.id,
              at: s.now,
              body: { kind: 'system', text },
            },
          ],
        });
      },

      cancelRide: (rideId) =>
        set((s) => {
          const ride = s.rides.find((r) => String(r.id) === rideId);
          if (!ride || String(ride.hostPersonId) !== String(s.me.id)) return {};
          const cancelled = transitionRide(ride, { to: 'cancelled', by: s.me.id, at: s.now });
          // Every live seat dies with the car. Leaving one confirmed would be a
          // person standing at a rank waiting for a car nobody is driving.
          const claims = cancelled.claims.map((c) =>
            c.status === 'requested' || c.status === 'confirmed'
              ? // By the host: `roomMembers` keeps the riders a call-off ended,
                // and tells them from a seat a hide ended by who wrote it.
                transitionClaim(c, { to: 'revoked_by_policy', by: s.me.id, at: s.now })
              : c,
          );
          // The car screen promises the riders are told. They are, in the one
          // place they are all already looking.
          const room = rideChannelId(rideId);
          const told = s.channels.some((c) => c.id === room)
            ? [
                ...s.messages,
                {
                  id: messageId(s.messages.length, s.now),
                  channelId: room,
                  from: s.me.id,
                  at: s.now,
                  body: { kind: 'system' as const, text: 'The car was called off. Every seat in it has ended.' },
                },
              ]
            : s.messages;
          return {
            rides: s.rides.map((r) => (String(r.id) === rideId ? { ...cancelled, claims } : r)),
            messages: told,
          };
        }),

      setRideFare: (rideId, fare) => {
        const s = get();
        const ride = s.rides.find((r) => String(r.id) === rideId);
        if (!ride) return;
        if (String(ride.hostPersonId) !== String(s.me.id)) {
          throw new Error('Only the host states what the car should cost.');
        }
        if (fare) assertFare(fare);
        const next: Ride = { ...ride };
        delete next.fare;
        const same =
          (fare?.amountMinor ?? null) === (ride.fare?.amountMinor ?? null) &&
          (fare?.currency ?? null) === (ride.fare?.currency ?? null);
        set({
          rides: s.rides.map((r) =>
            r === ride ? (fare ? { ...next, fare: { amountMinor: fare.amountMinor, currency: fare.currency } } : next) : r,
          ),
        });
        // People already in the car agreed to one number. A different one is
        // said where they will see it, not changed underneath them.
        if (!same && (ride.fare || riders(ride).length > 1)) {
          get().carLine(
            rideId,
            fare
              ? `${ride.fare ? 'The host changed the estimate to' : 'The host estimates'} about ${Math.round(fare.amountMinor / 100)} ${fare.currency} for the car.`
              : 'The host took the fare estimate down.',
          );
        }
      },

      setPickupNote: (rideId, note) => {
        const s = get();
        const ride = s.rides.find((r) => String(r.id) === rideId);
        if (!ride) return;
        if (String(ride.hostPersonId) !== String(s.me.id)) {
          throw new Error('Only the host says where the car is.');
        }
        const text = note.trim();
        if (text.length > PICKUP_NOTE_CAP) {
          throw new Error(`A pickup note is at most ${PICKUP_NOTE_CAP} characters.`);
        }
        if (looksLikeAddress(text)) {
          throw new Error('A pickup note names a public spot, never an address.');
        }
        if ((ride.pickupNote ?? '') === text) return;
        const next: Ride = { ...ride };
        delete next.pickupNote;
        const room = rideChannelId(rideId);
        /*
         * The note itself lives on the car, shown to the people in it. The room
         * gets a line saying it changed — not the note — so the inbox lights up
         * for the riders without the text being copied somewhere a later edit
         * would leave stale.
         */
        const inRoom = s.channels.some((c) => c.id === room);
        set({
          rides: s.rides.map((r) => (r === ride ? (text ? { ...next, pickupNote: text } : next) : r)),
          ...(inRoom
            ? {
                messages: [
                  ...s.messages,
                  {
                    id: messageId(s.messages.length, s.now),
                    channelId: room,
                    from: s.me.id,
                    at: s.now,
                    body: {
                      kind: 'system' as const,
                      text: text ? 'The host updated where to meet the car.' : 'The host took the pickup details down.',
                    },
                  },
                ],
              }
            : {}),
        });
      },

      /**
       * The car's room, opened once it holds more than its host.
       *
       * A `'group'` channel, not a new `ChannelKind`: the kind already exists,
       * already carries a member list, and already renders "N people".
       */
      setTripStage: (tripId, stage, terminal) =>
        set((s) => ({
          tripStages: {
            ...s.tripStages,
            [tripId]: { stage, at: s.now, ...(terminal ? { terminal } : {}) },
          },
        })),

      clearTripStage: (tripId) =>
        set((s) => {
          const next = { ...s.tripStages };
          delete next[tripId];
          return { tripStages: next };
        }),

      openRideRoom: (rideId) => {
        const s = get();
        const ride = s.rides.find((r) => String(r.id) === rideId);
        if (!ride) return;
        const members = riders(ride);
        if (members.length < 2) return;
        const existing = s.channels.find((c) => c.id === rideChannelId(rideId));
        const route = rideRoute(ride);
        if (existing) {
          set({
            channels: s.channels.map((c) =>
              c.id === existing.id ? { ...c, memberIds: [...new Set(members)] } : c,
            ),
          });
          return;
        }
        const channel: Channel = {
          id: rideChannelId(rideId),
          kind: 'group',
          title: `${route.from} → ${route.to}`.slice(0, 40),
          memberIds: [...new Set(members)],
          createdBy: ride.hostPersonId,
          createdAt: s.now,
        };
        set({ channels: [...s.channels, channel] });
      },

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
        const meetId = meetIdForChannel(channelId);
        // A guardian watches a meet. A circle's General is not one.
        if (!meetId) return;
        const session = armGuardian({
          id: asGuardianSessionId('g_' + Date.parse(String(s.now))),
          meetId,
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
        set((s) => {
          const meetId = meetIdForChannel(channelId);
          if (!meetId) return {};
          // Only a meet you are in, about someone who was in it with you.
          const inMeet = channelId.startsWith('meet:')
            ? isMyMeetRoom(s, channelId) && roomPeople(s, channelId).some((p) => String(p) === String(rateeId))
            : (() => {
                const car = s.rides.find((r) => String(rideChannelId(String(r.id))) === channelId);
                const people = car ? roomMembers(car).map(String) : [];
                return people.includes(String(s.me.id)) && people.includes(String(rateeId));
              })();
          if (!inMeet) return {};
          return {
          ratings: [
            // Per person, not per meet: in a car you rate each rider, and
            // replacing every rating for the meet erased the one before.
            // Yours of them, and nothing else: another person's rating of the
            // same someone is theirs, not yours to replace.
            ...s.ratings.filter((r) => !(r.meetId === meetId && r.rateeId === rateeId && r.raterId === s.me.id)),
            {
              id: asRatingId('rt_' + String(meetId) + '_' + String(rateeId) + '_' + Date.parse(String(s.now))),
              meetId,
              raterId: s.me.id,
              rateeId,
              submittedAt: s.now,
              ...input,
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
          // Random, at the impure edge. A module counter reset on every page
          // load while the simulated clock stood still, so two requests could
          // share an id — and one demo yes accepted two different people.
          id: asMeetRequestId(`req_${crypto.randomUUID().slice(0, 12)}_${Date.parse(now)}`),
          status: 'draft',
          history: [],
          createdAt: now,
        };
        const sent = transition(request, { to: 'sent', by: get().me.id, at: now });
        set((s) => ({ requests: [...s.requests, sent] }));
        return sent;
      },

      answerDemoRequest: (requestId) => {
        const s = get();
        if (s.account.mode !== 'demo') return;
        const r = s.requests.find((x) => String(x.id) === requestId);
        if (!r || r.fromPersonId !== s.me.id) return;
        if (r.status !== 'sent' && r.status !== 'viewed') return;
        if (String(s.now) >= String(r.expiresAt)) return;
        if (r.status === 'sent') get().advanceRequest(requestId, 'viewed', r.toPersonId);
        get().advanceRequest(requestId, 'accepted', r.toPersonId);
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
                id: messageId(s.messages.length, s.now),
                channelId: meetChannelId(accepted.id),
                from: s.me.id,
                at: s.now,
                body: {
                  kind: 'system' as const,
                  text: 'You both said yes. Nothing else is shared until you choose to.',
                },
              },
              /*
               * Demo only: they open with a time, so the first room anyone
               * opens has something to say yes to. See `scriptedProposal`.
               */
              ...(s.account.mode === 'demo'
                ? [
                    {
                      id: messageId(s.messages.length + 1, s.now),
                      channelId: meetChannelId(accepted.id),
                      from: other,
                      at: s.now,
                      body: scriptedProposal(accepted, s.now),
                    },
                  ]
                : []),
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

      blockPerson: (id) => {
        /*
         * In a car, leaving, removal and a called-off car all say a line in the
         * room. A hide used to end the seat silently — so a silent disappearance
         * could only mean a hide. It says the same neutral line now, before the
         * seat goes (afterwards the room would not hold the right people).
         */
        for (const ride of get().rides) {
          if (ride.status === 'cancelled') continue;
          const theirSeatInMine =
            String(ride.hostPersonId) === String(get().me.id) && latestClaim(ride, id)?.status === 'confirmed';
          const mySeatInTheirs =
            String(ride.hostPersonId) === String(id) && latestClaim(ride, get().me.id)?.status === 'confirmed';
          if (theirSeatInMine) get().seatLine(String(ride.id), id, 'out');
          if (mySeatInTheirs) get().seatLine(String(ride.id), get().me.id, 'out');
        }
        set((s) => ({
          me: { ...s.me, blocked: [...new Set([...s.me.blocked, id])] },
          /*
           * A trip settled with them is not settled any more: Home said "You are
           * meeting Jonas on this one" about someone you had just hidden, and the
           * board stayed closed on a meet that was off.
           */
          myTrips: s.myTrips.map((t) => {
            if (!t.outcome || String(t.outcome.settledWith) !== String(id)) return t;
            const next = { ...t };
            delete next.outcome;
            return next;
          }),
          /*
           * A plan with them comes off. Hiding someone used to leave the agreed
           * time and place standing — on their side a meet you no longer
           * intend to keep. Calling it off is what a person would do, and it
           * says nothing about why: "called it off" is not "hid you".
           */
          messages: [
            ...s.messages,
            ...s.requests.flatMap((r) => {
              if (r.status !== 'accepted') return [];
              if (r.fromPersonId !== id && r.toPersonId !== id) return [];
              const room = meetChannelId(r.id);
              const plan = agreedPlan(messagesFor(room, s.messages), [r.fromPersonId, r.toPersonId]);
              if (!plan) return [];
              return [{ room, proposalId: plan.proposal.id }];
            }).map((x, k) => ({
              // Numbered from the end of the log, one each: numbering by the
              // request's index minted an id the next message then reused.
              id: messageId(s.messages.length + k, s.now),
              channelId: x.room,
              from: s.me.id,
              at: s.now,
              body: { kind: 'plan_off' as const, proposalId: x.proposalId },
            })),
          ],
          // Any live request between you dies with the block.
          requests: s.requests.map((r) =>
            (r.fromPersonId === id || r.toPersonId === id) &&
            !['accepted', 'denied', 'withdrawn', 'expired', 'revoked_by_policy'].includes(r.status)
              ? transition(r, { to: 'revoked_by_policy', by: 'system', at: s.now })
              : r,
          ),
          /*
           * And any seat between you, in either direction.
           *
           * `revokeClaimByPolicy()` was written for exactly this and had no
           * caller anywhere — the sweep here stopped at `requests`, so blocking
           * someone left them sitting in your car and you in theirs. A block
           * that does not reach the one meet you cannot walk out of is not a
           * block.
           */
          rides: s.rides.map((ride) => {
            const hostIsThem = String(ride.hostPersonId) === String(id);
            const mineHosted = String(ride.hostPersonId) === String(s.me.id);
            if (!hostIsThem && !mineHosted) return ride;
            return {
              ...ride,
              claims: ride.claims.map((c) => {
                const involvesThem = String(c.personId) === String(id);
                const involvesMe = String(c.personId) === String(s.me.id);
                // Their seat in my car, or my seat in theirs.
                if ((mineHosted && involvesThem) || (hostIsThem && involvesMe)) {
                  return revokeClaimByPolicy(c, s.now);
                }
                return c;
              }),
            };
          }),
        }));
      },

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
      /*
       * What gets written, via `slice()` rather than a second list.
       *
       * This used to be its own hand-maintained object naming all sixteen
       * fields, which meant the app had two lists that had to agree and no
       * mechanism to make them. Adding the `rides` slice proved the point: it
       * went into `slice()`, not into here, so shared cars worked perfectly
       * until the first page reload and then silently were not there. Nothing
       * failed — the data was simply never written.
       *
       * `slice()` returns `PersistedSlice`, so the compiler now enforces what
       * a comment used to ask for.
       *
       * `filters` is absent on purpose, and that is the one real difference
       * from the whole state: it is a lens on this session, not a durable
       * fact, and reopening the app to a board silently narrowed by a filter
       * set last week is indistinguishable from a broken product.
       */
      partialize: (s) => slice(s),
      migrate: (persisted, version) =>
        migratePersisted(persisted, version, mintDeviceId, SEED_NOW) as never,
    },
  ),
);

/** Reset helper for tests and the dev menu. Yields a fresh install. */
export const resetStore = () => useStore.getState().reset();

export const nowOf = (): ISODateTime => useStore.getState().now ?? asUtc(SEED_NOW);
