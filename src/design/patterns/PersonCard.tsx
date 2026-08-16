import type { ReactNode } from 'react';
import type { RedactedPerson } from '@domain/person';
import { isRedacted } from '@domain/person';
import { Avatar } from '../primitives/Avatar';
import { Chip } from '../primitives/Chip';
import { StampBadge } from './StampBadge';

/**
 * The person card.
 *
 * The hierarchy here *is* the product's positioning, and it was rebuilt once.
 *
 * The first version filled the frame with a photograph and hung a name over the
 * bottom of it — the dating-app grammar, borrowed because everyone already
 * knows how to use it. It worked, and it worked too well: a wall of faces
 * invites you to judge faces, and no amount of professional copy underneath
 * undoes what the layout already said.
 *
 * So the photograph is now identity rather than content — 56px, beside the
 * name, the size of a face you glance at to recognise someone rather than one
 * you assess. The largest thing on the card is the person's own sentence. Below
 * it sits what they do and what they are working on. You decide whether to
 * cross a terminal for someone based on what they said and what they are
 * building, and the layout should make that the path of least resistance.
 *
 * Everyone still gets a photo. It is just no longer the argument.
 *
 * The prop type is `RedactedPerson`, never `Person`, and an ESLint rule stops
 * anyone importing `Person` into this folder. So a leak here is not a
 * forgotten conditional — it requires deliberately defeating the type system.
 *
 * Withheld fields render as a stated absence ("shown once you both agree")
 * rather than as an unexplained gap. People trust a system that tells them what
 * it is holding back more than one that quietly shows nothing.
 */

export interface PersonCardProps {
  person: RedactedPerson;
  /** One line of travel context — "On your flight · 13h in the air". */
  context?: string;
  /**
   * Which of the viewer's own journeys this suggestion belongs to — "SQ317".
   *
   * A flight code rather than a colour swatch. Colour would need three or four
   * new hues to stay distinguishable, and the palette is four in total by
   * design; more importantly a colour has to be learned before it means
   * anything, whereas the code is the same string the person is already looking
   * for on a departure board. It is set in mono, like every other flight fact
   * in this app.
   */
  tripCode?: string;
  /** Why they are here. Shown under the fold on the detail view. */
  footer?: ReactNode;
  onClick?: () => void;
  /** `feed` is the full card; `row` is the compact list form. */
  layout?: 'feed' | 'row';
}

const HIDDEN_NAME = 'Name shown once you both agree';

export function PersonCard({
  person,
  context,
  tripCode,
  footer,
  onClick,
  layout = 'feed',
}: PersonCardProps) {
  const name = isRedacted(person.displayName) ? null : person.displayName;
  const headline = isRedacted(person.headline) ? null : person.headline;
  const professional = isRedacted(person.professional) ? null : person.professional;

  /*
   * The role, and only the role.
   *
   * This was "Principal engineer · Energy". At 390px it wrapped, and no amount
   * of non-breaking-space fiddling makes a line ending in a lone "·" look like
   * anything other than a bug. The industry was also the weaker half: "Energy"
   * is a category, "Principal engineer" is a person, and "Working on
   * cross-border capacity models" two lines below already says the sector far
   * better than a one-word label does. Industry stays on the profile.
   */
  const role = professional?.title ?? professional?.industry;

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      className={`pcard pcard--${layout}`}
      {...(onClick ? { type: 'button' as const, onClick } : {})}
    >
      {tripCode && (
        <p className="pcard__trip mono">
          <span className="visually-hidden">For your trip </span>
          {tripCode}
        </p>
      )}

      <header className="pcard__id">
        <Avatar spec={person.avatar} size="md" {...(name ? { label: name } : {})} />

        <div className="pcard__idtext">
          <h3 className={`pcard__name ${name ? '' : 'pcard__name--withheld'}`}>
            {name ?? HIDDEN_NAME}
          </h3>
          {role && <p className="pcard__role">{role}</p>}
          {context && <p className="pcard__context mono">{context}</p>}
        </div>

        {person.stamps.length > 0 && (
          <div className="pcard__stamps">
            {person.stamps.slice(0, 3).map((s, i) => (
              <StampBadge key={`${s.kind}-${s.handle ?? i}`} stamp={s} compact />
            ))}
          </div>
        )}
      </header>

      {/* Their own sentence, and the biggest thing on the card. */}
      {headline && <p className="pcard__headline">{headline}</p>}

      {professional?.workingOn && (
        <div className="pcard__work">
          <span className="pcard__worklabel">Working on</span>
          <span className="pcard__workvalue">{professional.workingOn}</span>
        </div>
      )}

      {person.circles.length > 0 && (
        <div className="pcard__chips">
          {person.circles.map((c) => (
            <Chip key={c.circleId} tone="neutral">
              {c.shortName}
            </Chip>
          ))}
        </div>
      )}

      {footer}
    </Wrapper>
  );
}
