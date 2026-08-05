'use server';

import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/auth';

export async function savePushSubscription(sub: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
}) {
  const { supabase, profile } = await getCtx();
  if (!sub?.endpoint || !sub?.keys?.p256dh) return { error: 'Geçersiz abonelik.' };
  // endpoint gerçek bir push servisi olmalı (SSRF koruması)
  try {
    const u = new URL(sub.endpoint);
    const ipLike = /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname) || u.hostname === 'localhost';
    if (u.protocol !== 'https:' || ipLike) return { error: 'Geçersiz abonelik adresi.' };
  } catch {
    return { error: 'Geçersiz abonelik adresi.' };
  }
  await supabase.from('push_subscriptions').upsert(
    {
      user_id: profile.id,
      endpoint: sub.endpoint,
      keys: sub.keys,
      user_agent: sub.userAgent ?? null
    },
    { onConflict: 'endpoint' }
  );
  return { ok: true };
}

export async function markAllNotificationsRead() {
  const { supabase, profile } = await getCtx();
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', profile.id)
    .is('read_at', null);
  revalidatePath('/notifications');
  revalidatePath('/', 'layout');
  return { ok: true };
}
