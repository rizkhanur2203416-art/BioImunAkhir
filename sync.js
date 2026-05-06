/* ================================================================
   BIOIMUN E-MODULE — SYNC.JS  (v3 — LKPD Full Jawaban)
   Lapisan sinkronisasi antara website dan Google Sheets
   ================================================================
   CARA DEPLOY APPS SCRIPT:
   1. Buka https://script.google.com → New Project
   2. Tempel isi google-apps-script.gs
   3. Klik Deploy → New deployment
   4. Type: Web app | Execute as: Me | Who has access: Anyone
   5. Klik Deploy → salin URL → paste di SHEET_URL bawah
   ================================================================ */

const SHEET_URL = 'https://script.google.com/macros/s/AKfycbwJAkT9pmRhdxGteAXZT0uUu9kIgrsUypHjEKxFqWL6RbSv1IF1-PaL5XHYMsFpORKY/exec';
// ⚠️ Ganti URL ini dengan URL deployment Google Apps Script terbaru jika sudah re-deploy
// Contoh: 'https://script.google.com/macros/s/AKfycbx.../exec'

/* ───────────────────────────────────────────────────────────────
   🔧  CORE SEND FUNCTION
   Menggunakan GET + query string — metode PALING RELIABEL untuk
   Google Apps Script karena tidak ada masalah CORS preflight.
   Data JSON di-encode sebagai parameter ?action=...&data={...}
   ─────────────────────────────────────────────────────────────── */
async function sendToSheet(action, payload) {
  if (!SHEET_URL || SHEET_URL === 'GANTI_DENGAN_URL_DEPLOYMENT' || SHEET_URL === 'BELUM_DIKONFIGURASI') {
    console.warn('[BioImun Sync] ⚠️ SHEET_URL belum dikonfigurasi di sync.js!');
    return;
  }
  try {
    // Encode payload sebagai JSON dalam query string
    // GAS doGet(e) membaca e.parameter.action dan e.parameter.data
    const dataStr = encodeURIComponent(JSON.stringify(payload));
    const url     = `${SHEET_URL}?action=${encodeURIComponent(action)}&data=${dataStr}`;

    // Gunakan no-cors GET — tidak ada preflight, body selalu diterima GAS
    await fetch(url, {
      method : 'GET',
      mode   : 'no-cors',
    });
    console.log('[BioImun Sync] ✅ Terkirim (GET):', action);
  } catch (err) {
    console.warn('[BioImun Sync] ⚠️ Gagal kirim:', action, err.message);
    queueFailedSync(action, payload);
  }
}

/* ───────────────────────────────────────────────────────────────
   📦  ANTREAN OFFLINE
   ─────────────────────────────────────────────────────────────── */
function queueFailedSync(action, payload) {
  try {
    const key   = 'bioimun_sync_queue';
    const queue = JSON.parse(localStorage.getItem(key) || '[]');
    queue.push({ action, payload, ts: Date.now() });
    if (queue.length > 50) queue.splice(0, queue.length - 50);
    localStorage.setItem(key, JSON.stringify(queue));
    console.log('[BioImun Sync] 💾 Disimpan ke antrean lokal:', action);
  } catch (e) {}
}

async function flushSyncQueue() {
  try {
    const key   = 'bioimun_sync_queue';
    const queue = JSON.parse(localStorage.getItem(key) || '[]');
    if (!queue.length) return;
    console.log('[BioImun Sync] 🔄 Mengirim', queue.length, 'item dari antrean...');
    const remaining = [];
    for (const item of queue) {
      try {
        const dataStr = encodeURIComponent(JSON.stringify(item.payload));
        const url     = `${SHEET_URL}?action=${encodeURIComponent(item.action)}&data=${dataStr}`;
        await fetch(url, { method: 'GET', mode: 'no-cors' });
        console.log('[BioImun Sync] ✅ Antrean terkirim:', item.action);
      } catch (e) {
        remaining.push(item);
      }
    }
    localStorage.setItem(key, JSON.stringify(remaining));
    if (remaining.length === 0) console.log('[BioImun Sync] ✅ Semua antrean berhasil dikirim!');
  } catch (e) {}
}

window.addEventListener('online', () => {
  console.log('[BioImun Sync] 🌐 Koneksi kembali, mengirim antrean...');
  flushSyncQueue();
});

/* ───────────────────────────────────────────────────────────────
   👤  HELPER: ambil data user aktif dari sessionStorage
   ─────────────────────────────────────────────────────────────── */
