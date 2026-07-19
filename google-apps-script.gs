// הדביקו קובץ זה ב-Extensions > Apps Script של גיליון ה-Google Sheets
// אחרי הדבקה: Deploy > New deployment > Web app
// Execute as: Me | Who has access: Anyone
// העתיקו את כתובת ה-Web app (מסתיימת ב-/exec) ועדכנו אותה ב-script.js תחת SHEETS_WEBHOOK_URL

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);

  sheet.appendRow([
    new Date(),
    data.firstName,
    data.lastName,
    data.phone,
    data.email,
    data.gift,
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok" }))
    .setMimeType(ContentService.MimeType.JSON);
}
