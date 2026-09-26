import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetStore, useStore } from '@state/store';
import { RideScreen } from './RideScreen';

/**
 * The car screen's two new promises: what it costs is on the screen before
 * anyone has to ask, and where to meet the car is for the people in it only.
 */
describe('RideScreen — money and the pickup note', () => {
  beforeEach(() => {
    resetStore();
    act(() => {
      useStore.getState().startDemo();
    });
  });

  const open = (id: string) => render(<RideScreen rideId={id} onBack={vi.fn()} onOpenRoom={vi.fn()} />);

  it('quotes a browser the share they would pay with them in', () => {
    open('ride_jonas_marina');
    // SGD 36 across Jonas and you. The code, not a bare "$": Singapore, US
    // and Hong Kong dollars all narrow to the same symbol.
    expect(screen.getAllByText(/About SGD.18 each with you in/).length).toBeGreaterThan(0);
  });

  it('never shows the pickup note to someone not in the car', () => {
    open('ride_jonas_marina');
    expect(screen.queryByText(/INSEAD tote/)).toBeNull();
    expect(screen.getByText(/shared with the people in it, once you are/)).toBeInTheDocument();
  });

  it('shows it the moment you are in', () => {
    act(() => useStore.getState().claimSeat('ride_jonas_marina'));
    open('ride_jonas_marina');
    expect(screen.getByText(/INSEAD tote/)).toBeInTheDocument();
  });

  it('lets the host state an estimate, and shows each person’s share of it', () => {
    open('ride_you_cph');
    fireEvent.click(screen.getByRole('button', { name: 'Add an estimate' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '400' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(useStore.getState().rides.find((r) => String(r.id) === 'ride_you_cph')?.fare).toEqual({
      amountMinor: 40000,
      currency: 'DKK',
    });
  });

  it('asks before calling the car off', () => {
    open('ride_you_cph');
    fireEvent.click(screen.getByRole('button', { name: 'Call off the car' }));
    expect(useStore.getState().rides.find((r) => String(r.id) === 'ride_you_cph')?.status).toBe('open');
    fireEvent.click(screen.getByRole('button', { name: 'Call it off' }));
    expect(useStore.getState().rides.find((r) => String(r.id) === 'ride_you_cph')?.status).toBe('cancelled');
  });
});
