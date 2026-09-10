import 'server-only';

/**
 * BÜYÜK LİSTELERLE GÜVENLİ SORGULAMA
 *
 * İki sessiz sınır vardı ve veri kayboluyordu:
 *
 *  1) `.in('task_id', [700 kimlik])` gibi sorgular adres satırını (URL) çok
 *     uzatıyor; sunucu isteği reddedince sorgu boş dönüyor ve ekranda hiçbir
 *     hata görünmeden liste boşalıyordu. (Personel performansının kaybolma
 *     sebebi tam olarak buydu.)
 *  2) Supabase tek istekte en fazla 1000 satır döndürür; daha fazlası sessizce
 *     kırpılır — yani "hepsi görünsün" dediğimiz listeler eksik kalıyordu.
 *
 * Buradaki iki yardımcı her ikisini de çözer: listeyi parçalara böler ve
 * her parçayı sayfa sayfa sonuna kadar okur.
 *
 * ÖNEMLİ: Supabase sorgu nesneleri TEK KULLANIMLIKTIR. Bu yüzden her iki
 * yardımcı da hazır sorgu değil, "sorgu üreten fonksiyon" ister.
 */

/** Tek istekte istenecek en fazla kimlik sayısı (URL uzunluk sınırı için). */
const CHUNK = 80;
/** Tek istekte istenecek en fazla satır sayısı. */
const PAGE = 1000;
/** Aynı anda açılacak en fazla istek (sunucuyu boğmamak için). */
const CONCURRENCY = 5;
/** Tek bir listede okunacak üst sınır (kaçak döngüye karşı emniyet freni). */
const MAX_ROWS = 50000;

/** Bir sorguyu sayfa sayfa sonuna kadar okur. */
async function readAllPages<T>(build: () => any): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    let res = await build().range(from, from + PAGE - 1);
    if (res.error) {
      // geçici bir aksaklık olabilir — bir kez daha dene
      res = await build().range(from, from + PAGE - 1);
    }
    if (res.error) {
      console.error('[veri] sayfalı sorgu hatası:', res.error.message);
      break;
    }
    const batch = (res.data ?? []) as T[];
    rows.push(...batch);
    // sunucu istenenden az satır döndürdüyse liste bitti demektir
    if (batch.length === 0 || batch.length < PAGE) break;
    from += batch.length;
    if (rows.length >= MAX_ROWS) break;
  }
  return rows;
}

/** Görevleri en fazla CONCURRENCY tanesi aynı anda çalışacak şekilde yürütür. */
async function withLimit<T>(jobs: (() => Promise<T[]>)[]): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    const slice = jobs.slice(i, i + CONCURRENCY);
    const res = await Promise.all(slice.map(j => j()));
    for (const r of res) out.push(...r);
  }
  return out;
}

/**
 * `.in(...)` sorgusunu parçalara bölerek çalıştırır ve tüm satırları birleştirir.
 *
 * @param build her çağrıda YENİ bir sorgu üretmeli — örn.
 *              `ids => supabase.from('task_assignees').select('*').in('task_id', ids)`
 * @param ids   kimlik listesi (kaç tane olursa olsun)
 */
export async function chunkedIn<T = any>(
  build: (ids: string[]) => any,
  ids: string[],
  chunkSize: number = CHUNK
): Promise<T[]> {
  if (!ids?.length) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += chunkSize) chunks.push(ids.slice(i, i + chunkSize));
  return withLimit<T>(chunks.map(chunk => () => readAllPages<T>(() => build(chunk))));
}

/**
 * Bir sorgunun TÜM satırlarını okur (1000 satır sınırını aşar).
 * Sayfalamanın tutarlı olması için sorguda bir `.order(...)` bulunmalıdır.
 *
 * @param build her çağrıda YENİ bir sorgu üretmeli
 */
export async function selectAll<T = any>(build: () => any): Promise<T[]> {
  return readAllPages<T>(build);
}
