(function () {
  const gamesGrid = document.getElementById("games-grid");
  const statusLine = document.getElementById("status-line");
  const standingsTable = document.getElementById("standings-table");
  const refreshBtn = document.getElementById("refresh-btn");
  const refreshIcon = document.getElementById("refresh-icon");

  // results keyed by game id: { score1, score2, winner }
  let results = {};
  const notConfigured =
    !CONFIG.SHEET_API_URL || CONFIG.SHEET_API_URL.indexOf("PASTE_YOUR") === 0;

  function playerRows(team) {
    return team.map((p) => `<span class="player">${escapeHtml(p)}</span>`).join("");
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderGames() {
    gamesGrid.innerHTML = "";
    GAMES.forEach((game) => {
      const r = results[game.id];
      const hasResult = r && r.score1 !== "" && r.score1 !== undefined && r.score1 !== null;
      const winner = hasResult ? r.winner : "";

      const card = document.createElement("div");
      card.className = "game-card" + (hasResult ? " completed" : "");
      card.innerHTML = `
        ${hasResult && winner ? `<div class="winner-tag">Winner: ${escapeHtml(winner)}</div>` : ""}
        <div class="game-card-top">
          <span class="game-number">Game ${game.id}</span>
          <span class="court-badge">Court ${game.court}</span>
        </div>
        <div class="team-row${winner && teamLabel(game.team1) === winner ? " winner" : ""}">
          <div class="team-names">${playerRows(game.team1)}</div>
          <input type="number" min="0" class="score-input" data-role="score1" value="${hasResult ? r.score1 : ""}" aria-label="Score for ${teamLabel(game.team1)}">
        </div>
        <div class="vs-divider">VS</div>
        <div class="team-row${winner && teamLabel(game.team2) === winner ? " winner" : ""}">
          <div class="team-names">${playerRows(game.team2)}</div>
          <input type="number" min="0" class="score-input" data-role="score2" value="${hasResult ? r.score2 : ""}" aria-label="Score for ${teamLabel(game.team2)}">
        </div>
        <div class="game-card-actions">
          <button class="btn btn-primary" data-role="save">Save Result</button>
          <span class="save-msg" data-role="msg"></span>
        </div>
      `;

      const saveBtn = card.querySelector('[data-role="save"]');
      const msg = card.querySelector('[data-role="msg"]');
      const score1Input = card.querySelector('[data-role="score1"]');
      const score2Input = card.querySelector('[data-role="score2"]');

      saveBtn.addEventListener("click", () => {
        const s1 = score1Input.value.trim();
        const s2 = score2Input.value.trim();
        if (s1 === "" || s2 === "") {
          msg.textContent = "Enter both scores.";
          msg.classList.add("error");
          return;
        }
        saveResult(game, s1, s2, saveBtn, msg);
      });

      gamesGrid.appendChild(card);
    });
  }

  function teamLabel(team) {
    return team.join(" / ");
  }

  function saveResult(game, s1, s2, btn, msg) {
    if (notConfigured) {
      msg.textContent = "Backend not configured yet (see README).";
      msg.classList.add("error");
      return;
    }
    btn.disabled = true;
    msg.classList.remove("error");
    msg.textContent = "Saving…";

    const payload = {
      gameId: game.id,
      court: game.court,
      team1: teamLabel(game.team1),
      team2: teamLabel(game.team2),
      score1: Number(s1),
      score2: Number(s2)
    };

    fetch(CONFIG.SHEET_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    })
      .then((res) => res.json())
      .then(() => {
        results[game.id] = {
          score1: payload.score1,
          score2: payload.score2,
          winner:
            payload.score1 === payload.score2
              ? ""
              : payload.score1 > payload.score2
              ? payload.team1
              : payload.team2
        };
        msg.textContent = "Saved ✓";
        btn.disabled = false;
        renderGames();
        renderStandings();
      })
      .catch((err) => {
        console.error(err);
        msg.textContent = "Failed to save. Try again.";
        msg.classList.add("error");
        btn.disabled = false;
      });
  }

  function renderStandings() {
    const wins = {};
    const played = {};

    function bump(name, map) {
      map[name] = (map[name] || 0) + 1;
    }

    GAMES.forEach((game) => {
      const r = results[game.id];
      if (!r || r.score1 === "" || r.score1 === undefined) return;
      game.team1.forEach((p) => bump(p, played));
      game.team2.forEach((p) => bump(p, played));
      if (r.score1 === r.score2) return;
      const winningTeam = r.score1 > r.score2 ? game.team1 : game.team2;
      winningTeam.forEach((p) => bump(p, wins));
    });

    const players = Array.from(
      new Set(GAMES.flatMap((g) => g.team1.concat(g.team2)))
    );

    if (Object.keys(played).length === 0) {
      standingsTable.innerHTML = `<p class="hint">No results entered yet.</p>`;
      return;
    }

    const rows = players
      .map((p) => ({ name: p, wins: wins[p] || 0, played: played[p] || 0 }))
      .filter((p) => p.played > 0)
      .sort((a, b) => b.wins - a.wins || b.played - a.played);

    standingsTable.innerHTML = `
      <table>
        <thead><tr><th>Player</th><th>Wins</th><th>Played</th></tr></thead>
        <tbody>
          ${rows
            .map(
              (r) =>
                `<tr><td>${escapeHtml(r.name)}</td><td>${r.wins}</td><td>${r.played}</td></tr>`
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  function setStatus(text, isError) {
    statusLine.textContent = text;
    statusLine.classList.toggle("error", !!isError);
  }

  function loadResults() {
    if (notConfigured) {
      setStatus(
        "Score entry backend isn't configured yet — see README.md to connect a Google Sheet.",
        true
      );
      renderGames();
      renderStandings();
      return;
    }

    refreshIcon.style.transition = "transform 0.6s linear";
    refreshIcon.style.transform = "rotate(360deg)";
    setStatus("Loading results…");

    fetch(CONFIG.SHEET_API_URL)
      .then((res) => res.json())
      .then((data) => {
        results = {};
        (data.results || []).forEach((row) => {
          results[row.GameId] = {
            score1: row.Score1,
            score2: row.Score2,
            winner: row.Winner
          };
        });
        setStatus(
          `Loaded ${Object.keys(results).length} result(s) · last refreshed ${new Date().toLocaleTimeString()}`
        );
        renderGames();
        renderStandings();
      })
      .catch((err) => {
        console.error(err);
        setStatus("Couldn't load results — showing schedule only.", true);
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
})();
