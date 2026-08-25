// מועדון הלקוחות Xiaomi - גרסה רשמית.
// חולקת עם הגרסה הראשית את הנכסים (../img), את רשימת החנויות (../stores.json)
// ואת אותו חוזה נתונים מול Google Apps Script.

const SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbzHnPkEbmIgyUuiBUdCZXvcc6BtOqR_UVjP9tuz_aXl07UcxrNbcLb9KMGFG9grv4m3ZA/exec";

const state = {
  machine: null,
  machineSku: "",
  machineLabel: "",
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  store: "",
  gift: null,
  giftSku: "",
  giftLabel: "",
  giftCardAmount: "",
  marketing: "",
  terms: "",
};

// חשבונית (רשות) - נקראת ל-base64 בעת בחירת קובץ.
const invoice = { data: null, name: "", type: "" };
const INVOICE_MAX_BYTES = 5 * 1024 * 1024;

const GIFT_CARD_IMAGE_DEFAULT = "../img/dreamcard.webp";

function submitToSheet() {
  if (!SHEETS_WEBHOOK_URL) return;

  fetch(SHEETS_WEBHOOK_URL, {
    method: "POST",
    body: JSON.stringify({
      ...state,
      invoiceData: invoice.data,
      invoiceName: invoice.name,
      invoiceType: invoice.type,
    }),
  }).catch((err) => console.error("Failed to save registration:", err));
}

/* ================= ניווט בין שלבים ================= */

const screens = {
  0: document.getElementById("screen-0"),
  1: document.getElementById("screen-1"),
  2: document.getElementById("screen-2"),
  confirm: document.getElementById("screen-confirm"),
};

const steps = document.querySelectorAll(".step");
const stepperFill = document.getElementById("stepper-fill");

function goToScreen(key) {
  Object.values(screens).forEach((el) => el.classList.remove("is-active"));
  screens[key].classList.add("is-active");

  // במסך האישור כל השלבים הושלמו
  const current = key === "confirm" ? steps.length : Number(key);

  steps.forEach((step) => {
    const index = Number(step.dataset.step);
    step.classList.toggle("is-current", index === current);
    step.classList.toggle("is-done", index < current);
  });

  stepperFill.style.width =
    key === "confirm" ? "100%" : ((current + 1) / (steps.length + 1)) * 100 + "%";
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

/* ================= שלב 1: בחירת דגם ================= */

const machineGrid = document.getElementById("machine-grid");
const startButton = document.getElementById("start-button");

// דגמי הטלוויזיה נטענים דינמית מ-items.json (ר' loadItems למטה).
// itemsByMachine ממופה לפי מפתח ה-machine לאחר הטעינה.
let itemsByMachine = {};

machineGrid.addEventListener("click", (e) => {
  const card = e.target.closest(".model");
  if (card) selectModel(card);
});

machineGrid.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const card = e.target.closest(".model");
  if (!card) return;
  e.preventDefault();
  selectModel(card);
});

function selectModel(card) {
  machineGrid.querySelectorAll(".model").forEach((c) => {
    c.classList.remove("is-selected");
    c.setAttribute("aria-selected", "false");
  });
  card.classList.add("is-selected");
  card.setAttribute("aria-selected", "true");

  const item = itemsByMachine[card.dataset.machine];
  if (!item) return;

  state.machine = item.machine;
  state.machineSku = item.sku || "";
  state.machineLabel = item.name || "";
  startButton.disabled = false;

  renderGiftCard(item);
  revealGiftCard();
}

const giftCardSection = document.getElementById("giftcard-section");
const giftCardImageEl = document.getElementById("giftcard-image");
const giftCardCaptionEl = document.getElementById("giftcard-caption");

