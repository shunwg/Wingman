import { TripForm } from './TripForm';

/** `#/trip/new`. The form, and the one sentence that explains the clock. */
export function NewTripScreen({ onDone }: { onDone: () => void }) {
  return (
    <>
      <p className="screennote">
        Times are local to each airport. Once it is listed, people around this journey can find
        you — and you can hide it again any time from Trip.
      </p>
      <TripForm onDone={onDone} />
    </>
  );
}
