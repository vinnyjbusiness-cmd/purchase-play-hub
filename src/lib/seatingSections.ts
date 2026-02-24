// Venue-specific seating configurations
// Each venue has its own sections and blocks

export interface VenueSection {
  label: string;
  blocks: string[];
}

export interface VenueConfig {
  value: string;
  label: string;
  sections: {
    GA: VenueSection[];
    HOSPO: string[];
  };
}

export const VENUES: VenueConfig[] = [
  {
    value: "liverpool",
    label: "Liverpool (Anfield)",
    sections: {
      GA: [
        { label: "Anfield Road Upper", blocks: ["AU1", "AU2", "AU3", "AU4", "AU5", "AU6", "AU7", "AU8"] },
        { label: "Anfield Road Lower", blocks: ["AL1", "AL2", "AL3", "AL4", "AL5", "AL6", "AL7", "AL8"] },
        { label: "The Kop", blocks: ["KP1", "KP2", "KP3", "KP4", "KP5", "KP6", "KP7", "KP8", "KP9"] },
        { label: "Longside Upper", blocks: ["LU1", "LU2", "LU3", "LU4", "LU5", "LU6", "LU7", "LU8"] },
        { label: "Longside Lower", blocks: ["LL1", "LL2", "LL3", "LL4", "LL5", "LL6", "LL7", "LL8"] },
        { label: "Main Stand Lower Tier", blocks: ["ML1", "ML2", "ML3", "ML4", "ML5", "ML6", "ML7", "ML8"] },
        { label: "Main Stand Upper Tier", blocks: ["MU1", "MU2", "MU3", "MU4", "MU5", "MU6", "MU7", "MU8"] },
        { label: "Kenny Dalglish Stand Lower Tier", blocks: ["KDL1", "KDL2", "KDL3", "KDL4", "KDL5", "KDL6", "KDL7", "KDL8"] },
        { label: "Kenny Dalglish Upper Tier", blocks: ["KDU1", "KDU2", "KDU3", "KDU4", "KDU5", "KDU6", "KDU7", "KDU8"] },
        { label: "Away Section", blocks: ["AW1", "AW2", "AW3", "AW4"] },
      ],
      HOSPO: [
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
      ],
    },
  },
  {
    value: "arsenal",
    label: "Arsenal (Emirates)",
    sections: {
      GA: [
        { label: "North Bank Upper", blocks: ["NB1", "NB2", "NB3", "NB4", "NB5", "NB6", "NB7", "NB8", "NB9", "NB10"] },
        { label: "North Bank Lower", blocks: ["NBL1", "NBL2", "NBL3", "NBL4", "NBL5", "NBL6", "NBL7", "NBL8", "NBL9", "NBL10"] },
        { label: "Clock End Upper", blocks: ["CE1", "CE2", "CE3", "CE4", "CE5", "CE6", "CE7", "CE8"] },
        { label: "Clock End Lower", blocks: ["CEL1", "CEL2", "CEL3", "CEL4", "CEL5", "CEL6", "CEL7", "CEL8"] },
        { label: "East Stand Upper", blocks: ["EU1", "EU2", "EU3", "EU4", "EU5", "EU6", "EU7", "EU8", "EU9", "EU10"] },
        { label: "East Stand Lower", blocks: ["EL1", "EL2", "EL3", "EL4", "EL5", "EL6", "EL7", "EL8", "EL9", "EL10"] },
        { label: "West Stand Upper", blocks: ["WU1", "WU2", "WU3", "WU4", "WU5", "WU6", "WU7", "WU8", "WU9", "WU10"] },
        { label: "West Stand Lower", blocks: ["WL1", "WL2", "WL3", "WL4", "WL5", "WL6", "WL7", "WL8", "WL9", "WL10"] },
      ],
      HOSPO: [
        "Club Level",
        "Diamond Club",
        "Woolwich Restaurant",
        "Box Seats",
        "The Armoury Lounge",
        "Champions Bar",
        "Legends Suite",
      ],
    },
  },
  {
    value: "manchester-united",
    label: "Manchester United (Old Trafford)",
    sections: {
      GA: [
        { label: "Sir Alex Ferguson Stand Upper", blocks: ["SAF-U1", "SAF-U2", "SAF-U3", "SAF-U4", "SAF-U5", "SAF-U6"] },
        { label: "Sir Alex Ferguson Stand Lower", blocks: ["SAF-L1", "SAF-L2", "SAF-L3", "SAF-L4", "SAF-L5", "SAF-L6"] },
        { label: "Stretford End Upper", blocks: ["SE-U1", "SE-U2", "SE-U3", "SE-U4", "SE-U5", "SE-U6"] },
        { label: "Stretford End Lower", blocks: ["SE-L1", "SE-L2", "SE-L3", "SE-L4", "SE-L5", "SE-L6"] },
        { label: "East Stand Upper", blocks: ["E-U1", "E-U2", "E-U3", "E-U4", "E-U5", "E-U6"] },
        { label: "East Stand Lower", blocks: ["E-L1", "E-L2", "E-L3", "E-L4", "E-L5", "E-L6"] },
        { label: "Sir Bobby Charlton Stand Upper", blocks: ["SBC-U1", "SBC-U2", "SBC-U3", "SBC-U4", "SBC-U5", "SBC-U6"] },
        { label: "Sir Bobby Charlton Stand Lower", blocks: ["SBC-L1", "SBC-L2", "SBC-L3", "SBC-L4", "SBC-L5", "SBC-L6"] },
      ],
      HOSPO: [
        "Red Cafe",
        "Club Neville",
        "Treble Suite",
        "Executive Boxes",
        "Champions Club",
        "Legends Lounge",
      ],
    },
  },
  {
    value: "world-cup",
    label: "World Cup 2026",
    sections: {
      GA: [
        { label: "Category 1", blocks: ["Block A", "Block B", "Block C", "Block D", "Block E", "Block F"] },
        { label: "Category 2", blocks: ["Block A", "Block B", "Block C", "Block D", "Block E", "Block F"] },
        { label: "Category 3", blocks: ["Block A", "Block B", "Block C", "Block D", "Block E", "Block F"] },
        { label: "Category 4", blocks: ["Block A", "Block B", "Block C", "Block D", "Block E", "Block F"] },
      ],
      HOSPO: [
        "VIP Lounge",
        "FIFA Hospitality Suite",
        "Premium Pavilion",
        "Executive Club",
        "Skybox",
      ],
    },
  },
];

// Helper to get venue by value
export const getVenue = (value: string) => VENUES.find(v => v.value === value);

// Backward-compatible exports used by AddOrderDialog, AddPurchaseDialog, etc.
const liverpoolVenue = VENUES.find(v => v.value === "liverpool")!;
export const STANDARD_SECTIONS = liverpoolVenue.sections.GA;
export const HOSPITALITY_OPTIONS = liverpoolVenue.sections.HOSPO;
export const CLUBS = VENUES.map(v => ({ value: v.value, label: v.label }));
