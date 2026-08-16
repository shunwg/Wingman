import { useState } from 'react';
import { Avatar } from '@design/primitives/Avatar';
import { Button } from '@design/primitives/Button';
import { Chip } from '@design/primitives/Chip';
import { generateAvatar } from '@design/avatar/generate';
import { STAGE_COPY, stagesFor } from '@data/copy/stages';
import { useMeetRoom, type RoomParticipant } from './useMeetRoom';

/**
 * The meet room.
 *
 * Opens only once both people have agreed, and it is built around one question:
 * where are you, and are you close? Everything else is secondary to that,
 * because everything else can wait twenty minutes until you are standing
 * together.
 *
 * So the room leads with two presence cards — their terminal and yours, taken
 * from the flight rather than typed — and a row of one-tap updates. Free text
 * exists underneath, because naming a landmark needs words, but it is not the
 * first thing your thumb finds. A blank box at the top of this screen would
 * invite a conversation that ought to be happening in person.
 */
export function MeetScreen({ requestId, onBack }: { requestId: string; onBack: () => void }) {
  const room = useMeetRoom(requestId);
  const [draft, setDraft] = useState('');

  if (!room.request) {
    return (
      <div className="empty">
        <h2 className="empty__title display">No room here</h2>
        <p className="empty__body">
          A room opens once you have both agreed to meet. This one either has not been accepted, or
          has since closed.
        </p>
        <Button variant="secondary" onClick={onBack}>
          Back to requests
        </Button>
      </div>
    );
  }

  const { messages, mine, theirs, sameTerminal, postStage, postText } = room;
  const offered = stagesFor(mine.stage);

  return (
    <article className="room">
      <button className="person__back" onClick={onBack} type="button">
        ← Requests
      </button>

      <div className="room__presence">
        <Presence who={theirs} />
        <Presence who={mine} isMine />
      </div>

      {sameTerminal && (
        <p className="room__together">
          You&rsquo;re both in {mine.terminal} at {mine.airportIata}.
        </p>
      )}

      <section className="room__stages">
        <h3 className="room__label">Tell them where you are</h3>
        <div className="room__buttons">
          {offered.map((stage) => (
            <button
              key={stage}
              type="button"
              className={`stagebtn ${STAGE_COPY[stage].tone === 'warn' ? 'stagebtn--warn' : ''}`}
              onClick={() =>
                postStage(requestId, stage, {
                  // The terminal is attached at the moment of sending, so the
                  // log records where they were then rather than where they are
                  // now — which is the whole point of a timeline.
                  ...(mine.terminal ? { terminal: mine.terminal } : {}),
                  ...(mine.airportIata ? { airportIata: mine.airportIata } : {}),
                })
              }
            >
              {STAGE_COPY[stage].button}
            </button>
          ))}
        </div>
      </section>

      <section className="room__log">
        {messages.length === 0 ? (
          <p className="room__empty">
            Nothing yet. Tap where you&rsquo;ve got to and {theirs.firstName} will see it.
          </p>
        ) : (
          <ol className="room__list">
            {messages.map((m) => {
              const isMine = String(m.from) === mine.id;
              const who = isMine ? mine : theirs;

              if (m.body.kind === 'stage') {
                const copy = STAGE_COPY[m.body.stage];
                return (
                  <li key={m.id} className={`msg msg--stage ${copy.tone === 'warn' ? 'msg--warn' : ''}`}>
                    <span className="msg__dot" aria-hidden="true" />
                    <span className="msg__stage">
                      {isMine ? copy.mine : `${who.firstName} ${copy.theirs}`}
                      {m.body.terminal && (
                        <span className="msg__where mono"> · {m.body.terminal}</span>
                      )}
                    </span>
                    <time className="msg__time mono">{clock(String(m.at))}</time>
                  </li>
                );
              }

              return (
                <li key={m.id} className={`msg msg--text ${isMine ? 'msg--mine' : ''}`}>
                  <p className="msg__bubble">{m.body.text}</p>
                  <time className="msg__time mono">{clock(String(m.at))}</time>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <form
        className="room__compose"
        onSubmit={(e) => {
          e.preventDefault();
          postText(requestId, draft);
          setDraft('');
        }}
      >
        <input
          className="field__input"
          value={draft}
          maxLength={240}
          placeholder="Which end of the bar?"
          aria-label="Say something"
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button type="submit" disabled={draft.trim().length === 0}>
          Send
        </Button>
      </form>

      <p className="room__fineprint">
        Messages live on this device and disappear when the meet does. If something is wrong, you
        can still block them — a yes is not a commitment to keep talking.
      </p>
    </article>
  );
}

function Presence({ who, isMine }: { who: RoomParticipant; isMine?: boolean }) {
  const spec = who.photoUrl
    ? { ...generateAvatar(who.avatarSeed), photoUrl: who.photoUrl }
    : generateAvatar(who.avatarSeed);

  return (
    <div className="presence">
      <Avatar spec={spec} size="md" label={who.firstName} />
      <div className="presence__body">
        <p className="presence__name">{isMine ? 'You' : who.firstName}</p>
        {who.stage ? (
          <p className="presence__stage">
            {isMine ? STAGE_COPY[who.stage].mine : `${who.firstName} ${STAGE_COPY[who.stage].theirs}`}
          </p>
        ) : (
          <p className="presence__stage presence__stage--quiet">No update yet</p>
        )}
        <p className="presence__where mono">
          {who.terminal ? (
            <Chip tone="neutral">
              {who.airportIata} · {who.terminal}
            </Chip>
          ) : (
            <span className="presence__nowhere">{who.flightNo ?? 'No flight'}</span>
          )}
        </p>
      </div>
    </div>
  );
}

/** 18:42 — the only part of a timestamp that matters inside an airport. */
function clock(iso: string): string {
  return iso.slice(11, 16);
}
