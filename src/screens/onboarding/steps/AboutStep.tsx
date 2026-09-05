import { useState } from 'react';
import { Button } from '@design/primitives/Button';
import { useStore } from '@state/store';
import { ProfileFields } from '@screens/profile/ProfileFields';
import { useProfileDrafts, useSaveProfile, validateProfile } from '@screens/profile/useProfileDraft';

/** Name, one sentence, a photo if you like. Not skippable: a card needs a name. */
export function AboutStep({ onNext }: { onNext: () => void }) {
  const seed = useStore((s) => s.me.avatar.seed);
  const { profile } = useProfileDrafts();
  const { saveProfile } = useSaveProfile();
  const [draft, setDraft] = useState(profile);
  const [attempted, setAttempted] = useState(false);

  const errors = validateProfile(draft);
  const ok = Object.keys(errors).length === 0;

  return (
    <>
      <p className="signup__lede">
        A first name and one sentence is what a stranger sees. The rest waits until you both
        agree to meet.
      </p>
      <ProfileFields
        draft={draft}
        errors={attempted ? errors : {}}
        avatarSeed={seed}
        onChange={setDraft}
      />
      <div className="signup__actions">
        <Button
          size="lg"
          onClick={() => {
            setAttempted(true);
            if (!ok) return;
            saveProfile(draft);
            onNext();
          }}
        >
          Next
        </Button>
      </div>
    </>
  );
}