// הסכום נשמר ב-state ונשלח לגיליון כרגיל - הוא רק לא מוצג יותר מוטבע על התמונה.
// הטבה מוצגת גם כשאין לה סכום כספי (למשל מוצר פיזי במקום שובר).
function renderGiftCard(item) {
  const hasGift = Boolean(item.giftName || item.giftImage);

  if (!hasGift) {
    state.gift = null;
    state.giftSku = "";
    state.giftLabel = "";
    state.giftCardAmount = "";
    giftCardSection.hidden = true;
    return;
  }

  state.gift = item.giftSku || "";
  state.giftSku = item.giftSku || "";
  state.giftLabel = item.giftName || "";
  state.giftCardAmount = item.giftAmount || ""; // ריק להטבות פיזיות שאינן שובר כספי
  giftCardImageEl.src = item.giftImage ? "../img/" + item.giftImage : GIFT_CARD_IMAGE_DEFAULT;
  giftCardCaptionEl.textContent = item.giftName || "";
  giftCardSection.hidden = false;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* גולל כך שגם המתנה וגם כפתור ההמשך גלויים. נמדד בזמן אמת, ולכן
   מתאים את עצמו לכל גובה מסך במקום להסתמך על ערך קבוע. */
// ממתין לטעינת התמונה והפונט לפני שמודדים גובה: שניהם משנים את גובה העמוד
// אחרי שהם נטענים (התמונה מ-0 לגובהה בפועל, הפונט ב-swap משנה מטריקות
// טקסט), ואם מודדים לפני זה, יעד הגלילה מחושב לפי מצב נמוך יותר מהאמיתי -
// והכפתור נשאר חתוך מתחת לגלישה.
function whenLayoutSettled_() {
  const waits = [];
  if (document.fonts && document.fonts.ready) waits.push(document.fonts.ready);
  if (giftCardImageEl && !giftCardImageEl.complete) {
    waits.push(
      new Promise((resolve) => {
        giftCardImageEl.addEventListener("load", resolve, { once: true });
        giftCardImageEl.addEventListener("error", resolve, { once: true });
      })
    );
  }
  return Promise.all(waits);
}

function revealGiftCard() {
  const actions = document.querySelector("#screen-0 .panel-foot");
  if (!actions || giftCardSection.hidden) return;

  whenLayoutSettled_().then(() => {
    requestAnimationFrame(() => {
      const PAD = 16;
      const viewportHeight = window.innerHeight;
      const cardTop = giftCardSection.getBoundingClientRect().top;
      const actionsBottom = actions.getBoundingClientRect().bottom;

      if (cardTop >= 0 && actionsBottom <= viewportHeight) return; // כבר גלוי

      const blockHeight = actionsBottom - cardTop;
      const offset =
        blockHeight + PAD * 2 <= viewportHeight
          ? actionsBottom + PAD - viewportHeight
          : cardTop - PAD;

      const maxScroll = document.documentElement.scrollHeight - viewportHeight;
      const target = Math.max(0, Math.min(window.scrollY + offset, maxScroll));

      window.scrollTo({ top: target, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    });
  });
}

startButton.addEventListener("click", () => {
  if (!state.machine) return;
  goToScreen(1);
  scrollToTop();
});

/* ================= שלב 2: מקום הרכישה ================= */

document.getElementById("store-back").addEventListener("click", () => {
  goToScreen(0);
  scrollToTop();
});

document.getElementById("store-continue").addEventListener("click", () => {
  goToScreen(2); // השלב אופציונלי - ממשיכים גם בלי בחירה
  scrollToTop();
  focusFirstField();
});

/* ================= שלב 2: פרטים ================= */

const detailsForm = document.getElementById("details-form");

const validators = {
  firstName: (v) => v.trim().length >= 2,
  lastName: (v) => v.trim().length >= 2,
  phone: (v) => /^0\d{1,2}-?\d{7}$/.test(v.trim().replace(/\s/g, "")),
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
  terms: (v) => v === true,
};

const errorText = {
  firstName: "יש להזין שם פרטי תקין",
  lastName: "יש להזין שם משפחה תקין",
  phone: "יש להזין מספר טלפון תקין",
  email: "יש להזין כתובת דואר אלקטרוני תקינה",
  terms: "יש לאשר את התקנון כדי להמשיך",
};

const TEXT_FIELDS = ["firstName", "lastName", "phone", "email"];

function validateField(name) {
  const input = detailsForm.elements[name];
  const errorEl = detailsForm.querySelector(`[data-error-for="${name}"]`);
  const isCheckbox = input.type === "checkbox";
  const isValid = validators[name](isCheckbox ? input.checked : input.value);

  // בתיבת סימון מסמנים את השורה כולה - מסגרת על תיבה של 16px כמעט לא נראית
  const target = isCheckbox ? input.closest(".consent") : input;
  if (target) target.classList.toggle("is-invalid", !isValid);
  errorEl.textContent = isValid ? "" : errorText[name];

  return isValid;
}

detailsForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const fields = TEXT_FIELDS.concat("terms");
  // map ולא some - כדי שכל השגיאות יוצגו יחד ולא רק הראשונה
  const allValid = fields.map(validateField).every(Boolean);

  if (!allValid) {
    const firstInvalid = detailsForm.querySelector(".is-invalid");
    if (firstInvalid) {
      firstInvalid.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "center",
      });
    }
    return;
  }

  TEXT_FIELDS.forEach((name) => {
    state[name] = detailsForm.elements[name].value.trim();
  });

  state.marketing = detailsForm.elements.marketing.checked ? "כן" : "לא";
  state.terms = "כן";

  renderConfirmation();
  submitToSheet();
  goToScreen("confirm");
  scrollToTop();
});

