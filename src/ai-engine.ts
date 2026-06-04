// ============================================================
// PROMPT BATTLE — Heuristic AI Engine · v0.1
// ============================================================
// A rule-based AI that scores every legal action and picks the
// best one. No ML/LLM required — runs entirely in the browser.
//
// Architecture:
//   GameState  → ActionGenerator → ActionScorer → ActionPicker
//
// To integrate:
//   import { AIPlayer } from './ai-engine';
//   const ai = new AIPlayer('hard');
//   const action = ai.chooseAction(gameState);
//   applyAction(gameState, action);
// ============================================================

import type { Card, Ability } from './types';

// ─────────────────────────────────────────────────────────────
// Game State types
// (These live here for now; merge with your main types later)
// ─────────────────────────────────────────────────────────────

export interface Creation {
  id:         string;          // unique instance id
  cardId:     string;          // source card id
  quality:    number;
  visibility: number;
  glitchTokens: number;
  runtimeLeft: number;         // 0 = on field; >0 = in queue
  clipLocked:  boolean;
  turnsOnField: number;
  featuredBurstUsed: boolean;
}

export interface CreatorState {
  cardId:      string;
  loyalty:     number;
  maxLoyalty:  number;
  reputation:  number;
  isExhausted: boolean;        // used ability this turn
}

export interface ModelInPlay {
  cardId:       string;
  activatedThisTurn: boolean;
  activatedThisRound: number; // how many times this round (tracks contention)
  modifiers:    string[];     // attached modifier card ids
}

export interface PlayerState {
  id:           'human' | 'ai';
  creator:      CreatorState;
  hand:         Card[];
  deck:         Card[];
  discard:      Card[];
  credits:      number;
  creditCap:    number;
  creations:    Creation[];   // slots 0-2 (field only, runtime=0)
  queue:        Creation[];   // runtime > 0
  modifiersOnCreator: string[];
  turnNumber:   number;
}

export interface GameState {
  human:        PlayerState;
  ai:           PlayerState;
  sharedModels: ModelInPlay[];
  artifactZone: string[];     // artifact card ids
  turnOwner:    'human' | 'ai';
  roundNumber:  number;
  gameLog:      string[];
}

// ─────────────────────────────────────────────────────────────
// Action types
// ─────────────────────────────────────────────────────────────

export type ActionType =
  | 'PLAY_MODEL'
  | 'ACTIVATE_MODEL'
  | 'PLAY_MODIFIER'
  | 'PLAY_ARTIFACT'
  | 'PLAY_EVENT'
  | 'USE_CREATOR_ABILITY'
  | 'END_TURN';

export interface Action {
  type:        ActionType;
  cardId?:     string;     // card being played
  targetId?:   string;     // target (model id, creation id, creator id)
  promptIds?:  string[];   // up to 2 prompt cards for ACTIVATE_MODEL
  abilityNum?: number | 'signature';
}

// ─────────────────────────────────────────────────────────────
// Difficulty presets
// ─────────────────────────────────────────────────────────────

export type Difficulty = 'easy' | 'medium' | 'hard';

interface DifficultyConfig {
  randomBlunder:  number;   // 0–1 chance of picking a random action instead of best
  lookahead:      number;   // depth (0 = greedy, 1 = one-step lookahead)
  aggressiveness: number;   // 0–1; higher = prefers attacking opponent over building
  abilityUseRate: number;   // 0–1; chance to consider abilities even when sub-optimal
}

const DIFFICULTY: Record<Difficulty, DifficultyConfig> = {
  easy:   { randomBlunder: 0.35, lookahead: 0, aggressiveness: 0.3, abilityUseRate: 0.4 },
  medium: { randomBlunder: 0.12, lookahead: 0, aggressiveness: 0.55, abilityUseRate: 0.7 },
  hard:   { randomBlunder: 0.02, lookahead: 1, aggressiveness: 0.7,  abilityUseRate: 0.95 },
};

// ─────────────────────────────────────────────────────────────
// Scoring weights (tweak to adjust AI playstyle)
// ─────────────────────────────────────────────────────────────

