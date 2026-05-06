/* ====================================================================
   BIOIMUN – MAIN SCRIPT (MERGED)
   Menggabungkan: sync.js (sinkronisasi Google Sheets) + script.js (logika utama)
   ==================================================================== */

'use strict';

/* ================================================================
   BIOIMUN MODUL — SYNC.JS
   Lapisan sinkronisasi antara website dan Google Sheets
   ================================================================
   CARA PAKAI:
   1. Jalankan Google Apps Script (lihat google-apps-script.gs)
   2. Tempel URL deployment di variabel SHEET_URL di bawah
   3. Tambahkan <script src="sync.js"></script> di dashboard.html
      SEBELUM <script src="script.js"></script>
   ================================================================ */

/* ───────────────────────────────────────────────────────────────
   ⚙️  KONFIGURASI — WAJIB DIISI SETELAH DEPLOY APPS SCRIPT
   ─────────────────────────────────────────────────────────────── */
const SHEET_URL = 'https://script.google.com/macros/s/AKfycbwJAkT9pmRhdxGteAXZT0uUu9kIgrsUypHjEKxFqWL6RbSv1IF1-PaL5XHYMsFpORKY/exec';
// Contoh: 'https://script.google.com/macros/s/AKfycbx.../exec'

/* ───────────────────────────────────────────────────────────────
   🔧  CORE SEND FUNCTION
   Menggunakan GET + query string — satu-satunya cara reliable
   untuk Google Apps Script tanpa masalah CORS preflight.
   ─────────────────────────────────────────────────────────────── */
async function sendToSheet(action, payload) {
  if (!SHEET_URL || SHEET_URL === '' || SHEET_URL === 'BELUM_DIKONFIGURASI') {
    console.warn('[BioImun Sync] SHEET_URL belum dikonfigurasi.');
    return;
  }
  try {
    const dataStr = encodeURIComponent(JSON.stringify(payload));
    const url     = `${SHEET_URL}?action=${encodeURIComponent(action)}&data=${dataStr}`;
    await fetch(url, { method: 'GET', mode: 'no-cors' });
    console.log('[BioImun Sync] ✅ Terkirim (GET):', action);
  } catch (err) {
    console.warn('[BioImun Sync] ⚠️ Gagal kirim:', action, err.message);
    queueFailedSync(action, payload);
  }
}

/* ───────────────────────────────────────────────────────────────
   📦  ANTREAN OFFLINE
   Jika tidak ada internet, simpan dulu lalu kirim saat online
   ─────────────────────────────────────────────────────────────── */
function queueFailedSync(action, payload) {
  try {
    const key   = 'bioimun_sync_queue';
    const queue = JSON.parse(localStorage.getItem(key) || '[]');
    queue.push({ action, payload, ts: Date.now() });
    // Simpan maks 50 item antrean
    if (queue.length > 50) queue.splice(0, queue.length - 50);
    localStorage.setItem(key, JSON.stringify(queue));
  } catch (e) {}
}

async function flushSyncQueue() {
  try {
    const key   = 'bioimun_sync_queue';
    const queue = JSON.parse(localStorage.getItem(key) || '[]');
    if (!queue.length) return;
    const remaining = [];
    for (const item of queue) {
      try {
        const dataStr = encodeURIComponent(JSON.stringify(item.payload));
        const url     = `${SHEET_URL}?action=${encodeURIComponent(item.action)}&data=${dataStr}`;
        await fetch(url, { method: 'GET', mode: 'no-cors' });
        console.log('[BioImun Sync] 🔄 Antrean terkirim:', item.action);
      } catch (e) {
        remaining.push(item);
      }
    }
    localStorage.setItem(key, JSON.stringify(remaining));
    if (remaining.length === 0) console.log('[BioImun Sync] ✅ Semua antrean berhasil dikirim!');
  } catch (e) {}
}

// Kirim antrean saat koneksi kembali
window.addEventListener('online', () => {
  console.log('[BioImun Sync] 🌐 Koneksi kembali, mengirim antrean...');
  flushSyncQueue();
});

/* ───────────────────────────────────────────────────────────────
   👤  HELPER: ambil data user aktif
   ─────────────────────────────────────────────────────────────── */
function getSyncUser() {
  try {
    const u = JSON.parse(sessionStorage.getItem('bioimun_user') || '{}');
    return {
      username: u.username || 'unknown',
      nama    : u.name     || 'Unknown',
      role    : u.role     || 'siswa',
      kelas   : u.kelas    || '—',
    };
  } catch (e) {
    return { username:'unknown', nama:'Unknown', role:'siswa', kelas:'—' };
  }
}

/* ═══════════════════════════════════════════════════════════════
   📤  FUNGSI SYNC PER AKTIVITAS
   Setiap fungsi dipanggil otomatis dari titik-titik di script.js
   ═══════════════════════════════════════════════════════════════ */

/* ── 1. LOGIN ───────────────────────────────────────────────────
   Dipanggil: saat pengguna berhasil login (dari login.html)        */
function syncLogin(user) {
  sendToSheet('login', {
    username: user.username,
    nama    : user.name,
    role    : user.role,
    kelas   : user.kelas || '—',
  });
}

/* ── 2. PROGRESS BELAJAR ────────────────────────────────────────
   Dipanggil: setiap saveProgress() — setelah baca materi / kuis  */
function syncProgress(progressData) {
  const u = getSyncUser();
  sendToSheet('progress', {
    username: u.username,
    nama    : u.nama,
    progress: progressData,
  });
}

/* ── 3. HASIL KUIS ──────────────────────────────────────────────
   Dipanggil: setelah siswa submit kuis materi                     */
function syncKuis(materiIdx, skor, lulus) {
  const u = getSyncUser();
  sendToSheet('kuis', {
    username : u.username,
    nama     : u.nama,
    materiIdx,
    skor,
    lulus,
  });
}

/* ── 4. HASIL DRILL ─────────────────────────────────────────────
   Dipanggil: setelah drill selesai (showDrillResult)              */
function syncDrill(jumlahSoal, skor) {
  const u = getSyncUser();
  sendToSheet('drill', {
    username   : u.username,
    nama       : u.nama,
    jumlahSoal,
    skor,
  });
}

/* ── 5. PROGRESS LKPD ──────────────────────────────────────────
   Dipanggil: setiap tahap LKPD diselesaikan                      */
function syncLKPD(kelompok, tahap) {
  const u = getSyncUser();
  sendToSheet('lkpd', {
    username: u.username,
    nama    : u.nama,
    kelompok,
    tahap,
  });
}

/* ── 6. PRE-TEST ────────────────────────────────────────────────
   Dipanggil: saat siswa submit pre-test                           */
function syncPretest(jawaban) {
  const u = getSyncUser();
  sendToSheet('pretest', {
    username: u.username,
    nama    : u.nama,
    jawaban,                       // array 5 string
  });
}

/* ── 7. POST-TEST ───────────────────────────────────────────────
   Dipanggil: saat siswa submit post-test                          */
function syncPosttest(jawaban) {
  const u = getSyncUser();
  sendToSheet('posttest', {
    username: u.username,
    nama    : u.nama,
    jawaban,
  });
}

/* ── 8. ANGKET OWNERSHIP ────────────────────────────────────────
   Dipanggil: saat siswa submit angket                             */
function syncAngket(answers) {
  const u = getSyncUser();
  sendToSheet('angket', {
    username: u.username,
    nama    : u.nama,
    answers,                       // array 15 nilai (1-5)
  });
}

/* ── 9. ESAI REFLEKTIF ──────────────────────────────────────────
   Dipanggil: saat siswa submit esai reflektif                     */
function syncReflektif(esai) {
  const u = getSyncUser();
  sendToSheet('reflektif', {
    username: u.username,
    nama    : u.nama,
    esai,                          // array 5 string
  });
}

/* ═══════════════════════════════════════════════════════════════
   🪝  MONKEY-PATCH — menyisipkan sync ke fungsi script.js
   Dilakukan SETELAH script.js dimuat (via defer / DOMContentLoaded)
   ═══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

  /* Kirim antrean offline yang tertunda */
  flushSyncQueue();

  /* ── PATCH saveProgress ─────────────────────────────────────── */
  const _origSaveProgress = window.saveProgress;
  window.saveProgress = function () {
    _origSaveProgress?.();
    // Throttle: tidak kirim lebih dari sekali per 10 detik
    clearTimeout(window._syncProgressTimer);
    window._syncProgressTimer = setTimeout(() => {
      if (window.progress) syncProgress(window.progress);
    }, 10000);
  };

  /* ── PATCH submitKuis ───────────────────────────────────────── */
  const _origSubmitKuis = window.submitKuis;
  window.submitKuis = function () {
    _origSubmitKuis?.();
    // Baca hasil dari progress yang baru disimpan
    const idx    = window.currentMateri ?? 0;
    const skor   = window.progress?.kuisScore?.[idx] ?? 0;
    const lulus  = window.progress?.kuisPassed?.[idx] ?? false;
    syncKuis(idx, skor, lulus);
  };

  /* ── PATCH showDrillResult ──────────────────────────────────── */
  const _origShowDrillResult = window.showDrillResult;
  window.showDrillResult = function () {
    _origShowDrillResult?.();
    const num  = window.drillNum ?? 5;
    const ans  = window.drillAnswers ?? [];
    const qs   = window.drillQuestions ?? [];
    let   skor = 0;
    qs.forEach((q, i) => { if (ans[i] === q.ans) skor++; });
    syncDrill(num, skor);
  };

  /* ── PATCH submitPBLDetail (LKPD per kelompok) ─────────────── */
  const _origSubmitPBLDetail = window.submitPBLDetail;
  window.submitPBLDetail = function (idx, textareaId) {
    _origSubmitPBLDetail?.(idx, textareaId);
    const grp = window.currentLKPDGroup ?? 1;
    syncLKPD(grp, idx);
  };

  /* ── PATCH submitTest (pretest / posttest / reflektif) ─────── */
  const _origSubmitTest = window.submitTest;
  window.submitTest = function (type) {
    _origSubmitTest?.(type);
    const idMap = {
      pretest  : ['pre-q1','pre-q2','pre-q3','pre-q4','pre-q5'],
      posttest : ['post-q1','post-q2','post-q3','post-q4','post-q5'],
      reflektif: ['ref-q1','ref-q2','ref-q3','ref-q4','ref-q5'],
    };
    const ids     = idMap[type] || [];
    const jawaban = ids.map(id => document.getElementById(id)?.value || '');

    if (type === 'pretest')   syncPretest(jawaban);
    if (type === 'posttest')  syncPosttest(jawaban);
    if (type === 'reflektif') syncReflektif(jawaban);
  };

  /* ── PATCH submitAngket ─────────────────────────────────────── */
  const _origSubmitAngket = window.submitAngket;
  window.submitAngket = function () {
    _origSubmitAngket?.();
    const answers = [];
    for (let i = 0; i < 15; i++) {
      const sel = document.querySelector(`input[name="angket-${i}"]:checked`);
      answers.push(sel ? parseInt(sel.value) : 0);
    }
    syncAngket(answers);
  };

  console.log('[BioImun Sync] ✅ Semua patch aktif. Siap sinkronisasi ke Google Sheets.');
});


/* ====================================================================
   LOGIKA UTAMA – NAVIGASI, PROGRESS, MATERI, KUIS, DRILL
   ==================================================================== */

/* ====================================================================
   BIOIMUN MODUL – SCRIPT.JS
   Semua logika sistem: navigasi, progress, materi, kuis, LKPD, drill
   ==================================================================== */


/* ========================= STATE ========================= */
let currentUser   = null;
let currentMateri = 0;
let currentPBL    = 0;
let drillNum      = 10;
let drillIdx      = 0;
let drillQuestions = [];
let drillAnswers   = [];
let kuisAnswers    = [];
let sidebarCollapsed = false;

// Progress: materi[i] = true jika selesai dibaca, kuisPassed[i] = true jika skor >=2/3
let progress = {
  materi:     [false, false, false, false, false], // dibaca?
  kuisPassed: [false, false, false, false, false], // lulus kuis?
  kuisScore:  [null, null, null, null, null],
  lkpd:       [false, false, false, false, false], // submit setiap tahap
  drillBest:  null,
  xp: 0,
};

const MIN_KUIS_SCORE = 3; // dari 5 soal

/* ========================= INIT ========================= */
document.addEventListener('DOMContentLoaded', () => {
  // Cek login
  const raw = sessionStorage.getItem('bioimun_user');
  if (!raw) { window.location.href = 'login.html'; return; }
  currentUser = JSON.parse(raw);

  // Muat progress dari localStorage per user
  loadProgress();
  renderUser();
  updateGlobalProgress();
  updateSidebarLocks();
  renderBadges();
  navigateTo('dashboard');
  initGlosarium();
  initRujukan();
  initSubmateriCards();
});

/* ========================= USER ========================= */
function renderUser() {
  const el = (id) => document.getElementById(id);
  const fn = currentUser.name.split(' ')[0];
  if (el('side-avatar'))  el('side-avatar').textContent  = currentUser.name[0];
  if (el('side-name'))    el('side-name').textContent    = currentUser.name;
  if (el('side-role'))    el('side-role').textContent    = currentUser.role === 'guru' ? 'Guru Biologi' : 'Pelajar · ' + currentUser.kelas;
  if (el('hero-name'))    el('hero-name').textContent    = fn;
  if (el('topbar-user'))  el('topbar-user').textContent  = fn;
}

/* ========================= PROGRESS ========================= */
function loadProgress() {
  try {
    const key = 'bioimun_prog_' + currentUser.username;
    const d   = localStorage.getItem(key);
    if (d) {
      const p = JSON.parse(d);
      Object.assign(progress, p);
    }
  } catch(e) {}
}

function saveProgress() {
  try {
    const key = 'bioimun_prog_' + currentUser.username;
    localStorage.setItem(key, JSON.stringify(progress));
  } catch(e) {}
  // Sync ke Google Sheets ditangani oleh sync.js (monkey-patch saveProgress)
}

function materiUnlocked(idx) {
  if (idx === 0) return true;
  return progress.kuisPassed[idx - 1] === true;
}

function lkpdUnlocked(idx) {
  if (idx === 0) return true;
  return progress.lkpd[idx - 1] === true;
}

function updateGlobalProgress() {
  const done  = progress.kuisPassed.filter(Boolean).length;
  const pct   = Math.round((done / 5) * 100);
  const fill  = document.getElementById('prog-mini');
  const label = document.getElementById('prog-pct');
  if (fill)  fill.style.width   = pct + '%';
  if (label) label.textContent  = pct + '%';

  // Stat cards
  const matDone  = progress.materi.filter(Boolean).length;
  const el = document.getElementById('stat-materi-done');
  if (el) el.textContent = matDone;

  // XP
  progress.xp = done * 20 + (progress.drillBest ? Math.round(progress.drillBest * 5) : 0);
  const xpEl = document.getElementById('xp-val');
  if (xpEl) xpEl.textContent = progress.xp + ' XP';
  const xpFill = document.getElementById('xp-fill');
  if (xpFill) xpFill.style.width = Math.min(100, progress.xp) + '%';

  // Last score
  const scores = progress.kuisScore.filter(v => v !== null);
  const lsEl   = document.getElementById('last-score');
  if (lsEl) lsEl.textContent = scores.length ? scores[scores.length-1] + '/5' : '-';

  // Progress tracks
  for (let i = 0; i < 5; i++) {
    const tf = document.getElementById('prog-track-' + i);
    if (tf) {
      const v = progress.kuisPassed[i] ? 100 : (progress.materi[i] ? 50 : 0);
      tf.style.width = v + '%';
    }
  }
}

