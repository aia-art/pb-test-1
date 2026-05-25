// ============================================================
// PROMPT BATTLE — Types · Set 001 First Render
// ============================================================

export type CardType     = 'creator' | 'model' | 'prompt' | 'modifier' | 'artifact' | 'event';
export type CardRarity   = 'common' | 'uncommon' | 'rare' | 'mythic';
export type StyleTag     = 'Fantasy' | 'Landscape' | 'Portrait' | 'Abstract' | 'Atmosphere';
export type CostType     = 'credits' | 'reputation';
export type TimingType   = 'instant' | 'main' | 'either';

// ── Ability / sub-objects ─────────────────────────────────────
export interface AbilityCost {
  loyalty?:    number;
  reputation?: number;
  credits?:    number;
}
export interface Ability {
  num:      number | 'signature';
  name:     string;
  cost:     AbilityCost;
  text:     string;
  keywords: string[];
  timing?:  TimingType;
}
export interface PassiveAbility {
  name:     string;
  text:     string;
  keywords: string[];
}
export interface FavouritePrompt {
  text:     string;
  subtype:  string;
  effect:   string;
}
export interface StartingBonus {
  type:    'credit' | 'reputation';
  amount:  number;
  display: string;
}

// ── Core Card interface ───────────────────────────────────────
export interface Card {
  id:       string;
  name:     string;
  type:     CardType;
  subtype?: string;
  rarity:   CardRarity;
  rarityDots: 1 | 2 | 3 | 5;

  // Art
  image:             string;
  illustration:      string;
  illustrationMood?: string;

  // Deck membership
  inDecks: { deckA: number; deckB: number };
  deckLimit?: number;

  // ── Creator-only ───────────────────────────────────────────
  factions?:     string[];
  loyalty?:      number;
  startingBonus?: StartingBonus;
  passive?:      PassiveAbility;
  influence?:    PassiveAbility;
  abilities?:    Ability[];
  favouritePrompt?: FavouritePrompt;
  creatorNotes?: string;

  // ── Model-only ─────────────────────────────────────────────
  playCost?:     number;
  activateCost?: number;
  quality?:      number;
  runtime?:      number;
  compatible?:   StyleTag[];
  incompatible?: StyleTag[];
  guaranteed?:   'deckA' | 'deckB';

  // ── Prompt-only ────────────────────────────────────────────
  cost?:         number;
  costType?:     CostType;
  keyword?:      string;
  promptType?:   string;
  compatibleModels?: string;

  // ── Modifier-only ──────────────────────────────────────────
  modifierType?: string;
  duration?:     string;
  attachesTo?:   string;

  // ── Artifact-only ──────────────────────────────────────────
  artifactType?: string;

  // ── Event-only ─────────────────────────────────────────────
  timing?:       TimingType;
  eventType?:    string;

  // ── Shared text ────────────────────────────────────────────
  effect?:       string;
  flavourText?:  string;
  designNote?:   string;
}

// ── Deck types ───────────────────────────────────────────────
export interface PrebuiltDeck {
  id:            string;
  name:          string;
  subtitle:      string;
  description:   string;
  creator:       string;
  guaranteedModels: string[];
  cards:         Record<string, number>;
  archetypes:    string[];
  difficulty:    'Beginner' | 'Intermediate' | 'Advanced';
}
export interface CustomDeck {
  id:              string;
  name:            string;
  description?:    string;
  createdAt:       string;
  creator:         string | null;
  guaranteedModels: string[];
  cards:           Record<string, number>;
}
export interface DecksStore {
  version: number;
  decks:   CustomDeck[];
}

// ── Game types ───────────────────────────────────────────────
export interface GameLog {
  id:        string;
  message:   string;
  timestamp: string;
  type:      'action' | 'system' | 'combat' | 'error';
}

// ── Vote types ───────────────────────────────────────────────
export interface VoteOption {
  label:        string;
  description:  string;
  image?:       string;
}
export interface VoteQuestion {
  id:      string;
  cardId:  string;
  question: string;
  optionA: VoteOption;
  optionB: VoteOption;
}
export interface VoteRecord {
  id:     string;
  cardId: string;
  chosen: string;
}

// ── Announcement types ───────────────────────────────────────
export interface Announcement {
  id:       string;
  date:     string;
  title:    string;
  author:   string;
  priority: 'normal' | 'urgent';
  body:     string;
}
export interface AnnouncementIndex {
  id:       string;
  date:     string;
  priority: 'normal' | 'urgent';
}