function getSyncUser() {
  try {
    const u = JSON.parse(sessionStorage.getItem('bioimun_user') || '{}');
    return {
      username: u.username || 'unknown',
      nama    : u.name || u.nama || 'Unknown',
      role    : u.role     || 'siswa',
      kelas   : u.kelas    || '—',
    };
  } catch (e) {
    return { username: 'unknown', nama: 'Unknown', role: 'siswa', kelas: '—' };
  }
}

/* ───────────────────────────────────────────────────────────────
   💾  HELPER: simpan/ambil jawaban LKPD dari localStorage
   Menyimpan sementara agar tidak hilang saat tahap berganti
   ─────────────────────────────────────────────────────────────── */
function saveLKPDJawabanLokal(tahap, fieldId, nilai) {
  try {
    const u   = getSyncUser();
    const key = 'bioimun_lkpd_' + u.username;
    const data = JSON.parse(localStorage.getItem(key) || '{}');
    if (!data['tahap' + tahap]) data['tahap' + tahap] = {};
    data['tahap' + tahap][fieldId] = nilai;
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {}
}

function getLKPDJawabanLokal(tahap) {
  try {
    const u   = getSyncUser();
    const key = 'bioimun_lkpd_' + u.username;
    const data = JSON.parse(localStorage.getItem(key) || '{}');
    return data['tahap' + tahap] || {};
  } catch (e) { return {}; }
}

/* ═══════════════════════════════════════════════════════════════
   📤  FUNGSI SYNC PER AKTIVITAS
   ═══════════════════════════════════════════════════════════════ */

function syncLogin(user) {
  sendToSheet('login', {
    username: user.username,
    nama    : user.name || user.nama,
    role    : user.role,
    kelas   : user.kelas || '—',
  });
}

function syncProgress(progressData) {
  const u = getSyncUser();
  sendToSheet('progress', { username: u.username, nama: u.nama, progress: progressData });
}

function syncKuis(materiIdx, skor, lulus) {
  const u = getSyncUser();
  sendToSheet('kuis', { username: u.username, nama: u.nama, materiIdx, skor, lulus });
}

function syncDrill(jumlahSoal, skor, detail) {
  const u = getSyncUser();
  sendToSheet('drill', {
    username  : u.username,
    nama      : u.nama,
    jumlahSoal,
    skor,
    detail    : detail || [],   // array detail per soal
  });
}

/* ── SYNC LKPD DENGAN JAWABAN LENGKAP ──────────────────────────
   Fungsi ini dipanggil setiap kali siswa menyelesaikan satu tahap.
   Mengirim:
   1. Action 'lkpd_tahapN' → jawaban penuh ke sheet per tahap
   2. Action 'lkpd' (lama)  → progress ringkas (tetap kompatibel)
   ─────────────────────────────────────────────────────────────── */

/**
 * syncLKPDTahap(tahap, kelompok, jawaban)
 *
 * tahap    : 1-5 (nomor tahap, BUKAN 0-indexed)
 * kelompok : nomor kelompok (integer)
 * jawaban  : objek berisi isi textarea sesuai tahap:
 *   Tahap 1 → { rumusan_masalah }
 *   Tahap 2 → { rencana_belajar }
 *   Tahap 3 → { hasil_analisis }
 *   Tahap 4 → { deskripsi_infografis }
 *   Tahap 5 → { solusi, kesimpulan, evaluasi, rating_kolaborasi, rating_pemahaman }
 */
function syncLKPDTahap(tahap, kelompok, jawaban) {
  const u = getSyncUser();
  // Kirim ke action khusus per tahap (jawaban penuh)
  sendToSheet('lkpd_tahap' + tahap, {
    username : u.username,
    nama     : u.nama,
    kelompok : kelompok,
    tahap    : tahap,
    jawaban  : jawaban,
  });
}

/* Fungsi lama tetap ada untuk kompatibilitas (dipanggil dari submitLKPD) */
function syncLKPD(kelompok, tahap) {
  const u = getSyncUser();
  // 'tahap' di sini adalah 0-indexed dari script.js, konversi ke 1-indexed
  sendToSheet('lkpd', { username: u.username, nama: u.nama, kelompok, tahap });
}

function syncPretest(jawaban) {
  const u = getSyncUser();
  sendToSheet('pretest', { username: u.username, nama: u.nama, jawaban });
}

function syncPosttest(jawaban) {
  const u = getSyncUser();
  sendToSheet('posttest', { username: u.username, nama: u.nama, jawaban });
}

function syncAngket(answers) {
  const u = getSyncUser();
  sendToSheet('angket', { username: u.username, nama: u.nama, answers });
}

function syncReflektif(esai) {
  const u = getSyncUser();
  sendToSheet('reflektif', { username: u.username, nama: u.nama, esai });
}

/* ═══════════════════════════════════════════════════════════════
   🪝  MONKEY-PATCH — menyisipkan sync ke fungsi script.js
   ═══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

  flushSyncQueue();

  /* ── PATCH saveProgress ─────────────────────────────────────── */
  const _origSaveProgress = window.saveProgress;
  window.saveProgress = function () {
    if (typeof _origSaveProgress === 'function') _origSaveProgress.apply(this, arguments);
    clearTimeout(window._syncProgressTimer);
    window._syncProgressTimer = setTimeout(() => {
      if (window.progress) syncProgress(window.progress);
    }, 5000);
  };

  /* ── PATCH submitKuis ───────────────────────────────────────── */
  const _origSubmitKuis = window.submitKuis;
  window.submitKuis = function () {
    if (typeof _origSubmitKuis === 'function') _origSubmitKuis.apply(this, arguments);
    const idx   = window.currentMateri ?? 0;
    const skor  = window.progress?.kuisScore?.[idx]  ?? 0;
    const lulus = window.progress?.kuisPassed?.[idx] ?? false;
    syncKuis(idx, skor, lulus);
  };

  /* ── PATCH showDrillResult ──────────────────────────────────── */
  const _origShowDrillResult = window.showDrillResult;
  window.showDrillResult = function () {
    if (typeof _origShowDrillResult === 'function') _origShowDrillResult.apply(this, arguments);
    const num = window.drillNum       ?? 5;
    const ans = window.drillAnswers   ?? [];
    const qs  = window.drillQuestions ?? [];
    const letters = ['A', 'B', 'C', 'D'];
    let skor = 0;

    // Bangun array detail per soal untuk dicatat di Sheets
    const detail = qs.map((q, i) => {
      const benar = ans[i] === q.ans;
      if (benar) skor++;
      return {
        nomor        : i + 1,
        soal         : q.q,
        jawaban_siswa: ans[i] >= 0 ? letters[ans[i]] : 'Tidak dijawab',
        jawaban_benar: letters[q.ans],
        benar        : benar,
      };
    });

    syncDrill(num, skor, detail);
  };

  /* ── PATCH checkAndSubmitLKPD ───────────────────────────────
     Ini adalah titik utama yang perlu diintersepsi.
     checkAndSubmitLKPD(idx, textareaId) dipanggil dari tombol
     "Selesaikan Tahap N" di setiap PBL_CONTENT.

     Pemetaan idx (0-indexed dari script.js) → tahap (1-indexed):
       idx 0 → Tahap 1, textarea: 'rm-text'   (Rumusan Masalah)
       idx 1 → Tahap 2, textarea: 'org-text'  (Rencana Belajar)
       idx 2 → Tahap 3, textarea: 'inv-text'  (Hasil Analisis)
       idx 3 → Tahap 4, textarea: 'pres-text' (Deskripsi Infografis)
       idx 4 → Tahap 5, multi-textarea        (Solusi, Kesimpulan, Evaluasi)
   ─────────────────────────────────────────────────────────── */
  const _origCheckAndSubmitLKPD = window.checkAndSubmitLKPD;
  window.checkAndSubmitLKPD = function (idx, textareaId) {
    // Panggil fungsi asli dulu (validasi + submitLKPD di dalamnya)
    if (typeof _origCheckAndSubmitLKPD === 'function') {
      _origCheckAndSubmitLKPD.apply(this, arguments);
    }

    // Hanya lanjut sync jika textarea sudah valid (isi ≥ 20 karakter)
    const ta = document.getElementById(textareaId);
    if (!ta || ta.value.trim().length < 20) return;

    const tahap    = idx + 1;  // konversi ke 1-indexed
    const kelompok = window.currentLKPDGroup ?? 1;
    let   jawaban  = {};

    if (idx === 0) {
      // Tahap 1: Orientasi Masalah
      jawaban = {
        rumusan_masalah: (document.getElementById('rm-text')?.value || '').trim(),
      };
    } else if (idx === 1) {
      // Tahap 2: Organisasi Belajar
      jawaban = {
        rencana_belajar: (document.getElementById('org-text')?.value || '').trim(),
      };
    } else if (idx === 2) {
      // Tahap 3: Penyelidikan
      jawaban = {
        hasil_analisis: (document.getElementById('inv-text')?.value || '').trim(),
      };
    } else if (idx === 3) {
      // Tahap 4: Penyajian Hasil
      jawaban = {
        deskripsi_infografis: (document.getElementById('pres-text')?.value || '').trim(),
      };
    } else if (idx === 4) {
      // Tahap 5: Evaluasi (multi-field)
      jawaban = {
        solusi    : (document.getElementById('sol-text')?.value  || '').trim(),
        kesimpulan: (document.getElementById('kes-text')?.value  || '').trim(),
        evaluasi  : (document.getElementById('eval-text')?.value || '').trim(),
        // Self-assessment rating (disimpan oleh rateSelf() ke dataset)
        rating_kolaborasi: parseInt(document.getElementById('_sync_rating_kolaborasi')?.dataset?.selfKolaborasi || '0') || 0,
        rating_pemahaman : parseInt(document.getElementById('_sync_rating_pemahaman')?.dataset?.selfPemahaman   || '0') || 0,
      };
    }

    // Simpan ke localStorage sebagai backup lokal
    saveLKPDJawabanLokal(tahap, 'jawaban', jawaban);

    // Kirim ke Google Sheets (jawaban penuh per tahap)
    syncLKPDTahap(tahap, kelompok, jawaban);

    console.log('[BioImun Sync] 📋 LKPD Tahap', tahap, 'jawaban terkirim:', jawaban);
  };

  /* ── PATCH submitTest ───────────────────────────────────────── */
  const _origSubmitTest = window.submitTest;
  window.submitTest = function (type) {
    if (typeof _origSubmitTest === 'function') _origSubmitTest.apply(this, arguments);
    const idMap = {
      pretest  : ['pre-q1',  'pre-q2',  'pre-q3',  'pre-q4',  'pre-q5'],
      posttest : ['post-q1', 'post-q2', 'post-q3', 'post-q4', 'post-q5'],
      reflektif: ['ref-q1',  'ref-q2',  'ref-q3',  'ref-q4',  'ref-q5'],
    };
    const ids     = idMap[type] || [];
    const jawaban = ids.map(id => { const el = document.getElementById(id); return el ? el.value.trim() : '—'; });
    if (type === 'pretest')   syncPretest(jawaban);
    if (type === 'posttest')  syncPosttest(jawaban);
    if (type === 'reflektif') syncReflektif(jawaban);
  };

  /* ── PATCH submitAngket ─────────────────────────────────────── */
  const _origSubmitAngket = window.submitAngket;
  window.submitAngket = function () {
    if (typeof _origSubmitAngket === 'function') _origSubmitAngket.apply(this, arguments);
    const answers = [];
    for (let i = 0; i < 15; i++) {
      const sel = document.querySelector(`input[name="angket-${i}"]:checked`);
      answers.push(sel ? parseInt(sel.value) : 0);
    }
    syncAngket(answers);
  };

  /* ── PATCH rateSelf ─────────────────────────────────────────────
     rateSelf(btn, nilai, kategori) dipanggil dari tombol bintang Tahap 5.
     Kita sisipkan data-attribute agar mudah dibaca saat submit.
   ─────────────────────────────────────────────────────────────── */
  const _origRateSelf = window.rateSelf;
  window.rateSelf = function (btn, nilai, kategori) {
    if (typeof _origRateSelf === 'function') _origRateSelf.apply(this, arguments);
    // Tandai nilai rating di elemen kontainer agar bisa dibaca saat syncLKPD
    const container = btn?.closest?.('[style]') || document.body;
    if (kategori === 'kolaborasi') {
      // Simpan ke elemen khusus yang mudah dicari
      let marker = document.getElementById('_sync_rating_kolaborasi');
      if (!marker) {
        marker = document.createElement('span');
        marker.id = '_sync_rating_kolaborasi';
        marker.style.display = 'none';
        document.body.appendChild(marker);
      }
      marker.setAttribute('data-self-kolaborasi', nilai);
      marker.dataset.selfKolaborasi = nilai;
    } else if (kategori === 'pemahaman') {
      let marker = document.getElementById('_sync_rating_pemahaman');
      if (!marker) {
        marker = document.createElement('span');
        marker.id = '_sync_rating_pemahaman';
        marker.style.display = 'none';
        document.body.appendChild(marker);
      }
      marker.setAttribute('data-self-pemahaman', nilai);
      marker.dataset.selfPemahaman = nilai;
    }
  };

  console.log('[BioImun Sync] ✅ Semua patch aktif (v3 + LKPD Full Jawaban). Siap sinkronisasi ke Google Sheets.');
});

/* ═══════════════════════════════════════════════════════════════
   📊  HELPER PUBLIK: ambil semua jawaban LKPD lokal
   Bisa dipanggil dari console untuk debug:
   >> getBioImunLKPDData()
   ═══════════════════════════════════════════════════════════════ */
window.getBioImunLKPDData = function () {
  const u   = getSyncUser();
  const key = 'bioimun_lkpd_' + u.username;
  const data = JSON.parse(localStorage.getItem(key) || '{}');
  console.table(data);
  return data;
};
