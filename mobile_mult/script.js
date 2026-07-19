const SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbwjSMfvGLg3qcZXAGxPh6s89V9Wlna2sMu0ytcra7fu0gIhP2uDTjeCFrZlEmcmit4W/exec";
const CONFIG_URL = SHEETS_WEBHOOK_URL; // doGet מחזיר את הקונפיגורציה

// תוכן ברירת מחדל - משמש כ-fallback אם טעינת הקונפיגורציה נכשלת.
const DEFAULT_CONFIG = {
  texts: {
    screen0Title: "☕ בחרו את מכונת הקפה שלכם",
    screen0Subtitle: "בחרו את הדגם שרכשתם כדי להמשיך",
    screen1Title: "☕ מצטרפים למועדון הקפה",
    screen1Subtitle: "מלאו את הפרטים שלכם כדי להמשיך לבחירת מתנה",
    screen2Subtitle: "בחרו את דגם אוזניות ה-Anker הרצוי",
    confirmTitle: "תודה, ההרשמה הושלמה!",
  },
  machines: [
    { id: "solo", name: "Caffeo Solo", desc: "מכונה קומפקטית וקלה לתפעול", image: "c1.jpg" },
    { id: "purista", name: "Purista", desc: "עיצוב מינימליסטי ואינטואיטיבי", image: "purista.jpg" },
    { id: "baristaTS", name: "Barista T Smart", desc: "טכנולוגיה חכמה וגמישות מרבית", image: "barista-ts.jpg" },
    { id: "avanza", name: "Avanza", desc: "פתרון קפה משפחתי איכותי", image: "avanza.jpg" },
  ],
  gifts: [
    { id: "lifeP3", name: "Soundcore Life P3", desc: "אוזניות אלחוטיות עם ביטול רעשים אקטיבי", image: "gift-lifep3.jpg" },
    { id: "spaceA40", name: "Soundcore Space A40", desc: "ביטול רעשים אדפטיבי וסוללה ארוכה", image: "gift-spacea40.jpg" },
    { id: "liberty4", name: "Soundcore Liberty 4", desc: "איכות סאונד פרימיום עם ANC", image: "gift-liberty4.png" },
    { id: "r50i", name: "Soundcore R50i NC", desc: "אוזניות ספורט עמידות במים עם ANC", image: "gift-r50i.jpg" },
  ],
};

let config = DEFAULT_CONFIG;
let machineLabels = {};
let giftLabels = {};

const state = {
  machine: null,
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  gift: null,
};

function submitToSheet() {
  if (!SHEETS_WEBHOOK_URL || SHEETS_WEBHOOK_URL === "YOUR_APPS_SCRIPT_WEB_APP_URL") return;

  fetch(SHEETS_WEBHOOK_URL, {
    method: "POST",
    body: JSON.stringify({
      ...state,
      machineLabel: machineLabels[state.machine],
      giftLabel: giftLabels[state.gift],
    }),
  }).catch((err) => console.error("Failed to save registration:", err));
}

/* ============ טעינת קונפיגורציה ורינדור ============ */

function normalizeConfig(raw) {
  if (!raw || typeof raw !== "object") return DEFAULT_CONFIG;
  return {
    texts: Object.assign({}, DEFAULT_CONFIG.texts, raw.texts || {}),
    machines: Array.isArray(raw.machines) && raw.machines.length ? raw.machines : DEFAULT_CONFIG.machines,
    gifts: Array.isArray(raw.gifts) && raw.gifts.length ? raw.gifts : DEFAULT_CONFIG.gifts,
  };
}

async function loadConfig() {
  try {
    const res = await fetch(CONFIG_URL, { method: "GET" });
    const raw = await res.json();
    config = normalizeConfig(raw);
  } catch (err) {
    console.warn("Using default config (fetch failed):", err);
    config = DEFAULT_CONFIG;
  }
  applyConfig();
}

function applyConfig() {
  buildLabels();
  renderTexts();
  renderCards("machine-grid", config.machines, "machine-card", "machine");
  renderCards("gift-carousel", config.gifts, "gift-card", "gift");
}

function buildLabels() {
  machineLabels = {};
  config.machines.forEach((m) => (machineLabels[m.id] = m.name));
  giftLabels = {};
  config.gifts.forEach((g) => (giftLabels[g.id] = g.name));
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el && value) el.textContent = value;
}

function renderTexts() {
  const t = config.texts || {};
  setText("screen0-title", t.screen0Title);
  setText("screen0-sub", t.screen0Subtitle);
  setText("screen1-title", t.screen1Title);
  setText("screen1-sub", t.screen1Subtitle);
  setText("screen2-sub", t.screen2Subtitle);
  setText("confirm-title", t.confirmTitle);
}

function renderCards(gridId, items, cardClass, datasetKey) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = "";

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = cardClass;
    card.dataset[datasetKey] = item.id;
    card.tabIndex = 0;
    card.setAttribute("role", "option");
    card.setAttribute("aria-selected", "false");

    if (item.image) {
      const img = document.createElement("img");
      img.src = item.image;
      img.alt = item.name || "";
      img.className = cardClass + "-image";
      card.appendChild(img);
    }

    const h3 = document.createElement("h3");
    h3.textContent = item.name || "";
    card.appendChild(h3);

    const p = document.createElement("p");
    p.textContent = item.desc || "";
    card.appendChild(p);

    grid.appendChild(card);
  });
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

/* ============ מסך 0: בחירת מכונה (event delegation) ============ */

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

  document.getElementById("screen2-title").textContent =
    `🎁 בחרו את המתנה שלכם למכונת ה-${machineLabels[state.machine]}`;

  goToScreen(2);
});

["firstName", "lastName", "phone", "email"].forEach((name) => {
  detailsForm.elements[name].addEventListener("blur", () => {
    if (detailsForm.elements[name].value.trim()) validateField(name);
  });
});

/* ============ מסך 2: בחירת מתנה (event delegation) ============ */

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

  Object.keys(state).forEach((key) => (state[key] = key === "gift" || key === "machine" ? null : ""));

  goToScreen(0);
});

/* ============ אתחול ============ */
loadConfig();
