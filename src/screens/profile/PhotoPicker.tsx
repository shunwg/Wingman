import { useRef, useState } from 'react';
import { Avatar } from '@design/primitives/Avatar';
import { Button } from '@design/primitives/Button';
import { generateAvatar } from '@design/avatar/generate';
import { resizeToDataUrl } from '@design/avatar/photo';

/**
 * A photo, or the generated portrait.
 *
 * The portrait is shown until a photo is chosen, so nobody is ever a grey
 * silhouette — and "Remove photo" goes back to it rather than to nothing.
 * The file is resized on the way in; the original never reaches the store.
 */
export function PhotoPicker({
  seed,
  photoUrl,
  onChange,
}: {
  /** The avatar seed, so the fallback is this person's own portrait. */
  seed: string;
  photoUrl?: string;
  onChange: (dataUrl: string | undefined) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spec = photoUrl ? { ...generateAvatar(seed), photoUrl } : generateAvatar(seed);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await resizeToDataUrl(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="photopick">
      <Avatar spec={spec} size="xl" label="" />
      <div className="photopick__actions">
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="visually-hidden"
          aria-label="Choose a photo"
          onChange={(e) => void pick(e.target.files?.[0])}
        />
        <Button
          variant="secondary"
          size="sm"
          loading={busy}
          onClick={() => input.current?.click()}
        >
          {photoUrl ? 'Change photo' : 'Add a photo'}
        </Button>
        {photoUrl && (
          <Button variant="quiet" size="sm" onClick={() => onChange(undefined)}>
            Remove photo
          </Button>
        )}
        <p className="photopick__note">
          {photoUrl
            ? 'Shown small on your card; the sentence does the talking.'
            : 'Optional. Without one, this portrait stands in.'}
        </p>
        {error && (
          <p className="field__error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
