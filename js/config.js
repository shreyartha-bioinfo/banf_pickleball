// Paste the Google Apps Script Web App URL here after deploying (see README.md).
// Example: "https://script.google.com/macros/s/AKfycb.../exec"
const CONFIG = {
  SHEET_API_URL: "https://script.google.com/macros/s/AKfycbzNJ6fyxFdly5EApU-ug4kUMA0J5Zku8BLu09V5kOGEB-WynZB7TkBMUwqt_bwCgCWX/exec",
  // Games 1 & 2 lock at first serve; later pairs lock as prior results land.
  // Must match PREDICTOR_START in apps-script/Code.gs. -04:00 = US Eastern in July.
  PREDICTOR_START: "2026-07-12T09:30:00-04:00",
  // Betting closes at noon. Must match BETTING_DEADLINE in apps-script/Code.gs.
  BETTING_DEADLINE: "2026-07-12T12:00:00-04:00"
};
