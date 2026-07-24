import { getOccupancyCategories } from "./ashrae-data";

/**
 * AI OCCUPANCY DETECTION ENGINE
 * Client-side token/keyword classifier that maps space names
 * to ASHRAE 62.1 occupancy categories with confidence scores.
 */

/**
 * Mapped lookup dictionary of phrases/synonyms for Stage 2
 */
const SYNONYM_DICTIONARY: Record<string, string> = {
  // Computer Lab synonyms
  "computer room": "Computer lab",
  "computer lab": "Computer lab",
  "it lab": "Computer lab",
  "ict lab": "Computer lab",
  "training lab": "Computer lab",

  // Conference / Meeting synonyms
  "meeting room": "Conference / meeting",
  "conference room": "Conference / meeting",
  "board room": "Conference / meeting",
  "boardroom": "Conference / meeting",
  "huddle room": "Conference / meeting",
  "huddle": "Conference / meeting",

  // Toilet synonyms
  "wc": "Rest Room / Changing Room",
  "toilet": "Rest Room / Changing Room",
  "restroom": "Rest Room / Changing Room",
  "washroom": "Rest Room / Changing Room",
  "water closet": "Rest Room / Changing Room",
  "lavatory": "Rest Room / Changing Room",
  "bathroom": "Rest Room / Changing Room",
  "powder room": "Rest Room / Changing Room",
  "powderroom": "Rest Room / Changing Room",

  // Server Room synonyms
  "server room": "Electrical equipment rooms",
  "data room": "Electrical equipment rooms",
  "data center": "Electrical equipment rooms",
  "data centre": "Electrical equipment rooms",
  "comms room": "Electrical equipment rooms",
  "it closet": "Electrical equipment rooms",

  // Office Space synonyms
  "office": "Office space",
  "desk": "Office space",
  "workstation": "Office space",
  "open plan": "Office space",
  "executive office": "Office space",
  "workspace": "Office space",

  // Bedroom / Living Room synonyms
  "bedroom": "Bedroom",
  "master bedroom": "Bedroom",
  "living room": "Living room",
  "living": "Living room",
  "bed room": "Bedroom",

  // Kitchen synonyms
  "kitchen": "Kitchen - Residential",

  // Commercial Kitchen synonyms
  "commercial kitchen": "Kitchen - Commercial",
  "cooking kitchen": "Kitchen - Commercial",
  "catering kitchen": "Kitchen - Commercial",

  // Locker room synonyms
  "locker room": "EX. Locker rooms",
  "locker rooms": "EX. Locker rooms",
  "locker": "EX. Locker rooms",
  "dressing room": "EX. Locker rooms",
  "dressing rooms": "EX. Locker rooms"
};

interface KeywordRule {
  keywords: string[];
  category: string;
  weight: number;
}

/**
 * Keyword → Category mapping matrix for Stage 3 Phrase Matching.
 */
