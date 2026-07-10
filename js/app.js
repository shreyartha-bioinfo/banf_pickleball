(function () {
  const gamesGrid = document.getElementById("games-grid");
  const statusLine = document.getElementById("status-line");
  const standingsTable = document.getElementById("standings-table");
  const refreshBtn = document.getElementById("refresh-btn");
  const refreshIcon = document.getElementById("refresh-icon");

  const AUTO_REFRESH_MS = 45000;
  const QUALIFY_RANK = 8;

  const notConfigured =
    !CONFIG.SHEET_API_URL || CONFIG.SHEET_API_URL.indexOf("PASTE_YOUR") === 0;

  // scoresByGame[gameId] = { team1Score, team2Score } (numbers, or undefined if not yet played)
  let scoresByGame = {};
  // statsByGamePlayer["gameId|Player"] = { aces, faultServes, absent, proxyName }
  let statsByGamePlayer = {};

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

        hasLoadedOnce = true;
        setStatus(`Live · last refreshed ${new Date().toLocaleTimeString()}`);
        renderGames();
        renderStandings();
      })
      .catch((err) => {
        console.error(err);
        // Stay quiet on failure: leave the last successful status/data as-is (if any)
        // and just retry on the next auto-refresh, rather than alarming visitors.
        renderGames();
        renderStandings();
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
})();
