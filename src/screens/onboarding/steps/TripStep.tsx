import { Button } from '@design/primitives/Button';
import { TripForm } from '@screens/trips/TripForm';

/** The same form as the Trip tab. Skippable — the board says what to do without one. */
export function TripStep({ onFinish }: { onFinish: () => void }) {
  return (
    <>
      <p className="signup__lede">
        Wingman only shows you people around a journey. Add the next one and the board fills
        in.
      </p>
      <TripForm
        onDone={onFinish}
        submitLabel="List it"
        secondary={
          <Button variant="secondary" size="lg" onClick={onFinish}>
            Add a flight later
          </Button>
        }
      />
    </>
  );
}
