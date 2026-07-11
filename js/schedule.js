// BANF Sports Day 2026 — Men's Pickleball schedule.
// team1 / team2 are arrays of two player names (doubles).
// Games run in pairs (Court A + Court B) every 20 minutes, first serve 9:30 AM.
// The 10:50 AM slot is the showcase break (see SHOWCASE_BREAK below); the
// men's league resumes at 11:10 AM.
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

// 20-minute showcase window after Game 8 — women's and kids' exhibition
// matches, all at the same time. Display-only: not part of the men's league
// standings, predictor, or betting.
const SHOWCASE_BREAK = {
  time: "10:50 AM",
  afterGameId: 8,
  note: "20-minute showcase after Game 8 — the men's league resumes at 11:10 AM.",
  matches: [
    { label: "Women's Doubles", team1: ["Lopita", "Tanima"], team2: ["Sreya", "Roopkatha"] },
    { label: "Kids 13–17 Doubles", tbd: "Team combinations to be decided" },
    { label: "Kids 7–13 Singles", team1: ["Oleen"], team2: ["Evaan"] }
  ]
};
