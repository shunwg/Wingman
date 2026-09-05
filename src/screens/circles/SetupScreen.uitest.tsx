import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetStore, useStore } from '@state/store';
import { SetupScreen } from './SetupScreen';

describe('SetupScreen', () => {
  beforeEach(() => {
    resetStore();
  });

  it('counts a pasted list, drops duplicates, and stores hashes only', async () => {
    render(<SetupScreen onDone={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('What is it called?'), {
      target: { value: 'Oslo Business Forum 2026' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    fireEvent.change(screen.getByLabelText('Paste the list'), {
      target: { value: 'anna@example.no, Bjorn@Example.no\nanna@example.no\nnot-an-email' },
    });
    expect(screen.getByRole('status')).toHaveTextContent('2 addresses, 1 duplicate removed, 1 skipped');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    fireEvent.click(screen.getByRole('button', { name: 'Open the circle' }));
    await waitFor(() => expect(screen.getByText(/is open/)).toBeInTheDocument());

    const circle = useStore.getState().myCircles[0]!;
    expect(circle.admission.kind).toBe('invite_list');
    if (circle.admission.kind === 'invite_list') {
      expect(circle.admission.emailHashes).toHaveLength(2);
      for (const h of circle.admission.emailHashes) expect(h).toMatch(/^[0-9a-f]{64}$/);
      expect(JSON.stringify(circle)).not.toContain('@');
    }
    expect(circle.badges?.map((b) => b.id)).toEqual(['organiser', 'speaker', 'sponsor']);
    const mine = useStore.getState().me.memberships.find((m) => String(m.circleId) === String(circle.id));
    expect(mine?.badgeIds).toEqual(['organiser']);
    expect(screen.getByText("Everyone here was on the organiser's list.")).toBeInTheDocument();
  });
});
