// ============================================================
// SPARKS MEMBERSHIP CARD - GITHUB PAGES VERSION
// ============================================================

const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTosLyHAecGLxPdg4ULsnx11VimQuzvcjD6pCEiTJWPtrLY0ckPVHahmkax46woBS6MhCKK4Qntjy2O/pub?gid=2025872883&single=true&output=csv";
const ATTENDANCE_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTosLyHAecGLxPdg4ULsnx11VimQuzvcjD6pCEiTJWPtrLY0ckPVHahmkax46woBS6MhCKK4Qntjy2O/pub?gid=602531638&single=true&output=csv";
const BACKUP_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTosLyHAecGLxPdg4ULsnx11VimQuzvcjD6pCEiTJWPtrLY0ckPVHahmkax46woBS6MhCKK4Qntjy2O/pub?gid=2025872883&single=true&output=csv";

const LOGO_URL = "logo.png";
const PROXY_PREFIX = "https://api.allorigins.win/raw?url=";
const TELESALES_WA = "https://wa.me/6281390006606";
const TELESALES_LABEL = "Tim Customer Support Sparks Sports";

const app = document.getElementById("app");

let ALL_STUDENTS = [];
let ALL_ATTENDANCE = [];
let ALL_BACKUP = [];
let DATA_READY = false;
let DATA_ERROR = "";

// ============================================================
// ICONS
// ============================================================

