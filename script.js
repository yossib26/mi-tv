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

function submitToSheet() {
  if (!SHEETS_WEBHOOK_URL || SHEETS_WEBHOOK_URL === "YOUR_APPS_SCRIPT_WEB_APP_URL") return;

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

const GIFT_CARD_IMAGE_DEFAULT = "img/dreamcard.webp";

const screens = {
  0: document.getElementById("screen-0"),
  1: document.getElementById("screen-1"),
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

const machineGrid = document.getElementById("machine-grid");
const startButton = document.getElementById("start-button");

// דגמי הטלוויזיה נטענים דינמית מ-items.json (ר' loadItems למטה).
// itemsByMachine ממופה לפי מפתח ה-machine לאחר הטעינה.
let itemsByMachine = {};

machineGrid.addEventListener("click", (e) => {
  const card = e.target.closest(".machine-card");
  if (card) selectMachine(card);
});

machineGrid.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const card = e.target.closest(".machine-card");
  if (!card) return;
  e.preventDefault();
  selectMachine(card);
});

function selectMachine(card) {
  machineGrid.querySelectorAll(".machine-card").forEach((c) => {
    c.classList.remove("selected");
    c.setAttribute("aria-selected", "false");
  });
  card.classList.add("selected");
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

/* גולל כך שגם הגיפטקארד וגם כפתור "המשך" יהיו גלויים אחרי הבחירה.
   נמדד בזמן אמת ולכן עובד גם בדסקטופ וגם במובייל. */
// ממתין לטעינת התמונה (וגופנים, אם יש) לפני שמודדים גובה: התמונה גבוהה 0px
// עד שהיא נטענת, ואם מודדים לפני זה, יעד הגלילה מחושב לפי מצב נמוך יותר
// מהאמיתי - והכפתור נשאר חתוך מתחת לגלישה.
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
  const actions = document.querySelector("#screen-0 .form-actions");
  if (!actions || giftCardSection.hidden) return;

  whenLayoutSettled_().then(() => {
    // הכרטיס הרגע נחשף - ממתינים לפריסה לפני מדידת המיקום.
    requestAnimationFrame(() => {
      const PAD = 16;
      const viewportHeight = window.innerHeight;
      const cardTop = giftCardSection.getBoundingClientRect().top;
      const actionsBottom = actions.getBoundingClientRect().bottom;

      // הכל כבר גלוי - לא מזיזים את העמוד.
      if (cardTop >= 0 && actionsBottom <= viewportHeight) return;

      const blockHeight = actionsBottom - cardTop;
      const offset =
        blockHeight + PAD * 2 <= viewportHeight
          ? actionsBottom + PAD - viewportHeight // מיישר את הכפתור לתחתית, הכרטיס נשאר מעליו
          : cardTop - PAD; // הבלוק גבוה מהמסך - מעדיפים את ראש הכרטיס

      const maxScroll = document.documentElement.scrollHeight - viewportHeight;
      const target = Math.max(0, Math.min(window.scrollY + offset, maxScroll));

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: target, behavior: reduceMotion ? "auto" : "smooth" });
    });
  });
}

startButton.addEventListener("click", () => {
  if (!state.machine) return;
  goToScreen(1);
});

const detailsForm = document.getElementById("details-form");

const validators = {
  firstName: (v) => v.trim().length >= 2,
  lastName: (v) => v.trim().length >= 2,
  phone: (v) => /^0\d{1,2}-?\d{7}$/.test(v.trim().replace(/\s/g, "")),
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
  terms: (v) => v === true, // אישור התקנון - שדה חובה
};

const errorText = {
  firstName: "יש להזין שם פרטי תקין",
  lastName: "יש להזין שם משפחה תקין",
  phone: "יש להזין מספר טלפון תקין",
  email: "יש להזין כתובת אימייל תקינה",
  terms: "יש לאשר את התקנון כדי להמשיך",
};

const TEXT_FIELDS = ["firstName", "lastName", "phone", "email"];

