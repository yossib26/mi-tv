// הדביקו קובץ זה ב-Extensions > Apps Script של גיליון ה-Google Sheets.
// אחרי הדבקה: Deploy > Manage deployments > ערכו את הפריסה > Version: New version > Deploy.
//
// הגדרת סוד לממשק הניהול (חד-פעמי):
//   Project Settings (סמל גלגל השיניים) > Script Properties > Add script property
//   Property: ADMIN_TOKEN   Value: <בחרו סוד כלשהו - תזינו אותו גם בממשק הניהול>
//
// הסקריפט מטפל בשלושה דברים:
//   POST ללא action / action="register"  -> מוסיף שורת הרשמה לגיליון (לפי שמות הכותרות)
//   POST action="saveConfig" + token     -> שומר קונפיגורציה (מכונות/מתנות/טקסטים)
//   GET  (או ?type=config)               -> מחזיר את הקונפיגורציה השמורה

function doPost(e) {
  var data = JSON.parse(e.postData.contents);

  if (data.action === "saveConfig") {
    return saveConfig_(data);
  }

  return appendRegistration_(data);
}

function doGet(e) {
  var props = PropertiesService.getScriptProperties();
  var config = props.getProperty("SITE_CONFIG");
  return ContentService
    .createTextOutput(config || "{}")
    .setMimeType(ContentService.MimeType.JSON);
}

function appendRegistration_(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

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

  return jsonOut_({ status: "ok" });
}

function saveConfig_(data) {
  var props = PropertiesService.getScriptProperties();
  var expected = props.getProperty("ADMIN_TOKEN");

  if (!expected || data.token !== expected) {
    return jsonOut_({ status: "error", message: "unauthorized" });
  }

  props.setProperty("SITE_CONFIG", JSON.stringify(data.config || {}));
  return jsonOut_({ status: "ok" });
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
