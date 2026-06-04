// ============================================================
// PROMPT BATTLE — Game Engine · v0.1
// ============================================================
// Implements the full rules v0.14 as a pure state machine.
// No side-effects: every function takes state → returns new state.
// React UI just calls dispatch(action) and re-renders.
//
// Absolute Rules are enforced after every mutation.
// ============================================================

import type { Card, StyleTag } from './types';

// ─────────────────────────────────────────────────────────────
// Core state types
// ─────────────────────────────────────────────────────────────

export type PlayerId = 'human' | 'ai';

export interface Creation {
  instanceId:       string;        // unique per game
  sourceModelId:    string;        // which Model card generated it
  quality:          number;        // base quality (before glitch)
  glitchTokens:     number;
  visibility:       number;
  runtimeLeft:      number;        // 0 = on field
  styleTag:         StyleTag | null;
  clipLocked:       boolean;
  turnsOnField:     number;
  featuredBurstUsed: boolean;
  immuneUntilTurn:  number;        // turn # until which single-target immunity applies (from P-003)
  watermarkImmune:  boolean;
  owner:            PlayerId;
}

export interface AttachedModifier {
  cardId:    string;
  turnsLeft: number | 'permanent';
  target:    string;               // 'creator' | instanceId | modelId
}

export interface ModelInPlay {
  modelId:              string;
  placedByPlayer:       PlayerId;
  placedOnTurn:         number;
  activationsThisRound: number;    // for contention
  activatedThisTurn:    boolean;
  attachedLoras:        string[];  // modifier card ids
}

export interface CreatorState {
  cardId:      string;
  loyalty:     number;
  reputation:  number;
  isExhausted: boolean;            // used ability this turn
}

export interface PlayerState {
  id:          PlayerId;
  creator:     CreatorState;
  hand:        Card[];
  deck:        Card[];
  discard:     Card[];
  credits:     number;
  creditCap:   number;             // default 10
  field:       Creation[];         // runtime=0, max 3
  queue:       Creation[];         // runtime>0, max 2
  remixQueue:  Creation | null;    // max 1
  modifiers:   AttachedModifier[]; // on creator / own creations
}

export interface GameState {
  human:         PlayerState;
  ai:            PlayerState;
  sharedModels:  ModelInPlay[];
  artifactZone:  string[];         // artifact card ids in play
  turn:          number;           // global turn counter
  round:         number;
  activePlayer:  PlayerId;
  phase:         'refresh' | 'main' | 'end' | 'game_over';
  winner:        PlayerId | 'draw' | null;
  log:           LogEntry[];
  abilityUsedThisTurn: PlayerId[];
}

export interface LogEntry {
  id:      string;
  text:    string;
  type:    'action' | 'system' | 'combat' | 'error';
  turn:    number;
}

// ─────────────────────────────────────────────────────────────
// Action types (dispatched by UI or AI)
// ─────────────────────────────────────────────────────────────

export type GameAction =
  | { type: 'START_GAME';           humanDeck: Card[]; aiDeck: Card[]; humanCreatorId: string; aiCreatorId: string; firstPlayer: PlayerId }
  | { type: 'MULLIGAN';             player: PlayerId }
  | { type: 'BEGIN_MAIN_PHASE' }
  | { type: 'PLAY_MODEL';           player: PlayerId; cardId: string }
  | { type: 'ACTIVATE_MODEL';       player: PlayerId; modelId: string; promptIds: string[] }
  | { type: 'PLAY_MODIFIER';        player: PlayerId; cardId: string; targetId: string }
  | { type: 'PLAY_ARTIFACT';        player: PlayerId; cardId: string }
  | { type: 'PLAY_EVENT';           player: PlayerId; cardId: string }
  | { type: 'USE_CREATOR_ABILITY';  player: PlayerId; abilityNum: number | 'signature'; targetId?: string }
  | { type: 'APPLY_CLIP_LOCK';      player: PlayerId; creationId: string }
  | { type: 'SLOT_OVERFLOW_CHOICE'; player: PlayerId; destroyId: string | 'discard_incoming' }
  | { type: 'END_TURN';             player: PlayerId }
  | { type: 'CONCEDE';              player: PlayerId };

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

let _instanceCounter = 0;
function newInstanceId() { return `cr-${++_instanceCounter}-${Date.now()}`; }

let _logCounter = 0;
function log(state: GameState, text: string, type: LogEntry['type'] = 'system'): GameState {
  const entry: LogEntry = { id: `log-${++_logCounter}`, text, type, turn: state.turn };
  return { ...state, log: [entry, ...state.log].slice(0, 200) };
}

