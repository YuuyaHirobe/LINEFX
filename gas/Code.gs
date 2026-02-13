/**
 * Google Apps Script side for spreadsheet edit notifications.
 *
 * Steps:
 * 1) Open the target spreadsheet -> Extensions -> Apps Script
 * 2) Paste this file and set constants below
 * 3) Create installable trigger: onEdit -> Head deployment
 */

const WEBHOOK_URL = 'https://YOUR_SERVER_DOMAIN/notify';
const NOTIFY_API_KEY = 'YOUR_RANDOM_SHARED_SECRET';
// Optional: set if you want to override server-side LINE_GROUP_ID
const LINE_GROUP_ID = '';

function onEdit(e) {
  if (!e || !e.range) return;

  const range = e.range;
  const sheet = range.getSheet();
  const ss = sheet.getParent();

  const payload = {
    spreadsheetName: ss.getName(),
    spreadsheetUrl: ss.getUrl(),
    sheetName: sheet.getName(),
    a1Notation: range.getA1Notation(),
    newValue: typeof e.value !== 'undefined' ? e.value : '',
    oldValue: typeof e.oldValue !== 'undefined' ? e.oldValue : '',
    editedAt: new Date().toISOString()
  };

  if (LINE_GROUP_ID) {
    payload.groupId = LINE_GROUP_ID;
  }

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': NOTIFY_API_KEY
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const resp = UrlFetchApp.fetch(WEBHOOK_URL, options);
  const code = resp.getResponseCode();
  if (code >= 300) {
    console.log('Notify failed: ' + code + ' body=' + resp.getContentText());
  }
}
