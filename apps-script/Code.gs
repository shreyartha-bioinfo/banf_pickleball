/**
 * BANF Sports Day 2026 — Pickleball read-only results backend.
 *
 * You enter everything directly in the Google Sheet — this script only
 * serves that data to the website as JSON (no login, no writes from the site).
 *
 * Setup: paste this file into Extensions > Apps Script, then run
 * `initializeSheets` once from the editor's Run menu (or just deploy — the
 * first page load will create the sheets automatically). Tabs:
 *   - "Scores": one row per game — fill in Team1Score / Team2Score after each match.
 *   - "PlayerStats": one row per player per game — fill in Aces / FaultServes,
 *     and mark Absent (+ optional ProxyName) if a player was a no-show.
 *   - "Knockouts": semifinal/final scores — fill in Team1Score / Team2Score
 *     (the Match column says which seeds are Team1 vs Team2).
 *   - "Showcase": the 10:50 AM women's & kids exhibition matches — edit the
 *     Team1/Team2 names (kids combos) and fill in scores to mark them Final.
 *   - "FantasyPicks": predictor entries submitted from the site (auto-managed).
 *   - "Bets": virtual-money bets submitted from the site (auto-managed).
 *
 * IMPORTANT: this GAMES list must stay identical to js/schedule.js on the site.
 */

const GAMES = [
  { id: 1, court: "A", time: "9:30 AM", team1: ["Partha Mukhopadhyay", "Nabo Roy"], team2: ["Tarit Mondal", "Saikat Natta"] },
  { id: 2, court: "B", time: "9:30 AM", team1: ["Atmadeep Mazumdar", "Siddharth Das Sarkar"], team2: ["Bhupal Dhar", "Dipra Ghosh"] },
  { id: 3, court: "A", time: "9:50 AM", team1: ["Suman Ghosh", "Dipra Ghosh"], team2: ["Tarit Mondal", "Swayam Kundu"] },
  { id: 4, court: "B", time: "9:50 AM", team1: ["Saikat Natta", "Souvik Ray"], team2: ["Madhu Sindhuvalli", "Aayaan Roy"] },
  { id: 5, court: "A", time: "10:10 AM", team1: ["Suman Ghosh", "Atmadeep Mazumdar"], team2: ["Amit Chakrabarty", "Nabo Roy"] },
  { id: 6, court: "B", time: "10:10 AM", team1: ["Partha Mukhopadhyay", "Siddharth Das Sarkar"], team2: ["Madhu Sindhuvalli", "Souvik Ray"] },
  { id: 7, court: "A", time: "10:30 AM", team1: ["Tarit Mondal", "Suvankar Paul"], team2: ["Aayaan Roy", "Suman Ghosh"] },
  { id: 8, court: "B", time: "10:30 AM", team1: ["Swayam Kundu", "Dipra Ghosh"], team2: ["Saikat Natta", "Amit Chakrabarty"] },
  { id: 9, court: "A", time: "11:10 AM", team1: ["Partha Mukhopadhyay", "Madhu Sindhuvalli"], team2: ["Siddharth Das Sarkar", "Nabo Roy"] },
  { id: 10, court: "B", time: "11:10 AM", team1: ["Swarnendu Sen", "Bhupal Dhar"], team2: ["Suvankar Paul", "Swayam Kundu"] },
  { id: 11, court: "A", time: "11:30 AM", team1: ["Swarnendu Sen", "Souvik Ray"], team2: ["Atmadeep Mazumdar", "Bhupal Dhar"] },
  { id: 12, court: "B", time: "11:30 AM", team1: ["Aayaan Roy", "Amit Chakrabarty"], team2: ["Swarnendu Sen", "Suvankar Paul"] },
  { id: 13, court: "A", time: "11:50 AM", team1: ["Partha Mukhopadhyay", "Swayam Kundu"], team2: ["Atmadeep Mazumdar", "Aayaan Roy"] },
  { id: 14, court: "B", time: "11:50 AM", team1: ["Nabo Roy", "Souvik Ray"], team2: ["Siddharth Das Sarkar", "Amit Chakrabarty"] },
  { id: 15, court: "A", time: "12:10 PM", team1: ["Tarit Mondal", "Madhu Sindhuvalli"], team2: ["Bhupal Dhar", "Suvankar Paul"] },
  { id: 16, court: "B", time: "12:10 PM", team1: ["Saikat Natta", "Suman Ghosh"], team2: ["Swarnendu Sen", "Dipra Ghosh"] }
];