function updateSidebarLocks() {
  // Ruang belajar cards
  for (let i = 0; i < 5; i++) {
    const card = document.getElementById('sm-card-' + i);
    if (!card) continue;
    const unlocked = materiUnlocked(i);
    card.classList.toggle('locked', !unlocked);
    const statusEl = card.querySelector('.materi-status');
    const lockOvEl = card.querySelector('.lock-overlay');
    if (statusEl) {
      if (progress.kuisPassed[i]) {
        statusEl.className = 'materi-status done';
        statusEl.innerHTML = '✅ Selesai';
      } else if (unlocked) {
        statusEl.className = 'materi-status open';
        statusEl.innerHTML = '📖 Tersedia';
      } else {
        statusEl.className = 'materi-status locked';
        statusEl.innerHTML = '🔒 Terkunci';
      }
    }
    if (lockOvEl) lockOvEl.style.display = unlocked ? 'none' : 'flex';
    const progFill = document.getElementById('prog-' + i);
    if (progFill) {
      const v = progress.kuisPassed[i] ? 100 : (progress.materi[i] ? 50 : 0);
      progFill.style.width = v + '%';
    }
  }

  // PBL sidebar tabs
  for (let i = 0; i < 5; i++) {
    const tab = document.querySelector(`.pbl-stage-tab[data-stage="${i}"]`);
    if (!tab) continue;
    const unlocked = lkpdUnlocked(i);
    tab.classList.toggle('pbl-locked', !unlocked);
    const badgeEl = tab.querySelector('.pbl-stage-badge');
    if (badgeEl) {
      if (progress.lkpd[i]) {
        badgeEl.style.background = '#dcfce7';
        badgeEl.style.color      = '#15803d';
        badgeEl.textContent      = '✅';
        tab.classList.add('pbl-done');
      } else if (!unlocked) {
        badgeEl.style.background = '#f1f5f9';
        badgeEl.style.color      = '#94a3b8';
        badgeEl.textContent      = '🔒';
      } else {
        badgeEl.style.background = '#dbeafe';
        badgeEl.style.color      = '#1d4ed8';
        badgeEl.textContent      = '📝';
      }
    }
  }
}

function renderBadges() {
  const container = document.getElementById('badge-container');
  if (!container) return;
  const badges = [
    { id:0, icon:'🌟', name:'Pemula',    cond: progress.materi.filter(Boolean).length >= 1 },
    { id:1, icon:'📚', name:'Pelajar',   cond: progress.materi.filter(Boolean).length >= 3 },
    { id:2, icon:'🏆', name:'Juara',     cond: progress.kuisPassed.every(Boolean) },
    { id:3, icon:'🔬', name:'Ilmuwan',   cond: progress.drillBest !== null },
    { id:4, icon:'🎓', name:'Sarjana',   cond: progress.lkpd.every(Boolean) },
  ];
  container.innerHTML = badges.map(b => `
    <div class="gbadge ${b.cond ? 'earned' : 'locked-b'}" title="${b.name}">
      <div class="gb-icon">${b.icon}</div>
      <div class="gb-name">${b.name}</div>
    </div>`).join('');
}

/* ========================= SIDEBAR ========================= */
function toggleSidebar() {
  const sb  = document.getElementById('sidebar');
  const mc  = document.querySelector('.main-content');
  if (window.innerWidth <= 768) {
    sb.classList.toggle('mobile-open');
    document.getElementById('sidebar-overlay').classList.toggle('show');
  } else {
    sidebarCollapsed = !sidebarCollapsed;
    sb.classList.toggle('collapsed', sidebarCollapsed);
    mc.classList.toggle('sidebar-collapsed', sidebarCollapsed);
  }
}

function closeSidebarMobile() {
  document.getElementById('sidebar').classList.remove('mobile-open');
  document.getElementById('sidebar-overlay').classList.remove('show');
}

/* ========================= NAVIGATION ========================= */
const PAGE_MAP = {
  dashboard    : 'sp-dashboard',
  kompetensi   : 'sp-kompetensi',
  ruangbelajar : 'sp-ruangbelajar',
  lkpd         : 'sp-lkpd',
  'lkpd-detail': 'sp-lkpd-detail',
  drill        : 'sp-drill',
  pretest      : 'sp-pretest',
  angket       : 'sp-angket',
  posttest     : 'sp-posttest',
  reflektif    : 'sp-reflektif',
  glosarium    : 'sp-glosarium',
  rujukan      : 'sp-rujukan',
  identitas    : 'sp-identitas',
  materi       : 'sp-materi',
};
const TITLES = {
  dashboard    : '🏠 Beranda',
  kompetensi   : '🎯 Kompetensi',
  ruangbelajar : '📚 Ruang Belajar',
  lkpd         : '📋 LKPD – <em>Problem-Based Learning</em>',
  drill        : '✏️ Drill Soal',
  pretest      : '📝 Pre-Test',
  angket       : '📋 Angket Ownership',
  posttest     : '📝 Post-Test',
  reflektif    : '💡 Esai Reflektif',
  glosarium    : '📖 Glosarium',
  rujukan      : '📚 Daftar Rujukan',
  identitas    : '👤 Identitas Pengembang',
  materi       : '📄 Materi',
};
// NAV_ORDER sesuai urutan .nav-item di sidebar (Menu Utama + Evaluasi + Referensi)
const NAV_ORDER = [
  'dashboard','kompetensi','ruangbelajar','lkpd','drill',
  'pretest','angket','posttest','reflektif',
  'glosarium','rujukan','identitas'
];

function navigateTo(pg) {
  document.querySelectorAll('.sub-page').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const spId = PAGE_MAP[pg];
  if (spId) {
    const target = document.getElementById(spId);
    if (target) target.classList.add('active');
  }
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.innerHTML = TITLES[pg] || pg;
  const idx = NAV_ORDER.indexOf(pg);
  const items = document.querySelectorAll('.nav-item');
  if (idx >= 0 && items[idx]) items[idx].classList.add('active');

  // Init per halaman
  if (pg === 'lkpd')      { if (typeof refreshGroupStatus === 'function') setTimeout(refreshGroupStatus, 50); }
  if (pg === 'glosarium')  { if (typeof initGlosarium === 'function') initGlosarium(); }
  if (pg === 'rujukan')    { if (typeof initRujukan === 'function') initRujukan(); }
  if (pg === 'angket')     { if (typeof initAngket === 'function') initAngket(false); }
  if (pg === 'pretest')    { if (typeof restoreTest === 'function') restoreTest('pretest'); }
  if (pg === 'posttest')   { if (typeof restoreTest === 'function') restoreTest('posttest'); }
  if (pg === 'reflektif')  { if (typeof restoreTest === 'function') restoreTest('reflektif'); }

  window.scrollTo(0, 0);
  closeSidebarMobile();
}

function doLogout() {
  sessionStorage.removeItem('bioimun_user');
  window.location.href = 'login.html';
}

/* ========================= KOMPETENSI ACCORDION ========================= */
function toggleAccord(el) {
  const body = el.nextElementSibling;
  const isOpen = body.classList.contains('open');
  document.querySelectorAll('.kp-accord-body').forEach(b => b.classList.remove('open'));
  document.querySelectorAll('.kp-accord-head').forEach(h => h.classList.remove('open'));
  if (!isOpen) {
    body.classList.add('open');
    el.classList.add('open');
  }
}

