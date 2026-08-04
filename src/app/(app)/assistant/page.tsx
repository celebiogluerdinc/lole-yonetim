import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import { aiEnabled } from '@/lib/ai';
import AssistantChat from '@/components/AssistantChat';
import { Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AssistantPage() {
  const { supabase, profile, companyId } = await getCtx();
  if (!companyId && profile.role === 'super_admin') redirect('/super/companies');

  if (!aiEnabled()) {
    return (
      <main className="max-w-3xl mx-auto p-4 md:p-8">
        <div className="card p-10 text-center">
          <span className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-[#5E5CE6] to-[#AF52DE] text-white flex items-center justify-center mb-4">
            <Sparkles size={26} />
          </span>
          <h1 className="text-[22px] font-bold">Lole Asistan hazır, anahtar bekliyor</h1>
          <p className="text-[15px] text-[#8E8E93] mt-2 max-w-md mx-auto leading-relaxed">
            Yapay zeka özelliklerini açmak için <b>console.anthropic.com</b>&apos;dan bir API anahtarı alın
            ve Vercel ortam değişkenlerine <code className="text-[13px] bg-black/5 px-1.5 py-0.5 rounded">ANTHROPIC_API_KEY</code> olarak
            ekleyip yeniden deploy edin.
          </p>
        </div>
      </main>
    );
  }

  const { data: thread } = await supabase
    .from('ai_threads').select('id')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(1).maybeSingle();

  let messages: any[] = [];
  if (thread) {
    const { data } = await supabase
      .from('ai_messages')
      .select('id, role, content, created_at')
      .eq('thread_id', thread.id)
      .in('role', ['user', 'assistant'])
      .order('created_at', { ascending: true })
      .limit(60);
    messages = data ?? [];
  }

  return <AssistantChat messages={messages} userName={profile.full_name.split(' ')[0]} />;
}
