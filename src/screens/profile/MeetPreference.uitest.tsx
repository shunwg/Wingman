import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { meetPreference } from '@privacy/index';
import { resetStore, useStore } from '@state/store';
import { MeetPreference } from './MeetPreference';

describe('MeetPreference', () => {
  beforeEach(() => {
    resetStore();
    useStore.getState().startDemo();
  });

  it('shows all four options, including people who have not said', () => {
    render(<MeetPreference />);
    for (const label of ['Women', 'Men', 'Non-binary people', 'People who have not said']) {
      expect(screen.getByRole('button', { name: label, pressed: true })).toBeInTheDocument();
    }
  });

  it('writes a narrower set to both halves and says it works both ways', () => {
    render(<MeetPreference />);
    fireEvent.click(screen.getByRole('button', { name: 'Men' }));
    const p = useStore.getState().me.privacy;
    expect(p.audience.genders).toEqual(p.seeking.genders);
    expect(meetPreference(p)).toEqual(['woman', 'nonbinary', 'undisclosed']);
    expect(screen.getByText(/cannot see you either/)).toBeInTheDocument();
  });

  it('warns when people who have not said are left out', () => {
    render(<MeetPreference />);
    fireEvent.click(screen.getByRole('button', { name: 'People who have not said' }));
    expect(screen.getByText(/Most people have not said/)).toBeInTheDocument();
  });

  it('refuses to untick the last one', () => {
    render(<MeetPreference />);
    for (const label of ['Men', 'Non-binary people', 'People who have not said']) {
      fireEvent.click(screen.getByRole('button', { name: label }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Women' }));
    expect(meetPreference(useStore.getState().me.privacy)).toEqual(['woman']);
  });

  it('names the Discover lens as a different thing', () => {
    render(<MeetPreference />);
    expect(screen.getByText(/not the women-only chip on Discover/)).toBeInTheDocument();
  });
});
