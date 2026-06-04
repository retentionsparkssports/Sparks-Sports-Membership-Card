// ============================================================
// SPARKS MEMBERSHIP CARD - GITHUB PAGES VERSION
// Method: GitHub Pages + Published Google Sheets CSV + PapaParse
// No Apps Script
// ============================================================

// WAJIB DIGANTI DENGAN LINK CSV GOOGLE SHEETS KAMU
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTosLyHAecGLxPdg4ULsnx11VimQuzvcjD6pCEiTJWPtrLY0ckPVHahmkax46woBS6MhCKK4Qntjy2O/pub?gid=2025872883&single=true&output=csv";

// Logo asli Sparks. Upload file logo ke root repository dengan nama logo.png
const LOGO_URL = "logo.png";

// Fallback proxy kalau direct CSV gagal
const PROXY_CSV_URL = "https://api.allorigins.win/raw?url=" + encodeURIComponent(SHEET_CSV_URL);

const app = document.getElementById("app");

let ALL_STUDENTS = [];
let DATA_READY = false;
let DATA_ERROR = "";

// ============================================================
// ICONS
// ============================================================

const ICON_PHONE = `
  <svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 16.92v2.2a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 3.4 2 2 0 0 1 4.11 1.2h2.2a2 2 0 0 1 2 1.72c.13.96.35 1.9.66 2.8a2 2 0 0 1-.45 2.1L7.6 8.75a16 16 0 0 0 7.65 7.65l.93-.93a2 2 0 0 1 2.1-.45c.9.31 1.84.53 2.8.66A2 2 0 0 1 22 16.92Z"/>
  </svg>
`;

const ICON_SEARCH = `
  <svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="11" cy="11" r="7"></circle>
    <path d="m20 20-3.5-3.5"></path>
  </svg>
`;

// ============================================================
// INIT
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const phone = params.get("phone");

  if (!phone) {
    renderLandingPage();
    loadDataInBackground();
    return;
  }

  renderLoadingPage("Mencari data membership", "Mohon tunggu sebentar. Kami sedang mencocokkan nomor WhatsApp yang kamu masukkan.");
  await loadData();

  if (DATA_ERROR) {
    renderErrorPage(DATA_ERROR);
    return;
  }

  const students = findByPhone(phone);

  if (!students.length) {
    renderNotFoundPage(phone);
    return;
  }

  renderDashboardPage(students);
});

// ============================================================
// DATA LOADING
// ============================================================

async function loadDataInBackground() {
  await loadData();
}

async function loadData() {
  if (DATA_READY) return;

  if (!SHEET_CSV_URL || SHEET_CSV_URL.includes("PASTE_LINK_CSV")) {
    DATA_ERROR = "Link database belum terhubung. Silakan hubungi tim Sparks untuk pengecekan.";
    return;
  }

  try {
    const rows = await parseRemoteCsv(SHEET_CSV_URL);
    processRows(rows);
    DATA_READY = true;
  } catch (firstError) {
    try {
      const rows = await parseRemoteCsv(PROXY_CSV_URL);
      processRows(rows);
      DATA_READY = true;
    } catch (secondError) {
      DATA_ERROR = "Data membership belum bisa dimuat. Silakan coba beberapa saat lagi atau hubungi Student Advisor Retention untuk bantuan.";
      console.error("Direct CSV error:", firstError);
      console.error("Proxy CSV error:", secondError);
    }
  }
}

function parseRemoteCsv(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      skipEmptyLines: true,
      complete: function (result) {
        if (!result || !result.data || !result.data.length) {
          reject(new Error("CSV kosong atau tidak terbaca."));
          return;
        }

        resolve(result.data);
      },
      error: function (error) {
        reject(error);
      }
    });
  });
}

