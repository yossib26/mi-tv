// הדביקו קובץ זה ב-Extensions > Apps Script של גיליון ה-Google Sheets
// אחרי הדבקה: Deploy > Manage deployments > ערכו את הפריסה הקיימת > Version: New version > Deploy
// הסקריפט קורא את שורת הכותרות בגיליון ומשבץ כל ערך לעמודה המתאימה לפי שם הכותרת,
// כך שסדר/מיקום העמודות בגיליון לא משנה - אפשר להוסיף/להזיז עמודות בלי לשבור את הקוד.

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);

  var fieldsByHeader = {
    "תאריך": new Date(),
    "שם פרטי": data.firstName || "",
    "שם משפחה": data.lastName || "",
    "טלפון": data.phone || "",
    "אימייל": data.email || "",
    "מתנה": data.giftLabel || data.gift || "",
    "נרכשה": data.machineLabel || data.machine || "",
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