const ICON_PHONE = `<svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v2.2a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 3.4 2 2 0 0 1 4.11 1.2h2.2a2 2 0 0 1 2 1.72c.13.96.35 1.9.66 2.8a2 2 0 0 1-.45 2.1L7.6 8.75a16 16 0 0 0 7.65 7.65l.93-.93a2 2 0 0 1 2.1-.45c.9.31 1.84.53 2.8.66A2 2 0 0 1 22 16.92Z"/></svg>`;
const ICON_SEARCH = `<svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>`;
const ICON_WA = `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;

// ============================================================
// INIT
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const phone = params.get("phone");
  const studentId = params.get("sid");

  // LP3: student detail page
  if (studentId) {
    renderLoadingPage("Memuat detail attendance", "Mohon tunggu sebentar.");
    await loadData();
    if (DATA_ERROR) { renderErrorPage(DATA_ERROR); return; }
    const students = findByPhone(phone || "");
    const student = ALL_STUDENTS.find(s => s.studentId === studentId) || (students[0] || null);
    if (!student) { renderNotFoundPage(phone || studentId); return; }
    const attendance = getAttendanceByStudentId(studentId);
    const waLink = getWaLinkByStudentId(studentId);
    const sarName = getSarNameByStudentId(studentId);
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
  if (!SHEET_CSV_URL || SHEET_CSV_URL.includes("PASTE_LINK_CSV")) {
    DATA_ERROR = "Link database belum terhubung. Silakan hubungi tim Sparks untuk pengecekan.";
    return;
  }
  try {
    const [retentionRows, attendanceRows, backupRows] = await Promise.all([
      parseRemoteCsv(SHEET_CSV_URL).catch(() => parseRemoteCsv(PROXY_PREFIX + encodeURIComponent(SHEET_CSV_URL))),
      ATTENDANCE_CSV_URL && !ATTENDANCE_CSV_URL.includes("PASTE") ? parseRemoteCsv(ATTENDANCE_CSV_URL).catch(() => []) : Promise.resolve([]),
      BACKUP_CSV_URL && !BACKUP_CSV_URL.includes("PASTE") ? parseRemoteCsv(BACKUP_CSV_URL).catch(() => []) : Promise.resolve([]),
    ]);
    processRetentionRows(retentionRows);
    processAttendanceRows(attendanceRows);
    processBackupRows(backupRows);
    DATA_READY = true;
  } catch (e) {
    DATA_ERROR = "Data membership belum bisa dimuat. Silakan coba beberapa saat lagi atau hubungi Student Advisor Retention untuk bantuan.";
    console.error(e);
  }
}

function parseRemoteCsv(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      skipEmptyLines: true,
      complete: r => (!r || !r.data || !r.data.length) ? reject(new Error("CSV kosong")) : resolve(r.data),
      error: reject
    });
  });
}

// ============================================================
// PROCESS: RETENTION DATA
// ============================================================

function processRetentionRows(rows) {
  const headerIndex = findHeaderIndex(rows);
  const headers = rows[headerIndex].map(h => normalizeHeader(h));
  const dataRows = rows.slice(headerIndex + 1);

  const col = {
    branch:     findColumn(headers, ["branch", "branch code"], 0),
    center:     findColumn(headers, ["center", "centre", "center name", "nama center", "branch name", "lokasi"], null),
    studentId:  findColumn(headers, ["student id", "studentid", "sid"], 1),
    studentName:findColumn(headers, ["student name", "nama siswa", "name"], 2),
    phone:      findColumn(headers, ["phone number", "phone", "nomor hp", "nomor whatsapp", "whatsapp", "no hp"], 3),
    parentsName:findColumn(headers, ["parents name", "parent name", "nama parent", "nama orang tua", "parents"], 4),
    retentionX: findColumn(headers, ["retention x", "retention_x", "retention", "ret x"], 5),
    expiryDate: findColumn(headers, ["expiry date", "expired date", "membership berakhir", "end date"], 6)
  };

  const parsed = [];
  for (const row of dataRows) {
    if (!row || row.length < 3) continue;
    const studentId   = cleanCell(row[col.studentId]);
    const studentName = cleanCell(row[col.studentName]);
    const phone       = cleanCell(row[col.phone]);
    if (!studentId && !studentName && !phone) continue;
    if (isBadRow(studentId) || isBadRow(studentName) || isBadRow(phone)) continue;
    const branch = cleanCell(row[col.branch]);
    const center = col.center !== null ? cleanCell(row[col.center]) : "";
    parsed.push({
      branch,
      center: center || branch || "Center belum tersedia",
      studentId,
      studentName,
      phone,
      normalizedPhone: normalizePhone(phone),
      parentsName: cleanCell(row[col.parentsName]),
      retentionX: parseInt(cleanCell(row[col.retentionX]), 10) || 0,
      expiryDateRaw: cleanCell(row[col.expiryDate]),
      expiryDate: formatDisplayDate(cleanCell(row[col.expiryDate]))
    });
  }
  ALL_STUDENTS = parsed;
}

// ============================================================
// PROCESS: ATTENDANCE DATA
// ============================================================

function processAttendanceRows(rows) {
  if (!rows.length) return;
  const headers = rows[0].map(h => normalizeHeader(h));
  const dataRows = rows.slice(1);

  const col = {
    studentId:    findColumn(headers, ["student id", "studentid"], 0),
    studentName:  findColumn(headers, ["student name", "nama siswa"], 1),
    center:       findColumn(headers, ["center", "centre"], 2),
    date:         findColumn(headers, ["date", "tanggal"], 3),
    class_:       findColumn(headers, ["class", "kelas"], 4),
    status:       findColumn(headers, ["status", "attendance"], 5),
    makeupReason: findColumn(headers, ["makeup reason", "makeup_reason", "reason"], 6),
    type:         findColumn(headers, ["type"], 7),
  };

  ALL_ATTENDANCE = dataRows
    .filter(r => r && cleanCell(r[col.studentId]) && cleanCell(r[col.studentId]) !== "nan")
    .map(r => ({
      studentId:    cleanCell(r[col.studentId]),
      studentName:  cleanCell(r[col.studentName]),
      center:       cleanCell(r[col.center]),
      date:         cleanCell(r[col.date]),
      class_:       cleanCell(r[col.class_]),
      status:       cleanCell(r[col.status]),
      makeupReason: cleanCell(r[col.makeupReason]),
      type:         cleanCell(r[col.type]),
    }));
}

// ============================================================
// PROCESS: MEMBERSHIP BACKUP (WA links)
// ============================================================

function processBackupRows(rows) {
  if (!rows.length) return;
  const headers = rows[0].map(h => normalizeHeader(h));
  const dataRows = rows.slice(1);

  const col = {
    studentId: findColumn(headers, ["student id", "student_id"], 0),
    sarName:   findColumn(headers, ["student advisor retention", "student_advisor_retention", "sar", "sar name"], 8),
    waLink:    findColumn(headers, ["link wa", "wa link", "link_wa", "wa"], 10),
  };

  ALL_BACKUP = dataRows
    .filter(r => r && cleanCell(r[col.studentId]))
    .map(r => ({
      studentId: cleanCell(r[col.studentId]),
      sarName:   cleanCell(r[col.sarName]),
      waLink:    cleanCell(r[col.waLink]),
    }));
}

// ============================================================
// LOOKUP FUNCTIONS
// ============================================================

function findByPhone(rawInput) {
  const needle = normalizePhone(rawInput);
  const matched = ALL_STUDENTS.filter(s => s.normalizedPhone && s.normalizedPhone === needle);
  if (!matched.length) return [];
  const byStudent = {};
  matched.forEach(s => {
    if (!s.studentId) return;
    if (!byStudent[s.studentId] || s.retentionX > byStudent[s.studentId].retentionX) {
      byStudent[s.studentId] = s;
    }
  });
  return Object.values(byStudent).sort((a, b) => String(a.studentId).localeCompare(String(b.studentId)));
}

function getAttendanceByStudentId(studentId) {
  return ALL_ATTENDANCE
    .filter(r => r.studentId === studentId)
    .sort((a, b) => {
      const da = new Date(a.date), db = new Date(b.date);
      return db - da;
    });
}

function getWaLinkByStudentId(studentId) {
  const record = ALL_BACKUP.find(r => r.studentId === studentId);
  if (!record) return null;
  const link = record.waLink;
  if (!link || !link.startsWith("https://wa.me")) return null;
  return link;
}

function getSarNameByStudentId(studentId) {
  const record = ALL_BACKUP.find(r => r.studentId === studentId);
  return record ? record.sarName : "";
}

// ============================================================
// PAGES
// ============================================================

function renderBrandLogo(size = "default") {
  const imgClass = size === "small" ? "logo-img small" : "logo-img";
  return `<div class="logo-wrap">
    <img src="${LOGO_URL}" class="${imgClass}" alt="Sparks Sports Academy"
      onerror="this.style.display='none';this.nextElementSibling.style.display='block';"/>
    <div class="logo-fallback ${size === "small" ? "white" : ""}" style="display:none;">
      Sparks <span class="star">★</span>
    </div>
  </div>`;
}

// ---- LP1 ----
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
      <p class="small-note">Butuh bantuan? Hubungi <a href="${TELESALES_WA}" target="_blank" style="color:var(--green);font-weight:700;">Tim Customer Support Sparks Sports</a> untuk pengecekan data membership.</p>
    </div>
  `;
  const phoneInput = document.getElementById("phone");
  phoneInput.addEventListener("input", function () { this.value = this.value.replace(/[^0-9]/g, ""); });
  phoneInput.addEventListener("keydown", function (e) { if (e.key === "Enter") goToDashboard(); });
}

