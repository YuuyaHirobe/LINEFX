require('dotenv').config();

const express = require('express');
const line = require('@line/bot-sdk');

const app = express();

const required = [
  'LINE_CHANNEL_ACCESS_TOKEN',
  'LINE_CHANNEL_SECRET',
  'NOTIFY_API_KEY'
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env: ${key}`);
  }
}

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
});

const capturedGroupIds = new Set();

app.get('/healthz', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.get('/group-ids', (_req, res) => {
  res.status(200).json({ groupIds: Array.from(capturedGroupIds) });
});

app.post('/callback', line.middleware(config), async (req, res) => {
  try {
    const events = req.body.events || [];
    for (const event of events) {
      const source = event.source || {};
      if (source.type === 'group' && source.groupId) {
        capturedGroupIds.add(source.groupId);
        console.log('[groupId captured]', source.groupId);
      }

      if (event.type === 'join' && source.type === 'group' && source.groupId) {
        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [
            {
              type: 'text',
              text: 'スプレッドシート更新通知Botを有効化しました。'
            }
          ]
        });
      }
    }

    res.status(200).end();
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
});

app.post('/notify', express.json(), async (req, res) => {
  try {
    const key = req.header('x-api-key');
    if (!key || key !== process.env.NOTIFY_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      spreadsheetName,
      spreadsheetUrl,
      sheetName,
      a1Notation,
      newValue,
      oldValue,
      editedAt,
      groupId,
      changedCells
    } = req.body || {};

    const targetGroupId = groupId || process.env.LINE_GROUP_ID;
    if (!targetGroupId) {
      return res.status(400).json({ error: 'Missing target groupId or LINE_GROUP_ID' });
    }

    const hasChangedCells = Array.isArray(changedCells) && changedCells.length > 0;
    const lines = hasChangedCells
      ? [
          'スプシを変更したよ。確認してね',
          ...changedCells.slice(0, 3),
          spreadsheetUrl ? `URL: ${spreadsheetUrl}` : null
        ].filter(Boolean)
      : [
          'スプシを変更したよ。確認してね',
          a1Notation ? `セル: ${a1Notation}` : null,
          typeof newValue !== 'undefined' ? `変更後: ${String(newValue)}` : null,
          editedAt ? `時刻: ${editedAt}` : null,
          spreadsheetName ? `ファイル: ${spreadsheetName}` : null,
          sheetName ? `シート: ${sheetName}` : null,
          typeof oldValue !== 'undefined' ? `変更前: ${String(oldValue)}` : null,
          spreadsheetUrl ? `URL: ${spreadsheetUrl}` : null
        ].filter(Boolean);

    await client.pushMessage({
      to: targetGroupId,
      messages: [
        {
          type: 'text',
          text: lines.join('\n')
        }
      ]
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to send LINE message' });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
