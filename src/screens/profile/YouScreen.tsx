import { useState } from 'react';
import { Avatar } from '@design/primitives/Avatar';
import { Button } from '@design/primitives/Button';
import { Chip, ToggleChip } from '@design/primitives/Chip';
import { OptionRow } from '@design/primitives/OptionRow';
import { Sheet } from '@design/primitives/Sheet';
import { StampBadge } from '@design/patterns/StampBadge';
import type { Gender, PrivacyPresetId } from '@domain/index';
import { PRESET_LIST } from '@privacy/index';
import { SEED_CIRCLES } from '@data/seed/circles';
import { useStore } from '@state/store';
import { WelcomeCards } from '@screens/onboarding/WelcomeCards';
import { SafetySection } from './SafetySection';

/**
 * You, and who can see you.
 *
 * The privacy controls are presets rather than raw rules, and that is not a
 * simplification — it is the fix for the bug the whole engine exists to
 * prevent. Setting only "who can see me: women" leaves your own feed full of
 * men, which is not what anyone means when they choose it. A preset compiles
 * both halves atomically.
 */
export function YouScreen() {
  const me = useStore((s) => s.me);
  const mode = useStore((s) => s.account.mode);
  const myCircles = useStore((s) => s.myCircles);
  const setMe = useStore((s) => s.setMe);
  const setPrivacy = useStore((s) => s.setPrivacy);
  const startDemo = useStore((s) => s.startDemo);
  const signOut = useStore((s) => s.signOut);
  const [confirmOut, setConfirmOut] = useState(false);
  const [howOpen, setHowOpen] = useState(false);

  const togglePreset = (id: PrivacyPresetId) => {
    const has = me.privacy.presets.includes(id);
    setPrivacy({
      presets: has ? me.privacy.presets.filter((p) => p !== id) : [...me.privacy.presets, id],
    });
  };

  const circleName = (id: string) =>
    [...myCircles, ...SEED_CIRCLES].find((c) => String(c.id) === id)?.name ?? id;

  return (
    <>
      <section className="youhead">
        <Avatar spec={me.avatar} size="xl" label={me.displayName} />
        <div>
          <h2 className="youhead__name display">{me.displayName || 'Your name'}</h2>
          <p className="youhead__headline">{me.headline || 'One sentence goes here.'}</p>
          <div className="youhead__stamps">
            {me.verifications.map((v) => (
              <StampBadge
                key={String(v.id)}
                stamp={{
                  kind: v.kind,
                  display: {
                    label: v.providerId,
                    iconKey: v.kind,
                    tone: v.kind === 'government_eid' ? 'trust' : 'social',
                    explainer: '',
                    publicLabel: '',
                  },
                  ...(v.evidence?.handle ? { handle: v.evidence.handle } : {}),
                }}
              />
            ))}
          </div>
          <div className="panel__row">
            <Button size="sm" variant="secondary" onClick={() => (window.location.hash = '#/you/edit')}>
              Edit your card
            </Button>
          </div>
        </div>
      </section>

      <section className="panel">
        <h3 className="panel__title">Your accounts</h3>
        <p className="panel__note">
          Connect LinkedIn, Google, Facebook, Instagram, BankID or a work address. Others see
          that something was checked — never what, and never by whom.
        </p>
        <Button variant="secondary" full onClick={() => (window.location.hash = '#/verify')}>
          {me.verifications.length > 0
            ? `Manage ${me.verifications.length} connected`
            : 'Connect an account'}
        </Button>
      </section>

      <section className="panel">
        <h3 className="panel__title">You are</h3>
        <p className="panel__note">
          Used only to make the women-only setting work. It is never shown on your card, and it is
          never a matching signal.
        </p>
        <div className="panel__row">
          {(['woman', 'man', 'nonbinary', 'undisclosed'] as Gender[]).map((g) => (
            <ToggleChip key={g} selected={me.gender === g} onClick={() => setMe({ gender: g })}>
              {g === 'undisclosed' ? 'Rather not say' : g}
            </ToggleChip>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3 className="panel__title">Who can see you</h3>
        <p className="panel__note">
          Each of these works in both directions at once — it changes who sees you and who you
          see, together.
        </p>
        <div className="panel__stack">
          {PRESET_LIST.map((p) => (
            <OptionRow
              key={p.id}
              label={p.label}
              note={p.explainer}
              selected={me.privacy.presets.includes(p.id)}
              onClick={() => togglePreset(p.id)}
            />
          ))}
        </div>
      </section>

      <section className="panel">
        <h3 className="panel__title">Where you can be found</h3>
        <div className="panel__row">
          {(
            [
              ['onFlight', 'On my flight'],
              ['inTerminal', 'In my terminal'],
              ['inCity', 'In my city'],
              ['offTrip', 'When not travelling'],
            ] as const
          ).map(([key, label]) => (
            <ToggleChip
              key={key}
              selected={me.privacy.discoverability[key]}
              onClick={() =>
                setPrivacy({
                  discoverability: {
                    ...me.privacy.discoverability,
                    [key]: !me.privacy.discoverability[key],
                  },
                })
              }
            >
              {label}
            </ToggleChip>
          ))}
        </div>
        <p className="panel__note">
          &ldquo;When not travelling&rdquo; is off by default. Wingman is somewhere you appear
          because you are going somewhere — not a standing listing of yourself.
        </p>
      </section>

      <section className="panel">
        <h3 className="panel__title">Your circles</h3>
        {me.memberships.length === 0 ? (
          <p className="panel__note">None yet. Circles are under the shield tab.</p>
        ) : (
          <div className="panel__row">
            {me.memberships.map((m) => (
              <Chip key={String(m.circleId)} tone={m.display === 'show_badge' ? 'accent' : 'neutral'}>
                {circleName(String(m.circleId))} ·{' '}
                {m.display === 'show_badge' ? 'badge shown' : 'matching only'}
              </Chip>
            ))}
          </div>
        )}
      </section>

      <SafetySection />

      <section className="panel">
        <h3 className="panel__title">About Wingman</h3>
        <p className="panel__note">
          Organisers pay for circles; travellers never do, and there are no ads. Your profile
          lives on this device until Wingman has a server.
        </p>
        <Button variant="secondary" full onClick={() => setHowOpen(true)}>
          How Wingman works
        </Button>
      </section>

      <div className="panel">
        {mode === 'demo' ? (
          <Button variant="secondary" full onClick={() => (window.location.hash = startDemo())}>
            Reset the demo
          </Button>
        ) : (
          <Button variant="secondary" full onClick={() => setConfirmOut(true)}>
            Sign out and start over
          </Button>
        )}
      </div>

      <Sheet
        open={confirmOut}
        title="Start over?"
        onClose={() => setConfirmOut(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmOut(false)}>
              Keep my profile
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmOut(false);
                signOut();
                window.location.hash = '#/welcome';
              }}
            >
              Sign out
            </Button>
          </>
        }
      >
        <p className="sheet__body">
          Your profile, trips and conversations live only on this device. Signing out removes
          them here, and there is no copy anywhere else.
        </p>
      </Sheet>

      <Sheet open={howOpen} title="How Wingman works" onClose={() => setHowOpen(false)}>
        <WelcomeCards />
      </Sheet>
    </>
  );
}
