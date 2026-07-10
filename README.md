# BANF Sports Day 2026 — Men's Pickleball

A static website for the tournament: match schedule, live scores, auto-ranked
standings, and a sidebar with rules, tips, and tutorial links. Built as plain
HTML/CSS/JS so it can be hosted for free on GitHub Pages. The site is **read-only**
— you enter results directly in a Google Sheet, and the site displays them live.

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
   menu) — this auto-creates two pre-filled tabs in your Sheet:
   - **Scores** — one row per game, with `Team1Score` / `Team2Score` left blank for you to fill in.
   - **PlayerStats** — one row per player per game (4 rows per game), with `Aces`,
     `FaultServes`, `Absent`, and `ProxyName` left blank for you to fill in.

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
- Until all 12 league games are complete, the bracket is a live projection from the
  current standings; players tied on all tiebreakers are seeded in table order.
- Enter semifinal/final scores in the auto-created `Knockouts` sheet tab (rows `SF1`,
  `SF2`, `F` — the Match column notes which seeds are Team1 vs Team2). The final's
  teams fill in automatically from the semifinal winners, and a champions banner
  appears once the final has a decisive score.

## Predictor game

The **Predictor** tab lets anyone predict the winner of all 12 league games:

- Participants enter their name, tap a team in each game, and submit. Entries are
  stored in a `FantasyPicks` tab of the same Google Sheet (auto-created).
- Resubmitting with the same name before the deadline replaces that person's picks.
- Picks lock at **10:00 AM US Eastern, Sunday July 12, 2026** — enforced server-side
  in Apps Script, not just hidden in the page. To change the deadline, update
  `FANTASY_DEADLINE` in `js/config.js` and `ENTRY_DEADLINE` in `apps-script/Code.gs`
  (they must match), then redeploy the Apps Script. The same deadline governs betting.
- Everyone's picks stay hidden until the deadline passes; after lock, the form is
  replaced by a leaderboard scoring one point per correctly picked winner (only
  completed games count, ties share a rank), updating live as results are entered.

## Betting game

The **Betting** tab gives everyone **$100 of virtual money** to spread across the
players they think will win the tournament:

- Any split is allowed — $100 on one favourite or a few dollars across many players —
  as long as the total stays within the budget (whole dollars, at least $1).
- Bets land in a `Bets` tab of the Sheet (auto-created, one column per player).
  Resubmitting with the same name before the deadline replaces that person's bets.
- Betting closes at the same server-enforced deadline as the Predictor.
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
js/schedule.js        The 12-game schedule (edit here to change teams/courts)
js/config.js           Your Google Apps Script Web App URL goes here
js/app.js               Rendering + standings ranking logic (read-only, auto-refreshes)
apps-script/Code.gs   Google Apps Script backend — serves the Sheet as JSON
```

## Editing the schedule

Edit **both** `js/schedule.js` (used by the website) and the `GAMES` constant at the
top of `apps-script/Code.gs` (used to pre-fill the Sheet tabs) — they must stay
identical. Each game is an object with `id`, `court`, `team1` (array of two names),
and `team2`. Game IDs must stay unique.

## Local preview

No build step required — just open `index.html` in a browser, or serve the folder:

```
python3 -m http.server 8000
```

then visit `http://localhost:8000`. Live data won't load until `SHEET_API_URL` is
configured (step 1 above); the schedule will still display with pending scores.
