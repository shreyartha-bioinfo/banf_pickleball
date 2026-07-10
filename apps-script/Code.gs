/**
 * BANF Sports Day 2026 — Pickleball results backend.
 * Deploy this bound to a Google Sheet as a Web App (see README.md).
 */

const SHEET_NAME = "Results";
const HEADERS = ["GameId", "Court", "Team1", "Team2", "Score1", "Score2", "Winner", "LastUpdated"];

function doGet(e) {
  const sheet = getSheet_();
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const results = data
    .filter((row) => row[0] !== "" && row[0] !== null)
    .map((row) => {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = row[i]));
      return obj;
    });
  return jsonResponse_({ results: results });
}

function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  const sheet = getSheet_();
  const data = sheet.getDataRange().getValues();

  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(payload.gameId)) {
      rowIndex = i + 1; // 1-indexed, +1 for header row already accounted by loop start
      break;
    }
  }

  const score1 = Number(payload.score1);
  const score2 = Number(payload.score2);
  const winner = score1 === score2 ? "" : score1 > score2 ? payload.team1 : payload.team2;

  const row = [
    payload.gameId,
    payload.court,
    payload.team1,
    payload.team2,
    score1,
    score2,
    winner,
    new Date()
  ];

  if (rowIndex === -1) {
    sheet.appendRow(row);
  } else {
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  }

  return jsonResponse_({ status: "ok" });
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getRange(1, 1).getValue() !== HEADERS[0]) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
  return sheet;
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
