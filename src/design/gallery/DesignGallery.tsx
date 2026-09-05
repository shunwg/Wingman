import { useEffect, useState } from 'react';
import { Avatar } from '../primitives/Avatar';
import { Button } from '../primitives/Button';
import { Chip, ToggleChip } from '../primitives/Chip';
import { Field } from '../primitives/Field';
import { OptionRow } from '../primitives/OptionRow';
import { Sheet } from '../primitives/Sheet';
import { Stepper } from '../primitives/Stepper';
import { PersonCard } from '../patterns/PersonCard';
import { generateAvatar } from '../avatar/generate';
import { Logo } from '../brand/Logo';
import { Wordmark } from '../brand/Wordmark';
import {
  TOKEN_SWATCHES,
  acceptedCard,
  faceSeeds,
  strangerCard,
  unprovenCard,
} from './fixtures';

/**
 * The design gallery — dev route `/_design`.
 *
 * Every token, primitive and pattern against frozen fixtures. Two jobs: it is
 * where design work actually happens, without needing to navigate an app into
 * the right state; and it is the visual-regression surface, so a token change
 * produces one reviewable diff instead of twenty flaky screen diffs.
 */
export function DesignGallery() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [selected, setSelected] = useState<string[]>(['gate_coffee']);
  const [option, setOption] = useState('verified');
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggle = (k: string) =>
    setSelected((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));

  return (
    <div className="gallery">
      <div className="theme-toggle">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
        >
          {theme === 'light' ? 'Dark' : 'Light'}
        </Button>
      </div>

      <h1 className="gallery__title display">Wingman design</h1>
      <p className="gallery__lede">
        Light-first, warm, photo-led. Four hues total — ink, an ember accent, a trust green and a
        guardian indigo. Colour is never the only indicator: every stamp and state carries an icon
        and a label too.
      </p>

      <section className="gallery__section">
        <h2 className="gallery__h2 display">Brand</h2>
        <p className="gallery__note">
          Two routes converging. One climbs, one dips, both arrive at the same ember dot — a wing
          made of two journeys. In mono the dot takes the stroke colour. Never an airplane.
        </p>
        <div className="brand-row">
          <Logo size={16} />
          <Logo size={24} />
          <Logo size={48} />
          <Logo size={96} />
          <Logo size={48} tone="accent" />
          <Logo size={48} tone="mono" />
          <Wordmark />
          <Wordmark size={40} />
        </div>
        <div className="brand-row brand-row--ink">
          <Logo size={24} />
          <Logo size={48} />
          <Logo size={48} tone="mono" />
          <Wordmark />
        </div>
      </section>

      <section className="gallery__section">
        <h2 className="gallery__h2 display">Colour</h2>
        <p className="gallery__note">
          Every value is a token. Nothing outside <code>src/design</code> may write a literal
          colour, so a re-skin means editing one file.
        </p>
        <div className="gallery__swatches">
          {TOKEN_SWATCHES.map((t) => (
            <div className="swatch" key={t.name}>
              <div className="swatch__chip" style={{ background: `var(${t.name})` }} />
              <div className="swatch__label">
                <b className="mono">{t.name}</b>
                <span>{t.role}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="gallery__section">
        <h2 className="gallery__h2 display">Type</h2>
        <p className="gallery__note">
          Fraunces for display, Inter for interface, JetBrains Mono for anything that is a fact —
          flight numbers, times, money, codes.
        </p>
        <p className="display" style={{ fontSize: 'var(--text-3xl)' }}>
          Meet people worth meeting
        </p>
        <p style={{ maxWidth: '62ch', marginTop: 'var(--sp-3)' }}>
          Someone on your flight, in your terminal during a layover, or landing in the same city
          tonight.
        </p>
        <p className="mono" style={{ marginTop: 'var(--sp-3)', color: 'var(--muted)' }}>
          SQ317 · LHR → SIN · 12h 45m · GATE C12 · 14:05
        </p>
      </section>

      <section className="gallery__section">
        <h2 className="gallery__h2 display">Buttons</h2>
        <p className="gallery__note">
          Everything pressable scales to 0.97 on press. Hover is gated behind a fine pointer, so
          touch devices never get a stuck hover state.
        </p>
        <div className="gallery__row">
          <Button variant="primary">Ask to meet</Button>
          <Button variant="secondary">Not this trip</Button>
          <Button variant="quiet">Skip</Button>
          <Button variant="danger">Block</Button>
          <Button variant="primary" loading>
            Sending
          </Button>
          <Button variant="primary" disabled>
            Unavailable
          </Button>
        </div>
      </section>

      <section className="gallery__section">
        <h2 className="gallery__h2 display">Chips</h2>
        <p className="gallery__note">
          Toggles are real buttons with <code>aria-pressed</code>, not styled divs — a filter you
          cannot reach by keyboard is a filter half the people cannot use.
        </p>
        <div className="gallery__row" style={{ marginBottom: 'var(--sp-4)' }}>
          <Chip tone="neutral">Energy</Chip>
          <Chip tone="accent">On your flight</Chip>
          <Chip tone="trust">ID verified</Chip>
          <Chip tone="guard">Guardian armed</Chip>
          <Chip tone="warn">Different terminals</Chip>
          <Chip mono>SQ317</Chip>
        </div>
        <div className="gallery__row">
          {['gate_coffee', 'lounge', 'meal', 'business_intro', 'ride_share'].map((k) => (
            <ToggleChip key={k} selected={selected.includes(k)} onClick={() => toggle(k)}>
              {k.replace(/_/g, ' ')}
            </ToggleChip>
          ))}
        </div>
      </section>

      <section className="gallery__section">
        <h2 className="gallery__h2 display">Forms</h2>
        <p className="gallery__note">
          Label above, hint under, error under that. Options are pressed buttons. A stepper
          says where you are; a sheet asks one question and leaves.
        </p>
        <div className="gallery__forms">
          <Stepper index={1} count={5} title="About you" onBack={() => {}} />
          <Field label="Flight number" hint="Like SK1465. Optional." htmlFor="g-fno">
            <input id="g-fno" className="field__input mono" placeholder="SK1465" />
          </Field>
          <Field label="Date" error="That is before 2026-09-02. Wingman only lists journeys ahead of you.">
            <input className="field__input mono" type="date" defaultValue="2026-08-01" />
          </Field>
          <div className="panel__stack">
            <OptionRow
              label="Verified people only"
              note="Only people who have verified at least one account can see you."
              selected={option === 'verified'}
              onClick={() => setOption('verified')}
            />
            <OptionRow
              label="Women only"
              note="Only women can see you, and you will only see women."
              selected={option === 'women'}
              onClick={() => setOption('women')}
            />
          </div>
          <Button variant="secondary" size="sm" onClick={() => setSheetOpen(true)}>
            Open a sheet
          </Button>
          <Sheet
            open={sheetOpen}
            title="Remove this trip?"
            onClose={() => setSheetOpen(false)}
            actions={
              <>
                <Button variant="secondary" onClick={() => setSheetOpen(false)}>
                  Keep it
                </Button>
                <Button variant="danger" onClick={() => setSheetOpen(false)}>
                  Remove
                </Button>
              </>
            }
          >
            <p className="sheet__body">Nothing else changes. Your other trips stay listed.</p>
          </Sheet>
        </div>
      </section>

      <section className="gallery__section">
        <h2 className="gallery__h2 display">Portraits</h2>
        <p className="gallery__note">
          Everyone gets a photo. Generated deterministically from the person&rsquo;s id — no
          network, no licensing, and no real person depicted. A duotone backdrop, an off-centre
          crop, a rim light and a little grain are what make it read as photographic rather than as
          an icon. A test asserts 200 seeds give 200 distinct, legible results.
        </p>
        <div className="faces">
          {faceSeeds.map((seed) => (
            <Avatar key={seed} spec={generateAvatar(seed)} size="lg" />
          ))}
        </div>
      </section>

      <section className="gallery__section">
        <h2 className="gallery__h2 display">Person card</h2>
        <p className="gallery__note">
          The prop type is <code>RedactedPerson</code>, never <code>Person</code> — a leak here
          requires defeating the type system rather than forgetting a conditional. Withheld fields
          say so instead of leaving a gap.
        </p>
        <div className="gallery__grid">
          <PersonCard
            person={strangerCard}
            context="On your flight · 12h 45m"
            onClick={() => {}}
          />
          <PersonCard
            person={acceptedCard}
            context="Singapore · Thu night"
            onClick={() => {}}
          />
          <PersonCard person={unprovenCard} context="Changi T3 · 2h 10m" onClick={() => {}} />
        </div>
      </section>

      <section className="gallery__section">
        <h2 className="gallery__h2 display">Disclosure ladder</h2>
        <p className="gallery__note">
          The same person at rung 0 and rung 2. Identity is earned by mutuality: a stranger gets a
          face, a headline and what has been proved — not a name, a bio, an employer or a link.
        </p>
        <div className="gallery__rows">
          <PersonCard person={strangerCard} context="Rung 0 · browsing" layout="row" />
          <PersonCard person={acceptedCard} context="Rung 2 · accepted" layout="row" />
        </div>
      </section>
    </div>
  );
}