document.getElementById("back-button").addEventListener("click", () => {
  goToScreen(1);
  scrollToTop();
});

TEXT_FIELDS.forEach((name) => {
  detailsForm.elements[name].addEventListener("blur", () => {
    if (detailsForm.elements[name].value.trim()) validateField(name);
  });
});

detailsForm.elements.terms.addEventListener("change", () => validateField("terms"));

/* ---- חשבונית ---- */

const invoiceInput = document.getElementById("invoice");
const invoiceError = detailsForm.querySelector('[data-error-for="invoice"]');
const invoiceHint = document.getElementById("invoice-hint");
const INVOICE_HINT_DEFAULT = "קובץ תמונה או PDF, עד 5MB";

invoiceInput.addEventListener("change", () => {
  invoice.data = null;
  invoice.name = "";
  invoice.type = "";
  invoiceError.textContent = "";

  const file = invoiceInput.files[0];
  if (!file) {
    invoiceHint.textContent = INVOICE_HINT_DEFAULT;
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
    invoiceHint.textContent = "נבחר: " + file.name;
  };
  reader.onerror = () => {
    invoiceError.textContent = "שגיאה בקריאת הקובץ, נסו שוב";
  };
  reader.readAsDataURL(file);
});

/* ---- מקום רכישה ---- */

const storeGrid = document.getElementById("store-grid");
const storeOtherInput = document.getElementById("store-other");
const storePicked = document.getElementById("store-picked");
let selectedStoreTile = null;

function renderStorePicked() {
  const label = state.store;
  storePicked.hidden = !label;
  if (label) storePicked.innerHTML = "נבחר: <strong></strong>";
  if (label) storePicked.querySelector("strong").textContent = label;
}

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
  renderStorePicked();
});

storeOtherInput.addEventListener("input", () => {
  state.store = currentStoreLabel();
  renderStorePicked();
});

// אחרי בחירת חנות ממשיכים ישר לשדה הראשון בטופס.
function focusFirstField() {
  const firstField = detailsForm.elements.firstName;
  if (!firstField) return;

  requestAnimationFrame(() => {
    firstField.focus({ preventScroll: true }); // הגלילה נעשית בנפרד, חלק
    firstField.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "center",
    });
  });
}

/* ---- טעינת רשימת החנויות (משותפת עם הגרסה הראשית) ---- */

const STORES_URL = "../stores.json";
const STORE_IMG_BASE = "../img/";
const STORES_FALLBACK = [
  { id: "xiaomi-online", label: "אתר האינטרנט Xiaomi", logo: "s_xiaomi.png" },
  { id: "machsanei-hashmal", label: "מחסני חשמל", logo: "s_machsanei.png" },
  { id: "ksp", label: "KSP", logo: "s_ksp.jpg" },
  { id: "bug", label: "באג", logo: "s_bug.png" },
  { id: "shekem-electric", label: "שקם אלקטריק" },
  { id: "alm", label: "א.ל.מ" },
  { id: "other", label: "אחר", icon: "+", other: true },
];

function renderStores(list) {
  storeGrid.innerHTML = "";

  list.forEach((s) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "store-tile";
    btn.dataset.store = s.id;
    btn.dataset.storeLabel = s.label;
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", "false");
    btn.setAttribute("aria-label", s.label);
    btn.title = s.label; // אריח לוגו לא מציג טקסט - השם מופיע ב-hover

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
    const res = await fetch(STORES_URL + "?t=" + Date.now()); // מונע JSON ישן מהמטמון
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (Array.isArray(data.stores) && data.stores.length) list = data.stores;
  } catch (err) {
    console.warn("stores load failed - using fallback:", err);
  }
  renderStores(list);
}

