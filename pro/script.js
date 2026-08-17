// מועדון הלקוחות Xiaomi - גרסה רשמית.
// חולקת עם הגרסה הראשית את הנכסים (../img), את רשימת החנויות (../stores.json)
// ואת אותו חוזה נתונים מול Google Apps Script.

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

// מק"ט המוצר נגזר משם קובץ התמונה: ../img/c_81313.jpg -> 81313
function skuFromCard(card) {
  const img = card.querySelector("img");
  if (!img) return "";
  const match = (img.getAttribute("src") || "").match(/_([^/._]+)\.[a-z0-9]+$/i);
  return match ? match[1] : "";
}

const machineLabels = {
  tvMini55: "Xiaomi TV S Mini LED 55 אינץ'",
  tvMini65: "Xiaomi TV S Mini LED 65 אינץ'",
  tvMini75: "Xiaomi TV S Mini LED 75 אינץ'",
  tvMini85: "Xiaomi TV S Mini LED 85 אינץ'",
  tvMini98: "Xiaomi TV S Mini LED 98 אינץ'",
};

// המתנה קבועה - רק הסכום משתנה לפי הדגם. זהו המקום היחיד לעדכון הסכומים.
const GIFT_ID = "dreamcard";
const giftLabels = { dreamcard: "גיפטקארד Dream Card" };

const giftCardAmounts = {
  tvMini55: 250,
  tvMini65: 300,
  tvMini75: 400,
  tvMini85: 550,
  tvMini98: 850,
};

// תמונת הגיפטקארד לכל דגם. כרגע כולם על אותה תמונה;
// לתמונה נפרדת לדגם - החליפו כאן את הנתיב.
const GIFT_CARD_IMAGE_DEFAULT = "../img/dreamcard.webp";
const giftCardImages = {
  tvMini55: GIFT_CARD_IMAGE_DEFAULT,
  tvMini65: GIFT_CARD_IMAGE_DEFAULT,
  tvMini75: GIFT_CARD_IMAGE_DEFAULT,
  tvMini85: GIFT_CARD_IMAGE_DEFAULT,
  tvMini98: GIFT_CARD_IMAGE_DEFAULT,
};

// חשבונית (רשות) - נקראת ל-base64 בעת בחירת קובץ.
const invoice = { data: null, name: "", type: "" };
const INVOICE_MAX_BYTES = 5 * 1024 * 1024;

function submitToSheet() {
  if (!SHEETS_WEBHOOK_URL) return;

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

const modelCards = document.querySelectorAll(".model");
const startButton = document.getElementById("start-button");

modelCards.forEach((card) => {
  card.addEventListener("click", () => selectModel(card));
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectModel(card);
    }
  });
});

function selectModel(card) {
  modelCards.forEach((c) => {
    c.classList.remove("is-selected");
    c.setAttribute("aria-selected", "false");
  });
  card.classList.add("is-selected");
  card.setAttribute("aria-selected", "true");

  state.machine = card.dataset.machine;
  state.machineSku = skuFromCard(card);
  startButton.disabled = false;

  renderGiftCard(state.machine);
  revealGiftCard();
}

const giftCardSection = document.getElementById("giftcard-section");
const giftCardImageEl = document.getElementById("giftcard-image");
const giftCardAmountEl = document.getElementById("giftcard-amount");
const giftCardCaptionEl = document.getElementById("giftcard-caption");

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
  giftCardCaptionEl.textContent = machineLabels[machineKey];
  giftCardSection.hidden = false;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* גולל כך שגם המתנה וגם כפתור ההמשך גלויים. נמדד בזמן אמת, ולכן
   מתאים את עצמו לכל גובה מסך במקום להסתמך על ערך קבוע. */
function revealGiftCard() {
  const actions = document.querySelector("#screen-0 .panel-foot");
  if (!actions || giftCardSection.hidden) return;

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

/* ================= אישור ================= */

function renderConfirmation() {
  const details = document.getElementById("confirm-details");
  details.innerHTML = "";

  const rows = [
    ["דגם שנרכש", machineLabels[state.machine]],
    ["שם מלא", `${state.firstName} ${state.lastName}`],
    ["טלפון", state.phone],
    ["דואר אלקטרוני", state.email],
  ];

  if (state.giftCardAmount) {
    rows.push([giftLabels[state.gift], "₪" + state.giftCardAmount.toLocaleString("he-IL")]);
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

  giftCardAmountEl.textContent = "";
  giftCardCaptionEl.textContent = "";
  giftCardSection.hidden = true;

  modelCards.forEach((c) => {
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
