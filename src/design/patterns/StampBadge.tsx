import type { PublicStamp, StampKind } from '@domain/verification';

/**
 * A verification badge.
 *
 * Renders from the provider's `display` descriptor and **never switches on a
 * provider id** — which is the mechanism that makes adding a provider a
 * zero-screen-edit change. An ESLint rule bans provider-id literals in screens
 * to keep it that way.
 *
 * Colour is never the only signal: each stamp carries its own glyph and a text
 * label, so it survives colour blindness and a monochrome screenshot alike.
 */

const GLYPH: Record<StampKind, string> = {
  government_eid: 'M8 1.5 2.5 4v4.2c0 3.4 2.3 6.5 5.5 7.3 3.2-.8 5.5-3.9 5.5-7.3V4L8 1.5Zm2.6 5.1-3.2 4a.7.7 0 0 1-1.1 0L5 9.4a.7.7 0 1 1 1-.9l.8.9 2.7-3.4a.7.7 0 1 1 1.1.7Z',
  social_account: 'M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm3.3 4.9-4 4.6a.7.7 0 0 1-1.1 0L4.7 9.3a.7.7 0 1 1 1.1-.9l1 1.2 3.4-3.9a.7.7 0 1 1 1.1.9Z',
  email_domain: 'M2 4.2c0-.7.6-1.2 1.3-1.2h9.4c.7 0 1.3.5 1.3 1.2v7.6c0 .7-.6 1.2-1.3 1.2H3.3c-.7 0-1.3-.5-1.3-1.2V4.2Zm1.8.3L8 7.9l4.2-3.4H3.8Z',
  phone: 'M5.2 2.3c.4-.4 1-.4 1.4 0l1.3 1.4c.4.4.4 1 0 1.4l-.7.7c.7 1.4 1.6 2.3 3 3l.7-.7c.4-.4 1-.4 1.4 0l1.4 1.3c.4.4.4 1 0 1.4l-.9.9c-.5.5-1.3.6-2 .3C7.6 10.7 5 8.1 4 5.1c-.3-.7-.2-1.4.3-2l.9-.8Z',
};

const KIND_LABEL: Record<StampKind, string> = {
  government_eid: 'ID verified',
  social_account: 'Account verified',
  email_domain: 'Work email verified',
  phone: 'Phone verified',
};

export interface StampBadgeProps {
  stamp: PublicStamp;
  /** Icon only, for the corner of a photo where space is tight. */
  compact?: boolean;
}

export function StampBadge({ stamp, compact }: StampBadgeProps) {
  const tone = stamp.display.tone === 'trust' ? 'trust' : 'neutral';
  const label = stamp.display.publicLabel || KIND_LABEL[stamp.kind];

  return (
    <span
      className={`stamp stamp--${tone} ${compact ? 'stamp--compact' : ''}`}
      title={stamp.display.explainer || label}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path d={GLYPH[stamp.kind]} fill="currentColor" />
      </svg>
      {compact ? <span className="visually-hidden">{label}</span> : <span>{label}</span>}
      {!compact && stamp.handle && <span className="stamp__handle mono">{stamp.handle}</span>}
    </span>
  );
}