function processRows(rows) {
  const headerIndex = findHeaderIndex(rows);

  if (headerIndex === -1) {
    throw new Error("Header database tidak ditemukan.");
  }

  const headers = rows[headerIndex].map(h => normalizeHeader(h));
  const dataRows = rows.slice(headerIndex + 1);

  const col = {
    branch: findColumn(headers, ["branch", "branch code", "kode branch"], 0),
    center: findColumn(headers, ["center", "centre", "center name", "nama center", "nama centre", "branch name", "lokasi"], null),
    studentId: findColumn(headers, ["student id", "studentid", "sid", "id siswa"], 1),
    studentName: findColumn(headers, ["student name", "nama siswa", "name", "student"], 2),
    phone: findColumn(headers, ["phone number", "phone", "nomor hp", "nomor whatsapp", "whatsapp", "no hp"], 3),
    parentsName: findColumn(headers, ["parents name", "parent name", "nama parent", "nama orang tua", "parents", "mom name"], 4),
    retentionX: findColumn(headers, ["retention x", "retention_x", "retention", "ret x"], 5),
    expiryDate: findColumn(headers, ["expiry date", "expired date", "membership berakhir", "end date", "tanggal expired", "expired"], 6)
  };

  const parsed = [];

  for (const row of dataRows) {
    if (!row || row.length < 3) continue;

    const branch = cleanCell(row[col.branch]);
    const center = col.center !== null ? cleanCell(row[col.center]) : "";
    const studentId = cleanCell(row[col.studentId]);
    const studentName = cleanCell(row[col.studentName]);
    const phone = cleanCell(row[col.phone]);
    const parentsName = cleanCell(row[col.parentsName]);
    const retentionXRaw = cleanCell(row[col.retentionX]);
    const expiryDateRaw = cleanCell(row[col.expiryDate]);

    if (!studentId && !studentName && !phone) continue;
    if (isBadRow(studentId) || isBadRow(studentName) || isBadRow(phone)) continue;

    parsed.push({
      branch,
      center: center || branch || "Center belum tersedia",
      studentId,
      studentName,
      phone,
      normalizedPhone: normalizePhone(phone),
      parentsName,
      retentionX: parseInt(retentionXRaw, 10) || 0,
      expiryDateRaw,
      expiryDate: formatDisplayDate(expiryDateRaw)
    });
  }

  ALL_STUDENTS = parsed;
}

function findHeaderIndex(rows) {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const joined = rows[i].map(c => normalizeHeader(c)).join(" | ");

    const hasStudent = joined.includes("student") || joined.includes("siswa");
    const hasPhone = joined.includes("phone") || joined.includes("whatsapp") || joined.includes("nomor") || joined.includes("hp");
    const hasExpiry = joined.includes("expiry") || joined.includes("expired") || joined.includes("berakhir");

    if (hasStudent && hasPhone) return i;
    if (hasPhone && hasExpiry) return i;
  }

  return 0;
}

function findColumn(headers, possibleNames, fallbackIndex) {
  for (const name of possibleNames) {
    const normalizedName = normalizeHeader(name);
    const idx = headers.findIndex(h => h === normalizedName || h.includes(normalizedName));
    if (idx !== -1) return idx;
  }

  return fallbackIndex;
}

function isBadRow(value) {
  const v = cleanCell(value).toLowerCase();

  return [
    "",
    "student id",
    "student name",
    "phone number",
    "nomor hp",
    "nomor whatsapp",
    "automated",
    "appscript",
    "#n/a",
    "#value!",
    "#ref!",
    "#num!",
    "#error!"
  ].includes(v);
}

// ============================================================
// LOOKUP LOGIC
// ============================================================

function findByPhone(rawInput) {
  const needle = normalizePhone(rawInput);

  const matched = ALL_STUDENTS.filter(student => {
    return student.normalizedPhone && student.normalizedPhone === needle;
  });

  if (!matched.length) return [];

  const byStudent = {};

  matched.forEach(student => {
    const sid = student.studentId;

    if (!sid) return;

    if (!byStudent[sid] || student.retentionX > byStudent[sid].retentionX) {
      byStudent[sid] = student;
    }
  });

  return Object
    .values(byStudent)
    .sort((a, b) => String(a.studentId).localeCompare(String(b.studentId)));
}

// ============================================================
// PAGES
// ============================================================

function renderBrandLogo(size = "default") {
  const imgClass = size === "small" ? "logo-img small" : "logo-img";

  return `
    <div class="logo-wrap">
      <img
        src="${LOGO_URL}"
        class="${imgClass}"
        alt="Sparks Sports Academy"
        onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
      />
      <div class="logo-fallback ${size === "small" ? "white" : ""}" style="display:none;">
        Sparks <span class="star">★</span>
      </div>
    </div>
  `;
}

