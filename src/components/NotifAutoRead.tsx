'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { markAllNotificationsRead } from '@/app/(app)/notifications/actions';

/** Clears unread state shortly after the notification center is opened. */
export default function NotifAutoRead({ hasUnread }: { hasUnread: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!hasUnread) return;
    const t = setTimeout(async () => {
      await markAllNotificationsRead().catch(() => {});
      router.refresh();
    }, 1200);
    return () => clearTimeout(t);
  }, [hasUnread, router]);
  return null;
}
