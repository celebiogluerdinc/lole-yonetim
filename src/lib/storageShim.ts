import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Orijinal uygulama tüm kalıcı veriyi `window.storage` adında basit bir
 * anahtar-değer (KV) arabirimi üzerinden saklıyordu (Claude artifact deposu):
 *
 *    window.storage.get(key, shared)    -> { value: string } | null
 *    window.storage.set(key, value, shared) -> truthy
 *    window.storage.delete(key, shared)
 *    window.storage.list(prefix, shared) -> { keys: string[] }
 *
 * Burada AYNI arabirimi Supabase `kv_store` tablosuyla birebir uyguluyoruz.
 * Böylece 3500 satırlık iş mantığına HİÇ dokunmadan veri artık kullanıcının
 * kendi Supabase projesinde saklanıyor.
 *
 * `shared=true`  -> tüm ekip aynı satırı paylaşır (scope='shared')
 * `shared=false` -> yalnızca giriş yapan kullanıcıya özel (scope=kullanıcı uuid)
 */
export interface LoleStorage {
  get(key: string, shared?: boolean): Promise<{ value: string; updatedAt?: string | null } | null>;
  set(key: string, value: string, shared?: boolean): Promise<boolean>;
  delete(key: string, shared?: boolean): Promise<boolean>;
  list(prefix: string, shared?: boolean): Promise<{ keys: string[] }>;
  /** B1-F3: yalnızca updated_at okuyan hafif sorgu (bayatlama tespiti için). */
  head(key: string, shared?: boolean): Promise<{ updatedAt: string | null } | null>;
  /**
   * B1: Compare-And-Set — updated_at fencing token olarak kullanılır (şema değişikliği yok).
   * Beklenen sürüm eşleşirse yazar; eşleşmezse { ok:false, current } döner (mevcut satır ile).
   * Satır hiç yoksa insert eder. Motor tarafı bu yol çalışmazsa DÜZ set'e düşer (fail-open).
   */
  setCas(
    key: string,
    value: string,
    shared: boolean | undefined,
    expectedUpdatedAt: string | null
  ): Promise<
    | { ok: true; updatedAt: string }
    | { ok: false; current: { value: string; updatedAt: string | null } | null }
  >;
}

const TABLE = 'kv_store';

export function makeStorage(sb: SupabaseClient, userId: string): LoleStorage {
  const scopeOf = (shared?: boolean) => (shared ? 'shared' : userId);

  return {
    async get(key, shared) {
      const { data, error } = await sb
        .from(TABLE)
        .select('value, updated_at')
        .eq('scope', scopeOf(shared))
        .eq('key', key)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { value: data.value as string, updatedAt: (data.updated_at as string) ?? null };
    },

    async head(key, shared) {
      const { data, error } = await sb
        .from(TABLE)
        .select('updated_at')
        .eq('scope', scopeOf(shared))
        .eq('key', key)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { updatedAt: (data.updated_at as string) ?? null };
    },

    async setCas(key, value, shared, expectedUpdatedAt) {
      const scope = scopeOf(shared);
      const now = new Date().toISOString();
      const readCurrent = async () => {
        const { data } = await sb
          .from(TABLE)
          .select('value, updated_at')
          .eq('scope', scope)
          .eq('key', key)
          .maybeSingle();
        return data
          ? { value: data.value as string, updatedAt: (data.updated_at as string) ?? null }
          : null;
      };
      if (!expectedUpdatedAt) {
        // Satır yok varsayımı → insert; çakışırsa (satır varmış) mevcut durumu döndür
        const { error } = await sb.from(TABLE).insert({ scope, key, value, updated_at: now });
        if (!error) return { ok: true, updatedAt: now };
        return { ok: false, current: await readCurrent() };
      }
      const { data, error } = await sb
        .from(TABLE)
        .update({ value, updated_at: now })
        .eq('scope', scope)
        .eq('key', key)
        .eq('updated_at', expectedUpdatedAt)
        .select('updated_at');
      if (error) throw error;
      if (data && data.length) return { ok: true, updatedAt: now };
      // 0 satır güncellendi → ya sürüm değişti ya satır yok
      const current = await readCurrent();
      if (!current) {
        const ins = await sb.from(TABLE).insert({ scope, key, value, updated_at: now });
        if (!ins.error) return { ok: true, updatedAt: now };
      }
      return { ok: false, current };
    },

    async set(key, value, shared) {
      const { error } = await sb
        .from(TABLE)
        .upsert(
          {
            scope: scopeOf(shared),
            key,
            value,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'scope,key' }
        );
      if (error) throw error;
      return true;
    },

    async delete(key, shared) {
      const { error } = await sb
        .from(TABLE)
        .delete()
        .eq('scope', scopeOf(shared))
        .eq('key', key);
      if (error) throw error;
      return true;
    },

    async list(prefix, shared) {
      const { data, error } = await sb
        .from(TABLE)
        .select('key')
        .eq('scope', scopeOf(shared))
        .like('key', `${prefix}%`);
      if (error) throw error;
      return { keys: (data || []).map((r: { key: string }) => r.key) };
    },
  };
}
