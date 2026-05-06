/* ================================================================
   BIOIMUN E-MODULE — GOOGLE APPS SCRIPT BACKEND (v3 — LKPD Full)
   ================================================================
   Cara deploy:
   1. Buka script.google.com → New Project → tempel kode ini
   2. Klik Deploy → New deployment → Web app
   3. Execute as: Me | Who has access: Anyone
   4. Copy URL deployment → paste ke SHEET_URL di sync.js
   ================================================================ */

// ── KONFIGURASI ──────────────────────────────────────────────────
const SPREADSHEET_ID = '15ncUlzus98oYQAgYpAn_64BMoV9c33yGz-txfhByjR0';
// Spreadsheet: https://docs.google.com/spreadsheets/d/15ncUlzus98oYQAgYpAn_64BMoV9c33yGz-txfhByjR0/edit

// Nama setiap sheet (tab)
const SHEETS = {
  LOGIN       : 'Log_Login',
  USERS       : 'Daftar_Pengguna',      // ✨ Sheet khusus pendaftaran akun baru
  PROGRESS    : 'Progress_Belajar',
  KUIS        : 'Hasil_Kuis',
  DRILL       : 'Hasil_Drill',
  LKPD        : 'Progress_LKPD',
  LKPD_DETAIL : 'Jawaban_LKPD',       // ✨ BARU: rekap lengkap semua jawaban LKPD
  LKPD_T1     : 'LKPD_Tahap1_OrientasiMasalah',
  LKPD_T2     : 'LKPD_Tahap2_OrganisasiBelajar',
  LKPD_T3     : 'LKPD_Tahap3_Penyelidikan',
  LKPD_T4     : 'LKPD_Tahap4_PenyajianHasil',
  LKPD_T5     : 'LKPD_Tahap5_Evaluasi',
  PRETEST     : 'Jawaban_PreTest',
  POSTTEST    : 'Jawaban_PostTest',
  ANGKET      : 'Angket_Ownership',
  REFLEKTIF   : 'Esai_Reflektif',
  REKAP       : 'Rekap_Siswa',
};

// ── ENTRY POINT — semua POST request masuk sini ──────────────────
function doPost(e) {
  try {
    initAllSheets();

    let data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      data = e.parameter || {};
      if (data.data) {
        try { data = { ...JSON.parse(data.data), action: data.action }; } catch (e2) {}
      }
    }

    const action = data.action;
    let result;

    switch (action) {
      case 'login':        result = recordLogin(data);              break;
      case 'register':     result = recordRegister(data);           break;
      case 'progress':     result = recordProgress(data);           break;
      case 'kuis':         result = recordKuis(data);               break;
      case 'drill':        result = recordDrill(data);              break;
      case 'lkpd':         result = recordLKPD(data);               break;
      // ✨ BARU: action khusus per tahap dengan jawaban lengkap
      case 'lkpd_tahap1':  result = recordLKPDTahap(data, 1);       break;
      case 'lkpd_tahap2':  result = recordLKPDTahap(data, 2);       break;
      case 'lkpd_tahap3':  result = recordLKPDTahap(data, 3);       break;
      case 'lkpd_tahap4':  result = recordLKPDTahap(data, 4);       break;
      case 'lkpd_tahap5':  result = recordLKPDTahap(data, 5);       break;
      case 'pretest':      result = recordTest(data, 'pretest');    break;
      case 'posttest':     result = recordTest(data, 'posttest');   break;
      case 'angket':       result = recordAngket(data);             break;
      case 'reflektif':    result = recordReflektif(data);         break;
      default:             result = { status: 'error', msg: 'Unknown action: ' + action };
    }

    if (data.username) updateRekap(data.username);
    return buildResponse(result);

  } catch (err) {
    Logger.log('doPost error: ' + err.toString());
    return buildResponse({ status: 'error', msg: err.toString() });
  }
}