const KEYWORD_RULES: KeywordRule[] = [
  // ── Bedroom / Living Room ────────────────────────────────────────────
  { keywords: ['bedroom', 'living room', 'living', 'bed room', 'bed'], category: 'Bedroom / living room', weight: 0.95 },

  // ── Offices ─────────────────────────────────────────────────────────
  { keywords: ['office', 'desk', 'workstation', 'open plan', 'workspace', 'open-plan', 'cowork'], category: 'Office space', weight: 0.92 },
  { keywords: ['private office', 'exec office', 'manager office'], category: 'Office space', weight: 0.95 },
  { keywords: ['telephone', 'call center', 'data entry', 'hotdesk'], category: 'Telephone / data entry', weight: 0.88 },

  // ── Meeting / Conference ─────────────────────────────────────────────
  { keywords: ['meeting', 'conference', 'boardroom', 'huddle', 'seminar', 'training room', 'breakout'], category: 'Conference / meeting', weight: 0.95 },

  // ── Corridors / Circulation ──────────────────────────────────────────
  { keywords: ['corridor', 'hallway', 'passage', 'walkway', 'gallery', 'aisle', 'circulation'], category: 'Corridors', weight: 0.95 },

  // ── Lobby / Reception ────────────────────────────────────────────────
  { keywords: ['lobby', 'foyer', 'atrium', 'entrance hall', 'welcome', 'entry hall'], category: 'Lobbies', weight: 0.93 },
  { keywords: ['reception', 'front desk', 'waiting', 'concierge'], category: 'Reception areas', weight: 0.93 },
  { keywords: ['main entry', 'main lobby', 'main entrance'], category: 'Main entry lobbies', weight: 0.95 },

  // ── Toilets / Restrooms ──────────────────────────────────────────────
  { keywords: ['toilet', 'washroom', 'restroom', 'wc', 'water closet', 'lavatory', 'bathroom', 'cloakroom', 'powder room', 'shower', 'changing room', 'change room'], category: 'Rest Room / Changing Room', weight: 0.97 },
  { keywords: ['locker', 'dressing'], category: 'EX. Locker rooms', weight: 0.93 },

  // ── Electrical / Mechanical ──────────────────────────────────────────
  { keywords: ['electrical room', 'elec room', 'mv room', 'lv room', 'switchroom', 'switchgear', 'transformer'], category: 'Electrical equipment rooms', weight: 0.93 },
  { keywords: ['mechanical', 'plant room', 'plant', 'ahu', 'ahu room', 'fan room', 'pump room'], category: 'Electrical equipment rooms', weight: 0.90 },
  { keywords: ['server', 'data center', 'data centre', 'ict room', 'comms room', 'network room', 'ups room', 'ups', 'it room', 'it closet'], category: 'Electrical equipment rooms', weight: 0.90 },
  { keywords: ['telephone closet', 'telecoms', 'patch room', 'dp room', 'mdf', 'idf'], category: 'Telephone closets', weight: 0.90 },

  // ── Kitchens / Food ──────────────────────────────────────────────────
  { keywords: ['kitchen', 'cooking', 'catering'], category: 'Kitchen (cooking) - commercial', weight: 0.92 },
  { keywords: ['kitchenette', 'pantry', 'tea point', 'break room', 'snack'], category: 'Kitchenettes', weight: 0.90 },
  { keywords: ['canteen', 'cafeteria', 'dining', 'restaurant', 'food court', 'mess'], category: 'Cafeteria / fast food dining', weight: 0.90 },

  // ── Storage ──────────────────────────────────────────────────────────
  { keywords: ['storage', 'store room', 'storeroom', 'store', 'archive', 'record room', 'filing'], category: 'Storage rooms', weight: 0.88 },
  { keywords: ['warehouse', 'goods'], category: 'Warehouses', weight: 0.90 },
  { keywords: ['janitor', 'cleaner', 'broom', 'utility closet', 'trash', 'refuse', 'bin room', 'recycling'], category: 'EX. Janitor closets, trash rooms, recycling', weight: 0.92 },
  { keywords: ['dry store', 'dry storage'], category: 'Occupiable storage rooms for dry materials', weight: 0.88 },

  // ── Health / Gym ─────────────────────────────────────────────────────
  { keywords: ['gym', 'gymnasium', 'fitness', 'exercise', 'aerobic', 'sports hall', 'sport hall'], category: 'Gym, sports arena (play area)', weight: 0.90 },
  { keywords: ['health club', 'weight room', 'weight training', 'cardio'], category: 'Health club / weight', weight: 0.88 },
  { keywords: ['swimming', 'pool', 'aquatic'], category: 'Swimming (pool & deck)', weight: 0.93 },

  // ── Classrooms / Education ───────────────────────────────────────────
  { keywords: ['classroom', 'class room', 'tutorial', 'teaching room'], category: 'Classrooms (age 9 plus)', weight: 0.92 },
  { keywords: ['lecture classroom'], category: 'Lecture classroom', weight: 0.92 },
  { keywords: ['lecture hall', 'lecture hall (fixed seats)', 'fixed seats'], category: 'Lecture hall (fixed seats)', weight: 0.95 },
  { keywords: ['lecture', 'auditorium'], category: 'Lecture classroom', weight: 0.90 },
  { keywords: ['science lab', 'laboratory', 'lab room', 'chem lab', 'bio lab'], category: 'Science laboratories', weight: 0.90 },
  { keywords: ['library'], category: 'Libraries', weight: 0.95 },
  { keywords: ['art', 'art room', 'art class', 'arts', 'craft', 'art classroom'], category: 'Art classroom', weight: 0.95 },

  // ── Assembly / Public ────────────────────────────────────────────────
  { keywords: ['assembly hall', 'assembly room', 'multipurpose', 'multi purpose', 'hall'], category: 'Multi-purpose assembly', weight: 0.85 },
  { keywords: ['theater', 'theatre', 'cinema', 'auditorium', 'screening'], category: 'Auditorium seating area', weight: 0.92 },
  { keywords: ['museum', 'gallery', 'exhibition'], category: 'Museums / galleries', weight: 0.90 },

  // ── Retail / Commercial ──────────────────────────────────────────────
  { keywords: ['retail', 'shop', 'store floor', 'showroom', 'display area', 'boutique'], category: 'Sales', weight: 0.88 },
  { keywords: ['supermarket', 'grocery'], category: 'Supermarket', weight: 0.93 },
  { keywords: ['mall', 'shopping centre', 'shopping center'], category: 'Mall common areas', weight: 0.88 },

  // ── Laundry ──────────────────────────────────────────────────────────
  { keywords: ['laundry', 'linen', 'laundrette'], category: 'Laundry rooms, central', weight: 0.90 },

  // ── Guard / Security ─────────────────────────────────────────────────
  { keywords: ['guard', 'security room', 'security post', 'guard post', 'security station'], category: 'Guard stations', weight: 0.90 },

  // ── Parking ──────────────────────────────────────────────────────────
  { keywords: ['parking', 'car park', 'garage', 'basement parking', 'multi-storey'], category: 'Ex. Parking garages', weight: 0.95 },

  // ── Shipping / Receiving ─────────────────────────────────────────────
  { keywords: ['loading', 'dispatch', 'shipping', 'receiving', 'loading bay', 'dock'], category: 'Shipping / receiving', weight: 0.88 },
];

