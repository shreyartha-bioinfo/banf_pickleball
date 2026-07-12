# BANF Sports Day 2026 — Pickleball

A static website for the tournament: match schedule, live scores, auto-ranked
standings, and a sidebar with rules, tips, and tutorial links. Built as plain
HTML/CSS/JS so it can be hosted for free on GitHub Pages. The site is **read-only**
— you enter results directly in a Google Sheet, and the site displays them live.

## Match-day timeline

The 16 men's league games run in pairs (Court A + Court B) every 20 minutes:

| Time | Court A | Court B |
| --- | --- | --- |
| 9:30 AM | Game 1 | Game 2 |
| 9:50 AM | Game 3 | Game 4 |
| 10:10 AM | Game 5 | Game 6 |
| 10:30 AM | Game 7 | Game 8 |
| 10:50 AM | *Showcase break* | *Showcase break* |
| 11:10 AM | Game 9 | Game 10 |
| 11:30 AM | Game 11 | Game 12 |
| 11:50 AM | Game 13 | Game 14 |
| 12:10 PM | Game 15 | Game 16 |

The **10:50 AM showcase break** (20 minutes, after Game 8) hosts the exhibition
matches, all at the same time: Women's Doubles — Lopita/Tanima vs Sreya/Roopkatha;
Kids 13–17 Doubles — team combinations to be decided; Kids 7–13 Singles — Oleen vs
Evaan. They don't feed the men's standings or predictor; the women's match settles
the betting side pot (see below). Times live in `js/schedule.js` (`time` per game,
plus the `SHOWCASE_BREAK` constant).

### Showcase matches — names & scores

The showcase matches are managed from the **Showcase** tab of the Google Sheet
(auto-created with rows `W` = Women's Doubles, `K1` = Kids 13–17, `K2` = Kids 7–13):

- **Names:** whatever you type in `Team1` / `Team2` overrides the site's defaults —
  fill in the kids 13–17 combinations there once they're decided. Until both name
  cells of a row have something, the site shows "Team combinations to be decided".
- **Scores:** fill in `Team1Score` / `Team2Score` after each match — the showcase
  card on the site marks that match **Final**, shows the score, and highlights the
  winner. The `W` row's score also settles the women's betting side pot.
- **Markers:** the women's row carries the same live badges as the men's game cards —
  📣 on the pair backed by the majority of predictor picks, and 💵 on the pair
  holding more side-pot money.

## Live site

Once GitHub Pages is enabled (see below), the site will be available at:

```
https://shreyartha-bioinfo.github.io/banf_pickleball/
```

## 1. Set up the results backend (Google Sheet)

1. Create a new Google Sheet (sheets.new). Name it whatever you like, e.g. "BANF Pickleball 2026 Results".
2. In the Sheet, go to **Extensions → Apps Script**.
3. Delete any placeholder code in `Code.gs` and paste in the contents of
   [`apps-script/Code.gs`](apps-script/Code.gs) from this repo.
4. Click **Deploy → New deployment**.
   - Click the gear icon next to "Select type" and choose **Web app**.
   - Description: anything, e.g. "results API".
   - Execute as: **Me**.
   - Who has access: **Anyone**.
   - Click **Deploy**, and authorize the script when prompted (it only reads/creates
     tabs in this one sheet — nothing outside it).
5. Copy the **Web app URL** it gives you (ends in `/exec`).
6. In this repo, open [`js/config.js`](js/config.js) and paste the URL:

   ```js
   const CONFIG = {
     SHEET_API_URL: "https://script.google.com/macros/s/XXXXXXXX/exec"
   };
   ```

7. Commit and push.
8. Load the site once (or run `initializeSheets` from the Apps Script editor's Run
   menu) — this auto-creates the pre-filled tabs in your Sheet:
   - **Scores** — one row per game, with `Team1Score` / `Team2Score` left blank for you to fill in.
   - **PlayerStats** — one row per player per game (4 rows per game), with `Aces`,
     `FaultServes`, `Absent`, and `ProxyName` left blank for you to fill in.
   - **Showcase** — the 10:50 AM women's & kids matches: edit names, fill in scores.
   - **Knockouts**, **FantasyPicks**, and **Bets** — knockout scores and the
     site-submitted predictor/betting entries.

## 2. Entering results after each match

Open the Google Sheet directly (not the website) and:

- In the **Scores** tab, find the row for that `GameId` and fill in `Team1Score` and
  `Team2Score`.
- In the **PlayerStats** tab, find each of the 4 players' rows for that `GameId` and
  fill in `Aces` and `FaultServes`.
- If a player didn't show up and someone played as their proxy: set that player's
  `Absent` cell to `TRUE` and optionally note the substitute's name in `ProxyName`.
  That player gets no credit for the game (no win, no point/ace differential) in the
  standings — but their present teammate and both opponents are scored normally.

The site polls the Sheet automatically every 45 seconds, plus there's a manual
**Refresh Results** button, so standings update live as you type.

> If you deployed an earlier version of `Code.gs`, redeploy (**Deploy → Manage
> deployments → edit → New version**) with the latest `apps-script/Code.gs` so the
> site keeps working with the same URL.

## Knockout bracket

The **Knockouts** tab builds the elimination round from the standings automatically:

- The top 8 pair up by rank — 1 with 8, 2 with 7, 3 with 6, 4 with 5.
- Semifinal 1 is (1/8) vs (3/6); Semifinal 2 is (2/7) vs (4/5); winners meet in the final.
- Until all 16 league games are complete, the bracket is a live projection from the
  current standings; players tied on all tiebreakers are seeded in table order.
- Enter semifinal/final scores in the auto-created `Knockouts` sheet tab (rows `SF1`,
  `SF2`, `F` — the Match column notes which seeds are Team1 vs Team2). The final's
  teams fill in automatically from the semifinal winners, and a champions banner
  appears once the final has a decisive score.

## Predictor game

The **Predictor** tab lets anyone predict the winner of all 16 league games plus
the Women's Doubles showcase match (17 picks total; the women's pick is stored in
the `GW` column of `FantasyPicks` and scored from the `W` row of the `Showcase` tab):