// Predictor picks and bets lock at this moment (server-enforced). -04:00 = US Eastern in July.
const ENTRY_DEADLINE = "2026-07-12T10:00:00-04:00";

const BET_BUDGET = 100; // virtual dollars per bettor (men's tournament)

// Women's Doubles side bet: separate $20 pot on the 10:50 AM showcase match.
// Team order must match the "W" row in the Knockouts sheet (Team1 = Lopita/Tanima)
// and WOMENS_TEAMS in js/schedule.js. Payout: winner 1.5x, loser 0.5x.
const WOMENS_TEAMS = ["Lopita / Tanima", "Sreya / Roopkatha"];
const WOMENS_BET_BUDGET = 20;

const SCORES_SHEET = "Scores";
const SCORES_HEADERS = ["GameId", "Court", "Time", "Team1", "Team2", "Team1Score", "Team2Score"];

const FANTASY_SHEET = "FantasyPicks"; // predictor entries (sheet name kept for compatibility)
// Predictor pick for the Women's Doubles showcase: wire key "W", sheet column "GW".
const WOMENS_PICK_ID = "W";
function fantasyHeaders_() {
  return ["Name", "SubmittedAt"].concat(GAMES.map((g) => "G" + g.id)).concat(["GW"]);
}

const KNOCKOUTS_SHEET = "Knockouts";
const KNOCKOUTS_HEADERS = ["MatchId", "Match", "Team1Score", "Team2Score"];
const KNOCKOUT_MATCHES = [
  ["SF1", "Semifinal 1 — Team1: seeds 1+8, Team2: seeds 3+6"],
  ["SF2", "Semifinal 2 — Team1: seeds 2+7, Team2: seeds 4+5"],
  ["F", "Final — Team1: SF1 winner, Team2: SF2 winner"]
];

// Showcase matches (10:50 AM break): edit Team1/Team2 to set/change the
// line-ups — e.g. fill in the kids 13–17 combos once decided — and enter
// Team1Score/Team2Score after each match to mark it Final on the site.
// Row "W" also settles the women's side bets (Team1 = Lopita / Tanima).
const SHOWCASE_SHEET = "Showcase";
const SHOWCASE_HEADERS = ["MatchId", "Label", "Team1", "Team2", "Team1Score", "Team2Score"];
const SHOWCASE_MATCHES = [
  ["W", "Women's Doubles", "Lopita / Tanima", "Sreya / Roopkatha"],
  ["K1", "Kids 13–17 Doubles", "", ""],
  ["K2", "Kids 7–13 Singles", "Oleen", "Evaan"]
];

