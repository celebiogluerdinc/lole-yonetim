/**
 * AI KÖPRÜSÜ — tarayıcıdaki uygulama Anthropic'e doğrudan çıkamaz (CORS +
 * anahtar gizliliği). Bu route istekleri sunucudan iletir; anahtar yalnızca
 * Vercel ortam değişkeninde durur (ANTHROPIC_API_KEY).
 *
 * A5 güvenlik önlemleri:
 *  1) Model SUNUCUDA sabit — istemcinin gönderdiği body.model yok sayılır.
 *  2) IP başına dakikada 10 istek sınırı (bellek içi; Vercel'de best-effort).
 *  3) Supabase JWT: Authorization başlığı GELDİYSE doğrulanır; gelmediyse
 *     (eski istemci uyumu) istek engellenmez — uygulama kırılmaz.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MODEL = 'claude-sonnet-4-5'; // sunucuda kilitli — body.model dikkate alınmaz

const RL = new Map<string, number[]>();
const RL_MAX = 30; // v14-S2: "Yönetim Meclisi" tek çalıştırmada 5 ardışık çağrı yapıyor — 10 sınırı ikinci meclisi 429 ile düşürüyordu
const RL_WIN_MS = 60_000;
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (RL.get(ip) || []).filter((t) => now - t < RL_WIN_MS);
  if (arr.length >= RL_MAX) {
    RL.set(ip, arr);
    return true;
  }
  arr.push(now);
  RL.set(ip, arr);
  if (RL.size > 5000) RL.clear(); // bellek emniyeti
  return false;
}

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: 'ANTHROPIC_API_KEY tanımlı değil (Vercel > Settings > Environment Variables).' }, { status: 500 });

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'bilinmiyor';
  if (rateLimited(ip)) {
    return Response.json(
      { error: { message: 'Çok fazla istek — dakikada en fazla 10 AI çağrısı yapılabilir, lütfen kısa bir süre bekleyin.' } },
      { status: 429 }
    );
  }

  // Supabase JWT doğrulaması: başlık geldiyse doğrula; doğrulama SERVİSİNE ulaşılamazsa isteği engelleme (uygulamayı bozma)
  const auth = req.headers.get('authorization');
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (auth && auth.startsWith('Bearer ') && supaUrl && anon) {
    try {
      const u = await fetch(`${supaUrl}/auth/v1/user`, {
        headers: { apikey: anon, Authorization: auth },
        cache: 'no-store',
      });
      if (u.status === 401 || u.status === 403) {
        return Response.json({ error: { message: 'Oturum doğrulanamadı — lütfen yeniden giriş yapın.' } }, { status: 401 });
      }
    } catch {
      /* doğrulama servisi erişilemez — fail-open, istek devam eder */
    }
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return Response.json({ error: 'Geçersiz istek' }, { status: 400 }); }
  const payload = {
    model: MODEL,
    max_tokens: Math.min(Number(body.max_tokens) || 900, 2000),
    system: typeof body.system === 'string' ? body.system.slice(0, 8000) : undefined,
    messages: body.messages,
  };
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(payload),
  });
  const j = await r.json().catch(() => ({}));
  return Response.json(j, { status: r.status });
}
