# BANF Sports Day 2026 — Men's Pickleball

A static website for the tournament: match schedule, live score entry, standings, and a
sidebar with rules, tips, and tutorial links. Built as plain HTML/CSS/JS so it can be
hosted for free on GitHub Pages, with a Google Sheet as the results backend.

## Live site

Once GitHub Pages is enabled (see below), the site will be available at:

```
https://shreyartha-bioinfo.github.io/banf_pickleball/
```

## 1. Set up the results backend (Google Sheet)

Score entries are written to a Google Sheet through a small Apps Script "Web App" so
scores sync across everyone viewing the site.

1. Create a new Google Sheet (sheets.new). Name it whatever you like, e.g. "BANF Pickleball 2026 Results".
2. In the Sheet, go to **Extensions → Apps Script**.
3. Delete any placeholder code in `Code.gs` and paste in the contents of
   [`apps-script/Code.gs`](apps-script/Code.gs) from this repo.
4. Click **Deploy → New deployment**.
   - Click the gear icon next to "Select type" and choose **Web app**.
   - Description: anything, e.g. "results API".
   - Execute as: **Me**.
   - Who has access: **Anyone**.
   - Click **Deploy**, and authorize the script when prompted (it only edits this one sheet).
5. Copy the **Web app URL** it gives you (ends in `/exec`).
6. In this repo, open [`js/config.js`](js/config.js) and paste the URL:

   ```js
   const CONFIG = {
     SHEET_API_URL: "https://script.google.com/macros/s/XXXXXXXX/exec"
   };
   ```

7. Commit and push. The site will now read/write results from your Sheet.

The script auto-creates a `Results` sheet tab with headers the first time someone saves
a score — no manual header setup needed. You (or anyone with edit access to the Sheet)
can also open the Sheet directly to view or correct results.

> If you deployed an earlier version of `Code.gs` before the no-show/proxy feature was
> added, just redeploy (**Deploy → Manage deployments → edit → New version**) with the
> latest `apps-script/Code.gs`. It automatically upgrades the header row on the next
> score save.

### No-shows and proxy players

Each player row in a game card has a checkbox. If a player doesn't show up and someone
else plays in their place, check that player's box (an optional "proxy name" field
appears for the record) and save the result as normal. The absent player is excluded
from the standings' win/played counts for that game — the match result and court
assignment are unaffected.

> **Note:** because the Web App is set to "Anyone" access, anyone who has the URL can
> submit results (there's no login). That matches a casual sports-day scorekeeping
> use case; don't reuse this URL for anything sensitive. If you ever want to rotate
> it, redeploy a new version in Apps Script and update `js/config.js`.

## 2. Enable GitHub Pages

1. Push this repo's contents to the `main` branch (or merge the PR from the working branch into `main`).
2. In GitHub: **Settings → Pages**.
3. Under "Build and deployment", set **Source** to "Deploy from a branch".
4. Choose branch `main` and folder `/ (root)`, then **Save**.
5. GitHub will publish the site at `https://<your-username>.github.io/<repo-name>/`
   within a minute or two.

## Project structure

```
index.html          Main page: schedule + sidebar
css/style.css        Styling
js/schedule.js        The 12-game schedule (edit here to change teams/courts)
js/config.js           Your Google Apps Script Web App URL goes here
js/app.js               Rendering, score entry, standings logic
apps-script/Code.gs   Google Apps Script backend (paste into Apps Script editor)
```

## Editing the schedule

Edit `js/schedule.js` — each game is an object with `id`, `court`, `team1` (array of
two names), and `team2`. Game IDs must stay unique since they're used as the key when
saving/loading results.

## Local preview

No build step required — just open `index.html` in a browser, or serve the folder:

```
python3 -m http.server 8000
```

then visit `http://localhost:8000`. Score saving won't work until `SHEET_API_URL` is
configured (step 1 above); the schedule will still display.