const BETS_SHEET = "Bets";
function playersSorted_() {
  const seen = {};
  GAMES.forEach((g) => g.team1.concat(g.team2).forEach((p) => (seen[p] = true)));
  return Object.keys(seen).sort();
}
function betsHeaders_() {
  return ["Name", "SubmittedAt"].concat(playersSorted_()).concat(WOMENS_TEAMS);
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
  const betsSheet = getOrCreateBetsSheet_();

  const locked = Date.now() >= new Date(ENTRY_DEADLINE).getTime();
  const fantasyRows = sheetToObjects_(fantasySheet);

  // Before lock, entries are anonymous placeholders (count only) — names, picks
  // and bets are all revealed together once the deadline passes.
  const entries = fantasyRows.map((row) => {
    if (!locked) return {};
    const entry = { name: row.Name, submittedAt: row.SubmittedAt, picks: {} };
    GAMES.forEach((g) => (entry.picks[g.id] = row["G" + g.id]));
    entry.picks[WOMENS_PICK_ID] = row["GW"];
    return entry;
  });

  // Anonymous per-game aggregate of predictor picks (like bet totals): safe to
  // expose before lock, drives the "crowd pick" badges on the schedule.
  const pickCounts = {};
  GAMES.forEach((g) => (pickCounts[g.id] = { 1: 0, 2: 0 }));
  pickCounts[WOMENS_PICK_ID] = { 1: 0, 2: 0 };
  fantasyRows.forEach((row) => {
    GAMES.forEach((g) => {
      const v = Number(row["G" + g.id]);
      if (v === 1 || v === 2) pickCounts[g.id][v] += 1;
    });
    const wv = Number(row["GW"]);
    if (wv === 1 || wv === 2) pickCounts[WOMENS_PICK_ID][wv] += 1;
  });

  // Bets: aggregate totals always; individual allocations only after lock
  // (needed for the payout board — private while betting is open).
  // Women's Doubles pairs ride along as two extra "names" in the same maps.
  const betNames = playersSorted_().concat(WOMENS_TEAMS);
  const totals = {};
  betNames.forEach((p) => (totals[p] = 0));
  const betEntries = sheetToObjects_(betsSheet).map((row) => {
    betNames.forEach((p) => (totals[p] += Number(row[p]) || 0));
    if (!locked) return {};
    const entry = { name: row.Name, submittedAt: row.SubmittedAt, bets: {} };
    betNames.forEach((p) => (entry.bets[p] = Number(row[p]) || 0));
    return entry;
  });

  return jsonResponse_({
    scores: sheetToObjects_(scoresSheet),
    playerStats: sheetToObjects_(statsSheet),
    knockouts: sheetToObjects_(getOrCreateKnockoutsSheet_()),
    showcase: sheetToObjects_(getOrCreateShowcaseSheet_()),
    fantasy: { locked: locked, deadline: ENTRY_DEADLINE, entries: entries, pickCounts: pickCounts },
    bets: { locked: locked, deadline: ENTRY_DEADLINE, budget: BET_BUDGET, entries: betEntries, totals: totals }
  });
}

function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  if (payload.action === "fantasy") return handlePredictorPost_(payload);
  if (payload.action === "bets") return handleBetsPost_(payload);
  return jsonResponse_({ status: "error", message: "Unknown action" });
}

function validateEntrant_(payload) {
  if (Date.now() >= new Date(ENTRY_DEADLINE).getTime()) {
    return "Entries are locked — the deadline has passed.";
  }
  const name = String(payload.name || "").trim();
  if (!name || name.length > 40) {
    return "Enter a name (max 40 characters).";
  }
  return null;
}

function handlePredictorPost_(payload) {
  const entrantError = validateEntrant_(payload);
  if (entrantError) return jsonResponse_({ status: "error", message: entrantError });
  const name = String(payload.name).trim();

  const picks = payload.picks || {};
  for (let i = 0; i < GAMES.length; i++) {
    const v = Number(picks[GAMES[i].id]);
    if (v !== 1 && v !== 2) {
      return jsonResponse_({ status: "error", message: "Pick a winner for every match." });
    }
  }
  const wv = Number(picks[WOMENS_PICK_ID]);
  if (wv !== 1 && wv !== 2) {
    return jsonResponse_({ status: "error", message: "Pick a winner for the women's doubles too." });
  }

  const row = [name, new Date()].concat(GAMES.map((g) => Number(picks[g.id]))).concat([wv]);
  upsertRowByName_(getOrCreateFantasySheet_(), name, row);
  return jsonResponse_({ status: "ok" });
}

function handleBetsPost_(payload) {
  const entrantError = validateEntrant_(payload);
  if (entrantError) return jsonResponse_({ status: "error", message: entrantError });
  const name = String(payload.name).trim();

  const players = playersSorted_();
  const bets = payload.bets || {};
  let total = 0;
  const amounts = players.map(function (p) {
    const v = Math.round(Number(bets[p]) || 0);
    if (v < 0) return NaN;
    total += v;
    return v;
  });
  let womensTotal = 0;
  const womensAmounts = WOMENS_TEAMS.map(function (t) {
    const v = Math.round(Number(bets[t]) || 0);
    if (v < 0) return NaN;
    womensTotal += v;
    return v;
  });
  if (amounts.some(isNaN) || womensAmounts.some(isNaN)) {
    return jsonResponse_({ status: "error", message: "Bet amounts must be positive whole dollars." });
  }
  if (total + womensTotal <= 0) {
    return jsonResponse_({ status: "error", message: "Place at least $1 on someone." });
  }
  if (total > BET_BUDGET) {
    return jsonResponse_({ status: "error", message: "You only have $" + BET_BUDGET + " to spread across the players — total is $" + total + "." });
  }
  if (womensTotal > WOMENS_BET_BUDGET) {
    return jsonResponse_({ status: "error", message: "The women's side pot is only $" + WOMENS_BET_BUDGET + " — total is $" + womensTotal + "." });
  }

  const row = [name, new Date()].concat(amounts).concat(womensAmounts);
  upsertRowByName_(getOrCreateBetsSheet_(), name, row);
  return jsonResponse_({ status: "ok" });
}

