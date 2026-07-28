// ניהול רשימת החנויות: טוען את stores.json, מאפשר עריכה, ומפיק קובץ מעודכן.
// הכלי אינו כותב לשרת (אתר סטטי) - הוא מייצר את הקובץ להורדה/העתקה.

const STORES_URL = "../../stores.json"; // stores.json בשורש הפרויקט
const IMG_BASE = "../../img/";          // תמונות משותפות בשורש/img

const DEFAULT_STORES = [
  { id: "machsanei-hashmal", label: "מחסני חשמל", logo: "s_machsanei.png" },
  { id: "ksp", label: "KSP", logo: "s_ksp.jpg" },
  { id: "bug", label: "באג", logo: "s_bug.png" },
  { id: "shekem-electric", label: "שקם אלקטריק" },
  { id: "alm", label: "א.ל.מ" },
  { id: "other", label: "אחר", icon: "➕", other: true },
];

let stores = [];

const rowsEl = document.getElementById("rows");
const previewEl = document.getElementById("preview");
const jsonOut = document.getElementById("json-out");
const statusEl = document.getElementById("status");

// חיווט מוגן: אם אלמנט חסר (למשל חוסר סנכרון מטמון HTML/JS) - לא זורק שגיאה שעוצרת את כל הסקריפט.
function on(id, event, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, handler);
}

/* ---------- טעינה ---------- */

async function loadStores() {
  try {
    const res = await fetch(STORES_URL + "?t=" + Date.now());
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (!Array.isArray(data.stores) || !data.stores.length) throw new Error("empty");
    stores = data.stores.map(normalizeStore);
    setStatus("נטען מ-stores.json (" + stores.length + " חנויות).");
  } catch (err) {
    stores = DEFAULT_STORES.map(normalizeStore);
    setStatus("לא ניתן לטעון את הקובץ — נטענה רשימת ברירת מחדל. (" + err.message + ")");
  }
  renderAll();
}

function normalizeStore(s) {
  return {
    id: (s.id || "").trim(),
    label: (s.label || "").trim(),
    logo: (s.logo || "").trim(),
    icon: (s.icon || "").trim(),
    other: !!s.other,
  };
}

/* ---------- עריכה ---------- */

function slugify(text) {
  return String(text).trim().replace(/\s+/g, "-");
}

function renderRows() {
  rowsEl.innerHTML = "";
  stores.forEach((s, i) => {
    const row = document.createElement("div");
    row.className = "store-row";

    const labelFld = field("שם החנות", s.label, () => {});
    const idFld = field("מזהה (id)", s.id, (v) => { s.id = v.trim(); onChange(false); });
    const idInput = idFld.querySelector("input");
    const labelInput = labelFld.querySelector("input");
    labelInput.addEventListener("input", () => {
      s.label = labelInput.value;
      if (!s.id) { s.id = slugify(labelInput.value); idInput.value = s.id; }
      onChange(false);
    });
    row.appendChild(labelFld);
    row.appendChild(idFld);

    row.appendChild(field("לוגו (שם קובץ ב-img/)", s.logo, (v) => {
      s.logo = v.trim();
      onChange();
    }, s.other));

    // צ'קבוקס "אחר"
    const checkWrap = document.createElement("div");
    checkWrap.className = "fld fld--check";
    const cbLabel = document.createElement("label");
    cbLabel.textContent = "אפשרות 'אחר'";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = s.other;
    cb.addEventListener("change", () => {
      // רק חנות אחת יכולה להיות "אחר"
      if (cb.checked) {
        stores.forEach((o) => { o.other = false; o.icon = ""; });
        s.other = true;
        s.icon = s.icon || "➕";
        s.logo = "";
      } else {
        s.other = false;
        s.icon = "";
      }
      onChange();
    });
    checkWrap.appendChild(cbLabel);
    checkWrap.appendChild(cb);
    row.appendChild(checkWrap);

    // פעולות שורה
    const actions = document.createElement("div");
    actions.className = "row-actions";
    actions.appendChild(iconBtn("▲", "העלה", i === 0, () => { move(i, -1); }));
    actions.appendChild(iconBtn("▼", "הורד", i === stores.length - 1, () => { move(i, 1); }));
    actions.appendChild(iconBtn("🗑", "מחק", false, () => { remove(i); }, true));
    row.appendChild(actions);

    rowsEl.appendChild(row);
  });
}

function field(labelText, value, onInput, disabled) {
  const wrap = document.createElement("div");
  wrap.className = "fld";
  const label = document.createElement("label");
  label.textContent = labelText;
  const input = document.createElement("input");
  input.type = "text";
  input.value = value || "";
  input.disabled = !!disabled;
  input.addEventListener("input", () => onInput(input.value));
  wrap.appendChild(label);
  wrap.appendChild(input);
  return wrap;
}

