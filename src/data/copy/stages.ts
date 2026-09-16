import type { JourneyStage } from '@domain/index';

/**
 * What each stage says, in both directions.
 *
 * Two phrasings per stage because the same event reads differently depending on
 * who moved: "You're through security" and "Jonas is through security" are the
 * same fact and different sentences, and a room that renders one of them for
 * both people sounds like a machine.
 *
 * `rail` is a fourth, shorter voice, present only where it is needed. A rail
 * is an index — five or six columns across 362px — and a button is an action;
 * "Through passport control" is right on a button and wraps to three lines in
 * a 60px column, which throws the whole row out of alignment. Where a stage's
 * button label already fits, there is no `rail` and the button label is used.
 *
 * Kept in `data/copy/` rather than in the component so the wording can be
 * changed — or translated — without touching a screen.
 */
export const STAGE_COPY: Record<
  JourneyStage,
  { button: string; mine: string; theirs: string; rail?: string; tone?: 'warn' }
> = {
  heading_to_airport: { rail: 'Setting off',
    button: 'On my way',
    mine: "You're on your way to the airport",
    theirs: 'is on their way to the airport',
  },
  in_car: { button: 'In the car', mine: "You're in the car", theirs: 'is in the car' },
  checked_in: { button: 'Checked in', mine: "You're checked in", theirs: 'is checked in' },
  through_security: { rail: 'Security',
    button: 'Through security',
    mine: "You're through security",
    theirs: 'is through security',
  },
  in_lounge: { button: 'In the lounge', mine: "You're in the lounge", theirs: 'is in the lounge' },
  at_gate: { rail: 'Gate', button: 'At the gate', mine: "You're at the gate", theirs: 'is at the gate' },
  boarded: { button: 'Boarded', mine: "You've boarded", theirs: 'has boarded' },
  landed: { button: 'Landed', mine: "You've landed", theirs: 'has landed' },
  through_immigration: { rail: 'Passport',
    button: 'Through passport control',
    mine: "You're through passport control",
    theirs: 'is through passport control',
  },
  through_baggage: { rail: 'Bags',
    button: 'Got my bags',
    mine: "You've got your bags",
    theirs: 'has their bags',
  },
  at_meeting_point: { rail: 'Meeting point',
    button: "I'm here",
    mine: "You're at the meeting point",
    theirs: 'is at the meeting point',
  },
  // The two that matter most and are hardest to send. Both are one tap, because
  // the alternative is someone drafting an apology while the other person waits.
  running_late: {
    button: 'Running late',
    mine: "You said you're running late",
    theirs: 'is running late',
    tone: 'warn',
  },
  cannot_make_it: {
    button: "Can't make it",
    mine: "You said you can't make it",
    theirs: "can't make it",
    tone: 'warn',
  },
};

/**
 * Which buttons to offer, given where they already are.
 *
 * Airside and landside are different halves of a journey and offering all nine
 * at once makes the room a form. "Running late" and "Can't make it" are always
 * available, because the moment you need them is never the moment you planned
 * for.
 */
export function stagesFor(current: JourneyStage | undefined): JourneyStage[] {
  const departure: JourneyStage[] = ['checked_in', 'through_security', 'in_lounge', 'at_gate', 'boarded'];
  const arrival: JourneyStage[] = ['landed', 'through_immigration', 'through_baggage', 'at_meeting_point'];
  const always: JourneyStage[] = ['running_late', 'cannot_make_it'];

  if (!current) return [...departure.slice(0, 3), ...always];
  if (departure.includes(current)) {
    const i = departure.indexOf(current);
    const next = departure.slice(i + 1, i + 3);
    return [...(next.length ? next : arrival.slice(0, 2)), ...always];
  }
  const i = arrival.indexOf(current);
  return [...arrival.slice(i + 1, i + 3), ...always];
}