const W = {
  // Per point of loyalty damage dealt to opponent
  LOYALTY_DAMAGE:     12,
  // Per reputation gained this turn
  REP_GAIN:            3,
  // Per quality on a generated creation
  CREATION_QUALITY:    5,
  // Bonus for filling an empty creation slot
  SLOT_FILLED:         4,
  // Penalty for passing turn with no creations and empty queue
  CREATOR_STRESS:    -10,
  // Bonus per visibility counter on AI creations (projected gain)
  VISIBILITY:          1,
  // Bonus for having more creations than opponent
  FIELD_ADVANTAGE:     6,
  // Penalty for spending credits beyond a comfort threshold
  CREDIT_OVERSPEND:   -2,
  // Bonus for Featured burst threshold proximity
  FEATURED_BURST:      8,
  // Penalty per glitch token on generated creation
  GLITCH_PER_TOKEN:   -3,
  // Bonus for removing a high-visibility opponent creation
  REMOVE_OPPONENT:    10,
  // Bonus for using a signature ability (high-impact)
  SIGNATURE_BONUS:    15,
};

// ─────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────

/** Reputation bracket for a creation */
function repPerTurn(vis: number, quality: number): number {
  let base = 0;
  if (vis >= 10) base = 3;
  else if (vis >= 6) base = 2;
  else if (vis >= 3) base = 1;

  if (quality === 1) base = Math.max(0, base - 1);
  else if (quality === 4) base += 1;
  else if (quality >= 5) base += 2;

  return base;
}

/** How many creations are currently on field */
function fieldCount(player: PlayerState): number {
  return player.creations.filter(c => c.runtimeLeft === 0).length;
}

/** Can the AI afford a card? */
function canAffordCredit(ai: PlayerState, cost: number): boolean {
  return ai.credits >= cost;
}

function canAffordAbility(
  ai: PlayerState,
  ab: Ability
): boolean {
  const repCost = ab.cost.reputation ?? 0;
  const loyCost = ab.cost.loyalty ?? 0;
  return ai.creator.reputation >= repCost
    && ai.creator.loyalty >= loyCost
    && !ai.creator.isExhausted;
}

// ─────────────────────────────────────────────────────────────
// Legal action generator
// ─────────────────────────────────────────────────────────────

function getLegalActions(state: GameState, allCards: Card[]): Action[] {
  const ai        = state.ai;
  const actions:  Action[] = [];
  const cardMap   = new Map(allCards.map(c => [c.id, c]));
  const isRound2  = state.roundNumber >= 2;

  // ── Always legal: end turn ──────────────────────────────────
  actions.push({ type: 'END_TURN' });

  // ── Play a model from hand ──────────────────────────────────
  for (const card of ai.hand) {
    if (card.type === 'model') {
      const cost = card.playCost ?? 0;
      if (canAffordCredit(ai, cost)) {
        actions.push({ type: 'PLAY_MODEL', cardId: card.id });
      }
    }
  }

  // ── Activate a model in shared zone ────────────────────────
  const availableSlots = 3 - fieldCount(ai) - ai.queue.length;
  if (availableSlots > 0) {
    for (const model of state.sharedModels) {
      if (model.activatedThisTurn) continue;
      // Only both players from round 2; round 1 only activating player
      if (!isRound2 && model.activatedThisRound > 0) continue;

      const modelCard = cardMap.get(model.cardId);
      if (!modelCard) continue;
      const activateCost = modelCard.activateCost ?? 0;

      if (!canAffordCredit(ai, activateCost)) continue;

      // Base activation (no prompts)
      actions.push({ type: 'ACTIVATE_MODEL', cardId: model.cardId });

      // With one prompt
      const prompts1 = ai.hand.filter(c =>
        c.type === 'prompt' && canAffordCredit(ai, activateCost + (c.cost ?? 0))
      );
      for (const p of prompts1) {
        actions.push({ type: 'ACTIVATE_MODEL', cardId: model.cardId, promptIds: [p.id] });

        // With two prompts (different subtypes)
        const prompts2 = ai.hand.filter(c =>
          c.type === 'prompt'
          && c.id !== p.id
          && c.subtype !== p.subtype
          && canAffordCredit(ai, activateCost + (p.cost ?? 0) + (c.cost ?? 0))
        );
        for (const p2 of prompts2) {
          actions.push({
            type: 'ACTIVATE_MODEL',
            cardId: model.cardId,
            promptIds: [p.id, p2.id],
          });
        }
      }
    }
  }

  // ── Play a modifier ─────────────────────────────────────────
  for (const card of ai.hand) {
    if (card.type === 'modifier' && canAffordCredit(ai, card.cost ?? 0)) {
      // Simplified: attach to own creator
      actions.push({ type: 'PLAY_MODIFIER', cardId: card.id, targetId: 'ai_creator' });
      // Or to own creations
      for (const c of ai.creations) {
        actions.push({ type: 'PLAY_MODIFIER', cardId: card.id, targetId: c.id });
      }
    }
  }

  // ── Play an artifact ────────────────────────────────────────
  for (const card of ai.hand) {
    if (card.type === 'artifact' && canAffordCredit(ai, card.cost ?? 0)) {
      actions.push({ type: 'PLAY_ARTIFACT', cardId: card.id });
    }
  }

  // ── Play an event ────────────────────────────────────────────
  for (const card of ai.hand) {
    if (card.type === 'event' && canAffordCredit(ai, card.cost ?? 0)) {
      actions.push({ type: 'PLAY_EVENT', cardId: card.id });
    }
  }

  // ── Use creator ability ──────────────────────────────────────
  if (!ai.creator.isExhausted) {
    const creatorCard = cardMap.get(ai.creator.cardId);
    if (creatorCard?.abilities) {
      for (const ab of creatorCard.abilities) {
        if (canAffordAbility(ai, ab)) {
          actions.push({ type: 'USE_CREATOR_ABILITY', abilityNum: ab.num });
        }
      }
    }
  }

  return actions;
}

