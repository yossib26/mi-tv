// ממשק ניהול - טוען/שומר קונפיגורציה דרך Apps Script.
// הגישה לדף עצמו מוגנת ב-Vercel Edge Middleware (Basic Auth).
// השמירה מאומתת ע"י ADMIN_TOKEN שמוגדר ב-Apps Script Script Properties.

const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbwjSMfvGLg3qcZXAGxPh6s89V9Wlna2sMu0ytcra7fu0gIhP2uDTjeCFrZlEmcmit4W/exec";

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

const TEXT_LABELS = {
  screen0Title: "כותרת - מסך בחירת מכונה",
  screen0Subtitle: "תת-כותרת - מסך בחירת מכונה",
  screen1Title: "כותרת - מסך פרטים אישיים",
  screen1Subtitle: "תת-כותרת - מסך פרטים אישיים",
  screen2Subtitle: "תת-כותרת - מסך בחירת מתנה",
  confirmTitle: "כותרת - מסך אישור",
};

// התמונות מוגשות מ-/mobile_mult/, לכן התצוגה המקדימה מצביעה לשם.
const IMAGE_BASE = "../mobile_mult/";

const statusEl = document.getElementById("status");
const tokenInput = document.getElementById("admin-token");
const textsFields = document.getElementById("texts-fields");
const machinesList = document.getElementById("machines-list");
const giftsList = document.getElementById("gifts-list");

function showStatus(msg, kind) {
  statusEl.textContent = msg;
  statusEl.className = "status show " + (kind || "");
}

