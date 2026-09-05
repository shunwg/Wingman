import { Button } from '@design/primitives/Button';
import { Chip } from '@design/primitives/Chip';
import { CircleCrest } from '@design/patterns/CircleCrest';
import { admissionSentence } from '@domain/index';
import { circleIsLive } from '@data/seed/circles';
import { bucketPhrase } from '@lib/bucket';
import { useCircles } from '@state/selectors/circles';
import { useStore } from '@state/store';

/**
 * Circles.
 *
 * A closed loop is the thing a school or a conference actually buys, so this
 * is a top-level surface rather than a settings row. The list leads with the
 * circles you are in; each row says how its members got in, because that
 * sentence is the product. Everything else — your badge, the members, joining
 * — lives on the circle's own page.
 */
export function CirclesScreen({ onOpen }: { onOpen: (id: string) => void }) {
  const me = useStore((s) => s.me);
  const now = useStore((s) => s.now);
  const circles = useCircles();
  const today = String(now).slice(0, 10);

  const mine = circles.filter((c) => me.memberships.some((m) => String(m.circleId) === String(c.id)));
  const others = circles.filter((c) => !mine.includes(c) && !c.membersOnly);

  const row = (c: (typeof circles)[number]) => {
    const m = me.memberships.find((x) => String(x.circleId) === String(c.id));
    const live = circleIsLive(c, today);
    return (
      <button type="button" className="circlerow" key={String(c.id)} onClick={() => onOpen(String(c.id))}>
        <CircleCrest shortName={c.shortName} {...(c.crestUrl ? { crestUrl: c.crestUrl } : {})} size="md" />
        <span className="circlerow__body">
          <span className="circlerow__name">{c.name}</span>
          <span className="circlerow__meta mono">
            {bucketPhrase(c.memberCount, 'member', 'members')}
            {c.runs && ` · ${c.runs.from} → ${c.runs.to}`}
          </span>
          <span className="circlerow__sentence">{admissionSentence(c.admission)}</span>
          {m ? (
            <span className="circlerow__state">
              <Chip tone={m.display === 'show_badge' ? 'accent' : 'neutral'}>
                {m.display === 'show_badge' ? 'Badge shown' : m.display === 'match_only' ? 'Matching only' : 'Paused'}
              </Chip>
            </span>
          ) : !live ? (
            <span className="circlerow__state">
              <Chip tone="warn">{today > String(c.runs?.to) ? 'Finished' : 'Not yet'}</Chip>
            </span>
          ) : null}
        </span>
        <span className="circlerow__go" aria-hidden="true">
          ›
        </span>
      </button>
    );
  };

  return (
    <>
      <p className="screennote">Closed loops where everyone was admitted the same way you were.</p>

      {mine.length > 0 && (
        <section className="panel__stack">
          <h3 className="panel__title">Yours</h3>
          {mine.map(row)}
        </section>
      )}

      {others.length > 0 && (
        <section className="panel__stack">
          <h3 className="panel__title">{mine.length > 0 ? 'Open to you' : 'Circles'}</h3>
          {others.map(row)}
        </section>
      )}

      <div className="circlecard circlecard--pitch">
        <h2 className="circlecard__name">Running a school or a conference?</h2>
        <p className="circlecard__admission">
          A circle is a list or an email ending, a mark, and, for an event, a date range.
          Admission is proved, never typed, which is the only reason a member can trust that
          everyone else in the room belongs there.
        </p>
        <div className="panel__row">
          <Button size="sm" onClick={() => (window.location.hash = '#/circles/new')}>
            Open a circle
          </Button>
          <a
            className="btn btn--quiet btn--sm"
            href={import.meta.env.BASE_URL + 'organisers.html'}
            target="_blank"
            rel="noreferrer"
          >
            For organisers
          </a>
        </div>
      </div>
    </>
  );
}
