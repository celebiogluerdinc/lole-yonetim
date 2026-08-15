// LOLE uygulama kabuğu (body markup) — orijinalden birebir taşındı.
// Engine bu DOM element ID'lerini bekler (loginScreen, selectScreen, app, main, ...).
export const LOLE_SHELL = `
<div id="loginScreen">
  <div class="brand">
    <div class="logo">LOLE</div>
    <div class="sub">Finans & Muhasebe Yönetim Sistemi</div>
  </div>
  <div class="loginBox">
    <h2>Giriş Yap</h2>
    <p class="tiny" style="color:#aab4c9;margin-bottom:14px">Kullanıcı adı ve şifrenizi girin</p>
    <input type="text" id="loginUser" placeholder="Kullanıcı adı" autocomplete="username" autocapitalize="off" spellcheck="false">
    <input type="password" id="loginPw" placeholder="Şifre" autocomplete="current-password" style="margin-top:10px">
    <label style="display:flex;align-items:center;gap:7px;justify-content:center;margin-top:12px;font-size:12.5px;color:#c9d1e3;cursor:pointer"><input type="checkbox" id="loginRemember" style="width:auto;padding:0"> Beni Hatırla</label>
    <p id="loginErr" style="display:none;color:#ff9a90;font-size:12.5px;margin-top:10px;text-align:left"></p>
    <button class="btn" style="width:100%;justify-content:center;margin-top:16px" data-act="loginSubmit">Giriş Yap →</button>
  </div>
</div>

<div id="selectScreen">
  <div class="brand">
    <div class="logo">LOLE</div>
    <div class="sub">Finans & Muhasebe Yönetim Sistemi</div>
    <button class="uHello" id="uHello" data-act="userForm"></button>
    <div id="sessHello" class="tiny" style="color:#aab4c9;margin-top:8px"></div>
  </div>
  <div class="coGrid" id="coGrid"></div>
  <div id="sysBackupCenter"></div>
</div>

<div id="app">
  <aside class="side">
    <div class="top"><div class="lg">LOLE</div></div>
    <button class="coBtn" data-act="goSelect"><span id="sideCo"></span><small>şirket değiştir ⇄</small></button>
    <nav class="nav" id="sideNav"></nav>
  </aside>
  <main class="main" id="main"></main>
</div>

<div class="bnav"><div class="in" id="bnavIn"></div></div>
<div id="moreSheet"><div class="sheet" id="moreIn"></div></div>
<div id="modalWrap"><div class="modal" id="modalBox"></div></div>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<button id="aiFab" data-act="openAiChat" title="AI Asistan (kısayol: /)">✦</button>
`;