function renderLandingPage() {
  document.body.className = "center-page";

  app.innerHTML = `
    <div class="card">
      ${renderBrandLogo()}

      <div class="divider"></div>

      <p class="headline">Cek Status Membership Anak</p>
      <p class="sub">
        Masukkan nomor WhatsApp orang tua yang terdaftar untuk melihat status membership Sparks.
      </p>

      <label for="phone">Nomor WhatsApp</label>

      <div class="input-row has-icon">
        <div class="field-icon">${ICON_PHONE}</div>
        <div class="prefix">+62</div>
        <input
          type="tel"
          id="phone"
          placeholder="8111000549"
          inputmode="numeric"
          autocomplete="tel"
          maxlength="16"
        />
      </div>

      <p class="hint">Tanpa angka 0 di depan. Contoh: 8111000549</p>

      <button id="btn" onclick="goToDashboard()">Cek Status Membership →</button>

      <div class="helper-box">
        <div class="helper-title">Butuh bantuan?</div>
        <div class="helper-copy">
          Jika nomor tidak ditemukan, pastikan nomor yang dimasukkan sama dengan nomor WhatsApp yang terdaftar di Sparks, atau SAR Student Advisor Retention center kamu.
        </div>
      </div>
    </div>
  `;

  const phoneInput = document.getElementById("phone");

  phoneInput.addEventListener("input", function () {
    this.value = this.value.replace(/[^0-9]/g, "");
  });

  phoneInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") goToDashboard();
  });
}

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

      <p class="error-text">
        Coba cek kembali angka yang dimasukkan. Jika nomor sudah benar tetapi data tetap tidak muncul,
        silakan hubungi Student Advisor Retention center kamu untuk pengecekan data.
      </p>

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

      <p class="error-text">
        Silakan muat ulang halaman ini. Jika masih belum bisa, hubungi Student Advisor Retention center kamu untuk pengecekan database.
      </p>

      <br><br>

      <a class="link-button" onclick="backToHome()">← Kembali</a>
    </div>
  `;
}

function renderDashboardPage(students) {
  document.body.className = "dashboard-page";

  const parentsNameRaw = students[0]?.parentsName || "";
  const formattedParentName = formatGreetingParentName(parentsNameRaw);

  const greeting = formattedParentName
    ? `Halo, ${escapeHtml(formattedParentName)}! 👋`
    : "Halo! 👋";

  const multiNote = students.length > 1
    ? `<div class="multi-note">👤 ${students.length} anak terdaftar dengan nomor ini.</div>`
    : "";

  const cards = students.map(createStudentCard).join("");

  app.innerHTML = `
    <div class="topbar">
      <div class="topbar-logo">
        <div class="topbar-logo-inner">
          <img
            src="${LOGO_URL}"
            class="logo-img small"
            alt="Sparks Sports Academy"
            onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
          />
          <div class="logo-fallback white" style="display:none;">
            Sparks <span class="star">★</span> Sports Academy
          </div>
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

function createStudentCard(student) {
  const centerText = student.center || student.branch || "Center belum tersedia";

  return `
    <div class="student-card">
      <div class="card-top">
        <div class="avatar">${getInitials(student.studentName)}</div>

        <div class="card-info">
          <div class="student-name">${escapeHtml(student.studentName || "Nama belum tersedia")}</div>
          <div class="student-id">${escapeHtml(student.studentId || "")}</div>
          <div>
            <span class="center-badge">${escapeHtml(centerText)}</span>
          </div>
        </div>
      </div>

      ${createExpiryBanner(student.expiryDate)}
    </div>
  `;
}
function createExpiryBanner(expiryStr) {
  const date = parseExpiryDate(expiryStr);

  if (!date) {
    return `
      <div class="expiry-box expiry-unknown">
        <div class="ex-label">Membership Berakhir</div>
        <div class="ex-date">Belum tersedia</div>
        <div class="ex-msg">Status membership belum tersedia. Yuk hubungi SAR untuk bantu cek ya.</div>
      </div>
    `;
  }

  const days = daysUntil(date);

  let cls;
  let daysText;
  let msg;

  if (days < 0) {
    cls = "expiry-expired";
    daysText = `${Math.abs(days)} hari yang lalu`;
    msg = "Yah, membership si kecil sudah habis. Yuk perpanjang sekarang supaya tetap bisa lanjut seru-seruan di Sparks!";
  } else if (days === 0) {
    cls = "expiry-urgent";
    daysText = "Berakhir hari ini";
    msg = "Duh, membership si kecil berakhir hari ini nih. Yuk segera perpanjang supaya tetap aktif!";
  } else if (days <= 14) {
    cls = "expiry-urgent";
    daysText = `${days} hari lagi`;
    msg = "Duh, membership si kecil sudah mendekati masa berakhir nih. Yuk segera perpanjang ya!";
  } else if (days <= 30) {
    cls = "expiry-soon";
    daysText = `${days} hari lagi`;
    msg = "Duh, membership si kecil sudah mendekati waktu expired. Yuk mulai perpanjang dari sekarang ya.";
  } else {
    cls = "expiry-active";
    daysText = `${days} hari lagi`;
    msg = "Yeay, membership si kecil masih aktif! Tinggal lanjut latihan dan have fun bareng Sparks!";
  }

  return `
    <div class="expiry-box ${cls}">
      <div class="ex-label">Membership Berakhir</div>
      <div class="ex-date">${escapeHtml(formatDisplayDate(expiryStr))}</div>
      <div class="ex-days">${escapeHtml(daysText)}</div>
      <div class="ex-msg">${escapeHtml(msg)}</div>
    </div>
  `;
}

// ============================================================
// ACTIONS
// ============================================================

