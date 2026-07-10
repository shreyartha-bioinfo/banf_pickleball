// BANF Sports Day 2026 — Men's Pickleball league schedule.
// team1 / team2 are arrays of two player names (doubles).
const GAMES = [
  { id: 1, court: "A", team1: ["Aayaan Roy", "Amit Chakrabarty"], team2: ["Partha Mukhopadhyay", "Dipra Ghosh"] },
  { id: 2, court: "B", team1: ["Bhupal Dhar", "Siddharth Das Sarkar"], team2: ["Atmadeep Mazumdar", "Nabo Roy"] },
  { id: 3, court: "A", team1: ["Suman Ghosh", "Madhu Sindhuvalli"], team2: ["Tarit Mondal", "Swayam Kundu"] },
  { id: 4, court: "B", team1: ["Saikat Natta", "Souvik Ray"], team2: ["Suvankar", "Aayaan Roy"] },
  { id: 5, court: "A", team1: ["Amit Chakrabarty", "Atmadeep Mazumdar"], team2: ["Suman Ghosh", "Nabo Roy"] },
  { id: 6, court: "B", team1: ["Partha Mukhopadhyay", "Siddharth Das Sarkar"], team2: ["Madhu Sindhuvalli", "Souvik Ray"] },
  { id: 7, court: "A", team1: ["Tarit Mondal", "Suvankar"], team2: ["Aayaan Roy", "Suman Ghosh"] },
  { id: 8, court: "B", team1: ["Swayam Kundu", "Dipra Ghosh"], team2: ["Saikat Natta", "Amit Chakrabarty"] },
  { id: 9, court: "A", team1: ["Nabo Roy", "Partha Mukhopadhyay"], team2: ["Siddharth Das Sarkar", "Suvankar"] },
  { id: 10, court: "B", team1: ["Swarnendu Sen", "Bhupal Dhar"], team2: ["Madhu Sindhuvalli", "Swayam Kundu"] },
  { id: 11, court: "A", team1: ["Swarnendu Sen", "Dipra Ghosh"], team2: ["Tarit Mondal", "Saikat Natta"] },
  { id: 12, court: "B", team1: ["Swarnendu Sen", "Souvik Ray"], team2: ["Atmadeep Mazumdar", "Bhupal Dhar"] }
];

// Finals shown on the "Other Categories" tab. Team names and scores come from
// the OtherCategories sheet tab (see apps-script/Code.gs — the two lists must
// stay in sync); until the organizer fills them in, the site shows
// "To be announced". Ids must stay unique.
const OTHER_MATCHES = [
  { id: "W-F", category: "Women's Pickleball", stage: "Final" },
  { id: "K13-F", category: "K13–17 Pickleball", stage: "Final" },
  { id: "K7-F", category: "K7–K12 Singles Pickleball", stage: "Final" }
];
