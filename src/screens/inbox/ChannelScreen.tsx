import { useEffect, useRef, useState } from 'react';
import { Avatar } from '@design/primitives/Avatar';
import { Button } from '@design/primitives/Button';
import { Chip } from '@design/primitives/Chip';
import { Menu } from '@design/primitives/Menu';
import { Sheet } from '@design/primitives/Sheet';
import type { IanaZone, Message, PersonId } from '@domain/index';
import { TEXT_CAP, isRedacted, localTime, looksLikeAddress, meetForRide } from '@domain/index';
import { buildVCard } from '@lib/vcard';
import { STAGE_COPY, stagesFor } from '@data/copy/stages';
import { PLAN_COPY } from '@data/copy/plans';
import { airportIndex } from '@data/airports/index';
import { isLive } from '@privacy/index';
import { bucketPhrase } from '@lib/bucket';
import { authorName, latestProgress, useChannel, type Participant } from '@state/selectors/channel';
import { usePlanForChannel, type ProposalState } from '@state/selectors/plans';
import { useRideForChannel } from '@state/selectors/rides';
import { useStore } from '@state/store';
import { PersonMenu } from '@screens/safety/PersonMenu';
import { ReportSheet } from '@screens/safety/ReportSheet';
import { GuardianSheet } from '@screens/safety/GuardianSheet';
import { AfterMeetSheet } from '@screens/safety/AfterMeetSheet';
import { takeArriving } from './arrive';
import { ProposeSheet, type ProposalDraft } from './ProposeSheet';
import { MEET_KIND_LABEL } from '@data/copy/meetKinds';
import { buildIcs } from '@lib/ics';
import { fareCopy } from '@screens/rides/fareCopy';
import { seatLineText } from '@data/copy/rides';
import { windowLabel } from '@screens/whenLabel';

/**
 * One conversation — a meet room, a circle's General, or a group.
 *
 * A meet leads with where each of you is and a row of one-tap updates; free
 * text sits underneath because naming a landmark needs words, but a blank
 * box at the top would invite a conversation that should be happening in
 * person twenty minutes later. A circle leads with the organiser's pin. A
 * group is the circle layout without it.
 *
 * A meet's whole job is to turn a yes into a time and a place. The agreed plan
 * sits at the top once there is one — derived from the log, never stored — and
 * it moves only when the other person says yes to a different time.
 */
