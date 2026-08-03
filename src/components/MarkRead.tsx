'use client';

import { useEffect } from 'react';
import { markAnnouncementsRead } from '@/app/(app)/announcements/actions';

/** Silently marks visible announcements as read on mount. */
export default function MarkRead({ ids }: { ids: string[] }) {
  useEffect(() => {
    if (ids.length) markAnnouncementsRead(ids).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(ids)]);
  return null;
}
