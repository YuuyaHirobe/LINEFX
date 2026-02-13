/**
 * Google Apps Script side for spreadsheet edit notifications.
 *
 * Behavior:
 * - Buffer edits on each onEdit event
 * - Send one summary notification after a quiet period
 *
 * Required triggers:
 * - onEdit (From spreadsheet -> On edit)
 * - flushBufferedNotifications (Time-driven -> Every 1 minute)
 */

const WEBHOOK_URL = 'https://YOUR_SERVER_DOMAIN/notify';
const NOTIFY_API_KEY = 'WjmOE135yXwtGdsNgrIpuLeq6UzJca9fnF7lQP0h';
const LINE_GROUP_ID = '';

// Treat "sheet closed" as "no edits for this duration".
const QUIET_PERIOD_SECONDS = 120;
const MAX_BUFFERED_CHANGES = 50;
const MAX_LINES_IN_MESSAGE = 3;

const KEY_PENDING = 'pending_changes';
const KEY_LAST_EDITED_AT = 'last_edited_at';
const KEY_SPREADSHEET_URL = 'spreadsheet_url';

function onEdit(e) {
  if (!e || !e.range) return;

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const range = e.range;
    const sheet = range.getSheet();
    const ss = sheet.getParent();

    const oneChange = {
      sheetName: sheet.getName(),
      a1Notation: range.getA1Notation(),
      oldValue: typeof e.oldValue !== 'undefined' ? String(e.oldValue) : '',
      newValue: typeof e.value !== 'undefined' ? String(e.value) : '',
      editedAt: new Date().toISOString()
    };

    const props = PropertiesService.getScriptProperties();
    const pending = JSON.parse(props.getProperty(KEY_PENDING) || '[]');
    pending.push(oneChange);

    if (pending.length > MAX_BUFFERED_CHANGES) {
      pending.splice(0, pending.length - MAX_BUFFERED_CHANGES);
    }

    props.setProperty(KEY_PENDING, JSON.stringify(pending));
    props.setProperty(KEY_LAST_EDITED_AT, String(Date.now()));
    props.setProperty(KEY_SPREADSHEET_URL, ss.getUrl());

  } finally {
    lock.releaseLock();
  }
}

function flushBufferedNotifications() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const props = PropertiesService.getScriptProperties();
    const pending = JSON.parse(props.getProperty(KEY_PENDING) || '[]');
    const lastEditedAt = Number(props.getProperty(KEY_LAST_EDITED_AT) || '0');

    if (!pending.length || !lastEditedAt) return;

    const now = Date.now();
    if (now - lastEditedAt < QUIET_PERIOD_SECONDS * 1000) return;

    const total = pending.length;
    const head = pending.slice(-MAX_LINES_IN_MESSAGE);
    const changedCells = head.map(function(c) {
      return c.a1Notation;
    });

    const payload = {
      changedCells: changedCells,
      changeCount: total,
      editedAt: new Date(lastEditedAt).toISOString(),
      spreadsheetUrl: props.getProperty(KEY_SPREADSHEET_URL) || ''
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
      return;
    }

    props.deleteProperty(KEY_PENDING);
    props.deleteProperty(KEY_LAST_EDITED_AT);
    props.deleteProperty(KEY_SPREADSHEET_URL);
  } finally {
    lock.releaseLock();
  }
}
