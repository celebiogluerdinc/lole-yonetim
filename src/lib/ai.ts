import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from './supabase/server';
import type { Ctx } from './auth';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';

export const aiEnabled = () => !!process.env.ANTHROPIC_API_KEY;

export type AgentName =
  | 'assistant' | 'task_creator' | 'checklist_generator' | 'announcement_writer'
  | 'photo_verifier' | 'performance_analyst' | 'workload_balancer';

/** Company-level allowance: per-agent toggle + monthly token budget. */
export async function checkAllowance(companyId: string | null, agent: AgentName): Promise<string | null> {
  if (!aiEnabled()) {
    return 'Yapay zeka henüz etkin değil. Yöneticinizin Vercel ortam değişkenlerine ANTHROPIC_API_KEY eklemesi gerekiyor.';
  }
  if (!companyId) return null;
  const admin = supabaseAdmin();
  const { data: s } = await admin.from('ai_settings').select('*').eq('company_id', companyId).maybeSingle();
  if (s?.enabled_agents && s.enabled_agents[agent] === false) {
    return 'Bu yapay zeka özelliği şirketiniz için kapatılmış.';
  }
  if (s?.monthly_token_budget) {
    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const { data: runs } = await admin
      .from('ai_agent_runs')
      .select('input_tokens, output_tokens')
      .eq('company_id', companyId)
      .gte('created_at', monthStart.toISOString());
    const used = (runs ?? []).reduce((a: number, r: any) => a + (r.input_tokens ?? 0) + (r.output_tokens ?? 0), 0);
    if (used >= s.monthly_token_budget) {
      return 'Bu ayın yapay zeka kullanım bütçesi doldu. Gelecek ay tekrar deneyin.';
    }
  }
  return null;
}

export async function logRun(opts: {
  companyId: string | null; agent: AgentName; userId?: string | null;
  input: any; output: any; inputTokens: number; outputTokens: number;
  status?: 'success' | 'error'; trigger?: 'manual' | 'cron';
}) {
  try {
    await supabaseAdmin().from('ai_agent_runs').insert({
      company_id: opts.companyId,
      agent: opts.agent,
      triggered_by: opts.userId ?? null,
      trigger: opts.trigger ?? 'manual',
      input: opts.input,
      output: opts.output,
      status: opts.status ?? 'success',
      input_tokens: opts.inputTokens,
      output_tokens: opts.outputTokens
    });
  } catch { /* logging must never break the feature */ }
}

const nowInfo = () =>
  `Şu an: ${new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'full', timeStyle: 'short' })} (Europe/Istanbul).`;

