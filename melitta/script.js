const SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbw5fPKD2ybNbG-slrFgv4OLLAkji-jypSu33kz_gYgE1WWkZaxk9Zo5S3tkHGh2K_Ih/exec";

// הקטלוג נטען מקובץ ה-CSV שבשורש הפרויקט (מכונות Melitta + מתנה קבועה אחת).
// עמודת התמונה מכילה נתיב יחסי לעמוד: תמונות מכונה ב-img/ ותמונת המתנה ב-../img/.
const CSV_URL = "../melitta-gifts.csv";

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
    { id: "solo-31000", sku: "31000", name: "Melitta Solo Silver", desc: "", image: "img/31000.jpg" },
    { id: "solo-31014", sku: "31014", name: "Melitta Solo Black", desc: "", image: "img/31014.jpg" },
    { id: "solo-31015", sku: "31015", name: "Melitta Solo Pure Silver", desc: "", image: "img/31015.jpg" },
    { id: "solo-31016", sku: "31016", name: "Melitta Solo Pure Black", desc: "", image: "img/31016.jpg" },
    { id: "solo-31017", sku: "31017", name: "Melitta Solo Red", desc: "", image: "img/31017.jpg" },
  ],
  gifts: [
    {
      id: "gift1",
      sku: "51336",
      name: "Soundcore R60i True Wireless",
      desc: "אוזניות TWS עם נרתיק טעינה ותצוגת סוללה",
      image: "img/g_51336.jpg",
    },
  ],
  giftsByMachine: null,
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
  store: "",
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

// יוצר כרטיס. אם התמונה חסרה/נכשלת - נופל בחזרה לאייקון אימוג'י.
function buildCard(item, cardClass, dataKey, iconChar, showDesc) {
  const card = document.createElement("article");
  card.className = cardClass;
  card.dataset[dataKey] = item.id;
  card.tabIndex = 0;
  card.setAttribute("role", "option");
  card.setAttribute("aria-selected", "false");

  const iconClass = cardClass === "machine-card" ? "machine-card-icon" : "gift-icon";

  function addIcon() {
    const icon = document.createElement("div");
    icon.className = iconClass;
    icon.textContent = iconChar;
    return icon;
  }

  if (item.image) {
    const img = document.createElement("img");
    img.src = item.image;
    img.alt = item.name || "";
    img.className = cardClass + "-image";
    img.addEventListener("error", () => {
      if (img.parentNode === card) card.replaceChild(addIcon(), img);
    });
    card.appendChild(img);
  } else {
    card.appendChild(addIcon());
  }

  const h3 = document.createElement("h3");
  h3.textContent = item.name || "";
  card.appendChild(h3);

  if (showDesc && item.desc) {
    const p = document.createElement("p");
    p.textContent = item.desc;
    card.appendChild(p);
  }

  return card;
}

function renderMachines() {
  machineGrid.innerHTML = "";
  catalog.machines.forEach((m) =>
    machineGrid.appendChild(buildCard(m, "machine-card", "machine", "☕", false))
  );
}