/* ========================= MATERI DATA ========================= */
const MATERI = [
  {
    title: 'Sistem Pertahanan Tubuh',
    emoji: '🛡️',
    content: `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
        <span style="font-size:1.6rem;">🛡️</span>
        <div>
          <h2 style="margin:0;font-size:1.15rem;color:var(--primary-dark);">Sistem Pertahanan Tubuh Manusia</h2>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">
            <span style="font-size:.78rem;padding:3px 10px;background:#dcfce7;color:#166534;border-radius:20px;font-weight:600;"><i class="fas fa-book"></i> Biologi Fase F</span>
            <span style="font-size:.78rem;padding:3px 10px;background:#dbeafe;color:#1e40af;border-radius:20px;font-weight:600;"><i class="fas fa-book-open"></i> Flipbook Interaktif</span>
          </div>
        </div>
      </div>
      <div style="background:linear-gradient(135deg,#f0fdf4,#eff6ff);border:1px solid #bbf7d0;border-radius:14px;padding:12px 16px;margin-bottom:14px;font-size:.84rem;color:#166534;display:flex;align-items:flex-start;gap:10px;">
        <span style="font-size:1.2rem;flex-shrink:0;">💡</span>
        <span>Baca seluruh flipbook di bawah ini. Gunakan tombol navigasi halaman untuk berpindah halaman. Setelah selesai membaca, kerjakan kuis di bawah untuk membuka materi berikutnya.</span>
      </div>
      <div style="position:relative;width:100%;padding-bottom:62%;height:0;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.12);background:#1a1a2e;">
        <iframe
          src="https://heyzine.com/flip-book/e5f9aa37bc.html"
          style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;"
          allowfullscreen
          loading="lazy"
          title="BioImun – Sistem Pertahanan Tubuh"
        ></iframe>
      </div>
      <div style="margin-top:10px;text-align:center;">
        <a href="https://heyzine.com/flip-book/e5f9aa37bc.html" target="_blank" rel="noopener"
           style="font-size:.82rem;color:var(--accent);font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
          <i class="fas fa-external-link-alt"></i> Buka di tab baru untuk tampilan penuh
        </a>
      </div>`,
    kuis: [
      { q:'Seorang siswa mengalami infeksi bakteri. Komponen sistem pertahanan tubuh PERTAMA yang akan merespons adalah?',
        opts:['Sel B yang memproduksi antibodi','Sel T sitotoksik yang membunuh sel terinfeksi','Sel NK dan makrofag yang memfagositosis bakteri','Sel plasma yang mensekresi IgG'],
        ans:2, penj:'Respons imun bawaan (innate immunity) adalah pertahanan pertama. Makrofag dan sel NK langsung aktif menyerang patogen tanpa perlu pengenalan spesifik antigen, sedangkan sel B dan sel T membutuhkan waktu lebih lama untuk teraktivasi.' },
      { q:'Perhatikan pernyataan: (1) Leukosit mencakup neutrofil, limfosit, dan monosit; (2) Eritrosit berperan dalam sistem imun; (3) Timus adalah organ limfoid primer; (4) Limpa termasuk organ limfoid sekunder. Pernyataan yang BENAR adalah?',
        opts:['(1) dan (2)','(1) dan (3)','(2) dan (4)','(3) dan (4)'],
        ans:3, penj:'Leukosit (sel darah putih) memang mencakup neutrofil, limfosit, dan monosit — benar. Timus adalah organ limfoid primer (tempat pematangan sel T) — benar. Eritrosit tidak berperan dalam imunitas. Limpa adalah organ limfoid sekunder (tempat respons imun berlangsung).' },
      { q:'Mengapa seseorang yang sudah pernah terserang cacar air tidak akan terserang lagi meskipun terpapar virus varicella? Hal ini paling tepat dijelaskan oleh konsep?',
        opts:['Fagositosis oleh neutrofil','Memori imunologis sel B dan sel T memori','Aktivasi sistem komplemen','Produksi interferon oleh sel NK'],
        ans:1, penj:'Setelah infeksi pertama, sel B memori dan sel T memori terbentuk dan bertahan bertahun-tahun. Saat terpapar ulang, sel-sel memori ini merespons jauh lebih cepat dan kuat (respons sekunder) sebelum virus sempat menyebabkan gejala.' },
      { q:'Pada kasus transplantasi organ, tubuh penerima sering menolak organ donor. Mekanisme penolakan ini melibatkan?',
        opts:['Sistem komplemen yang menghancurkan bakteri','MHC (Major Histocompatibility Complex) yang dikenali sebagai asing oleh sel T','Produksi IgE berlebihan terhadap antigen donor','Aktivasi sel mast oleh histamin'],
        ans:1, penj:'Setiap individu memiliki MHC unik di permukaan sel. Sel T penerima mengenali MHC donor sebagai "non-self" (asing) dan melancarkan respons imun seluler untuk menghancurkan organ tersebut. Ini disebut reaksi penolakan (graft rejection).' },
      { q:'Seorang bayi baru lahir dari ibu yang telah divaksin tetanus. Bayi tersebut memiliki antibodi anti-tetanus. Jenis imunitas yang dimiliki bayi ini adalah?',
        opts:['Aktif alami — karena diperoleh dari proses infeksi alami','Aktif buatan — karena diperoleh melalui vaksinasi','Pasif alami — karena antibodi diperoleh dari ibu melalui plasenta','Pasif buatan — karena diperoleh melalui suntikan serum'],
        ans:2, penj:'Bayi menerima antibodi IgG yang dibuat oleh ibunya (bukan membuat sendiri), melalui plasenta selama kehamilan. Karena diperoleh dari organisme lain secara alami (bukan disuntikkan), ini disebut imunitas pasif alami. Bayi tidak membentuk sel memori dari proses ini.' }
    ]
  },
  {
    title: 'Pertahanan Tubuh Nonspesifik',
    emoji: '🔰',
    content: `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
        <span style="font-size:1.6rem;">🔰</span>
        <div>
          <h2 style="margin:0;font-size:1.15rem;color:var(--primary-dark);">Pertahanan Tubuh Nonspesifik</h2>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">
            <span style="font-size:.78rem;padding:3px 10px;background:#dcfce7;color:#166534;border-radius:20px;font-weight:600;"><i class="fas fa-book"></i> Biologi Fase F</span>
            <span style="font-size:.78rem;padding:3px 10px;background:#dbeafe;color:#1e40af;border-radius:20px;font-weight:600;"><i class="fas fa-book-open"></i> Flipbook Interaktif</span>
          </div>
        </div>
      </div>
      <div style="background:linear-gradient(135deg,#f0fdf4,#eff6ff);border:1px solid #bbf7d0;border-radius:14px;padding:12px 16px;margin-bottom:14px;font-size:.84rem;color:#166534;display:flex;align-items:flex-start;gap:10px;">
        <span style="font-size:1.2rem;flex-shrink:0;">💡</span>
        <span>Baca seluruh flipbook di bawah ini. Gunakan tombol navigasi halaman untuk berpindah halaman. Setelah selesai membaca, kerjakan kuis di bawah untuk membuka materi berikutnya.</span>
      </div>
      <div style="position:relative;width:100%;padding-bottom:62%;height:0;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.12);background:#1a1a2e;">
        <iframe
          src="https://heyzine.com/flip-book/ca1f979511.html"
          style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;"
          allowfullscreen
          loading="lazy"
          title="BioImun – Pertahanan Tubuh Nonspesifik"
        ></iframe>
      </div>
      <div style="margin-top:10px;text-align:center;">
        <a href="https://heyzine.com/flip-book/ca1f979511.html" target="_blank" rel="noopener"
           style="font-size:.82rem;color:var(--accent);font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
          <i class="fas fa-external-link-alt"></i> Buka flipbook di tab baru untuk tampilan penuh
        </a>
      </div>`,
    kuis: [
      { q:'Ketika bakteri masuk melalui luka, urutan respons pertahanan nonspesifik yang BENAR adalah?',
        opts:['Antibodi → fagositosis → demam','Inflamasi → fagositosis → demam','Fagositosis → produksi antibodi → inflamasi','Demam → produksi interferon → fagositosis'],
        ans:1, penj:'Respons nonspesifik diawali dengan inflamasi (vasodilatasi, peningkatan permeabilitas pembuluh) yang menarik sel fagosit ke lokasi infeksi. Neutrofil dan makrofag kemudian melakukan fagositosis. Jika infeksi menyebar, hipotalamus memicu demam untuk menghambat pertumbuhan patogen.' },
      { q:'Seorang peneliti menemukan bahwa tikus yang dinonaktifkan gen interferon-nya jauh lebih rentan terhadap infeksi virus. Kesimpulan yang paling tepat dari temuan ini adalah?',
        opts:['Interferon merupakan antigen yang melawan virus secara langsung','Interferon berperan kritis dalam pertahanan awal melawan infeksi virus dengan memperingatkan sel-sel sekitar','Tikus tersebut tidak dapat membentuk antibodi','Fagositosis tidak dapat terjadi tanpa interferon'],
        ans:1, penj:'Interferon adalah protein sinyal yang dilepas sel terinfeksi virus untuk memperingatkan sel-sel di sekitarnya agar meningkatkan pertahanan antivirus. Tanpa interferon, sel lain tidak mendapat "peringatan dini" sehingga virus dapat menyebar lebih cepat.' },
      { q:'Pernyataan yang BENAR tentang perbedaan pertahanan lini pertama dan lini kedua adalah?',
        opts:['Kulit dan selaput lendir adalah lini kedua; fagositosis adalah lini pertama','Kulit dan selaput lendir adalah lini pertama; fagositosis dan inflamasi adalah lini kedua','Antibodi adalah bagian dari lini pertama pertahanan tubuh','Demam termasuk pertahanan lini pertama karena terjadi paling awal'],
        ans:1, penj:'Lini pertama: penghalang fisik dan kimiawi (kulit, rambut hidung, selaput lendir, enzim lisozim, pH asam lambung). Lini kedua: respons seluler internal seperti fagositosis, inflamasi, demam, dan interferon — aktif ketika patogen berhasil menembus lini pertama.' },
      { q:'Mengapa demam sampai 38,5°C justru MENGUNTUNGKAN bagi sistem imun dalam melawan infeksi bakteri?',
        opts:['Demam membunuh semua sel imun yang lemah','Suhu tinggi menghambat pertumbuhan bakteri dan meningkatkan aktivitas fagosit','Demam mempercepat produksi antibodi spesifik','Demam menurunkan pH darah sehingga bakteri tidak bisa berkembang'],
        ans:1, penj:'Banyak bakteri patogen tumbuh optimal pada suhu tubuh normal (37°C). Suhu yang sedikit lebih tinggi menghambat enzim-enzim bakteri. Selain itu, aktivitas fagosit dan sel NK justru meningkat pada suhu 38–39°C, mempercepat eliminasi patogen.' },
      { q:'Seorang pasien dengan luka bakar luas mengalami infeksi berulang meski dirawat di rumah sakit. Faktor UTAMA yang paling menjelaskan kerentanan ini adalah?',
        opts:['Sistem imun spesifiknya telah menurun akibat panas','Luka bakar menghilangkan kulit sebagai penghalang fisik lini pertama pertahanan nonspesifik','Pasien tidak dapat memproduksi interferon','Sel B pasien tidak dapat membentuk antibodi'],
        ans:1, penj:'Kulit adalah penghalang fisik terpenting dalam pertahanan nonspesifik (lini pertama). Luka bakar luas menghilangkan penghalang ini secara masif, sehingga bakteri dari lingkungan memiliki akses langsung ke jaringan tubuh. Ini jauh lebih signifikan daripada gangguan imunitas spesifik dalam jangka pendek.' }
    ]
  },
  {
    title: 'Pertahanan Tubuh Spesifik',
    emoji: '🎯',
    content: `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
        <span style="font-size:1.6rem;">🎯</span>
        <div>
          <h2 style="margin:0;font-size:1.15rem;color:var(--primary-dark);">Pertahanan Tubuh Spesifik</h2>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">
            <span style="font-size:.78rem;padding:3px 10px;background:#dcfce7;color:#166534;border-radius:20px;font-weight:600;"><i class="fas fa-book"></i> Biologi Fase F</span>
            <span style="font-size:.78rem;padding:3px 10px;background:#dbeafe;color:#1e40af;border-radius:20px;font-weight:600;"><i class="fas fa-book-open"></i> Flipbook Interaktif</span>
          </div>
        </div>
      </div>
      <div style="background:linear-gradient(135deg,#f0fdf4,#eff6ff);border:1px solid #bbf7d0;border-radius:14px;padding:12px 16px;margin-bottom:14px;font-size:.84rem;color:#166534;display:flex;align-items:flex-start;gap:10px;">
        <span style="font-size:1.2rem;flex-shrink:0;">💡</span>
        <span>Baca seluruh flipbook di bawah ini. Gunakan tombol navigasi halaman untuk berpindah halaman. Setelah selesai membaca, kerjakan kuis di bawah untuk membuka materi berikutnya.</span>
      </div>
      <div style="position:relative;width:100%;padding-bottom:62%;height:0;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.12);background:#1a1a2e;">
        <iframe
          src="https://heyzine.com/flip-book/7f3f5fc4c1.html"
          style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;"
          allowfullscreen
          loading="lazy"
          title="BioImun – Pertahanan Tubuh Spesifik"
        ></iframe>
      </div>
      <div style="margin-top:10px;text-align:center;">
        <a href="https://heyzine.com/flip-book/7f3f5fc4c1.html" target="_blank" rel="noopener"
           style="font-size:.82rem;color:var(--accent);font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
          <i class="fas fa-external-link-alt"></i> Buka flipbook di tab baru untuk tampilan penuh
        </a>
      </div>`,
    kuis: [
      { q:'Seorang anak divaksin campak. Empat minggu kemudian ia terpapar virus campak asli. Respons imun yang akan terjadi adalah?',
        opts:['Respons primer lambat karena belum pernah terinfeksi sesungguhnya','Respons sekunder cepat karena sel B memori dari vaksinasi langsung aktif','Tidak ada respons karena antibodi vaksin sudah habis','Hanya fagositosis yang terjadi karena antigen virus sudah dikenal'],
        ans:1, penj:'Vaksin memperkenalkan antigen virus campak, memicu respons primer dan pembentukan sel B memori. Saat terpapar virus asli, sel B memori langsung berproliferasi menghasilkan antibodi dalam jumlah besar (respons sekunder) — jauh lebih cepat dari respons primer.' },
      { q:'Pasien mengalami defisiensi sel T helper (CD4+). Konsekuensi yang PALING MUNGKIN terjadi adalah?',
        opts:['Hanya imunitas seluler yang terganggu; produksi antibodi tetap normal','Baik imunitas humoral maupun seluler terganggu karena sel T helper mengaktifkan keduanya','Imunitas bawaan sepenuhnya berhenti berfungsi','Hanya produksi IgM yang terganggu'],
        ans:1, penj:'Sel T helper adalah "orkestrator" sistem imun adaptif. Ia mengaktifkan sel B (untuk produksi antibodi/imunitas humoral) DAN mengaktifkan sel T sitotoksik (imunitas seluler). Hilangnya sel T helper menyebabkan kedua jalur imun adaptif terganggu — inilah yang terjadi pada AIDS.' },
      { q:'Mengapa antibodi tidak dapat langsung menghancurkan virus yang sudah berada di dalam sel (intraseluler)?',
        opts:['Karena antibodi hanya bekerja di dalam sel','Karena antibodi hanya bekerja di ruang ekstraseluler; virus intraseluler hanya bisa dieliminasi sel T sitotoksik','Karena virus intraseluler tidak memiliki antigen','Karena antibodi harus bekerja bersama sel NK saja'],
        ans:1, penj:'Antibodi adalah protein besar yang tidak dapat menembus membran sel. Antibodi efektif menetralisir patogen dan toksin di ruang ekstraseluler (darah, limfe). Virus yang sudah bersembunyi di dalam sel hanya dapat dieliminasi oleh sel T sitotoksik (CD8+) yang mengenali fragmen antigen virus yang dipresentasikan di permukaan sel terinfeksi.' },
      { q:'Bagaimana sel T sitotoksik mengenali sel yang terinfeksi virus untuk dihancurkan?',
        opts:['Melalui IgG yang menempel di permukaan sel terinfeksi','Melalui presentasi fragmen antigen virus pada molekul MHC kelas I di permukaan sel terinfeksi','Melalui perubahan warna membran sel yang terinfeksi','Melalui sinyal interferon yang dikeluarkan sel terinfeksi saja'],
        ans:1, penj:'Setiap sel berinti mempresentasikan sampel protein intraselnya di permukaan melalui MHC kelas I. Jika sel terinfeksi virus, protein virus akan muncul di MHC I — ini adalah "tanda bahaya" yang dikenali oleh reseptor (TCR) sel T sitotoksik untuk melancarkan serangan.' },
      { q:'Pada respons imun humoral, urutan kejadian yang BENAR setelah antigen masuk ke tubuh adalah?',
        opts:['Antigen → sel T helper aktif → sel B aktif → sel plasma → antibodi','Antigen → sel B aktif langsung → antibodi → sel T helper aktif','Antigen → sel NK aktif → sel B aktif → antibodi → sel T helper','Antigen → antibodi langsung diproduksi oleh makrofag → sel B aktif'],
        ans:0, penj:'Antigen dipresentasikan oleh APC (sel dendritik/makrofag) kepada sel T helper. Sel T helper yang aktif melepas sitokin yang mengaktifkan sel B. Sel B yang teraktivasi berproliferasi dan berdiferensiasi menjadi sel plasma (yang memproduksi antibodi) dan sel B memori.' }
    ]
  },
  {
    title: 'Jenis Imunitas',
    emoji: '💉',
    content: `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
        <span style="font-size:1.6rem;">💉</span>
        <div>
          <h2 style="margin:0;font-size:1.15rem;color:var(--primary-dark);">Jenis Imunitas</h2>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">
            <span style="font-size:.78rem;padding:3px 10px;background:#dcfce7;color:#166534;border-radius:20px;font-weight:600;"><i class="fas fa-book"></i> Biologi Fase F</span>
            <span style="font-size:.78rem;padding:3px 10px;background:#dbeafe;color:#1e40af;border-radius:20px;font-weight:600;"><i class="fas fa-book-open"></i> Flipbook Interaktif</span>
          </div>
        </div>
      </div>
      <div style="background:linear-gradient(135deg,#f0fdf4,#eff6ff);border:1px solid #bbf7d0;border-radius:14px;padding:12px 16px;margin-bottom:14px;font-size:.84rem;color:#166534;display:flex;align-items:flex-start;gap:10px;">
        <span style="font-size:1.2rem;flex-shrink:0;">💡</span>
        <span>Baca seluruh flipbook di bawah ini. Gunakan tombol navigasi halaman untuk berpindah halaman. Setelah selesai membaca, kerjakan kuis di bawah untuk membuka materi berikutnya.</span>
      </div>
      <div style="position:relative;width:100%;padding-bottom:62%;height:0;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.12);background:#1a1a2e;">
        <iframe
          src="https://heyzine.com/flip-book/42be1c3c5e.html"
          style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;"
          allowfullscreen
          loading="lazy"
          title="BioImun – Jenis Imunitas"
        ></iframe>
      </div>
      <div style="margin-top:10px;text-align:center;">
        <a href="https://heyzine.com/flip-book/42be1c3c5e.html" target="_blank" rel="noopener"
           style="font-size:.82rem;color:var(--accent);font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
          <i class="fas fa-external-link-alt"></i> Buka flipbook di tab baru untuk tampilan penuh
        </a>
      </div>`,
    kuis: [
      { q:'Seorang ibu hamil yang sudah mendapatkan vaksin hepatitis B melahirkan bayi. Bayi tersebut dites dan ditemukan memiliki antibodi anti-HBs. Jenis imunitas bayi tersebut adalah?',
        opts:['Aktif buatan karena ibunya divaksin','Pasif alami karena antibodi diperoleh dari ibu melalui plasenta','Aktif alami karena bayi sendiri yang membentuk antibodi','Pasif buatan karena antibodi berasal dari produksi laboratorium'],
        ans:1, penj:'Antibodi IgG ibu (yang terbentuk dari vaksinasi) melewati plasenta ke bayi. Karena bayi menerima antibodi yang dibuat organisme lain (ibu) secara alami (bukan disuntikkan serum), ini adalah imunitas pasif alami. Bayi tidak membuat antibodi sendiri dan tidak membentuk sel memori.' },
      { q:'Seorang korban gigitan ular berbisa diberi suntikan antivenom (serum berisi antibodi anti-racun ular). Jenis imunitas yang diperoleh dan karakteristiknya adalah?',
        opts:['Aktif buatan — berlangsung lama karena membentuk sel memori','Pasif buatan — berlangsung singkat karena tidak membentuk sel memori','Pasif alami — berlangsung lama karena berasal dari organisme lain','Aktif alami — terjadi karena tubuh terpapar racun ular secara alami'],
        ans:1, penj:'Antivenom adalah antibodi yang diproduksi hewan (misalnya kuda) lalu dimurnikan dan disuntikkan ke manusia — ini adalah imunitas pasif buatan. Karena pasien menerima antibodi jadi (bukan membuatnya sendiri), tidak terbentuk sel memori, sehingga perlindungannya bersifat sementara.' },
      { q:'Mengapa imunitas aktif memberikan perlindungan lebih LAMA dibanding imunitas pasif?',
        opts:['Karena antibodi pada imunitas aktif lebih banyak jumlahnya','Karena imunitas aktif melibatkan pembentukan sel B dan T memori yang dapat bertahan bertahun-tahun','Karena pada imunitas aktif, antigen langsung dihancurkan tanpa sisa','Karena pada imunitas pasif, antibodi yang diterima lebih cepat terurai'],
        ans:1, penj:'Pada imunitas aktif, tubuh sendiri menjalani respons imun lengkap, menghasilkan sel B memori dan sel T memori yang dapat bertahan puluhan tahun. Sel-sel ini siap merespons cepat jika antigen yang sama muncul lagi. Pada imunitas pasif, hanya antibodi jadi yang diterima tanpa pembentukan sel memori, sehingga perlindungan hanya berlangsung beberapa minggu.' },
      { q:'Perbandingan antara imunitas aktif alami dan aktif buatan yang PALING TEPAT adalah?',
        opts:['Aktif alami diperoleh dari vaksin; aktif buatan diperoleh dari sakit lalu sembuh','Aktif alami dari sakit atau sembuh; aktif buatan dari vaksinasi; keduanya menghasilkan sel memori','Keduanya sama-sama tidak membentuk sel memori','Aktif buatan selalu lebih efektif daripada aktif alami'],
        ans:1, penj:'Imunitas aktif alami diperoleh saat tubuh sendiri menghadapi infeksi nyata dan sembuh (misal: sembuh dari cacar air). Imunitas aktif buatan diperoleh melalui vaksinasi. KEDUANYA menghasilkan sel memori dan memberikan perlindungan jangka panjang, perbedaannya hanya pada cara paparan antigennya.' },
      { q:'Program imunisasi nasional seperti pemberian vaksin Difteri-Tetanus-Pertusis (DTP) kepada bayi bertujuan membentuk imunitas pada tingkat populasi. Konsep ini disebut?',
        opts:['Imunitas pasif buatan','Imunitas aktif alami','Kekebalan kelompok (herd immunity)','Toleransi imun'],
        ans:2, penj:'Herd immunity (kekebalan kelompok) terbentuk ketika sebagian besar populasi (biasanya >95%) kebal terhadap suatu penyakit, sehingga rantai penularan terputus dan individu yang tidak kebal (bayi baru lahir, lansia, penderita imunodefisiensi) pun terlindungi secara tidak langsung.' },
      { q:'Antibodi yang diterima bayi melalui ASI merupakan contoh imunitas?', opts:['Aktif alami','Aktif buatan','Pasif alami','Pasif buatan'], ans:2,
        penj:'Antibodi dari ASI (terutama IgA) diberikan dari ibu ke bayi secara alami. Bayi tidak membuat antibodi sendiri, sehingga ini adalah imunitas pasif alami.' }
    ]
  },
  {
    title: 'Gangguan Sistem Pertahanan Tubuh',
    emoji: '🦠',
    content: `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
        <span style="font-size:1.6rem;">🦠</span>
        <div>
          <h2 style="margin:0;font-size:1.15rem;color:var(--primary-dark);">Gangguan Sistem Pertahanan Tubuh</h2>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">
            <span style="font-size:.78rem;padding:3px 10px;background:#dcfce7;color:#166534;border-radius:20px;font-weight:600;"><i class="fas fa-book"></i> Biologi Fase F</span>
            <span style="font-size:.78rem;padding:3px 10px;background:#dbeafe;color:#1e40af;border-radius:20px;font-weight:600;"><i class="fas fa-book-open"></i> Flipbook Interaktif</span>
          </div>
        </div>
      </div>
      <div style="background:linear-gradient(135deg,#f0fdf4,#eff6ff);border:1px solid #bbf7d0;border-radius:14px;padding:12px 16px;margin-bottom:14px;font-size:.84rem;color:#166534;display:flex;align-items:flex-start;gap:10px;">
        <span style="font-size:1.2rem;flex-shrink:0;">💡</span>
        <span>Baca seluruh flipbook di bawah ini. Gunakan tombol navigasi halaman untuk berpindah halaman. Setelah selesai membaca, kerjakan kuis di bawah untuk membuka materi berikutnya.</span>
      </div>
      <div style="position:relative;width:100%;padding-bottom:62%;height:0;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.12);background:#1a1a2e;">
        <iframe
          src="https://heyzine.com/flip-book/957bf0f36d.html"
          style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;"
          allowfullscreen
          loading="lazy"
          title="BioImun – Gangguan Sistem Pertahanan Tubuh"
        ></iframe>
      </div>
      <div style="margin-top:10px;text-align:center;">
        <a href="https://heyzine.com/flip-book/957bf0f36d.html" target="_blank" rel="noopener"
           style="font-size:.82rem;color:var(--accent);font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
          <i class="fas fa-external-link-alt"></i> Buka flipbook di tab baru untuk tampilan penuh
        </a>
      </div>`,
    kuis: [
      { q:'Seorang anak makan kacang tanah dan tiba-tiba mengalami sesak napas berat, tekanan darah turun drastis, dan kemerahan di seluruh tubuh. Kondisi ini paling tepat disebut sebagai?',
        opts:['Imunodefisiensi akut karena kacang merusak sel imun','Reaksi autoimun karena tubuh menyerang jaringan sendiri','Anafilaksis — reaksi hipersensitivitas tipe I yang mengancam jiwa','Sindrom imunodefisiensi karena alergen menekan sel T'],
        ans:2, penj:'Anafilaksis adalah reaksi hipersensitivitas tipe I yang ekstrem dan mengancam jiwa. Dipicu oleh paparan alergen (kacang) pada individu tersensitisasi yang memiliki IgE spesifik. IgE memicu degranulasi masif sel mast dan basofil, melepas histamin besar-besaran yang menyebabkan bronkospasme, vasodilatasi, dan hipotensi.' },
      { q:'Mengapa penderita HIV/AIDS rentan terhadap infeksi yang tidak berbahaya bagi orang sehat (infeksi oportunistik)?',
        opts:['Karena HIV merusak sumsum tulang sehingga semua sel darah tidak dapat dibentuk','Karena HIV menghancurkan sel T helper yang diperlukan untuk mengaktifkan imunitas humoral dan seluler','Karena HIV menyerang langsung sel B sehingga tidak ada antibodi','Karena HIV menonaktifkan sel NK dan neutrofil sebagai pertahanan pertama'],
        ans:1, penj:'HIV secara selektif menginfeksi dan menghancurkan sel T helper (CD4+). Tanpa sel T helper, sel B tidak dapat diaktifkan secara optimal (imunitas humoral menurun) dan sel T sitotoksik tidak mendapat sinyal kuat (imunitas seluler menurun). Akibatnya, sistem imun adaptif kolaps, dan tubuh tidak mampu melawan patogen oportunistik.' },
      { q:'Penderita Lupus (SLE) mengalami kerusakan berbagai organ termasuk ginjal dan kulit. Mekanisme paling tepat yang menjelaskan kerusakan ini adalah?',
        opts:['Virus Lupus langsung merusak organ tersebut','Sistem imun gagal membedakan antigen tubuh sendiri dari antigen asing, sehingga menyerang jaringan ginjal dan kulit','Sistem komplemen tidak berfungsi sehingga infeksi bakteri merusak organ','Kekurangan sel NK menyebabkan sel tumor menyerang organ'],
        ans:1, penj:'Lupus adalah penyakit autoimun di mana toleransi imun terhadap antigen self gagal. Sel T dan sel B menghasilkan autoantibodi yang menyerang jaringan tubuh sendiri (DNA inti sel, sel darah merah, ginjal, dll). Kompleks imun yang terbentuk mengendap di organ dan memicu kerusakan inflamatoris.' },
      { q:'Seorang pasien paska transplantasi ginjal mendapat obat imunosupresan setiap hari. Tujuan pemberian obat ini adalah?',
        opts:['Meningkatkan produksi antibodi agar ginjal baru cepat diterima','Mencegah sistem imun pasien mengenali ginjal donor sebagai asing dan menolaknya','Membantu sel T sitotoksik membunuh bakteri yang mungkin masuk saat operasi','Merangsang pembentukan sel B memori terhadap antigen ginjal baru'],
        ans:1, penj:'Obat imunosupresan (misalnya siklosporin) menekan aktivitas sel T sehingga sistem imun tidak menyerang ginjal donor yang memiliki MHC berbeda. Tanpa obat ini, sel T akan mengenali MHC donor sebagai "asing" dan melancarkan respons penolakan. Konsekuensinya, pasien menjadi rentan terhadap infeksi karena imunitasnya secara umum tertekan.' },
      { q:'Perhatikan data berikut: pada tahun 2025 terjadi KLB campak di Sumenep dengan cakupan imunisasi hanya 82% — jauh di bawah ambang 95% untuk herd immunity. Analisis yang PALING TEPAT berdasarkan konsep sistem imun adalah?',
        opts:['Campak tidak menular jika cakupan vaksin sudah di atas 80%','Gap 13% dari ambang herd immunity menyebabkan rantai penularan tidak terputus sehingga individu yang tidak kebal (bayi, immunocompromised) tetap terancam','Cakupan 82% sudah cukup karena mayoritas sudah kebal','Herd immunity tidak relevan untuk penyakit virus seperti campak'],
        ans:1, penj:'Herd immunity membutuhkan cakupan sangat tinggi (≥95% untuk campak yang sangat menular, R₀=12-18) agar rantai penularan terputus sepenuhnya. Cakupan 82% meninggalkan 18% populasi rentan — cukup untuk mempertahankan penularan. Individu yang tidak dapat divaksin (bayi <9 bulan, penderita imunodefisiensi) kehilangan perlindungan tidak langsung dari herd immunity ini.' }
    ]
  }
];