// ============================================================
// ASSISTANT (chat with tools — runs with the USER's permissions)
// ============================================================
export async function runAssistant(
  ctx: Ctx,
  history: { role: 'user' | 'assistant'; content: string }[]
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const client = new Anthropic();
  const isManager = ['super_admin', 'admin'].includes(ctx.profile.role) || ctx.managedDepartmentIds.length > 0;

  const tools: any[] = [
    {
      name: 'get_my_tasks',
      description: 'Kullanıcıya atanmış görevleri listeler (başlık, durum, bitiş tarihi, öncelik).',
      input_schema: {
        type: 'object',
        properties: {
          filter: { type: 'string', enum: ['today', 'upcoming', 'overdue', 'open', 'all'], description: 'Hangi görünüm' }
        }
      }
    },
    {
      name: 'get_announcements',
      description: 'Şirketin son duyurularını (Pano) getirir.',
      input_schema: { type: 'object', properties: {} }
    }
  ];
  if (isManager) {
    tools.push({
      name: 'get_team_stats',
      description: 'Yöneticinin görebildiği görevlerin durum dağılımını ve kişi bazında sayıları getirir (son 30 gün).',
      input_schema: { type: 'object', properties: {} }
    });
  }

  async function execTool(name: string, input: any): Promise<string> {
    const sb = ctx.supabase; // user-scoped → RLS applies to everything the AI sees
    try {
      if (name === 'get_my_tasks') {
        const { data } = await sb
          .from('task_assignees')
          .select('tasks(id, title, status, due_at, priority, type)')
          .eq('user_id', ctx.profile.id);
        let tasks = (data ?? []).map((r: any) => r.tasks).filter(Boolean);
        const now = Date.now();
        const today = new Date().toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' });
        const f = input?.filter ?? 'all';
        tasks = tasks.filter((t: any) => {
          const done = ['completed', 'cancelled'].includes(t.status);
          const isToday = t.due_at && new Date(t.due_at).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' }) === today;
          switch (f) {
            case 'today': return !done && isToday;
            case 'upcoming': return !done && t.due_at && new Date(t.due_at).getTime() > now;
            case 'overdue': return !done && t.due_at && new Date(t.due_at).getTime() < now;
            case 'open': return !done;
            default: return true;
          }
        });
        return JSON.stringify(tasks.slice(0, 30));
      }
      if (name === 'get_announcements') {
        const { data } = await sb
          .from('announcements').select('title, body, is_pinned, created_at')
          .order('created_at', { ascending: false }).limit(10);
        return JSON.stringify(data ?? []);
      }
      if (name === 'get_team_stats' && isManager) {
        const since = new Date(Date.now() - 30 * 86400000).toISOString();
        const { data: tasks } = await sb
          .from('tasks')
          .select('id, status, due_at, completed_at')
          .gte('due_at', since);
        const { data: asg } = await sb
          .from('task_assignees')
          .select('task_id, profiles:user_id(full_name)');
        const byUser: Record<string, number> = {};
        const tset = new Set((tasks ?? []).map((t: any) => t.id));
        for (const a of asg ?? []) {
          if (!tset.has(a.task_id)) continue;
          const nm = (a as any).profiles?.full_name ?? '?';
          byUser[nm] = (byUser[nm] ?? 0) + 1;
        }
        const counts: Record<string, number> = {};
        for (const t of tasks ?? []) counts[t.status] = (counts[t.status] ?? 0) + 1;
        return JSON.stringify({ durum_dagilimi: counts, kisi_gorev_sayilari: byUser });
      }
      return 'Bilinmeyen araç.';
    } catch (e: any) {
      return `Araç hatası: ${e?.message ?? 'bilinmiyor'}`;
    }
  }

  const system = [
    `Sen "Lole Asistan"sın — Lole Yönetim personel/görev uygulamasının içindeki yardımcı asistan.`,
    `Kullanıcı: ${ctx.profile.full_name} (rol: ${ctx.profile.role}).`,
    nowInfo(),
    `Her zaman Türkçe, kısa, samimi ve net yanıt ver. Görevleri listelerken tarih-saat belirt, gecikenleri vurgula, önceliklendirme önerileri yap.`,
    `Yalnızca araçlardan gelen gerçek veriye dayan; veri yoksa uydurma. Kullanıcının göremeyeceği hiçbir veriye erişimin yok.`
  ].join('\n');

  let messages: any[] = history.map(m => ({ role: m.role, content: m.content }));
  let inTok = 0, outTok = 0;
  let finalText = '';

  for (let i = 0; i < 5; i++) {
    const resp = await client.messages.create({
      model: MODEL, max_tokens: 1024, system, tools, messages
    });
    inTok += resp.usage?.input_tokens ?? 0;
    outTok += resp.usage?.output_tokens ?? 0;

    const toolUses = resp.content.filter((b: any) => b.type === 'tool_use');
    const texts = resp.content.filter((b: any) => b.type === 'text').map((b: any) => b.text);

    if (resp.stop_reason === 'tool_use' && toolUses.length) {
      messages.push({ role: 'assistant', content: resp.content });
      const results = [];
      for (const tu of toolUses as any[]) {
        results.push({
          type: 'tool_result', tool_use_id: tu.id,
          content: await execTool(tu.name, tu.input)
        });
      }
      messages.push({ role: 'user', content: results });
      continue;
    }
    finalText = texts.join('\n').trim();
    break;
  }
  if (!finalText) finalText = 'Üzgünüm, şu anda yanıt üretemedim. Lütfen tekrar deneyin.';
  return { text: finalText, inputTokens: inTok, outputTokens: outTok };
}

