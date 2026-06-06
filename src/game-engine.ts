// ============================================================
// PROMPT BATTLE — Game Engine · v0.3
// Pure state machine. No side-effects.
// ============================================================

import type { Card, StyleTag } from './types';

export type PlayerId = 'human' | 'ai';

export interface Creation {
  instanceId:        string;
  sourceModelId:     string;
  quality:           number;
  glitchTokens:      number;
  visibility:        number;
  runtimeLeft:       number;
  styleTag:          StyleTag | null;
  clipLocked:        boolean;
  turnsOnField:      number;
  featuredBurstUsed: boolean;
  immuneUntilTurn:   number;
  watermarkImmune:   boolean;
  owner:             PlayerId;
}

export interface AttachedModifier {
  cardId:    string;
  turnsLeft: number | 'permanent';
  target:    string;
}

export interface ModelInPlay {
  modelId:              string;
  placedByPlayer:       PlayerId;
  placedOnTurn:         number;
  activationsThisRound: number;
  activatedThisTurn:    boolean;
  attachedLoras:        string[];
}

export interface CreatorState {
  cardId:      string;
  loyalty:     number;
  reputation:  number;
  isExhausted: boolean;
}

export interface PlayerState {
  id:               PlayerId;
  creator:          CreatorState;
  hand:             Card[];
  guaranteedModels: Card[];   // Set aside face-up — NOT in deck
  deck:             Card[];
  discard:          Card[];
  credits:          number;
  creditCap:        number;
  field:            Creation[];
  queue:            Creation[];
  remixQueue:       Creation | null;
  modifiers:        AttachedModifier[];
  mulliganed:       boolean;
  turnsPlayed:      number;   // increments each time this player completes a turn
}

export interface GameState {
  human:               PlayerState;
  ai:                  PlayerState;
  sharedModels:        ModelInPlay[];
  artifactZone:        string[];
  turn:                number;
  round:               number;
  activePlayer:        PlayerId;
  phase:               'mulligan' | 'refresh' | 'main' | 'end' | 'game_over';
  mulliganPhase:       { humanDone: boolean; aiDone: boolean };
  winner:              PlayerId | 'draw' | null;
  log:                 LogEntry[];
  abilityUsedThisTurn: PlayerId[];
  favouritePromptActive: boolean;  // human has toggled their fav prompt in for next activation
}

export interface LogEntry {
  id:   string;
  text: string;
  type: 'action' | 'system' | 'combat' | 'error';
  turn: number;
}

export type GameAction =
  | { type: 'START_GAME'; humanDeck: Card[]; aiDeck: Card[]; humanCreatorId: string; aiCreatorId: string; firstPlayer: PlayerId }
  | { type: 'MULLIGAN'; player: PlayerId }
  | { type: 'KEEP_HAND'; player: PlayerId }
  | { type: 'PLAY_MODEL'; player: PlayerId; cardId: string }
  | { type: 'PLAY_GUARANTEED_MODEL'; player: PlayerId; cardId: string }
  | { type: 'ACTIVATE_MODEL'; player: PlayerId; modelId: string; promptIds: string[] }
  | { type: 'PLAY_MODIFIER'; player: PlayerId; cardId: string; targetId: string }
  | { type: 'PLAY_ARTIFACT'; player: PlayerId; cardId: string }
  | { type: 'PLAY_EVENT'; player: PlayerId; cardId: string }
  | { type: 'USE_CREATOR_ABILITY'; player: PlayerId; abilityNum: number | 'signature'; targetId?: string }
  | { type: 'APPLY_CLIP_LOCK'; player: PlayerId; creationId: string }
  | { type: 'TOGGLE_FAVOURITE_PROMPT'; player: PlayerId }   // select/deselect fav prompt as one of the 2 prompts
  | { type: 'END_TURN'; player: PlayerId }
  | { type: 'CONCEDE'; player: PlayerId };

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

let _iid = 0;
function newIid() { return `cr-${++_iid}-${Date.now()}`; }
let _lid = 0;
function newLid() { return `log-${++_lid}`; }

function addLog(state: GameState, text: string, type: LogEntry['type'] = 'system'): GameState {
  return { ...state, log: [{ id: newLid(), text, type, turn: state.turn }, ...state.log].slice(0, 300) };
}

function getPlayer(state: GameState, id: PlayerId): PlayerState {
  return id === 'human' ? state.human : state.ai;
}

function getOpponent(state: GameState, id: PlayerId): PlayerState {
  return id === 'human' ? state.ai : state.human;
}

function setPlayer(state: GameState, id: PlayerId, p: PlayerState): GameState {
  return id === 'human' ? { ...state, human: p } : { ...state, ai: p };
}