loadStores();

/* ---- טעינת דגמי הטלוויזיה מ-items.json (משותף עם הגרסה הראשית) ---- */

const ITEMS_URL = "../items.json";
const ITEMS_FALLBACK = [
  { machine: "tvSMini55", sort: 1, sku: "81313", name: "Xiaomi TV S Mini LED  2026 55\" 1200 nit L55MC-SME", image: "tv_81313.jpg", giftSku: "DC350", giftName: "שובר DREAM CARD בשווי 350 ₪", giftAmount: 350, giftImage: "g_DC350.jpg" },
  { machine: "tvSMini65", sort: 2, sku: "81314", name: "Xiaomi TV S Mini LED  2026 65\" 1200 nit L65MC-SME", image: "tv_81314.jpg", giftSku: "DC400", giftName: "שובר DREAM CARD בשווי 400 ₪", giftAmount: 400, giftImage: "g_DC400.jpg" },
  { machine: "tvSMini75", sort: 3, sku: "81315", name: "Xiaomi TV S Mini LED  2026 75\" 1200 nit L75MC-SME", image: "tv_81315.jpg", giftSku: "DC400", giftName: "שובר DREAM CARD בשווי 400 ₪", giftAmount: 400, giftImage: "g_DC400.jpg" },
  { machine: "tvSMini85", sort: 4, sku: "81318", name: "Xiaomi TV S Mini LED 85 2026 1200NIT 144HZ", image: "tv_81318.jpg", giftSku: "DC600", giftName: "שובר DREAM CARD בשווי 600 ₪", giftAmount: 600, giftImage: "g_DC600.jpg" },
  { machine: "tvSProMini55", sort: 5, sku: "89626", name: "Xiaomi TV S Pro Mini LED 55 2026 1700NIT L55MB-SME", image: "tv_89626.jpg", giftSku: "DC350", giftName: "שובר DREAM CARD בשווי 350 ₪", giftAmount: 350, giftImage: "g_DC350.jpg" },
  { machine: "tvSProMini65", sort: 6, sku: "89627", name: "Xiaomi TV S Pro Mini LED 65 2026 1700NIT L65MB-SME", image: "tv_89627.jpg", giftSku: "DC400", giftName: "שובר DREAM CARD בשווי 400 ₪", giftAmount: 400, giftImage: "g_DC400.jpg" },
  { machine: "tvSProMini75", sort: 7, sku: "89628", name: "Xiaomi TV S Pro Mini LED 75 2026 1700Nit L75MB-SME", image: "tv_89628.jpg", giftSku: "DC400", giftName: "שובר DREAM CARD בשווי 400 ₪", giftAmount: 400, giftImage: "g_DC400.jpg" },
  { machine: "scooter6Lite", sort: 8, sku: "81354", name: "Xiaomi Electric Scooter 6 Lite GL", image: "tv_81354.jpg", giftSku: "81276", giftName: "משאבת אויר חשמלית קומפקטית ניידת", giftImage: "g_81276.jpg" },
  { machine: "scooter6", sort: 9, sku: "81291", name: "Xiaomi Electric Scooter 6 קורקינט חשמלי שיכוח מלא", image: "tv_81291.jpg", giftSku: "81276", giftName: "משאבת אויר חשמלית קומפקטית ניידת", giftImage: "g_81276.jpg" },
  { machine: "fanProSlim", sort: 10, sku: "81400", name: "Mijia Smart Standing Fan Pro Slim EU", image: "tv_81400.jpg", giftSku: "81277", giftName: "סוללת גיבוי Xiaomi 67W 10000mAh", giftImage: "g_81277.jpg" },
  { machine: "espressoMachine", sort: 11, sku: "81260", name: "Xiaomi Semi-automatic Espresso Machine מכונת אספרסו", image: "tv_81260.jpg", giftSku: "2602", giftName: "מטחנת קפה המילטון", giftImage: "g_2602.jpg" },
];

