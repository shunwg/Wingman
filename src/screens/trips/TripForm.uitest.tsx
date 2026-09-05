import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetStore, useStore } from '@state/store';
import { TripForm } from './TripForm';

/**
 * The form is the first thing a new person meets after onboarding; it must
 * enable itself once the required fields are in, name the field that is wrong,
 * and never throw away what was typed.
 */
describe('TripForm', () => {
  beforeEach(() => {
    resetStore();
  });

  const fill = () => {
    fireEvent.change(screen.getByLabelText('From'), { target: { value: 'OSL' } });
    fireEvent.click(screen.getByRole('option', { name: /OSL/ }));
    fireEvent.change(screen.getByLabelText('To'), { target: { value: 'CPH' } });
    fireEvent.click(screen.getByRole('option', { name: /CPH/ }));
    fireEvent.change(screen.getByLabelText('Departs'), { target: { value: '08:40' } });
    fireEvent.change(screen.getByLabelText('Arrives'), { target: { value: '10:00' } });
  };

  it('enables submit once the required fields are in, and lists the trip', () => {
    const onDone = vi.fn();
    render(<TripForm onDone={onDone} />);
    const submit = screen.getByRole('button', { name: 'List this trip' });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Flight number'), { target: { value: 'SK1465' } });
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-18' } });
    fill();
    expect(submit).toBeEnabled();

    fireEvent.click(submit);
    expect(onDone).toHaveBeenCalledTimes(1);
    const trips = useStore.getState().myTrips;
    expect(trips).toHaveLength(1);
    expect(trips[0]!.segments[0]!.flightNo).toBe('SK1465');
    expect(trips[0]!.segments[0]!.departUtc).toBe('2026-09-18T06:40:00Z');
    expect(trips[0]!.stays[0]!.dates.to).toBe('2026-09-20');
  });

  it('names the field that is wrong and keeps what was typed', () => {
    const onDone = vi.fn();
    render(<TripForm onDone={onDone} />);
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-08-01' } });
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'List this trip' }));

    expect(onDone).not.toHaveBeenCalled();
    const alerts = screen.getAllByRole('alert').map((a) => a.textContent).join(' ');
    expect(alerts).toMatch(/before 2026-09-02/);
    expect(screen.getByLabelText('Departs')).toHaveValue('08:40');
    expect(useStore.getState().myTrips).toHaveLength(0);
  });
});