// ---- LOADING ----
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

// ---- NOT FOUND ----
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
      <a class="wa-help-btn" href="${TELESALES_WA}" target="_blank">${ICON_WA} Hubungi Tim Customer Support Sparks Sports</a>
      <br><br>
      <a class="link-button" onclick="backToHome()">← Coba Nomor Lain</a>
    </div>
  `;
}

// ---- ERROR ----
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

// ---- LP2: DASHBOARD ----
function renderDashboardPage(students) {
  document.body.className = "dashboard-page";
  const parentsNameRaw = students[0]?.parentsName || "";
  const formattedParentName = formatGreetingParentName(parentsNameRaw);
  const greeting = formattedParentName ? `Halo, ${escapeHtml(formattedParentName)}! 👋` : "Halo! 👋";
  const phone = new URLSearchParams(window.location.search).get("phone") || "";
  const multiNote = students.length > 1
    ? `<div class="multi-note">👤 ${students.length} anak terdaftar dengan nomor ini.</div>`
    : "";
  const cards = students.map(s => createStudentCard(s, phone)).join("");
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
      ${cards}
      <a class="back-link" onclick="backToHome()">← Cek nomor lain</a>
    </div>
  `;
}

function createStudentCard(student, phone) {
  const centerText = student.center || student.branch || "Center belum tersedia";
  const sid = encodeURIComponent(student.studentId);
  const ph  = encodeURIComponent(phone);
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
      <a class="detail-btn" href="?phone=${ph}&sid=${sid}">📋 Lihat Detail Attendance →</a>
    </div>
  `;
}

// ---- LP3: STUDENT DETAIL ----
function renderDetailPage(student, attendance, waLink, sarName, phone) {
  document.body.className = "dashboard-page";
  const centerText = student.center || student.branch || "Center belum tersedia";
  const ph = encodeURIComponent(phone || "");

  const waTarget = waLink || TELESALES_WA;
  const waLabel  = waLink
    ? (sarName ? `Hubungi Student Advisor Retention (${escapeHtml(sarName)})` : "Hubungi Student Advisor Retention")
    : `Hubungi ${TELESALES_LABEL}`;

  // Extract unique class names from attendance for tabs
  // Use simplifyClassName to get short label, store original for filter
  const classMap = {};  // short label → original class_ values that map to it
  attendance.forEach(r => {
    const short = getClassLabel(r.class_);
    if (!classMap[short]) classMap[short] = new Set();
    classMap[short].add(r.class_);
  });
  const classKeys = Object.keys(classMap);  // unique short class labels

  // Build tabs HTML — "Semua" always first, then per class
  const tabsHtml = [
    `<button class="class-tab active" onclick="lp3SwitchClass(event, '__all__')">Semua</button>`,
    ...classKeys.map(k => `<button class="class-tab" onclick="lp3SwitchClass(event, ${JSON.stringify(k)})">${escapeHtml(k)}</button>`)
  ].join("");

  app.innerHTML = `
    <div class="topbar topbar-detail">
      <a class="topbar-back" href="?phone=${ph}">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><polyline points="15 18 9 12 15 6"/></svg>
      </a>
      <div class="topbar-logo">
        <div class="topbar-logo-inner">
          <img src="${LOGO_URL}" class="logo-img small" alt="Sparks Sports Academy"
            onerror="this.style.display='none';this.nextElementSibling.style.display='block';"/>
          <div class="logo-fallback white" style="display:none;">Sparks <span class="star">★</span></div>
        </div>
      </div>
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

      <div class="class-tabs-wrap">
        ${tabsHtml}
      </div>

      <div class="metrics-row" id="lp3-metrics"></div>

      <div class="att-card">
        <div class="att-header">
          <div class="att-title" id="lp3-att-title">Riwayat Kehadiran</div>
          <div class="att-period">Periode ini</div>
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

      <a class="wa-help-btn wa-help-btn--full" href="${waTarget}" target="_blank">
        ${ICON_WA} ${waLabel}
      </a>
      <a class="back-link" href="?phone=${ph}">← Kembali ke daftar anak</a>
    </div>
  `;

  // Store attendance on window for tab switching
  window._lp3Attendance = attendance;
  window._lp3ClassMap   = classMap;

  // Render initial state — all classes
  lp3RenderTab("__all__");
}

function lp3SwitchClass(event, classKey) {
  document.querySelectorAll(".class-tab").forEach(t => t.classList.remove("active"));
  event.currentTarget.classList.add("active");
  lp3RenderTab(classKey);
}

function lp3RenderTab(classKey) {
  const all = window._lp3Attendance || [];
  const classMap = window._lp3ClassMap || {};

  // Filter attendance rows for this tab
  const rows = classKey === "__all__"
    ? all
    : all.filter(r => getClassLabel(r.class_) === classKey);

  // Metrics
  const totalHadir   = rows.filter(r => r.status.toLowerCase() === "present").length;
  const totalSessions = rows.filter(r => r.type === "Regular").length;
  const izinUsed     = rows.filter(r => /izin/i.test(r.makeupReason)).length;
  const izinSisa     = Math.max(0, 2 - izinUsed);

  // Metric cards — 2 only: total hadir + kuota tersisa
  const metricHadir = `
    <div class="metric-card">
      <div class="metric-icon metric-green">✓</div>
      <div class="metric-val">${totalHadir}<span class="metric-unit"> sesi</span></div>
      <div class="metric-lbl">Total hadir</div>
      <div class="metric-sub">dari ${totalSessions} sesi periode ini</div>
    </div>`;

  const metricMakeup = izinSisa === 0
    ? `<div class="metric-card metric-card--warn">
        <div class="metric-icon metric-red">✕</div>
        <div class="metric-val">0<span class="metric-unit"> tersisa</span></div>
        <div class="metric-lbl">Kuota make up habis</div>
        <div class="metric-sub">Izin tidak bisa di-make up lagi</div>
      </div>`
    : `<div class="metric-card">
        <div class="metric-icon metric-purple">↺</div>
        <div class="metric-val">${izinSisa}<span class="metric-unit"> tersisa</span></div>
        <div class="metric-lbl">Kuota make up tersisa</div>
        <div class="metric-sub">dari 2 kuota per periode</div>
      </div>`;

  document.getElementById("lp3-metrics").innerHTML = metricHadir + metricMakeup;

  // Update table title
  const titleEl = document.getElementById("lp3-att-title");
  if (titleEl) {
    titleEl.textContent = classKey === "__all__"
      ? "Riwayat Kehadiran"
      : `Riwayat Kehadiran · ${classKey}`;
  }

  // Table rows
  const tbody = document.getElementById("lp3-tbody");
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="att-empty">Belum ada data attendance untuk periode ini.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const classShort = simplifyClassName(r.class_);
    const { badge, dot } = getStatusBadge(r.status, r.makeupReason);
    const reasonTag = r.makeupReason && r.makeupReason !== "Regular Class" && r.makeupReason !== ""
      ? `<span class="reason-tag">${escapeHtml(r.makeupReason)}</span>`
      : "";
    return `<tr>
      <td><span class="att-dot-inline ${dot}"></span>${escapeHtml(r.date)}</td>
      <td>${escapeHtml(classShort)}${reasonTag}</td>
      <td><span class="att-badge ${badge}">${escapeHtml(r.status)}</span></td>
    </tr>`;
  }).join("");
}

// Get short class label from raw class_ string for tab grouping
// Format: "CENTER | AgeGroup | Sport | Day | Time | Room" → "Sport"
function getClassLabel(raw) {
  if (!raw) return "Kelas";
  const parts = raw.split("|").map(p => p.trim());
  if (parts.length >= 3) return parts[2];
  return raw;
}

// ============================================================
// EXPIRY BANNER
// ============================================================

function createExpiryBanner(expiryStr) {
  const date = parseExpiryDate(expiryStr);
  if (!date) {
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

function simplifyClassName(raw) {
  if (!raw) return "";
  const parts = raw.split("|").map(p => p.trim());
  // Format: CENTER | AgeGroup | Sport | Day | Time | Room
  if (parts.length >= 5) return `${parts[2]} · ${parts[3]} ${parts[4]}`;
  return raw;
}

function getStatusBadge(status, reason) {
  const s = status.toLowerCase();
  const r = (reason || "").toLowerCase();
  if (s === "present" && (r === "regular class" || r === "")) return { badge: "badge-present", dot: "dot-present" };
  if (s === "present" || s === "make up")                      return { badge: "badge-makeup",  dot: "dot-makeup"  };
  if (s === "absent")                                           return { badge: "badge-absent",  dot: "dot-absent"  };
  if (s === "leave")                                            return { badge: "badge-leave",   dot: "dot-leave"   };
  return { badge: "badge-present", dot: "dot-present" };
}

function findHeaderIndex(rows) {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const joined = rows[i].map(c => normalizeHeader(c)).join(" | ");
    if ((joined.includes("student") || joined.includes("siswa")) && joined.includes("phone")) return i;
    if (joined.includes("phone") && joined.includes("expiry")) return i;
  }
  return 0;
}

function findColumn(headers, names, fallback) {
  for (const name of names) {
    const n = normalizeHeader(name);
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

function cleanCell(v) { return (v === null || v === undefined) ? "" : String(v).trim(); }
function normalizeHeader(v) { return cleanCell(v).toLowerCase().replace(/\s+/g," ").replace(/[_-]+/g," ").trim(); }

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
  const monthMap = {jan:0,january:0,feb:1,february:1,mar:2,march:2,apr:3,april:3,may:4,mei:4,jun:5,june:5,juni:5,jul:6,july:6,juli:6,aug:7,august:7,agu:7,agustus:7,sep:8,sept:8,september:8,oct:9,october:9,okt:9,oktober:9,nov:10,november:10,dec:11,december:11,des:11,desember:11};
  let m;
  m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2]-1, +m[3]);
  m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) { let y=+m[3]; if(y<100)y+=2000; return +m[1]>12 ? new Date(y,+m[2]-1,+m[1]) : new Date(y,+m[1]-1,+m[2]); }
  m = raw.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{2,4})$/);
  if (m) { let y=+m[3]; if(y<100)y+=2000; if(monthMap[m[2].toLowerCase()]!==undefined) return new Date(y,monthMap[m[2].toLowerCase()],+m[1]); }
  m = raw.match(/^(\d{1,2})-([A-Za-z]+)-(\d{2,4})$/);
  if (m) { let y=+m[3]; if(y<100)y+=2000; if(monthMap[m[2].toLowerCase()]!==undefined) return new Date(y,monthMap[m[2].toLowerCase()],+m[1]); }
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
  const target = new Date(date); target.setHours(0,0,0,0);
  return Math.round((target - today) / 86400000);
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
  if (!raw) { alert("Masukkan nomor WhatsApp terlebih dahulu."); return; }
  if (raw.length < 9) { alert("Nomor terlalu pendek"); return; }
  const phone = normalizePhone(raw);
  btn.textContent = "Mencari...";
  btn.disabled = true;
  window.location.href = `${window.location.pathname}?phone=${encodeURIComponent(phone)}`;
}

function backToHome() { window.location.href = window.location.pathname; }
