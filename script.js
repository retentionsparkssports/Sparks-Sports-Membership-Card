// ============================================================
// SPARKS MEMBERSHIP CARD - GITHUB PAGES VERSION
// ============================================================

const SHEET_CSV_URL      = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTosLyHAecGLxPdg4ULsnx11VimQuzvcjD6pCEiTJWPtrLY0ckPVHahmkax46woBS6MhCKK4Qntjy2O/pub?gid=2025872883&single=true&output=csv";
const ATTENDANCE_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTosLyHAecGLxPdg4ULsnx11VimQuzvcjD6pCEiTJWPtrLY0ckPVHahmkax46woBS6MhCKK4Qntjy2O/pub?gid=602531638&single=true&output=csv";
const BACKUP_CSV_URL     = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTosLyHAecGLxPdg4ULsnx11VimQuzvcjD6pCEiTJWPtrLY0ckPVHahmkax46woBS6MhCKK4Qntjy2O/pub?gid=2025872883&single=true&output=csv";

const LOGO_URL        = "logo.png";
const PROXY_PREFIX    = "https://api.allorigins.win/raw?url=";
const SUPPORT_WA      = "https://wa.me/6281390006606";
const SUPPORT_LABEL   = "Tim Customer Support Sparks Sports";

const app = document.getElementById("app");

let ALL_STUDENTS   = [];
let ALL_ATTENDANCE    = [];
let ATTENDANCE_INDEX  = {};
let ALL_BACKUP        = [];
let DATA_READY        = false;
let DATA_ERROR     = "";

// ============================================================
// ICONS
// ============================================================