function resolveThumb(src) {
  if (!src) return "";
  if (/^https?:\/\//.test(src) || src.startsWith("/")) return src;
  return IMAGE_BASE + src;
}

function normalizeConfig(raw) {
  if (!raw || typeof raw !== "object" || Object.keys(raw).length === 0) return clone(DEFAULT_CONFIG);
  return {
    texts: Object.assign({}, DEFAULT_CONFIG.texts, raw.texts || {}),
    machines: Array.isArray(raw.machines) && raw.machines.length ? raw.machines : clone(DEFAULT_CONFIG.machines),
    gifts: Array.isArray(raw.gifts) && raw.gifts.length ? raw.gifts : clone(DEFAULT_CONFIG.gifts),
  };
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/* ---------- רינדור ---------- */

function renderTexts(texts) {
  textsFields.innerHTML = "";
  Object.keys(TEXT_LABELS).forEach((key) => {
    const wrap = document.createElement("div");
    wrap.className = "field";

    const label = document.createElement("label");
    label.textContent = TEXT_LABELS[key];

    const input = document.createElement("input");
    input.type = "text";
    input.className = "text-input f-text";
    input.dataset.key = key;
    input.value = texts[key] || "";

    wrap.appendChild(label);
    wrap.appendChild(input);
    textsFields.appendChild(wrap);
  });
}

function renderItems(listEl, items) {
  listEl.innerHTML = "";
  items.forEach((item) => listEl.appendChild(buildItemRow(item)));
}

function buildItemRow(item) {
  item = item || { id: "", name: "", desc: "", image: "" };

  const row = document.createElement("div");
  row.className = "item-row";

  // תצוגה מקדימה
  const thumbSrc = resolveThumb(item.image);
  let thumb;
  if (thumbSrc) {
    thumb = document.createElement("img");
    thumb.className = "item-thumb";
    thumb.src = thumbSrc;
    thumb.alt = "";
  } else {
    thumb = document.createElement("div");
    thumb.className = "item-thumb empty";
    thumb.textContent = "🖼";
  }

  // שדות
  const fields = document.createElement("div");
  fields.className = "item-fields";

  const nameInput = mkInput("f-name", "שם", item.name);
  const descInput = mkInput("f-desc", "תיאור", item.desc);

  const row2 = document.createElement("div");
  row2.className = "row2";
  const imageInput = mkInput("f-image", "תמונה (שם קובץ או URL)", item.image);
  const idInput = mkInput("f-id", "מזהה (ייחודי)", item.id);
  row2.appendChild(imageInput);
  row2.appendChild(idInput);

  imageInput.querySelector("input").addEventListener("input", (e) => {
    const src = resolveThumb(e.target.value.trim());
    if (src) {
      const img = document.createElement("img");
      img.className = "item-thumb";
      img.src = src;
      img.alt = "";
      row.replaceChild(img, row.firstChild);
    }
  });

  fields.appendChild(nameInput);
  fields.appendChild(descInput);
  fields.appendChild(row2);

  // הסרה
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn btn-danger item-remove";
  removeBtn.textContent = "מחק";
  removeBtn.addEventListener("click", () => row.remove());

  row.appendChild(thumb);
  row.appendChild(fields);
  row.appendChild(removeBtn);
  return row;
}

function mkInput(cls, placeholder, value) {
  const wrap = document.createElement("div");
  wrap.className = "field";
  const input = document.createElement("input");
  input.type = "text";
  input.className = "text-input " + cls;
  input.placeholder = placeholder;
  input.value = value || "";
  wrap.appendChild(input);
  return wrap;
}

/* ---------- איסוף ---------- */

function collectConfig() {
  const texts = {};
  textsFields.querySelectorAll(".f-text").forEach((input) => {
    texts[input.dataset.key] = input.value.trim();
  });

  return {
    texts,
    machines: collectItems(machinesList),
    gifts: collectItems(giftsList),
  };
}

function collectItems(listEl) {
  return Array.from(listEl.querySelectorAll(".item-row"))
    .map((row) => {
      const name = row.querySelector(".f-name").value.trim();
      const desc = row.querySelector(".f-desc").value.trim();
      const image = row.querySelector(".f-image").value.trim();
      let id = row.querySelector(".f-id").value.trim();
      if (!id) id = "item-" + Math.random().toString(36).slice(2, 9);
      return { id, name, desc, image };
    })
    .filter((item) => item.name);
}

/* ---------- טעינה ושמירה ---------- */

async function loadConfig() {
  showStatus("טוען קונפיגורציה...", "");
  let cfg;
  try {
    const res = await fetch(WEBHOOK_URL, { method: "GET" });
    const raw = await res.json();
    cfg = normalizeConfig(raw);
    showStatus("נטען בהצלחה.", "ok");
  } catch (err) {
    cfg = clone(DEFAULT_CONFIG);
    showStatus("לא ניתן לטעון מהשרת - מוצגות ברירות מחדל. " + err.message, "err");
  }
  renderTexts(cfg.texts);
  renderItems(machinesList, cfg.machines);
  renderItems(giftsList, cfg.gifts);
}

async function saveConfig() {
  const token = tokenInput.value.trim();
  if (!token) {
    showStatus("יש להזין ADMIN_TOKEN לפני שמירה.", "err");
    return;
  }
  localStorage.setItem("coffeeAdminToken", token);

  const config = collectConfig();
  showStatus("שומר...", "");

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      body: JSON.stringify({ action: "saveConfig", token, config }),
    });
    let result = null;
    try { result = await res.json(); } catch (e) { /* CORS/redirect - נתעלם */ }

    if (result && result.status === "error") {
      showStatus("שמירה נכשלה: " + (result.message || "לא מאושר - בדוק את ה-ADMIN_TOKEN"), "err");
      return;
    }
    showStatus("✓ נשמר. רענן את האתר הציבורי (/mobile_mult/) כדי לראות את השינויים.", "ok");
  } catch (err) {
    showStatus("הבקשה נשלחה אך לא ניתן לאמת תגובה. ודא ידנית בגיליון/באתר. (" + err.message + ")", "err");
  }
}

/* ---------- חיווט ---------- */

document.getElementById("add-machine").addEventListener("click", () => {
  machinesList.appendChild(buildItemRow());
});
document.getElementById("add-gift").addEventListener("click", () => {
  giftsList.appendChild(buildItemRow());
});
document.getElementById("save-button").addEventListener("click", saveConfig);
document.getElementById("reload-button").addEventListener("click", loadConfig);

// שחזור טוקן שנשמר מקומית
const savedToken = localStorage.getItem("coffeeAdminToken");
if (savedToken) tokenInput.value = savedToken;

loadConfig();
