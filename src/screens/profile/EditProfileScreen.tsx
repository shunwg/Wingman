import { useState } from 'react';
import { Button } from '@design/primitives/Button';
import { useStore } from '@state/store';
import { ProfileFields } from './ProfileFields';
import { WorkFields } from './WorkFields';
import { useProfileDrafts, useSaveProfile, validateProfile } from './useProfileDraft';

/**
 * `#/you/edit`. The same two field groups as signup, committed on Save.
 *
 * A route rather than inline editing on You: You stays a summary, and edits
 * land in persisted state once, not on every keystroke.
 */
export function EditProfileScreen({ onDone }: { onDone: () => void }) {
  const seed = useStore((s) => s.me.avatar.seed);
  const { profile, work } = useProfileDrafts();
  const { saveProfile, saveWork } = useSaveProfile();
  const [p, setP] = useState(profile);
  const [w, setW] = useState(work);
  const [attempted, setAttempted] = useState(false);

  const errors = validateProfile(p);
  const ok = Object.keys(errors).length === 0;

  return (
    <div className="signup">
      <ProfileFields draft={p} errors={attempted ? errors : {}} avatarSeed={seed} onChange={setP} />
      <h3 className="panel__title">Work</h3>
      <WorkFields draft={w} onChange={setW} />
      <div className="signup__actions">
        <Button variant="secondary" size="lg" onClick={onDone}>
          Cancel
        </Button>
        <Button
          size="lg"
          onClick={() => {
            setAttempted(true);
            if (!ok) return;
            saveProfile(p);
            saveWork(w);
            onDone();
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