/**
 * Normalize string: lowercase, replace separators, collapse spaces.
 */
function normalize(str: string): string {
  return (str || '').toLowerCase()
    .replace(/[_\-\/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Clean floor prefixes from space name.
 */
function cleanSpaceName(name: string): string {
  if (!name) return "";
  const cleaned = name.replace(/^([0-9]{1,3}|b[0-9]?|g|lg|ug|sf|rf|m|p)[f]?\s*[-:]\s*/i, '');
  return normalize(cleaned);
}

/**
 * Check if a keyword/phrase matches as a whole word in the text.
 */
function isWordMatch(text: string, phrase: string): boolean {
  const escaped = phrase.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp('(?:^|\\b)' + escaped + '(?:\\b|$)', 'i');
  return regex.test(text);
}

/**
 * Jaccard Similarity on word sets
 */
function getJaccardSimilarity(str1: string, str2: string): number {
  const set1 = new Set(str1.toLowerCase().split(/\s+/).filter(w => w.length > 1));
  const set2 = new Set(str2.toLowerCase().split(/\s+/).filter(w => w.length > 1));
  if (set1.size === 0 && set2.size === 0) return 1.0;
  if (set1.size === 0 || set2.size === 0) return 0.0;

  let intersection = 0;
  set1.forEach(item => {
    if (set2.has(item)) {
      intersection++;
    }
  });
  const union = set1.size + set2.size - intersection;
  return intersection / union;
}

/**
 * Levenshtein Distance for typo matching
 */
function getLevenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function getFuzzyScore(str1: string, str2: string): number {
  const dist = getLevenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1.0;
  return 1.0 - dist / maxLen;
}

/**
 * Save/Load learned rules
 */
export function getLearnedRules(): Record<string, string> {
  try {
    const saved = localStorage.getItem('mep_vent_ai_learned');
    return saved ? JSON.parse(saved) : {};
  } catch (e) {
    return {};
  }
}

export function saveAiLearnedRule(spaceName: string, category: string): void {
  if (!spaceName || !category) return;
  const cleaned = cleanSpaceName(spaceName);
  if (!cleaned) return;
  try {
    const rules = getLearnedRules();
    rules[cleaned] = category;
    localStorage.setItem('mep_vent_ai_learned', JSON.stringify(rules));
  } catch (e) {
    console.error("Failed to save learned rule", e);
  }
}

/**
 * Prediction Engine with strict Matching Stages
 */
export function predictOccupancyCategory(spaceName: string): { category: string; confidence: number } {
  if (!spaceName || spaceName.trim().length < 2) {
    return { category: '', confidence: 0 };
  }

  const cleaned = cleanSpaceName(spaceName);
  const categories = getOccupancyCategories();

  // ─────────────────────────────────────────────────────────────────
  // 0. Learned Rules Check
  // ─────────────────────────────────────────────────────────────────
  const learned = getLearnedRules();
  if (learned[cleaned]) {
    const exactDB = categories.find(c => c.toLowerCase() === learned[cleaned].toLowerCase());
    if (exactDB) {
      return { category: exactDB, confidence: 1.0 };
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // STAGE 1: Exact Match (Highest Priority)
  // ─────────────────────────────────────────────────────────────────
  const exactDB = categories.find(c => c.toLowerCase() === cleaned.toLowerCase());
  if (exactDB) {
    return { category: exactDB, confidence: 1.0 };
  }

  // ─────────────────────────────────────────────────────────────────
  // STAGE 2: Keyword/Synonym Dictionary Match
  // ─────────────────────────────────────────────────────────────────
  const dictMapped = SYNONYM_DICTIONARY[cleaned];
  if (dictMapped) {
    const exactDB = categories.find(c => c.toLowerCase() === dictMapped.toLowerCase());
    if (exactDB) {
      return { category: exactDB, confidence: 0.95 };
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // STAGE 3: Phrase / Multi-Word Priority Scoring
  // ─────────────────────────────────────────────────────────────────
  let bestScore = 0;
  let bestCategory: string | null = null;

  for (const rule of KEYWORD_RULES) {
    for (const kw of rule.keywords) {
      const kwClean = kw.toLowerCase().trim();

      if (isWordMatch(cleaned, kwClean)) {
        const kwWords = kwClean.split(' ').length;
        const inputWords = cleaned.split(' ').length;

        // Base score from rule weight
        let score = rule.weight;

        // Bonus for multi-word keyword phrases to prioritize over single words
        score += kwWords * 0.05;

        // Bonus if the keyword covers more of the input
        score += (kwWords / inputWords) * 0.05;

        // Extra bonus for perfect word matches of the input
        if (kwClean === cleaned) {
          score += 0.15;
        }

        if (score > bestScore) {
          bestScore = score;
          bestCategory = rule.category;
        }
      }
    }
  }

  // If a strong phrase match was found, return it
  if (bestCategory && bestScore >= 0.70) {
    const exactDB = categories.find(c => c.toLowerCase() === bestCategory!.toLowerCase());
    if (exactDB) {
      return { category: exactDB, confidence: Math.min(bestScore, 0.99) };
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // STAGE 4: Fuzzy Matching (Lowest Priority Fallback)
  // ─────────────────────────────────────────────────────────────────
  let bestFuzzyCat: string | null = null;
  let bestFuzzyScore = 0;

  for (const cat of categories) {
    const jaccard = getJaccardSimilarity(cleaned, cat);
    const lev = getFuzzyScore(cleaned, cat);
    const score = (jaccard + lev) / 2;

    if (score > bestFuzzyScore) {
      bestFuzzyScore = score;
      bestFuzzyCat = cat;
    }
  }

  // Fuzzy match must meet a minimal similarity threshold (50%)
  if (bestFuzzyCat && bestFuzzyScore >= 0.50) {
    // Penalize fuzzy match confidence slightly to represent lower confidence (e.g. 75% max)
    const confidence = Math.min(bestFuzzyScore * 0.75, 0.78);
    return { category: bestFuzzyCat, confidence: confidence };
  }

  return { category: '', confidence: 0 };
}

/**
 * Automatically predict pressure based on space name keywords
 */
export function predictSpacePressure(spaceName: string): { pressure: "Neutral" | "Positive" | "Negative" | "Critical"; autoDetected: boolean } {
  if (!spaceName) return { pressure: "Positive", autoDetected: false };
  const name = spaceName.toLowerCase().trim();

  // 1. Negative spaces (exhaust required / negative pressure to prevent odor/hazard spread)
  const negativeKeywords = [
    "garbage", "refuse", "trash",
    "bathroom", "toilet", "restroom", "washroom", "ablution", "wc",
    "janitor", "jan",
    "kitchen", "pantry",
    "art class", "art room",
    "changing", "locker",
    "shower",
    "storage", "store",
    "chemical", "waste"
  ];

  // 2. Positive spaces (fresh air supply / positive pressure to keep clean)
  const positiveKeywords = [
    "bedroom", "bed", "master bed", "maid",
    "corridor", "passage", "hallway",
    "living room", "living",
    "lobby", "foyer", "reception", "waiting",
    "classroom", "class room", "class",
    "library", "liabrary",
    "computer lab", "computer room", "labs",
    "dining", "cafe", "cafeteria",
    "prefunction", "pre-function",
    "entrance", "enterance",
    "office", "meeting", "conference"
  ];

  for (const kw of negativeKeywords) {
    if (name.includes(kw)) {
      return { pressure: "Negative", autoDetected: true };
    }
  }

  for (const kw of positiveKeywords) {
    if (name.includes(kw)) {
      return { pressure: "Positive", autoDetected: true };
    }
  }

  return { pressure: "Positive", autoDetected: false };
}