// ─────────────────────────────────────────────────────────────
// Action scorer
// ─────────────────────────────────────────────────────────────

function scoreAction(
  action: Action,
  state:  GameState,
  allCards: Card[],
  config: DifficultyConfig
): number {
  const ai     = state.ai;
  const human  = state.human;
  const cardMap = new Map(allCards.map(c => [c.id, c]));
  let score    = 0;

  switch (action.type) {

    case 'END_TURN': {
      // Penalty if we'd take creator stress
      const wouldStress = fieldCount(ai) === 0 && ai.queue.length === 0;
      if (wouldStress) score += W.CREATOR_STRESS;
      // Small positive for ending if we've done a lot already
      score += ai.credits < 3 ? 2 : 0;
      break;
    }

    case 'PLAY_MODEL': {
      const card = cardMap.get(action.cardId!);
      if (!card) break;
      // Playing a model enables future activations — value it as future investment
      score += 4;
      // If it's cheap, even better
      score += Math.max(0, 3 - (card.playCost ?? 0));
      // Penalise if we already have 3 models in shared zone
      if (state.sharedModels.length >= 3) score -= 6;
      break;
    }

    case 'ACTIVATE_MODEL': {
      const modelCard  = cardMap.get(action.cardId!);
      if (!modelCard) break;

      let projectedQuality  = modelCard.quality ?? 1;
      let projectedGlitch   = 0;
      let projectedVisBonus = 0;

      // Check model effect keywords
      const effect = (modelCard.effect ?? '').toLowerCase();
      if (effect.includes('glitch token')) projectedGlitch += 1;
      if (effect.includes('bonus visibility')) projectedVisBonus += 1;

      // Factor in prompts
      for (const pid of (action.promptIds ?? [])) {
        const p = cardMap.get(pid);
        if (!p) continue;
        const pe = (p.effect ?? '').toLowerCase();
        if (pe.includes('+1 quality')) projectedQuality += 1;
        if (pe.includes('+2 quality') || pe.includes('+3 quality')) projectedQuality += parseInt(pe.match(/\+(\d) quality/)?.[1] ?? '0');
        if (pe.includes('glitch token')) projectedGlitch += 1;
        if (pe.includes('visibility counter')) projectedVisBonus += parseInt(pe.match(/(\d) bonus vis/)?.[1] ?? '1');
      }

      // Quality 0 = instant destroy, avoid
      if (projectedQuality <= 0) { score -= 20; break; }

      score += projectedQuality * W.CREATION_QUALITY;
      score += projectedGlitch  * W.GLITCH_PER_TOKEN;
      score += projectedVisBonus * W.VISIBILITY;
      score += W.SLOT_FILLED;

      // Bonus if we currently have fewer creations than opponent
      if (fieldCount(ai) < fieldCount(human)) score += W.FIELD_ADVANTAGE;

      // Projected rep
      const projectedRep = repPerTurn(projectedVisBonus + 1, projectedQuality);
      score += projectedRep * W.REP_GAIN;

      break;
    }

    case 'PLAY_MODIFIER': {
      const card = cardMap.get(action.cardId!);
      if (!card) break;
      score += 5;
      // The Astronaut is very powerful
      if (card.id === 'MO-001') score += 15;
      break;
    }

    case 'PLAY_ARTIFACT': {
      score += 6;
      break;
    }

    case 'PLAY_EVENT': {
      const card = cardMap.get(action.cardId!);
      if (!card) break;
      score += 5;
      // If the effect targets opponent loyalty, bonus by aggressiveness
      const e = (card.effect ?? '').toLowerCase();
      if (e.includes('loyalty')) score += Math.round(8 * config.aggressiveness);
      break;
    }

    case 'USE_CREATOR_ABILITY': {
      const creatorCard = cardMap.get(ai.creator.cardId);
      if (!creatorCard?.abilities) break;
      const ab = creatorCard.abilities.find(a => a.num === action.abilityNum);
      if (!ab) break;

      const text = ab.text.toLowerCase();

      // Signature ability = high impact by definition
      if (action.abilityNum === 'signature') {
        score += W.SIGNATURE_BONUS;
      }

      // If ability deals loyalty damage to opponent
      if (text.includes('loyalty damage') || text.includes('loses') && text.includes('loyalty')) {
        score += W.LOYALTY_DAMAGE * config.aggressiveness;
      }

      // If ability removes/destroys opponent creations
      if (text.includes('quality 0') || text.includes('destroyed')) {
        const highValueTargets = human.creations.filter(c => c.visibility >= 6).length;
        score += highValueTargets * W.REMOVE_OPPONENT;
      }

      // Defensive / visibility abilities
      if (text.includes('visibility counter')) {
        const ownCreations = fieldCount(ai);
        score += ownCreations * W.VISIBILITY * 2;
      }

      // Loyalty gain
      if (text.includes('gain') && text.includes('loyalty')) {
        score += 6;
      }

      // Penalise if not aggressive enough in config
      if (action.abilityNum !== 'signature') {
        score *= config.abilityUseRate;
      }

      break;
    }
  }

  return score;
}

