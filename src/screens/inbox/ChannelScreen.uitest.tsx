import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetStore, useStore } from '@state/store';
import { ChannelScreen } from './ChannelScreen';

/**
 * The meet room after Priya's request is accepted. Her terminal must not
 * appear until she posts an update; hiding her from the header must leave
 * the room.
 */
describe('ChannelScreen (meet)', () => {
  beforeEach(() => {
    resetStore();
    act(() => {
      useStore.getState().startDemo();
      useStore.getState().advanceRequest('req_seed_priya', 'accepted', useStore.getState().me.id);
    });
  });

  it('shows no terminal for the other person before their first update', () => {
    render(<ChannelScreen channelId="meet:req_seed_priya" onBack={() => {}} />);
    expect(screen.getByText('Location appears once they post an update')).toBeInTheDocument();
    // Priya is at Heathrow T2 by her flight; her card must not say so yet. Mine may.
    const theirs = document.querySelectorAll('.presence')[0]!;
    expect(theirs.textContent).toContain('Priya');
    expect(theirs.querySelector('.chip')).toBeNull();
    expect(screen.getByText(/You both said yes/)).toBeInTheDocument();
  });

  it('hiding them from the header leaves the room and blocks them', () => {
    const onBack = vi.fn();
    render(<ChannelScreen channelId="meet:req_seed_priya" onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: 'More about Priya' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Hide Priya from me' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(useStore.getState().me.blocked.map(String)).toContain('priya');
  });

  it('a posted stage carries my terminal and reads as my sentence', () => {
    render(<ChannelScreen channelId="meet:req_seed_priya" onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Through security' }));
    expect(screen.getAllByText(/through security/i).length).toBeGreaterThan(0);
    const last = useStore.getState().messages.at(-1)!;
    expect(last.body.kind).toBe('stage');
    if (last.body.kind === 'stage') expect(last.body.terminal).toBe('T2');
  });
});

describe('ChannelScreen (circle)', () => {
  beforeEach(() => {
    resetStore();
    act(() => {
      useStore.getState().startDemo();
    });
  });

  it('shows the pin, the seeded history, and answers a message in the demo', () => {
    render(<ChannelScreen channelId="circle:insead" onBack={() => {}} />);
    expect(screen.getByText('Pinned')).toBeInTheDocument();
    expect(screen.getByText(/Lau Pa Sat gets loud/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Say something'), { target: { value: 'Landing Wednesday too.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByText('Landing Wednesday too.')).toBeInTheDocument();
    const mine = useStore.getState().messages.filter((m) => String(m.channelId) === 'circle:insead');
    expect(mine).toHaveLength(2); // mine + the scripted reply
  });
});