/* ========================= RUANG BELAJAR ========================= */
function initSubmateriCards() {
  for (let i = 0; i < 5; i++) {
    const card = document.getElementById('sm-card-' + i);
    if (card) {
      card.onclick = () => openMateri(i);
    }
  }
}

function openMateri(idx) {
  if (!materiUnlocked(idx)) {
    showToast('🔒 Selesaikan kuis materi sebelumnya terlebih dahulu!', 'error');
    return;
  }
  currentMateri = idx;
  const m = MATERI[idx];
  navigateTo('materi');
  document.getElementById('mb-title').textContent = m.title;
  document.getElementById('topbar-title').textContent = '📄 ' + m.title;

  const box = document.getElementById('materi-content-box');
  box.innerHTML = m.content;

  // Tandai materi sudah dibaca
  progress.materi[idx] = true;
  saveProgress();
  updateGlobalProgress();
  updateSidebarLocks();

  renderKuis(idx);
}

function backToRuangBelajar() {
  navigateTo('ruangbelajar');
  updateSidebarLocks();
}

/* ========================= KUIS ========================= */
function renderKuis(matIdx) {
  const kuis      = MATERI[matIdx].kuis;
  const container = document.getElementById('kuis-questions');
  kuisAnswers     = [];
  container.innerHTML = '';
  document.getElementById('kuis-score').style.display     = 'none';
  document.getElementById('kuis-actions').style.display   = 'flex';
  document.getElementById('kuis-unlock-msg').style.display = 'none';
  document.getElementById('kuis-locked-msg').style.display = 'none';

  kuis.forEach((q, qi) => {
    const letters = ['A','B','C','D'];
    const optsHtml = q.opts.map((o, oi) =>
      `<div class="q-opt" onclick="selectKuisOpt(this,${qi},${oi})" data-qi="${qi}" data-oi="${oi}">
        <div class="opt-letter">${letters[oi]}</div>${o}
      </div>`).join('');
    container.innerHTML += `
      <div class="q-card" id="qcard-${qi}">
        <div class="q-text">${qi+1}. ${q.q}</div>
        <div class="q-options">${optsHtml}</div>
        <div class="q-feedback" id="qfb-${qi}"></div>
      </div>`;
  });
}

function selectKuisOpt(el, qi, oi) {
  document.querySelectorAll(`[data-qi="${qi}"]`).forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  kuisAnswers[qi] = oi;
}

function submitKuis() {
  const kuis  = MATERI[currentMateri].kuis;
  let   score = 0;
  let   allAnswered = true;

  kuis.forEach((q, qi) => {
    if (kuisAnswers[qi] === undefined) { allAnswered = false; return; }
    const userAns = kuisAnswers[qi];
    const opts    = document.querySelectorAll(`[data-qi="${qi}"]`);
    const fb      = document.getElementById('qfb-' + qi);
    opts.forEach(o => o.onclick = null);
    opts.forEach((o, oi) => {
      if (oi === q.ans)          o.classList.add('correct');
      else if (userAns === oi)   o.classList.add('wrong');
    });
    if (userAns === q.ans) {
      score++;
      fb.textContent = '✅ Jawaban benar! ' + q.penj;
      fb.className   = 'q-feedback show ok';
    } else {
      fb.textContent = `❌ Salah. Jawaban benar: ${['A','B','C','D'][q.ans]}. ${q.penj}`;
      fb.className   = 'q-feedback show fail';
    }
  });

  if (!allAnswered) {
    showToast('⚠️ Jawab semua soal terlebih dahulu!', 'error');
    return;
  }

  progress.kuisScore[currentMateri] = score;
  const passed = score >= MIN_KUIS_SCORE;
  progress.kuisPassed[currentMateri] = passed;
  progress.xp += score * 5;
  saveProgress();
  updateGlobalProgress();
  updateSidebarLocks();
  renderBadges();
  // ── SYNC kuis ke Google Sheets ──
  if (typeof syncKuis === 'function') syncKuis(currentMateri, score, passed);

  const scoreBox = document.getElementById('kuis-score');
  scoreBox.style.display = 'block';
  scoreBox.innerHTML = `
    <div class="score-box">
      <div style="font-size:2.5rem;margin-bottom:8px">${score===5?'🏆':score>=3?'👍':'📚'}</div>
      <div class="score-val">${score}/5</div>
      <div class="score-label">${score===5?'Sempurna! Luar biasa!':score>=3?'Bagus! Kamu lulus!':'Perlu belajar lagi!'}</div>
    </div>`;

  document.getElementById('kuis-actions').style.display = 'none';

  if (passed) {
    document.getElementById('kuis-unlock-msg').style.display = 'block';
    showToast('🎉 Selamat! Materi berikutnya terbuka!', 'success');
  } else {
    document.getElementById('kuis-locked-msg').style.display = 'block';
    showToast(`Skor ${score}/5. Minimal ${MIN_KUIS_SCORE}/5 untuk lanjut.`, 'error');
  }
}

function resetKuis() {
  kuisAnswers = [];
  renderKuis(currentMateri);
}

/* ========================= LKPD PBL ========================= */
function openPBL(idx) {
  if (!lkpdUnlocked(idx)) {
    showToast('🔒 Selesaikan tahap sebelumnya terlebih dahulu!', 'error');
    return;
  }
  currentPBL = idx;
  document.querySelectorAll('.pbl-stage-tab').forEach((t, i) => t.classList.toggle('active', i === idx));
  const area = document.getElementById('lkpd-content-area');

  if (!lkpdUnlocked(idx)) {
    area.innerHTML = `
      <div class="lkpd-locked-panel">
        <i class="fas fa-lock"></i>
        <h3>Tahap Terkunci</h3>
        <p>Selesaikan tahap sebelumnya untuk membuka tahap ini.</p>
      </div>`;
    return;
  }
  area.innerHTML = PBL_CONTENT[idx];
}

function submitLKPD(idx) {
  progress.lkpd[idx] = true;
  saveProgress();
  updateSidebarLocks();
  renderBadges();
  // ── SYNC LKPD ke Google Sheets ──
  if (typeof syncLKPD === 'function') syncLKPD(1, idx);
  showToast('✅ Tahap ' + (idx+1) + ' berhasil diselesaikan! Tahap berikutnya terbuka.', 'success');
  // Buka tab berikutnya jika ada
  if (idx < 4) setTimeout(() => openPBL(idx + 1), 800);
}