// ─────────────────────────────────────────────────────────────
// Main AI class
// ─────────────────────────────────────────────────────────────

export class AIPlayer {
  private config: DifficultyConfig;

  constructor(public difficulty: Difficulty = 'medium') {
    this.config = DIFFICULTY[difficulty];
  }

  /**
   * Given the current game state, returns a single action for the AI to take.
   * Call this in a loop until it returns END_TURN.
   */
  chooseAction(state: GameState, allCards: Card[]): Action {
    const legal = getLegalActions(state, allCards);

    // Random blunder: occasionally pick a random legal action
    if (Math.random() < this.config.randomBlunder) {
      return legal[Math.floor(Math.random() * legal.length)];
    }

    // Score every legal action
    const scored = legal.map(action => ({
      action,
      score: scoreAction(action, state, allCards, this.config),
    }));

    // Sort descending
    scored.sort((a, b) => b.score - a.score);

    // Greedy: pick the best scoring action
    // (lookahead would recurse here — skipping for v0.1 performance)
    return scored[0].action;
  }

  /**
   * Runs a full AI turn: returns an ordered list of actions the AI will take.
   * Call each action's effect in sequence (pass updated state each time).
   */
  planFullTurn(state: GameState, allCards: Card[]): Action[] {
    const plan: Action[] = [];
    // Clone state shallowly to simulate without mutating
    let sim = { ...state };

    for (let step = 0; step < 10; step++) { // safety cap
      const action = this.chooseAction(sim, allCards);
      plan.push(action);
      if (action.type === 'END_TURN') break;

      // Minimal state mutation for simulation
      sim = simulateAction(sim, action, allCards);
    }

    return plan;
  }
}

// ─────────────────────────────────────────────────────────────
// Lightweight simulation (for lookahead / planFullTurn)
// ─────────────────────────────────────────────────────────────

