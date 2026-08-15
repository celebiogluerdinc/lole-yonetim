/**
 * HAFTALIK OTOMATİK YEDEK E-POSTASI
 * Vercel Cron tarafından her Pazartesi 06:00 UTC'de (09:00 TR) çağrılır
 * (bkz. vercel.json). Tüm şirketlerin verisini Supabase'ten okur ve
 * yedek dosyası olarak e-posta ekinde gönderir.
 *
 * AKTİF OLMASI İÇİN Vercel > Project > Settings > Environment Variables:
 *   SUPABASE_SERVICE_ROLE_KEY  = Supabase > Settings > API > service_role  (GİZLİ!)
 *   RESEND_API_KEY             = resend.com ücretsiz hesabından API anahtarı
 *   BACKUP_EMAIL               = celebiogluerdinc@gmail.com  (opsiyonel; varsayılan bu)
 * Anahtarlar yoksa hiçbir şey yapmaz, hata ile döner (veriye dokunmaz).
 */
export const dynamic = 'force-dynamic';

const MAIN_KEY = 'lole-finans-v1-ekip'; // uygulamanın ortak veri anahtarı (DKEY+'-ekip')

export async function GET(req: Request) {
  // A14: Vercel Cron sırrı — CRON_SECRET tanımlıysa Bearer başlığı zorunlu (tanımlı değilse eski davranış korunur, deploy kırılmaz)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return new Response('unauthorized', { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resend = process.env.RESEND_API_KEY;
  const to = process.env.BACKUP_EMAIL || 'celebiogluerdinc@gmail.com';

  // B4: sonuç durumunu kv_store'a yaz — Ayarlar ekranında gösterilir
  const writeStatus = async (st: Record<string, unknown>) => {
    if (!url || !service) return;
    try {
      await fetch(`${url}/rest/v1/kv_store?on_conflict=scope,key`, {
        method: 'POST',
        headers: {
          apikey: service,
          Authorization: `Bearer ${service}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          scope: 'shared',
          key: 'lole-weekly-backup-status',
          value: JSON.stringify(st),
          updated_at: new Date().toISOString(),
        }),
      });
    } catch {
      /* durum yazılamazsa yedek akışını bozma */
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  if (!url || !service || !resend) {
    // v14-S1: eskiden sessizce dönüyordu; Ayarlar ekranı sonsuza dek "henüz hiç çalışmadı" gösteriyordu
    await writeStatus({ ok: false, date: today, error: 'Eksik ayar: SUPABASE_SERVICE_ROLE_KEY / RESEND_API_KEY' });
    return Response.json(
      { ok: false, error: 'Eksik ayar: SUPABASE_SERVICE_ROLE_KEY ve RESEND_API_KEY ortam değişkenleri gerekli.' },
      { status: 500 }
    );
  }

  // 1) Tüm şirketlerin ortak verisini oku (salt-okunur)
  const r = await fetch(
    `${url}/rest/v1/kv_store?scope=eq.shared&key=eq.${encodeURIComponent(MAIN_KEY)}&select=value`,
    { headers: { apikey: service, Authorization: `Bearer ${service}` }, cache: 'no-store' }
  );
  if (!r.ok) {
    await writeStatus({ ok: false, date: today, error: 'Supabase okunamadı: ' + r.status }); // v14-S1
    return Response.json({ ok: false, error: 'Supabase okunamadı: ' + r.status }, { status: 502 });
  }
  const rows = (await r.json()) as Array<{ value: string }>;
  const data = rows?.[0]?.value;
  if (!data) {
    await writeStatus({ ok: false, date: today, error: 'Yedeklenecek veri bulunamadı (kv_store boş)' }); // v14-S1
    return Response.json({ ok: false, error: 'Yedeklenecek veri bulunamadı (kv_store boş).' }, { status: 404 });
  }

  // 2) E-posta ile gönder (ek: tam sistem yedeği JSON)
  const b64 = Buffer.from(data, 'utf8').toString('base64');
  const mail = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resend}` },
    body: JSON.stringify({
      from: 'LOLE Finans <onboarding@resend.dev>',
      to: [to],
      subject: `LOLE Finans — haftalık otomatik yedek (${today})`,
      text:
        'Merhaba,\n\nTÜM şirketleri kapsayan haftalık sistem yedeğiniz ektedir.\n' +
        'Bu dosyayı güvenli bir yerde saklayın.\n\n' +
        'Geri yükleme gerekirse: Uygulama > Ayarlar > Sistem Yedeğini Yükle.\n\n' +
        'Bu e-posta her Pazartesi otomatik gönderilir.',
      attachments: [{ filename: `lole-sistem-yedegi-${today}.json`, content: b64 }],
    }),
  });
  const mj = await mail.json().catch(() => ({}));
  if (!mail.ok) {
    await writeStatus({ ok: false, date: today, error: 'E-posta gönderilemedi' });
    return Response.json({ ok: false, error: 'E-posta gönderilemedi', detail: mj }, { status: 502 });
  }
  await writeStatus({ ok: true, date: today, sentTo: to, bytes: data.length });
  return Response.json({ ok: true, sentTo: to, bytes: data.length, date: today });
}