const PBL_CONTENT = [
  // ── Tahap 1: Orientasi Masalah ──
  `<div class="lkpd-content animate-in">
    <h3 style="font-size:1.1rem;font-weight:800;color:var(--primary-dark);margin-bottom:16px;">🔍 Tahap 1: Orientasi pada Masalah</h3>
    <div class="case-box">
      <h4>📰 Studi Kasus: Lonjakan Kasus DBD</h4>
      <p>Pada awal musim hujan, terjadi peningkatan signifikan kasus Demam Berdarah Dengue (DBD). Data Kementerian Kesehatan menunjukkan kenaikan 40% dibanding tahun lalu. Banyak pasien mengalami penurunan trombosit drastis dan kebocoran plasma. Mengapa sistem imun seseorang bisa kalah dari virus dengue?</p>
    </div>
    <div class="case-box" style="background:linear-gradient(135deg,#eff6ff,#dbeafe);border-color:#93c5fd;margin-top:12px;">
      <h4 style="color:#1e40af;">🤧 Kasus Tambahan: Meningkatnya Kasus Alergi</h4>
      <p style="color:#1e3a8a;">Prevalensi alergi pada anak-anak meningkat 20% dalam 10 tahun terakhir. Para ilmuwan menduga berkaitan dengan perubahan pola hidup dan paparan polutan. Mengapa sistem imun beberapa orang "salah sasaran" menyerang zat yang tidak berbahaya?</p>
    </div>
    <div style="margin-top:20px;">
      <label style="font-size:.9rem;font-weight:700;color:var(--text);display:block;margin-bottom:8px;">✏️ Rumusan Masalah Kelompok Kamu:</label>
      <textarea class="textarea-field" id="rm-text" placeholder="Tuliskan rumusan masalah berdasarkan kasus di atas (minimal 2 kalimat tanya)..."></textarea>
    </div>
    <div style="margin-top:20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <h4 style="font-size:.95rem;font-weight:800;color:var(--primary-dark);">💬 Forum Diskusi Kelas</h4>
        <button class="btn-primary" onclick="addForumPost(0)" style="padding:8px 16px;font-size:.82rem;"><i class="fas fa-plus"></i> Tambah</button>
      </div>
      <div id="forum-posts-0">
        <div class="forum-post"><div class="forum-post-header"><div class="fp-avatar">K1</div><div><div class="fp-name">Kelompok 1</div><div class="fp-time">2 jam lalu</div></div></div><div class="fp-text">Menurut kami, masalah utama adalah: Mengapa sistem imun tidak mampu mengenali dan menghancurkan virus dengue sebelum menyebabkan kerusakan organ?</div><div class="fp-actions"><button class="fp-btn" onclick="likePost(this)"><i class="fas fa-thumbs-up"></i> Suka (3)</button></div></div>
        <div class="forum-post"><div class="forum-post-header"><div class="fp-avatar" style="background:linear-gradient(135deg,#7c3aed,#4f46e5)">K2</div><div><div class="fp-name">Kelompok 2</div><div class="fp-time">1 jam lalu</div></div></div><div class="fp-text">Kami meneliti: Bagaimana mekanisme virus dengue menghindari sistem imun? Apakah ada hubungannya dengan antibody-dependent enhancement?</div><div class="fp-actions"><button class="fp-btn" onclick="likePost(this)"><i class="fas fa-thumbs-up"></i> Suka (5)</button></div></div>
      </div>
    </div>
    <button class="btn-primary" style="margin-top:20px;width:100%" onclick="checkAndSubmitLKPD(0,'rm-text')"><i class="fas fa-check-circle"></i> Selesaikan Tahap 1</button>
  </div>`,

  // ── Tahap 2: Organisasi Belajar ──
  `<div class="lkpd-content animate-in">
    <h3 style="font-size:1.1rem;font-weight:800;color:var(--primary-dark);margin-bottom:16px;">📚 Tahap 2: Mengorganisasikan Siswa untuk Belajar</h3>
    <div class="info-box" style="margin-bottom:16px;"><strong>📌 Tujuan:</strong> Merencanakan strategi belajar, membagi tugas, dan mengidentifikasi sumber belajar.</div>
    <div class="card" style="margin-bottom:16px;">
      <h4 style="margin-bottom:14px;font-size:.95rem;font-weight:800;"><i class="fas fa-book-open" style="color:var(--primary)"></i> Sumber Belajar Tambahan</h4>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div style="display:flex;align-items:center;gap:12px;padding:12px;border:2px solid var(--border);border-radius:12px;background:var(--bg);">
          <div style="width:40px;height:40px;border-radius:10px;background:#dbeafe;display:flex;align-items:center;justify-content:center;font-size:1.1rem;">📄</div>
          <div><div style="font-size:.88rem;font-weight:700;">Jurnal: Immunological Response to Dengue Virus</div><div style="font-size:.76rem;color:var(--text-muted);">Nature Immunology, 2023</div></div>
          <button class="btn-secondary" style="margin-left:auto;padding:6px 14px;font-size:.78rem;" onclick="showToast('Membuka artikel...','info')">Buka →</button>
        </div>
        <div style="display:flex;align-items:center;gap:12px;padding:12px;border:2px solid var(--border);border-radius:12px;background:var(--bg);">
          <div style="width:40px;height:40px;border-radius:10px;background:#dcfce7;display:flex;align-items:center;justify-content:center;font-size:1.1rem;">📚</div>
          <div><div style="font-size:.88rem;font-weight:700;">Ruang Belajar BioImun</div><div style="font-size:.76rem;color:var(--text-muted);">Materi interaktif dengan kuis</div></div>
          <button class="btn-secondary" style="margin-left:auto;padding:6px 14px;font-size:.78rem;" onclick="navigateTo('ruangbelajar')">Buka →</button>
        </div>
      </div>
    </div>
    <div style="margin-bottom:16px;">
      <label style="font-size:.9rem;font-weight:700;display:block;margin-bottom:8px;">📝 Rencana Belajar Kelompok:</label>
      <textarea class="textarea-field" id="org-text" placeholder="Tuliskan: pembagian tugas anggota, sumber yang akan digunakan, target waktu, dan strategi belajar kelompok Anda..." style="min-height:120px"></textarea>
    </div>
    <div style="margin-top:20px;">
      <h4 style="font-size:.95rem;font-weight:800;margin-bottom:12px;">💬 Forum Berbagi Informasi</h4>
      <div id="forum-posts-1">
        <div class="forum-post"><div class="forum-post-header"><div class="fp-avatar" style="background:linear-gradient(135deg,#f59e0b,#d97706)">K3</div><div><div class="fp-name">Kelompok 3</div><div class="fp-time">30 menit lalu</div></div></div><div class="fp-text">Kami membagi tugas: 2 orang riset tentang mekanisme virus dengue, 2 orang riset tentang sistem komplemen, 1 orang koordinator presentasi.</div><div class="fp-actions"><button class="fp-btn" onclick="likePost(this)"><i class="fas fa-thumbs-up"></i> Suka (2)</button></div></div>
      </div>
      <button class="btn-secondary" onclick="addForumPost(1)" style="margin-top:10px;padding:8px 16px;font-size:.82rem;"><i class="fas fa-plus"></i> Tambah Info</button>
    </div>
    <button class="btn-primary" style="margin-top:20px;width:100%" onclick="checkAndSubmitLKPD(1,'org-text')"><i class="fas fa-check-circle"></i> Selesaikan Tahap 2</button>
  </div>`,

  // ── Tahap 3: Penyelidikan ──
  `<div class="lkpd-content animate-in">
    <h3 style="font-size:1.1rem;font-weight:800;color:var(--primary-dark);margin-bottom:16px;">🔬 Tahap 3: Membimbing Penyelidikan</h3>
    <div class="info-box" style="margin-bottom:16px;"><strong>🎯 Tujuan:</strong> Melakukan penyelidikan mendalam dan menganalisis berbagai sumber informasi ilmiah.</div>
    <div class="card" style="margin-bottom:16px;">
      <h4 style="margin-bottom:14px;font-size:.95rem;font-weight:800;">🌐 Sumber Referensi Ilmiah</h4>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;">
        <div style="padding:14px;border:2px solid var(--border);border-radius:12px;cursor:pointer;transition:all .2s;text-align:center;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border)'"><div style="font-size:1.5rem;margin-bottom:6px;">🏛️</div><div style="font-size:.85rem;font-weight:700;">PubMed</div><div style="font-size:.75rem;color:var(--text-muted);">Jurnal biomedis</div></div>
        <div style="padding:14px;border:2px solid var(--border);border-radius:12px;cursor:pointer;transition:all .2s;text-align:center;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border)'"><div style="font-size:1.5rem;margin-bottom:6px;">🏥</div><div style="font-size:.85rem;font-weight:700;">Kemenkes RI</div><div style="font-size:.75rem;color:var(--text-muted);">Data kesehatan</div></div>
        <div style="padding:14px;border:2px solid var(--border);border-radius:12px;cursor:pointer;transition:all .2s;text-align:center;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border)'"><div style="font-size:1.5rem;margin-bottom:6px;">🔬</div><div style="font-size:.85rem;font-weight:700;">WHO</div><div style="font-size:.75rem;color:var(--text-muted);">Kesehatan global</div></div>
      </div>
    </div>
    <div style="margin-bottom:16px;">
      <label style="font-size:.9rem;font-weight:700;display:block;margin-bottom:8px;">📝 Hasil Analisis Informasi:</label>
      <textarea class="textarea-field" id="inv-text" style="min-height:140px" placeholder="Tuliskan hasil analisis dari berbagai sumber yang telah kalian temukan. Sertakan sumber (judul artikel/URL) dan temuan penting dari setiap sumber..."></textarea>
    </div>
    <div style="margin-top:20px;">
      <h4 style="font-size:.95rem;font-weight:800;margin-bottom:12px;">💬 Forum Penyelidikan Terbuka</h4>
      <div id="forum-posts-2">
        <div class="forum-post"><div class="forum-post-header"><div class="fp-avatar" style="background:linear-gradient(135deg,#0e7fb5,#0d4530)">K4</div><div><div class="fp-name">Kelompok 4</div><div class="fp-time">45 menit lalu</div></div></div><div class="fp-text">Dari jurnal PubMed, kami menemukan bahwa virus dengue menggunakan mekanisme ADE (Antibody-Dependent Enhancement) untuk justru menggunakan antibodi sebagai "kuda Troya" untuk masuk ke sel imun. Sangat menarik!</div><div class="fp-actions"><button class="fp-btn" onclick="likePost(this)"><i class="fas fa-thumbs-up"></i> Suka (7)</button></div></div>
      </div>
      <button class="btn-secondary" onclick="addForumPost(2)" style="margin-top:10px;padding:8px 16px;font-size:.82rem;"><i class="fas fa-plus"></i> Bagikan Temuan</button>
    </div>
    <button class="btn-primary" style="margin-top:20px;width:100%" onclick="checkAndSubmitLKPD(2,'inv-text')"><i class="fas fa-check-circle"></i> Selesaikan Tahap 3</button>
  </div>`,

  // ── Tahap 4: Penyajian Hasil ──
  `<div class="lkpd-content animate-in">
    <h3 style="font-size:1.1rem;font-weight:800;color:var(--primary-dark);margin-bottom:16px;">🎨 Tahap 4: Mengembangkan dan Menyajikan Hasil</h3>
    <div class="info-box" style="margin-bottom:16px;"><strong>🎯 Tujuan:</strong> Membuat dan mempresentasikan hasil penyelidikan dalam bentuk infografis atau karya kreatif.</div>
    <div style="margin-bottom:16px;">
      <label style="font-size:.9rem;font-weight:700;display:block;margin-bottom:8px;">📝 Deskripsi Infografis Kelompok:</label>
      <textarea class="textarea-field" id="pres-text" placeholder="Jelaskan isi infografis yang kalian buat: topik, konten utama, pesan yang ingin disampaikan, dan cara penyajiannya..." style="min-height:110px"></textarea>
    </div>
    <h4 style="font-size:.95rem;font-weight:800;margin-bottom:14px;">🖼️ Galeri Karya Kelompok</h4>
    <div class="gallery-grid" style="margin-bottom:20px;">
      <div class="gallery-item"><div class="gi-icon">🛡️</div><div class="gi-title">Infografis Sistem Imun</div><div class="gi-group">Kelompok 1</div></div>
      <div class="gallery-item"><div class="gi-icon">🦠</div><div class="gi-title">Mekanisme DBD vs Imun</div><div class="gi-group">Kelompok 2</div></div>
      <div class="gallery-item"><div class="gi-icon">💉</div><div class="gi-title">Jenis Vaksin Indonesia</div><div class="gi-group">Kelompok 3</div></div>
      <div class="gallery-item"><div class="gi-icon">🔬</div><div class="gi-title">Alergi & Hipersensitivitas</div><div class="gi-group">Kelompok 4</div></div>
      <div class="gallery-item" style="border-style:dashed;" onclick="showToast('Upload infografis (format teks deskripsi di atas)','info')"><div style="font-size:2rem;margin-bottom:6px">➕</div><div class="gi-title">Tambah Karya</div></div>
    </div>
    <div style="margin-top:16px;">
      <h4 style="font-size:.95rem;font-weight:800;margin-bottom:12px;">💬 Komentar & Diskusi Antar Kelompok</h4>
      <div id="forum-posts-3">
        <div class="forum-post"><div class="forum-post-header"><div class="fp-avatar">K2</div><div><div class="fp-name">Kelompok 2</div><div class="fp-time">1 jam lalu</div></div></div><div class="fp-text">Infografis Kelompok 1 sangat informatif! Kami suka bagian tentang komponen sel imun. Apakah kalian juga menjelaskan peran sel NK (Natural Killer)?</div><div class="fp-actions"><button class="fp-btn" onclick="likePost(this)"><i class="fas fa-thumbs-up"></i> Suka (4)</button></div></div>
      </div>
      <div style="margin-top:12px;">
        <textarea class="textarea-field" id="comment-text" placeholder="Berikan komentar atau pertanyaan untuk kelompok lain..." style="min-height:70px"></textarea>
        <button class="btn-secondary" style="margin-top:8px;padding:9px 18px;font-size:.85rem" onclick="addComment()"><i class="fas fa-paper-plane"></i> Kirim Komentar</button>
      </div>
    </div>
    <button class="btn-primary" style="margin-top:20px;width:100%" onclick="checkAndSubmitLKPD(3,'pres-text')"><i class="fas fa-check-circle"></i> Selesaikan Tahap 4</button>
  </div>`,

  // ── Tahap 5: Evaluasi ──
  `<div class="lkpd-content animate-in">
    <h3 style="font-size:1.1rem;font-weight:800;color:var(--primary-dark);margin-bottom:16px;">✅ Tahap 5: Menganalisis dan Mengevaluasi</h3>
    <div class="info-box" style="margin-bottom:16px;"><strong>🎯 Tujuan:</strong> Merefleksikan proses pembelajaran, mengevaluasi solusi, dan menarik kesimpulan.<br><small style="color:var(--text-muted);">📌 Catatan: Refleksi ini hanya dapat dilihat oleh guru.</small></div>
    <div style="margin-bottom:16px;">
      <label style="font-size:.9rem;font-weight:700;display:block;margin-bottom:8px;">💡 Solusi yang Ditemukan Kelompok:</label>
      <textarea class="textarea-field" id="sol-text" placeholder="Tuliskan solusi/jawaban atas rumusan masalah berdasarkan hasil penyelidikan..."></textarea>
    </div>
    <div style="margin-bottom:16px;">
      <label style="font-size:.9rem;font-weight:700;display:block;margin-bottom:8px;">📝 Kesimpulan:</label>
      <textarea class="textarea-field" id="kes-text" placeholder="Tuliskan kesimpulan dari keseluruhan proses pembelajaran PBL ini..."></textarea>
    </div>
    <div style="margin-bottom:16px;">
      <label style="font-size:.9rem;font-weight:700;display:block;margin-bottom:8px;">🔄 Evaluasi Proses Pembelajaran:</label>
      <textarea class="textarea-field" id="eval-text" placeholder="Apa yang berjalan baik? Apa yang perlu diperbaiki? Apa yang kalian pelajari? (min. 3 kalimat)" style="min-height:120px"></textarea>
    </div>
    <div style="margin-bottom:20px;">
      <label style="font-size:.9rem;font-weight:700;display:block;margin-bottom:8px;">⭐ Penilaian Diri (Self-Assessment):</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div style="padding:14px;border:2px solid var(--border);border-radius:12px;background:#fff;">
          <div style="font-size:.85rem;font-weight:700;margin-bottom:8px;">Kontribusi dalam Kelompok</div>
          <div style="display:flex;gap:6px;">${[1,2,3,4,5].map(n=>`<button onclick="rateSelf(this,${n},'kolaborasi')" style="width:32px;height:32px;border-radius:8px;border:2px solid var(--border);background:#fff;cursor:pointer;font-size:1.1rem;transition:all .2s">⭐</button>`).join('')}</div>
        </div>
        <div style="padding:14px;border:2px solid var(--border);border-radius:12px;background:#fff;">
          <div style="font-size:.85rem;font-weight:700;margin-bottom:8px;">Pemahaman Materi</div>
          <div style="display:flex;gap:6px;">${[1,2,3,4,5].map(n=>`<button onclick="rateSelf(this,${n},'pemahaman')" style="width:32px;height:32px;border-radius:8px;border:2px solid var(--border);background:#fff;cursor:pointer;font-size:1.1rem;transition:all .2s">⭐</button>`).join('')}</div>
        </div>
      </div>
    </div>
    <button class="btn-primary" style="width:100%" onclick="checkAndSubmitLKPD(4,'eval-text')"><i class="fas fa-flag-checkered"></i> Selesaikan LKPD Seluruhnya</button>
  </div>`
];

function checkAndSubmitLKPD(idx, textareaId) {
  const ta = document.getElementById(textareaId);
  if (!ta || ta.value.trim().length < 20) {
    showToast('⚠️ Isi kolom teks terlebih dahulu (minimal 20 karakter)!', 'error');
    if (ta) ta.focus();
    return;
  }
  submitLKPD(idx);
}

function addForumPost(stage) {
  openModal('Tambah Diskusi', `
    <div class="form-group"><label>Nama Kelompok</label><div class="input-wrap"><i class="fas fa-users"></i><input type="text" id="fp-group" placeholder="Kelompok..."></div></div>
    <div class="form-group" style="margin-top:14px"><label>Diskusi / Rumusan Masalah</label><textarea class="textarea-field" id="fp-text" placeholder="Tuliskan pendapat, pertanyaan, atau temuan..." style="min-height:90px"></textarea></div>
    <button class="btn-primary" onclick="postForum(${stage})" style="width:100%;margin-top:8px"><i class="fas fa-paper-plane"></i> Kirim</button>
  `);
}

function postForum(stage) {
  const g = document.getElementById('fp-group').value || 'Kelompok';
  const t = document.getElementById('fp-text').value;
  if (!t) return;
  const posts = document.getElementById('forum-posts-' + stage);
  if (posts) {
    const init = g.split(' ').map(w => w[0]).join('').toUpperCase().substring(0,2) || 'K';
    posts.innerHTML += `<div class="forum-post animate-in"><div class="forum-post-header"><div class="fp-avatar" style="background:linear-gradient(135deg,#f59e0b,#d97706)">${init}</div><div><div class="fp-name">${g}</div><div class="fp-time">Baru saja</div></div></div><div class="fp-text">${t}</div><div class="fp-actions"><button class="fp-btn" onclick="likePost(this)"><i class="fas fa-thumbs-up"></i> Suka (0)</button></div></div>`;
  }
  closeModal();
  showToast('✅ Diskusi berhasil ditambahkan!', 'success');
}

function likePost(btn) {
  const txt   = btn.innerHTML;
  const match = txt.match(/\((\d+)\)/);
  if (match) btn.innerHTML = `<i class="fas fa-thumbs-up"></i> Suka (${parseInt(match[1])+1})`;
}

function addComment() {
  const ta = document.getElementById('comment-text');
  if (!ta || !ta.value.trim()) { showToast('Tulis komentar terlebih dahulu.','error'); return; }
  const posts = document.getElementById('forum-posts-3');
  if (posts) {
    posts.innerHTML += `<div class="forum-post animate-in"><div class="forum-post-header"><div class="fp-avatar">${currentUser.name[0]}</div><div><div class="fp-name">${currentUser.name}</div><div class="fp-time">Baru saja</div></div></div><div class="fp-text">${ta.value}</div><div class="fp-actions"><button class="fp-btn" onclick="likePost(this)"><i class="fas fa-thumbs-up"></i> Suka (0)</button></div></div>`;
  }
  ta.value = '';
  showToast('✅ Komentar terkirim!', 'success');
}

function rateSelf(btn, n, cat) {
  const parent = btn.parentElement;
  parent.querySelectorAll('button').forEach((b, i) => b.style.background = i < n ? '#fef3c7' : '#fff');
  showToast(`Rating ${cat}: ${n}/5 disimpan!`, 'success');
}