function player(state: GameState, id: PlayerId): PlayerState {
  return id === 'human' ? state.human : state.ai;
}

function opponent(state: GameState, id: PlayerId): PlayerState {
  return id === 'human' ? state.ai : state.human;
}

function setPlayer(state: GameState, id: PlayerId, p: PlayerState): GameState {
  return id === 'human' ? { ...state, human: p } : { ...state, ai: p };
}

function capRep(rep: number) { return Math.min(20, Math.max(0, rep)); }
function capLoy(loy: number) { return Math.max(0, loy); }
function capCred(cred: number, cap: number) { return Math.min(cap, Math.max(0, cred)); }

// Effective quality accounts for glitch tokens
function effectiveQuality(c: Creation): number {
  return c.quality - c.glitchTokens;
}

/** Rep per turn for a creation based on visibility and quality */
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

/** Absolute Rule check: destroy creations with effective quality ≤ 0 */
function enforceQualityRule(state: GameState): GameState {
  let s = state;
  for (const pid of ['human', 'ai'] as PlayerId[]) {
    const p = player(s, pid);
    const toDestroy = p.field.filter(c => effectiveQuality(c) <= 0);
    for (const c of toDestroy) {
      s = destroyCreation(s, pid, c.instanceId, 'quality 0');
    }
  }
  return s;
}

/** Absolute Rule: check loyalty ≤ 0 → game over */
function enforceLoyaltyRule(state: GameState): GameState {
  const h = state.human.creator.loyalty;
  const a = state.ai.creator.loyalty;
  if (h <= 0 && a <= 0) return { ...state, phase: 'game_over', winner: 'draw' };
  if (h <= 0) return { ...state, phase: 'game_over', winner: 'ai' };
  if (a <= 0) return { ...state, phase: 'game_over', winner: 'human' };
  return state;
}

function enforceAbsoluteRules(state: GameState): GameState {
  let s = enforceQualityRule(state);
  s = enforceLoyaltyRule(s);
  return s;
}

/** Deals loyalty damage to a creator */
function dealLoyaltyDamage(state: GameState, target: PlayerId, amount: number, reason: string): GameState {
  const p = player(state, target);
  const newLoy = capLoy(p.creator.loyalty - amount);
  let s = setPlayer(state, target, {
    ...p,
    creator: { ...p.creator, loyalty: newLoy },
  });
  s = log(s, `${target} creator takes ${amount} loyalty damage (${reason})`, 'combat');
  return enforceAbsoluteRules(s);
}

/** Destroys a creation and deals loyalty damage to its owner */
function destroyCreation(state: GameState, owner: PlayerId, instanceId: string, reason: string): GameState {
  const p = player(state, owner);
  const creation = p.field.find(c => c.instanceId === instanceId)
                || p.queue.find(c => c.instanceId === instanceId);
  if (!creation) return state;

  // Remove from field and queue
  const newField = p.field.filter(c => c.instanceId !== instanceId);
  const newQueue = p.queue.filter(c => c.instanceId !== instanceId);
  let s = setPlayer(state, owner, {
    ...p,
    field: newField,
    queue: newQueue,
    discard: [...p.discard], // creation itself doesn't go to discard
  });
  s = log(s, `${owner}'s creation destroyed (${reason})`, 'combat');
  // Absolute Rule 3: always 1 loyalty damage on destruction
  s = dealLoyaltyDamage(s, owner, 1, `creation destroyed`);
  return s;
}

// ─────────────────────────────────────────────────────────────
// Refresh Phase
// ─────────────────────────────────────────────────────────────