function simulateAction(
  state: GameState,
  action: Action,
  allCards: Card[]
): GameState {
  const cardMap = new Map(allCards.map(c => [c.id, c]));
  // Deep clone enough to avoid mutation bugs
  const s: GameState = {
    ...state,
    ai: {
      ...state.ai,
      credits:   state.ai.credits,
      hand:      [...state.ai.hand],
      creations: [...state.ai.creations],
      queue:     [...state.ai.queue],
      creator:   { ...state.ai.creator },
    },
  };
  const ai = s.ai;

  switch (action.type) {
    case 'PLAY_MODEL': {
      const card = cardMap.get(action.cardId!);
      if (card) {
        ai.credits -= (card.playCost ?? 0);
        ai.hand = ai.hand.filter(c => c.id !== action.cardId);
        s.sharedModels = [
          ...s.sharedModels,
          { cardId: card.id, activatedThisTurn: false, activatedThisRound: 0, modifiers: [] },
        ];
      }
      break;
    }
    case 'ACTIVATE_MODEL': {
      const modelCard = cardMap.get(action.cardId!);
      if (!modelCard) break;
      let totalCost = modelCard.activateCost ?? 0;
      for (const pid of (action.promptIds ?? [])) {
        totalCost += cardMap.get(pid)?.cost ?? 0;
      }
      ai.credits -= totalCost;
      // Remove prompts from hand
      ai.hand = ai.hand.filter(c => !(action.promptIds ?? []).includes(c.id));
      // Mark model activated
      s.sharedModels = s.sharedModels.map(m =>
        m.cardId === action.cardId
          ? { ...m, activatedThisTurn: true, activatedThisRound: m.activatedThisRound + 1 }
          : m
      );
      // Add creation to queue
      const newCreation: Creation = {
        id: `ai-cr-${Date.now()}-${Math.random()}`,
        cardId: action.cardId!,
        quality: modelCard.quality ?? 1,
        visibility: 0,
        glitchTokens: 0,
        runtimeLeft: modelCard.runtime ?? 1,
        clipLocked: false,
        turnsOnField: 0,
        featuredBurstUsed: false,
      };
      ai.queue = [...ai.queue, newCreation];
      break;
    }
    case 'USE_CREATOR_ABILITY': {
      const creatorCard = cardMap.get(ai.creator.cardId);
      const ab = creatorCard?.abilities?.find(a => a.num === action.abilityNum);
      if (ab) {
        ai.creator.reputation -= (ab.cost.reputation ?? 0);
        ai.creator.loyalty    -= (ab.cost.loyalty    ?? 0);
        ai.creator.isExhausted = true;
      }
      break;
    }
    default:
      break;
  }

  return s;
}

// ─────────────────────────────────────────────────────────────
// Export convenience factory
// ─────────────────────────────────────────────────────────────

export function createAI(difficulty: Difficulty = 'medium'): AIPlayer {
  return new AIPlayer(difficulty);
}

// ─────────────────────────────────────────────────────────────
// README for integration
// ─────────────────────────────────────────────────────────────
//
// HOW TO USE:
//
// 1. Import the AI and card data in your game controller:
//      import { createAI } from './ai-engine';
//      import { ALL_CARDS } from './data';
//
// 2. Create the AI instance (once per game):
//      const ai = createAI('medium'); // or 'easy' | 'hard'
//
// 3. On AI's turn, plan its full sequence of actions:
//      const plan = ai.planFullTurn(gameState, ALL_CARDS);
//
// 4. Execute each action one by one (with animation delay between):
//      for (const action of plan) {
//        await applyAction(gameState, action);      // your game logic
//        await delay(700);                          // visual breathing room
//      }
//
// 5. The AI respects ALL rules:
//      - One ability use per turn (isExhausted)
//      - Credit costs
//      - Reputation / Loyalty costs for abilities
//      - Creation slot limits
//      - Round 2 shared model rules
//
// EXTENDING THE AI:
//   - Add card-specific scoring overrides in scoreAction()
//   - Raise lookahead to 1 in DIFFICULTY.hard once game state
//     serialisation is stable (it's CPU-cheap at depth 1)
//   - Add a MONTE_CARLO flag later to switch to tree search
//
// ============================================================