function validateField(name) {
  const input = detailsForm.elements[name];
  const errorEl = detailsForm.querySelector(`[data-error-for="${name}"]`);
  const isCheckbox = input.type === "checkbox";
  const isValid = validators[name](isCheckbox ? input.checked : input.value);

  // בתיבת סימון מסמנים את השורה כולה - מסגרת על תיבה של 18px לא נראית
  const target = isCheckbox ? input.closest(".consent-row") : input;
  if (target) target.classList.toggle("invalid", !isValid);
  errorEl.textContent = isValid ? "" : errorText[name];

  return isValid;
}

detailsForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const fields = TEXT_FIELDS.concat("terms");
  // map ולא some - כדי שכל השגיאות יוצגו יחד ולא רק הראשונה
  const allValid = fields.map(validateField).every(Boolean);

  if (!allValid) return;

  TEXT_FIELDS.forEach((name) => {
    state[name] = detailsForm.elements[name].value.trim();
  });

  state.marketing = detailsForm.elements.marketing.checked ? "כן" : "לא";
  state.terms = "כן";

  // שלב 2 הוא הסופי - שליחה ומעבר ישירות למסך האישור.
  renderConfirmation();
  submitToSheet();
  goToScreen("confirm");
});

document.getElementById("back-button").addEventListener("click", () => {
  goToScreen(0);
});

TEXT_FIELDS.forEach((name) => {
  detailsForm.elements[name].addEventListener("blur", () => {
    if (detailsForm.elements[name].value.trim()) validateField(name);
  });
});

// מנקה את שגיאת התקנון ברגע שסומן, בלי להמתין לשליחה נוספת.
detailsForm.elements.terms.addEventListener("change", () => validateField("terms"));

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
    focusFirstField();
  }
  state.store = currentStoreLabel();
});

/* אחרי בחירת חנות ממשיכים ישר לשדה הראשון בטופס. */
function focusFirstField() {
  const firstField = detailsForm.elements.firstName;
  if (!firstField) return;

  requestAnimationFrame(() => {
    // preventScroll כדי שהמיקוד לא יקפיץ בחדות, והגלילה תהיה חלקה
    firstField.focus({ preventScroll: true });
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    firstField.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "center",
    });
  });
}

storeOtherInput.addEventListener("input", () => {
  state.store = currentStoreLabel();
});

/* ---- טעינת רשימת החנויות מ-JSON (עם גיבוי מובנה) ---- */
const STORES_URL = "stores.json";
const STORE_IMG_BASE = "img/";
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
    btn.className = "store-tile" + (s.logo ? "" : " store-tile--text");
    btn.dataset.store = s.id;
    btn.dataset.storeLabel = s.label;
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", "false");
    btn.setAttribute("aria-label", s.label);
    btn.title = s.label; // אריח לוגו לא מציג טקסט - שם החנות מופיע ב-hover

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
    const res = await fetch(STORES_URL + "?t=" + Date.now()); // מונע הגשת JSON ישן מהמטמון
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (Array.isArray(data.stores) && data.stores.length) list = data.stores;
  } catch (err) {
    console.warn("stores load failed - using fallback:", err);
  }
  renderStores(list);
}

loadStores();

