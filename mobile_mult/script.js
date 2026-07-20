const SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbw4UALN0yNpVXjQmX8L0CNlOQj1nsgbbvqckfkZTlGaLWEdsmOUPq5Qmikws8PJ97-x/exec";

// הקטלוג נטען מקובץ ה-CSV שבשורש הפרויקט.
// כל שורה בקובץ היא צירוף של מכונה + מתנה, כך שניתן להגדיר מתנות שונות לכל מכונה.
const CSV_URL = "../machines-gifts.csv";

const COL = {
  machineId: "מזהה מכונה",
  machineSku: "מק״ט מכונה",
  machineName: "שם מכונה",
  machineDesc: "תיאור מכונה",
  machineImage: "תמונת מכונה",
  giftId: "מזהה מתנה",
  giftSku: "מק״ט מתנה",
  giftName: "שם מתנה",
  giftDesc: "תיאור מתנה",
  giftImage: "תמונת מתנה",
};

// גיבוי: משמש אם טעינת ה-CSV נכשלת, כדי שהאתר לעולם לא יישאר ריק.
const FALLBACK_CATALOG = {
  machines: [
    { id: "solo", sku: "", name: "Caffeo Solo", desc: "מכונה קומפקטית וקלה לתפעול", image: "c1.jpg" },
    { id: "purista", sku: "", name: "Purista", desc: "עיצוב מינימליסטי ואינטואיטיבי", image: "purista.jpg" },
    { id: "baristaTS", sku: "", name: "Barista T Smart", desc: "טכנולוגיה חכמה וגמישות מרבית", image: "barista-ts.jpg" },
    { id: "avanza", sku: "", name: "Avanza", desc: "פתרון קפה משפחתי איכותי", image: "avanza.jpg" },
  ],
  gifts: [
    { id: "lifeP3", sku: "", name: "Soundcore Life P3", desc: "אוזניות אלחוטיות עם ביטול רעשים אקטיבי", image: "gift-lifep3.jpg" },
    { id: "spaceA40", sku: "", name: "Soundcore Space A40", desc: "ביטול רעשים אדפטיבי וסוללה ארוכה", image: "gift-spacea40.jpg" },
    { id: "liberty4", sku: "", name: "Soundcore Liberty 4", desc: "איכות סאונד פרימיום עם ANC", image: "gift-liberty4.png" },
    { id: "r50i", sku: "", name: "Soundcore R50i NC", desc: "אוזניות ספורט עמידות במים עם ANC", image: "gift-r50i.jpg" },
  ],
  giftsByMachine: null, // null = כל המתנות זמינות לכל מכונה
};

let catalog = FALLBACK_CATALOG;
let machineById = {};
let giftById = {};

const state = {
  machine: null,
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  gift: null,
};

// חשבונית (רשות) - נקראת ל-base64 בעת בחירת קובץ.
const invoice = { data: null, name: "", type: "" };
const INVOICE_MAX_BYTES = 5 * 1024 * 1024;

function submitToSheet() {
  if (!SHEETS_WEBHOOK_URL || SHEETS_WEBHOOK_URL === "YOUR_APPS_SCRIPT_WEB_APP_URL") return;

  const machine = machineById[state.machine] || {};
  const gift = giftById[state.gift] || {};

  fetch(SHEETS_WEBHOOK_URL, {
    method: "POST",
    body: JSON.stringify({
      ...state,
      machineLabel: machine.name || state.machine,
      machineSku: machine.sku || "",
      giftLabel: gift.name || state.gift,
      giftSku: gift.sku || "",
      invoiceData: invoice.data,
      invoiceName: invoice.name,
      invoiceType: invoice.type,
    }),
  }).catch((err) => console.error("Failed to save registration:", err));
}

/* ============ טעינת הקטלוג מה-CSV ============ */

// פרסר CSV: מטפל בשדות במרכאות, פסיקים בתוך שדה, מרכאות כפולות ו-CRLF.
function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // הסרת BOM

  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
// eslint-disable-next-line no-empty
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }

  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function buildCatalog(rows) {
  const header = rows[0].map((h) => h.trim());
  const idx = {};
  header.forEach((h, i) => (idx[h] = i));

  // אם הכותרות לא תואמות - נחזיר קטלוג ריק כדי שייעשה שימוש בגיבוי.
  if (idx[COL.machineId] === undefined || idx[COL.giftId] === undefined) {
    return { machines: [], gifts: [], giftsByMachine: null };
  }

  const get = (row, col) => (idx[col] !== undefined ? (row[idx[col]] || "").trim() : "");

  const machines = new Map();
  const gifts = new Map();
  const giftsByMachine = {};

  rows.slice(1).forEach((row) => {
    const mId = get(row, COL.machineId);
    const gId = get(row, COL.giftId);

    if (mId && !machines.has(mId)) {
      machines.set(mId, {
        id: mId,
        sku: get(row, COL.machineSku),
        name: get(row, COL.machineName),
        desc: get(row, COL.machineDesc),
        image: get(row, COL.machineImage),
      });
    }

    if (gId && !gifts.has(gId)) {
      gifts.set(gId, {
        id: gId,
        sku: get(row, COL.giftSku),
        name: get(row, COL.giftName),
        desc: get(row, COL.giftDesc),
        image: get(row, COL.giftImage),
      });
    }

    if (mId && gId) {
      if (!giftsByMachine[mId]) giftsByMachine[mId] = [];
      if (!giftsByMachine[mId].includes(gId)) giftsByMachine[mId].push(gId);
    }
  });

  return {
    machines: Array.from(machines.values()),
    gifts: Array.from(gifts.values()),
    giftsByMachine,
  };
}