// ============================================================
// STRUCTURED DRAFTS (forced tool call → validated JSON)
// ============================================================
async function structuredDraft(opts: {
  system: string; user: string; toolName: string; schema: any;
}): Promise<{ draft: any; inputTokens: number; outputTokens: number }> {
  const client = new Anthropic();
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: opts.system,
    tools: [{ name: opts.toolName, description: 'Taslağı kaydet', input_schema: opts.schema }],
    tool_choice: { type: 'tool', name: opts.toolName },
    messages: [{ role: 'user', content: opts.user }]
  });
  const tu: any = resp.content.find((b: any) => b.type === 'tool_use');
  return {
    draft: tu?.input ?? null,
    inputTokens: resp.usage?.input_tokens ?? 0,
    outputTokens: resp.usage?.output_tokens ?? 0
  };
}

export async function draftTaskFromText(instruction: string, peopleNames: string[], departmentNames: string[]) {
  return structuredDraft({
    system: [
      'Bir yöneticinin serbest metnini, personel yönetim uygulaması için görev taslağına dönüştürüyorsun.',
      nowInfo(),
      `Şirketteki kişiler: ${peopleNames.join(', ') || '(bilinmiyor)'}.`,
      `Departmanlar: ${departmentNames.join(', ') || '(bilinmiyor)'}.`,
      'Tarihleri Europe/Istanbul saatine göre "YYYY-MM-DDTHH:mm" formatında ver ("yarın 08:00" gibi ifadeleri hesapla).',
      'Metinde madde madde iş sayılıyorsa type=checklist yap ve items doldur. Fotoğraf/kanıt isteniyorsa requires_photo=true. Kontrol/onay isteniyorsa requires_approval=true.',
      'assignee_names alanına yalnızca verilen kişi listesinden isimler yaz; kişi belirtilmemişse boş bırak. Tüm metinler Türkçe olsun.'
    ].join('\n'),
    user: instruction,
    toolName: 'save_task_draft',
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        type: { type: 'string', enum: ['task', 'checklist'] },
        items: { type: 'array', items: { type: 'string' } },
        due_at: { type: 'string', description: 'YYYY-MM-DDTHH:mm (Istanbul)' },
        priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] },
        requires_photo: { type: 'boolean' },
        requires_approval: { type: 'boolean' },
        assignee_names: { type: 'array', items: { type: 'string' } },
        department_name: { type: 'string' }
      },
      required: ['title', 'type', 'due_at', 'priority']
    }
  });
}

export async function draftTemplateFromText(instruction: string) {
  return structuredDraft({
    system: [
      'Bir işletme için yeniden kullanılabilir görev/checklist ŞABLONU tasarlıyorsun (restoran, pastane, fabrika, pazarlama bağlamları olabilir).',
      'Sektör iyi uygulamalarına göre kapsamlı ama pratik maddeler üret (5-12 madde). Tüm metinler Türkçe.',
      'Fotoğraf kanıtı mantıklıysa requires_photo=true öner.'
    ].join('\n'),
    user: instruction,
    toolName: 'save_template_draft',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        type: { type: 'string', enum: ['task', 'checklist'] },
        items: { type: 'array', items: { type: 'string' } },
        default_priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] },
        requires_photo: { type: 'boolean' },
        requires_approval: { type: 'boolean' }
      },
      required: ['name', 'type']
    }
  });
}

