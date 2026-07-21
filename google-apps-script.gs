// הדביקו קובץ זה ב-Extensions > Apps Script של גיליון ה-Google Sheets.
//
// מה הסקריפט עושה בכל הרשמה:
//   1. שומר חשבונית (אם נשלחה) ל-Google Drive בתיקייה "Coffee Club Invoices"
//   2. מוסיף שורה לגיליון, לפי שמות הכותרות (סדר העמודות לא משנה)
//   3. שולח מייל אישור ללקוח + עותק לבעל הסקריפט
//
// ⚠️ חובה לאשר הרשאות לפני שזה יעבוד:
//    1. בחרו למעלה את הפונקציה authorizeAll ולחצו Run (▶)
//    2. אשרו את הגישה ל-Drive ולשליחת דואר
//    3. רק אז: Deploy > Manage deployments > Edit > Version: New version > Deploy
//       (שימו לב: "New version" משמר את אותה כתובת. "New deployment" יוצר כתובת חדשה
//        ואז צריך לעדכן אותה גם בקוד האתר.)
//
// מכסת שליחת דואר: 100 נמענים ליום בחשבון Gmail רגיל, 1,500 ב-Workspace.

// כתובת לקבלת התראות על הרשמות. השאירו ריק כדי לשלוח לחשבון שבבעלותו הסקריפט.
var OWNER_EMAIL = "";

