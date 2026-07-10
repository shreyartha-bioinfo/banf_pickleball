/**
 * BANF Sports Day 2026 — Pickleball read-only results backend.
 *
 * You enter everything directly in the Google Sheet — this script only
 * serves that data to the website as JSON (no login, no writes from the site).
 *
 * Setup: paste this file into Extensions > Apps Script, then run
 * `initializeSheets` once from the editor's Run menu (or just deploy — the
 * first page load will create the sheets automatically). That creates two
 * pre-filled tabs:
 *   - "Scores": one row per game — fill in Team1Score / Team2Score after each match.
 *   - "PlayerStats": one row per player per game — fill in Aces / FaultServes,
 *     and mark Absent (+ optional ProxyName) if a player was a no-show.
 *
 * IMPORTANT: this GAMES list must stay identical to js/schedule.js on the site.
 */

const GAMES = [
  { id: 1, court: "A", team1: ["Aayaan Roy", "Amit Chakrabarty"], team2: ["Partha Mukhopadhyay", "Dipra Ghosh"] },
  { id: 2, court: "B", team1: ["Bhupal Dhar", "Siddharth Das Sarkar"], team2: ["Atmadeep Mazumdar", "Nabo Roy"] },
  { id: 3, court: "A", team1: ["Suman Ghosh", "Madhu Sindhuvalli"], team2: ["Tarit Mondal", "Swayam Kundu"] },
  { id: 4, court: "B", team1: ["Saikat Natta", "Souvik Ray"], team2: ["Suvankar", "Aayaan Roy"] },
  { id: 5, court: "A", team1: ["Amit Chakrabarty", "Atmadeep Mazumdar"], team2: ["Suman Ghosh", "Nabo Roy"] },
  { id: 6, court: "B", team1: ["Partha Mukhopadhyay", "Siddharth Das Sarkar"], team2: ["Madhu Sindhuvalli", "Souvik Ray"] },
  { id: 7, court: "A", team1: ["Tarit Mondal", "Suvankar"], team2: ["Aayaan Roy", "Suman Ghosh"] },
  { id: 8, court: "B", team1: ["Swayam Kundu", "Dipra Ghosh"], team2: ["Saikat Natta", "Amit Chakrabarty"] },
  { id: 9, court: "A", team1: ["Nabo Roy", "Partha Mukhopadhyay"], team2: ["Siddharth Das Sarkar", "Suvankar"] },
  { id: 10, court: "B", team1: ["Swarnendu Sen", "Bhupal Dhar"], team2: ["Madhu Sindhuvalli", "Swayam Kundu"] },
  { id: 11, court: "A", team1: ["Swarnendu Sen", "Dipra Ghosh"], team2: ["Tarit Mondal", "Saikat Natta"] },
  { id: 12, court: "B", team1: ["Swarnendu Sen", "Souvik Ray"], team2: ["Atmadeep Mazumdar", "Bhupal Dhar"] }
];

// Fantasy picks lock at this moment (server-enforced). -04:00 = US Eastern in July.
const FANTASY_DEADLINE = "2026-07-12T10:00:00-04:00";

const SCORES_SHEET = "Scores";
const SCORES_HEADERS = ["GameId", "Court", "Team1", "Team2", "Team1Score", "Team2Score"];

const FANTASY_SHEET = "FantasyPicks";
function fantasyHeaders_() {
  return ["Name", "SubmittedAt"].concat(GAMES.map((g) => "G" + g.id));
}

const STATS_SHEET = "PlayerStats";
const STATS_HEADERS = [
  "GameId", "Court", "TeamSlot", "Player", "Partner", "Opponents",
  "Aces", "FaultServes", "Absent", "ProxyName"
];

function doGet(e) {
  const scoresSheet = getOrCreateScoresSheet_();
  const statsSheet = getOrCreateStatsSheet_();
  const fantasySheet = getOrCreateFantasySheet_();

  const locked = Date.now() >= new Date(FANTASY_DEADLINE).getTime();
  const entries = sheetToObjects_(fantasySheet).map((row) => {
    const entry = { name: row.Name, submittedAt: row.SubmittedAt };
    if (locked) {
      entry.picks = {};
      GAMES.forEach((g) => (entry.picks[g.id] = row["G" + g.id]));
    }
    return entry;
  });

  return jsonResponse_({
    scores: sheetToObjects_(scoresSheet),
    playerStats: sheetToObjects_(statsSheet),
    fantasy: { locked: locked, deadline: FANTASY_DEADLINE, entries: entries }
  });
}

function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  if (payload.action !== "fantasy") {
    return jsonResponse_({ status: "error", message: "Unknown action" });
  }
  if (Date.now() >= new Date(FANTASY_DEADLINE).getTime()) {
    return jsonResponse_({ status: "error", message: "Picks are locked — the deadline has passed." });
  }

  const name = String(payload.name || "").trim();
  if (!name || name.length > 40) {
    return jsonResponse_({ status: "error", message: "Enter a name (max 40 characters)." });
  }
  const picks = payload.picks || {};
  for (let i = 0; i < GAMES.length; i++) {
    const v = Number(picks[GAMES[i].id]);
    if (v !== 1 && v !== 2) {
      return jsonResponse_({ status: "error", message: "Pick a winner for every game." });
    }
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getOrCreateFantasySheet_();
    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim().toLowerCase() === name.toLowerCase()) {
        rowIndex = i + 1;
        break;
      }
    }
    const row = [name, new Date()].concat(GAMES.map((g) => Number(picks[g.id])));
    if (rowIndex === -1) {
      sheet.appendRow(row);
    } else {
      sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
    }
  } finally {
    lock.releaseLock();
  }

  return jsonResponse_({ status: "ok" });
}

function initializeSheets() {
  getOrCreateScoresSheet_();
  getOrCreateStatsSheet_();
  getOrCreateFantasySheet_();
}

function sheetToObjects_(sheet) {
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  return data
    .filter((row) => row[0] !== "" && row[0] !== null)
    .map((row) => {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = row[i]));
      return obj;
    });
}

function getOrCreateScoresSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SCORES_SHEET);
  if (sheet) return sheet;

  sheet = ss.insertSheet(SCORES_SHEET);
  sheet.getRange(1, 1, 1, SCORES_HEADERS.length).setValues([SCORES_HEADERS]);
  const rows = GAMES.map((g) => [g.id, g.court, g.team1.join(" / "), g.team2.join(" / "), "", ""]);
  sheet.getRange(2, 1, rows.length, SCORES_HEADERS.length).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, SCORES_HEADERS.length);
  return sheet;
}

function getOrCreateStatsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(STATS_SHEET);
  if (sheet) return sheet;

  sheet = ss.insertSheet(STATS_SHEET);
  sheet.getRange(1, 1, 1, STATS_HEADERS.length).setValues([STATS_HEADERS]);

  const rows = [];
  GAMES.forEach((g) => {
    g.team1.forEach((p, i) => {
      rows.push([g.id, g.court, 1, p, g.team1[1 - i], g.team2.join(" / "), "", "", "", ""]);
    });
    g.team2.forEach((p, i) => {
      rows.push([g.id, g.court, 2, p, g.team2[1 - i], g.team1.join(" / "), "", "", "", ""]);
    });
  });
  sheet.getRange(2, 1, rows.length, STATS_HEADERS.length).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, STATS_HEADERS.length);
  return sheet;
}

function getOrCreateFantasySheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(FANTASY_SHEET);
  if (sheet) return sheet;

  sheet = ss.insertSheet(FANTASY_SHEET);
  const headers = fantasyHeaders_();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  return sheet;
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
