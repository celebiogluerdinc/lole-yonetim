'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const sb = getSupabase();
    sb.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/');
      else setChecking(false);
    });
  }, [router]);

  async function signIn() {
    setErr('');
    if (!email.trim() || !pw) {
      setErr('E-posta ve şifre gerekli.');
      return;
    }
    setBusy(true);
    try {
      const sb = getSupabase();
      const timeout = new Promise<never>((_, rej) =>
        setTimeout(
          () =>
            rej(
              new Error(
                'Sunucuya ulaşılamadı. İnternet bağlantınızı ve Supabase URL/anahtar ayarlarını kontrol edin.'
              )
            ),
          25000
        )
      );
      const { error } = await Promise.race([
        sb.auth.signInWithPassword({ email: email.trim(), password: pw }),
        timeout,
      ]);
      if (error) {
        setErr(
          error.message.toLowerCase().includes('invalid')
            ? 'E-posta veya şifre hatalı.'
            : error.message
        );
        setBusy(false);
        return;
      }
      router.replace('/');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Giriş sırasında bir hata oluştu.');
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 34,
        padding: '44px 20px',
        background:
          'radial-gradient(900px 500px at 50% -10%,#1d2c4d 0%,#0c1322 55%) #0c1322',
        color: '#eef1f7',
      }}
    >
      <div className="brand" style={{ textAlign: 'center' }}>
        <div
          className="logo"
          style={{
            fontSize: 34,
            fontWeight: 800,
            letterSpacing: '.34em',
            textIndent: '.34em',
            color: '#e3b578',
          }}
        >
          LOLE
        </div>
        <div className="sub" style={{ color: '#aab4c9', marginTop: 6, fontSize: 13 }}>
          Finans &amp; Muhasebe Yönetim Sistemi
        </div>
      </div>

      <div className="loginBox">
        <h2>Giriş Yap</h2>
        <p className="tiny" style={{ color: '#aab4c9', marginBottom: 14 }}>
          E-posta ve şifrenizle giriş yapın
        </p>
        {checking ? (
          <p className="tiny" style={{ color: '#aab4c9' }}>Kontrol ediliyor…</p>
        ) : (
          <>
            <input
              type="email"
              placeholder="E-posta"
              autoComplete="username"
              autoCapitalize="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && signIn()}
            />
            <input
              type="password"
              placeholder="Şifre"
              autoComplete="current-password"
              style={{ marginTop: 10 }}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && signIn()}
            />
            {err && (
              <p
                style={{
                  color: '#ff9a90',
                  fontSize: 12.5,
                  marginTop: 10,
                  textAlign: 'left',
                }}
              >
                {err}
              </p>
            )}
            <button
              className="btn"
              style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}
              onClick={signIn}
              disabled={busy}
            >
              {busy ? 'Giriş yapılıyor…' : 'Giriş Yap →'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