function runRefreshPhase(state: GameState, allCards: Map<string, Card>): GameState {
  const pid = state.activePlayer;
  let p  = player(state, pid);
  let s  = state;

  // Step 1: Gain 5 Credits + carryover (carryover applied from last end phase)
  const gained = Math.min(p.creditCap, p.credits + 5);
  p = { ...p, credits: gained };
  s = log(setPlayer(s, pid, p), `${pid} gains credits → ${gained}`, 'system');

  // Step 2: Reduce runtime on queued creations
  let newQueue = p.queue.map(c => ({ ...c, runtimeLeft: c.runtimeLeft - 1 }));

  // Step 3: Creations whose runtime reached 0 enter the field
  const entering = newQueue.filter(c => c.runtimeLeft <= 0);
  newQueue = newQueue.filter(c => c.runtimeLeft > 0);
  p = { ...p, queue: newQueue };
  s = setPlayer(s, pid, p);

  for (const creation of entering) {
    p = player(s, pid);
    if (p.field.length < 3) {
      const entered = { ...creation, runtimeLeft: 0 };
      p = { ...p, field: [...p.field, entered] };
      s = log(setPlayer(s, pid, p), `${pid}'s creation enters the field`, 'action');
    } else {
      // Slot overflow — for now auto-resolve by destroying oldest field creation
      // (In real game, player chooses — UI should intercept with SLOT_OVERFLOW_CHOICE)
      const oldest = p.field[0];
      s = destroyCreation(setPlayer(s, pid, p), pid, oldest.instanceId, 'slot overflow');
      p = player(s, pid);
      const entered = { ...creation, runtimeLeft: 0 };
      p = { ...p, field: [...p.field, entered] };
      s = setPlayer(s, pid, p);
      s = log(s, `Slot overflow: oldest creation destroyed`, 'system');
    }
  }

  // Step 4: Gain visibility on field creations
  p = player(s, pid);
  let newField = p.field.map(c => ({ ...c, visibility: c.visibility + 1, turnsOnField: c.turnsOnField + 1 }));

  // Step 5: Collect reputation
  let totalRep = 0;
  for (const c of newField) {
    const rep = repPerTurn(c.visibility, effectiveQuality(c));
    totalRep += rep;
    // Featured burst: first time hitting exactly 10 vis
    if (c.visibility >= 10 && !c.featuredBurstUsed) {
      totalRep += 5;
      s = log(s, `${pid} featured burst! +5 rep`, 'combat');
      newField = newField.map(fc => fc.instanceId === c.instanceId ? { ...fc, featuredBurstUsed: true } : fc);
    }
  }
  const newRep = capRep(p.creator.reputation + totalRep);
  p = { ...p, field: newField, creator: { ...p.creator, reputation: newRep } };
  s = setPlayer(s, pid, p);
  if (totalRep > 0) s = log(s, `${pid} gains ${totalRep} rep → ${newRep}`, 'system');

  // Step 6: Passives (handled by specific card effects — skipped in v0.1)

  // Step 7: Creator Stress (Turn 2+)
  p = player(s, pid);
  if (s.round >= 2) {
    if (p.field.length === 0 && p.queue.length === 0) {
      s = dealLoyaltyDamage(s, pid, 1, 'creator stress');
      s = log(s, `${pid} creator stress!`, 'combat');
    }
  }

  // Reset exhausted status and model activation flags
  p = player(s, pid);
  p = { ...p, creator: { ...p.creator, isExhausted: false } };
  s = setPlayer(s, pid, p);
  s = {
    ...s,
    sharedModels: s.sharedModels.map(m => ({ ...m, activatedThisTurn: false })),
    abilityUsedThisTurn: s.abilityUsedThisTurn.filter(x => x !== pid),
  };

  s = { ...s, phase: 'main' };
  s = log(s, `--- ${pid.toUpperCase()} MAIN PHASE (Turn ${s.turn}) ---`, 'system');
  return enforceAbsoluteRules(s);
}

// ─────────────────────────────────────────────────────────────
// End Phase
// ─────────────────────────────────────────────────────────────

function runEndPhase(state: GameState): GameState {
  const pid = state.activePlayer;
  let p  = player(state, pid);
  let s  = state;

  // Step 1: Until-end-of-turn effects expire (tracked externally for now)

  // Step 2: Credit carryover — floor(remaining / 2)
  const carryover = Math.floor(p.credits / 2);
  p = { ...p, credits: carryover };
  s = log(setPlayer(s, pid, p), `${pid} carries over ${carryover} credits`, 'system');

  // Step 3: Discard to hand limit of 7
  if (p.hand.length > 7) {
    // AI auto-discards worst cards; human needs UI — for now discard last cards
    const toDiscard = p.hand.slice(7);
    p = {
      ...p,
      hand: p.hand.slice(0, 7),
      discard: [...p.discard, ...toDiscard],
    };
    s = log(setPlayer(s, pid, p), `${pid} discards ${toDiscard.length} card(s)`, 'system');
  }

  // Step 4: Draw 1 card
  p = player(s, pid);
  if (p.deck.length > 0) {
    const [drawn, ...rest] = p.deck;
    p = { ...p, hand: [...p.hand, drawn], deck: rest };
    s = log(setPlayer(s, pid, p), `${pid} draws a card`, 'system');
  }

  // Step 5: Deck-out check
  p = player(s, pid);
  if (p.deck.length === 0 && p.hand.length === 0) {
    s = setPlayer(s, pid, p);
    return { ...s, phase: 'game_over', winner: pid === 'human' ? 'ai' : 'human' };
  }

  // Advance to opponent's turn
  const nextPlayer: PlayerId = pid === 'human' ? 'ai' : 'human';
  const newRound = pid === 'ai' ? s.round + 1 : s.round;

  // Reset shared model round counters when round changes
  let sharedModels = s.sharedModels;
  if (pid === 'ai') {
    sharedModels = sharedModels.map(m => ({ ...m, activationsThisRound: 0 }));
  }

  s = setPlayer(s, pid, p);
  return {
    ...s,
    sharedModels,
    activePlayer: nextPlayer,
    round:        newRound,
    turn:         s.turn + 1,
    phase:        'refresh',
  };
}