/* ---- טעינת דגמי הטלוויזיה מ-items.json (עם גיבוי מובנה) ---- */
const ITEMS_URL = "items.json";
const ITEMS_FALLBACK = [
  { machine: "tvMini55", sort: 1, sku: "81313", name: "Xiaomi TV S Mini LED 55 אינץ'", image: "c_81313.jpg", giftSku: "GC-DREAM-250", giftName: "גיפטקארד Dream Card", giftAmount: 250, giftImage: "dreamcard.webp" },
  { machine: "tvMini65", sort: 2, sku: "81314", name: "Xiaomi TV S Mini LED 65 אינץ'", image: "c_81314.jpg", giftSku: "GC-DREAM-300", giftName: "גיפטקארד Dream Card", giftAmount: 300, giftImage: "dreamcard.webp" },
  { machine: "tvMini75", sort: 3, sku: "81315", name: "Xiaomi TV S Mini LED 75 אינץ'", image: "c_81315.jpg", giftSku: "GC-DREAM-400", giftName: "גיפטקארד Dream Card", giftAmount: 400, giftImage: "dreamcard.webp" },
  { machine: "tvMini85", sort: 4, sku: "81318", name: "Xiaomi TV S Mini LED 85 אינץ'", image: "c_81318.jpg", giftSku: "GC-DREAM-550", giftName: "גיפטקארד Dream Card", giftAmount: 550, giftImage: "dreamcard.webp" },
  { machine: "tvMini98", sort: 5, sku: "81319", name: "Xiaomi TV S Mini LED 98 אינץ'", image: "c_81319.jpg", giftSku: "GC-DREAM-850", giftName: "גיפטקארד Dream Card", giftAmount: 850, giftImage: "dreamcard.webp" },
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

function renderMachines(list) {
  machineGrid.innerHTML = "";
  itemsByMachine = {};

  sortItems(list).forEach((item) => {
    itemsByMachine[item.machine] = item;

    const card = document.createElement("article");
    card.className = "machine-card";
    card.dataset.machine = item.machine;
    card.tabIndex = 0;
    card.setAttribute("role", "option");
    card.setAttribute("aria-selected", "false");

    const img = document.createElement("img");
    img.src = "img/" + item.image;
    img.alt = item.name;
    img.className = "machine-card-image";
    card.appendChild(img);

    const h3 = document.createElement("h3");
    h3.textContent = item.name;
    card.appendChild(h3);

    machineGrid.appendChild(card);
  });
}

async function loadItems() {
  let list = ITEMS_FALLBACK;
  try {
    const res = await fetch(ITEMS_URL + "?t=" + Date.now()); // מונע הגשת JSON ישן מהמטמון
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (Array.isArray(data.items) && data.items.length) list = data.items;
  } catch (err) {
    console.warn("items load failed - using fallback:", err);
  }
  renderMachines(list);
}

loadItems();

const giftCardSection = document.getElementById("giftcard-section");
const giftCardImageEl = document.getElementById("giftcard-image");
const giftCardCaptionEl = document.getElementById("giftcard-caption");

// המתנה מוגדרת לכל דגם ב-items.json (שם, מק"ט, סכום ותמונה).
// הסכום נשמר ב-state ונשלח לגיליון כרגיל - הוא רק לא מוצג יותר מוטבע על התמונה.
function renderGiftCard(item) {
  const amount = item.giftAmount || 0;

  if (!amount) {
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
  state.giftCardAmount = amount;
  giftCardImageEl.src = item.giftImage ? "img/" + item.giftImage : GIFT_CARD_IMAGE_DEFAULT;
  giftCardCaptionEl.textContent = item.giftName || "";
  giftCardSection.hidden = false;
}

function renderConfirmation() {
  const details = document.getElementById("confirm-details");
  details.innerHTML = "";

  const rows = [
    ["טלוויזיה שנרכשה", state.machineLabel],
    ["שם מלא", `${state.firstName} ${state.lastName}`],
    ["טלפון", state.phone],
    ["אימייל", state.email],
  ];

  if (state.giftCardAmount) {
    rows.push([state.giftLabel, "₪" + state.giftCardAmount.toLocaleString("he-IL")]);
  }
  if (state.store) rows.push(["מקום רכישה", state.store]);
  if (invoice.name) rows.push(["חשבונית", invoice.name]);
  rows.push(["דיוור וחומר שיווקי", state.marketing]);

  rows.forEach(([label, value]) => {
    const row = document.createElement("div");
    row.innerHTML = `<dt>${label}</dt><dd>${value}</dd>`;
    details.appendChild(row);
  });
}

document.getElementById("restart-button").addEventListener("click", () => {
  detailsForm.reset(); // מנקה גם את תיבות הסימון
  TEXT_FIELDS.forEach((name) => {
    detailsForm.elements[name].classList.remove("invalid");
    detailsForm.querySelector(`[data-error-for="${name}"]`).textContent = "";
  });

  document.getElementById("terms-row").classList.remove("invalid");
  detailsForm.querySelector('[data-error-for="terms"]').textContent = "";

  giftCardCaptionEl.textContent = "";
  giftCardSection.hidden = true;

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

  Object.keys(state).forEach((key) => (state[key] = key === "gift" || key === "machine" ? null : ""));

  goToScreen(0);
});
