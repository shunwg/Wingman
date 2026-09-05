import { useRef, useState } from 'react';

/**
 * How Wingman works, in three cards.
 *
 * Shared by the welcome screen and the "How Wingman works" row on You, so the
 * first-use page stays reachable after onboarding. Swipe or scroll; the dots
 * follow. Nothing here is a tutorial — each card is one sentence of intent
 * and one of mechanism.
 */
export const WELCOME_CARDS: { title: string; body: string }[] = [
  {
    title: 'Around the way you already travel.',
    body: 'Someone on your flight, in your terminal on a layover, or landing in the same city tonight. Coffee at the gate, a shared ride in, dinner, or an introduction.',
  },
  {
    title: 'You decide who sees you before anyone does.',
    body: 'Verified people only, women only, your circles only — in both directions at once. Nothing is on until you choose it, and you can change it any time.',
  },
  {
    title: 'Nothing is shared until you both say yes.',
    body: 'A first name and one sentence is all a stranger sees. Your full name, your links and where you are appear only once you have both agreed to meet.',
  },
];

export function WelcomeCards() {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    if (!card) return;
    const step = card.offsetWidth + 12;
    setActive(Math.round(el.scrollLeft / step));
  };

  return (
    <>
      <div className="welcome__cards" ref={track} onScroll={onScroll}>
        {WELCOME_CARDS.map((c) => (
          <article className="welcome__card" key={c.title}>
            <h2 className="welcome__cardtitle display">{c.title}</h2>
            <p className="welcome__cardbody">{c.body}</p>
          </article>
        ))}
      </div>
      <ol className="welcome__dots" aria-label={`Card ${active + 1} of ${WELCOME_CARDS.length}`}>
        {WELCOME_CARDS.map((c, i) => (
          <li key={c.title} className={`welcome__dot ${i === active ? 'is-on' : ''}`} />
        ))}
      </ol>
    </>
  );
}