// ─────────────────────────────────────────────────────────────
// Main Phase actions
// ─────────────────────────────────────────────────────────────

function applyPlayModel(state: GameState, pid: PlayerId, cardId: string, allCards: Map<string, Card>): GameState {
  const card = allCards.get(cardId);
  if (!card || card.type !== 'model') return log(state, 'Invalid model card', 'error');

  let p = player(state, pid);
  const cost = card.playCost ?? 0;
  if (p.credits < cost) return log(state, 'Not enough credits', 'error');

  p = {
    ...p,
    credits: p.credits - cost,
    hand: p.hand.filter(c => c.id !== cardId),
  };

  const modelInPlay: ModelInPlay = {
    modelId:              cardId,
    placedByPlayer:       pid,
    placedOnTurn:         state.turn,
    activationsThisRound: 0,
    activatedThisTurn:    false,
    attachedLoras:        [],
  };

  let s = setPlayer(state, pid, p);
  s = { ...s, sharedModels: [...s.sharedModels, modelInPlay] };
  return log(s, `${pid} plays model: ${card.name}`, 'action');
}

function applyActivateModel(
  state:    GameState,
  pid:      PlayerId,
  modelId:  string,
  promptIds: string[],
  allCards: Map<string, Card>
): GameState {
  const modelEntry = state.sharedModels.find(m => m.modelId === modelId);
  if (!modelEntry) return log(state, 'Model not in shared zone', 'error');
  if (modelEntry.activatedThisTurn) return log(state, 'Model already activated this turn', 'error');

  // Round 1: only placing player may activate
  if (state.round === 1 && modelEntry.placedByPlayer !== pid) {
    return log(state, 'Round 1: only placing player may activate', 'error');
  }

  const modelCard = allCards.get(modelId);
  if (!modelCard) return log(state, 'Model card data missing', 'error');

  let p = player(state, pid);

  // Queue capacity check (max 2)
  if (p.queue.length >= 2) return log(state, 'Queue full (max 2)', 'error');

  // Cost
  const loraCount  = modelEntry.attachedLoras.length;
  const activateCost = (modelCard.activateCost ?? 0) + loraCount;
  let totalCost = activateCost;
  const promptCards: Card[] = [];
  for (const pid2 of promptIds) {
    const pc = allCards.get(pid2);
    if (!pc) return log(state, `Prompt ${pid2} not found`, 'error');
    totalCost += pc.cost ?? 0;
    promptCards.push(pc);
  }
  if (p.credits < totalCost) return log(state, 'Not enough credits to activate', 'error');

  // Validate prompts: max 2, different subtypes
  if (promptCards.length > 2) return log(state, 'Max 2 prompts per activation', 'error');
  const subtypes = promptCards.map(c => c.subtype);
  if (new Set(subtypes).size !== subtypes.length) return log(state, 'Prompts must have different subtypes', 'error');

  // ── Build the creation ──────────────────────────────────────
  let quality     = modelCard.quality ?? 1;
  let glitchTok   = 0;
  let visBonus    = 0;
  let runtime     = modelCard.runtime ?? 1;
  let styleTag:   StyleTag | null = null;
  let clipLockable = false;

  // Style from model effect text (simplified)
  const modelEffect = (modelCard.effect ?? '').toLowerCase();
  if (modelEffect.includes('clip-lock')) clipLockable = true;
  if (modelEffect.includes('bonus visibility')) visBonus += 1;
  if (modelEffect.includes('glitch token'))    glitchTok += 1;

  // Style tag compatibility — check from prompts first
  const styleSources = promptCards.filter(c =>
    c.subtype === 'Style' || c.subtype === 'Artist' || c.subtype === 'Atmosphere'
  );

  for (const pc of promptCards) {
    const pe = (pc.effect ?? '').toLowerCase();
    // Quality bonuses
    const qMatch = pe.match(/\+(\d) quality/);
    if (qMatch) quality += parseInt(qMatch[1]);
    // Glitch
    if (pe.includes('glitch token') && !pe.includes('-')) glitchTok += 1;
    // Visibility
    const vMatch = pe.match(/(\d) bonus visibility/);
    if (vMatch) visBonus += parseInt(vMatch[1]);
    // Runtime increase
    if (pe.includes('runtime increases by 1')) runtime += 1;
    // Style tag from prompt
    if (pc.subtype === 'Style' || pc.promptType === 'Style') {
      if (pe.includes('fantasy'))   styleTag = 'Fantasy';
      if (pe.includes('landscape')) styleTag = 'Landscape';
      if (pe.includes('portrait'))  styleTag = 'Portrait';
      if (pe.includes('abstract'))  styleTag = 'Abstract';
      if (pe.includes('atmosphere'))styleTag = 'Atmosphere';
    }
  }

  // Style compatibility
  if (styleTag && modelCard.compatible?.includes(styleTag))   quality += 1;
  if (styleTag && modelCard.incompatible?.includes(styleTag)) glitchTok += 1;

  // Contention (2nd activation this round)
  const newActivationCount = modelEntry.activationsThisRound + 1;
  if (newActivationCount >= 2) runtime += 1;

  // Special: SD1.5 always adds 1 glitch
  if (modelCard.id === 'M-004') glitchTok += 1;

  const creation: Creation = {
    instanceId:       newInstanceId(),
    sourceModelId:    modelId,
    quality,
    glitchTokens:     glitchTok,
    visibility:       visBonus,
    runtimeLeft:      runtime,
    styleTag,
    clipLocked:       false,
    turnsOnField:     0,
    featuredBurstUsed: false,
    immuneUntilTurn:  0,
    watermarkImmune:  false,
    owner:            pid,
  };

  // Remove prompts from hand
  p = {
    ...p,
    credits: p.credits - totalCost,
    hand:    p.hand.filter(c => !promptIds.includes(c.id)),
    queue:   [...p.queue, creation],
  };

  // Mark model activated
  const updatedModels = state.sharedModels.map(m =>
    m.modelId === modelId
      ? { ...m, activatedThisTurn: true, activationsThisRound: m.activationsThisRound + 1 }
      : m
  );

  let s = setPlayer(state, pid, p);
  s = { ...s, sharedModels: updatedModels };
  s = log(s, `${pid} activates ${modelCard.name} (Q${quality}, ${glitchTok} glitch, RT${runtime})`, 'action');
  return enforceAbsoluteRules(s);
}