- Participants enter their name, tap a team in each game, and submit. Entries are
  stored in a `FantasyPicks` tab of the same Google Sheet (auto-created).
- **Picks lock two games at a time (rolling)**: Games 1 & 2 lock at first serve —
  **9:30 AM US Eastern, Sunday July 12, 2026** (`PREDICTOR_START` in `js/config.js`
  and `apps-script/Code.gs`, keep them matching) — and each later pair (3&4, 5&6, …)
  locks the moment the previous pair's results land in the `Scores` tab. The women's
  showcase pick locks when Games 7 & 8 are done (the showcase follows them) or when
  its own result is entered. A pair whose own score appears is locked regardless.
- Enforced server-side: locked picks are frozen verbatim even on resubmit, and open
  picks can be joined or updated by anyone at any time (resubmitting the same name
  replaces open picks only — late joiners simply can't score already-locked games).
- Entrant names stay anonymous until play starts; from 9:30 AM the leaderboard runs
  live — one point per correctly picked winner (only completed matches count, ties
  share a rank) — and each pair's picks are revealed as that pair locks. Open picks
  stay private.

## Betting game

The **Betting** tab gives everyone **$100 of virtual money** to spread across the
players they think will win the tournament:

- Any split is allowed — $100 on one favourite or a few dollars across many players —
  as long as the total stays within the budget (whole dollars, at least $1).
- Bets land in a `Bets` tab of the Sheet (auto-created, one column per player).
  Resubmitting with the same name before the deadline replaces that person's bets.
- Betting closes at **12:00 PM (noon) US Eastern, Sunday July 12, 2026** —
  server-enforced (`BETTING_DEADLINE` in `js/config.js` and `apps-script/Code.gs`).
  The women's $20 side pot additionally freezes when the showcase starts (Games 7 & 8
  scored, or the `W` result entered), so nobody can bet on a match already played.
- Individual allocations stay private until the deadline — before lock the API only
  exposes per-player totals, which feed **The Money Cloud**: a live word cloud where a
  player's name grows with the total money placed on them (hover a name for its exact
  total). After lock, individual bets are revealed to drive the payout board.

### Payout rules

Each wager pays out at **wager × the player's final multiplier**:

- **Table stage** — a player finishing 9th–16th doesn't qualify and that wager is lost
  (0×). The top 8 earn a base multiplier by exact final rank: 1st = 1.8×, 2nd = 1.7×,
  3rd = 1.6×, 4th = 1.5×, 5th = 1.4×, 6th = 1.3×, 7th = 1.2×, 8th = 1.1×. Players
  sharing a rank share its multiplier.