/* ========================= DRILL SOAL ========================= */
const ALL_QUESTIONS = [
  /* ── BLOK 1: Sistem Pertahanan Tubuh (Konsep Dasar) ── */
  { q:'Sel darah putih yang berperan utama dalam imunitas adaptif adalah?', opts:['Eritrosit','Trombosit','Limfosit','Basofil'], ans:2, penj:'Limfosit (Sel B dan Sel T) adalah sel utama dalam respons imun spesifik/adaptif. Sel B menghasilkan antibodi, Sel T berperan dalam imunitas seluler.' },
  { q:'Antibodi termasuk dalam golongan protein?', opts:['Enzim','Hormon','Imunoglobulin','Lipoprotein'], ans:2, penj:'Antibodi adalah protein imunoglobulin yang diproduksi oleh sel plasma (turunan sel B yang teraktivasi oleh antigen).' },
  { q:'Sel NK (Natural Killer) berfungsi untuk?', opts:['Memproduksi antibodi','Membunuh sel tumor dan sel terinfeksi virus','Mengaktifkan sel B','Menghasilkan komplemen'], ans:1, penj:'Sel NK membunuh sel yang terinfeksi virus dan sel tumor tanpa memerlukan pengenalan MHC spesifik, sebagai bagian imunitas bawaan.' },
  { q:'Organ limfoid PRIMER tempat pematangan sel T adalah?', opts:['Limpa','Kelenjar getah bening','Timus','Amandel'], ans:2, penj:'Timus adalah organ limfoid primer. Sel T diproduksi di sumsum tulang lalu bermigrasi ke timus untuk diseleksi dan dimatangkan. Nama "T" berasal dari thymus.' },
  { q:'Kulit merupakan komponen pertahanan tubuh lini?', opts:['Ketiga — imunitas adaptif','Kedua — fagositosis','Pertama — penghalang fisik nonspesifik','Keempat — memori imun'], ans:2, penj:'Kulit adalah penghalang fisik lini pertama (nonspesifik). Bersama selaput lendir, silia, dan sekret asam, kulit mencegah patogen masuk ke tubuh.' },
  { q:'Komplemen adalah?', opts:['Jenis antibodi di plasma','Sistem protein plasma yang membantu imunitas melalui lisis dan opsonisasi','Jenis limfosit khusus','Organ limfoid sekunder'], ans:1, penj:'Sistem komplemen adalah serangkaian protein plasma yang bekerja bersama antibodi untuk menghancurkan patogen melalui pembentukan pori membran (MAC), opsonisasi, dan pengaktifan inflamasi.' },
  { q:'Antigen adalah molekul yang?', opts:['Diproduksi tubuh untuk melawan infeksi','Asing, memicu respons imun, dan berikatan dengan antibodi','Sel darah putih yang menyerang patogen','Protein pelindung permukaan sel tubuh sendiri'], ans:1, penj:'Antigen (antibody generator) adalah molekul asing — biasanya protein atau polisakarida — yang dapat memicu respons imun spesifik dan berikatan secara spesifik dengan antibodi atau reseptor sel T.' },
  { q:'Imunoglobulin manakah yang PALING BANYAK dalam serum darah manusia?', opts:['IgA','IgM','IgG','IgE'], ans:2, penj:'IgG adalah imunoglobulin paling melimpah dalam serum (75-80% total antibodi). IgG juga satu-satunya yang dapat melewati plasenta untuk memberikan imunitas pasif pada janin.' },

  /* ── BLOK 2: Pertahanan Nonspesifik & Mekanisme ── */
  { q:'Demam merupakan mekanisme pertahanan tubuh yang MENGUNTUNGKAN karena?', opts:['Menurunkan produksi antibodi agar imun tidak berlebihan','Menghambat pertumbuhan banyak patogen dan meningkatkan aktivitas fagosit','Mengaktifkan reaksi alergi yang membersihkan patogen','Meningkatkan pH darah sehingga patogen mati'], ans:1, penj:'Suhu tinggi (38–39°C) menghambat enzim pertumbuhan bakteri patogen, sekaligus meningkatkan kecepatan migrasi dan aktivitas fagosit. Namun demam >40°C sudah berbahaya bagi sel tubuh sendiri.' },
  { q:'Interferon berbeda dari antibodi karena interferon?', opts:['Diproduksi oleh sel plasma dan membunuh virus langsung','Diproduksi sel terinfeksi dan menghambat replikasi virus di sel sekitar','Merupakan bagian dari sistem komplemen','Hanya aktif pada infeksi bakteri'], ans:1, penj:'Interferon adalah sinyal kimiawi yang dilepas sel terinfeksi virus untuk memperingatkan sel tetangga agar meningkatkan pertahanan antivirus. Interferon tidak membunuh virus langsung melainkan mencegah infeksi menyebar ke sel sehat.' },
  { q:'Proses di mana makrofag menelan dan mencerna bakteri disebut?', opts:['Opsonisasi','Fagositosis','Eksositosis','Transduksi'], ans:1, penj:'Fagositosis (dari bahasa Yunani: phagein = memakan) adalah proses sel fagosit seperti makrofag dan neutrofil menelan partikel asing atau patogen ke dalam fagosom, lalu mencernanya dengan enzim lisosomal.' },
  { q:'Mengapa NEUTROFIL disebut sebagai "pasukan pertama" dalam melawan infeksi bakteri?', opts:['Karena neutrofil memproduksi antibodi paling cepat','Karena neutrofil adalah leukosit paling banyak dan paling cepat bermigrasi ke lokasi infeksi','Karena neutrofil mengaktifkan sel B lebih dulu dari sel lain','Karena neutrofil hidup paling lama di antara semua leukosit'], ans:1, penj:'Neutrofil adalah leukosit terbanyak (60-70% leukosit darah) dan sel pertama yang bermigrasi (dalam hitungan menit-jam) ke jaringan yang terinfeksi melalui kemotaksis. Neutrofil melakukan fagositosis intensif dan melepas zat antimikroba.' },
  { q:'Reaksi inflamasi akut ditandai oleh kemerahan, panas, bengkak, dan nyeri. Penyebab KEMERAHAN dan PANAS pada area infeksi adalah?', opts:['Akumulasi sel T sitotoksik yang panas','Vasodilatasi dan peningkatan aliran darah ke area tersebut','Degranulasi sel mast yang melepas panas langsung','Aktivasi sel B lokal yang memproduksi panas'], ans:1, penj:'Mediator inflamasi seperti histamin dan prostaglandin menyebabkan vasodilatasi (pelebaran pembuluh darah) dan peningkatan aliran darah ke area cedera. Lebih banyak darah panas dari tubuh inti mengalir ke jaringan perifer → kemerahan dan perasaan hangat.' },
  { q:'Seorang penderita diare diberi larutan rehidrasi yang mengandung elektrolit. Di saluran cerna, terdapat lisozim dalam air liur dan mukus. Fungsi lisozim dalam konteks imun adalah?', opts:['Menghasilkan sel T di usus','Menghancurkan dinding sel bakteri (peptidoglikan) sehingga bakteri lisis','Menetralisir toksin virus di lambung','Merangsang sel B memproduksi IgA'], ans:1, penj:'Lisozim adalah enzim yang terdapat di air liur, air mata, mukus, dan sekret lainnya. Lisozim memutus ikatan β-1,4-glikosidik pada peptidoglikan dinding sel bakteri gram positif, menyebabkan bakteri lisis. Ini adalah komponen kimia pertahanan nonspesifik lini pertama.' },

  /* ── BLOK 3: Pertahanan Spesifik & Imunitas Adaptif ── */
  { q:'MHC (Major Histocompatibility Complex) berfungsi untuk?', opts:['Memproduksi antibodi secara langsung','Mempresentasikan fragmen antigen kepada limfosit T','Membunuh sel terinfeksi secara langsung','Mengaktifkan sistem komplemen'], ans:1, penj:'MHC adalah protein permukaan sel yang bertugas "menampilkan" fragmen peptida antigen kepada sel T. MHC kelas I mempresentasikan antigen intraseluler ke sel T sitotoksik (CD8+); MHC kelas II pada APC mempresentasikan antigen ekstraseluler ke sel T helper (CD4+).' },
  { q:'Sel plasma yang memproduksi antibodi berasal dari diferensiasi?', opts:['Sel T sitotoksik yang teraktivasi','Sel B yang teraktivasi oleh antigen dan bantuan sel T helper','Makrofag yang telah memfagositosis antigen','Sel NK yang mengenali sel tumor'], ans:1, penj:'Sel B naif yang bertemu antigen dan menerima sinyal ko-stimulasi dari sel T helper akan berproliferasi dan berdiferensiasi menjadi sel plasma (yang aktif memproduksi antibodi) dan sel B memori (untuk proteksi jangka panjang).' },
  { q:'Pada respons imun sekunder (paparan antigen kedua), antibodi diproduksi LEBIH CEPAT dan LEBIH BANYAK karena?', opts:['Antigen kedua lebih lemah sehingga mudah dikalahkan','Sel B memori langsung berproliferasi menjadi banyak sel plasma tanpa perlu aktivasi awal','Sistem komplemen sudah terbentuk sepenuhnya','Sel NK sudah mengenali antigen tersebut'], ans:1, penj:'Sel B memori yang terbentuk dari paparan pertama dapat hidup bertahun-tahun. Saat antigen sama muncul kembali, sel B memori langsung berproliferasi masif dan berdiferensiasi cepat menjadi banyak sel plasma — menghasilkan antibodi dalam jumlah besar hanya dalam 1-3 hari (vs 10-17 hari pada respons primer).' },
  { q:'Mengapa sel T sitotoksik hanya membunuh sel yang mengekspresikan MHC kelas I, bukan sel yang tidak punya MHC?', opts:['Karena sel tanpa MHC I adalah sel imun yang tidak perlu dihancurkan','Karena sel T sitotoksik memiliki reseptor yang spesifik mengenali kompleks MHC I + peptida antigen','Karena sel tanpa MHC I dilindungi oleh sel NK','Karena reseptor sel T hanya bekerja pada suhu tinggi'], ans:1, penj:'Reseptor sel T (TCR) didesain untuk mengenali kompleks antigen-MHC I secara spesifik. Sel terinfeksi mempresentasikan peptida virus di MHC I → TCR mengenali ini sebagai sinyal untuk membunuh. Sel tanpa MHC I (misalnya sel tumor yang menghilangkan MHC I) justru diserang oleh sel NK — sistem berlapis yang saling melengkapi.' },
  { q:'Proses OPSONISASI meningkatkan efisiensi fagositosis dengan cara?', opts:['Meningkatkan suhu lokal sehingga fagosit lebih aktif','Melapisi patogen dengan antibodi (IgG) atau komplemen yang dikenali reseptor di permukaan fagosit','Memperbesar ukuran bakteri sehingga fagosit lebih mudah menemukan targetnya','Mengaktifkan sel mast untuk melepas histamin'], ans:1, penj:'Opsonisasi adalah pelapisan patogen dengan antibodi (IgG) atau fragmen komplemen (C3b). Fagosit memiliki reseptor Fc (untuk IgG) dan reseptor komplemen di permukaannya. Patogen yang ter-opsonisasi 100-1000x lebih mudah difagositosis.' },

  /* ── BLOK 4: Jenis Imunitas ── */
  { q:'Vaksin BCG diberikan pada bayi untuk mencegah penyakit?', opts:['Polio','Tuberkulosis','Campak','Hepatitis B'], ans:1, penj:'BCG (Bacillus Calmette-Guérin) adalah vaksin hidup yang dilemahkan untuk mencegah penyakit tuberkulosis (TBC) yang disebabkan Mycobacterium tuberculosis, terutama bentuk berat seperti TB meningitis pada anak.' },
  { q:'Imunisasi pasif alami pada bayi terjadi melalui?', opts:['Vaksinasi saat lahir','Antibodi (IgG) melalui plasenta dan IgA melalui ASI','Infeksi ringan yang disengaja','Suntikan serum dari ibu'], ans:1, penj:'Bayi mendapatkan imunitas pasif alami melalui dua jalur: (1) IgG dari ibu melewati plasenta selama kehamilan trimester ketiga; (2) IgA sekretori dari ASI/kolostrum melindungi saluran cerna bayi.' },
  { q:'Seseorang yang digigit anjing gila segera diberi VAR (Vaksin Anti Rabies) dan serum anti-rabies sekaligus. Mengapa keduanya diberikan bersamaan?', opts:['VAR merangsang tubuh membentuk antibodi (aktif), serum memberikan antibodi segera (pasif) untuk proteksi jangka pendek selama imunitas aktif terbentuk','VAR dan serum keduanya memberikan antibodi siap pakai','VAR meningkatkan fagositosis; serum menonaktifkan virus','Keduanya bekerja sebagai vaksin untuk jenis virus berbeda'], ans:0, penj:'Virus rabies bekerja sangat cepat. Serum anti-rabies (imunitas pasif buatan) memberikan antibodi siap pakai yang langsung menetralisir virus. Sementara itu VAR merangsang tubuh membentuk imunitas aktif sendiri. Imunitas pasif dari serum habis dalam beberapa minggu, namun imunitas aktif dari VAR sudah terbentuk dan akan bertahan lama.' },
  { q:'Herd immunity (kekebalan kelompok) dapat melindungi individu yang TIDAK DAPAT DIVAKSIN, seperti bayi baru lahir. Mekanisme perlindungan ini adalah?', opts:['Vaksin yang diberikan pada orang lain menular ke bayi','Karena sebagian besar populasi kebal, rantai penularan terputus sehingga patogen tidak mencapai individu rentan','Bayi menerima vaksin secara langsung dari ibu melalui plasenta','Sistem imun bawaan bayi diperkuat oleh vaksin populasi'], ans:1, penj:'Ketika cukup banyak anggota komunitas kebal (melalui vaksin atau infeksi alami), setiap individu terinfeksi rata-rata menularkan ke <1 orang — artinya wabah tidak dapat berkelanjutan. Patogen tidak dapat menemukan inang rentan dalam jumlah cukup untuk menyebar, sehingga individu yang tidak kebal pun terlindungi secara tidak langsung.' },
  { q:'Imunitas buatan aktif dan buatan pasif berbeda karena?', opts:['Aktif buatan menggunakan serum antibodi; pasif buatan menggunakan vaksin','Aktif buatan (vaksin) merangsang tubuh membentuk antibodi dan sel memori sendiri; pasif buatan (serum) memberikan antibodi jadi dari luar','Keduanya menghasilkan sel memori yang sama kuatnya','Aktif buatan hanya melindungi selama 1 minggu'], ans:1, penj:'Imunitas aktif buatan (vaksinasi): antigen dimasukkan → tubuh memproduksi antibodi dan sel memori → perlindungan jangka panjang. Imunitas pasif buatan (serum/antitoksin): antibodi dari luar diberikan → tidak ada pembentukan sel memori → perlindungan singkat (beberapa minggu) namun segera efektif.' },

  /* ── BLOK 5: Gangguan Sistem Imun ── */
  { q:'Penyakit yang disebabkan sistem imun menyerang sel tubuh sendiri disebut?', opts:['Alergi','Imunodefisiensi','Autoimun','Anafilaksis'], ans:2, penj:'Penyakit autoimun terjadi ketika mekanisme toleransi imun gagal dan sistem imun salah mengenali antigen "self" sebagai asing, lalu melancarkan serangan terhadap jaringan tubuh sendiri.' },
  { q:'HIV menyerang sel T helper secara spesifik. Konsekuensi jangka panjang yang paling berbahaya adalah?', opts:['Peningkatan produksi IgE sehingga alergi makin parah','Kolapsnya imunitas adaptif karena sel T helper diperlukan untuk mengaktifkan sel B dan sel T sitotoksik','Peningkatan jumlah sel NK yang tidak terkontrol','Sumsum tulang berhenti memproduksi semua sel darah'], ans:1, penj:'Sel T helper (CD4+) adalah "komando" sistem imun adaptif. Tanpanya, sel B tidak dapat optimal memproduksi antibodi (imunitas humoral turun) dan sel T sitotoksik tidak mendapat sinyal aktivasi (imunitas seluler turun). Individu menjadi rentan terhadap infeksi oportunistik dan kanker tertentu — inilah kondisi AIDS.' },
  { q:'Penderita alergi serbuk bunga mengalami bersin dan mata berair saat musim semi. Imunoglobulin yang paling berperan dalam reaksi ini adalah?', opts:['IgG','IgA','IgM','IgE'], ans:3, penj:'Alergi tipe I (hipersensitivitas cepat) dimediasi oleh IgE. IgE diproduksi saat pertama kali terpapar alergen dan menempel pada sel mast. Paparan berikutnya: alergen berikatan dengan IgE di sel mast → degranulasi → histamin menyebabkan bersin, gatal, dan mata berair.' },
  { q:'Mengapa penderita penyakit autoimun seperti Rheumatoid Arthritis sering diberi obat yang MENEKAN sistem imun?', opts:['Agar sistem imun bisa beristirahat dan pulih','Untuk menghentikan serangan sistem imun terhadap jaringan sendi yang dikenali keliru sebagai asing','Untuk meningkatkan produksi sel B agar lebih banyak antibodi','Untuk mengaktifkan toleransi imun dengan cara meningkatkan sel T'], ans:1, penj:'Pada Rheumatoid Arthritis, sistem imun menghasilkan autoantibodi yang menyerang sinovium (lapisan sendi). Obat imunosupresan seperti metotreksat mengurangi aktivitas sel imun, sehingga serangan terhadap sendi berkurang. Risikonya: pasien menjadi lebih rentan terhadap infeksi.' },
  { q:'Analisis data KLB Campak Sumenep 2025: 205 kasus terkonfirmasi dari 2.139 suspek, mayoritas pada anak tidak diimunisasi. Hipotesis ilmiah yang paling didukung data ini adalah?', opts:['Vaksin campak tidak efektif pada anak di bawah 5 tahun','Cakupan imunisasi yang rendah menyebabkan terbentuknya kelompok rentan yang cukup besar untuk mempertahankan penularan virus campak','Campak hanya menular melalui kontak langsung, bukan melalui udara','Sistem imun anak usia 1-4 tahun secara alami tidak mampu merespons vaksin campak'], ans:1, penj:'Data menunjukkan mayoritas kasus terjadi pada anak tidak diimunisasi. Dengan cakupan imunisasi hanya 82% (jauh di bawah threshold herd immunity 95% untuk campak yang sangat menular dengan R₀=12-18), terdapat populasi rentan yang cukup besar untuk mempertahankan rantai penularan. Ini mendukung hipotesis bahwa rendahnya cakupan imunisasi adalah faktor utama KLB.' },

  /* ── BLOK 6: Vaksin, Teknologi, dan Aplikasi Klinis ── */
  { q:'Prinsip kerja vaksin mRNA (seperti vaksin COVID-19 Pfizer/Moderna) berbeda dari vaksin konvensional karena?', opts:['Vaksin mRNA langsung menyuntikkan antibodi','Vaksin mRNA memasukkan instruksi genetik agar sel tubuh sendiri memproduksi antigen untuk merangsang imun','Vaksin mRNA menggunakan virus hidup yang dilemahkan','Vaksin mRNA hanya merangsang imunitas bawaan tanpa membentuk sel memori'], ans:1, penj:'Vaksin mRNA tidak mengandung antigen protein langsung, melainkan kode genetik (mRNA) yang menginstrusikan sel otot untuk memproduksi protein spike virus. Protein ini kemudian dikenali sistem imun dan memicu respons imun adaptif (termasuk sel memori). mRNA sendiri tidak masuk ke nukleus dan tidak mengubah DNA.' },
  { q:'Sel dendritik disebut sebagai "sel penyaji antigen (APC) profesional" karena?', opts:['Dapat memproduksi antibodi dalam jumlah besar','Paling efisien dalam memfagositosis antigen, memprosesnya, dan mempresentasikannya ke sel T naif untuk mengawali respons imun adaptif','Dapat langsung membunuh sel tumor tanpa bantuan sel T','Adalah sel pertama yang bermigrasi ke lokasi infeksi'], ans:1, penj:'Sel dendritik adalah APC paling poten. Setelah memfagositosis patogen di jaringan perifer, sel dendritik bermigrasi ke kelenjar getah bening, memproses antigen, dan mempresentasikannya ke sel T naif melalui MHC II. Inilah yang mengawali respons imun adaptif spesifik terhadap patogen tersebut.' },
  { q:'Tes ELISA (Enzyme-Linked Immunosorbent Assay) untuk mendeteksi HIV dalam darah menggunakan prinsip?', opts:['Fagositosis oleh makrofag yang terdeteksi secara visual','Ikatan spesifik antara antibodi anti-HIV dan antigen HIV dalam sampel darah','Pengukuran suhu tubuh yang meningkat akibat infeksi','Penghitungan jumlah sel T CD4+ secara langsung'], ans:1, penj:'ELISA memanfaatkan spesifisitas ikatan antigen-antibodi. Antigen HIV dilapisi di permukaan plat, lalu sampel darah pasien ditambahkan. Jika pasien memiliki antibodi anti-HIV, akan terjadi ikatan. Antibodi sekunder berlabel enzim kemudian mendeteksi ikatan ini menghasilkan perubahan warna yang dapat diukur.' },
  { q:'Pada terapi kanker dengan CAR-T cell, sel T pasien dimodifikasi secara genetik untuk mengenali protein spesifik di permukaan sel kanker. Prinsip imunologi yang menjadi dasar terapi ini adalah?', opts:['Peningkatan produksi IgE untuk membunuh sel kanker','Penggunaan spesifisitas sel T sitotoksik untuk secara selektif membunuh sel yang mengekspresikan antigen target tertentu','Stimulasi produksi interferon secara masif','Transplantasi sumsum tulang untuk mengganti sel imun yang rusak'], ans:1, penj:'CAR-T (Chimeric Antigen Receptor T-cell) therapy merekayasa sel T pasien sendiri agar memiliki reseptor chimeric yang mengenali antigen spesifik di permukaan sel kanker (misal CD19 pada leukemia). Sel T termodifikasi ini kemudian membunuh sel kanker secara spesifik seperti sel T sitotoksik normal, namun dengan target yang telah ditentukan.' },
  { q:'Mengapa seseorang yang mendapat terapi imunosupresan jangka panjang (misalnya paska transplantasi organ) dianjurkan menghindari kerumunan dan segera melapor jika demam?', opts:['Karena obat imunosupresan menyebabkan demam palsu','Karena sistem imun yang ditekan tidak dapat merespons infeksi secara normal, sehingga infeksi ringan dapat berkembang menjadi serius','Karena terapi imunosupresan meningkatkan risiko alergi di kerumunan','Karena demam menandakan penolakan organ yang berhasil dicegah'], ans:1, penj:'Obat imunosupresan menekan aktivitas sel T (dan secara tidak langsung sel B), yang diperlukan untuk menolak organ donor. Namun efek sampingnya: sistem imun secara umum melemah dan tidak mampu merespons infeksi dengan cukup kuat. Infeksi yang pada orang sehat hanya menyebabkan gejala ringan dapat berkembang menjadi kondisi mengancam jiwa pada pasien imunosupresan.' },
  /* ── BLOK 7: Analisis & Evaluasi Lanjutan (HOTS) ── */
  { q:'Seorang siswa mengklaim bahwa "antibodi yang diterima dari vaksin langsung melindungi tubuh." Analisis TEPAT terhadap pernyataan ini adalah?', opts:['Benar, vaksin memang mengandung antibodi siap pakai','Salah; vaksin mengandung antigen yang merangsang tubuh memproduksi antibodi sendiri','Benar untuk vaksin mRNA saja','Salah; vaksin hanya merangsang imunitas bawaan tanpa antibodi'], ans:1, penj:'Vaksin berisi antigen (bukan antibodi). Antigen merangsang sistem imun adaptif membentuk antibodi dan sel memori sendiri. Serum/antitoksin berisi antibodi jadi — itulah imunitas pasif buatan, berbeda dari vaksin.' },
  { q:'Dua pasien mendapat infeksi flu identik. Pasien A sembuh dalam 3 hari; Pasien B baru sembuh setelah 10 hari. Faktor paling mungkin yang membedakan adalah?', opts:['Pasien A punya lebih banyak eritrosit','Pasien A pernah terinfeksi/divaksin flu strain serupa sehingga punya sel memori','Pasien B kekurangan trombosit','Pasien A punya lebih banyak komplemen'], ans:1, penj:'Sel memori dari infeksi/vaksinasi sebelumnya memungkinkan respons sekunder jauh lebih cepat. Pasien A dengan sel memori dapat mengeliminasi virus sebelum berkembang banyak, sedangkan Pasien B tanpa sel memori harus membangun respons primer dari awal (7-14 hari).' },
  { q:'Bayi prematur lahir usia 28 minggu lebih rentan infeksi dibanding bayi cukup bulan. Penjelasan imunologis yang paling tepat adalah?', opts:['Bayi prematur tidak memiliki leukosit','Transfer IgG maternal melalui plasenta paling aktif di trimester ketiga; bayi prematur menerima lebih sedikit antibodi ibu','Timus bayi prematur belum terbentuk sama sekali','Bayi prematur tidak dapat memproduksi interferon'], ans:1, penj:'Transfer IgG ibu ke janin berlangsung aktif terutama pada trimester ketiga (minggu 32-40). Bayi prematur yang lahir sebelum periode ini mendapat jauh lebih sedikit antibodi protektif dari ibu sehingga rentan terhadap infeksi hingga sistem imunnya sendiri cukup matang.' },
  { q:'Mengapa vaksin influenza perlu diperbarui setiap tahun, berbeda dengan vaksin campak yang sekali seumur hidup?', opts:['Virus influenza lebih berbahaya dari virus campak','Virus influenza bermutasi sangat cepat (antigenic drift/shift) sehingga antigen permukaannya berubah tiap tahun, sedangkan virus campak sangat stabil secara antigen','Sistem imun melupakan antigen influenza setiap tahun','Vaksin influenza tidak membentuk sel memori'], ans:1, penj:'Virus influenza memiliki RNA polimerase error-prone menghasilkan mutasi terus-menerus pada hemagglutinin (H) dan neuraminidase (N) — antigenic drift. Perubahan besar (antigenic shift) terjadi saat segmen gen berbagai strain bergabung. Antibodi dari vaksin tahun lalu mungkin tidak mengenali strain baru.' },
  { q:'Bayi penderita X-linked agammaglobulinemia (XLA) tidak dapat mengembangkan sel B. Jenis infeksi yang paling sering dialaminya adalah?', opts:['Infeksi virus intraseluler karena sel T tidak ada','Infeksi bakteri ekstraseluler berulang karena tidak ada antibodi untuk opsonisasi','Infeksi jamur karena sel NK tidak aktif','Infeksi parasit berat karena komplemen tidak ada'], ans:1, penj:'Tanpa sel B, tidak ada produksi antibodi. Antibodi sangat penting untuk opsonisasi bakteri dan aktivasi komplemen. Bakteri ekstraseluler (Streptococcus, Haemophilus) menjadi patogen utama. Imunitas seluler (sel T) relatif intact, sehingga infeksi virus terkontrol lebih baik.' },
  { q:'Data menunjukkan setelah vaksinasi massal campak, kejadian pneumonia anak turun drastis. Penjelasan imunologis yang paling tepat adalah?', opts:['Vaksin campak mengandung antibodi pneumonia','Campak menyebabkan measles immune amnesia — menghapus memori imun yang ada; vaksinasi mencegah hal ini','Vaksin campak meningkatkan imunitas bawaan permanen','Pneumonia menurun karena sanitasi bersamaan membaik'], ans:1, penj:'Infeksi campak menghapus 20-70% repertoir sel memori imun yang sudah ada selama 2-3 tahun (measles immune amnesia). Penyintas campak menjadi rentan penyakit lain yang sudah dikebal, termasuk pneumonia. Vaksinasi mencegah infeksi campak dan mencegah penghapusan memori imun ini.' },
  { q:'Mengapa anafilaksis terjadi dalam hitungan menit (bukan jam) setelah paparan alergen pada individu tersensitisasi?', opts:['Alergen langsung merusak jaringan secara kimia','IgE yang sudah terikat di sel mast langsung memicu degranulasi histamin tanpa perlu sintesis antibodi baru','Sel T sitotoksik sangat cepat mengenali alergen','Sistem komplemen langsung teraktivasi oleh alergen'], ans:1, penj:'Pada individu tersensitisasi, IgE spesifik sudah menempel pada sel mast. Saat alergen berikatan dengan IgE ini, sel mast langsung melepas mediator tersimpan (histamin) dalam hitungan detik-menit. Tidak ada fase lag untuk sintesis antibodi baru.' },
  { q:'Sel T regulator (Treg) memiliki fungsi utama dalam sistem imun, yaitu?', opts:['Membunuh sel tumor lebih efisien dari sel T sitotoksik','Menekan aktivitas sel imun lain untuk mencegah respons imun berlebihan dan autoimunitas','Menghasilkan interferon dalam jumlah besar untuk melawan virus','Mengaktifkan sel B memproduksi lebih banyak IgE'], ans:1, penj:'Sel T regulator (CD4+CD25+FoxP3+) adalah "rem" sistem imun. Mereka menekan aktivasi berlebihan sel T effektor dan sel B melalui sitokin inhibitorik (IL-10, TGF-β). Treg sangat penting mencegah autoimunitas dan mempertahankan toleransi terhadap antigen diri sendiri.' },
  { q:'Dalam transfer pasif, serum tikus yang pernah terinfeksi bakteri X dipindahkan ke tikus naif yang kemudian ditantang bakteri X. Tikus naif bertahan lebih lama. Kesimpulan yang paling didukung adalah?', opts:['Sel T memori dari tikus pertama berpindah melalui serum','Antibodi spesifik dalam serum memberikan proteksi sementara (pasif) pada tikus kedua','Makrofag dalam serum menghancurkan bakteri X','Faktor genetik berpindah melalui serum'], ans:1, penj:'Eksperimen transfer pasif klasik mendemonstrasikan imunitas humoral. Serum berisi antibodi (bukan sel). Antibodi anti-bakteri X dari tikus tersensitisasi berpindah memberikan proteksi sementara. Karena tidak ada sel memori yang berpindah, perlindungan akan hilang saat antibodi habis.' },
  { q:'Checkpoint inhibitor anti-PD-1 (seperti pembrolizumab) digunakan dalam terapi kanker karena?', opts:['Langsung membunuh sel kanker dengan toksin','Memblok sinyal PD-1/PD-L1 yang menghambat sel T, sehingga sel T sitotoksik dapat kembali menyerang sel kanker','Merangsang produksi antibodi monoklonal','Meningkatkan interferon gamma secara langsung'], ans:1, penj:'Sel kanker sering mengekspresikan PD-L1 yang berikatan dengan PD-1 di sel T, mengirim sinyal "jangan serang aku." Anti-PD-1 memblok interaksi ini, membebaskan sel T dari inhibisi sehingga dapat mengenali dan membunuh sel kanker kembali.' },
  { q:'Vaksin tidak efektif diberikan saat pasien menjalani kemoterapi intensif karena?', opts:['Kemoterapi menghancurkan antigen dalam vaksin','Kemoterapi menekan proliferasi limfosit yang diperlukan untuk membentuk respons imun dan sel memori terhadap vaksin','Vaksin mempercepat pertumbuhan sel kanker','Kemoterapi meningkatkan suhu tubuh merusak antigen vaksin'], ans:1, penj:'Kemoterapi menghentikan pembelahan sel cepat (sel kanker dan limfosit). Limfosit perlu berproliferasi masif untuk membentuk imunitas terhadap vaksin. Kemoterapi menekan kapasitas proliferasi ini sehingga respons imun terhadap vaksin sangat lemah.' },
  { q:'Pada KLB Campak Sumenep 2025, dari 2.139 suspek hanya 205 terkonfirmasi lab. Implikasi metodologi paling tepat untuk respons kesehatan masyarakat adalah?', opts:['Hanya 205 yang perlu ditangani','Kasus suspek jauh lebih banyak menunjukkan perlunya investigasi aktif; menunggu konfirmasi lab sebelum bertindak akan memperburuk wabah','Data menunjukkan tes lab tidak akurat','Campak tidak seberbahaya yang dilaporkan'], ans:1, penj:'Rasio suspek:konfirmasi tinggi (10:1) mencerminkan keterbatasan kapasitas tes. Dalam KLB, kasus suspek bergejala klinis campak tetap diperlakukan sebagai kasus dan diisolasi sambil menunggu konfirmasi. Menunggu konfirmasi sebelum isolasi memungkinkan penularan berlanjut.' },
  { q:'Atlet yang menyuntikkan darah orang lain (doping darah) berisiko mengalami reaksi hemolitik karena?', opts:['Tubuh memproduksi terlalu banyak antibodi','Sel T mengenali eritrosit donor sebagai asing berdasarkan antigen golongan darah, memicu respons imun hemolitik','Sel NK menghancurkan semua eritrosit baru','Eritrosit tidak memiliki MHC sehingga langsung dihancurkan'], ans:1, penj:'Eritrosit memiliki antigen permukaan (ABO, Rh). Jika darah donor tidak kompatibel, antibodi penerima bereaksi dengan antigen eritrosit donor, mengaktifkan komplemen, dan menyebabkan hemolisis — reaksi transfusi hemolitik yang mengancam jiwa.' },
  { q:'Pasien HIV+ dengan CD4+ 180 sel/μL dimulai terapi ARV. Alasan medis yang paling tepat adalah?', opts:['CD4 rendah menandakan pasien tidak menular lagi','CD4+ <200 menandakan AIDS dimulai; imunitas tidak cukup kuat tanpa intervensi untuk mencegah infeksi oportunistik','ARV meningkatkan sel B untuk memproduksi antibodi','CD4 rendah berarti sel B terlalu aktif perlu ditekan'], ans:1, penj:'Jumlah CD4+ <200 sel/μL mendefinisikan AIDS menurut WHO. Pada level ini risiko infeksi oportunistik (PCP, Toxoplasma, CMV) sangat tinggi karena imunitas seluler dan humoral terganggu berat. ARV memblok replikasi HIV memungkinkan pemulihan sel CD4+.' },
  { q:'Terapi CAR-T cell merekayasa sel T pasien untuk mengenali antigen spesifik di sel kanker. Prinsip imunologi yang menjadi dasarnya adalah?', opts:['Peningkatan produksi IgE untuk sel kanker','Spesifisitas sel T sitotoksik untuk selektif membunuh sel yang mengekspresikan antigen target tertentu','Stimulasi produksi interferon masif','Transplantasi sumsum tulang untuk mengganti sel imun'], ans:1, penj:'CAR-T merekayasa sel T pasien dengan reseptor chimeric yang mengenali antigen spesifik kanker (misal CD19 pada leukemia). Sel T termodifikasi membunuh sel kanker secara spesifik seperti sel T sitotoksik normal, namun dengan target yang telah direkayasa secara genetik.' },
  { q:'Penderita Myasthenia Gravis memiliki autoantibodi yang menyerang reseptor asetilkolin di neuromuscular junction. Akibatnya penderita mengalami kelemahan otot progresif. Analisis yang paling tepat adalah?', opts:['Ini adalah contoh imunodefisiensi karena antibodi tidak bekerja pada target yang tepat','Ini adalah contoh autoimun tipe II (antibodi-mediated cytotoxicity) di mana antibodi menyerang antigen permukaan sel target','Ini adalah contoh alergi tipe I yang melibatkan IgE','Ini adalah contoh infeksi bakteri yang menyerang otot'], ans:1, penj:'Myasthenia Gravis adalah penyakit autoimun tipe II. Autoantibodi IgG menyerang reseptor asetilkolin (AChR) di neuromuscular junction — menghambat transmisi sinyal saraf ke otot. Ini menyebabkan kelemahan otot yang memburuk dengan aktivitas. Autoimun tipe II didefinisikan oleh antibodi yang menyerang antigen permukaan sel atau matriks ekstraseluler.' }
];

