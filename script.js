// ============================================================
// SPARKS MEMBERSHIP CARD - GITHUB PAGES VERSION
// Method: GitHub Pages + Published Google Sheets CSV + PapaParse
// No Apps Script needed
// ============================================================

// GANTI URL DI BAWAH INI DENGAN LINK CSV GOOGLE SHEETS KAMU
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTosLyHAecGLxPdg4ULsnx11VimQuzvcjD6pCEiTJWPtrLY0ckPVHahmkax46woBS6MhCKK4Qntjy2O/pub?gid=0&single=true&output=csv";

// Fallback proxy kalau direct CSV gagal karena CORS/network issue
const PROXY_CSV_URL = "https://api.allorigins.win/raw?url=" + encodeURIComponent(SHEET_CSV_URL);

const app = document.getElementById("app");

let ALL_STUDENTS = [];
let DATA_READY = false;
let DATA_ERROR = "";

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

  renderLoadingPage("Mencari Data", "Kami sedang mengecek status membership si kecil.");
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
    DATA_ERROR = "Link Google Sheets CSV belum diisi di file script.js.";
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
      DATA_ERROR = "Data belum bisa dimuat. Pastikan Google Sheets sudah dipublish sebagai CSV dan link CSV di script.js sudah benar.";
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
    throw new Error("Header tidak ditemukan. Pastikan sheet memiliki kolom Branch, Student ID, Student Name, Phone Number, Parents Name, Retention X, dan Expiry Date.");
  }

  const headers = rows[headerIndex].map(h => normalizeHeader(h));
  const dataRows = rows.slice(headerIndex + 1);

  const col = {
    branch: findColumn(headers, ["branch"], 0),
    studentId: findColumn(headers, ["student id", "studentid", "sid"], 1),
    studentName: findColumn(headers, ["student name", "nama siswa", "name"], 2),
    phone: findColumn(headers, ["phone number", "phone", "nomor hp", "nomor whatsapp", "whatsapp"], 3),
    parentsName: findColumn(headers, ["parents name", "parent name", "nama parent", "nama orang tua"], 4),
    retentionX: findColumn(headers, ["retention x", "retention_x", "retention"], 5),
    expiryDate: findColumn(headers, ["expiry date", "expired date", "membership berakhir", "end date"], 6)
  };

  const parsed = [];

  for (const row of dataRows) {
    if (!row || row.length < 3) continue;

    const branch = cleanCell(row[col.branch]);
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
    const hasPhone = joined.includes("phone") || joined.includes("whatsapp") || joined.includes("nomor");
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

function renderLandingPage() {
  document.body.className = "center-page";

  app.innerHTML = `
    <div class="card">
      <div class="logo-green">Sparks <span class="logo-star">★</span></div>
      <div class="logo-sub">Sports Academy</div>
      <div class="divider"></div>

      <p class="headline">Cek Status Membership</p>
      <p class="sub">
        Masukkan nomor WhatsApp yang terdaftar untuk melihat status langganan si kecil.
      </p>

      <label for="phone">Nomor WhatsApp</label>

      <div class="input-row">
        <div class="prefix">+62</div>
        <input
          type="tel"
          id="phone"
          placeholder="8xx xxxx xxxx"
          inputmode="numeric"
          autocomplete="tel"
          maxlength="16"
        />
      </div>

      <p class="hint">Tanpa angka 0 di depan. Contoh: 81234567890</p>

      <button id="btn" onclick="goToDashboard()">Cek Status →</button>

      <p class="small-note">
        Pastikan nomor yang dimasukkan sesuai dengan nomor WhatsApp yang terdaftar di Sparks.
      </p>
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
      <div class="logo-green">Sparks <span class="logo-star">★</span></div>
      <div class="logo-sub">Sports Academy</div>
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
      <div class="icon">🔍</div>

      <h2 class="headline">Nomor Tidak Ditemukan</h2>

      <p class="error-text">Kami tidak menemukan data untuk nomor:</p>

      <div class="phone-box">+${escapeHtml(normalizePhone(phone))}</div>

      <p class="error-text">
        Pastikan nomor yang dimasukkan sesuai dengan nomor yang terdaftar di Sparks.
        Jika masih belum ditemukan, hubungi SAR kamu ya.
      </p>

      <br><br>

      <a class="link-button" onclick="backToHome()">← Coba Lagi</a>
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

      <br><br>

      <a class="link-button" onclick="backToHome()">← Kembali</a>
    </div>
  `;
}

function renderDashboardPage(students) {
  document.body.className = "dashboard-page";

  const parentsName = students[0]?.parentsName || "";
  const greeting = parentsName
    ? `Halo, ${escapeHtml(parentsName)}! 👋`
    : "Halo! 👋";

  const multiNote = students.length > 1
    ? `<div class="multi-note">👤 ${students.length} anak terdaftar di nomor ini.</div>`
    : "";

  const cards = students.map(createStudentCard).join("");

  app.innerHTML = `
    <div class="topbar">
      <div class="topbar-logo">Sparks ★ Sports Academy</div>
    </div>

    <div class="wrap">
      <div class="greeting-card">
        <div class="greeting-text">${greeting}</div>
        <div class="greeting-sub">Berikut status membership si kecil di Sparks.</div>
      </div>

      ${multiNote}
      ${cards}

      <a class="back-link" onclick="backToHome()">← Cek nomor lain</a>
    </div>
  `;
}

function createStudentCard(student) {
  return `
    <div class="student-card">
      <div class="card-top">
        <div class="avatar">${getInitials(student.studentName)}</div>

        <div class="card-info">
          <div class="student-name">${escapeHtml(student.studentName || "Nama belum tersedia")}</div>
          <div class="student-id">${escapeHtml(student.studentId || "")}</div>
          <div class="branch-badge">${escapeHtml(student.branch || "Branch belum tersedia")}</div>
        </div>
      </div>

      ${createExpiryBanner(student.expiryDate)}

      <div class="info-row">
        <span class="info-label">Nomor HP</span>
        <span class="info-val">+${escapeHtml(student.normalizedPhone || student.phone || "-")}</span>
      </div>

      <div class="info-row">
        <span class="info-label">Parent</span>
        <span class="info-val">${escapeHtml(student.parentsName || "-")}</span>
      </div>
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
        <div class="ex-msg">Hubungi SAR untuk konfirmasi status membership.</div>
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
    msg = "Yuk segera perpanjang agar tidak ketinggalan sesi!";
  } else if (days === 0) {
    cls = "expiry-urgent";
    daysText = "Hari ini!";
    msg = "Segera hubungi SAR untuk perpanjangan.";
  } else if (days <= 14) {
    cls = "expiry-urgent";
    daysText = `${days} hari lagi`;
    msg = "Segera perpanjang agar membership tetap aktif.";
  } else if (days <= 30) {
    cls = "expiry-soon";
    daysText = `${days} hari lagi`;
    msg = "Membership akan segera berakhir. Jangan lupa perpanjang ya!";
  } else {
    cls = "expiry-active";
    daysText = `${days} hari lagi`;
    msg = "Membership masih aktif.";
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
    alert("Masukkan nomor WhatsApp kamu dulu ya.");
    return;
  }

  if (raw.length < 9) {
    alert("Nomor terlalu pendek, coba lagi.");
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

  if (p.startsWith("0")) {
    p = "62" + p.slice(1);
  }

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

    // Default Google Sheets CSV Indonesia sering tetap aman kalau berupa MM/DD/YYYY
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

  const parts = clean.split(/\s+/);

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