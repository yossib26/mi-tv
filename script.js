const SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbw4UALN0yNpVXjQmX8L0CNlOQj1nsgbbvqckfkZTlGaLWEdsmOUPq5Qmikws8PJ97-x/exec";

const state = {
  machine: null,
  machineSku: "",
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  gift: null,
  giftSku: "",
};

// מק"ט המוצר נגזר משם קובץ התמונה: img/c_30002.jpg -> 30002
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
  solo: "Gaggia Magenta Prestige 8702/01",
  purista: "Gaggia Magenta Milk 8701/01",
  baristaTS: "Gaggia Anima Deluxe 8761/01",
  avanza: "Gaggia Anima Barista Plus RI8760/02",
  ciTouch: "Gaggia Anima Prestige OTC SS RI8762/01",
  latticia: "Gaggia Magenta Plus RI8700/01",
  varianza: "Gaggia Magenta Prestige EG6603",
  passione: "Gaggia Anima OTC RI8759/01",
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

const giftLabels = {
  lifeP3: "מיקרוגל Toshiba",
  spaceA40: "ערכת טעינה לרכב Anker",
  liberty4: "אוזניות Soundcore אלחוטיות",
  r50i: "מאוורר עמוד",
  spaceOne: "מצלמת אבטחה Xiaomi 360°",
};

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

  document.getElementById("screen2-title").textContent =
    `🎁 בחרו את המתנה שלכם למכונת ה-${machineLabels[state.machine]}`;

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

const giftCards = document.querySelectorAll(".gift-card");
const confirmGiftButton = document.getElementById("confirm-gift-button");

giftCards.forEach((card) => {
  card.addEventListener("click", () => selectGift(card));
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectGift(card);
    }
  });
});

function selectGift(card) {
  giftCards.forEach((c) => {
    c.classList.remove("selected");
    c.setAttribute("aria-selected", "false");
  });
  card.classList.add("selected");
  card.setAttribute("aria-selected", "true");
  card.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });

  state.gift = card.dataset.gift;
  state.giftSku = skuFromCard(card);
  confirmGiftButton.disabled = false;
}

document.getElementById("back-button").addEventListener("click", () => {
  goToScreen(1);
});

document.getElementById("confirm-gift-button").addEventListener("click", () => {
  if (!state.gift) return;
  renderConfirmation();
  submitToSheet();
  goToScreen("confirm");
});

function renderConfirmation() {
  const details = document.getElementById("confirm-details");
  details.innerHTML = "";

  const rows = [
    ["מכונה שנרכשה", machineLabels[state.machine]],
    ["שם מלא", `${state.firstName} ${state.lastName}`],
    ["טלפון", state.phone],
    ["אימייל", state.email],
    ["מתנה שנבחרה", giftLabels[state.gift]],
  ];

  if (invoice.name) rows.push(["חשבונית", invoice.name]);

  rows.forEach(([label, value]) => {
    const row = document.createElement("div");
    row.innerHTML = `<dt>${label}</dt><dd>${value}</dd>`;
    details.appendChild(row);
  });
}

document.getElementById("restart-button").addEventListener("click", () => {
  detailsForm.reset();
  ["firstName", "lastName", "phone", "email"].forEach((name) => {
    detailsForm.elements[name].classList.remove("invalid");
    detailsForm.querySelector(`[data-error-for="${name}"]`).textContent = "";
  });

  giftCards.forEach((c) => {
    c.classList.remove("selected");
    c.setAttribute("aria-selected", "false");
  });
  confirmGiftButton.disabled = true;

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

  Object.keys(state).forEach((key) => (state[key] = key === "gift" || key === "machine" ? null : ""));

  goToScreen(0);
});
