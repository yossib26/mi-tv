// הדביקו קובץ זה ב-Extensions > Apps Script של גיליון ה-Google Sheets
// אחרי הדבקה: Deploy > Manage deployments > ערכו את הפריסה הקיימת > Version: New version > Deploy
// הסקריפט קורא את שורת הכותרות בגיליון ומשבץ כל ערך לעמודה המתאימה לפי שם הכותרת,
// כך שסדר/מיקום העמודות בגיליון לא משנה - אפשר להוסיף/להזיז עמודות בלי לשבור את הקוד.
//
// חדש: אם נשלחה חשבונית, היא נשמרת ל-Google Drive בתיקייה "Coffee Club Invoices"
// והקישור אליה נכתב לעמודה בשם "חשבונית". יש להוסיף עמודה כזו בשורת הכותרות בגיליון.
//
// ⚠️ חובה לאשר הרשאת Drive לפני שהעלאת חשבונית תעבוד:
//    1. בחרו למעלה את הפונקציה authorizeDrive ולחצו Run (▶).
//    2. Google יבקש הרשאות - אשרו את הגישה ל-Drive.
//    3. רק אז בצעו Deploy > Manage deployments > New version > Deploy.

// הריצו ידנית פעם אחת כדי לאשר את הרשאת ה-Drive (וגם יוצר את תיקיית היעד).
function authorizeDrive() {
  var folderName = "Coffee Club Invoices";
  var folders = DriveApp.getFoldersByName(folderName);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
  Logger.log("OK - הרשאת Drive אושרה. תיקייה מוכנה: " + folder.getName());
}

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);

  var invoiceUrl = "";
  if (data.invoiceData) {
    invoiceUrl = saveInvoice_(data);
  }

  var fieldsByHeader = {
    "תאריך": new Date(),
    "שם פרטי": data.firstName || "",
    "שם משפחה": data.lastName || "",
    "טלפון": data.phone || "",
    "אימייל": data.email || "",
    "מתנה": data.giftLabel || data.gift || "",
    "נרכשה": data.machineLabel || data.machine || "",
    "חשבונית": invoiceUrl,
  };

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = headers.map(function (header) {
    return fieldsByHeader.hasOwnProperty(header) ? fieldsByHeader[header] : "";
  });

  sheet.appendRow(row);

  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok" }))
    .setMimeType(ContentService.MimeType.JSON);
}

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