function applyUseAbility(
  state:      GameState,
  pid:        PlayerId,
  abilityNum: number | 'signature',
  targetId:   string | undefined,
  allCards:   Map<string, Card>
): GameState {
  if (state.abilityUsedThisTurn.includes(pid)) {
    return log(state, 'Already used an ability this turn', 'error');
  }

  const p          = player(state, pid);
  const creatorCard = allCards.get(p.creator.cardId);
  const ability    = creatorCard?.abilities?.find(a => a.num === abilityNum);
  if (!ability) return log(state, 'Ability not found', 'error');

  const repCost = ability.cost.reputation ?? 0;
  const loyCost = ability.cost.loyalty ?? 0;

  if (p.creator.reputation < repCost) return log(state, 'Not enough reputation', 'error');
  if (p.creator.loyalty < loyCost)   return log(state, 'Not enough loyalty', 'error');

  // Deduct cost
  let s = setPlayer(state, pid, {
    ...p,
    creator: {
      ...p.creator,
      reputation: capRep(p.creator.reputation - repCost),
      loyalty:    capLoy(p.creator.loyalty    - loyCost),
      isExhausted: true,
    },
  });
  s = { ...s, abilityUsedThisTurn: [...s.abilityUsedThisTurn, pid] };

  // ── Resolve ability effects (card-specific) ─────────────────
  s = resolveAbilityEffect(s, pid, ability.num, creatorCard!.id, targetId, allCards);
  s = log(s, `${pid} uses ability: ${ability.name}`, 'action');
  return enforceAbsoluteRules(s);
}

