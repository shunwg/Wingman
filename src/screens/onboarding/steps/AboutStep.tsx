import { useEffect, useRef, useState } from 'react';
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
  const formRef = useRef<HTMLDivElement>(null);
  // Set on a failing click, read and cleared on the render it caused. A
  // synchronous `querySelector` right after `setAttempted(true)` would run
  // against the pre-update DOM — `errors` on this render is still `{}` until
  // React commits the state change — so the field carrying `aria-invalid`
  // does not exist yet to find.
  const pendingFocus = useRef(false);

  const errors = validateProfile(draft);
  const ok = Object.keys(errors).length === 0;

  useEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  });

  return (
    <>
      <p className="signup__lede">
        A first name and one sentence is what a stranger sees. The rest waits until you both
        agree to meet.
      </p>
      <div ref={formRef}>
        <ProfileFields
          draft={draft}
          errors={attempted ? errors : {}}
          avatarSeed={seed}
          onChange={setDraft}
        />
      </div>
      <div className="signup__actions">
        <Button
          size="lg"
          onClick={() => {
            setAttempted(true);
            if (!ok) {
              // A failed Next moved no focus and gave no summary — keyboard
              // and screen-reader users were left on the button with the
              // errors rendered off-screen above. `[aria-invalid="true"]` is
              // the same attribute `Field` now sets on the control itself, so
              // this stays correct as fields are added or reordered.
              pendingFocus.current = true;
              return;
            }
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
