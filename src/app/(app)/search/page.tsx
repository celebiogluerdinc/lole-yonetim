import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import { TZ } from '@/lib/utils';
import { Search, ClipboardList, Megaphone, ShoppingCart, Wallet, User, FolderOpen } from 'lucide-react';

export const dynamic = 'force-dynamic';

/** Global arama: görevler, duyurular, satın alma, ödeme, kişiler, dosyalar. */
export default async function SearchPage({
  searchParams
}: { searchParams: { q?: string } }) {
  const { supabase, profile, companyId } = await getCtx();
  if (!companyId) redirect(profile.role === 'super_admin' ? '/super/companies' : '/home');

  const q = (searchParams.q ?? '').trim().slice(0, 80);
  const like = `%${q}%`;
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', {
    timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric'
  });

  let tasks: any[] = [], anns: any[] = [], purchases: any[] = [], payments: any[] = [],
      people: any[] = [], files: any[] = [];

  if (q.length >= 2) {
    const [tRes, aRes, prRes, payRes, pplRes, fRes] = await Promise.all([
      supabase.from('tasks')
        .select('id, title, status, due_at')
        .eq('company_id', companyId).ilike('title', like)
        .order('created_at', { ascending: false }).limit(15),
      supabase.from('announcements')
        .select('id, title, created_at')
        .eq('company_id', companyId)
        .or(`title.ilike.${like},body.ilike.${like}`)
        .order('created_at', { ascending: false }).limit(10),
      supabase.from('purchase_requests')
        .select('id, title, status, created_at')
        .eq('company_id', companyId).ilike('title', like)
        .order('created_at', { ascending: false }).limit(10),
      supabase.from('payment_requests')
        .select('id, work_title, firm_name, status, created_at')
        .eq('company_id', companyId)
        .or(`work_title.ilike.${like},firm_name.ilike.${like}`)
        .order('created_at', { ascending: false }).limit(10),
      supabase.from('profiles')
        .select('id, full_name, role')
        .eq('company_id', companyId).eq('is_active', true)
        .ilike('full_name', like).limit(10),
      supabase.from('documents')
        .select('id, title, category, created_at')
        .eq('company_id', companyId)
        .or(`title.ilike.${like},file_name.ilike.${like}`)
        .order('created_at', { ascending: false }).limit(10)
    ]);
    tasks = tRes.data ?? []; anns = aRes.data ?? []; purchases = prRes.data ?? [];
    payments = payRes.data ?? []; people = pplRes.data ?? []; files = fRes.data ?? [];
  }

  const total = tasks.length + anns.length + purchases.length + payments.length + people.length + files.length;

  const Section = ({ title, icon: Icon, color, children, count }: any) =>
    count > 0 ? (
      <section>
        <h2 className="section-title flex items-center gap-1.5" style={{ color }}>
          <Icon size={14} /> {title} ({count})
        </h2>
        <div className="card divide-y divide-white/[0.08] overflow-hidden">{children}</div>
      </section>
    ) : null;

  const Row = ({ href, main, sub }: { href: string; main: string; sub: string }) => (
    <Link href={href} className="block px-4 py-3 hover:bg-white/[0.04] transition-colors">
      <p className="text-[15px] font-medium truncate">{main}</p>
      <p className="text-[12px] text-[#8E8E93] truncate">{sub}</p>
    </Link>
  );

  return (
    <main className="max-w-3xl mx-auto p-4 md:p-8 space-y-5">
      <header className="px-1">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">🔍 Arama</h1>
        <p className="text-[14px] text-[#8E8E93]">Görev, duyuru, talep, kişi ve dosyalarda arayın</p>
      </header>

      <form action="/search" className="relative">
        <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#AEAEB2]" />
        <input
          name="q" defaultValue={q} autoFocus
          placeholder="En az 2 harf yazıp Enter'a basın…"
          className="input !pl-11 !py-3 !text-[16px]"
        />
      </form>

      {q.length >= 2 && total === 0 && (
        <div className="card p-10 text-center">
          <p className="text-3xl mb-2">🔍</p>
          <p className="text-[15px] text-[#8E8E93]">&quot;{q}&quot; için sonuç bulunamadı.</p>
        </div>
      )}
      {q.length >= 2 && total > 0 && (
        <p className="text-[13px] text-[#8E8E93] px-1">{total} sonuç bulundu.</p>
      )}

      <Section title="Görevler" icon={ClipboardList} color="#0A84FF" count={tasks.length}>
        {tasks.map(t => (
          <Row key={t.id} href={`/tasks/${t.id}`} main={t.title}
            sub={`${t.status} · ${t.due_at ? fmt(t.due_at) : 'tarihsiz'}`} />
        ))}
      </Section>

      <Section title="Duyurular" icon={Megaphone} color="#FF9500" count={anns.length}>
        {anns.map(a => (
          <Row key={a.id} href="/announcements" main={a.title} sub={fmt(a.created_at)} />
        ))}
      </Section>

      <Section title="Satın Alma Talepleri" icon={ShoppingCart} color="#FF9F0A" count={purchases.length}>
        {purchases.map(p => (
          <Row key={p.id} href="/purchasing" main={p.title} sub={`${p.status} · ${fmt(p.created_at)}`} />
        ))}
      </Section>

      <Section title="Ödeme Talepleri" icon={Wallet} color="#30D158" count={payments.length}>
        {payments.map(p => (
          <Row key={p.id} href="/payments" main={`${p.firm_name} — ${p.work_title}`}
            sub={`${p.status} · ${fmt(p.created_at)}`} />
        ))}
      </Section>

      <Section title="Kişiler" icon={User} color="#AF52DE" count={people.length}>
        {people.map(p => (
          <Row key={p.id} href="/messages" main={p.full_name} sub={p.role} />
        ))}
      </Section>

      <Section title="Dosyalar" icon={FolderOpen} color="#30B0C7" count={files.length}>
        {files.map(f => (
          <Row key={f.id} href="/files" main={f.title}
            sub={`${f.category ?? 'Dosya'} · ${fmt(f.created_at)}`} />
        ))}
      </Section>
    </main>
  );
}
