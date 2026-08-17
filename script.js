const SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbw5fPKD2ybNbG-slrFgv4OLLAkji-jypSu33kz_gYgE1WWkZaxk9Zo5S3tkHGh2K_Ih/exec";

const state = {
  machine: null,
  machineSku: "",
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  store: "",
  gift: null,
  giftSku: "",
  giftCardAmount: "",
  marketing: "",
  terms: "",
};

// מק"ט המוצר נגזר משם קובץ התמונה: img/c_81313.jpg -> 81313
function skuFromCard(card) {
  const img = card.querySelector("img");
  if (!img) return "";
  const match = (img.getAttribute("src") || "").match(/_([^/._]+)\.[a-z0-9]+$/i);
  return match ? match[1] : "";
}

// חשבונית (רשות) - נקראת ל-base64 בעת בחירת קובץ.
const invoice = { data: null, name: "", type: "" };
const INVOICE_MAX_BYTES = 5 * 1024 * 1024;

const machineLabels = {
  tvMini55: "Xiaomi TV S Mini LED 55 אינץ'",
  tvMini65: "Xiaomi TV S Mini LED 65 אינץ'",
  tvMini75: "Xiaomi TV S Mini LED 75 אינץ'",
  tvMini85: "Xiaomi TV S Mini LED 85 אינץ'",
  tvMini98: "Xiaomi TV S Mini LED 98 אינץ'",
};

function submitToSheet() {
  if (!SHEETS_WEBHOOK_URL || SHEETS_WEBHOOK_URL === "YOUR_APPS_SCRIPT_WEB_APP_URL") return;

  fetch(SHEETS_WEBHOOK_URL, {
    method: "POST",
    body: JSON.stringify({
      ...state,
      machineLabel: machineLabels[state.machine],
      giftLabel: giftLabels[state.gift],
      invoiceData: invoice.data,
      invoiceName: invoice.name,
      invoiceType: invoice.type,
    }),
  }).catch((err) => console.error("Failed to save registration:", err));
}

// המתנה קבועה - גיפטקארד Dream Card. רק הסכום משתנה לפי דגם הטלוויזיה.
const GIFT_ID = "dreamcard";

const giftLabels = {
  dreamcard: "גיפטקארד Dream Card",
};

// סכום הגיפטקארד המוענק לכל דגם טלוויזיה, בשקלים.
// זהו המקום היחיד לעדכון הסכומים.
const giftCardAmounts = {
  tvMini55: 250,
  tvMini65: 300,
  tvMini75: 400,
  tvMini85: 550,
  tvMini98: 850,
};

// תמונת הגיפטקארד לכל דגם. כרגע כולם משתמשים באותה תמונה;
// כדי לתת תמונה נפרדת לדגם - הוסיפו כאן שורה עם נתיב התמונה שלו.
const GIFT_CARD_IMAGE_DEFAULT = "img/dreamcard.webp";
const giftCardImages = {
  tvMini55: GIFT_CARD_IMAGE_DEFAULT,
  tvMini65: GIFT_CARD_IMAGE_DEFAULT,
  tvMini75: GIFT_CARD_IMAGE_DEFAULT,
  tvMini85: GIFT_CARD_IMAGE_DEFAULT,
  tvMini98: GIFT_CARD_IMAGE_DEFAULT,
};

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

const machineCards = document.querySelectorAll(".machine-card");
const startButton = document.getElementById("start-button");

machineCards.forEach((card) => {
  card.addEventListener("click", () => selectMachine(card));
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectMachine(card);
    }
  });
});

function selectMachine(card) {
  machineCards.forEach((c) => {
    c.classList.remove("selected");
    c.setAttribute("aria-selected", "false");
  });
  card.classList.add("selected");
  card.setAttribute("aria-selected", "true");

  state.machine = card.dataset.machine;
  state.machineSku = skuFromCard(card);
  startButton.disabled = false;
  renderGiftCard(state.machine);
  revealGiftCard();
}

/* גולל כך שגם הגיפטקארד וגם כפתור "המשך" יהיו גלויים אחרי הבחירה.
   נמדד בזמן אמת ולכן עובד גם בדסקטופ וגם במובייל. */
function revealGiftCard() {
  const actions = document.querySelector("#screen-0 .form-actions");
  if (!actions || giftCardSection.hidden) return;

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

const giftCardSection = document.getElementById("giftcard-section");
const giftCardImageEl = document.getElementById("giftcard-image");
const giftCardAmountEl = document.getElementById("giftcard-amount");
const giftCardCaptionEl = document.getElementById("giftcard-caption");

// המתנה זהה לכולם - משתנים רק הסכום והתמונה, לפי דגם הטלוויזיה.
function renderGiftCard(machineKey) {
  const amount = giftCardAmounts[machineKey] || 0;

  if (!amount) {
    state.gift = null;
    state.giftCardAmount = "";
    giftCardSection.hidden = true;
    return;
  }

  state.gift = GIFT_ID;
  state.giftCardAmount = amount;
  giftCardImageEl.src = giftCardImages[machineKey] || GIFT_CARD_IMAGE_DEFAULT;
  giftCardAmountEl.textContent = "₪" + amount.toLocaleString("he-IL");
  giftCardCaptionEl.textContent = `על רכישת ${machineLabels[machineKey]}`;
  giftCardSection.hidden = false;
}

function renderConfirmation() {
  const details = document.getElementById("confirm-details");
  details.innerHTML = "";

  const rows = [
    ["טלוויזיה שנרכשה", machineLabels[state.machine]],
    ["שם מלא", `${state.firstName} ${state.lastName}`],
    ["טלפון", state.phone],
    ["אימייל", state.email],
  ];

  if (state.giftCardAmount) {
    rows.push([giftLabels[state.gift], "₪" + state.giftCardAmount.toLocaleString("he-IL")]);
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

  giftCardAmountEl.textContent = "";
  giftCardCaptionEl.textContent = "";
  giftCardSection.hidden = true;

  machineCards.forEach((c) => {
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
