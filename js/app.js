(function () {
  const gamesGrid = document.getElementById("games-grid");
  const statusLine = document.getElementById("status-line");
  const standingsTable = document.getElementById("standings-table");
  const refreshBtn = document.getElementById("refresh-btn");
  const refreshIcon = document.getElementById("refresh-icon");

  const tabBtnSchedule = document.getElementById("tab-btn-schedule");
  const tabBtnKnockouts = document.getElementById("tab-btn-knockouts");
  const tabBtnFantasy = document.getElementById("tab-btn-fantasy");
  const tabBtnBetting = document.getElementById("tab-btn-betting");
  const tabSchedule = document.getElementById("tab-schedule");
  const tabKnockouts = document.getElementById("tab-knockouts");
  const tabFantasy = document.getElementById("tab-fantasy");
  const tabBetting = document.getElementById("tab-betting");

  const knockoutStatusLine = document.getElementById("knockout-status-line");
  const bracketEl = document.getElementById("bracket");

  const bettingDeadlineLine = document.getElementById("betting-deadline-line");
  const bettingFormCard = document.getElementById("betting-form-card");
  const bettingLockedCard = document.getElementById("betting-locked-card");
  const bettingEntryCount = document.getElementById("betting-entry-count");
  const bettingNameInput = document.getElementById("betting-name");
  const bettingPlayersEl = document.getElementById("betting-players");
  const bettingProgress = document.getElementById("betting-progress");
  const bettingSubmitBtn = document.getElementById("betting-submit");
  const bettingMsg = document.getElementById("betting-msg");
  const bettingPotLine = document.getElementById("betting-pot-line");
  const bettingCloud = document.getElementById("betting-cloud");

  const fantasyDeadlineLine = document.getElementById("fantasy-deadline-line");
  const fantasyFormCard = document.getElementById("fantasy-form-card");
  const fantasyLockedCard = document.getElementById("fantasy-locked-card");
  const fantasyEntryCount = document.getElementById("fantasy-entry-count");
  const fantasyNameInput = document.getElementById("fantasy-name");
  const fantasyGamesEl = document.getElementById("fantasy-games");
  const fantasyProgress = document.getElementById("fantasy-progress");
  const fantasySubmitBtn = document.getElementById("fantasy-submit");
  const fantasyMsg = document.getElementById("fantasy-msg");
  const fantasyLeaderboard = document.getElementById("fantasy-leaderboard");

  const AUTO_REFRESH_MS = 45000;
  const QUALIFY_RANK = 8;
  const BET_BUDGET = 100;
  const PICKS_STORAGE_KEY = "banfFantasyPicks";
  const NAME_STORAGE_KEY = "banfFantasyName";
  const BETS_STORAGE_KEY = "banfBets";

  const notConfigured =
    !CONFIG.SHEET_API_URL || CONFIG.SHEET_API_URL.indexOf("PASTE_YOUR") === 0;

  // scoresByGame[gameId] = { team1Score, team2Score } (numbers, or undefined if not yet played)
  let scoresByGame = {};
  // statsByGamePlayer["gameId|Player"] = { aces, faultServes, absent, proxyName }
  let statsByGamePlayer = {};
  // fantasy (predictor): { locked, deadline, entries: [{ name, submittedAt, picks? }] }
  let fantasyData = { locked: false, deadline: CONFIG.FANTASY_DEADLINE, entries: [] };
  // bets: { locked, deadline, entries: [{ name }], totals: { playerName: dollars } }
  let betsData = { locked: false, deadline: CONFIG.FANTASY_DEADLINE, entries: [], totals: {} };
  // knockoutScores["SF1"|"SF2"|"F"] = { team1Score, team2Score }
  let knockoutScores = {};

  const ALL_PLAYERS = Array.from(new Set(GAMES.flatMap((g) => g.team1.concat(g.team2)))).sort();

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function teamLabel(team) {
    return team.join(" / ");
  }

  function statKey(gameId, player) {
    return gameId + "|" + player;
  }

  function getPlayerStat(gameId, player) {
    return statsByGamePlayer[statKey(gameId, player)] || {};
  }

  function isAbsent(gameId, player) {
    const stat = getPlayerStat(gameId, player);
    return stat.absent === true || stat.absent === "TRUE" || stat.absent === "true";
  }

  function hasScore(gameId) {
    const s = scoresByGame[gameId];
    return !!s && s.team1Score !== undefined && s.team2Score !== undefined;
  }

  // ---------- Game schedule rendering (read-only) ----------

  function playerLinesReadOnly(team, gameId) {
    return team
      .map((p) => {
        const absent = isAbsent(gameId, p);
        const stat = getPlayerStat(gameId, p);
        const hasStatLine = !absent && (stat.aces !== undefined || stat.faultServes !== undefined) &&
          (Number(stat.aces) > 0 || Number(stat.faultServes) > 0);
        return `
          <div class="player-line-view${absent ? " absent" : ""}">
            <span class="player-name">${escapeHtml(p)}</span>
            ${absent ? `<span class="proxy-note">No-show${stat.proxyName ? ` — proxy: ${escapeHtml(stat.proxyName)}` : ""}</span>` : ""}
            ${hasStatLine ? `<span class="player-stat-note">${Number(stat.aces) || 0} aces · ${Number(stat.faultServes) || 0} false serves</span>` : ""}
          </div>
        `;
      })
      .join("");
  }

  function renderGames() {
    gamesGrid.innerHTML = "";
    GAMES.forEach((game) => {
      const played = hasScore(game.id);
      const score = scoresByGame[game.id] || {};
      const t1 = played ? score.team1Score : null;
      const t2 = played ? score.team2Score : null;
      const winner = played && t1 !== t2 ? (t1 > t2 ? teamLabel(game.team1) : teamLabel(game.team2)) : "";

      const card = document.createElement("article");
      card.className = "game-card" + (played ? " completed" : "");
      card.innerHTML = `
        <div class="game-card-top">
          <span class="game-number">Game ${game.id}</span>
          <span class="badge-group">
            <span class="status-chip ${played ? "final" : "upcoming"}">${played ? "Final" : "Upcoming"}</span>
            <span class="court-badge">Court ${game.court}</span>
          </span>
        </div>
        <div class="team-row${winner === teamLabel(game.team1) ? " winner" : ""}">
          <div class="team-names">${playerLinesReadOnly(game.team1, game.id)}</div>
          <span class="score-display${played ? "" : " pending"}">${played ? t1 : "–"}</span>
        </div>
        <div class="team-sep"></div>
        <div class="team-row${winner === teamLabel(game.team2) ? " winner" : ""}">
          <div class="team-names">${playerLinesReadOnly(game.team2, game.id)}</div>
          <span class="score-display${played ? "" : " pending"}">${played ? t2 : "–"}</span>
        </div>
      `;
      gamesGrid.appendChild(card);
    });
  }

  // ---------- Standings ----------

  function computeStandings() {
    const players = Array.from(new Set(GAMES.flatMap((g) => g.team1.concat(g.team2))));

    const totals = {};
    players.forEach((p) => {
      totals[p] = { wins: 0, played: 0, pointDiff: 0, aces: 0, faultServes: 0 };
    });

    // h2h[playerA][playerB] = { wins, losses } — only counted when both were on court together.
    const h2h = {};
    players.forEach((p) => (h2h[p] = {}));

    GAMES.forEach((game) => {
      if (!hasScore(game.id)) return;
      const score = scoresByGame[game.id];
      const t1s = Number(score.team1Score);
      const t2s = Number(score.team2Score);

      const team1Present = game.team1.filter((p) => !isAbsent(game.id, p));
      const team2Present = game.team2.filter((p) => !isAbsent(game.id, p));

      function credit(player, ownScore, oppScore, opponents) {
        if (isAbsent(game.id, player)) return;
        const t = totals[player];
        t.played += 1;
        if (ownScore > oppScore) t.wins += 1;
        t.pointDiff += ownScore - oppScore;
        const stat = getPlayerStat(game.id, player);
        t.aces += Number(stat.aces) || 0;
        t.faultServes += Number(stat.faultServes) || 0;

        opponents.forEach((opp) => {
          h2h[player][opp] = h2h[player][opp] || { wins: 0, losses: 0 };
          if (ownScore > oppScore) h2h[player][opp].wins += 1;
          else if (oppScore > ownScore) h2h[player][opp].losses += 1;
        });
      }

      game.team1.forEach((p) => credit(p, t1s, t2s, team2Present));
      game.team2.forEach((p) => credit(p, t2s, t1s, team1Present));
    });

    // Show every player from the start (0s across the board before any results),
    // so the table exists and updates incrementally as each game completes.
    const ranked = players.slice();

    function metricKey(p) {
      const t = totals[p];
      return t.wins + "|" + t.pointDiff + "|" + (t.aces - t.faultServes);
    }

    const groups = {};
    ranked.forEach((p) => {
      const k = metricKey(p);
      (groups[k] = groups[k] || []).push(p);
    });

    const headScore = {};
    Object.values(groups).forEach((group) => {
      group.forEach((p) => {
        let score = 0;
        group.forEach((other) => {
          if (other === p) return;
          const rec = h2h[p][other];
          if (rec) score += rec.wins - rec.losses;
        });
        headScore[p] = score;
      });
    });

    const rows = ranked.map((p) => ({
      player: p,
      wins: totals[p].wins,
      played: totals[p].played,
      pointDiff: totals[p].pointDiff,
      aceDiff: totals[p].aces - totals[p].faultServes,
      headScore: headScore[p]
    }));

    rows.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
      if (b.aceDiff !== a.aceDiff) return b.aceDiff - a.aceDiff;
      if (b.headScore !== a.headScore) return b.headScore - a.headScore;
      // Same rank either way (tie on all 4 tiebreakers) — alphabetical just gives a stable display order.
      return a.player.localeCompare(b.player);
    });

    rows.forEach((row, i) => {
      if (i === 0) {
        row.rank = 1;
      } else {
        const prev = rows[i - 1];
        const tied =
          row.wins === prev.wins &&
          row.pointDiff === prev.pointDiff &&
          row.aceDiff === prev.aceDiff &&
          row.headScore === prev.headScore;
        row.rank = tied ? prev.rank : i + 1;
      }
    });

    return rows;
  }

  function renderStandings() {
    const rows = computeStandings();

    if (rows.length === 0) {
      standingsTable.innerHTML = `<p class="hint">Standings will appear once results are entered.</p>`;
      return;
    }

    standingsTable.innerHTML = `
      <div class="standings-scroll">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th class="num">Wins</th>
              <th class="num">Point Diff</th>
              <th class="num">Ace Diff</th>
              <th class="num">H2H</th>
              <th class="num">Played</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map((r, i) => {
                const qualifies = r.rank <= QUALIFY_RANK;
                const isCutLine =
                  qualifies && (i === rows.length - 1 || rows[i + 1].rank > QUALIFY_RANK);
                return `
                  <tr class="${qualifies ? "qualify" : ""}${isCutLine ? " cut-line" : ""}">
                    <td><span class="rank-chip">${r.rank}</span>${qualifies ? '<span class="qualify-badge">Q</span>' : ""}</td>
                    <td>${escapeHtml(r.player)}</td>
                    <td class="num">${r.wins}</td>
                    <td class="num">${r.pointDiff > 0 ? "+" : ""}${r.pointDiff}</td>
                    <td class="num">${r.aceDiff > 0 ? "+" : ""}${r.aceDiff}</td>
                    <td class="num">${r.headScore > 0 ? "+" : ""}${r.headScore}</td>
                    <td class="num">${r.played}/3</td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
      <p class="standings-legend">Q = currently qualifying for the top 8. Ties across all four tiebreakers share a rank (e.g. 1, 2, 2, 2, 2, 6, 6, 8).</p>
    `;
  }

  // ---------- Knockouts ----------

  function knockoutScore(matchId) {
    const s = knockoutScores[matchId];
    return s && s.team1Score !== undefined && s.team2Score !== undefined ? s : null;
  }

  function knockoutMatchCard(title, matchId, team1, team2) {
    const s = knockoutScore(matchId);
    const played = !!s && !!team1.players && !!team2.players;
    const winner =
      played && s.team1Score !== s.team2Score ? (s.team1Score > s.team2Score ? 1 : 2) : 0;

    function teamHtml(team, slot) {
      if (!team.players) {
        return `
          <div class="team-row">
            <div class="team-names"><span class="tbd">${escapeHtml(team.tbdLabel)}</span></div>
            <span class="score-display pending">–</span>
          </div>`;
      }
      const names = team.players
        .map(
          (p) =>
            `<div class="player-line-view"><span class="seed-chip">${p.seed}</span><span class="player-name${p.placeholder ? " placeholder-name" : ""}">${escapeHtml(p.name)}</span></div>`
        )
        .join("");
      const scoreVal = played ? (slot === 1 ? s.team1Score : s.team2Score) : "–";
      return `
        <div class="team-row${winner === slot ? " winner" : ""}">
          <div class="team-names">${names}</div>
          <span class="score-display${played ? "" : " pending"}">${scoreVal}</span>
        </div>`;
    }

    return `
      <article class="game-card bracket-match${played ? " completed" : ""}">
        <div class="game-card-top">
          <span class="game-number">${title}</span>
          <span class="status-chip ${played ? "final" : "upcoming"}">${played ? "Final" : "Upcoming"}</span>
        </div>
        ${teamHtml(team1, 1)}
        <div class="team-sep"></div>
        ${teamHtml(team2, 2)}
      </article>`;
  }

  function renderKnockouts() {
    const playedCount = GAMES.filter((g) => hasScore(g.id)).length;
    const leagueComplete = playedCount === GAMES.length;

    // Before any results exist, show neutral "Rank N" slots instead of an
    // alphabetical prefill; real names take over as scores come in.
    const seeds =
      playedCount === 0
        ? Array.from({ length: 8 }, (_, i) => ({ seed: i + 1, name: `Rank ${i + 1}`, placeholder: true }))
        : computeStandings().slice(0, 8).map((r, i) => ({ seed: i + 1, name: r.player }));

    knockoutStatusLine.textContent = leagueComplete
      ? "League phase complete — bracket is set"
      : playedCount === 0
      ? "Bracket fills in as league results come in"
      : `Projected bracket · ${playedCount}/${GAMES.length} league games played`;

    if (seeds.length < 8) {
      bracketEl.innerHTML = `<p class="hint">The bracket appears once standings are available.</p>`;
      return;
    }

    const pair = (a, b) => ({ players: [seeds[a - 1], seeds[b - 1]] });
    const sf1t1 = pair(1, 8);
    const sf1t2 = pair(3, 6);
    const sf2t1 = pair(2, 7);
    const sf2t2 = pair(4, 5);

    function sfWinner(matchId, t1, t2) {
      const s = knockoutScore(matchId);
      if (!s || s.team1Score === s.team2Score) return null;
      return s.team1Score > s.team2Score ? t1 : t2;
    }

    const finalist1 = sfWinner("SF1", sf1t1, sf1t2) || { players: null, tbdLabel: "Winner of Semifinal 1" };
    const finalist2 = sfWinner("SF2", sf2t1, sf2t2) || { players: null, tbdLabel: "Winner of Semifinal 2" };

    const finalScore = knockoutScore("F");
    let championHtml = "";
    if (finalScore && finalist1.players && finalist2.players && finalScore.team1Score !== finalScore.team2Score) {
      const champs = finalScore.team1Score > finalScore.team2Score ? finalist1 : finalist2;
      championHtml = `
        <div class="champion-card">
          <span class="champion-trophy">🏆</span>
          <p class="champion-kicker">Champions</p>
          <p class="champion-names">${champs.players.map((p) => escapeHtml(p.name)).join(" &amp; ")}</p>
        </div>`;
    }

    bracketEl.innerHTML = `
      <div class="bracket-round">
        <h4 class="round-title">Semifinals</h4>
        ${knockoutMatchCard("Semifinal 1", "SF1", sf1t1, sf1t2)}
        ${knockoutMatchCard("Semifinal 2", "SF2", sf2t1, sf2t2)}
      </div>
      <div class="bracket-round bracket-final">
        <h4 class="round-title">Final</h4>
        ${knockoutMatchCard("Final", "F", finalist1, finalist2)}
        ${championHtml}
      </div>`;
  }

  // ---------- Fantasy ----------

  function fantasyLocked() {
    if (fantasyData.locked === true) return true;
    const deadlineMs = new Date(fantasyData.deadline || CONFIG.FANTASY_DEADLINE).getTime();
    return !isNaN(deadlineMs) && Date.now() >= deadlineMs;
  }

  function loadMyPicks() {
    try {
      return JSON.parse(localStorage.getItem(PICKS_STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  let myPicks = loadMyPicks();
  let fantasyFormBuilt = false;

  function updateFantasyProgress() {
    const picked = GAMES.filter((g) => myPicks[g.id] === 1 || myPicks[g.id] === 2).length;
    fantasyProgress.textContent = `${picked}/${GAMES.length} games picked`;
  }

  function buildFantasyForm() {
    if (fantasyFormBuilt) return;
    fantasyFormBuilt = true;

    fantasyNameInput.value = localStorage.getItem(NAME_STORAGE_KEY) || "";

    fantasyGamesEl.innerHTML = "";
    GAMES.forEach((game) => {
      const row = document.createElement("div");
      row.className = "pick-row";
      row.innerHTML = `
        <div class="pick-meta">
          <span class="game-number">Game ${game.id}</span>
          <span class="court-badge">Court ${game.court}</span>
        </div>
        <div class="pick-options">
          <button type="button" class="pick-btn" data-slot="1">${escapeHtml(teamLabel(game.team1))}</button>
          <button type="button" class="pick-btn" data-slot="2">${escapeHtml(teamLabel(game.team2))}</button>
        </div>
      `;
      const buttons = row.querySelectorAll(".pick-btn");
      buttons.forEach((btn) => {
        const slot = Number(btn.dataset.slot);
        if (myPicks[game.id] === slot) btn.classList.add("selected");
        btn.addEventListener("click", () => {
          myPicks[game.id] = slot;
          localStorage.setItem(PICKS_STORAGE_KEY, JSON.stringify(myPicks));
          buttons.forEach((b) => b.classList.toggle("selected", Number(b.dataset.slot) === slot));
          updateFantasyProgress();
        });
      });
      fantasyGamesEl.appendChild(row);
    });
    updateFantasyProgress();
  }

  function setFantasyMsg(text, isError) {
    fantasyMsg.textContent = text;
    fantasyMsg.classList.toggle("error", !!isError);
  }

  function submitFantasyPicks() {
    if (notConfigured) {
      setFantasyMsg("Backend not configured yet.", true);
      return;
    }
    if (fantasyLocked()) {
      setFantasyMsg("Picks are locked — the deadline has passed.", true);
      renderFantasy();
      return;
    }
    const name = fantasyNameInput.value.trim();
    if (!name) {
      setFantasyMsg("Enter your name first.", true);
      fantasyNameInput.focus();
      return;
    }
    const missing = GAMES.filter((g) => myPicks[g.id] !== 1 && myPicks[g.id] !== 2);
    if (missing.length > 0) {
      setFantasyMsg(`Pick a winner for every game — ${missing.length} still unpicked.`, true);
      return;
    }

    localStorage.setItem(NAME_STORAGE_KEY, name);
    fantasySubmitBtn.disabled = true;
    setFantasyMsg("Submitting…");

    fetch(CONFIG.SHEET_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "fantasy", name: name, picks: myPicks })
    })
      .then((res) => res.json())
      .then((data) => {
        fantasySubmitBtn.disabled = false;
        if (data.status !== "ok") {
          setFantasyMsg(data.message || "Couldn't submit picks. Try again.", true);
          return;
        }
        setFantasyMsg(`Picks submitted for ${name} ✓ — you can resubmit to change them until the deadline.`);
        loadResults();
      })
      .catch((err) => {
        console.error(err);
        fantasySubmitBtn.disabled = false;
        setFantasyMsg("Couldn't submit picks. Check your connection and try again.", true);
      });
  }

  function formatCountdown(ms) {
    if (ms <= 0) return "0m";
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return (d > 0 ? d + "d " : "") + (d > 0 || h > 0 ? h + "h " : "") + m + "m";
  }

  function updateFantasyDeadlineLine() {
    const deadlineMs = new Date(fantasyData.deadline || CONFIG.FANTASY_DEADLINE).getTime();
    if (fantasyLocked()) {
      fantasyDeadlineLine.textContent = "Picks are locked";
      return;
    }
    fantasyDeadlineLine.textContent = `Picks lock in ${formatCountdown(deadlineMs - Date.now())}`;
  }

  function computeFantasyLeaderboard() {
    // winnerSlot per decisively completed game
    const winners = {};
    GAMES.forEach((g) => {
      if (!hasScore(g.id)) return;
      const s = scoresByGame[g.id];
      if (Number(s.team1Score) === Number(s.team2Score)) return;
      winners[g.id] = Number(s.team1Score) > Number(s.team2Score) ? 1 : 2;
    });
    const scoredGameIds = Object.keys(winners);

    const rows = fantasyData.entries.map((entry) => {
      let correct = 0;
      scoredGameIds.forEach((gid) => {
        if (entry.picks && Number(entry.picks[gid]) === winners[gid]) correct += 1;
      });
      return { name: entry.name, correct: correct };
    });

    rows.sort((a, b) => b.correct - a.correct || String(a.name).localeCompare(String(b.name)));
    rows.forEach((row, i) => {
      row.rank = i > 0 && row.correct === rows[i - 1].correct ? rows[i - 1].rank : i + 1;
    });

    return { rows: rows, scoredCount: scoredGameIds.length };
  }

  function renderFantasy() {
    updateFantasyDeadlineLine();
    const locked = fantasyLocked();

    fantasyFormCard.hidden = locked;
    fantasyLockedCard.hidden = !locked;

    if (!locked) {
      buildFantasyForm();
      const n = fantasyData.entries.length;
      const names = fantasyData.entries.map((e) => escapeHtml(e.name)).join(", ");
      fantasyLeaderboard.innerHTML = `
        <p class="hint">The leaderboard appears once picks lock.
        ${n > 0 ? `<strong>${n}</strong> ${n === 1 ? "entry" : "entries"} so far: ${names}.` : "No entries yet — be the first!"}</p>
      `;
      return;
    }

    fantasyEntryCount.textContent = String(fantasyData.entries.length);

    if (fantasyData.entries.length === 0) {
      fantasyLeaderboard.innerHTML = `<p class="hint">No fantasy entries were submitted.</p>`;
      return;
    }

    const board = computeFantasyLeaderboard();
    fantasyLeaderboard.innerHTML = `
      <div class="standings-scroll">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Participant</th>
              <th class="num">Correct Picks</th>
            </tr>
          </thead>
          <tbody>
            ${board.rows
              .map(
                (r) => `
                  <tr>
                    <td><span class="rank-chip">${r.rank}</span></td>
                    <td>${escapeHtml(r.name)}</td>
                    <td class="num">${r.correct} / ${board.scoredCount}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
      <p class="standings-legend">Scores update automatically as each game finishes. ${board.scoredCount} of ${GAMES.length} games scored so far.</p>
    `;
  }

  // ---------- Betting ----------

  function loadMyBets() {
    try {
      return JSON.parse(localStorage.getItem(BETS_STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  let myBets = loadMyBets();
  let bettingFormBuilt = false;

  function myBetsTotal() {
    return ALL_PLAYERS.reduce((sum, p) => sum + (Math.round(Number(myBets[p])) || 0), 0);
  }

  function updateBettingProgress() {
    const total = myBetsTotal();
    bettingProgress.textContent = `Allocated: $${total} / $${BET_BUDGET}`;
    bettingProgress.classList.toggle("over-budget", total > BET_BUDGET);
  }

  function buildBettingForm() {
    if (bettingFormBuilt) return;
    bettingFormBuilt = true;

    bettingNameInput.value = localStorage.getItem(NAME_STORAGE_KEY) || "";

    bettingPlayersEl.innerHTML = "";
    ALL_PLAYERS.forEach((player) => {
      const row = document.createElement("div");
      row.className = "bet-row";
      row.innerHTML = `
        <label class="bet-player-name">${escapeHtml(player)}</label>
        <div class="bet-amount-wrap">
          <span class="bet-currency">$</span>
          <input type="number" class="bet-input" min="0" max="${BET_BUDGET}" step="1" placeholder="0"
            value="${myBets[player] ? Math.round(Number(myBets[player])) : ""}" aria-label="Bet on ${escapeHtml(player)}">
        </div>
      `;
      const input = row.querySelector(".bet-input");
      input.addEventListener("input", () => {
        const v = Math.max(0, Math.round(Number(input.value)) || 0);
        if (v === 0) delete myBets[player];
        else myBets[player] = v;
        localStorage.setItem(BETS_STORAGE_KEY, JSON.stringify(myBets));
        updateBettingProgress();
      });
      bettingPlayersEl.appendChild(row);
    });
    updateBettingProgress();
  }

  function setBettingMsg(text, isError) {
    bettingMsg.textContent = text;
    bettingMsg.classList.toggle("error", !!isError);
  }

  function submitBets() {
    if (notConfigured) {
      setBettingMsg("Backend not configured yet.", true);
      return;
    }
    if (fantasyLocked()) {
      setBettingMsg("Betting is closed — the deadline has passed.", true);
      renderBetting();
      return;
    }
    const name = bettingNameInput.value.trim();
    if (!name) {
      setBettingMsg("Enter your name first.", true);
      bettingNameInput.focus();
      return;
    }
    const total = myBetsTotal();
    if (total <= 0) {
      setBettingMsg("Place at least $1 on someone.", true);
      return;
    }
    if (total > BET_BUDGET) {
      setBettingMsg(`You only have $${BET_BUDGET} to spread — you've allocated $${total}.`, true);
      return;
    }

    localStorage.setItem(NAME_STORAGE_KEY, name);
    bettingSubmitBtn.disabled = true;
    setBettingMsg("Placing bets…");

    fetch(CONFIG.SHEET_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "bets", name: name, bets: myBets })
    })
      .then((res) => res.json())
      .then((data) => {
        bettingSubmitBtn.disabled = false;
        if (data.status !== "ok") {
          setBettingMsg(data.message || "Couldn't place bets. Try again.", true);
          return;
        }
        setBettingMsg(`Bets placed for ${name} ✓ — $${total} in play. Resubmit to change them until the deadline.`);
        loadResults();
      })
      .catch((err) => {
        console.error(err);
        bettingSubmitBtn.disabled = false;
        setBettingMsg("Couldn't place bets. Check your connection and try again.", true);
      });
  }

  // Deterministic pseudo-shuffle so the cloud looks organic but stable between refreshes.
  function cloudOrderKey(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 9973;
    return h;
  }

  function renderBetCloud() {
    const totals = betsData.totals || {};
    const max = Math.max(1, ...ALL_PLAYERS.map((p) => Number(totals[p]) || 0));
    const pot = ALL_PLAYERS.reduce((sum, p) => sum + (Number(totals[p]) || 0), 0);
    const colors = ["cloud-navy", "cloud-green", "cloud-soft", "cloud-gold"];

    const ordered = ALL_PLAYERS.slice().sort((a, b) => cloudOrderKey(a) - cloudOrderKey(b));

    bettingCloud.innerHTML = ordered
      .map((p, i) => {
        const amount = Number(totals[p]) || 0;
        // sqrt scale keeps mid-size bets legible; range 0.85rem – 2.5rem
        const size = amount === 0 ? 0.85 : 0.95 + 1.55 * Math.sqrt(amount / max);
        return `<span class="cloud-word ${amount === 0 ? "cloud-zero" : colors[i % colors.length]}"
          style="font-size:${size.toFixed(2)}rem" title="${escapeHtml(p)} — $${amount}">${escapeHtml(p)}</span>`;
      })
      .join(" ");

    bettingPotLine.textContent =
      pot > 0
        ? `$${pot} placed by ${betsData.entries.length} bettor${betsData.entries.length === 1 ? "" : "s"} — names grow as more money lands on them. Hover a name for its total.`
        : "Player names grow as more money is placed on them. No bets yet — be the first!";
  }

  function renderBetting() {
    const locked = fantasyLocked();
    if (locked) {
      bettingDeadlineLine.textContent = "Betting is closed";
    } else {
      const deadlineMs = new Date(betsData.deadline || CONFIG.FANTASY_DEADLINE).getTime();
      bettingDeadlineLine.textContent = `Betting closes in ${formatCountdown(deadlineMs - Date.now())}`;
    }

    bettingFormCard.hidden = locked;
    bettingLockedCard.hidden = !locked;
    if (!locked) {
      buildBettingForm();
    } else {
      bettingEntryCount.textContent = String(betsData.entries.length);
    }
    renderBetCloud();
  }

  // ---------- Tabs ----------

  const tabs = [
    { btn: tabBtnSchedule, panel: tabSchedule },
    { btn: tabBtnKnockouts, panel: tabKnockouts },
    { btn: tabBtnFantasy, panel: tabFantasy },
    { btn: tabBtnBetting, panel: tabBetting }
  ];

  tabs.forEach((tab) => {
    tab.btn.addEventListener("click", () => {
      tabs.forEach((t) => {
        t.panel.hidden = t !== tab;
        t.btn.classList.toggle("active", t === tab);
      });
    });
  });

  fantasySubmitBtn.addEventListener("click", submitFantasyPicks);
  bettingSubmitBtn.addEventListener("click", submitBets);

  // ---------- Data loading ----------

  function setStatus(text, isError) {
    statusLine.textContent = text;
    statusLine.classList.toggle("error", !!isError);
  }

  function normalizeScoreValue(v) {
    return v === "" || v === null || v === undefined ? undefined : Number(v);
  }

  let hasLoadedOnce = false;

  function loadResults() {
    if (notConfigured) {
      setStatus(
        "Results backend isn't configured yet — see README.md to connect a Google Sheet.",
        true
      );
      renderGames();
      renderStandings();
      renderKnockouts();
      renderFantasy();
      renderBetting();
      return;
    }

    refreshIcon.style.transition = "transform 0.6s linear";
    refreshIcon.style.transform = "rotate(360deg)";
    if (!hasLoadedOnce) {
      setStatus("Loading results…");
    }

    const cacheBustUrl =
      CONFIG.SHEET_API_URL + (CONFIG.SHEET_API_URL.indexOf("?") === -1 ? "?" : "&") + "t=" + Date.now();

    fetch(cacheBustUrl, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        scoresByGame = {};
        (data.scores || []).forEach((row) => {
          const t1 = normalizeScoreValue(row.Team1Score);
          const t2 = normalizeScoreValue(row.Team2Score);
          if (t1 === undefined || t2 === undefined) return;
          scoresByGame[row.GameId] = { team1Score: t1, team2Score: t2 };
        });

        statsByGamePlayer = {};
        (data.playerStats || []).forEach((row) => {
          statsByGamePlayer[statKey(row.GameId, row.Player)] = {
            aces: row.Aces,
            faultServes: row.FaultServes,
            absent: row.Absent,
            proxyName: row.ProxyName
          };
        });

        knockoutScores = {};
        (data.knockouts || []).forEach((row) => {
          const t1 = normalizeScoreValue(row.Team1Score);
          const t2 = normalizeScoreValue(row.Team2Score);
          if (t1 === undefined || t2 === undefined) return;
          knockoutScores[row.MatchId] = { team1Score: t1, team2Score: t2 };
        });

        if (data.fantasy) {
          fantasyData = {
            locked: data.fantasy.locked === true,
            deadline: data.fantasy.deadline || CONFIG.FANTASY_DEADLINE,
            entries: data.fantasy.entries || []
          };
        }

        if (data.bets) {
          betsData = {
            locked: data.bets.locked === true,
            deadline: data.bets.deadline || CONFIG.FANTASY_DEADLINE,
            entries: data.bets.entries || [],
            totals: data.bets.totals || {}
          };
        }

        hasLoadedOnce = true;
        setStatus(`Live · last refreshed ${new Date().toLocaleTimeString()}`);
        renderGames();
        renderStandings();
        renderKnockouts();
        renderFantasy();
        renderBetting();
      })
      .catch((err) => {
        console.error(err);
        // Stay quiet on failure: leave the last successful status/data as-is (if any)
        // and just retry on the next auto-refresh, rather than alarming visitors.
        renderGames();
        renderStandings();
        renderKnockouts();
        renderFantasy();
        renderBetting();
      })
      .finally(() => {
        setTimeout(() => {
          refreshIcon.style.transform = "rotate(0deg)";
        }, 600);
      });
  }

  refreshBtn.addEventListener("click", loadResults);

  loadResults();
  if (!notConfigured) {
    setInterval(loadResults, AUTO_REFRESH_MS);
  }
  setInterval(() => {
    updateFantasyDeadlineLine();
    renderBetting();
  }, 30000);
})();