/** Resolve card-specific ability effects */
function resolveAbilityEffect(
  state:      GameState,
  pid:        PlayerId,
  abilityNum: number | 'signature',
  creatorId:  string,
  targetId:   string | undefined,
  allCards:   Map<string, Card>
): GameState {
  const opp = pid === 'human' ? 'ai' : 'human';

  // ── Aia (C-001) ─────────────────────────────────────────────
  if (creatorId === 'C-001') {
    // ① Overrender: target opponent creation loses 1 Quality (2 if it already has glitch)
    if (abilityNum === 1 && targetId) {
      const oppPlayer = player(state, opp);
      const target = oppPlayer.field.find(c => c.instanceId === targetId);
      if (!target || target.clipLocked) return log(state, 'Invalid or protected target', 'error');
      const extraGlitch = target.glitchTokens > 0 ? 1 : 0;
      const newField = oppPlayer.field.map(c =>
        c.instanceId === targetId
          ? { ...c, glitchTokens: c.glitchTokens + 1 + extraGlitch }
          : c
      );
      return setPlayer(state, opp, { ...oppPlayer, field: newField });
    }

    // ② Positive Feedback: remove CLIP-LOCK, gain loyalty = turns locked (max 3)
    if (abilityNum === 2 && targetId) {
      const p = player(state, pid);
      const target = p.field.find(c => c.instanceId === targetId);
      if (!target || !target.clipLocked) return log(state, 'Target not CLIP-LOCKed', 'error');
      const loyGain = Math.min(3, target.turnsOnField - 1);
      const newField = p.field.map(c =>
        c.instanceId === targetId ? { ...c, clipLocked: false } : c
      );
      return setPlayer(state, pid, {
        ...p,
        field: newField,
        creator: { ...p.creator, loyalty: capLoy(p.creator.loyalty + loyGain) },
      });
    }

    // ③ Iridescent Shift: +2 vis, single-target immune until next turn
    if (abilityNum === 3 && targetId) {
      const p = player(state, pid);
      const newField = p.field.map(c =>
        c.instanceId === targetId
          ? { ...c, visibility: c.visibility + 2, immuneUntilTurn: state.turn + 2 }
          : c
      );
      return setPlayer(state, pid, { ...p, field: newField });
    }

    // Σ Copy That!: up to 3 CLIP-LOCKed → remove, deal 1 loyalty to opponent each
    if (abilityNum === 'signature') {
      const p = player(state, pid);
      const locked = p.field.filter(c => c.clipLocked);
      const chosen = locked.slice(0, 3);
      let s = setPlayer(state, pid, {
        ...p,
        field: p.field.map(c => chosen.some(ch => ch.instanceId === c.instanceId) ? { ...c, clipLocked: false } : c),
      });
      for (const _ of chosen) {
        s = dealLoyaltyDamage(s, opp, 1, 'Copy That!');
      }
      if (chosen.length >= 2) {
        const oppP = player(s, opp);
        s = setPlayer(s, opp, {
          ...oppP,
          creator: { ...oppP.creator, reputation: capRep(oppP.creator.reputation - 2) },
        });
      }
      return s;
    }
  }

  // ── Anonymous User (C-002) ───────────────────────────────────
  if (creatorId === 'C-002') {
    // ① First Post: next model activation 2 fewer credits (simplified: give 2 temp credits)
    if (abilityNum === 1) {
      const p = player(state, pid);
      if (p.field.length > 0 || p.queue.length > 0) return log(state, 'Field/queue must be empty', 'error');
      return setPlayer(state, pid, { ...p, credits: Math.min(p.creditCap, p.credits + 2) });
    }

    // ② Flood the Feed: all queued → field immediately (each gets +1 glitch)
    if (abilityNum === 2) {
      const p = player(state, pid);
      const flooding = p.queue.map(c => ({ ...c, runtimeLeft: 0, glitchTokens: c.glitchTokens + 1 }));
      const available = 3 - p.field.length;
      const entering  = flooding.slice(0, available);
      let s = setPlayer(state, pid, {
        ...p,
        field: [...p.field, ...entering],
        queue: [],
      });
      return enforceQualityRule(s);
    }

    // ③ More Than You: if AI has more creations → opponent loses 1 loyalty, AI gains 1
    if (abilityNum === 3) {
      const p   = player(state, pid);
      const opp2 = player(state, opp);
      if (p.field.length > opp2.field.length) {
        let s = dealLoyaltyDamage(state, opp, 1, 'More Than You');
        const pp = player(s, pid);
        s = setPlayer(s, pid, { ...pp, creator: { ...pp.creator, loyalty: capLoy(pp.creator.loyalty + 1) } });
        return s;
      }
      return log(state, 'Need more creations than opponent', 'error');
    }

    // Σ Going Viral: all creations +3 vis; each crossing Liked/Featured → opp -1 loy
    if (abilityNum === 'signature') {
      const p = player(state, pid);
      let loyDamage = 0;
      const newField = p.field.map(c => {
        const prevVis = c.visibility;
        const newVis  = c.visibility + 3;
        if ((prevVis < 6  && newVis >= 6)  || (prevVis < 10 && newVis >= 10)) loyDamage++;
        return { ...c, visibility: newVis };
      });
      let s = setPlayer(state, pid, { ...p, field: newField });
      for (let i = 0; i < loyDamage; i++) {
        s = dealLoyaltyDamage(s, opp, 1, 'Going Viral');
      }
      return s;
    }
  }

  // Unrecognised creator / ability — no-op
  return state;
}

