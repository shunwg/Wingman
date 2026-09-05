import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetStore, useStore } from '@state/store';
import { AdminScreen } from './AdminScreen';

describe('AdminScreen', () => {
  beforeEach(() => {
    resetStore();
    act(() => {
      useStore.getState().startDemo();
    });
  });

  it('is organisers only', () => {
    render(<AdminScreen id="insead" onBack={vi.fn()} />);
    expect(screen.getByText('Organisers only')).toBeInTheDocument();
  });

  it('pins a note that lands on the circle', () => {
    act(() => {
      useStore.getState().createCircle({
        id: 'obf' as never,
        name: 'Oslo Business Forum',
        shortName: 'OBF',
        kind: 'conference',
        admission: { kind: 'invite_code' },
        crestSeed: 'obf',
        membersOnly: false,
        memberCount: 1,
        createdAt: '2026-09-02T16:30:00Z' as never,
      });
    });
    render(<AdminScreen id="obf" onBack={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Announcement'), { target: { value: 'Badges at the desk from 07:30.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pin it' }));
    expect(useStore.getState().announcements.obf?.text).toBe('Badges at the desk from 07:30.');
    expect(screen.getByRole('button', { name: 'Pinned' })).toBeInTheDocument();
  });
});
