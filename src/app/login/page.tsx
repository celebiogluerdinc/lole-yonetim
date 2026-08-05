import { login } from './actions';

export default function LoginPage({
  searchParams
}: {
  searchParams: { error?: string };
}) {
  return (
    <main className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-brand-500 text-white flex items-center justify-center text-2xl font-bold shadow-lg shadow-black/40">
            L
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Lole Yönetim</h1>
          <p className="text-sm text-[#8E8E93] mt-1">Hesabınızla giriş yapın</p>
        </div>

        <form action={login} className="card p-6 space-y-4">
          <div>
            <label className="label" htmlFor="email">Kullanıcı adı veya e-posta</label>
            <input id="email" name="email" type="text" autoCapitalize="none" autoComplete="username"
              required className="input" placeholder="ayse.yilmaz" />
          </div>
          <div>
            <label className="label" htmlFor="password">Parola</label>
            <input id="password" name="password" type="password" required className="input" placeholder="••••••••" />
          </div>
          {searchParams.error && (
            <p className="text-sm text-rose-300 bg-rose-500/10 rounded-xl px-3 py-2">
              Kullanıcı adı veya parola hatalı. Lütfen tekrar deneyin.
            </p>
          )}
          <button type="submit" className="btn-primary w-full">Giriş Yap</button>
        </form>

        <p className="text-center text-xs text-[#8E8E93] mt-6">
          Hesabınız yoksa şirket yöneticinizle iletişime geçin.
        </p>
      </div>
    </main>
  );
}
