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

// Rolling predictor: the first pair of games locks when play starts; each later
// pair locks as soon as the previous pair's results are entered. The women's
// showcase pick locks when Games 7 & 8 are scored (the showcase follows them).
// -04:00 = US Eastern in July.
const PREDICTOR_START = "2026-07-12T09:30:00-04:00";
// Betting locks at noon (server-enforced); the women's side bet additionally
// locks when the showcase starts (rolling, like the women's pick).
const BETTING_DEADLINE = "2026-07-12T12:00:00-04:00";

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

// Which games have both scores entered, from the Scores sheet rows.
function scoredMap_(scoresRows) {
  const scored = {};
  scoresRows.forEach(function (row) {
    if (row.Team1Score !== "" && row.Team1Score !== null &&
        row.Team2Score !== "" && row.Team2Score !== null) {
      scored[row.GameId] = true;
    }
  });
  return scored;
}

function pairIds_(k) {
  return GAMES.filter((g) => Math.ceil(g.id / 2) === k).map((g) => g.id);
}

// Rolling pair locks: pair 1 locks at PREDICTOR_START; pair k locks when every
// game of pair k-1 is scored. A pair with one of its own games scored is locked
// regardless. The women's showcase pick ("W") locks when Games 7 & 8 are done
// (the showcase follows them) or once its own result is entered.
function lockedGamesMap_(scored, showcaseRows) {
  const locked = {};
  const numPairs = Math.ceil(GAMES.length / 2);
  for (let k = 1; k <= numPairs; k++) {
    const ids = pairIds_(k);
    let isLocked = ids.some((id) => scored[id]);
    if (!isLocked) {
      if (k === 1) {
        isLocked = Date.now() >= new Date(PREDICTOR_START).getTime();
      } else {
        isLocked = pairIds_(k - 1).every((id) => scored[id]);
      }
    }
    ids.forEach((id) => (locked[id] = isLocked));
  }

  let wLocked = pairIds_(4).every((id) => scored[id]);
  if (!wLocked) {
    const wRow = (showcaseRows || []).filter((r) => String(r.MatchId) === WOMENS_PICK_ID)[0];
    wLocked =
      !!wRow &&
      wRow.Team1Score !== "" && wRow.Team1Score !== null &&
      wRow.Team2Score !== "" && wRow.Team2Score !== null;
  }
  locked[WOMENS_PICK_ID] = wLocked;

  return locked;
}