// מציג את המתנה הקבועה (מתנה אחת) - נבחרת אוטומטית.
function renderGift() {
  giftGrid.innerHTML = "";
  const gift = catalog.gifts[0];
  if (!gift) {
    confirmGiftButton.disabled = true;
    return;
  }

  const card = buildCard(gift, "gift-card", "gift", "🎁", true);
  card.classList.add("selected");
  card.setAttribute("aria-selected", "true");
  card.removeAttribute("tabindex");
  card.setAttribute("role", "listitem");
  giftGrid.appendChild(card);

  state.gift = gift.id;
  confirmGiftButton.disabled = false;
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
const storeSection = document.querySelector(".store-section");
// מוסתר בטעינה, ומתגלה רק לאחר בחירת מכונה.
if (storeSection) storeSection.classList.add("is-hidden");

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
  if (storeSection) storeSection.classList.remove("is-hidden");
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

  renderGift();
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

/* ---- בורר רשת שיווק ---- */
const storeGrid = document.getElementById("store-grid");
const storeOtherInput = document.getElementById("store-other");
let selectedStoreTile = null;

function currentStoreLabel() {
  if (!selectedStoreTile) return "";
  if (selectedStoreTile.dataset.store === "other") {
    return storeOtherInput.value.trim() || "אחר";
  }
  return selectedStoreTile.dataset.storeLabel || "";
}

storeGrid.addEventListener("click", (e) => {
  const tile = e.target.closest(".store-tile");
  if (!tile) return;

  storeGrid.querySelectorAll(".store-tile").forEach((t) => {
    t.classList.remove("selected");
    t.setAttribute("aria-selected", "false");
  });
  tile.classList.add("selected");
  tile.setAttribute("aria-selected", "true");
  selectedStoreTile = tile;

  if (tile.dataset.store === "other") {
    storeOtherInput.hidden = false;
    storeOtherInput.focus();
  } else {
    storeOtherInput.hidden = true;
    storeOtherInput.value = "";
  }
  state.store = currentStoreLabel();
});

storeOtherInput.addEventListener("input", () => {
  state.store = currentStoreLabel();
});

/* ---- טעינת רשימת החנויות מ-JSON (עם גיבוי מובנה) ---- */
const STORES_URL = "../stores.json";
const STORE_IMG_BASE = "../img/";
const STORES_FALLBACK = [
  { id: "machsanei-hashmal", label: "מחסני חשמל", logo: "s_machsanei.png" },
  { id: "ksp", label: "KSP", logo: "s_ksp.jpg" },
  { id: "bug", label: "באג", logo: "s_bug.png" },
  { id: "shekem-electric", label: "שקם אלקטריק" },
  { id: "other", label: "אחר", icon: "➕", other: true },
];

function renderStores(list) {
  storeGrid.innerHTML = "";
  list.forEach((s) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "store-tile" + (s.logo ? "" : " store-tile--text");
    btn.dataset.store = s.id;
    btn.dataset.storeLabel = s.label;
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", "false");
    btn.setAttribute("aria-label", s.label);

    if (s.logo) {
      const img = document.createElement("img");
      img.src = STORE_IMG_BASE + s.logo;
      img.alt = s.label;
      img.className = "store-logo";
      btn.appendChild(img);
    } else {
      if (s.icon) {
        const icon = document.createElement("span");
        icon.className = "store-icon";
        icon.textContent = s.icon;
        btn.appendChild(icon);
      }
      const name = document.createElement("span");
      name.className = "store-name";
      name.textContent = s.label;
      btn.appendChild(name);
    }

    storeGrid.appendChild(btn);
  });
}

async function loadStores() {
  let list = STORES_FALLBACK;
  try {
    const res = await fetch(STORES_URL);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (Array.isArray(data.stores) && data.stores.length) list = data.stores;
  } catch (err) {
    console.warn("stores load failed - using fallback:", err);
  }
  renderStores(list);
}

loadStores();

/* ============ מסך 2: המתנה הקבועה ============ */

const giftGrid = document.getElementById("gift-carousel");
const confirmGiftButton = document.getElementById("confirm-gift-button");

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
    ["מתנה", gift.name || ""],
  ];

  if (state.store) rows.push(["מקום רכישה", state.store]);
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

  storeGrid.querySelectorAll(".store-tile").forEach((t) => {
    t.classList.remove("selected");
    t.setAttribute("aria-selected", "false");
  });
  selectedStoreTile = null;
  storeOtherInput.value = "";
  storeOtherInput.hidden = true;
  if (storeSection) storeSection.classList.add("is-hidden");

  Object.keys(state).forEach((key) => (state[key] = key === "gift" || key === "machine" ? null : ""));

  goToScreen(0);
});

/* ============ אתחול ============ */
loadCatalog();
