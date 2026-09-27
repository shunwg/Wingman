import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetStore, useStore } from '@state/store';
import { DemoEntry } from './DemoEntry';

describe('#/demo over a real profile', () => {
  beforeEach(() => {
    resetStore();
  });

  it('asks before replacing it — the link used to wipe it silently', () => {
    act(() => {
      useStore.getState().startDemo();
      useStore.setState((s) => ({ account: { ...s.account, mode: 'local' } }));
    });
    const before = useStore.getState().me.id;
    render(<DemoEntry />);
    expect(screen.getByText('Replace your profile with the demo?')).toBeInTheDocument();
    expect(useStore.getState().account.mode).toBe('local');
    expect(useStore.getState().me.id).toBe(before);
  });

  it('goes straight to the demo when there is nothing to lose', () => {
    render(<DemoEntry />);
    expect(useStore.getState().account.mode).toBe('demo');
  });
});
