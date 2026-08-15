import type { ReactNode } from 'react';
import type { RedactedPerson } from '@domain/person';
import { isRedacted } from '@domain/person';
import { Avatar } from '../primitives/Avatar';
import { Chip } from '../primitives/Chip';
import { StampBadge } from './StampBadge';

/**
 * The person card.
 *
 * This is the object that makes Wingman read as a dating app before a single
 * word is processed: a photo filling the frame, a name and one line at the
 * base, everything else deferred. That is deliberate — the visual grammar is
 * borrowed because it is the one people already know how to use.
 *
 * The prop type is `RedactedPerson`, never `Person`, and an ESLint rule stops
 * anyone importing `Person` into this folder. So a leak here is not a
 * forgotten conditional — it requires deliberately defeating the type system.
 *
 * Withheld fields render as a stated absence ("shown once you both agree")
 * rather than as an unexplained gap. People trust a system that tells them
 * what it is holding back more than one that quietly shows nothing.
 */

export interface PersonCardProps {
  person: RedactedPerson;
  /** One line of travel context — "On your flight · 9h in the air". */
  context?: string;
  /** Why they are here. Shown under the fold on the detail view. */
  footer?: ReactNode;
  onClick?: () => void;
  /** `feed` is the tall photo-first card; `row` is the compact list form. */
  layout?: 'feed' | 'row';
}

const HIDDEN_NAME = 'Name shown once you both agree';

export function PersonCard({ person, context, footer, onClick, layout = 'feed' }: PersonCardProps) {
  const name = isRedacted(person.displayName) ? null : person.displayName;
  const headline = isRedacted(person.headline) ? null : person.headline;
  const professional = isRedacted(person.professional) ? null : person.professional;

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      className={`pcard pcard--${layout}`}
      {...(onClick ? { type: 'button' as const, onClick } : {})}
    >
      <div className="pcard__photo">
        <Avatar
          spec={person.avatar}
          shape="photo"
          size="full"
          {...(name ? { label: name } : {})}
        />

        {/* The feed card overlays its caption on the photo — that framing is
            what makes it read as a dating-app card. The row card cannot: at
            96px the text would sit on top of the face. So it moves into the
            body instead of being shrunk until it is unreadable. */}
        {layout === 'feed' && (
          <>
            <div className="pcard__scrim" aria-hidden="true" />
            {person.stamps.length > 0 && (
              <div className="pcard__stamps">
                {person.stamps.slice(0, 3).map((s, i) => (
                  <StampBadge key={`${s.kind}-${s.handle ?? i}`} stamp={s} compact />
                ))}
              </div>
            )}
            <div className="pcard__caption">
              <h3 className="pcard__name display">
                {name ?? <span className="pcard__name--withheld">{HIDDEN_NAME}</span>}
              </h3>
              {context && <p className="pcard__context mono">{context}</p>}
            </div>
          </>
        )}
      </div>

      <div className="pcard__body">
        {layout === 'row' && (
          <div className="pcard__rowhead">
            <h3 className="pcard__name display">
              {name ?? <span className="pcard__name--withheld">{HIDDEN_NAME}</span>}
            </h3>
            {context && <p className="pcard__context pcard__context--row mono">{context}</p>}
            {person.stamps.length > 0 && (
              <div className="pcard__rowstamps">
                {person.stamps.slice(0, 3).map((s, i) => (
                  <StampBadge key={`${s.kind}-${s.handle ?? i}`} stamp={s} compact />
                ))}
              </div>
            )}
          </div>
        )}

        {headline && <p className="pcard__headline">{headline}</p>}

        {professional && (professional.title || professional.industry) && (
          <p className="pcard__work">
            {professional.title ?? professional.industry}
            {professional.company ? ` · ${professional.company}` : ''}
          </p>
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
      </div>
    </Wrapper>
  );
}
