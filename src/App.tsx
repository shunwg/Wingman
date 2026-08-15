import { useEffect, useState } from 'react';
import { DesignGallery } from './design/gallery/DesignGallery';

/**
 * App shell.
 *
 * Currently a hash router with one route — the design gallery — while the
 * screens are built. `screens/_shell/routes.tsx` replaces this in phase 4.
 */
export function App() {
  const [hash, setHash] = useState(() => window.location.hash);

  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  if (hash.startsWith('#/_design') || hash === '') return <DesignGallery />;

  return <DesignGallery />;
}