// הריצו ידנית פעם אחת כדי לאשר את ההרשאות (וגם מכין את תיקיית היעד).
function authorizeAll() {
  var folderName = "Coffee Club Invoices";
  var folders = DriveApp.getFoldersByName(folderName);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

  var quota = MailApp.getRemainingDailyQuota();

  Logger.log("OK - תיקיית Drive: " + folder.getName() + " | מכסת מיילים שנותרה היום: " + quota);
}

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);

  var invoiceUrl = "";
  if (data.invoiceData) {
    invoiceUrl = saveInvoice_(data);
  }

  // כל ערך והכותרות שהוא מתאים להן. אפשר לכתוב בגיליון כל אחת מהחלופות
  // (עם/בלי גרשיים, "מכונה" או "מכונת קפה") והערך ישובץ נכון.
  var fields = [
    { value: new Date(), headers: ["תאריך"] },
    { value: data.firstName || "", headers: ["שם פרטי"] },
    { value: data.lastName || "", headers: ["שם משפחה"] },
    { value: data.phone || "", headers: ["טלפון"] },
    { value: data.email || "", headers: ["אימייל"] },
    { value: data.giftLabel || data.gift || "", headers: ["מתנה", "שם מתנה"] },
    { value: data.machineLabel || data.machine || "", headers: ["נרכשה", "מכונה", "מכונה שנרכשה"] },
    { value: data.store || "", headers: ["מקום רכישה", "חנות", "רשת שיווק", "היכן נרכש"] },
    { value: invoiceUrl, headers: ["חשבונית"] },
    {
      value: data.machineSku || "",
      headers: ["מק״ט מכונה", "מקט מכונה", "מק״ט מכונת קפה", "מקט מכונת קפה"],
    },
    {
      value: data.giftSku || "",
      headers: ["מק״ט מתנה", "מקט מתנה"],
    },
  ];

  // התאמה גמישה: מתעלמת מרווחים ומסוגי גרשיים שונים
  function normalize_(text) {
    return String(text).replace(/["'׳״‘’“”]/g, "").replace(/\s+/g, "");
  }

  var valueByHeader = {};
  fields.forEach(function (field) {
    field.headers.forEach(function (header) {
      valueByHeader[normalize_(header)] = field.value;
    });
  });

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = headers.map(function (header) {
    var key = normalize_(header);
    return valueByHeader.hasOwnProperty(key) ? valueByHeader[key] : "";
  });

  sheet.appendRow(row);

  // המיילים נשלחים רק אחרי שהשורה נשמרה, וכשל בשליחה לא מפיל את הרישום.
  try {
    sendEmails_(data, invoiceUrl);
  } catch (err) {
    Logger.log("שליחת המייל נכשלה: " + err.message);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok" }))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ================== דואר ================== */

function sendEmails_(data, invoiceUrl) {
  var machine = data.machineLabel || data.machine || "";
  var machineSku = data.machineSku || "";
  var gift = data.giftLabel || data.gift || "";
  var giftSku = data.giftSku || "";
  var fullName = ((data.firstName || "") + " " + (data.lastName || "")).trim();

  var rows = [
    ["מכונת הקפה", machine + (machineSku ? " (מק״ט " + machineSku + ")" : "")],
    ["המתנה שנבחרה", gift + (giftSku ? " (מק״ט " + giftSku + ")" : "")],
    ["טלפון", data.phone || ""],
    ["אימייל", data.email || ""],
  ];
  if (data.store) {
    rows.push(["מקום רכישה", data.store]);
  }
  if (invoiceUrl && invoiceUrl.indexOf("ERROR:") !== 0) {
    rows.push(["חשבונית", "התקבלה"]);
  }

  // --- מייל ללקוח ---
  if (isValidEmail_(data.email)) {
    MailApp.sendEmail({
      to: data.email,
      subject: "אישור הרשמה - מועדון הקפה",
      htmlBody: customerHtml_(data.firstName || "", rows),
      name: "מועדון הקפה",
    });
  }

  // --- עותק לבעל הסקריפט ---
  var owner = OWNER_EMAIL || Session.getEffectiveUser().getEmail();
  if (isValidEmail_(owner)) {
    var ownerRows = rows.slice();
    ownerRows.unshift(["שם מלא", fullName]);
    if (invoiceUrl && invoiceUrl.indexOf("ERROR:") !== 0) {
      ownerRows.push(["קישור לחשבונית", invoiceUrl]);
    }

    MailApp.sendEmail({
      to: owner,
      subject: "הרשמה חדשה: " + fullName + (machine ? " - " + machine : ""),
      htmlBody: ownerHtml_(ownerRows),
      name: "מועדון הקפה",
    });
  }
}

function customerHtml_(firstName, rows) {
  return '' +
    '<div dir="rtl" style="font-family:Arial,sans-serif;background:#f8f5f2;padding:24px;">' +
      '<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e8ddd4;border-radius:10px;overflow:hidden;">' +
        '<div style="background:#c1272d;color:#ffffff;padding:18px 24px;font-size:18px;font-weight:bold;">' +
          '☕ ההרשמה שלך התקבלה' +
        '</div>' +
        '<div style="padding:24px;color:#1a0f08;font-size:15px;line-height:1.6;">' +
          '<p style="margin:0 0 16px;">שלום ' + escapeHtml_(firstName) + ',</p>' +
          '<p style="margin:0 0 20px;">תודה שנרשמת! אלה הפרטים שקלטנו:</p>' +
          detailsTable_(rows) +
          '<p style="margin:20px 0 0;color:#8a7a6a;font-size:13px;">' +
            'אם משהו מהפרטים אינו נכון, אפשר להשיב למייל הזה.' +
          '</p>' +
        '</div>' +
      '</div>' +
    '</div>';
}

function ownerHtml_(rows) {
  return '' +
    '<div dir="rtl" style="font-family:Arial,sans-serif;color:#1a0f08;font-size:15px;">' +
      '<p style="margin:0 0 16px;font-weight:bold;">התקבלה הרשמה חדשה:</p>' +
      detailsTable_(rows) +
    '</div>';
}

function detailsTable_(rows) {
  var html = '<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">';
  rows.forEach(function (pair) {
    html +=
      '<tr>' +
        '<td style="padding:9px 0;color:#8a7a6a;border-bottom:1px solid #e8ddd4;white-space:nowrap;">' +
          escapeHtml_(pair[0]) +
        '</td>' +
        '<td style="padding:9px 0;font-weight:bold;border-bottom:1px solid #e8ddd4;text-align:left;">' +
          escapeHtml_(pair[1]) +
        '</td>' +
      '</tr>';
  });
  return html + '</table>';
}

// מנטרל תווי HTML מקלט משתמש, כדי שלא ישברו את מבנה המייל
function escapeHtml_(text) {
  return String(text == null ? "" : text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isValidEmail_(email) {
  return !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

/* ================== חשבוניות ================== */

function saveInvoice_(data) {
  try {
    var folderName = "Coffee Club Invoices";
    var folders = DriveApp.getFoldersByName(folderName);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

    var bytes = Utilities.base64Decode(data.invoiceData);
    var contentType = data.invoiceType || "application/octet-stream";
    var safeName =
      (data.firstName || "") + "_" + (data.lastName || "") + "_" +
      new Date().getTime() + "_" + (data.invoiceName || "invoice");

    var blob = Utilities.newBlob(bytes, contentType, safeName);
    var file = folder.createFile(blob);
    return file.getUrl();
  } catch (err) {
    return "ERROR: " + err.message;
  }
}