// ── GET: ENDPOINT UTAMA dari sync.js (fetch GET + no-cors) ──────
// sync.js mengirim: ?action=login&data={"username":"...","nama":"..."}
// doGet membaca e.parameter.action dan e.parameter.data
function doGet(e) {
  try {
    initAllSheets();

    if (e.parameter && e.parameter.action) {
      let data = { action: e.parameter.action };
      if (e.parameter.data) {
        try {
          // data dikirim sebagai JSON string ter-encode
          data = { ...JSON.parse(e.parameter.data), action: e.parameter.action };
        } catch (err2) {
          Logger.log('doGet parse error: ' + err2.toString());
        }
      }

      const action = data.action;
      let result;
      switch (action) {
        case 'login':        result = recordLogin(data);              break;
        case 'register':     result = recordRegister(data);           break;
        case 'progress':     result = recordProgress(data);           break;
        case 'kuis':         result = recordKuis(data);               break;
        case 'drill':        result = recordDrill(data);              break;
        case 'lkpd':         result = recordLKPD(data);               break;
        case 'lkpd_tahap1':  result = recordLKPDTahap(data, 1);       break;
        case 'lkpd_tahap2':  result = recordLKPDTahap(data, 2);       break;
        case 'lkpd_tahap3':  result = recordLKPDTahap(data, 3);       break;
        case 'lkpd_tahap4':  result = recordLKPDTahap(data, 4);       break;
        case 'lkpd_tahap5':  result = recordLKPDTahap(data, 5);       break;
        case 'pretest':      result = recordTest(data, 'pretest');    break;
        case 'posttest':     result = recordTest(data, 'posttest');   break;
        case 'angket':       result = recordAngket(data);             break;
        case 'reflektif':    result = recordReflektif(data);         break;
        default:             result = { status: 'error', msg: 'Unknown action: ' + action };
      }

      if (data.username) updateRekap(data.username);
      return buildResponse(result);
    }

    // Tanpa parameter → test koneksi
    return buildResponse({
      status: 'ok',
      msg: 'BioImun API aktif ✅ — gunakan ?action=...&data={...}',
      spreadsheet: SPREADSHEET_ID,
      time: new Date().toISOString()
    });

  } catch (err) {
    Logger.log('doGet error: ' + err.toString());
    return buildResponse({ status: 'error', msg: err.toString() });
  }
}

function buildResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── HELPER: ambil atau buat sheet ────────────────────────────────
function getSheet(name) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  let   sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function now() {
  return Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
}

// ── INISIALISASI HEADER semua sheet ──────────────────────────────
function initAllSheets() {
  const headers = {
    [SHEETS.LOGIN]:    ['Timestamp','Username','Nama','Role','Kelas','IP_Kira2'],
    [SHEETS.PROGRESS]: ['Timestamp','Username','Nama','Materi1','Materi2','Materi3','Materi4','Materi5',
                        'Kuis1Lulus','Kuis2Lulus','Kuis3Lulus','Kuis4Lulus','Kuis5Lulus',
                        'Skor_Kuis1','Skor_Kuis2','Skor_Kuis3','Skor_Kuis4','Skor_Kuis5',
                        'XP','DrillBest%','Total_Materi_Selesai','Total_Kuis_Lulus','Persen_Progress'],
    [SHEETS.KUIS]:     ['Timestamp','Username','Nama','Materi_Ke','Judul_Materi','Skor','Lulus_YN','Percobaan_Ke'],
    [SHEETS.DRILL]:    ['Timestamp','Username','Nama','Jumlah_Soal','Skor','Persen','Status',
                        'Detail_Soal_Benar','Detail_Soal_Salah','Daftar_Topik_Salah'],
    [SHEETS.LKPD]:     ['Timestamp','Username','Nama','Kelompok','Tahap','Nama_Tahap','Status'],

    // ✨ BARU: Sheet rekap semua jawaban LKPD per siswa (1 baris per siswa, update tiap tahap)
    [SHEETS.LKPD_DETAIL]: [
      'Terakhir_Update','Username','Nama','Kelompok',
      'T1_Rumusan_Masalah',
      'T2_Rencana_Belajar',
      'T3_Hasil_Analisis',
      'T4_Deskripsi_Infografis',
      'T5_Solusi','T5_Kesimpulan','T5_Evaluasi_Proses',
      'T5_Rating_Kolaborasi','T5_Rating_Pemahaman',
      'Tahap_Selesai','Status_LKPD'
    ],

    // ✨ Sheet detail per tahap (untuk analisis mendalam per tahap)
    [SHEETS.LKPD_T1]: ['Timestamp','Username','Nama','Kelompok','Rumusan_Masalah','Jumlah_Karakter','Status'],
    [SHEETS.LKPD_T2]: ['Timestamp','Username','Nama','Kelompok','Rencana_Belajar','Jumlah_Karakter','Status'],
    [SHEETS.LKPD_T3]: ['Timestamp','Username','Nama','Kelompok','Hasil_Analisis','Jumlah_Karakter','Status'],
    [SHEETS.LKPD_T4]: ['Timestamp','Username','Nama','Kelompok','Deskripsi_Infografis','Jumlah_Karakter','Status'],
    [SHEETS.LKPD_T5]: ['Timestamp','Username','Nama','Kelompok',
                        'Solusi_Kelompok','Kesimpulan','Evaluasi_Proses',
                        'Rating_Kolaborasi','Rating_Pemahaman','Status'],

    [SHEETS.PRETEST]:  ['Timestamp','Username','Nama','Soal1','Soal2','Soal3','Soal4','Soal5','Status'],
    [SHEETS.POSTTEST]: ['Timestamp','Username','Nama','Soal1','Soal2','Soal3','Soal4','Soal5','Status'],
    [SHEETS.ANGKET]:   ['Timestamp','Username','Nama','Q1','Q2','Q3','Q4','Q5','Q6','Q7','Q8','Q9','Q10','Q11','Q12','Q13','Q14','Q15',
                        'Total_Skor','Persen','Dimensi_TJ','Dimensi_Motivasi','Dimensi_Mandiri','Dimensi_Terlibat','Dimensi_Refleksi','Kategori'],
    [SHEETS.REFLEKTIF]:['Timestamp','Username','Nama','Esai1_TanggungJawab','Esai2_Motivasi','Esai3_Pemahaman','Esai4_Tantangan','Esai5_Penerapan','Status'],
    [SHEETS.REKAP]:    ['Terakhir_Update','Username','Nama','Role','Total_Login','Progress%','Kuis_Lulus','XP',
                        'PreTest','PostTest','Angket_Skor','LKPD_Selesai','Drill_Best%','Status_Keseluruhan'],
    [SHEETS.USERS]:    ['Timestamp_Daftar','Username','Nama','Email','Role','Kelas','Status'],
  };

  Object.entries(headers).forEach(([name, hdr]) => {
    const sheet = getSheet(name);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(hdr);
      sheet.getRange(1, 1, 1, hdr.length).setFontWeight('bold')
           .setBackground('#1a6b4a').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }
  });
}

