'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Silently re-fetches server data on an interval while the tab is visible — live tracking. */
export default function AutoRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