function effQ(c: Creation) { return c.quality - c.glitchTokens; }

function repPerTurn(vis: number, quality: number): number {
  let base = 0;
  if (vis >= 10) base = 3; else if (vis >= 6) base = 2; else if (vis >= 3) base = 1;
  if (quality === 1) base = Math.max(0, base - 1);
  if (quality === 4) base += 1;
  if (quality >= 5)  base += 2;
  return base;
}

function capRep(n: number) { return Math.min(20, Math.max(0, n)); }
function capLoy(n: number) { return Math.max(0, n); }

function destroyCreation(state: GameState, owner: PlayerId, instanceId: string, reason: string): GameState {
  const p = getPlayer(state, owner);
  const exists = [...p.field, ...p.queue].find(c => c.instanceId === instanceId);
  if (!exists) return state;
  let s = setPlayer(state, owner, {
    ...p,
    field: p.field.filter(c => c.instanceId !== instanceId),
    queue: p.queue.filter(c => c.instanceId !== instanceId),
  });
  s = addLog(s, `${owner}'s creation destroyed (${reason})`, 'combat');
  // -1 loyalty on destruction
  const pp = getPlayer(s, owner);
  s = setPlayer(s, owner, { ...pp, creator: { ...pp.creator, loyalty: capLoy(pp.creator.loyalty - 1) } });
  return enforceAbsoluteRules(s);
}

function enforceQuality(state: GameState): GameState {
  let s = state;
  for (const pid of ['human', 'ai'] as PlayerId[]) {
    const p = getPlayer(s, pid);
    for (const c of p.field) {
      if (effQ(c) <= 0) s = destroyCreation(s, pid, c.instanceId, 'quality ≤ 0');
    }
  }
  return s;
}

function enforceLoyalty(state: GameState): GameState {
  const h = state.human.creator.loyalty;
  const a = state.ai.creator.loyalty;
  if (h <= 0 && a <= 0) return { ...state, phase: 'game_over', winner: 'draw' };
  if (h <= 0) return { ...state, phase: 'game_over', winner: 'ai' };
  if (a <= 0) return { ...state, phase: 'game_over', winner: 'human' };
  return state;
}

function enforceAbsoluteRules(state: GameState): GameState {
  return enforceLoyalty(enforceQuality(state));
}

// ─────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildPlayer(id: PlayerId, creatorId: string, deck: Card[], allCards: Map<string, Card>): PlayerState {
  const creator = allCards.get(creatorId)!;
  // Separate guaranteed models from the shuffled deck
  const guaranteed = deck.filter(c => c.type === 'model' && c.guaranteed);
  const shuffled   = shuffle(deck.filter(c => !(c.type === 'model' && c.guaranteed)));
  const startRep   = creator.startingBonus?.type === 'reputation' ? creator.startingBonus.amount : 0;
  return {
    id,
    creator: { cardId: creatorId, loyalty: creator.loyalty ?? 10, reputation: startRep, isExhausted: false },
    hand:             shuffled.slice(0, 7),
    guaranteedModels: guaranteed,
    deck:             shuffled.slice(7),
    discard:          [],
    credits:          0,
    creditCap:        10,
    field:            [],
    queue:            [],
    remixQueue:       null,
    modifiers:        [],
    mulliganed:       false,
    turnsPlayed:      0,
  };
}

// ─────────────────────────────────────────────────────────────
// Refresh phase
// ─────────────────────────────────────────────────────────────