// ============================================================
// PHOTO VERIFIER (vision) — flags suspicious proof photos.
// NEVER auto-rejects; only annotates for the reviewer.
// ============================================================
export async function verifyPhoto(
  base64: string, mediaType: string, taskTitle: string, taskDescription?: string | null
): Promise<{ verdict: 'ok' | 'suspicious'; note: string; inputTokens: number; outputTokens: number }> {
  const client = new Anthropic();
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: [
      'Bir personel yönetim uygulamasında görev kanıt fotoğraflarını denetliyorsun.',
      'Fotoğrafın, verilen görevle makul şekilde ilişkili olup olmadığını değerlendir.',
      'Şüpheli say: tamamen alakasız konu, simsiyah/bozuk kare, ekran fotoğrafı gibi bariz kaçamaklar.',
      'Emin değilsen "ok" ver — personeli haksız yere şüpheye düşürme. Kararı her zaman insan verir.'
    ].join('\n'),
    tools: [{
      name: 'save_verdict',
      description: 'Değerlendirmeyi kaydet',
      input_schema: {
        type: 'object',
        properties: {
          verdict: { type: 'string', enum: ['ok', 'suspicious'] },
          note: { type: 'string', description: 'Tek cümlelik Türkçe gerekçe' }
        },
        required: ['verdict', 'note']
      }
    }],
    tool_choice: { type: 'tool', name: 'save_verdict' },
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType as any, data: base64 } },
        { type: 'text', text: `Görev: "${taskTitle}"${taskDescription ? ` — ${taskDescription}` : ''}\nBu fotoğraf bu görevin kanıtı olarak makul mü?` }
      ]
    }]
  });
  const tu: any = resp.content.find((b: any) => b.type === 'tool_use');
  return {
    verdict: tu?.input?.verdict === 'suspicious' ? 'suspicious' : 'ok',
    note: tu?.input?.note ?? '',
    inputTokens: resp.usage?.input_tokens ?? 0,
    outputTokens: resp.usage?.output_tokens ?? 0
  };
}

// ============================================================
// PERFORMANCE ANALYST — weekly written report for managers
// ============================================================
export async function writeWeeklyReport(companyName: string, stats: any) {
  const client = new Anthropic();
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 900,
    system: [
      `"${companyName}" şirketinin haftalık operasyon raporunu yazıyorsun (yöneticiler okuyacak).`,
      nowInfo(),
      'Verilen istatistiklere dayan; uydurma. Türkçe, sıcak ama profesyonel bir dille yaz.',
      'Yapı: 1) İki cümlelik genel özet 2) Öne çıkanlar (iyi gidenler) 3) Dikkat gerektirenler (gecikme kalıpları, kaçırılan görevler) 4) 2-3 somut öneri.',
      'Kişileri eleştirirken yapıcı ol; suçlayıcı dil kullanma. Markdown başlık kullanma, düz metin + kısa satırlar yaz. En fazla 250 kelime.'
    ].join('\n'),
    messages: [{ role: 'user', content: JSON.stringify(stats) }]
  });
  const text = resp.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim();
  return {
    text,
    inputTokens: resp.usage?.input_tokens ?? 0,
    outputTokens: resp.usage?.output_tokens ?? 0
  };
}

// ============================================================
// WORKLOAD BALANCER — assignment suggestion (advice only)
// ============================================================
export async function suggestAssignees(taskSummary: string, memberStats: any[]) {
  return structuredDraft({
    system: [
      'Bir yöneticiye, yeni görevi ekipten kime atamasının daha dengeli olacağını öneriyorsun.',
      'Ölçütler: mevcut açık iş yükü (az olan öne), son 30 günde zamanında tamamlama oranı (yüksek olan öne).',
      'recommended alanına 1-2 isim yaz (verilen listeden, aynen). reason tek cümlelik Türkçe gerekçe olsun.'
    ].join('\n'),
    user: `Görev: ${taskSummary}\nEkip istatistikleri: ${JSON.stringify(memberStats)}`,
    toolName: 'save_suggestion',
    schema: {
      type: 'object',
      properties: {
        recommended: { type: 'array', items: { type: 'string' } },
        reason: { type: 'string' }
      },
      required: ['recommended', 'reason']
    }
  });
}

export async function draftAnnouncementFromText(rough: string) {
  return structuredDraft({
    system: [
      'Bir şirket panosu duyurusu yazıyorsun. Yöneticinin karaladığı notu net, saygılı, sıcak ve profesyonel bir Türkçe duyuruya dönüştür.',
      'Kısa tut (en fazla 4-5 cümle), emoji kullanma ya da en fazla bir tane kullan, emir kipinden kaçın.'
    ].join('\n'),
    user: rough,
    toolName: 'save_announcement_draft',
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Kısa duyuru başlığı' },
        body: { type: 'string', description: 'Duyuru metni' }
      },
      required: ['title', 'body']
    }
  });
}
