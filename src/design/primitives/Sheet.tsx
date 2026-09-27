import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * A bottom sheet.
 *
 * One question, one decision, then it goes away. Escape closes it, the scrim
 * closes it, and focus lands on the panel when it opens so a keyboard or a
 * screen reader is inside the dialog rather than behind it.
 *
 * And it drags closed, like every sheet on the phone it is designed for. The
 * native prototype had this and the web app did not, and it was most of what
 * made the prototype's sheets feel like part of the phone rather than a web
 * dialog. The drag lives on the handle and the title only — never the body —
 * so it cannot fight the sheet's own scrolling or a text field.
 */
export interface SheetProps {
  open: boolean;
  title: string;
  /** Accessible name when the title alone would be ambiguous. */
  label?: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
}

/** Far enough down that it was meant. */
const DISMISS_PX = 96;
/** Or fast enough, in px per ms, even if it was short. */
const FLICK = 0.6;

export function Sheet({ open, title, label, onClose, children, actions }: SheetProps) {
  const panel = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; dy: number; lastY: number; lastT: number; v: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    drag.current = { startY: e.clientY, dy: 0, lastY: e.clientY, lastT: e.timeStamp, v: 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = panel.current;
    if (p) {
      // Follow the finger exactly; any easing here reads as lag.
      p.style.animation = 'none';
      p.style.transition = 'none';
    }
  };

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const p = panel.current;
    if (!d || !p) return;
    // Down only. A sheet pulled up past its own height has nowhere to go.
    d.dy = Math.max(0, e.clientY - d.startY);
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.v = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    p.style.transform = d.dy > 0 ? `translateY(${d.dy}px)` : '';
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    const p = panel.current;
    if (!d || !p) return;
    if (d.dy > DISMISS_PX || (d.dy > 24 && d.v > FLICK)) {
      onClose();
      return;
    }
    // Not far enough: back where it was. Reduced motion keeps the gesture and
    // drops the travel — it snaps rather than springs.
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    p.style.transition = reduced ? 'none' : 'transform var(--dur-sheet) var(--ease-drawer)';
    p.style.transform = '';
  };

  /*
   * Rendered at the end of <body>, not where it was opened. A sheet opened from
   * inside anything with its own stacking context — a profile's "…" menu at
   * z-index 2, a screen mid-animation — was trapped under the tab bar, which
   * then covered Report and took the tap. A portal cannot be trapped.
   */
  return createPortal(
    <div className="sheet" role="dialog" aria-modal="true" aria-label={label ?? title}>
      <div className="sheet__scrim" onClick={onClose} />
      <div className="sheet__panel" ref={panel} tabIndex={-1}>
        <div
          className="sheet__head"
          data-testid="sheet-drag"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <span className="sheet__grab" aria-hidden="true" />
          <h2 className="sheet__title display">{title}</h2>
        </div>
        {children}
        {actions && <div className="sheet__actions">{actions}</div>}
      </div>
    </div>,
    document.body,
  );
}