// ממיין לפי שדה sort (פריטים בלי sort יורדים לסוף, בסדר יציב ביניהם).
function sortItems(list) {
  return list
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const sa = typeof a.item.sort === "number" ? a.item.sort : Infinity;
      const sb = typeof b.item.sort === "number" ? b.item.sort : Infinity;
      return sa - sb || a.index - b.index;
    })
    .map((entry) => entry.item);
}

function renderModels(list) {
  machineGrid.innerHTML = "";
  itemsByMachine = {};

  sortItems(list).forEach((item) => {
    itemsByMachine[item.machine] = item;

    const card = document.createElement("article");
    card.className = "model";
    card.dataset.machine = item.machine;
    card.tabIndex = 0;
    card.setAttribute("role", "option");
    card.setAttribute("aria-selected", "false");

    const mark = document.createElement("span");
    mark.className = "model-mark";
    mark.setAttribute("aria-hidden", "true");
    card.appendChild(mark);

    const img = document.createElement("img");
    img.src = "../img/" + item.image;
    img.alt = item.name;
    img.className = "model-image";
    card.appendChild(img);

    const text = document.createElement("div");
    text.className = "model-text";

    const name = document.createElement("h2");
    name.className = "model-name";
    name.textContent = item.name;
    text.appendChild(name);

    card.appendChild(text);
    machineGrid.appendChild(card);
  });
}

async function loadItems() {
  let list = ITEMS_FALLBACK;
  try {
    const res = await fetch(ITEMS_URL + "?t=" + Date.now()); // מונע JSON ישן מהמטמון
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (Array.isArray(data.items) && data.items.length) list = data.items;
  } catch (err) {
    console.warn("items load failed - using fallback:", err);
  }
  renderModels(list);
}

loadItems();

/* ================= אישור ================= */

function renderConfirmation() {
  const details = document.getElementById("confirm-details");
  details.innerHTML = "";

  const rows = [
    ["דגם שנרכש", state.machineLabel],
    ["שם מלא", `${state.firstName} ${state.lastName}`],
    ["טלפון", state.phone],
    ["דואר אלקטרוני", state.email],
  ];

  if (state.giftLabel) {
    // הטבה כספית (שובר) מוצגת עם הסכום; הטבה פיזית מוצגת עם שמה בלבד.
    const amountText = state.giftCardAmount ? ` (₪${Number(state.giftCardAmount).toLocaleString("he-IL")})` : "";
    rows.push(["ההטבה שלכם", state.giftLabel + amountText]);
  }
  if (state.store) rows.push(["מקום רכישה", state.store]);
  if (invoice.name) rows.push(["חשבונית", invoice.name]);
  rows.push(["דיוור וחומר שיווקי", state.marketing]);

  rows.forEach(([label, value]) => {
    const row = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    row.append(dt, dd);
    details.appendChild(row);
  });
}

document.getElementById("restart-button").addEventListener("click", () => {
  detailsForm.reset(); // מנקה גם את תיבות הסימון

  TEXT_FIELDS.forEach((name) => {
    detailsForm.elements[name].classList.remove("is-invalid");
    detailsForm.querySelector(`[data-error-for="${name}"]`).textContent = "";
  });

  document.getElementById("terms-row").classList.remove("is-invalid");
  detailsForm.querySelector('[data-error-for="terms"]').textContent = "";

  giftCardCaptionEl.textContent = "";
  giftCardSection.hidden = true;

  machineGrid.querySelectorAll(".model").forEach((c) => {
    c.classList.remove("is-selected");
    c.setAttribute("aria-selected", "false");
  });
  startButton.disabled = true;

  invoice.data = null;
  invoice.name = "";
  invoice.type = "";
  invoiceInput.value = "";
  invoiceError.textContent = "";
  invoiceHint.textContent = INVOICE_HINT_DEFAULT;

  storeGrid.querySelectorAll(".store-tile").forEach((t) => {
    t.classList.remove("selected");
    t.setAttribute("aria-selected", "false");
  });
  selectedStoreTile = null;
  storeOtherInput.value = "";
  storeOtherInput.hidden = true;

  Object.keys(state).forEach((key) => {
    state[key] = key === "gift" || key === "machine" ? null : "";
  });

  goToScreen(0);
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
});

goToScreen(0);