function iconBtn(symbol, title, disabled, handler, danger) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "icon-btn" + (danger ? " danger" : "");
  b.textContent = symbol;
  b.title = title;
  b.disabled = !!disabled;
  b.addEventListener("click", handler);
  return b;
}

function move(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= stores.length) return;
  [stores[i], stores[j]] = [stores[j], stores[i]];
  onChange();
}

function remove(i) {
  stores.splice(i, 1);
  onChange();
}

on("add-btn", "click", () => {
  stores.push(normalizeStore({ id: "", label: "", logo: "" }));
  onChange();
});

on("reload-btn", "click", loadStores);

// טעינת קובץ stores.json מהמחשב אל הממשק
const fileInput = document.getElementById("file-input");
on("upload-btn", "click", () => fileInput && fileInput.click());
if (fileInput) {
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!Array.isArray(data.stores) || !data.stores.length) {
          throw new Error('חסר מערך "stores" תקין');
        }
        stores = data.stores.map(normalizeStore);
        renderAll();
        setStatus("✓ נטען הקובץ " + file.name + " (" + stores.length + " חנויות).");
      } catch (err) {
        setStatus("⚠️ קובץ לא תקין: " + err.message);
      }
    };
    reader.onerror = () => setStatus("⚠️ שגיאה בקריאת הקובץ.");
    reader.readAsText(file);
    fileInput.value = "";
  });
}

/* ---------- תצוגה מקדימה ---------- */

function renderPreview() {
  previewEl.innerHTML = "";
  stores.forEach((s) => {
    const tile = document.createElement("div");
    tile.className = "store-tile";
    if (s.logo && !s.other) {
      const img = document.createElement("img");
      img.src = IMG_BASE + s.logo;
      img.alt = s.label || "";
      img.className = "store-logo";
      img.addEventListener("error", () => {
        // אם התמונה חסרה - מציגים את השם כדי שהתצוגה לא תישבר
        if (img.parentNode === tile) {
          tile.removeChild(img);
          tile.prepend(nameSpan(s.label || s.logo));
        }
      });
      tile.appendChild(img);
    } else {
      if (s.icon) {
        const icon = document.createElement("span");
        icon.className = "store-icon";
        icon.textContent = s.icon;
        tile.appendChild(icon);
      }
      tile.appendChild(nameSpan(s.label));
    }
    previewEl.appendChild(tile);
  });
}

function nameSpan(text) {
  const span = document.createElement("span");
  span.className = "store-name";
  span.textContent = text || "";
  return span;
}

/* ---------- ייצוא JSON ---------- */

function storeToObjectString(s) {
  const parts = ['"id": ' + JSON.stringify(s.id), '"label": ' + JSON.stringify(s.label)];
  if (s.other) {
    parts.push('"icon": ' + JSON.stringify(s.icon || "➕"));
    parts.push('"other": true');
  } else if (s.logo) {
    parts.push('"logo": ' + JSON.stringify(s.logo));
  }
  return "    { " + parts.join(", ") + " }";
}

function buildJson() {
  const lines = stores.map(storeToObjectString).join(",\n");
  return '{\n  "stores": [\n' + lines + "\n  ]\n}\n";
}

function renderJson() {
  jsonOut.value = buildJson();
}

/* ---------- אירוע שינוי מרכזי ---------- */

function onChange(rerenderRows = true) {
  if (rerenderRows) renderRows();
  renderPreview();
  renderJson();
}

function renderAll() {
  renderRows();
  renderPreview();
  renderJson();
}

function setStatus(msg) {
  statusEl.textContent = msg;
}

/* ---------- הורדה והעתקה ---------- */

on("download-btn", "click", () => {
  const invalid = stores.filter((s) => !s.id || !s.label);
  if (invalid.length) {
    setStatus("⚠️ לכל חנות חייבים להיות שם ומזהה (id). תקנו לפני ההורדה.");
    return;
  }
  const ids = stores.map((s) => s.id);
  if (new Set(ids).size !== ids.length) {
    setStatus("⚠️ יש מזהי (id) כפולים. כל חנות חייבת מזהה ייחודי.");
    return;
  }
  const blob = new Blob([buildJson()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "stores.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  setStatus("✓ הקובץ הורד. החליפו איתו את stores.json בשורש הפרויקט.");
});

on("copy-btn", "click", async () => {
  try {
    await navigator.clipboard.writeText(buildJson());
    setStatus("✓ הועתק ללוח.");
  } catch (err) {
    jsonOut.select();
    setStatus("לא ניתן להעתיק אוטומטית — הטקסט נבחר, העתיקו ידנית (Ctrl+C).");
  }
});

/* ---------- אתחול ---------- */
loadStores();
