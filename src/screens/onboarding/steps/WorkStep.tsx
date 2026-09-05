import { useState } from 'react';
import { Button } from '@design/primitives/Button';
import { WorkFields } from '@screens/profile/WorkFields';
import { useProfileDrafts, useSaveProfile } from '@screens/profile/useProfileDraft';

/** The professional card. Skippable — a blank one still matches on everything. */
export function WorkStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const { work } = useProfileDrafts();
  const { saveWork } = useSaveProfile();
  const [draft, setDraft] = useState(work);

  return (
    <>
      <p className="signup__lede">
        What you are working on sits under your sentence on the card. It is the second thing
        anyone reads.
      </p>
      <WorkFields draft={draft} onChange={setDraft} />
      <div className="signup__actions">
        <Button variant="secondary" size="lg" onClick={onSkip}>
          Skip for now
        </Button>
        <Button
          size="lg"
          onClick={() => {
            saveWork(draft);
            onNext();
          }}
        >
          Next
        </Button>
      </div>
    </>
  );
}