function runRefresh(state: GameState, allCards: Map<string, Card>): GameState {
  const pid = state.activePlayer;
  let p = getPlayer(state, pid);
  let s = state;

  // Step 1: gain 5 credits (+ carryover already applied in end phase)
  p = { ...p, credits: Math.min(p.creditCap, p.credits + 5) };

  // Step 2: reduce runtime
  let newQueue = p.queue.map(c => ({ ...c, runtimeLeft: c.runtimeLeft - 1 }));

  // Step 3: creations enter field
  const entering = newQueue.filter(c => c.runtimeLeft <= 0);
  newQueue = newQueue.filter(c => c.runtimeLeft > 0);
  p = { ...p, queue: newQueue };
  s = setPlayer(s, pid, p);

  for (const creation of entering) {
    p = getPlayer(s, pid);
    if (p.field.length < 3) {
      p = { ...p, field: [...p.field, { ...creation, runtimeLeft: 0 }] };
      s = setPlayer(s, pid, p);
      s = addLog(s, `${pid}'s creation enters the field`, 'action');
    } else {
      // Auto: destroy oldest to make room (UI can intercept for player)
      const oldest = p.field[0];
      s = destroyCreation(setPlayer(s, pid, p), pid, oldest.instanceId, 'slot overflow');
      p = getPlayer(s, pid);
      p = { ...p, field: [...p.field, { ...creation, runtimeLeft: 0 }] };
      s = setPlayer(s, pid, p);
    }
  }

  // Step 4: gain visibility
  p = getPlayer(s, pid);
  let newField = p.field.map(c => ({ ...c, visibility: c.visibility + 1, turnsOnField: c.turnsOnField + 1 }));

  // Step 5: collect rep
  let totalRep = 0;
  for (const c of newField) {
    totalRep += repPerTurn(c.visibility, effQ(c));
    if (c.visibility >= 10 && !c.featuredBurstUsed) {
      totalRep += 5;
      newField = newField.map(f => f.instanceId === c.instanceId ? { ...f, featuredBurstUsed: true } : f);
      s = addLog(s, `${pid} Featured Burst! +5 rep`, 'combat');
    }
  }
  const newRep = capRep(p.creator.reputation + totalRep);
  p = { ...p, field: newField, creator: { ...p.creator, reputation: newRep } };
  s = setPlayer(s, pid, p);
  if (totalRep > 0) s = addLog(s, `${pid} gains ${totalRep} rep (now ${newRep})`, 'system');

  // Step 6a: influence effects (start of turn)
  s = resolveInfluence(s, pid, allCards);

  // Step 6b: creator stress — "Turn 2 onwards" = each player's 2nd+ turn
  p = getPlayer(s, pid);
  if (p.turnsPlayed >= 1 && p.field.length === 0 && p.queue.length === 0) {
    p = { ...p, creator: { ...p.creator, loyalty: capLoy(p.creator.loyalty - 1) } };
    s = setPlayer(s, pid, p);
    s = addLog(s, `${pid} creator stress! -1 loyalty`, 'combat');
  }

  // Step 6c: ongoing passive resolution
  s = resolveOngoingPassives(s, pid, allCards);

  // Reset exhausted
  p = getPlayer(s, pid);
  p = { ...p, creator: { ...p.creator, isExhausted: false } };
  s = setPlayer(s, pid, p);
  s = {
    ...s,
    sharedModels:        s.sharedModels.map(m => ({ ...m, activatedThisTurn: false })),
    abilityUsedThisTurn: s.abilityUsedThisTurn.filter(x => x !== pid),
    phase:               'main',
  };
  s = addLog(s, `=== ${pid.toUpperCase()} TURN (Round ${s.round}, Turn ${s.turn}) ===`, 'system');
  return enforceAbsoluteRules(s);
}

// ─────────────────────────────────────────────────────────────
// End phase
// ─────────────────────────────────────────────────────────────

