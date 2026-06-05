// ============================================================
// PROMPT BATTLE — Heuristic AI Engine · v0.2
// Uses game-engine.ts types directly — no duplicate interfaces.
// ============================================================

import type { Card, Ability } from './types';
import type { GameState, PlayerState, Creation } from './game-engine';

// ─────────────────────────────────────────────────────────────
// Action types (internal to AI — mapped to GameAction by caller)
// ─────────────────────────────────────────────────────────────

export type ActionType =
  | 'PLAY_MODEL' | 'ACTIVATE_MODEL' | 'PLAY_MODIFIER'
  | 'PLAY_ARTIFACT' | 'PLAY_EVENT' | 'USE_CREATOR_ABILITY' | 'END_TURN';

export interface Action {
  type:        ActionType;
  cardId?:     string;
  targetId?:   string;
  promptIds?:  string[];
  abilityNum?: number | 'signature';
}

// ─────────────────────────────────────────────────────────────
// Difficulty
// ─────────────────────────────────────────────────────────────

export type Difficulty = 'easy' | 'medium' | 'hard';

interface DifficultyConfig {
  randomBlunder:  number;
  aggressiveness: number;
  abilityUseRate: number;
}

const DIFFICULTY: Record<Difficulty, DifficultyConfig> = {
  easy:   { randomBlunder: 0.40, aggressiveness: 0.3, abilityUseRate: 0.4 },
  medium: { randomBlunder: 0.12, aggressiveness: 0.55, abilityUseRate: 0.7 },
  hard:   { randomBlunder: 0.03, aggressiveness: 0.75, abilityUseRate: 0.95 },
};

// ─────────────────────────────────────────────────────────────
// Scoring weights
// ─────────────────────────────────────────────────────────────

