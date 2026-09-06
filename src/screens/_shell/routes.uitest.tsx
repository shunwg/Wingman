import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetStore, useStore } from '@state/store';
import { Router } from './routes';

/**
 * The first-run gate, and the one thing it must never lose: an invitation
 * opened before the person had a profile.
 */
describe('Router gate', () => {
  beforeEach(() => {
    resetStore();
    window.location.hash = '';
  });

  it('sends a fresh install to welcome and remembers the invitation', async () => {
    window.location.hash = '#/join/ABC123';
    render(<Router />);
    await screen.findByRole('button', { name: 'Create my profile' });
    expect(window.location.hash).toBe('#/welcome');
    expect(useStore.getState().account.returnTo).toBe('#/join/ABC123');
  });

  it('the demo path lands back on the invitation', async () => {
    window.location.hash = '#/join/ABC123';
    render(<Router />);
    await screen.findByRole('button', { name: 'Create my profile' });
    let to = '';
    act(() => {
      to = useStore.getState().startDemo();
    });
    expect(to).toBe('#/join/ABC123');
    expect(useStore.getState().account.returnTo).toBeUndefined();
  });

  it('does not send the board to welcome once onboarded', async () => {
    act(() => {
      useStore.getState().startDemo();
    });
    window.location.hash = '#/';
    render(<Router />);
    await screen.findByRole('heading', { name: /^Good/ });
    expect(window.location.hash).toBe('#/');
  });

  it('the design gallery is reachable with a blank store', async () => {
    window.location.hash = '#/_design';
    render(<Router />);
    await screen.findByRole('heading', { name: 'Wingman design' });
    expect(window.location.hash).toBe('#/_design');
  });
});