// ── 0. REGISTRASI PENGGUNA BARU ──────────────────────────────────
function recordRegister(d) {
  const sheet = getSheet(SHEETS.USERS);
  // Cek apakah username sudah ada (hindari duplikat)
  const existing = findRow(sheet, d.username, 2);
  const row = [
    now(),
    d.username,
    d.nama || d.name || '—',
    d.email || '—',
    d.role  || 'siswa',
    d.kelas || '—',
    '✅ Aktif',
  ];
  if (existing > 0) {
    // Update baris yang ada (misal re-register)
    sheet.getRange(existing, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  return { status: 'ok', msg: 'Registrasi tercatat' };
}

// ── 1. LOG LOGIN ─────────────────────────────────────────────────
function recordLogin(d) {
  const sheet = getSheet(SHEETS.LOGIN);
  sheet.appendRow([now(), d.username, d.nama || d.name || '—', d.role, d.kelas || '—', '—']);
  return { status: 'ok', msg: 'Login tercatat' };
}

// ── 2. PROGRESS BELAJAR ──────────────────────────────────────────
function recordProgress(d) {
  const sheet  = getSheet(SHEETS.PROGRESS);
  const prog   = d.progress;
  const matDone = prog.materi.filter(Boolean).length;
  const kuisLulus = prog.kuisPassed.filter(Boolean).length;
  const pct    = Math.round(kuisLulus / 5 * 100);

  const existing = findRow(sheet, d.username, 2);
  const row = [
    now(), d.username, d.nama,
    prog.materi[0]?'✅':'❌', prog.materi[1]?'✅':'❌', prog.materi[2]?'✅':'❌',
    prog.materi[3]?'✅':'❌', prog.materi[4]?'✅':'❌',
    prog.kuisPassed[0]?'✅':'❌', prog.kuisPassed[1]?'✅':'❌', prog.kuisPassed[2]?'✅':'❌',
    prog.kuisPassed[3]?'✅':'❌', prog.kuisPassed[4]?'✅':'❌',
    prog.kuisScore[0]??'—', prog.kuisScore[1]??'—', prog.kuisScore[2]??'—',
    prog.kuisScore[3]??'—', prog.kuisScore[4]??'—',
    prog.xp || 0,
    prog.drillBest !== null ? prog.drillBest + '%' : '—',
    matDone, kuisLulus, pct + '%',
  ];

  if (existing > 0) {
    sheet.getRange(existing, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  return { status:'ok', msg:'Progress disimpan' };
}

// ── 3. HASIL KUIS ────────────────────────────────────────────────
function recordKuis(d) {
  const sheet = getSheet(SHEETS.KUIS);
  const materiNames = [
    'Sistem Pertahanan Tubuh',
    'Pertahanan Nonspesifik',
    'Pertahanan Spesifik',
    'Jenis Imunitas',
    'Gangguan Sistem Imun'
  ];
  const data    = sheet.getDataRange().getValues();
  const attempt = data.filter(r => r[1] === d.username && r[3] == d.materiIdx + 1).length + 1;

  sheet.appendRow([
    now(), d.username, d.nama,
    d.materiIdx + 1,
    materiNames[d.materiIdx] || 'Materi ' + (d.materiIdx+1),
    d.skor + '/5',
    d.lulus ? '✅ LULUS' : '❌ Tidak Lulus',
    attempt,
  ]);
  return { status:'ok', msg:'Hasil kuis tercatat' };
}

// ── 4. HASIL DRILL ───────────────────────────────────────────────
function recordDrill(d) {
  const sheet = getSheet(SHEETS.DRILL);
  const pct   = Math.round(d.skor / d.jumlahSoal * 100);

  // Rekap soal benar/salah dari detail per soal (dikirim sync.js v3)
  // d.detail = array of { nomor, soal, jawaban_siswa, jawaban_benar, benar }
  let detailBenar = '—';
  let detailSalah = '—';
  let topikSalah  = '—';

  if (Array.isArray(d.detail) && d.detail.length > 0) {
    const benarList = d.detail.filter(s => s.benar);
    const salahList = d.detail.filter(s => !s.benar);

    detailBenar = benarList.length > 0
      ? benarList.map(s => 'No.' + s.nomor).join(', ')
      : 'Tidak ada';

    detailSalah = salahList.length > 0
      ? salahList.map(s => 'No.' + s.nomor + ' (Jawab:' + s.jawaban_siswa + '|Benar:' + s.jawaban_benar + ')').join(' | ')
      : 'Tidak ada';

    topikSalah = salahList.length > 0
      ? salahList.map(s => s.soal.substring(0, 50) + '...').join(' || ')
      : '—';
  }

  sheet.appendRow([
    now(), d.username, d.nama,
    d.jumlahSoal, d.skor + '/' + d.jumlahSoal, pct + '%',
    pct >= 80 ? '🌟 Sangat Baik' : pct >= 60 ? '👍 Baik' : '📚 Perlu Latihan',
    detailBenar,
    detailSalah,
    topikSalah,
  ]);
  return { status:'ok', msg:'Hasil drill tercatat' };
}

// ── 5. PROGRESS LKPD (ringkas — tetap dipertahankan) ────────────
function recordLKPD(d) {
  const sheet = getSheet(SHEETS.LKPD);
  const namaStage = ['Orientasi Masalah','Organisasi Belajar','Penyelidikan','Penyajian Hasil','Evaluasi'];
  sheet.appendRow([
    now(), d.username, d.nama,
    'Kelompok ' + d.kelompok,
    d.tahap + 1,
    namaStage[d.tahap] || 'Tahap ' + (d.tahap+1),
    '✅ Selesai',
  ]);
  return { status:'ok', msg:'Progress LKPD tercatat' };
}

// ── 5b. JAWABAN LKPD PER TAHAP (BARU) ────────────────────────────
/**
 * Merekam jawaban lengkap siswa untuk tiap tahap LKPD.
 * - Sheet khusus per tahap: mencatat setiap submit (append)
 * - Sheet LKPD_DETAIL: rekap 1 baris per siswa, update setiap tahap selesai
 *
 * data yang diharapkan dari sync.js:
 * {
 *   username, nama, kelompok,
 *   tahap: 1-5,
 *   jawaban: {
 *     // Tahap 1
 *     rumusan_masalah: '...',
 *     // Tahap 2
 *     rencana_belajar: '...',
 *     // Tahap 3
 *     hasil_analisis: '...',
 *     // Tahap 4
 *     deskripsi_infografis: '...',
 *     // Tahap 5
 *     solusi: '...', kesimpulan: '...', evaluasi: '...',
 *     rating_kolaborasi: 0-5, rating_pemahaman: 0-5
 *   }
 * }
 */
function recordLKPDTahap(d, tahap) {
  const j = d.jawaban || {};
  const kelompok = 'Kelompok ' + (d.kelompok || 1);

  // ── A. Tulis ke sheet khusus tahap ─────────────────────────────
  const sheetNames = [null, SHEETS.LKPD_T1, SHEETS.LKPD_T2, SHEETS.LKPD_T3, SHEETS.LKPD_T4, SHEETS.LKPD_T5];
  const sheetTahap = getSheet(sheetNames[tahap]);

  if (tahap === 1) {
    const txt = j.rumusan_masalah || '—';
    sheetTahap.appendRow([now(), d.username, d.nama, kelompok, txt, txt.length, '✅ Dikumpulkan']);
  } else if (tahap === 2) {
    const txt = j.rencana_belajar || '—';
    sheetTahap.appendRow([now(), d.username, d.nama, kelompok, txt, txt.length, '✅ Dikumpulkan']);
  } else if (tahap === 3) {
    const txt = j.hasil_analisis || '—';
    sheetTahap.appendRow([now(), d.username, d.nama, kelompok, txt, txt.length, '✅ Dikumpulkan']);
  } else if (tahap === 4) {
    const txt = j.deskripsi_infografis || '—';
    sheetTahap.appendRow([now(), d.username, d.nama, kelompok, txt, txt.length, '✅ Dikumpulkan']);
  } else if (tahap === 5) {
    sheetTahap.appendRow([
      now(), d.username, d.nama, kelompok,
      j.solusi         || '—',
      j.kesimpulan     || '—',
      j.evaluasi       || '—',
      j.rating_kolaborasi ?? '—',
      j.rating_pemahaman  ?? '—',
      '✅ Dikumpulkan'
    ]);
  }

  // ── B. Update sheet LKPD_DETAIL (rekap 1 baris per siswa) ──────
  updateLKPDDetail(d, tahap, kelompok, j);

  // ── C. Tetap catat ke sheet ringkas Progress_LKPD ──────────────
  recordLKPD({ username: d.username, nama: d.nama, kelompok: d.kelompok || 1, tahap: tahap - 1 });

  return { status: 'ok', msg: 'Jawaban LKPD Tahap ' + tahap + ' tercatat' };
}

/**
 * Memperbarui sheet LKPD_DETAIL: 1 baris per siswa,
 * kolom per tahap diisi/diperbarui setiap kali tahap selesai.
 */
function updateLKPDDetail(d, tahap, kelompok, j) {
  const sheet = getSheet(SHEETS.LKPD_DETAIL);

  // Kolom di LKPD_DETAIL:
  // 1:Timestamp, 2:Username, 3:Nama, 4:Kelompok,
  // 5:T1_Rumusan, 6:T2_Rencana, 7:T3_Analisis, 8:T4_Infografis,
  // 9:T5_Solusi, 10:T5_Kesimpulan, 11:T5_Evaluasi,
  // 12:T5_Rating_Kol, 13:T5_Rating_Pem,
  // 14:Tahap_Selesai, 15:Status

  const existing = findRow(sheet, d.username, 2);

  if (existing < 0) {
    // Buat baris baru dengan data tahap ini
    const newRow = [
      now(), d.username, d.nama, kelompok,
      tahap === 1 ? (j.rumusan_masalah || '—')      : '—',
      tahap === 2 ? (j.rencana_belajar || '—')      : '—',
      tahap === 3 ? (j.hasil_analisis || '—')       : '—',
      tahap === 4 ? (j.deskripsi_infografis || '—') : '—',
      tahap === 5 ? (j.solusi || '—')               : '—',
      tahap === 5 ? (j.kesimpulan || '—')           : '—',
      tahap === 5 ? (j.evaluasi || '—')             : '—',
      tahap === 5 ? (j.rating_kolaborasi ?? '—')    : '—',
      tahap === 5 ? (j.rating_pemahaman ?? '—')     : '—',
      tahap + '/5',
      tahap === 5 ? '🎓 Selesai Semua' : '📝 Berlangsung (Tahap ' + tahap + ')',
    ];
    sheet.appendRow(newRow);
  } else {
    // Update baris yang ada — hanya perbarui kolom yang relevan
    const rowData = sheet.getRange(existing, 1, 1, 15).getValues()[0];

    // Col 1: timestamp
    rowData[0] = now();
    // Col 4: kelompok (update jika belum diisi)
    if (rowData[3] === '—' || !rowData[3]) rowData[3] = kelompok;

    // Isi kolom jawaban sesuai tahap
    if (tahap === 1) rowData[4] = j.rumusan_masalah      || rowData[4] || '—';
    if (tahap === 2) rowData[5] = j.rencana_belajar      || rowData[5] || '—';
    if (tahap === 3) rowData[6] = j.hasil_analisis       || rowData[6] || '—';
    if (tahap === 4) rowData[7] = j.deskripsi_infografis || rowData[7] || '—';
    if (tahap === 5) {
      rowData[8]  = j.solusi             || rowData[8]  || '—';
      rowData[9]  = j.kesimpulan         || rowData[9]  || '—';
      rowData[10] = j.evaluasi           || rowData[10] || '—';
      rowData[11] = j.rating_kolaborasi  ?? rowData[11] ?? '—';
      rowData[12] = j.rating_pemahaman   ?? rowData[12] ?? '—';
    }

    // Perbarui tahap selesai (ambil nilai terbesar)
    const prevTahap = parseInt(String(rowData[13]).split('/')[0]) || 0;
    const newTahap  = Math.max(prevTahap, tahap);
    rowData[13] = newTahap + '/5';
    rowData[14] = newTahap >= 5 ? '🎓 Selesai Semua' : '📝 Berlangsung (Tahap ' + newTahap + ')';

    sheet.getRange(existing, 1, 1, 15).setValues([rowData]);
  }
}

// ── 6. PRE-TEST & POST-TEST ──────────────────────────────────────
function recordTest(d, type) {
  const sheetName = type === 'pretest' ? SHEETS.PRETEST : SHEETS.POSTTEST;
  const sheet     = getSheet(sheetName);

  const existing = findRow(sheet, d.username, 2);
  const row = [
    now(), d.username, d.nama,
    d.jawaban[0] || '—', d.jawaban[1] || '—', d.jawaban[2] || '—',
    d.jawaban[3] || '—', d.jawaban[4] || '—',
    '✅ Dikumpulkan',
  ];

  if (existing > 0) {
    sheet.getRange(existing, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  return { status:'ok', msg: type + ' tercatat' };
}

// ── 7. ANGKET OWNERSHIP OF LEARNING ─────────────────────────────
function recordAngket(d) {
  const sheet = getSheet(SHEETS.ANGKET);
  const answers = d.answers;
  const total   = answers.reduce((s, v) => s + v, 0);
  const pct     = Math.round(total / (15 * 5) * 100);

  const dimTJ  = answers.slice(0,3).reduce((s,v)=>s+v,0);
  const dimMot = answers.slice(3,6).reduce((s,v)=>s+v,0);
  const dimMan = answers.slice(6,9).reduce((s,v)=>s+v,0);
  const dimTer = answers.slice(9,12).reduce((s,v)=>s+v,0);
  const dimRef = answers.slice(12,15).reduce((s,v)=>s+v,0);
  const kategori = pct>=80?'🌟 Sangat Tinggi':pct>=65?'👍 Tinggi':pct>=50?'📚 Cukup':'💪 Rendah';

  const existing = findRow(sheet, d.username, 2);
  const row = [
    now(), d.username, d.nama,
    ...answers,
    total, pct + '%',
    dimTJ + '/15', dimMot + '/15', dimMan + '/15', dimTer + '/15', dimRef + '/15',
    kategori,
  ];

  if (existing > 0) {
    sheet.getRange(existing, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  return { status:'ok', msg:'Angket tercatat', skor: total, pct };
}

// ── 8. ESAI REFLEKTIF ────────────────────────────────────────────
function recordReflektif(d) {
  const sheet = getSheet(SHEETS.REFLEKTIF);
  const existing = findRow(sheet, d.username, 2);
  const row = [
    now(), d.username, d.nama,
    d.esai[0] || '—', d.esai[1] || '—', d.esai[2] || '—',
    d.esai[3] || '—', d.esai[4] || '—',
    '✅ Dikumpulkan',
  ];

  if (existing > 0) {
    sheet.getRange(existing, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  return { status:'ok', msg:'Esai reflektif tercatat' };
}

// ── 9. REKAP SISWA (auto-update) ─────────────────────────────────
function updateRekap(username) {
  if (!username) return;
  const sheet  = getSheet(SHEETS.REKAP);
  const ss     = SpreadsheetApp.openById(SPREADSHEET_ID);

  function getLatestRow(sheetName, usernameCol) {
    const s = ss.getSheetByName(sheetName);
    if (!s || s.getLastRow() < 2) return null;
    const data = s.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][usernameCol - 1]) === username) return data[i];
    }
    return null;
  }

  const progRow     = getLatestRow(SHEETS.PROGRESS, 2);
  const angketRow   = getLatestRow(SHEETS.ANGKET, 2);
  const pretestRow  = getLatestRow(SHEETS.PRETEST, 2);
  const posttestRow = getLatestRow(SHEETS.POSTTEST, 2);

  // Hitung login count
  const loginSheet = ss.getSheetByName(SHEETS.LOGIN);
  let loginCount = 0;
  if (loginSheet && loginSheet.getLastRow() > 1) {
    loginSheet.getDataRange().getValues().slice(1).forEach(r => { if (r[1] === username) loginCount++; });
  }

  // LKPD selesai — cek dari LKPD_DETAIL (lebih akurat)
  let lkpdTahap = 0;
  const lkpdDetailSheet = ss.getSheetByName(SHEETS.LKPD_DETAIL);
  if (lkpdDetailSheet && lkpdDetailSheet.getLastRow() > 1) {
    const lkpdData = lkpdDetailSheet.getDataRange().getValues();
    for (let i = lkpdData.length - 1; i >= 1; i--) {
      if (String(lkpdData[i][1]) === username) {
        lkpdTahap = parseInt(String(lkpdData[i][13]).split('/')[0]) || 0;
        break;
      }
    }
  }

  const progPct   = progRow   ? progRow[22]  : '0%';
  const kuisLulus = progRow   ? progRow[20]  : 0;
  const xp        = progRow   ? progRow[18]  : 0;
  const drillBest = progRow   ? progRow[19]  : '—';
  const nama      = progRow   ? progRow[2]   : username;
  const angketSkor= angketRow ? angketRow[18]: '—';
  const hasPretest  = pretestRow  ? '✅' : '❌';
  const hasPosttest = posttestRow ? '✅' : '❌';

  const parseInt_safe = (v) => { const n = parseInt(String(v)); return isNaN(n) ? 0 : n; };
  const progNum = parseInt_safe(String(progPct));
  const status  = progNum === 100 && hasPretest==='✅' && hasPosttest==='✅' && lkpdTahap >= 5
                ? '🎓 Selesai'
                : progNum >= 50
                ? '📚 Sedang Belajar'
                : '🆕 Baru Mulai';

  const existing = findRow(sheet, username, 2);
  const row = [
    now(), username, nama, progRow ? (progRow[3] || '—') : '—',
    loginCount, progPct, kuisLulus, xp,
    hasPretest, hasPosttest, angketSkor,
    lkpdTahap + '/5 Tahap', drillBest, status,
  ];

  if (existing > 0) {
    sheet.getRange(existing, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
}

// ── UTILITY: cari baris berdasarkan username ──────────────────────
function findRow(sheet, username, col) {
  if (sheet.getLastRow() < 2) return -1;
  const vals = sheet.getRange(2, col, sheet.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) {
    if (String(vals[i][0]) === String(username)) return i + 2;
  }
  return -1;
}

// ── AUTO-FORMAT: jalankan sekali untuk setup sheet ───────────────
function setupSheets() {
  initAllSheets();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  Object.values(SHEETS).forEach(name => {
    const s = ss.getSheetByName(name);
    if (s) {
      s.autoResizeColumns(1, s.getLastColumn() || 1);
      if (s.getFrozenRows() === 0) s.setFrozenRows(1);
    }
  });

  // Wrap text di kolom jawaban LKPD agar terbaca
  const lkpdSheets = [
    SHEETS.LKPD_DETAIL, SHEETS.LKPD_T1, SHEETS.LKPD_T2,
    SHEETS.LKPD_T3,     SHEETS.LKPD_T4, SHEETS.LKPD_T5,
  ];
  lkpdSheets.forEach(name => {
    const s = ss.getSheetByName(name);
    if (s && s.getLastColumn() > 0) {
      s.getRange(1, 1, Math.max(s.getLastRow(), 1), s.getLastColumn())
       .setWrap(true);
    }
  });

  Logger.log('Setup selesai! Semua sheet sudah siap termasuk sheet LKPD baru.');
}
