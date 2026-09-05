import { useEffect, useRef, useState } from 'react';
import { Avatar } from '@design/primitives/Avatar';
import { Button } from '@design/primitives/Button';
import { Chip } from '@design/primitives/Chip';
import { Menu } from '@design/primitives/Menu';
import type { Message, PersonId } from '@domain/index';
import { TEXT_CAP } from '@domain/index';
import { STAGE_COPY, stagesFor } from '@data/copy/stages';
import { isLive } from '@privacy/index';
import { bucketPhrase } from '@lib/bucket';
import { authorName, useChannel, type Participant } from '@state/selectors/channel';
import { useStore } from '@state/store';
import { PersonMenu } from '@screens/safety/PersonMenu';
import { ReportSheet } from '@screens/safety/ReportSheet';
import { GuardianSheet } from '@screens/safety/GuardianSheet';
import { AfterMeetSheet } from '@screens/safety/AfterMeetSheet';

/**
 * One conversation — a meet room, a circle's General, or a group.
 *
 * A meet leads with where each of you is and a row of one-tap updates; free
 * text sits underneath because naming a landmark needs words, but a blank
 * box at the top would invite a conversation that should be happening in
 * person twenty minutes later. A circle leads with the organiser's pin. A
 * group is the circle layout without it.
 */
export function ChannelScreen({ channelId, onBack }: { channelId: string; onBack: () => void }) {
  const view = useChannel(channelId);
  const me = useStore((s) => s.me);
  const post = useStore((s) => s.post);
  const markRead = useStore((s) => s.markRead);
  const muted = useStore((s) => s.muted);
  const muteChannel = useStore((s) => s.muteChannel);
  const unmuteChannel = useStore((s) => s.unmuteChannel);
  const guardian = useStore((s) => s.guardian);
  const now = useStore((s) => s.now);
  const [draft, setDraft] = useState('');
  const [reporting, setReporting] = useState<Message | null>(null);
  const [guarding, setGuarding] = useState(false);
  const [afterMeet, setAfterMeet] = useState(false);
  const log = useRef<HTMLOListElement>(null);

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

  const { channel, messages, mine, theirs, sameTerminal, circle } = view;
  const isMeet = channel.kind === 'meet';
  const isMuted = muted.includes(channelId);
  const watching = guardian && String(guardian.meetId) === channelId && isLive(guardian, now) ? guardian : null;
  const title = channel.kind === 'circle' && circle ? `${circle.shortName} · General` : channel.title;

  const send = () => {
    post(channel, { kind: 'text', text: draft });
    setDraft('');
  };

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
            : `${channel.memberIds.length} people`}
          {isMuted && ' · muted'}
        </p>
      )}

      {channel.pinned && (
        <div className="room__pin">
          <span className="room__pinlabel">Pinned</span>
          <p className="room__pintext">{channel.pinned.text}</p>
        </div>
      )}

      {isMeet && mine && theirs && (
        <>
          <div className="room__presence">
            <Presence who={theirs} />
            <Presence who={mine} />
          </div>
          {sameTerminal && (
            <p className="room__together">
              You&rsquo;re both in {mine.terminal} at {mine.airportIata}.
            </p>
          )}
          {watching ? (
            <div className="room__guardian">
              <Chip tone="guard">{watching.guardian.label} is watching until {String(watching.endsAt).slice(11, 16)}</Chip>
              <Button size="sm" variant="secondary" onClick={() => setAfterMeet(true)}>
                I&rsquo;m safe
              </Button>
            </div>
          ) : (
            <div className="room__guardian">
              <Button size="sm" variant="quiet" onClick={() => setGuarding(true)}>
                Tell someone where you are
              </Button>
              <Button size="sm" variant="quiet" onClick={() => setAfterMeet(true)}>
                We&rsquo;ve met
              </Button>
            </div>
          )}
          <section className="room__stages">
            <h3 className="room__label">Tell them where you are</h3>
            <div className="room__buttons">
              {stagesFor(mine.stage).map((stage) => (
                <button
                  key={stage}
                  type="button"
                  className={`stagebtn ${STAGE_COPY[stage].tone === 'warn' ? 'stagebtn--warn' : ''}`}
                  onClick={() =>
                    post(channel, {
                      kind: 'stage',
                      stage,
                      ...(mine.terminal ? { terminal: mine.terminal } : {}),
                      ...(mine.airportIata ? { airportIata: mine.airportIata as never } : {}),
                    })
                  }
                >
                  {STAGE_COPY[stage].button}
                </button>
              ))}
            </div>
          </section>
        </>
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
              if (m.body.kind === 'system') {
                return (
                  <li key={String(m.id)} className="msg msg--system">
                    <span className="msg__stage">{m.body.text}</span>
                  </li>
                );
              }
              if (m.body.kind === 'stage') {
                const copy = STAGE_COPY[m.body.stage];
                const who = authorName(String(m.from), String(me.id), me.firstName);
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
                  {!isMine && !grouped && channel.kind !== 'meet' && (
                    <span className="msg__author">{authorName(String(m.from), String(me.id), me.firstName)}</span>
                  )}
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
          onChange={(e) => setDraft(e.target.value)}
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

      <p className="room__fineprint">
        Messages live on this device. Hide or report anyone from the menu at the top — a yes is
        not a commitment to keep talking.
      </p>

      {reporting && (
        <ReportSheet
          personId={reporting.from}
          firstName={authorName(String(reporting.from), String(me.id), me.firstName)}
          message={reporting}
          onClose={() => setReporting(null)}
        />
      )}
      {guarding && view.request && (
        <GuardianSheet
          channelId={channelId}
          window={view.request.proposal.window}
          onClose={() => setGuarding(false)}
        />
      )}
      {afterMeet && theirs && (
        <AfterMeetSheet
          channelId={channelId}
          otherId={theirs.id as PersonId}
          firstName={theirs.firstName}
          onClose={() => setAfterMeet(false)}
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

/** 18:42 — the only part of a timestamp that matters inside an airport. */
function clock(iso: string): string {
  return iso.slice(11, 16);
}
