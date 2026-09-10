import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { pushToUsers } from '@/lib/push';

export const dynamic = 'force-dynamic';

const TITLES: Record<string, string> = {
  due_soon: '⏰ Görevin süresi yaklaşıyor',
  overdue: '🚨 Görev gecikti'
};

/**
 * Called by pg_cron (net.http_get) every 10 minutes.
 * Delivers Web Push for reminder notifications created by fn_process_reminders.
 */
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const { data: pending } = await admin
    .from('notifications')
    .select('id, user_id, type, payload')
    .eq('pushed', false)
    .in('type', ['due_soon', 'overdue'])
    .gte('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
    .limit(200);

  if (!pending?.length) return NextResponse.json({ delivered: 0 });

  let delivered = 0;
  for (const n of pending) {
    const p = n.payload ?? {};
    const escalated = p.escalated === true || p.escalated === 'true';
    await pushToUsers([n.user_id], {
      title: escalated ? '🚨 Ekipte geciken görev var' : (TITLES[n.type] ?? 'Lole Yönetim'),
      body: p.title ?? '',
      url: p.task_id ? `/tasks/${p.task_id}` : '/notifications'
    });
    delivered++;
  }
  await admin
    .from('notifications')
    .update({ pushed: true })
    .in('id', pending.map((n: any) => n.id));

  return NextResponse.json({ delivered });
}