function upsertRowByName_(sheet, name, row) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim().toLowerCase() === name.toLowerCase()) {
        rowIndex = i + 1;
        break;
      }
    }
    if (rowIndex === -1) {
      sheet.appendRow(row);
    } else {
      sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
    }
  } finally {
    lock.releaseLock();
  }
}

function initializeSheets() {
  getOrCreateScoresSheet_();
  getOrCreateStatsSheet_();
  getOrCreateFantasySheet_();
  getOrCreateBetsSheet_();
  getOrCreateKnockoutsSheet_();
  getOrCreateShowcaseSheet_();
}

/**
 * Run this once from the editor after updating Code.gs on an existing Sheet.
 * Creates any missing tabs (e.g. "Showcase") and upgrades headers in place:
 *   - Bets: renames the old "Suvankar" column to "Suvankar Paul" and appends
 *     the two women's-pair columns if they're not there yet.
 *   - FantasyPicks: appends the "GW" column (women's doubles pick).
 * Never touches data rows or tabs that are already up to date.
 */
function upgradeSheets() {
  initializeSheets();

  const betsSheet = getOrCreateBetsSheet_();
  const betsHeaders = betsSheet.getRange(1, 1, 1, betsSheet.getLastColumn()).getValues()[0];

  const oldIdx = betsHeaders.indexOf("Suvankar");
  if (oldIdx !== -1 && betsHeaders.indexOf("Suvankar Paul") === -1) {
    betsSheet.getRange(1, oldIdx + 1).setValue("Suvankar Paul");
    betsHeaders[oldIdx] = "Suvankar Paul";
  }

  WOMENS_TEAMS.forEach(function (t) {
    if (betsHeaders.indexOf(t) === -1) {
      betsSheet.getRange(1, betsHeaders.length + 1).setValue(t);
      betsHeaders.push(t);
    }
  });

  const fantasySheet = getOrCreateFantasySheet_();
  const fantasyHeaders = fantasySheet
    .getRange(1, 1, 1, fantasySheet.getLastColumn())
    .getValues()[0];
  if (fantasyHeaders.indexOf("GW") === -1) {
    fantasySheet.getRange(1, fantasyHeaders.length + 1).setValue("GW");
  }
}

function getOrCreateShowcaseSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHOWCASE_SHEET);
  if (sheet) return sheet;

  sheet = ss.insertSheet(SHOWCASE_SHEET);
  sheet.getRange(1, 1, 1, SHOWCASE_HEADERS.length).setValues([SHOWCASE_HEADERS]);
  const rows = SHOWCASE_MATCHES.map((m) => [m[0], m[1], m[2], m[3], "", ""]);
  sheet.getRange(2, 1, rows.length, SHOWCASE_HEADERS.length).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, SHOWCASE_HEADERS.length);
  return sheet;
}

function getOrCreateKnockoutsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(KNOCKOUTS_SHEET);
  if (sheet) return sheet;

  sheet = ss.insertSheet(KNOCKOUTS_SHEET);
  sheet.getRange(1, 1, 1, KNOCKOUTS_HEADERS.length).setValues([KNOCKOUTS_HEADERS]);
  const rows = KNOCKOUT_MATCHES.map((m) => [m[0], m[1], "", ""]);
  sheet.getRange(2, 1, rows.length, KNOCKOUTS_HEADERS.length).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, KNOCKOUTS_HEADERS.length);
  return sheet;
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
  const rows = GAMES.map((g) => [g.id, g.court, g.time, g.team1.join(" / "), g.team2.join(" / "), "", ""]);
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

function getOrCreateBetsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(BETS_SHEET);
  if (sheet) return sheet;

  sheet = ss.insertSheet(BETS_SHEET);
  const headers = betsHeaders_();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  return sheet;
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