async function loadCatalog() {
  try {
    const res = await fetch(CSV_URL);
    if (!res.ok) throw new Error("HTTP " + res.status);

    const built = buildCatalog(parseCSV(await res.text()));
    if (!built.machines.length || !built.gifts.length) throw new Error("catalog is empty");

    catalog = built;
  } catch (err) {
    console.warn("CSV load failed - using built-in catalog:", err);
    catalog = FALLBACK_CATALOG;
  }

  machineById = {};
  catalog.machines.forEach((m) => (machineById[m.id] = m));
  giftById = {};
  catalog.gifts.forEach((g) => (giftById[g.id] = g));

  renderMachines();
}

/* ============ רינדור כרטיסים ============ */

function buildCard(item, cardClass, dataKey, iconChar) {
  const card = document.createElement("article");
  card.className = cardClass;
  card.dataset[dataKey] = item.id;
  card.tabIndex = 0;
  card.setAttribute("role", "option");
  card.setAttribute("aria-selected", "false");

  if (item.image) {
    const img = document.createElement("img");
    img.src = item.image;
    img.alt = item.name || "";
    img.className = cardClass + "-image";
    card.appendChild(img);
  } else {
    const icon = document.createElement("div");
    icon.className = cardClass === "machine-card" ? "machine-card-icon" : "gift-icon";
    icon.textContent = iconChar;
    card.appendChild(icon);
  }

  const h3 = document.createElement("h3");
  h3.textContent = item.name || "";
  card.appendChild(h3);

  const p = document.createElement("p");
  p.textContent = item.desc || "";
  card.appendChild(p);

  return card;
}

function renderMachines() {
  machineGrid.innerHTML = "";
  catalog.machines.forEach((m) => machineGrid.appendChild(buildCard(m, "machine-card", "machine", "☕")));
}

// מציג רק את המתנות המשויכות למכונה שנבחרה (לפי שורות ה-CSV).
function renderGiftsFor(machineId) {
  const allowed = catalog.giftsByMachine && catalog.giftsByMachine[machineId];
  const list = allowed ? catalog.gifts.filter((g) => allowed.includes(g.id)) : catalog.gifts;

  giftGrid.innerHTML = "";
  list.forEach((g) => giftGrid.appendChild(buildCard(g, "gift-card", "gift", "🎧")));

  state.gift = null;
  confirmGiftButton.disabled = true;
}

/* ============ ניווט בין מסכים ============ */

const screens = {
  0: document.getElementById("screen-0"),
  1: document.getElementById("screen-1"),
  2: document.getElementById("screen-2"),
  confirm: document.getElementById("screen-confirm"),
};

const dots = document.querySelectorAll(".dot");

function goToScreen(key) {
  Object.values(screens).forEach((el) => el.classList.remove("active"));
  screens[key].classList.add("active");

  dots.forEach((dot) => {
    dot.classList.toggle("active", dot.dataset.step === String(key));
  });
}

/* ============ מסך 0: בחירת מכונה ============ */

const machineGrid = document.getElementById("machine-grid");
const startButton = document.getElementById("start-button");

machineGrid.addEventListener("click", (e) => {
  const card = e.target.closest(".machine-card");
  if (card) selectMachine(card);
});

machineGrid.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    const card = e.target.closest(".machine-card");
    if (card) {
      e.preventDefault();
      selectMachine(card);
    }
  }
});

function selectMachine(card) {
  machineGrid.querySelectorAll(".machine-card").forEach((c) => {
    c.classList.remove("selected");
    c.setAttribute("aria-selected", "false");
  });
  card.classList.add("selected");
  card.setAttribute("aria-selected", "true");

  state.machine = card.dataset.machine;
  startButton.disabled = false;
}

startButton.addEventListener("click", () => {
  if (!state.machine) return;
  goToScreen(1);
});

/* ============ מסך 1: פרטים אישיים ============ */

const detailsForm = document.getElementById("details-form");

const validators = {
  firstName: (v) => v.trim().length >= 2,
  lastName: (v) => v.trim().length >= 2,
  phone: (v) => /^0\d{1,2}-?\d{7}$/.test(v.trim().replace(/\s/g, "")),
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
};

const errorText = {
  firstName: "יש להזין שם פרטי תקין",
  lastName: "יש להזין שם משפחה תקין",
  phone: "יש להזין מספר טלפון תקין",
  email: "יש להזין כתובת אימייל תקינה",
};

function validateField(name) {
  const input = detailsForm.elements[name];
  const errorEl = detailsForm.querySelector(`[data-error-for="${name}"]`);
  const isValid = validators[name](input.value);

  input.classList.toggle("invalid", !isValid);
  errorEl.textContent = isValid ? "" : errorText[name];

  return isValid;
}

detailsForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const fields = ["firstName", "lastName", "phone", "email"];
  const allValid = fields.map(validateField).every(Boolean);

  if (!allValid) return;

  fields.forEach((name) => {
    state[name] = detailsForm.elements[name].value.trim();
  });

  const machineName = (machineById[state.machine] || {}).name || "";
  document.getElementById("screen2-title").textContent =
    `🎁 בחרו את המתנה שלכם למכונת ה-${machineName}`;

  renderGiftsFor(state.machine);
  goToScreen(2);
});

["firstName", "lastName", "phone", "email"].forEach((name) => {
  detailsForm.elements[name].addEventListener("blur", () => {
    if (detailsForm.elements[name].value.trim()) validateField(name);
  });
});

const invoiceInput = document.getElementById("invoice");
const invoiceError = detailsForm.querySelector('[data-error-for="invoice"]');
const invoiceHint = document.getElementById("invoice-hint");

invoiceInput.addEventListener("change", () => {
  invoice.data = null;
  invoice.name = "";
  invoice.type = "";
  invoiceError.textContent = "";

  const file = invoiceInput.files[0];
  if (!file) {
    invoiceHint.textContent = "תמונה או PDF, עד 5MB";
    return;
  }

  const isAllowed = file.type.startsWith("image/") || file.type === "application/pdf";
  if (!isAllowed) {
    invoiceError.textContent = "יש להעלות קובץ תמונה או PDF בלבד";
    invoiceInput.value = "";
    return;
  }
  if (file.size > INVOICE_MAX_BYTES) {
    invoiceError.textContent = "הקובץ גדול מדי (מקסימום 5MB)";
    invoiceInput.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    invoice.data = String(reader.result).split(",")[1] || "";
    invoice.name = file.name;
    invoice.type = file.type;
    invoiceHint.textContent = "✓ נבחר: " + file.name;
  };
  reader.onerror = () => {
    invoiceError.textContent = "שגיאה בקריאת הקובץ, נסו שוב";
  };
  reader.readAsDataURL(file);
});

/* ============ מסך 2: בחירת מתנה ============ */

const giftGrid = document.getElementById("gift-carousel");
const confirmGiftButton = document.getElementById("confirm-gift-button");

giftGrid.addEventListener("click", (e) => {
  const card = e.target.closest(".gift-card");
  if (card) selectGift(card);
});

giftGrid.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    const card = e.target.closest(".gift-card");
    if (card) {
      e.preventDefault();
      selectGift(card);
    }
  }
});

function selectGift(card) {
  giftGrid.querySelectorAll(".gift-card").forEach((c) => {
    c.classList.remove("selected");
    c.setAttribute("aria-selected", "false");
  });
  card.classList.add("selected");
  card.setAttribute("aria-selected", "true");
  card.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });

  state.gift = card.dataset.gift;
  confirmGiftButton.disabled = false;
}

document.getElementById("back-button").addEventListener("click", () => {
  goToScreen(1);
});

confirmGiftButton.addEventListener("click", () => {
  if (!state.gift) return;
  renderConfirmation();
  submitToSheet();
  goToScreen("confirm");
});

function renderConfirmation() {
  const details = document.getElementById("confirm-details");
  details.innerHTML = "";

  const machine = machineById[state.machine] || {};
  const gift = giftById[state.gift] || {};

  const rows = [
    ["מכונה שנרכשה", machine.name || ""],
    ["שם מלא", `${state.firstName} ${state.lastName}`],
    ["טלפון", state.phone],
    ["אימייל", state.email],
    ["מתנה שנבחרה", gift.name || ""],
  ];

  if (invoice.name) rows.push(["חשבונית", invoice.name]);

  rows.forEach(([label, value]) => {
    const row = document.createElement("div");
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    row.appendChild(dt);
    row.appendChild(dd);
    details.appendChild(row);
  });
}

document.getElementById("restart-button").addEventListener("click", () => {
  detailsForm.reset();
  ["firstName", "lastName", "phone", "email"].forEach((name) => {
    detailsForm.elements[name].classList.remove("invalid");
    detailsForm.querySelector(`[data-error-for="${name}"]`).textContent = "";
  });

  giftGrid.querySelectorAll(".gift-card").forEach((c) => {
    c.classList.remove("selected");
    c.setAttribute("aria-selected", "false");
  });
  confirmGiftButton.disabled = true;

  machineGrid.querySelectorAll(".machine-card").forEach((c) => {
    c.classList.remove("selected");
    c.setAttribute("aria-selected", "false");
  });
  startButton.disabled = true;

  invoice.data = null;
  invoice.name = "";
  invoice.type = "";
  invoiceInput.value = "";
  invoiceError.textContent = "";
  invoiceHint.textContent = "תמונה או PDF, עד 5MB";

  Object.keys(state).forEach((key) => (state[key] = key === "gift" || key === "machine" ? null : ""));

  goToScreen(0);
});

/* ============ אתחול ============ */
loadCatalog();
