import { useState } from 'react';
import { Button } from '@design/primitives/Button';
import { OptionRow } from '@design/primitives/OptionRow';
import { useStore } from '@state/store';
import { ProfileFields } from './ProfileFields';
import { WorkFields } from './WorkFields';
import { useProfileDrafts, useSaveProfile, validateProfile } from './useProfileDraft';

/**
 * `#/you/edit`. The same two field groups as signup, committed on Save, and
 * the three switches that move fields along the ladder.
 *
 * A route rather than inline editing on You: You stays a summary, and edits
 * land in persisted state once, not on every keystroke. The switches write
 * `privacy.disclosure`; the ladder already honours them, so nothing else
 * has to change for a card to reflect the choice.
 */
export function EditProfileScreen({ onDone }: { onDone: () => void }) {
  const seed = useStore((s) => s.me.avatar.seed);
  const disclosure = useStore((s) => s.me.privacy.disclosure);
  const setPrivacy = useStore((s) => s.setPrivacy);
  const { profile, work } = useProfileDrafts();
  const { saveProfile, saveWork } = useSaveProfile();
  const [p, setP] = useState(profile);
  const [w, setW] = useState(work);
  const [d, setD] = useState({
    nameEarly: Boolean(disclosure.nameEarly),
    professionalLate: Boolean(disclosure.professionalLate),
    bioLate: Boolean(disclosure.bioLate),
  });
  const [attempted, setAttempted] = useState(false);

  const errors = validateProfile(p);
  const ok = Object.keys(errors).length === 0;

  return (
    <div className="signup">
      <ProfileFields draft={p} errors={attempted ? errors : {}} avatarSeed={seed} onChange={setP} />
      <h3 className="panel__title">Work</h3>
      <WorkFields draft={w} onChange={setW} />

      <h3 className="panel__title">What shows when</h3>
      <p className="panel__note">
        A stranger sees a first name and one sentence. These move things earlier or later; nothing
        can be taken off the ladder entirely.
      </p>
      <div className="panel__stack">
        <OptionRow
          label="Show my full name from the start"
          note="Off, a stranger sees your first name only. On, they see it in full before anyone says yes."
          selected={d.nameEarly}
          onClick={() => setD((x) => ({ ...x, nameEarly: !x.nameEarly }))}
        />
        <OptionRow
          label="Keep my work details until we are meeting"
          note="Title, industry and what you are working on stay hidden until a meet is agreed."
          selected={d.professionalLate}
          onClick={() => setD((x) => ({ ...x, professionalLate: !x.professionalLate }))}
        />
        <OptionRow
          label="Keep my bio until someone has said yes"
          note="The longer text waits for an accepted request."
          selected={d.bioLate}
          onClick={() => setD((x) => ({ ...x, bioLate: !x.bioLate }))}
        />
      </div>

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
            setPrivacy({ disclosure: { ...disclosure, ...d } });
            onDone();
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