function runEnd(state: GameState): GameState {
  const pid = state.activePlayer;
  let p = getPlayer(state, pid);
  let s = state;

  // Carryover + increment turns played
  p = { ...p, credits: Math.floor(p.credits / 2), turnsPlayed: p.turnsPlayed + 1 };

  // Discard to 7
  if (p.hand.length > 7) {
    const excess = p.hand.slice(7);
    p = { ...p, hand: p.hand.slice(0, 7), discard: [...p.discard, ...excess] };
  }

  // Draw 1
  if (p.deck.length > 0) {
    const [drawn, ...rest] = p.deck;
    p = { ...p, hand: [...p.hand, drawn], deck: rest };
  }

  s = setPlayer(s, pid, p);

  // Deck-out
  p = getPlayer(s, pid);
  if (p.deck.length === 0 && p.hand.length === 0) {
    return { ...s, phase: 'game_over', winner: pid === 'human' ? 'ai' : 'human' };
  }

  const nextPlayer: PlayerId = pid === 'human' ? 'ai' : 'human';
  const newRound = pid === 'ai' ? s.round + 1 : s.round;
  let sharedModels = s.sharedModels;
  if (pid === 'ai') sharedModels = sharedModels.map(m => ({ ...m, activationsThisRound: 0 }));

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
// Main phase actions
// ─────────────────────────────────────────────────────────────

function playModel(state: GameState, pid: PlayerId, cardId: string, allCards: Map<string, Card>, fromGuaranteed: boolean): GameState {
  const card = allCards.get(cardId);
  if (!card || card.type !== 'model') return addLog(state, 'Invalid model card', 'error');
  let p = getPlayer(state, pid);

  if (!fromGuaranteed) {
    // Playing from hand costs playCost
    if (p.credits < (card.playCost ?? 0)) return addLog(state, 'Not enough credits', 'error');
    p = { ...p, credits: p.credits - (card.playCost ?? 0), hand: p.hand.filter(c => c.id !== cardId) };
  } else {
    // Guaranteed models are free to play (set aside)
    p = { ...p, guaranteedModels: p.guaranteedModels.filter(c => c.id !== cardId) };
  }

  const modelEntry: ModelInPlay = {
    modelId: cardId, placedByPlayer: pid, placedOnTurn: state.turn,
    activationsThisRound: 0, activatedThisTurn: false, attachedLoras: [],
  };
  let s = setPlayer(state, pid, p);
  s = { ...s, sharedModels: [...s.sharedModels, modelEntry] };
  return addLog(s, `${pid} plays model: ${card.name}`, 'action');
}

// ─────────────────────────────────────────────────────────────
// Passive / Influence effect resolution
// ─────────────────────────────────────────────────────────────

function resolvePassives(state: GameState, pid: PlayerId, newCreation: Creation, allCards: Map<string, Card>): GameState {
  const opp    = pid === 'human' ? 'ai' : 'human';
  const p      = getPlayer(state, pid);
  const oppP   = getPlayer(state, opp);
  const creator = allCards.get(p.creator.cardId);
  if (!creator) return state;
  let s = state;

  // ── Aia (C-001): CLIP-LOCK Mastery is manual (already handled via APPLY_CLIP_LOCK)

  // ── Anonymous User (C-002): Copycat
  // When a new Creation enters that shares a Style tag with an opponent active Creation,
  // steal 2 Visibility Counters from that opponent Creation.
  if (creator.id === 'C-002' && newCreation.styleTag) {
    const targets = oppP.field.filter(c => c.styleTag === newCreation.styleTag && c.runtimeLeft === 0);
    if (targets.length > 0) {
      // Steal from first eligible (player would choose, AI just picks highest vis)
      const target = targets.reduce((best, c) => c.visibility > best.visibility ? c : best, targets[0]);
      const stolen = Math.min(2, target.visibility);
      const newOppField = oppP.field.map(c =>
        c.instanceId === target.instanceId ? { ...c, visibility: Math.max(0, c.visibility - stolen) } : c
      );
      // Add stolen vis to the new creation (find it in queue)
      const newPField  = p.field.map(c =>
        c.instanceId === newCreation.instanceId ? { ...c, visibility: c.visibility + stolen } : c
      );
      const newPQueue  = p.queue.map(c =>
        c.instanceId === newCreation.instanceId ? { ...c, visibility: c.visibility + stolen } : c
      );
      s = setPlayer(s, opp, { ...oppP, field: newOppField });
      s = setPlayer(s, pid,  { ...getPlayer(s, pid), field: newPField, queue: newPQueue });
      s = addLog(s, `${pid} Copycat! Stole ${stolen} visibility from opponent's ${target.styleTag} creation`, 'action');
    }
  }

  return s;
}

// ─────────────────────────────────────────────────────────────
// Influence effect resolution (start of turn)
// ─────────────────────────────────────────────────────────────

function resolveInfluence(state: GameState, pid: PlayerId, allCards: Map<string, Card>): GameState {
  const p      = getPlayer(state, pid);
  const creator = allCards.get(p.creator.cardId);
  if (!creator?.influence) return state;
  let s = state;

  // ── Anonymous User (C-002): Safety in Numbers
  // At start of turn: friendly Creations with ≤3 vis are immune to single-target until next turn
  if (creator.id === 'C-002') {
    const newField = p.field.map(c =>
      c.visibility <= 3 && c.runtimeLeft === 0
        ? { ...c, immuneUntilTurn: state.turn + 2 }
        : c
    );
    const protected_count = newField.filter(c => c.immuneUntilTurn >= state.turn).length;
    s = setPlayer(s, pid, { ...p, field: newField });
    if (protected_count > 0) {
      s = addLog(s, `${pid} Safety in Numbers: ${protected_count} creation(s) protected`, 'system');
    }
  }

  return s;
}

// ─────────────────────────────────────────────────────────────
// Anonymous User passive on-field effect (Copycat vis bonus)
// Applied each refresh for already-on-field creations with matching style
// ─────────────────────────────────────────────────────────────

function resolveOngoingPassives(state: GameState, pid: PlayerId, allCards: Map<string, Card>): GameState {
  const p      = getPlayer(state, pid);
  const creator = allCards.get(p.creator.cardId);
  if (!creator) return state;
  // Aia: CLIP-LOCK Mastery is manual — no ongoing resolution needed here
  // Anonymous User: Copycat only triggers on generation, not ongoing
  return state;
}


function activateModel(state: GameState, pid: PlayerId, modelId: string, promptIds: string[], allCards: Map<string, Card>): GameState {
  const entry = state.sharedModels.find(m => m.modelId === modelId);
  if (!entry) return addLog(state, 'Model not in shared zone', 'error');
  if (entry.activatedThisTurn) return addLog(state, 'Model already activated this turn', 'error');
  if (state.round === 1 && entry.placedByPlayer !== pid) return addLog(state, 'Round 1: only the placing player may activate', 'error');

  const modelCard = allCards.get(modelId);
  if (!modelCard) return addLog(state, 'Model card data missing', 'error');

  let p = getPlayer(state, pid);
  if (p.queue.length >= 2) return addLog(state, 'Queue full (max 2)', 'error');

  let totalCost = modelCard.activateCost ?? 0;
  for (const pid2 of promptIds.filter(id => id !== 'FAV_PROMPT')) totalCost += allCards.get(pid2)?.cost ?? 0;
  if (p.credits < totalCost) return addLog(state, `Need ${totalCost}Cr, have ${p.credits}Cr`, 'error');

  // Build creation
  let quality    = modelCard.quality ?? 1;
  let glitch     = 0;
  let visBonus   = 0;
  let runtime    = modelCard.runtime ?? 1;
  let styleTag: StyleTag | null = null;

  const mfx = (modelCard.effect ?? '').toLowerCase();
  if (mfx.includes('bonus visibility')) visBonus += 1;
  if (mfx.includes('glitch token'))     glitch   += 1;
  if (modelCard.id === 'M-004')         glitch   += 1; // SD 1.5 always glitches

  for (const pid2 of promptIds.filter(id => id !== 'FAV_PROMPT')) {
    const pc = allCards.get(pid2);
    if (!pc) continue;
    const pe = (pc.effect ?? '').toLowerCase();
    const qm = pe.match(/\+(\d+) quality/);
    if (qm) quality += parseInt(qm[1]);
    if (pe.includes('glitch token') && !pe.includes('remove')) glitch += 1;
    const vm = pe.match(/(\d+) bonus vis/);
    if (vm) visBonus += parseInt(vm[1]);
    if (pe.includes('runtime increases by 1')) runtime += 1;
    if (pc.subtype === 'Style' || pc.promptType === 'Style') {
      const pestyle = pe;
      if (pestyle.includes('fantasy'))    styleTag = 'Fantasy';
      if (pestyle.includes('landscape'))  styleTag = 'Landscape';
      if (pestyle.includes('portrait'))   styleTag = 'Portrait';
      if (pestyle.includes('abstract'))   styleTag = 'Abstract';
      if (pestyle.includes('atmosphere')) styleTag = 'Atmosphere';
    }
  }

  // Resolve favourite prompt effect
  if (promptIds.includes('FAV_PROMPT')) {
    const playerCreator = allCards.get(getPlayer(state, pid).creator.cardId);
    const fp = playerCreator?.favouritePrompt;
    if (fp) {
      const fpe = fp.effect.toLowerCase();
      const fqm = fpe.match(/\+(\d+) quality/);
      if (fqm) quality += parseInt(fqm[1]);
      if (fpe.includes('glitch token') && !fpe.includes('remove')) glitch += 1;
      const fvm = fpe.match(/(\d+) bonus vis/);
      if (fvm) visBonus += parseInt(fvm[1]);
      if (fp.subtype === 'Atmosphere' || fp.subtype === 'Style' || fp.subtype === 'Artist') {
        const ft = fpe;
        if (ft.includes('fantasy'))    styleTag = 'Fantasy';
        if (ft.includes('landscape'))  styleTag = 'Landscape';
        if (ft.includes('portrait'))   styleTag = 'Portrait';
        if (ft.includes('abstract'))   styleTag = 'Abstract';
        if (ft.includes('atmosphere')) styleTag = 'Atmosphere';
      }
    }
  }

  if (styleTag && modelCard.compatible?.includes(styleTag))   quality += 1;
  if (styleTag && modelCard.incompatible?.includes(styleTag)) glitch  += 1;
  if (entry.activationsThisRound >= 1) runtime += 1; // contention

  const creation: Creation = {
    instanceId: newIid(), sourceModelId: modelId,
    quality, glitchTokens: glitch, visibility: visBonus,
    runtimeLeft: runtime, styleTag,
    clipLocked: false, turnsOnField: 0,
    featuredBurstUsed: false, immuneUntilTurn: 0,
    watermarkImmune: false, owner: pid,
  };

  p = {
    ...p,
    credits: p.credits - totalCost,
    hand:    p.hand.filter(c => !promptIds.includes(c.id)),
    queue:   [...p.queue, creation],
  };

  let s = setPlayer(state, pid, p);
  s = { ...s, sharedModels: s.sharedModels.map(m => m.modelId === modelId ? { ...m, activatedThisTurn: true, activationsThisRound: m.activationsThisRound + 1 } : m) };
  s = addLog(s, `${pid} activates ${modelCard.name} → Q${quality}${glitch > 0 ? `-${glitch}G` : ''} RT${runtime}`, 'action');
  // Reset favourite prompt toggle after use
  if (pid === 'human') s = { ...s, favouritePromptActive: false };
  s = resolvePassives(s, pid, creation, allCards);
  return enforceAbsoluteRules(s);
}

function useAbility(state: GameState, pid: PlayerId, abilityNum: number | 'signature', targetId: string | undefined, allCards: Map<string, Card>): GameState {
  if (state.abilityUsedThisTurn.includes(pid)) return addLog(state, 'Already used an ability this turn', 'error');
  const p = getPlayer(state, pid);
  const creatorCard = allCards.get(p.creator.cardId);
  const ability = creatorCard?.abilities?.find(a => a.num === abilityNum);
  if (!ability) return addLog(state, 'Ability not found', 'error');

  const repCost = ability.cost.reputation ?? 0;
  const loyCost = ability.cost.loyalty    ?? 0;
  if (p.creator.reputation < repCost) return addLog(state, `Need ${repCost} rep`, 'error');
  if (p.creator.loyalty    < loyCost) return addLog(state, `Need ${loyCost} loyalty`, 'error');

  let s = setPlayer(state, pid, {
    ...p,
    creator: { ...p.creator, reputation: capRep(p.creator.reputation - repCost), loyalty: capLoy(p.creator.loyalty - loyCost), isExhausted: true },
  });
  s = { ...s, abilityUsedThisTurn: [...s.abilityUsedThisTurn, pid] };
  s = resolveAbility(s, pid, abilityNum, creatorCard!.id, targetId, allCards);
  s = addLog(s, `${pid} uses ${ability.name}`, 'action');
  return enforceAbsoluteRules(s);
}

function resolveAbility(state: GameState, pid: PlayerId, num: number | 'signature', creatorId: string, targetId: string | undefined, allCards: Map<string, Card>): GameState {
  const opp = pid === 'human' ? 'ai' : 'human';

  if (creatorId === 'C-001') {
    // ① Overrender: add glitch to target opponent creation
    if (num === 1 && targetId) {
      const oppP = getPlayer(state, opp);
      const target = oppP.field.find(c => c.instanceId === targetId);
      if (!target || target.clipLocked) return addLog(state, 'Invalid/protected target', 'error');
      const extra = target.glitchTokens > 0 ? 1 : 0;
      return setPlayer(state, opp, { ...oppP, field: oppP.field.map(c => c.instanceId === targetId ? { ...c, glitchTokens: c.glitchTokens + 1 + extra } : c) });
    }
    // ② Positive Feedback: remove CLIP-LOCK, gain loyalty
    if (num === 2 && targetId) {
      const p = getPlayer(state, pid);
      const target = p.field.find(c => c.instanceId === targetId);
      if (!target?.clipLocked) return addLog(state, 'Target not CLIP-LOCKed', 'error');
      const loyGain = Math.min(3, target.turnsOnField);
      return setPlayer(state, pid, { ...p, field: p.field.map(c => c.instanceId === targetId ? { ...c, clipLocked: false } : c), creator: { ...p.creator, loyalty: capLoy(p.creator.loyalty + loyGain) } });
    }
    // ③ Iridescent Shift: +2 vis + single-target immunity
    if (num === 3 && targetId) {
      const p = getPlayer(state, pid);
      return setPlayer(state, pid, { ...p, field: p.field.map(c => c.instanceId === targetId ? { ...c, visibility: c.visibility + 2, immuneUntilTurn: state.turn + 2 } : c) });
    }
    // Σ Copy That!
    if (num === 'signature') {
      const p = getPlayer(state, pid);
      const locked = p.field.filter(c => c.clipLocked).slice(0, 3);
      let s = setPlayer(state, pid, { ...p, field: p.field.map(c => locked.some(l => l.instanceId === c.instanceId) ? { ...c, clipLocked: false } : c) });
      for (const _ of locked) {
        const oppP = getPlayer(s, opp);
        s = setPlayer(s, opp, { ...oppP, creator: { ...oppP.creator, loyalty: capLoy(oppP.creator.loyalty - 1) } });
      }
      if (locked.length >= 2) {
        const oppP = getPlayer(s, opp);
        s = setPlayer(s, opp, { ...oppP, creator: { ...oppP.creator, reputation: capRep(oppP.creator.reputation - 2) } });
      }
      return s;
    }
  }

  if (creatorId === 'C-002') {
    if (num === 1) {
      const p = getPlayer(state, pid);
      if (p.field.length > 0 || p.queue.length > 0) return addLog(state, 'Field/queue must be empty', 'error');
      return setPlayer(state, pid, { ...p, credits: Math.min(p.creditCap, p.credits + 2) });
    }
    if (num === 2) {
      const p = getPlayer(state, pid);
      const flooding = p.queue.map(c => ({ ...c, runtimeLeft: 0, glitchTokens: c.glitchTokens + 1 }));
      const canFit   = 3 - p.field.length;
      const entering = flooding.slice(0, canFit);
      let s = setPlayer(state, pid, { ...p, field: [...p.field, ...entering], queue: [] });
      return enforceAbsoluteRules(s);
    }
    if (num === 3) {
      const p = getPlayer(state, pid);
      const oppP = getPlayer(state, opp);
      if (p.field.length <= oppP.field.length) return addLog(state, 'Need more creations than opponent', 'error');
      let s = setPlayer(state, opp, { ...oppP, creator: { ...oppP.creator, loyalty: capLoy(oppP.creator.loyalty - 1) } });
      const pp = getPlayer(s, pid);
      s = setPlayer(s, pid, { ...pp, creator: { ...pp.creator, loyalty: capLoy(pp.creator.loyalty + 1) } });
      return s;
    }
    if (num === 'signature') {
      const p = getPlayer(state, pid);
      let loyDmg = 0;
      const newField = p.field.map(c => {
        const prev = c.visibility;
        const next = c.visibility + 3;
        if ((prev < 6 && next >= 6) || (prev < 10 && next >= 10)) loyDmg++;
        return { ...c, visibility: next };
      });
      let s = setPlayer(state, pid, { ...p, field: newField });
      for (let i = 0; i < loyDmg; i++) {
        const oppP = getPlayer(s, opp);
        s = setPlayer(s, opp, { ...oppP, creator: { ...oppP.creator, loyalty: capLoy(oppP.creator.loyalty - 1) } });
      }
      return s;
    }
  }

  return state;
}

// ─────────────────────────────────────────────────────────────
// Main reducer
// ─────────────────────────────────────────────────────────────

export function gameReducer(state: GameState, action: GameAction, allCards: Map<string, Card>): GameState {
  if (state.phase === 'game_over' && action.type !== 'START_GAME') return state;

  switch (action.type) {

    case 'START_GAME': {
      const human = buildPlayer('human', action.humanCreatorId, action.humanDeck, allCards);
      const ai    = buildPlayer('ai',    action.aiCreatorId,    action.aiDeck,    allCards);
      return {
        human, ai,
        sharedModels: [], artifactZone: [],
        turn: 1, round: 1,
        activePlayer: action.firstPlayer,
        phase: 'mulligan',
        mulliganPhase: { humanDone: false, aiDone: false },
        winner: null, log: [],
        abilityUsedThisTurn: [],
        favouritePromptActive: false,
      };
    }

    case 'MULLIGAN': {
      const p = getPlayer(state, action.player);
      const reshuffled = shuffle([...p.hand, ...p.deck]);
      let s = setPlayer(state, action.player, {
        ...p, hand: reshuffled.slice(0, 6), deck: reshuffled.slice(6), mulliganed: true,
      });
      s = addLog(s, `${action.player} mulliganed (drew 6)`, 'system');
      return advanceMulligan(s, action.player);
    }

    case 'KEEP_HAND': {
      let s = addLog(state, `${action.player} kept hand`, 'system');
      return advanceMulligan(s, action.player);
    }

    case 'PLAY_GUARANTEED_MODEL':
      return playModel(state, action.player, action.cardId, allCards, true);

    case 'PLAY_MODEL':
      return playModel(state, action.player, action.cardId, allCards, false);

    case 'ACTIVATE_MODEL':
      return activateModel(state, action.player, action.modelId, action.promptIds, allCards);

    case 'USE_CREATOR_ABILITY':
      return useAbility(state, action.player, action.abilityNum, action.targetId, allCards);

    case 'APPLY_CLIP_LOCK': {
      const p = getPlayer(state, action.player);
      const target = p.field.find(c => c.instanceId === action.creationId);
      if (!target || target.sourceModelId !== 'M-001') return addLog(state, 'CLIP-LOCK only on Coherent creations', 'error');
      return setPlayer(state, action.player, { ...p, field: p.field.map(c => c.instanceId === action.creationId ? { ...c, clipLocked: true } : c) });
    }

    case 'PLAY_MODIFIER': {
      const card = allCards.get(action.cardId);
      if (!card) return addLog(state, 'Card not found', 'error');
      const p = getPlayer(state, action.player);
      if (p.credits < (card.cost ?? 0)) return addLog(state, 'Not enough credits', 'error');
      return addLog(setPlayer(state, action.player, {
        ...p, credits: p.credits - (card.cost ?? 0),
        hand: p.hand.filter(c => c.id !== action.cardId),
        modifiers: [...p.modifiers, { cardId: action.cardId, turnsLeft: 'permanent', target: action.targetId }],
      }), `${action.player} plays modifier: ${card.name}`, 'action');
    }

    case 'PLAY_ARTIFACT': {
      const card = allCards.get(action.cardId);
      if (!card) return addLog(state, 'Card not found', 'error');
      const p = getPlayer(state, action.player);
      if (p.credits < (card.cost ?? 0)) return addLog(state, 'Not enough credits', 'error');
      let s = setPlayer(state, action.player, { ...p, credits: p.credits - (card.cost ?? 0), hand: p.hand.filter(c => c.id !== action.cardId) });
      s = { ...s, artifactZone: [...s.artifactZone, action.cardId] };
      return addLog(s, `${action.player} plays artifact: ${card.name}`, 'action');
    }

    case 'PLAY_EVENT': {
      if (state.round === 1) return addLog(state, 'No events in Round 1', 'error');
      const card = allCards.get(action.cardId);
      if (!card) return addLog(state, 'Card not found', 'error');
      const p = getPlayer(state, action.player);
      if (p.credits < (card.cost ?? 0)) return addLog(state, 'Not enough credits', 'error');
      return addLog(setPlayer(state, action.player, {
        ...p, credits: p.credits - (card.cost ?? 0),
        hand: p.hand.filter(c => c.id !== action.cardId),
        discard: [...p.discard, card],
      }), `${action.player} plays event: ${card.name}`, 'action');
    }

    case 'END_TURN': {
      let s = runEnd(state);
      if (s.phase === 'refresh') s = runRefresh(s, allCards);
      return s;
    }

    case 'TOGGLE_FAVOURITE_PROMPT':
      return { ...state, favouritePromptActive: !state.favouritePromptActive };

    case 'CONCEDE':
      return { ...state, phase: 'game_over', winner: action.player === 'human' ? 'ai' : 'human' };

    default:
      return state;
  }
}

function advanceMulligan(state: GameState, justActed: PlayerId): GameState {
  const newPhase = {
    ...state.mulliganPhase,
    [justActed === 'human' ? 'humanDone' : 'aiDone']: true,
  };

  // Both done?
  if (newPhase.humanDone && newPhase.aiDone) {
    // Bonus credits: if one mulliganed and the other didn't
    const hMul = state.human.mulliganed || (justActed === 'human' && state.log[0]?.text.includes('mulliganed'));
    const aMul = state.ai.mulliganed    || (justActed === 'ai'    && state.log[0]?.text.includes('mulliganed'));

    let s = { ...state, mulliganPhase: newPhase };

    if (hMul && !aMul) {
      s = setPlayer(s, 'ai',    { ...s.ai,    credits: s.ai.credits + 2    });
      s = addLog(s, 'AI gains 2 bonus credits (no mulligan)', 'system');
    } else if (!hMul && aMul) {
      s = setPlayer(s, 'human', { ...s.human, credits: s.human.credits + 2 });
      s = addLog(s, 'You gain 2 bonus credits (no mulligan)', 'system');
    }

    // Apply first-player credits and starting bonuses
    const fp = s.activePlayer;
    const sp: PlayerId = fp === 'human' ? 'ai' : 'human';
    s = setPlayer(s, fp, { ...getPlayer(s, fp), credits: Math.min(10, getPlayer(s, fp).credits + 4) });
    s = setPlayer(s, sp, { ...getPlayer(s, sp), credits: Math.min(10, getPlayer(s, sp).credits + 6) });

    // Transition straight to main phase for first player
    s = { ...s, phase: 'main' };
    s = addLog(s, `=== GAME START — ${fp.toUpperCase()} goes first ===`, 'system');
    return s;
  }

  return { ...state, mulliganPhase: newPhase };
}

// ─────────────────────────────────────────────────────────────
// Selectors
// ─────────────────────────────────────────────────────────────

export function selectCanUseAbility(state: GameState, pid: PlayerId, num: number | 'signature', allCards: Map<string, Card>): boolean {
  if (state.activePlayer !== pid || state.phase !== 'main') return false;
  if (state.abilityUsedThisTurn.includes(pid)) return false;
  const p = getPlayer(state, pid);
  const card = allCards.get(p.creator.cardId);
  const ab = card?.abilities?.find(a => a.num === num);
  if (!ab) return false;
  return p.creator.reputation >= (ab.cost.reputation ?? 0) && p.creator.loyalty >= (ab.cost.loyalty ?? 0);
}