export function ChannelScreen({ channelId, onBack }: { channelId: string; onBack: () => void }) {
  const view = useChannel(channelId);
  const me = useStore((s) => s.me);
  const post = useStore((s) => s.post);
  const agreeTo = useStore((s) => s.agreeTo);
  const callOffPlan = useStore((s) => s.callOffPlan);
  const markRead = useStore((s) => s.markRead);
  const muted = useStore((s) => s.muted);
  const muteChannel = useStore((s) => s.muteChannel);
  const unmuteChannel = useStore((s) => s.unmuteChannel);
  const guardian = useStore((s) => s.guardian);
  const checkOut = useStore((s) => s.checkOut);
  const now = useStore((s) => s.now);
  const [draft, setDraft] = useState('');
  const [reporting, setReporting] = useState<Message | null>(null);
  const [guarding, setGuarding] = useState(false);
  const [afterMeet, setAfterMeet] = useState<Participant | null>(null);
  const [choosingRider, setChoosingRider] = useState(false);
  const [proposing, setProposing] = useState(false);
  const [callingOff, setCallingOff] = useState(false);
  const [cantSheet, setCantSheet] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const log = useRef<HTMLOListElement>(null);
  // Taken once, on the first render of a room you have just said yes to.
  const arrive = useRef(takeArriving(channelId)).current;
  const roomPlan = usePlanForChannel(channelId);
  /*
   * A car's room carries a persistent strip rather than a message about money.
   * The split is the one fact everybody in a shared cab wants and nobody wants
   * to raise, so the room states it and keeps stating it — and states equally
   * plainly that Wingman is not settling it.
   */
  const ride = useRideForChannel(channelId);

  const messageCount = view?.messages.length ?? 0;
  useEffect(() => {
    if (view) markRead(channelId);
    const last = log.current?.lastElementChild;
    if (last && typeof last.scrollIntoView === 'function') last.scrollIntoView({ block: 'end' });
  }, [channelId, messageCount, markRead, view]);

  if (!view) {
    return (
      <div className="empty">
        <h2 className="empty__title display">No room here</h2>
        <p className="empty__body">
          A room opens once you have both agreed to meet, or once you are in a circle. This one
          either has not opened, or has since closed.
        </p>
        <Button variant="secondary" onClick={onBack}>
          Back to inbox
        </Button>
      </div>
    );
  }

  const { channel, messages, mine, theirs, theirsCard, sameTerminal, circle } = view;
  const isMeet = channel.kind === 'meet';
  const isMuted = muted.includes(channelId);
  const watching = guardian && String(guardian.meetId) === channelId && isLive(guardian, now) ? guardian : null;
  const title = channel.kind === 'circle' && circle ? `${circle.shortName} · General` : channel.title;
  const plan = roomPlan?.plan ?? null;
  const carMeet = ride ? meetForRide(ride.ride) : null;
  const imInCar = ride ? ride.riders.some((id) => String(id) === String(me.id)) : false;

  /*
   * Local time, at the airport the room is about.
   *
   * This used to be `iso.slice(11, 16)` — the UTC clock. A coffee agreed for
   * 19:30 at Heathrow read "18:30" in summer, and the agreed time is the one
   * number in this room that has to be right.
   */
  const zone: IanaZone | undefined =
    (ride ? airportIndex.zone(ride.ride.airportIata) : undefined) ??
    (roomPlan?.meet?.place.airportIata ? airportIndex.zone(roomPlan.meet.place.airportIata) : undefined) ??
    (mine?.airportIata ? airportIndex.zone(mine.airportIata as never) : undefined) ??
    (roomPlan?.meet?.place.cityKey ? airportIndex.cityZone(roomPlan.meet.place.cityKey) : undefined);
  const clock = (iso: string): string => (zone ? localTime(iso as never, zone) : iso.slice(11, 16));

  const send = () => {
    // The room is where people say which end of the bar — and where an
    // address would be typed by habit. Stop it before it is sent, and say why.
    if (looksLikeAddress(draft)) {
      setDraftError('That reads like an address. Meet somewhere public, and name that instead.');
      return;
    }
    post(channel, { kind: 'text', text: draft });
    setDraft('');
    setDraftError(null);
  };

  const calendar = (m: { id: string; meetKind: keyof typeof MEET_KIND_LABEL; from: string; to: string; place: string }) => {
    const other = theirs?.firstName ?? 'them';
    const ics = buildIcs(
      {
        uid: `${m.id}@wingman`,
        title: `${MEET_KIND_LABEL[m.meetKind]} with ${other}`,
        start: m.from,
        end: m.to,
        location: m.place,
        description: 'Arranged through Wingman',
      },
      String(now),
    );
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wingman-meet.ics';
    a.click();
    URL.revokeObjectURL(url);
  };

  const planBody = plan?.proposal.body;
  const riders = view.participants.filter((p) => !p.isMe);

  /*
   * "Can't make it" after the yes.
   *
   * It is one tap, deliberately — and it used to leave the strip saying
   * "Agreed · 19:10" above it, so the room said two opposite things at once.
   * The strip now says it plainly and points at the way out.
   */
  let agreedAt = -1;
  if (plan) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const b = messages[i]!.body;
      if (b.kind === 'agreed' && b.proposalId === plan.proposal.id) {
        agreedAt = i;
        break;
      }
    }
  }
  const cantMakeIt = plan
    ? messages
        .slice(agreedAt + 1)
        .filter((m) => m.body.kind === 'stage' && m.body.stage === 'cannot_make_it')
        .map((m) => String(m.from))
    : [];
  const iCant = cantMakeIt.includes(String(me.id));
  const theyCant = theirs ? cantMakeIt.includes(String(theirs.id)) : false;

  return (
    <article className="room">
      <header className="room__head">
        <button className="person__back" onClick={onBack} type="button">
          ← Inbox
        </button>
        <h2 className="room__title display">{title}</h2>
        {isMeet && theirs ? (
          <PersonMenu personId={theirs.id as PersonId} firstName={theirs.firstName} channelId={channelId} onHidden={onBack} />
        ) : (
          <Menu
            items={[
              { label: isMuted ? 'Unmute' : 'Mute', onClick: () => (isMuted ? unmuteChannel(channelId) : muteChannel(channelId)) },
            ]}
          />
        )}
      </header>

      {channel.kind !== 'meet' && (
        <p className="room__members mono">
          {channel.kind === 'circle' && circle
            ? bucketPhrase(circle.memberCount, 'member', 'members')
            : `${view.participants.length} people`}
          {isMuted && ' · muted'}
        </p>
      )}

      {ride && (
        <section className="room__fare" aria-label="The car">
          <a className="room__farelabel" href={`#/car/${String(ride.ride.id)}`}>
            {ride.route.from} → {ride.route.to} ·{' '}
            {ride.ride.status === 'cancelled'
              ? 'Called off'
              : `${ride.riders.length} sharing · ${windowLabel(ride.ride.window.from, ride.ride.window.to, zone, now)}`}
          </a>
          {ride.ride.status !== 'cancelled' && (
          <span className="room__farenote">
            {fareCopy(ride.ride, ride.riders.length, true, String(ride.ride.hostPersonId) === String(me.id) ? 'You' : authorName(String(ride.ride.hostPersonId), String(me.id), me.firstName)).short}
            {ride.ride.fareSplit === 'host_pays' ? '' : ' · settle it between you'}
          </span>
          )}
          {ride.riders.some((pid) => me.blocked.includes(pid)) && String(ride.ride.hostPersonId) !== String(me.id) && (
            <p className="ride__hidden" role="note">
              Someone you hid is in this car. They are out of your view here, not out of the car: they can still read
              what you post.
            </p>
          )}
          {imInCar && ride.ride.pickupNote && (
            <p className="room__pickup">
              <span className="room__pickuplabel">Where to meet the car</span> {ride.ride.pickupNote}
            </p>
          )}
        </section>
      )}

      {isMeet && plan && planBody && (
        <section className={`plan ${iCant || theyCant ? 'plan--doubt' : ''}`} aria-label="The agreed plan">
          {/* Pinned while the log scrolls under it: the room opens at its
              newest message, and a strip that scrolled away with the log was a
              plan nobody could see after tapping That works. The time is the
              headline because it is the fact people check; the kind and the
              place follow. */}
          <p className="plan__when">
            {iCant || theyCant ? (
              <Chip tone="warn">{PLAN_COPY.strip.doubt}</Chip>
            ) : (
              <Chip tone="trust">{PLAN_COPY.strip.label}</Chip>
            )}
            <span className="plan__time">
              {windowLabel(planBody.window.from, planBody.window.to, zone, now)}
            </span>
          </p>
          <p className="plan__what">
            {MEET_KIND_LABEL[planBody.meetKind]} · {planBody.placeLabel}
          </p>
          {theyCant && theirs && <p className="plan__warn">{PLAN_COPY.theyCant(theirs.firstName)}</p>}
          {iCant && theirs && <p className="plan__warn">{PLAN_COPY.iCant(theirs.firstName)}</p>}
          {roomPlan?.offer && theirs && <p className="plan__pending">{PLAN_COPY.pending(theirs.firstName)}</p>}
          <div className="plan__actions">
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                calendar({
                  id: String(plan.proposal.id),
                  meetKind: planBody.meetKind,
                  from: String(planBody.window.from),
                  to: String(planBody.window.to),
                  place: planBody.placeLabel,
                })
              }
            >
              {PLAN_COPY.strip.calendar}
            </Button>
            <Button size="sm" variant="quiet" onClick={() => setProposing(true)}>
              {PLAN_COPY.strip.change}
            </Button>
            <Button size="sm" variant={iCant || theyCant ? 'danger' : 'quiet'} onClick={() => setCallingOff(true)}>
              {PLAN_COPY.strip.off}
            </Button>
          </div>
        </section>
      )}

      {channel.pinned && (
        <div className="room__pin">
          <span className="room__pinlabel">Pinned</span>
          <p className="room__pintext">{channel.pinned.text}</p>
        </div>
      )}

      {isMeet && mine && theirs && (
        <>
          <div className={`room__presence ${arrive ? 'room__presence--arrive' : ''}`}>
            <Presence who={theirs} />
            <Presence who={mine} />
          </div>
          {sameTerminal && (
            <p className={`room__together ${arrive ? 'room__together--arrive' : ''}`}>
              You&rsquo;re both in {mine.terminal} at {mine.airportIata}.
            </p>
          )}
          {watching ? (
            <div className="room__guardian">
              <Chip tone="guard">{watching.guardian.label} is watching until {clock(String(watching.endsAt))}</Chip>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  // Safe means the watch ends now — not when a rating is
                  // submitted. "Later" on the rating used to leave it running.
                  checkOut();
                  setAfterMeet(theirs);
                }}
              >
                I&rsquo;m safe
              </Button>
            </div>
          ) : (
            <div className="room__guardian">
              {view.request && !plan && (
                <Button size="sm" variant="secondary" onClick={() => setProposing(true)}>
                  Suggest a time
                </Button>
              )}
              <Button size="sm" variant="quiet" onClick={() => setGuarding(true)}>
                Tell someone where you are
              </Button>
              <Button size="sm" variant="quiet" onClick={() => setAfterMeet(theirs)}>
                We&rsquo;ve met
              </Button>
            </div>
          )}
          {theirsCard && (
            <section className="contact">
              <h3 className="room__label">Contact</h3>
              <p className="contact__name">
                {typeof theirsCard.displayName === 'string' ? theirsCard.displayName : theirs.firstName}
                {!isRedacted(theirsCard.professional) && theirsCard.professional.title
                  ? ` · ${theirsCard.professional.title}`
                  : ''}
              </p>
              <ul className="contact__links">
                {theirsCard.links.map((l, i) =>
                  isRedacted(l) ? (
                    <li key={i} className="contact__held">A link, shown once you are meeting.</li>
                  ) : (
                    <li key={i}>
                      <a href={l.url} target="_blank" rel="noreferrer">
                        {l.network} · {l.handle}
                      </a>
                    </li>
                  ),
                )}
              </ul>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const name = typeof theirsCard.displayName === 'string' ? theirsCard.displayName : theirs.firstName;
                  const pro = isRedacted(theirsCard.professional) ? undefined : theirsCard.professional;
                  const card = buildVCard({
                    fullName: name,
                    ...(pro?.title ? { title: pro.title } : {}),
                    ...(pro?.company ? { company: pro.company } : {}),
                    urls: theirsCard.links.filter((l) => !isRedacted(l)).map((l) => (l as { url: string }).url),
                    note: 'Met through Wingman',
                  });
                  const url = URL.createObjectURL(new Blob([card], { type: 'text/vcard' }));
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${name.replace(/\s+/g, '-')}.vcf`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Save contact
              </Button>
            </section>
          )}
          <section className="room__stages">
            {/* Named, so it cannot be mistaken for "Tell someone where you
                are" above it — that one is a link for a friend; this one is
                for the person you are meeting. */}
            <h3 className="room__label">Tell {theirs.firstName} where you are</h3>
            <div className="room__buttons">
              {stagesFor(latestProgress(messages, String(me.id))).map((stage) => (
                <button
                  key={stage}
                  type="button"
                  className={`stagebtn ${STAGE_COPY[stage].tone === 'warn' ? 'stagebtn--warn' : ''}`}
                  onClick={() => {
                    // With a plan standing, ask first: this used to post to
                    // Priya *before* the sheet asked, so "Keep the plan" left
                    // her told and the plan up.
                    if (stage === 'cannot_make_it' && plan) {
                      setCantSheet(true);
                      return;
                    }
                    // A warning is not a place: "running late" does not need to
                    // say which terminal you are running late in.
                    const warn = STAGE_COPY[stage].tone === 'warn';
                    post(channel, {
                      kind: 'stage',
                      stage,
                      ...(!warn && mine.terminal ? { terminal: mine.terminal } : {}),
                      ...(!warn && mine.airportIata ? { airportIata: mine.airportIata as never } : {}),
                    });
                  }}
                >
                  {STAGE_COPY[stage].button}
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      {/* A car is the one meet you cannot walk out of, so it gets the same
          safety tools a coffee has — watching over its pickup window, and
          rating each person in it afterwards. */}
      {ride && carMeet && imInCar && (
        <div className="room__guardian">
          {watching ? (
            <>
              <Chip tone="guard">{watching.guardian.label} is watching until {clock(String(watching.endsAt))}</Chip>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  checkOut();
                  if (riders.length > 0) setChoosingRider(true);
                }}
              >
                I&rsquo;m safe
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="quiet" onClick={() => setGuarding(true)}>
                Tell someone where you are
              </Button>
              {riders.length > 0 && (
                <Button size="sm" variant="quiet" onClick={() => setChoosingRider(true)}>
                  We&rsquo;ve met
                </Button>
              )}
            </>
          )}
        </div>
      )}

      <section className="room__log">
        {messages.length === 0 ? (
          <p className="room__empty">
            {isMeet && theirs
              ? `Nothing yet. Tap where you've got to and ${theirs.firstName} will see it.`
              : 'Nothing yet. Say hello.'}
          </p>
        ) : (
          <ol className="room__list" ref={log} aria-live="polite">
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const isMine = String(m.from) === String(me.id);
              const grouped = prev && prev.from === m.from && prev.body.kind === 'text' && m.body.kind === 'text';
              const who = isMine ? 'You' : authorName(String(m.from), String(me.id), me.firstName);
              if (m.body.kind === 'system') {
                return (
                  <li key={String(m.id)} className="msg msg--system">
                    <span className="msg__stage">{m.body.text}</span>
                  </li>
                );
              }
              if (m.body.kind === 'seat') {
                return (
                  <li key={String(m.id)} className="msg msg--system">
                    <span className="msg__stage">{seatLineText(m.body.change, isMine ? 'You' : who)}</span>
                  </li>
                );
              }
              if (m.body.kind === 'agreed' || m.body.kind === 'plan_off') {
                const target = m.body.proposalId;
                const about = messages.find((x) => x.id === target);
                const detail =
                  about?.body.kind === 'proposal'
                    ? ` ${MEET_KIND_LABEL[about.body.meetKind]}, ${clock(String(about.body.window.from))} at ${about.body.placeLabel}.`
                    : '';
                const line =
                  m.body.kind === 'agreed'
                    ? (isMine ? PLAN_COPY.log.agreedMine : PLAN_COPY.log.agreedTheirs(who)) + detail
                    : isMine
                      ? PLAN_COPY.log.offMine
                      : PLAN_COPY.log.offTheirs(who);
                return (
                  <li key={String(m.id)} className={`msg msg--system ${m.body.kind === 'agreed' ? 'msg--agreed' : ''}`}>
                    <span className="msg__stage">{line}</span>
                  </li>
                );
              }
              if (m.body.kind === 'proposal') {
                const b = m.body;
                const state: ProposalState | undefined = roomPlan?.states.get(String(m.id));
                const other = theirs?.firstName ?? 'them';
                return (
                  <li key={String(m.id)} className={`msg msg--proposal ${isMine ? 'msg--mine' : ''}`}>
                    <div
                      className={`proposal ${state === 'agreed' ? 'proposal--agreed' : ''} ${
                        state === 'replaced' || state === 'passed' ? 'proposal--stale' : ''
                      }`}
                    >
                      <p className="proposal__who">
                        {!isMine && (
                          <button
                            type="button"
                            className="msg__more proposal__more"
                            aria-label="Report this suggestion"
                            onClick={() => setReporting(m)}
                          >
                            ⋯
                          </button>
                        )}
                        {who} suggested
                        {state === 'agreed' && (
                          <>
                            {' '}
                            <Chip tone="trust">{PLAN_COPY.card.agreed}</Chip>
                          </>
                        )}
                      </p>
                      <p className="proposal__title">{MEET_KIND_LABEL[b.meetKind]}</p>
                      <p className="proposal__meta mono">
                        {b.placeLabel} · {clock(String(b.window.from))}–{clock(String(b.window.to))}
                      </p>
                      <div className="proposal__actions">
                        {state === 'agreeable' && (
                          <>
                            <Button size="sm" onClick={() => agreeTo(channelId, String(m.id))}>
                              {PLAN_COPY.card.agree}
                            </Button>
                            <Button size="sm" variant="quiet" onClick={() => setProposing(true)}>
                              Suggest another time
                            </Button>
                          </>
                        )}
                        {state === 'waiting' && <span className="proposal__note">{PLAN_COPY.card.waiting(other)}</span>}
                        {state === 'passed' && <span className="proposal__note">{PLAN_COPY.card.passed}</span>}
                        {state === 'replaced' && <span className="proposal__note">{PLAN_COPY.card.replaced}</span>}
                        {(state === 'waiting' || state === undefined) && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              calendar({
                                id: String(m.id),
                                meetKind: b.meetKind,
                                from: String(b.window.from),
                                to: String(b.window.to),
                                place: b.placeLabel,
                              })
                            }
                          >
                            Add to calendar
                          </Button>
                        )}
                      </div>
                    </div>
                    <time className="msg__time mono">{clock(String(m.at))}</time>
                  </li>
                );
              }
              if (m.body.kind === 'stage') {
                const copy = STAGE_COPY[m.body.stage];
                return (
                  <li key={String(m.id)} className={`msg msg--stage ${copy.tone === 'warn' ? 'msg--warn' : ''}`}>
                    <span className="msg__dot" aria-hidden="true" />
                    <span className="msg__stage">
                      {isMine ? copy.mine : `${who} ${copy.theirs}`}
                      {m.body.terminal && <span className="msg__where mono"> · {m.body.terminal}</span>}
                    </span>
                    <time className="msg__time mono">{clock(String(m.at))}</time>
                  </li>
                );
              }
              return (
                <li key={String(m.id)} className={`msg msg--text ${isMine ? 'msg--mine' : ''} ${grouped ? 'msg--grouped' : ''}`}>
                  {!isMine && !grouped && channel.kind !== 'meet' && <span className="msg__author">{who}</span>}
                  <span className="msg__row">
                    <p className="msg__bubble">{m.body.text}</p>
                    {!isMine && (
                      <button type="button" className="msg__more" aria-label="Report this message" onClick={() => setReporting(m)}>
                        ⋯
                      </button>
                    )}
                  </span>
                  <time className="msg__time mono">{clock(String(m.at))}</time>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {ride && ride.ride.status === 'cancelled' ? (
        <p className="room__closed">
          The car was called off. The room stays so everyone in it can read that; nothing more can be said here.
        </p>
      ) : (
      <form
        className="room__compose"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          className="field__input room__input"
          value={draft}
          rows={1}
          maxLength={TEXT_CAP[channel.kind]}
          placeholder={isMeet ? 'Which end of the bar?' : 'Say something'}
          aria-label="Say something"
          onChange={(e) => {
            setDraft(e.target.value);
            if (draftError) setDraftError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button type="submit" disabled={draft.trim().length === 0}>
          Send
        </Button>
      </form>
      )}
      {draftError && (
        <p className="field__error" role="alert">
          {draftError}
        </p>
      )}

      <p className="room__fineprint">
        {isMeet
          ? 'Messages live on this device. Hide or report anyone from the menu at the top. A yes is not a commitment to keep talking.'
          : 'Messages live on this device. Report a message from the ⋯ beside it.'}
      </p>

      {reporting && (
        <ReportSheet
          personId={reporting.from}
          firstName={authorName(String(reporting.from), String(me.id), me.firstName)}
          message={reporting}
          onClose={() => setReporting(null)}
        />
      )}
      {guarding && (view.request || carMeet) && (
        <GuardianSheet
          channelId={channelId}
          // The agreed window when there is one — not the one first asked for,
          // which is what this watched before a plan existed. A car's is the
          // host's pickup window.
          window={carMeet?.window ?? roomPlan?.meet?.window ?? view.request!.proposal.window}
          onClose={() => setGuarding(false)}
        />
      )}
      {proposing && view.request && (
        <ProposeSheet
          request={view.request}
          // A change starts from the plan, not from your terminal: "Change
          // time" used to reset the place to "LHR T2" and preselect the very
          // time already agreed, so a change changed the wrong thing.
          defaultPlace={planBody ? planBody.placeLabel : mine?.terminal ? `${mine.airportIata ?? ''} ${mine.terminal}`.trim() : ''}
          {...(planBody
            ? { current: { from: planBody.window.from, placeKind: planBody.placeKind ?? 'terminal_landmark', otherName: theirs?.firstName ?? 'they' } }
            : {})}
          clock={clock}
          onClose={() => setProposing(false)}
          onPost={(d: ProposalDraft) => {
            post(channel, { kind: 'proposal', ...d });
            setProposing(false);
          }}
        />
      )}
      {cantSheet && plan && theirs && (
        <Sheet
          open
          title="Can’t make it?"
          onClose={() => setCantSheet(false)}
          actions={
            // Stacked, and without the name: "Tell Maximilian and call it off"
            // ran off a 402px screen. The last line sends nothing.
            <div className="sheet__stack">
              <Button
                variant="danger"
                full
                onClick={() => {
                  post(channel, { kind: 'stage', stage: 'cannot_make_it' });
                  callOffPlan(channelId);
                  setCantSheet(false);
                }}
              >
                Tell them, and call it off
              </Button>
              <Button
                variant="secondary"
                full
                onClick={() => {
                  post(channel, { kind: 'stage', stage: 'cannot_make_it' });
                  setCantSheet(false);
                }}
              >
                Just tell them
              </Button>
              <Button variant="quiet" full onClick={() => setCantSheet(false)}>
                Not now
              </Button>
            </div>
          }
        >
          <p className="sheet__body">{PLAN_COPY.cantSheet(theirs.firstName)}</p>
        </Sheet>
      )}
      {callingOff && plan && (
        <Sheet
          open
          title={PLAN_COPY.strip.off}
          onClose={() => setCallingOff(false)}
          actions={
            <>
              <Button variant="secondary" onClick={() => setCallingOff(false)}>
                Keep the plan
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  callOffPlan(channelId);
                  setCallingOff(false);
                }}
              >
                {PLAN_COPY.strip.off}
              </Button>
            </>
          }
        >
          <p className="sheet__body">{PLAN_COPY.offConfirm}</p>
        </Sheet>
      )}
      {choosingRider && (
        <Sheet open title="Who do you want to rate?" onClose={() => setChoosingRider(false)}>
          <p className="sheet__body">One at a time. Nobody sees what you said until they have rated you too.</p>
          <div className="riderpick">
            {riders.map((p) => (
              <button
                key={p.id}
                type="button"
                className="riderpick__row"
                onClick={() => {
                  setChoosingRider(false);
                  setAfterMeet(p);
                }}
              >
                <Avatar spec={p.avatar} size="sm" label={p.firstName} />
                <span>{p.firstName}</span>
              </button>
            ))}
          </div>
        </Sheet>
      )}
      {afterMeet && (
        <AfterMeetSheet
          channelId={channelId}
          otherId={afterMeet.id as PersonId}
          firstName={afterMeet.firstName}
          onClose={() => setAfterMeet(null)}
        />
      )}
    </article>
  );
}

function Presence({ who }: { who: Participant }) {
  return (
    <div className="presence">
      <Avatar spec={who.avatar} size="md" label={who.firstName} />
      <div className="presence__body">
        <p className="presence__name">{who.isMe ? 'You' : who.firstName}</p>
        {who.stage ? (
          <p className="presence__stage">
            {who.isMe ? STAGE_COPY[who.stage].mine : `${who.firstName} ${STAGE_COPY[who.stage].theirs}`}
          </p>
        ) : (
          <p className="presence__stage presence__stage--quiet">
            {who.isMe ? 'No update yet' : 'Location appears once they post an update'}
          </p>
        )}
        <p className="presence__where mono">
          {who.terminal ? (
            <Chip tone="neutral">
              {who.airportIata} · {who.terminal}
            </Chip>
          ) : who.isMe ? (
            <span className="presence__nowhere">{who.flightNo ?? 'No flight'}</span>
          ) : null}
        </p>
      </div>
    </div>
  );
}