function applyApplyClipLock(state: GameState, pid: PlayerId, creationId: string): GameState {
  const creatorCard = state[pid === 'human' ? 'human' : 'ai'].creator.cardId;
  if (creatorCard !== 'C-001') return log(state, 'Only Aia can apply CLIP-LOCK', 'error');

  const p = player(state, pid);
  const target = p.field.find(c => c.instanceId === creationId);
  if (!target) return log(state, 'Creation not found on field', 'error');
  // Only Coherent model creations (M-001)
  if (target.sourceModelId !== 'M-001') return log(state, 'CLIP-LOCK only on Coherent creations', 'error');

  const newField = p.field.map(c =>
    c.instanceId === creationId ? { ...c, clipLocked: true } : c
  );
  return log(setPlayer(state, pid, { ...p, field: newField }), `${pid} applies CLIP-LOCK`, 'action');
}

// ─────────────────────────────────────────────────────────────
// Game setup
// ─────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildPlayerState(
  id:        PlayerId,
  creatorId: string,
  deck:      Card[],
  allCards:  Map<string, Card>
): PlayerState {
  const shuffled = shuffle(deck);
  const hand     = shuffled.slice(0, 7);
  const rest     = shuffled.slice(7);
  const creator  = allCards.get(creatorId)!;
  const startRep = creator.startingBonus?.type === 'reputation' ? creator.startingBonus.amount : 0;
  const startCred = creator.startingBonus?.type === 'credit'    ? creator.startingBonus.amount : 0;

  return {
    id,
    creator: {
      cardId:      creatorId,
      loyalty:     creator.loyalty ?? 10,
      reputation:  startRep,
      isExhausted: false,
    },
    hand,
    deck:          rest,
    discard:       [],
    credits:       startCred,   // Starting credits added later by first-player rule
    creditCap:     10,
    field:         [],
    queue:         [],
    remixQueue:    null,
    modifiers:     [],
  };
}

// ─────────────────────────────────────────────────────────────
// Main reducer
// ─────────────────────────────────────────────────────────────