function doGet(e) {
  const scoresSheet = getOrCreateScoresSheet_();
  const statsSheet = getOrCreateStatsSheet_();
  const fantasySheet = getOrCreateFantasySheet_();
  const betsSheet = getOrCreateBetsSheet_();

  const scoresRows = sheetToObjects_(scoresSheet);
  const showcaseRows = sheetToObjects_(getOrCreateShowcaseSheet_());
  const lockedGames = lockedGamesMap_(scoredMap_(scoresRows), showcaseRows);
  const namesRevealed = Date.now() >= new Date(PREDICTOR_START).getTime();
  const fantasyRows = sheetToObjects_(fantasySheet);

  // Entrants stay anonymous until play starts; after that, only picks for
  // locked games are revealed (open picks stay private).
  const entries = fantasyRows.map((row) => {
    if (!namesRevealed) return {};
    const entry = { name: row.Name, submittedAt: row.SubmittedAt, picks: {} };
    GAMES.forEach((g) => {
      if (lockedGames[g.id]) entry.picks[g.id] = row["G" + g.id];
    });
    if (lockedGames[WOMENS_PICK_ID]) entry.picks[WOMENS_PICK_ID] = row["GW"];
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

  // Bets: aggregate totals always; individual allocations only after betting
  // locks at noon (needed for the payout board — private while betting is open).
  // Women's Doubles pairs ride along as two extra "names" in the same maps.
  const betsLocked = Date.now() >= new Date(BETTING_DEADLINE).getTime();
  const betNames = playersSorted_().concat(WOMENS_TEAMS);
  const totals = {};
  betNames.forEach((p) => (totals[p] = 0));
  const betEntries = sheetToObjects_(betsSheet).map((row) => {
    betNames.forEach((p) => (totals[p] += Number(row[p]) || 0));
    if (!betsLocked) return {};
    const entry = { name: row.Name, submittedAt: row.SubmittedAt, bets: {} };
    betNames.forEach((p) => (entry.bets[p] = Number(row[p]) || 0));
    return entry;
  });

  return jsonResponse_({
    scores: scoresRows,
    playerStats: sheetToObjects_(statsSheet),
    knockouts: sheetToObjects_(getOrCreateKnockoutsSheet_()),
    showcase: showcaseRows,
    fantasy: {
      start: PREDICTOR_START,
      lockedGames: lockedGames,
      namesRevealed: namesRevealed,
      entries: entries,
      pickCounts: pickCounts
    },
    bets: {
      locked: betsLocked,
      wLocked: lockedGames[WOMENS_PICK_ID] === true,
      deadline: BETTING_DEADLINE,
      budget: BET_BUDGET,
      entries: betEntries,
      totals: totals
    }
  });
}

function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  if (payload.action === "fantasy") return handlePredictorPost_(payload);
  if (payload.action === "bets") return handleBetsPost_(payload);
  return jsonResponse_({ status: "error", message: "Unknown action" });
}

function validateName_(payload) {
  const name = String(payload.name || "").trim();
  if (!name || name.length > 40) {
    return "Enter a name (max 40 characters).";
  }
  return null;
}

function currentLockedGames_() {
  const scored = scoredMap_(sheetToObjects_(getOrCreateScoresSheet_()));
  const showcaseRows = sheetToObjects_(getOrCreateShowcaseSheet_());
  return lockedGamesMap_(scored, showcaseRows);
}

function handlePredictorPost_(payload) {
  const nameError = validateName_(payload);
  if (nameError) return jsonResponse_({ status: "error", message: nameError });
  const name = String(payload.name).trim();

  const lockedGames = currentLockedGames_();
  const allKeys = GAMES.map((g) => g.id).concat([WOMENS_PICK_ID]);
  if (allKeys.every((k) => lockedGames[k])) {
    return jsonResponse_({ status: "error", message: "The predictor is closed — all matches are locked." });
  }

  const picks = payload.picks || {};
  for (let i = 0; i < allKeys.length; i++) {
    const k = allKeys[i];
    if (lockedGames[k]) continue; // locked picks are preserved server-side, not validated
    const v = Number(picks[k]);
    if (v !== 1 && v !== 2) {
      return jsonResponse_({ status: "error", message: "Pick a winner for every open match." });
    }
  }

  // Merge: locked matches keep whatever this entrant already had (blank for new
  // entrants — locked matches can't be picked late); open matches take the new picks.
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getOrCreateFantasySheet_();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim().toLowerCase() === name.toLowerCase()) {
        rowIndex = i + 1;
        break;
      }
    }
    const existing = {};
    if (rowIndex !== -1) {
      headers.forEach((h, i) => (existing[h] = data[rowIndex - 1][i]));
    }
    const colFor = (k) => (k === WOMENS_PICK_ID ? "GW" : "G" + k);
    const row = [name, new Date()].concat(
      allKeys.map((k) =>
        lockedGames[k] ? (rowIndex !== -1 ? existing[colFor(k)] : "") : Number(picks[k])
      )
    );
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

function handleBetsPost_(payload) {
  const nameError = validateName_(payload);
  if (nameError) return jsonResponse_({ status: "error", message: nameError });
  if (Date.now() >= new Date(BETTING_DEADLINE).getTime()) {
    return jsonResponse_({ status: "error", message: "Betting is closed — the deadline has passed." });
  }
  const name = String(payload.name).trim();
  const wLocked = currentLockedGames_()[WOMENS_PICK_ID] === true;

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
  if (amounts.some(isNaN) || (!wLocked && womensAmounts.some(isNaN))) {
    return jsonResponse_({ status: "error", message: "Bet amounts must be positive whole dollars." });
  }
  if (total + (wLocked ? 0 : womensTotal) <= 0) {
    return jsonResponse_({ status: "error", message: "Place at least $1 on someone." });
  }
  if (total > BET_BUDGET) {
    return jsonResponse_({ status: "error", message: "You only have $" + BET_BUDGET + " to spread across the players — total is $" + total + "." });
  }
  if (!wLocked && womensTotal > WOMENS_BET_BUDGET) {
    return jsonResponse_({ status: "error", message: "The women's side pot is only $" + WOMENS_BET_BUDGET + " — total is $" + womensTotal + "." });
  }

  // Once the showcase starts, women's side bets are frozen: existing entrants
  // keep their stored women's amounts, new entrants get none.
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getOrCreateBetsSheet_();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim().toLowerCase() === name.toLowerCase()) {
        rowIndex = i + 1;
        break;
      }
    }
    const existing = {};
    if (rowIndex !== -1) {
      headers.forEach((h, i) => (existing[h] = data[rowIndex - 1][i]));
    }
    const finalWomens = wLocked
      ? WOMENS_TEAMS.map((t) => (rowIndex !== -1 ? Number(existing[t]) || 0 : 0))
      : womensAmounts;
    const row = [name, new Date()].concat(amounts).concat(finalWomens);
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
