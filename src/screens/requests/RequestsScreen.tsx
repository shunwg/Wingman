import { useState } from 'react';
import { Button } from '@design/primitives/Button';
import { Chip } from '@design/primitives/Chip';
import { Avatar } from '@design/primitives/Avatar';
import type { DenialRecord, MeetRequest, PersonId } from '@domain/index';
import { senderView } from '@state/machines/meetRequest';
import { useStore } from '@state/store';
import { personById } from '@data/seed/people';
import { generateAvatar } from '@design/avatar/generate';
import { DenySheet } from './DenySheet';

/**
 * Requests, both directions.
 *
 * The asymmetry is the whole point of this screen. What *you* see about
 * requests sent to you is complete: who, what they proposed, when it lapses.
 * What a sender sees about a request they sent is deliberately impoverished —
 * pending, accepted, or closed — because the alternative is a product where a
 * decline has to be justified.
 */
export function RequestsScreen() {
  const requests = useStore((s) => s.requests);
  const me = useStore((s) => s.me);
  const [denying, setDenying] = useState<MeetRequest | null>(null);

  const incoming = requests.filter((r) => r.toPersonId === me.id);
  const outgoing = requests.filter((r) => r.fromPersonId === me.id);
  // Both directions: once it is agreed, who asked stops mattering.
  const accepted = requests.filter((r) => r.status === 'accepted');

  return (
    <>
      <section className="reqsection">
        <h2 className="reqsection__title">Waiting for you</h2>
        {incoming.filter((r) => ['sent', 'viewed'].includes(r.status)).length === 0 ? (
          <p className="reqsection__empty">Nothing waiting.</p>
        ) : (
          incoming
            .filter((r) => ['sent', 'viewed'].includes(r.status))
            .map((r) => <IncomingRow key={String(r.id)} request={r} onDeny={() => setDenying(r)} />)
        )}
      </section>

      <section className="reqsection">
        <h2 className="reqsection__title">Meeting</h2>
        {accepted.length === 0 ? (
          <p className="reqsection__empty">Nothing agreed yet.</p>
        ) : (
          accepted.map((r) => <MeetingRow key={String(r.id)} request={r} meId={me.id} />)
        )}
      </section>

      <section className="reqsection">
        <h2 className="reqsection__title">You asked</h2>
        {outgoing.length === 0 ? (
          <p className="reqsection__empty">You have not asked anyone yet.</p>
        ) : (
          outgoing.map((r) => <OutgoingRow key={String(r.id)} request={r} />)
        )}
      </section>

      {denying && <DenySheet request={denying} onClose={() => setDenying(null)} />}
    </>
  );
}

/** An agreed meet — the door into its room. */
function MeetingRow({ request, meId }: { request: MeetRequest; meId: PersonId }) {
  const otherId = String(request.fromPersonId === meId ? request.toPersonId : request.fromPersonId);
  const other = personById(otherId);

  return (
    <a className="reqrow reqrow--link" href={`#/meet/${String(request.id)}`}>
      <Avatar spec={other?.avatar ?? generateAvatar(otherId)} size="md" />
      <div className="reqrow__body">
        <p className="reqrow__who">{other?.firstName ?? 'Someone'}</p>
        <p className="reqrow__msg">{KIND_TEXT[request.proposal.kind] ?? 'Meeting up'}</p>
      </div>
      <span className="reqrow__go" aria-hidden="true">
        →
      </span>
    </a>
  );
}

const KIND_TEXT: Record<string, string> = {
  gate_coffee: 'Coffee at the gate',
  lounge: 'The lounge',
  terminal_walk: 'A walk round the terminal',
  ride_share: 'Sharing the ride in',
  meal: 'A meal',
  drinks: 'A drink',
  business_intro: 'An introduction',
  coworking: 'Coworking',
};

function IncomingRow({ request, onDeny }: { request: MeetRequest; onDeny: () => void }) {
  const advance = useStore((s) => s.advanceRequest);
  const me = useStore((s) => s.me);
  const from = personById(String(request.fromPersonId));

  return (
    <article className="reqrow">
      <Avatar spec={from?.avatar ?? generateAvatar(String(request.fromPersonId))} size="md" />
      <div className="reqrow__body">
        <p className="reqrow__who">{from?.firstName ?? 'Someone'} asked to meet</p>
        <p className="reqrow__msg">&ldquo;{request.message}&rdquo;</p>
        <Chip tone="accent">{request.proposal.kind.replace(/_/g, ' ')}</Chip>
      </div>
      <div className="reqrow__actions">
        <Button size="sm" onClick={() => advance(String(request.id), 'accepted', me.id)}>
          Yes
        </Button>
        {/* Declining is a first-class action, not hidden behind an overflow
            menu. Making "no" hard to find does not produce fewer noes — it
            produces more silence, which is worse for the person waiting. */}
        <Button size="sm" variant="secondary" onClick={onDeny}>
          Not this time
        </Button>
      </div>
    </article>
  );
}

function OutgoingRow({ request }: { request: MeetRequest }) {
  const to = personById(String(request.toPersonId));
  const view = senderView(request.status);

  return (
    <article className="reqrow">
      <Avatar spec={to?.avatar ?? generateAvatar(String(request.toPersonId))} size="md" />
      <div className="reqrow__body">
        <p className="reqrow__who">{to?.firstName ?? 'Someone'}</p>
        <p className="reqrow__msg">&ldquo;{request.message}&rdquo;</p>
      </div>
      <div className="reqrow__status">
        {view === 'pending' && <Chip>Waiting</Chip>}
        {view === 'accepted' && <Chip tone="trust">Yes — you&rsquo;re meeting</Chip>}
        {/* Denied, withdrawn, expired and revoked all land here, identically.
            The sender is never told which, and never told why. */}
        {view === 'closed' && <Chip>Closed</Chip>}
      </div>
    </article>
  );
}

export type { DenialRecord };
