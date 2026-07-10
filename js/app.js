(function () {
  const gamesGrid = document.getElementById("games-grid");
  const statusLine = document.getElementById("status-line");
  const standingsTable = document.getElementById("standings-table");
  const refreshBtn = document.getElementById("refresh-btn");
  const refreshIcon = document.getElementById("refresh-icon");

  const adminStatusEl = document.getElementById("admin-status");
  const adminLoginBtn = document.getElementById("admin-login-btn");
  const adminLogoutBtn = document.getElementById("admin-logout-btn");
  const loginPopover = document.getElementById("login-popover");
  const passwordInput = document.getElementById("admin-password-input");
  const submitBtn = document.getElementById("admin-submit-btn");
  const loginError = document.getElementById("login-error");

  const STORAGE_KEY = "banfAdminPassword";

  // results keyed by game id: { score1, score2, winner, absentPlayers: [names], proxyNames: {name: proxyName} }
  let results = {};
  const notConfigured =
    !CONFIG.SHEET_API_URL || CONFIG.SHEET_API_URL.indexOf("PASTE_YOUR") === 0;

  // Transient "Saved ✓" confirmation shown on a card right after a re-render.
  let flashMessage = null; // { gameId, text, isError }

  let isAdmin = false;
  let adminPassword = null;

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

  function cssEscape(str) {
    return window.CSS && CSS.escape ? CSS.escape(str) : str.replace(/["\\]/g, "\\$&");
  }

  // ---------- Admin login ----------

  function setAdminUi() {
    adminStatusEl.textContent = isAdmin ? "Scorekeeper mode" : "Viewing (read-only)";
    adminStatusEl.classList.toggle("active", isAdmin);
    adminLoginBtn.hidden = isAdmin;
    adminLogoutBtn.hidden = !isAdmin;
  }

  function verifyPassword(password) {
    if (notConfigured) return Promise.resolve(false);
    return fetch(CONFIG.SHEET_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "verify", password: password })
    })
      .then((res) => res.json())
      .then((data) => !!data.valid)
      .catch(() => false);
  }

  adminLoginBtn.addEventListener("click", () => {
    loginPopover.hidden = !loginPopover.hidden;
    loginError.textContent = "";
    if (!loginPopover.hidden) passwordInput.focus();
  });

  adminLogoutBtn.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    adminPassword = null;
    isAdmin = false;
    setAdminUi();
    renderGames();
  });

  function attemptLogin() {
    const pw = passwordInput.value;
    if (!pw) return;
    loginError.textContent = "";
    submitBtn.disabled = true;
    verifyPassword(pw).then((valid) => {
      submitBtn.disabled = false;
      if (valid) {
        adminPassword = pw;
        localStorage.setItem(STORAGE_KEY, pw);
        isAdmin = true;
        passwordInput.value = "";
        loginPopover.hidden = true;
        setAdminUi();
        renderGames();
      } else {
        loginError.textContent = notConfigured
          ? "Backend not configured yet."
          : "Incorrect password.";
      }
    });
  }

  submitBtn.addEventListener("click", attemptLogin);
  passwordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") attemptLogin();
  });

  function restoreAdminSession() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    verifyPassword(stored).then((valid) => {
      if (valid) {
        adminPassword = stored;
        isAdmin = true;
      } else {
        localStorage.removeItem(STORAGE_KEY);
        isAdmin = false;
      }
      setAdminUi();
      renderGames();
    });
  }

  // ---------- Rendering ----------

  function playerLinesEditable(team, r) {
    const absent = (r && r.absentPlayers) || [];
    const proxies = (r && r.proxyNames) || {};
    return team
      .map((p) => {
        const isAbsent = absent.indexOf(p) !== -1;
        const proxyName = proxies[p] || "";
        return `
          <div class="player-line">
            <label class="player-check">
              <input type="checkbox" class="absent-check" data-player="${escapeHtml(p)}" ${isAbsent ? "checked" : ""}>
              <span class="player${isAbsent ? " absent" : ""}">${escapeHtml(p)}</span>
            </label>
            <input type="text" class="proxy-input" data-player="${escapeHtml(p)}"
              placeholder="Proxy player name" value="${escapeHtml(proxyName)}"
              style="display:${isAbsent ? "block" : "none"}">
          </div>
        `;
      })
      .join("");
  }

  function playerLinesReadOnly(team, r) {
    const absent = (r && r.absentPlayers) || [];
    const proxies = (r && r.proxyNames) || {};
    return team
      .map((p) => {
        const isAbsent = absent.indexOf(p) !== -1;
        const proxyName = proxies[p] || "";
        return `
          <div class="player-line-view${isAbsent ? " absent" : ""}">
            <span class="player-name">${escapeHtml(p)}</span>
            ${isAbsent ? `<span class="proxy-note">No-show${proxyName ? ` — proxy: ${escapeHtml(proxyName)}` : ""}</span>` : ""}
          </div>
        `;
      })
      .join("");
  }

  function renderGames() {
    gamesGrid.innerHTML = "";
    GAMES.forEach((game) => {
      const r = results[game.id];
      const hasResult = r && r.score1 !== "" && r.score1 !== undefined && r.score1 !== null;
      const winner = hasResult ? r.winner : "";

      const card = document.createElement("div");
      card.className = "game-card" + (hasResult ? " completed" : "");
      card.dataset.gameId = game.id;

      const team1Score = isAdmin
        ? `<input type="number" min="0" class="score-input" data-role="score1" value="${hasResult ? r.score1 : ""}" aria-label="Score for ${teamLabel(game.team1)}">`
        : `<span class="score-display${hasResult ? "" : " pending"}">${hasResult ? r.score1 : "–"}</span>`;
      const team2Score = isAdmin
        ? `<input type="number" min="0" class="score-input" data-role="score2" value="${hasResult ? r.score2 : ""}" aria-label="Score for ${teamLabel(game.team2)}">`
        : `<span class="score-display${hasResult ? "" : " pending"}">${hasResult ? r.score2 : "–"}</span>`;

      card.innerHTML = `
        ${hasResult && winner ? `<div class="winner-tag">Winner: ${escapeHtml(winner)}</div>` : ""}
        <div class="game-card-top">
          <span class="game-number">Game ${game.id}</span>
          <span class="court-badge">Court ${game.court}</span>
        </div>
        <div class="team-row${winner && teamLabel(game.team1) === winner ? " winner" : ""}">
          <div class="team-names">${isAdmin ? playerLinesEditable(game.team1, r) : playerLinesReadOnly(game.team1, r)}</div>
          ${team1Score}
        </div>
        <div class="vs-divider">VS</div>
        <div class="team-row${winner && teamLabel(game.team2) === winner ? " winner" : ""}">
          <div class="team-names">${isAdmin ? playerLinesEditable(game.team2, r) : playerLinesReadOnly(game.team2, r)}</div>
          ${team2Score}
        </div>
        ${
          isAdmin
            ? `
        <p class="proxy-hint">Check a player's box if they didn't show up and someone played as their proxy. The absent player won't get credit in standings.</p>
        <div class="game-card-actions">
          <button class="btn btn-primary" data-role="save">Save Result</button>
          <span class="save-msg" data-role="msg"></span>
        </div>`
            : ""
        }
      `;

      if (isAdmin) {
        const saveBtn = card.querySelector('[data-role="save"]');
        const msg = card.querySelector('[data-role="msg"]');
        const score1Input = card.querySelector('[data-role="score1"]');
        const score2Input = card.querySelector('[data-role="score2"]');

        if (flashMessage && flashMessage.gameId === game.id) {
          msg.textContent = flashMessage.text;
          msg.classList.toggle("error", !!flashMessage.isError);
        }

        card.querySelectorAll(".absent-check").forEach((checkbox) => {
          checkbox.addEventListener("change", () => {
            const line = checkbox.closest(".player-line");
            const proxyInput = line.querySelector(".proxy-input");
            const label = line.querySelector(".player");
            proxyInput.style.display = checkbox.checked ? "block" : "none";
            label.classList.toggle("absent", checkbox.checked);
            if (!checkbox.checked) proxyInput.value = "";
          });
        });

        saveBtn.addEventListener("click", () => {
          const s1 = score1Input.value.trim();
          const s2 = score2Input.value.trim();
          if (s1 === "" || s2 === "") {
            msg.textContent = "Enter both scores.";
            msg.classList.add("error");
            return;
          }

          const absentPlayers = [];
          const proxyNames = {};
          card.querySelectorAll(".absent-check").forEach((checkbox) => {
            if (checkbox.checked) {
              const name = checkbox.dataset.player;
              absentPlayers.push(name);
              const proxyInput = card.querySelector(`.proxy-input[data-player="${cssEscape(name)}"]`);
              const proxyVal = proxyInput ? proxyInput.value.trim() : "";
              if (proxyVal) proxyNames[name] = proxyVal;
            }
          });

          saveResult(game, s1, s2, absentPlayers, proxyNames, saveBtn, msg);
        });
      }

      gamesGrid.appendChild(card);
    });
  }

  function saveResult(game, s1, s2, absentPlayers, proxyNames, btn, msg) {
    if (notConfigured) {
      msg.textContent = "Backend not configured yet (see README).";
      msg.classList.add("error");
      return;
    }
    if (!isAdmin || !adminPassword) {
      msg.textContent = "Log in as scorekeeper to save results.";
      msg.classList.add("error");
      return;
    }
    btn.disabled = true;
    msg.classList.remove("error");
    msg.textContent = "Saving…";

    const payload = {
      action: "save",
      password: adminPassword,
      gameId: game.id,
      court: game.court,
      team1: teamLabel(game.team1),
      team2: teamLabel(game.team2),
      score1: Number(s1),
      score2: Number(s2),
      absentPlayers: absentPlayers,
      proxyNames: proxyNames
    };

    fetch(CONFIG.SHEET_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "error") {
          throw new Error(data.message || "Save failed");
        }
        results[game.id] = {
          score1: payload.score1,
          score2: payload.score2,
          winner:
            payload.score1 === payload.score2
              ? ""
              : payload.score1 > payload.score2
              ? payload.team1
              : payload.team2,
          absentPlayers: absentPlayers,
          proxyNames: proxyNames
        };
        flashMessage = { gameId: game.id, text: "Saved ✓", isError: false };
        renderGames();
        renderStandings();
        scheduleFlashClear(game.id);
      })
      .catch((err) => {
        console.error(err);
        const isAuthError = /password/i.test(err.message || "");
        if (isAuthError) {
          localStorage.removeItem(STORAGE_KEY);
          adminPassword = null;
          isAdmin = false;
          setAdminUi();
          renderGames();
          setStatus("Your scorekeeper session expired — please log in again.", true);
          return;
        }
        msg.textContent = "Failed to save. Try again.";
        msg.classList.add("error");
        btn.disabled = false;
      });
  }

  function scheduleFlashClear(gameId) {
    setTimeout(() => {
      if (flashMessage && flashMessage.gameId === gameId) {
        flashMessage = null;
        const card = gamesGrid.querySelector(`[data-game-id="${gameId}"]`);
        const msgEl = card && card.querySelector('[data-role="msg"]');
        if (msgEl) msgEl.textContent = "";
      }
    }, 2500);
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
      const absent = r.absentPlayers || [];

      game.team1
        .concat(game.team2)
        .filter((p) => absent.indexOf(p) === -1)
        .forEach((p) => bump(p, played));

      if (r.score1 === r.score2) return;
      const winningTeam = r.score1 > r.score2 ? game.team1 : game.team2;
      winningTeam.filter((p) => absent.indexOf(p) === -1).forEach((p) => bump(p, wins));
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

  function safeParseJson(str, fallback) {
    if (!str) return fallback;
    try {
      return JSON.parse(str);
    } catch (e) {
      return fallback;
    }
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
            winner: row.Winner,
            absentPlayers: safeParseJson(row.AbsentPlayers, []),
            proxyNames: safeParseJson(row.ProxyNames, {})
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

  setAdminUi();
  loadResults();
  restoreAdminSession();
})();