const W = {
  LOYALTY_DAMAGE:    12,
  REP_GAIN:           3,
  CREATION_QUALITY:   5,
  SLOT_FILLED:        4,
  CREATOR_STRESS:   -10,
  VISIBILITY:         1,
  FIELD_ADVANTAGE:    6,
  GLITCH_PER_TOKEN:  -3,
  REMOVE_OPPONENT:   10,
  SIGNATURE_BONUS:   15,
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function repPerTurn(vis: number, quality: number): number {
  let base = 0;
  if (vis >= 10)     base = 3;
  else if (vis >= 6) base = 2;
  else if (vis >= 3) base = 1;
  if (quality === 1) base = Math.max(0, base - 1);
  if (quality === 4) base += 1;
  if (quality >= 5)  base += 2;
  return base;
}

function fieldCreations(player: PlayerState): Creation[] {
  return player.field.filter(c => c.runtimeLeft === 0);
}

function canAffordAbility(ai: PlayerState, ab: Ability): boolean {
  return ai.creator.reputation >= (ab.cost.reputation ?? 0)
      && ai.creator.loyalty    >= (ab.cost.loyalty    ?? 0)
      && !ai.creator.isExhausted;
}

// ─────────────────────────────────────────────────────────────
// Legal action generator
// ─────────────────────────────────────────────────────────────

function getLegalActions(state: GameState, cardMap: Map<string, Card>): Action[] {
  const ai      = state.ai;
  const actions: Action[] = [{ type: 'END_TURN' }];
  const isRound2 = state.round >= 2;

  // Play model
  for (const card of ai.hand) {
    if (card.type === 'model' && ai.credits >= (card.playCost ?? 0)) {
      actions.push({ type: 'PLAY_MODEL', cardId: card.id });
    }
  }

  // Activate model
  const queueSlots = 2 - ai.queue.length;
  const fieldSlots = 3 - fieldCreations(ai).length;
  const freeSlots  = Math.min(queueSlots, fieldSlots + queueSlots);

  if (freeSlots > 0) {
    for (const model of state.sharedModels) {
      if (model.activatedThisTurn) continue;
      if (!isRound2 && model.placedByPlayer !== 'ai') continue;

      const modelCard = cardMap.get(model.modelId);
      if (!modelCard) continue;
      const baseCost = modelCard.activateCost ?? 0;
      if (ai.credits < baseCost) continue;

      // No prompts
      actions.push({ type: 'ACTIVATE_MODEL', cardId: model.modelId, promptIds: [] });

      // With prompts
      const prompts = ai.hand.filter(c => c.type === 'prompt' && ai.credits >= baseCost + (c.cost ?? 0));
      for (const p of prompts) {
        actions.push({ type: 'ACTIVATE_MODEL', cardId: model.modelId, promptIds: [p.id] });
        const prompts2 = prompts.filter(c =>
          c.id !== p.id && c.subtype !== p.subtype
          && ai.credits >= baseCost + (p.cost ?? 0) + (c.cost ?? 0)
        );
        for (const p2 of prompts2) {
          actions.push({ type: 'ACTIVATE_MODEL', cardId: model.modelId, promptIds: [p.id, p2.id] });
        }
      }
    }
  }

  // Play modifier
  for (const card of ai.hand) {
    if (card.type === 'modifier' && ai.credits >= (card.cost ?? 0)) {
      actions.push({ type: 'PLAY_MODIFIER', cardId: card.id, targetId: 'creator' });
    }
  }

  // Play artifact
  for (const card of ai.hand) {
    if (card.type === 'artifact' && ai.credits >= (card.cost ?? 0)) {
      actions.push({ type: 'PLAY_ARTIFACT', cardId: card.id });
    }
  }

  // Play event (round 2+)
  if (isRound2) {
    for (const card of ai.hand) {
      if (card.type === 'event' && ai.credits >= (card.cost ?? 0)) {
        actions.push({ type: 'PLAY_EVENT', cardId: card.id });
      }
    }
  }

  // Use creator ability
  if (!state.abilityUsedThisTurn.includes('ai')) {
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

function scoreAction(action: Action, state: GameState, cardMap: Map<string, Card>, config: DifficultyConfig): number {
  const ai    = state.ai;
  const human = state.human;
  let score   = 0;

  switch (action.type) {

    case 'END_TURN': {
      const noCreations = fieldCreations(ai).length === 0 && ai.queue.length === 0;
      if (noCreations && state.round >= 2) score += W.CREATOR_STRESS;
      if (ai.credits < 3) score += 2;
      break;
    }

    case 'PLAY_MODEL': {
      const card = cardMap.get(action.cardId!);
      if (!card) break;
      score += 4;
      score += Math.max(0, 3 - (card.playCost ?? 0));
      if (state.sharedModels.length >= 3) score -= 5;
      break;
    }

    case 'ACTIVATE_MODEL': {
      const modelCard = cardMap.get(action.cardId!);
      if (!modelCard) break;
      let projQ     = modelCard.quality ?? 1;
      let projGlitch = 0;
      let projVis   = 0;
      const effect  = (modelCard.effect ?? '').toLowerCase();
      if (effect.includes('glitch token'))      projGlitch += 1;
      if (effect.includes('bonus visibility'))  projVis    += 1;

      for (const pid of (action.promptIds ?? [])) {
        const p = cardMap.get(pid);
        if (!p) continue;
        const pe = (p.effect ?? '').toLowerCase();
        const qm = pe.match(/\+(\d+) quality/);
        if (qm) projQ += parseInt(qm[1]);
        if (pe.includes('glitch token') && !pe.includes('remove')) projGlitch += 1;
        const vm = pe.match(/(\d+) bonus vis/);
        if (vm) projVis += parseInt(vm[1]);
      }

      if (projQ - projGlitch <= 0) { score -= 20; break; }

      score += (projQ - projGlitch) * W.CREATION_QUALITY;
      score += projGlitch * W.GLITCH_PER_TOKEN;
      score += projVis * W.VISIBILITY;
      score += W.SLOT_FILLED;
      if (fieldCreations(ai).length < fieldCreations(human).length) score += W.FIELD_ADVANTAGE;
      score += repPerTurn(projVis + 1, projQ) * W.REP_GAIN;
      break;
    }

    case 'PLAY_MODIFIER':
      score += 5;
      if (action.cardId === 'MO-001') score += 12;
      break;

    case 'PLAY_ARTIFACT':
      score += 6;
      break;

    case 'PLAY_EVENT': {
      const card = cardMap.get(action.cardId!);
      if (!card) break;
      score += 5;
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
      if (action.abilityNum === 'signature') score += W.SIGNATURE_BONUS;
      if (text.includes('loyalty')) score += W.LOYALTY_DAMAGE * config.aggressiveness;
      if (text.includes('quality 0') || text.includes('destroy')) {
        score += fieldCreations(human).filter(c => c.visibility >= 6).length * W.REMOVE_OPPONENT;
      }
      if (text.includes('visibility')) score += fieldCreations(ai).length * W.VISIBILITY * 2;
      score *= config.abilityUseRate;
      break;
    }
  }

  return score;
}

// ─────────────────────────────────────────────────────────────
// AIPlayer class
// ─────────────────────────────────────────────────────────────

export class AIPlayer {
  private config: DifficultyConfig;

  constructor(public difficulty: Difficulty = 'medium') {
    this.config = DIFFICULTY[difficulty];
  }

  chooseAction(state: GameState, allCards: Card[]): Action {
    const cardMap = new Map(allCards.map(c => [c.id, c]));
    const legal   = getLegalActions(state, cardMap);

    if (Math.random() < this.config.randomBlunder) {
      return legal[Math.floor(Math.random() * legal.length)];
    }

    const scored = legal
      .map(a => ({ action: a, score: scoreAction(a, state, cardMap, this.config) }))
      .sort((a, b) => b.score - a.score);

    return scored[0].action;
  }

  /** Returns ordered list of actions for a full AI turn. */
  planFullTurn(state: GameState, allCards: Card[]): Action[] {
    const plan: Action[] = [];
    // Greedy: keep picking best action until END_TURN
    // We don't mutate state here — we just score from current snapshot.
    // This is safe because each action reduces available resources.
    for (let step = 0; step < 12; step++) {
      const action = this.chooseAction(state, allCards);
      plan.push(action);
      if (action.type === 'END_TURN') break;

      // Optimistically reduce credits so we don't repeat unaffordable actions
      state = pessimisticallyUpdateState(state, action, allCards);
    }
    return plan;
  }
}

// ─────────────────────────────────────────────────────────────
// Lightweight state updater (for planFullTurn only)
// Just tracks credits/hand/exhausted so we don't loop forever.
// ─────────────────────────────────────────────────────────────

function pessimisticallyUpdateState(state: GameState, action: Action, allCards: Card[]): GameState {
  const cardMap = new Map(allCards.map(c => [c.id, c]));
  const ai = { ...state.ai, hand: [...state.ai.hand], queue: [...state.ai.queue] };

  switch (action.type) {
    case 'PLAY_MODEL': {
      const card = cardMap.get(action.cardId!);
      if (card) {
        ai.credits = ai.credits - (card.playCost ?? 0);
        ai.hand = ai.hand.filter(c => c.id !== action.cardId);
      }
      break;
    }
    case 'ACTIVATE_MODEL': {
      const modelCard = cardMap.get(action.cardId!);
      if (modelCard) {
        let cost = modelCard.activateCost ?? 0;
        for (const pid of (action.promptIds ?? [])) cost += cardMap.get(pid)?.cost ?? 0;
        ai.credits = ai.credits - cost;
        ai.hand = ai.hand.filter(c => !(action.promptIds ?? []).includes(c.id));
        // Add dummy creation to queue so slot logic works
        ai.queue = [...ai.queue, {
          instanceId: `sim-${Math.random()}`, sourceModelId: action.cardId!,
          quality: modelCard.quality ?? 1, glitchTokens: 0, visibility: 0,
          runtimeLeft: modelCard.runtime ?? 1, styleTag: null,
          clipLocked: false, turnsOnField: 0, featuredBurstUsed: false,
          immuneUntilTurn: 0, watermarkImmune: false, owner: 'ai',
        }];
      }
      break;
    }
    case 'USE_CREATOR_ABILITY': {
      const creatorCard = cardMap.get(ai.creator.cardId);
      const ab = creatorCard?.abilities?.find(a => a.num === action.abilityNum);
      if (ab) {
        ai.creator = {
          ...ai.creator,
          reputation: ai.creator.reputation - (ab.cost.reputation ?? 0),
          loyalty: ai.creator.loyalty - (ab.cost.loyalty ?? 0),
          isExhausted: true,
        };
      }
      break;
    }
    case 'PLAY_MODIFIER':
    case 'PLAY_ARTIFACT':
    case 'PLAY_EVENT': {
      const card = cardMap.get(action.cardId!);
      if (card) {
        ai.credits = ai.credits - (card.cost ?? 0);
        ai.hand = ai.hand.filter(c => c.id !== action.cardId);
      }
      break;
    }
  }

  return {
    ...state,
    ai,
    abilityUsedThisTurn: action.type === 'USE_CREATOR_ABILITY'
      ? [...state.abilityUsedThisTurn, 'ai']
      : state.abilityUsedThisTurn,
  };
}

export function createAI(difficulty: Difficulty = 'medium'): AIPlayer {
  return new AIPlayer(difficulty);
}