function changeDrillNum(delta) {
  drillNum = Math.max(5, Math.min(50, drillNum + delta));
  const dispEl = document.getElementById('drill-num-display');
  if (dispEl) dispEl.textContent = drillNum;
}

function startDrill() {
  drillQuestions = [...ALL_QUESTIONS].sort(() => Math.random() - .5).slice(0, drillNum);
  drillIdx     = 0;
  drillAnswers = new Array(drillNum).fill(-1);
  document.getElementById('drill-setup-area').style.display  = 'none';
  document.getElementById('drill-quiz-area').style.display   = 'block';
  document.getElementById('drill-result-area').style.display = 'none';
  document.getElementById('drill-tot').textContent = drillNum;
  showDrillQuestion();
}

function showDrillQuestion() {
  const q = drillQuestions[drillIdx];
  document.getElementById('drill-cur').textContent   = drillIdx + 1;
  document.getElementById('drill-prog').style.width  = ((drillIdx / drillNum) * 100) + '%';
  const letters = ['A','B','C','D'];
  document.getElementById('drill-question-box').innerHTML = `
    <div class="q-text" style="font-size:1rem;">${drillIdx+1}. ${q.q}</div>
    <div class="q-options" style="margin-top:14px;">${q.opts.map((o,i)=>`<div class="q-opt" onclick="selectDrillOpt(this,${i})" data-oi="${i}"><div class="opt-letter">${letters[i]}</div>${o}</div>`).join('')}</div>`;
  const nextBtn = document.getElementById('drill-next-btn');
  if (nextBtn) nextBtn.textContent = drillIdx === drillNum - 1 ? 'Selesai ✓' : 'Soal Berikutnya →';
}

