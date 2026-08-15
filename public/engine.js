/* =====================================================================
   LOLE Finans & Muhasebe — İş Mantığı Motoru (engine)
   Orijinal tek-dosya uygulamadan taşındı. YALNIZCA 3 altyapı dikişi değişti:
     1) Depolama: window.storage artık Supabase kv_store ile beslenir (React tarafı).
     2) Giriş: özel giriş yerine Supabase Auth (supaAutoLogin köprüsü).
     3) Çıkış: doLogout Supabase oturumunu kapatır ve /login'e yönlendirir.
   Diğer TÜM modüller (16 sayfa) birebir korunmuştur.
   Bu dosya klasik (global) bir script olarak yüklenir; data-act tıklama
   yönlendirmesi window[fonksiyonAdı] üzerinden çalışır — modül olarak SARMAYIN.
   ===================================================================== */
/* ---------- ŞİRKETLER ---------- */
const COMPANIES=[
 {id:'rest', name:'LOLE RESTAURANT', tip:'Restoran işletmesi', color:'#8c2f1b'},
 {id:'pati', name:'LOLE PATISSERIE', tip:'Pastane işletmesi',  color:'#9a5b13'},
 {id:'fact', name:'LOLE FACTORY',    tip:'Üretim tesisi',      color:'#31456e'},
 {id:'loleq',name:'LOLE Q',          tip:'Perakende / mağaza', color:'#4a2a6b'}
];
const GRUP={id:'grup',name:'LOLE GRUP',tip:'Konsolide görünüm'};

/* ---------- VERİ KATMANI ---------- */
const DKEY='lole-finans-v1'; // ⚠️ SAKIN DEĞİŞTİRME: mevcut tüm finansal veri bu anahtar altında saklı — değişirse eski veriye erişim kaybolur (veri silinmez ama görünmez olur)
/* v19: GÖMÜLÜ YEDEK — bulut depolama bir önceki yayından bağımsız/boş çıkarsa (ör. yeni bir artifact sürümü farklı bir depolama alanına düşerse)
   diye, bilinen en son veri anlık görüntüsü DOĞRUDAN KODUN İÇİNE gömülür. Böylece veri, Claude'un artifact/depolama sürekliliğine değil,
   dosyanın kendisine bağlı olarak taşınır. Her güncellemede en güncel yedek buraya işlenecek. Şu an boş — bir sonraki güncellemede doldurulacak. */
const EMBEDDED_SEED=(function(){
 try{ return JSON.parse(`{
 "meta": {
  "created": "2026-07-21T11:05:59.269Z",
  "version": 2,
  "saved": "2026-07-21T15:06:54.504Z"
 },
 "seq": 5,
 "accounts": [
  {
   "id": "r267hm",
   "co": "rest",
   "type": "banka",
   "name": "pos",
   "bankName": "ziraat bankası",
   "iban": "",
   "accNo": "",
   "opening": 0,
   "note": ""
  }
 ],
 "txns": [],
 "pos": [],
 "posEntries": [],
 "cards": [],
 "cardTxns": [],
 "cari": [
  {
   "id": "r1upyx",
   "co": "rest",
   "name": "alp öz",
   "type": "tedarikci",
   "taxNo": "",
   "phone": "",
   "email": "",
   "vadeGun": 30,
   "opening": 0,
   "riskLimit": "",
   "note": ""
  }
 ],
 "cariTxns": [],
 "staff": [
  {
   "id": "r376we",
   "co": "rest",
   "active": "1",
   "name": "ali",
   "pos": "",
   "phone": "",
   "startDate": "2026-07-21",
   "salary": 30000,
   "iban": "",
   "note": ""
  }
 ],
 "staffTxns": [],
 "leaves": [],
 "fixed": [
  {
   "id": "r4eads",
   "co": "rest",
   "type": "fatura",
   "name": "elektrik",
   "payDay": 15,
   "amount": 50000,
   "note": ""
  }
 ],
 "fixedLogs": [],
 "tasks": [],
 "notes": [],
 "cheques": [],
 "stock": [],
 "stockTxns": [],
 "assets": [],
 "budgets": [],
 "ai": {
  "autoBrief": 1
 },
 "aiCache": {
  "brief:rest:2026-07-21": "**LOLE RESTAURANT · 21.07.2026 Sabah Brifingi**\\n\\n• Sistemde bugüne ait herhangi bir finansal kayıt bulunmuyor — gelir, gider, hesap bakiyesi ve kasa bilgisi tamamı sıfır görünüyor; bu veri girişi yapılmadığına ya da bağlantı sorununa işaret edebilir, öncelikli olarak kontrol edilmesini öneririm.\\n\\n• Bugün vadesi gelen ödeme kaydı yok; bu açıdan günü rahat başlatıyorsunuz.\\n\\n• Banka ve nakit bakiyesi 0,00 TL olarak görünüyor — gerçek bakiye bu değilse muhasebe sistemindeki senkronizasyonu gün içinde düzeltin.\\n\\n• Aylık gelir ve gider toplamı da 0,00 TL; Temmuz ayına ait işlemlerin sisteme işlenip işlenmediğini muhasebecinizle teyit edin.\\n\\n• Portföyde çek/senet, bekleyen POS blokajı ve kritik stok uyarısı kaydı bulunmuyor — ancak bunların doğru yansıyıp yansımadığı, veri sorunu giderilmeden kesin söylenemez.\\n\\n• Bugün için somut öneri: Sabah içinde kasiyer veya muhasebe sorumlusundan gerçek kasa ve banka bakiyesini alın, sisteme girin; böylece akşam kapanış karşılaştırmasını sağlıklı yapabilirsiniz."
 },
 "user": {
  "name": "",
  "title": ""
 },
 "users": [
  {
   "id": "u0",
   "username": "erdinc",
   "email": "celebiogluerdinc@gmail.com",
   "role": "super",
   "companies": "all",
   "password": "10ef0dde01b10f4f8136511007c06d729e6527de2866f624e945cbcc09d6047f",
   "addedAt": "2026-07-21T11:06:03.158Z",
   "addedBy": "sistem",
   "rememberHash": "c127d15e937ce83015fdb9241a39249afe04d2ca148726190463d6df66ebf93e"
  }
 ],
 "authPw": {
  "user": "17fd087b70259c35a1e9964f1f572d19365638ee5a748a23f2deed0ae4e524af",
  "super": "10ef0dde01b10f4f8136511007c06d729e6527de2866f624e945cbcc09d6047f"
 },
 "auditLog": [
  {
   "ts": "2026-07-21T14:59:28.874Z",
   "user": "erdinc",
   "action": "Giriş yapıldı",
   "detail": ""
  },
  {
   "ts": "2026-07-21T11:07:10.945Z",
   "user": "erdinc",
   "action": "Giriş yapıldı",
   "detail": ""
  }
 ],
 "trash": [],
 "cats": {
  "gelir": [
   "Satış Geliri",
   "Diğer Gelir"
  ],
  "gider": [
   "Hammadde & Malzeme",
   "Personel",
   "Kira",
   "Fatura & Abonelik",
   "Vergi & SGK",
   "Pazarlama",
   "Bakım & Onarım",
   "Banka & Komisyon",
   "Diğer Gider"
  ]
 }
}`); }
 catch(e){ console.error('EMBEDDED_SEED ayrıştırma hatası:',e); return null; }
})(); // v29: 2026-07-21 15:06 tarihli güncel Sistem Yedeği gömüldü (hesap+personel+sabit ödeme dahil)
/* v22: Google Sheets / herhangi bir dış adrese otomatik senkron DENENDİ ve tarayıcı loglarıyla KESİN olarak imkansız olduğu doğrulandı —
   artifact'ın Content-Security-Policy'si yalnızca birkaç CDN + www.claudeusercontent.com'a izin veriyor, başka hiçbir dış adrese değil.
   Bu sınırlama koddan değil, Claude.ai'nin kendi güvenlik politikasından kaynaklanıyor; bu yüzden ilgili kod tamamen kaldırıldı.
   Güvenilir yol: gömülü yedek (EMBEDDED_SEED, yukarıda) + Ayarlar'daki Yedek İndir/Panoya Kopyala. */
const DEFAULT_ADMIN_EMAIL='celebiogluerdinc@gmail.com';
var MODE='ekip'; // v7: uygulama artık her zaman çevrimiçi/ortak veri modunda çalışır — kullanıcı girişiyle korunur
const skey=()=>MODE==='ekip'?DKEY+'-ekip':DKEY;
const isTeam=()=>MODE==='ekip';
const blankState=()=>({
 meta:{created:new Date().toISOString(),version:2},
 seq:1,
 accounts:[],txns:[],pos:[],posEntries:[],cards:[],cardTxns:[],
 cari:[],cariTxns:[],staff:[],staffTxns:[],leaves:[],
 fixed:[],fixedLogs:[],tasks:[],notes:[],
 cheques:[],stock:[],stockTxns:[],assets:[],budgets:[],
 ai:{autoBrief:1},aiCache:{},user:{name:'',title:''},users:[],
 authPw:{}, // C8: ortak rol şifreleri seed'den KALDIRILDI — mevcut bulut verisindeki eski girişler geriye dönük çalışmaya devam eder
 auditLog:[], // v13: kritik olayların (giriş/çıkış, kullanıcı/kategori değişikliği, sıfırlama/geri yükleme) kaydı — kim, ne zaman, ne yaptı
 trash:[], // v15: silinen kayıtların 30 gün saklandığı çöp kutusu indeksi ({kind,id,label,deletedAt,deletedBy})
 cats:{gelir:['Satış Geliri','Diğer Gelir'],gider:['Hammadde & Malzeme','Personel','Kira','Fatura & Abonelik','Vergi & SGK','Pazarlama','Bakım & Onarım','Banka & Komisyon','Diğer Gider']}
});
var S=blankState();
var CO=null;
var PAGE='dash';
var saveT=null;
var SESSION=null; // v7: giriş yapan kullanıcı — sayfa yenilenince sıfırlanır, veriler her zaman ortak depoda kalır
var lastActivity=Date.now(); // v11: en son etkileşim zamanı (yalnızca bellekte, cihaza yazılmaz)
var SESSION_TIMEOUT_MS=48*60*60*1000; // 48 saat işlem yapılmazsa oturum otomatik kapanır
function markActivity(){ lastActivity=Date.now(); }
function checkSessionTimeout(){
 if(!SESSION) return;
 if(Date.now()-lastActivity>SESSION_TIMEOUT_MS){
  doLogout();
  toast('⏱ 48 saattir işlem yapılmadığı için oturum kapatıldı, tekrar giriş yapın');
 }
}

function safeParse(s){
 try{const j=JSON.parse(s);if(j&&Array.isArray(j.txns)&&Array.isArray(j.accounts))return j;}catch(e){}
 return null;
}
function withTimeoutErr(p,ms){ // withTimeout'un HATA AYRISTIRAN sürümü: zaman aşımı/istisna reject eder (A7: ağ hatası ≠ veri yok)
 return new Promise(function(resolve,reject){
  var done=false;
  var t=setTimeout(function(){ if(!done){done=true;reject(new Error('depolama zaman aşımı'));} },ms||5000);
  Promise.resolve(p).then(function(v){ if(!done){done=true;clearTimeout(t);resolve(v);} },function(e){ if(!done){done=true;clearTimeout(t);reject(e||new Error('depolama hatası'));} });
 });
}
function withTimeout(p,ms){ // ortak depolama çağrısı yanıt vermezse sonsuza kadar beklemeyi önler
 return new Promise(function(resolve){
  var done=false;
  var t=setTimeout(function(){ if(!done){done=true;resolve(null);} },ms||5000);
  Promise.resolve(p).then(function(v){ if(!done){done=true;clearTimeout(t);resolve(v);} },function(){ if(!done){done=true;clearTimeout(t);resolve(null);} });
 });
}
function fixState(j){ // eksik alanları tamamla (sürüm geçişleri veri kaybetmesin)
 const b=blankState();
 for(const k of Object.keys(b)) if(j[k]===undefined) j[k]=b[k];
 if(!j.cats||!Array.isArray(j.cats.gelir)||!Array.isArray(j.cats.gider)) j.cats=b.cats;
 if(!j.meta) j.meta=b.meta;
 if(!Array.isArray(j.users)||!j.users.length){ // v7: kullanıcı listesi boşsa varsayılan süper yönetici oluştur (kilitlenmeyi önler)
  j.users=[{id:'u0',username:'erdinc',email:DEFAULT_ADMIN_EMAIL,role:'super',companies:'all',password:'10ef0dde01b10f4f8136511007c06d729e6527de2866f624e945cbcc09d6047f',addedAt:new Date().toISOString(),addedBy:'sistem'}];
 }
 (j.users||[]).forEach(function(u){ // v10: eski (yalnızca e-postalı) kayıtlar için otomatik kullanıcı adı türet, kimse dışarıda kalmasın
  if(!u.username){ u.username=String((u.email||'kullanici').split('@')[0]||'kullanici').toLowerCase().replace(/[^a-z0-9_.-]/g,'')||('u'+Math.random().toString(36).slice(2,7)); }
 });
 return j;
}
var READONLY=false; // A7: bağlantı hatasında salt-okunur mod — eski yedek/seed CANLI verinin üzerine asla otomatik yazılmaz
var lastCloudRev=null; // B1: buluttaki ana kaydın bilinen son updated_at değeri (CAS/fencing token)
function showReadonlyBanner(){
 try{
  if(document.getElementById('roBanner'))return;
  var d=document.createElement('div');
  d.id='roBanner';d.setAttribute('role','alert');
  d.style.cssText='position:fixed;top:0;left:0;right:0;z-index:99999;background:#b3261e;color:#fff;padding:10px 14px;font:600 13px system-ui;display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap';
  d.innerHTML='⚠ Bulut bağlantısı kurulamadı — uygulama SALT-OKUNUR modda: görünen veriler güncel olmayabilir ve hiçbir değişiklik kaydedilmez. <button data-act="reloadApp" style="background:#fff;color:#b3261e;border:0;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer">↻ Yeniden Dene</button>';
  document.body.appendChild(d);
 }catch(e){}
}
function reloadApp(){try{location.reload();}catch(e){}}
var loadSource='—'; // v24: bir önceki yüklemenin GERÇEKTE hangi kaynaktan geldiğini kalıcı olarak tutar (Ayarlar'da görünür) — kaçırılabilecek bir toast'a bağımlı kalmamak için
async function loadState(){
 if(!window.storage){ loadSource='depolama-yok→'+(EMBEDDED_SEED?'gömülü yedek':'boş'); S=fixState(EMBEDDED_SEED||S); return; } // bulut depolama yoksa (artifact henüz yayınlanmamış) — varsa gömülü yedekten, yoksa temiz başlar; cihaza yazılmaz
 let a=null,lastErr=null;
 for(let attempt=0;attempt<3;attempt++){ // v18+A7: ağ/okuma HATASI ile "satır boş" artık ayrıştırılıyor
  try{
   const r=await withTimeoutErr(window.storage.get(skey(),isTeam()),5000);
   lastErr=null;
   if(r&&r.value){ const pj=safeParse(r.value); if(pj){ a=pj; lastCloudRev=(r&&r.updatedAt)||null; } }
   break; // sorgu BAŞARILI (veri geldi ya da satır gerçekten boş) — yeniden denemeye gerek yok
  }catch(e){ lastErr=e; }
  if(attempt<2) await new Promise(res=>setTimeout(res,700*(attempt+1)));
 }
 if(!a&&lastErr){ // A7: BAĞLANTI HATASI — yedek/seed'i canlı verinin üzerine YAZMA; salt-okunur başla
  loadSource='BAĞLANTI HATASI ('+(((lastErr&&lastErr.message)||lastErr)+'').slice(0,80)+') — salt-okunur';
  READONLY=true;
  S=fixState(EMBEDDED_SEED?JSON.parse(JSON.stringify(EMBEDDED_SEED)):blankState());
  setTimeout(showReadonlyBanner,300);
  setTimeout(()=>toast('⚠ Buluta bağlanılamadı — uygulama SALT-OKUNUR modda açıldı. Bağlantı gelince "Yeniden Dene" ile tazeleyin.'),500);
  return;
 }
 if(!a){ // sorgu başarılı ama ana kayıt yok/bozuk → buluttaki tarihli yedeklerin en yenisini dene
  try{
   const hist=await listBackups();
   if(hist.length){
    const y=await loadBackupByDate(hist[0].date);
    if(y){loadSource='bulut-tarihli-yedek('+hist[0].date+')'; S=fixState(y); setTimeout(()=>toast('Ana kayıt okunamadı — '+dTR(hist[0].date)+' tarihli buluttaki yedekten geri yüklendi'),400); await dailyBackup(); return;}
   }
  }catch(e){}
  if(EMBEDDED_SEED){ // v19+A7: gömülü yedek YALNIZCA onayla buluta yazılır — otomatik üzerine yazma kaldırıldı
   loadSource='GÖMÜLÜ-YEDEK (bulut boş çıktı — buluta YAZILMADI, onay bekliyor)';
   S=fixState(EMBEDDED_SEED);
   setTimeout(function(){
    uiConfirm('Bulutta veri bulunamadı; koda gömülü son yedek GEÇİCİ olarak yüklendi. Bu yedek buluta KALICI olarak yazılsın mı? (Yazmadan önce bulutta bir ana kayıt varsa kopyası "-pre-overwrite" anahtarına alınır.)',async function(){
     try{ if(window.storage){ var cur=await withTimeout(window.storage.get(skey(),isTeam()),5000); if(cur&&cur.value) await withTimeout(window.storage.set(skey()+'-pre-overwrite-'+new Date().toISOString().slice(0,19).replace(/:/g,'-'),cur.value,true),8000); } }catch(e){}
     saveNow();toast('Gömülü yedek buluta yazıldı');
    },{title:'Gömülü Yedek',yes:'Buluta Yaz'});
   },700);
   return;
  }
  loadSource='BOŞ (hiçbir kaynakta veri bulunamadı)';
  S=fixState(S);
  // v18: sessizce boş başlamak yerine uyar — gerçekten ilk kullanımsa zararsız, ama bağlantı sorunuysa kullanıcıyı veri girmeden önce durdurur
  setTimeout(()=>toast('ℹ️ Kayıtlı veri bulunamadı. İlk kullanımınızsa normaldir — değilse, veri girmeden önce Ayarlar > "Depolama Bağlantısını Test Et" ile doğrulayın.'),500);
  return; // temiz başlangıç (varsayılan süper yönetici otomatik oluşturulur)
 }
 loadSource='bulut (normal)';
 S=fixState(a);
 try{ // A15: 7 günden eski AI önbelleği buluta tekrar tekrar taşınmasın
  for(var _k in (S.aiCache||{})){var _d=String(_k).split(':')[2];if(_d&&/^\d{4}-\d{2}-\d{2}$/.test(_d)&&daysDiff(_d)<-7)delete S.aiCache[_k];}
 }catch(e){}
 purgeOldTrash();
 await dailyBackup();
}
/* ---------- YEDEK GEÇMİŞİ (v9 — TAMAMEN BULUTTA. Cihaza hiçbir şey otomatik yazılmaz.
   Cihaza kayıt YALNIZCA Ayarlar > "Yedek İndir / Panoya Kopyala" düğmelerine bilerek basıldığında olur. ---------- */
var BACKUP_KEEP_DAYS=14;
var lastBackupInfo=null; // bu oturumda yapılan son otomatik bulut yedeği (yalnızca bellekte tutulur, cihaza yazılmaz)
var STORAGE_CAP_BYTES=20*1024*1024; // Anthropic'in artifact başına sabit 20 MB sınırı
var storageWarnShown=false; // bu oturumda eşik uyarısı bir kez gösterildi mi
function computeStorageEstimate(){ // GERÇEK ölçüm değil — Anthropic kullanım sorgulama imkanı sunmuyor; canlı veri + günlük yedeklerden TAHMİN
 var liveSize=JSON.stringify(S).length;
 var backupsSize=liveSize*BACKUP_KEEP_DAYS; // her gün tam kopya alınıyor
 var total=liveSize+backupsSize;
 return {live:liveSize,backups:backupsSize,total:total,pct:total/STORAGE_CAP_BYTES*100};
}
function checkStorageWarning(){ // yalnızca gerçek bir kayıt başarılı olduğunda çağrılır (oturumda bir kez uyarır)
 var u=computeStorageEstimate();
 if(u.pct>=85&&!storageWarnShown){
  storageWarnShown=true;
  toast('⚠ Bulut depolama tahmini %'+u.pct.toFixed(0)+' dolu — Ayarlar\'dan detaya bakın');
 }
 return u;
}
function backupKey(dateISO){ return skey()+'-yedek-'+dateISO; }
async function gzipB64(str){ // B5: günlük yedekleri sıkıştırarak yaz (destekleyen tarayıcıda) — okuma tarafı GZB64: önekiyle ayırt eder
 try{
  if(typeof CompressionStream==='undefined')return null;
  var ab=await new Response(new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  var u8=new Uint8Array(ab),bin='',CH=0x8000;
  for(var i=0;i<u8.length;i+=CH)bin+=String.fromCharCode.apply(null,u8.subarray(i,i+CH));
  return 'GZB64:'+btoa(bin);
 }catch(e){return null;}
}
async function gunzipB64(sv){
 try{
  var b=atob(String(sv).slice(6));
  var u8=new Uint8Array(b.length);
  for(var i=0;i<b.length;i++)u8[i]=b.charCodeAt(i);
  var ab=await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  return new TextDecoder().decode(ab);
 }catch(e){return null;}
}
async function dailyBackup(){ // günde bir kez, o günkü durumun tarihli bir kopyasını BULUTA yazar
 try{
  if(!window.storage) return;
  const t=todayISO();
  if(lastBackupInfo&&lastBackupInfo.date===t&&lastBackupInfo.ok) return; // bu oturumda bugün için zaten alındı
  const existing=await withTimeout(window.storage.get(backupKey(t),true),5000);
  if(existing&&existing.value){ lastBackupInfo={date:t,ok:true}; return; } // bugünün yedeği bulutta zaten var
  let snap=JSON.stringify(S);
  try{ const gz=await gzipB64(snap); if(gz&&gz.length<snap.length)snap=gz; }catch(e){}
  const res=await withTimeout(window.storage.set(backupKey(t),snap,true),5000);
  lastBackupInfo={date:t,ok:!!res};
  await pruneOldBackups();
 }catch(e){}
}
async function pruneOldBackups(){ // buluttaki son BACKUP_KEEP_DAYS günü aşan yedekleri sil (yalnızca bulut, cihazda zaten hiçbir şey yok)
 try{
  if(!window.storage||!window.storage.list) return;
  const prefix=skey()+'-yedek-';
  const r=await withTimeout(window.storage.list(prefix,true),5000);
  if(!r||!r.keys) return;
  // B5: kademeli saklama — son 3 günün tamamı + 4 haftaya kadar pazartesi yedekleri korunur
  const old=r.keys.filter(k=>{const d=k.slice(prefix.length);if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return false;const dd=daysDiff(d);if(dd>=-3)return false;const isMon=new Date(d+'T12:00').getDay()===1;if(isMon&&dd>=-28)return false;return true;});
  for(const k of old){ try{ await withTimeout(window.storage.delete(k,true),5000); }catch(e){} }
  for(const pfx of [skey()+'-pre-restore-',skey()+'-pre-overwrite-']){ // B4: emniyet kopyaları 30 gün sonra temizlenir (tarihli-yedek regex'i bunlara dokunmaz)
   try{
    const r2=await withTimeout(window.storage.list(pfx,true),5000);
    if(r2&&r2.keys)for(const k2 of r2.keys){const d2=k2.slice(pfx.length,pfx.length+10);if(/^\d{4}-\d{2}-\d{2}$/.test(d2)&&daysDiff(d2)<-30){try{await withTimeout(window.storage.delete(k2,true),5000);}catch(e){}}}
   }catch(e){}
  }
 }catch(e){}
}
async function listBackups(){ // yalnızca buluttaki tarihli yedekleri, azalan sırada döndürür
 try{
  if(!window.storage||!window.storage.list) return [];
  const prefix=skey()+'-yedek-';
  const r=await withTimeout(window.storage.list(prefix,true),5000);
  if(!r||!r.keys) return [];
  return r.keys.map(k=>({date:k.slice(prefix.length)})).filter(b=>/^\d{4}-\d{2}-\d{2}$/.test(b.date)).sort((a,b)=>a.date<b.date?1:-1);
 }catch(e){ return []; }
}
async function loadBackupByDate(dateISO){
 try{ if(window.storage){const r=await withTimeout(window.storage.get(backupKey(dateISO),true),5000); if(r&&r.value){let raw=r.value; if(typeof raw==='string'&&raw.slice(0,6)==='GZB64:'){const un=await gunzipB64(raw); if(un)raw=un;} const y=safeParse(raw); if(y)return y;}} }catch(e){}
 return null;
}
async function openBackupList(){
 document.getElementById('modalBox').innerHTML='<div class="mh"><h3>🗄 Yedek Geçmişi</h3><button data-act="closeModal" style="font-size:20px;color:var(--ink3)">✕</button></div><div class="mb"><div class="tiny" style="padding:6px 2px">Bulut taranıyor…</div></div>';
 document.getElementById('modalWrap').classList.add('on');
 const list=await listBackups();
 const body=document.getElementById('modalBox');
 if(!body||!document.getElementById('modalWrap').classList.contains('on'))return; // kullanıcı kapattıysa yükleme sonrası yazmayı atla
 if(!list.length){
  body.innerHTML='<div class="mh"><h3>🗄 Yedek Geçmişi</h3><button data-act="closeModal" style="font-size:20px;color:var(--ink3)">✕</button></div><div class="mb"><p class="mut">Henüz otomatik bulut yedeği oluşmadı — bir sonraki uygulama açılışından itibaren burada birikmeye başlayacak.</p></div>';
  return;
 }
 const rows=list.map(b=>
  '<div class="rem"><span class="dot"></span><span>'+dTR(b.date)+'<br><span class="tiny">🌐 bulut</span></span><button class="btn sm gh" data-act="restoreFromDateAsk" data-arg="'+b.date+'">Geri Yükle</button></div>'
 ).join('');
 body.innerHTML='<div class="mh"><h3>🗄 Yedek Geçmişi <span class="tiny">son '+BACKUP_KEEP_DAYS+' gün · bulutta</span></h3><button data-act="closeModal" style="font-size:20px;color:var(--ink3)">✕</button></div>'+
  '<div class="mb"><p class="mut" style="margin-bottom:10px">Uygulama her gün ilk açıldığında o günkü durumun bir kopyası otomatik olarak yalnızca buluta alınır — cihazda hiçbir kopya tutulmaz.</p>'+rows+'</div>';
}
async function preRestoreSnapshot(){ // B4: S'i degistirmeden ONCE su anki halin emniyet kopyasi buluta alinir
 try{ if(!window.storage)return false; var k=skey()+'-pre-restore-'+new Date().toISOString().slice(0,19).replace(/:/g,'-'); var r=await withTimeout(window.storage.set(k,JSON.stringify(S),true),8000); return !!r; }catch(e){ return false; }
}
function restoreSummary(cur,inc){ // B4: onay modalinda ozet kiyasi
 var curN=(cur.txns||[]).length, incN=(inc.txns||[]).length;
 var pct=curN?Math.round((curN-incN)/curN*100):0;
 return 'Mevcut: '+curN+' işlem, son kayıt '+((cur.meta&&cur.meta.saved)?new Date(cur.meta.saved).toLocaleString('tr-TR'):'—')+' / Yüklenecek: '+incN+' işlem, son kayıt '+((inc.meta&&inc.meta.saved)?new Date(inc.meta.saved).toLocaleString('tr-TR'):'—')+(pct>0?' — yüklenecek veri %'+pct+' KÜÇÜK, dikkat!':'');
}
async function restoreFromDateAsk(dateISO){
 if(!isSuper())return;
 const y=await loadBackupByDate(dateISO);
 if(!y){toast('Yedek okunamadı');return;}
 uiConfirm('Tüm veriler '+dTR(dateISO)+' tarihli yedekle DEĞİŞTİRİLECEK. '+restoreSummary(S,y)+' — Geri yüklemeden önce şu anki hâlin emniyet kopyası buluta alınır. Devam edilsin mi?',async function(){
  await preRestoreSnapshot();
  S=fixState(y);logAudit('Bulut yedeğinden geri yüklendi',dateISO);
  saveNow();toast(dTR(dateISO)+' tarihli yedek geri yüklendi');goSelect();
 },{danger:1,title:'Yedeği Geri Yükle',yes:'Evet, Geri Yükle'});
}
var saveErr=false;
var dirty=false; // son değişiklik buluta başarıyla yazıldı mı — yalnızca bellekte tutulur, cihaza yazılmaz
var pendingSaves=0; // hâlâ yanıt bekleyen (veya yeniden denenen) bulut kaydı sayısı
var lastSaveFailed=false;
var lastSavedCore=null; // B5: en son buluta yazılan içerik (meta.saved hariç) — değişmemişse tekrar yazılmaz
var casRounds=0; // B1: çakışma-birleştirme tur sayacı (en fazla 3 tur, sonra kullanıcıya sorulur)
function stateCore(){ var _sv=S.meta?S.meta.saved:null; try{ if(S.meta)S.meta.saved=''; return JSON.stringify(S); } finally { if(S.meta)S.meta.saved=_sv; } }
/* B1: kayıt birleştirme — veri modeli append+soft-delete olduğu için id-UNION güvenlidir */
var MERGE_ARRAYS=['accounts','txns','pos','posEntries','cards','cardTxns','cari','cariTxns','staff','staffTxns','leaves','fixed','fixedLogs','tasks','notes','cheques','stock','stockTxns','assets','budgets','users','trash'];
function pickRec(a,b){
 if(a.deletedAt&&!b.deletedAt)return a;
 if(b.deletedAt&&!a.deletedAt)return b;
 var ua=String(a.updatedAt||a.editedAt||a.createdAt||'');
 var ub=String(b.updatedAt||b.editedAt||b.createdAt||'');
 return ub>ua?b:a;
}
function mergeStates(remote,local){ // remote: fixState'ten geçmiş uzak durum (taban) — local: bizim S
 var out=remote;
 var localNewer=String((local.meta&&local.meta.saved)||'')>=String((out.meta&&out.meta.saved)||'');
 MERGE_ARRAYS.forEach(function(k){
  var ra=Array.isArray(out[k])?out[k]:[]; var la=Array.isArray(local[k])?local[k]:[];
  var map=new Map();
  ra.forEach(function(r){ if(r&&r.id!=null)map.set(r.id,r); });
  la.forEach(function(r){ if(!r||r.id==null)return; var ex=map.get(r.id); map.set(r.id,ex?pickRec(ex,r):r); });
  out[k]=Array.from(map.values());
 });
 try{ // auditLog id'siz — birleştir + tekilleştir
  var seen=new Set(),log=[];
  (local.auditLog||[]).concat(out.auditLog||[]).forEach(function(e){ var kk=JSON.stringify(e); if(seen.has(kk))return; seen.add(kk); log.push(e); });
  log.sort(function(a,b){ return String(a.ts||'')<String(b.ts||'')?1:-1; });
  out.auditLog=log.slice(0,400);
 }catch(e){}
 out.seq=Math.max(+out.seq||0,+local.seq||0)+1;
 if(localNewer){ out.cats=local.cats||out.cats; out.meta=local.meta||out.meta; out.ai=local.ai||out.ai; out.aiCache=local.aiCache||out.aiCache; out.user=local.user||out.user; out.authPw=local.authPw||out.authPw; }
 return out;
}
function showConflictModal(current){
 window.__casCur=current;
 document.getElementById('modalBox').innerHTML=
  '<div class="mh"><h3>⚠ Kaydedilemedi — eşzamanlı değişiklik</h3><button data-act="closeModal" style="font-size:20px;color:var(--ink3)">✕</button></div>'+
  '<div class="mb"><p style="font-size:14px;line-height:1.55">Başka bir kullanıcı aynı anda kayıt yaptı ve otomatik birleştirme 3 denemede tamamlanamadı.</p>'+
  '<p class="tiny" style="margin-top:8px">"Uzaktakini Yükle": diğer kullanıcının kaydı yüklenir, sizin SON değişiklikleriniz kaybolur.<br>"Üzerine Yaz": sizin sürümünüz yazılır, diğer kullanıcının SON değişiklikleri kaybolabilir.</p></div>'+
  '<div class="mf"><button class="btn gh" data-act="casLoadRemote">☁ Uzaktakini Yükle</button><button class="btn solidDng" data-act="casForceWrite">⬆ Üzerine Yaz</button></div>';
 document.getElementById('modalWrap').classList.add('on');
}
function casLoadRemote(){
 var cur=window.__casCur;window.__casCur=null;closeModal();
 if(!cur)return;
 var remote=safeParse(cur.value);
 if(!remote){toast('Uzak kayıt okunamadı');return;}
 S=fixState(remote);lastCloudRev=cur.updatedAt||null;casRounds=0;dirty=false;lastSaveFailed=false;updateSaveBadge();
 toast('☁ Uzak kayıt yüklendi — sizin son değişiklikleriniz atıldı');
 try{if(CO)go(PAGE);else renderSelect();}catch(e){}
}
function casForceWrite(){
 var cur=window.__casCur;window.__casCur=null;closeModal();
 if(cur&&cur.updatedAt)lastCloudRev=cur.updatedAt;
 casRounds=0;
 pendingSaves++;updateSaveBadge();
 attemptCloudSave(0);
}
function updateSaveBadge(){
 var el=document.getElementById('saveBadge');
 if(!el)return;
 if(pendingSaves>0){ el.className='chip w'; el.textContent='⏳ Kaydediliyor…'; }
 else if(lastSaveFailed){ el.className='chip n'; el.textContent='⚠ Kaydedilemedi'; }
 else{ el.className='chip p'; el.textContent='✓ Kaydedildi'; }
}
function attemptCloudSave(tryNo){ // B1: CAS'lı kayıt. KURAL (FAIL-OPEN): sürüm kontrolü HERHANGİ bir nedenle çalışmazsa yazma ESKİSİ GİBİ düz set ile devam eder — kayıt yolu asla kilitlenmez.
 var j=JSON.stringify(S);
 var core=stateCore();
 function onOk(updatedAt){
  pendingSaves=Math.max(0,pendingSaves-1);
  saveErr=false;lastSaveFailed=false;dirty=false;
  casRounds=0;lastSavedCore=core;
  if(updatedAt)lastCloudRev=updatedAt;
  updateSaveBadge();
  checkStorageWarning();
 }
 function onFail(){
  pendingSaves=Math.max(0,pendingSaves-1);
  lastSaveFailed=true;
  updateSaveBadge();
  if(!saveErr){saveErr=true;toast('⚠ Bulut kaydı başarısız! Ayarlar > Yedek İndir ile verinizi hemen dışa alın.');}
 }
 function plainSet(){ // eski (v17) yol — CAS kullanılamıyorsa/başarısızsa yazma aynen devam eder
  withTimeout(window.storage.set(skey(),j,isTeam()),8000).then(function(res){
   if(res)onOk(null);
   else if(tryNo<2)setTimeout(function(){attemptCloudSave(tryNo+1);},800*(tryNo+1));
   else onFail();
  });
 }
 function resolveSaveConflict(current){ // gerçek çakışma: uzakla birleştir, en fazla 3 tur yeniden dene; olmadı kullanıcıya sor
  var remote=safeParse(current&&current.value);
  if(!remote){ if(current&&current.updatedAt)lastCloudRev=current.updatedAt; plainSet(); return; } // uzak bozuk → fail-open
  if(casRounds>=3){
   pendingSaves=Math.max(0,pendingSaves-1);
   lastSaveFailed=true;updateSaveBadge();
   showConflictModal(current);
   return;
  }
  casRounds++;
  try{
   S=mergeStates(fixState(remote),S);
   lastCloudRev=current.updatedAt||null;
   toast('☁ Başka bir kullanıcı da kaydetmiş — kayıtlar otomatik birleştirildi, yeniden kaydediliyor');
   attemptCloudSave(0);
  }catch(e){ if(current&&current.updatedAt)lastCloudRev=current.updatedAt; plainSet(); } // birleştirme hatası → fail-open (eski LWW davranışı)
 }
 try{
  var useCas=!!(window.storage&&window.storage.setCas&&lastCloudRev); // rev bilinmiyorsa (eski yayın/eski shim) düz yol
  if(!useCas){ plainSet(); return; }
  withTimeout(window.storage.setCas(skey(),j,isTeam(),lastCloudRev),8000).then(function(res){
   if(res&&res.ok){ onOk(res.updatedAt||null); return; }
   if(res&&res.ok===false&&res.current&&res.current.value){ resolveSaveConflict(res.current); return; }
   plainSet(); // CAS null/anlaşılmaz döndü (ağ, eski sunucu…) → FAIL-OPEN
  });
 }catch(err){ // senkron istisna: önce fail-open düz yazmayı dene
  try{ plainSet(); return; }catch(e2){}
  pendingSaves=Math.max(0,pendingSaves-1);
  lastSaveFailed=true;
  updateSaveBadge();
  var msg=(err&&err.message)?err.message:String(err);
  console.error('LOLE bulut kayıt hatası (attemptCloudSave):',err);
  if(!saveErr){saveErr=true;toast('⚠ Bulut kaydı hata verdi: '+msg);}
 }
}
function saveNow(){ // YALNIZCA buluta (ortak/çevrimiçi depo) kaydeder — cihaza otomatik hiçbir şey yazılmaz
 if(READONLY){ if(!saveErr){saveErr=true;toast('🔒 Salt-okunur mod — bağlantı yok, değişiklik KAYDEDİLMEDİ. Üstteki "Yeniden Dene" ile bağlantıyı tazeleyin.');} return false; } // A7
 var _core=stateCore();
 if(_core===lastSavedCore&&pendingSaves===0&&!lastSaveFailed){ dirty=false; updateSaveBadge(); return true; } // B5: içerik değişmemişse buluta tekrar yazma
 S.meta.saved=new Date().toISOString();
 if(!window.storage){
  if(!saveErr){saveErr=true;toast('⚠ Bulut depolama bulunamadı (artifact yayınlanmamış olabilir) — Ayarlar > Yedek İndir ile verinizi hemen dışa alın.');}
  return false;
 }
 pendingSaves++;
 updateSaveBadge();
 attemptCloudSave(0);
 return true;
}
function save(){
 if(READONLY){try{toast('🔒 Salt-okunur mod — bu değişiklik KAYDEDİLMEDİ');}catch(e){} return;} // v14-H11: eskiden sessizce yutuluyordu, kullanıcı "kaydedildi" toast'ını görüyordu
 dirty=true;
 clearTimeout(saveT);
 saveT=setTimeout(saveNow,1000); // B5: 150ms → 1000ms — art arda işlemlerde tek yazma
}
/* B1-F3: bayatlama tespiti — odakta + 60 sn'de bir yalnızca updated_at sorgulanır.
   Uzak sürüm değişti + bizde bekleyen değişiklik YOK → sessiz yeniden yükle.
   Bekleyen değişiklik VARSA → birleştirmeli kayıt öne çekilir (CAS çakışma yolu birleştirir). */
var __freshBusy=false;
async function checkCloudFresh(){
 try{
  if(__freshBusy||READONLY||!window.storage||!window.storage.head||!lastCloudRev||!SESSION)return;
  if(document.visibilityState==='hidden')return;
  __freshBusy=true;
  var h=await withTimeout(window.storage.head(skey(),isTeam()),5000);
  if(!h||!h.updatedAt||h.updatedAt===lastCloudRev){__freshBusy=false;return;}
  if(dirty||pendingSaves>0){ __freshBusy=false; clearTimeout(saveT); saveNow(); return; } // birleştirmeli kayıt öne çekilir
  var r=await withTimeout(window.storage.get(skey(),isTeam()),8000);
  __freshBusy=false;
  if(!r||!r.value)return;
  var remote=safeParse(r.value);
  if(!remote)return;
  S=fixState(remote);
  lastCloudRev=r.updatedAt||h.updatedAt;
  lastSavedCore=stateCore();
  try{ if(CO&&PAGE)go(PAGE); else if(SESSION)renderSelect(); }catch(e){}
  toast('☁ Veriler başka bir kullanıcının kaydıyla güncellendi');
 }catch(e){ __freshBusy=false; }
}
setInterval(checkCloudFresh,60000);
window.addEventListener('focus',function(){setTimeout(checkCloudFresh,400);});
/* v17: İzole depolama testi — S state'inden bağımsız, ham window.storage API'sini dener ve TAM hatayı gösterir */
async function testStorage(){
 var out=document.getElementById('storageTestResult');
 if(out)out.textContent='⏳ Test çalışıyor…';
 try{
  if(!window.storage){
   if(out)out.textContent='❌ window.storage API mevcut değil. Bu genelde: (1) artifact henüz yayınlanmadığında, (2) dosya indirilip doğrudan açıldığında, ya da (3) başka bir sitede (GitHub Pages/Netlify vb.) barındırıldığında olur. Bu uygulama yalnızca claude.ai üzerinde, yayınlanmış hâliyle çalışır.';
   return;
  }
  var testKey='__lole_test_'+Date.now();
  var testVal='ping-'+Math.random().toString(36).slice(2);
  // v33: gerçek kayıt akışıyla birebir karşılaştırılabilir olsun diye 3 deneme + zengin hata detayı
  var setRes=null,lastErr=null,attempts=0;
  for(var i=0;i<3;i++){
   attempts=i+1;
   try{ setRes=await window.storage.set(testKey,testVal,false); lastErr=null; if(setRes)break; }
   catch(e){ lastErr=e; }
   if(i<2) await new Promise(function(res){setTimeout(res,600*(i+1));});
  }
  function errDetail(e){
   if(!e)return '';
   var parts=[];
   if(e.name)parts.push('ad:'+e.name);
   if(e.message)parts.push('mesaj:'+e.message);
   if(e.code!==undefined)parts.push('kod:'+e.code);
   if(e.status!==undefined)parts.push('durum:'+e.status);
   return parts.length?(' ['+parts.join(', ')+']'):(' ['+String(e)+']');
  }
  if(!setRes){
   if(out)out.textContent='❌ Yazma başarısız ('+attempts+' denemede) — '+(lastErr?'istisna fırlattı'+errDetail(lastErr):'set() boş/null döndürdü, istisna yok')+'. Cihaz: '+(navigator.userAgent||'').slice(0,90);
   console.error('LOLE depolama testi — yazma başarısız:',lastErr);
   return;
  }
  var getRes=await window.storage.get(testKey,false);
  if(!getRes||getRes.value!==testVal){ if(out)out.textContent='❌ Okuma başarısız ya da yazılan değerle eşleşmiyor ('+attempts+'. denemede yazma başarılı olmuştu).'; return; }
  try{await window.storage.delete(testKey,false);}catch(e){}
  if(out)out.textContent='✅ Başarılı ('+attempts+'. denemede) — yazma/okuma/silme çalışıyor. Sorun devam ediyorsa asıl kayıt anahtarına özgü olabilir; bir işlem ekleyip üstteki "Kaydedildi" rozetine bakın.';
 }catch(err){
  var msg=(err&&err.message)?err.message:String(err);
  var extra=(err&&err.name)?(' (ad: '+err.name+')'):'';
  if(out)out.textContent='❌ İstisna fırlattı: '+msg+extra+'. Cihaz: '+(navigator.userAgent||'').slice(0,90);
  console.error('LOLE depolama testi hatası:',err);
 }
}
/* Sekme kapanırken / arka plana alınırken bekleyen değişiklikleri buluta yazmayı dener.
   beforeunload'da ayrıca: kayıt hâlâ uçuşta veya başarısızsa, tarayıcının kendi
   "kapatmak istediğinize emin misiniz" uyarısını tetikler — bu, cihazda hiçbir şey
   tutmadan yine de kullanıcıya son bir fırsat/uyarı verir (localStorage'a alternatif). */
window.addEventListener('pagehide',()=>{ if(dirty){clearTimeout(saveT);saveNow();} });
window.addEventListener('beforeunload',(e)=>{
 if(dirty){clearTimeout(saveT);saveNow();}
 if(pendingSaves>0||lastSaveFailed){
  e.preventDefault();
  e.returnValue='Kaydedilmemiş bir değişiklik olabilir. Birkaç saniye bekleyip tekrar kapatmayı deneyin (veya Ayarlar > Yedek İndir ile dışa alın).';
  return e.returnValue;
 }
});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&dirty){clearTimeout(saveT);saveNow();}});

const nid=()=> 'r'+(S.seq++).toString(36)+Date.now().toString(36).slice(-4);
function pushRec(arr,rec){ arr.push(stampCreate(rec)); return rec; } // B3: stampCreate unutulamaz hale gelsin
function stampCreate(rec){ rec.createdBy=SESSION?SESSION.username:''; rec.createdAt=new Date().toISOString(); return rec; } // v16: kaydı kimin oluşturduğunu damgalar
function stampUpdate(rec,orig){ rec.createdBy=orig?orig.createdBy:rec.createdBy; rec.createdAt=orig?orig.createdAt:rec.createdAt; rec.updatedBy=SESSION?SESSION.username:''; rec.updatedAt=new Date().toISOString(); return rec; }

/* ---------- YARDIMCILAR ---------- */
const TRY=new Intl.NumberFormat('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmt=n=>TRY.format(+n||0)+' ₺';
const fmt0=n=>new Intl.NumberFormat('tr-TR',{maximumFractionDigits:0}).format(Math.round(+n||0))+' ₺';
const fmtBytes=n=>{n=+n||0;if(n>=1024*1024)return (n/1024/1024).toFixed(2)+' MB';if(n>=1024)return (n/1024).toFixed(0)+' KB';return n+' B';};
const kfmt=n=>{n=+n||0;const a=Math.abs(n);if(a>=1e6)return (n/1e6).toLocaleString('tr-TR',{maximumFractionDigits:1})+' M';if(a>=1e3)return (n/1e3).toLocaleString('tr-TR',{maximumFractionDigits:0})+' bin';return Math.round(n).toString();};
const todayISO=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const monthISO=()=>todayISO().slice(0,7);
const dTR=iso=>{if(!iso)return'';const[y,m,d]=iso.split('-');return d+'.'+m+'.'+y;};
const AYLAR=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const mTR=p=>{const[y,m]=p.split('-');return AYLAR[+m-1]+' '+y;};
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const daysDiff=iso=>Math.round((new Date(iso+'T12:00')-new Date(todayISO()+'T12:00'))/86400000);
const addDays=(iso,n)=>{const d=new Date(iso+'T12:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};
const clampDay=(y,m,day)=>{const last=new Date(y,m,0).getDate();return y+'-'+String(m).padStart(2,'0')+'-'+String(Math.min(day,last)).padStart(2,'0');};
function toast(msg,type){const t=document.getElementById('toast');t.textContent=msg;t.className='toast on'+(type?' '+type:'');clearTimeout(t._x);t._x=setTimeout(()=>{t.classList.remove('on');},Math.min(7000,1800+String(msg||'').length*35));}
const byCo=(arr,co)=>arr.filter(x=>x.co===co&&!x.deletedAt);
const coName=id=>id==='grup'?'LOLE GRUP':(COMPANIES.find(c=>c.id===id)||{}).name||'';
window.addEventListener('error',e=>{try{toast('Hata: '+e.message);}catch(_){}});

/* ---------- MERKEZİ OLAY SİSTEMİ ----------
 Bazı önizleme ortamları elementlerin üzerine yazılmış onclick komutlarını (CSP) engeller.
 Bu yüzden TÜM etkileşim data-act öznitelikleriyle tek bir dinleyiciden yürütülür. */
document.addEventListener('click',function(e){
 markActivity();
 var t=e.target;
 var el=(t&&t.closest)?t.closest('[data-act]'):null;
 if(!el)return;
 var fn=window[el.getAttribute('data-act')];
 if(typeof fn!=='function')return;
 if(el.tagName==='BUTTON'&&el.getAttribute('type')!=='submit')e.preventDefault();
 var args=el.hasAttribute('data-arg')?el.getAttribute('data-arg').split('~'):[];
 try{fn.apply(null,args);}catch(err){try{toast('Hata: '+err.message);}catch(_){}}
});
function a11yPass(){
 document.querySelectorAll('[data-act]:not(button):not(input):not(select):not(a)').forEach(function(el){if(!el.hasAttribute('tabindex')){el.setAttribute('tabindex','0');el.setAttribute('role','button');}});
 document.querySelectorAll('button').forEach(function(b){ // C6: simge dugmelere ekran okuyucu etiketi
  if(b.getAttribute('aria-label'))return;
  var tx=(b.textContent||'').trim();
  if(tx==='✎')b.setAttribute('aria-label','Düzenle');
  else if(tx==='🗑')b.setAttribute('aria-label','Sil');
  else if(tx==='✕')b.setAttribute('aria-label','Kapat');
 });
}
try{ // C6: her yeniden cizimde a11yPass otomatik kossun (elle cagri unutulsa da)
 var _a11yMo=new MutationObserver(function(){ clearTimeout(window.__a11yT); window.__a11yT=setTimeout(function(){try{a11yPass();}catch(e){}},150); });
 ['main','modalBox'].forEach(function(id){ var el=document.getElementById(id); if(el)_a11yMo.observe(el,{childList:true,subtree:true}); });
}catch(e){}
document.addEventListener('keydown',function(e){
 if(e.key!=='Enter'&&e.key!==' ')return;
 var t=e.target;
 if(!t||!t.hasAttribute||!t.hasAttribute('data-act'))return;
 var tag=t.tagName;
 if(tag==='BUTTON'||tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA'||tag==='A')return;
 if(e.key===' ')e.preventDefault();
 t.click();
});
document.addEventListener('change',function(e){
 markActivity();
 var f=e.target&&e.target.getAttribute?e.target.getAttribute('data-actv'):null;
 if(!f||typeof window[f]!=='function')return;
 try{window[f](e.target.value,e.target);}catch(err){try{toast('Hata: '+err.message);}catch(_){}}
});
document.addEventListener('submit',function(e){
 if(e.target&&e.target.id==='mForm')submitModal(e);
});
function printPage(){try{window.print();}catch(e){}}
function moreGo(p){document.getElementById('moreSheet').classList.remove('on');if(p==='_select')goSelect();else go(p);}
function closeSheet(){document.getElementById('moreSheet').classList.remove('on');}

/* ---------- GRAFİK MOTORU (SVG) ---------- */
const PAL=['#0f4c5c','#e07a3f','#2a9d8f','#a24a68','#5b7bb4','#c9a227','#7d5ba6','#3f8f5f','#b45f4d','#64748b'];
const hashColor=s=>{let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))%997;return PAL[h%PAL.length];};

/* Halka grafik + açıklama listesi */
function chartDonut(items,centerLabel){
 items=items.filter(i=>i.value>0);
 const tot=items.reduce((s,i)=>s+i.value,0);
 if(tot<=0)return '<div class="empty">Gösterilecek veri yok</div>';
 const R=52,C=2*Math.PI*R;let off=C*0.25,segs='';
 const _dAct=it=>it.act?` data-act="${it.act}" data-arg="${esc(it.arg==null?'':it.arg)}" style="cursor:pointer"`:''; // A4: dilim/lejant tıklanabilirliği
 items.forEach((it,i)=>{const len=it.value/tot*C;
  segs+=`<circle${_dAct(it)} r="${R}" cx="70" cy="70" fill="none" stroke="${it.color||PAL[i%PAL.length]}" stroke-width="21" stroke-dasharray="${len-1.5} ${C-len+1.5}" stroke-dashoffset="${off}"><title>${esc(it.label)}: ${fmt0(it.value)}</title></circle>`;
  off-=len;});
 const legend=items.map((it,i)=>`<div class="lgRow"${_dAct(it)}${it.act?' title="Detaya git"':''}><i style="background:${it.color||PAL[i%PAL.length]}"></i><span class="lgL">${esc(it.label)}</span><b>${fmt0(it.value)}</b><span class="lgP">%${(it.value/tot*100).toFixed(1)}</span></div>`).join('');
 return `<div class="donutWrap"><svg viewBox="0 0 140 140" class="donut">${segs}
   <text x="70" y="66" text-anchor="middle" style="font-size:15px;font-weight:800;fill:var(--ink)">${kfmt(tot)}</text>
   <text x="70" y="82" text-anchor="middle" style="font-size:8.5px;fill:var(--ink3);letter-spacing:.05em">${esc(centerLabel||'TOPLAM ₺')}</text>
  </svg><div class="lgCol">${legend}</div></div>`;
}

/* Alan / çizgi grafik (çok serili) */
function niceStep(raw){ /* 1-2-5x10^n 'nice' adim */
 raw=Math.max(+raw||0,1e-6);
 const p=Math.pow(10,Math.floor(Math.log10(raw)));
 const r=raw/p;
 return (r<=1?1:r<=2?2:r<=5?5:10)*p;
}
function chartArea(series,labels,h){
 h=h||210;
 if(!series.length||series.every(s=>s.values.every(v=>!+v)))return '<div class="empty"><b>Henüz hareket yok</b>İşlem girildikçe grafik burada oluşur.</div>';
 const W=640,pad=42,padB=26,padT=12;
 const n=Math.max(2,...series.map(s=>s.values.length));
 const min=Math.min(0,...series.flatMap(s=>s.values.map(v=>+v||0)));
 const max=Math.max(1,...series.flatMap(s=>s.values.map(v=>+v||0)));
 const X=i=>pad+i*(W-pad-14)/(n-1);
 const Y=v=>padT+((max-v)/(max-min))*(h-padB-padT);
 const stp=niceStep((max-min)/4);
 let grid='',prevLbl=null;
 for(let v=Math.ceil(min/stp)*stp;v<=max+stp*1e-6;v+=stp){const y=Y(v),lbl=kfmt(v);
  grid+=`<line x1="${pad}" y1="${y.toFixed(1)}" x2="${W-14}" y2="${y.toFixed(1)}" stroke="#e6eaf1" stroke-width="1"/>`;
  if(lbl!==prevLbl){grid+=`<text x="${pad-6}" y="${(y+3).toFixed(1)}" text-anchor="end" style="font-size:9.5px;fill:#94a0b0">${lbl}</text>`;prevLbl=lbl;}}
 const y0=Y(0);
 let paths='';
 for(const s of series){
  const pts=s.values.map((v,i)=>X(i).toFixed(1)+','+Y(v).toFixed(1)).join(' ');
  paths+=`<polygon points="${X(0).toFixed(1)},${y0.toFixed(1)} ${pts} ${X(s.values.length-1).toFixed(1)},${y0.toFixed(1)}" fill="${s.color}" opacity="0.13"/>
   <polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`;
  s.values.forEach((v,i)=>{paths+=`<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="2.6" fill="${s.color}"><title>${esc(labels[i]||'')}: ${fmt0(v)}</title></circle>`;});
 }
 if(min<0)paths+=`<line x1="${pad}" y1="${y0.toFixed(1)}" x2="${W-14}" y2="${y0.toFixed(1)}" stroke="var(--ink3)" stroke-width="1.2" stroke-dasharray="4 3"/>`;
 const step=Math.ceil(n/9);
 let xl='';
 labels.forEach((l,i)=>{if(i%step===0||i===n-1)xl+=`<text x="${X(i).toFixed(1)}" y="${h-8}" text-anchor="middle" style="font-size:9.5px;fill:#94a0b0">${esc(l)}</text>`;});
 const lg=series.map(s=>`<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('');
 return `<svg viewBox="0 0 ${W} ${h}" class="chartSvg">${grid}${paths}${xl}</svg><div class="legend">${lg}</div>`;
}

/* Dikey çubuk grafik (gruplu, değer etiketli) */
function chartVBars(groups,h){
 h=h||200;
 const max=Math.max(1,...groups.flatMap(g=>g.bars.map(b=>b.value)));
 return `<div class="vb" style="height:${h}px">`+groups.map(g=>
  `<div class="vbG"><div class="vbBars">`+
   g.bars.map(b=>{const pct=Math.max(1.5,b.value/max*100);
    return `<div class="vbB" title="${esc(b.name||'')}: ${fmt0(b.value)}"><span class="vbV">${kfmt(b.value)}</span><i style="height:${pct}%;background:${b.color}"></i></div>`;}).join('')+
  `</div><span class="vbL">${esc(g.label)}</span></div>`).join('')+`</div>`;
}

/* Yatay çubuk listesi */
function chartHBars(items,color){ // v14-H6: eksi bakiye artık kırmızı çizilir
 const max=Math.max(1,...items.map(i=>Math.abs(i.value)));
 if(!items.length)return '<div class="empty">Veri yok</div>';
 return items.map(i=>`<div class="hb"${i.act?` data-act="${i.act}" data-arg="${esc(i.arg==null?'':i.arg)}" style="cursor:pointer" title="Detaya git"`:''}><div class="hbT"><span>${esc(i.label)}</span><b>${fmt0(i.value)}</b></div>
  <div class="hbTrack"><div class="hbFill" style="width:${Math.abs(i.value)/max*100}%;background:${i.value<0?'var(--neg)':(i.color||color||'var(--acc)')}"></div></div></div>`).join('');
}

/* Segment sekme kontrolü */
function seg(items,cur,fn){return '<div class="seg">'+items.map(i=>`<button class="${i[0]===cur?'on':''}" data-act="${fn}" data-arg="${i[0]}">${i[1]}${i[2]!==undefined?'<span class=\"ct\">'+i[2]+'</span>':''}</button>`).join('')+'</div>';}

/* Mini eğilim çizgisi */
function spark(values,color){
 if(!values||values.length<2)return '';
 const min=Math.min(...values),max=Math.max(...values),rng=(max-min)||1;
 const pts=values.map((v,i)=>(i/(values.length-1)*100).toFixed(1)+','+(26-(v-min)/rng*22).toFixed(1)).join(' ');
 return `<svg viewBox="0 0 100 30" preserveAspectRatio="none" class="spark"><polyline points="${pts}" fill="none" stroke="${color||'var(--acc)'}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
}

const CEK_DURUM_TR={portfoy:'Portföyde',tahsilde:'Tahsilde',ciro:'Ciro edildi',kapandi:'Kapandı',karsiliksiz:'Karşılıksız'}; // v14-H3: tek kaynak — Excel/PDF'te 'tahsilde' ve 'ciro' boş çıkıyordu
/* ---------- HESAPLAMALAR ---------- */
function accBalance(a){
 let b=+a.opening||0;
 for(const t of S.txns){
  if(t.co!==a.co||t.deletedAt)continue;
  if(t.valueDate&&t.valueDate>todayISO())continue; // B2: valör günü gelmemiş tutar (POS blokajı) bakiyeye girmez
  if(t.type==='gelir'&&t.accId===a.id)b+=+t.amount;
  else if(t.type==='gider'&&t.accId===a.id)b-=+t.amount;
  else if(t.type==='virman'){if(t.accId===a.id)b-=+t.amount;if(t.accId2===a.id)b+=+t.amount;}
 }
 return b;
}
function accRangeFlow(a,from,to){ // seçili tarih aralığında bir hesabın dönem başı/giriş/çıkış/dönem sonu özeti
 let opening=+a.opening||0,into=0,out=0;
 for(const t of S.txns){
  if(t.co!==a.co||t.deletedAt)continue;
  let d=0;
  if(t.type==='gelir'&&t.accId===a.id)d=+t.amount;
  else if(t.type==='gider'&&t.accId===a.id)d=-t.amount;
  else if(t.type==='virman'){if(t.accId===a.id)d-=+t.amount;if(t.accId2===a.id)d+=+t.amount;}
  if(!d)continue;
  var _fd=t.valueDate||t.date; // B2: hesap akışında valör tarihi esas
  if(_fd<from)opening+=d;
  else if(_fd<=to){ if(d>0)into+=d; else out+=-d; }
 }
 return {opening,into,out,closing:opening+into-out};
}
function accSeries(a,days){ // son N gün, gün sonu bakiyeleri (tek geçiş)
 days=days||30;
 const start=addDays(todayISO(),-(days-1));
 let base=+a.opening||0;const delta={};
 for(const t of S.txns){
  if(t.co!==a.co||t.deletedAt)continue;
  let d=0;
  if(t.type==='gelir'&&t.accId===a.id)d=+t.amount;
  else if(t.type==='gider'&&t.accId===a.id)d=-t.amount;
  else if(t.type==='virman'){if(t.accId===a.id)d-= +t.amount;if(t.accId2===a.id)d+= +t.amount;}
  if(!d)continue;
  var _sd=t.valueDate||t.date; // B2: hesap seyri valör tarihiyle çizilir
  if(_sd<start)base+=d; else delta[_sd]=(delta[_sd]||0)+d;
 }
 const out=[];let run=base;
 for(let i=0;i<days;i++){const dt=addDays(start,i);run+=delta[dt]||0;out.push(run);}
 return out;
}
function dailySeries(co,days){ // gelir/gider günlük serileri (tek geçiş)
 const start=addDays(todayISO(),-(days-1));
 const g={},x={};
 for(const t of S.txns){
  if(t.co!==co||t.type==='virman'||t.date<start||t.deletedAt||t.xfer||t.src==='stok')continue;
  if(t.type==='gelir')g[t.date]=(g[t.date]||0)+ +t.amount;
  else x[t.date]=(x[t.date]||0)+ +t.amount;
 }
 const labels=[],gv=[],xv=[];
 for(let i=0;i<days;i++){const dt=addDays(start,i);labels.push(dt.slice(8)+'.'+dt.slice(5,7));gv.push(g[dt]||0);xv.push(x[dt]||0);}
 return {labels,gelir:gv,gider:xv};
}
function monthSeries(co,n,cat){ // son N ay {p,label,gelir,gider}
 const out=[];
 for(let i=n-1;i>=0;i--){
  const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-i);
  const p=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  let g=0,x=0;
  for(const t of S.txns){
   if(t.co!==co||t.type==='virman'||!t.date.startsWith(p)||t.deletedAt||t.xfer||t.src==='stok')continue;
   if(cat&&t.cat!==cat)continue;
   if(t.type==='gelir')g+=+t.amount;else x+=+t.amount;
  }
  out.push({p,label:AYLAR[+p.slice(5)-1].slice(0,3),gelir:g,gider:x});
 }
 return out;
}
function cariBalance(c){
 let b=+c.opening||0;
 for(const t of S.cariTxns) if(t.cariId===c.id&&!t.deletedAt) b+= t.type==='borc'? +t.amount : -t.amount;
 return b;
}
function cardDebt(card){
 let b=0;
 for(const t of S.cardTxns) if(t.cardId===card.id&&!t.deletedAt) b+= t.type==='harcama'? +t.amount : -t.amount;
 return b;
}
function nextDue(day){
 const t=new Date();let y=t.getFullYear(),m=t.getMonth()+1;
 let d=clampDay(y,m,day);
 if(daysDiff(d)<0){m++;if(m>12){m=1;y++;}d=clampDay(y,m,day);}
 return d;
}
function cekOfCariId(id){return S.cheques.find(function(c){return c.id===id&&c.cariId;});} // A1: cariye bagli cek islemi mi
function sumRange(co,from,to,opts){
 let g=0,x=0,byCat={},byCatG={};
 const _skipCL=!!(opts&&opts.skipCariLinked); // A1: tahakkuk modunda cari bagli nakit hareketleri (tahsilat/odeme/cek) dusulur — cift sayim onlenir
 for(const t of S.txns){
  if(t.co!==co||t.type==='virman'||t.deletedAt||t.xfer)continue;
  if(t.src==='stok'&&!(opts&&opts.includeStok))continue; // C3: tahakkuk COGS kaydı nakit toplamına girmez
  if(t.date<from||t.date>to)continue;
  if(_skipCL&&(t.cariTxnId||(t.cekId&&cekOfCariId(t.cekId))))continue;
  if(t.type==='gelir'){g+=+t.amount;byCatG[t.cat||'Diğer']=(byCatG[t.cat||'Diğer']||0)+ +t.amount;}
  else {x+=+t.amount; byCat[t.cat||'Diğer']=(byCat[t.cat||'Diğer']||0)+ +t.amount;}
 }
 return {gelir:g,gider:x,net:g-x,byCat,byCatG};
}
function kdvSummary(co,from,to){ // KDV tahsil edilen (gelir) / ödenen (gider) — tutarlar KDV dahil girildiği varsayılır: kdv=tutar×oran/(100+oran)
 let tahsil=0,odenen=0; const byRate={};
 for(const t of S.txns){
  if(t.co!==co||t.type==='virman'||t.deletedAt||!t.vat)continue;
  if(t.date<from||t.date>to)continue;
  const v=+t.vat||0; if(!v)continue;
  const kdvAmt=+t.amount*v/(100+v);
  if(t.type==='gelir')tahsil+=kdvAmt; else odenen+=kdvAmt;
  const key=(t.type==='gelir'?'Tahsil ':'Ödenen ')+'%'+v;
  byRate[key]=(byRate[key]||0)+kdvAmt;
 }
 for(const t of S.cariTxns){
  if(t.co!==co||t.deletedAt||!t.fatura||!t.vat)continue;
  if(t.date<from||t.date>to)continue;
  const v=+t.vat||0;if(!v)continue;
  const kdvAmt=+t.amount*v/(100+v);
  if(t.type==='borc')tahsil+=kdvAmt; else odenen+=kdvAmt;
  const key=(t.type==='borc'?'Tahsil (fatura) ':'Ödenen (fatura) ')+'%'+v;
  byRate[key]=(byRate[key]||0)+kdvAmt;
 }
 return {tahsil,odenen,net:tahsil-odenen,byRate};
}
function prevPeriodOf(from,to){ // seçili dönemle aynı uzunlukta, hemen öncesindeki dönem (karşılaştırma için)
 const span=Math.round((new Date(to+'T12:00')-new Date(from+'T12:00'))/86400000)+1;
 const pTo=addDays(from,-1);
 return {from:addDays(pTo,-(span-1)),to:pTo};
}
function pctChange(cur,prev){ if(!prev)return cur?100:0; return (cur-prev)/Math.abs(prev)*100; }

/* ---------- HATIRLATICILAR ---------- */
function reminders(co){
 const out=[];
 for(const c of byCo(S.cards,co)){const debt=cardDebt(c);if(debt<=0)continue;const d=nextDue(+c.dueDay);const df=daysDiff(d);if(df<=10)out.push({d,df,pg:'card',t:'Kredi kartı: '+c.name+' son ödeme',a:debt});}
 const per=monthISO();
 for(const f of byCo(S.fixed,co)){
  const paid=S.fixedLogs.some(l=>l.fixedId===f.id&&l.period===per&&!l.deletedAt);
  if(paid)continue;
  const d=nextDue(+f.payDay);const df=daysDiff(d);
  if(df<=12)out.push({d,df,pg:'fixed',t:({kira:'Kira',vergi:'Vergi',sgk:'SGK',fatura:'Fatura'})[f.type]+': '+f.name,a:+f.amount});
 }
 const _cariById=new Map(),_balMap=new Map(); // A15: tek geçişte cari bakiye haritası (O(n²) → O(n))
 for(const c of S.cari){ if(c.deletedAt)continue; _cariById.set(c.id,c); _balMap.set(c.id,+c.opening||0); }
 for(const t of S.cariTxns){ if(t.deletedAt||!_balMap.has(t.cariId))continue; _balMap.set(t.cariId,_balMap.get(t.cariId)+(t.type==='borc'?+t.amount:-t.amount)); }
 for(const t of S.cariTxns){
  if(t.co!==co||!t.vade||t.deletedAt||t.kapandi)continue;const df=daysDiff(t.vade);
  if(df<=7){const c=_cariById.get(t.cariId)||{};
   const _cb=_balMap.has(t.cariId)?_balMap.get(t.cariId):0;
   if(c.id&&((t.type==='borc'&&_cb<=0)||(t.type==='alacak'&&_cb>=0)))continue;
   out.push({d:t.vade,df,pg:'cari',t:(t.type==='borc'?'Tahsilat vadesi: ':'Ödeme vadesi: ')+(c.name||'?'),a:+t.amount});}
 }
 for(const p of S.posEntries){
  if(p.co!==co||p.status!=='bekliyor'||p.deletedAt)continue;const df=daysDiff(p.settleDate);
  if(df<=3)out.push({d:p.settleDate,df,pg:'pos',t:'POS hesaba geçiş: '+((S.pos.find(x=>x.id===p.posId)||{}).name||''),a:+p.net});
 }
 for(const c of S.cheques){
  if(c.co!==co||(c.durum!=='portfoy'&&c.durum!=='tahsilde')||c.deletedAt)continue;const df=daysDiff(c.vade);
  if(df<=7)out.push({d:c.vade,df,pg:'cek',t:(c.tip==='alinan'?'Çek tahsil vadesi: ':'Çek ödeme vadesi: ')+c.kisi+(c.durum==='tahsilde'?' (tahsilde)':''),a:+c.tutar});
 }
 for(const it of S.stock){
  if(it.co!==co||it.deletedAt)continue;const q=stockQty(it);
  if(+(it.min||0)>0&&q<=+it.min)out.push({d:todayISO(),df:0,pg:'stok',t:'Kritik stok: '+it.name+' ('+q+' '+(it.unit||'')+' kaldı)',a:null});
 }
 for(const g of S.tasks){
  if(g.co!==co||g.status==='tamam'||g.deletedAt)continue;const df=daysDiff(g.due);
  if(df<=3)out.push({d:g.due,df,pg:'task',t:'Görev: '+g.title+(g.who?' ('+g.who+')':''),a:null});
 }
 out.sort((a,b)=>a.d<b.d?-1:1);
 return out;
}
function remClass(df){return df<=0?'d-red':df<=3?'d-org':'d-yel';}
function remLbl(df){return df<0?Math.abs(df)+' gün gecikti':df===0?'BUGÜN':df===1?'yarın':df+' gün sonra';}

/* ---------- GEZİNME ---------- */
/* v34: SOL MENÜ SVG İKONLARI — çizgi (feather tarzı), stroke:currentColor.
   Render: ICO[anahtar]||anahtar — bilinmeyen anahtar emoji olarak aynen kalır. */
const ICO={
 home:'<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-7h5v7"/></svg>',
 sparkle:'<svg viewBox="0 0 24 24"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/></svg>',
 bank:'<svg viewBox="0 0 24 24"><path d="M3 9.5L12 4l9 5.5"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8"/><path d="M3 21h18"/></svg>',
 arrows:'<svg viewBox="0 0 24 24"><path d="M7 20V6"/><path d="M4 9l3-3 3 3"/><path d="M17 4v14"/><path d="M14 15l3 3 3-3"/></svg>',
 pos:'<svg viewBox="0 0 24 24"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 9.5h19"/><path d="M6 15h4"/></svg>',
 card:'<svg viewBox="0 0 24 24"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><rect x="6" y="9" width="4" height="3.2" rx="0.8"/><path d="M6 15.5h6"/></svg>',
 users:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17" cy="9" r="2.8"/><path d="M17.5 14.2c2.4.5 4 2.3 4 5.8"/></svg>',
 badge:'<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3h6"/><circle cx="12" cy="11" r="2.5"/><path d="M8.5 17.5c.6-1.8 1.9-2.7 3.5-2.7s2.9.9 3.5 2.7"/></svg>',
 calendar:'<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 10h17"/><path d="M8 3v4"/><path d="M16 3v4"/></svg>',
 doc:'<svg viewBox="0 0 24 24"><path d="M6 2.5h8l4 4V21.5H6z"/><path d="M14 2.5v4h4"/><path d="M9 12h6"/><path d="M9 16h6"/></svg>',
 box:'<svg viewBox="0 0 24 24"><path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5L12 12l8.5-4.5"/><path d="M12 12v9"/></svg>',
 tag:'<svg viewBox="0 0 24 24"><path d="M3 3h8l10 10-8 8L3 11z"/><circle cx="8" cy="8" r="1.6"/></svg>',
 target:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/></svg>',
 chart:'<svg viewBox="0 0 24 24"><path d="M4 20h16"/><path d="M7 20v-6"/><path d="M12 20V6"/><path d="M17 20v-9"/></svg>',
 check:'<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8 12.5l2.8 2.8L16.5 9"/></svg>',
 gear:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1"/></svg>',
 search:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M15.8 15.8L21 21"/></svg>'
};
const icHtml=k=>ICO[k]||k;
const PAGES=[
 {id:'dash', ic:'home', t:'Ana Sayfa'},
 {id:'ai',   ic:'sparkle', t:'AI Asistan'},
 {id:'acc',  ic:'bank',t:'Banka & Kasa'},
 {id:'tx',   ic:'arrows', t:'Gelir - Gider'},
 {id:'pos',  ic:'pos',t:'POS İşlemleri'},
 {id:'card', ic:'card',t:'Kredi Kartları'},
 {id:'cari', ic:'users',t:'Cari Hesaplar'},
 {id:'staff',ic:'badge',t:'Personel & Maaş'},
 {id:'fixed',ic:'calendar',t:'Sabit Ödemeler'},
 {id:'cek',  ic:'doc',t:'Çek & Senet'},
 {id:'stok', ic:'box',t:'Stok Takibi'},
 {id:'asset',ic:'tag',t:'Demirbaş'},
 {id:'budget',ic:'target',t:'Bütçe Kontrolü'},
 {id:'rep',  ic:'chart',t:'Raporlar'},
 {id:'task', ic:'check', t:'Görev & Duyuru'},
 {id:'set',  ic:'gear', t:'Ayarlar'}
];
function goSelect(){CO=null;document.getElementById('app').classList.remove('on');document.getElementById('selectScreen').style.display='flex';renderSelect();}
function renderSelect(){
 const g=document.getElementById('coGrid');
 let h='';
 for(const c of COMPANIES){
  if(!canAccessCo(c.id))continue;
  const accs=byCo(S.accounts,c.id);let bal=0;for(const a of accs)bal+=accBalance(a);
  const t=sumRange(c.id,todayISO(),todayISO());
  h+=`<button class="coCard" style="--cc:${c.color}" data-act="enterCo" data-arg="${c.id}">
    <div class="nm">${c.name}</div><div class="tp">${c.tip}</div>
    <div class="bal">Nakit + Banka <b>${fmt0(bal)}</b><span class="tiny">Bugünkü ciro: ${fmt0(t.gelir)}</span></div></button>`;
 }
 if(canAccessCo('grup')){
  h+=`<button class="coCard grup" data-act="enterCo" data-arg="grup">
   <div class="nm">LOLE GRUP</div><div class="tp">${GRUP.tip}</div>
   <div class="bal">4 şirket karşılaştırmalı<b>Konsolide Rapor →</b></div></button>`;
 }
 g.innerHTML=h||'<p class="tiny" style="color:#aab4c9;grid-column:1/-1;text-align:center">Henüz erişiminiz olan bir şirket yok. Yöneticinizle iletişime geçin.</p>';
 var uh=document.getElementById('uHello');
 if(uh){var _un=userName();uh.textContent=(_un&&_un!=='Kullanıcı')?('👤 Hoş geldiniz, '+_un):'👤 Adınızı tanıtın';}
 var sh=document.getElementById('sessHello');
 if(sh)sh.innerHTML=SESSION?('Giriş yapan: <b>'+esc(SESSION.username)+'</b>'+(SESSION.role==='super'?' <span class="chip w">Süper Yönetici</span>':' <span class="chip g">Kullanıcı</span>')+' &nbsp;·&nbsp; <button data-act="doLogout" style="text-decoration:underline;color:#c9d1e3">Çıkış Yap</button>'):'';
 var bc=document.getElementById('sysBackupCenter');
 if(bc)bc.innerHTML=isSuper()?
  `<div style="width:100%;max-width:560px;margin:22px auto 0;text-align:left;background:linear-gradient(160deg,rgba(255,255,255,.07),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.09);border-radius:20px;padding:22px 24px;backdrop-filter:blur(6px);color:#eef1f7;animation:pop .5s both">
    <h2 style="font-size:14.5px;font-weight:800;margin-bottom:10px;display:flex;align-items:center;gap:8px">🗄 Veri Yedekleme Merkezi</h2>
    <p style="font-size:12.5px;color:#aab4c9;margin-bottom:14px;line-height:1.5">Tek dosya, TÜM şirketler: ${COMPANIES.map(c=>c.name).join(' · ')}. Şirket bazlı değil, sistem geneli — hangi şirketi seçtiğinizin önemi yok.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
     <button class="btn" data-act="dlBackup">⬇ Sistem Yedeği Al (tüm şirketler)</button>
     <button class="btn gh" data-act="pickBackupFile" data-arg="upFileSys">⬆ Sistem Yedeğini Yükle</button>
    </div>
    <input type="file" id="upFileSys" accept=".json" style="display:none" data-actv="upBackupPick">
    <p style="font-size:11px;margin-top:10px;color:#8492ac">⚠ Yükleme, mevcut TÜM şirketlerin verisinin üzerine yazar. Yüklemeden önce güncel bir yedek almanız önerilir.</p>
   </div>`:'';
 try{a11yPass();}catch(e){}
}
function coJumpTo(coId,page){ // A6: grup raporundan şirketin ilgili modülüne tek tıkla geçiş
 enterCo(coId);
 if(CO===coId&&page&&CO!=='grup')go(page);
}
function enterCo(id){
 if(!canAccessCo(id)){toast('Bu şirkete erişim yetkiniz yok');return;}
 CO=id;
 document.body.dataset.co=id;
 document.getElementById('selectScreen').style.display='none';
 document.getElementById('app').classList.add('on');
 document.getElementById('sideCo').textContent=coName(id);
 buildNav();
 try{autoSettlePos();}catch(e){} // B2: şirkete girişte vadesi dolan POS blokajları otomatik işlenir
 go(id==='grup'?'grup':'dash');
}
function buildNav(){
 const pages= CO==='grup'
   ? [{id:'grup',ic:'chart',t:'Grup Raporu'},{id:'set',ic:'gear',t:'Ayarlar'}]
   : PAGES;
 document.getElementById('sideNav').innerHTML=
  pages.map(p=>`<button data-p="${p.id}" data-act="go" data-arg="${p.id}"><span class="ic">${icHtml(p.ic)}</span>${p.t}</button>`).join('')
  +`<button data-act="globalSearch"><span class="ic">${icHtml('search')}</span>Genel Arama</button>`;
 const mainTabs= CO==='grup'
  ? [{id:'grup',ic:'chart',t:'Rapor'},{id:'set',ic:'gear',t:'Ayarlar'}]
  : [{id:'dash',ic:'home',t:'Ana Sayfa'},{id:'tx',ic:'arrows',t:'İşlemler'},{id:'_add',ic:'+',t:''},{id:'rep',ic:'chart',t:'Raporlar'},{id:'_more',ic:'☰',t:'Menü'}];
 document.getElementById('bnavIn').innerHTML=mainTabs.map(p=>
  p.id==='_add'?`<button class="fab" data-act="quickAdd">+</button>`
  :`<button data-p="${p.id}" data-act="${p.id==='_more'?'openMore':'go'}" data-arg="${p.id==='_more'?'':p.id}"><span class="ic">${icHtml(p.ic)}</span>${p.t}</button>`).join('');
 document.getElementById('moreIn').innerHTML=
  (CO==='grup'?[]:PAGES).map(p=>`<button data-act="moreGo" data-arg="${p.id}"><span class="ic">${icHtml(p.ic)}</span>${p.t}</button>`).join('')
  +`<button data-act="globalSearch"><span class="ic">${icHtml('search')}</span>Genel Arama</button><button data-act="moreGo" data-arg="_select"><span class="ic">⇄</span>Şirket Değiştir</button>`;
}
function openMore(){document.getElementById('moreSheet').classList.add('on');}
function go(p){
 PAGE=p;
 document.querySelectorAll('[data-p]').forEach(b=>b.classList.toggle('on',b.dataset.p===p));
 const R={dash:rDash,ai:rAi,acc:rAcc,tx:rTx,pos:rPos,card:rCard,cari:rCari,staff:rStaff,fixed:rFixed,cek:rCek,stok:rStock,asset:rAsset,budget:rBudget,rep:rRep,task:rTask,set:rSet,grup:rGrup};
 (R[p]||rDash)();
 updateSaveBadge();
 try{window.scrollTo(0,0);}catch(e){}
 try{a11yPass();}catch(e){}
}
function topbar(title,btnHtml){
 return `<div class="topbar"><div class="tt"><span class="spine"></span><div style="position:relative">
  <div class="eyebrow" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><button class="coSwitch" data-act="toggleCoMenu"><span class="dot"></span>${coName(CO)} ▾</button><span class="hidem">${dTR(todayISO())}</span>${isTeam()?'<span class="chip w" title="Ekip modu — ortak veri">🌐 Ekip</span>':''}<span id="saveBadge" class="chip g" title="Bulut kayıt durumu">✓ Kaydedildi</span></div>
  ${coMenuHtml()}
  <h1>${title}</h1></div></div>
  <div class="tb-actions"><button class="userChip" data-act="userForm" title="Profili düzenle">👤 ${esc(userName())}</button>${btnHtml||''}</div></div>`;
}

/* ---------- MODAL FORM & ONAY (tarayıcı confirm/prompt KULLANILMAZ) ---------- */
var modalCb=null,modalFields=null;
function parseAmt(v){ // "1.500,75" / "1500.75" / "1500,5" / "1500" hepsini kabul et
 v=String(v==null?'':v).trim().replace(/\s|₺|TL/gi,'');
 if(v==='')return NaN;
 if(v.includes(',')&&v.includes('.')) v=v.replace(/\./g,'').replace(',','.');
 else if(v.includes(',')) v=v.replace(',','.');
 return parseFloat(v);
}
function openForm(title,fields,onSubmit,init){
 init=init||{};
 window.__lastFocusEl=document.activeElement; // B6: modal kapaninca odak geri verilir
 modalCb=onSubmit;
 modalFields=[];
 for(const f of fields){ if(f.row)modalFields.push(...f.row); else modalFields.push(f); }
 const body=fields.map(f=>{
  if(f.row) return '<div class="frow">'+f.row.map(x=>fldHtml(x,init)).join('')+'</div>';
  return fldHtml(f,init);
 }).join('');
 /* ÖNEMLİ: <form> KULLANILMAZ — sandbox ortamlarında form gönderimi engellendiği için
    kaydetme tamamen düğme + betikle yapılır. */
 document.getElementById('modalBox').innerHTML=
  `<div class="mh"><h3>${esc(title)}</h3><button data-act="closeModal" style="font-size:20px;color:var(--ink3)">✕</button></div>
   <div class="mb"><div id="mForm">${body}</div></div>
   <div class="mf"><button type="button" class="btn gh" data-act="closeModal">Vazgeç</button><button type="button" class="btn" id="mSave" data-act="doSubmit">Kaydet</button></div>`;
 var _mbx=document.getElementById('modalBox'); // B6: erisilebilir dialog
 _mbx.setAttribute('role','dialog');_mbx.setAttribute('aria-modal','true');
 const fEl=document.getElementById('mForm');
 fEl.addEventListener('submit',submitModal); // eski test/entegrasyon uyumu
 fEl.addEventListener('keydown',e=>{ if(e.key==='Enter'&&e.target&&e.target.tagName!=='TEXTAREA'){e.preventDefault();doSubmit();} });
 document.getElementById('mSave').onclick=doSubmit; // delegasyona ek doğrudan bağ (çifte güvence)
 document.getElementById('modalWrap').classList.add('on');
 setTimeout(()=>{const el=document.querySelector('#mForm input,#mForm select');if(el)try{el.focus();}catch(e){}},60);
}
function fldHtml(f,init){
 const v=init[f.name]!==undefined?init[f.name]:(f.def!==undefined?f.def:'');
 let inp='';
 if(f.type==='select'){ /* v14-K1: init değeri seçenek listesinde yoksa (silinmiş kategori, pasife alınmış hesap/personel/cari) tarayıcı sessizce İLK seçeneği seçiyor ve Kaydet'te veri değişiyordu — mevcut değeri listenin başına ekleyip koruyoruz */
  var _opts=(f.opts||[]).slice();
  if(v!==''&&v!==undefined&&v!==null&&!_opts.some(function(o){return String(Array.isArray(o)?o[0]:o)===String(v);})) _opts.unshift([v,String(v)+' (mevcut — listede yok)']);
  inp=`<select name="${f.name}">${_opts.map(o=>{const val=Array.isArray(o)?o[0]:o,lbl=Array.isArray(o)?o[1]:o;return `<option value="${esc(val)}" ${String(val)===String(v)?'selected':''}>${esc(lbl)}</option>`;}).join('')}</select>`;
 }
 else if(f.type==='textarea') inp=`<textarea name="${f.name}" rows="3">${esc(v)}</textarea>`;
 else if(f.type==='number') inp=`<input name="${f.name}" type="text" inputmode="decimal" autocomplete="off" value="${esc(v)}" placeholder="${esc(f.ph||'0')}">`;
 else if(f.type==='checks'){const arr=Array.isArray(v)?v:[];inp=`<div class="checkGrp">${(f.opts||[]).map(o=>{const val=Array.isArray(o)?o[0]:o,lbl=Array.isArray(o)?o[1]:o;return `<label class="ckOpt"><input type="checkbox" name="${f.name}" value="${esc(val)}" ${arr.indexOf(val)!==-1?'checked':''}> ${esc(lbl)}</label>`;}).join('')}</div>`;}
 else inp=`<input name="${f.name}" type="${f.type||'text'}" value="${esc(v)}" placeholder="${esc(f.ph||'')}">`;
 return `<div class="fld"><label>${f.label}${f.req?' *':''}</label>${inp}</div>`;
}
function doSubmit(){
 const box=document.getElementById('mForm');
 if(!box||!modalCb)return;
 try{box.querySelectorAll('.ferr').forEach(function(x){x.remove();});}catch(e){} // B6: onceki hata satirlarini temizle
 const o={};let bad=null;
 for(const f of (modalFields||[])){
  if(f.type==='checks'){
   const els=box.querySelectorAll('[name="'+f.name+'"]:checked');
   o[f.name]=Array.prototype.map.call(els,function(x){return x.value;});
   continue;
  }
  const el=box.querySelector('[name="'+f.name+'"]');
  if(!el)continue;
  el.style.borderColor='';
  let val=el.value;
  if(f.type==='number'){
   const n=parseAmt(val);
   if(val!==''&&isNaN(n)){bad=bad||[f,el,'sayı olmalı'];}
   else if(f.req&&(val===''||isNaN(n))){bad=bad||[f,el,'zorunlu'];}
   else if(!isNaN(n)&&f.min!==undefined&&n<+f.min){bad=bad||[f,el,'en az '+f.min+' olmalı'];}
   val=isNaN(n)?'':n;
  }else if(f.req&&String(val).trim()===''){bad=bad||[f,el,'zorunlu'];}
  o[f.name]=val;
 }
 if(bad){
  bad[1].style.borderColor='var(--neg)';
  try{ // B6: hatayi yalniz kaybolan toast'la degil, alanin altinda kalici satirla goster
   var _fw=bad[1].closest('.fld');
   if(_fw){var _fe=document.createElement('div');_fe.className='ferr';_fe.setAttribute('role','alert');_fe.textContent='"'+bad[0].label.replace(/\s*\(.*\)/,'')+'" alanı '+bad[2];_fw.appendChild(_fe);}
  }catch(e){}
  try{bad[1].focus();}catch(e){}
  toast('"'+bad[0].label.replace(/\s*\(.*\)/,'')+'" alanı '+bad[2]);
  return;
 }
 const cb=modalCb;
 closeModal();
 cb(o);
}
function submitModal(e){ if(e&&e.preventDefault)e.preventDefault(); doSubmit(); return false; }
function closeModal(){document.getElementById('modalWrap').classList.remove('on');modalCb=null;modalFields=null;try{if(window.__lastFocusEl&&window.__lastFocusEl.focus&&document.contains(window.__lastFocusEl))window.__lastFocusEl.focus();}catch(e){}window.__lastFocusEl=null;}
document.addEventListener('keydown',function(e){ // B6: Escape ile modal kapatma
 if(e.key==='Escape'){var mw=document.getElementById('modalWrap');if(mw&&mw.classList.contains('on')){e.preventDefault();closeModal();}}
});
function uiConfirm(msg,onYes,opt){
 opt=opt||{};
 document.getElementById('modalBox').innerHTML=
  `<div class="mh"><h3>${esc(opt.title||'Onay')}</h3><button data-act="closeModal" style="font-size:20px;color:var(--ink3)">✕</button></div>
   <div class="mb"><p style="font-size:14px;line-height:1.55">${esc(msg)}</p></div>
   <div class="mf"><button class="btn gh" data-act="closeModal">Vazgeç</button><button class="btn ${opt.danger?'solidDng':''}" id="cfYes">${esc(opt.yes||'Evet, Devam')}</button></div>`;
 window.__cfCb=onYes;
 document.getElementById('cfYes').onclick=cfRun;
 document.getElementById('modalWrap').classList.add('on');
}
function cfRun(){var cb=window.__cfCb;window.__cfCb=null;closeModal();if(cb)cb();}
/* Tek noktadan silme kayıt defteri (data-act="del" data-arg="tür~id") */
function softDelete(arr,id,kind,labelFn){
 var rec=arr.find(function(x){return x.id===id;});
 if(!rec)return null;
 if(rec.co&&!canAccessCo(rec.co)){toast('Bu şirkette silme yetkiniz yok');return null;}
 rec.deletedAt=new Date().toISOString();
 rec.deletedBy=SESSION?SESSION.username:'';
 var lbl='';try{lbl=labelFn?labelFn(rec):'';}catch(e){}
 try{logAudit('Kayıt silindi',(kind||'')+': '+(lbl||id));}catch(e){}
 S.trash=S.trash||[];
 S.trash.unshift({kind:kind,id:id,label:lbl,deletedAt:rec.deletedAt,deletedBy:rec.deletedBy});
 if(S.trash.length>500)S.trash.length=500;
 return rec;
}
function cascadeSoftDelete(arr,matchFn){
 arr.forEach(function(t){ if(matchFn(t)&&!t.deletedAt){ t.deletedAt=new Date().toISOString(); t.deletedBy=SESSION?SESSION.username:''; } });
}
function del(kind,id){
 const R={
  acc:['Hesap silinsin mi? Bu hesaba bağlı '+S.txns.filter(t=>(t.accId===id||t.accId2===id)&&!t.deletedAt).length+' yaşayan işlem var. (Hareket kayıtları korunur, çöp kutusuna taşınır)',()=>{softDelete(S.accounts,id,'acc',r=>'Hesap: '+r.name);}],
  tx:['İşlem silinsin mi? (Bağlı kayıtlar da birlikte silinir; taksitli kart harcamasında TÜM taksitler birlikte silinir; 30 gün içinde geri getirilebilir)',()=>{const rec=softDelete(S.txns,id,'tx',r=>(r.type==='gelir'?'Gelir':r.type==='gider'?'Gider':'Virman')+': '+fmt0(r.amount)+(r.desc?' - '+r.desc:r.cat?' - '+r.cat:''));if(rec){cascadeSoftDelete(S.fixedLogs,l=>l.txnId===id);if(rec.cariTxnId)cascadeSoftDelete(S.cariTxns,x=>x.id===rec.cariTxnId);if(rec.cardTxnId){cascadeSoftDelete(S.cardTxns,x=>x.id===rec.cardTxnId);cascadeSoftDelete(S.txns,t=>t.cardTxnId===rec.cardTxnId&&t.id!==id);}if(rec.staffTxnId)cascadeSoftDelete(S.staffTxns,x=>x.id===rec.staffTxnId);if(rec.cekId){var _ck=S.cheques.find(x=>x.id===rec.cekId);if(_ck&&!_ck.deletedAt)_ck.durum=_ck.prevDurum||'portfoy'; /* v14-K7: tahsildeyken kapatilan cek silinince tahsilde durumuna doner */cascadeSoftDelete(S.cariTxns,x=>x.cekId===rec.cekId);}if(rec.posEId){var _pe=S.posEntries.find(x=>x.id===rec.posEId);if(_pe&&!_pe.deletedAt){_pe.status='bekliyor';_pe.noAutoSettle=1;} /* v14-K8: autoSettlePos ayni kaydi hemen yeniden uretmesin */cascadeSoftDelete(S.txns,t=>t.posEId===rec.posEId&&t.id!==id);cascadeSoftDelete(S.cariTxns,x=>x.posEId===rec.posEId);}if(rec.stokTxnId){cascadeSoftDelete(S.stockTxns,x=>x.id===rec.stokTxnId);cascadeSoftDelete(S.cardTxns,x=>x.stokTxnId===rec.stokTxnId);cascadeSoftDelete(S.cariTxns,x=>x.stokTxnId===rec.stokTxnId);}if(rec.assetId){cascadeSoftDelete(S.cardTxns,x=>x.assetId===rec.assetId);cascadeSoftDelete(S.cariTxns,x=>x.assetId===rec.assetId);}}}],
  pos:['POS tanımı, girişleri ve bağlı gelir/komisyon/cari kayıtları silinsin mi? (Çöp kutusuna taşınır)',()=>{softDelete(S.pos,id,'pos',r=>'POS: '+r.name);var _peids=S.posEntries.filter(t=>t.posId===id).map(t=>t.id);cascadeSoftDelete(S.posEntries,t=>t.posId===id);cascadeSoftDelete(S.txns,t=>t.posEId&&_peids.indexOf(t.posEId)>-1);cascadeSoftDelete(S.cariTxns,t=>t.posEId&&_peids.indexOf(t.posEId)>-1);}], // v14-K5: eskiden yalnız tanım siliniyor, girişler yetim kalıp KPI'ları şişiriyordu
  posE:['POS girişi silinsin mi? (Hesaba geçmişse bağlı gelir/komisyon/cari kayıtları da birlikte silinir)',()=>{softDelete(S.posEntries,id,'posE',r=>'POS girişi: '+fmt0(r.net)+' ('+r.date+')');cascadeSoftDelete(S.txns,t=>t.posEId===id);cascadeSoftDelete(S.cariTxns,t=>t.posEId===id);}],
  card:['Kart, hareketleri ve bağlı gider/cari/sabit-ödeme kayıtları silinsin mi? (Çöp kutusuna taşınır)',()=>{softDelete(S.cards,id,'card',r=>'Kart: '+r.name);var _ctids=S.cardTxns.filter(t=>t.cardId===id).map(t=>t.id);var _ccids=S.cardTxns.filter(t=>t.cardId===id&&t.cariTxnId).map(t=>t.cariTxnId);var _cstids=S.cardTxns.filter(t=>t.cardId===id&&t.staffTxnId).map(t=>t.staffTxnId);var _ctxids=S.txns.filter(t=>t.cardTxnId&&_ctids.indexOf(t.cardTxnId)>-1).map(t=>t.id);cascadeSoftDelete(S.cardTxns,t=>t.cardId===id);cascadeSoftDelete(S.txns,t=>t.cardTxnId&&_ctids.indexOf(t.cardTxnId)>-1);cascadeSoftDelete(S.cariTxns,t=>_ccids.indexOf(t.id)>-1);cascadeSoftDelete(S.staffTxns,t=>_cstids.indexOf(t.id)>-1);cascadeSoftDelete(S.fixedLogs,l=>l.txnId&&_ctxids.indexOf(l.txnId)>-1);}], // v14-K3: eskiden gider ve tedarikçi carisi yetim kalıyordu
  cardT:['Kayıt silinsin mi? (Bağlı gider/banka/cari/personel/sabit-ödeme kaydı da birlikte silinir)',()=>{softDelete(S.cardTxns,id,'cardT',r=>'Kart hareketi: '+fmt0(r.amount));var _ktx=S.txns.filter(t=>t.cardTxnId===id).map(t=>t.id);cascadeSoftDelete(S.txns,t=>t.cardTxnId===id);var _ct=S.cardTxns.find(x=>x.id===id);if(_ct&&_ct.cariTxnId)cascadeSoftDelete(S.cariTxns,x=>x.id===_ct.cariTxnId);if(_ct&&_ct.staffTxnId)cascadeSoftDelete(S.staffTxns,x=>x.id===_ct.staffTxnId);cascadeSoftDelete(S.fixedLogs,l=>l.txnId&&_ktx.indexOf(l.txnId)>-1);}], // v14-K4
  cari:['Cari, tüm hareketleri ve bunların doğurduğu nakit/kart kayıtları silinsin mi? (Çöp kutusuna taşınır)',()=>{softDelete(S.cari,id,'cari',r=>'Cari: '+r.name);var _cids=S.cariTxns.filter(t=>t.cariId===id).map(t=>t.id);cascadeSoftDelete(S.cariTxns,t=>t.cariId===id);cascadeSoftDelete(S.txns,t=>t.cariTxnId&&_cids.indexOf(t.cariTxnId)>-1);cascadeSoftDelete(S.cardTxns,t=>t.cariTxnId&&_cids.indexOf(t.cariTxnId)>-1);}], // v14-K2: eskiden nakit eşi yetim kalıp her seferinde denetim hatası üretiyordu
  cariT:['Hareket silinsin mi? (Bağlı nakit/kart kaydı da birlikte silinir)',()=>{softDelete(S.cariTxns,id,'cariT',r=>'Cari hareketi: '+fmt0(r.amount));cascadeSoftDelete(S.txns,t=>t.cariTxnId===id);cascadeSoftDelete(S.cardTxns,t=>t.cariTxnId===id);}],
  staffPerma:['Personel kaydı KALICI olarak silinsin mi? (Çöp kutusuna taşınır, 30 gün içinde geri getirilebilir; ödeme ve izin geçmişi birlikte gizlenir)',()=>{softDelete(S.staff,id,'staffPerma',r=>'Personel (kalıcı): '+r.name);cascadeSoftDelete(S.staffTxns,t=>t.staffId===id);cascadeSoftDelete(S.leaves,t=>t.staffId===id);}],
  staffT:['Kayıt silinsin mi? (Hesaptan/karttan düşen bağlı kayıtlar da birlikte silinir)',()=>{softDelete(S.staffTxns,id,'staffT',r=>'Personel ödemesi: '+fmt0(r.amount));cascadeSoftDelete(S.txns,t=>t.staffTxnId===id);cascadeSoftDelete(S.cardTxns,t=>t.staffTxnId===id);}],
  leave:['İzin silinsin mi?',()=>{softDelete(S.leaves,id,'leave',()=>'İzin kaydı');}],
  fixed:['Tanım ve ödeme geçmişi silinsin mi? (Bağlı gider kayıtları da birlikte silinir; çöp kutusuna taşınır)',()=>{softDelete(S.fixed,id,'fixed',r=>'Sabit ödeme: '+r.name);var _ltx=S.fixedLogs.filter(l=>l.fixedId===id&&l.txnId).map(l=>l.txnId);cascadeSoftDelete(S.fixedLogs,l=>l.fixedId===id);cascadeSoftDelete(S.txns,t=>_ltx.indexOf(t.id)>-1);}], // v14-K6: eskiden loglar yaşamaya devam edip 'Bu Ay Kalan' KPI'sını bozuyordu
  fixedL:['Ödeme kaydı ve bağlı gider silinsin mi? (Kart/cari eşleri de birlikte silinir; çöp kutusuna taşınır)',()=>{const l=S.fixedLogs.find(z=>z.id===id);softDelete(S.fixedLogs,id,'fixedL',r=>'Ödeme kaydı: '+fmt0(r.amount));if(l&&l.txnId){var _t=S.txns.find(t=>t.id===l.txnId);cascadeSoftDelete(S.txns,t=>t.id===l.txnId);if(_t){if(_t.cardTxnId){cascadeSoftDelete(S.cardTxns,x=>x.id===_t.cardTxnId);var _ct2=S.cardTxns.find(x=>x.id===_t.cardTxnId);if(_ct2&&_ct2.cariTxnId)cascadeSoftDelete(S.cariTxns,x=>x.id===_ct2.cariTxnId);}if(_t.cariTxnId)cascadeSoftDelete(S.cariTxns,x=>x.id===_t.cariTxnId);}}}],
  task:['Görev silinsin mi?',()=>{softDelete(S.tasks,id,'task',r=>'Görev: '+r.title);}],
  note:['Duyuru silinsin mi?',()=>{softDelete(S.notes,id,'note',()=>'Duyuru');}],
  cek:['Çek/senet kaydı silinsin mi? (Tahsilat/ödeme ve cari kayıtları varsa birlikte silinir)',()=>{softDelete(S.cheques,id,'cek',r=>'Çek/Senet: '+(r.kisi||'')+' '+fmt0(r.tutar));cascadeSoftDelete(S.txns,t=>t.cekId===id);cascadeSoftDelete(S.cariTxns,t=>t.cekId===id);}],
  stok:['Ürün ve stok hareketleri silinsin mi? (Bağlı gider/cari/kart kayıtları da birlikte silinir; çöp kutusuna taşınır)',()=>{softDelete(S.stock,id,'stok',r=>'Ürün: '+r.name);var _sids=S.stockTxns.filter(t=>t.itemId===id).map(t=>t.id);cascadeSoftDelete(S.stockTxns,t=>t.itemId===id);cascadeSoftDelete(S.txns,t=>t.stokTxnId&&_sids.indexOf(t.stokTxnId)>-1);cascadeSoftDelete(S.cardTxns,t=>t.stokTxnId&&_sids.indexOf(t.stokTxnId)>-1);cascadeSoftDelete(S.cariTxns,t=>t.stokTxnId&&_sids.indexOf(t.stokTxnId)>-1);}],
  stokT:['Stok hareketi silinsin mi? (Bağlı gider/cari/kart kaydı da birlikte silinir)',()=>{softDelete(S.stockTxns,id,'stokT',()=>'Stok hareketi');cascadeSoftDelete(S.txns,t=>t.stokTxnId===id);cascadeSoftDelete(S.cardTxns,t=>t.stokTxnId===id);cascadeSoftDelete(S.cariTxns,t=>t.stokTxnId===id);}],
  asset:['Demirbaş silinsin mi? (Bağlı alım/satış ve cari/kart kayıtları da birlikte silinir)',()=>{softDelete(S.assets,id,'asset',r=>'Demirbaş: '+r.name);cascadeSoftDelete(S.txns,t=>t.assetId===id);cascadeSoftDelete(S.cardTxns,t=>t.assetId===id);cascadeSoftDelete(S.cariTxns,t=>t.assetId===id);}],
  budget:['Bütçe kalemi silinsin mi?',()=>{softDelete(S.budgets,id,'budget',r=>'Bütçe: '+r.cat);}]
 }[kind];
 if(R)askDel(R[0],R[1]);
}
function askDel(msg,fn){ uiConfirm(msg||'Bu kayıt silinsin mi?',()=>{fn();save();toast('Kayıt çöp kutusuna taşındı — 30 gün içinde geri getirilebilir');go(PAGE);},{danger:1,title:'Silme Onayı',yes:'Evet, Sil'}); }
function restoreTrash(idxStr){
 if(!isSuper())return;
 const idx=+idxStr;
 const entry=(S.trash||[])[idx];
 if(!entry){toast('Kayıt bulunamadı');return;}
 const ARR={acc:S.accounts,tx:S.txns,pos:S.pos,posE:S.posEntries,card:S.cards,cardT:S.cardTxns,cari:S.cari,cariT:S.cariTxns,
  staffT:S.staffTxns,leave:S.leaves,staffPerma:S.staff,fixed:S.fixed,fixedL:S.fixedLogs,task:S.tasks,note:S.notes,cek:S.cheques,stok:S.stock,stokT:S.stockTxns,asset:S.assets,budget:S.budgets};
 const arr=ARR[entry.kind];
 const rec=arr?arr.find(x=>x.id===entry.id):null;
 if(!rec){toast('Kayıt bulunamadı (belki kalıcı silinmiş)');S.trash=(S.trash||[]).filter((e,i)=>i!==idx);save();return;}
 delete rec.deletedAt;delete rec.deletedBy;
 if(entry.kind==='card'){var _rk=[],_rkc=[],_rks=[],_rkt=[];S.cardTxns.forEach(t=>{if(t.cardId===entry.id&&t.deletedAt){delete t.deletedAt;delete t.deletedBy;_rk.push(t.id);if(t.cariTxnId)_rkc.push(t.cariTxnId);if(t.staffTxnId)_rks.push(t.staffTxnId);}});S.txns.forEach(function(t){if(t.cardTxnId&&_rk.indexOf(t.cardTxnId)>-1&&t.deletedAt){delete t.deletedAt;delete t.deletedBy;_rkt.push(t.id);}});S.cariTxns.forEach(function(t){if(_rkc.indexOf(t.id)>-1&&t.deletedAt){delete t.deletedAt;delete t.deletedBy;}});S.staffTxns.forEach(function(t){if(_rks.indexOf(t.id)>-1&&t.deletedAt){delete t.deletedAt;delete t.deletedBy;}});S.fixedLogs.forEach(function(l){if(l.txnId&&_rkt.indexOf(l.txnId)>-1&&l.deletedAt){delete l.deletedAt;delete l.deletedBy;}});} /* v14-K3 simetri */
 if(entry.kind==='cari'){var _rc=[];S.cariTxns.forEach(t=>{if(t.cariId===entry.id&&t.deletedAt){delete t.deletedAt;delete t.deletedBy;_rc.push(t.id);}});[S.txns,S.cardTxns].forEach(function(a2){a2.forEach(function(t){if(t.cariTxnId&&_rc.indexOf(t.cariTxnId)>-1&&t.deletedAt){delete t.deletedAt;delete t.deletedBy;}});});} /* v14-K2 simetri */
 if(entry.kind==='stok'){var _sids2=[];S.stockTxns.forEach(t=>{if(t.itemId===entry.id&&t.deletedAt){delete t.deletedAt;delete t.deletedBy;_sids2.push(t.id);}});[S.txns,S.cardTxns,S.cariTxns].forEach(function(arr2){arr2.forEach(function(t){if(t.stokTxnId&&_sids2.indexOf(t.stokTxnId)>-1&&t.deletedAt){delete t.deletedAt;delete t.deletedBy;}});});}
 if(entry.kind==='stokT')[S.txns,S.cardTxns,S.cariTxns].forEach(function(arr2){arr2.forEach(function(t){if(t.stokTxnId===entry.id&&t.deletedAt){delete t.deletedAt;delete t.deletedBy;}});});
 if(entry.kind==='asset')[S.txns,S.cardTxns,S.cariTxns].forEach(function(arr2){arr2.forEach(function(t){if(t.assetId===entry.id&&t.deletedAt){delete t.deletedAt;delete t.deletedBy;}});});
 if(entry.kind==='staffPerma'){rec.active='0';S.staffTxns.forEach(t=>{if(t.staffId===entry.id&&t.deletedAt){delete t.deletedAt;delete t.deletedBy;}});S.leaves.forEach(t=>{if(t.staffId===entry.id&&t.deletedAt){delete t.deletedAt;delete t.deletedBy;}});}
 if(entry.kind==='fixedL'&&rec.txnId){const t=S.txns.find(x=>x.id===rec.txnId);if(t&&t.deletedAt){delete t.deletedAt;delete t.deletedBy;}if(t){if(t.cardTxnId){var _fc1=S.cardTxns.find(function(x){return x.id===t.cardTxnId;});if(_fc1&&_fc1.deletedAt){delete _fc1.deletedAt;delete _fc1.deletedBy;}if(_fc1&&_fc1.cariTxnId){var _fc2=S.cariTxns.find(function(x){return x.id===_fc1.cariTxnId;});if(_fc2&&_fc2.deletedAt){delete _fc2.deletedAt;delete _fc2.deletedBy;}}}if(t.cariTxnId){var _fc3=S.cariTxns.find(function(x){return x.id===t.cariTxnId;});if(_fc3&&_fc3.deletedAt){delete _fc3.deletedAt;delete _fc3.deletedBy;}}}}
 var __und=function(t){if(t&&t.deletedAt){delete t.deletedAt;delete t.deletedBy;}};
 if(entry.kind==='cariT'){S.txns.forEach(function(t){if(t.cariTxnId===entry.id)__und(t);});S.cardTxns.forEach(function(t){if(t.cariTxnId===entry.id)__und(t);});}
 if(entry.kind==='cardT'){S.txns.forEach(function(t){if(t.cardTxnId===entry.id)__und(t);});if(rec.cariTxnId)__und(S.cariTxns.find(function(x){return x.id===rec.cariTxnId;}));}
 if(entry.kind==='staffT'){S.txns.forEach(function(t){if(t.staffTxnId===entry.id)__und(t);});S.cardTxns.forEach(function(t){if(t.staffTxnId===entry.id)__und(t);});}
 if(entry.kind==='cek'){S.txns.forEach(function(t){if(t.cekId===entry.id)__und(t);});S.cariTxns.forEach(function(t){if(t.cekId===entry.id)__und(t);});}
 if(entry.kind==='tx'){S.fixedLogs.forEach(function(l){if(l.txnId===entry.id)__und(l);});if(rec.cariTxnId)__und(S.cariTxns.find(function(x){return x.id===rec.cariTxnId;}));if(rec.cardTxnId){__und(S.cardTxns.find(function(x){return x.id===rec.cardTxnId;}));S.txns.forEach(function(t){if(t.cardTxnId===rec.cardTxnId)__und(t);});}if(rec.staffTxnId)__und(S.staffTxns.find(function(x){return x.id===rec.staffTxnId;}));if(rec.cekId){var _ck2=S.cheques.find(function(x){return x.id===rec.cekId;});if(_ck2)_ck2.durum='kapandi';S.cariTxns.forEach(function(x){if(x.cekId===rec.cekId)__und(x);});}if(rec.posEId){var _pe2=S.posEntries.find(function(x){return x.id===rec.posEId;});if(_pe2){_pe2.status='gecti';delete _pe2.noAutoSettle;}S.txns.forEach(function(t){if(t.posEId===rec.posEId)__und(t);});S.cariTxns.forEach(function(t){if(t.posEId===rec.posEId)__und(t);});}if(rec.stokTxnId){__und(S.stockTxns.find(function(x){return x.id===rec.stokTxnId;}));S.cardTxns.forEach(function(t){if(t.stokTxnId===rec.stokTxnId)__und(t);});S.cariTxns.forEach(function(t){if(t.stokTxnId===rec.stokTxnId)__und(t);});}if(rec.assetId){S.cardTxns.forEach(function(t){if(t.assetId===rec.assetId)__und(t);});S.cariTxns.forEach(function(t){if(t.assetId===rec.assetId)__und(t);});}}
 if(entry.kind==='posE'){S.txns.forEach(function(t){if(t.posEId===entry.id)__und(t);});S.cariTxns.forEach(function(t){if(t.posEId===entry.id)__und(t);});}
 if(entry.kind==='pos'){var _rp=[];S.posEntries.forEach(function(t){if(t.posId===entry.id&&t.deletedAt){__und(t);_rp.push(t.id);}});[S.txns,S.cariTxns].forEach(function(a2){a2.forEach(function(t){if(t.posEId&&_rp.indexOf(t.posEId)>-1)__und(t);});});} /* v14-K5 simetri */
 if(entry.kind==='fixed'){var _rf=[];S.fixedLogs.forEach(function(l){if(l.fixedId===entry.id&&l.deletedAt){__und(l);if(l.txnId)_rf.push(l.txnId);}});S.txns.forEach(function(t){if(_rf.indexOf(t.id)>-1)__und(t);});} /* v14-K6 simetri */
 S.trash=(S.trash||[]).filter((e,i)=>i!==idx);
 logAudit('Kayıt geri getirildi',entry.label||entry.kind);
 save();toast('Kayıt geri getirildi');go(PAGE);
}
function purgeOldTrash(){ // 30 günden eski silinmiş kayıtları kalıcı olarak temizler
 try{
  if(!S.trash||!S.trash.length)return;
  const cutoff=addDays(todayISO(),-30);
  const keep=[],purge=[];
  S.trash.forEach(e=>{ (e.deletedAt&&e.deletedAt.slice(0,10)<cutoff)?purge.push(e):keep.push(e); });
  if(!purge.length)return;
  const ARR={acc:S.accounts,tx:S.txns,pos:S.pos,posE:S.posEntries,card:S.cards,cardT:S.cardTxns,cari:S.cari,cariT:S.cariTxns,
   staffT:S.staffTxns,leave:S.leaves,staffPerma:S.staff,fixed:S.fixed,fixedL:S.fixedLogs,task:S.tasks,note:S.notes,cek:S.cheques,stok:S.stock,stokT:S.stockTxns,asset:S.assets,budget:S.budgets};
  purge.forEach(e=>{ const arr=ARR[e.kind]; if(arr){ const i=arr.findIndex(x=>x.id===e.id); if(i>-1)arr.splice(i,1); } });
  S.trash=keep;
  try{logAudit('Çöp kutusu kalıcı temizlik',purge.length+' kayıt');}catch(e){}
  Object.keys(ARR).forEach(function(k){var arr=ARR[k];if(!arr)return;for(var oi=arr.length-1;oi>=0;oi--){var orx=arr[oi];if(orx&&orx.deletedAt&&String(orx.deletedAt).slice(0,10)<cutoff&&!S.trash.some(function(e2){return e2.id===orx.id;}))arr.splice(oi,1);}});
 }catch(e){}
}

const accOpts=(co,empty)=>{const l=byCo(S.accounts,co).filter(a=>a.active!=='0').map(a=>[a.id,(a.type==='kasa'?'💵 ':'🏦 ')+a.name]);return empty?[['','— Seçin —']].concat(l):l;};
const cariOpts=co=>[['','— Cari yok —']].concat(byCo(S.cari,co).filter(c=>c.active!=='0').map(c=>[c.id,c.name]));
const catOpts=t=>S.cats[t].map(c=>[c,c]);

function quickAdd(){
 if(CO==='grup')return;
 openForm('Hızlı İşlem',[
  {name:'w',label:'İşlem türü',type:'select',opts:[['gelir','Gelir ekle'],['gider','Gider ekle'],['virman','Hesaplar arası virman'],['task','Görev oluştur'],['ai','✦ AI Asistanına sor']]}
 ],o=>{ if(o.w==='ai') openAiChat(); else if(o.w==='task') addTaskForm(); else if(o.w==='virman') virmanForm(); else addTxnForm(o.w); });
}

/* ---------- ANA SAYFA ---------- */
function rDash(){
 const co=CO;
 const accs=byCo(S.accounts,co);
 let bal=0;for(const a of accs)bal+=accBalance(a);
 const t=sumRange(co,todayISO(),todayISO());
 const m=sumRange(co,monthISO()+'-01',todayISO());
 let posBek=0;for(const p of S.posEntries)if(p.co===co&&p.status==='bekliyor'&&!p.deletedAt)posBek+=+p.net;
 const budOver=byCo(S.budgets,co).filter(b=>+b.amount>0&&((b.type||'gider')==='gelir'?false:(m.byCat[b.cat]||0)>+b.amount)).length; // v14-H4: gelir/ciro hedefleri gider kırılımıyla kıyaslanamaz
 const rems=reminders(co);
 const overdue=rems.filter(r=>r.df<=0).length;
 const recent=S.txns.filter(x=>x.co===co&&!x.deletedAt).sort((a,b)=>b.date<a.date?-1:b.date>a.date?1:0).slice(0,10);
 const ds=dailySeries(co,30);
 const dun=sumRange(co,addDays(todayISO(),-1),addDays(todayISO(),-1));
 const fark=dun.gelir?((t.gelir-dun.gelir)/dun.gelir*100):0;
 let posBugun=0,posDun=0; // C1: gun sonu gorunurlugu — bugun girilen POS brutu (henuz hesaba gecmemis olsa da)
 for(const pe of S.posEntries){ if(pe.co!==co||pe.deletedAt||pe.status!=='bekliyor')continue; if(pe.date===todayISO())posBugun+=+pe.gross; else if(pe.date===addDays(todayISO(),-1))posDun+=+pe.gross; } // v14-H5: etiket "(blokajda)" diyor — hesaba geçmiş girişler çift sayılmasın

 document.getElementById('main').innerHTML= topbar('Ana Sayfa',
  `<button class="btn" data-act="quickAdd">＋ Hızlı İşlem</button>`)+
 (overdue?`<div class="card" data-act="scrollRem" style="cursor:pointer;background:linear-gradient(135deg,var(--neg),#e0564f);border:0;margin-bottom:12px"><h2 style="color:#fff;margin-bottom:0">⚠ ${overdue} vadesi geçmiş ödeme var — görmek için tıklayın ↓</h2></div>`:'')+
 (budOver?`<div class="card" data-act="go" data-arg="budget" style="cursor:pointer;background:linear-gradient(135deg,var(--warn),#d9a13f);border:0;margin-bottom:12px"><h2 style="color:#fff;margin-bottom:0">🎯 ${budOver} bütçe kalemi bu ay aşıldı — ayrıntılar için tıklayın</h2></div>`:'')+
 `<div class="grid g4" style="margin-bottom:16px">
   <div class="kpi p" data-act="goTxToday" data-arg="gelir" style="cursor:pointer" title="Bugünkü gelir işlemlerini aç"><div class="l">Bugünkü Ciro ↗</div><div class="v">${fmt0(t.gelir)}</div><div class="s">Kasa/banka: ${fmt0(t.gelir)} + POS (blokajda): ${fmt0(posBugun)}</div><div class="s">${dun.gelir?('Düne göre '+(fark>=0?'▲ +':'▼ ')+fark.toFixed(1)+'%'+(posDun?' · dün POS: '+fmt0(posDun):'')):'Bu ay: '+fmt0(m.gelir)}</div></div>
   <div class="kpi n" data-act="goTxToday" data-arg="gider" style="cursor:pointer" title="Bugünkü gider işlemlerini aç"><div class="l">Bugünkü Gider ↗</div><div class="v">${fmt0(t.gider)}</div><div class="s">Bu ay: ${fmt0(m.gider)}</div></div>
   <div class="kpi a" data-act="go" data-arg="acc" style="cursor:pointer" title="Banka & Kasa ekranını aç"><div class="l">Nakit + Banka ↗</div><div class="v">${fmt0(bal)}</div><div class="s">${accs.length} hesap</div></div>
   <div class="kpi" data-act="go" data-arg="pos" style="cursor:pointer" title="POS işlemlerini aç"><div class="l">Blokajdaki POS ↗</div><div class="v">${fmt0(posBek)}</div><div class="s">Aylık net: ${fmt0(m.net)}</div></div>
  </div>
  <div class="grid g2">
   <div class="card" id="remCard"><h2>Ödeme Hatırlatıcıları <span class="chip ${rems.some(r=>r.df<=0)?'n':'g'}">${rems.length}</span>${rems.length>9?`<button class="btn sm gh" data-act="showAllRems">Tümünü gör (${rems.length})</button>`:''}</h2>
    ${rems.length? rems.slice(0,9).map(r=>`<div class="rem ${remClass(r.df)}" data-act="go" data-arg="${r.pg||'dash'}" style="cursor:pointer" title="İlgili ekrana git"><span class="dot"></span><span>${esc(r.t)}<br><span class="tiny">${dTR(r.d)} · ${remLbl(r.df)}</span></span>${r.a!=null?`<span class="amt">${fmt0(r.a)}</span>`:''}</div>`).join('')
     :'<div class="empty"><b>Yaklaşan ödeme yok</b>Kredi kartı, sabit ödeme ve cari vadeleri burada görünür.</div>'}
   </div>
   <div class="card"><h2>Hesap Bakiyeleri <button class="btn sm gh" data-act="go" data-arg="acc">Detay →</button></h2>
    ${accs.length? chartHBars(accs.map(a=>({label:(a.type==='kasa'?'💵 ':'🏦 ')+a.name,value:accBalance(a),color:hashColor(a.bankName||a.name),act:'accDetail',arg:a.id})))
     :'<div class="empty"><b>Hesap yok</b>Banka & Kasa ekranından hesap ekleyin.</div>'}
   </div>
  </div>
  <div class="card"><h2>🛡 Sistem Tutarlılık Denetimi <button class="btn sm gh" data-act="runIntegrity">Yeniden Denetle</button></h2><div id="integrityOut" class="tiny">Denetim çalışıyor…</div></div>
  <div id="briefBox"></div>
  ${fcCard(30)}
  <div class="card"><h2>Son 30 Gün Nakit Akışı</h2>
   ${chartArea([{name:'Gelir',color:'var(--pos)',values:ds.gelir},{name:'Gider',color:'var(--neg)',values:ds.gider}],ds.labels,210)}
  </div>
  <div class="card"><h2>Son İşlemler <button class="btn sm gh" data-act="go" data-arg="tx">Tümü →</button></h2>
   ${recent.length? '<table><thead><tr><th>Tarih</th><th>İşlem</th><th class="hidem">Kategori</th><th class="num">Tutar</th></tr></thead><tbody>'+
    recent.map(x=>txRow(x,1)).join('')+'</tbody></table>'
    :'<div class="empty"><b>Henüz işlem yok</b>"+ Hızlı İşlem" ile başlayın veya Ayarlar ekranından Örnek Veri yükleyin.<br><button class="btn sm" data-act="quickAdd">＋ Hızlı İşlem</button></div>'}
  </div>`;
 renderBriefCard();
 try{runIntegrity('auto');}catch(e){}
}
function txRow(x,click){
 const acc=S.accounts.find(a=>a.id===x.accId)||{};
 const _cr=x.cariId?S.cari.find(c=>c.id===x.cariId):null; // v14-A2: cari ve belge no eskiden hiç gösterilmiyordu
 const cls=x.type==='gelir'?'p':x.type==='gider'?'n':'g';
 const lbl=x.type==='virman'?'Virman':x.type==='gelir'?'Gelir':'Gider';
 const who=x.createdBy?(' · '+(x.updatedBy&&x.updatedBy!==x.createdBy?'düzenleyen: '+x.updatedBy:'ekleyen: '+x.createdBy)):'';
 return `<tr${click?` data-act="goTxDate" data-arg="${x.date}" style="cursor:pointer" title="O günün tüm işlemlerini aç"`:''}><td>${dTR(x.date)}</td><td><span class="chip ${cls}">${lbl}</span> ${esc(x.desc||'')}<div class="tiny">${acc.id?`<span data-act="accDetail" data-arg="${acc.id}" style="cursor:pointer;text-decoration:underline dotted" title="Hesap detayını aç">${esc(acc.name)}</span>`:esc(x.src==='card'?'Kredi kartı':x.src==='stok'?'Tahakkuk (stok)':'')}${esc(who)}${x.doc?' · 🧾 '+esc(x.doc):''}</div>${_cr?`<div class="tiny"><span class="chip g" data-act="cariDetail" data-arg="${_cr.id}" style="cursor:pointer" title="Cari detayını aç">👥 ${esc(_cr.name)}</span></div>`:''}</td><td class="hidem">${esc(x.cat||'')}</td><td class="num" style="color:${x.type==='gelir'?'var(--pos)':x.type==='gider'?'var(--neg)':'var(--ink2)'}">${x.type==='gider'?'-':''}${fmt(x.amount)}</td></tr>`;
}

/* ---------- BANKA & KASA (kart görünümü + grafikler) ---------- */
var accTab='all';
function setAccTab(v){accTab=v;rAcc();}
function rAcc(){
 const allAccs=byCo(S.accounts,CO); // v32: TÜM hesaplar (aktif+pasif) — toplamlar bundan hesaplanır, pasif bir hesabın bakiyesi asla sessizce kaybolmaz
 const all=allAccs.filter(a=>a.active!=='0'); // yalnızca aktif — kart listesi ve sekmeler için
 const inactiveAccs=allAccs.filter(a=>a.active==='0');
 const allRows=allAccs.map(a=>({a,b:accBalance(a)})); // A15: bakiyeler TEK geçişte (pasif dahil) — toplamlar bundan
 const rows=allRows.filter(r=>r.a.active!=='0'&&(accTab==='all'||r.a.type===accTab));
 const toplam=allRows.reduce((s,r)=>s+r.b,0);
 const kasaT=allRows.filter(r=>r.a.type==='kasa').reduce((s,r)=>s+r.b,0);
 const bankaT=allRows.filter(r=>r.a.type==='banka').reduce((s,r)=>s+r.b,0);

 document.getElementById('main').innerHTML= topbar('Banka & Kasa',
  `<button class="btn gh" data-act="virmanForm">⇄ Virman</button><button class="btn" data-act="accForm">＋ Hesap Ekle</button>`)+
 `<div class="grid g3" style="margin-bottom:16px">
   <div class="kpi a" data-act="setAccTab" data-arg="all" style="cursor:pointer" title="Tüm hesapları göster"><div class="l">Toplam Bakiye ↗</div><div class="v">${fmt0(toplam)}</div></div>
   <div class="kpi" data-act="setAccTab" data-arg="kasa" style="cursor:pointer" title="Yalnızca kasaları göster"><div class="l">💵 Kasa Toplamı ↗</div><div class="v">${fmt0(kasaT)}</div></div>
   <div class="kpi" data-act="setAccTab" data-arg="banka" style="cursor:pointer" title="Yalnızca bankaları göster"><div class="l">🏦 Banka Toplamı ↗</div><div class="v">${fmt0(bankaT)}</div></div>
  </div>
  ${seg([['all','Tümü',all.length],['banka','🏦 Bankalar',all.filter(a=>a.type==='banka').length],['kasa','💵 Kasalar',all.filter(a=>a.type==='kasa').length]],accTab,'setAccTab')}
  ${rows.length?`<div class="card"><h2>Bakiye Dağılımı</h2>
   ${chartDonut(rows.map(r=>({label:r.a.name,value:Math.max(0,r.b),color:hashColor(r.a.bankName||r.a.name),act:'accDetail',arg:r.a.id})),'POZİTİF BAKİYE ₺')}
   ${rows.some(r=>r.b<0)?`<div class="tiny" style="margin-top:8px">⚠ Eksi bakiyeli hesaplar halkada gösterilemez: ${rows.filter(r=>r.b<0).map(r=>esc(r.a.name)+' ('+fmt0(r.b)+')').join(' · ')}</div>`:''}
  </div>`:''}
  ${rows.length? `<div class="grid g2">`+rows.map(({a,b})=>{
   const col=hashColor(a.bankName||a.name);
   const sp=accSeries(a,30);
   return `<div class="card accCard" data-act="accDetail" data-arg="${a.id}" style="--ac:${col};cursor:pointer" title="Hesap detay sayfasını aç">
    <div class="accHead"><span class="avat" style="background:${col}">${esc((a.bankName||a.name).charAt(0).toUpperCase())}</span>
     <div><b>${esc(a.name)}</b><div class="tiny">${a.type==='kasa'?'Nakit Kasa':esc(a.bankName||'Banka')}</div></div>
     <span class="chip ${a.type==='kasa'?'w':'g'}" style="margin-left:auto">${a.type==='kasa'?'KASA':'BANKA'}</span></div>
    ${a.iban?`<div class="tiny" style="margin:6px 0 0">IBAN: ${esc(a.iban)}</div>`:''}
    <div class="accBal"><div><div class="tiny">Güncel Bakiye</div><b style="font-size:21px;color:${b<0?'var(--neg)':'var(--ink)'}">${fmt(b)}</b></div>
     <div class="sparkBox">${spark(sp,col)}<div class="tiny" style="text-align:right">30 günlük seyir</div></div></div>
    <div class="cardBtns">
     <button class="btn sm" data-act="addTxnFromAcc" data-arg="gelir~${a.id}">＋ Gelir</button>
     <button class="btn sm" data-act="addTxnFromAcc" data-arg="gider~${a.id}">－ Gider</button>
     <button class="btn sm gh" data-act="virmanForm" data-arg="${a.id}">⇄ Virman</button>
     <button class="btn sm gh" data-act="accDetail" data-arg="${a.id}">📄 Ekstre</button>
     <button class="btn sm gh" data-act="accForm" data-arg="${a.id}">✎ Düzenle</button>
     <button class="btn sm gh" data-act="accDeactivate" data-arg="${a.id}">⏸ Pasife Al</button>
     <button class="btn sm dng" data-act="del" data-arg="acc~${a.id}">Sil</button>
    </div></div>`;
  }).join('')+`</div>`
  :`<div class="card"><div class="empty"><b>Bu sekmede hesap yok</b>Önce bir kasa ve banka hesabı ekleyin; tüm gelir-giderler bu hesaplara işlenir.<br><button class="btn sm" data-act="accForm">＋ Hesap Ekle</button></div></div>`}
  ${inactiveAccs.length?`<div class="card"><h2>⏸ Pasif Hesaplar <span class="tiny">(${inactiveAccs.length}) — bakiyeleri toplamlara dahil edilmeye devam eder, sadece işlem seçim listelerinden gizlenir</span></h2>
   <table><thead><tr><th>Hesap</th><th class="num">Bakiye</th><th class="rowact"></th></tr></thead><tbody>
   ${inactiveAccs.map(a=>`<tr><td><span class="avat sm" style="background:${hashColor(a.bankName||a.name)}">${esc((a.bankName||a.name).charAt(0))}</span> ${esc(a.name)} <span class="tiny">${a.type==='kasa'?'Kasa':esc(a.bankName||'Banka')}</span></td>
   <td class="num">${fmt(accBalance(a))}</td>
   <td class="rowact"><button class="btn sm gh" data-act="accReactivate" data-arg="${a.id}">↩ Aktif Et</button><button class="btn sm dng" data-act="del" data-arg="acc~${a.id}">🗑 Sil</button></td></tr>`).join('')}
   </tbody></table></div>`:''}
  `; /* v14-D3: hiç doldurulmayan ekstreBox kaldırıldı — ekstre accDetail içinde basılıyor */
 document.getElementById('main').insertAdjacentHTML('beforeend',modSum('acc'));
}
function staffDeactivate(id){ /* v14-K9: eskiden del('staff') idi — 'çöp kutusuna taşındı' diyordu ama hiçbir şey çöpe gitmiyordu */
 const s=S.staff.find(x=>x.id===id);if(!s)return;
 uiConfirm(esc(s.name)+' personeli çıkış yapmış olarak işaretlensin mi? (Ödeme ve izin geçmişi korunur, listede "Pasif Personel" bölümüne taşınır)',function(){
  s.active='0';try{logAudit('Personel çıkışı',s.name);}catch(e){}
  save();toast(s.name+' pasife alındı — geçmişi korunuyor, "↩ Aktif Et" ile geri alabilirsiniz');go('staff');
 },{danger:1,title:'Personel Çıkışı',yes:'Evet, Çıkış Ver'});
}
function cardDeactivate(id){ /* v14-D2: payMethodOpts zaten c.active!=='0' filtreliyordu ama kartı pasife alacak yol yoktu */
 const c=S.cards.find(x=>x.id===id);if(!c)return;
 c.active='0';try{logAudit('Kart pasife alındı',c.name);}catch(e){}
 save();toast(c.name+' pasife alındı — borcu toplamlarda görünmeye devam eder, yeni harcama listelerinden gizlenir');go('card');
}
function cardReactivate(id){
 const c=S.cards.find(x=>x.id===id);if(!c)return;
 c.active='1';try{logAudit('Kart yeniden aktif edildi',c.name);}catch(e){}
 save();toast(c.name+' yeniden aktif edildi');go('card');
}
function accDeactivate(id){
 const a=S.accounts.find(x=>x.id===id);if(!a)return;
 a.active='0';logAudit('Hesap pasife alındı',a.name);save();toast(a.name+' pasife alındı — bakiyesi toplamlarda görünmeye devam eder');go('acc');
}
function accReactivate(id){
 const a=S.accounts.find(x=>x.id===id);if(!a)return;
 a.active='1';logAudit('Hesap yeniden aktif edildi',a.name);save();toast(a.name+' yeniden aktif edildi');go('acc');
}
function accForm(id){
 const init=id?S.accounts.find(a=>a.id===id):{type:'banka'};
 openForm(id?'Hesabı Düzenle':'Yeni Hesap',[
  {name:'type',label:'Hesap türü',type:'select',opts:[['banka','Banka Hesabı'],['kasa','Nakit Kasa']]},
  {name:'name',label:'Hesap adı',req:1,ph:'Ör: Ziraat Vadesiz / Ana Kasa'},
  {name:'bankName',label:'Banka adı (kasa ise boş bırakın)',ph:'Ziraat Bankası'},
  {name:'iban',label:'IBAN',ph:'TR__ ____ ____ ...'},
  {row:[{name:'accNo',label:'Hesap no'},{name:'opening',label:'Açılış bakiyesi (₺)',type:'number',def:0}]},
  {name:'note',label:'Not',type:'textarea'}
 ],o=>{
  if(id)Object.assign(init,o);
  else S.accounts.push({id:nid(),co:CO,...o});
  save();toast('Hesap kaydedildi');go('acc');
 },init||{});
}
function virmanForm(fromId){
 const opts=accOpts(CO);
 if(opts.length<2)return toast('Virman için en az 2 hesap gerekli');
 openForm('Hesaplar Arası Virman',[
  {name:'accId',label:'Gönderen hesap',type:'select',opts,req:1},
  {name:'accId2',label:'Alan hesap',type:'select',opts,req:1},
  {row:[{name:'amount',label:'Tutar (₺)',type:'number',req:1,min:0.01},{name:'date',label:'Tarih',type:'date',def:todayISO(),req:1}]},
  {name:'desc',label:'Açıklama',ph:'Kasadan bankaya'}
 ],o=>{
  if(o.accId===o.accId2)return toast('Aynı hesaba virman yapılamaz');
  pushRec(S.txns,{id:nid(),co:CO,type:'virman',...o,amount:+o.amount});
  save();
  var _fa=S.accounts.find(function(x){return x.id===o.accId;});
  toast(_fa&&accBalance(_fa)<0?'Virman kaydedildi — ⚠ gönderen hesabın bakiyesi eksiye düştü, kontrol edin':'Virman kaydedildi');
  go(PAGE);
 },fromId?{accId:fromId}:{});
}
/* v33: ekstre tarih araligi — parametresiz cagri (accDetail) eski "Tumu" davranisini korur */
var _accEk={id:null,from:'',to:''};
function accEkFrom(v){if(_accEk.id)accEkstre(_accEk.id,v,_accEk.to);}
function accEkTo(v){if(_accEk.id)accEkstre(_accEk.id,_accEk.from,v);}
function accEkPreset(id,k){if(k==='tum')accEkstre(id,'','');else{const r=rangePreset(k);accEkstre(id,r.from,r.to);}}
function accEkstre(id,from,to){
 const a=S.accounts.find(x=>x.id===id);if(!a)return;
 from=from||'';to=to||'';
 _accEk={id:id,from:from,to:to};
 const all=S.txns.filter(t=>t.co===CO&&!t.deletedAt&&(t.accId===id||t.accId2===id)).sort((x,y)=>x.date<y.date?-1:1);
 let devir=0,bekleyen=0;const list=[];
 for(const t of all){
  let delta=0;
  if(t.type==='gelir')delta=+t.amount; else if(t.type==='gider')delta=-t.amount;
  else delta=(t.accId===id?-1:1)*t.amount;
  var _ed=t.valueDate||t.date; // v14-R6: accBalance/accSeries valör gününü kullanıyordu, ekstre kullanmıyordu
  if(_ed>todayISO()){bekleyen+=delta;continue;} // valörü gelmemiş (POS blokajı) — bakiyeye henüz girmez
  if(from&&_ed<from){devir+=delta;continue;} // aralik oncesi net etki -> donem basi devir
  if(to&&_ed>to)continue;
  list.push({t:t,delta:delta});
 }
 const donemBasi=(+a.opening||0)+devir;
 let run=donemBasi;
 const rows=list.map(({t,delta})=>{
  run+=delta;
  return `<tr><td>${dTR(t.date)}</td><td>${esc(t.desc||t.cat||(t.type==='virman'?'Virman':''))}</td><td class="num" style="color:${delta>=0?'var(--pos)':'var(--neg)'}">${fmt(delta)}</td><td class="num">${fmt(run)}</td>
  <td class="rowact">${t.type!=='virman'?'<button data-act="editTxn" data-arg="'+t.id+'">✎</button>':''}<button data-act="del" data-arg="tx~${t.id}">🗑</button></td></tr>`;
 }).reverse().join('')
 +(from?`<tr style="background:var(--acc-soft)"><td>${dTR(from)}</td><td><b>Dönem başı devir</b> <span class="tiny">açılış ${fmt(a.opening)} + önceki hareketler ${fmt(devir)}</span></td><td class="num"></td><td class="num"><b>${fmt(donemBasi)}</b></td><td class="rowact"></td></tr>`:'');
 const filt=`<div class="filters" style="margin-bottom:8px"><span class="mut" style="align-self:center">Aralık:</span>
   <input type="date" value="${from}" data-actv="accEkFrom"><input type="date" value="${to}" data-actv="accEkTo">
   <button class="btn sm gh" data-act="accEkPreset" data-arg="${id}~ay">Bu Ay</button>
   <button class="btn sm gh" data-act="accEkPreset" data-arg="${id}~gecenAy">Geçen Ay</button>
   <button class="btn sm ${(!from&&!to)?'':'gh'}" data-act="accEkPreset" data-arg="${id}~tum">Tümü</button></div>`;
 var _ebx=document.getElementById('ekstreBox'); if(!_ebx)return; // v14-D3: kutu yoksa sessizce çık (rAcc'teki ölü div kaldırıldı)
 _ebx.innerHTML=
  `<div class="card"><h2>Ekstre — ${esc(a.name)} <button class="btn sm gh" data-act="printPage">🖨 Yazdır</button></h2>
   ${filt}
   ${bekleyen?`<div class="tiny" style="margin-bottom:6px;color:var(--warn)">⏳ Valör günü gelmemiş (POS blokajı vb.) <b>${fmt(bekleyen)}</b> bu bakiyeye henüz dahil değil.</div>`:''}
   <div class="mut" style="margin-bottom:8px">Açılış bakiyesi: <b>${fmt(a.opening)}</b>${(from||to)?' · Dönem başı: <b>'+fmt(donemBasi)+'</b> · Dönem sonu: <b>'+fmt(run)+'</b>':' · Güncel bakiye: <b>'+fmt(run)+'</b>'} · ${list.length} hareket</div>
   ${rows?'<table><thead><tr><th>Tarih</th><th>Açıklama</th><th class="num">Tutar</th><th class="num">Bakiye</th><th class="rowact"></th></tr></thead><tbody>'+rows+'</tbody></table>':'<div class="empty">Bu hesapta '+((from||to)?'seçili aralıkta ':'')+'hareket yok.</div>'}</div>`;
 try{document.getElementById('ekstreBox').scrollIntoView({behavior:'smooth'});}catch(e){}
}

/* ---------- GELİR-GİDER ---------- */
var txFilter={type:'',cat:'',from:'',to:''};
function txSetType(v){txFilter.type=v;rTx();}
function txSetCat(v){txFilter.cat=v;rTx();}
function txSetFrom(v){txFilter.from=v;rTx();}
function txSetTo(v){txFilter.to=v;rTx();}
function txClear(){txFilter={type:'',cat:'',from:'',to:'',q:''};rTx();}
function txSetQ(v){txFilter.q=v;rTx();}
function filteredTxns(co,f){ // A13: rTx ve exportTxCsv AYNI filtreyi kullanir (q dahil)
 let list=S.txns.filter(t=>t.co===co&&!t.deletedAt);
 if(f.type)list=list.filter(t=>t.type===f.type);
 if(f.cat)list=list.filter(t=>t.cat===f.cat);
 if(f.from)list=list.filter(t=>t.date>=f.from);
 if(f.to)list=list.filter(t=>t.date<=f.to);
 if(f.q){var _q=String(f.q).toLowerCase();list=list.filter(t=>String((t.desc||'')+' '+(t.doc||'')+' '+(t.cat||'')+' '+t.amount).toLowerCase().indexOf(_q)!==-1);}
 return list;
}
function rTx(){
 let list=filteredTxns(CO,txFilter);
 const f=txFilter;
 list.sort((a,b)=>a.date<b.date?1:-1);
 const g=list.filter(t=>t.type==='gelir').reduce((s,t)=>s+ +t.amount,0);
 const x=list.filter(t=>t.type==='gider').reduce((s,t)=>s+ +t.amount,0);
 document.getElementById('main').innerHTML= topbar('Gelir - Gider',
  `<button class="btn gh" data-act="exportTxCsv" title="Filtrelenmiş listeyi Excel/CSV olarak indir">⬇ CSV</button><button class="btn gh" data-act="addTxnForm" data-arg="gelir">＋ Gelir</button><button class="btn" data-act="addTxnForm" data-arg="gider">＋ Gider</button>`)+
 `<div class="grid g3" style="margin-bottom:16px">
  <div class="kpi p"><div class="l">Gelir (filtreli)</div><div class="v">${fmt0(g)}</div></div>
  <div class="kpi n"><div class="l">Gider (filtreli)</div><div class="v">${fmt0(x)}</div></div>
  <div class="kpi a"><div class="l">Net</div><div class="v">${fmt0(g-x)}</div></div></div>
 <div class="card">
  <div class="filters">
   <select data-actv="txSetType"><option value="">Tümü</option><option ${f.type==='gelir'?'selected':''} value="gelir">Gelir</option><option ${f.type==='gider'?'selected':''} value="gider">Gider</option><option ${f.type==='virman'?'selected':''} value="virman">Virman</option></select>
   <select data-actv="txSetCat"><option value="">Tüm kategoriler</option>${Array.from(new Set(S.cats.gelir.concat(S.cats.gider).concat(byCo(S.txns,CO).map(t=>t.cat).filter(Boolean)))).map(c=>`<option ${f.cat===c?'selected':''}>${esc(c)}</option>`).join('')}</select>
   <input type="date" value="${f.from}" data-actv="txSetFrom">
   <input type="date" value="${f.to}" data-actv="txSetTo">
   <input type="text" value="${esc(f.q||'')}" placeholder="🔍 Ara: açıklama, belge no, tutar..." data-actv="txSetQ" style="min-width:200px">
   <button class="btn sm gh" data-act="txClear">Temizle</button>
  </div>
  ${list.length? '<table><thead><tr><th>Tarih</th><th>İşlem</th><th class="hidem">Kategori</th><th class="num">Tutar</th><th class="rowact"></th></tr></thead><tbody>'+
   list.slice(0,200).map(t=>txRow(t).replace('</tr>',`<td class="rowact"><button data-act="editTxn" data-arg="${t.id}">✎</button><button data-act="del" data-arg="tx~${t.id}">🗑</button></td></tr>`)).join('')+'</tbody></table>'+(list.length>200?'<div class="tiny" style="padding:8px">İlk 200 kayıt gösteriliyor, filtre kullanın.</div>':'')
   :'<div class="empty"><b>Kayıt bulunamadı</b>Filtreleri değiştirin veya yeni işlem ekleyin.</div>'}
 </div>`;
}
function addTxnForm(type,init){
 if(!byCo(S.accounts,CO).length)return toast('Önce Banka & Kasa ekranından bir hesap ekleyin');
 const isEdit=!!(init&&init.id); // v26: sadece gerçek bir kayıt ID'si varsa "düzenleme" say — yoksa (ör. sadece hesap ön-doldurmak için) her zaman YENİ kayıt oluştur
 openForm(type==='gelir'?'Gelir Ekle':'Gider Ekle',[
  {row:[{name:'amount',label:'Tutar (₺)',type:'number',req:1,min:0.01},{name:'date',label:'Tarih',type:'date',def:todayISO(),req:1}]},
  {name:'cat',label:'Kategori',type:'select',opts:catOpts(type),req:1},
  {name:'accId',label:type==='gelir'?'Hangi hesaba girdi':'Hangi hesaptan çıktı',type:'select',opts:accOpts(CO),req:1},
  {name:'cariId',label:'Cari (opsiyonel — seçerseniz bu para hareketi cari bakiyesine tahsilat/ödeme olarak işlenir)',type:'select',opts:cariOpts(CO)},
  {row:[{name:'vat',label:'KDV %',type:'select',opts:[['','KDV yok'],['1','%1'],['10','%10'],['20','%20']]},{name:'doc',label:'Belge no'}]},
  {name:'desc',label:'Açıklama',ph:'Ör: Sebze hali alımı'}
 ],o=>{
  const rec={id:isEdit?init.id:nid(),co:CO,type,...o,amount:+o.amount};
  /* v14-A1: "Cari" alanı eskiden yalnızca kayda yazılıyor, hiçbir yerde okunmuyordu (ölü alan).
     Artık cari seçilirse karşı hareket üretilir: gelir → 'alacak' (müşterinin borcu azalır / tahsilat),
     gider → 'borc' (tedarikçiye borcumuz azalır / ödeme). Bağ rec.cariTxnId ile kurulur;
     silme (del 'tx') ve geri alma (restoreTrash 'tx') bu bağı zaten simetrik işliyor. */
  var _oldCt=(isEdit&&init.cariTxnId)?S.cariTxns.find(function(x){return x.id===init.cariTxnId;}):null;
  var _cari=o.cariId?S.cari.find(function(x){return x.id===o.cariId&&!x.deletedAt;}):null;
  var _cmsg='';
  if(_cari){
   var _ctype=type==='gelir'?'alacak':'borc';
   var _cdesc=(type==='gelir'?'Cari tahsilat':'Cari ödeme')+': '+_cari.name+(o.desc?' - '+o.desc:(o.cat?' - '+o.cat:''));
   if(_oldCt&&!_oldCt.deletedAt&&_oldCt.src==='tx'){
    _oldCt.cariId=o.cariId;_oldCt.type=_ctype;_oldCt.amount=+o.amount;_oldCt.date=o.date;_oldCt.desc=_cdesc;_oldCt.accId=o.accId||'';
    try{stampUpdate(_oldCt,_oldCt);}catch(e){}
    rec.cariTxnId=_oldCt.id;
   }else{
    var _nct=stampCreate({id:nid(),co:CO,cariId:o.cariId,type:_ctype,amount:+o.amount,date:o.date,src:'tx',nakit:type,accId:o.accId||'',desc:_cdesc});
    S.cariTxns.push(_nct);rec.cariTxnId=_nct.id;
   }
   _cmsg=' + '+_cari.name+' carisine '+(type==='gelir'?'tahsilat':'ödeme')+' işlendi';
  }else{
   if(_oldCt&&_oldCt.src==='tx'){cascadeSoftDelete(S.cariTxns,function(x){return x.id===_oldCt.id;});_cmsg=' — cari bağı kaldırıldı';}
   delete rec.cariTxnId;
  }
  if(isEdit){stampUpdate(rec,init);const i=S.txns.findIndex(z=>z.id===init.id);S.txns[i]=rec;}
  else{stampCreate(rec);S.txns.push(rec);}
  var _bmsg='';
  if(_cari){var _bl=cariBalance(_cari);if(_cari.riskLimit&&_bl>+_cari.riskLimit)_bmsg=' ⚠ Risk limiti aşıldı: '+fmt(_bl);}
  save();toast((type==='gelir'?'Gelir kaydedildi':'Gider kaydedildi')+_cmsg+_bmsg);go(PAGE);
 },init||{});
}
function addTxnFromAcc(type,accId){ addTxnForm(type,{accId:accId}); } // v26: bir hesap kartından doğrudan gelir/gider eklerken o hesabı ön-seçili getirir
function editTxn(id){
 const t=S.txns.find(x=>x.id===id);if(!t)return;
 if(t.co&&!canAccessCo(t.co))return toast('Bu şirkette düzenleme yetkiniz yok');
 if(t.type==='virman')return toast('Virman kaydını silip yeniden oluşturabilirsiniz');
 var _ctSrc=t.cariTxnId?((S.cariTxns.find(function(x){return x.id===t.cariTxnId;})||{}).src||''):''; // v14-A1: gelir/gider formunun kendi kurduğu cari bağı düzenlenebilir kalsın
 if((t.cariTxnId&&_ctSrc!=='tx')||t.cardTxnId||t.staffTxnId||t.cekId||t.posEId||t.stokTxnId||t.assetId||t.xfer||t.src==='card'||t.src==='stok'||S.fixedLogs.some(l=>l.txnId===t.id&&!l.deletedAt))
  return toast('🔗 Bu kayıt bağlantılı bir işlemden (cari/kart/personel/çek/POS/stok/demirbaş/sabit ödeme) otomatik oluşturuldu — tutarlar kopmasın diye buradan düzenlenemez. Değiştirmek için kaydı silin (eşi de birlikte silinir) ve kaynağından yeniden girin.');
 addTxnForm(t.type,t);
}

/* ---------- POS ---------- */
var posTab='giris';
function setPosTab(v){posTab=v;rPos();}
function rPos(){
 const allPos=byCo(S.pos,CO); // v32: TÜM POS cihazları (aktif+pasif) — geçmiş grafik/karşılaştırmalarda tam veri korunur
 const list=allPos.filter(p=>p.active!=='0'); // yalnızca aktif — cihaz yönetim tablosu için
 const inactivePos=allPos.filter(p=>p.active==='0');
 const ent=byCo(S.posEntries,CO).sort((a,b)=>a.date<b.date?1:-1);
 const bek=ent.filter(e=>e.status==='bekliyor');
 const mo=monthISO();
 const ayEnt=ent.filter(e=>e.date.startsWith(mo));
 const ayKom=ayEnt.reduce((s,e)=>s+ +e.comm,0);
 const ayBrut=ayEnt.reduce((s,e)=>s+ +e.gross,0);
 const share={};for(const e of ayEnt){share[e.posId]=(share[e.posId]||0)+ +e.gross;}
 document.getElementById('main').innerHTML= topbar('POS İşlemleri',
  `<button class="btn gh" data-act="posDefForm">＋ POS Tanımla</button><button class="btn gh" data-act="posGunSonu">＋ Gün Sonu (tüm POS'lar)</button><button class="btn" data-act="posEntryForm">＋ POS Girişi</button>`)+
 `<div class="grid g3" style="margin-bottom:16px">
   <div class="kpi a" data-act="setPosTab" data-arg="giris" style="cursor:pointer" title="Günlük girişleri göster"><div class="l">Bu Ay POS Ciro (brüt) ↗</div><div class="v">${fmt0(ayBrut)}</div></div>
   <div class="kpi n" data-act="setPosTab" data-arg="cihaz" style="cursor:pointer" title="Cihaz & komisyon karşılaştırmasını göster"><div class="l">Bu Ay Komisyon ↗</div><div class="v">${fmt0(ayKom)}</div><div class="s">Efektif oran: %${ayBrut?(ayKom/ayBrut*100).toFixed(2):'0'}</div></div>
   <div class="kpi" data-act="setPosTab" data-arg="giris" style="cursor:pointer" title="Bekleyen girişleri göster"><div class="l">Blokajda Bekleyen ↗</div><div class="v">${fmt0(bek.reduce((s,e)=>s+ +e.net,0))}</div><div class="s">${bek.length} işlem</div></div>
  </div>
  ${seg([['giris','Günlük Girişler',ent.length],['cihaz','Cihazlar & Komisyonlar',list.length]],posTab,'setPosTab')}`+
 (posTab==='cihaz'
 ? `<div class="card"><h2>Tanımlı POS Cihazları</h2>
  ${list.length? '<table><thead><tr><th>POS</th><th>Bağlı Hesap</th><th class="num">Komisyon</th><th class="num">Blokaj</th><th class="num hidem">Bu Ay Ciro</th><th class="rowact"></th></tr></thead><tbody>'+
   list.map(p=>{const a=S.accounts.find(x=>x.id===p.accId)||{};return `<tr data-act="posDetail" data-arg="${p.id}" style="cursor:pointer" title="POS detay sayfasını aç"><td><span class="avat sm" style="background:${hashColor(p.name)}">${esc(p.name.charAt(0))}</span> <b>${esc(p.name)}</b></td><td>${esc(a.name||'—')}</td><td class="num">%${p.comm}</td><td class="num">${p.blokaj} gün${p.vatRate?' <span class="tiny">· KDV %'+esc(p.vatRate)+'</span>':''}</td><td class="num hidem">${fmt0(share[p.id]||0)}</td>
   <td class="rowact"><button data-act="posDefForm" data-arg="${p.id}">✎</button><button data-act="posDeactivate" data-arg="${p.id}">⏸</button><button data-act="del" data-arg="pos~${p.id}">🗑</button></td></tr>`;}).join('')+'</tbody></table>'
   :'<div class="empty"><b>POS tanımlı değil</b>Banka, komisyon oranı ve blokaj süresiyle POS cihazlarınızı tanımlayın.</div>'}
  </div>
  ${inactivePos.length?`<div class="card"><h2>⏸ Pasif POS Cihazları <span class="tiny">(${inactivePos.length}) — geçmiş verileri raporlarda korunur</span></h2>
   <table><thead><tr><th>POS</th><th>Bağlı Hesap</th><th class="rowact"></th></tr></thead><tbody>
   ${inactivePos.map(p=>{const a=S.accounts.find(x=>x.id===p.accId)||{};return `<tr><td><span class="avat sm" style="background:${hashColor(p.name)}">${esc(p.name.charAt(0))}</span> ${esc(p.name)}</td><td>${esc(a.name||'—')}</td>
   <td class="rowact"><button class="btn sm gh" data-act="posReactivate" data-arg="${p.id}">↩ Aktif Et</button><button class="btn sm dng" data-act="del" data-arg="pos~${p.id}">🗑 Sil</button></td></tr>`;}).join('')}
   </tbody></table></div>`:''}
  ${posCompareCard(allPos,ent)}`
 : `${Object.keys(share).length?`<div class="card"><h2>Bu Ay POS Dağılımı</h2>${chartDonut(allPos.map(p=>({label:p.name,value:share[p.id]||0,color:hashColor(p.name),act:'posDetail',arg:p.id})),'BRÜT ₺')}</div>`:''}
  <div class="card"><h2>POS Girişleri</h2>
  ${ent.length? '<table><thead><tr><th>Tarih</th><th>POS</th><th class="num">Brüt</th><th class="num">Komisyon</th><th class="num">Net</th><th>Hesaba Geçiş</th><th class="rowact"></th></tr></thead><tbody>'+
   ent.slice(0,60).map(e=>{const p=S.pos.find(x=>x.id===e.posId)||{};
    return `<tr><td>${dTR(e.date)}</td><td>${p.id?`<span data-act="posDetail" data-arg="${p.id}" style="cursor:pointer;text-decoration:underline dotted" title="POS detayını aç">${esc(p.name)}</span>`:esc(p.name||'?')}</td><td class="num">${fmt(e.gross)}</td><td class="num" style="color:var(--neg)">-${fmt(e.comm)}</td><td class="num" style="font-weight:700">${fmt(e.net)}</td>
    <td>${e.status==='gecti'?'<span class="chip p">Hesaba geçti ✓</span>':`<span class="chip w">${dTR(e.settleDate)}</span> <button class="btn sm" data-act="posSettle" data-arg="${e.id}">Geçti ✓</button>`}</td>
    <td class="rowact"><button data-act="del" data-arg="posE~${e.id}">🗑</button></td></tr>`;}).join('')+'</tbody></table>'
   :'<div class="empty"><b>POS girişi yok</b>Gün sonu POS toplamlarını girin; komisyon ve net tutar otomatik hesaplanır.</div>'}
  </div>${posCompareCard(allPos,ent)}`);
 document.getElementById('main').insertAdjacentHTML('beforeend',modSum('pos'));
}
function posDeactivate(id){
 const p=S.pos.find(x=>x.id===id);if(!p)return;
 p.active='0';logAudit('POS pasife alındı',p.name);save();toast(p.name+' pasife alındı — geçmiş verileri korunur');go('pos');
}
function posReactivate(id){
 const p=S.pos.find(x=>x.id===id);if(!p)return;
 p.active='1';logAudit('POS yeniden aktif edildi',p.name);save();toast(p.name+' yeniden aktif edildi');go('pos');
}
function posDefForm(id){
 const init=id?S.pos.find(p=>p.id===id):{};
 const opts=accOpts(CO);
 if(!opts.length)return toast('Önce bir banka hesabı ekleyin');
 openForm(id?'POS Düzenle':'Yeni POS',[
  {name:'name',label:'POS adı',req:1,ph:'Ör: Ziraat POS 1'},
  {name:'accId',label:'Bağlı banka hesabı',type:'select',opts,req:1},
  {row:[{name:'comm',label:'Komisyon oranı (%)',type:'number',req:1,def:2,step:'0.01'},{name:'blokaj',label:'Blokaj süresi (gün)',type:'number',req:1,def:1,step:'1'}]},
  {name:'vatRate',label:'Satış KDV oranı (%) — hesaba geçen POS gelirine işlenir',type:'select',opts:[['','KDV yok'],['1','%1'],['10','%10'],['20','%20']],def:'10'}
 ],o=>{ if(id)Object.assign(init,o); else S.pos.push({id:nid(),co:CO,...o}); save();toast('POS kaydedildi');go('pos'); },init||{});
}
function posEntryForm(){
 const opts=byCo(S.pos,CO).filter(p=>p.active!=='0').map(p=>[p.id,p.name+' (%'+p.comm+')']);
 if(!opts.length)return toast('Önce bir POS tanımlayın');
 openForm('POS Girişi (gün sonu)',[
  {name:'posId',label:'POS',type:'select',opts,req:1},
  {row:[{name:'gross',label:'Brüt tutar (₺)',type:'number',req:1,min:0.01},{name:'date',label:'Tarih',type:'date',def:todayISO(),req:1}]},
  {name:'cariId',label:'İlgili cari (opsiyonel — veresiye müşterisinin POS ödemesiyse seçin, hesaba geçince cari alacak kaydı oluşur)',type:'select',opts:cariOpts(CO)}
 ],o=>{
  if(S.posEntries.some(function(x){return x.posId===o.posId&&x.date===o.date&&!x.deletedAt;})){toast('⚠ Bu POS için '+dTR(o.date)+' tarihinde zaten giriş var — ciro çift sayılmasın diye kaydedilmedi. Yanlışsa mevcut kaydı silip yeniden girin.');return;}
  const p=S.pos.find(x=>x.id===o.posId);
  const comm=+(+o.gross*(+p.comm/100)).toFixed(2);
  const net=+(+o.gross-comm).toFixed(2);
  pushRec(S.posEntries,{id:nid(),co:CO,date:o.date,posId:o.posId,gross:+o.gross,comm,net,settleDate:addDays(o.date,+p.blokaj||0),status:'bekliyor',cariId:o.cariId||''});
  save();toast('POS girişi eklendi · Net '+fmt(net)+(o.cariId?' · hesaba geçince cariye tahsilat işlenecek':''));go('pos');
 });
}
/* v33: GUN SONU TOPLU POS GIRISI — tek formda tum aktif POS'lar icin brut tutar */
function posGunSonu(){
 const list=byCo(S.pos,CO).filter(p=>p.active!=='0');
 if(!list.length)return toast('Önce bir POS tanımlayın');
 const flds=[{name:'date',label:'Tarih',type:'date',def:todayISO(),req:1}];
 list.forEach(p=>flds.push({name:'g_'+p.id,label:p.name+' — brüt ₺ (komisyon %'+p.comm+')',type:'number',ph:'Boş bırakılırsa atlanır'}));
 openForm('Gün Sonu — Tüm POS\'lar',flds,o=>{
  let ok=0,tot=0;const skip=[];
  list.forEach(p=>{
   const v=o['g_'+p.id];
   if(v===''||v==null)return; // bos birakilan atlanir
   if(isNaN(+v)||+v<=0){skip.push(p.name+' (geçersiz tutar)');return;} // B3: gecersiz girilenler sessizce yutulmaz
   if(S.posEntries.some(function(x){return x.posId===p.id&&x.date===o.date&&!x.deletedAt;})){skip.push(p.name);return;} // mukerrer kontrolu
   const comm=+(+v*(+p.comm/100)).toFixed(2);
   const net=+(+v-comm).toFixed(2);
   pushRec(S.posEntries,{id:nid(),co:CO,date:o.date,posId:p.id,gross:+v,comm,net,settleDate:addDays(o.date,+p.blokaj||0),status:'bekliyor'});
   ok++;tot+=+v;
  });
  if(!ok&&!skip.length){toast('Hiç tutar girilmedi — en az bir POS için brüt tutar yazın');return;}
  if(ok){try{logAudit('Gün sonu POS girişi',o.date+' · '+ok+' POS · brüt '+fmt0(tot));}catch(e){}save();}
  toast('Gün sonu: '+ok+' POS girişi eklendi · brüt '+fmt0(tot)+(skip.length?' · ⚠ Atlandı (o tarihte zaten giriş var): '+skip.join(', '):''));
  if(ok)go('pos');
 });
}
function posSettleCore(e,auto){ // B2: tekil settle mantığı — elle ve otomatik yol aynı kodu kullanır
 const p=S.pos.find(x=>x.id===e.posId&&!x.deletedAt)||{}; // v14-K5: silinmiş POS tanımına gelir yazma
 if(!p.accId||!S.accounts.find(x=>x.id===p.accId&&!x.deletedAt)){if(!auto)toast('⚠ Bu POS tanımının bağlı banka hesabı yok ya da silinmiş — para boşluğa yazılmasın diye işlem durduruldu. Önce POS tanımını düzenleyip hesap bağlayın.');return false;}
 const co=e.co||CO;
 const vd=(e.settleDate&&e.settleDate>e.date)?e.settleDate:''; // B2: banka bakiyesi valör (blokaj bitiş) gününde etkilenir, K/Z satış gününde kalır
 e.status='gecti';
 S.txns.push(stampCreate({id:nid(),co:co,type:'gelir',date:e.date,valueDate:vd,amount:+e.gross,cat:'Satış Geliri',accId:p.accId,posEId:e.id,cariId:e.cariId||'',vat:p.vatRate||'',desc:'POS aktarımı: '+(p.name||'')+' ('+dTR(e.date)+' satışı)'}));
 S.txns.push(stampCreate({id:nid(),co:co,type:'gider',date:e.date,valueDate:vd,amount:+e.comm,cat:'Banka & Komisyon',accId:p.accId,posEId:e.id,desc:'POS komisyonu: '+(p.name||'')}));
 if(e.cariId){ // B1: veresiye müşterisinin POS ödemesi cari hesaba tahsilat olarak işlenir
  const _c=S.cari.find(x=>x.id===e.cariId);
  S.cariTxns.push(stampCreate({id:nid(),co:co,cariId:e.cariId,type:'alacak',amount:+e.gross,date:e.date,posEId:e.id,desc:'POS tahsilatı: '+(p.name||'')+' ('+dTR(e.date)+')'+(_c?' — '+_c.name:'')}));
 }
 try{logAudit('POS hesaba geçti'+(auto?' (otomatik)':''),(p.name||'')+' '+dTR(e.date)+' net '+fmt(e.net));}catch(err){}
 return true;
}
function posSettle(id){
 const e=S.posEntries.find(x=>x.id===id);if(!e||e.status==='gecti')return;
 delete e.noAutoSettle; // v14-K8: elle 'Geçti' denince otomatik kilidi kalkar
 if(!posSettleCore(e,false))return;
 save();toast('Hesaba geçti: gelir satış gününe ('+dTR(e.date)+') işlendi'+(e.settleDate&&e.settleDate>e.date?', banka bakiyesi '+dTR(e.settleDate)+' valörüyle güncellenecek':'')+(e.cariId?' + cariye tahsilat işlendi':''));go('pos');
}
function autoSettlePos(){ // B2: blokaj süresi dolan POS girişleri otomatik hesaba geçer
 let n=0;
 S.posEntries.forEach(e=>{
  if(e.deletedAt||e.status!=='bekliyor')return;
  if(e.noAutoSettle)return; // v14-K8: kullanıcı bu girişin kaydını elle sildi — otomatik yeniden üretme
  if(!e.settleDate||e.settleDate>todayISO())return;
  if(!canAccessCo(e.co))return;
  if(posSettleCore(e,true))n++;
 });
 if(n){save();try{toast('⏱ '+n+' POS girişinin blokaj süresi doldu — otomatik olarak hesaba geçirildi');}catch(e){}}
 return n;
}

/* ---------- KREDİ KARTLARI ---------- */
function rCard(){
 const allCards=byCo(S.cards,CO); /* v14-D2 */
 const list=allCards.filter(c=>c.active!=='0');
 const inactiveCards=allCards.filter(c=>c.active==='0');
 const totalDebt=list.reduce((s,c)=>s+Math.max(0,cardDebt(c)),0);
 const totalLimit=list.reduce((s,c)=>s+ +(c.limit||0),0);
 document.getElementById('main').innerHTML= topbar('Kredi Kartları',
  `<button class="btn" data-act="cardForm">＋ Kart Ekle</button>`)+
 (list.length?`<div class="grid g3" style="margin-bottom:16px">
   <div class="kpi n"><div class="l">Toplam Kart Borcu</div><div class="v">${fmt0(totalDebt)}</div></div>
   <div class="kpi"><div class="l">Toplam Limit</div><div class="v">${fmt0(totalLimit)}</div></div>
   <div class="kpi a"><div class="l">Kullanılabilir</div><div class="v">${fmt0(totalLimit-totalDebt)}</div><div class="s">Doluluk: %${totalLimit?(totalDebt/totalLimit*100).toFixed(1):0}</div></div>
  </div>
  ${totalDebt>0?`<div class="card"><h2>Borç Dağılımı (kart bazında)</h2>${chartDonut(list.map(c=>({label:c.name,value:Math.max(0,cardDebt(c)),color:hashColor(c.bank||c.name),act:'cardDetail',arg:c.id})),'BORÇ ₺')}</div>`:''}${cardInstCard(list)}`:'')+
 (list.length? `<div class="grid g2">`+list.map(c=>{
   const debt=cardDebt(c);const avail=+c.limit-debt;const due=nextDue(+c.dueDay);const df=daysDiff(due);
   const pct=Math.min(100,Math.max(0,debt/(+c.limit||1)*100));
   const col=hashColor(c.bank||c.name);
   return `<div class="card accCard" data-act="cardDetail" data-arg="${c.id}" style="--ac:${col};cursor:pointer" title="Kart detay sayfasını aç">
    <div class="accHead"><span class="avat" style="background:${col}">${esc((c.bank||c.name).charAt(0).toUpperCase())}</span>
     <div><b>${esc(c.name)}</b><div class="tiny">${esc(c.bank||'')} ${c.last4?'· •••• '+esc(c.last4):''}</div></div>
     ${debt>0?`<span class="chip ${df<=3?'n':'w'}" style="margin-left:auto">${remLbl(df)}</span>`:'<span class="chip p" style="margin-left:auto">Borç yok</span>'}</div>
    <div class="grid g2" style="margin:12px 0 10px">
     <div><div class="tiny">Güncel Borç</div><b style="font-size:20px;color:${debt>0?'var(--neg)':'var(--pos)'}">${fmt(debt)}</b></div>
     <div><div class="tiny">Kullanılabilir</div><b style="font-size:20px">${fmt(avail)}</b></div>
    </div>
    <div style="background:var(--bg);border-radius:99px;height:9px;overflow:hidden;margin-bottom:8px"><div style="width:${pct}%;height:100%;background:${pct>80?'var(--neg)':col};transition:width .3s"></div></div>
    <div class="mut">Limit ${fmt0(c.limit)} · doluluk %${pct.toFixed(0)} · kesim: ayın ${c.cutDay}'i · son ödeme: ayın ${c.dueDay}'i${debt>0?' ('+dTR(due)+')':''}</div>
    <div class="cardBtns">
     <button class="btn sm" data-act="cardTxnForm" data-arg="${c.id}~harcama">＋ Harcama</button>
     <button class="btn sm gh" data-act="cardTxnForm" data-arg="${c.id}~odeme">₺ Ödeme Yap</button>
     <button class="btn sm gh" data-act="cardDetail" data-arg="${c.id}">📄 Ekstre</button>
     <button class="btn sm gh" data-act="cardForm" data-arg="${c.id}">✎</button>
     <button class="btn sm gh" data-act="cardDeactivate" data-arg="${c.id}">⏸ Pasife Al</button>
     <button class="btn sm dng" data-act="del" data-arg="card~${c.id}">Sil</button>
    </div></div>`;}).join('')+`</div>`+(inactiveCards.length?`<div class="card"><h2>⏸ Pasif Kartlar <span class="tiny">(${inactiveCards.length}) — borçları toplamlarda görünmeye devam eder, sadece ödeme/harcama seçim listelerinden gizlenir</span></h2>
   <table><thead><tr><th>Kart</th><th class="num">Borç</th><th class="rowact"></th></tr></thead><tbody>
   ${inactiveCards.map(c=>`<tr><td><span class="avat sm" style="background:${hashColor(c.bank||c.name)}">${esc((c.bank||c.name).charAt(0))}</span> ${esc(c.name)} <span class="tiny">${esc(c.bank||'')}</span></td><td class="num">${fmt(cardDebt(c))}</td>
   <td class="rowact"><button class="btn sm gh" data-act="cardReactivate" data-arg="${c.id}">↩ Aktif Et</button><button class="btn sm dng" data-act="del" data-arg="card~${c.id}">🗑 Sil</button></td></tr>`).join('')}
   </tbody></table></div>`:'')+`${upcomingInstCard(CO)}<div id="cardEkstreBox"></div>`
  :`<div class="card"><div class="empty"><b>Kayıtlı kart yok</b>Limit, hesap kesim ve son ödeme günleriyle kartlarınızı ekleyin; son ödeme hatırlatmaları ana sayfada görünür.</div></div>`);
 document.getElementById('main').insertAdjacentHTML('beforeend',modSum('card'));
}
function cardForm(id){
 const init=id?S.cards.find(c=>c.id===id):{};
 openForm(id?'Kartı Düzenle':'Yeni Kredi Kartı',[
  {name:'name',label:'Kart adı',req:1,ph:'Ör: İş Bankası Maximum'},
  {row:[{name:'bank',label:'Banka'},{name:'last4',label:'Son 4 hane',ph:'1234'}]},
  {row:[{name:'limit',label:'Limit (₺)',type:'number',req:1},{name:'cutDay',label:'Hesap kesim günü',type:'number',req:1,def:1,step:'1',min:1,max:31}]},
  {row:[{name:'dueDay',label:'Son ödeme günü',type:'number',req:1,def:10,step:'1',min:1,max:31},{name:'note',label:'Not'}]}
 ],o=>{ if(id)Object.assign(init,o); else S.cards.push({id:nid(),co:CO,...o}); save();toast('Kart kaydedildi');go('card'); },init||{});
}
function cardTxnForm(cardId,type){
 const flds= type==='harcama'
  ? [{row:[{name:'amount',label:'Tutar (₺)',type:'number',req:1,min:0.01},{name:'date',label:'Tarih',type:'date',def:todayISO(),req:1}]},
     {row:[{name:'cat',label:'Kategori',type:'select',opts:catOpts('gider'),req:1},{name:'taksit',label:'Taksit',type:'select',opts:[[1,'Tek çekim'],[2,'2 taksit'],[3,'3 taksit'],[4,'4 taksit'],[5,'5 taksit'],[6,'6 taksit'],[9,'9 taksit'],[12,'12 taksit']]}]},
     {row:[{name:'vat',label:'KDV %',type:'select',opts:[['','KDV yok'],['1','%1'],['10','%10'],['20','%20']]},{name:'cariId',label:'İlgili cari / tedarikçi (opsiyonel)',type:'select',opts:cariOpts(CO)}]},{name:'desc',label:'Açıklama',ph:'Ör: Metro toptan alışveriş'}]
  : [{row:[{name:'amount',label:'Ödeme tutarı (₺)',type:'number',req:1,min:0.01},{name:'date',label:'Tarih',type:'date',def:todayISO(),req:1}]},
     {name:'accId',label:'Hangi hesaptan ödendi',type:'select',opts:accOpts(CO),req:1}];
 openForm(type==='harcama'?'Kart Harcaması':'Kart Ödemesi',flds,o=>{
  var cdid=nid();
  var ctid=''; // A12: kart ekranindan tedarikci secilirse cari bakiyeye de islensin
  if(type==='harcama'&&o.cariId){
   ctid=nid();
   S.cariTxns.push(stampCreate({id:ctid,co:CO,cariId:o.cariId,type:'alacak',amount:+o.amount,date:o.date,cardId:cardId,cardTxnId:cdid,desc:'Kart harcaması: '+(o.desc||'')}));
  }
  var _cdRec={id:cdid,co:CO,cardId,type,...o,amount:+o.amount,taksit:+o.taksit||1};
  if(ctid)_cdRec.cariTxnId=ctid;
  S.cardTxns.push(stampCreate(_cdRec));
  const c=S.cards.find(x=>x.id===cardId)||{};
  if(type==='odeme'&&o.accId){
   S.txns.push(stampCreate({id:nid(),co:CO,type:'gider',date:o.date,amount:+o.amount,cat:'Banka & Komisyon',accId:o.accId,cardTxnId:cdid,desc:'Kredi kartı ödemesi: '+(c.name||''),xfer:true}));
  }
  if(type==='harcama'){
   var N=+o.taksit||1;
   if(N<=1){
    S.txns.push(stampCreate({id:nid(),co:CO,type:'gider',date:o.date,amount:+o.amount,cat:o.cat,accId:'',cardTxnId:cdid,vat:o.vat||'',desc:(o.desc||'')+' (kredi kartı)',src:'card',cariId:o.cariId||''}));
   }else{
    var per=Math.round((+o.amount/N)*100)/100, acc=0;
    for(var ti=0;ti<N;ti++){
     var amt=(ti===N-1)?Math.round((+o.amount-acc)*100)/100:per; acc=Math.round((acc+per)*100)/100;
     S.txns.push(stampCreate({id:nid(),co:CO,type:'gider',date:addMonthsClamped(o.date,ti),amount:amt,cat:o.cat,accId:'',cardTxnId:cdid,taksitNo:(ti+1)+'/'+N,vat:o.vat||'',desc:(o.desc||'')+' (taksit '+(ti+1)+'/'+N+', kredi kartı)',src:'card',cariId:o.cariId||''}));
    }
   }
  }
  save();toast(type==='harcama'?((+o.taksit||1)>1?'Harcama eklendi — gider '+o.taksit+' aya bölündü (aylık ~'+fmt0((+o.amount)/(+o.taksit))+')':'Harcama eklendi'):'Ödeme kaydedildi');go('card');
 });
}
function cardStatementRange(c,ref){ // v14-Y3: cutDay zorunlu alandı ama hiçbir hesaba girmiyordu
 var cd=+c.cutDay||1, d=ref?new Date(ref):new Date();
 var y=d.getFullYear(), m=d.getMonth()+1, day=d.getDate();
 var endY=y, endM=m; if(day>cd){endM++;if(endM>12){endM=1;endY++;}}
 var end=clampDay(endY,endM,cd);
 var sY=endY, sM=endM-1; if(sM<1){sM=12;sY--;}
 var start=addDays(clampDay(sY,sM,cd),1);
 return {from:start,to:end};
}
function cardEkstre(id){
 const c=S.cards.find(x=>x.id===id);if(!c)return;
 const list=S.cardTxns.filter(t=>t.cardId===id&&!t.deletedAt).sort((a,b)=>a.date<b.date?1:-1);
 const _sr=cardStatementRange(c); // içinde bulunulan hesap kesim dönemi
 const _don=list.filter(t=>t.date>=_sr.from&&t.date<=_sr.to);
 const _donBorc=_don.reduce((s,t)=>s+(t.type==='harcama'?+t.amount:-t.amount),0);
 var _kbx=document.getElementById('cardEkstreBox'); if(!_kbx)return;
 _kbx.innerHTML=
  `<div class="card"><h2>Kart Ekstresi — ${esc(c.name)}</h2>
   <div class="mut" style="margin-bottom:8px">📆 Güncel dönem (kesim: ayın ${c.cutDay}'i): <b>${dTR(_sr.from)} — ${dTR(_sr.to)}</b> · dönem hareketi <b>${fmt(_donBorc)}</b> (${_don.length} işlem) · son ödeme: <b>${dTR(nextDue(+c.dueDay))}</b></div>
   ${list.length?'<table><thead><tr><th>Tarih</th><th>İşlem</th><th class="num">Tutar</th><th class="rowact"></th></tr></thead><tbody>'+
    list.map(t=>`<tr><td>${dTR(t.date)}</td><td><span class="chip ${t.type==='odeme'?'p':'n'}">${t.type==='odeme'?'Ödeme':'Harcama'}</span> ${esc(t.desc||t.cat||'')}${(+t.taksit||1)>1?' <span class="chip w">'+t.taksit+' taksit</span>':''}${t.vat?' <span class="chip">KDV %'+esc(t.vat)+'</span>':''}${t.cariId?' <span class="chip g" data-act="cariDetail" data-arg="'+t.cariId+'" style="cursor:pointer" title="Cari detayını aç">👥 '+esc((S.cari.find(x=>x.id===t.cariId)||{}).name||'')+'</span>':''}</td><td class="num" style="color:${t.type==='odeme'?'var(--pos)':'var(--neg)'}">${t.type==='odeme'?'-':''}${fmt(t.amount)}</td>
    <td class="rowact"><button data-act="del" data-arg="cardT~${t.id}">🗑</button></td></tr>`).join('')+'</tbody></table>'
    :'<div class="empty">Bu kartta hareket yok.</div>'}</div>`;
 try{document.getElementById('cardEkstreBox').scrollIntoView({behavior:'smooth'});}catch(e){}
}

/* ---------- CARİ HESAPLAR ---------- */
var cariTab='all';
function setCariTab(v){cariTab=v;rCari();}
var cariVade=''; // B4: yaşlandırma kovası filtresi ('' = kapalı, '0'..'3')
function setCariVade(v){cariVade=(String(cariVade)===String(v))?'':String(v);go('cari');}
function rCari(){
 const allCari=byCo(S.cari,CO); // v32: TÜM cariler (aktif+pasif) — toplamlar bundan hesaplanır
 const all=allCari.filter(c=>c.active!=='0'); // yalnızca aktif — liste ve sekmeler için
 const inactiveCari=allCari.filter(c=>c.active==='0');
 const isM=c=>c.type==='musteri'||c.type==='her2';
 const isT=c=>c.type==='tedarikci'||c.type==='her2';
 const list= cariTab==='musteri'? all.filter(isM)
  : cariTab==='tedarikci'? all.filter(isT)
  : cariTab==='diger'? all.filter(c=>c.type==='diger')
  : all;
 const allRows=allCari.map(c=>({c,b:cariBalance(c)})); // A15: bakiyeler TEK geçişte — toplamlar bundan
 const _lset=new Set(list.map(c=>c.id));
 const rows=allRows.filter(r=>_lset.has(r.c.id));
 const _vadeL=['0-30 gün','31-60 gün','61-90 gün','90+ gün'];
 const rowsF=cariVade===''?rows:rows.filter(r=>S.cariTxns.some(t=>t.cariId===r.c.id&&!t.deletedAt&&!t.kapandi&&t.type==='borc'&&t.vade&&(function(){var g=-daysDiff(t.vade);if(g<=0)return false;return (g<=30?0:g<=60?1:g<=90?2:3)===+cariVade;})())); // B4: kovaya göre filtre
 let alacak=0,borc=0;
 for(const r of allRows){if(r.b>0)alacak+=r.b;else borc+=-r.b;}
 const topAlacak=rows.filter(r=>r.b>0).sort((a,b)=>b.b-a.b).slice(0,6);
 const topBorc=rows.filter(r=>r.b<0).sort((a,b)=>a.b-b.b).slice(0,6);
 const TT={musteri:'Müşteri',tedarikci:'Tedarikçi',her2:'Müşteri+Tedarikçi',diger:'Diğer'};
 document.getElementById('main').innerHTML= topbar('Cari Hesaplar',
  `<button class="btn" data-act="cariForm">＋ Cari Ekle</button>`)+
 orphanCard()+
 seg([['all','Tümü',all.length],['musteri','Müşteriler',all.filter(isM).length],['tedarikci','Tedarikçiler',all.filter(isT).length],['diger','Diğer',all.filter(c=>c.type==='diger').length]],cariTab,'setCariTab')+
 `<div class="grid g3" style="margin-bottom:16px">
  <div class="kpi p"><div class="l">Toplam Alacağımız</div><div class="v">${fmt0(alacak)}</div></div>
  <div class="kpi n"><div class="l">Toplam Borcumuz</div><div class="v">${fmt0(borc)}</div></div>
  <div class="kpi"><div class="l">${cariTab==='all'?'Cari Sayısı':cariTab==='musteri'?'Müşteri Sayısı':cariTab==='tedarikci'?'Tedarikçi Sayısı':'Kayıt Sayısı'}</div><div class="v">${list.length}</div></div></div>
 ${cariAgingCard()}
 ${(topAlacak.length||topBorc.length)?`<div class="grid g2">
  <div class="card"><h2>En Yüksek Alacaklarımız</h2>${topAlacak.length?chartHBars(topAlacak.map(r=>({label:r.c.name,value:r.b,color:'var(--pos)',act:'cariDetail',arg:r.c.id}))):'<div class="empty">Alacak yok</div>'}</div>
  <div class="card"><h2>En Yüksek Borçlarımız</h2>${topBorc.length?chartHBars(topBorc.map(r=>({label:r.c.name,value:-r.b,color:'var(--neg)',act:'cariDetail',arg:r.c.id}))):'<div class="empty">Borç yok</div>'}</div>
 </div>`:''}
 ${cariVade!==''?`<div class="card" style="margin-bottom:12px;padding:10px 14px"><span class="chip w">⏳ Filtre: ${_vadeL[+cariVade]} gecikmiş borcu olanlar (${rowsF.length} cari)</span> <button class="btn sm gh" data-act="setCariVade" data-arg="${cariVade}">✕ Filtreyi kaldır</button></div>`:''}
 ${rowsF.length? `<div class="grid g2">`+rowsF.map(({c,b})=>{
   const col=hashColor(c.name);
   const vadeli=S.cariTxns.filter(t=>t.cariId===c.id&&!t.deletedAt&&!t.kapandi&&t.vade&&daysDiff(t.vade)<=7&&daysDiff(t.vade)>=-30); // v14-H15
   return `<div class="card accCard" data-act="cariDetail" data-arg="${c.id}" style="--ac:${col};cursor:pointer" title="Cari detay sayfasını aç">
    <div class="accHead"><span class="avat" style="background:${col}">${esc(c.name.charAt(0).toUpperCase())}</span>
     <div><b>${esc(c.name)}</b><div class="tiny">${esc(c.phone||'')} ${c.taxNo?'· VN: '+esc(c.taxNo):''}</div></div>
     <span class="chip g" style="margin-left:auto">${TT[c.type]||c.type}</span>${(+c.riskLimit>0&&b>+c.riskLimit)?'<span class="chip n">⚠ Limit aşımı</span>':''}</div>
    <div class="accBal" style="margin-top:10px"><div><div class="tiny">Güncel Bakiye</div>
     <b style="font-size:20px;color:${b>0?'var(--pos)':b<0?'var(--neg)':'var(--ink2)'}">${fmt(Math.abs(b))}</b>
     <div class="tiny">${b>0?'bize borçlu':b<0?'biz borçluyuz':'hesap kapalı'}</div></div>
     ${vadeli.length?`<div><span class="chip ${vadeli.some(v=>daysDiff(v.vade)<=0)?'n':'w'}">⏰ ${vadeli.length} vadeli işlem</span></div>`:''}</div>
    <div class="cardBtns">
     <button class="btn sm out" data-act="cariTxnForm" data-arg="${c.id}~borc">＋ Borç</button>
     <button class="btn sm in" data-act="cariTxnForm" data-arg="${c.id}~alacak">＋ Alacak</button>
     <button class="btn sm gh" data-act="cariInvoiceForm" data-arg="${c.id}">🧾 Faturalaştır</button>
     <button class="btn sm gh" data-act="cariDetail" data-arg="${c.id}">📄 Ekstre</button>
     <button class="btn sm gh" data-act="cariForm" data-arg="${c.id}">✎</button>
     <button class="btn sm gh" data-act="cariDeactivate" data-arg="${c.id}">⏸ Pasife Al</button>
     <button class="btn sm dng" data-act="del" data-arg="cari~${c.id}">Sil</button>
    </div></div>`;}).join('')+`</div>`
  :`<div class="card"><div class="empty"><b>${cariVade!==''?'Bu gecikme aralığında cari yok':'Bu sekmede cari yok'}</b>${cariVade!==''?'Filtreyi kaldırıp tüm carileri görebilirsiniz.':'Müşteri ve tedarikçilerinizi ekleyin; borç-alacak ve vade takibi burada yapılır.'}</div></div>`}
 ${inactiveCari.length?`<div class="card"><h2>⏸ Pasif Cariler <span class="tiny">(${inactiveCari.length}) — bakiyeleri toplamlara dahil edilmeye devam eder, sadece yeni işlem listelerinden gizlenir</span></h2>
  <table><thead><tr><th>Cari</th><th class="num">Bakiye</th><th class="rowact"></th></tr></thead><tbody>
  ${inactiveCari.map(c=>{const b=cariBalance(c);return `<tr><td><span class="avat sm" style="background:${hashColor(c.name)}">${esc(c.name.charAt(0))}</span> ${esc(c.name)} <span class="tiny">${TT[c.type]||c.type}</span></td>
  <td class="num">${fmt(Math.abs(b))} ${b>0?'(bize borçlu)':b<0?'(biz borçluyuz)':''}</td>
  <td class="rowact"><button class="btn sm gh" data-act="cariReactivate" data-arg="${c.id}">↩ Aktif Et</button><button class="btn sm dng" data-act="del" data-arg="cari~${c.id}">🗑 Sil</button></td></tr>`;}).join('')}
  </tbody></table></div>`:''}
 <div id="cariEkstreBox"></div>`;
 document.getElementById('main').insertAdjacentHTML('beforeend',modSum('cari'));
}
function cariDeactivate(id){
 const c=S.cari.find(x=>x.id===id);if(!c)return;
 c.active='0';logAudit('Cari pasife alındı',c.name);save();toast(c.name+' pasife alındı — bakiyesi toplamlarda görünmeye devam eder');go('cari');
}
function cariReactivate(id){
 const c=S.cari.find(x=>x.id===id);if(!c)return;
 c.active='1';logAudit('Cari yeniden aktif edildi',c.name);save();toast(c.name+' yeniden aktif edildi');go('cari');
}
function cariForm(id){
 const init=id?S.cari.find(c=>c.id===id):{type:'tedarikci'};
 openForm(id?'Cari Düzenle':'Yeni Cari',[
  {name:'name',label:'Unvan / Ad',req:1,ph:'Ör: Anadolu Gıda Ltd.'},
  {name:'type',label:'Cari türü',type:'select',opts:[['musteri','Müşteri'],['tedarikci','Tedarikçi'],['her2','Müşteri + Tedarikçi'],['diger','Diğer']]},
  {row:[{name:'taxNo',label:'Vergi No / TCKN'},{name:'phone',label:'Telefon'}]},
  {row:[{name:'email',label:'E-posta',type:'email'},{name:'vadeGun',label:'Varsayılan vade (gün)',type:'number',step:'1',def:30}]},
  {row:[{name:'opening',label:'Açılış bakiyesi ₺ (+ alacağımız / − borcumuz)',type:'number',def:0},{name:'riskLimit',label:'Risk limiti (₺)',type:'number'}]},
  {name:'note',label:'Not',type:'textarea'}
 ],o=>{ if(id){Object.assign(init,o);stampUpdate(init,init);} else pushRec(S.cari,{id:nid(),co:CO,...o}); save();toast('Cari kaydedildi');go('cari'); },init||{}); // v14-D1: denetim damgası
}
function cariTxnForm(cariId,defType,init){
 const c=S.cari.find(x=>x.id===cariId)||{};
 openForm('Cari Hareket — '+(c.name||''),[
  {name:'type',label:'İşlem',type:'select',opts:[['borc','Borçlandır (satış yaptık / alacağımız arttı)'],['alacak','Alacaklandır (tahsilat / borcumuz arttı)']],req:1,def:defType||'borc'},
  {row:[{name:'amount',label:'Tutar (₺)',type:'number',req:1,min:0.01},{name:'date',label:'Tarih',type:'date',def:todayISO(),req:1}]},
  {name:'nakit',label:'Nakit Hareketi (para gerçekten hesaba girdi/çıktıysa)',type:'select',opts:[['','Yok — sadece cari kaydı (veresiye)'],['gelir','💰 Bu hesaba PARA GİRİŞİ oldu (tahsilat)'],['gider','💸 Bu hesaptan PARA ÇIKIŞI oldu (ödeme)']],def:''},
  {name:'method',label:'Yöntem (nakit hareketi seçtiyseniz): kasa / banka / 💳 kredi kartı',type:'select',opts:payMethodOpts(CO)},
  {name:'vade',label:'Vade tarihi (hatırlatma için)',type:'date',def:c.vadeGun?addDays(todayISO(),+c.vadeGun):''},
  {name:'desc',label:'Açıklama',ph:'Fatura no, işlem detayı...'}
 ],o=>{
  var method=o.method||''; var isCard=method.indexOf('card:')===0; var cardId=isCard?method.slice(5):''; var bankAccId=isCard?'':method;
  if(o.nakit&&!method){ toast('⚠ "Nakit Hareketi" seçtiniz ama yöntem seçmediniz — parayı hangi kasa/banka veya kredi kartıyla işlediğinizi seçin; gerçek para hareketi yoksa "Yok — sadece cari kaydı (veresiye)" seçeneğini işaretleyin.'); cariTxnForm(cariId,o.type,o); return; }
  if(isCard&&o.nakit!=='gider'){ toast('💳 Kredi kartı yalnızca ödeme (para çıkışı) için seçilebilir; tahsilat için kasa/banka seçin.'); cariTxnForm(cariId,o.type,o); return; }
  var ctid=nid();
  S.cariTxns.push(stampCreate({id:ctid,co:CO,cariId:cariId,type:o.type,amount:+o.amount,date:o.date,vade:o.vade,desc:o.desc,nakit:o.nakit||'',accId:bankAccId||'',cardId:cardId||''}));
  let nakitMsg='';
  if(o.nakit&&bankAccId){
   S.txns.push(stampCreate({id:nid(),co:CO,type:o.nakit,date:o.date,amount:+o.amount,accId:bankAccId,cariId:cariId,cariTxnId:ctid,
    cat:o.nakit==='gelir'?'Diğer Gelir':'Diğer Gider',
    desc:(o.nakit==='gelir'?'Cari tahsilat: ':'Cari ödeme: ')+(c.name||'')+(o.desc?' - '+o.desc:'')}));
   nakitMsg=' + nakit hareketi işlendi';
  }else if(o.nakit&&isCard){
   var cdid=nid();
   S.cardTxns.push(stampCreate({id:cdid,co:CO,cardId:cardId,type:'harcama',amount:+o.amount,date:o.date,cat:'Cari Ödeme',taksit:1,cariId:cariId,cariTxnId:ctid,desc:'Cari ödemesi: '+(c.name||'')+(o.desc?' - '+o.desc:'')}));
   S.txns.push(stampCreate({id:nid(),co:CO,type:'gider',date:o.date,amount:+o.amount,accId:'',src:'card',cariId:cariId,cariTxnId:ctid,cardTxnId:cdid,cat:'Cari Ödeme',
    desc:'Cari ödemesi (kredi kartı): '+(c.name||'')+(o.desc?' - '+o.desc:'')}));
   nakitMsg=' + kredi kartına işlendi (kart borcu arttı)';
  }
  const bal=cariBalance(S.cari.find(x=>x.id===cariId));
  if(c.riskLimit&&bal>+c.riskLimit)toast('⚠ Risk limiti aşıldı! Bakiye: '+fmt(bal));
  else toast('Hareket kaydedildi'+nakitMsg);
  save();go('cari');
 },init||{});
 setTimeout(function(){ /* veresiye girisinde yontem alanini gizle */
  var nk=document.querySelector('#mForm select[name="nakit"]'),mt=document.querySelector('#mForm select[name="method"]');
  if(!nk||!mt)return;
  var fld=mt.closest('.fld');if(!fld)return;
  var upd=function(){fld.style.display=nk.value?'':'none';};
  nk.addEventListener('change',upd);upd();
 },80);
}
/* v27: FATURALAŞTIR — cari hareketin ÜZERİNE, resmi fatura bilgilerini (no, KDV) ekleyen özel bir giriş yolu.
   Bakiye hesaplaması hâlâ AYNI test edilmiş cariTxns/cariBalance mekanizmasını kullanır — buraya dokunulmadı,
   sadece kaydın üzerine fatura no/KDV gibi ek alanlar ve görsel bir "🧾 Fatura" etiketi ekleniyor. */
function cariInvoiceForm(cariId){
 const c=S.cari.find(x=>x.id===cariId)||{};
 openForm('Faturalaştır — '+(c.name||''),[
  {name:'type',label:'Fatura Yönü',type:'select',opts:[['borc','Kestiğimiz fatura (satış — alacağımız artar)'],['alacak','Aldığımız fatura (alış — borcumuz artar)']],req:1,def:'borc'},
  {row:[{name:'faturaNo',label:'Fatura No',req:1,ph:'Ör: A2026-000145'},{name:'date',label:'Fatura Tarihi',type:'date',def:todayISO(),req:1}]},
  {row:[{name:'amount',label:'Tutar ₺ (KDV dahil)',type:'number',req:1,min:0.01},{name:'vat',label:'KDV %',type:'select',opts:[['','KDV yok'],['1','%1'],['10','%10'],['20','%20']]}]},
  {name:'cat',label:'Gider kategorisi (alış faturası için — bütçe ve tahakkuk raporu bu kaleme işler)',type:'select',opts:[['','— Genel (Fatura Gideri) —']].concat(catOpts('gider'))},
  {name:'vade',label:'Vade tarihi',type:'date',def:c.vadeGun?addDays(todayISO(),+c.vadeGun):''},
  {name:'desc',label:'Açıklama (opsiyonel)',ph:'Fatura içeriği / not'}
 ],o=>{
  S.cariTxns.push(stampCreate({id:nid(),co:CO,cariId,...o,amount:+o.amount,fatura:true}));
  const bal=cariBalance(S.cari.find(x=>x.id===cariId));
  logAudit('Cari fatura kaydedildi',(c.name||'')+' — '+o.faturaNo);
  if(c.riskLimit&&bal>+c.riskLimit)toast('⚠ Risk limiti aşıldı! Bakiye: '+fmt(bal));
  else toast('🧾 Fatura kaydedildi: '+o.faturaNo);
  save();go('cari');
 });
}
/* v33: cari ekstre tarih araligi — parametresiz cagri (cariDetail) eski "Tumu" davranisini korur */
var _cariEk={id:null,from:'',to:''};
function cariEkFrom(v){if(_cariEk.id)cariEkstre(_cariEk.id,v,_cariEk.to);}
function cariEkTo(v){if(_cariEk.id)cariEkstre(_cariEk.id,_cariEk.from,v);}
function cariEkPreset(id,k){if(k==='tum')cariEkstre(id,'','');else{const r=rangePreset(k);cariEkstre(id,r.from,r.to);}}
function cariEkstre(id,from,to){
 const c=S.cari.find(x=>x.id===id);if(!c)return;
 from=from||'';to=to||'';
 _cariEk={id:id,from:from,to:to};
 const all=S.cariTxns.filter(t=>t.cariId===id&&!t.deletedAt).sort((a,b)=>a.date<b.date?-1:1);
 let devir=0;const list=[];
 for(const t of all){
  const d=t.type==='borc'?+t.amount:-t.amount;
  if(from&&t.date<from){devir+=d;continue;} // aralik oncesi net etki -> donem basi devir
  if(to&&t.date>to)continue;
  list.push(t);
 }
 const donemBasi=(+c.opening||0)+devir;
 let run=donemBasi;
 const rows=(from?`<tr style="background:var(--acc-soft)"><td>${dTR(from)}</td><td><b>Dönem başı devir</b> <span class="tiny">açılış ${fmt(c.opening)} + önceki hareketler ${fmt(devir)}</span></td><td class="num"></td><td class="num"></td><td class="num"><b>${fmt(donemBasi)}</b></td><td></td></tr>`:'')
 +list.map(t=>{const d=t.type==='borc'?+t.amount:-t.amount;run+=d;
  const vatTag=(t.fatura&&t.vat)?` <span class="tiny">(KDV %${esc(t.vat)}, tutarı: ${fmt(+t.amount*t.vat/(100+ +t.vat))})</span>`:'';
  const acc=t.nakit&&t.accId?S.accounts.find(x=>x.id===t.accId):null;
  const card=t.nakit&&t.cardId?S.cards.find(x=>x.id===t.cardId):null;
  const nakitTag=acc?` <span class="chip p" data-act="accDetail" data-arg="${acc.id}" style="cursor:pointer" title="Hesap detayını aç">${t.nakit==='gelir'?'💰 Nakit tahsilat':'💸 Nakit ödeme'} · ${esc(acc.name)}</span>`:card?` <span class="chip p" data-act="cardDetail" data-arg="${card.id}" style="cursor:pointer" title="Kart detayını aç">💳 Kart ödemesi · ${esc(card.name)}</span>`:(t.nakit?` <button class="btn sm dng" data-act="fixOrphanTxn" data-arg="${t.id}">⚠ Düzelt (hesap seçilmemiş)</button>`:` <span class="chip w">📝 Veresiye</span>`);
  return `<tr><td>${dTR(t.date)}</td><td>${t.fatura?`<span class="chip g">🧾 ${esc(t.faturaNo||'Fatura')}</span> `:''}${esc(t.desc||'')}${vatTag}${nakitTag} ${t.vade?'<div class="tiny">Vade: '+dTR(t.vade)+(t.kapandi?' <span class="chip p">kapandı ✓</span>':' <button class="btn sm gh" data-act="cariVadeKapat" data-arg="'+t.id+'">✔ Kapat</button>')+'</div>':''}</td>
  <td class="num amtN">${t.type==='borc'?fmt(t.amount):'<span class="nil">—</span>'}</td><td class="num amtP">${t.type==='alacak'?fmt(t.amount):'<span class="nil">—</span>'}</td>
  <td class="num" style="font-weight:600">${fmt(run)}</td>
  <td class="rowact"><button data-act="del" data-arg="cariT~${t.id}">🗑</button></td></tr>`;}).join('');
 var _cbx=document.getElementById('cariEkstreBox'); if(!_cbx)return;
 _cbx.innerHTML=
  `<div class="card"><h2>Cari Ekstre — ${esc(c.name)} <button class="btn sm gh" data-act="printPage">🖨 Yazdır</button>${run>0?'<button class="btn sm gh" data-act="aiCollectMail" data-arg="'+id+'">✦ Tahsilat Maili</button>':''}</h2>
  <div class="filters" style="margin-bottom:8px"><span class="mut" style="align-self:center">Aralık:</span>
   <input type="date" value="${from}" data-actv="cariEkFrom"><input type="date" value="${to}" data-actv="cariEkTo">
   <button class="btn sm gh" data-act="cariEkPreset" data-arg="${id}~ay">Bu Ay</button>
   <button class="btn sm gh" data-act="cariEkPreset" data-arg="${id}~gecenAy">Geçen Ay</button>
   <button class="btn sm ${(!from&&!to)?'':'gh'}" data-act="cariEkPreset" data-arg="${id}~tum">Tümü</button></div>
  <div class="mut" style="margin-bottom:8px">Açılış: ${fmt(c.opening)}${(from||to)?' · Dönem başı: <b>'+fmt(donemBasi)+'</b> · Dönem sonu: <b>'+fmt(run)+'</b>':' · Güncel bakiye: <b>'+fmt(run)+'</b>'} ${run>0?'(bize borçlu)':run<0?'(biz borçluyuz)':''} · 🧾 ${list.filter(t=>t.fatura).length} fatura · 💳 ${list.filter(t=>t.nakit&&t.accId).length} nakit hareketli kayıt</div>
  ${rows?'<table><thead><tr><th>Tarih</th><th>Açıklama</th><th class="num">Borç</th><th class="num">Alacak</th><th class="num">Bakiye</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>':'<div class="empty">'+((from||to)?'Seçili aralıkta hareket yok.':'Hareket yok.')+'</div>'}</div>`;
 try{document.getElementById('cariEkstreBox').scrollIntoView({behavior:'smooth'});}catch(e){}
}

/* ---------- PERSONEL & MAAŞ ---------- */
var staffTab='kadro';
function setStaffTab(v){staffTab=v;rStaff();}
function rStaff(){
 const list=byCo(S.staff,CO).filter(s=>s.active!=='0');
 const inactiveList=byCo(S.staff,CO).filter(s=>s.active==='0'); // v31: pasif personeli görüp yönetebilme
 const mo=monthISO();
 const pays=S.staffTxns.filter(t=>t.co===CO&&!t.deletedAt).sort((a,b)=>a.date<b.date?1:-1);
 const lvs=S.leaves.filter(l=>l.co===CO&&!l.deletedAt).sort((a,b)=>a.start<b.start?1:-1);
 const ayOdeme=pays.filter(t=>t.date.startsWith(mo)&&(t.type==='maas'||t.type==='avans')).reduce((s,t)=>s+ +t.amount,0);
 const ms=monthSeries(CO,6,'Personel');
 const TT={maas:'Maaş',avans:'Avans',prim:'Prim',kesinti:'Kesinti'};
 const LT={yillik:'Yıllık izin',ucretsiz:'Ücretsiz izin',rapor:'Sağlık raporu',mazeret:'Mazeret'};
 const stName=id=>(S.staff.find(x=>x.id===id)||{}).name||'?';

 document.getElementById('main').innerHTML= topbar('Personel & Maaş',
  `<button class="btn gh" data-act="maasDonemi">💰 Maaş Dönemi Çalıştır</button><button class="btn gh" data-act="leaveForm">🏖 İzin Gir</button><button class="btn" data-act="staffForm">＋ Personel Ekle</button>`)+
 `<div class="grid g3" style="margin-bottom:16px">
  <div class="kpi"><div class="l">Aktif Personel</div><div class="v">${list.length}</div></div>
  <div class="kpi"><div class="l">Sözleşme Maaş Toplamı (statik)</div><div class="v">${fmt0(list.reduce((s,x)=>s+ +(x.salary||0),0))}</div></div>
  <div class="kpi n"><div class="l">Bu Ay Ödenen (maaş+avans)</div><div class="v">${fmt0(ayOdeme)}</div>${(function(){var _mAll=sumRange(CO,monthISO()+'-01',todayISO());var _pg=_mAll.byCat['Personel']||0;var _r=_mAll.gelir?_pg/_mAll.gelir*100:0;return '<div class="s" style="color:'+(_r>35?'var(--neg)':_r<25&&_r>0?'var(--pos)':_r?'var(--warn)':'var(--ink3)')+'">Personel/Ciro: '+(_mAll.gelir?('%'+_r.toFixed(1)):'—')+' <span class="tiny">(sağlıklı bant %25-35)</span></div>';})()}</div></div>
 ${seg([['kadro','Kadro',list.length],['odeme','Ödemeler',pays.length],['izin','İzin & Rapor',lvs.length]],staffTab,'setStaffTab')}`+
 (staffTab==='odeme'
 ? `<div class="card"><h2>Tüm Ödeme Kayıtları</h2>
   ${pays.length?'<table><thead><tr><th>Tarih</th><th>Personel</th><th>Tür</th><th class="hidem">Dönem</th><th class="num">Tutar</th><th class="rowact"></th></tr></thead><tbody>'+
    pays.slice(0,80).map(t=>`<tr><td>${dTR(t.date)}</td><td><span class="avat sm" style="background:${hashColor(stName(t.staffId))}">${esc(stName(t.staffId).charAt(0))}</span> ${esc(stName(t.staffId))}</td>
    <td><span class="chip ${t.type==='kesinti'?'n':t.type==='avans'?'w':'g'}">${TT[t.type]||t.type}</span></td><td class="hidem">${t.period?mTR(t.period):''}</td><td class="num">${fmt(t.amount)}</td>
    <td class="rowact"><button data-act="del" data-arg="staffT~${t.id}">🗑</button></td></tr>`).join('')+'</tbody></table>'
    :'<div class="empty"><b>Ödeme kaydı yok</b>Personel kartlarındaki "₺ Ödeme / Avans" ile kayıt oluşturun.</div>'}</div>`
 : staffTab==='izin'
 ? `<div class="card"><h2>İzin & Rapor Kayıtları</h2>
   ${lvs.length?'<table><thead><tr><th>Personel</th><th>Tür</th><th>Tarih Aralığı</th><th>Durum</th><th class="rowact"></th></tr></thead><tbody>'+
    lvs.map(l=>{const aktif=l.start<=todayISO()&&l.end>=todayISO();
     return `<tr><td><span class="avat sm" style="background:${hashColor(stName(l.staffId))}">${esc(stName(l.staffId).charAt(0))}</span> ${esc(stName(l.staffId))}</td>
     <td>${LT[l.type]||l.type}</td><td>${dTR(l.start)} → ${dTR(l.end)}</td>
     <td>${aktif?'<span class="chip w">🏖 Şu an izinde</span>':l.end<todayISO()?'<span class="chip g">Tamamlandı</span>':'<span class="chip p">Planlandı</span>'}</td>
     <td class="rowact"><button data-act="del" data-arg="leave~${l.id}">🗑</button></td></tr>`;}).join('')+'</tbody></table>'
    :'<div class="empty"><b>İzin kaydı yok</b>"🏖 İzin Gir" ile personel izinlerini planlayın.</div>'}</div>`
 : `${ms.some(m=>m.gider>0)?`<div class="card"><h2>Aylık Personel Gideri (son 6 ay)</h2>
  ${chartVBars(ms.map(m=>({label:m.label,bars:[{value:m.gider,color:'var(--acc)',name:'Personel gideri'}]})),180)}</div>`:''}
 ${list.length? `<div class="grid g2">`+list.map(st=>{
   const col=hashColor(st.name);
   const paid=S.staffTxns.filter(t=>t.staffId===st.id&&!t.deletedAt&&t.date.startsWith(mo)&&(t.type==='maas'||t.type==='avans')).reduce((s,t)=>s+ +t.amount,0); // v14-H13
   const pct=Math.min(100,paid/(+st.salary||1)*100);
   const onLeave=S.leaves.some(l=>l.staffId===st.id&&!l.deletedAt&&l.start<=todayISO()&&l.end>=todayISO()); // v14-H7
   return `<div class="card accCard" data-act="staffHist" data-arg="${st.id}" style="--ac:${col};cursor:pointer" title="Ödeme ve izin geçmişini aç">
    <div class="accHead"><span class="avat" style="background:${col}">${esc(st.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase())}</span>
     <div><b>${esc(st.name)}</b><div class="tiny">${esc(st.pos||'')} ${st.phone?'· '+esc(st.phone):''}</div></div>
     ${onLeave?'<span class="chip w" style="margin-left:auto">🏖 İzinde</span>':'<span class="chip p" style="margin-left:auto">Aktif</span>'}</div>
    <div class="grid g2" style="margin:12px 0 8px">
     <div><div class="tiny">Net Maaş</div><b style="font-size:19px">${fmt0(st.salary)}</b></div>
     <div><div class="tiny">Bu Ay Ödenen${st.startDate?' <span title="İşe giriş: '+dTR(st.startDate)+'">· '+esc(kidemStr(st.startDate))+'</span>':''}</div><b style="font-size:19px;color:${paid>0?'var(--acc)':'var(--ink3)'}">${fmt0(paid)}</b></div>
    </div>
    <div style="background:#eceff6;border-radius:99px;height:8px;overflow:hidden"><div class="hbFill" style="width:${pct}%;height:100%;background:${col}"></div></div>
    <div class="tiny" style="margin-top:4px">Bu ay maaşın %${pct.toFixed(0)}'i ödendi</div>
    <div class="cardBtns">
     <button class="btn sm" data-act="staffPayForm" data-arg="${st.id}">₺ Ödeme / Avans</button>
     <button class="btn sm gh" data-act="leaveForm" data-arg="${st.id}">🏖 İzin</button>
     <button class="btn sm gh" data-act="staffHist" data-arg="${st.id}">📄 Geçmiş</button>
     <button class="btn sm gh" data-act="staffForm" data-arg="${st.id}">✎</button>
     <button class="btn sm dng" data-act="staffDeactivate" data-arg="${st.id}">⏏ Çıkış</button>
    </div></div>`;}).join('')+`</div>`
  :'<div class="card"><div class="empty"><b>Personel kaydı yok</b>Personellerinizi ekleyip maaş, avans ve izinlerini buradan takip edin.</div></div>'}
 ${inactiveList.length?`<div class="card"><h2>⏸ Pasif Personel <span class="tiny">(${inactiveList.length}) — işten ayrılan veya hatalı eklenen kayıtlar</span></h2>
  <table><thead><tr><th>Ad</th><th class="hidem">Görev</th><th class="rowact"></th></tr></thead><tbody>
  ${inactiveList.map(s=>`<tr><td><span class="avat sm" style="background:${hashColor(s.name)}">${esc(s.name.charAt(0))}</span> ${esc(s.name)}</td><td class="hidem">${esc(s.pos||'')}</td>
  <td class="rowact"><button class="btn sm gh" data-act="staffReactivate" data-arg="${s.id}">↩ Aktif Et</button><button class="btn sm dng" data-act="del" data-arg="staffPerma~${s.id}">🗑 Kalıcı Sil</button></td></tr>`).join('')}
  </tbody></table></div>`:''}`)+
 `<div id="staffHistBox"></div>`;
 document.getElementById('main').insertAdjacentHTML('beforeend',modSum('staff'));
}
function staffForm(id){
 const init=id?S.staff.find(s=>s.id===id):{active:'1'};
 openForm(id?'Personel Düzenle':'Yeni Personel',[
  {name:'name',label:'Ad Soyad',req:1},
  {row:[{name:'pos',label:'Görev / Pozisyon',ph:'Aşçı, Garson...'},{name:'phone',label:'Telefon'}]},
  {row:[{name:'startDate',label:'İşe giriş',type:'date',def:todayISO()},{name:'salary',label:'Net maaş (₺)',type:'number',req:1}]},
  {name:'iban',label:'IBAN'},
  {name:'note',label:'Not',type:'textarea'}
 ],o=>{ if(id)Object.assign(init,o); else S.staff.push({id:nid(),co:CO,active:'1',...o}); save();toast('Personel kaydedildi');go('staff'); },init||{});
}
function staffPayForm(staffId,init){
 const st=S.staff.find(x=>x.id===staffId)||{};
 openForm('Ödeme — '+(st.name||''),[
  {name:'type',label:'İşlem türü',type:'select',opts:[['maas','Maaş ödemesi'],['avans','Avans'],['prim','Prim / ikramiye'],['kesinti','Kesinti']],req:1},
  {row:[{name:'amount',label:'Tutar (₺)',type:'number',req:1,min:0.01,def:st.salary||''},{name:'date',label:'Tarih',type:'date',def:todayISO(),req:1}]},
  {name:'period',label:'Dönem',type:'month',def:monthISO(),req:1},
  {name:'method',label:'Hangi hesaptan / kart (maaş/avans/prim için zorunlu)',type:'select',opts:payMethodOpts(CO)},
  {name:'kesintiAccId',label:'Kesinti NAKİT tahsil edildiyse hangi hesaba girdi (opsiyonel — boşsa maaştan mahsup edilir)',type:'select',opts:accOpts(CO,1)},
  {name:'desc',label:'Açıklama'}
 ],o=>{
  var isPay=(o.type==='maas'||o.type==='avans'||o.type==='prim');
  if(isPay&&!o.method){ toast('⚠ Maaş/avans/prim ödemesi için paranın çıktığı hesabı ya da kredi kartını seçin. Nakit çıkışı olmadan ödeme işlenemez.'); staffPayForm(staffId,o); return; }
  var isCard=isPay&&String(o.method).indexOf('card:')===0; // D1: personel ödemesi kartla da yapılabilir
  var stid=nid();
  S.staffTxns.push(stampCreate({id:stid,co:CO,staffId:staffId,type:o.type,amount:+o.amount,date:o.date,period:o.period,desc:o.desc,accId:(isPay&&!isCard)?o.method:'',cardId:isCard?o.method.slice(5):''}));
  var _d=(o.type==='maas'?'Maaş: ':o.type==='avans'?'Avans: ':o.type==='prim'?'Prim: ':'Kesinti: ')+(st.name||'')+' ('+(o.period||'')+')';
  if(isPay){
   if(isCard){
    var cdid=nid();
    S.cardTxns.push(stampCreate({id:cdid,co:CO,cardId:o.method.slice(5),type:'harcama',amount:+o.amount,date:o.date,cat:'Personel',taksit:1,staffTxnId:stid,desc:_d}));
    S.txns.push(stampCreate({id:nid(),co:CO,type:'gider',date:o.date,amount:+o.amount,cat:'Personel',accId:'',src:'card',cardTxnId:cdid,staffTxnId:stid,desc:_d+' (kredi kartı)'}));
   }else{
    S.txns.push(stampCreate({id:nid(),co:CO,type:'gider',date:o.date,amount:+o.amount,cat:'Personel',accId:o.method,staffTxnId:stid,desc:_d}));
   }
  }
  if(o.type==='kesinti'&&o.kesintiAccId){ // D1: kesinti nakden tahsil edildiyse hesaba gelir yazılır
   S.txns.push(stampCreate({id:nid(),co:CO,type:'gelir',date:o.date,amount:+o.amount,cat:'Diğer Gelir',accId:o.kesintiAccId,staffTxnId:stid,desc:'Personel kesintisi tahsilatı: '+(st.name||'')}));
  }
  save();toast('Kayıt eklendi'+(isCard?' — kredi kartına işlendi':''));go('staff');
 },init||{});
}
/* v33: TOPLU MAAS DONEMI — tum aktif personelin maasini tek adimda isler (avans/kesinti mahsuplu) */
function maasDonemi(){
 const list=byCo(S.staff,CO).filter(s=>s.active!=='0');
 if(!list.length)return toast('Aktif personel yok — önce personel ekleyin');
 const opts=accOpts(CO);
 if(!opts.length)return toast('Önce Banka & Kasa ekranından bir hesap ekleyin');
 openForm('💰 Maaş Dönemi Çalıştır',[
  {name:'period',label:'Dönem',type:'month',def:monthISO(),req:1},
  {name:'payDate',label:'Ödeme tarihi',type:'date',def:todayISO(),req:1},
  {name:'accId',label:'Kaynak hesap (maaşların çıkacağı)',type:'select',opts,req:1}
 ],o=>{
  let done=0,skipped=0,total=0;const netSkip=[];
  list.forEach(st=>{
   // o donem zaten maas aldiysa atla
   if(S.staffTxns.some(t=>t.staffId===st.id&&t.type==='maas'&&t.period===o.period&&!t.deletedAt)){skipped++;return;}
   const avans=S.staffTxns.filter(t=>t.staffId===st.id&&t.type==='avans'&&t.period===o.period&&!t.deletedAt).reduce((s,t)=>s+ +t.amount,0);
   const kesinti=S.staffTxns.filter(t=>t.staffId===st.id&&t.type==='kesinti'&&t.period===o.period&&!t.deletedAt).reduce((s,t)=>s+ +t.amount,0);
   var _uz=0,_ug=0; // v14-X6: ücretsiz izin günleri maaştan düşülür (izin türü eskiden hiçbir hesaba girmiyordu)
   S.leaves.forEach(function(l){ if(l.staffId!==st.id||l.deletedAt||l.type!=='ucretsiz'||!l.start)return;
    var _ps=o.period+'-01', _pe=o.period+'-31';
    var a1=l.start>_ps?l.start:_ps, b1=(l.end||l.start)<_pe?(l.end||l.start):_pe;
    if(a1>b1)return; _ug+=Math.floor((new Date(b1)-new Date(a1))/86400000)+1; });
   if(_ug>0)_uz=+((+(st.salary||0)/30)*_ug).toFixed(2);
   const net=+(st.salary||0)-avans-kesinti-_uz;
   if(net<=0){skipped++;netSkip.push(st.name+': mahsup sonrası net '+fmt0(net)+' — kalan '+fmt0(Math.abs(net))+' sonraki döneme DEVRETMEDİ, elle kontrol edin');return;}
   const mahsup=(avans>0||kesinti>0||_uz>0)?' — mahsup: '+[avans>0?'avans '+fmt0(avans):'',kesinti>0?'kesinti '+fmt0(kesinti):'',_uz>0?_ug+' gün ücretsiz izin '+fmt0(_uz):''].filter(Boolean).join(', '):'';
   const stid=nid();
   S.staffTxns.push(stampCreate({id:stid,co:CO,staffId:st.id,type:'maas',amount:net,date:o.payDate,period:o.period,accId:o.accId,desc:'Toplu maaş dönemi'+mahsup}));
   S.txns.push(stampCreate({id:nid(),co:CO,type:'gider',date:o.payDate,amount:net,cat:'Personel',accId:o.accId,staffTxnId:stid,desc:'Maaş: '+st.name+' ('+o.period+')'+mahsup}));
   done++;total+=net;
  });
  if(!done){toast('İşlenecek maaş yok — '+skipped+' personel atlandı (dönem maaşı zaten ödenmiş veya mahsup sonrası net ≤ 0)');return;}
  try{logAudit('Toplu maaş dönemi çalıştırıldı',o.period+' · '+done+' personel · '+fmt0(total));}catch(e){}
  save();
  toast('💰 '+mTR(o.period)+' maaş dönemi tamamlandı: '+done+' personel işlendi, '+skipped+' atlandı · toplam '+fmt0(total)+(netSkip.length?' · ⚠ '+netSkip.join(' | '):''));
  staffTab='odeme';go('staff');
 });
}
function leaveForm(staffId){
 const stf=byCo(S.staff,CO).filter(s=>s.active!=='0');
 if(!stf.length)return toast('Önce personel ekleyin');
 const st=staffId?S.staff.find(x=>x.id===staffId):null;
 const flds=[];
 if(!st)flds.push({name:'staffId',label:'Personel',type:'select',opts:stf.map(s=>[s.id,s.name]),req:1});
 flds.push(
  {name:'type',label:'Tür',type:'select',opts:[['yillik','Yıllık izin'],['ucretsiz','Ücretsiz izin'],['rapor','Sağlık raporu'],['mazeret','Mazeret izni']],req:1},
  {row:[{name:'start',label:'Başlangıç',type:'date',def:todayISO(),req:1},{name:'end',label:'Bitiş',type:'date',def:todayISO(),req:1}]},
  {name:'note',label:'Not'});
 openForm('İzin / Rapor'+(st?' — '+st.name:''),flds,o=>{
  pushRec(S.leaves,{id:nid(),co:CO,staffId:staffId||o.staffId,...o});
  save();toast('İzin kaydedildi');staffTab='izin';go('staff');
 });
}
function staffReactivate(id){
 const s=S.staff.find(x=>x.id===id);if(!s)return;
 s.active='1';logAudit('Personel yeniden aktif edildi',s.name);save();toast(s.name+' yeniden aktif edildi');go('staff');
}
function kidemStr(sd){ // v14-D: startDate hiçbir yerde okunmuyordu
 if(!sd)return '';
 var d=Math.max(0,-daysDiff(sd)); if(!d)return 'bugün başladı';
 var y=Math.floor(d/365), m=Math.floor((d%365)/30);
 return (y?y+' yıl ':'')+(m?m+' ay ':'')+((!y&&!m)?d+' gün ':'')+'kıdem';
}
function staffHist(id){
 const st=S.staff.find(x=>x.id===id);if(!st)return;
 const pays=S.staffTxns.filter(t=>t.staffId===id&&!t.deletedAt).sort((a,b)=>a.date<b.date?1:-1);
 const lvs=S.leaves.filter(l=>l.staffId===id&&!l.deletedAt).sort((a,b)=>a.start<b.start?1:-1);
 const TT={maas:'Maaş',avans:'Avans',prim:'Prim',kesinti:'Kesinti'};
 const LT={yillik:'Yıllık izin',ucretsiz:'Ücretsiz izin',rapor:'Sağlık raporu',mazeret:'Mazeret'};
 var _shx=document.getElementById('staffHistBox'); if(!_shx){go('staff');_shx=document.getElementById('staffHistBox');} if(!_shx)return; // v14: kutu yoksa önce personel ekranına dön
 _shx.innerHTML=
 `${(st.startDate||st.iban||st.note)?`<div class="card"><h2>Personel Bilgileri</h2><p style="font-size:13px">${st.startDate?'📅 İşe giriş: '+dTR(st.startDate)+' <span class="tiny">('+kidemStr(st.startDate)+')</span>':''}${st.iban?'<br>🏦 IBAN: '+esc(st.iban):''}${st.phone?'<br>☎ '+esc(st.phone):''}</p>${st.note?`<p style="font-size:13px;white-space:pre-wrap;color:var(--ink2)">${esc(st.note)}</p>`:''}</div>`:''}
  <div class="card"><h2>${esc(st.name)} — Ödeme Geçmişi</h2>
  ${pays.length?'<table><thead><tr><th>Tarih</th><th>Tür</th><th class="hidem">Dönem</th><th class="num">Tutar</th><th></th></tr></thead><tbody>'+
   pays.map(t=>`<tr><td>${dTR(t.date)}</td><td>${TT[t.type]||t.type} <span class="tiny">${esc(t.desc||'')}</span></td><td class="hidem">${t.period?mTR(t.period):''}</td><td class="num">${fmt(t.amount)}</td>
   <td class="rowact"><button data-act="del" data-arg="staffT~${t.id}">🗑</button></td></tr>`).join('')+'</tbody></table>':'<div class="empty">Ödeme kaydı yok.</div>'}
  <h2 style="margin-top:16px">İzinler & Raporlar</h2>
  ${lvs.length?'<table><tbody>'+lvs.map(l=>`<tr><td>${dTR(l.start)} → ${dTR(l.end)}</td><td>${LT[l.type]||l.type}</td><td class="tiny">${esc(l.note||'')}</td>
   <td class="rowact"><button data-act="del" data-arg="leave~${l.id}">🗑</button></td></tr>`).join('')+'</tbody></table>':'<div class="empty">İzin kaydı yok.</div>'}
 </div>`;
 try{document.getElementById('staffHistBox').scrollIntoView({behavior:'smooth'});}catch(e){}
}

/* ---------- SABİT & RESMİ ÖDEMELER ---------- */
const FTYPE={kira:'Kira',vergi:'Vergi',sgk:'SGK',fatura:'Fatura'};
const FCOL={kira:'#a24a68',vergi:'#5b7bb4',sgk:'#2a9d8f',fatura:'#e07a3f'};
var fixedTab='ay';
function setFixedTab(v){fixedTab=v;rFixed();}
function rFixed(){
 const list=byCo(S.fixed,CO);
 const per=monthISO();
 const hist=[];
 for(let i=11;i>=0;i--){const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-i);
  const p=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  const v=S.fixedLogs.filter(l=>l.co===CO&&l.period===p&&!l.deletedAt).reduce((s,l)=>s+ +l.amount,0);
  hist.push({label:AYLAR[+p.slice(5)-1].slice(0,3),bars:[{value:v,color:'var(--acc)',name:'Ödenen sabit gider'}]});}
 const byType={};for(const f of list)byType[f.type]=(byType[f.type]||0)+ +f.amount;
 const aylikYuk=list.reduce((s,f)=>s+ +f.amount,0);
 const odenen=S.fixedLogs.filter(l=>l.co===CO&&l.period===per&&!l.deletedAt).reduce((s,l)=>s+ +l.amount,0);
 const logs=S.fixedLogs.filter(l=>l.co===CO&&!l.deletedAt).sort((a,b)=>a.paidDate<b.paidDate?1:-1);

 document.getElementById('main').innerHTML= topbar('Sabit & Resmi Ödemeler',
  `<button class="btn" data-act="fixedForm">＋ Ödeme Tanımla</button>`)+
 `<div class="grid g3" style="margin-bottom:16px">
   <div class="kpi"><div class="l">Aylık Sabit Yük (tanımlı)</div><div class="v">${fmt0(aylikYuk)}</div></div>
   <div class="kpi p"><div class="l">${mTR(per)} Ödenen</div><div class="v">${fmt0(odenen)}</div></div>
   <div class="kpi n"><div class="l">Bu Ay Kalan</div><div class="v">${fmt0(Math.max(0,aylikYuk-odenen))}</div></div>
  </div>
  ${seg([['ay','Bu Ay Durumu',list.length],['gecmis','Ödeme Geçmişi',logs.length]],fixedTab,'setFixedTab')}`+
 (fixedTab==='gecmis'
 ? `<div class="card"><h2>Son 12 Ay Ödenen Sabit Giderler</h2>${hist.some(h=>h.bars[0].value>0)?chartVBars(hist,170):'<div class="empty">Henüz ödeme geçmişi yok</div>'}</div>
  <div class="card"><h2>Tüm Ödeme Kayıtları</h2>
  ${logs.length?'<table><thead><tr><th>Dönem</th><th>Ödeme</th><th>Tarih</th><th class="num">Tutar</th><th class="rowact"></th></tr></thead><tbody>'+
   logs.slice(0,80).map(l=>{const f=S.fixed.find(x=>x.id===l.fixedId)||{};
    return `<tr><td>${mTR(l.period)}</td><td><span class="chip g" style="background:${FCOL[f.type]||'#888'}22;color:${FCOL[f.type]||'#555'}">${FTYPE[f.type]||''}</span> ${esc(f.name||'?')}</td><td>${dTR(l.paidDate)}</td><td class="num">${fmt(l.amount)}</td>
    <td class="rowact"><button data-act="del" data-arg="fixedL~${l.id}">🗑</button></td></tr>`;}).join('')+'</tbody></table>'
   :'<div class="empty"><b>Ödeme geçmişi yok</b>Bu Ay sekmesinden "Öde" ile ilk kaydı oluşturun.</div>'}</div>`
 : `${list.length?`<div class="card"><h2>Tür Dağılımı (aylık tanımlı)</h2>${chartDonut(Object.entries(byType).map(([t,v])=>({label:FTYPE[t],value:v,color:FCOL[t]})),'AYLIK ₺')}</div>`:''}
  <div class="card"><h2>${mTR(per)} Ödeme Durumu</h2>
  ${list.length? '<table><thead><tr><th>Ödeme</th><th class="hidem">Gün</th><th class="num">Tutar</th><th>Durum</th><th class="rowact"></th></tr></thead><tbody>'+
   list.map(f=>{
    const log=S.fixedLogs.find(l=>l.fixedId===f.id&&l.period===per&&!l.deletedAt);
    const d=nextDue(+f.payDay);const df=daysDiff(d);
    const _fc=f.cariId?S.cari.find(x=>x.id===f.cariId&&!x.deletedAt):null; // v14-Y1: not ve cari bağı hiç görünmüyordu
    return `<tr><td><span class="chip g" style="background:${FCOL[f.type]}22;color:${FCOL[f.type]}">${FTYPE[f.type]}</span> <b>${esc(f.name)}</b>${_fc?` <span class="chip g" data-act="cariDetail" data-arg="${_fc.id}" style="cursor:pointer" title="Ödeme bu cariye işlenir">👥 ${esc(_fc.name)}</span>`:(f.cariId?' <span class="chip n" title="Tanımdaki cari silinmiş — ödeme cariye işlenmeyecek">⚠ cari bağı geçersiz</span>':'')}${f.note?`<div class="tiny">${esc(f.note)}</div>`:''}</td>
    <td class="hidem">Her ayın ${f.payDay}'i</td><td class="num">${fmt0(log?log.amount:f.amount)}</td>
    <td>${log?`<span class="chip p">Ödendi ✓ ${dTR(log.paidDate)}</span>`
      :`<span class="chip ${df<=0?'n':df<=5?'w':'g'}">${df<0?'Gecikti':'Bekliyor'} · ${dTR(d)}</span> <button class="btn sm" data-act="payFixed" data-arg="${f.id}">Öde</button>`}</td>
    <td class="rowact"><button title="Geçmiş" data-act="fixedHist" data-arg="${f.id}">📄</button><button data-act="fixedForm" data-arg="${f.id}">✎</button><button data-act="del" data-arg="fixed~${f.id}">🗑</button></td></tr>`;}).join('')+'</tbody></table>'
   :'<div class="empty"><b>Sabit ödeme tanımlı değil</b>Kira, vergi, SGK ve faturalarınızı (elektrik, su, doğalgaz, internet...) sınırsız tanımlayın; her ay tek tıkla "Ödendi" işaretleyin.</div>'}
 </div>`)+`<div id="fixedHistBox"></div>`;
}
function fixedForm(id){
 const init=id?S.fixed.find(f=>f.id===id):{type:'fatura'};
 openForm(id?'Ödeme Düzenle':'Yeni Sabit Ödeme',[
  {name:'type',label:'Tür',type:'select',opts:[['kira','Kira'],['vergi','Vergi'],['sgk','SGK'],['fatura','Fatura / Abonelik']],req:1},
  {name:'name',label:'Ad',req:1,ph:'Ör: Elektrik Faturası / Dükkan Kirası / KDV'},
  {row:[{name:'payDay',label:'Ödeme günü (ayın kaçı)',type:'number',req:1,def:1,step:'1',min:1,max:31},{name:'amount',label:'Ortalama tutar (₺) — opsiyonel',type:'number',ph:'Değişkense boş bırakın'}]},
  {name:'cariId',label:'İlgili cari (opsiyonel — ödemeler cari hesaba da işlenir)',type:'select',opts:cariOpts(CO)},
  {name:'note',label:'Not (abone no vb.)'}
 ],o=>{ if(id)Object.assign(init,o); else S.fixed.push({id:nid(),co:CO,...o}); save();toast('Tanım kaydedildi');go('fixed'); },init||{});
}
function payFixed(fid){
 const f=S.fixed.find(x=>x.id===fid);if(!f)return;
 if(!byCo(S.accounts,CO).length)return toast('Önce Banka & Kasa ekranından bir hesap ekleyin');
 openForm('Ödeme Yap — '+f.name,[
  {row:[{name:'amount',label:'Ödenen tutar (₺)',type:'number',req:1,def:f.amount},{name:'paidDate',label:'Ödeme tarihi',type:'date',def:todayISO(),req:1}]},
  {name:'method',label:'Ödeme yöntemi (kasa / banka / 💳 kredi kartı)',type:'select',opts:payMethodOpts(CO),req:1},
  {name:'period',label:'Dönem',type:'month',def:monthISO(),req:1}
 ],o=>{
  if(S.fixedLogs.some(function(l){return l.fixedId===fid&&l.period===o.period&&!l.deletedAt;})){ // v14-R7: maasDonemi'ndeki koruma buraya da
   toast('⚠ '+mTR(o.period)+' dönemi için bu tanıma ait ödeme kaydı zaten var — mükerrer kayıt engellendi. Farklı dönem seçin ya da eski kaydı silin.');return;
  }
  const cat= f.type==='kira'?'Kira': f.type==='fatura'?'Fatura & Abonelik':'Vergi & SGK';
  const isCard=String(o.method).indexOf('card:')===0; // C4: sabit ödeme kartla da yapılabilir
  var ctid='';
  if(f.cariId&&S.cari.find(x=>x.id===f.cariId&&!x.deletedAt)){ // C4: tanımdaki cariye ödeme işlenir (borcumuz kapanır)
   ctid=nid();
   S.cariTxns.push(stampCreate({id:ctid,co:CO,cariId:f.cariId,type:'borc',amount:+o.amount,date:o.paidDate,desc:'Sabit ödeme: '+f.name+' ('+mTR(o.period)+')'}));
  }
  var tx;
  if(isCard){
   const cardId=o.method.slice(5),cdid=nid();
   const cd={id:cdid,co:CO,cardId:cardId,type:'harcama',amount:+o.amount,date:o.paidDate,cat:cat,taksit:1,desc:FTYPE[f.type]+' ödemesi: '+f.name+' ('+mTR(o.period)+')'};
   if(ctid)cd.cariTxnId=ctid;
   S.cardTxns.push(stampCreate(cd));
   tx={id:nid(),co:CO,type:'gider',date:o.paidDate,amount:+o.amount,cat,accId:'',src:'card',cardTxnId:cdid,desc:FTYPE[f.type]+' ödemesi: '+f.name+' ('+mTR(o.period)+', kredi kartı)'};
  }else{
   tx={id:nid(),co:CO,type:'gider',date:o.paidDate,amount:+o.amount,cat,accId:o.method,desc:FTYPE[f.type]+' ödemesi: '+f.name+' ('+mTR(o.period)+')'};
   if(ctid)tx.cariTxnId=ctid;
  }
  pushRec(S.txns,tx);
  pushRec(S.fixedLogs,{id:nid(),co:CO,fixedId:fid,period:o.period,amount:+o.amount,paidDate:o.paidDate,txnId:tx.id});
  save();toast(f.name+' ödendi olarak işaretlendi'+(isCard?' — kredi kartına işlendi':'')+(ctid?' + cariye işlendi':''));go('fixed');
 });
}
function fixedHist(fid){
 const f=S.fixed.find(x=>x.id===fid);if(!f)return;
 const logs=S.fixedLogs.filter(l=>l.fixedId===fid&&!l.deletedAt).sort((a,b)=>a.period<b.period?1:-1);
 var _fhx=document.getElementById('fixedHistBox'); if(!_fhx){go('fixed');_fhx=document.getElementById('fixedHistBox');} if(!_fhx)return;
 _fhx.innerHTML=
 `<div class="card"><h2>Ödeme Geçmişi — ${esc(f.name)}</h2>
  ${logs.length?'<table><thead><tr><th>Dönem</th><th>Ödeme Tarihi</th><th class="num">Tutar</th><th></th></tr></thead><tbody>'+
   logs.map(l=>`<tr><td>${mTR(l.period)}</td><td>${dTR(l.paidDate)}</td><td class="num">${fmt(l.amount)}</td>
   <td class="rowact"><button data-act="del" data-arg="fixedL~${l.id}">🗑</button></td></tr>`).join('')+'</tbody></table>'
   :'<div class="empty">Ödeme geçmişi yok.</div>'}</div>`;
 try{document.getElementById('fixedHistBox').scrollIntoView({behavior:'smooth'});}catch(e){}
}

/* ---------- RAPORLAR (şirket) ---------- */
var repRange={from:monthISO()+'-01',to:todayISO()};
var repMode='nakit'; // v33: K/Z gorunum modu — 'nakit' (varsayilan) | 'tahakkuk'
function setRepMode(v){repMode=v==='tahakkuk'?'tahakkuk':'nakit';rRep();}
function accrualAdjust(co,from,to,s){ // sumRange sonucuna fatura isaretli cari hareketlerini ekler (tahakkuk esasi)
 const r={gelir:s.gelir,gider:s.gider,net:s.net,byCat:Object.assign({},s.byCat),byCatG:Object.assign({},s.byCatG)};
 for(const t of S.cariTxns){
  if(t.co!==co||!t.fatura||t.deletedAt)continue;
  if(t.date<from||t.date>to)continue;
  if(t.type==='borc'){r.gelir+=+t.amount;var _gc=t.cat||'Satış Geliri';r.byCatG[_gc]=(r.byCatG[_gc]||0)+ +t.amount;} // v14-R1: 'Fatura Geliri' hiçbir bütçe kaleminin seçemeyeceği bir addı — gerçek kategoriye akıyor
  else{r.gider+=+t.amount;var _fc=t.cat||'Diğer Gider';r.byCat[_fc]=(r.byCat[_fc]||0)+ +t.amount;} // v14-R1 // B3: alış faturası kategorisi bütçeye/K-Z'ye kendi kaleminde akar
 }
 for(const t of S.txns){ // C3: stok kullanım maliyeti (COGS) tahakkuk esasında gider sayılır
  if(t.co!==co||t.deletedAt||t.src!=='stok'||t.type!=='gider')continue;
  if(t.date<from||t.date>to)continue;
  r.gider+=+t.amount;var _sc=t.cat||'Hammadde & Malzeme';if(_sc==='Hammadde & Malzeme (kullanım)')_sc='Hammadde & Malzeme';r.byCat[_sc]=(r.byCat[_sc]||0)+ +t.amount; // v14-R1: bütçe kalemiyle eşleşebilsin
 }
 r.net=r.gelir-r.gider;
 return r;
}
function rangePreset(k){if(k==='gecenAy'){var _d=new Date(),_y=_d.getFullYear(),_m=_d.getMonth();var _f=new Date(_y,_m-1,1),_l=new Date(_y,_m,0),_p2=function(n){return String(n).padStart(2,'0');};return {from:_f.getFullYear()+'-'+_p2(_f.getMonth()+1)+'-01',to:_l.getFullYear()+'-'+_p2(_l.getMonth()+1)+'-'+_p2(_l.getDate())};}return k==='g30'?{from:addDays(todayISO(),-29),to:todayISO()}:k==='yil'?{from:new Date().getFullYear()+'-01-01',to:todayISO()}:{from:monthISO()+'-01',to:todayISO()};}
function repSetFrom(v){repRange.from=v;rRep();}
function repSetTo(v){repRange.to=v;rRep();}
function repPreset(k){repRange=rangePreset(k);rRep();}
function pnlCard(s,prevS,cats,catsG){
 const chg=pctChange(s.net,prevS.net);
 const gRows=catsG.length?catsG.map(x=>'<tr data-act="goTxCat" data-arg="gelir~'+esc(x[0])+'" style="cursor:pointer" title="Bu kategorinin işlemlerini aç"><td>'+esc(x[0])+' <span class="tiny">↗</span></td><td class="num">'+fmt0(x[1])+'</td></tr>').join(''):'<tr><td colspan="2" class="tiny">Bu dönemde gelir kaydı yok</td></tr>';
 const xRows=cats.length?cats.map(x=>'<tr data-act="goTxCat" data-arg="gider~'+esc(x[0])+'" style="cursor:pointer" title="Bu kategorinin işlemlerini aç"><td>'+esc(x[0])+' <span class="tiny">↗</span></td><td class="num">'+fmt0(x[1])+'</td></tr>').join(''):'<tr><td colspan="2" class="tiny">Bu dönemde gider kaydı yok</td></tr>';
 const _thk=(typeof repMode!=='undefined'&&repMode==='tahakkuk');
 return '<div class="card"><h2>📑 Kâr / Zarar Tablosu <span class="tiny">'+(_thk?'Tahakkuk görünümü':'Nakit görünümü')+'</span></h2>'+
  (_thk?'<p class="tiny" style="margin-bottom:8px">Faturalar fatura tarihinde dahil — nakit görünümde yalnızca kasa/banka hareketleri.</p>':'')+
  '<div style="overflow-x:auto"><table><tbody>'+
   '<tr style="background:var(--acc-soft)"><td colspan="2"><b>GELİRLER</b></td></tr>'+gRows+
   '<tr><td><b>Toplam Gelir</b></td><td class="num" style="color:var(--pos);font-weight:700">'+fmt0(s.gelir)+'</td></tr>'+
   '<tr style="background:var(--acc-soft)"><td colspan="2"><b>GİDERLER</b></td></tr>'+xRows+
   '<tr><td><b>Toplam Gider</b></td><td class="num" style="color:var(--neg);font-weight:700">'+fmt0(s.gider)+'</td></tr>'+
  '</tbody></table></div>'+
  '<div class="grid g3" style="margin-top:14px">'+
   '<div class="kpi '+(s.net>=0?'p':'n')+'"><div class="l">Net Kâr/Zarar</div><div class="v">'+fmt0(s.net)+'</div></div>'+
   '<div class="kpi"><div class="l">Kâr Marjı</div><div class="v">%'+(s.gelir?(s.net/s.gelir*100).toFixed(1):'0')+'</div></div>'+
   '<div class="kpi '+(chg>=0?'p':'n')+'"><div class="l">Önceki Döneme Göre</div><div class="v">'+(chg>=0?'▲ +':'▼ ')+Math.abs(chg).toFixed(1)+'%</div><div class="s">Önceki net: '+fmt0(prevS.net)+'</div></div>'+
  '</div></div>';
}
function cashFlowCard(co,from,to){
 const accs=byCo(S.accounts,co);
 if(!accs.length) return '<div class="card"><h2>💵 Nakit Giriş-Çıkış Raporu</h2><div class="empty">Henüz kayıtlı hesap yok.</div></div>';
 const rows=accs.map(a=>({a,f:accRangeFlow(a,from,to)}));
 const tOpen=rows.reduce((s,r)=>s+r.f.opening,0), tIn=rows.reduce((s,r)=>s+r.f.into,0), tOut=rows.reduce((s,r)=>s+r.f.out,0), tClose=rows.reduce((s,r)=>s+r.f.closing,0);
 const trs=rows.map(r=>'<tr data-act="accDetail" data-arg="'+r.a.id+'" style="cursor:pointer" title="Hesap detay sayfasını aç"><td>'+(r.a.type==='kasa'?'💵 ':'🏦 ')+esc(r.a.name)+' <span class="tiny">↗</span></td>'+
   '<td class="num">'+fmt0(r.f.opening)+'</td>'+
   '<td class="num" style="color:var(--pos)">+'+fmt0(r.f.into)+'</td>'+
   '<td class="num" style="color:var(--neg)">-'+fmt0(r.f.out)+'</td>'+
   '<td class="num" style="font-weight:700">'+fmt0(r.f.closing)+'</td></tr>').join('');
 return '<div class="card"><h2>💵 Nakit Giriş-Çıkış Raporu <span class="tiny">hesap bazında</span></h2>'+
  '<div style="overflow-x:auto"><table><thead><tr><th>Hesap</th><th class="num">Dönem Başı</th><th class="num">Giriş</th><th class="num">Çıkış</th><th class="num">Dönem Sonu</th></tr></thead><tbody>'+trs+
  '<tr style="background:var(--acc-soft)"><td><b>TOPLAM</b></td><td class="num"><b>'+fmt0(tOpen)+'</b></td><td class="num" style="color:var(--pos)"><b>+'+fmt0(tIn)+'</b></td><td class="num" style="color:var(--neg)"><b>-'+fmt0(tOut)+'</b></td><td class="num"><b>'+fmt0(tClose)+'</b></td></tr>'+
  '</tbody></table></div></div>';
}
function kdvCard(co,from,to){
 const k=kdvSummary(co,from,to);
 const rateRows=Object.entries(k.byRate).sort((a,b)=>b[1]-a[1]);
 if(!k.tahsil&&!k.odenen)return '<div class="card"><h2>🧾 KDV Özeti</h2><div class="empty">Seçili dönemde KDV oranı girilmiş kayıt yok.</div></div>';
 return '<div class="card"><h2>🧾 KDV Özeti <span class="tiny">seçili dönem</span></h2>'+
  '<div class="grid g3">'+
   '<div class="kpi p"><div class="l">Tahsil Edilen (Satış)</div><div class="v">'+fmt0(k.tahsil)+'</div></div>'+
   '<div class="kpi n"><div class="l">Ödenen (Alış/Gider)</div><div class="v">'+fmt0(k.odenen)+'</div></div>'+
   '<div class="kpi '+(k.net>=0?'a':'n')+'"><div class="l">'+(k.net>=0?'Ödenecek KDV':'Devreden KDV')+'</div><div class="v">'+fmt0(Math.abs(k.net))+'</div></div>'+
  '</div>'+
  (rateRows.length?'<table style="margin-top:12px"><thead><tr><th>Oran / Yön</th><th class="num">Tutar</th></tr></thead><tbody>'+
   rateRows.map(([k2,v])=>'<tr><td>'+esc(k2)+'</td><td class="num">'+fmt0(v)+'</td></tr>').join('')+'</tbody></table>':'')+
  '<p class="tiny" style="margin-top:10px">Tutarların KDV dahil girildiği varsayılarak hesaplanır (işlem eklerken seçilen KDV % oranına göre). ⚠ KDV oranı seçilmemiş POS ve kart kayıtları bu özete girmez — POS tanımına ve kart harcama formuna KDV oranı ekleyin. Bu bir vergi danışmanlığı değildir — beyanname öncesi muhasebecinizle teyit edin.</p></div>';
}
function rRep(){
 const {from,to}=repRange;
 const s=sumRange(CO,from,to);
 const pp=prevPeriodOf(from,to);
 const prevS=sumRange(CO,pp.from,pp.to);
 const cats=Object.entries(s.byCat).sort((a,b)=>b[1]-a[1]);
 const catsG=Object.entries(s.byCatG).sort((a,b)=>b[1]-a[1]);
 // v33: tahakkuk modunda K/Z tablosuna faturali cari hareketleri de dahil edilir
 const sM=repMode==='tahakkuk'?accrualAdjust(CO,from,to,sumRange(CO,from,to,{skipCariLinked:true})):s;
 const prevM=repMode==='tahakkuk'?accrualAdjust(CO,pp.from,pp.to,sumRange(CO,pp.from,pp.to,{skipCariLinked:true})):prevS;
 const catsM=Object.entries(sM.byCat).sort((a,b)=>b[1]-a[1]);
 const catsGM=Object.entries(sM.byCatG).sort((a,b)=>b[1]-a[1]);
 const ms=monthSeries(CO,6);
 document.getElementById('main').innerHTML= topbar('Raporlar',
  `<button class="btn gh" data-act="excelDl" data-arg="co">📊 Excel</button><button class="btn gh" data-act="pdfPrint">🖨 PDF</button><button class="btn" data-act="aiSummary" data-arg="co">✦ AI ile Özetle</button><button class="btn gh" data-act="aiCFO">🧠 CFO Analizi</button>`)+
 `<div class="card"><div class="filters">
   <span class="mut" style="align-self:center">Dönem:</span>
   <input type="date" value="${from}" data-actv="repSetFrom">
   <input type="date" value="${to}" data-actv="repSetTo">
   <button class="btn sm gh" data-act="repPreset" data-arg="ay">Bu Ay</button>
   <button class="btn sm gh" data-act="repPreset" data-arg="gecenAy">Geçen Ay</button>
   <button class="btn sm gh" data-act="repPreset" data-arg="g30">Son 30 Gün</button>
   <button class="btn sm gh" data-act="repPreset" data-arg="yil">Bu Yıl</button>
  </div>
  <div class="grid g3">
   <div class="kpi p" data-act="goTxCat" data-arg="gelir~~${from}~${to}" style="cursor:pointer" title="Dönemin gelir işlemlerini aç"><div class="l">Toplam Gelir ↗</div><div class="v">${fmt0(sM.gelir)}</div><div class="s">${repMode==='tahakkuk'?'Tahakkuk (faturalı)':'Nakit esas'}</div></div>
   <div class="kpi n" data-act="goTxCat" data-arg="gider~~${from}~${to}" style="cursor:pointer" title="Dönemin gider işlemlerini aç"><div class="l">Toplam Gider ↗</div><div class="v">${fmt0(sM.gider)}</div><div class="s">${repMode==='tahakkuk'?'Tahakkuk (faturalı)':'Nakit esas'}</div></div>
   <div class="kpi a"><div class="l">Net Sonuç</div><div class="v">${fmt0(sM.net)}</div><div class="s">Marj: %${sM.gelir?(sM.net/sM.gelir*100).toFixed(1):0} · ${repMode==='tahakkuk'?'Tahakkuk':'Nakit'}</div></div>
  </div></div>
  ${seg([['nakit','💵 Nakit'],['tahakkuk','🧾 Tahakkuk (faturalı)']],repMode,'setRepMode')}
  ${pnlCard(sM,prevM,catsM,catsGM)}
  ${kdvCard(CO,from,to)}
  <div class="grid g2">
   <div class="card"><h2>Gider Dağılımı <span class="tiny">${repMode==='tahakkuk'?'Tahakkuk (faturalı)':'Nakit esas'}</span></h2>
    ${catsM.length?chartDonut(catsM.map(([c,v],i)=>({label:c,value:v,color:PAL[i%PAL.length],act:'goTxCat',arg:'gider~'+c+'~'+from+'~'+to})),'GİDER ₺'):'<div class="empty">Seçili dönemde gider yok.</div>'}</div>
   <div class="card"><h2>Gelir Kaynakları <span class="tiny">${repMode==='tahakkuk'?'Tahakkuk (faturalı)':'Nakit esas'}</span></h2>
    ${catsGM.length?chartDonut(catsGM.map(([c,v],i)=>({label:c,value:v,color:PAL[(i+2)%PAL.length],act:'goTxCat',arg:'gelir~'+c+'~'+from+'~'+to})),'GELİR ₺'):'<div class="empty">Seçili dönemde gelir yok.</div>'}</div>
  </div>
  <div class="card"><h2>Son 6 Ay Gelir / Gider Trendi</h2>
   ${chartArea([{name:'Gelir',color:'var(--pos)',values:ms.map(m=>m.gelir)},{name:'Gider',color:'var(--neg)',values:ms.map(m=>m.gider)}],ms.map(m=>m.label),220)}
  </div>
  ${cashFlowCard(CO,from,to)}
  ${fcCard(30)}
  <div id="aiBox"></div>`;
}

/* ---------- GRUP KONSOLİDE RAPORU ---------- */
var grupRange={from:monthISO()+'-01',to:todayISO()};
function grupSetFrom(v){grupRange.from=v;rGrup();}
function grupSetTo(v){grupRange.to=v;rGrup();}
function grupPreset(k){grupRange=rangePreset(k);rGrup();}
function rGrup(){
 const {from,to}=grupRange;
 const rows=COMPANIES.map(c=>{
  const s=sumRange(c.id,from,to);
  let bal=0;for(const a of byCo(S.accounts,c.id))bal+=accBalance(a);
  let alacak=0,borc=0;for(const cr of byCo(S.cari,c.id)){const b=cariBalance(cr);if(b>0)alacak+=b;else borc+=-b;}
  let kartBorc=0;for(const k of byCo(S.cards,c.id))kartBorc+=Math.max(0,cardDebt(k));
  const maasYuku=byCo(S.staff,c.id).filter(x=>x.active!=='0').reduce((s2,x)=>s2+ +(x.salary||0),0);
  return {c,s,bal,alacak,borc,kartBorc,maasYuku};
 });
 const T=k=>rows.reduce((s,r)=>s+(k==='gelir'||k==='gider'||k==='net'?r.s[k]:r[k]),0);
 // grup 6 aylık trend
 const gms=[];
 for(let i=5;i>=0;i--){const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-i);
  const p=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');gms.push({p,label:AYLAR[+p.slice(5)-1].slice(0,3)});}
 const coSeries=COMPANIES.map(c=>{const ms=monthSeries(c.id,6);return {name:c.name.replace('LOLE ',''),color:c.color,values:ms.map(m=>m.gelir)};});

 document.getElementById('main').innerHTML= topbar('LOLE Grup — Konsolide Rapor',
  `<button class="btn gh" data-act="excelDl" data-arg="grup">📊 Excel</button><button class="btn gh" data-act="pdfPrint">🖨 PDF</button><button class="btn" data-act="aiSummary" data-arg="grup">✦ AI ile Özetle</button>`)+
 `<div class="card"><div class="filters">
   <span class="mut" style="align-self:center">Dönem:</span>
   <input type="date" value="${from}" data-actv="grupSetFrom">
   <input type="date" value="${to}" data-actv="grupSetTo">
   <button class="btn sm gh" data-act="grupPreset" data-arg="ay">Bu Ay</button>
   <button class="btn sm gh" data-act="grupPreset" data-arg="g30">Son 30 Gün</button>
   <button class="btn sm gh" data-act="grupPreset" data-arg="yil">Bu Yıl</button>
  </div>
  <div class="grid g4">
   <div class="kpi p"><div class="l">Grup Toplam Gelir</div><div class="v">${fmt0(T('gelir'))}</div></div>
   <div class="kpi n"><div class="l">Grup Toplam Gider</div><div class="v">${fmt0(T('gider'))}</div></div>
   <div class="kpi a"><div class="l">Grup Net</div><div class="v">${fmt0(T('net'))}</div></div>
   <div class="kpi"><div class="l">Grup Nakit + Banka</div><div class="v">${fmt0(T('bal'))}</div></div>
  </div></div>
  <div class="grid g2">
   <div class="card"><h2>Gelir Payları</h2>${chartDonut(rows.map(r=>({label:r.c.name,value:r.s.gelir,color:r.c.color,act:'enterCo',arg:r.c.id})),'GELİR ₺')}</div>
   <div class="card"><h2>Gelir / Gider Karşılaştırması</h2>
    ${chartVBars(rows.map(r=>({label:r.c.name.replace('LOLE ',''),bars:[{value:r.s.gelir,color:r.c.color,name:'Gelir'},{value:r.s.gider,color:'#c3cad6',name:'Gider'}]})),190)}
    <div class="legend"><span><i style="background:var(--acc)"></i>Gelir (şirket rengi)</span><span><i style="background:#c3cad6"></i>Gider</span></div>
   </div>
  </div>
  <div class="card"><h2>Şirketlerin Aylık Ciro Trendi (6 ay)</h2>
   ${chartArea(coSeries,gms.map(m=>m.label),230)}
  </div>
  <div class="card"><h2>Şirket Karşılaştırma Tablosu</h2>
   <div style="overflow-x:auto"><table><thead><tr><th>Şirket</th><th class="num">Gelir</th><th class="num">Gider</th><th class="num">Net</th><th class="num">Nakit+Banka</th><th class="num">Cari Alacak</th><th class="num">Cari Borç</th><th class="num">Kart Borcu</th><th class="num">Personel Gideri (dönem)</th><th class="num">Personel/Ciro %</th><th class="num">Sözleşme Maaş Toplamı (statik)</th></tr></thead><tbody>
   ${rows.map(r=>`<tr data-act="enterCo" data-arg="${r.c.id}" style="cursor:pointer" title="${esc(r.c.name)} şirketine gir"><td><b style="color:${r.c.color}">${r.c.name}</b></td>
    <td class="num" style="color:var(--pos)">${fmt0(r.s.gelir)}</td>
    <td class="num" style="color:var(--neg)">${fmt0(r.s.gider)}</td>
    <td class="num" style="font-weight:700">${fmt0(r.s.net)}</td>
    <td class="num" data-act="coJumpTo" data-arg="${r.c.id}~acc" title="Banka & Kasa ekranına git">${fmt0(r.bal)}</td><td class="num" data-act="coJumpTo" data-arg="${r.c.id}~cari" title="Cari Hesaplar ekranına git">${fmt0(r.alacak)}</td><td class="num" data-act="coJumpTo" data-arg="${r.c.id}~cari" title="Cari Hesaplar ekranına git">${fmt0(r.borc)}</td>
    <td class="num" data-act="coJumpTo" data-arg="${r.c.id}~card" title="Kredi Kartları ekranına git">${fmt0(r.kartBorc)}</td><td class="num">${fmt0(r.s.byCat['Personel']||0)}</td><td class="num" style="color:${(function(){var _r=r.s.gelir?(r.s.byCat['Personel']||0)/r.s.gelir*100:0;return _r>35?'var(--neg)':_r<25?'var(--ink2)':'var(--pos)';})()}">${r.s.gelir?((r.s.byCat['Personel']||0)/r.s.gelir*100).toFixed(1)+'%':'—'}</td><td class="num">${fmt0(r.maasYuku)}</td></tr>`).join('')}
   <tr style="background:var(--acc-soft)"><td><b>GRUP TOPLAMI</b></td><td class="num"><b>${fmt0(T('gelir'))}</b></td><td class="num"><b>${fmt0(T('gider'))}</b></td><td class="num"><b>${fmt0(T('net'))}</b></td><td class="num"><b>${fmt0(T('bal'))}</b></td><td class="num"><b>${fmt0(T('alacak'))}</b></td><td class="num"><b>${fmt0(T('borc'))}</b></td><td class="num"><b>${fmt0(T('kartBorc'))}</b></td><td class="num"><b>${fmt0(rows.reduce((s2,r)=>s2+(r.s.byCat['Personel']||0),0))}</b></td><td class="num"><b>${(function(){var tg=T('gelir'),tp=rows.reduce((s2,r)=>s2+(r.s.byCat['Personel']||0),0);return tg?(tp/tg*100).toFixed(1)+'%':'—';})()}</b></td><td class="num"><b>${fmt0(T('maasYuku'))}</b></td></tr>
   </tbody></table></div></div>
  <div id="aiBox"></div>`;
}

/* ---------- AI RAPOR AJANI ---------- */
function aiDataPack(mode){
 if(mode==='full'){ // C5: meclis icin zengin paket — packCo + yaslandirma + gecikmis cekler + 30g projeksiyon
  var base=packCo(CO);
  try{
   var aging={gecikme_1_30:0,gecikme_31_60:0,gecikme_61_90:0,gecikme_90_ustu:0};
   S.cariTxns.forEach(function(t2){ if(t2.co!==CO||t2.deletedAt||t2.kapandi||t2.type!=='borc'||!t2.vade)return; var g=-daysDiff(t2.vade); if(g<=0)return; if(g<=30)aging.gecikme_1_30+=+t2.amount; else if(g<=60)aging.gecikme_31_60+=+t2.amount; else if(g<=90)aging.gecikme_61_90+=+t2.amount; else aging.gecikme_90_ustu+=+t2.amount; });
   base.cariYaslandirmaGecikmis=aging;
   base.vadesiGecmisCekler=byCo(S.cheques,CO).filter(function(c2){return (c2.durum==='portfoy'||c2.durum==='tahsilde')&&daysDiff(c2.vade)<0;}) /* v14-H2 */.map(function(c2){return {tip:c2.tip,kisi:c2.kisi,tutar:+c2.tutar,vade:c2.vade};});
   var fc=cashForecast(CO,30);
   base.nakitProjeksiyon30gun={baslangic:Math.round(fc.bal0),son:Math.round(fc.end),enDusuk:{tutar:Math.round(fc.minB),tarih:fc.minD},toplamGiris:Math.round(fc.ti),toplamCikis:Math.round(fc.to)};
  }catch(e){}
  return base;
 }
 const rng= mode==='grup'?grupRange:repRange;
 if(mode==='grup'){
  return {mode:'grup',donem:rng,sirketler:COMPANIES.map(c=>{
   const s=sumRange(c.id,rng.from,rng.to);let bal=0;for(const a of byCo(S.accounts,c.id))bal+=accBalance(a);
   return {ad:c.name,gelir:s.gelir,gider:s.gider,net:s.net,nakit:bal,giderKirilimi:s.byCat};
  })};
 }
 const _tah=(typeof repMode!=='undefined'&&repMode==='tahakkuk'); // v14-R2: etiketle veri uyuşmuyordu
 const s=_tah?accrualAdjust(CO,rng.from,rng.to,sumRange(CO,rng.from,rng.to,{skipCariLinked:true})):sumRange(CO,rng.from,rng.to);let bal=0;for(const a of byCo(S.accounts,CO))bal+=accBalance(a);
 return {mode:'sirket',sirket:coName(CO),donem:rng,gorunum:(typeof repMode!=='undefined'&&repMode==='tahakkuk')?'tahakkuk (faturalı cari hareketler dahil)':'nakit esas',gelir:s.gelir,gider:s.gider,net:s.net,nakit:bal,giderKirilimi:s.byCat,hatirlatmalar:reminders(CO).slice(0,8).map(r=>r.t+' ('+dTR(r.d)+')')};
}
async function aiSummary(mode){
 const box=document.getElementById('aiBox');
 box.innerHTML='<div class="card"><h2>✦ AI Rapor Ajanı</h2><div class="aiBox">Analiz hazırlanıyor…</div></div>';
 const data=aiDataPack(mode);
 let out='';
 try{
  const r=await fetch('/api/ai',{method:'POST',headers:loleAuthHeaders(),
   body:JSON.stringify({max_tokens:1000,messages:[{role:'user',
    content:'Sen bir Türk KOBİ finans danışmanısın. Aşağıdaki muhasebe verilerini kısa ve net Türkçe ile yorumla: 1) Genel durum (2-3 cümle) 2) Dikkat çeken 3 bulgu 3) 2 somut öneri. Rakamları ₺ formatında yaz. Başlık kullanma, madde işareti kullanabilirsin. Veri: '+JSON.stringify(data)}]})});
  const j=await r.json();
  if(j&&j.content) out=j.content.map(c=>c.text||'').join('\n').trim();
 }catch(e){}
 if(!out) out=localAiSummary(data);
 box.innerHTML='<div class="card"><h2>✦ AI Rapor Ajanı <span class="tiny">Yapay zeka tarafından oluşturulmuştur, kontrol ediniz.</span></h2><div class="aiBox">'+esc(out)+'</div></div>';
 try{box.scrollIntoView({behavior:'smooth'});}catch(e){}
}
function localAiSummary(d){
 let L=[];
 if(d.mode==='grup'){
  const t=d.sirketler.reduce((a,s)=>({g:a.g+s.gelir,x:a.x+s.gider,n:a.n+s.net}),{g:0,x:0,n:0});
  const best=d.sirketler.slice().sort((a,b)=>b.net-a.net)[0];
  const worst=d.sirketler.slice().sort((a,b)=>a.net-b.net)[0];
  L.push(`GRUP ÖZETİ (${dTR(d.donem.from)} – ${dTR(d.donem.to)})`);
  L.push(`Toplam gelir ${fmt(t.g)}, toplam gider ${fmt(t.x)}, net sonuç ${fmt(t.n)}.`);
  if(best)L.push(`• En iyi performans: ${best.ad} (net ${fmt(best.net)}).`);
  if(worst&&worst!==best)L.push(`• En zayıf performans: ${worst.ad} (net ${fmt(worst.net)})${worst.net<0?' — zarar var, gider kalemleri incelenmeli.':'.'}`);
  const dusukNakit=d.sirketler.filter(s=>s.nakit<0);
  if(dusukNakit.length)L.push(`• Uyarı: ${dusukNakit.map(s=>s.ad).join(', ')} nakit pozisyonu negatif.`);
  L.push(`Öneri: Kârlılığı düşük şirketlerde en büyük 3 gider kalemini gözden geçirin; grup içi nakit fazlasını ihtiyaç duyan şirkete virmanla yönlendirin.`);
 }else{
  L.push(`${d.sirket} ÖZETİ (${dTR(d.donem.from)} – ${dTR(d.donem.to)})`);
  L.push(`Gelir ${fmt(d.gelir)}, gider ${fmt(d.gider)}, net ${fmt(d.net)}. Nakit+banka: ${fmt(d.nakit)}.`);
  const cats=Object.entries(d.giderKirilimi).sort((a,b)=>b[1]-a[1]);
  if(cats.length){L.push(`• En büyük gider kalemi: ${cats[0][0]} (${fmt(cats[0][1])}, giderin %${(cats[0][1]/(d.gider||1)*100).toFixed(0)}'i).`);}
  if(d.net<0)L.push(`• Dikkat: Dönem zararla kapandı. Gider/gelir dengesi bozulmuş görünüyor.`);
  else if(d.gider>0)L.push(`• Kâr marjı: %${(d.net/(d.gelir||1)*100).toFixed(1)}.`);
  if(d.hatirlatmalar&&d.hatirlatmalar.length)L.push(`• Yaklaşan ödemeler: ${d.hatirlatmalar.slice(0,3).join('; ')}.`);
  L.push(`Öneri: En büyük iki gider kaleminde tedarikçi/fiyat alternatiflerini karşılaştırın ve vadesi yaklaşan ödemeler için nakit planı yapın.`);
 }
 return L.join('\n');
}

/* ---------- GÖREV & DUYURU (kanban pano) ---------- */
var taskTab='pano';var taskWho='';
function setTaskWho(w){taskWho=w;rTask();}
var taskDue=''; // D2: teslim filtresi ('' | 'gec' | 'bugun')
function setTaskDue(v){taskDue=(taskDue===v)?'':v;taskTab='pano';go('task');}
function goTaskDone(){taskTab='pano';go('task');setTimeout(function(){var el=document.getElementById('kb_tamam');if(el)try{el.scrollIntoView({behavior:'smooth'});}catch(e){}},120);}
function setTaskTab(v){taskTab=v;rTask();}
const KANBAN=[['acik','Bekliyor','var(--warn)'],['devam','Devam Ediyor','#3a6fb0'],['tamam','Tamamlandı','var(--pos)']];
function rTask(){
 const all=byCo(S.tasks,CO);
 const notes=byCo(S.notes,CO).sort((a,b)=>a.date<b.date?1:-1);
 const acik=all.filter(t=>t.status!=='tamam');
 const geciken=acik.filter(t=>daysDiff(t.due)<0);
 const bugun=acik.filter(t=>daysDiff(t.due)===0);
 const whoSet=[...new Set(all.map(t=>t.who).filter(Boolean))];
 let tasks= taskWho? all.filter(t=>t.who===taskWho) : all;
 if(taskDue==='gec')tasks=tasks.filter(t=>t.status!=='tamam'&&daysDiff(t.due)<0); // D2: KPI filtreleri
 else if(taskDue==='bugun')tasks=tasks.filter(t=>t.status!=='tamam'&&daysDiff(t.due)===0);

 document.getElementById('main').innerHTML= topbar('Görev & Duyuru',
  taskTab==='pano'?`<button class="btn" data-act="addTaskForm">＋ Görev Ata</button>`:`<button class="btn" data-act="noteForm">＋ Duyuru</button>`)+
 `<div class="grid g4" style="margin-bottom:16px">
   <div class="kpi" data-act="setTaskDue" data-arg="" style="cursor:pointer" title="Filtreyi kaldır, tüm görevleri göster"><div class="l">Açık Görev</div><div class="v">${acik.length}</div></div>
   <div class="kpi n" data-act="setTaskDue" data-arg="gec" style="cursor:pointer${taskDue==='gec'?';outline:2px solid var(--acc)':''}" title="Yalnız geciken görevleri göster"><div class="l">Geciken ↗${taskDue==='gec'?' ✓':''}</div><div class="v">${geciken.length}</div></div>
   <div class="kpi ${bugun.length?'a':''}" data-act="setTaskDue" data-arg="bugun" style="cursor:pointer${taskDue==='bugun'?';outline:2px solid var(--acc)':''}" title="Yalnız bugün teslim görevleri göster"><div class="l">Bugün Teslim ↗${taskDue==='bugun'?' ✓':''}</div><div class="v">${bugun.length}</div></div>
   <div class="kpi p" data-act="goTaskDone" style="cursor:pointer" title="Tamamlanan kolonuna git"><div class="l">Tamamlanan ↗</div><div class="v">${all.length-acik.length}</div></div>
  </div>
  <div class="tabs">
   <button class="${taskTab==='pano'?'on':''}" data-act="setTaskTab" data-arg="pano">📋 Görev Panosu</button>
   <button class="${taskTab==='duyuru'?'on':''}" data-act="setTaskTab" data-arg="duyuru">📢 Duyurular<span class="ct" style="font-size:10px;opacity:.6"> ${notes.length}</span></button>
  </div>`+
 (taskTab==='pano'
 ? `${taskDue?`<div style="margin-bottom:10px"><span class="chip w">⏳ Filtre: ${taskDue==='gec'?'Geciken görevler':'Bugün teslim'}</span> <button class="btn sm gh" data-act="setTaskDue" data-arg="${taskDue}">✕ Filtreyi kaldır</button></div>`:''}${whoSet.length?`<div class="whoChips"><button class="${taskWho===''?'on':''}" data-act="setTaskWho" data-arg="">Herkes</button>${whoSet.map(w=>`<button class="${taskWho===w?'on':''}" data-act="setTaskWho" data-arg="${esc(w)}">${esc(w)}</button>`).join('')}</div>`:''}
  <div class="kb">${KANBAN.map(([st,lbl,col])=>{
   const items=tasks.filter(t=>(t.status||'acik')===st).sort((a,b)=>a.due<b.due?-1:1);
   return `<div class="kbCol" id="kb_${st}"><h3>${lbl}<span class="ct">${items.length}</span></h3>
    ${items.map(t=>{
     const df=daysDiff(t.due);const done=st==='tamam';
     return `<div class="kbCard" style="--kc:${t.pri==='yuksek'?'var(--neg)':col}">
      <div class="kt" style="${done?'text-decoration:line-through;color:var(--ink3)':''}">${esc(t.title)}</div>
      ${t.desc?`<div class="tiny" style="margin-top:4px">${esc(t.desc)}</div>`:''}
      <div class="km">
       ${t.who?`<span class="avat sm" style="background:${hashColor(t.who)}">${esc(t.who.charAt(0))}</span><span class="tiny" style="font-weight:700">${esc(t.who)}</span>`:'<span class="tiny">Atanmadı</span>'}
       ${t.pri==='yuksek'?'<span class="chip n">Acil</span>':''}
       <span class="chip ${done?'g':df<0?'n':df===0?'w':'g'}" style="margin-left:auto">${done?'✓':'📅 '+dTR(t.due)+' · '+remLbl(df)}</span>
      </div>
      <div class="kbAct">
       ${st==='acik'?`<button class="btn sm gh" data-act="setTaskSt" data-arg="${t.id}~devam">▶ Başlat</button><button class="btn sm" data-act="setTaskSt" data-arg="${t.id}~tamam">✓ Bitir</button>`:''}
       ${st==='devam'?`<button class="btn sm gh" data-act="setTaskSt" data-arg="${t.id}~acik">⏸ Beklet</button><button class="btn sm" data-act="setTaskSt" data-arg="${t.id}~tamam">✓ Bitir</button>`:''}
       ${st==='tamam'?`<button class="btn sm gh" data-act="setTaskSt" data-arg="${t.id}~acik">↩ Geri Aç</button>`:''}
       <button class="btn sm gh" data-act="editTaskForm" data-arg="${t.id}" style="margin-left:auto">✎</button>
       <button class="btn sm dng" data-act="del" data-arg="task~${t.id}">🗑</button>
      </div></div>`;}).join('')||'<div class="empty" style="padding:16px">Görev yok</div>'}
   </div>`;}).join('')}</div>`
 : `<div class="card">${notes.length? notes.map(n=>`<div style="border-left:4px solid ${n.level==='acil'?'var(--neg)':'var(--acc)'};padding:11px 15px;background:#f6f8fc;border-radius:0 12px 12px 0;margin-bottom:10px">
     <b>${esc(n.title)}</b> ${n.level==='acil'?'<span class="chip n">ACİL</span>':''} <span class="tiny">· ${dTR(n.date)}</span>
     <div style="font-size:13.5px;margin-top:4px;white-space:pre-wrap">${esc(n.body)}</div>
     <button class="btn sm gh" style="margin-top:8px" data-act="del" data-arg="note~${n.id}">Sil</button></div>`).join('')
   :'<div class="empty"><b>Duyuru yok</b>Ekibinize duyuru yayınlayın.</div>'}</div>`);
}
function setTaskSt(id,st){const t=S.tasks.find(x=>x.id===id);if(t){t.status=st;save();toast(st==='tamam'?'Görev tamamlandı ✓':st==='devam'?'Görev başlatıldı':'Görev beklemeye alındı');rTask();}}
function tgTask(id){const t=S.tasks.find(x=>x.id===id);if(t){t.status=t.status==='tamam'?'acik':'tamam';save();rTask();}}
function taskFields(init){
 const stf=byCo(S.staff,CO).filter(s=>s.active!=='0').map(s=>s.name);
 const whoFld= stf.length
  ? {name:'who',label:'Atanan personel',type:'select',opts:[['','— Atanmadı —']].concat(stf.map(n=>[n,n]))}
  : {name:'who',label:'Atanan kişi',ph:'Ad Soyad'};
 return [
  {name:'title',label:'Görev başlığı',req:1,ph:'Ör: Gün sonu kasa sayımı'},
  whoFld,
  {row:[{name:'due',label:'Teslim tarihi',type:'date',def:todayISO(),req:1},{name:'pri',label:'Öncelik',type:'select',opts:[['normal','Normal'],['yuksek','Acil']]}]},
  {name:'desc',label:'Açıklama',type:'textarea'}
 ];
}
function addTaskForm(){
 openForm('Görev Ata',taskFields(),o=>{ S.tasks.push({id:nid(),co:CO,status:'acik',...o}); save();toast('Görev atandı');taskTab='pano';go('task'); });
}
function editTaskForm(id){
 const t=S.tasks.find(x=>x.id===id);if(!t)return;
 openForm('Görevi Düzenle',taskFields(t),o=>{ Object.assign(t,o); save();toast('Görev güncellendi');rTask(); },t);
}
function noteForm(){
 openForm('Yeni Duyuru',[
  {name:'title',label:'Başlık',req:1},
  {name:'level',label:'Önem',type:'select',opts:[['normal','Normal'],['acil','Acil']]},
  {name:'body',label:'Duyuru metni',type:'textarea',req:1}
 ],o=>{ S.notes.push({id:nid(),co:CO,date:todayISO(),...o}); save();toast('Duyuru yayınlandı');taskTab='duyuru';go('task'); });
}

/* ---------- AYARLAR ---------- */
function rSet(){
 document.getElementById('main').innerHTML= topbar('Ayarlar','')+
 `<div class="grid g2">
  <div class="card"><h2>Veri Yedekleme Merkezi</h2>
   <p class="mut" style="margin-bottom:12px">Veriler bu yayının tüm yetkili kullanıcıları arasında çevrimiçi ve ortak olarak saklanır (cihazda tutulmaz). Ek güvence için yedeğinizi indirebilir veya kopyalayabilirsiniz.</p>
   <div style="display:flex;gap:8px;flex-wrap:wrap">
    <button class="btn" data-act="dlBackup">⬇ Yedek İndir</button>
    <button class="btn gh" data-act="copyBackup">📋 Panoya Kopyala</button>
    ${isSuper()?'<button class="btn gh" data-act="pickBackupFile">⬆ Dosyadan Yükle</button><button class="btn gh" data-act="pasteBackupForm">📥 Yapıştırarak Yükle</button>':''}
    <input type="file" id="upFile" accept=".json" style="display:none" data-actv="upBackupPick">
   </div>
   <div style="margin-top:12px;padding-top:12px;border-top:1px dashed var(--line,#e5e7eb)">
    <button class="btn gh" data-act="testStorage">🔌 Depolama Bağlantısını Test Et</button>
    <div id="storageTestResult" class="tiny" style="margin-top:8px;color:var(--ink3)"></div>
   </div>
   ${isSuper()?'<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn gh" data-act="openBackupList">🗄 Yedek Geçmişi</button><button class="btn gh" data-act="loadDemo">🎲 Örnek Veri Yükle</button></div>':'<p class="tiny" style="margin-top:10px">🔒 Geri yükleme ve örnek veri yükleme yalnızca süper yöneticiye açık — tüm verinin üzerine yazabildiği için.</p>'}
   <p class="tiny" style="margin-top:10px;color:var(--ink3)">🚫 "Tüm verileri sıfırla" özelliği güvenlik amacıyla tamamen kapatılmıştır — hiçbir kullanıcı (süper yönetici dahil) tüm veriyi tek seferde silemez.</p>
  </div>
  <div class="card"><h2>Rapor & Dışa Aktarım Merkezi</h2>
   <p class="mut" style="margin-bottom:12px">Excel raporu artık <b>canlı formüllerle</b> (SUMIFS) birbirine bağlı: Hesaplar/Cariler/Kartlar/Stok bakiyeleri kendi hareket sayfalarından, Özet ise tüm sayfalardan otomatik hesaplanır — Excel'de bir hücreyi değiştirirseniz bağlı toplamlar kendiliğinden güncellenir. ${CO==='grup'?'Grup dosyası karşılaştırma tablosu + 4 şirketin tamamını (şirket başına 18 sayfa) içerir.':'18 sayfa: Özet, Hesaplar, İşlemler, POS, Kartlar + Hareketleri, Cariler + Hareketleri, Personel + Ödemeleri, Sabit Ödemeler + Geçmişi, Çek-Senet, Stok + Hareketleri, Demirbaş, Bütçe, Görevler.'} PDF/yazdırma raporu da aynı derinlikte tüm hareketleri listeler.</p>
   <div style="display:flex;gap:8px;flex-wrap:wrap">
    <button class="btn" data-act="excelDl" data-arg="${CO==='grup'?'grup':'co'}">📊 Excel Raporu İndir (formüllü, .xls)</button>
    <button class="btn gh" data-act="pdfPrint">🖨 PDF Olarak Yazdır</button>
    <button class="btn gh" data-act="dlReportHTML">⬇ Rapor Dosyası İndir</button>
   </div>
  </div>
  <div class="card"><h2>Kategori Yönetimi</h2>
   <p class="mut">Gelir Kategorileri</p>
   <div style="margin:6px 0 12px">${S.cats.gelir.map((c,i)=>`<span class="chip g" style="margin:2px">${esc(c)} ${isSuper()?`<button data-act="delCatAsk" data-arg="gelir~${i}" style="color:var(--neg)">×</button>`:''}</span>`).join('')}
    ${isSuper()?'<button class="btn sm gh" data-act="addCat" data-arg="gelir">＋ Ekle</button>':''}</div>
   <p class="mut">Gider Kategorileri</p>
   <div style="margin:6px 0">${S.cats.gider.map((c,i)=>`<span class="chip g" style="margin:2px">${esc(c)} ${isSuper()?`<button data-act="delCatAsk" data-arg="gider~${i}" style="color:var(--neg)">×</button>`:''}</span>`).join('')}
    ${isSuper()?'<button class="btn sm gh" data-act="addCat" data-arg="gider">＋ Ekle</button>':''}
   ${!isSuper()?'<p class="tiny" style="margin-top:8px">🔒 Kategori düzenleme yalnızca süper yöneticiye açık.</p>':''}</div>
  </div>
 </div>
 ${usersCard()}
 ${trashCard()}
 ${auditLogCard()}
 ${modeCard()}
 ${storageUsageCard()}
 ${aiSettingsCard()}`;
 (async function(){ // B4: haftalik e-posta yedegi son durumu (weekly-backup route'u kv'ye yazar)
  try{
   if(!window.storage)return;
   var r=await withTimeout(window.storage.get('lole-weekly-backup-status',true),5000);
   var el=document.getElementById('wbStatus');
   if(!el)return;
   if(!r||!r.value){el.textContent='Haftalık e-posta yedeği: henüz hiç çalışmadı (Vercel cron + CRON_SECRET ayarlarını kontrol edin)';return;}
   var st=JSON.parse(r.value);
   el.textContent='Haftalık e-posta yedeği: '+(st.ok?('✓ '+dTR(st.date)+' → '+(st.sentTo||'')+' ('+fmtBytes(st.bytes||0)+')'):('⚠ '+dTR(st.date)+' başarısız — '+(st.error||'')));
  }catch(e){}
 })();
 document.getElementById('main').innerHTML+=`
 <div class="card"><h2>Sistem Bilgisi</h2>
  <p class="mut">LOLE Finans & Muhasebe v14 (otomatik ekip senkronu ~20 sn) · Tek dosyalık web uygulaması · ${COMPANIES.length} şirket + grup konsolide raporu<br>
  Depolama: 🌐 tamamen bulutta (cihazda otomatik hiçbir şey tutulmaz) · Son kayıt: ${S.meta.saved?new Date(S.meta.saved).toLocaleString('tr-TR'):'—'} · Kullanıcı sayısı: ${(S.users||[]).length} · Bu oturumdaki bulut yedeği: ${lastBackupInfo&&lastBackupInfo.ok?dTR(lastBackupInfo.date)+' ✓':'henüz alınmadı'}<br>
  <b>Bu oturum verisi nereden geldi:</b> ${loadSource} · Cari kayıt sayısı: ${(S.cari||[]).length}<br>
  <span id="wbStatus">Haftalık e-posta yedeği durumu okunuyor…</span><br>
  İşlem kaydı: ${S.txns.length} · Toplam kayıt: ${S.txns.length+S.cariTxns.length+S.cardTxns.length+S.posEntries.length+S.staffTxns.length}</p>
 </div>`;
}
function resetAsk(){ toast('Bu özellik güvenlik nedeniyle devre dışı bırakıldı — hiçbir kullanıcı tüm verileri sıfırlayamaz.'); } // v14: kasıtlı olarak devre dışı — kimse programı sıfırlayamasın
function addCat(t){
 if(!isSuper())return;
 openForm('Yeni '+(t==='gelir'?'Gelir':'Gider')+' Kategorisi',[{name:'name',label:'Kategori adı',req:1}],
  o=>{S.cats[t].push(o.name.trim());logAudit('Kategori eklendi',(t==='gelir'?'Gelir: ':'Gider: ')+o.name.trim());save();toast('Kategori eklendi');rSet();});
}
function delCatAsk(t,i){if(!isSuper())return;delCat(t,+i);}
function delCat(t,i){ if(!isSuper())return; var nm=S.cats[t][i]; uiConfirm('"'+nm+'" kategorisi silinsin mi? (Eski kayıtlar etkilenmez)',()=>{S.cats[t].splice(i,1);logAudit('Kategori silindi',(t==='gelir'?'Gelir: ':'Gider: ')+nm);save();rSet();},{danger:1,yes:'Evet, Sil'}); }
function dlBackup(){
 try{
  const blob=new Blob([JSON.stringify(S,null,1)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='LOLE-yedek-'+todayISO()+'.json';document.body.appendChild(a);a.click();a.remove();
  toast('Yedek indirildi');
 }catch(e){toast('İndirme engellendi — "Panoya Kopyala" seçeneğini kullanın');}
}
async function copyBackup(){
 const j=JSON.stringify(S);
 try{await navigator.clipboard.writeText(j);toast('Yedek panoya kopyalandı ('+Math.round(j.length/1024)+' KB)');}
 catch(e){
  openForm('Yedek Verisi (kopyalayın)',[{name:'j',label:'Aşağıdaki metni seçip kopyalayın',type:'textarea',def:j}],()=>{});
 }
}
function pasteBackupForm(){
 if(!isSuper())return;
 openForm('Yedek Yapıştır',[{name:'j',label:'Yedek JSON metnini buraya yapıştırın',type:'textarea',req:1}],o=>{
  try{const j=JSON.parse(o.j);if(!j.txns||!j.accounts)throw 0;
   uiConfirm('Yapıştırılan yedek yüklensin mi? '+restoreSummary(S,j)+' — Önce şu anki hâlin emniyet kopyası buluta alınır.',async function(){
    await preRestoreSnapshot();
    var _ol1=(S.auditLog||[]).slice(0,200);S=fixState(j);S.auditLog=(S.auditLog||[]).concat(_ol1).slice(0,400);logAudit('Yapıştırarak yedek yüklendi','');saveNow();toast('Yedek yüklendi');goSelect();
   },{danger:1,title:'Yedek Yükle',yes:'Evet, Yükle'});
  }
  catch(e){toast('Geçersiz yedek verisi');}
 });
}
function pickBackupFile(id){if(!isSuper())return;document.getElementById(id||'upFile').click();}
function upBackupPick(v,el){if(!isSuper())return;upBackup(el);}
function upBackup(inp){
 if(!isSuper())return;
 const f=inp.files[0];if(!f)return;
 const r=new FileReader();
 r.onload=()=>{try{const j=JSON.parse(r.result);if(!j.txns||!j.accounts)throw 0;
  uiConfirm('"'+(f.name||'dosya')+'" yedeği yüklensin mi? '+restoreSummary(S,j)+' — Önce şu anki hâlin emniyet kopyası buluta alınır.',async function(){
   await preRestoreSnapshot();
   var _ol2=(S.auditLog||[]).slice(0,200);S=fixState(j);S.auditLog=(S.auditLog||[]).concat(_ol2).slice(0,400);logAudit('Dosyadan yedek yüklendi',f.name||'');saveNow();toast('Yedek yüklendi');goSelect();
  },{danger:1,title:'Yedek Yükle',yes:'Evet, Yükle'});
 }catch(e){toast('Geçersiz yedek dosyası');}};
 r.readAsText(f);inp.value='';
}

/* ---------- ZENGİN ÖRNEK VERİ ---------- */
function loadDemo(){
 if(!isSuper())return;
 uiConfirm('Örnek veriler mevcut verilerin YERİNE yüklenecek (180 günlük satış, banka, POS, kart, cari, personel ve sabit ödeme kayıtları). Devam edilsin mi?',()=>{
  genDemo();demoV4Extras();logAudit('Örnek veri yüklendi (mevcut veri değiştirildi)','');saveNow();toast('Örnek veriler yüklendi — 4 şirket dolu');goSelect();
 },{title:'Örnek Veri',yes:'Evet, Yükle'});
}
function genDemo(){
 S=blankState();S.meta.demo=true;
 let seed=20260720;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const SC={rest:1.15,pati:0.72,fact:1.65,loleq:0.55};
 const TEDS=['Anadolu Gıda Tedarik','Marmara Et & Şarküteri','Ege Sebze Hali','Karadeniz Un & Şeker','Öz Ambalaj Sanayi'];
 const MUST=['Vadi Kurumsal Catering','Park AVM Cafe (bayi)'];
 const ADLAR=['Ahmet Yılmaz','Ayşe Demir','Mehmet Kaya','Zeynep Şahin','Mustafa Çelik','Elif Arslan'];
 const ROL={rest:['Şef','Sous Şef','Garson','Garson','Komi','Kasiyer'],pati:['Pasta Şefi','Fırıncı','Tezgahtar','Tezgahtar','Kasiyer','Kurye'],fact:['Üretim Müdürü','Üretim Ustası','Operatör','Operatör','Depocu','Şoför'],loleq:['Mağaza Müdürü','Satış Danışmanı','Satış Danışmanı','Kasiyer','Depocu','Vitrin Uzmanı']};
 const today=todayISO(),per=monthISO();
 const prevPeriod=n=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');};

 for(const c of COMPANIES){const k=SC[c.id];
  const kasa={id:nid(),co:c.id,type:'kasa',name:'Ana Kasa',opening:Math.round(18000*k)};
  const b1={id:nid(),co:c.id,type:'banka',name:'Ziraat Vadesiz',bankName:'Ziraat Bankası',iban:'TR33 0001 0002 3456 7890 '+c.id.toUpperCase(),opening:Math.round(160000*k)};
  const b2={id:nid(),co:c.id,type:'banka',name:'İş Bankası Ticari',bankName:'İş Bankası',iban:'TR64 0006 4000 0011 2345 '+c.id.toUpperCase(),opening:Math.round(85000*k)};
  S.accounts.push(kasa,b1,b2);
  const pos1={id:nid(),co:c.id,name:'Ziraat POS',accId:b1.id,comm:1.89,blokaj:1};
  const pos2={id:nid(),co:c.id,name:'İş Bankası POS',accId:b2.id,comm:2.15,blokaj:2};
  S.pos.push(pos1,pos2);

  // 180 gün satış & işletme giderleri
  for(let i=179;i>=0;i--){
   const d=addDays(today,-i);
   const dow=new Date(d+'T12:00').getDay();
   const boost=(dow===5||dow===6)?1.4:(dow===0?1.15:1);
   const trend=1+(179-i)/179*0.18; // hafif büyüme
   const ciro=Math.round(26000*k*boost*trend*(0.85+rnd()*0.35));
   const nakit=Math.round(ciro*0.34), kart=ciro-nakit;
   S.txns.push({id:nid(),co:c.id,type:'gelir',date:d,amount:nakit,cat:'Satış Geliri',accId:kasa.id,desc:'Gün sonu nakit satış'});
   const p=(i%2)?pos2:pos1;
   const comm=+(kart*p.comm/100).toFixed(2);
   if(i<=2){ // son günler blokajda beklesin
    S.posEntries.push({id:nid(),co:c.id,date:d,posId:p.id,gross:kart,comm,net:+(kart-comm).toFixed(2),settleDate:addDays(d,p.blokaj),status:'bekliyor'});
   }else{
    var _peid=nid();
    S.posEntries.push({id:_peid,co:c.id,date:d,posId:p.id,gross:kart,comm,net:+(kart-comm).toFixed(2),settleDate:addDays(d,p.blokaj),status:'gecti'});
    S.txns.push({id:nid(),co:c.id,type:'gelir',date:addDays(d,p.blokaj),amount:kart,cat:'Satış Geliri',accId:p.accId,posEId:_peid,desc:'POS satışı ('+p.name+')'});
    S.txns.push({id:nid(),co:c.id,type:'gider',date:addDays(d,p.blokaj),amount:comm,cat:'Banka & Komisyon',accId:p.accId,posEId:_peid,desc:'POS komisyonu'});
   }
   if(i%3===0)S.txns.push({id:nid(),co:c.id,type:'gider',date:d,amount:Math.round(ciro*0.95*0.34),cat:'Hammadde & Malzeme',accId:b1.id,desc:['Toptan gıda alımı','Sebze-meyve alımı','Et & şarküteri','Ambalaj malzemesi'][Math.floor(rnd()*4)]});
   if(dow===1)S.txns.push({id:nid(),co:c.id,type:'gider',date:d,amount:Math.round(2200*k*(0.7+rnd()*0.7)),cat:'Pazarlama',accId:b2.id,desc:'Sosyal medya reklamı'});
   if(rnd()<0.05)S.txns.push({id:nid(),co:c.id,type:'gider',date:d,amount:Math.round(2600*k*(0.5+rnd())),cat:'Bakım & Onarım',accId:kasa.id,desc:'Ekipman bakım-onarım'});
  }

  // kredi kartları
  const cardDefs=[['İş Bankası Maximum','İş Bankası',11],['Garanti Bonus','Garanti BBVA',24]];
  for(const[nm,bk,due]of cardDefs){
   const card={id:nid(),co:c.id,name:nm,bank:bk,last4:String(4000+Math.floor(rnd()*5999)),limit:Math.round(140000*k),cutDay:due-9,dueDay:due};
   S.cards.push(card);
   for(let j=0;j<5;j++){
    const d=addDays(today,-Math.floor(rnd()*45));
    const amt=Math.round(4500*k*(0.5+rnd()*1.6));
    const cat=['Hammadde & Malzeme','Bakım & Onarım','Diğer Gider'][Math.floor(rnd()*3)];
    var _cdid=nid();
    S.cardTxns.push({id:_cdid,co:c.id,cardId:card.id,type:'harcama',date:d,amount:amt,cat,desc:'Kart harcaması'});
    S.txns.push({id:nid(),co:c.id,type:'gider',date:d,amount:amt,cat,accId:'',cardTxnId:_cdid,desc:'Kart harcaması ('+nm+')',src:'card'});
   }
   const ode=Math.round(9000*k);
   S.cardTxns.push({id:nid(),co:c.id,cardId:card.id,type:'odeme',date:addDays(today,-12),amount:ode});
   S.txns.push({id:nid(),co:c.id,type:'gider',date:addDays(today,-12),amount:ode,cat:'Banka & Komisyon',accId:b1.id,desc:'Kredi kartı ödemesi: '+nm});
  }

  // cariler
  TEDS.slice(0,3+Math.floor(rnd()*3)).forEach((nm,ix)=>{
   const cr={id:nid(),co:c.id,type:'tedarikci',name:nm,phone:'0532 4'+String(10+ix)+' '+String(20+ix)+' '+String(30+ix),vadeGun:30,opening:0,taxNo:String(1234500000+ix*7)};
   S.cari.push(cr);
   for(let j=0;j<3;j++){
    const d=addDays(today,-Math.floor(rnd()*60));
    S.cariTxns.push({id:nid(),co:c.id,cariId:cr.id,type:'alacak',amount:Math.round(12000*k*(0.5+rnd()*1.5)),date:d,vade:addDays(d,30),desc:'Mal alım faturası'});
   }
   S.cariTxns.push({id:nid(),co:c.id,cariId:cr.id,type:'borc',amount:Math.round(15000*k*(0.6+rnd())),date:addDays(today,-Math.floor(rnd()*20)),desc:'Ödeme yapıldı'});
  });
  MUST.forEach((nm,ix)=>{
   const cr={id:nid(),co:c.id,type:'musteri',name:nm,phone:'0533 6'+String(40+ix)+' '+String(50+ix)+' '+String(60+ix),vadeGun:15,opening:0};
   S.cari.push(cr);
   const d=addDays(today,-Math.floor(rnd()*15));
   S.cariTxns.push({id:nid(),co:c.id,cariId:cr.id,type:'borc',amount:Math.round(22000*k*(0.6+rnd())),date:d,vade:addDays(d,15),desc:'Kurumsal satış faturası'});
  });

  // personel: son 2 ay maaşları ödendi, bu ay 2 avans
  ADLAR.forEach((nm,ix)=>{
   const st={id:nid(),co:c.id,name:nm,pos:ROL[c.id][ix],phone:'0530 1'+String(10+ix)+' 2'+String(20+ix)+' 3'+String(ix),startDate:'2024-0'+(1+ix%9)+'-15',salary:Math.round((38000+ix*4200)*Math.sqrt(k)),active:'1'};
   S.staff.push(st);
   for(let m=1;m<=2;m++){
    const p2=prevPeriod(m);const pd=p2+'-0'+(3+ix%3);
    var _stid1=nid();
    S.staffTxns.push({id:_stid1,co:c.id,staffId:st.id,type:'maas',date:pd,amount:st.salary,period:p2,accId:b1.id});
    S.txns.push({id:nid(),co:c.id,type:'gider',date:pd,amount:st.salary,cat:'Personel',accId:b1.id,staffTxnId:_stid1,desc:'Maaş: '+nm+' ('+p2+')'});
   }
   if(ix<2){
    const ad=addDays(today,-3-ix*2),av=Math.round(st.salary*0.2);
    var _stid2=nid();
    S.staffTxns.push({id:_stid2,co:c.id,staffId:st.id,type:'avans',date:ad,amount:av,period:per,accId:kasa.id});
    S.txns.push({id:nid(),co:c.id,type:'gider',date:ad,amount:av,cat:'Personel',accId:kasa.id,staffTxnId:_stid2,desc:'Avans: '+nm});
   }
  });
  S.leaves.push({id:nid(),co:c.id,staffId:S.staff[S.staff.length-2].id,start:addDays(today,-1),end:addDays(today,3),type:'yillik',note:'Yıllık izin'});

  // sabit ödemeler + 3 aylık ödeme geçmişi
  const fixDefs=[['kira','İşyeri Kirası',5,Math.round(65000*k)],['sgk','SGK Primi',26,Math.round(38000*k)],['vergi','KDV Beyannamesi',28,Math.round(24000*k)],['fatura','Elektrik Faturası',20,Math.round(13500*k)],['fatura','Su Faturası',18,Math.round(2600*k)],['fatura','İnternet & Telefon',12,Math.round(1900*k)],['fatura','Doğalgaz Faturası',22,Math.round(6200*k)]];
  for(const[tp,nm,gun,amt]of fixDefs){
   const fx={id:nid(),co:c.id,type:tp,name:nm,payDay:gun,amount:amt};
   S.fixed.push(fx);
   for(let m=1;m<=3;m++){
    const p3=prevPeriod(m);
    const paidDate=p3+'-'+String(gun).padStart(2,'0');
    const val=Math.round(amt*(0.92+rnd()*0.16));
    const tx={id:nid(),co:c.id,type:'gider',date:paidDate,amount:val,cat:tp==='kira'?'Kira':tp==='fatura'?'Fatura & Abonelik':'Vergi & SGK',accId:b1.id,desc:FTYPE[tp]+' ödemesi: '+nm+' ('+mTR(p3)+')'};
    S.txns.push(tx);
    S.fixedLogs.push({id:nid(),co:c.id,fixedId:fx.id,period:p3,amount:val,paidDate,txnId:tx.id});
   }
   // bu ay: günü geçmiş olanlardan bazıları ödensin, kalanlar hatırlatıcıda görünsün
   if(+today.slice(8)>gun&&rnd()<0.5){
    const paidDate=per+'-'+String(gun).padStart(2,'0');
    const val=Math.round(amt*(0.95+rnd()*0.1));
    const tx={id:nid(),co:c.id,type:'gider',date:paidDate,amount:val,cat:tp==='kira'?'Kira':tp==='fatura'?'Fatura & Abonelik':'Vergi & SGK',accId:b1.id,desc:FTYPE[tp]+' ödemesi: '+nm+' ('+mTR(per)+')'};
    S.txns.push(tx);
    S.fixedLogs.push({id:nid(),co:c.id,fixedId:fx.id,period:per,amount:val,paidDate,txnId:tx.id});
   }
  }

  // çek & senet
  S.cheques.push(
   {id:nid(),co:c.id,tip:'alinan',tur:'cek',kisi:MUST[0],banka:'Ziraat Bankası',no:'A'+Math.floor(100000+rnd()*899999),tutar:Math.round(45000*k),vade:addDays(today,4),durum:'portfoy'},
   {id:nid(),co:c.id,tip:'alinan',tur:'senet',kisi:MUST[1],banka:'',no:'S'+Math.floor(1000+rnd()*8999),tutar:Math.round(28000*k),vade:addDays(today,25),durum:'portfoy'},
   {id:nid(),co:c.id,tip:'verilen',tur:'cek',kisi:TEDS[0],banka:'İş Bankası',no:'B'+Math.floor(100000+rnd()*899999),tutar:Math.round(36000*k),vade:addDays(today,12),durum:'portfoy'});
  var _ckD={id:nid(),co:c.id,tip:'alinan',tur:'cek',kisi:MUST[0],banka:'Garanti BBVA',no:'C'+Math.floor(100000+rnd()*899999),tutar:Math.round(19000*k),vade:addDays(today,-20),durum:'kapandi'};
  S.cheques.push(_ckD);
  S.txns.push({id:nid(),co:c.id,type:'gelir',date:addDays(today,-20),amount:_ckD.tutar,cat:'Diğer Gelir',accId:b1.id,cekId:_ckD.id,desc:'Çek tahsilatı: '+MUST[0]+' ('+_ckD.no+')'});
  // stok
  const stokDefs=[['Un (Tip 650)','kg',18,320,100],['Ayçiçek Yağı','lt',72,140,60],['Toz Şeker','kg',32,45,80],['Ambalaj Kutusu','adet',6.5,900,300],['Kahve Çekirdeği','kg',540,42,15],['Süt','lt',26,110,50]];
  stokDefs.forEach((d,ix)=>{
   const it={id:nid(),co:c.id,name:d[0],unit:d[1],cost:d[2],qty:d[3],min:d[4]};
   S.stock.push(it);
   S.stockTxns.push({id:nid(),co:c.id,itemId:it.id,type:'giris',qty:Math.round(d[3]*0.4),date:addDays(today,-6-ix),desc:'Tedarik alımı'});
   S.stockTxns.push({id:nid(),co:c.id,itemId:it.id,type:'cikis',qty:Math.round(d[3]*(ix===2?1.35:0.5)),date:addDays(today,-2),desc:'Üretim kullanımı'});
  });
  // demirbaş
  [['Konveksiyonlu Fırın','Mutfak ekipmanı','Mutfak',185000],['Sanayi Buzdolabı','Soğutma','Depo',96000],['POS Cihazı x2','Elektronik','Kasa',14000],['Salon Mobilya Takımı','Mobilya','Salon',120000]].forEach((d,ix)=>{
   S.assets.push({id:nid(),co:c.id,name:d[0],cat:d[1],loc:d[2],date:addDays(today,-200-ix*40),cost:Math.round(d[3]*k),durum:ix===1?'bakim':'aktif'});
  });
  // bütçe
  [['Hammadde & Malzeme',0.36],['Personel',0.22],['Kira',0.08],['Pazarlama',0.03],['Fatura & Abonelik',0.04],['Bakım & Onarım',0.02]].forEach(d=>{
   S.budgets.push({id:nid(),co:c.id,cat:d[0],amount:Math.round(26000*k*30*d[1])});
  });
  // görev & duyuru
  S.tasks.push(
   {id:nid(),co:c.id,title:'Gün sonu kasa sayımı',who:ADLAR[2],due:today,pri:'normal',status:'acik'},
   {id:nid(),co:c.id,title:'Ekipman bakım & temizliği',who:ADLAR[4],due:addDays(today,2),pri:'normal',status:'devam'},
   {id:nid(),co:c.id,title:'Tedarikçi fiyat listelerini güncelle',who:ADLAR[0],due:addDays(today,-2),pri:'yuksek',status:'acik'},
   {id:nid(),co:c.id,title:'Aylık stok sayımı',who:ADLAR[1],due:addDays(today,-5),pri:'normal',status:'tamam'});
  S.notes.push({id:nid(),co:c.id,date:addDays(today,-1),title:'Aylık ekip toplantısı',body:'Cuma günü saat 15:00\'te aylık değerlendirme toplantısı yapılacaktır. Tüm ekibin katılımı beklenmektedir.',level:'normal'});
 }
}

/* ---------- BAŞLAT + KENDİ KENDİNE TEST ---------- */
function __probe(){window.__probeOK=true;}
function selfTest(){
 try{
  window.__probeOK=false;
  var b=document.createElement('button');
  b.setAttribute('data-act','__probe');b.style.display='none';
  document.body.appendChild(b);
  b.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
  b.remove();
  var okStore=!!window.storage;
  if(window.__probeOK){
   toast(okStore?'Sistem hazır ✓ Butonlar çalışıyor, veriler buluta kaydediliyor':'⚠ Butonlar çalışıyor ama bulut depolama bulunamadı — bu genelde artifact henüz yayınlanmadığı için olur. Yayınlamadan veri kalıcı kaydedilmez.');
  }else{
   var d=document.createElement('div');
   d.style.cssText='position:fixed;top:0;left:0;right:0;z-index:99;background:#c2403c;color:#fff;padding:10px 14px;font-size:13px;text-align:center;font-weight:600';
   d.textContent='⚠ Bu görüntüleyici dokunmaları engelliyor. Lütfen dosyayı indirip Chrome / Safari tarayıcısında açın.';
   document.body.appendChild(d);
  }
 }catch(e){}
}
(async function(){
 try{var _tst=document.getElementById('toast');if(_tst){_tst.setAttribute('role','status');_tst.setAttribute('aria-live','polite');}}catch(e){} // B6: eski kabuk uyumu
 try{ // C7: PWA app-shell service worker (yalnizca statik kabuk; veri/API asla onbelleklenmez)
  if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('/sw.js').catch(function(){});
 }catch(e){}
 await loadState();
 var autoOk=await supaAutoLogin();
 if(autoOk){
  document.getElementById('loginScreen').style.display='none';
  document.getElementById('selectScreen').style.display='flex';
  toast('Hoş geldiniz — '+SESSION.username);
  renderSelect();
  setTimeout(weeklyBackupCheck,1500);
 }else{
  if(window.__loleBoot&&window.__loleBoot.signOut)window.__loleBoot.signOut();
 }
 setInterval(checkSessionTimeout,60000); // her dakika 48 saatlik hareketsizlik kontrolü
 var le=document.getElementById('loginUser');
 var lp=document.getElementById('loginPw');
 var loginEnter=function(e){if(e.key==='Enter'){e.preventDefault();loginSubmit();}};
 if(le)le.addEventListener('keydown',loginEnter);
 if(lp)lp.addEventListener('keydown',loginEnter);
 var mw=document.getElementById('modalWrap');
 if(mw)mw.addEventListener('click',function(e){if(e.target===mw)closeModal();});
 var ms=document.getElementById('moreSheet');
 if(ms)ms.addEventListener('click',function(e){if(e.target===ms)ms.classList.remove('on');});
 setTimeout(selfTest,400);
})();

/* ================== v3 EKLENTİLERİ ================== */

/* ---------- MODÜL ALTI DÖKÜM & ÖZETLER ---------- */
function foot(cols){return '<tr class="tfoot">'+cols.map(c=>`<td class="${c[1]||''}">${c[0]}</td>`).join('')+'</tr>';}
function modSum(kind){
 const co=CO;
 if(kind==='acc'){
  const accsF=byCo(S.accounts,co).filter(a=>accTab==='all'||a.type===accTab);
  const ids=new Set(accsF.map(a=>a.id));
  const list=S.txns.filter(t=>t.co===co&&!t.deletedAt&&(ids.has(t.accId)||ids.has(t.accId2))).sort((a,b)=>a.date<b.date?1:-1);
  if(!list.length)return '';
  let gir=0,cik=0;
  const perAcc=accsF.map(a=>{
   let g=0,x=0;
   for(const t of list){
    if(t.type==='gelir'&&t.accId===a.id)g+=+t.amount;
    else if(t.type==='gider'&&t.accId===a.id)x+=+t.amount;
    else if(t.type==='virman'){if(t.accId2===a.id)g+=+t.amount;if(t.accId===a.id)x+=+t.amount;}
   }
   gir+=g;cik+=x;
   return `<tr><td><b>${esc(a.name)}</b></td><td class="num" style="color:var(--pos)">${fmt(g)}</td><td class="num" style="color:var(--neg)">${fmt(x)}</td><td class="num"><b>${fmt(accBalance(a))}</b></td></tr>`;
  }).join('');
  const rows=list.slice(0,30).map(t=>txRow(t)).join('');
  const bakiyeToplam=accsF.reduce((s,a)=>s+accBalance(a),0); // v25 düzeltme: satırlardaki Güncel Bakiye toplamıyla artık birebir tutarlı (açılış bakiyeleri dahil)
  return `<div class="card"><h2>Hesap Bazlı Toplamlar</h2>
   <table><thead><tr><th>Hesap</th><th class="num">Toplam Giriş</th><th class="num">Toplam Çıkış</th><th class="num">Güncel Bakiye</th></tr></thead><tbody>${perAcc}
   ${foot([['<b>TOPLAM</b>'],[ '<b>'+fmt(gir)+'</b>','num'],['<b>'+fmt(cik)+'</b>','num'],['<b>'+fmt(bakiyeToplam)+'</b>','num']])}</tbody></table></div>
  <div class="card"><h2>Yapılan İşlemler — Satır Satır Döküm <span class="tiny">(son 30 / toplam ${list.length})</span></h2>
   <table><thead><tr><th>Tarih</th><th>İşlem</th><th class="hidem">Kategori</th><th class="num">Tutar</th></tr></thead><tbody>${rows}</tbody></table></div>`;
 }
 if(kind==='pos'){
  const ent=byCo(S.posEntries,co);
  if(!ent.length)return '';
  const months={};
  for(const e of ent){const p=e.date.slice(0,7);months[p]=months[p]||{g:0,k:0,n:0,c:0};months[p].g+=+e.gross;months[p].k+=+e.comm;months[p].n+=+e.net;months[p].c++;}
  const keys=Object.keys(months).sort().reverse().slice(0,6);
  let TG=0,TK=0,TN=0,TC=0;
  const rows=keys.map(p=>{const m=months[p];TG+=m.g;TK+=m.k;TN+=m.n;TC+=m.c;
   return `<tr><td><b>${mTR(p)}</b></td><td class="num">${m.c}</td><td class="num">${fmt(m.g)}</td><td class="num" style="color:var(--neg)">-${fmt(m.k)}</td><td class="num"><b>${fmt(m.n)}</b></td></tr>`;}).join('');
  return `<div class="card"><h2>POS Aylık Özet — İşlem & Veri Toplamları</h2>
   <table><thead><tr><th>Ay</th><th class="num">İşlem</th><th class="num">Brüt Ciro</th><th class="num">Komisyon</th><th class="num">Net</th></tr></thead><tbody>${rows}
   ${foot([['<b>TOPLAM</b>'],[ '<b>'+TC+'</b>','num'],['<b>'+fmt(TG)+'</b>','num'],['<b>-'+fmt(TK)+'</b>','num'],['<b>'+fmt(TN)+'</b>','num']])}</tbody></table></div>`;
 }
 if(kind==='card'){
  const list=S.cardTxns.filter(t=>t.co===co&&!t.deletedAt).sort((a,b)=>a.date<b.date?1:-1);
  if(!list.length)return '';
  let H=0,O=0;
  const rows=list.slice(0,30).map(t=>{const c=S.cards.find(x=>x.id===t.cardId)||{};
   if(t.type==='harcama')H+=+t.amount;else O+=+t.amount;
   return `<tr><td>${dTR(t.date)}</td><td><b>${esc(c.name||'?')}</b> <span class="tiny">${esc(t.desc||t.cat||'')}</span></td>
   <td><span class="chip ${t.type==='odeme'?'p':'n'}">${t.type==='odeme'?'Ödeme':'Harcama'}</span></td>
   <td class="num" style="color:${t.type==='odeme'?'var(--pos)':'var(--neg)'}">${fmt(t.amount)}</td></tr>`;}).join('');
  for(const t of list.slice(30)){if(t.type==='harcama')H+=+t.amount;else O+=+t.amount;}
  return `<div class="card"><h2>Kart Hareketleri — Satır Satır Döküm <span class="tiny">(son 30 / toplam ${list.length})</span></h2>
   <table><thead><tr><th>Tarih</th><th>Kart / Açıklama</th><th>Tür</th><th class="num">Tutar</th></tr></thead><tbody>${rows}
   ${foot([['<b>TOPLAM</b>'],[ '<span class="tiny">Harcama: <b>'+fmt(H)+'</b> · Ödeme: <b>'+fmt(O)+'</b></span>'],[''],['<b>Kalan borç: '+fmt(H-O)+'</b>','num']])}</tbody></table></div>`;
 }
 if(kind==='cari'){
  const isM=c=>c.type==='musteri'||c.type==='her2';
  const isT=c=>c.type==='tedarikci'||c.type==='her2';
  const _cm=new Map(S.cari.map(function(c){return [c.id,c];})); // A15: cariId → cari haritası
  const uygun=id=>{const c=_cm.get(id);if(!c)return false;
   return cariTab==='musteri'?isM(c):cariTab==='tedarikci'?isT(c):cariTab==='diger'?c.type==='diger':true;};
  const list=S.cariTxns.filter(t=>t.co===co&&!t.deletedAt&&uygun(t.cariId)).sort((a,b)=>a.date<b.date?1:-1);
  if(!list.length)return '';
  let B=0,A=0;
  const rows=list.slice(0,30).map(t=>{const c=_cm.get(t.cariId)||{};
   return `<tr><td>${dTR(t.date)}</td><td><b>${esc(c.name||'?')}</b> <span class="tiny">${t.fatura?`🧾 ${esc(t.faturaNo||'Fatura')} · `:''}${esc(t.desc||'')}${t.vade?' · Vade: '+dTR(t.vade):''}</span></td>
   <td class="num">${t.type==='borc'?fmt(t.amount):''}</td><td class="num">${t.type==='alacak'?fmt(t.amount):''}</td></tr>`;}).join('');
  for(const t of list){if(t.type==='borc')B+=+t.amount;else A+=+t.amount;}
  return `<div class="card"><h2>Cari Hareket Dökümü <span class="tiny">(son 30 / toplam ${list.length})</span></h2>
   <table><thead><tr><th>Tarih</th><th>Cari / Açıklama</th><th class="num">Borç</th><th class="num">Alacak</th></tr></thead><tbody>${rows}
   ${foot([['<b>TOPLAM</b>'],[''],['<b>'+fmt(B)+'</b>','num'],['<b>'+fmt(A)+'</b>','num']])}</tbody></table></div>`;
 }
 if(kind==='staff'){
  const pays=S.staffTxns.filter(t=>t.co===co&&!t.deletedAt);
  if(!pays.length)return '';
  const months={};
  for(const t of pays){const p=(t.period||t.date.slice(0,7));months[p]=months[p]||{maas:0,avans:0,prim:0,kesinti:0};months[p][t.type]=(months[p][t.type]||0)+ +t.amount;}
  const keys=Object.keys(months).sort().reverse().slice(0,6);
  let TM=0,TA=0,TP=0,TK=0;
  const rows=keys.map(p=>{const m=months[p];TM+=m.maas||0;TA+=m.avans||0;TP+=m.prim||0;TK+=m.kesinti||0;
   const top=(m.maas||0)+(m.avans||0)+(m.prim||0)-(m.kesinti||0);
   return `<tr><td><b>${mTR(p)}</b></td><td class="num">${fmt(m.maas||0)}</td><td class="num">${fmt(m.avans||0)}</td><td class="num">${fmt(m.prim||0)}</td><td class="num">${fmt(m.kesinti||0)}</td><td class="num"><b>${fmt(top)}</b></td></tr>`;}).join('');
  return `<div class="card"><h2>Personel Aylık Ödeme Özeti</h2>
   <table><thead><tr><th>Dönem</th><th class="num">Maaş</th><th class="num">Avans</th><th class="num">Prim</th><th class="num">Kesinti</th><th class="num">Toplam</th></tr></thead><tbody>${rows}
   ${foot([['<b>TOPLAM</b>'],[ '<b>'+fmt(TM)+'</b>','num'],['<b>'+fmt(TA)+'</b>','num'],['<b>'+fmt(TP)+'</b>','num'],['<b>'+fmt(TK)+'</b>','num'],['<b>'+fmt(TM+TA+TP-TK)+'</b>','num']])}</tbody></table></div>`;
 }
 return '';
}

/* ---------- ÇEK & SENET ---------- */
function rCek(){
 const list=byCo(S.cheques,CO).sort((a,b)=>a.vade<b.vade?-1:1);
 const acikD=d=>d==='portfoy'||d==='tahsilde'; // C1: tahsilde de açık çektir
 const alP=list.filter(c=>c.tip==='alinan'&&acikD(c.durum));
 const veP=list.filter(c=>c.tip==='verilen'&&acikD(c.durum));
 const hafta=list.filter(c=>acikD(c.durum)&&daysDiff(c.vade)<=7);
 const DT={portfoy:['Portföyde','g'],tahsilde:['Tahsilde 🏦','w'],ciro:['Ciro edildi ↪','g'],kapandi:['Kapandı ✓','p'],karsiliksiz:['Karşılıksız','n']};
 document.getElementById('main').innerHTML= topbar('Çek & Senet',
  `<button class="btn" data-act="cekForm">＋ Çek / Senet Ekle</button>`)+
 `<div class="grid g3" style="margin-bottom:16px">
   <div class="kpi p"><div class="l">Portföydeki Alacak Çekleri</div><div class="v">${fmt0(alP.reduce((s,c)=>s+ +c.tutar,0))}</div><div class="s">${alP.length} adet</div></div>
   <div class="kpi n"><div class="l">Verdiğimiz Çekler (açık)</div><div class="v">${fmt0(veP.reduce((s,c)=>s+ +c.tutar,0))}</div><div class="s">${veP.length} adet</div></div>
   <div class="kpi ${hafta.length?'a':''}"><div class="l">7 Gün İçinde Vadesi Gelen</div><div class="v">${hafta.length}</div></div>
  </div>
  <div class="card"><h2>Çek / Senet Portföyü <span class="tiny">ℹ Cariye bağlı açık çekler cari bakiyesine zaten dahildir — aynı alacağı iki kez saymayın</span></h2>
  ${list.length? '<table><thead><tr><th>Tür</th><th>Kişi / Kurum</th><th class="hidem">Banka & No</th><th>Vade</th><th class="num">Tutar</th><th>Durum</th><th class="rowact"></th></tr></thead><tbody>'+
   list.map(c=>{const df=daysDiff(c.vade);const acik=c.durum==='portfoy'||c.durum==='tahsilde';
    return `<tr data-act="cekDetail" data-arg="${c.id}" style="cursor:pointer" title="Çek detay sayfasını aç"><td><span class="chip ${c.tip==='alinan'?'p':'n'}">${c.tip==='alinan'?'ALINAN':'VERİLEN'}</span> ${c.tur==='senet'?'Senet':'Çek'}</td>
    <td>${c.cariId?`<b data-act="cariDetail" data-arg="${c.cariId}" style="cursor:pointer;text-decoration:underline dotted" title="Cari detayını aç">${esc(c.kisi)}</b>`:`<b>${esc(c.kisi)}</b> <button class="btn sm gh" data-act="cekForm" data-arg="${c.id}" title="Bu çeki bir cari hesapla eşleştirin — kapanış/karşılıksız cariye otomatik işlenir">👥 cari eşleştir</button>`}</td><td class="hidem">${esc(c.banka||'')} ${c.no?'· '+esc(c.no):''}</td>
    <td>${dTR(c.vade)} ${acik?`<span class="chip ${df<0?'n':df<=3?'w':'g'}">${remLbl(df)}</span>`:''}</td>
    <td class="num"><b>${fmt(c.tutar)}</b></td>
    <td><span class="chip ${DT[c.durum][1]}">${DT[c.durum][0]}</span>
     ${acik?`<button class="btn sm" data-act="cekKapat" data-arg="${c.id}">${c.tip==='alinan'?'Tahsil Et':'Öde'}</button>${c.tip==='alinan'?`${c.durum==='portfoy'?`<button class="btn sm gh" data-act="cekTahsileVer" data-arg="${c.id}" title="Bankaya tahsile ver (para hareketi olmaz, yalnız konum)">🏦 Tahsile Ver</button><button class="btn sm gh" data-act="cekCiro" data-arg="${c.id}" title="Çeki bir tedarikçiye ciro et — cari borcunuz kapanır">↪ Ciro</button>`:''}<button class="btn sm dng" data-act="cekKarsiliksiz" data-arg="${c.id}">Karşılıksız</button>`:''}`:''}</td>
    <td class="rowact"><button data-act="cekForm" data-arg="${c.id}">✎</button><button data-act="del" data-arg="cek~${c.id}">🗑</button></td></tr>`;}).join('')+
   foot([['<b>TOPLAM</b>'],[''],['','hidem'],[''],['<b>'+fmt(list.reduce((s,c)=>s+ +c.tutar,0))+'</b>','num'],[''],['','rowact']])+'</tbody></table>'
   :'<div class="empty"><b>Çek / senet kaydı yok</b>Aldığınız ve verdiğiniz çek-senetleri vade takibiyle buradan yönetin; vadesi yaklaşanlar ana sayfada hatırlatılır.</div>'}
 </div>`;
}
function cekForm(id){
 const init=id?S.cheques.find(c=>c.id===id):{tip:'alinan',tur:'cek',durum:'portfoy'};
 openForm(id?'Çek / Senet Düzenle':'Yeni Çek / Senet',[
  {row:[{name:'tip',label:'Yön',type:'select',opts:[['alinan','Alınan (müşteriden)'],['verilen','Verilen (tedarikçiye)']]},{name:'tur',label:'Tür',type:'select',opts:[['cek','Çek'],['senet','Senet']]}]},
  {name:'kisi',label:'Kişi / Kurum',req:1,ph:'Ör: Anadolu Gıda Ltd.'},
  {name:'cariId',label:'İlgili cari (opsiyonel — seçilirse tahsilat/ödeme cari hesaba da işlenir)',type:'select',opts:cariOpts(CO)},
  {row:[{name:'banka',label:'Banka'},{name:'no',label:'Çek / Senet No'}]},
  {row:[{name:'tutar',label:'Tutar (₺)',type:'number',req:1,min:0.01},{name:'vade',label:'Vade tarihi',type:'date',req:1,def:addDays(todayISO(),30)}]},
  {name:'note',label:'Not'}
 ],o=>{
  if(o.cariId&&!String(o.kisi||'').trim()){const _c=S.cari.find(x=>x.id===o.cariId);if(_c)o.kisi=_c.name;} // B6: cari seçildiyse kişi otomatik dolar
  if(id)Object.assign(init,o); else pushRec(S.cheques,{id:nid(),co:CO,durum:init&&init.durum?init.durum:'portfoy',...o});
  save();toast('Çek/senet kaydedildi'+(o.cariId?'':' — ⚠ cari eşleştirilmedi: kapanış/karşılıksız cari hesaba işlenmeyecek'));go('cek');
 },init||{});
 setTimeout(function(){ // B6: cari seçimi kişi alanını doldurur
  var sel=document.querySelector('#mForm select[name="cariId"]'),kisi=document.querySelector('#mForm input[name="kisi"]');
  if(!sel||!kisi)return;
  sel.addEventListener('change',function(){var c=S.cari.find(function(x){return x.id===sel.value;});if(c&&(!kisi.value.trim()||sel.dataset.prev===kisi.value)){kisi.value=c.name;sel.dataset.prev=c.name;}});
 },80);
}
function cekTahsileVer(id){ // C1: bankaya tahsile verildi — para hareketi yok, yalnız konum bilgisi
 const c=S.cheques.find(x=>x.id===id);if(!c||c.durum!=='portfoy')return;
 const opts=accOpts(CO);
 if(!opts.length)return toast('Önce Banka & Kasa ekranından bir hesap ekleyin');
 openForm('🏦 Tahsile Ver — '+c.kisi,[
  {name:'accId',label:'Hangi bankaya tahsile verildi (vadesinde bu hesaba tahsil önerilir)',type:'select',opts,req:1}
 ],o=>{
  c.durum='tahsilde';c.tahsilAccId=o.accId;
  try{logAudit('Çek tahsile verildi',c.kisi+' '+fmt(c.tutar));}catch(e){}
  save();toast('Çek tahsile verildi — para hareketi vadesinde "Tahsil Et" ile işlenir');go('cek');
 });
}
function cekCiro(id){ // C1: çeki tedarikçiye ciro et — banka işlemi olmadan cari borcumuz kapanır
 const c=S.cheques.find(x=>x.id===id);if(!c||c.durum!=='portfoy'||c.tip!=='alinan')return;
 const opts=byCo(S.cari,CO).filter(x=>x.active!=='0').map(x=>[x.id,x.name]);
 if(!opts.length)return toast('Önce ciro edilecek cari (tedarikçi) ekleyin');
 openForm('↪ Ciro Et — '+c.kisi+' ('+fmt(c.tutar)+')',[
  {name:'cariId',label:'Hangi cariye ciro edildi (borcumuz bu tutar kadar kapanır)',type:'select',opts,req:1},
  {name:'date',label:'Ciro tarihi',type:'date',def:todayISO(),req:1}
 ],o=>{
  const hedef=S.cari.find(x=>x.id===o.cariId);
  c.prevDurum=c.durum; c.durum='ciro';c.ciroCariId=o.cariId;c.ciroDate=o.date;
  S.cariTxns.push(stampCreate({id:nid(),co:CO,cariId:o.cariId,type:'borc',amount:+c.tutar,date:o.date,cekId:id,
   desc:'Çek cirosu: '+c.kisi+(c.no?' ('+c.no+')':'')+' — vade '+dTR(c.vade)}));
  var _src=c.cariId?S.cari.find(function(x){return x.id===c.cariId&&!x.deletedAt;}):null; // v14-H14: çeki veren müşterinin alacağı da kapanmalı (cekKapat ile aynı desen)
  if(_src)S.cariTxns.push(stampCreate({id:nid(),co:CO,cariId:_src.id,type:'alacak',amount:+c.tutar,date:o.date,cekId:id,
   desc:(c.tur==='senet'?'Senet':'Çek')+' cirosu ile kapandı'+(c.no?' ('+c.no+')':'')}));
  try{logAudit('Çek ciro edildi',c.kisi+' → '+(hedef?hedef.name:'')+' '+fmt(c.tutar));}catch(e){}
  save();toast('Çek '+(hedef?hedef.name:'cariye')+' ciro edildi — cari borcunuz '+fmt(c.tutar)+' kapandı (banka hareketi yok)');go('cek');
 });
}
function cekKapat(id){
 const c=S.cheques.find(x=>x.id===id);if(!c)return;
 if(c.durum!=='portfoy'&&c.durum!=='tahsilde')return toast('Bu çek zaten kapatılmış/ciro edilmiş');
 const opts=accOpts(CO);
 if(!opts.length)return toast('Önce Banka & Kasa ekranından bir hesap ekleyin');
 openForm((c.tip==='alinan'?'Tahsilat':'Ödeme')+' — '+c.kisi,[
  {name:'accId',label:c.tip==='alinan'?'Hangi hesaba tahsil edildi':'Hangi hesaptan ödendi',type:'select',opts,req:1,def:c.tahsilAccId||''},
  {name:'date',label:'İşlem tarihi',type:'date',def:todayISO(),req:1}
 ],o=>{
  c.prevDurum=c.durum; c.durum='kapandi'; // v14-K7
  var _cc=c.cariId?S.cari.find(function(x){return x.id===c.cariId&&!x.deletedAt;}):null; // v14-H9: silinmiş cariye yazma
  S.txns.push(stampCreate({id:nid(),co:CO,type:c.tip==='alinan'?'gelir':'gider',date:o.date,amount:+c.tutar,cekId:id,
   cat:c.tip==='alinan'?'Diğer Gelir':'Diğer Gider',accId:o.accId,
   desc:(c.tur==='senet'?'Senet':'Çek')+(c.tip==='alinan'?' tahsilatı: ':' ödemesi: ')+c.kisi+(c.no?' ('+c.no+')':'')}));
  var _msg=c.tip==='alinan'?'Çek tahsil edildi, gelir işlendi':'Çek ödendi, gider işlendi';
  if(_cc){
   S.cariTxns.push(stampCreate({id:nid(),co:CO,cariId:_cc.id,type:c.tip==='alinan'?'alacak':'borc',amount:+c.tutar,date:o.date,cekId:id,
    desc:(c.tur==='senet'?'Senet':'Çek')+(c.tip==='alinan'?' tahsilatı':' ödemesi')+(c.no?' ('+c.no+')':'')}));
   _msg+=' + '+_cc.name+' carisine işlendi';
  }
  try{logAudit('Çek/senet kapatıldı',c.kisi+' '+fmt(c.tutar));}catch(e){}
  save();toast(_msg);go('cek');
 });
}
function cekKarsiliksiz(id){
 const c=S.cheques.find(x=>x.id===id);if(!c)return;
 /* A3: portföydeki çekte cari alacağı zaten hiç kapanmamıştır — 'borc' kaydı eklemek bakiyeyi 2x açar. Yalnızca durum işaretlenir. */
 uiConfirm(c.kisi+' çeki karşılıksız olarak işaretlensin mi?'+(c.cariId?' (Cari bakiye değişmez — alacak zaten açık durumda.)':''),()=>{c.durum='karsiliksiz';c.note=(c.note?c.note+' | ':'')+'Karşılıksız: '+todayISO();try{logAudit('Çek karşılıksız',c.kisi+' '+fmt(c.tutar));}catch(e){}save();toast('Karşılıksız işaretlendi');go('cek');},{danger:1});
}

function cekDetail(id){ // C6: çek/senet detay sayfası — cari bağı + durum + bağlı kayıtlar
 const c=S.cheques.find(x=>x.id===id&&!x.deletedAt);if(!c){toast('Çek/senet bulunamadı');return;}
 PAGE='cek';_navHi('cek');
 const DT={portfoy:['Portföyde','g'],tahsilde:['Tahsilde 🏦','w'],ciro:['Ciro edildi ↪','g'],kapandi:['Kapandı ✓','p'],karsiliksiz:['Karşılıksız','n']};
 const df=daysDiff(c.vade);
 const acik=c.durum==='portfoy'||c.durum==='tahsilde';
 const cari=c.cariId?S.cari.find(x=>x.id===c.cariId&&!x.deletedAt):null;
 const ciroC=c.ciroCariId?S.cari.find(x=>x.id===c.ciroCariId):null;
 const tahsilAcc=c.tahsilAccId?S.accounts.find(x=>x.id===c.tahsilAccId):null;
 const ltx=S.txns.filter(t=>t.cekId===id&&!t.deletedAt);
 const lct=S.cariTxns.filter(t=>t.cekId===id&&!t.deletedAt);
 document.getElementById('main').innerHTML= topbar((c.tur==='senet'?'📜 Senet':'📄 Çek')+' — '+esc(c.kisi),
  `<button class="btn gh" data-act="go" data-arg="cek">← Çek & Senet</button>`)+
 `<div class="grid g3" style="margin-bottom:16px">
   <div class="kpi ${c.tip==='alinan'?'p':'n'}"><div class="l">${c.tip==='alinan'?'Alınan (müşteriden)':'Verilen (tedarikçiye)'}</div><div class="v">${fmt0(c.tutar)}</div><div class="s">${esc(c.banka||'')}${c.no?' · No: '+esc(c.no):''}</div></div>
   <div class="kpi ${acik&&df<0?'n':''}"><div class="l">Vade</div><div class="v" style="font-size:19px">${dTR(c.vade)}</div><div class="s">${acik?remLbl(df):''}</div></div>
   <div class="kpi"><div class="l">Durum</div><div class="v" style="font-size:19px">${(DT[c.durum]||[c.durum])[0]}</div><div class="s">${c.durum==='tahsilde'&&tahsilAcc?'Tahsilde: '+esc(tahsilAcc.name):c.durum==='ciro'&&ciroC?'Ciro: '+esc(ciroC.name)+(c.ciroDate?' · '+dTR(c.ciroDate):''):''}</div></div>
  </div>
  <div class="card" style="margin-bottom:14px"><div class="cardBtns" style="margin:0">
   ${acik?`<button class="btn sm" data-act="cekKapat" data-arg="${c.id}">${c.tip==='alinan'?'₺ Tahsil Et':'₺ Öde'}</button>`:''}
   ${c.durum==='portfoy'&&c.tip==='alinan'?`<button class="btn sm gh" data-act="cekTahsileVer" data-arg="${c.id}">🏦 Tahsile Ver</button><button class="btn sm gh" data-act="cekCiro" data-arg="${c.id}">↪ Ciro Et</button>`:''}
   ${acik&&c.tip==='alinan'?`<button class="btn sm dng" data-act="cekKarsiliksiz" data-arg="${c.id}">Karşılıksız</button>`:''}
   <button class="btn sm gh" data-act="cekForm" data-arg="${c.id}">✎ Düzenle</button>
  </div></div>
  <div class="card"><h2>Cari Bağlantısı</h2>
   ${cari?`<p style="font-size:13.5px"><b data-act="cariDetail" data-arg="${cari.id}" style="cursor:pointer;text-decoration:underline dotted" title="Cari detayını aç">👥 ${esc(cari.name)}</b> — güncel bakiye ${fmt(Math.abs(cariBalance(cari)))} ${cariBalance(cari)>0?'(bize borçlu)':cariBalance(cari)<0?'(biz borçluyuz)':''}${acik&&c.tip==='alinan'?'<br><span class="tiny">ℹ Bu açık çek cari bakiyesine zaten dahildir (alacak çekle güvence altında) — aynı tutarı iki kez saymayın.</span>':''}</p>`
    :`<div class="empty"><b>Cari eşleştirilmemiş</b>Kapanış/karşılıksız işlemleri cari hesaba işlenmez. <button class="btn sm" data-act="cekForm" data-arg="${c.id}">👥 Cari Eşleştir</button></div>`}
  </div>
  ${(ltx.length||lct.length)?`<div class="card"><h2>Bağlı Kayıtlar</h2><table><tbody>
   ${ltx.map(t=>{const a=S.accounts.find(x=>x.id===t.accId);return `<tr><td>${dTR(t.date)}</td><td><span class="chip ${t.type==='gelir'?'p':'n'}">${t.type==='gelir'?'Gelir':'Gider'}</span> ${esc(t.desc||'')} ${a?`<span class="chip g" data-act="accDetail" data-arg="${a.id}" style="cursor:pointer">🏦 ${esc(a.name)}</span>`:''}</td><td class="num">${fmt(t.amount)}</td></tr>`;}).join('')}
   ${lct.map(t=>{const cc=S.cari.find(x=>x.id===t.cariId);return `<tr><td>${dTR(t.date)}</td><td><span class="chip g">Cari: ${t.type==='borc'?'borç':'alacak'}</span> ${esc(t.desc||'')} ${cc?`<span class="chip g" data-act="cariDetail" data-arg="${cc.id}" style="cursor:pointer">👥 ${esc(cc.name)}</span>`:''}</td><td class="num">${fmt(t.amount)}</td></tr>`;}).join('')}
  </tbody></table></div>`:''}
  ${c.note?`<div class="card"><h2>Not</h2><p style="font-size:13px;white-space:pre-wrap">${esc(c.note)}</p></div>`:''}`;
 try{window.scrollTo(0,0);}catch(e){}
}

/* ---------- STOK TAKİBİ ---------- */
var stokKritik=false; // C5: kritik seviye filtresi
function stokKritikTgl(){stokKritik=!stokKritik;go('stok');}
function stockQty(it){
 let q=+it.qty||0;
 for(const t of S.stockTxns) if(t.itemId===it.id&&!t.deletedAt) q+= t.type==='giris'? +t.qty : -t.qty;
 return q;
}
function rStock(){
 const list=byCo(S.stock,CO);
 const rows=list.map(it=>({it,q:stockQty(it)}));
 const deger=rows.reduce((s,r)=>s+r.q*(+r.it.cost||0),0);
 const kritik=rows.filter(r=>+(r.it.min||0)>0&&r.q<=+r.it.min); // v14-H9: hatırlatıcı/AI/grup raporu zaten min>0 arıyordu — ekran da hizalandı
 const rowsShow=stokKritik?kritik:rows; // C5: KPI'ya tıklayınca yalnız kritikler
 const moves=byCo(S.stockTxns,CO).sort((a,b)=>a.date<b.date?1:-1);
 document.getElementById('main').innerHTML= topbar('Stok Takibi',
  `<button class="btn gh" data-act="stockTxnForm">⇅ Stok Hareketi</button><button class="btn" data-act="stockForm">＋ Ürün Ekle</button>`)+
 `<div class="grid g3" style="margin-bottom:16px">
   <div class="kpi"><div class="l">Stok Kalemi</div><div class="v">${list.length}</div></div>
   <div class="kpi a"><div class="l">Toplam Stok Değeri</div><div class="v">${fmt0(deger)}</div></div>
   <div class="kpi ${kritik.length?'n':''}" data-act="stokKritikTgl" style="cursor:pointer${stokKritik?';outline:2px solid var(--acc)':''}" title="Yalnız kritik seviyedeki ürünleri göster/gizle"><div class="l">Kritik Seviyede ↗${stokKritik?' ✓':''}</div><div class="v">${kritik.length}</div></div>
  </div>
  <div class="card"><h2>Ürünler & Mevcut Stok ${stokKritik?`<span class="chip w">⚠ Yalnız kritikler</span> <button class="btn sm gh" data-act="stokKritikTgl">✕ Filtreyi kaldır</button>`:''}</h2>
  ${rowsShow.length? '<table><thead><tr><th>Ürün</th><th class="num">Miktar</th><th class="num hidem">Birim Maliyet</th><th class="num">Stok Değeri</th><th class="num hidem">Kritik Sınır</th><th class="rowact"></th></tr></thead><tbody>'+
   rowsShow.map(({it,q})=>`<tr data-act="stockDetail" data-arg="${it.id}" style="cursor:pointer" title="Ürün detay sayfasını aç"><td><span class="avat sm" style="background:${hashColor(it.name)}">${esc(it.name.charAt(0))}</span> <b>${esc(it.name)}</b> <span class="tiny">${esc(it.unit||'')}</span> ${q<=+(it.min||0)?'<span class="chip n">⚠ Kritik</span>':''}</td>
   <td class="num"><b>${q.toLocaleString('tr-TR')}</b></td><td class="num hidem">${fmt(it.cost)}</td><td class="num">${fmt(q*(+it.cost||0))}</td><td class="num hidem">${(+it.min||0).toLocaleString('tr-TR')}</td>
   <td class="rowact"><button data-act="stockTxnForm" data-arg="${it.id}" title="Bu ürüne giriş/çıkış hareketi gir">⇅</button><button data-act="stockForm" data-arg="${it.id}">✎</button><button data-act="del" data-arg="stok~${it.id}">🗑</button></td></tr>`).join('')+
   foot([['<b>TOPLAM</b>'],[''],['','num hidem'],['<b>'+fmt(deger)+'</b>','num'],['','num hidem'],['','rowact']])+'</tbody></table>'
   :stokKritik?'<div class="empty"><b>Kritik seviyede ürün yok 🎉</b>Filtreyi kaldırıp tüm ürünleri görebilirsiniz.</div>':'<div class="empty"><b>Ürün yok</b>Hammadde ve ürünlerinizi ekleyin; giriş-çıkış hareketleriyle stok otomatik hesaplanır, kritik seviyeler ana sayfada uyarır.</div>'}
  </div>
  ${moves.length?`<div class="card"><h2>Stok Hareket Dökümü <span class="tiny">(son 25 / toplam ${moves.length})</span></h2>
   <table><thead><tr><th>Tarih</th><th>Ürün</th><th>Hareket</th><th class="num">Miktar</th><th class="rowact"></th></tr></thead><tbody>
   ${moves.slice(0,25).map(t=>{const it=S.stock.find(x=>x.id===t.itemId)||{};
    return `<tr><td>${dTR(t.date)}</td><td><b data-act="stockDetail" data-arg="${t.itemId}" style="cursor:pointer;text-decoration:underline dotted" title="Ürün detayını aç">${esc(it.name||'?')}</b> <span class="tiny">${esc(t.desc||'')}</span>${+t.amount>0?' <span class="chip g">₺ '+fmt0(t.amount)+'</span>':''}</td>
    <td><span class="chip ${t.type==='giris'?'p':'n'}">${t.type==='giris'?'Giriş':'Çıkış'}</span></td>
    <td class="num">${(+t.qty).toLocaleString('tr-TR')} ${esc(it.unit||'')}</td>
    <td class="rowact"><button data-act="del" data-arg="stokT~${t.id}">🗑</button></td></tr>`;}).join('')}</tbody></table></div>`:''}`;
}
function stockForm(id){
 const init=id?S.stock.find(x=>x.id===id):{unit:'kg'};
 openForm(id?'Ürün Düzenle':'Yeni Ürün',[
  {name:'name',label:'Ürün adı',req:1,ph:'Ör: Un (Tip 650)'},
  {row:[{name:'unit',label:'Birim',type:'select',opts:[['kg','kg'],['lt','lt'],['adet','adet'],['paket','paket'],['koli','koli']]},{name:'cost',label:'Birim maliyet (₺)',type:'number',def:0}]},
  {row:[{name:'qty',label:'Açılış miktarı',type:'number',def:0},{name:'min',label:'Kritik sınır (uyarı)',type:'number',def:0}]}
 ],o=>{ if(id)Object.assign(init,o); else S.stock.push({id:nid(),co:CO,...o}); save();toast('Ürün kaydedildi');go('stok'); },init||{});
}
function stockTxnForm(itemId,init){ // A1+C3+C5: alım finansal kayda bağlanır, çıkışta COGS opsiyonu, ürün ön-seçimi
 const opts=byCo(S.stock,CO).map(i=>[i.id,i.name]);
 if(!opts.length)return toast('Önce ürün ekleyin');
 const payOpts=[['','— Ödeme yok / yalnız stok kaydı —']].concat(payMethodOpts(CO).slice(1)).concat([['cari','📝 Veresiye (tedarikçi carisine borç yaz)']]);
 openForm('Stok Hareketi',[
  {name:'itemId',label:'Ürün',type:'select',opts,req:1,def:itemId||''},
  {row:[{name:'type',label:'Hareket',type:'select',opts:[['giris','Giriş (alım)'],['cikis','Çıkış (kullanım/fire)']]},{name:'qty',label:'Miktar',type:'number',req:1,min:0.001}]},
  {row:[{name:'date',label:'Tarih',type:'date',def:todayISO(),req:1},{name:'desc',label:'Açıklama'}]},
  {row:[{name:'amount',label:'Alım tutarı ₺ toplam (Giriş için)',type:'number'},{name:'method',label:'Ödeme yöntemi (tutar girildiyse zorunlu)',type:'select',opts:payOpts}]},
  {name:'cariId',label:'Tedarikçi cari (veresiye için zorunlu, diğerlerinde opsiyonel)',type:'select',opts:cariOpts(CO)},
  {name:'masraf',label:'Çıkışta maliyeti gidere yaz (tahakkuk — K/Z raporuna yansır, kasadan para çıkmaz)',type:'select',opts:[['','Hayır — yalnız stok düşümü'],['1','Evet — kullanım maliyetini gidere yaz']]}
 ],o=>{
  const it=S.stock.find(x=>x.id===o.itemId)||{};
  if(o.type==='giris'&&+o.amount>0&&!o.method){toast('⚠ Alım tutarı girdiniz ama ödeme yöntemi seçmediniz — para boşluğa yazılmaz. Kasa/banka, kart veya veresiye seçin.');stockTxnForm(o.itemId,o);return;}
  if(o.type==='giris'&&+o.amount>0&&o.method==='cari'&&!o.cariId){toast('⚠ Veresiye seçtiniz — tedarikçi carisini seçin.');stockTxnForm(o.itemId,o);return;}
  const stid=nid();
  pushRec(S.stockTxns,{id:stid,co:CO,itemId:o.itemId,type:o.type,qty:o.qty,date:o.date,desc:o.desc,amount:(o.type==='giris'?+o.amount||0:0)});
  let msg='Stok hareketi işlendi';
  if(o.type==='giris'&&+o.amount>0&&o.method){
   const _desc='Stok alımı: '+(it.name||'')+' ('+o.qty+' '+(it.unit||'')+')'+(o.desc?' - '+o.desc:'');
   if(o.method==='cari'){
    S.cariTxns.push(stampCreate({id:nid(),co:CO,cariId:o.cariId,type:'alacak',amount:+o.amount,date:o.date,stokTxnId:stid,desc:_desc+' (veresiye)'}));
    msg+=' + tedarikçi carisine borç yazıldı';
   }else if(o.method.indexOf('card:')===0){
    const cardId=o.method.slice(5),cdid=nid();
    S.cardTxns.push(stampCreate({id:cdid,co:CO,cardId:cardId,type:'harcama',amount:+o.amount,date:o.date,cat:'Hammadde & Malzeme',taksit:1,stokTxnId:stid,cariId:o.cariId||'',desc:_desc})); /* v14-A3: kart yolunda cari hiç kaydedilmiyordu */
    S.txns.push(stampCreate({id:nid(),co:CO,type:'gider',date:o.date,amount:+o.amount,cat:'Hammadde & Malzeme',accId:'',src:'card',cardTxnId:cdid,stokTxnId:stid,desc:_desc+' (kredi kartı)'}));
    msg+=' + kredi kartına işlendi';
   }else{
    S.txns.push(stampCreate({id:nid(),co:CO,type:'gider',date:o.date,amount:+o.amount,cat:'Hammadde & Malzeme',accId:o.method,stokTxnId:stid,cariId:o.cariId||'',desc:_desc}));
    msg+=' + gider hesaptan düşüldü';
    if(o.cariId&&S.cari.find(x=>x.id===o.cariId&&!x.deletedAt)){ /* v14-A3: peşin alımda cari seçimi eskiden ölüydü — artık tedarikçi ekstresine alım+ödeme çifti olarak yazılır (net bakiye etkisi 0, geçmiş görünür olur) */
     S.cariTxns.push(stampCreate({id:nid(),co:CO,cariId:o.cariId,type:'alacak',amount:+o.amount,date:o.date,stokTxnId:stid,desc:_desc+' (peşin alım)'}));
     S.cariTxns.push(stampCreate({id:nid(),co:CO,cariId:o.cariId,type:'borc',amount:+o.amount,date:o.date,stokTxnId:stid,desc:_desc+' — peşin ödendi'}));
     msg+=' + tedarikçi ekstresine işlendi';
    }
   }
  }
  if(o.type==='cikis'&&o.masraf==='1'){ // C3: COGS tahakkuku — nakit çıkmaz, K/Z'ye yansır
   const cost=+(+o.qty*(+it.cost||0)).toFixed(2);
   if(cost>0){S.txns.push(stampCreate({id:nid(),co:CO,type:'gider',date:o.date,amount:cost,cat:'Hammadde & Malzeme (kullanım)',accId:'',src:'stok',stokTxnId:stid,desc:'Stok kullanım maliyeti: '+(it.name||'')+' ('+o.qty+' '+(it.unit||'')+')'}));msg+=' + kullanım maliyeti tahakkuk gideri yazıldı ('+fmt0(cost)+')';}
   else msg+=' — birim maliyet 0 olduğundan gider yazılmadı';
  }
  save();toast(msg);go('stok');
 },init||{});
}

function stockDetail(id){ // C6: ürün detay sayfası — hareket dökümü + finansal bağlar
 const it=S.stock.find(x=>x.id===id&&!x.deletedAt);if(!it){toast('Ürün bulunamadı');return;}
 PAGE='stok';_navHi('stok');
 const q=stockQty(it);
 const moves=S.stockTxns.filter(t=>t.itemId===id&&!t.deletedAt).sort((a,b)=>a.date<b.date?1:-1);
 const alimT=moves.filter(t=>t.type==='giris').reduce((s,t)=>s+(+t.amount||0),0);
 const payTag=t=>{ // hareketin finansal bağını rozetle
  const tx=S.txns.find(x=>x.stokTxnId===t.id&&!x.deletedAt&&x.src!=='card'&&x.src!=='stok');
  if(tx){const a=S.accounts.find(x=>x.id===tx.accId);return a?` <span class="chip p" data-act="accDetail" data-arg="${a.id}" style="cursor:pointer" title="Hesap detayını aç">💸 ${esc(a.name)}</span>`:'';}
  const ct=S.cardTxns.find(x=>x.stokTxnId===t.id&&!x.deletedAt);
  if(ct){const cd=S.cards.find(x=>x.id===ct.cardId);return cd?` <span class="chip p" data-act="cardDetail" data-arg="${cd.id}" style="cursor:pointer" title="Kart detayını aç">💳 ${esc(cd.name)}</span>`:'';}
  const crt=S.cariTxns.find(x=>x.stokTxnId===t.id&&!x.deletedAt);
  if(crt){const cr=S.cari.find(x=>x.id===crt.cariId);return cr?` <span class="chip w" data-act="cariDetail" data-arg="${cr.id}" style="cursor:pointer" title="Cari detayını aç">📝 Veresiye · ${esc(cr.name)}</span>`:'';}
  const stx=S.txns.find(x=>x.stokTxnId===t.id&&!x.deletedAt&&x.src==='stok');
  if(stx)return ` <span class="chip g" title="Tahakkuk gideri — kasadan para çıkmadı">🧾 COGS ${fmt0(stx.amount)}</span>`;
  return '';
 };
 document.getElementById('main').innerHTML= topbar('📦 '+esc(it.name),
  `<button class="btn gh" data-act="go" data-arg="stok">← Stok Takibi</button>`)+
 `<div class="grid g3" style="margin-bottom:16px">
   <div class="kpi ${q<=+(it.min||0)?'n':'a'}"><div class="l">Mevcut Miktar</div><div class="v">${q.toLocaleString('tr-TR')} ${esc(it.unit||'')}</div><div class="s">Kritik sınır: ${(+it.min||0).toLocaleString('tr-TR')}${q<=+(it.min||0)?' · ⚠ kritik seviyede':''}</div></div>
   <div class="kpi"><div class="l">Stok Değeri</div><div class="v">${fmt0(q*(+it.cost||0))}</div><div class="s">Birim maliyet: ${fmt(it.cost)}</div></div>
   <div class="kpi"><div class="l">Toplam Alım Tutarı</div><div class="v">${fmt0(alimT)}</div><div class="s">${moves.length} hareket</div></div>
  </div>
  <div class="card" style="margin-bottom:14px"><div class="cardBtns" style="margin:0">
   <button class="btn sm" data-act="stockTxnForm" data-arg="${it.id}">⇅ Hareket Gir</button>
   <button class="btn sm gh" data-act="stockForm" data-arg="${it.id}">✎ Düzenle</button>
  </div></div>
  <div class="card"><h2>Hareket Dökümü</h2>
  ${moves.length?'<table><thead><tr><th>Tarih</th><th>Hareket</th><th class="num">Miktar</th><th class="num">Tutar</th><th class="rowact"></th></tr></thead><tbody>'+
   moves.map(t=>`<tr><td>${dTR(t.date)}</td><td><span class="chip ${t.type==='giris'?'p':'n'}">${t.type==='giris'?'Giriş':'Çıkış'}</span> <span class="tiny">${esc(t.desc||'')}</span>${payTag(t)}</td>
   <td class="num">${(+t.qty).toLocaleString('tr-TR')} ${esc(it.unit||'')}</td><td class="num">${+t.amount>0?fmt(t.amount):'—'}</td>
   <td class="rowact"><button data-act="del" data-arg="stokT~${t.id}">🗑</button></td></tr>`).join('')+'</tbody></table>'
   :'<div class="empty"><b>Hareket yok</b>"⇅ Hareket Gir" ile giriş/çıkış ekleyin.</div>'}</div>`;
 try{window.scrollTo(0,0);}catch(e){}
}

/* ---------- DEMİRBAŞ ---------- */
function rAsset(){
 const list=byCo(S.assets,CO).sort((a,b)=>a.date<b.date?1:-1);
 const toplam=list.reduce((s,a)=>s+ +(a.cost||0),0);
 const AD={aktif:['Kullanımda','p'],bakim:['Bakımda','w'],hurda:['Hurda','n']};
 document.getElementById('main').innerHTML= topbar('Demirbaş & Varlıklar',
  `<button class="btn" data-act="assetForm">＋ Demirbaş Ekle</button>`)+
 `<div class="grid g3" style="margin-bottom:16px">
   <div class="kpi"><div class="l">Demirbaş Adedi</div><div class="v">${list.length}</div></div>
   <div class="kpi a"><div class="l">Toplam Kayıtlı Değer</div><div class="v">${fmt0(toplam)}</div></div>
   <div class="kpi"><div class="l">Bakımda / Hurda</div><div class="v">${list.filter(a=>a.durum!=='aktif').length}</div></div>
  </div>
  <div class="card"><h2>Demirbaş Listesi</h2>
  ${list.length? '<table><thead><tr><th>Demirbaş</th><th class="hidem">Konum</th><th>Alım</th><th class="num">Bedel</th><th>Durum</th><th class="rowact"></th></tr></thead><tbody>'+
   list.map(a=>`<tr data-act="assetDetail" data-arg="${a.id}" style="cursor:pointer" title="Demirbaş detay sayfasını aç"><td><span class="avat sm" style="background:${hashColor(a.name)}">${esc(a.name.charAt(0))}</span> <b>${esc(a.name)}</b> <span class="tiny">${esc(a.cat||'')}</span></td>
   <td class="hidem">${esc(a.loc||'')}</td><td>${dTR(a.date)}</td><td class="num">${fmt(a.cost)}</td>
   <td><span class="chip ${AD[a.durum||'aktif'][1]}">${AD[a.durum||'aktif'][0]}</span></td>
   <td class="rowact">${(a.durum||'aktif')!=='hurda'?`<button data-act="assetSellForm" data-arg="${a.id}" title="Sat / hurdaya ayır — satış bedeli hesaba gelir yazılır">💰</button>`:''}<button data-act="assetForm" data-arg="${a.id}">✎</button><button data-act="del" data-arg="asset~${a.id}">🗑</button></td></tr>`).join('')+
   foot([['<b>TOPLAM</b>'],['','hidem'],[''],['<b>'+fmt(toplam)+'</b>','num'],[''],['','rowact']])+'</tbody></table>'
   :'<div class="empty"><b>Demirbaş kaydı yok</b>Fırın, buzdolabı, POS cihazı, mobilya gibi işletme varlıklarınızın envanterini tutun.</div>'}
 </div>`;
}
function assetForm(id){
 const init=id?S.assets.find(x=>x.id===id):{durum:'aktif',date:todayISO()};
 const payOpts=[['','— Ödeme kaydı oluşturma (eski/önceden ödenmiş kayıt) —']].concat(payMethodOpts(CO).slice(1)).concat([['cari','📝 Veresiye (satıcı carisine borç yaz)']]);
 const flds=[
  {name:'name',label:'Demirbaş adı',req:1,ph:'Ör: Konveksiyonlu Fırın'},
  {row:[{name:'cat',label:'Kategori',ph:'Mutfak ekipmanı'},{name:'loc',label:'Konum',ph:'Mutfak / Salon'}]},
  {row:[{name:'date',label:'Alım tarihi',type:'date',def:todayISO()},{name:'cost',label:'Alım bedeli (₺)',type:'number',req:1}]},
  {name:'durum',label:'Durum',type:'select',opts:[['aktif','Kullanımda'],['bakim','Bakımda'],['hurda','Hurda']]},
  {name:'note',label:'Not (seri no vb.)'}
 ];
 if(!id)flds.push( // A2: yeni alımda ödeme bağlantısı — bakiye/K-Z/bütçe etkilenir
  {name:'method',label:'Ödeme yöntemi (seçilirse gider kaydı oluşur)',type:'select',opts:payOpts},
  {name:'cariId',label:'Satıcı cari (veresiye için zorunlu, diğerlerinde opsiyonel)',type:'select',opts:cariOpts(CO)});
 openForm(id?'Demirbaş Düzenle':'Yeni Demirbaş',flds,o=>{
  if(id){Object.assign(init,o);save();toast('Demirbaş kaydedildi');go('asset');return;}
  if(o.method==='cari'&&!o.cariId){toast('⚠ Veresiye seçtiniz — satıcı carisini seçin.');return;}
  const aid=nid();
  const rec={id:aid,co:CO,name:o.name,cat:o.cat,loc:o.loc,date:o.date,cost:o.cost,durum:o.durum,note:o.note};
  S.assets.push(stampCreate(rec));
  let msg='Demirbaş kaydedildi';
  if(o.method&&+o.cost>0){
   const _desc='Demirbaş alımı: '+o.name;
   if(o.method==='cari'){
    S.cariTxns.push(stampCreate({id:nid(),co:CO,cariId:o.cariId,type:'alacak',amount:+o.cost,date:o.date,assetId:aid,desc:_desc+' (veresiye)'}));
    msg+=' + satıcı carisine borç yazıldı';
   }else if(o.method.indexOf('card:')===0){
    const cardId=o.method.slice(5),cdid=nid();
    S.cardTxns.push(stampCreate({id:cdid,co:CO,cardId:cardId,type:'harcama',amount:+o.cost,date:o.date,cat:'Demirbaş & Yatırım',taksit:1,assetId:aid,desc:_desc}));
    S.txns.push(stampCreate({id:nid(),co:CO,type:'gider',date:o.date,amount:+o.cost,cat:'Demirbaş & Yatırım',accId:'',src:'card',cardTxnId:cdid,assetId:aid,desc:_desc+' (kredi kartı)'}));
    msg+=' + kredi kartına işlendi';
   }else{
    S.txns.push(stampCreate({id:nid(),co:CO,type:'gider',date:o.date,amount:+o.cost,cat:'Demirbaş & Yatırım',accId:o.method,assetId:aid,cariId:o.cariId||'',desc:_desc}));
    msg+=' + gider hesaptan düşüldü';
    if(o.cariId&&S.cari.find(x=>x.id===o.cariId&&!x.deletedAt)){ /* v14-A3: peşin alımda satıcı cari seçimi eskiden ölüydü */
     S.cariTxns.push(stampCreate({id:nid(),co:CO,cariId:o.cariId,type:'alacak',amount:+o.cost,date:o.date,assetId:aid,desc:_desc+' (peşin alım)'}));
     S.cariTxns.push(stampCreate({id:nid(),co:CO,cariId:o.cariId,type:'borc',amount:+o.cost,date:o.date,assetId:aid,desc:_desc+' — peşin ödendi'}));
     msg+=' + satıcı ekstresine işlendi';
    }
   }
  }
  save();toast(msg);go('asset');
 },init||{});
}
function assetSellForm(id){ // A2: hurda/satışta gelir kaydı — para hangi hesaba girdi
 const a=S.assets.find(x=>x.id===id);if(!a)return;
 const opts=accOpts(CO);
 if(!opts.length)return toast('Önce Banka & Kasa ekranından bir hesap ekleyin');
 openForm('💰 Sat / Hurdaya Ayır — '+a.name,[
  {row:[{name:'amount',label:'Satış bedeli (₺ — hurda/bedelsizse 0)',type:'number',req:1,def:0},{name:'date',label:'Tarih',type:'date',def:todayISO(),req:1}]},
  {name:'accId',label:'Para hangi hesaba girdi (bedel > 0 için zorunlu)',type:'select',opts:accOpts(CO,1)}
 ],o=>{
  if(+o.amount>0&&!o.accId){toast('⚠ Satış bedeli girdiniz — paranın girdiği hesabı seçin (boşta para yasak).');return;}
  a.durum='hurda';
  if(+o.amount>0){
   S.txns.push(stampCreate({id:nid(),co:CO,type:'gelir',date:o.date,amount:+o.amount,cat:'Diğer Gelir',accId:o.accId,assetId:id,desc:'Demirbaş satışı: '+a.name}));
  }
  try{logAudit('Demirbaş satış/hurda',a.name+' '+fmt0(o.amount));}catch(e){}
  save();toast(+o.amount>0?'Demirbaş satıldı — gelir hesaba işlendi':'Demirbaş hurdaya ayrıldı');go('asset');
 });
}

function assetDetail(id){ // C6: demirbaş detay sayfası — alım kaydı bağlantısı + durum
 const a=S.assets.find(x=>x.id===id&&!x.deletedAt);if(!a){toast('Demirbaş bulunamadı');return;}
 PAGE='asset';_navHi('asset');
 const AD={aktif:['Kullanımda','p'],bakim:['Bakımda','w'],hurda:['Hurda','n']};
 const ltx=S.txns.filter(t=>t.assetId===id&&!t.deletedAt);
 const lct=S.cariTxns.filter(t=>t.assetId===id&&!t.deletedAt);
 const lcd=S.cardTxns.filter(t=>t.assetId===id&&!t.deletedAt);
 document.getElementById('main').innerHTML= topbar('🏷 '+esc(a.name),
  `<button class="btn gh" data-act="go" data-arg="asset">← Demirbaşlar</button>`)+
 `<div class="grid g3" style="margin-bottom:16px">
   <div class="kpi a"><div class="l">Alım Bedeli</div><div class="v">${fmt0(a.cost)}</div><div class="s">Alım: ${dTR(a.date)}</div></div>
   <div class="kpi ${AD[a.durum||'aktif'][1]==='n'?'n':''}"><div class="l">Durum</div><div class="v" style="font-size:19px">${AD[a.durum||'aktif'][0]}</div><div class="s">${esc(a.cat||'')}${a.loc?' · '+esc(a.loc):''}</div></div>
   <div class="kpi"><div class="l">Finansal Bağlantı</div><div class="v" style="font-size:19px">${(ltx.length||lct.length||lcd.length)?'✓ Bağlı':'—'}</div><div class="s">${(ltx.length||lct.length||lcd.length)?'Alım/satış kayıtları aşağıda':'Alım hiçbir hesaba işlenmemiş (eski kayıt)'}</div></div>
  </div>
  <div class="card" style="margin-bottom:14px"><div class="cardBtns" style="margin:0">
   ${(a.durum||'aktif')!=='hurda'?`<button class="btn sm" data-act="assetSellForm" data-arg="${a.id}">💰 Sat / Hurdaya Ayır</button>`:''}
   <button class="btn sm gh" data-act="assetForm" data-arg="${a.id}">✎ Düzenle</button>
  </div></div>
  ${(ltx.length||lct.length||lcd.length)?`<div class="card"><h2>Bağlı Finansal Kayıtlar</h2><table><tbody>
   ${ltx.map(t=>{const ac=S.accounts.find(x=>x.id===t.accId);return `<tr><td>${dTR(t.date)}</td><td><span class="chip ${t.type==='gelir'?'p':'n'}">${t.type==='gelir'?'Gelir (satış)':'Gider (alım)'}</span> ${esc(t.desc||'')} ${ac?`<span class="chip g" data-act="accDetail" data-arg="${ac.id}" style="cursor:pointer">🏦 ${esc(ac.name)}</span>`:t.src==='card'?'<span class="chip g">💳 kredi kartı</span>':''}</td><td class="num">${fmt(t.amount)}</td></tr>`;}).join('')}
   ${lct.map(t=>{const cr=S.cari.find(x=>x.id===t.cariId);return `<tr><td>${dTR(t.date)}</td><td><span class="chip w">📝 Veresiye</span> ${esc(t.desc||'')} ${cr?`<span class="chip g" data-act="cariDetail" data-arg="${cr.id}" style="cursor:pointer">👥 ${esc(cr.name)}</span>`:''}</td><td class="num">${fmt(t.amount)}</td></tr>`;}).join('')}
  </tbody></table></div>`:''}
  ${a.note?`<div class="card"><h2>Not</h2><p style="font-size:13px;white-space:pre-wrap">${esc(a.note)}</p></div>`:''}`;
 try{window.scrollTo(0,0);}catch(e){}
}

/* ---------- BÜTÇE KONTROLÜ ---------- */
var budPer='';var budMode='nakit'; // B3: dönem seçimi + tahakkuk görünümü
function budSetPer(v){if(v)budPer=v;go('budget');}
function setBudMode(v){budMode=v==='tahakkuk'?'tahakkuk':'nakit';go('budget');}
function rBudget(){
 const allB=byCo(S.budgets,CO);
 const list=allB.filter(b=>(b.type||'gider')!=='gelir'); // C4: gider butceleri (geriye uyumlu varsayilan)
 const gelirList=allB.filter(b=>(b.type||'gider')==='gelir'); // C4: ciro/gelir hedefleri
 const per=budPer||monthISO(); // B3: seçili dönem (varsayılan bu ay)
 const _isCur=per===monthISO();
 const ayGunu=new Date(+per.slice(0,4),+per.slice(5,7),0).getDate();
 const _to=_isCur?todayISO():per+'-'+String(ayGunu).padStart(2,'0');
 const s= budMode==='tahakkuk'? accrualAdjust(CO,per+'-01',_to,sumRange(CO,per+'-01',_to,{skipCariLinked:true})) : sumRange(CO,per+'-01',_to); // B3: tahakkukta fatura+stok giderleri de görünür
 const gecenGun=_isCur?+todayISO().slice(8):ayGunu;
 const paceK=gecenGun/ayGunu; // C4: ay icinde gecen gun orani
 const hedef=list.reduce((t,b)=>t+ +b.amount,0);
 const gercek=list.reduce((t,b)=>t+(s.byCat[b.cat]||0),0);
 document.getElementById('main').innerHTML= topbar('Bütçe Kontrolü',
  `<button class="btn" data-act="budgetForm">＋ Bütçe Kalemi</button>`)+
 `<div class="card"><div class="filters"><span class="mut" style="align-self:center">Dönem:</span>
  <input type="month" value="${per}" data-actv="budSetPer">
  <button class="btn sm ${_isCur?'':'gh'}" data-act="budSetPer" data-arg="${monthISO()}">Bu Ay</button>
  <button class="btn sm gh" data-act="budSetPer" data-arg="${periodAdd(monthISO(),-1)}">Geçen Ay</button></div>
  ${seg([['nakit','💵 Nakit'],['tahakkuk','🧾 Tahakkuk (fatura + stok dahil)']],budMode,'setBudMode')}</div>
 <div class="grid g3" style="margin-bottom:16px">
   <div class="kpi"><div class="l">${mTR(per)} Bütçesi</div><div class="v">${fmt0(hedef)}</div></div>
   <div class="kpi ${gercek>hedef?'n':'p'}"><div class="l">Gerçekleşen Gider</div><div class="v">${fmt0(gercek)}</div></div>
   <div class="kpi a"><div class="l">Kalan Bütçe</div><div class="v">${fmt0(hedef-gercek)}</div><div class="s">Kullanım: %${hedef?(gercek/hedef*100).toFixed(1):0}</div></div>
  </div>
  ${gelirList.length?`<div class="card"><h2>🎯 Ciro Hedefi — ${mTR(per)}</h2>
  ${gelirList.map(b=>{
    const g2=s.byCatG[b.cat]||0;const pct2=Math.min(100,g2/(+b.amount||1)*100);
    const beklenen2=+b.amount*paceK;const geride=g2<beklenen2*0.95;
    return `<div class="hb"><div class="hbT"><span><b>${esc(b.cat)}</b> ${geride?'<span class="chip w">Hedefin gerisinde</span>':g2>=+b.amount?'<span class="chip p">Hedef aşıldı 🎉</span>':'<span class="chip g">Yolunda</span>'}</span>
     <b>${fmt0(g2)} / ${fmt0(b.amount)} <button class="btn sm gh" data-act="budgetForm" data-arg="${b.id}">✎</button><button class="btn sm gh" data-act="del" data-arg="budget~${b.id}">🗑</button></b></div>
    <div class="hbTrack" style="height:12px"><div class="hbFill" style="width:${pct2}%;background:${geride?'var(--warn)':'var(--pos)'}"></div></div>
    <div class="tiny" style="margin-top:2px">%${(g2/(+b.amount||1)*100).toFixed(1)} gerçekleşti · gün-orantılı beklenen: ${fmt0(beklenen2)} (ayın ${gecenGun}/${ayGunu}. günü)</div></div>`;
  }).join('')}</div>`:''}
  <div class="card"><h2>Kategori Bazlı Bütçe Takibi — ${mTR(per)}</h2>
  ${list.length? list.map(b=>{
    const g=s.byCat[b.cat]||0;const pct=Math.min(100,g/(+b.amount||1)*100);const asim=g>+b.amount;
    const beklenen=+b.amount*paceK;const hizli=!asim&&g>beklenen*1.1;
    return `<div class="hb"><div class="hbT"><span><span data-act="goTxCat" data-arg="gider~${esc(b.cat)}~${per}-01~${_to}" style="cursor:pointer" title="Bu kategorinin dönem işlemlerini aç"><b>${esc(b.cat)} ↗</b></span> ${asim?'<span class="chip n">Bütçe aşıldı!</span>':hizli?'<span class="chip w">Hızlı gidiyor — gün-orantılı beklenen '+fmt0(beklenen)+'</span>':''}</span>
     <b>${fmt0(g)} / ${fmt0(b.amount)} <button class="btn sm gh" data-act="budgetForm" data-arg="${b.id}">✎</button><button class="btn sm gh" data-act="del" data-arg="budget~${b.id}">🗑</button></b></div>
    <div class="hbTrack" style="height:12px"><div class="hbFill" style="width:${pct}%;background:${asim?'var(--neg)':pct>85?'var(--warn)':'var(--pos)'}"></div></div>
    <div class="tiny" style="margin-top:2px">%${(g/(+b.amount||1)*100).toFixed(1)} kullanıldı · kalan ${fmt0(Math.max(0,+b.amount-g))}${asim?' · aşım '+fmt0(g-+b.amount):''}</div></div>`;
   }).join('')+`<table style="margin-top:10px"><tbody>${foot([['<b>TOPLAM</b>'],['<b>'+fmt(gercek)+' / '+fmt(hedef)+'</b>','num']])}</tbody></table>`
   :'<div class="empty"><b>Bütçe tanımlı değil</b>Gider kategorilerinize aylık hedef koyun; gerçekleşen harcamalar otomatik karşılaştırılır, aşımda uyarılırsınız.</div>'}
 </div>`;
}
function budgetForm(id){
 const init=id?S.budgets.find(x=>x.id===id):{type:'gider'};
 openForm(id?'Bütçe Düzenle':'Bütçe Kalemi',[
  {name:'type',label:'Tür',type:'select',opts:[['gider','Gider bütçesi (üstüne çıkma)'],['gelir','Ciro / gelir hedefi (altında kalma)']]},
  {name:'cat',label:'Kategori',type:'select',opts:catOpts((init&&init.type)==='gelir'?'gelir':'gider'),req:1},
  {name:'amount',label:'Aylık hedef (₺)',type:'number',req:1,min:1}
 ],o=>{
  if(id)Object.assign(init,o);
  else{
   const var_=S.budgets.find(b=>b.co===CO&&b.cat===o.cat&&(b.type||'gider')===(o.type||'gider')&&!b.deletedAt);
   if(var_)var_.amount=o.amount; else S.budgets.push({id:nid(),co:CO,...o});
  }
  save();toast('Bütçe kaydedildi');go('budget');
 },init||{});
 setTimeout(function(){ // C4: tur degisince kategori listesi gelir/gider olarak degisir
  var tp=document.querySelector('#mForm select[name="type"]'),cat=document.querySelector('#mForm select[name="cat"]');
  if(!tp||!cat)return;
  var fill=function(){
   var opts=catOpts(tp.value==='gelir'?'gelir':'gider');
   var cur=cat.value;
   cat.innerHTML=opts.map(function(c){var v=Array.isArray(c)?c[0]:c,l=Array.isArray(c)?c[1]:c;return '<option value="'+esc(v)+'">'+esc(l)+'</option>';}).join('');
   if(opts.some(function(c){return String(Array.isArray(c)?c[0]:c)===String(cur);}))cat.value=cur;
  };
  tp.addEventListener('change',fill);
 },90);
}

/* ---------- EXCEL / PDF DIŞA AKTARIM MERKEZİ ---------- */
/* ================== v12 — FORMÜL TABANLI, TAM BAĞLANTILI EXCEL YEDEKLEME ==================
   Hesaplar/Cariler/Kartlar/Stok bakiyeleri kendi hareket sayfalarından CANLI Excel
   formülleriyle (SUMIFS) hesaplanır; Özet sayfası tüm alt sayfalardan formülle beslenir;
   GRUP karşılaştırması her şirketin kendi sayfalarına çapraz-referans verir. Bir hücreyi
   değiştirirseniz bağlı toplamlar Excel içinde otomatik güncellenir. ================== */
function xmlE(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function xlStr(s){ return '"'+String(s==null?'':s).replace(/"/g,'""')+'"'; }
function FX(f,v,t){ return {f:f, v:v, t:t||'Number'}; }
function xCell(v){
 if(v&&typeof v==='object'&&typeof v.f==='string'){
  var t=v.t||'Number';
  var dv = t==='String' ? xmlE(v.v==null?'':v.v) : (isFinite(v.v)?v.v:0);
  return '<Cell ss:Formula="'+xmlE(v.f)+'"><Data ss:Type="'+t+'">'+dv+'</Data></Cell>';
 }
 if(typeof v==='number'&&isFinite(v))return '<Cell><Data ss:Type="Number">'+v+'</Data></Cell>';
 return '<Cell><Data ss:Type="String">'+xmlE(v)+'</Data></Cell>';
}
function xSheet(name,rows){
 name=String(name).replace(/[\[\]\/\\?*:]/g,' ').slice(0,31);
 return '<Worksheet ss:Name="'+xmlE(name)+'"><Table>'+rows.map(r=>'<Row>'+r.map(xCell).join('')+'</Row>').join('')+'</Table></Worksheet>';
}
function buildXLS(sheets){
 return '<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>'+
 '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'+sheets.join('')+'</Workbook>';
}
function sheetNm(nm){ return String(nm).replace(/[\[\]\/\\?*:]/g,' ').slice(0,31); }
function qref(nm){ return "'"+sheetNm(nm)+"'!"; }
function xlRange(col,startRow,count){ const endRow = count>0 ? (startRow+count-1) : startRow; return '$'+col+'$'+startRow+':$'+col+'$'+endRow; }
function coSheets(co,pre){
 pre=pre||'';
 const n=v=>+v||0;
 const accs=byCo(S.accounts,co), txnsSorted=byCo(S.txns,co).slice().sort((a,b)=>a.date<b.date?-1:1);
 const pes=byCo(S.posEntries,co).slice().sort((a,b)=>a.date<b.date?-1:1);
 const cards=byCo(S.cards,co), cts=byCo(S.cardTxns,co).slice().sort((a,b)=>a.date<b.date?-1:1);
 const caris=byCo(S.cari,co), crts=byCo(S.cariTxns,co).slice().sort((a,b)=>a.date<b.date?-1:1);
 const stf=byCo(S.staff,co), sts=byCo(S.staffTxns,co).slice().sort((a,b)=>a.date<b.date?-1:1);
 const fxs=byCo(S.fixed,co), fls=byCo(S.fixedLogs,co).slice().sort((a,b)=>a.period<b.period?-1:1);
 const cqs=byCo(S.cheques,co), stk=byCo(S.stock,co), stts=byCo(S.stockTxns,co).slice().sort((a,b)=>a.date<b.date?-1:1);
 const ass=byCo(S.assets,co), bds=byCo(S.budgets,co), tks=byCo(S.tasks,co);
 const sheets=[];
 const NM={tx:pre+'İşlemler',hs:pre+'Hesaplar',kt:pre+'Kartlar',kh:pre+'Kart Hareket',
  cr:pre+'Cariler',ch:pre+'Cari Hareket',st:pre+'Stok',sh:pre+'Stok Hareket',bg:pre+'Bütçe',pr:pre+'Personel',db:pre+'Demirbaş'};

 const N_TX=txnsSorted.length;
 const txRows=[['Tarih','Tür','Kategori','Hesap','Hedef Hesap (Virman)','Açıklama','Tutar','KDV %','KDV Tutarı (Formül)','Belge No','Cari']]; // v14-X1: belge no ve cari Excel'de hiç yoktu
 txnsSorted.forEach((t,idx)=>{
  const a=S.accounts.find(x=>x.id===t.accId)||{}, a2=S.accounts.find(x=>x.id===t.accId2)||{};
  const row=idx+2, vatRate=t.vat?+t.vat:'';
  const kdvF='=IF(H'+row+'="",0,G'+row+'*H'+row+'/(100+H'+row+'))';
  const kdvVal=vatRate?(+t.amount*vatRate/(100+vatRate)):0;
  txRows.push([t.date, t.type==='gelir'?'Gelir':t.type==='gider'?'Gider':'Virman', t.cat||'',
   a.name||(t.src==='card'?'Kredi kartı':''), a2.name||'', t.desc||'', n(t.amount), vatRate, FX(kdvF,kdvVal), t.doc||'', (S.cari.find(x=>x.id===t.cariId)||{}).name||'']);
 });
 const gelirToplam=txnsSorted.filter(t=>t.type==='gelir').reduce((s,t)=>s+n(t.amount),0);
 const giderToplam=txnsSorted.filter(t=>t.type==='gider').reduce((s,t)=>s+n(t.amount),0);
 txRows.push([]);
 const TOPGELIR_ROW=N_TX+3, TOPGIDER_ROW=N_TX+4, NET_ROW=N_TX+5;
 txRows.push(['Toplam Gelir', FX(N_TX?'=SUMIF('+xlRange('B',2,N_TX)+','+xlStr('Gelir')+','+xlRange('G',2,N_TX)+')':'=0', gelirToplam)]);
 txRows.push(['Toplam Gider', FX(N_TX?'=SUMIF('+xlRange('B',2,N_TX)+','+xlStr('Gider')+','+xlRange('G',2,N_TX)+')':'=0', giderToplam)]);
 txRows.push(['Net', FX('=B'+TOPGELIR_ROW+'-B'+TOPGIDER_ROW, gelirToplam-giderToplam)]);
 sheets.push(xSheet(NM.tx, txRows));

 const kdvTahsilF=N_TX?'=SUMIF('+qref(NM.tx)+xlRange('B',2,N_TX)+','+xlStr('Gelir')+','+qref(NM.tx)+xlRange('I',2,N_TX)+')':'=0';
 const kdvOdenenF=N_TX?'=SUMIF('+qref(NM.tx)+xlRange('B',2,N_TX)+','+xlStr('Gider')+','+qref(NM.tx)+xlRange('I',2,N_TX)+')':'=0';
 const kdvAll=kdvSummary(co,'0000-01-01','9999-12-31');
 sheets.push(xSheet(pre+'KDV',[
  ['KDV ÖZETİ — '+coName(co)+' (tüm zamanlar, formül — İşlemler sayfasındaki KDV Tutarı sütunundan)'],[],
  ['Tahsil Edilen KDV (Satış)', FX(kdvTahsilF,kdvAll.tahsil)],
  ['Ödenen KDV (Alış/Gider)', FX(kdvOdenenF,kdvAll.odenen)],
  ['Net (Ödenecek / Devreden)', FX('=B3-B4',kdvAll.tahsil-kdvAll.odenen)],
  [],['Not: Hesaplama, tutarların KDV dahil girildiğini varsayar (Tutar×Oran/(100+Oran)). Bu vergi danışmanlığı değildir — beyanname öncesi muhasebecinizle teyit edin.']
 ]));

 /* v30: AYLIK ÖZET — ilk işlemden bugüne kadar HER AYIN gelir/gider/net dökümü, canlı SUMIFS formülleriyle. */
 const monthEndOf=p=>{const parts=p.split('-'),y=+parts[0],m=+parts[1];const nm=m===12?(y+1)+'-01-01':y+'-'+String(m+1).padStart(2,'0')+'-01';return addDays(nm,-1);};
 const monthList=[];
 if(N_TX){
  let cur=txnsSorted[0].date.slice(0,7);
  const endP=todayISO().slice(0,7);
  while(cur<=endP){ monthList.push(cur); const parts=cur.split('-'),y=+parts[0],m=+parts[1]; cur=m===12?(y+1)+'-01':y+'-'+String(m+1).padStart(2,'0'); }
 }
 const aylikRows=[['Ay','Gelir (Formül)','Gider (Formül)','Net (Formül)']];
 monthList.forEach((p,idx)=>{
  const row=idx+2, mStart=p+'-01', mEnd=monthEndOf(p);
  const gF='=SUMIFS('+qref(NM.tx)+xlRange('G',2,N_TX)+','+qref(NM.tx)+xlRange('B',2,N_TX)+','+xlStr('Gelir')+','+qref(NM.tx)+xlRange('A',2,N_TX)+','+xlStr('>='+mStart)+','+qref(NM.tx)+xlRange('A',2,N_TX)+','+xlStr('<='+mEnd)+')';
  const xF='=SUMIFS('+qref(NM.tx)+xlRange('G',2,N_TX)+','+qref(NM.tx)+xlRange('B',2,N_TX)+','+xlStr('Gider')+','+qref(NM.tx)+xlRange('A',2,N_TX)+','+xlStr('>='+mStart)+','+qref(NM.tx)+xlRange('A',2,N_TX)+','+xlStr('<='+mEnd)+')';
  const s=sumRange(co,mStart,mEnd);
  aylikRows.push([mTR(p), FX(gF,s.gelir), FX(xF,s.gider), FX('=B'+row+'-C'+row,s.gelir-s.gider)]);
 });
 if(monthList.length){
  aylikRows.push([]);
  aylikRows.push(['TOPLAM', FX('=SUM('+xlRange('B',2,monthList.length)+')',gelirToplam), FX('=SUM('+xlRange('C',2,monthList.length)+')',giderToplam), FX('=SUM('+xlRange('D',2,monthList.length)+')',gelirToplam-giderToplam)]);
 }else{
  aylikRows.push(['Henüz işlem yok — ilk gelir/gider girildiğinde aylar burada otomatik listelenir.']);
 }
 sheets.push(xSheet(pre+'Aylık Özet', aylikRows));

 const hsRows=[['Hesap','Tür','Banka','IBAN','Açılış','Bakiye (Formül)']];
 accs.forEach((a,idx)=>{
  const row=idx+2;
  const f='=E'+row
   +'+SUMIFS('+qref(NM.tx)+xlRange('G',2,N_TX)+','+qref(NM.tx)+xlRange('D',2,N_TX)+',A'+row+','+qref(NM.tx)+xlRange('B',2,N_TX)+','+xlStr('Gelir')+')'
   +'-SUMIFS('+qref(NM.tx)+xlRange('G',2,N_TX)+','+qref(NM.tx)+xlRange('D',2,N_TX)+',A'+row+','+qref(NM.tx)+xlRange('B',2,N_TX)+','+xlStr('Gider')+')'
   +'+SUMIFS('+qref(NM.tx)+xlRange('G',2,N_TX)+','+qref(NM.tx)+xlRange('E',2,N_TX)+',A'+row+','+qref(NM.tx)+xlRange('B',2,N_TX)+','+xlStr('Virman')+')'
   +'-SUMIFS('+qref(NM.tx)+xlRange('G',2,N_TX)+','+qref(NM.tx)+xlRange('D',2,N_TX)+',A'+row+','+qref(NM.tx)+xlRange('B',2,N_TX)+','+xlStr('Virman')+')';
  hsRows.push([a.name, a.type==='kasa'?'Kasa':'Banka', a.bankName||'', a.iban||'', n(a.opening), FX(f,accBalance(a))]);
 });
 const nakitBankaToplam=accs.reduce((s,a)=>s+accBalance(a),0);
 const HESAP_TOTAL_ROW=accs.length+3;
 if(accs.length){ hsRows.push([]); hsRows.push(['TOPLAM','','','', FX('=SUM('+xlRange('E',2,accs.length)+')',accs.reduce((s,a)=>s+n(a.opening),0)), FX('=SUM('+xlRange('F',2,accs.length)+')',nakitBankaToplam)]); }
 sheets.push(xSheet(NM.hs, hsRows));

 const N_KH=cts.length;
 const khRows=[['Tarih','Kart','Tür','Kategori','Açıklama','Tutar']];
 cts.forEach(t=>{ const c=S.cards.find(x=>x.id===t.cardId)||{}; khRows.push([t.date, c.name||'', t.type==='odeme'?'Ödeme':'Harcama', t.cat||'', t.desc||'', n(t.amount)]); });
 sheets.push(xSheet(NM.kh, khRows));
 const ktRows=[['Kart','Banka','Limit','Borç (Formül)','Kesim Günü','Son Ödeme Günü']];
 cards.forEach((c,idx)=>{
  const row=idx+2;
  const f='=SUMIFS('+qref(NM.kh)+xlRange('F',2,N_KH)+','+qref(NM.kh)+xlRange('B',2,N_KH)+',A'+row+','+qref(NM.kh)+xlRange('C',2,N_KH)+','+xlStr('Harcama')+')'
   +'-SUMIFS('+qref(NM.kh)+xlRange('F',2,N_KH)+','+qref(NM.kh)+xlRange('B',2,N_KH)+',A'+row+','+qref(NM.kh)+xlRange('C',2,N_KH)+','+xlStr('Ödeme')+')';
  ktRows.push([c.name, c.bank||'', n(c.limit), FX(f,cardDebt(c)), n(c.cutDay), n(c.dueDay)]);
 });
 const kartBorcToplam=cards.reduce((s,c)=>s+Math.max(0,cardDebt(c)),0);
 const KART_TOTAL_ROW=cards.length+3;
 // v25 düzeltme: SUM yerine SUMIF(">0") — negatif bakiyeli (fazla ödenmiş) kartları uygulamayla aynı şekilde 0 sayar,
 // böylece dosya Excel'de yeniden hesaplandığında canlı formül ile ilk görünen değer artık HER ZAMAN aynı sonucu verir.
 if(cards.length){ ktRows.push([]); ktRows.push(['TOPLAM','','', FX('=SUMIF('+xlRange('D',2,cards.length)+',">0")',kartBorcToplam),'','']); }
 sheets.push(xSheet(NM.kt, ktRows));

 const N_CH=crts.length;
 const chRows=[['Tarih','Cari','Borç','Alacak','Vade','Açıklama']];
 crts.forEach(t=>{ const c=S.cari.find(x=>x.id===t.cariId)||{}; chRows.push([t.date, c.name||'', t.type==='borc'?n(t.amount):'', t.type==='alacak'?n(t.amount):'', t.vade||'', t.desc||'']); });
 sheets.push(xSheet(NM.ch, chRows));
 const crRows=[['Cari','Tür','Telefon','Vergi No','Açılış','Bakiye (Formül)','Durum (Formül)','E-posta']]; // v14-X2
 caris.forEach((c,idx)=>{
  const row=idx+2;
  const f='=E'+row+'+SUMIFS('+qref(NM.ch)+xlRange('C',2,N_CH)+','+qref(NM.ch)+xlRange('B',2,N_CH)+',A'+row+')'
   +'-SUMIFS('+qref(NM.ch)+xlRange('D',2,N_CH)+','+qref(NM.ch)+xlRange('B',2,N_CH)+',A'+row+')';
  const durumF='=IF(F'+row+'>0,'+xlStr('Bize borçlu')+',IF(F'+row+'<0,'+xlStr('Biz borçluyuz')+','+xlStr('Kapalı')+'))';
  const b=cariBalance(c);
  crRows.push([c.name, ({musteri:'Müşteri',tedarikci:'Tedarikçi',her2:'Her ikisi',diger:'Diğer'})[c.type]||'', c.phone||'', c.taxNo||'', n(c.opening), FX(f,b), FX(durumF, b>0?'Bize borçlu':b<0?'Biz borçluyuz':'Kapalı','String'), c.email||'']);
 });
 const cariAlacakToplam=caris.reduce((s,c)=>{const b=cariBalance(c);return s+(b>0?b:0);},0);
 const cariBorcToplam=caris.reduce((s,c)=>{const b=cariBalance(c);return s+(b<0?-b:0);},0);
 const CARI_ALACAK_ROW=caris.length+3, CARI_BORC_ROW=caris.length+4;
 if(caris.length){ crRows.push([]); crRows.push(['TOPLAM ALACAK (Formül)','','','','', FX('=SUMIF('+xlRange('F',2,caris.length)+',">0")',cariAlacakToplam),'']);
  crRows.push(['TOPLAM BORÇ (Formül)','','','','', FX('=-SUMIF('+xlRange('F',2,caris.length)+',"<0")',cariBorcToplam),'']); }
 sheets.push(xSheet(NM.cr, crRows));

 const posRows=[['Tarih','POS','Brüt','Komisyon','Net','Hesaba Geçiş','Durum']];
 pes.forEach(e=>{ const p=S.pos.find(x=>x.id===e.posId)||{}; posRows.push([e.date, p.name||'', n(e.gross), n(e.comm), n(e.net), e.settleDate, e.status==='gecti'?'Geçti':'Bekliyor']); });
 if(pes.length){ posRows.push([]); posRows.push(['TOPLAM','', FX('=SUM('+xlRange('C',2,pes.length)+')',pes.reduce((s,e)=>s+n(e.gross),0)), FX('=SUM('+xlRange('D',2,pes.length)+')',pes.reduce((s,e)=>s+n(e.comm),0)), FX('=SUM('+xlRange('E',2,pes.length)+')',pes.reduce((s,e)=>s+n(e.net),0)),'','']); }
 sheets.push(xSheet(pre+'POS', posRows));

 const N_PO=sts.length;
 const poRows=[['Tarih','Personel','Tür','Dönem','Tutar']];
 sts.forEach(t=>{ const x=S.staff.find(z=>z.id===t.staffId)||{}; poRows.push([t.date, x.name||'', ({maas:'Maaş',avans:'Avans',prim:'Prim',kesinti:'Kesinti'})[t.type]||t.type, t.period||'', n(t.amount)]); });
 if(sts.length){ poRows.push([]); poRows.push(['TOPLAM','','','', FX('=SUM('+xlRange('E',2,N_PO)+')',sts.reduce((s,t)=>s+n(t.amount),0))]); }
 sheets.push(xSheet(pre+'Personel Ödeme', poRows));
 const maasYuku=stf.filter(x=>x.active!=='0').reduce((s,x)=>s+n(x.salary),0);
 const PERSONEL_TOTAL_ROW=stf.length+3;
 sheets.push(xSheet(NM.pr,[['Personel','Görev','Telefon','Net Maaş','Durum','İşe Giriş','IBAN'], // v14-X3
  ...stf.map(x=>[x.name,x.pos||'',x.phone||'',n(x.salary),x.active==='0'?'Ayrıldı':'Aktif',x.startDate||'',x.iban||'']),
  ...(stf.length?[[],['AYLIK MAAŞ YÜKÜ (aktif personel)', FX('=SUMIF('+xlRange('E',2,stf.length)+','+xlStr('Aktif')+','+xlRange('D',2,stf.length)+')', maasYuku)]]:[])]));

 const N_OG=fls.length;
 const ogRows=[['Dönem','Ödeme','Tarih','Tutar']];
 fls.forEach(l=>{ const f=S.fixed.find(x=>x.id===l.fixedId)||{}; ogRows.push([l.period, f.name||'', l.paidDate, n(l.amount)]); });
 if(fls.length){ ogRows.push([]); ogRows.push(['TOPLAM','','', FX('=SUM('+xlRange('D',2,N_OG)+')',fls.reduce((s,l)=>s+n(l.amount),0))]); }
 sheets.push(xSheet(pre+'Öde.Geçmişi', ogRows));
 sheets.push(xSheet(pre+'Sabit Ödemeler',[['Ödeme','Tür','Gün','Aylık Tutar'], ...fxs.map(f=>[f.name,FTYPE[f.type]||'',n(f.payDay),n(f.amount)]),
  ...(fxs.length?[[],['TOPLAM AYLIK YÜK','','', FX('=SUM('+xlRange('D',2,fxs.length)+')',fxs.reduce((s,f)=>s+n(f.amount),0))]]:[])]));

 const cqRows=[['Yön','Tür','Kişi','Banka','No','Vade','Tutar','Durum']];
 cqs.forEach(c=>cqRows.push([c.tip==='alinan'?'Alınan':'Verilen', c.tur==='senet'?'Senet':'Çek', c.kisi, c.banka||'', c.no||'', c.vade, n(c.tutar), (CEK_DURUM_TR[c.durum]||'')])); /* v14-H3 */
 if(cqs.length){ cqRows.push([]); cqRows.push(['TOPLAM (Açık: Portföyde + Tahsilde)','','','','','', FX('=SUMIF('+xlRange('H',2,cqs.length)+','+xlStr('Portföyde')+','+xlRange('G',2,cqs.length)+')+SUMIF('+xlRange('H',2,cqs.length)+','+xlStr('Tahsilde')+','+xlRange('G',2,cqs.length)+')',cqs.filter(c=>c.durum==='portfoy'||c.durum==='tahsilde').reduce((s,c)=>s+n(c.tutar),0)),'']); } /* v14-X4 */
 sheets.push(xSheet(pre+'Çek Senet', cqRows));

 const N_SH=stts.length;
 const shRows=[['Tarih','Ürün','Yön','Miktar','Açıklama']];
 stts.forEach(t=>{ const it=S.stock.find(x=>x.id===t.itemId)||{}; shRows.push([t.date, it.name||'', t.type==='giris'?'Giriş':'Çıkış', n(t.qty), t.desc||'']); });
 sheets.push(xSheet(NM.sh, shRows));
 const stRows=[['Ürün','Birim','Başlangıç Miktar','Güncel Miktar (Formül)','Birim Maliyet','Stok Değeri (Formül)','Kritik Sınır']];
 stk.forEach((it,idx)=>{
  const row=idx+2;
  const qtyF='=C'+row+'+SUMIFS('+qref(NM.sh)+xlRange('D',2,N_SH)+','+qref(NM.sh)+xlRange('B',2,N_SH)+',A'+row+','+qref(NM.sh)+xlRange('C',2,N_SH)+','+xlStr('Giriş')+')'
   +'-SUMIFS('+qref(NM.sh)+xlRange('D',2,N_SH)+','+qref(NM.sh)+xlRange('B',2,N_SH)+',A'+row+','+qref(NM.sh)+xlRange('C',2,N_SH)+','+xlStr('Çıkış')+')';
  const q=stockQty(it);
  stRows.push([it.name, it.unit||'', n(it.qty), FX(qtyF,q), n(it.cost), FX('=D'+row+'*E'+row, q*n(it.cost)), n(it.min)]);
 });
 const stokDegerToplam=stk.reduce((s,it)=>s+stockQty(it)*n(it.cost),0);
 const STOK_TOTAL_ROW=stk.length+3;
 if(stk.length){ stRows.push([]); stRows.push(['TOPLAM STOK DEĞERİ','','','','', FX('=SUM('+xlRange('F',2,stk.length)+')',stokDegerToplam),'']); }
 sheets.push(xSheet(NM.st, stRows));

 const demirbasToplam=ass.reduce((s,a)=>s+n(a.cost),0);
 const DEMIRBAS_TOTAL_ROW=ass.length+3;
 sheets.push(xSheet(NM.db,[['Demirbaş','Kategori','Konum','Alım Tarihi','Bedel','Durum'],
  ...ass.map(a=>[a.name,a.cat||'',a.loc||'',a.date||'',n(a.cost),({aktif:'Kullanımda',bakim:'Bakımda',hurda:'Hurda'})[a.durum||'aktif']]),
  ...(ass.length?[[],['TOPLAM','','','', FX('=SUM('+xlRange('E',2,ass.length)+')',demirbasToplam),'']]:[])]));

 const bgRows=[['Kategori','Tür','Aylık Hedef','Bu Ay Gerçekleşen (Formül)','Fark (Formül)','% Kullanım (Formül)']]; // v14-R5: gelir hedefleri hep 0 görünüyordu
 const per=monthISO()+'-01', today=todayISO();
 const _bs=sumRange(co,per,today);
 bds.forEach((b,idx)=>{
  const row=idx+2;
  const _ig=(b.type||'gider')==='gelir';
  const gF=N_TX?'=SUMIFS('+qref(NM.tx)+xlRange('G',2,N_TX)+','+qref(NM.tx)+xlRange('C',2,N_TX)+',A'+row+','+qref(NM.tx)+xlRange('B',2,N_TX)+','+xlStr(_ig?'Gelir':'Gider')+','
   +qref(NM.tx)+xlRange('A',2,N_TX)+','+xlStr('>='+per)+','+qref(NM.tx)+xlRange('A',2,N_TX)+','+xlStr('<='+today)+')':'=0';
  const g=(_ig?_bs.byCatG:_bs.byCat)[b.cat]||0;
  bgRows.push([b.cat, _ig?'Gelir':'Gider', n(b.amount), FX(gF,g), FX('=C'+row+'-D'+row, n(b.amount)-g), FX('=IF(C'+row+'=0,0,D'+row+'/C'+row+'*100)', n(b.amount)?g/n(b.amount)*100:0)]);
 });
 sheets.push(xSheet(NM.bg, bgRows));

 sheets.push(xSheet(pre+'Görevler',[['Görev','Atanan','Teslim','Öncelik','Durum'],
  ...tks.map(t=>[t.title,t.who||'',t.due,t.pri==='yuksek'?'Acil':'Normal',({acik:'Bekliyor',devam:'Devam',tamam:'Tamamlandı'})[t.status]||''])]));

 const gK=Object.entries(sumRange(co,'0000-01-01','9999-12-31').byCat).sort((a,b)=>b[1]-a[1]);
 const gG=Object.entries(sumRange(co,'0000-01-01','9999-12-31').byCatG).sort((a,b)=>b[1]-a[1]);
 const ozRows=[
  ['LOLE FİNANS RAPORU — '+coName(co)],['Rapor tarihi',todayISO()],[],
  ['Toplam Gelir (tüm zamanlar)', FX('='+qref(NM.tx)+'B'+TOPGELIR_ROW, gelirToplam)],
  ['Toplam Gider', FX('='+qref(NM.tx)+'B'+TOPGIDER_ROW, giderToplam)],
  ['Net', FX('='+qref(NM.tx)+'B'+NET_ROW, gelirToplam-giderToplam)],
  ['Nakit + Banka', FX(accs.length?'='+qref(NM.hs)+'F'+HESAP_TOTAL_ROW:'=0', nakitBankaToplam)],
  ['Cari Alacak', FX(caris.length?'='+qref(NM.cr)+'F'+CARI_ALACAK_ROW:'=0', cariAlacakToplam)],
  ['Cari Borç', FX(caris.length?'='+qref(NM.cr)+'F'+CARI_BORC_ROW:'=0', cariBorcToplam)],
  ['Kart Borcu', FX(cards.length?'='+qref(NM.kt)+'D'+KART_TOTAL_ROW:'=0', kartBorcToplam)],
  ['Aylık Maaş Yükü', FX(stf.length?'='+qref(NM.pr)+'B'+PERSONEL_TOTAL_ROW:'=0', maasYuku)],
  ['Stok Değeri', FX(stk.length?'='+qref(NM.st)+'F'+STOK_TOTAL_ROW:'=0', stokDegerToplam)],
  ['Demirbaş Değeri', FX(ass.length?'='+qref(NM.db)+'E'+DEMIRBAS_TOTAL_ROW:'=0', demirbasToplam)],
  ['Net KDV (Ödenecek/Devreden)', FX("='"+sheetNm(pre+'KDV')+"'!B5", kdvAll.tahsil-kdvAll.odenen)],
  [],['GİDER KIRILIMI (tüm zamanlar — formül)'],
  ...gK.map(([c,v])=>[c, FX(N_TX?'=SUMIF('+qref(NM.tx)+xlRange('C',2,N_TX)+','+xlStr(c)+','+qref(NM.tx)+xlRange('G',2,N_TX)+')':'=0', v)]),
  [],['GELİR KIRILIMI (tüm zamanlar — formül)'],
  ...gG.map(([c,v])=>[c, FX(N_TX?'=SUMIF('+qref(NM.tx)+xlRange('C',2,N_TX)+','+xlStr(c)+','+qref(NM.tx)+xlRange('G',2,N_TX)+')':'=0', v)]),
 ];
 sheets.unshift(xSheet(pre+'Özet', ozRows));
 return {sheets, meta:{accCount:accs.length,carisCount:caris.length,cardsCount:cards.length,stfCount:stf.length,N_TX,
  nakitBankaToplam,cariAlacakToplam,cariBorcToplam,kartBorcToplam,maasYuku,HESAP_TOTAL_ROW,CARI_ALACAK_ROW,CARI_BORC_ROW,KART_TOTAL_ROW,PERSONEL_TOTAL_ROW}};
}
function excelCo(co){return buildXLS(coSheets(co,'').sheets);}
function excelGrup(){
 const ay=monthISO()+'-01', bugun=todayISO();
 const cmpRows=[['Şirket','Gelir (bu ay, Formül)','Gider (bu ay, Formül)','Net (Formül)','Nakit+Banka (Formül)','Cari Alacak (Formül)','Cari Borç (Formül)','Kart Borcu (Formül)','Maaş Yükü (Formül)']];
 let allSheets=[];
 const colSums=[0,0,0,0,0,0,0,0];
 for(const c of COMPANIES){
  const kisa=c.name.replace('LOLE ','').slice(0,10)+' ';
  const {sheets,meta}=coSheets(c.id,kisa);
  allSheets=allSheets.concat(sheets);
  const TXN=kisa+'İşlemler';
  const gelirF=meta.N_TX?'=SUMIFS('+qref(TXN)+xlRange('G',2,meta.N_TX)+','+qref(TXN)+xlRange('B',2,meta.N_TX)+','+xlStr('Gelir')+','+qref(TXN)+xlRange('A',2,meta.N_TX)+','+xlStr('>='+ay)+','+qref(TXN)+xlRange('A',2,meta.N_TX)+','+xlStr('<='+bugun)+')':'=0';
  const giderF=meta.N_TX?'=SUMIFS('+qref(TXN)+xlRange('G',2,meta.N_TX)+','+qref(TXN)+xlRange('B',2,meta.N_TX)+','+xlStr('Gider')+','+qref(TXN)+xlRange('A',2,meta.N_TX)+','+xlStr('>='+ay)+','+qref(TXN)+xlRange('A',2,meta.N_TX)+','+xlStr('<='+bugun)+')':'=0';
  const sBu=sumRange(c.id,ay,bugun);
  const rowIdx=cmpRows.length+1;
  const vals=[sBu.gelir,sBu.gider,sBu.gelir-sBu.gider,meta.nakitBankaToplam,meta.cariAlacakToplam,meta.cariBorcToplam,meta.kartBorcToplam,meta.maasYuku];
  vals.forEach((v,i)=>colSums[i]+=v);
  cmpRows.push([c.name,
   FX(gelirF,sBu.gelir), FX(giderF,sBu.gider), FX('=B'+rowIdx+'-C'+rowIdx,sBu.gelir-sBu.gider),
   FX(meta.accCount?'='+qref(kisa+'Hesaplar')+'F'+meta.HESAP_TOTAL_ROW:'=0',meta.nakitBankaToplam),
   FX(meta.carisCount?'='+qref(kisa+'Cariler')+'F'+meta.CARI_ALACAK_ROW:'=0',meta.cariAlacakToplam),
   FX(meta.carisCount?'='+qref(kisa+'Cariler')+'F'+meta.CARI_BORC_ROW:'=0',meta.cariBorcToplam),
   FX(meta.cardsCount?'='+qref(kisa+'Kartlar')+'D'+meta.KART_TOTAL_ROW:'=0',meta.kartBorcToplam),
   FX(meta.stfCount?'='+qref(kisa+'Personel')+'B'+meta.PERSONEL_TOTAL_ROW:'=0',meta.maasYuku)]);
 }
 const lastDataRow=cmpRows.length;
 cmpRows.push([]);
 const grupToplamRow=['GRUP TOPLAMI'];
 ['B','C','D','E','F','G','H','I'].forEach((L,i)=>grupToplamRow.push(FX('=SUM('+L+'2:'+L+lastDataRow+')',colSums[i])));
 cmpRows.push(grupToplamRow);
 allSheets.unshift(xSheet('GRUP Karşılaştırma', cmpRows));
 return buildXLS(allSheets);
}
function dlText(name,mime,content){
 try{
  const blob=new Blob(['\ufeff'+content],{type:mime+';charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=name;document.body.appendChild(a);a.click();a.remove();
  return true;
 }catch(e){return false;}
}
function excelDl(scope){
 const grup=scope==='grup'||CO==='grup';
 const x=grup?excelGrup():excelCo(CO);
 const ad='LOLE-'+(grup?'GRUP':coName(CO).replace(/\s+/g,'-'))+'-'+todayISO()+'.xls';
 if(dlText(ad,'application/vnd.ms-excel',x))toast('Excel raporu indirildi (formüllü, tam bağlantılı): '+ad);
 else toast('İndirme bu görüntüleyicide engelli — dosyayı indirip Chrome/Safari\'de açın');
}
function fullReportHTML(fromA,toA,modeA){ // v14-R3: artık Raporlar ekranındaki dönem + mod ile üretilir
 const grup=CO==='grup';
 const _rf=fromA||((typeof repRange!=='undefined'&&repRange.from)||monthISO()+'-01');
 const _rt=toA||((typeof repRange!=='undefined'&&repRange.to)||todayISO());
 const _rm=modeA||((typeof repMode!=='undefined'&&repMode)||'nakit');
 const tbl=rows=>'<table>'+rows.map((r,i)=>'<tr>'+r.map(c=>(i===0?'<th>':'<td>')+(c===''||c==null?'&nbsp;':c)+(i===0?'</th>':'</td>')).join('')+'</tr>').join('')+'</table>';
 let out='<h1>LOLE FİNANS RAPORU — '+esc(grup?'LOLE GRUP':coName(CO))+'</h1><p class="mut">Rapor tarihi: '+dTR(todayISO())+' · Dönem: '+dTR(_rf)+' — '+dTR(_rt)+' · Görünüm: '+(_rm==='tahakkuk'?'Tahakkuk (faturalı)':'Nakit esas')+' · Tablolar ilgili şirket(ler)in tüm kayıtlı hareketlerini içerir.</p>';
 const cos=grup?COMPANIES.map(c=>c.id):[CO];
 for(const co of cos){
  const s=_rm==='tahakkuk'?accrualAdjust(co,_rf,_rt,sumRange(co,_rf,_rt,{skipCariLinked:true})):sumRange(co,_rf,_rt);
  const st=sumRange(co,'0000-01-01','9999-12-31');
  let bal=0;for(const a of byCo(S.accounts,co))bal+=accBalance(a);
  out+='<h2>'+esc(coName(co))+'</h2>';
  out+=tbl([['Gösterge','Seçili Dönem','Tüm Zamanlar'],
   ['Gelir',fmt(s.gelir),fmt(st.gelir)],['Gider',fmt(s.gider),fmt(st.gider)],['Net',fmt(s.net),fmt(st.net)],['Nakit+Banka',fmt(bal),'']]);
  const accs=byCo(S.accounts,co);
  if(accs.length)out+='<h3>Hesaplar (Banka & Kasa)</h3>'+tbl([['Hesap','Tür','IBAN','Açılış','Güncel Bakiye'],
   ...accs.map(a=>[esc(a.name),a.type==='kasa'?'Kasa':'Banka',esc(a.iban||''),fmt(a.opening),fmt(accBalance(a))])]);
  const txns=byCo(S.txns,co).slice().sort((a,b)=>a.date<b.date?-1:1);
  if(txns.length)out+='<h3>Tüm İşlemler ('+txns.length+' kayıt)</h3>'+tbl([['Tarih','Tür','Kategori','Hesap','Açıklama','Tutar'],
   ...txns.map(t=>{const a=S.accounts.find(x=>x.id===t.accId)||{};
    return [dTR(t.date),t.type==='gelir'?'Gelir':t.type==='gider'?'Gider':'Virman',esc(t.cat||''),esc(a.name||''),esc(t.desc||''),fmt(t.amount)];})]);
  out+='<h3>Gider Kırılımı (bu ay)</h3>'+tbl([['Kategori','Tutar'],...Object.entries(s.byCat).sort((a,b)=>b[1]-a[1]).map(([c,v])=>[esc(c),fmt(v)])]);
  out+='<h3>Gelir Kırılımı (bu ay)</h3>'+tbl([['Kategori','Tutar'],...Object.entries(s.byCatG).sort((a,b)=>b[1]-a[1]).map(([c,v])=>[esc(c),fmt(v)])]);
  const pes=byCo(S.posEntries,co).slice().sort((a,b)=>a.date<b.date?-1:1);
  if(pes.length)out+='<h3>POS Hareketleri</h3>'+tbl([['Tarih','POS','Brüt','Komisyon','Net','Durum'],
   ...pes.map(e=>{const p=S.pos.find(x=>x.id===e.posId)||{};return [dTR(e.date),esc(p.name||''),fmt(e.gross),fmt(e.comm),fmt(e.net),e.status==='gecti'?'Geçti':'Bekliyor'];})]);
  const cards=byCo(S.cards,co);
  if(cards.length){
   out+='<h3>Kredi Kartları</h3>'+tbl([['Kart','Banka','Limit','Borç','Kesim','Son Ödeme'],
    ...cards.map(c=>[esc(c.name),esc(c.bank||''),fmt(c.limit),fmt(cardDebt(c)),c.cutDay,c.dueDay])]);
   const cts=byCo(S.cardTxns,co).slice().sort((a,b)=>a.date<b.date?-1:1);
   if(cts.length)out+='<h3>Kredi Kartı Ekstresi (tüm hareketler)</h3>'+tbl([['Tarih','Kart','Tür','Kategori','Açıklama','Tutar'],
    ...cts.map(t=>{const c=S.cards.find(x=>x.id===t.cardId)||{};return [dTR(t.date),esc(c.name||''),t.type==='odeme'?'Ödeme':'Harcama',esc(t.cat||''),esc(t.desc||''),fmt(t.amount)];})]);
  }
  const caris=byCo(S.cari,co);
  if(caris.length){
   out+='<h3>Cari Bakiyeler (Alacak/Borç)</h3>'+tbl([['Cari','Tür','Telefon','Bakiye','Durum'],
    ...caris.map(c=>{const b=cariBalance(c);return [esc(c.name),({musteri:'Müşteri',tedarikci:'Tedarikçi',her2:'Her ikisi',diger:'Diğer'})[c.type]||'',esc(c.phone||''),fmt(Math.abs(b)),b>0?'Bize borçlu':b<0?'Biz borçluyuz':'Kapalı'];})]);
   const crts=byCo(S.cariTxns,co).slice().sort((a,b)=>a.date<b.date?-1:1);
   if(crts.length)out+='<h3>Cari Hareketleri (tüm alacak/ödeme kayıtları)</h3>'+tbl([['Tarih','Cari','Borç','Alacak','Vade','Açıklama'],
    ...crts.map(t=>{const c=S.cari.find(x=>x.id===t.cariId)||{};return [dTR(t.date),esc(c.name||''),t.type==='borc'?fmt(t.amount):'',t.type==='alacak'?fmt(t.amount):'',t.vade?dTR(t.vade):'',esc(t.desc||'')];})]);
  }
  const stf=byCo(S.staff,co).filter(x=>x.active!=='0');
  if(stf.length){
   out+='<h3>Personel</h3>'+tbl([['Personel','Görev','Net Maaş'],...stf.map(x=>[esc(x.name),esc(x.pos||''),fmt(x.salary)])]);
   const sts=byCo(S.staffTxns,co).slice().sort((a,b)=>a.date<b.date?-1:1);
   if(sts.length)out+='<h3>Personel Ödemeleri</h3>'+tbl([['Tarih','Personel','Tür','Dönem','Tutar'],
    ...sts.map(t=>{const x=S.staff.find(z=>z.id===t.staffId)||{};return [dTR(t.date),esc(x.name||''),({maas:'Maaş',avans:'Avans',prim:'Prim',kesinti:'Kesinti'})[t.type]||t.type,t.period||'',fmt(t.amount)];})]);
  }
  const fxs=byCo(S.fixed,co);
  if(fxs.length){
   out+='<h3>Sabit Ödemeler</h3>'+tbl([['Ödeme','Tür','Gün','Aylık Tutar'],...fxs.map(f=>[esc(f.name),FTYPE[f.type]||'',f.payDay,fmt(f.amount)])]);
   const fls=byCo(S.fixedLogs,co).slice().sort((a,b)=>a.period<b.period?-1:1);
   if(fls.length)out+='<h3>Sabit Ödeme Geçmişi (fatura ödemeleri dahil)</h3>'+tbl([['Dönem','Ödeme','Ödeme Tarihi','Tutar'],
    ...fls.map(l=>{const f=S.fixed.find(x=>x.id===l.fixedId)||{};return [l.period,esc(f.name||''),l.paidDate?dTR(l.paidDate):'',fmt(l.amount)];})]);
  }
  const cqs=byCo(S.cheques,co);
  if(cqs.length)out+='<h3>Çek & Senet</h3>'+tbl([['Yön','Tür','Kişi','Banka','Vade','Tutar','Durum'],
   ...cqs.map(c=>[c.tip==='alinan'?'Alınan':'Verilen',c.tur==='senet'?'Senet':'Çek',esc(c.kisi),esc(c.banka||''),c.vade?dTR(c.vade):'',fmt(c.tutar),(CEK_DURUM_TR[c.durum]||'')])]); /* v14-H3 */
  const stk=byCo(S.stock,co);
  if(stk.length)out+='<h3>Stok</h3>'+tbl([['Ürün','Birim','Miktar','Birim Maliyet','Stok Değeri'],
   ...stk.map(it=>{const q=stockQty(it);return [esc(it.name),esc(it.unit||''),q,fmt(it.cost),fmt(q*(+it.cost||0))];})]);
  const ass=byCo(S.assets,co);
  if(ass.length)out+='<h3>Demirbaş</h3>'+tbl([['Demirbaş','Kategori','Bedel','Durum'],
   ...ass.map(a=>[esc(a.name),esc(a.cat||''),fmt(a.cost),({aktif:'Kullanımda',bakim:'Bakımda',hurda:'Hurda'})[a.durum||'aktif']])]);
  const bds=byCo(S.budgets,co);
  if(bds.length)out+='<h3>Bütçe (Hedef vs Gerçekleşen)</h3>'+tbl([['Kategori','Tür','Aylık Hedef','Dönem Gerçekleşen','Fark'],
   ...bds.map(b=>{const _ig=(b.type||'gider')==='gelir';const g=(_ig?s.byCatG:s.byCat)[b.cat]||0;return [esc(b.cat),_ig?'Gelir':'Gider',fmt(b.amount),fmt(g),fmt(b.amount-g)];})]); // v14-R4
 }
 return out;
}
function pdfPrint(){
 let box=document.getElementById('printArea');
 if(!box){box=document.createElement('div');box.id='printArea';document.body.appendChild(box);}
 box.innerHTML=fullReportHTML();
 document.body.classList.add('print-report');
 const done=()=>{document.body.classList.remove('print-report');};
 try{ window.onafterprint=done; window.print(); setTimeout(done,1200); }
 catch(e){ done(); toast('Yazdırma bu görüntüleyicide engelli — "Rapor Dosyası İndir" seçeneğini kullanın'); }
}
function dlReportHTML(){
 const html='<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>LOLE Finans Raporu '+todayISO()+'</title><style>'+
 'body{font:13px/1.5 -apple-system,Segoe UI,Arial,sans-serif;color:#141d33;max-width:900px;margin:24px auto;padding:0 16px}'+
 'h1{font-size:22px;border-bottom:3px solid #0c1322;padding-bottom:8px}h2{font-size:17px;margin-top:26px;color:#0c1322}h3{font-size:13px;margin-top:16px;text-transform:uppercase;letter-spacing:.08em;color:#46536e}'+
 'table{width:100%;border-collapse:collapse;margin:8px 0;font-size:12.5px}th{background:#eef1f6;text-align:left}th,td{border:1px solid #d8deea;padding:6px 9px}td:nth-child(n+2),th:nth-child(n+2){text-align:right}'+
 '.mut{color:#8b96ac}.no-print{background:#0c1322;color:#fff;border:0;padding:10px 18px;border-radius:10px;font-weight:700;cursor:pointer}@media print{.no-print{display:none}}'+
 '</style></head><body><button class="no-print" onclick="window.print()">🖨 Yazdır / PDF olarak kaydet</button>'+fullReportHTML()+'</body></html>';
 const ad='LOLE-rapor-'+(CO==='grup'?'GRUP':coName(CO).replace(/\s+/g,'-'))+'-'+todayISO()+'.html';
 if(dlText(ad,'text/html',html))toast('Rapor indirildi — açıp "Yazdır / PDF kaydet" deyin');
 else toast('İndirme engelli — dosyayı indirip tarayıcıda açın');
}


/* ================== v4 — AI ASİSTAN MERKEZİ + İŞLEVSELLİK PAKETİ ================== */

/* ---- ortak yardımcılar ---- */
function periodAdd(p,n){var a=p.split('-').map(Number);var t=a[0]*12+(a[1]-1)+n;return Math.floor(t/12)+'-'+String((t%12)+1).padStart(2,'0');}
function trLow(s){return String(s==null?'':s).toLocaleLowerCase('tr');}

/* ---- AI çekirdeği ---- */
var AI_ON=null; /* null=denenmedi, true/false=son deneme sonucu */
var AI_SYS='Sen LOLE Grup sirketlerinin Türkçe finans asistanısın. YALNIZCA sana verilen JSON verisine dayan; veride olmayan bilgi için "kayıtlarda göremiyorum" de, asla tahmin uydurma. Tutarları 1.250,50 TL biçiminde yaz. Kısa, net, samimi-profesyonel ol. Markdown başlığı kullanma; madde işareti (•) kullanabilirsin.';
function loleAuthHeaders(){ // A5: supabase-js oturum jetonunu localStorage'dan al (sunucu doğrular; yoksa istek yine çalışır)
 var h={'Content-Type':'application/json'};
 try{
  for(var i=0;i<localStorage.length;i++){
   var k=localStorage.key(i);
   if(/^sb-.*-auth-token$/.test(k)){
    var v=JSON.parse(localStorage.getItem(k)||'null');
    var tk=v&&(v.access_token||(v.currentSession&&v.currentSession.access_token));
    if(tk){h['Authorization']='Bearer '+tk;break;}
   }
  }
 }catch(e){}
 return h;
}
async function aiAsk(user,maxTok){
 try{
  var r=await fetch('/api/ai',{method:'POST',headers:loleAuthHeaders(),
   body:JSON.stringify({max_tokens:maxTok||900,system:AI_SYS,messages:[{role:'user',content:user}]})});
  var j=await r.json();
  var t=(j&&j.content)?j.content.map(function(c){return c.text||'';}).join('\n').trim():'';
  AI_ON=!!t;return t;
 }catch(e){AI_ON=false;return '';}
}
function aiTag(live){return '<span class="src">'+(live?'✦ Yapay zeka tarafından oluşturulmuştur — kontrol ediniz.':'⚙ Yerleşik analiz (canlı AI şu an erişilemiyor; Claude ortamında otomatik devreye girer).')+'</span>';}

/* ---- şirket veri paketi ---- */
function packCo(co){
 var t=sumRange(co,todayISO(),todayISO()),m=sumRange(co,monthISO()+'-01',todayISO());
 var posBek=0;for(var i=0;i<S.posEntries.length;i++){var p=S.posEntries[i];if(p.co===co&&p.status==='bekliyor'&&!p.deletedAt)posBek+=+p.net;}
 return {
  sirket:coName(co),tarih:todayISO(),
  bugun:{gelir:Math.round(t.gelir),gider:Math.round(t.gider)},
  buAy:{gelir:Math.round(m.gelir),gider:Math.round(m.gider),net:Math.round(m.net)},
  hesaplar:byCo(S.accounts,co).map(function(a){return {ad:a.name,tur:a.type,bakiye:Math.round(accBalance(a))};}),
  krediKartlari:byCo(S.cards,co).map(function(c){return {ad:c.name,borc:Math.round(cardDebt(c)),sonOdemeGunu:c.dueDay};}),
  posBlokajBekleyen:Math.round(posBek),
  cariBakiyeler:byCo(S.cari,co).map(function(c){return {ad:c.name,bakiye:Math.round(cariBalance(c))};}).filter(function(c){return c.bakiye!==0;}),
  yaklasanOdemeler:reminders(co).slice(0,10).map(function(r){return {ne:r.t,tarih:r.d,tutar:r.a};}),
  kritikStok:byCo(S.stock,co).filter(function(it){return +(it.min||0)>0&&stockQty(it)<=+it.min;}).map(function(it){return it.name;}),
  portfoyCekSenet:byCo(S.cheques,co).filter(function(c){return c.durum==='portfoy'||c.durum==='tahsilde';}) /* v14-H2 */.map(function(c){return {tip:c.tip,kisi:c.kisi,tutar:+c.tutar,vade:c.vade};}),
  personel:byCo(S.staff,co).filter(function(s){return s.active!=='0';}).map(function(s){return {ad:s.name,gorev:s.pos||''};}),
  giderKategorileriBuAy:m.byCat,gelirKategorileriBuAy:m.byCatG
 };
}

/* ---- AI ASİSTAN SAYFASI ---- */
var aiLog=[],aiLogCo=null,aiBusy=false;
function rAi(){
 if(aiLogCo!==CO){aiLog=[];aiLogCo=CO;}
 var grup=(CO==='grup');
 var ornek=['bugünkü ciro','bu ay net kâr','kart borçları','yaklaşan ödemeler','kritik stok','kirayı ödedik mi'];
 document.getElementById('main').innerHTML= topbar('AI Asistan',
  '<button class="btn ai" data-act="meclisToplanti">🏛 Yönetim Meclisi</button><button class="btn gh" data-act="aiChatClear">🧹 Temizle</button>')+
 '<div id="meclisBox"></div>'+
 '<div class="card"><h2>✦ Soru-Cevap Ajanı <span class="tiny">verilerinize doğal dille sorun</span></h2>'+
  '<div class="aiChat" id="aiLogBox">'+renderAiLog()+'</div>'+
  '<div class="aiInRow"><input id="aiIn" placeholder="Ör: kasada ne kadar var? · Anadolu Gıda bakiyesi? · en büyük gider?" autocomplete="off"><button class="btn" data-act="aiSend">Gönder</button></div>'+
  '<div style="margin-top:9px;display:flex;gap:6px;flex-wrap:wrap">'+ornek.map(function(q){return '<button class="chip g" data-act="aiQuick" data-arg="'+q+'">'+q+'</button>';}).join('')+'</div>'+
 '</div>'+
 (grup
  ? '<div class="card"><div class="empty"><b>Uzman ajanlar şirket ekranında</b>Brifing, nakit tahmini, anomali, maliyet ve tahsilat ajanları şirket verisiyle çalışır. Sohbet burada 4 şirketin toplamı üzerinden yanıt verir.</div></div>'
  : '<h2 style="margin:4px 2px 10px;font-size:15px;color:var(--ink2)">UZMAN AJANLAR</h2><div class="agentGrid">'+
    agentCard('🌅','Sabah Brifingi','Dünün cirosu, bugünkü ödemeler ve kritik uyarılar tek bakışta.','aiBriefRun')+
    agentCard('📈','Nakit Akış Tahmini','Önümüzdeki 30 günün kesinleşmiş giriş-çıkış projeksiyonu ve açık riski.','aiFcRun')+
    agentCard('🧠','AI CFO Analizi','Marj, trend, risk ve aksiyon önerileriyle ay sonu derinliğinde analiz.','aiCFO')+
    agentCard('🕵️','Anomali Taraması','Mükerrer kayıt, sıra dışı tutar, negatif bakiye ve limit aşımı taraması.','aiAnomaly')+
    agentCard('💰','Maliyet Optimizasyonu','POS komisyon farkları ve hızlanan gider kalemlerinde tasarruf fırsatları.','aiCost')+
    agentCard('⚖️','Cari Risk & Tahsilat','Gecikme skorları, tahsilat önceliği ve kibar e-posta taslağı.','aiCariRisk')+
   '</div>')+
 '<div id="aiOut"></div>';
 var inp=document.getElementById('aiIn');
 if(inp)inp.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();aiSend();}});
 var lb=document.getElementById('aiLogBox');if(lb)lb.scrollTop=lb.scrollHeight;
}
function agentCard(ic,t,d,fn){return '<div class="agentCard"><b>'+ic+' '+t+'</b><span class="tiny">'+d+'</span><button class="btn sm" data-act="'+fn+'">Çalıştır</button></div>';}
function renderAiLog(){
 if(!aiLog.length)return '<div class="empty" style="padding:16px"><b>Merhaba! 👋</b>'+(CO==='grup'?'Grup geneli':coName(CO))+' verileri hakkında istediğinizi sorun. AI erişilemezse yerleşik analiz yanıtlar.</div>';
 return aiLog.map(function(m){return '<div class="aiMsg '+(m.r==='u'?'u':'a')+'">'+esc(m.t)+(m.r==='a'&&!m.tmp?aiTag(m.live):'')+'</div>';}).join('');
}
function paintLog(){var b=document.getElementById('aiLogBox');if(b){b.innerHTML=renderAiLog();b.scrollTop=b.scrollHeight;}}
function aiChatClear(){aiLog=[];if(PAGE==='ai')rAi();}
function aiQuick(q){var i=document.getElementById('aiIn');if(i)i.value=q;aiSend();}
async function aiSend(){
 if(aiBusy)return;
 var i=document.getElementById('aiIn');var q=(i?i.value:'').trim();
 if(!q)return;
 i.value='';aiBusy=true;
 aiLog.push({r:'u',t:q});
 aiLog.push({r:'a',t:'…düşünüyorum',tmp:true});
 paintLog();
 var local=localAnswer(q);
 var pack=(CO==='grup')?{kapsam:'LOLE GRUP — 4 şirket toplamı',sirketler:COMPANIES.map(function(c){return packCo(c.id);})}:packCo(CO);
 var ai=await aiAsk('VERI: '+JSON.stringify(pack)+'\n\nSORU: '+q+(local?'\n\n(Yerleşik ön analiz, dilersen düzelt/zenginleştir: '+local+')':''));
 var txt,live=false;
 if(ai){txt=ai;live=true;}
 else txt=local||'Bunu yerleşik analizle yanıtlayamadım. Şunları sorabilirsiniz: bakiye · bugünkü ciro · bu ay kâr · kart borcu · yaklaşan ödemeler · kritik stok · "kirayı ödedik mi" · bir cari veya personel adı.';
 aiLog=aiLog.filter(function(m){return !m.tmp;});
 aiLog.push({r:'a',t:txt,live:live});
 aiBusy=false;paintLog();
}

/* ---- yerleşik soru-cevap motoru ---- */
function localAnswer(q0){
 var q=trLow(q0);
 function has(){for(var i=0;i<arguments.length;i++)if(q.indexOf(arguments[i])>-1)return true;return false;}
 var coList=(CO==='grup')?COMPANIES.map(function(c){return c.id;}):[CO];
 var pre=function(c){return (CO==='grup')?coName(c)+': ':'';};
 var L=[],c,i;
 var STOP={nedir:1,kadar:1,nasil:1,'nasıl':1,neler:1,hangi:1,durum:1,durumu:1,bakiye:1,bakiyesi:1,'borç':1,borc:1,borcu:1,'borçları':1,borclari:1,'ödeme':1,odeme:1,'ödemeler':1,hesap:1,toplam:1,'bugün':1,bugun:1,'yarın':1,yarin:1,'için':1,icin:1,olan:1,gelir:1,gider:1,ciro:1,kart:1,kredi:1,vade:1,stok:1,'çek':1,cek:1,senet:1,'maaş':1,maas:1,izin:1,personel:1,cari:1,kasa:1,banka:1,nakit:1,para:1,kalan:1};
 var words=q.split(/[^a-zçğıöşü0-9]+/).filter(function(w){return w.length>=3&&!STOP[w];});
 var ent=findEntity(words,coList,pre); if(ent)return ent;

 if(has('bakiye','kasada','kasa','banka','nakit','ne kadar param','para var')&&!has('cari','kart')){
  for(i=0;i<coList.length;i++){c=coList[i];var accs=byCo(S.accounts,c);if(!accs.length)continue;
   var tot=0,parts=[];for(var k=0;k<accs.length;k++){var b=accBalance(accs[k]);tot+=b;parts.push(accs[k].name+' '+fmt0(b));}
   L.push(pre(c)+parts.join(' · ')+' — Toplam '+fmt0(tot));}
  if(L.length)return L.join('\n');
 }
 if(has('bugün')&&has('ciro','satış','gelir','gider','kazan')){
  for(i=0;i<coList.length;i++){c=coList[i];var t=sumRange(c,todayISO(),todayISO());
   L.push(pre(c)+'Bugün gelir '+fmt0(t.gelir)+', gider '+fmt0(t.gider)+', net '+fmt0(t.net));}
  return L.join('\n');
 }
 if(has('bu ay','aylık','ay sonu')&&has('ciro','gelir','gider','kâr','kar','net','durum')){
  for(i=0;i<coList.length;i++){c=coList[i];var m=sumRange(c,monthISO()+'-01',todayISO());
   L.push(pre(c)+'Bu ay gelir '+fmt0(m.gelir)+', gider '+fmt0(m.gider)+', net '+fmt0(m.net)+(m.gelir?' (marj %'+(m.net/m.gelir*100).toFixed(1)+')':''));}
  return L.join('\n');
 }
 if(has('kart')&&has('borç','borc','borcu','ne kadar')){
  for(i=0;i<coList.length;i++){c=coList[i];var cards=byCo(S.cards,c);if(!cards.length)continue;
   L.push(pre(c)+cards.map(function(cd){var d=cardDebt(cd);return cd.name+' '+fmt0(d)+(d>0?' (son ödeme: '+dTR(nextDue(+cd.dueDay))+')':'');}).join(' · '));}
  return L.length?L.join('\n'):'Kayıtlı kredi kartı bulunmuyor.';
 }
 if(has('yaklaşan','vade','ödeme var','ne ödeyeceğ','ödemeler')){
  for(i=0;i<coList.length;i++){c=coList[i];var rs=reminders(c).slice(0,5);
   if(rs.length)L.push(pre(c)+rs.map(function(r){return r.t+' — '+dTR(r.d)+(r.a!=null?' ('+fmt0(r.a)+')':'');}).join('\n'+(CO==='grup'?'   ':'')));}
  return L.length?L.join('\n'):'Önümüzdeki günlerde vadesi gelen ödeme görünmüyor ✓';
 }
 if(has('öde')&&has('kira','vergi','sgk','fatura')){
  var tmap={'kira':'kira','vergi':'vergi','sgk':'sgk','fatura':'fatura'};
  for(var key in tmap){ if(q.indexOf(key)<0)continue;
   for(i=0;i<coList.length;i++){c=coList[i];var fs=byCo(S.fixed,c).filter(function(f){return f.type===tmap[key];});
    for(var j=0;j<fs.length;j++){var f=fs[j];var paid=S.fixedLogs.some(function(l){return l.fixedId===f.id&&l.period===monthISO();});
     L.push(pre(c)+f.name+' — bu ay '+(paid?'ÖDENDİ ✓':'henüz ödenmedi (ödeme günü ayın '+f.payDay+'. günü, '+fmt0(f.amount)+')'));}}}
  return L.length?L.join('\n'):null;
 }
 if(has('çek','senet')){
  for(i=0;i<coList.length;i++){c=coList[i];var cq=byCo(S.cheques,c).filter(function(x){return x.durum==='portfoy';});
   if(cq.length)L.push(pre(c)+cq.map(function(x){return (x.tip==='alinan'?'Alınan':'Verilen')+' '+(x.tur==='senet'?'senet':'çek')+': '+x.kisi+' '+fmt0(x.tutar)+' (vade '+dTR(x.vade)+')';}).join(' · '));}
  return L.length?L.join('\n'):'Portföyde bekleyen çek/senet yok.';
 }
 if(has('stok','kritik','malzeme bit')){
  for(i=0;i<coList.length;i++){c=coList[i];var kr=byCo(S.stock,c).filter(function(it){return +(it.min||0)>0&&stockQty(it)<=+it.min;});
   if(kr.length)L.push(pre(c)+'Kritik: '+kr.map(function(it){return it.name+' ('+stockQty(it)+' '+(it.unit||'')+')';}).join(', '));}
  return L.length?L.join('\n'):'Kritik seviyede stok kalemi yok ✓';
 }
 if(has('blokaj','pos')&&has('bekle','ne kadar','geç')){
  for(i=0;i<coList.length;i++){c=coList[i];var s=0,n=0;
   for(var e=0;e<S.posEntries.length;e++){var pe=S.posEntries[e];if(pe.co===c&&pe.status==='bekliyor'){s+=+pe.net;n++;}}
   if(n)L.push(pre(c)+'Blokajda '+n+' işlem, toplam '+fmt0(s));}
  return L.length?L.join('\n'):'Blokajda bekleyen POS tutarı yok.';
 }
 if(has('en çok','en büyük','en yüksek')&&has('gider','harca','masraf')){
  for(i=0;i<coList.length;i++){c=coList[i];var mm=sumRange(c,monthISO()+'-01',todayISO());
   var top=Object.entries(mm.byCat).sort(function(a,b){return b[1]-a[1];})[0];
   if(top)L.push(pre(c)+'Bu ay en büyük gider: '+top[0]+' — '+fmt0(top[1])+(mm.gider?' (giderin %'+(top[1]/mm.gider*100).toFixed(0)+"'i)":''));}
  return L.length?L.join('\n'):null;
 }
 if(has('alacak','borç','borc')&&has('toplam','ne kadar')){
  for(i=0;i<coList.length;i++){c=coList[i];var al=0,bo=0;
   byCo(S.cari,c).forEach(function(x){var bb=cariBalance(x);if(bb>0)al+=bb;else bo-=bb;});
   L.push(pre(c)+'Toplam alacağımız '+fmt0(al)+' · toplam borcumuz '+fmt0(bo));}
  return L.join('\n');
 }
 return null;
}
/* cari / personel adına göre doğrudan yanıt */
function findEntity(words,coList,pre){
 if(!words.length)return null;
 var c,i;
 for(i=0;i<coList.length;i++){c=coList[i];
  var caris=byCo(S.cari,c);
  for(var x=0;x<caris.length;x++){var nm=trLow(caris[x].name);
   if(words.some(function(w){return nm.indexOf(w)>-1;})){
    var bb2=cariBalance(caris[x]);
    var last=S.cariTxns.filter(function(t){return t.cariId===caris[x].id&&!t.deletedAt;}).sort(function(a,b){return a.date<b.date?1:-1;})[0];
    return pre(c)+caris[x].name+' bakiyesi: '+fmt(Math.abs(bb2))+' '+(bb2>0?'(bize borçlu)':bb2<0?'(biz borçluyuz)':'(kapalı)')+(last?'. Son hareket: '+dTR(last.date)+' '+(last.type==='borc'?'borç':'alacak')+' '+fmt0(last.amount):'');}}
  var stf=byCo(S.staff,c);
  for(var y=0;y<stf.length;y++){var sn=trLow(stf[y].name);
   if(words.some(function(w){return sn.indexOf(w)>-1;})){
    var st=stf[y];
    var odenen=S.staffTxns.filter(function(t){return t.staffId===st.id&&t.period===monthISO()&&!t.deletedAt&&(t.type==='maas'||t.type==='avans');}) /* v14-H8 */.reduce(function(s2,t){return s2+ +t.amount;},0);
    var izin=S.leaves.filter(function(l){return l.staffId===st.id&&!l.deletedAt;}).length;
    return pre(c)+st.name+' ('+(st.pos||'personel')+') — net maaş '+fmt0(st.salary)+', bu ay ödenen '+fmt0(odenen)+', kayıtlı izin/rapor: '+izin;}}
 }
 return null;
}

/* ---- SABAH BRİFİNGİ ---- */
var briefTried={};
function localBrief(co){
 var dun=sumRange(co,addDays(todayISO(),-1),addDays(todayISO(),-1));
 var evvel=sumRange(co,addDays(todayISO(),-2),addDays(todayISO(),-2));
 var rems=reminders(co);
 var gec=rems.filter(function(r){return r.df<0;}),bug=rems.filter(function(r){return r.df===0;}),yak=rems.filter(function(r){return r.df>0&&r.df<=3;});
 var bal=0;byCo(S.accounts,co).forEach(function(a){bal+=accBalance(a);});
 var neg=byCo(S.accounts,co).filter(function(a){return accBalance(a)<0;});
 var kritik=byCo(S.stock,co).filter(function(it){return +(it.min||0)>0&&stockQty(it)<=+it.min;});
 var gorev=byCo(S.tasks,co).filter(function(t){return t.status!=='tamam';});
 var L=['📅 '+dTR(todayISO())+' · '+coName(co)];
 L.push('• Dün: ciro '+fmt0(dun.gelir)+(evvel.gelir?' ('+(dun.gelir>=evvel.gelir?'▲ +':'▼ ')+(((dun.gelir-evvel.gelir)/evvel.gelir)*100).toFixed(1)+'% önceki güne göre)':'')+' · gider '+fmt0(dun.gider));
 if(gec.length)L.push('• ⚠ GECİKEN '+gec.length+' ödeme: '+gec.slice(0,3).map(function(r){return r.t+(r.a!=null?' ('+fmt0(r.a)+')':'');}).join('; ')+(gec.length>3?' …':''));
 if(bug.length)L.push('• Bugün ödenecek: '+bug.map(function(r){return r.t+(r.a!=null?' ('+fmt0(r.a)+')':'');}).join('; '));
 else if(!gec.length)L.push('• Bugün vadesi gelen ödeme yok ✓');
 if(yak.length)L.push('• 3 gün içinde: '+yak.slice(0,3).map(function(r){return r.t+' ('+dTR(r.d)+')';}).join('; '));
 L.push('• Nakit + banka: '+fmt0(bal)+(neg.length?' — ⚠ '+neg.map(function(a){return a.name;}).join(', ')+' negatifte':''));
 if(kritik.length)L.push('• 📦 Kritik stok: '+kritik.map(function(x){return x.name;}).join(', '));
 if(gorev.length)L.push('• ✔ Açık görev: '+gorev.length+' adet');
 return L.join('\n');
}
function renderBriefCard(){
 if(CO==='grup')return;
 var box=document.getElementById('briefBox');if(!box)return;
 var key='brief:'+CO+':'+todayISO();
 var cached=S.aiCache&&S.aiCache[key];
 var txt=cached||localBrief(CO);
 box.innerHTML='<div class="card" style="border-left:4px solid var(--copper)"><h2>🌅 Sabah Brifingi '+
  '<button class="btn sm gh" data-act="aiBriefRun">'+(cached?'↻ Yenile':'✦ AI ile zenginleştir')+'</button>'+
  '<button class="btn sm gh" data-act="openAiChat">💬 Soru sor</button></h2>'+
  '<div class="aiBox" style="white-space:pre-wrap">'+esc(txt)+'</div>'+(cached?aiTag(true):'')+'</div>';
 if(S.ai&&S.ai.autoBrief&&!cached&&!briefTried[key]){briefTried[key]=1;aiBriefRun('auto');}
}
async function aiBriefRun(mode){
 if(CO==='grup')return;
 var key='brief:'+CO+':'+todayISO();
 var loc=localBrief(CO);
 if(PAGE==='ai')outCard('🌅 Sabah Brifingi',loc,false,true);
 else if(mode!=='auto'){var b=document.getElementById('briefBox');var x=b&&b.querySelector('.aiBox');if(x)x.textContent='✦ AI brifingi hazırlanıyor…';}
 var ai=await aiAsk('VERI: '+JSON.stringify(packCo(CO))+'\n\nYEREL BRIFING: '+loc+'\n\nGÖREV: İşletme sahibi için 5-7 maddelik, • ile başlayan Türkçe sabah brifingi yaz. En kritik uyarıyla başla, rakamları TL ile ver, son madde tek cümlelik somut bir öneri olsun.');
 if(ai){S.aiCache[key]=ai;save();}
 if(PAGE==='ai')outCard('🌅 Sabah Brifingi',ai||loc,!!ai);
 else if(PAGE==='dash')renderBriefCard();
}
function outCard(title,text,live,pending){
 var o=document.getElementById('aiOut');if(!o)return;
 o.innerHTML='<div class="card"><h2>'+title+'</h2><div class="aiBox" style="white-space:pre-wrap">'+esc(text)+'</div>'+(pending?'<div class="tiny" style="margin-top:6px">✦ AI ile zenginleştiriliyor…</div>':aiTag(live))+'</div>';
 try{o.scrollIntoView({behavior:'smooth'});}catch(e){}
}

/* ---- NAKİT AKIŞ PROJEKSİYONU ---- */
function cashForecast(co,days){
 days=days||30;
 var start=todayISO(),end=addDays(start,days);
 var M={};
 function put(d,inV,outV,t){
  if(!d)return; if(d<start)d=start; if(d>end)return;
  var m=M[d]||(M[d]={in:0,out:0,items:[]});
  m.in+=inV;m.out+=outV;m.items.push({t:t,a:(inV||-outV)});
 }
 var FT={kira:'Kira',vergi:'Vergi',sgk:'SGK',fatura:'Fatura'};
 var per=monthISO(),perN=periodAdd(per,1),ps=[per,perN];
 byCo(S.fixed,co).forEach(function(f){
  ps.forEach(function(p){
   if(S.fixedLogs.some(function(l){return l.fixedId===f.id&&l.period===p&&!l.deletedAt;}))return;
   var d=clampDay(+p.slice(0,4),+p.slice(5,7),+f.payDay||1);
   if(d>=start)put(d,0,+f.amount||0,(FT[f.type]||'Sabit')+': '+f.name);
  });
 });
 /* v33: kart borcu taksit bilgisine gore dagitilir — gelecek taksitler kendi ayinin son odeme gunune,
    kalan (guncel donem) borc bu ayki son odeme gunune yazilir */
 byCo(S.cards,co).forEach(function(c){
  var debt=cardDebt(c);
  if(debt<=0)return;
  var myCt={};S.cardTxns.forEach(function(k){if(k.cardId===c.id&&!k.deletedAt)myCt[k.id]=1;});
  var future=S.txns.filter(function(t){return t.co===co&&!t.deletedAt&&t.src==='card'&&t.taksitNo&&t.date>start&&t.cardTxnId&&myCt[t.cardTxnId];});
  var futSum=future.reduce(function(s,t){return s+ +t.amount;},0);
  var nowDue=Math.max(0,debt-futSum); // negatifse 0
  if(nowDue>0)put(nextDue(+c.dueDay),0,nowDue,'Kredi kartı: '+c.name);
  future.forEach(function(t){
   var y=+t.date.slice(0,4),m=+t.date.slice(5,7);
   var d=clampDay(y,m,+c.dueDay||1);
   if(d<t.date){m++;if(m>12){m=1;y++;}d=clampDay(y,m,+c.dueDay||1);} // nextDue mantigi: gun gecmisse sonraki ay
   put(d,0,+t.amount,'Kart taksidi: '+c.name+' ('+(t.taksitNo||'')+')');
  });
 });
 S.cariTxns.forEach(function(t){
  if(t.co!==co||!t.vade||t.vade<start||t.deletedAt||t.kapandi)return;
  var c=S.cari.find(function(x){return x.id===t.cariId;})||{};
  if(t.type==='borc')put(t.vade,+t.amount,0,'Tahsilat: '+(c.name||'?'));
  else put(t.vade,0,+t.amount,'Ödeme: '+(c.name||'?'));
 });
 byCo(S.cheques,co).forEach(function(c){
  if(c.durum!=='portfoy'&&c.durum!=='tahsilde')return; // v14-H1: tahsile verilen çek de açık çektir (reminders/cekKapat ile hizalandı)
  if(c.tip==='alinan')put(c.vade,+c.tutar,0,'Çek tahsili: '+c.kisi);
  else put(c.vade,0,+c.tutar,'Çek ödemesi: '+c.kisi);
 });
 S.posEntries.forEach(function(p){if(p.co===co&&p.status==='bekliyor'&&!p.deletedAt)put(p.settleDate,+p.net,0,'POS hesaba geçiş');});
 var bal=0;byCo(S.accounts,co).forEach(function(a){bal+=accBalance(a);});
 var labels=[],balS=[],items=[],run=bal,minB=bal,minD=start,ti=0,to=0;
 for(var i=0;i<=days;i++){
  var d=addDays(start,i),m=M[d];
  if(m){run+=m.in-m.out;ti+=m.in;to+=m.out;m.items.forEach(function(it){items.push({d:d,t:it.t,a:it.a});});}
  if(run<minB){minB=run;minD=d;}
  labels.push(i%5===0?dTR(d).slice(0,5):'');
  balS.push(Math.round(run));
 }
 items.sort(function(a,b){return Math.abs(b.a)-Math.abs(a.a);});
 return {bal0:bal,labels:labels,balS:balS,items:items,minB:minB,minD:minD,ti:ti,to:to,end:run};
}
function fcCard(days){
 if(CO==='grup')return '';
 days=days||30;
 var f=cashForecast(CO,days);
 if(!f.items.length)return '<div class="card"><h2>📈 Nakit Projeksiyonu ('+days+' gün)</h2><div class="empty"><b>Vadeli kayıt yok</b>Sabit ödeme, kart borcu, cari vade, çek ve POS blokajı girildikçe projeksiyon burada oluşur.</div></div>';
 var warn=f.minB<0?'<div class="rem d-red" style="margin-top:10px"><span class="dot"></span><span><b>Nakit açığı riski:</b> '+dTR(f.minD)+' civarı bakiye '+fmt0(f.minB)+' seviyesine iniyor — tahsilatı öne çekme veya ödeme erteleme değerlendirin.</span></div>':'';
 var list=f.items.slice(0,6).map(function(it){return '<div class="fcItem"><span>'+dTR(it.d)+' · '+esc(it.t)+'</span><b style="color:'+(it.a>=0?'var(--pos)':'var(--neg)')+'">'+(it.a>=0?'+':'−')+fmt0(Math.abs(it.a))+'</b></div>';}).join('');
 return '<div class="card"><h2>📈 Nakit Projeksiyonu <span class="tiny">bugün '+fmt0(f.bal0)+' → '+days+' gün sonra ~'+fmt0(f.end)+'</span></h2>'+
  chartArea([{name:'Beklenen bakiye',color:'#0f4c5c',values:f.balS}],f.labels,185)+
  '<div class="tiny" style="margin:8px 0 4px">Kesinleşmiş girişler <b style="color:var(--pos)">+'+fmt0(f.ti)+'</b> · çıkışlar <b style="color:var(--neg)">−'+fmt0(f.to)+'</b> · günlük satış geliri projeksiyona dahil değildir.</div>'+
  list+warn+
  '<div style="margin-top:10px"><button class="btn sm gh" data-act="aiFcComment">✦ AI Yorumu</button></div><div id="fcAiBox"></div></div>';
}
function aiFcRun(){var o=document.getElementById('aiOut');if(o){o.innerHTML=fcCard(30);try{o.scrollIntoView({behavior:'smooth'});}catch(e){}}}
function localFcComment(f){
 if(f.minB<0){var big=f.items.find(function(i){return i.a<0;});
  return 'Projeksiyona göre '+dTR(f.minD)+' civarında ~'+fmt0(Math.abs(f.minB))+' nakit açığı oluşuyor. En büyük çıkış: "'+((big||{}).t||'—')+'". Bu tarihten önceki tahsilatları öne çekmeyi veya en büyük ödemeyi bölmeyi değerlendirin.';}
 return 'Önümüzdeki 30 günde nakit pozitif seyrediyor ('+fmt0(f.bal0)+' → '+fmt0(f.end)+'). Yine de '+fmt0(f.to)+' tutarındaki çıkış günlerinde bakiye kontrolü yapın.';
}
async function aiFcComment(){
 var b=document.getElementById('fcAiBox');if(!b)return;
 b.innerHTML='<div class="tiny" style="margin-top:8px">✦ Yorum hazırlanıyor…</div>';
 var f=cashForecast(CO,30);
 var ai=await aiAsk('30 günlük nakit projeksiyonu: '+JSON.stringify({baslangic:Math.round(f.bal0),son:Math.round(f.end),enDusuk:{tutar:Math.round(f.minB),tarih:f.minD},toplamGiris:Math.round(f.ti),toplamCikis:Math.round(f.to),kalemler:f.items.slice(0,12)})+'\n\nGÖREV: 3-4 cümlede yorumla; açık riski varsa hangi tahsilatın öne çekilmesi / hangi ödemenin ertelenmesinin mantıklı olduğunu somut söyle.');
 b.innerHTML='<div class="aiBox" style="white-space:pre-wrap;margin-top:8px">'+esc(ai||localFcComment(f))+'</div>'+aiTag(!!ai);
}

/* ---- ANOMALİ TARAMASI ---- */
function scanAnomalies(co){
 var F=[];
 var tx=byCo(S.txns,co);
 var seen={};
 tx.forEach(function(t){
  if(t.type!=='gider')return;
  var k=t.date+'|'+t.amount+'|'+(t.cat||'');
  if(seen[k]===1){F.push({s:'n',t:'Mükerrer kayıt şüphesi',d:dTR(t.date)+' · '+fmt(t.amount)+' · '+(t.cat||'')+' — aynı gün aynı tutar iki kez girilmiş olabilir ('+(t.desc||'').slice(0,40)+')'});seen[k]=2;}
  else if(seen[k]!==2)seen[k]=1;
 });
 var from90=addDays(todayISO(),-90),stats={};
 tx.forEach(function(t){if(t.type==='gider'&&t.date>=from90){var cc=t.cat||'—';(stats[cc]=stats[cc]||[]).push(+t.amount);}});
 tx.forEach(function(t){
  if(t.type!=='gider'||t.date.slice(0,7)!==monthISO())return;
  var arr=stats[t.cat||'—']||[];
  if(arr.length>=5){var avg=arr.reduce(function(a,b){return a+b;},0)/arr.length;
   if(+t.amount>avg*3&&+t.amount>2000)F.push({s:'w',t:'Sıra dışı tutar',d:dTR(t.date)+' · '+(t.cat||'')+' · '+fmt(t.amount)+' — kategorinin 90 gün ortalamasının ('+fmt0(avg)+') 3 katından fazla'});}
 });
 byCo(S.accounts,co).forEach(function(a){
  var b=accBalance(a);
  if(b<0)F.push({s:'n',t:'Negatif bakiye',d:a.name+' hesabı '+fmt(b)+' seviyesinde'});
  else if(a.type==='kasa'&&b>75000)F.push({s:'w',t:'Kasada yüksek nakit',d:a.name+': '+fmt0(b)+' — güvenlik için bankaya yatırmayı değerlendirin'});
 });
 byCo(S.cari,co).forEach(function(c){
  var b=cariBalance(c);
  if(+c.riskLimit>0&&b>+c.riskLimit)F.push({s:'n',t:'Risk limiti aşımı',d:c.name+' bakiyesi '+fmt0(b)+' (limit '+fmt0(c.riskLimit)+')'});
 });
 reminders(co).filter(function(r){return r.df<0;}).slice(0,5).forEach(function(r){
  F.push({s:'n',t:'Geciken ödeme',d:r.t+' · '+dTR(r.d)+' ('+Math.abs(r.df)+' gün gecikti)'});
 });
 return F;
}
async function aiAnomaly(){
 var F=scanAnomalies(CO);
 var body=F.length
  ? F.map(function(f){return '<div class="rem '+(f.s==='n'?'d-red':'d-org')+'"><span class="dot"></span><span><b>'+esc(f.t)+':</b> '+esc(f.d)+'</span></div>';}).join('')
  : '<div class="empty"><b>Temiz görünüyor ✓</b>Mükerrer kayıt, sıra dışı tutar, negatif bakiye veya limit aşımı tespit edilmedi.</div>';
 var o=document.getElementById('aiOut');if(!o)return;
 o.innerHTML='<div class="card"><h2>🕵️ Anomali Taraması <span class="tiny">'+F.length+' bulgu</span></h2>'+body+'<div id="agAi">'+(F.length?'<div class="tiny" style="margin-top:8px">✦ AI değerlendirmesi hazırlanıyor…</div>':'')+'</div></div>';
 try{o.scrollIntoView({behavior:'smooth'});}catch(e){}
 if(!F.length)return;
 var ai=await aiAsk('Anomali bulguları: '+JSON.stringify(F.map(function(f){return f.t+': '+f.d;}))+'\n\nGÖREV: 2-3 cümlede en kritik bulguyu ve yapılması gerekeni söyle.');
 var g=document.getElementById('agAi');
 if(g)g.innerHTML='<div class="aiBox" style="margin-top:8px;white-space:pre-wrap">'+esc(ai||('En kritik bulgu: '+F[0].t+' — '+F[0].d+'. Kaydı açıp doğrulayın; hatalıysa silin, doğruysa açıklamaya not düşün.'))+'</div>'+aiTag(!!ai);
}

/* ---- MALİYET OPTİMİZASYONU ---- */
function costFindings(co){
 var F=[];
 var ent=byCo(S.posEntries,co),agg={};
 ent.forEach(function(e){var a=agg[e.posId]=agg[e.posId]||{g:0,c:0};a.g+=+e.gross;a.c+=+e.comm;});
 var rows=byCo(S.pos,co).map(function(p){var a=agg[p.id]||{g:0,c:0};return {p:p,g:a.g,c:a.c};})
  .filter(function(r){return r.g>0;})
  .map(function(r){r.eff=r.c/r.g*100;return r;})
  .sort(function(a,b){return a.eff-b.eff;});
 if(rows.length>=2){
  var best=rows[0],worst=rows[rows.length-1];
  if(worst.eff-best.eff>0.2){
   var months=new Set(ent.filter(function(e){return e.posId===worst.p.id;}).map(function(e){return e.date.slice(0,7);})).size||1;
   var tasarruf=(worst.g/months)*(worst.eff-best.eff)/100;
   F.push({t:'POS komisyon farkı',d:worst.p.name+' efektif %'+worst.eff.toFixed(2)+' — '+best.p.name+' %'+best.eff.toFixed(2)+'. Ciroyu '+best.p.name+' cihazına kaydırırsanız tahmini aylık ~'+fmt0(tasarruf)+' tasarruf.'});
  }
 }
 var a30=sumRange(co,addDays(todayISO(),-29),todayISO()).byCat;
 var b30=sumRange(co,addDays(todayISO(),-59),addDays(todayISO(),-30)).byCat;
 Object.keys(a30).forEach(function(cc){
  var prev=b30[cc]||0;
  if(prev>1000&&a30[cc]>prev*1.25)F.push({t:'Hızlanan gider: '+cc,d:'Son 30 gün '+fmt0(a30[cc])+' — önceki 30 güne ('+fmt0(prev)+') göre %'+(((a30[cc]-prev)/prev)*100).toFixed(0)+' artış.'});
 });
 byCo(S.fixed,co).forEach(function(f){
  var logs=S.fixedLogs.filter(function(l){return l.fixedId===f.id&&!l.deletedAt;}).sort(function(a,b){return a.period<b.period?-1:1;});
  if(logs.length>=4){
   var last=+logs[logs.length-1].amount;
   var prev3=logs.slice(-4,-1);
   var avg=prev3.reduce(function(s,l){return s+ +l.amount;},0)/prev3.length;
   if(avg>0&&last>avg*1.2)F.push({t:'Fatura artışı: '+f.name,d:'Son ödeme '+fmt0(last)+' — önceki 3 ay ortalamasının ('+fmt0(avg)+') %'+(((last-avg)/avg)*100).toFixed(0)+' üzerinde.'});
  }
 });
 return F;
}
async function aiCost(){
 var F=costFindings(CO);
 var body=F.length
  ? F.map(function(f){return '<div class="rem d-org"><span class="dot"></span><span><b>'+esc(f.t)+':</b> '+esc(f.d)+'</span></div>';}).join('')
  : '<div class="empty"><b>Belirgin fırsat yok ✓</b>POS komisyonları dengeli, gider kalemlerinde ani artış görünmüyor.</div>';
 var o=document.getElementById('aiOut');if(!o)return;
 o.innerHTML='<div class="card"><h2>💰 Maliyet Optimizasyonu <span class="tiny">'+F.length+' fırsat</span></h2>'+body+'<div id="agAi">'+(F.length?'<div class="tiny" style="margin-top:8px">✦ AI önerisi hazırlanıyor…</div>':'')+'</div></div>';
 try{o.scrollIntoView({behavior:'smooth'});}catch(e){}
 if(!F.length)return;
 var ai=await aiAsk('Maliyet bulguları: '+JSON.stringify(F.map(function(f){return f.t+': '+f.d;}))+'\n\nGÖREV: En yüksek etkili 2 aksiyonu öncelik sırasıyla, 3-4 cümlede öner.');
 var g=document.getElementById('agAi');
 if(g)g.innerHTML='<div class="aiBox" style="margin-top:8px;white-space:pre-wrap">'+esc(ai||('Öncelik: '+F[0].t+'. '+F[0].d))+'</div>'+aiTag(!!ai);
}

/* ---- CARİ RİSK & TAHSİLAT ---- */
function cariRiskRows(co){
 var out=[];
 byCo(S.cari,co).forEach(function(c){
  var b=cariBalance(c);if(b<=0)return;
  var od=S.cariTxns.filter(function(t){return t.cariId===c.id&&!t.deletedAt&&!t.kapandi&&t.type==='borc'&&t.vade&&daysDiff(t.vade)<0;}); // v14-H16
  var maxG=od.reduce(function(m,t){return Math.max(m,-daysDiff(t.vade));},0);
  var odSum=od.reduce(function(s,t){return s+ +t.amount;},0);
  var skor=Math.min(100,Math.round(maxG*1.5+(odSum/b)*40+((+c.riskLimit>0&&b>+c.riskLimit)?25:0)));
  var cekP=S.cheques.filter(function(k){return k.cariId===c.id&&!k.deletedAt&&k.tip==='alinan'&&(k.durum==='portfoy'||k.durum==='tahsilde');}).reduce(function(sm,k){return sm+ +k.tutar;},0); // B6: portföydeki çek güvencesi
  out.push({c:c,b:b,maxG:maxG,odSum:odSum,skor:skor,cekP:cekP});
 });
 return out.sort(function(a,b){return b.skor-a.skor||b.b-a.b;});
}
function aiCariRisk(){
 var rows=cariRiskRows(CO);
 var o=document.getElementById('aiOut');if(!o)return;
 if(!rows.length){o.innerHTML='<div class="card"><h2>⚖️ Cari Risk & Tahsilat</h2><div class="empty"><b>Açık alacak yok</b>Bakiyesi lehimize olan cari bulunmuyor.</div></div>';return;}
 o.innerHTML='<div class="card"><h2>⚖️ Cari Risk & Tahsilat <span class="tiny">skor: gecikme + vade aşımı payı + limit</span></h2>'+
  '<table><thead><tr><th>Cari</th><th class="num">Alacak</th><th class="num">Gecikmiş</th><th class="num">Çek (portföyde)</th><th>Risk Skoru</th><th class="rowact"></th></tr></thead><tbody>'+
  rows.slice(0,12).map(function(r){
   var col=r.skor>=60?'var(--neg)':r.skor>=30?'var(--warn)':'var(--pos)';
   return '<tr><td><b data-act="cariDetail" data-arg="'+r.c.id+'" style="cursor:pointer;text-decoration:underline dotted">'+esc(r.c.name)+'</b>'+(r.maxG?'<div class="tiny">en eski vade '+r.maxG+' gün gecikmiş</div>':'')+'</td>'+
    '<td class="num">'+fmt0(r.b)+'</td><td class="num" style="color:var(--neg)">'+(r.odSum?fmt0(r.odSum):'—')+'</td><td class="num">'+(r.cekP?fmt0(r.cekP)+' <span class="tiny">güvenceli</span>':'—')+'</td>'+
    '<td><div style="display:flex;align-items:center;gap:7px"><div class="skorBar"><i style="width:'+r.skor+'%;background:'+col+'"></i></div><b style="color:'+col+';min-width:24px;text-align:right">'+r.skor+'</b></div></td>'+
    '<td class="rowact"><button class="btn sm gh" data-act="aiCollectMail" data-arg="'+r.c.id+'" title="Tahsilat e-postası">✉</button></td></tr>';
  }).join('')+
  '</tbody></table><p class="tiny" style="margin-top:8px">✉ kibar bir tahsilat hatırlatma e-postası taslağı hazırlar (AI erişilirse metni iyileştirir).</p></div>';
 try{o.scrollIntoView({behavior:'smooth'});}catch(e){}
}
async function aiCollectMail(cariId){
 var c=S.cari.find(function(x){return x.id===cariId;});if(!c)return;
 var b=cariBalance(c);
 var od=S.cariTxns.filter(function(t){return t.cariId===c.id&&!t.deletedAt&&!t.kapandi&&t.type==='borc'&&t.vade&&daysDiff(t.vade)<0;}) /* v14-H16 */
  .map(function(t){return {tarih:t.date,vade:t.vade,tutar:+t.amount,aciklama:t.desc||''};});
 var odT=od.reduce(function(s,t){return s+t.tutar;},0);
 var loc='Konu: '+coName(CO)+' — Hesap Bakiyesi Hatırlatması\n\nSayın '+c.name+' yetkilisi,\n\nKayıtlarımıza göre '+dTR(todayISO())+' itibarıyla hesabınızda '+fmt(b)+' tutarında bakiye bulunmaktadır'+(od.length?' ve bunun '+fmt0(odT)+' tutarındaki kısmının vadesi geçmiştir':'')+'. Ödeme planınız hakkında bilgi verebilirseniz seviniriz; mutabakat için güncel ekstrenizi paylaşabiliriz.\n\nİyi çalışmalar dileriz,\n'+coName(CO)+' Muhasebe';
 mailModal(c,loc,false);
 var ai=await aiAsk('Cari: '+c.name+' · Guncel bakiye: '+Math.round(b)+' TL · Gecikmis kalemler: '+JSON.stringify(od)+'\n\nGÖREV: İş ilişkisini bozmayan, kibar ama net bir tahsilat hatırlatma e-postası yaz. Format: "Konu: ..." satırı + boş satır + gövde. En fazla 120 kelime. İmza: "'+coName(CO)+' Muhasebe".');
 if(ai&&document.getElementById('mailTxt'))mailModal(c,ai,true);
}
function mailModal(c,text,live){
 document.getElementById('modalBox').innerHTML=
  '<div class="mh"><h3>✉ Tahsilat E-postası — '+esc(c.name)+'</h3><button data-act="closeModal" style="font-size:20px;color:var(--ink3)">✕</button></div>'+
  '<div class="mb"><div class="fld"><textarea id="mailTxt" rows="11" style="font-size:13px;line-height:1.5">'+esc(text)+'</textarea></div>'+
  '<div class="tiny">'+(live?'✦ AI taslağı — göndermeden önce mutlaka kontrol edin.':'⚙ Yerleşik şablon — AI erişilirse metin otomatik iyileştirilir.')+'</div></div>'+
  '<div class="mf"><button class="btn gh" data-act="closeModal">Kapat</button><button class="btn" data-act="copyMail">📋 Kopyala</button></div>';
 document.getElementById('modalWrap').classList.add('on');
}
function copyMail(){
 var t=document.getElementById('mailTxt');if(!t)return;
 t.select();
 var ok=false;try{ok=document.execCommand('copy');}catch(e){}
 if(!ok&&navigator.clipboard){navigator.clipboard.writeText(t.value).then(function(){toast('E-posta panoya kopyalandı');});return;}
 toast(ok?'E-posta panoya kopyalandı':'Kopyalanamadı — metni elle seçip kopyalayın');
}

/* ---- AI CFO ANALİZİ ---- */
async function aiCFO(){
 var target=document.getElementById(PAGE==='rep'?'aiBox':'aiOut')||document.getElementById('aiOut');
 if(!target)return;
 target.innerHTML='<div class="card"><h2>🧠 AI CFO Analizi</h2><div class="aiBox">Derin analiz hazırlanıyor…</div></div>';
 try{target.scrollIntoView({behavior:'smooth'});}catch(e){}
 var co=CO;
 var ms=monthSeries(co,4);
 var m=sumRange(co,monthISO()+'-01',todayISO());
 var pp=periodAdd(monthISO(),-1);
 var pm=sumRange(co,pp+'-01',pp+'-31');
 var f=cashForecast(co,30);
 var an=scanAnomalies(co).slice(0,6).map(function(x){return x.t+': '+x.d;});
 var ag=agingBuckets(co);
 var pack={sirket:coName(co),sonAylar:ms,buAy:{gelir:Math.round(m.gelir),gider:Math.round(m.gider),net:Math.round(m.net),giderKirilimi:m.byCat},
  gecenAy:{gelir:Math.round(pm.gelir),gider:Math.round(pm.gider),net:Math.round(pm.net)},
  nakitProjeksiyon30g:{bugun:Math.round(f.bal0),sonra:Math.round(f.end),enDusuk:Math.round(f.minB),enDusukTarih:f.minD},
  vadesiGecmisAlacak:Math.round(ag.tot),anomaliler:an};
 var ai=await aiAsk('VERI: '+JSON.stringify(pack)+'\n\nGÖREV: CFO gözüyle sade Türkçe analiz: 1) Genel değerlendirme (2 cümle) 2) Geçen aya kıyasla marj/trend 3) En önemli 3 risk 4) 3 somut aksiyon. Madde işaretli, başlıksız, en fazla 220 kelime.',1200);
 var loc=localAiSummary(aiDataPack('co'))+
  '\n\n• 30 gün nakit projeksiyonu: '+fmt0(f.bal0)+' → '+fmt0(f.end)+(f.minB<0?' — ⚠ '+dTR(f.minD)+' civarı '+fmt0(f.minB)+' açık riski':'')+
  '\n• Vadesi geçmiş alacak hareketi: '+fmt0(ag.tot)+
  (an.length?'\n• Anomali: '+an[0]:'');
 target.innerHTML='<div class="card"><h2>🧠 AI CFO Analizi</h2><div class="aiBox" style="white-space:pre-wrap">'+esc(ai||loc)+'</div>'+aiTag(!!ai)+'</div>';
}

/* ---- ALACAK YAŞLANDIRMA ---- */
function agingBuckets(co){
 var B=[0,0,0,0],tot=0,per={};
 var _abal={}; // v14-H10: reminders() ile aynı bakiye koruması — tahsil edilmiş ama vadesi elle kapatılmamış kalemler kovada kalmasın
 byCo(S.cari,co).forEach(function(c){_abal[c.id]=cariBalance(c);});
 S.cariTxns.forEach(function(t){
  if(t.co!==co||t.type!=='borc'||!t.vade||t.deletedAt||t.kapandi)return;
  if(_abal[t.cariId]!==undefined&&_abal[t.cariId]<=0)return;
  var g=-daysDiff(t.vade);if(g<=0)return;
  var i=g<=30?0:g<=60?1:g<=90?2:3;
  B[i]+=+t.amount;tot+=+t.amount;
  per[t.cariId]=(per[t.cariId]||0)+ +t.amount;
 });
 var top=Object.entries(per).sort(function(a,b){return b[1]-a[1];}).slice(0,3)
  .map(function(e){var c=S.cari.find(function(x){return x.id===e[0];});return {id:e[0],name:(c||{}).name||'?',v:e[1]};});
 return {B:B,tot:tot,top:top};
}
function cariAgingCard(){
 var a=agingBuckets(CO);
 if(!a.tot)return '';
 var L=['0-30 gün','31-60 gün','61-90 gün','90+ gün'];
 return '<div class="card"><h2>⏳ Alacak Yaşlandırma <span class="tiny">vadesi geçen borç hareketleri · toplam '+fmt0(a.tot)+' — kovaya tıklayınca liste filtrelenir</span></h2>'+
  '<div class="grid g4">'+a.B.map(function(v,i){var on=String(cariVade)===String(i);return '<div class="kpi'+(i>=2&&v>0?' n':'')+'" data-act="setCariVade" data-arg="'+i+'" style="cursor:pointer'+(on?';outline:2px solid var(--acc)':'')+'" title="'+L[i]+' gecikmiş borcu olan carileri listele"><div class="l">'+L[i]+' ↗'+(on?' ✓':'')+'</div><div class="v">'+fmt0(v)+'</div></div>';}).join('')+'</div>'+
  (a.top.length?'<p class="tiny" style="margin-top:9px">En yüksek gecikme: '+a.top.map(function(t){return '<b data-act="cariDetail" data-arg="'+t.id+'" style="cursor:pointer;text-decoration:underline dotted" title="Cari detayını aç">'+esc(t.name)+'</b> ('+fmt0(t.v)+')';}).join(' · ')+' — önceliklendirme için <b>AI Asistan → Cari Risk</b> ajanını kullanın.</p>':'')+'</div>';
}

/* ---- POS KARŞILAŞTIRMA ---- */
function posCompareCard(list,ent){
 var agg={};ent.forEach(function(e){var a=agg[e.posId]=agg[e.posId]||{g:0,c:0};a.g+=+e.gross;a.c+=+e.comm;});
 var rows=list.map(function(p){var a=agg[p.id]||{g:0,c:0};return {p:p,g:a.g,c:a.c};})
  .filter(function(r){return r.g>0;})
  .map(function(r){r.eff=r.c/r.g*100;return r;})
  .sort(function(a,b){return a.eff-b.eff;});
 if(rows.length<2)return '';
 var best=rows[0],fark=rows[rows.length-1].eff-best.eff;
 return '<div class="card"><h2>⚖ POS Karşılaştırma <span class="tiny">efektif maliyet — tüm zamanlar</span></h2>'+
  '<table><thead><tr><th>POS</th><th class="num">Brüt Ciro</th><th class="num hidem">Komisyon</th><th class="num">Efektif %</th><th class="hidem">Blokaj</th></tr></thead><tbody>'+
  rows.map(function(r){return '<tr><td><b>'+esc(r.p.name)+'</b> '+(r===best?'<span class="chip p">En avantajlı</span>':'')+'</td><td class="num">'+fmt0(r.g)+'</td><td class="num hidem" style="color:var(--neg)">'+fmt0(r.c)+'</td><td class="num"><b>%'+r.eff.toFixed(2)+'</b></td><td class="hidem">'+(r.p.blokaj||0)+' gün</td></tr>';}).join('')+
  '</tbody></table>'+
  (fark>0.2?'<p class="tiny" style="margin-top:8px">💡 Ciroyu <b>'+esc(best.p.name)+'</b> cihazına yönlendirirseniz her 100.000 ₺ ciroda ~'+fmt0(fark*1000)+' komisyon tasarrufu.</p>':'')+'</div>';
}

/* ---- KART TAKSİT YÜKÜ ---- */
function cardInstCard(list){
 var cur=monthISO(),load={};
 S.cardTxns.forEach(function(t){
  if(t.type!=='harcama'||t.deletedAt)return;
  if(!list.some(function(c){return c.id===t.cardId;}))return;
  var n=+t.taksit||1,per=+t.amount/n;
  for(var i=0;i<n;i++){var p=periodAdd(t.date.slice(0,7),i);if(p>=cur)load[p]=(load[p]||0)+per;}
 });
 var labels=[],vals=[];
 for(var i=0;i<12;i++){var p=periodAdd(cur,i);labels.push(AYLAR[+p.slice(5,7)-1].slice(0,3));vals.push(Math.round(load[p]||0));}
 var taksitli=S.cardTxns.some(function(t){return t.type==='harcama'&&(+t.taksit||1)>1&&list.some(function(c){return c.id===t.cardId;});});
 if(!taksitli)return '';
 return '<div class="card"><h2>📆 Gelecek 12 Ay Kart Yükü <span class="tiny">taksitler döneme bölünmüş tahmini çıkış</span></h2>'+
  chartArea([{name:'Aylık yük',color:'#a24a68',values:vals}],labels,170)+'</div>';
}

/* ---- GENEL ARAMA ---- */
function globalSearch(){
 if(!CO)return;
 try{closeSheet();}catch(e){}
 document.getElementById('modalBox').innerHTML=
  '<div class="mh"><h3>🔍 Genel Arama</h3><button data-act="closeModal" style="font-size:20px;color:var(--ink3)">✕</button></div>'+
  '<div class="mb"><div class="fld"><input id="gsIn" placeholder="Cari, işlem, personel, görev, çek, ürün, hesap… (en az 2 harf)" autocomplete="off"></div><div id="gsRes" style="margin-top:8px"><div class="tiny" style="padding:4px 2px">Yazdıkça '+(CO==='grup'?'4 şirkette birden':coName(CO)+' kayıtlarında')+' arar. Kısayol: <b>/</b></div></div></div>';
 document.getElementById('modalWrap').classList.add('on');
 var i=document.getElementById('gsIn');
 i.addEventListener('input',runGS); // 200ms debounce'lu
 i.addEventListener('keydown',function(e){if(e.key==='Enter')e.preventDefault();});
 setTimeout(function(){try{i.focus();}catch(e){}},60);
}
var _gsT=null;
function runGS(){ clearTimeout(_gsT); _gsT=setTimeout(runGSNow,200); } // A15: her tuşta tam tarama yerine 200ms debounce
function runGSNow(){
 var el=document.getElementById('gsIn');var box=document.getElementById('gsRes');
 if(!el||!box)return;
 var q=trLow(el.value).trim();
 if(q.length<2){box.innerHTML='<div class="tiny" style="padding:4px 2px">Aramak için en az 2 harf yazın…</div>';return;}
 var grup=(CO==='grup');
 var coList=grup?COMPANIES.map(function(c){return c.id;}):[CO];
 var R=[];
 function hit(s){ if(R.length>=9)return false; return trLow(s).indexOf(q)>-1; } // A15: liste dolunca bakiye hesaplamalarını atla
 function push(ic,label,sub,page,kind,id,co){if(R.length<9)R.push({ic:ic,label:label,sub:(grup?coName(co)+' · ':'')+sub,page:page,kind:kind||'',id:id||'',co:co});}
 coList.forEach(function(co){
  byCo(S.cari,co).forEach(function(c){if(hit(c.name)||hit(c.taxNo)||hit(c.phone)||hit(c.email))push('👥',c.name,'Cari · bakiye '+fmt0(cariBalance(c)),'cari','cariE',c.id,co);}); // v14-D: e-posta da aranıyor
  byCo(S.staff,co).forEach(function(s){if(hit(s.name)||hit(s.pos))push('🧑‍🍳',s.name,'Personel · '+(s.pos||''),'staff','',s.id,co);});
  byCo(S.txns,co).forEach(function(t){if(hit(t.desc)||hit(t.doc)||String(t.amount).indexOf(q)>-1)push('⇅',(t.desc||t.cat||'İşlem'),dTR(t.date)+' · '+fmt(t.amount)+' · '+(t.type==='gelir'?'Gelir':t.type==='gider'?'Gider':'Virman'),'tx','',t.id,co);});
  byCo(S.tasks,co).forEach(function(g){if(hit(g.title))push('✔',g.title,'Görev · '+(g.status==='tamam'?'tamamlandı':'açık'),'task','',g.id,co);});
  byCo(S.cheques,co).forEach(function(c){if(hit(c.kisi))push('🧾',c.kisi,(c.tip==='alinan'?'Alınan':'Verilen')+' '+(c.tur==='senet'?'senet':'çek')+' '+fmt0(c.tutar)+' · vade '+dTR(c.vade),'cek','',c.id,co);});
  byCo(S.stock,co).forEach(function(it){if(hit(it.name))push('📦',it.name,'Stok · '+stockQty(it)+' '+(it.unit||''),'stok','',it.id,co);});
  byCo(S.accounts,co).forEach(function(a){if(hit(a.name)||hit(a.bankName)||hit(a.iban)||hit(a.accNo))push('🏦',a.name,'Hesap · '+fmt0(accBalance(a)),'acc','',a.id,co);});
  byCo(S.fixed,co).forEach(function(f){if(hit(f.name))push('📅',f.name,'Sabit ödeme · '+fmt0(f.amount),'fixed','',f.id,co);});
  byCo(S.cards,co).forEach(function(cd){if(hit(cd.name)||hit(cd.bank))push('💠',cd.name,'Kart · borç '+fmt0(cardDebt(cd)),'card','cardE',cd.id,co);});
 });
 box.innerHTML= R.length
  ? R.map(function(r){return '<button class="gsRow" data-act="gsGo" data-arg="'+r.page+'~'+r.kind+'~'+r.id+'~'+r.co+'"><span>'+r.ic+'</span><span style="min-width:0"><b>'+esc(r.label)+'</b><div class="tiny">'+esc(r.sub)+'</div></span><span class="chip g">git →</span></button>';}).join('')
  : '<div class="empty" style="padding:12px"><b>Sonuç yok</b>Aramanız için eşleşme bulunamadı.</div>';
}
function gsGo(page,kind,id,co){
 closeModal();
 if(co&&co!==CO)enterCo(co);
 go(page);
 if(kind==='cariE'&&id)setTimeout(function(){try{cariEkstre(id);}catch(e){}},90);
 if(kind==='cardE'&&id)setTimeout(function(){try{cardEkstre(id);}catch(e){}},90);
}
document.addEventListener('keydown',function(e){
 if(e.key!=='/'||!CO)return;
 var t=e.target,tag=t&&t.tagName;
 if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
 if(document.getElementById('modalWrap').classList.contains('on'))return;
 e.preventDefault();globalSearch();
});
function openAiChat(){
 if(!CO){toast('Önce bir şirket seçin');return;}
 go('ai');
 setTimeout(function(){var i=document.getElementById('aiIn');if(i)try{i.focus();}catch(e){}},90);
}

/* ---- AYARLAR: AI KARTI ---- */
function aiSettingsCard(){
 var auto=S.ai&&S.ai.autoBrief;
 var n=Object.keys(S.aiCache||{}).length;
 var st=AI_ON===false?' <b style="color:var(--warn)">Şu an: yerleşik mod.</b>':AI_ON===true?' <b style="color:var(--pos)">Şu an: canlı AI ✓</b>':'';
 return '<div class="card"><h2>✦ Yapay Zeka Ayarları</h2>'+
  '<p class="mut" style="margin-bottom:11px">AI ajanları yalnızca öneri üretir; onayınız olmadan hiçbir kayıt oluşturmaz veya değiştirmez. Claude ortamında canlı yapay zeka, dışarıda yerleşik kural tabanlı analiz çalışır.'+st+'</p>'+
  '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
  '<button class="btn '+(auto?'':'gh')+'" data-act="toggleAutoBrief">🌅 Otomatik sabah brifingi: '+(auto?'AÇIK':'kapalı')+'</button>'+
  '<button class="btn gh" data-act="aiCacheClear">🧹 AI önbelleğini temizle'+(n?' ('+n+')':'')+'</button>'+
  '<button class="btn gh" data-act="openAiChat">✦ AI Asistanı Aç</button></div></div>';
}
function toggleAutoBrief(){S.ai=S.ai||{};S.ai.autoBrief=S.ai.autoBrief?0:1;save();toast(S.ai.autoBrief?'Sabah brifingi her gün ilk açılışta otomatik oluşturulacak':'Otomatik brifing kapatıldı — dilediğinizde elle çalıştırabilirsiniz');rSet();}
function aiCacheClear(){S.aiCache={};briefTried={};save();toast('AI önbelleği temizlendi');rSet();}

/* ---- DEMO EKLERİ (taksit, gecikmiş vade, mükerrer örneği) ---- */
function demoV4Extras(){
 try{
  COMPANIES.forEach(function(c){
   var card=S.cards.find(function(x){return x.co===c.id;});
   if(card){
    var _cdV4=nid();
    S.cardTxns.push({id:_cdV4,co:c.id,cardId:card.id,type:'harcama',date:addDays(todayISO(),-20),amount:36000,cat:'Bakım & Onarım',desc:'Endüstriyel ekipman revizyonu (6 taksit)',taksit:6});
    S.txns.push({id:nid(),co:c.id,type:'gider',date:addDays(todayISO(),-20),amount:36000,cat:'Bakım & Onarım',accId:'',cardTxnId:_cdV4,desc:'Endüstriyel ekipman revizyonu (6 taksit, kredi kartı)',src:'card'});
   }
   var mus=S.cari.find(function(x){return x.co===c.id&&(x.type==='musteri'||x.type==='her2');});
   if(mus){
    S.cariTxns.push({id:nid(),co:c.id,cariId:mus.id,type:'borc',date:addDays(todayISO(),-55),vade:addDays(todayISO(),-25),amount:18500,desc:'Fatura #A-'+c.id.toUpperCase()+'103 (vadesi geçti)'});
    S.cariTxns.push({id:nid(),co:c.id,cariId:mus.id,type:'borc',date:addDays(todayISO(),-95),vade:addDays(todayISO(),-65),amount:9750,desc:'Fatura #A-'+c.id.toUpperCase()+'087 (vadesi geçti)'});
   }
  });
  var acc=S.accounts.find(function(a){return a.co==='rest'&&a.type==='banka';});
  if(acc){
   var d=addDays(todayISO(),-3);
   S.txns.push({id:nid(),co:'rest',type:'gider',date:d,amount:4850,cat:'Hammadde & Malzeme',accId:acc.id,desc:'Sebze-meyve alımı'});
   S.txns.push({id:nid(),co:'rest',type:'gider',date:d,amount:4850,cat:'Hammadde & Malzeme',accId:acc.id,desc:'Sebze-meyve alımı'});
  }
 }catch(e){}
}

window.__v4=true;

/* ================== v5 — ÜST ÇUBUK ŞİRKET MENÜSÜ & KULLANICI PROFİLİ ================== */
function userName(){if(SESSION){var u=(S.users||[]).find(function(x){return x.id===SESSION.id;});if(u&&u.displayName)return u.displayName;return SESSION.username||'Kullanıcı';}return (S.user&&S.user.name)?S.user.name:'Kullanıcı';}
function userForm(){
 if(!SESSION){toast('Önce giriş yapın');return;}
 var me=(S.users||[]).find(function(x){return x.id===SESSION.id;})||{};
 var init={name:me.displayName||SESSION.username||'',title:me.title||''};
 openForm('Kullanıcı Profili (yalnızca size özel)',[
  {name:'name',label:'Ad Soyad',req:1,ph:'Ör: Buse Aydın'},
  {name:'title',label:'Görev / Unvan',ph:'Ör: İşletme Sahibi, Muhasebe'}
 ],function(o){
  var u2=(S.users||[]).find(function(x){return x.id===SESSION.id;});
  if(u2){u2.displayName=o.name;u2.title=o.title||'';}save();
  toast('Merhaba '+o.name+'! Profiliniz kaydedildi');
  if(CO)go(PAGE); else renderSelect();
 },init);
}
function coMenuHtml(){
 var h='';
 COMPANIES.forEach(function(c){
  if(!canAccessCo(c.id))return;
  var bal=0;byCo(S.accounts,c.id).forEach(function(a){bal+=accBalance(a);});
  h+='<button data-act="coJump" data-arg="'+c.id+'"><span class="cdot" style="background:'+c.color+'"></span><b>'+c.name+'</b>'+(c.id===CO?'<span class="chip p" style="margin-left:4px">Aktif</span>':'')+'<span class="bal">'+kfmt(bal)+' ₺</span></button>';
 });
 h+='<div class="sep"></div>';
 if(canAccessCo('grup')){
  h+='<button data-act="coJump" data-arg="grup"><span class="cdot" style="background:#0c6b58"></span><b>LOLE GRUP</b>'+(CO==='grup'?'<span class="chip p" style="margin-left:4px">Aktif</span>':'')+'<span class="bal">Konsolide</span></button>';
 }
 h+='<button data-act="goSelect"><span class="cdot" style="background:var(--ink3)"></span>Şirket seçim ekranı…</button>';
 h+='<div class="sep"></div>';
 h+='<button data-act="doLogout"><span class="cdot" style="background:var(--neg)"></span>Çıkış Yap'+(SESSION?' ('+esc(SESSION.username)+')':'')+'</button>';
 return '<div id="coMenu">'+h+'</div>';
}
function toggleCoMenu(){var m=document.getElementById('coMenu');if(m)m.classList.toggle('on');}
function coJump(id){
 var m=document.getElementById('coMenu');if(m)m.classList.remove('on');
 if(id===CO)return;
 if(!canAccessCo(id)){toast('Bu şirkete erişim yetkiniz yok');return;}
 var keep=PAGE;
 enterCo(id);
 if(id==='grup'){ if(keep==='set')go('set'); return; }
 if(keep&&keep!=='grup'&&keep!=='dash')go(keep);
 toast(coName(id)+' ekranındasınız');
}
document.addEventListener('click',function(e){
 var m=document.getElementById('coMenu');
 if(!m||!m.classList.contains('on'))return;
 var t=e.target;
 if(t&&t.closest&&(t.closest('#coMenu')||t.closest('[data-act="toggleCoMenu"]')))return;
 m.classList.remove('on');
});
window.__v5=true;

/* ================== v6 — EKİP MODU (Claude yayınında ortak veri) ================== */
function modeCard(){
 return '<div class="card"><h2>🌐 Veri Modu <span class="chip w">Çevrimiçi — Ortak</span></h2>'+
  '<p class="mut">Bu uygulamadaki tüm veriler (işlemler, hesaplar, kullanıcı listesi) giriş yapan yetkili kullanıcılar arasında <b>çevrimiçi ve ortak olarak</b> tutulur; hiçbir veri yalnızca bir cihazda saklanmaz. Uygulamaya her dönüşte veriler otomatik tazelenir; aynı anda iki kişi kaydederse son kaydeden geçerli olur.</p></div>';
}
function storageUsageCard(){
 var u=computeStorageEstimate();
 var lvl = u.pct>=90?'n':(u.pct>=70?'w':'p');
 var lvlTxt = u.pct>=90?'Kritik':(u.pct>=70?'Dikkat':'Normal');
 var warn = u.pct>=70 ? '<p class="tiny" style="margin-top:10px;color:'+(u.pct>=90?'var(--neg)':'var(--warn)')+'">'+(u.pct>=90?'⚠ Depolamanın dolmasına çok az kaldı — yedek saklama süresini kısaltmayı konuşalım.':'Kullanım artıyor, bir süre sonra yedek saklama süresini gözden geçirmek isteyebiliriz.')+'</p>' : '';
 return '<div class="card"><h2>📦 Bulut Depolama Kullanımı <span class="chip '+lvl+'">'+lvlTxt+' — %'+u.pct.toFixed(0)+'</span></h2>'+
  '<p class="mut" style="margin-bottom:10px">Anthropic gerçek kullanım miktarını sorgulama imkanı sunmuyor — bu, canlı veri + günlük yedeklerin boyutundan yapılan bir <b>tahmindir</b>, kesin ölçüm değildir.</p>'+
  '<table><tbody>'+
   '<tr><td>Canlı veri</td><td class="num">'+fmtBytes(u.live)+'</td></tr>'+
   '<tr><td>Günlük yedekler ('+BACKUP_KEEP_DAYS+' gün)</td><td class="num">'+fmtBytes(u.backups)+'</td></tr>'+
   '<tr><td><b>Toplam (tahmini)</b></td><td class="num"><b>'+fmtBytes(u.total)+'</b> / 20 MB</td></tr>'+
  '</tbody></table>'+warn+'</div>';
}
async function syncTeam(){
 if(!isTeam()||!window.storage)return;
 if(document.getElementById('modalWrap')&&document.getElementById('modalWrap').classList.contains('on'))return; // v34: form açıkken senkron yapma, kullanıcının elindeki işi bozma
 if(pendingSaves>0||dirty)return; // v34: kendi kayıt/gönderim işlemimiz sürerken araya girmeyelim
 try{
  var r=await withTimeout(window.storage.get(skey(),true),5000);
  if(r&&r.value){
   var j=safeParse(r.value);
   if(j&&j.meta&&j.meta.saved&&(!S.meta.saved||j.meta.saved>S.meta.saved)){
    S=fixState(j);
    if(CO)go(PAGE); else renderSelect();
    toast('🌐 Ekip verisi güncellendi');
   }
  }
 }catch(e){}
}
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')syncTeam();});
setInterval(syncTeam,20000); // v34: sekme açık kalsa bile ~20 saniyede bir otomatik kontrol — diğer cihazlardaki değişiklikleri manuel yenileme olmadan yakalar
window.__v6=true;

/* ================== v7 — KULLANICI GİRİŞİ VE YETKİLENDİRME ================== */
function findUserByEmail(email){
 email=String(email||'').trim().toLowerCase();
 if(!email)return null;
 return (S.users||[]).find(function(u){return String(u.email||'').toLowerCase()===email;})||null;
}
function findUserByUsername(username){
 username=String(username||'').trim().toLowerCase();
 if(!username)return null;
 return (S.users||[]).find(function(u){return String(u.username||'').toLowerCase()===username;})||null;
}
function isSuper(){return !!(SESSION&&SESSION.role==='super');}
function logAudit(action,detail){ // v13: kritik olay kaydı — bellekte değil, S içinde (buluta kaydedilir, herkes görür/erişir değil, yalnızca süper yönetici görüntüler)
 try{
  S.auditLog=S.auditLog||[];
  S.auditLog.unshift({ts:new Date().toISOString(), user:(SESSION?SESSION.username:'—'), action:action, detail:detail||''});
  if(S.auditLog.length>200) S.auditLog.length=200; // depoyu şişirmesin, yalnızca son 200 olay
 }catch(e){}
}
function canAccessCo(id){
 if(!SESSION)return false;
 if(SESSION.role==='super')return true;
 var comps=SESSION.companies;
 var allIds=COMPANIES.map(function(c){return c.id;});
 var hasAll = comps==='all' || (Array.isArray(comps)&&allIds.every(function(x){return comps.indexOf(x)!==-1;}));
 if(id==='grup')return hasAll;
 if(hasAll)return true;
 return Array.isArray(comps)&&comps.indexOf(id)!==-1;
}
function renderLogin(){
 document.getElementById('app').classList.remove('on');
 document.getElementById('selectScreen').style.display='none';
 document.getElementById('loginScreen').style.display='flex';
 var err=document.getElementById('loginErr'); if(err)err.style.display='none';
 var el=document.getElementById('loginUser');
 if(el)setTimeout(function(){try{el.focus();}catch(e){}},60);
}
async function sha256Hex(str){
 try{
  var enc=new TextEncoder().encode(String(str));
  var buf=await crypto.subtle.digest('SHA-256',enc);
  return Array.prototype.map.call(new Uint8Array(buf),function(b){return b.toString(16).padStart(2,'0');}).join('');
 }catch(e){return null;}
}
function looksHashed(v){return typeof v==='string'&&/^[0-9a-f]{64}$/i.test(v);}
function checkPw(storedVal,enteredPw,enteredHash){
 if(!storedVal)return false;
 if(looksHashed(storedVal))return enteredHash===storedVal;
 return enteredPw===storedVal; // eski düz metin biçimi (geriye dönük uyum)
}
async function rememberLogin(u){ // "Beni Hatırla": ŞİFREYİ DEĞİL, rastgele bir jetonu buluttaki kişisel depoya yazar
 try{
  if(!window.storage)return;
  var tb=new Uint8Array(16); crypto.getRandomValues(tb);
  var token=Array.prototype.map.call(tb,function(b){return b.toString(16).padStart(2,'0');}).join('');
  var hash=await sha256Hex(token);
  if(!hash)return;
  u.rememberHash=hash; save();
  await withTimeout(window.storage.set('remember',JSON.stringify({username:u.username,token:token}),false),5000); // shared:false → yalnızca bu Claude hesabına özel, cihaza değil
 }catch(e){}
}
async function forgetRemembered(clearUserSide){
 try{
  if(clearUserSide&&SESSION){
   var u=(S.users||[]).find(function(x){return x.id===SESSION.id;});
   if(u&&u.rememberHash){u.rememberHash=null;save();}
  }
  if(window.storage) await withTimeout(window.storage.delete('remember',false),5000);
 }catch(e){}
}
async function tryAutoLogin(){ // sayfa her açıldığında: geçerli bir "hatırlama" jetonu varsa giriş ekranını atla
 try{
  if(!window.storage)return false;
  var r=await withTimeout(window.storage.get('remember',false),5000);
  if(!r||!r.value)return false;
  var data=null; try{data=JSON.parse(r.value);}catch(e){}
  if(!data||!data.username||!data.token)return false;
  var u=findUserByUsername(data.username);
  if(!u||!u.rememberHash)return false;
  var hash=await sha256Hex(data.token);
  if(!hash||hash!==u.rememberHash)return false;
  SESSION={id:u.id,username:u.username,email:u.email,role:u.role,companies:u.companies};
  markActivity();
  return true;
 }catch(e){ return false; }
}
async function loginSubmit(){
 var el=document.getElementById('loginUser');
 var pwEl=document.getElementById('loginPw');
 var errEl=document.getElementById('loginErr');
 var remEl=document.getElementById('loginRemember');
 var username=(el&&el.value||'').trim();
 var pw=(pwEl&&pwEl.value||'');
 if(!username){if(errEl){errEl.textContent='Kullanıcı adınızı girin';errEl.style.display='block';}return;}
 var u=findUserByUsername(username);
 if(!u){if(errEl){errEl.textContent='Bu kullanıcı adı tanımlı değil. Erişim için yöneticinizle iletişime geçin.';errEl.style.display='block';}return;}
 var hp=await sha256Hex(pw);
 var ok=false;
 if(u.password){ // kişiye özel şifre (asıl yol)
  if(u.salt){ var hs=await sha256Hex(u.salt+pw); ok=(hs===u.password); } // C8: tuzlu hash — yeni kayitlar
  else{
   ok=checkPw(u.password,pw,hp); // eski tuzsuz/duz metin — gecis kirilmaz
   if(ok&&hp&&!looksHashed(u.password)){u.password=hp;save();} // eski düz metinden hash'e yükselt
  }
 }else{ // bu kullanıcı için henüz kişisel şifre yok → eski rol bazlı ortak şifreyle dene, başarılıysa kişisel şifreye yükselt
  var legacy=S.authPw&&S.authPw[u.role];
  ok=checkPw(legacy,pw,hp);
  if(ok&&hp){u.password=hp;save();}
 }
 if(!ok){if(errEl){errEl.textContent='Şifre hatalı';errEl.style.display='block';}if(pwEl){pwEl.value='';try{pwEl.focus();}catch(e){}}return;}
 SESSION={id:u.id,username:u.username,email:u.email,role:u.role,companies:u.companies};
 markActivity();
 if(remEl&&remEl.checked){ await rememberLogin(u); } else { await forgetRemembered(false); }
 if(errEl)errEl.style.display='none';
 document.getElementById('loginScreen').style.display='none';
 document.getElementById('selectScreen').style.display='flex';
 logAudit('Giriş yapıldı','');
 toast('Hoş geldiniz — '+u.username);
 renderSelect();
}
function doLogout(){
 if(window.__loleBoot&&window.__loleBoot.signOut){ try{logAudit('Çıkış yapıldı','');}catch(e){} try{window.__loleBoot.signOut();}catch(e){} return; }
 var m=document.getElementById('coMenu');if(m)m.classList.remove('on');
 if(SESSION)logAudit('Çıkış yapıldı','');
 forgetRemembered(true); // hem kullanıcı kaydındaki hem bu Claude hesabındaki hatırlama izini temizle
 SESSION=null;CO=null;
 document.getElementById('app').classList.remove('on');
 document.getElementById('selectScreen').style.display='none';
 document.getElementById('loginScreen').style.display='flex';
 var el=document.getElementById('loginUser');
 var pw=document.getElementById('loginPw');
 if(pw)pw.value='';
 if(el){el.value='';setTimeout(function(){try{el.focus();}catch(e){}},60);}
 toast('Çıkış yapıldı');
}
function trashCard(){
 if(!isSuper())return '';
 const items=(S.trash||[]).slice(0,50);
 const rows=items.length?items.map((e,i)=>'<tr><td class="tiny">'+dTR(String(e.deletedAt).slice(0,10))+'</td><td>'+esc(e.label||e.kind)+'</td><td class="tiny">'+esc(e.deletedBy||'')+'</td><td class="rowact"><button data-act="restoreTrash" data-arg="'+i+'">↩ Geri Getir</button></td></tr>').join('')
  :'<tr><td colspan="4" class="tiny">Çöp kutusu boş.</td></tr>';
 return '<div class="card"><h2>🗑 Silinenler <span class="chip g">'+(S.trash||[]).length+'</span></h2>'+
  '<p class="mut" style="margin-bottom:10px">Silinen kayıtlar burada <b>30 gün</b> saklanır, süre dolunca kalıcı olarak temizlenir. İstediğiniz zaman geri getirebilirsiniz.</p>'+
  '<div style="overflow-x:auto"><table><thead><tr><th>Silindi</th><th>Kayıt</th><th>Kim sildi</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div></div>';
}
function auditLogCard(){
 if(!isSuper())return '';
 const log=(S.auditLog||[]).slice(0,25);
 const rows=log.length?log.map(e=>'<tr><td class="tiny">'+new Date(e.ts).toLocaleString('tr-TR')+'</td><td>'+esc(e.user)+'</td><td>'+esc(e.action)+'</td><td class="tiny">'+esc(e.detail||'')+'</td></tr>').join('')
  :'<tr><td colspan="4" class="tiny">Henüz kayıtlı olay yok.</td></tr>';
 return '<div class="card"><h2>📋 Olay Kaydı <span class="chip g">son '+log.length+' / '+(S.auditLog||[]).length+'</span></h2>'+
  '<p class="mut" style="margin-bottom:10px">Giriş/çıkış, kullanıcı yönetimi ve veri sıfırlama/geri yükleme gibi kritik olayların kaydı — yalnızca süper yönetici görür.</p>'+
  '<div style="overflow-x:auto"><table><thead><tr><th>Zaman</th><th>Kullanıcı</th><th>Olay</th><th>Detay</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>';
}
function usersCard(){
 if(!isSuper())return '';
 var rows=(S.users||[]).map(function(u){
  var coLbl = u.role==='super' ? 'Tüm şirketler' : (u.companies==='all' ? 'Tüm şirketler' : ((Array.isArray(u.companies)&&u.companies.length) ? u.companies.map(coName).join(', ') : '—'));
  var me = (SESSION&&u.id===SESSION.id);
  return '<tr><td><b>'+esc(u.displayName||u.username||'—')+'</b>'+(u.title?' <span class="chip g">'+esc(u.title)+'</span>':'')+(u.email?'<div class="tiny">'+esc(u.email)+'</div>':'')+(me?' <span class="chip g">Siz</span>':'')+'</td>' /* v14-Z2: unvan ve görünen ad hiç gösterilmiyordu */
   +'<td>'+(u.role==='super'?'<span class="chip w">Süper Yönetici</span>':'<span class="chip g">Kullanıcı</span>')+'</td>'
   +'<td class="tiny">'+esc(coLbl)+'</td>'
   +'<td class="tiny">'+(u.addedAt?dTR(String(u.addedAt).slice(0,10)):'—')+'</td>'
   +'<td class="rowact"><button data-act="editUserAsk" data-arg="'+u.id+'">✎</button><button data-act="delUserAsk" data-arg="'+u.id+'">🗑</button></td></tr>';
 }).join('');
 return '<div class="card"><h2>👤 Kullanıcı Yönetimi <span class="chip g">'+(S.users||[]).length+' kullanıcı</span></h2>'+
  '<p class="mut" style="margin-bottom:12px"><b>Giriş Supabase Auth ile, E-POSTA üzerinden yapılır</b> — kullanıcıyı buraya eklerken yazdığınız e-posta, kişinin Supabase\'te oturum açtığı e-posta ile birebir aynı olmalıdır; eşleşmezse kişi giriş yapamaz ya da yetkisiz yeni bir kayıt olarak açılır. Buradaki şifre alanı yalnızca Supabase\'in devre dışı olduğu yedek/yerel giriş içindir.</p>'+ /* v14-Z1: eski metin gerçeği anlatmıyordu */
  '<div style="overflow-x:auto"><table><thead><tr><th>Kullanıcı</th><th>Rol</th><th>Şirket Erişimi</th><th>Eklendi</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
  '<button class="btn sm" style="margin-top:12px" data-act="addUserAsk">＋ Kullanıcı Ekle</button></div>';
}
function addUserAsk(){
 if(!isSuper())return;
 openForm('Yeni Kullanıcı Ekle',[
  {name:'username',label:'Kullanıcı adı',req:1,ph:'ör: erdinc'},
  {name:'email',label:'E-posta (GİRİŞ ANAHTARI — Supabase Auth e-postasıyla birebir aynı olmalı)',req:1,ph:'ornek@eposta.com'},
  {name:'password',label:'Yedek giriş şifresi (opsiyonel — yalnız Supabase kapalıyken kullanılır)',ph:'En az 10 karakter'},
  {name:'role',label:'Rol',type:'select',opts:[['user','Kullanıcı'],['super','Süper Yönetici']]},
  {name:'companies',label:'Şirket Erişimi (Süper Yönetici için yok sayılır)',type:'checks',opts:COMPANIES.map(function(c){return [c.id,c.name];})}
 ],async function(o){
  var username=(o.username||'').trim().toLowerCase().replace(/\s+/g,'');
  if(!/^[a-z0-9_.-]{2,20}$/.test(username)){toast('Kullanıcı adı 2-20 karakter olmalı, yalnızca harf/rakam/._- içerebilir');return;}
  if(findUserByUsername(username)){toast('Bu kullanıcı adı zaten kayıtlı');return;}
  var pw=(o.password||'').trim();
  if(pw&&pw.length<10){toast('Şifre girdiyseniz en az 10 karakter olmalı');return;} // C8
  var email=(o.email||'').trim().toLowerCase();
  if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){toast('Geçerli bir e-posta zorunlu — giriş bu e-posta ile eşleştiriliyor.');return;} // v14-Z1
  if(findUserByEmail&&findUserByEmail(email)){toast('Bu e-posta zaten başka bir kullanıcıda kayıtlı');return;}
  var salt='',hash='';
  if(pw){ salt=Array.prototype.map.call(crypto.getRandomValues(new Uint8Array(8)),function(b){return b.toString(16).padStart(2,'0');}).join(''); // C8: kullanici basina tuz
   hash=await sha256Hex(salt+pw);
   if(!hash){toast('Şifre oluşturulamadı, tekrar deneyin');return;} }
  S.users.push({id:nid(),username:username,email:email,password:hash,salt:salt,role:o.role==='super'?'super':'user',companies:o.role==='super'?'all':(Array.isArray(o.companies)?o.companies:[]),addedAt:new Date().toISOString(),addedBy:SESSION?SESSION.username:''});
  logAudit('Kullanıcı eklendi',username+' ('+(o.role==='super'?'Süper Yönetici':'Kullanıcı')+')');
  save();toast('Kullanıcı eklendi: '+username+' — bu kişi '+email+' ile Supabase üzerinden giriş yapabilir');rSet();
 },{role:'user'});
}
function editUserAsk(id){
 if(!isSuper())return;
 var u=(S.users||[]).find(function(x){return x.id===id;});
 if(!u)return;
 var initCo = u.companies==='all' ? COMPANIES.map(function(c){return c.id;}) : (Array.isArray(u.companies)?u.companies:[]);
 openForm('Kullanıcıyı Düzenle',[
  {name:'username',label:'Kullanıcı adı',req:1},
  {name:'password',label:'Yeni şifre (boş = değişmez)',ph:'En az 10 karakter'},
  {name:'email',label:'E-posta (opsiyonel)'},
  {name:'role',label:'Rol',type:'select',opts:[['user','Kullanıcı'],['super','Süper Yönetici']]},
  {name:'companies',label:'Şirket Erişimi (Süper Yönetici için yok sayılır)',type:'checks',opts:COMPANIES.map(function(c){return [c.id,c.name];})}
 ],async function(o){
  var username=(o.username||'').trim().toLowerCase().replace(/\s+/g,'');
  if(!/^[a-z0-9_.-]{2,20}$/.test(username)){toast('Kullanıcı adı 2-20 karakter olmalı, yalnızca harf/rakam/._- içerebilir');return;}
  var dup=findUserByUsername(username);
  if(dup&&dup.id!==u.id){toast('Bu kullanıcı adı başka bir kullanıcıda kayıtlı');return;}
  var email=(o.email||'').trim().toLowerCase();
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){toast('E-posta girdiyseniz geçerli olmalı');return;}
  if(u.role==='super'&&o.role!=='super'){
   var superCount=(S.users||[]).filter(function(x){return x.role==='super';}).length;
   if(superCount<=1){toast('Son süper yönetici rolden çıkarılamaz');return;}
  }
  var newPw=(o.password||'').trim();
  if(newPw&&newPw.length<10){toast('Şifre en az 10 karakter olmalı');return;} // C8
  var newHash=null,newSalt=null;
  if(newPw){ newSalt=Array.prototype.map.call(crypto.getRandomValues(new Uint8Array(8)),function(b){return b.toString(16).padStart(2,'0');}).join(''); newHash=await sha256Hex(newSalt+newPw); if(!newHash){toast('Şifre oluşturulamadı, tekrar deneyin');return;} }
  u.username=username;u.email=email;u.role=o.role==='super'?'super':'user';
  u.companies=u.role==='super'?'all':(Array.isArray(o.companies)?o.companies:[]);
  if(newHash){u.password=newHash;u.salt=newSalt;}
  logAudit('Kullanıcı düzenlendi',username+(newHash?' (şifre değişti)':''));
  save();toast('Kullanıcı güncellendi'+(newHash?' (şifre de değişti)':''));rSet();
  if(SESSION&&u.id===SESSION.id){SESSION.username=u.username;SESSION.email=u.email;SESSION.role=u.role;SESSION.companies=u.companies;}
 },{username:u.username,email:u.email,role:u.role,companies:initCo});
}
function delUserAsk(id){
 if(!isSuper())return;
 var u=(S.users||[]).find(function(x){return x.id===id;});
 if(!u)return;
 if(u.role==='super'){
  var superCount=(S.users||[]).filter(function(x){return x.role==='super';}).length;
  if(superCount<=1){toast('Son süper yönetici silinemez');return;}
 }
 if(SESSION&&u.id===SESSION.id){toast('Kendi hesabınızı silemezsiniz');return;}
 uiConfirm('"'+u.username+'" kullanıcısı silinsin mi? Bu kişi artık giriş yapamaz.',function(){
  S.users=(S.users||[]).filter(function(x){return x.id!==id;});
  logAudit('Kullanıcı silindi',u.username);
  save();toast('Kullanıcı silindi');rSet();
 },{danger:1,title:'Kullanıcıyı Sil',yes:'Evet, Sil'});
}
/* ---------- Supabase Auth köprüsü ----------
   Sayfa zaten Supabase Auth ile korunuyor. Buraya gelindiyse geçerli bir
   Supabase kullanıcısı var. O kullanıcıyı uygulama içi SESSION'a bağlarız;
   eşleşen uygulama profili yoksa otomatik oluştururuz. */
async function supaAutoLogin(){
 try{
  var email=String((window.__loleBoot&&window.__loleBoot.email)||'').trim().toLowerCase();
  if(!email)return false;
  var u=findUserByEmail(email);
  if(!u){
   var isAdmin=(email===String(DEFAULT_ADMIN_EMAIL).toLowerCase());
   u={id:nid(),username:email.split('@')[0],email:email,role:isAdmin?'super':'user',
      companies:isAdmin?'all':[],addedAt:new Date().toISOString(),addedBy:'supabase-auth'};
   S.users=S.users||[]; S.users.push(u); save();
  }
  SESSION={id:u.id,username:u.username,email:u.email,role:u.role,companies:u.companies};
  markActivity();
  try{logAudit('Giriş yapıldı (Supabase)','');}catch(e){}
  return true;
 }catch(e){ return false; }
}

/* ---------- HESAPSIZ NAKİT HAREKETLERİNİ DÜZELTME (v10.5) ----------
   Düzeltmeden önce "nakit" seçilip hesap seçilmeden girilmiş cari hareketleri
   bulur, tek listede toplar ve tek tıkla ya bir hesaba işler ya veresiyeye çevirir. */
function orphanCashTxns(){
 return S.cariTxns.filter(function(t){return t.nakit&&!t.accId&&!t.cardId&&!t.deletedAt&&canAccessCo(t.co);});
}
function orphanCard(){
 var orphans=orphanCashTxns();
 if(!orphans.length)return '';
 orphans=orphans.slice().sort(function(a,b){return a.date<b.date?1:-1;});
 return `<div class="card" style="border:1.5px solid var(--neg);margin-bottom:16px">
  <h2 style="color:var(--neg)">⚠ Düzeltilecek Nakit Hareketleri <span class="chip n">${orphans.length}</span></h2>
  <p class="tiny" style="margin-bottom:10px">Bu hareketlerde "nakit giriş/çıkış" seçilmiş ama paranın hangi kasaya/bankaya girdiği/çıktığı yazılmamış — tutarlar boşta görünüyor. Her satırda <b>Düzelt</b> ile ya bir hesaba işleyin ya veresiyeye çevirin. (Cari bakiyesi değişmez, yalnızca eksik hesap tarafı tamamlanır.)</p>
  <table><thead><tr><th>Şirket</th><th>Cari</th><th>Tarih</th><th class="num">Tutar</th><th>Tür</th><th class="rowact"></th></tr></thead><tbody>
  ${orphans.map(function(t){var c=S.cari.find(function(x){return x.id===t.cariId;})||{};return `<tr>
   <td>${esc(coName(t.co))}</td><td>${esc(c.name||'-')}</td><td>${dTR(t.date)}</td>
   <td class="num">${fmt(t.amount)}</td><td>${t.nakit==='gelir'?'💰 Giriş':'💸 Çıkış'}</td>
   <td class="rowact"><button class="btn sm" data-act="fixOrphanTxn" data-arg="${t.id}">Düzelt</button></td></tr>`;}).join('')}
  </tbody></table></div>`;
}
function fixOrphanTxn(id){
 var t=S.cariTxns.find(function(x){return x.id===id;});
 if(!t){toast('Kayıt bulunamadı (silinmiş olabilir)');return;}
 var c=S.cari.find(function(x){return x.id===t.cariId;})||{};
 openForm('Düzelt — '+(c.name||'')+' · '+fmt(t.amount),[
  {name:'durum',label:'Bu hareket gerçekte neydi?',type:'select',req:1,def:'nakit',opts:[
   ['nakit','💰/💸 Nakit — para bir hesaba girdi/çıktı'],
   ['veresiye','📝 Veresiye — para hareketi yoktu (sadece borç/alacak kaydı)']]},
  {name:'accId',label:'Nakit ise: hangi kasa/banka? (para '+(t.nakit==='gelir'?'buraya girdi':'buradan çıktı')+')',type:'select',opts:accOpts(t.co,1)}
 ],function(o){
  if(o.durum==='veresiye'){
   t.nakit=''; t.accId='';
   try{stampUpdate(t,t);}catch(e){}
   try{logAudit('Hareket veresiyeye çevrildi',(c.name||'')+' '+fmt(t.amount));}catch(e){}
   save();toast('Veresiye olarak düzeltildi — cari bakiyesi değişmedi');go(PAGE);return;
  }
  if(!o.accId){toast('⚠ Nakit seçtiniz — lütfen paranın girdiği/çıktığı hesabı seçin');fixOrphanTxn(id);return;}
  t.accId=o.accId;
  var acc=S.accounts.find(function(x){return x.id===o.accId;})||{};
  S.txns.push(stampCreate({id:nid(),co:t.co,type:t.nakit,date:t.date,amount:+t.amount,accId:o.accId,cariTxnId:t.id,
   cat:t.nakit==='gelir'?'Diğer Gelir':'Diğer Gider',
   desc:(t.nakit==='gelir'?'Cari tahsilat: ':'Cari ödeme: ')+(c.name||'')+(t.desc?' - '+t.desc:'')}));
  try{logAudit('Hesapsız nakit hareketi düzeltildi',(c.name||'')+' → '+(acc.name||''));}catch(e){}
  save();toast('Nakit hareketi "'+(acc.name||'hesap')+'" hesabına işlendi ✓');go(PAGE);
 });
}

/* Cari ödeme/tahsilat yöntemi: kasa/banka hesapları + kredi kartları (v10.5) */
function payMethodOpts(co){
 var l=[['','— Seçin —']];
 byCo(S.accounts,co).filter(function(a){return a.active!=='0';}).forEach(function(a){l.push([a.id,(a.type==='kasa'?'💵 ':'🏦 ')+a.name]);});
 byCo(S.cards,co).filter(function(c){return c.active!=='0';}).forEach(function(c){l.push(['card:'+c.id,'💳 '+c.name+' (kredi kartı)']);});
 return l;
}

/* ---------- v10.6: DRILL-DOWN + TUTARLILIK DENETİMİ ---------- */
function scrollRem(){var el=document.getElementById('remCard');if(el)try{el.scrollIntoView({behavior:'smooth'});}catch(e){}}
function goTxToday(type){txFilter={type:type||'',cat:'',from:todayISO(),to:todayISO()};go('tx');}
function integrityChecks(){
 var res=[];
 var A=function(title,detail,pg,items){ if(items.length) res.push({title:title,detail:detail,pg:pg,n:items.length}); };
 var acc=function(id){ return S.accounts.find(function(a){return a.id===id&&!a.deletedAt;}); }; // A8: silinmis hesap 'var' sayilmasin
 A('Hesapsız nakit cari hareketi','Nakit seçilmiş ama kasa/banka/kart belirtilmemiş — Cari sayfasındaki "Düzeltilecekler" listesinden düzeltin.','cari', orphanCashTxns());
 A('Hesaba bağlı olmayan işlem','Gelir/gider kaydının bağlı olduğu kasa/banka bulunamadı — işlemi silip doğru hesapla yeniden girin.','tx',
  S.txns.filter(function(t){return !t.deletedAt&&canAccessCo(t.co)&&t.type!=='virman'&&t.src!=='card'&&t.src!=='stok'&&(!t.accId||!acc(t.accId));}));
 A('Eksik virman','Virmanın gönderen veya alan hesabı eksik/geçersiz.','tx',
  S.txns.filter(function(t){return !t.deletedAt&&canAccessCo(t.co)&&t.type==='virman'&&(!acc(t.accId)||!acc(t.accId2));}));
 A('Tek taraflı silinmiş bağlantı','Bir kaydın bağlı eşi silinmiş ama kendisi duruyor — kaydı silip yeniden girin.','tx',
  S.txns.filter(function(t){ if(t.deletedAt||!canAccessCo(t.co))return false;
   if(t.cariTxnId){var x=S.cariTxns.find(function(k){return k.id===t.cariTxnId;}); if(!x||x.deletedAt)return true;}
   if(t.cardTxnId){var x2=S.cardTxns.find(function(k){return k.id===t.cardTxnId;}); if(!x2||x2.deletedAt)return true;}
   if(t.staffTxnId){var x3=S.staffTxns.find(function(k){return k.id===t.staffTxnId;}); if(!x3||x3.deletedAt)return true;}
   return false;}));
 A('Sıfır veya negatif tutar','Tutarı 0 ya da eksi olan kayıt — veri giriş hatası olabilir, kontrol edin.','tx',
  [].concat(S.txns,S.cariTxns,S.cardTxns,S.staffTxns).filter(function(t){return !t.deletedAt&&canAccessCo(t.co)&&!(+t.amount>0);}));
 A('Hesapsız POS tanımı','POS tanımının bağlı banka hesabı yok/geçersiz — "hesaba geçti" işlemi boşluğa yazar. POS tanımını düzenleyin.','pos',
  S.pos.filter(function(p){return !p.deletedAt&&p.active!=='0'&&canAccessCo(p.co)&&!acc(p.accId);}));
 A('Gider kaydı silinmiş sabit ödeme','Sabit ödeme "ödendi" görünüyor ama bağlı gider kaydı silinmiş — geçmişten kaydı kontrol edin.','fixed',
  S.fixedLogs.filter(function(l){ if(l.deletedAt||!canAccessCo(l.co)||!l.txnId)return false; var t=S.txns.find(function(x){return x.id===l.txnId;}); return t&&t.deletedAt; }));
 /* ---- B2: K8-K12 — geçmiş hata sınıflarının (çek/taksit/POS kaskadları) kalıcı bekçileri ---- */
 var cekById=function(id){ return S.cheques.find(function(c){return c.id===id;}); };
 A('Çeki silinmiş işlem','Yaşayan gelir/gider kaydının bağlı olduğu çek/senet silinmiş — kaydı silip yeniden girin.','cek',
  S.txns.filter(function(t){ if(t.deletedAt||!canAccessCo(t.co)||!t.cekId)return false; var c=cekById(t.cekId); return !c||!!c.deletedAt; }));
 A('Çek-cari bağı kopuk','Cari hareketin bağlı çeki silinmiş VEYA çek "kapandı" görünüyor ama tahsilat/ödeme işlemi yok.','cek',
  S.cariTxns.filter(function(t){ if(t.deletedAt||!canAccessCo(t.co)||!t.cekId)return false; var c=cekById(t.cekId); return !c||!!c.deletedAt; })
  .concat(S.cheques.filter(function(c){ if(c.deletedAt||!canAccessCo(c.co)||c.durum!=='kapandi')return false; return !S.txns.some(function(t){return t.cekId===c.id&&!t.deletedAt;}); })));
 A('Nakit üretmiş ama işlemi olmayan kayıt','Cari/personel/kart kaydı nakit hareketi üretmiş görünüyor ama karşılık gelen yaşayan işlem yok — kaydı silip yeniden girin.','tx',
  S.cariTxns.filter(function(ct){ if(ct.deletedAt||!canAccessCo(ct.co)||!ct.nakit)return false;
    if(ct.accId)return !S.txns.some(function(t){return t.cariTxnId===ct.id&&!t.deletedAt;});
    if(ct.cardId)return !S.cardTxns.some(function(t){return t.cariTxnId===ct.id&&!t.deletedAt;});
    return false; })
  .concat(S.staffTxns.filter(function(st2){ if(st2.deletedAt||!canAccessCo(st2.co)||!st2.accId)return false; if(['maas','avans','prim'].indexOf(st2.type)<0)return false; return !S.txns.some(function(t){return t.staffTxnId===st2.id&&!t.deletedAt;}); }))
  .concat(S.staffTxns.filter(function(st3){ if(st3.deletedAt||!canAccessCo(st3.co)||!st3.cardId)return false; if(['maas','avans','prim'].indexOf(st3.type)<0)return false; return !S.cardTxns.some(function(t){return t.staffTxnId===st3.id&&!t.deletedAt;}); }))
  .concat(S.cardTxns.filter(function(ct2){ if(ct2.deletedAt||!canAccessCo(ct2.co)||ct2.type!=='harcama')return false; return !S.txns.some(function(t){return t.cardTxnId===ct2.id&&!t.deletedAt;}); })));
 A('POS "geçti" ama gelir kaydı yok','POS girişi hesaba geçmiş görünüyor ama bağlı yaşayan gelir işlemi yok.','pos',
  S.posEntries.filter(function(p2){ if(p2.deletedAt||!canAccessCo(p2.co)||p2.status!=='gecti')return false; return !S.txns.some(function(t){return t.posEId===p2.id&&t.type==='gelir'&&!t.deletedAt;}); }));
 A('Negatif stok','Stok miktarı eksiye düşmüş — sayım yapın veya eksik giriş hareketini ekleyin.','stok',
  S.stock.filter(function(it){return !it.deletedAt&&canAccessCo(it.co)&&stockQty(it)<0;}));
 A('Kategorisi tanımsız bütçe kalemi','Bütçe kaleminin kategorisi kategori listesinde yok — gerçekleşme hiç eşleşmez. Kalemi düzenleyin.','budget',
  S.budgets.filter(function(b){return !b.deletedAt&&canAccessCo(b.co)&&(S.cats[((b.type||'gider')==='gelir')?'gelir':'gider']||[]).indexOf(b.cat)<0;}));
 A('Stok bağı kopuk kayıt','Gider/cari/kart kaydının bağlı olduğu stok hareketi silinmiş — kaydı silip yeniden girin.','stok',
  [].concat(S.txns,S.cardTxns,S.cariTxns).filter(function(t){ if(t.deletedAt||!canAccessCo(t.co)||!t.stokTxnId)return false; var x=S.stockTxns.find(function(k){return k.id===t.stokTxnId;}); return !x||!!x.deletedAt; }));
 A('Demirbaşı silinmiş kayıt','Gider/gelir/cari/kart kaydının bağlı olduğu demirbaş silinmiş — kaydı silip yeniden girin.','asset',
  [].concat(S.txns,S.cardTxns,S.cariTxns).filter(function(t){ if(t.deletedAt||!canAccessCo(t.co)||!t.assetId)return false; var x=S.assets.find(function(k){return k.id===t.assetId;}); return !x||!!x.deletedAt; }));
 /* ---- v14: yeni bekçiler — kaskad eksiklerinden kalan ESKİ yetim kayıtları da yakalar ---- */
 A('POS tanımı silinmiş giriş','POS girişinin bağlı cihaz tanımı silinmiş — ciro/komisyon KPI\'ları şişer. Girişi silin ya da POS tanımını çöp kutusundan geri getirin.','pos',
  S.posEntries.filter(function(p){ if(p.deletedAt||!canAccessCo(p.co))return false; var x=S.pos.find(function(k){return k.id===p.posId;}); return !x||!!x.deletedAt; }));
 A('Tanımı silinmiş sabit ödeme kaydı','Ödeme kaydının bağlı sabit ödeme tanımı silinmiş — "Bu Ay Kalan" hesabı yanlışlanır.','fixed',
  S.fixedLogs.filter(function(l){ if(l.deletedAt||!canAccessCo(l.co)||!l.fixedId)return false; var x=S.fixed.find(function(k){return k.id===l.fixedId;}); return !x||!!x.deletedAt; }));
 A('Carisi silinmiş cari hareketi','Hareketin bağlı carisi silinmiş — hiçbir ekstrede görünmez ama bazı toplamlara girer.','cari',
  S.cariTxns.filter(function(t){ if(t.deletedAt||!canAccessCo(t.co)||!t.cariId)return false; var x=S.cari.find(function(k){return k.id===t.cariId;}); return !x||!!x.deletedAt; }));
 A('Kartı silinmiş kart hareketi','Kart hareketinin bağlı kartı silinmiş — kart borcu toplamları tutarsızlaşır.','card',
  S.cardTxns.filter(function(t){ if(t.deletedAt||!canAccessCo(t.co)||!t.cardId)return false; var x=S.cards.find(function(k){return k.id===t.cardId;}); return !x||!!x.deletedAt; }));
 A('Bağlı cari kaydı silinmiş gelir/gider','Gelir/gider kaydının cari eşi silinmiş — cari bakiyesi ile nakit hareketi ayrışmış.','tx',
  S.txns.filter(function(t){ if(t.deletedAt||!canAccessCo(t.co)||!t.cariTxnId)return false; var x=S.cariTxns.find(function(k){return k.id===t.cariTxnId;}); return !x||!!x.deletedAt; }));
 (function(){ // K12: aynı taksit grubunun bir kısmı silik bir kısmı yaşıyorsa raporla (A4 sınıfının bekçisi)
  var grp={};
  S.txns.forEach(function(t){ if(!t.cardTxnId||!canAccessCo(t.co))return; var g=grp[t.cardTxnId]=grp[t.cardTxnId]||{a:0,d:0,items:[]}; if(t.deletedAt)g.d++; else{g.a++;g.items.push(t);} });
  var bad=[];
  Object.keys(grp).forEach(function(k){ var g=grp[k]; if(g.a>0&&g.d>0){ var ct=S.cardTxns.find(function(x){return x.id===k;}); if(ct&&!ct.deletedAt) bad=bad.concat(g.items); } });
  A('Yarım silinmiş taksit grubu','Aynı taksitli harcamanın bazı taksitleri silinmiş bazıları duruyor — grubu silip yeniden girin.','card',bad);
 })();
 return res;
}
function runIntegrity(mode){
 var res=[];
 try{res=integrityChecks();}catch(e){var el0=document.getElementById('integrityOut');if(el0)el0.textContent='Denetim çalıştırılamadı: '+e.message;return;}
 var el=document.getElementById('integrityOut');
 if(!el)return;
 if(!res.length){
  el.innerHTML='<div style="color:var(--pos);font-weight:600;font-size:13px">✅ Sorun bulunamadı — tüm para hareketleri hesap/kart bağlantılı, kayıtlar tutarlı.</div><div class="tiny" style="margin-top:4px">Her ana sayfa açılışında otomatik denetlenir; yeni bir tutarsızlık oluşursa burada kırmızı görünür.</div>';
  if(mode!=='auto')toast('✅ Denetim temiz — sorun bulunamadı');
  return;
 }
 el.innerHTML='<p class="tiny" style="color:var(--neg);margin-bottom:8px"><b>'+res.length+' tür bulgu tespit edildi</b> — her satırdaki "Git" ile ilgili ekrana gidip düzeltin.</p>'+
  '<div style="overflow-x:auto"><table><thead><tr><th>Bulgu</th><th class="num">Adet</th><th class="rowact"></th></tr></thead><tbody>'+
  res.map(function(r){return '<tr><td><b>'+esc(r.title)+'</b><div class="tiny">'+esc(r.detail)+'</div></td><td class="num"><span class="chip n">'+r.n+'</span></td><td class="rowact"><button class="btn sm gh" data-act="go" data-arg="'+r.pg+'">Git →</button></td></tr>';}).join('')+'</tbody></table></div>';
 if(mode!=='auto')toast('⚠ '+res.length+' tür bulgu bulundu — liste güncellendi');
}

function goTxDate(d){txFilter={type:'',cat:'',from:d,to:d};go('tx');}
function goTxCat(type,cat,from,to){
 if(CO==='grup'){toast('Grup görünümünde işlem listesi yok — önce bir şirket seçin');return;}
 txFilter={type:type||'',cat:cat||'',from:from||repRange.from,to:to||repRange.to};
 go('tx');
}
function addMonthsClamped(iso,n){var pp=String(iso).split('-');var y=+pp[0],m=+pp[1],d=+pp[2];var t=(m-1)+n;var y2=y+Math.floor(t/12);var m2=(t%12)+1;return clampDay(y2,m2,d);}
function upcomingInstCard(co){
 var end=addMonthsClamped(todayISO(),6);
 var ups=S.txns.filter(function(t){return t.co===co&&!t.deletedAt&&t.src==='card'&&t.taksitNo&&t.date>todayISO()&&t.date<=end;}).sort(function(a,b){return a.date<b.date?-1:1;});
 if(!ups.length)return '';
 var tot=ups.reduce(function(sm,t){return sm+ +t.amount;},0);
 var cardName=function(t){var ct=S.cardTxns.find(function(k){return k.id===t.cardTxnId;});var c=ct?S.cards.find(function(k){return k.id===ct.cardId;}):null;return c?{name:c.name,id:c.id}:{name:'',id:''};}; // C7: kart adı + kimliği
 return '<div class="card"><h2>📅 Gelecek Taksitler <span class="tiny">önümüzdeki 6 ay · toplam '+fmt0(tot)+'</span></h2>'+
  '<div style="overflow-x:auto"><table><thead><tr><th>Tarih</th><th>Kart</th><th>Açıklama</th><th class="num">Tutar</th></tr></thead><tbody>'+
  ups.slice(0,40).map(function(t){var _cn=cardName(t);return '<tr><td>'+dTR(t.date)+'</td><td>'+(_cn.id?'<span data-act="cardDetail" data-arg="'+_cn.id+'" style="cursor:pointer;text-decoration:underline dotted" title="Kart detayını aç">'+esc(_cn.name)+'</span>':'')+'</td><td>'+esc(t.desc||'')+' <span class="chip w">'+esc(t.taksitNo)+'</span></td><td class="num">'+fmt(t.amount)+'</td></tr>';}).join('')+
  '</tbody></table></div>'+(ups.length>40?'<div class="tiny" style="padding:6px">İlk 40 taksit gösteriliyor.</div>':'')+
  '<p class="tiny" style="margin-top:8px">Her taksit, kendi ayının gider raporuna otomatik yansır; kart borcunuz ödeme yaptıkça azalır.</p></div>';
}
/* ---------- v10.8: TAM SAYFA DETAY EKRANLARI ---------- */
function _navHi(p){try{document.querySelectorAll('[data-p]').forEach(function(b){b.classList.toggle('on',b.dataset.p===p);});}catch(e){}}
function accDetail(id){
 const a=S.accounts.find(x=>x.id===id&&!x.deletedAt);if(!a){toast('Hesap bulunamadı');return;}
 PAGE='acc';_navHi('acc');
 const b=accBalance(a);
 const f=accRangeFlow(a,addDays(todayISO(),-30),todayISO());
 document.getElementById('main').innerHTML= topbar((a.type==='kasa'?'💵 ':'🏦 ')+esc(a.name),
  `<button class="btn gh" data-act="go" data-arg="acc">← Banka & Kasa</button>`)+
 `<div class="grid g3" style="margin-bottom:16px">
   <div class="kpi a"><div class="l">Güncel Bakiye</div><div class="v">${fmt0(b)}</div><div class="s">${a.type==='kasa'?'Nakit Kasa':esc(a.bankName||'Banka')}${a.iban?' · IBAN '+esc(a.iban):''}${a.accNo?' · Hesap No '+esc(a.accNo):''}</div></div>
   <div class="kpi p"><div class="l">Son 30 Gün Giriş</div><div class="v">${fmt0(f.into)}</div></div>
   <div class="kpi n"><div class="l">Son 30 Gün Çıkış</div><div class="v">${fmt0(f.out)}</div></div>
  </div>
  <div class="card" style="margin-bottom:14px"><div class="cardBtns" style="margin:0">
   <button class="btn sm" data-act="addTxnFromAcc" data-arg="gelir~${a.id}">＋ Gelir</button>
   <button class="btn sm" data-act="addTxnFromAcc" data-arg="gider~${a.id}">－ Gider</button>
   <button class="btn sm gh" data-act="virmanForm" data-arg="${a.id}">⇄ Virman</button>
   <button class="btn sm gh" data-act="accReconcile" data-arg="${a.id}">⚖ Mutabakat</button>
   <button class="btn sm gh" data-act="accForm" data-arg="${a.id}">✎ Düzenle</button>
  </div></div>
  ${a.note?`<div class="card"><h2>Not</h2><p style="font-size:13px;white-space:pre-wrap">${esc(a.note)}</p></div>`:''}
  <div id="ekstreBox"></div>`; /* v14-D: accNo ve not artık görünüyor */
 accEkstre(id);
 try{window.scrollTo(0,0);}catch(e){}
}
function cariDetail(id){
 const c=S.cari.find(x=>x.id===id&&!x.deletedAt);if(!c){toast('Cari bulunamadı');return;}
 PAGE='cari';_navHi('cari');
 const b=cariBalance(c);
 const txs=S.cariTxns.filter(t=>t.cariId===id&&!t.deletedAt);
 const gecikmis=txs.filter(t=>t.type==='borc'&&!t.kapandi&&t.vade&&daysDiff(t.vade)<0).reduce((s,t)=>s+ +t.amount,0); // v14-H16
 const ceks=S.cheques.filter(k=>k.cariId===id&&!k.deletedAt).sort((a,b)=>a.vade<b.vade?-1:1); // B6: bu carinin çekleri
 const guvence=ceks.filter(k=>k.tip==='alinan'&&(k.durum==='portfoy'||k.durum==='tahsilde')).reduce((s,k)=>s+ +k.tutar,0); // C2: çekle güvenceli alacak
 const CDT={portfoy:['Portföyde','g'],tahsilde:['Tahsilde 🏦','w'],ciro:['Ciro edildi ↪','g'],kapandi:['Kapandı ✓','p'],karsiliksiz:['Karşılıksız','n']};
 const TT={musteri:'Müşteri',tedarikci:'Tedarikçi',her2:'Müşteri+Tedarikçi',diger:'Diğer'};
 document.getElementById('main').innerHTML= topbar('👥 '+esc(c.name),
  `<button class="btn gh" data-act="go" data-arg="cari">← Cari Hesaplar</button>`)+
 `<div class="grid g3" style="margin-bottom:16px">
   <div class="kpi ${b>0?'p':b<0?'n':''}"><div class="l">Güncel Bakiye</div><div class="v">${fmt0(Math.abs(b))}</div><div class="s">${b>0?'bize borçlu':b<0?'biz borçluyuz':'hesap kapalı'} · ${TT[c.type]||c.type}${guvence>0?' · '+fmt0(Math.min(guvence,Math.max(0,b)))+' ₺ çekle güvenceli':''}</div></div>
   <div class="kpi ${gecikmis>0?'n':''}"><div class="l">Vadesi Geçmiş Alacak</div><div class="v">${fmt0(gecikmis)}</div></div>
   <div class="kpi"><div class="l">Hareket Sayısı</div><div class="v">${txs.length}</div><div class="s">${esc(c.phone||'')}</div></div>
  </div>
  <div class="card" style="margin-bottom:14px"><div class="cardBtns" style="margin:0">
   <button class="btn sm out" data-act="cariTxnForm" data-arg="${c.id}~borc">＋ Borç</button>
   <button class="btn sm in" data-act="cariTxnForm" data-arg="${c.id}~alacak">＋ Alacak</button>
   <button class="btn sm gh" data-act="cariInvoiceForm" data-arg="${c.id}">🧾 Faturalaştır</button>
   <button class="btn sm gh" data-act="cariForm" data-arg="${c.id}">✎ Düzenle</button>
  </div></div>
  ${ceks.length?`<div class="card"><h2>📄 Bu Carinin Çekleri <span class="tiny">${ceks.length} adet · açık ${fmt0(ceks.filter(k=>k.durum==='portfoy'||k.durum==='tahsilde').reduce((s,k)=>s+ +k.tutar,0))} — cariye bağlı açık çekler bakiyeye zaten dahildir</span></h2>
   <table><thead><tr><th>Tür</th><th>Vade</th><th class="num">Tutar</th><th>Durum</th></tr></thead><tbody>
   ${ceks.map(k=>`<tr data-act="cekDetail" data-arg="${k.id}" style="cursor:pointer" title="Çek detayını aç"><td><span class="chip ${k.tip==='alinan'?'p':'n'}">${k.tip==='alinan'?'ALINAN':'VERİLEN'}</span> ${k.tur==='senet'?'Senet':'Çek'}${k.no?' · '+esc(k.no):''}</td><td>${dTR(k.vade)}</td><td class="num"><b>${fmt(k.tutar)}</b></td><td><span class="chip ${(CDT[k.durum]||['?','g'])[1]}">${(CDT[k.durum]||[k.durum])[0]}</span></td></tr>`).join('')}
   </tbody></table></div>`:''}
  ${(c.email||c.note)?`<div class="card"><h2>İletişim & Not</h2>
   ${c.email?`<p style="font-size:13px">📧 <a href="mailto:${esc(c.email)}">${esc(c.email)}</a>${c.phone?' · ☎ '+esc(c.phone):''}</p>`:(c.phone?`<p style="font-size:13px">☎ ${esc(c.phone)}</p>`:'')}
   ${c.note?`<p style="font-size:13px;white-space:pre-wrap;color:var(--ink2)">${esc(c.note)}</p>`:''}</div>`:''}
  <div id="cariEkstreBox"></div>`; /* v14-D: e-posta ve not artık görünüyor */
 cariEkstre(id);
 try{window.scrollTo(0,0);}catch(e){}
}
function cardDetail(id){
 const c=S.cards.find(x=>x.id===id&&!x.deletedAt);if(!c){toast('Kart bulunamadı');return;}
 PAGE='card';_navHi('card');
 const debt=cardDebt(c);const avail=+(c.limit||0)-debt;const due=nextDue(+c.dueDay);
 const mo=monthISO();
 const ayHarc=S.cardTxns.filter(t=>t.cardId===id&&!t.deletedAt&&t.type==='harcama'&&String(t.date||'').startsWith(mo)).reduce((s,t)=>s+ +t.amount,0);
 document.getElementById('main').innerHTML= topbar('💳 '+esc(c.name),
  `<button class="btn gh" data-act="go" data-arg="card">← Kredi Kartları</button>`)+
 `<div class="grid g3" style="margin-bottom:16px">
   <div class="kpi ${debt>0?'n':'p'}"><div class="l">Güncel Borç</div><div class="v">${fmt0(debt)}</div><div class="s">${debt>0?'Son ödeme: '+dTR(due):'Borç yok'}</div></div>
   <div class="kpi"><div class="l">Kullanılabilir Limit</div><div class="v">${fmt0(avail)}</div><div class="s">Limit: ${fmt0(c.limit||0)}</div></div>
   <div class="kpi"><div class="l">Bu Ay Harcama</div><div class="v">${fmt0(ayHarc)}</div></div>
  </div>
  <div class="card" style="margin-bottom:14px"><div class="cardBtns" style="margin:0">
   <button class="btn sm" data-act="cardTxnForm" data-arg="${c.id}~harcama">＋ Harcama</button>
   <button class="btn sm gh" data-act="cardTxnForm" data-arg="${c.id}~odeme">₺ Ödeme Yap</button>
   <button class="btn sm gh" data-act="cardForm" data-arg="${c.id}">✎ Düzenle</button>
  </div></div>
  ${c.note?`<div class="card"><h2>Not</h2><p style="font-size:13px;white-space:pre-wrap">${esc(c.note)}</p></div>`:''}
  <div id="cardEkstreBox"></div>`; /* v14-D: kart notu artık görünüyor */
 cardEkstre(id);
 try{window.scrollTo(0,0);}catch(e){}
}
function posDetail(id){
 const p=S.pos.find(x=>x.id===id&&!x.deletedAt);if(!p){toast('POS bulunamadı');return;}
 PAGE='pos';_navHi('pos');
 const a=S.accounts.find(x=>x.id===p.accId)||{};
 const ent=S.posEntries.filter(e=>e.posId===id&&!e.deletedAt).sort((x,y)=>x.date<y.date?1:-1);
 const mo=monthISO();
 const ay=ent.filter(e=>String(e.date||'').startsWith(mo));
 const bek=ent.filter(e=>e.status==='bekliyor');
 document.getElementById('main').innerHTML= topbar('🖥 '+esc(p.name),
  `<button class="btn gh" data-act="go" data-arg="pos">← POS İşlemleri</button>`)+
 `<div class="grid g3" style="margin-bottom:16px">
   <div class="kpi a"><div class="l">Bu Ay Brüt</div><div class="v">${fmt0(ay.reduce((s,e)=>s+ +e.gross,0))}</div><div class="s">${ay.length} giriş</div></div>
   <div class="kpi n"><div class="l">Bu Ay Komisyon</div><div class="v">${fmt0(ay.reduce((s,e)=>s+ +e.comm,0))}</div><div class="s">Oran: %${p.comm} · blokaj ${p.blokaj} gün</div></div>
   <div class="kpi"><div class="l">Blokajda Bekleyen</div><div class="v">${fmt0(bek.reduce((s,e)=>s+ +e.net,0))}</div><div class="s">${bek.length} işlem · hesap: ${esc(a.name||'—')}</div></div>
  </div>
  <div class="card"><h2>Bu POS'un Girişleri <button class="btn sm gh" data-act="posDefForm" data-arg="${p.id}">✎ Tanımı Düzenle</button></h2>
  ${ent.length?'<div style="overflow-x:auto"><table><thead><tr><th>Tarih</th><th class="num">Brüt</th><th class="num">Komisyon</th><th class="num">Net</th><th>Durum</th><th class="rowact"></th></tr></thead><tbody>'+ent.slice(0,60).map(e=>`<tr><td>${dTR(e.date)}</td><td class="num">${fmt(e.gross)}</td><td class="num" style="color:var(--neg)">-${fmt(e.comm)}</td><td class="num" style="font-weight:700">${fmt(e.net)}</td><td>${e.status==='gecti'?'<span class="chip p">Hesaba geçti ✓</span>':`<span class="chip w">${dTR(e.settleDate)}</span> <button class="btn sm" data-act="posSettle" data-arg="${e.id}">Geçti ✓</button>`}</td><td class="rowact"><button data-act="del" data-arg="posE~${e.id}">🗑</button></td></tr>`).join('')+'</tbody></table></div>'+(ent.length>60?'<div class="tiny" style="padding:6px">Son 60 giriş gösteriliyor.</div>':''):'<div class="empty"><b>Bu POS için giriş yok</b>Gün sonu POS toplamlarını "＋ POS Girişi" ile ekleyin.</div>'}
  </div>`;
 try{window.scrollTo(0,0);}catch(e){}
}

/* ---------- v10.9: MUTABAKAT + CSV + HAFTALIK YEDEK ---------- */
function accReconcile(id){
 var a=S.accounts.find(function(x){return x.id===id&&!x.deletedAt;});if(!a)return;
 var sysAt=function(d){return accRangeFlow(a,'0000-01-01',d||todayISO()).closing;}; // A11: secilen tarihteki sistem bakiyesi
 var sys0=sysAt(todayISO());
 openForm('⚖ Mutabakat — '+a.name,[
  {name:'actual',label:'Sayım / banka ekstresi sonucu GERÇEK bakiye (₺). Seçilen tarihteki sistem bakiyesi: '+fmt(sys0),type:'number',req:1},
  {name:'date',label:'Sayım tarihi',type:'date',def:todayISO(),req:1},
  {name:'desc',label:'Not (opsiyonel)',ph:'Ör: akşam kasa sayımı'}
 ],function(o){
  var sys=sysAt(o.date); // A11: fark BUGUNKU degil, SECILEN tarihteki bakiyeye gore
  if(o.date<todayISO())toast('ℹ Geçmiş tarihli mutabakat — kapanmış dönem raporları değişecek');
  var diff=Math.round((o.actual-sys)*100)/100;
  if(!diff){toast('✅ Mutabakat tam — sistem ile sayım aynı ('+fmt(sys)+')');try{logAudit('Mutabakat: fark yok',a.name);}catch(e){}return;}
  var type=diff>0?'gelir':'gider';
  S.txns.push(stampCreate({id:nid(),co:CO,type:type,date:o.date,amount:Math.abs(diff),accId:a.id,
   cat:'Kasa/Banka Farkı',
   desc:'Mutabakat düzeltmesi: sistem '+fmt(sys)+' → sayım '+fmt(+o.actual)+(o.desc?' — '+o.desc:'')}));
  try{logAudit('Mutabakat düzeltmesi',a.name+' fark '+fmt(diff));}catch(e){}
  save();toast('⚖ Fark '+fmt(Math.abs(diff))+' '+(diff>0?'gelir (fazla)':'gider (eksik)')+' olarak işlendi — bakiye artık sayımla eşit');
  accDetail(a.id);
 });
 setTimeout(function(){ // A11: tarih degistikce 'secilen tarihteki sistem bakiyesi' etiketini canli guncelle
  var d=document.querySelector('#mForm input[name="date"]');
  var act=document.querySelector('#mForm input[name="actual"]');
  if(!d||!act)return;
  var lab=act.closest('.fld');lab=lab&&lab.querySelector('label');
  if(!lab)return;
  var upd=function(){try{lab.textContent='Sayım / banka ekstresi sonucu GERÇEK bakiye (₺). Seçilen tarihteki sistem bakiyesi: '+fmt(sysAt(d.value||todayISO()))+' *';}catch(e){}};
  d.addEventListener('change',upd);d.addEventListener('input',upd);
 },90);
}
function exportTxCsv(){
 if(CO==='grup'){toast('Grup görünümünde dışa aktarım yok — önce bir şirket seçin');return;}
 var list=filteredTxns(CO,txFilter); // A13: ekrandaki filtreyle (arama kutusu dahil) birebir ayni liste
 list.sort(function(a,b){return a.date<b.date?1:-1;});
 if(!list.length){toast('Filtreye uyan kayıt yok');return;}
 var accN=function(id){var x=S.accounts.find(function(k){return k.id===id;});return x?x.name:'';};
 var q=function(v){v=String(v==null?'':v);return '"'+v.replace(/"/g,'""')+'"';};
 var rows=[['Tarih','Tür','Kategori','Hesap','Tutar','KDV %','Belge No','Açıklama','Ekleyen'].join(';')];
 list.forEach(function(t){rows.push([t.date,t.type==='gelir'?'Gelir':t.type==='gider'?'Gider':'Virman',q(t.cat||''),q(accN(t.accId)||(t.src==='card'?'Kredi kartı':'')),String(+t.amount).replace('.',','),t.vat||'',q(t.doc||''),q(t.desc||''),q(t.createdBy||'')].join(';'));});
 var blob=new Blob(['﻿'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'});
 var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='lole-islemler-'+(coName(CO)||'').replace(/\s+/g,'-')+'-'+todayISO()+'.csv';document.body.appendChild(a);a.click();a.remove();
 try{logAudit('CSV dışa aktarım',list.length+' kayıt');}catch(e){}
 toast('⬇ CSV indirildi ('+list.length+' kayıt) — Excel ile açabilirsiniz');
}
function weeklyBackupCheck(){
 try{
  if(!isSuper())return;
  if(window.__wbAsked)return;
  var last=(S.meta&&S.meta.weeklyBackupAt)?String(S.meta.weeklyBackupAt).slice(0,10):'';
  if(last&&daysDiff(last)>-7)return;
  window.__wbAsked=true;
  uiConfirm('Haftalık yedek zamanı geldi'+(last?' (son yedek: '+dTR(last)+')':'')+'. TÜM şirketleri kapsayan sistem yedeğini şimdi bilgisayarınıza indirin ve e-postanıza/güvenli bir yere kaydedin.',function(){
   dlBackup();
   S.meta.weeklyBackupAt=new Date().toISOString();
   save();
  },{title:'📬 Haftalık Yedek',yes:'⬇ Yedeği İndir'});
 }catch(e){}
}

function cariVadeKapat(id){var t=S.cariTxns.find(function(x){return x.id===id;});if(!t)return;t.kapandi=1;try{logAudit('Vade kapatıldı',fmt(t.amount));}catch(e){}save();toast('✔ Vade kapatıldı — hatırlatıcı, projeksiyon ve yaşlandırmadan çıkarıldı');cariDetail(t.cariId);}
function showAllRems(){
 var rems=reminders(CO);
 document.getElementById('modalBox').innerHTML='<div class="mh"><h3>Tüm Ödeme Hatırlatıcıları ('+rems.length+')</h3><button data-act="closeModal" style="font-size:20px;color:var(--ink3)">✕</button></div>'+
  '<div class="mb">'+(rems.length?rems.map(function(r){return '<div class="rem '+remClass(r.df)+'" data-act="remGo" data-arg="'+(r.pg||'dash')+'" style="cursor:pointer"><span class="dot"></span><span>'+esc(r.t)+'<br><span class="tiny">'+dTR(r.d)+' · '+remLbl(r.df)+'</span></span>'+(r.a!=null?'<span class="amt">'+fmt0(r.a)+'</span>':'')+'</div>';}).join(''):'<div class="empty">Hatırlatıcı yok</div>')+'</div>';
 document.getElementById('modalWrap').classList.add('on');
}
function remGo(p){closeModal();go(p);}
var MECLIS_UYELER=[
 ['Mali Müşavir','muhasebe doğruluğu, KDV, kâr/zarar sağlığı, vergi/dönem riskleri'],
 ['Nakit Akış Uzmanı','önümüzdeki 30 günün nakit dengesi, vadeler, tahsilat öncelikleri'],
 ['Maliyet & Kârlılık Uzmanı','gider kalemleri, bütçe aşımları, marj ve tasarruf fırsatları'],
 ['Risk Denetçisi','geciken alacaklar, kart borç yükü, tek müşteri/tedarikçiye bağımlılık, tutarsızlıklar']];
async function meclisCagri(system,user,maxTok){
 var r=await fetch('/api/ai',{method:'POST',headers:loleAuthHeaders(),body:JSON.stringify({max_tokens:maxTok||700,system:system,messages:[{role:'user',content:user}]})});
 var j=await r.json();
 if(!r.ok)throw new Error((j&&j.error&&(j.error.message||j.error))||('Sunucu hatası '+r.status));
 return (j.content&&j.content[0]&&j.content[0].text)||'';
}
async function meclisToplanti(){
 if(CO==='grup'){toast('Meclis için önce bir şirket seçin');return;}
 if(window.__meclisBusy){toast('🏛 Meclis zaten toplanıyor — lütfen bitmesini bekleyin');return;} // C5: re-entry kilidi
 window.__meclisBusy=1;
 var box=document.getElementById('meclisBox');if(!box){window.__meclisBusy=0;return;}
 var pack=JSON.stringify(aiDataPack('full')||aiDataPack());
 box.innerHTML='<div class="card"><h2>🏛 Yönetim Meclisi Toplanıyor…</h2><div id="meclisSteps" class="tiny"></div></div>';
 var st=document.getElementById('meclisSteps');
 var gorusler=[];
 try{
  for(var i=0;i<MECLIS_UYELER.length;i++){
   var u=MECLIS_UYELER[i];
   st.innerHTML+='⏳ '+u[0]+' inceliyor…<br>';
   var g=await meclisCagri('Sen '+coName(CO)+' için çalışan bir '+u[0]+'sın. Odak alanın: '+u[1]+'. YALNIZCA verilen JSON veriye dayan; veride olmayanı uydurma. En fazla 5 madde, her madde tek cümle, rakamlı ve somut. Türkçe yaz, başlık kullanma.','Finansal veri: '+pack,600);
   gorusler.push(u[0]+':\n'+g);
   st.innerHTML=st.innerHTML.replace('⏳ '+u[0]+' inceliyor…','✓ '+u[0]+' görüşünü verdi');
  }
  st.innerHTML+='⏳ Başkan sentezliyor…<br>';
  var rapor=await meclisCagri('Sen '+coName(CO)+' yönetim meclisinin BAŞKANISIN. 4 uzmanın görüşleri sana verildi. Görevin: mükerrerleri birleştir, önem sırasına koy ve patrona net bir yönetim raporu yaz: (1) Genel durum 2-3 cümle, (2) BU HAFTA yapılması gereken en önemli 3-5 aksiyon (rakamlı, somut), (3) izlenecek 2 risk. Türkçe, başlıksız, • maddeli, samimi-profesyonel.','UZMAN GÖRÜŞLERİ:\n'+gorusler.join('\n\n')+'\n\nVERİ ÖZETİ: '+pack,900);
  box.innerHTML='<div class="card"><h2>🏛 Yönetim Meclisi Raporu <span class="tiny">'+dTR(todayISO())+' · 4 uzman + başkan</span></h2><div class="aiBox">'+esc(rapor)+'</div><details style="margin-top:10px"><summary class="tiny" style="cursor:pointer">Uzman görüşlerinin tamamı</summary><div class="aiBox" style="margin-top:8px">'+esc(gorusler.join('\n\n'))+'</div></details><p class="tiny" style="margin-top:8px">⚠ Bu rapor danışma amaçlıdır — kayıtlarınıza dokunmaz, kararlar sizindir.</p></div>';
  try{logAudit('Yönetim Meclisi raporu alındı','');}catch(e){}
 }catch(err){
  box.innerHTML='<div class="card"><h2>🏛 Meclis toplanamadı</h2><p class="tiny" style="color:var(--neg)">'+esc(err.message)+'</p><p class="tiny">Anahtar Vercel\'e girildiyse ve yeniden yayınlandıysa tekrar deneyin.</p></div>';
 }finally{ window.__meclisBusy=0; }
}
window.__v7=true;



