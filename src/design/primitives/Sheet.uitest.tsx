import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Sheet } from './Sheet';

// jsdom has no PointerEvent, so without this the events arrive with no
// clientY or button at all — and a "springs back" test passes for the wrong
// reason. MouseEvent carries both.
beforeAll(() => {
  if (!('PointerEvent' in window)) {
    class PointerEventShim extends MouseEvent {
      pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
      }
    }
    (window as unknown as { PointerEvent: typeof PointerEventShim }).PointerEvent = PointerEventShim;
  }
});

const drag = (from: number, to: number) => {
  const head = screen.getByTestId('sheet-drag');
  fireEvent.pointerDown(head, { clientY: from, button: 0, pointerId: 1 });
  fireEvent.pointerMove(head, { clientY: to, pointerId: 1 });
  fireEvent.pointerUp(head, { clientY: to, pointerId: 1 });
};

describe('Sheet drags closed', () => {
  it('closes when pulled well down by the handle', () => {
    const onClose = vi.fn();
    render(
      <Sheet open title="Suggest a time" onClose={onClose}>
        <p>body</p>
      </Sheet>,
    );
    drag(100, 260);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('springs back from a nudge', () => {
    const onClose = vi.fn();
    render(
      <Sheet open title="Suggest a time" onClose={onClose}>
        <p>body</p>
      </Sheet>,
    );
    drag(100, 120);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores an upward pull', () => {
    const onClose = vi.fn();
    render(
      <Sheet open title="Suggest a time" onClose={onClose}>
        <p>body</p>
      </Sheet>,
    );
    drag(300, 40);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('still closes on Escape, for a keyboard', () => {
    const onClose = vi.fn();
    render(
      <Sheet open title="Suggest a time" onClose={onClose}>
        <p>body</p>
      </Sheet>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('Sheet cannot be trapped', () => {
  it('renders at the end of <body>, outside whatever opened it (round 5)', () => {
    // Opened from inside a stacking context — a profile's "…" menu sits at
    // z-index 2 — a sheet rendered in place ended up under the tab bar.
    const { container } = render(
      <div style={{ position: 'absolute', zIndex: 2 }}>
        <Sheet open title="Report Priya" onClose={() => {}}>
          <p>body</p>
        </Sheet>
      </div>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Report Priya' });
    expect(container.contains(dialog)).toBe(false);
    expect(dialog.parentElement).toBe(document.body);
  });
});