function selectDrillOpt(el, oi) {
  document.querySelectorAll('[data-oi]').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  drillAnswers[drillIdx] = oi;
}

function nextDrill() {
  if (drillIdx < drillNum - 1) {
    drillIdx++;
    showDrillQuestion();
  } else {
    showDrillResult();
  }
}

function showDrillResult() {
  document.getElementById('drill-quiz-area').style.display   = 'none';
  document.getElementById('drill-result-area').style.display = 'block';
  let score = 0;
  drillQuestions.forEach((q,i) => { if (drillAnswers[i] === q.ans) score++; });
  document.getElementById('drill-final-score').textContent = score + '/' + drillNum;
  const pct = Math.round(score / drillNum * 100);
  document.getElementById('drill-result-msg').textContent =
    pct >= 80 ? '🏆 Sangat bagus! Pertahankan prestasi kamu!' :
    pct >= 60 ? '👍 Cukup baik. Terus berlatih untuk lebih baik!' :
                '📚 Perlu lebih banyak latihan. Pelajari lagi materinya!';

  let pembHtml = '<h4 style="font-size:.92rem;font-weight:800;margin-bottom:14px;color:var(--primary-dark);">📖 Pembahasan Detail:</h4>';
  drillQuestions.forEach((q,i) => {
    const isCorrect = drillAnswers[i] === q.ans;
    const letters   = ['A','B','C','D'];
    pembHtml += `<div style="padding:14px 16px;border:2px solid ${isCorrect?'var(--success)':'var(--danger)'};border-radius:12px;margin-bottom:12px;background:${isCorrect?'#f0fdf4':'#fef2f2'}">
      <div style="font-size:.88rem;font-weight:700;color:var(--text);margin-bottom:6px;">${i+1}. ${q.q}</div>
      <div style="font-size:.82rem;color:${isCorrect?'#166534':'#991b1b'};margin-bottom:6px;">${isCorrect?'✅':'❌'} Jawaban kamu: ${drillAnswers[i]>=0?letters[drillAnswers[i]]:'Tidak dijawab'} | Jawaban benar: ${letters[q.ans]} (${q.opts[q.ans]})</div>
      <div style="font-size:.82rem;color:var(--text-muted);line-height:1.6;">💡 <strong>Pembahasan:</strong> ${q.penj}</div>
    </div>`;
  });
  document.getElementById('drill-pembahasan').innerHTML = pembHtml;

  if (progress.drillBest === null || pct > progress.drillBest) {
    progress.drillBest = pct;
  }
  saveProgress();
  updateGlobalProgress();
  renderBadges();
  // ── SYNC drill ke Google Sheets ──
  if (typeof syncDrill === 'function') syncDrill(drillNum, score);
}

function endDrill() {
  document.getElementById('drill-quiz-area').style.display  = 'none';
  document.getElementById('drill-setup-area').style.display = 'block';
}

function resetDrill() {
  document.getElementById('drill-result-area').style.display = 'none';
  document.getElementById('drill-setup-area').style.display  = 'block';
  drillNum = 5;
  const dispEl = document.getElementById('drill-num-display');
  if (dispEl) dispEl.textContent = drillNum;
}

/* ========================= GLOSARIUM ========================= */
const GLOSARIUM_DATA = [
  { term:'Alergen', def:'Zat yang tidak berbahaya tetapi memicu reaksi alergi pada individu yang sensitif.' },
  { term:'Alergi', def:'Respons imun berlebihan terhadap zat yang sebenarnya tidak berbahaya, melibatkan IgE dan sel mast.' },
  { term:'Anafilaksis', def:'Reaksi alergi berat dan mengancam jiwa yang terjadi dengan cepat setelah paparan alergen.' },
  { term:'Antibodi', def:'Protein imunoglobulin yang diproduksi oleh sel plasma sebagai respons terhadap antigen spesifik.' },
  { term:'Antigen', def:'Molekul asing (biasanya protein) yang memicu respons imun dan berikatan spesifik dengan antibodi.' },
  { term:'Autoimun', def:'Kondisi di mana sistem imun menyerang jaringan atau sel tubuh sendiri secara keliru.' },
  { term:'Basofil', def:'Jenis sel darah putih granulosit yang melepas histamin saat terjadi reaksi alergi.' },
  { term:'CD4+', def:'Penanda permukaan sel T helper yang digunakan sebagai target infeksi oleh HIV.' },
  { term:'Dendritic Cell', def:'Sel penyaji antigen (APC) profesional yang mengaktifkan limfosit T naif.' },
  { term:'Epitop', def:'Bagian spesifik dari antigen yang dikenali dan berikatan dengan antibodi atau reseptor sel T.' },
  { term:'Fagositosis', def:'Proses sel (makrofag, neutrofil) menelan dan mencerna partikel asing atau patogen.' },
  { term:'Histamin', def:'Senyawa kimia yang dilepaskan sel mast selama reaksi alergi, menyebabkan peradangan.' },
  { term:'Imunitas aktif', def:'Imunitas yang terbentuk saat tubuh sendiri memproduksi antibodi setelah terpapar antigen.' },
  { term:'Imunitas pasif', def:'Imunitas yang diperoleh dari antibodi yang dibuat organisme lain dan dipindahkan ke tubuh.' },
  { term:'Imunoglobulin', def:'Nama ilmiah untuk antibodi; protein berbentuk Y yang diproduksi sel plasma.' },
  { term:'Inflamasi', def:'Respons jaringan terhadap cedera atau infeksi ditandai kemerahan, panas, bengkak, dan nyeri.' },
  { term:'Interferon', def:'Protein yang diproduksi sel terinfeksi virus untuk menghambat replikasi virus di sel sekitarnya.' },
  { term:'Komplemen', def:'Sistem protein plasma yang bekerja bersama antibodi untuk menghancurkan patogen.' },
  { term:'Limfosit', def:'Jenis sel darah putih yang berperan dalam imunitas spesifik; terdiri dari Sel B dan Sel T.' },
  { term:'Limpa', def:'Organ limfoid terbesar yang menyaring darah dan merupakan tempat respons imun terhadap antigen darah.' },
  { term:'Makrofag', def:'Sel fagosit besar yang berasal dari monosit; berperan dalam fagositosis dan penyajian antigen.' },
  { term:'MHC', def:'Major Histocompatibility Complex; protein permukaan sel yang mempresentasikan fragmen antigen ke limfosit T.' },
  { term:'Monosit', def:'Sel darah putih yang bermigrasi ke jaringan dan berubah menjadi makrofag.' },
  { term:'Neutrofil', def:'Sel darah putih terbanyak; fagosit yang merupakan pertahanan pertama melawan infeksi bakteri.' },
  { term:'Opsonisasi', def:'Proses pelapisan patogen dengan antibodi atau komplemen untuk memudahkan fagositosis.' },
  { term:'Patogen', def:'Organisme atau agen penyebab penyakit seperti bakteri, virus, jamur, atau parasit.' },
  { term:'Sel B', def:'Limfosit yang diproduksi di sumsum tulang; menghasilkan antibodi sebagai respons imun humoral.' },
  { term:'Sel NK', def:'Natural Killer cell; limfosit bawaan yang membunuh sel tumor dan sel terinfeksi virus.' },
  { term:'Sel T', def:'Limfosit yang dimatangkan di timus; berperan dalam imunitas seluler dan regulasi respons imun.' },
  { term:'Sitokin', def:'Protein pembawa pesan yang digunakan sel imun untuk berkomunikasi dan mengkoordinasikan respons imun.' },
  { term:'Timus', def:'Kelenjar di dada tempat Sel T diproduksi dan dimatangkan menjadi sel T yang kompeten.' },
  { term:'Vaksin', def:'Preparat biologis yang memberikan imunitas aktif buatan terhadap penyakit tertentu.' },
];

function initGlosarium() {
  const af = document.getElementById('alpha-filter');
  if (!af || af.children.length > 0) return;
  const alphas = [...new Set(GLOSARIUM_DATA.map(g => g.term[0].toUpperCase()))].sort();
  af.innerHTML = `<button class="alpha-btn active" onclick="filterAlpha(this,'all')">All</button>` +
    alphas.map(a => `<button class="alpha-btn" onclick="filterAlpha(this,'${a}')">${a}</button>`).join('');
  renderGlosarium(GLOSARIUM_DATA);
}

function renderGlosarium(data) {
  const list = document.getElementById('glos-list');
  if (!list) return;
  list.innerHTML = data.length ? data.map(g => `
    <div class="glos-item">
      <div class="glos-term">${g.term}</div>
      <div class="glos-def">${g.def}</div>
    </div>`).join('') : '<p style="color:var(--text-muted);text-align:center;padding:20px">Istilah tidak ditemukan.</p>';
}

function filterAlpha(btn, letter) {
  document.querySelectorAll('.alpha-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const filtered = letter === 'all' ? GLOSARIUM_DATA : GLOSARIUM_DATA.filter(g => g.term[0].toUpperCase() === letter);
  renderGlosarium(filtered);
}

function filterGlosarium() {
  const q        = document.getElementById('glos-search-inp').value.toLowerCase();
  const filtered = GLOSARIUM_DATA.filter(g => g.term.toLowerCase().includes(q) || g.def.toLowerCase().includes(q));
  renderGlosarium(filtered);
}

/* ========================= RUJUKAN ========================= */
const RUJUKAN_DATA = [
  { type:'book',    title:'Biologi untuk SMA/MA Kelas XI',              author:'Irnaningtyas',                  year:'2023', penerbit:'Erlangga, Jakarta',             note:'Kurikulum Merdeka' },
  { type:'book',    title:'Campbell Biology (12th Edition)',             author:'Reece, J.B., Urry, L.A., et al.',year:'2021', penerbit:'Pearson Education, New York',   note:'International Reference' },
  { type:'book',    title:'Immunology: A Short Course (8th Edition)',    author:'Coico, R. & Sunshine, G.',      year:'2015', penerbit:'Wiley-Blackwell',                note:'Standard Immunology Text' },
  { type:'article', title:'Innate Immune Evasion by SARS-CoV-2',        author:'Voss, M. et al.',               year:'2023', penerbit:'Nature Immunology, Vol. 24',     note:'Peer-reviewed journal' },
  { type:'article', title:'Dengue Virus Immune Evasion Mechanisms',     author:'Guzman, M.G. et al.',           year:'2022', penerbit:'PLoS Pathogens, 18(3)',          note:'Open access' },
  { type:'article', title:'Advances in Vaccine Development',            author:'Pollard, A.J. & Bijker, E.M.',  year:'2021', penerbit:'Nature Reviews Immunology, 21',  note:'Peer-reviewed' },
  { type:'web',     title:'Sistem Imun – Tinjauan Klinis',              author:'Kementerian Kesehatan RI',      year:'2024', penerbit:'kemkes.go.id',                   note:'Sumber resmi pemerintah' },
  { type:'web',     title:'Immunology Overview',                        author:'NIAID',                         year:'2024', penerbit:'niaid.nih.gov',                  note:'US Government' },
];

function initRujukan() {
  const list = document.getElementById('rujukan-list');
  if (!list || list.children.length > 0) return;
  const icons   = { book:'📚', article:'📄', web:'🌐' };
  const classes = { book:'ri-book', article:'ri-article', web:'ri-web' };
  list.innerHTML = RUJUKAN_DATA.map((r,i) => `
    <div class="ref-item animate-in" style="animation-delay:${i*0.06}s">
      <div class="ref-icon ${classes[r.type]}">${icons[r.type]}</div>
      <div>
        <div class="ref-title">${r.title}</div>
        <div class="ref-author">${r.author}</div>
        <div class="ref-author" style="margin-top:2px">${r.penerbit}</div>
        <div class="ref-year">${r.year} · ${r.note}</div>
      </div>
    </div>`).join('');
}

/* ========================= MODAL ========================= */
function openModal(title, body) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML    = body;
  document.getElementById('modal').classList.add('open');
}
function closeModal() { document.getElementById('modal').classList.remove('open'); }
document.addEventListener('DOMContentLoaded', () => {
  const mo = document.getElementById('modal');
  if (mo) mo.addEventListener('click', function(e) { if (e.target === this) closeModal(); });
});

/* ========================= TOAST ========================= */
let toastTimer;
function showToast(msg, type = 'success') {
  const t      = document.getElementById('toast');
  const icons  = { success:'✅', error:'❌', info:'ℹ️' };
  t.innerHTML  = `<span style="font-size:1.1rem">${icons[type]||'✅'}</span> ${msg}`;
  t.className  = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer   = setTimeout(() => t.classList.remove('show'), 3200);
}