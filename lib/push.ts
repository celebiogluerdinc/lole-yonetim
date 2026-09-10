import 'server-only';
import { supabaseAdmin } from './supabase/server';

/**
 * Sends a Web Push notification to every registered device of the given users.
 * No-ops silently when VAPID env vars are not configured.
 */
export async function pushToUsers(
  userIds: string[],
  payload: { title: string; body?: string; url?: string }
) {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv || userIds.length === 0) return;

  try {
    const webpush = require('web-push');
    webpush.setVapidDetails('mailto:admin@lole.app', pub, priv);

    const admin = supabaseAdmin();
    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, keys')
      .in('user_id', userIds);
    if (!subs?.length) return;

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body ?? '',
      url: payload.url ?? '/notifications'
    });

    await Promise.allSettled(subs.map(async (s: any) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, body);
      } catch (e: any) {
        // subscription expired / revoked → clean up
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await admin.from('push_subscriptions').delete().eq('id', s.id);
        }
      }
    }));
  } catch {
    // never let push failures break the main action
  }
}