export function gameReducer(
  state:    GameState,
  action:   GameAction,
  allCards: Map<string, Card>
): GameState {
  if (state.phase === 'game_over' && action.type !== 'START_GAME') return state;

  switch (action.type) {

    case 'START_GAME': {
      const human = buildPlayerState('human', action.humanCreatorId, action.humanDeck, allCards);
      const ai    = buildPlayerState('ai',    action.aiCreatorId,    action.aiDeck,    allCards);

      // First player: 4 credits; second: 6 credits
      const fp = action.firstPlayer;
      const sp: PlayerId = fp === 'human' ? 'ai' : 'human';

      const humanCredits = fp === 'human' ? 4 : 6;
      const aiCredits    = fp === 'ai'    ? 4 : 6;

      let s: GameState = {
        human: { ...human, credits: humanCredits },
        ai:    { ...ai,    credits: aiCredits    },
        sharedModels:   [],
        artifactZone:   [],
        turn:           1,
        round:          1,
        activePlayer:   fp,
        phase:          'main',
        winner:         null,
        log:            [],
        abilityUsedThisTurn: [],
      };
      s = log(s, `Game started! ${fp} goes first.`, 'system');
      return s;
    }

    case 'MULLIGAN': {
      const p = player(state, action.player);
      const reshuffled = shuffle([...p.hand, ...p.deck]);
      const newHand    = reshuffled.slice(0, 6);
      const newDeck    = reshuffled.slice(6);
      // Opponent gets +2 credits if they didn't mulligan (handled externally for now)
      return setPlayer(state, action.player, { ...p, hand: newHand, deck: newDeck });
    }

    case 'PLAY_MODEL':
      return applyPlayModel(state, action.player, action.cardId, allCards);

    case 'ACTIVATE_MODEL':
      return applyActivateModel(state, action.player, action.modelId, action.promptIds, allCards);

    case 'USE_CREATOR_ABILITY':
      return applyUseAbility(state, action.player, action.abilityNum, action.targetId, allCards);

    case 'APPLY_CLIP_LOCK':
      return applyApplyClipLock(state, action.player, action.creationId);

    case 'PLAY_MODIFIER': {
      const card = allCards.get(action.cardId);
      if (!card) return log(state, 'Card not found', 'error');
      const p = player(state, action.player);
      if (p.credits < (card.cost ?? 0)) return log(state, 'Not enough credits', 'error');
      const updated = {
        ...p,
        credits:   p.credits - (card.cost ?? 0),
        hand:      p.hand.filter(c => c.id !== action.cardId),
        modifiers: [...p.modifiers, {
          cardId:    action.cardId,
          turnsLeft: card.duration === 'Permanent' ? 'permanent' as const : parseInt(card.duration ?? '1'),
          target:    action.targetId,
        }],
      };
      return log(setPlayer(state, action.player, updated), `${action.player} plays modifier: ${card.name}`, 'action');
    }

    case 'PLAY_ARTIFACT': {
      const card = allCards.get(action.cardId);
      if (!card) return log(state, 'Card not found', 'error');
      const p = player(state, action.player);
      if (p.credits < (card.cost ?? 0)) return log(state, 'Not enough credits', 'error');
      const updated = {
        ...p,
        credits: p.credits - (card.cost ?? 0),
        hand:    p.hand.filter(c => c.id !== action.cardId),
      };
      let s = setPlayer(state, action.player, updated);
      s = { ...s, artifactZone: [...s.artifactZone, action.cardId] };
      return log(s, `${action.player} plays artifact: ${card.name}`, 'action');
    }

    case 'PLAY_EVENT': {
      // Events are simplified — just deduct cost and log for now
      const card = allCards.get(action.cardId);
      if (!card) return log(state, 'Card not found', 'error');
      if (state.round === 1) return log(state, 'No events in Round 1', 'error');
      const p = player(state, action.player);
      if (p.credits < (card.cost ?? 0)) return log(state, 'Not enough credits', 'error');
      const updated = {
        ...p,
        credits: p.credits - (card.cost ?? 0),
        hand:    p.hand.filter(c => c.id !== action.cardId),
        discard: [...p.discard, card],
      };
      return log(setPlayer(state, action.player, updated), `${action.player} plays event: ${card.name}`, 'action');
    }

    case 'END_TURN': {
      let s = runEndPhase(state);
      // If new active player's turn starts, run refresh
      if (s.phase === 'refresh') {
        s = runRefreshPhase(s, allCards);
      }
      return s;
    }

    case 'CONCEDE':
      return {
        ...state,
        phase:  'game_over',
        winner: action.player === 'human' ? 'ai' : 'human',
      };

    case 'SLOT_OVERFLOW_CHOICE': {
      // Deferred slot overflow resolution
      if (action.destroyId === 'discard_incoming') {
        // Discard the incoming — no loyalty loss (it never entered)
        return log(state, `${action.player} discards incoming creation`, 'system');
      }
      return destroyCreation(state, action.player, action.destroyId, 'slot overflow (player choice)');
    }

    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────
// Selector helpers (for UI)
// ─────────────────────────────────────────────────────────────

export function selectCanUseAbility(state: GameState, pid: PlayerId, abilityNum: number | 'signature', allCards: Map<string, Card>): boolean {
  if (state.activePlayer !== pid) return false;
  if (state.phase !== 'main') return false;
  if (state.abilityUsedThisTurn.includes(pid)) return false;
  const p = player(state, pid);
  const creatorCard = allCards.get(p.creator.cardId);
  const ab = creatorCard?.abilities?.find(a => a.num === abilityNum);
  if (!ab) return false;
  return p.creator.reputation >= (ab.cost.reputation ?? 0)
      && p.creator.loyalty    >= (ab.cost.loyalty    ?? 0);
}

export function selectGameOver(state: GameState): boolean {
  return state.phase === 'game_over';
}

export function selectActiveCreations(state: GameState, pid: PlayerId): Creation[] {
  return player(state, pid).field;
}

export function selectQueue(state: GameState, pid: PlayerId): Creation[] {
  return player(state, pid).queue;
}
