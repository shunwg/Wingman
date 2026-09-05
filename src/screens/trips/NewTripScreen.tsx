import type { Trip } from '@domain/index';
import { useStore } from '@state/store';
import { TripForm } from './TripForm';

/** `#/trip/new` and `#/trip/:id/edit`. The form, and the one sentence that explains the clock. */
export function NewTripScreen({ onDone, tripId }: { onDone: () => void; tripId?: string }) {
  const existing: Trip | undefined = useStore((s) => s.myTrips.find((t) => String(t.id) === tripId));
  return (
    <>
      <p className="screennote">
        Times are local to each airport. Once it is listed, people around this journey can find
        you, and you can hide it again any time from Trip.
      </p>
      <TripForm onDone={onDone} {...(existing ? { existing } : {})} />
    </>
  );
}
