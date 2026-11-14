/**
 * FOTOĞRAFI GÖNDERMEDEN ÖNCE KÜÇÜLT (yalnız tarayıcıda)
 *
 * Telefon kamerası 4–8 MB fotoğraf üretiyor; mobil veriyle sekiz
 * fotoğraf yüklemek dakikalar sürüyor ve çoğu zaman yarıda kesiliyordu.
 * Raf fotoğrafı için 1600 piksel fazlasıyla yeterli: dosya ~300 KB'a iniyor.
 *
 * Küçültme başarısız olursa (eski tarayıcı, HEIC) özgün dosya döner —
 * yükleme hiç olmamasındansa büyük dosya gitsin.
 */
export async function shrinkImage(file: File, maxSide = 1600, quality = 0.82): Promise<File> {
  if (typeof document === 'undefined' || !file.type.startsWith('image/')) return file;
  if (file.size < 400 * 1024) return file;
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('okunamadı'));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) { URL.revokeObjectURL(url); return file; }
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