function goToDashboard() {
  const input = document.getElementById("phone");
  const btn = document.getElementById("btn");

  let raw = input.value.trim().replace(/[^0-9]/g, "");

  if (!raw) {
    alert("Masukkan nomor WhatsApp terlebih dahulu.");
    return;
  }

  if (raw.length < 9) {
    alert("Nomor terlalu pendek");
    return;
  }

  const phone = normalizePhone(raw);

  btn.textContent = "Mencari...";
  btn.disabled = true;

  window.location.href = `${window.location.pathname}?phone=${encodeURIComponent(phone)}`;
}

function backToHome() {
  window.location.href = window.location.pathname;
}

// ============================================================
// HELPERS
// ============================================================
function formatGreetingParentName(name) {
  const clean = cleanCell(name);

  if (!clean) return "";

  const lower = clean.toLowerCase();

  // Kalau sudah ada panggilan, jangan ditambah lagi
  const alreadyHasParentTitle =
    lower.startsWith("mom") ||
    lower.startsWith("dad") ||
    lower.startsWith("mama") ||
    lower.startsWith("papa") ||
    lower.startsWith("bunda") ||
    lower.startsWith("ayah") ||
    lower.startsWith("ibu") ||
    lower.startsWith("mr") ||
    lower.startsWith("mrs");

  if (alreadyHasParentTitle) {
    return clean;
  }

  // Kalau belum ada, tambahkan prefix netral
  return `Mom/Dad ${clean}`;
}
function cleanCell(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeHeader(value) {
  return cleanCell(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[_-]+/g, " ")
    .trim();
}

function normalizePhone(phone) {
  let p = cleanCell(phone).replace(/[\s\-\(\)\+\.]/g, "");

  if (!p) return "";

  // 081111000549 -> 628111000549
  if (p.startsWith("0")) {
    p = "62" + p.slice(1);
  }

  // 81111000549 -> 628111000549
  else if (p.startsWith("8")) {
    p = "62" + p;
  }

  // 6208111000549 -> 628111000549
  if (p.startsWith("620")) {
    p = "62" + p.slice(3);
  }

  return p;
}

function parseExpiryDate(value) {
  const raw = cleanCell(value);

  if (
    !raw ||
    raw === "-" ||
    raw.toLowerCase() === "not yet renewal" ||
    raw.toLowerCase() === "xxxxx" ||
    raw.startsWith("#")
  ) {
    return null;
  }

  const monthMap = {
    jan: 0,
    january: 0,
    feb: 1,
    february: 1,
    mar: 2,
    march: 2,
    apr: 3,
    april: 3,
    may: 4,
    mei: 4,
    jun: 5,
    june: 5,
    juni: 5,
    jul: 6,
    july: 6,
    juli: 6,
    aug: 7,
    august: 7,
    agu: 7,
    agustus: 7,
    sep: 8,
    sept: 8,
    september: 8,
    oct: 9,
    october: 9,
    okt: 9,
    oktober: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11,
    des: 11,
    desember: 11
  };

  let match;

  // Format: 2026-05-18
  match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  // Format: 18/05/2026 or 5/18/2026
  match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (match) {
    const a = Number(match[1]);
    const b = Number(match[2]);
    let year = Number(match[3]);

    if (year < 100) year += 2000;

    // Kalau angka pertama > 12, hampir pasti DD/MM/YYYY
    if (a > 12) {
      return new Date(year, b - 1, a);
    }

    // Default Google Sheets CSV biasanya MM/DD/YYYY kalau export dari serial date
    return new Date(year, a - 1, b);
  }

  // Format: 18 May 2026 / 18 Mei 2026
  match = raw.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{2,4})$/);
  if (match) {
    const day = Number(match[1]);
    const monthText = match[2].toLowerCase();
    let year = Number(match[3]);

    if (year < 100) year += 2000;

    if (monthMap[monthText] !== undefined) {
      return new Date(year, monthMap[monthText], day);
    }
  }

  // Format: 18-May-2026 / 18-May-26
  match = raw.match(/^(\d{1,2})-([A-Za-z]+)-(\d{2,4})$/);
  if (match) {
    const day = Number(match[1]);
    const monthText = match[2].toLowerCase();
    let year = Number(match[3]);

    if (year < 100) year += 2000;

    if (monthMap[monthText] !== undefined) {
      return new Date(year, monthMap[monthText], day);
    }
  }

  const fallback = new Date(raw);
  return isNaN(fallback.getTime()) ? null : fallback;
}

function formatDisplayDate(value) {
  const date = parseExpiryDate(value);

  if (!date) {
    return cleanCell(value);
  }

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function daysUntil(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  return Math.round((target - today) / 86400000);
}

function getInitials(name) {
  const clean = cleanCell(name).replace(/\s*\(.*\)\s*$/, "").trim();

  if (!clean) return "?";

  const parts = clean.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0][0].toUpperCase();
  }

  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function escapeHtml(value) {
  return cleanCell(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