const ICON_PHONE = `<svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v2.2a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 3.4 2 2 0 0 1 4.11 1.2h2.2a2 2 0 0 1 2 1.72c.13.96.35 1.9.66 2.8a2 2 0 0 1-.45 2.1L7.6 8.75a16 16 0 0 0 7.65 7.65l.93-.93a2 2 0 0 1 2.1-.45c.9.31 1.84.53 2.8.66A2 2 0 0 1 22 16.92Z"/></svg>`;
const ICON_SEARCH = `<svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>`;
const ICON_WA     = `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;

// ============================================================
// INIT
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
  const params    = new URLSearchParams(window.location.search);
  const phone     = params.get("phone");
  const studentId = params.get("sid");

  // LP3: student detail
  if (studentId) {
    renderLoadingPage("Memuat detail attendance", "Mohon tunggu sebentar.");
    await loadData();
    if (DATA_ERROR) { renderErrorPage(DATA_ERROR); return; }
    // Find student with matching sid — pick row with highest retentionX, tiebreak by latest expiry
    const candidates = ALL_STUDENTS.filter(s => s.studentId === studentId);
    const student = candidates.reduce((best, s) => {
      if (!best) return s;
      if (s.retentionX > best.retentionX) return s;
      if (s.retentionX === best.retentionX) {
        const dNew = parseExpiryDate(s.expiryDateRaw);
        const dOld = parseExpiryDate(best.expiryDateRaw);
        if (dNew && dOld && dNew > dOld) return s;
        if (dNew && !dOld) return s;
      }
      return best;
    }, null);
    if (!student) { renderNotFoundPage(phone || studentId); return; }
    const attendance = getAttendanceById(studentId);
    const waLink     = getWaLinkById(studentId);
    const sarName    = getSarNameById(studentId);
    renderDetailPage(student, attendance, waLink, sarName, phone);
    return;
  }

  // LP2: dashboard
  if (phone) {
    renderLoadingPage("Mencari data membership", "Mohon tunggu sebentar. Kami sedang mencocokkan nomor WhatsApp yang kamu masukkan.");
    await loadData();
    if (DATA_ERROR) { renderErrorPage(DATA_ERROR); return; }
    const students = findByPhone(phone);
    if (!students.length) { renderNotFoundPage(phone); return; }
    renderDashboardPage(students);
    return;
  }

  // LP1: landing
  renderLandingPage();
  loadDataInBackground();
});

// ============================================================
// DATA LOADING
// ============================================================

async function loadDataInBackground() { await loadData(); }

async function loadData() {
  if (DATA_READY) return;
  if (!SHEET_CSV_URL || SHEET_CSV_URL.includes("PASTE")) {
    DATA_ERROR = "Link database belum terhubung.";
    return;
  }
  try {
    const [retentionRows, attendanceRows] = await Promise.all([
      fetchCsv(SHEET_CSV_URL),
      fetchCsv(ATTENDANCE_CSV_URL).catch(() => []),
    ]);
    processRetentionRows(retentionRows);
    processAttendanceRows(attendanceRows);
    DATA_READY = true;
  } catch (e) {
    DATA_ERROR = "Data membership belum bisa dimuat. Silakan coba beberapa saat lagi atau hubungi " + SUPPORT_LABEL + " untuk bantuan.";
    console.error(e);
  }
}

async function fetchCsv(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      skipEmptyLines: true,
      complete: r => (!r || !r.data || !r.data.length) ? reject(new Error("CSV kosong")) : resolve(r.data),
      error: err => {
        // retry with proxy
        Papa.parse(PROXY_PREFIX + encodeURIComponent(url), {
          download: true,
          skipEmptyLines: true,
          complete: r2 => (!r2 || !r2.data || !r2.data.length) ? reject(new Error("CSV kosong via proxy")) : resolve(r2.data),
          error: reject
        });
      }
    });
  });
}

// ============================================================
// PROCESS: RETENTION (LP1 & LP2)
// ============================================================

function processRetentionRows(rows) {
  const headerIndex = findHeaderIndex(rows);
  const headers     = rows[headerIndex].map(h => normalizeHeader(h));
  const dataRows    = rows.slice(headerIndex + 1);

  const col = {
    branch:      findColumn(headers, ["branch", "branch code"], 0),
    center:      7, // col H is always "Center" (full name) — col A "center" is just the branch code
    studentId:   findColumn(headers, ["student id", "studentid", "sid"], 1),
    studentName: findColumn(headers, ["student name", "nama siswa", "name"], 2),
    phone:       findColumn(headers, ["phone number", "phone", "nomor hp", "nomor whatsapp", "whatsapp", "no hp"], 3),
    parentsName: findColumn(headers, ["parents name", "parent name", "nama parent", "nama orang tua", "parents"], 4),
    retentionX:  findColumn(headers, ["retention x", "retention_x", "retention", "ret x"], 5),
    expiryDate:  findColumn(headers, ["expiry date", "expired date", "membership berakhir", "end date"], 6),
  };

  const parsed = [];
  for (const row of dataRows) {
    if (!row || row.length < 3) continue;
    const studentId   = cleanCell(row[col.studentId]);
    const studentName = cleanCell(row[col.studentName]);
    const phone       = cleanCell(row[col.phone]);
    if (!studentId && !studentName && !phone) continue;
    if (isBadRow(studentId) || isBadRow(studentName) || isBadRow(phone)) continue;
    const branch      = cleanCell(row[col.branch]);
    const center      = col.center !== null ? cleanCell(row[col.center]) : "";
    parsed.push({
      branch,
      center:          center || branch || "Center belum tersedia",
      studentId,
      studentName,
      phone,
      normalizedPhone: normalizePhone(phone),
      parentsName:     cleanCell(row[col.parentsName]),
      retentionX:      parseInt(cleanCell(row[col.retentionX]), 10) || 0,
      expiryDateRaw:   cleanCell(row[col.expiryDate]),
      expiryDate:      formatDisplayDate(cleanCell(row[col.expiryDate])),
    });
  }
  ALL_STUDENTS = parsed;
}

// ============================================================
// PROCESS: ATTENDANCE (LP3)
// ============================================================

function processAttendanceRows(rows) {
  if (!rows || !rows.length) return;

  // Find header row: must contain "student id" + "date" + "status"
  let headerIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const j = rows[i].map(c => normalizeHeader(c)).join("|");
    if (j.includes("student id") && j.includes("date") && j.includes("status")) {
      headerIdx = i;
      break;
    }
  }

  const headers  = rows[headerIdx].map(h => normalizeHeader(h));
  const dataRows = rows.slice(headerIdx + 1);

  // Exact indexOf — no fuzzy matching
  function colIdx(name, fallback) {
    const idx = headers.indexOf(normalizeHeader(name));
    return idx !== -1 ? idx : fallback;
  }

  const col = {
    studentId:    colIdx("student id",    0),
    studentName:  colIdx("student name",  1),
    center:       colIdx("center",        2),
    date:         colIdx("date",          3),
    class_:       colIdx("class",         4),
    status:       colIdx("status",        5),
    makeupReason: colIdx("makeup reason", 6),
    type:         colIdx("type",          7),
    isOldClass:    colIdx("is old class",   -1),
    previousClass: colIdx("previous class", -1), // for make up tab grouping
  };

  ALL_ATTENDANCE = dataRows
    .filter(r => {
      const sid = cleanCell(r[col.studentId]);
      return sid && sid !== "nan" && sid !== "Student ID";
    })
    .map(r => {
      const oldRaw = col.isOldClass !== -1 && r[col.isOldClass] !== undefined
        ? cleanCell(r[col.isOldClass]).toLowerCase() : "";
      const isOldClass = ["yes","true","1","lama"].includes(oldRaw);
      const previousClass = col.previousClass !== -1 && r[col.previousClass] !== undefined
        ? cleanCell(r[col.previousClass]) : "";
      return {
        studentId:    cleanCell(r[col.studentId]),
        studentName:  cleanCell(r[col.studentName]),
        center:       cleanCell(r[col.center]),
        date:         cleanCell(r[col.date]),
        class_:       cleanCell(r[col.class_]),
        status:       cleanCell(r[col.status]),
        makeupReason: cleanCell(r[col.makeupReason]),
        type:         cleanCell(r[col.type]),
        isOldClass,
        previousClass,
      };
    });

  // Build index for O(1) lookup by studentId
  ATTENDANCE_INDEX = {};
  ALL_ATTENDANCE.forEach(r => {
    if (!ATTENDANCE_INDEX[r.studentId]) ATTENDANCE_INDEX[r.studentId] = [];
    ATTENDANCE_INDEX[r.studentId].push(r);
  });
}

// ============================================================
// PROCESS: BACKUP (WA links)
// ============================================================

function processBackupRows(rows) {
  if (!rows || !rows.length) return;

  let headerIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const j = rows[i].map(c => normalizeHeader(c)).join("|");
    if (j.includes("student id")) { headerIdx = i; break; }
  }

  const headers  = rows[headerIdx].map(h => normalizeHeader(h));
  const dataRows = rows.slice(headerIdx + 1);

  function colIdx(name, fallback) {
    const idx = headers.indexOf(normalizeHeader(name));
    return idx !== -1 ? idx : fallback;
  }

  const col = {
    studentId: colIdx("student id", 1),
    sarName:   colIdx("student advisor retention", 8),
    waLink:    colIdx("link wa", 10),
  };

  ALL_BACKUP = dataRows
    .filter(r => r && cleanCell(r[col.studentId]))
    .map(r => ({
      studentId: cleanCell(r[col.studentId]),
      sarName:   cleanCell(r[col.sarName]),
      waLink:    cleanCell(r[col.waLink]),
    }));

  console.log("Total backup rows loaded:", ALL_BACKUP.length);
}

// ============================================================
// LOOKUP FUNCTIONS
// ============================================================

function findByPhone(rawInput) {
  const needle  = normalizePhone(rawInput);
  const matched = ALL_STUDENTS.filter(s => s.normalizedPhone && s.normalizedPhone === needle);
  if (!matched.length) return [];
  const byStudent = {};
  matched.forEach(s => {
    if (!s.studentId) return;
    const existing = byStudent[s.studentId];
    if (!existing) {
      byStudent[s.studentId] = s;
      return;
    }
    // Primary sort: higher retentionX wins
    if (s.retentionX > existing.retentionX) {
      byStudent[s.studentId] = s;
      return;
    }
    // Tiebreaker: if retentionX is equal, pick the one with later expiry date
    if (s.retentionX === existing.retentionX) {
      const dNew = parseExpiryDate(s.expiryDateRaw);
      const dOld = parseExpiryDate(existing.expiryDateRaw);
      if (dNew && dOld && dNew > dOld) byStudent[s.studentId] = s;
      else if (dNew && !dOld)          byStudent[s.studentId] = s;
    }
  });
  return Object.values(byStudent).sort((a, b) => String(a.studentId).localeCompare(String(b.studentId)));
}

function getAttendanceById(studentId) {
  const rows = ATTENDANCE_INDEX[studentId] || [];
  return rows.slice().sort((a, b) => {
    const da = a.date ? new Date(a.date) : new Date(0);
    const db = b.date ? new Date(b.date) : new Date(0);
    return db - da;
  });
}

function getWaLinkById(studentId) {
  const r = ALL_BACKUP.find(r => r.studentId === studentId);
  if (!r) return null;
  return r.waLink && r.waLink.startsWith("https://wa.me") ? r.waLink : null;
}

function getSarNameById(studentId) {
  const r = ALL_BACKUP.find(r => r.studentId === studentId);
  return r ? r.sarName : "";
}

// ============================================================
// BRAND LOGO
// ============================================================

function renderBrandLogo(size) {
  const imgClass = size === "small" ? "logo-img small" : "logo-img";
  return `<div class="logo-wrap">
    <img src="${LOGO_URL}" class="${imgClass}" alt="Sparks Sports Academy"
      onerror="this.style.display='none';this.nextElementSibling.style.display='block';"/>
    <div class="logo-fallback ${size === "small" ? "white" : ""}" style="display:none;">
      Sparks <span class="star">★</span>
    </div>
  </div>`;
}

// ============================================================
// LP1: LANDING PAGE
// ============================================================

function renderLandingPage() {
  document.body.className = "center-page";
  app.innerHTML = `
    <div class="card">
      ${renderBrandLogo()}
      <div class="divider"></div>
      <p class="headline">Cek Status Membership Anak</p>
      <p class="sub">Masukkan nomor WhatsApp orang tua yang terdaftar untuk melihat status membership Sparks.</p>
      <label for="phone">Nomor WhatsApp</label>
      <div class="input-row has-icon">
        <div class="field-icon">${ICON_PHONE}</div>
        <div class="prefix">+62</div>
        <input type="tel" id="phone" placeholder="8111000549" inputmode="numeric" autocomplete="tel" maxlength="16"/>
      </div>
      <p class="hint">Tanpa angka 0 di depan. Contoh: 8111000549</p>
      <button id="btn" onclick="goToDashboard()">Cek Status Membership →</button>
      <p class="small-note">Butuh bantuan? Hubungi <a href="${SUPPORT_WA}" target="_blank" style="color:var(--green);font-weight:700;">${SUPPORT_LABEL}</a> untuk pengecekan data membership.</p>
    </div>
  `;
  const inp = document.getElementById("phone");
  inp.addEventListener("input", function () { this.value = this.value.replace(/[^0-9]/g, ""); });
  inp.addEventListener("keydown", function (e) { if (e.key === "Enter") goToDashboard(); });
}

// ============================================================
// LOADING / ERROR / NOT FOUND
// ============================================================

function renderLoadingPage(title, subtitle) {
  document.body.className = "center-page";
  app.innerHTML = `
    <div class="card">
      <div class="search-visual">${ICON_SEARCH}</div>
      ${renderBrandLogo()}
      <div class="divider"></div>
      <p class="headline loading-dots">${escapeHtml(title)}</p>
      <p class="sub">${escapeHtml(subtitle)}</p>
    </div>
  `;
}

function renderNotFoundPage(phone) {
  document.body.className = "center-page";
  app.innerHTML = `
    <div class="card">
      <div class="search-visual">${ICON_SEARCH}</div>
      <h2 class="headline">Nomor Tidak Ditemukan</h2>
      <p class="error-text">Kami belum menemukan data membership untuk nomor:</p>
      <div class="phone-box">+${escapeHtml(normalizePhone(phone))}</div>
      <p class="error-text">Coba cek kembali angka yang dimasukkan. Jika nomor sudah benar tetapi data tetap tidak muncul, silakan hubungi Student Advisor Retention center kamu untuk pengecekan data.</p>
      <br>
      <a class="wa-help-btn" href="${SUPPORT_WA}" target="_blank">${ICON_WA} Hubungi ${SUPPORT_LABEL}</a>
      <br><br>
      <a class="link-button" onclick="backToHome()">← Coba Nomor Lain</a>
    </div>
  `;
}

function renderErrorPage(message) {
  document.body.className = "center-page";
  app.innerHTML = `
    <div class="card">
      <div class="icon warning">⚠️</div>
      <h2 class="headline">Data Belum Bisa Dimuat</h2>
      <p class="error-text">${escapeHtml(message)}</p>
      <p class="error-text">Silakan muat ulang halaman ini. Jika masih belum bisa, hubungi tim Sparks untuk pengecekan database.</p>
      <br><br>
      <a class="link-button" onclick="backToHome()">← Kembali</a>
    </div>
  `;
}

// ============================================================
// LP2: DASHBOARD
// ============================================================

function renderDashboardPage(students) {
  document.body.className = "dashboard-page";
  const phone        = new URLSearchParams(window.location.search).get("phone") || "";
  const parentsName  = formatGreetingParentName(students[0]?.parentsName || "");
  const greeting     = parentsName ? `Halo, ${escapeHtml(parentsName)}!` : "Halo!";
  const multiNote    = students.length > 1
    ? `<div class="multi-note">👤 ${students.length} anak terdaftar dengan nomor ini.</div>` : "";

  app.innerHTML = `
    <div class="topbar">
      <div class="topbar-logo">
        <div class="topbar-logo-inner">
          <img src="${LOGO_URL}" class="logo-img small" alt="Sparks Sports Academy"
            onerror="this.style.display='none';this.nextElementSibling.style.display='block';"/>
          <div class="logo-fallback white" style="display:none;">Sparks <span class="star">★</span> Sports Academy</div>
        </div>
      </div>
    </div>
    <div class="wrap">
      <div class="greeting-card">
        <div class="greeting-text">${greeting}</div>
        <div class="greeting-sub">Yuk cek status membership si kecil di Sparks.</div>
      </div>
      ${multiNote}
      ${students.map(s => studentCard(s, phone)).join("")}
      <a class="back-link" onclick="backToHome()">← Cek nomor lain</a>
    </div>
  `;
}

function studentCard(student, phone) {
  const centerText = student.center || student.branch || "Center belum tersedia";
  const sid        = encodeURIComponent(student.studentId);
  const ph         = encodeURIComponent(phone);
  return `
    <div class="student-card">
      <div class="card-top">
        <div class="avatar">${getInitials(student.studentName)}</div>
        <div class="card-info">
          <div class="student-name">${escapeHtml(student.studentName || "Nama belum tersedia")}</div>
          <div class="student-id">${escapeHtml(student.studentId || "")}</div>
          <div><span class="center-badge">${escapeHtml(centerText)}</span></div>
        </div>
      </div>
      ${createExpiryBanner(student.expiryDate)}
      <a class="detail-btn" href="?phone=${ph}&sid=${sid}">Lihat Detail Attendance →</a>
    </div>
  `;
}

// ============================================================
// LP3: STUDENT DETAIL
// ============================================================

function renderDetailPage(student, attendance, waLink, sarName, phone) {
  document.body.className = "dashboard-page";
  const centerText = student.center || student.branch || "Center belum tersedia";
  const ph         = encodeURIComponent(phone || "");
  const waTarget   = waLink || SUPPORT_WA;
  const waLabel    = waLink
    ? "Hubungi Student Advisor"
    : `Hubungi ${SUPPORT_LABEL}`;

  // Build class map — group attendance rows by class label
  // Make up rows: group under previousClass tab if available, else Semua only (no new tab)
  // isOldClass: true if ALL rows in that class are flagged as old (moving class scenario)
  const classMap = {};
  const classOldFlag = {};
  attendance.forEach(r => {
    const isMakeUp = r.type && r.type.toLowerCase() === "make up";
    // Determine which tab this row belongs to
    let tabLabel;
    if (isMakeUp) {
      // If previousClass exists → group under that tab
      // If blank → only show in Semua, do not create new tab
      tabLabel = r.previousClass ? getClassLabel(r.previousClass) : null;
    } else {
      tabLabel = getClassLabel(r.class_);
    }
    if (tabLabel) {
      if (!classMap[tabLabel]) { classMap[tabLabel] = []; classOldFlag[tabLabel] = true; }
      classMap[tabLabel].push(r);
      if (!r.isOldClass) classOldFlag[tabLabel] = false;
    }
  });
  const classKeys = Object.keys(classMap);
  const hasMovingClass = classKeys.some(k => classOldFlag[k]);
  const makeupAll  = attendance.filter(r => r.type && r.type.toLowerCase() === "make up");
  const tabsHtml  = [
    `<button class="class-tab active" data-key="__all__">Semua</button>`,
    ...classKeys.map(k => {
      const isOld = classOldFlag[k];
      return `<button class="class-tab${isOld ? ' class-tab--old' : ''}" data-key="${escapeHtml(k)}" data-old="${isOld}">${escapeHtml(k)}${isOld ? ' <span class="old-badge">Kelas Lama</span>' : ''}</button>`;
    }),
    makeupAll.length ? `<button class="class-tab class-tab--makeup" data-key="__makeup__">Make Up</button>` : ""
  ].join("");

  app.innerHTML = `
    <div class="topbar topbar-detail">
      <a class="topbar-back" href="?phone=${ph}">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><polyline points="15 18 9 12 15 6"/></svg>
      </a>
      <div class="topbar-logo"><div class="topbar-logo-inner">
        <img src="${LOGO_URL}" class="logo-img small" alt="Sparks Sports Academy"
          onerror="this.style.display='none';this.nextElementSibling.style.display='block';"/>
        <div class="logo-fallback white" style="display:none;">Sparks <span class="star">★</span></div>
      </div></div>
    </div>
    <div class="wrap">
      <div class="detail-hero">
        <div class="card-top">
          <div class="avatar">${getInitials(student.studentName)}</div>
          <div class="card-info">
            <div class="student-name">${escapeHtml(student.studentName || "")}</div>
            <div class="student-id">${escapeHtml(student.studentId || "")}</div>
            <div><span class="center-badge">${escapeHtml(centerText)}</span></div>
          </div>
        </div>
        ${createExpiryBanner(student.expiryDate)}
      </div>

      <div class="term-label">
        <span class="term-badge">Summer Term 2026</span>
      </div>

      <div class="class-tabs-wrap">${tabsHtml}</div>
      <div class="metrics-row" id="lp3-metrics"></div>

      <div class="att-card">
        <div class="att-header">
          <div class="att-title" id="lp3-att-title">Riwayat Kehadiran</div>
        </div>
        <div class="att-legend">
          <span class="leg-item"><span class="att-dot-inline dot-present"></span>Hadir</span>
          <span class="leg-item"><span class="att-dot-inline dot-makeup"></span>Make up</span>
          <span class="leg-item"><span class="att-dot-inline dot-absent"></span>Absen</span>
          <span class="leg-item"><span class="att-dot-inline dot-leave"></span>Izin</span>
        </div>
        <div class="att-table-wrap">
          <table class="att-table">
            <thead><tr><th>Tanggal</th><th>Kelas</th><th>Status</th></tr></thead>
            <tbody id="lp3-tbody"></tbody>
          </table>
        </div>
      </div>

      <a class="wa-help-btn wa-help-btn--full" href="${waTarget}" target="_blank">${ICON_WA} ${waLabel}</a>
      <a class="back-link" href="?phone=${ph}">← Kembali ke daftar anak</a>
    </div>
  `;

  // Store for tab switching — use pre-grouped classMap
  window._lp3All          = attendance;
  window._lp3MakeupAll    = makeupAll;
  window._lp3ClassMap     = classMap;
  window._lp3ClassOldFlag = classOldFlag;

  // Attach tab click events after DOM is fully rendered
  setTimeout(function() {
    document.querySelectorAll(".class-tab").forEach(function(btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll(".class-tab").forEach(function(t) { t.classList.remove("active"); });
        this.classList.add("active");
        lp3Render(this.getAttribute("data-key"));
      });
    });
    lp3Render("__all__");
  }, 0);
}

function lp3Render(key) {
  const all          = window._lp3All || [];
  const makeupAll    = window._lp3MakeupAll || [];
  const classMap     = window._lp3ClassMap || {};
  const classOldFlag = window._lp3ClassOldFlag || {};

  const isMakeUpTab = key === "__makeup__";
  const rows        = isMakeUpTab ? makeupAll : (key === "__all__" ? all : (classMap[key] || []));
  const isOldTab    = !isMakeUpTab && key !== "__all__" && classOldFlag[key];

  const metricsEl = document.getElementById("lp3-metrics");
  const titleEl   = document.getElementById("lp3-att-title");
  const tbody     = document.getElementById("lp3-tbody");
  if (!tbody) return;

  if (isMakeUpTab) {
    // Make Up tab — single chip: total, then list
    const countMU = makeupAll.length;
    if (metricsEl) metricsEl.innerHTML = `
      <div class="metric-chips">
        <div class="metric-chip metric-chip--makeup">
          <div class="mc-icon mc-purple">↺</div>
          <div class="mc-num purple">${countMU}</div>
          <div class="mc-lbl">Total Make Up</div>
        </div>
      </div>`;
    if (titleEl) titleEl.textContent = "Riwayat Make Up";

    if (!makeupAll.length) {
      tbody.innerHTML = `<tr><td colspan="3" class="att-empty">Belum ada data make up.</td></tr>`;
      return;
    }
    tbody.innerHTML = makeupAll.map(r => {
      const cls            = simplifyClassName(r.class_);
      const { badge, dot } = getStatusBadge(r.status, r.makeupReason);
      const reasonTag      = r.makeupReason && r.makeupReason !== ""
        ? `<span class="reason-tag">${escapeHtml(r.makeupReason)}</span>` : "";
      const prevTag        = r.previousClass
        ? `<span class="prev-class-tag">↩ ${escapeHtml(simplifyClassName(r.previousClass))}</span>` : "";
      return `<tr>
        <td><span class="att-dot-inline ${dot}"></span>${escapeHtml(r.date)}</td>
        <td>${escapeHtml(cls)}${reasonTag}${prevTag}</td>
        <td><span class="att-badge ${badge}">${escapeHtml(r.status)}</span></td>
      </tr>`;
    }).join("");
    return;
  }

  // Regular / Semua / per-kelas tab
  const regularRows     = rows.filter(r => r.type === "Regular");
  const makeupRows      = rows.filter(r => r.type === "Make Up");
  const countHadir      = regularRows.filter(r => r.status.toLowerCase() === "present").length;
  const countTidakHadir = regularRows.filter(r => {
    const s = r.status.toLowerCase();
    return s === "absent" || s === "leave" || s === "sakit" || s === "izin";
  }).length;
  const countMakeUp     = makeupRows.length;

  const oldCls = isOldTab ? " metric-chip--old" : "";
  if (metricsEl) metricsEl.innerHTML = `
    <div class="metric-chips">
      <div class="metric-chip${oldCls}">
        <div class="mc-icon mc-green">✓</div>
        <div class="mc-num green">${countHadir}</div>
        <div class="mc-lbl">Hadir</div>
      </div>
      <div class="metric-chip${oldCls}">
        <div class="mc-icon mc-red">✕</div>
        <div class="mc-num red">${countTidakHadir}</div>
        <div class="mc-lbl">Tidak Hadir</div>
      </div>
      <div class="metric-chip${oldCls}">
        <div class="mc-icon mc-purple">↺</div>
        <div class="mc-num purple">${countMakeUp}</div>
        <div class="mc-lbl">Make Up</div>
      </div>
    </div>`;

  if (titleEl) titleEl.textContent = key === "__all__" ? "Riwayat Kehadiran" : "Riwayat Kehadiran · " + key;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="att-empty">Belum ada data attendance untuk periode ini.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const cls            = simplifyClassName(r.class_);
    const { badge, dot } = getStatusBadge(r.status, r.makeupReason);
    const reasonTag      = r.makeupReason && r.makeupReason !== "Regular Class" && r.makeupReason !== ""
      ? `<span class="reason-tag">${escapeHtml(r.makeupReason)}</span>` : "";
    return `<tr>
      <td><span class="att-dot-inline ${dot}"></span>${escapeHtml(r.date)}</td>
      <td>${escapeHtml(cls)}${reasonTag}</td>
      <td><span class="att-badge ${badge}">${escapeHtml(r.status)}</span></td>
    </tr>`;
  }).join("");
}

// ============================================================
// EXPIRY BANNER
// ============================================================

function createExpiryBanner(expiryStr) {
  const date = parseExpiryDate(expiryStr);
  if (!date || date.getFullYear() < 2020) {
    return `<div class="expiry-box expiry-unknown">
      <div class="ex-label">Membership Berakhir</div>
      <div class="ex-date">Belum tersedia</div>
      <div class="ex-msg">Status membership belum tersedia. Yuk hubungi Student Advisor Retention untuk bantu cek ya.</div>
    </div>`;
  }
  const days = daysUntil(date);
  let cls, daysText, msg;
  if (days < 0) {
    cls = "expiry-expired"; daysText = `${Math.abs(days)} hari yang lalu`;
    msg = "Yah, membership si kecil sudah habis. Yuk perpanjang sekarang supaya tetap bisa lanjut seru-seruan di Sparks!";
  } else if (days === 0) {
    cls = "expiry-urgent"; daysText = "Berakhir hari ini";
    msg = "Duh, membership si kecil berakhir hari ini nih. Yuk segera perpanjang supaya tetap aktif!";
  } else if (days <= 14) {
    cls = "expiry-urgent"; daysText = `${days} hari lagi`;
    msg = "Duh, membership si kecil sudah mendekati masa berakhir nih. Yuk segera perpanjang ya!";
  } else if (days <= 30) {
    cls = "expiry-soon"; daysText = `${days} hari lagi`;
    msg = "Duh, membership si kecil sudah mendekati waktu expired. Yuk mulai perpanjang dari sekarang ya.";
  } else {
    cls = "expiry-active"; daysText = `${days} hari lagi`;
    msg = "Yeay, membership si kecil masih aktif! Tinggal lanjut latihan dan have fun bareng Sparks!";
  }
  return `<div class="expiry-box ${cls}">
    <div class="ex-label">Membership Berakhir</div>
    <div class="ex-date">${escapeHtml(formatDisplayDate(expiryStr))}</div>
    <div class="ex-days">${escapeHtml(daysText)}</div>
    <div class="ex-msg">${escapeHtml(msg)}</div>
  </div>`;
}

// ============================================================
// HELPERS
// ============================================================

function getClassLabel(raw) {
  if (!raw) return "Kelas";
  const parts = raw.split("|").map(p => p.trim());
  return parts.length >= 3 ? parts[2] : raw;
}

function simplifyClassName(raw) {
  if (!raw) return "";
  const parts = raw.split("|").map(p => p.trim());
  if (parts.length >= 5) return `${parts[2]} · ${parts[3]} ${parts[4]}`;
  return raw;
}

function getStatusBadge(status, reason) {
  const s = status.toLowerCase();
  if (s === "present")  return { badge: "badge-present", dot: "dot-present" };
  if (s === "make up")  return { badge: "badge-makeup",  dot: "dot-makeup"  };
  if (s === "absent")   return { badge: "badge-absent",  dot: "dot-absent"  };
  if (s === "leave" || s === "izin") return { badge: "badge-absent", dot: "dot-absent" };
  if (s === "sakit")    return { badge: "badge-absent",  dot: "dot-absent"  };
  return { badge: "badge-present", dot: "dot-present" };
}

function findHeaderIndex(rows) {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const j = rows[i].map(c => normalizeHeader(c)).join(" | ");
    if ((j.includes("student") || j.includes("siswa")) && j.includes("phone")) return i;
    if (j.includes("phone") && j.includes("expiry")) return i;
  }
  return 0;
}

function findColumn(headers, names, fallback) {
  for (const name of names) {
    const n   = normalizeHeader(name);
    const idx = headers.findIndex(h => h === n || h.includes(n));
    if (idx !== -1) return idx;
  }
  return fallback;
}

function isBadRow(value) {
  return ["","student id","student name","phone number","nomor hp","nomor whatsapp","automated","appscript","#n/a","#value!","#ref!","#num!","#error!"]
    .includes(cleanCell(value).toLowerCase());
}

function formatGreetingParentName(name) {
  const clean = cleanCell(name);
  if (!clean) return "";
  const lower = clean.toLowerCase();
  if (["mom","dad","mama","papa","bunda","ayah","ibu","mr","mrs"].some(p => lower.startsWith(p))) return clean;
  return `Mom/Dad ${clean}`;
}

function cleanCell(v)        { return (v === null || v === undefined) ? "" : String(v).trim(); }
function normalizeHeader(v)  { return cleanCell(v).toLowerCase().replace(/\s+/g," ").replace(/[_-]+/g," ").trim(); }

function normalizePhone(phone) {
  let p = cleanCell(phone).replace(/[\s\-\(\)\+\.]/g,"");
  if (!p) return "";
  if (p.startsWith("0")) p = "62" + p.slice(1);
  else if (p.startsWith("8")) p = "62" + p;
  if (p.startsWith("620")) p = "62" + p.slice(3);
  return p;
}

function parseExpiryDate(value) {
  const raw = cleanCell(value);
  if (!raw || raw === "-" || raw.toLowerCase() === "not yet renewal" || raw.toLowerCase() === "xxxxx" || raw.startsWith("#")) return null;
  const mm = {jan:0,january:0,feb:1,february:1,mar:2,march:2,apr:3,april:3,may:4,mei:4,jun:5,june:5,juni:5,jul:6,july:6,juli:6,aug:7,august:7,agu:7,agustus:7,sep:8,sept:8,september:8,oct:9,october:9,okt:9,oktober:9,nov:10,november:10,dec:11,december:11,des:11,desember:11};
  let m;
  m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(+m[1],+m[2]-1,+m[3]);
  m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) { let y=+m[3]; if(y<100)y+=2000; return +m[1]>12?new Date(y,+m[2]-1,+m[1]):new Date(y,+m[1]-1,+m[2]); }
  m = raw.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{2,4})$/);
  if (m) { let y=+m[3]; if(y<100)y+=2000; if(mm[m[2].toLowerCase()]!==undefined)return new Date(y,mm[m[2].toLowerCase()],+m[1]); }
  m = raw.match(/^(\d{1,2})-([A-Za-z]+)-(\d{2,4})$/);
  if (m) { let y=+m[3]; if(y<100)y+=2000; if(mm[m[2].toLowerCase()]!==undefined)return new Date(y,mm[m[2].toLowerCase()],+m[1]); }
  const fb = new Date(raw);
  return isNaN(fb.getTime()) ? null : fb;
}

function formatDisplayDate(value) {
  const date = parseExpiryDate(value);
  if (!date) return cleanCell(value);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function daysUntil(date) {
  const today = new Date(); today.setHours(0,0,0,0);
  const t     = new Date(date); t.setHours(0,0,0,0);
  return Math.round((t - today) / 86400000);
}

function getInitials(name) {
  const clean = cleanCell(name).replace(/\s*\(.*\)\s*$/, "").trim();
  if (!clean) return "?";
  const parts = clean.split(/\s+/).filter(Boolean);
  return parts.length === 1 ? parts[0][0].toUpperCase() : (parts[0][0] + parts[1][0]).toUpperCase();
}

function escapeHtml(value) {
  return cleanCell(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ============================================================
// ACTIONS
// ============================================================

function goToDashboard() {
  const input = document.getElementById("phone");
  const btn   = document.getElementById("btn");
  let raw = input.value.trim().replace(/[^0-9]/g, "");
  if (!raw)          { alert("Masukkan nomor WhatsApp terlebih dahulu."); return; }
  if (raw.length < 9){ alert("Nomor terlalu pendek"); return; }
  const phone = normalizePhone(raw);
  btn.textContent = "Mencari...";
  btn.disabled = true;
  window.location.href = `${window.location.pathname}?phone=${encodeURIComponent(phone)}`;
}

function backToHome() { window.location.href = window.location.pathname; }
