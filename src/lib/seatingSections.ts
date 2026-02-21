// Liverpool Anfield seating sections and blocks

export const STANDARD_SECTIONS = [
  {
    label: "Anfield Road Upper",
    blocks: ["AU1", "AU2", "AU3", "AU4", "AU5", "AU6", "AU7", "AU8"],
  },
  {
    label: "Anfield Road Lower",
    blocks: ["AL1", "AL2", "AL3", "AL4", "AL5", "AL6", "AL7", "AL8"],
  },
  {
    label: "The Kop",
    blocks: ["KP1", "KP2", "KP3", "KP4", "KP5", "KP6", "KP7", "KP8", "KP9"],
  },
  {
    label: "Longside Upper",
    blocks: ["LU1", "LU2", "LU3", "LU4", "LU5", "LU6", "LU7", "LU8"],
  },
  {
    label: "Longside Lower",
    blocks: ["LL1", "LL2", "LL3", "LL4", "LL5", "LL6", "LL7", "LL8"],
  },
  {
    label: "Main Stand Lower Tier",
    blocks: ["ML1", "ML2", "ML3", "ML4", "ML5", "ML6", "ML7", "ML8"],
  },
  {
    label: "Main Stand Upper Tier",
    blocks: ["MU1", "MU2", "MU3", "MU4", "MU5", "MU6", "MU7", "MU8"],
  },
  {
    label: "Kenny Dalglish Stand Lower Tier",
    blocks: ["KDL1", "KDL2", "KDL3", "KDL4", "KDL5", "KDL6", "KDL7", "KDL8"],
  },
  {
    label: "Kenny Dalglish Upper Tier",
    blocks: ["KDU1", "KDU2", "KDU3", "KDU4", "KDU5", "KDU6", "KDU7", "KDU8"],
  },
  {
    label: "Away Section",
    blocks: ["AW1", "AW2", "AW3", "AW4"],
  },
] as const;

export const HOSPITALITY_OPTIONS = [
  "Longside Hospitality",
  "Premier Club Executive",
  "Main Stand Executive",
  "Anfield Road Middle Tier Hospitality",
  "Village Offsite Hospitality",
  "Centenary Club Hospitality",
  "The Sandon - Shortside Offsite Hospitality",
  "The Dugout Hospitality",
  "Beautiful Game Hospitality",
  "Chemistry Lounge Hospitality",
] as const;

export const CLUBS = [
  { value: "liverpool", label: "Liverpool" },
  { value: "arsenal", label: "Arsenal" },
  { value: "manchester-united", label: "Manchester United" },
  { value: "world-cup", label: "World Cup" },
] as const;
