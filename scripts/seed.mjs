/**
 * LOLE YÖNETİM — seed script
 * Creates: 1 super admin + 4 Lole companies (preset departments auto-created
 * by DB trigger) + admin/manager/staff users + demo templates & tasks.
 *
 * Usage:  NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed.mjs
 * (or put them in .env.local — this script reads it)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';

// naive .env.local loader
if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.SEED_PASSWORD || 'Lole!2026';
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

async function createUser(email, full_name, role, company_id) {
  const { data, error } = await db.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { full_name, role, company_id: company_id ?? '' }
  });
  if (error) {
    if (String(error.message).includes('already been registered')) {
      const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
      const u = list.users.find(u => u.email === email);
      if (u) return u.id;
    }
    throw error;
  }
  // make sure profile fields are right (trigger may have defaulted)
  await db.from('profiles').update({ full_name, role, company_id, email }).eq('id', data.user.id);
  return data.user.id;
}

const COMPANIES = [
  { name: 'Lole Fabrika', slug: 'lole-fabrika', accent_color: '#ff5a1f' },
  { name: 'Lole Restaurant', slug: 'lole-restaurant', accent_color: '#d03801' },
  { name: 'Lole Patisserie', slug: 'lole-patisserie', accent_color: '#ff8a4c' },
  { name: 'Lole Pazarlama', slug: 'lole-pazarlama', accent_color: '#b43403' }
];

async function main() {
  console.log('— Süper admin oluşturuluyor…');
  await createUser('super@lole.app', 'Lole Süper Admin', 'super_admin', null);

  for (const c of COMPANIES) {
    console.log(`— ${c.name} kuruluyor…`);
    let { data: comp } = await db.from('companies').select('*').eq('slug', c.slug).maybeSingle();
    if (!comp) {
      const r = await db.from('companies').insert(c).select().single();
      if (r.error) throw r.error;
      comp = r.data;
    }
    const { data: deps } = await db.from('departments').select('*').eq('company_id', comp.id);
    const dep = (name) => deps.find(d => d.name === name);
    const slugp = c.slug.replace('lole-', '');

    const adminId = await createUser(`admin@${slugp}.lole.app`, `${c.name} Admin`, 'admin', comp.id);
    const mgrId = await createUser(`mudur@${slugp}.lole.app`, `${c.name} Operasyon Müdürü`, 'manager', comp.id);
    const p1 = await createUser(`personel1@${slugp}.lole.app`, `${c.name} Personel 1`, 'staff', comp.id);
    const p2 = await createUser(`personel2@${slugp}.lole.app`, `${c.name} Personel 2`, 'staff', comp.id);

    const op = dep('Operasyon');
    await db.from('department_members').upsert([
      { department_id: op.id, user_id: mgrId, is_manager: true },
      { department_id: op.id, user_id: p1, is_manager: false },
      { department_id: op.id, user_id: p2, is_manager: false },
      { department_id: dep('Yönetim').id, user_id: adminId, is_manager: true }
    ], { onConflict: 'department_id,user_id' });

    // template + demo tasks
    const { data: tpl } = await db.from('templates').insert({
      company_id: comp.id, department_id: op.id, name: 'Günlük Açılış Checklisti',
      description: 'Her sabah tamamlanacak açılış rutini', type: 'checklist',
      default_recurrence: 'FREQ=DAILY', requires_photo: true, requires_approval: false, created_by: mgrId
    }).select().single().then(r => r);
    if (tpl) {
      await db.from('template_items').insert([
        { template_id: tpl.id, title: 'Alanların temizliğini kontrol et', position: 0 },
        { template_id: tpl.id, title: 'Ekipmanları çalıştır ve test et', position: 1, requires_photo: true },
        { template_id: tpl.id, title: 'Günün görev listesini gözden geçir', position: 2 }
      ]);
    }

    const today = new Date();
    const at = (h, m = 0, plusDays = 0) => {
      const d = new Date(today); d.setDate(d.getDate() + plusDays); d.setHours(h, m, 0, 0);
      return d.toISOString();
    };
    const mk = async (t) => {
      const { data: task, error } = await db.from('tasks').insert({ company_id: comp.id, ...t }).select().single();
      if (error) throw error;
      return task;
    };

    const t1 = await mk({
      department_id: op.id, title: 'Açılış checklisti', type: 'checklist', created_by: mgrId,
      due_at: at(9, 0), priority: 'high', requires_photo: true
    });
    await db.from('task_assignees').insert({ task_id: t1.id, user_id: p1 });
    await db.from('checklist_items').insert([
      { task_id: t1.id, title: 'Alanların temizliğini kontrol et', position: 0 },
      { task_id: t1.id, title: 'Ekipmanları çalıştır ve test et', position: 1, requires_photo: true },
      { task_id: t1.id, title: 'Günün görev listesini gözden geçir', position: 2 }
    ]);

    const t2 = await mk({
      department_id: op.id, title: 'Depo sayımı', description: 'Haftalık stok sayımını yap ve rapora işle.',
      type: 'task', created_by: mgrId, due_at: at(17, 0), priority: 'normal', requires_approval: true
    });
    await db.from('task_assignees').insert({ task_id: t2.id, user_id: p2 });

    const t3 = await mk({
      department_id: op.id, title: 'Aylık derin temizlik', type: 'task', created_by: mgrId,
      due_at: at(15, 0, 3), priority: 'urgent', requires_photo: true, requires_approval: true
    });
    await db.from('task_assignees').insert([{ task_id: t3.id, user_id: p1 }, { task_id: t3.id, user_id: p2 }]);

    await db.from('announcements').insert([
      {
        company_id: comp.id, author_id: adminId, is_pinned: true,
        title: `${c.name} ekibine hoş geldiniz!`,
        body: 'Lole Yönetim uygulamamız yayında. Görevlerinizi Ana Sayfa\'dan takip edebilir, tamamladıklarınızı tik atarak işaretleyebilirsiniz. Sorularınız için yöneticinize ulaşın.'
      },
      {
        company_id: comp.id, author_id: adminId,
        title: 'Fotoğraflı görevler hakkında',
        body: 'Fotoğraf zorunlu görevlerde, işi tamamladığınızı gösteren bir fotoğraf çekmeden görev kapatılamaz. Anlayışınız için teşekkürler.'
      }
    ]);
  }

  console.log('\n✔ Seed tamam. Giriş bilgileri:');
  console.log(`  Süper admin : super@lole.app / ${PASSWORD}`);
  console.log(`  Örnek admin : admin@fabrika.lole.app / ${PASSWORD}`);
  console.log(`  Örnek müdür : mudur@restaurant.lole.app / ${PASSWORD}`);
  console.log(`  Örnek personel: personel1@patisserie.lole.app / ${PASSWORD}`);
}

main().catch(e => { console.error(e); process.exit(1); });