- **Knockout bonuses (stack on the base)** — winning a semifinal adds +0.8×; winning
  the championship adds a further +1.5×. (Example: $10 on the table-topper who wins
  semi and final → 1.8 + 0.8 + 1.5 = 4.1× → $41.)
- **💎 Perfect Portfolio** — bet on exactly 8 players and predict the qualifiers
  perfectly; if all 8 finish in the top 8, that bettor gets a flat +$50 and +0.5×
  added to every wager (any stake split counts — the full $100 need not be used).
- **Women's Doubles side pot** — every bettor also gets a separate **$20** to split
  between the two showcase pairs (Lopita/Tanima and Sreya/Roopkatha), any way they
  like. The winning pair pays **1.5×** and the losing pair **0.5×**: an even $10/$10
  split returns exactly the $20 staked, all-in on the winner pays $30, all-in on the
  loser returns $10. The result comes from the `W` row of the `Showcase` tab; until
  it's entered, the payout board counts side-pot stakes at face value. Side-pot
  stakes don't count toward the Perfect Portfolio's "exactly 8 players".

The **Betting Leaderboard** on the Betting tab lists who has entered before the
deadline, then switches to the full board once betting locks: bettors ranked by net
profit (payout minus stake, ties sharing a rank), showing staked amount, payout, and
a green/red net column, live-updating as standings and knockout results come in and
marked "Final" once the championship is decided.

## How standings are ranked

Players are ranked by, in order:

1. **Wins**
2. **Point differential** — points scored minus points conceded, summed across a
   player's games
3. **Aces − False Serves**
4. **Head-to-head** — net wins/losses against other players they're still tied with
   after the first three tiers

If two or more players are still tied after all four tiers, they share the same rank
(e.g. `1, 2, 2, 2, 2, 6, 6, 8`). The top 8 ranks are highlighted as qualifying.

## 3. Enable GitHub Pages

1. Push this repo's contents to the `main` branch (or merge the PR from the working branch into `main`).
2. In GitHub: **Settings → Pages**.
3. Under "Build and deployment", set **Source** to "Deploy from a branch".
4. Choose branch `main` and folder `/ (root)`, then **Save**.
5. GitHub will publish the site at `https://<your-username>.github.io/<repo-name>/`
   within a minute or two.

## Project structure

```
index.html          Main page: schedule + standings + sidebar
css/style.css        Styling
js/schedule.js        The 16-game schedule + showcase break (edit here to change teams/courts/times)
js/config.js           Your Google Apps Script Web App URL goes here
js/app.js               Rendering + standings ranking logic (read-only, auto-refreshes)
apps-script/Code.gs   Google Apps Script backend — serves the Sheet as JSON
```

## Editing the schedule

Edit **both** `js/schedule.js` (used by the website) and the `GAMES` constant at the
top of `apps-script/Code.gs` (used to pre-fill the Sheet tabs) — they must stay
identical. Each game is an object with `id`, `court`, `time`, `team1` (array of two
names), and `team2`. Game IDs must stay unique.

**If the Sheet tabs already exist when the schedule changes** (as with the move from
the old 12-game draw to the current 16-game one): the script never overwrites
existing tabs, so delete (or rename to keep as archive) the `Scores`, `PlayerStats`,
and `FantasyPicks` tabs, run `initializeSheets` again to recreate them from the new
schedule, and redeploy the Apps Script (**Deploy → Manage deployments → edit → New
version**). Predictor entries submitted against the old schedule reference the old
games and can't be carried over — those participants need to resubmit their picks.
Bets are per-player, so the `Bets` tab survives a schedule change (unless player
names changed — "Suvankar" is now listed as "Suvankar Paul").

**Upgrading an existing Sheet after a Code.gs update:** paste the latest `Code.gs`
into the Apps Script editor, run **`upgradeSheets`** once from the Run menu, then
redeploy (**Deploy → Manage deployments → edit → New version**). `upgradeSheets`
creates any missing tabs (e.g. `Showcase`) and upgrades headers in place — renaming
the old `Suvankar` column to `Suvankar Paul` and appending the two women's-pair
columns in `Bets`, and the `GW` women's-pick column in `FantasyPicks` — without
touching any data rows.

## Local preview

No build step required — just open `index.html` in a browser, or serve the folder:

```
python3 -m http.server 8000
```

then visit `http://localhost:8000`. Live data won't load until `SHEET_API_URL` is
configured (step 1 above); the schedule will still display with pending scores.
