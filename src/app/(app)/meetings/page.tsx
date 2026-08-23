import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import { TZ } from '@/lib/utils';
import MeetingsClient from '@/components/MeetingsClient';

export const dynamic = 'force-dynamic';

// VERİ POLİTİKASI: toplantı kayıtları silinmez / gizlenmez — tamamı listelenir.
const PAGE_SIZE = 1000;

export default async function MeetingsPage() {
  const { supabase, profile, companyId } = await getCtx();
  if (!companyId) redirect(profile.role === 'super_admin' ? '/super/companies' : '/home');

  const isAdmin = ['super_admin', 'admin'].includes(profile.role);

  // RLS güvencesi: davetli olmayan kullanıcı toplantıyı göremez.
  // Admin + süper yönetici iş takibi için tüm toplantıları görür.
  const { data: rows } = await supabase
    .from('meetings')
    .select('*, creator:created_by(full_name), departments:department_id(name)')
    .eq('company_id', companyId)
    .order('meeting_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);

  const ids = (rows ?? []).map((r: any) => r.id);

  const [partsRes, notesRes, usersRes, deptsRes] = await Promise.all([
    ids.length
      ? supabase.from('meeting_participants')
          .select('meeting_id, user_id, is_organizer, profiles:user_id(full_name)')
          .in('meeting_id', ids)
      : Promise.resolve({ data: [] } as any),
    ids.length
      ? supabase.from('meeting_notes')
          .select('*, author:author_id(full_name)')
          .in('meeting_id', ids)
          .order('created_at', { ascending: true })
          .limit(5000)
      : Promise.resolve({ data: [] } as any),
    supabase.from('profiles')
      .select('id, full_name, role')
      .eq('company_id', companyId).eq('is_active', true)
      .order('full_name'),
    supabase.from('departments').select('id, name').eq('company_id', companyId).order('name')
  ]);

  const fmt = (iso: string | null) => iso
    ? new Date(iso).toLocaleString('tr-TR', {
        timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      })
    : null;
  const dayKey = (iso: string | null) => iso
    ? new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
        .format(new Date(iso))
    : '';
  // datetime-local alanı için "YYYY-MM-DDTHH:mm" (İstanbul)
  const localInput = (iso: string | null) => iso
    ? new Intl.DateTimeFormat('sv-SE', {
        timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
      }).format(new Date(iso)).replace(' ', 'T').slice(0, 16)
    : '';

  const partsByMtg: Record<string, { id: string; name: string; organizer: boolean }[]> = {};
  for (const p of (partsRes.data ?? []) as any[]) {
    (partsByMtg[p.meeting_id] ??= []).push({
      id: p.user_id,
      name: p.profiles?.full_name ?? '—',
      organizer: !!p.is_organizer
    });
  }

  const notesByMtg: Record<string, any[]> = {};
  for (const n of (notesRes.data ?? []) as any[]) {
    (notesByMtg[n.meeting_id] ??= []).push({
      id: n.id,
      body: n.body,
      author: n.author?.full_name ?? '—',
      authorId: n.author_id,
      date: fmt(n.created_at)
    });
  }

  const meetings = (rows ?? []).map((r: any) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    outcome: r.outcome,
    location: r.location,
    status: r.status,
    when: fmt(r.meeting_at),
    whenInput: localInput(r.meeting_at),
    day: dayKey(r.meeting_at ?? r.created_at),
    created: fmt(r.created_at),
    creator: r.creator?.full_name ?? '—',
    creatorId: r.created_by,
    dept: r.departments?.name ?? null,
    participants: partsByMtg[r.id] ?? [],
    notes: notesByMtg[r.id] ?? [],
    amInvited: (partsByMtg[r.id] ?? []).some(p => p.id === profile.id)
  }));

  return (
    <MeetingsClient
      meetings={meetings}
      users={(usersRes.data ?? []) as any}
      departments={(deptsRes.data ?? []) as any}
      meId={profile.id}
      isAdmin={isAdmin}
    />
  );
}
