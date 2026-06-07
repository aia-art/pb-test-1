// ============================================================
// PROMPT BATTLE — Game Engine
// Implements all rules v0.14 card effects
// ============================================================
import { getCardById, PREBUILT_DECKS } from '../data';
import type { DecksStore } from '../types';
import type {
  GameState, PlayerState, CreationState, ModelState, ArtifactState,
  PlayerId, StyleTag, LogEntry, CreatorModifiers, SlotOverflowPending
} from './gameTypes';

// ── Constants ──────────────────────────────────────────────────────
export const CREDIT_CAP_DEFAULT = 10;
export const CREDIT_CAP_MAX = 13;
export const REP_CAP = 20;
export const MAX_ACTIVE = 3;
export const MAX_QUEUE = 2;

// ── ID generator ───────────────────────────────────────────────────
let _seq = 0;
export function uid(): string { return `${Date.now()}-${++_seq}`; }

// ── Deck storage ───────────────────────────────────────────────────
export function loadDeckStore(): DecksStore {
  try { return JSON.parse(localStorage.getItem('pb_decks') ?? '{"version":1,"decks":[]}'); }
  catch { return { version: 1, decks: [] }; }
}
export type DeckEntry = { id: string; name: string; creator: string | null; guaranteedModels: string[]; cards: Record<string,number> };
export function getAllDecks(): DeckEntry[] {
  const pb = PREBUILT_DECKS.map(d => ({ id: d.id, name: d.name, creator: d.creator, guaranteedModels: d.guaranteedModels, cards: d.cards }));
  const store = loadDeckStore();
  const custom = store.decks.map(d => ({ id: d.id, name: d.name, creator: d.creator, guaranteedModels: d.guaranteedModels ?? [], cards: d.cards }));
  return [...pb, ...custom];
}

// ── Shuffle ────────────────────────────────────────────────────────
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function buildDeck(cards: Record<string,number>): string[] {
  const arr: string[] = [];
  for (const [id, cnt] of Object.entries(cards)) for (let i=0;i<cnt;i++) arr.push(id);
  return shuffle(arr);
}

// ── Logging ────────────────────────────────────────────────────────
export function addLog(s: GameState, msg: string, type: LogEntry['type'] = 'action'): GameState {
  return { ...s, log: [...s.log.slice(-79), { id: uid(), msg, type, absTurn: s.absTurn }] };
}

// ── Resource helpers ───────────────────────────────────────────────
export function clampCredits(p: PlayerState): PlayerState {
  return { ...p, credits: Math.min(p.creditCap, Math.max(0, p.credits)) };
}
export function clampRep(p: PlayerState): PlayerState {
  return { ...p, reputation: Math.min(REP_CAP, Math.max(0, p.reputation)) };
}
function updPlayer(s: GameState, id: PlayerId, p: PlayerState): GameState {
  return { ...s, players: { ...s.players, [id]: p } };
}

// ── Effective style tag (Algorithm Swap) ───────────────────────────
export function effectiveStyle(tag: StyleTag | null, s: GameState): StyleTag | null {
  if (!tag || !s.algorithmSwap) return tag;
  const { style1, style2, expiresAbsTurn } = s.algorithmSwap;
  if (s.absTurn >= expiresAbsTurn) return tag;
  if (tag === style1) return style2;
  if (tag === style2) return style1;
  return tag;
}

// ── Effective quality of a creation ───────────────────────────────
export function effectiveQuality(c: CreationState): number {
  return Math.max(0, c.quality - c.glitchTokens);
}

// ── Reputation from a single creation ────────────────────────────
export function repFromCreation(c: CreationState, pid: PlayerId, s: GameState): number {
  if (!c.isOnField) return 0;
  if (effectiveQuality(c) <= 0) return 0;
  const player = s.players[pid];
  if (player.mods.ban) return 0;

  const vis = c.visibilityCounters;
  let base = 0;
  if (vis >= 10) base = 3;
  else if (vis >= 6) base = 2;
  else if (vis >= 3) base = 1;

  const eq = effectiveQuality(c);
  if (eq === 1) base = Math.max(0, base - 1);
  else if (eq >= 4) base += eq - 3;

  if (c.dragonHeadTurnsRemaining > 0) base = Math.floor(base / 2);
  if (c.featuredTurnsRemaining > 0) base *= 2;

  const eStyle = effectiveStyle(c.styleTag, s);
  if (eStyle === 'Abstract' && s.dailyChallengeAbstracts?.round === s.round) base *= 2;
  if (eStyle === 'Portrait' && s.dailyChallengePortraits?.round === s.round) base *= 2;
  if (player.mods.astronautExpiredHalfRepThisTurn) base = Math.floor(base / 2);

  return base;
}

// ── Destroy a creation ────────────────────────────────────────────
export function destroyCreation(s: GameState, pid: PlayerId, cid: string, fromSlotOverflow = false): GameState {
  let state = s;
  const p = { ...state.players[pid] };
  const creation =
    p.activeCreations.find(c => c.instanceId === cid) ||
    p.queue.find(c => c.instanceId === cid);
  if (!creation) return state;

  p.activeCreations = p.activeCreations.filter(c => c.instanceId !== cid);
  p.queue = p.queue.filter(c => c.instanceId !== cid);
  
  state = updPlayer(state, pid, p);
  state = addLog(state, `${pid === 'player' ? 'Player' : 'AI'}'s creation destroyed. Creator loses 1 Loyalty.`, 'damage');
  state = applyLoyaltyDamage(state, pid, 1);

  // MO-008 Featured: if a sibling creation got destroyed, that's not the featured one being destroyed
  // But we need to check: if the DESTROYED creation was featured, nothing extra
  // If a sibling gets a negative effect while featured exists, that's handled in addGlitchToken etc.
  return state;
}

// ── Check and destroy quality-0 creations ─────────────────────────
export function checkDestroyZeroQuality(s: GameState, pid: PlayerId): GameState {
  let state = s;
  const p = state.players[pid];
  const toDestroy = [
    ...p.activeCreations.filter(c => effectiveQuality(c) <= 0),
    ...p.queue.filter(c => effectiveQuality(c) <= 0),
  ];
  for (const c of toDestroy) {
    state = destroyCreation(state, pid, c.instanceId);
    if (state.phase === 'gameover') return state;
  }
  return state;
}

// ── Apply loyalty damage ───────────────────────────────────────────
export function applyLoyaltyDamage(s: GameState, pid: PlayerId, amount: number): GameState {
  let state = s;
  const p = { ...state.players[pid] };
  p.loyalty = Math.max(0, p.loyalty - amount);
  state = updPlayer(state, pid, p);
  if (p.loyalty <= 0) {
    const winner: PlayerId = pid === 'player' ? 'ai' : 'player';
    state = { ...state, phase: 'gameover', winner };
    state = addLog(state, `${pid === 'player' ? 'Player' : 'AI'} Loyalty reached 0 — ${winner === 'player' ? 'Player' : 'AI'} wins!`, 'system');
  }
  return state;
}

// ── Apply reputation ───────────────────────────────────────────────
export function applyRep(s: GameState, pid: PlayerId, amount: number): GameState {
  const p = { ...s.players[pid] };
  p.reputation = Math.min(REP_CAP, Math.max(0, p.reputation + amount));
  return updPlayer(s, pid, p);
}

// ── Apply credits ──────────────────────────────────────────────────
export function applyCredits(s: GameState, pid: PlayerId, amount: number): GameState {
  const p = clampCredits({ ...s.players[pid], credits: s.players[pid].credits + amount });
  return updPlayer(s, pid, p);
}

// ── Add glitch token to a creation ────────────────────────────────
export function addGlitch(
  s: GameState, pid: PlayerId, cid: string, fromOpponent: boolean
): GameState {
  let state = s;
  const p = { ...state.players[pid] };
  const findInAll = () =>
    p.activeCreations.find(c => c.instanceId === cid) ||
    p.queue.find(c => c.instanceId === cid);

  let creation = findInAll();
  if (!creation) return state;

  // Immunity checks (opponent effects)
  if (fromOpponent) {
    if (creation.clipLocked) return state;
    if (creation.immuneToOpponentUntilAbsTurn > state.absTurn) return state;
    if (creation.iridescShiftImmuneThisTurn) return state;
    if (creation.safetyInNumbersThisTurn) return state;
    // In remix queue: immune
    if (creation.isInRemixQueue) return state;
  }

  // JB glitch lock check
  if (creation.jbGlitchLockedUntilAbsTurn > state.absTurn) {
    // Can't remove the locked glitch, but can still add new ones
  }

  const updated: CreationState = { ...creation, glitchTokens: creation.glitchTokens + 1 };
  p.activeCreations = p.activeCreations.map(c => c.instanceId === cid ? updated : c);
  p.queue = p.queue.map(c => c.instanceId === cid ? updated : c);
  state = updPlayer(state, pid, p);

  // MO-008 Featured: negative effects on siblings also hit featured creation
  const featuredCreation = p.activeCreations.find(c => c.featuredTurnsRemaining > 0 && c.instanceId !== cid);
  if (featuredCreation && creation.isOnField) {
    state = addGlitch(state, pid, featuredCreation.instanceId, false);
  }

  state = checkDestroyZeroQuality(state, pid);
  return state;
}

// ── Add visibility counters to a creation ─────────────────────────
export function addVisibility(s: GameState, pid: PlayerId, cid: string, amount: number): GameState {
  let state = s;
  const p = { ...state.players[pid] };
  let creation = p.activeCreations.find(c => c.instanceId === cid);
  if (!creation) return state;

  const oldVis = creation.visibilityCounters;
  const newVis = oldVis + amount;
  const updated = { ...creation, visibilityCounters: newVis };
  p.activeCreations = p.activeCreations.map(c => c.instanceId === cid ? updated : c);
  state = updPlayer(state, pid, p);

  // Featured burst: first time reaching 10 vis → +5 rep
  if (!creation.featuredBurstTriggered && oldVis < 10 && newVis >= 10) {
    const pu = { ...state.players[pid] };
    pu.activeCreations = pu.activeCreations.map(c =>
      c.instanceId === cid ? { ...c, featuredBurstTriggered: true } : c
    );
    state = updPlayer(state, pid, pu);
    state = applyRep(state, pid, 5);
    state = addLog(state, `${pid}'s creation hits FEATURED! +5 Reputation burst!`, 'effect');
  }

  // MO-008 Featured: if vis drops below 6 while featured, lose 1 Quality and discard modifier
  const updated2 = state.players[pid].activeCreations.find(c => c.instanceId === cid);
  if (updated2 && updated2.featuredTurnsRemaining > 0 && updated2.visibilityCounters < 6) {
    const pu = { ...state.players[pid] };
    pu.activeCreations = pu.activeCreations.map(c =>
      c.instanceId === cid ? { ...c, featuredTurnsRemaining: 0, quality: Math.max(0, c.quality - 1) } : c
    );
    state = updPlayer(state, pid, pu);
    state = addLog(state, `Featured modifier removed — Visibility dropped below 6. Creation loses 1 Quality.`, 'effect');
    state = checkDestroyZeroQuality(state, pid);
  }

  return state;
}

// ── Remove one card from hand ──────────────────────────────────────
export function removeFromHand(p: PlayerState, cardId: string): PlayerState {
  const idx = p.hand.indexOf(cardId);
  if (idx === -1) return p;
  const hand = [...p.hand.slice(0, idx), ...p.hand.slice(idx + 1)];
  return { ...p, hand, discard: [...p.discard, cardId] };
}

// ── Draw a card ────────────────────────────────────────────────────
export function drawCard(s: GameState, pid: PlayerId, n = 1): GameState {
  let state = s;
  for (let i = 0; i < n; i++) {
    const p = { ...state.players[pid] };
    if (p.deck.length === 0) {
      if (p.hand.length === 0) {
        state = addLog(state, `${pid} has no cards — deck out! Game over.`, 'system');
        state = { ...state, phase: 'gameover', winner: pid === 'player' ? 'ai' : 'player' };
      }
      return state;
    }
    const [drawn, ...rest] = p.deck;
    p.deck = rest;
    p.hand = [...p.hand, drawn];
    state = updPlayer(state, pid, p);
  }
  return state;
}

// ── Init game state ────────────────────────────────────────────────
export function initGame(playerDeckId: string, aiDeckId: string): GameState {
  const allDecks = getAllDecks();
  const pDeck = allDecks.find(d => d.id === playerDeckId) ?? allDecks[0];
  const aDeck = allDecks.find(d => d.id === aiDeckId) ?? allDecks[1];

  const pCreator = getCardById(pDeck.creator ?? 'C-001');
  const aCreator = getCardById(aDeck.creator ?? 'C-002');

  // Build shuffled deck arrays (37-card decks)
  const pDeckArr = buildDeck(pDeck.cards);
  const aDeckArr = buildDeck(aDeck.cards);

  // Draw 7 cards opening hand (from deck)
  const pHand7 = pDeckArr.splice(0, 7);
  const aHand7 = aDeckArr.splice(0, 7);

  // Guaranteed models go into hand (set aside in physical game → in hand digitally)
  // They are NOT part of the shuffled deck, just added to hand
  const pHand = [...pDeck.guaranteedModels, ...pHand7];
  const aHand = [...aDeck.guaranteedModels, ...aHand7];

  function mkPlayer(id: PlayerId, deck: typeof pDeck, hand: string[], deckArr: string[]): PlayerState {
    const creator = id === 'player' ? pCreator : aCreator;
    return {
      id, creatorId: deck.creator ?? 'C-001',
      loyalty: creator?.loyalty ?? 11,
      reputation: 0, credits: 0, creditCap: CREDIT_CAP_DEFAULT,
      hand, deck: deckArr, discard: [],
      activeCreations: [], queue: [], remixQueue: null,
      mods: { ban: null, trending: null, astronaut: null, proSub: null, astronautExpiredHalfRepThisTurn: false },
      creatorExhaustedThisTurn: false, clipLockAppliedThisTurn: false,
      mulliganed: false, firstPostUsedThisTurn: false,
      repFromAbstractThisRound: 0, repFromPortraitThisRound: 0,
    };
  }

  return {
    phase: 'mulligan', absTurn: 0, round: 0,
    currentPlayer: 'player', turnPhase: 'refresh',
    players: {
      player: mkPlayer('player', pDeck, pHand, pDeckArr),
      ai: mkPlayer('ai', aDeck, aHand, aDeckArr),
    },
    sharedModels: [], artifacts: [], winner: null,
    log: [{ id: uid(), msg: 'Game ready — choose to keep or mulligan your hand (guaranteed models stay).', type: 'system', absTurn: 0 }],
    serverOverloadRounds: 0, queueTimeoutRounds: 0, centaurProblemRounds: 0,
    algorithmSwap: null, dailyChallengeAbstracts: null, dailyChallengePortraits: null,
    slotOverflowPending: null, pendingModifierPlay: null, lastOpponentActivation: null,
    mulligan: { player: 'pending', ai: 'pending' },
    playerDeckId, aiDeckId,
  };
}

// ── Apply mulligan decision ────────────────────────────────────────
export function applyMulligan(s: GameState, pid: PlayerId, doMulligan: boolean): GameState {
  let state = s;
  const mul = { ...state.mulligan, [pid]: doMulligan ? 'yes' : 'no' as const };
  state = { ...state, mulligan: mul };

  if (doMulligan) {
    const p = { ...state.players[pid] };
    // Shuffle non-model hand cards back into deck (keep guaranteed models)
    const deck = state[pid === 'player' ? 'playerDeckId' : 'aiDeckId'];
    const deckEntry = getAllDecks().find(d => d.id === deck);
    const guaranteed = deckEntry?.guaranteedModels ?? [];
    const models = p.hand.filter(id => guaranteed.includes(id));
    const nonModels = p.hand.filter(id => !guaranteed.includes(id));
    const newDeck = shuffle([...p.deck, ...nonModels]);
    p.deck = newDeck;
    p.hand = [...models, ...newDeck.splice(0, 6)];
    p.deck = newDeck;
    p.mulliganed = true;
    state = updPlayer(state, pid, p);
    state = addLog(state, `${pid === 'player' ? 'Player' : 'AI'} mulliganed — drew 6 new cards (models kept).`, 'system');
  }

  if (mul.player !== 'pending' && mul.ai !== 'pending') {
    state = finishMulligan(state);
  }
  return state;
}

function finishMulligan(s: GameState): GameState {
  let state = s;
  const pMul = state.mulligan.player === 'yes';
  const aMul = state.mulligan.ai === 'yes';

  // Random first player
  const firstPlayer: PlayerId = Math.random() < 0.5 ? 'player' : 'ai';
  const secondPlayer: PlayerId = firstPlayer === 'player' ? 'ai' : 'player';

  // Starting credits: first player 4, second 6
  const credits: Record<PlayerId, number> = { player: 0, ai: 0 };
  credits[firstPlayer] = 4;
  credits[secondPlayer] = 6;

  // Mulligan bonus: if one mulliganed and other didn't, non-mulligan gets +2
  if (pMul && !aMul) credits['ai'] = Math.min(10, credits['ai'] + 2);
  if (aMul && !pMul) credits['player'] = Math.min(10, credits['player'] + 2);

  // Apply starting bonuses from creator cards
  let pp = { ...state.players.player, credits: credits.player };
  let pa = { ...state.players.ai, credits: credits.ai };

  const pCreator = getCardById(pp.creatorId);
  const aCreator = getCardById(pa.creatorId);
  if (pCreator?.startingBonus) {
    if (pCreator.startingBonus.type === 'credit') pp.credits = Math.min(pp.creditCap, pp.credits + pCreator.startingBonus.amount);
    else pp.reputation = Math.min(REP_CAP, pp.reputation + pCreator.startingBonus.amount);
  }
  if (aCreator?.startingBonus) {
    if (aCreator.startingBonus.type === 'credit') pa.credits = Math.min(pa.creditCap, pa.credits + aCreator.startingBonus.amount);
    else pa.reputation = Math.min(REP_CAP, pa.reputation + aCreator.startingBonus.amount);
  }

  state = { ...state, players: { player: pp, ai: pa }, phase: 'playing', currentPlayer: firstPlayer, absTurn: 1, round: 1, turnPhase: 'refresh' };
  state = addLog(state, `${firstPlayer === 'player' ? 'Player' : 'AI'} goes first! Round 1 begins.`, 'system');
  return state;
}

// ────────────────────────────────────────────────────────────────────
// REFRESH PHASE
// ────────────────────────────────────────────────────────────────────
export function runRefreshPhase(s: GameState): GameState {
  let state = s;
  const pid = state.currentPlayer;
  let p = { ...state.players[pid] };

  state = addLog(state, `── ${pid === 'player' ? 'Player' : 'AI'} REFRESH PHASE (Round ${state.round}, Turn ${state.absTurn}) ──`, 'system');

  // Reset per-turn flags
  p.creatorExhaustedThisTurn = false;
  p.clipLockAppliedThisTurn = false;
  p.firstPostUsedThisTurn = false;
  if (p.mods.proSub) p.mods = { ...p.mods, proSub: { ...p.mods.proSub, halfCostUsedThisTurn: false } };
  state = updPlayer(state, pid, p);

  // Reset creation per-turn flags
  let pAfter = { ...state.players[pid] };
  pAfter.activeCreations = pAfter.activeCreations.map(c => ({
    ...c,
    iridescShiftImmuneThisTurn: false,
    safetyInNumbersThisTurn: false,
  }));
  state = updPlayer(state, pid, pAfter);

  // Step 1 — Gain 5 Credits + carryover
  p = { ...state.players[pid] };
  const baseGain = 5;
  let proBonus = 0;
  if (p.mods.proSub) proBonus = 1;
  p.credits = Math.min(p.creditCap, p.credits + baseGain + proBonus);
  state = updPlayer(state, pid, p);

  // Step 2 — Reduce Runtime for all queue creations
  p = { ...state.players[pid] };
  // Also reduce remix queue runtime (it returns after remix resolves, treated as 1 turn)
  p.queue = p.queue.map(c => {
    let rt = c.runtime - 1;
    if (state.queueTimeoutRounds > 0 && !c.isInRemixQueue) {
      rt += 1; // Queue Timeout adds 1 (net 0 reduction, already applied when queued)
      // Actually the artifact adds 1 at creation time. We just reduce by 1 each turn normally.
      rt += 1; // Undo our reduction since timeout means it doesn't reduce
      rt -= 1; // Actually let's just not reduce by 1 when timeout active
      // Correction: Timeout artifact means all runtimes are +1 from when it becomes active.
      // The net effect is runtime reduces by 1 per turn normally, but the runtime was set +1 on creation.
      // So we just reduce normally.
      rt = c.runtime - 1;
    }
    return { ...c, runtime: Math.max(0, rt) };
  });
  // Handle remix queue: it returns after 1 turn
  if (p.remixQueue) {
    const rq = { ...p.remixQueue, runtime: Math.max(0, p.remixQueue.runtime - 1) };
    p.remixQueue = rq;
  }
  state = updPlayer(state, pid, p);

  // Step 3 — Creations with runtime 0 enter field
  p = { ...state.players[pid] };
  const entering = p.queue.filter(c => c.runtime <= 0 && !c.isInRemixQueue);
  p.queue = p.queue.filter(c => c.runtime > 0 || c.isInRemixQueue);
  state = updPlayer(state, pid, p);

  for (const c of entering) {
    state = enterCreation(state, pid, c);
    if (state.phase === 'gameover') return state;
  }

  // Return from remix queue
  p = { ...state.players[pid] };
  if (p.remixQueue && p.remixQueue.runtime <= 0) {
    const remixed = { ...p.remixQueue, isInRemixQueue: false, isOnField: false, runtime: 0 };
    p.remixQueue = null;
    state = updPlayer(state, pid, p);
    state = enterCreation(state, pid, remixed);
    if (state.phase === 'gameover') return state;
  } else {
    state = updPlayer(state, pid, p);
  }

  // Step 4 — Gain Visibility
  p = { ...state.players[pid] };
  const visGain = state.serverOverloadRounds > 0 ? 0 : 1;
  p.activeCreations = p.activeCreations.map(c => ({ ...c, visibilityCounters: c.visibilityCounters + visGain }));
  // Astronaut: extra visibility
  if (p.mods.astronaut) {
    p.activeCreations = p.activeCreations.map(c => ({ ...c, visibilityCounters: c.visibilityCounters + 1 }));
  }
  // Anon's favourite prompt: +2 vis for first 2 turns on field
  p.activeCreations = p.activeCreations.map(c => {
    if (c.anonFavPromptVisBonusTurns > 0) {
      return { ...c, visibilityCounters: c.visibilityCounters + 2, anonFavPromptVisBonusTurns: c.anonFavPromptVisBonusTurns - 1 };
    }
    return c;
  });
  state = updPlayer(state, pid, p);

  // Check featured bursts (visibility changed)
  for (const c of state.players[pid].activeCreations) {
    if (!c.featuredBurstTriggered && c.visibilityCounters >= 10) {
      state = applyRep(state, pid, 5);
      const pu = { ...state.players[pid] };
      pu.activeCreations = pu.activeCreations.map(x => x.instanceId === c.instanceId ? { ...x, featuredBurstTriggered: true } : x);
      state = updPlayer(state, pid, pu);
      state = addLog(state, `${pid}'s creation reaches FEATURED (10+ vis)! +5 Reputation burst!`, 'effect');
    }
  }

  // MO-008 Featured: check vis dropped below 6
  for (const c of state.players[pid].activeCreations) {
    if (c.featuredTurnsRemaining > 0 && c.visibilityCounters < 6) {
      const pu = { ...state.players[pid] };
      pu.activeCreations = pu.activeCreations.map(x =>
        x.instanceId === c.instanceId ? { ...x, featuredTurnsRemaining: 0, quality: Math.max(0, x.quality - 1) } : x
      );
      state = updPlayer(state, pid, pu);
      state = addLog(state, `Featured modifier removed — vis < 6. Creation loses 1 Quality.`, 'effect');
      state = checkDestroyZeroQuality(state, pid);
    }
  }

  // Step 5 — Collect Reputation
  p = { ...state.players[pid] };
  let totalRep = 0;
  let abstractRep = 0;
  let portraitRep = 0;
  for (const c of p.activeCreations) {
    const rep = repFromCreation(c, pid, state);
    totalRep += rep;
    const eStyle = effectiveStyle(c.styleTag, state);
    if (eStyle === 'Abstract') abstractRep += rep;
    if (eStyle === 'Portrait') portraitRep += rep;
  }
  if (totalRep > 0) {
    state = applyRep(state, pid, totalRep);
    state = addLog(state, `${pid} collects ${totalRep} Reputation from ${state.players[pid].activeCreations.length} creation(s).`, 'effect');
  }
  p = { ...state.players[pid] };
  p.repFromAbstractThisRound += abstractRep;
  p.repFromPortraitThisRound += portraitRep;
  state = updPlayer(state, pid, p);

  // Step 6 — Passive effects
  // Anon's Influence (Safety in Numbers): all friendly creations with ≤3 vis become immune
  if (state.players[pid].creatorId === 'C-002') {
    const pu = { ...state.players[pid] };
    pu.activeCreations = pu.activeCreations.map(c =>
      c.visibilityCounters <= 3 ? { ...c, safetyInNumbersThisTurn: true } : c
    );
    state = updPlayer(state, pid, pu);
  }

  // Tick creator modifiers
  state = tickCreatorModifiers(state, pid);

  // Tick model modifiers
  state = tickModelModifiers(state);

  // Tick featured modifier on creations
  p = { ...state.players[pid] };
  p.activeCreations = p.activeCreations.map(c =>
    c.featuredTurnsRemaining > 0 ? { ...c, featuredTurnsRemaining: c.featuredTurnsRemaining - 1 } : c
  );
  p.activeCreations = p.activeCreations.map(c =>
    c.dragonHeadTurnsRemaining > 0 ? { ...c, dragonHeadTurnsRemaining: c.dragonHeadTurnsRemaining - 1 } : c
  );
  // Iridescent Shift immunity expires
  p.activeCreations = p.activeCreations.map(c => ({ ...c, iridescShiftImmuneThisTurn: false }));
  state = updPlayer(state, pid, p);

  // Step 7 — Creator Stress (Turn 2+ only, absTurn > 1 means past round 1)
  if (state.absTurn > 2) { // After first round (both players had turn 1)
    const pp = state.players[pid];
    const hasCreations = pp.activeCreations.length > 0 || pp.queue.length > 0 || pp.remixQueue !== null;
    if (!hasCreations) {
      state = addLog(state, `${pid} has no creations — Creator Stress! Loses 1 Loyalty.`, 'damage');
      state = applyLoyaltyDamage(state, pid, 1);
    }
  }

  // Centaur Problem: at start of each round (first player's refresh), add glitch to Fantasy
  if (state.centaurProblemRounds > 0 && pid === state.currentPlayer) {
    // This is done per round, check if it's the first player's turn
    for (const otherPid of ['player', 'ai'] as PlayerId[]) {
      const other = state.players[otherPid];
      for (const c of other.activeCreations) {
        if (effectiveStyle(c.styleTag, state) === 'Fantasy') {
          state = addGlitch(state, otherPid, c.instanceId, false);
          if (state.phase === 'gameover') return state;
        }
      }
    }
  }

  state = { ...state, turnPhase: 'main' };
  return state;
}

function tickCreatorModifiers(s: GameState, pid: PlayerId): GameState {
  let state = s;
  let p = { ...state.players[pid] };
  const mods = { ...p.mods };

  // Ban
  if (mods.ban) {
    mods.ban = { turnsRemaining: mods.ban.turnsRemaining - 1 };
    if (mods.ban.turnsRemaining <= 0) { mods.ban = null; state = addLog(state, `${pid}'s Ban expired.`, 'effect'); }
  }
  // Trending
  if (mods.trending) {
    // Trending is measured in rounds
    // We decrement on the player's refresh phase each round
    // Simple: decrement turnsRemaining
    mods.trending = { roundsRemaining: mods.trending.roundsRemaining - 1 };
    if (mods.trending.roundsRemaining <= 0) { mods.trending = null; state = addLog(state, `${pid}'s Trending modifier expired.`, 'effect'); }
  }
  // Astronaut
  if (mods.astronaut) {
    mods.astronaut = { turnsRemaining: mods.astronaut.turnsRemaining - 1 };
    if (mods.astronaut.turnsRemaining <= 0) {
      mods.astronaut = null;
      mods.astronautExpiredHalfRepThisTurn = true;
      // On detach: all active creations get +1 glitch (CLIP-LOCK doesn't block)
      p.mods = mods;
      state = updPlayer(state, pid, p);
      for (const c of state.players[pid].activeCreations) {
        state = addGlitch(state, pid, c.instanceId, false); // own effect, not from opponent
      }
      state = addLog(state, `Astronaut detached from ${pid}'s Creator! All creations gain 1 Glitch. Rep halved next turn.`, 'effect');
      p = { ...state.players[pid] };
      mods.astronaut = p.mods.astronaut;
      mods.astronautExpiredHalfRepThisTurn = p.mods.astronautExpiredHalfRepThisTurn;
    }
  } else {
    mods.astronautExpiredHalfRepThisTurn = false;
  }
  // PRO Sub
  if (mods.proSub) {
    mods.proSub = { ...mods.proSub, turnsRemaining: mods.proSub.turnsRemaining - 1 };
    if (mods.proSub.turnsRemaining <= 0) {
      const prevCredits = state.players[pid].credits;
      mods.proSub = null;
      p.creditCap = CREDIT_CAP_DEFAULT;
      p.mods = mods;
      state = updPlayer(state, pid, p);
      state = addLog(state, `${pid}'s PRO Subscription expired. Credit cap returns to 10.`, 'effect');
      if (prevCredits > 10) {
        state = applyRep(state, pid, -5);
        state = addLog(state, `${pid} had >10 Credits at PRO expiry — loses 5 Reputation.`, 'effect');
        if (state.players[pid].reputation <= 0) {
          state = applyLoyaltyDamage(state, pid, 1);
          const pu = { ...state.players[pid] };
          pu.reputation = 0;
          state = updPlayer(state, pid, pu);
          state = addLog(state, `${pid}'s Reputation hit 0 — loses 1 Loyalty, reset to 0.`, 'damage');
        }
      }
      // Excess credits lost (cap enforcement)
      const pu = clampCredits({ ...state.players[pid] });
      state = updPlayer(state, pid, pu);
      p = { ...state.players[pid] };
      mods.proSub = p.mods.proSub;
    }
  }

  p.mods = mods;
  return updPlayer(state, pid, p);
}

function tickModelModifiers(s: GameState): GameState {
  let state = s;
  state = { ...state, sharedModels: state.sharedModels.map(m => ({
    ...m,
    noiseTurnsRemaining: Math.max(0, m.noiseTurnsRemaining - 1),
  }))};
  return state;
}

// ── Creation enters the field ──────────────────────────────────────
function enterCreation(s: GameState, pid: PlayerId, c: CreationState): GameState {
  let state = s;
  const p = { ...state.players[pid] };

  if (p.activeCreations.length >= MAX_ACTIVE) {
    // Slot Overflow
    state = addLog(state, `Slot Overflow! ${pid} has 3 active creations.`, 'system');
    if (pid === 'ai') {
      // AI auto-destroys lowest effective quality creation
      const sorted = [...p.activeCreations].sort((a, b) => effectiveQuality(a) - effectiveQuality(b));
      const toDestroy = sorted[0];
      state = destroyCreation(state, pid, toDestroy.instanceId, true);
      if (state.phase === 'gameover') return state;
      const pu = { ...state.players[pid] };
      pu.activeCreations = [...pu.activeCreations, { ...c, isOnField: true, runtime: 0 }];
      state = updPlayer(state, pid, pu);
    } else {
      // Player must choose — set pending
      state = { ...state, slotOverflowPending: { incomingCreation: c, playerId: pid } };
    }
    return state;
  }

  p.activeCreations = [...p.activeCreations, { ...c, isOnField: true, runtime: 0 }];
  state = updPlayer(state, pid, p);

  // Anon passive (Copycat): if new creation shares style with opponent's active creation, steal 2 vis
  if (state.players[pid].creatorId === 'C-002') {
    const oppId: PlayerId = pid === 'player' ? 'ai' : 'player';
    const opp = state.players[oppId];
    const newStyle = effectiveStyle(c.styleTag, state);
    const eligible = opp.activeCreations.filter(oc => effectiveStyle(oc.styleTag, state) === newStyle);
    if (eligible.length > 0) {
      // Steal from one (choose one with most vis)
      const target = eligible.sort((a, b) => b.visibilityCounters - a.visibilityCounters)[0];
      const stolen = Math.min(2, target.visibilityCounters);
      if (stolen > 0) {
        const ou = { ...state.players[oppId] };
        ou.activeCreations = ou.activeCreations.map(oc =>
          oc.instanceId === target.instanceId ? { ...oc, visibilityCounters: oc.visibilityCounters - stolen } : oc
        );
        state = updPlayer(state, oppId, ou);
        state = addVisibility(state, pid, c.instanceId, stolen);
        state = addLog(state, `Anon's Copycat! Stole ${stolen} Visibility from opponent.`, 'effect');
      }
    }
  }

  // Daily Challenge Portraits: each Portrait entering gets +1 vis
  if (s.dailyChallengePortraits?.round === s.round && effectiveStyle(c.styleTag, state) === 'Portrait') {
    state = addVisibility(state, pid, c.instanceId, 1);
  }

  state = checkDestroyZeroQuality(state, pid);
  return state;
}

// ── Resolve slot overflow (player choice) ─────────────────────────
export function resolveSlotOverflow(s: GameState, destroyExistingId?: string): GameState {
  let state = s;
  if (!state.slotOverflowPending) return state;
  const { incomingCreation, playerId } = state.slotOverflowPending;
  state = { ...state, slotOverflowPending: null };

  if (destroyExistingId) {
    // Destroy an existing creation, then add incoming
    state = destroyCreation(state, playerId, destroyExistingId, true);
    if (state.phase === 'gameover') return state;
    const p = { ...state.players[playerId] };
    p.activeCreations = [...p.activeCreations, { ...incomingCreation, isOnField: true, runtime: 0 }];
    state = updPlayer(state, playerId, p);
  } else {
    // Destroy incoming (it never made it to field)
    state = addLog(state, `Incoming creation rejected — Creator loses 1 Loyalty.`, 'damage');
    state = applyLoyaltyDamage(state, playerId, 1);
  }
  return state;
}

// ── Compute creation stats when activating a model ─────────────────
export function computeCreationOnActivation(
  state: GameState, pid: PlayerId,
  modelCardId: string,
  promptIds: string[],
  useFavPrompt: boolean,
  modelInstance: ModelState,
): CreationState {
  const modelCard = getCardById(modelCardId)!;
  const p = state.players[pid];

  let quality = modelCard.quality ?? 1;
  let glitch = 0;
  let vis = 0;
  let runtime = modelCard.runtime ?? 1;
  let styleTag: StyleTag | null = null;
  let immuneUntilAbsTurn = 0;
  let anonFavPromptVisBonusTurns = 0;
  let jbGlitchLockedUntil = 0;
  let watermarkImmune = false;
  const usedPromptIds: string[] = [];

  // PRO Sub: reduce runtime by 1
  if (p.mods.proSub) runtime = Math.max(1, runtime - 1);
  // Queue Timeout: runtime +1 (already added to existing queue when artifact was played, future creations too)
  if (state.queueTimeoutRounds > 0) runtime += 1;

  // SD1.5 always adds 1 glitch
  if (modelCardId === 'M-004') glitch += 1;

  // Coherent (M-001): +1 Visibility Counter on entry
  if (modelCardId === 'M-001') vis += 1;

  // Queue Skip: bypass runtime
  let bypassed = false;
  if (modelInstance.queueSkipReady) {
    runtime = 0;
    bypassed = true;
  }

  // Process prompts (max 2, different subtypes)
  for (const pid2 of promptIds) {
    const pc = getCardById(pid2);
    if (!pc) continue;
    usedPromptIds.push(pid2);

    switch (pid2) {
      case 'P-001': // Good Old Greg — Artist, assigns Fantasy
        if (styleTag === 'Fantasy') quality += 1;
        else styleTag = 'Fantasy';
        if (modelCardId === 'M-004') vis += 1;
        break;
      case 'P-002': // Men... — Style, Portrait, +1 vis
        styleTag = 'Portrait';
        vis += 1;
        break;
      case 'P-003': // Copygazelle — Negative, 3-turn immunity
        immuneUntilAbsTurn = state.absTurn + 3;
        break;
      case 'P-004': // Did You Steal This Prompt — Artist, +2 vis, +1 locked glitch
        vis += 2; glitch += 1;
        jbGlitchLockedUntil = state.absTurn + 2;
        break;
      case 'P-005': // Here Goes the Paragraph — Atmosphere, +2 glitch, +2 vis
        glitch += 2; vis += 2;
        break;
      case 'P-006': // Are You Crazy?! — Style, +3 Quality, +1 Runtime
        quality += 3; runtime += 1;
        break;
      case 'P-007': // What's Wrong with the Hands — Negative, +1 Quality
        quality += 1;
        break;
      case 'P-008': // So That's How They Trained It — Negative, +1 Quality, watermark immune
        quality += 1; watermarkImmune = true;
        break;
      case 'P-009': // Another Landscape — Style, assigns Landscape
        styleTag = 'Landscape';
        break;
      case 'P-010': // What's That — Artist, +2 vis, +1 glitch
        vis += 2; glitch += 1;
        break;
    }
  }

  // Favourite prompt (treated as one of the 2 prompts)
  if (useFavPrompt) {
    const creator = getCardById(pid === 'player' ? state.players.player.creatorId : state.players.ai.creatorId);
    if (creator?.id === 'C-001') {
      // Aia: Atmosphere, +1 Quality, +1 vis
      quality += 1; vis += 1;
    } else if (creator?.id === 'C-002') {
      // Anon: Style (Portrait), +2 vis for first 2 turns, +1 glitch
      styleTag = 'Portrait';
      glitch += 1;
      anonFavPromptVisBonusTurns = 2;
    }
  }

  // If no style prompt, pick from compatible list (default first compatible)
  if (!styleTag && modelCard.compatible && modelCard.compatible.length > 0) {
    styleTag = modelCard.compatible[0] as StyleTag;
  }

  // Style compatibility check
  const compat = modelCard.compatible as StyleTag[] ?? [];
  const incompat = modelCard.incompatible as StyleTag[] ?? [];
  const eStyle = effectiveStyle(styleTag, state);
  if (eStyle && compat.includes(eStyle)) quality += 1;
  if (eStyle && incompat.includes(eStyle)) glitch += 1;

  // Centaur Problem: Fantasy creations entering get +1 glitch
  if (state.centaurProblemRounds > 0 && eStyle === 'Fantasy') glitch += 1;

  // LoRA effects on the model
  if (modelInstance.loraCardId) {
    switch (modelInstance.loraCardId) {
      case 'MO-002': // Anime LoRA: Portrait/Fantasy +1 Quality, Landscape -1 Quality
        if (eStyle === 'Portrait' || eStyle === 'Fantasy') quality += 1;
        if (eStyle === 'Landscape') quality = Math.max(1, quality - 1);
        break;
      case 'MO-003': // Painting LoRA: Abstract/Atmosphere +1 Quality, +1 vis
        if (eStyle === 'Abstract' || eStyle === 'Atmosphere') { quality += 1; vis += 1; }
        break;
      case 'MO-004': // Realism LoRA: Portrait +2 Quality, +1 Runtime
        if (eStyle === 'Portrait') { quality += 2; runtime += 1; }
        break;
    }
  }

  // Noise (MO-010): -1 Quality (min 1)
  if (modelInstance.noiseTurnsRemaining > 0) quality = Math.max(1, quality - 1);

  // Server Overload: no extra effect on creation entry (just activation cost)

  // Juggernaut v9 (M-002): Abstract +1 Quality
  if (modelCardId === 'M-002' && eStyle === 'Abstract') quality += 1;

  // SDXL (M-003): Portrait → +1 vis, +1 glitch
  if (modelCardId === 'M-003' && eStyle === 'Portrait') { vis += 1; glitch += 1; }

  // Trending modifier
  const playerState = state.players[pid];
  if (playerState.mods.trending) vis += 1;
  // Astronaut
  if (playerState.mods.astronaut) vis += 2;

  return {
    instanceId: uid(),
    modelId: modelCardId,
    quality, glitchTokens: glitch, visibilityCounters: vis,
    styleTag: eStyle, runtime, isOnField: false,
    clipLocked: false, clipLockAppliedAbsTurn: 0,
    promptsUsed: usedPromptIds, loraUsed: modelInstance.loraCardId,
    immuneToOpponentUntilAbsTurn: immuneUntilAbsTurn,
    iridescShiftImmuneThisTurn: false, featuredBurstTriggered: false,
    anonFavPromptVisBonusTurns, jbGlitchLockedUntilAbsTurn: jbGlitchLockedUntil,
    watermarkImmune, safetyInNumbersThisTurn: false,
    featuredTurnsRemaining: 0, dragonHeadTurnsRemaining: 0,
    isInRemixQueue: false, remixNewStyle: null,
  };
}

// ────────────────────────────────────────────────────────────────────
// MAIN PHASE ACTIONS
// ────────────────────────────────────────────────────────────────────

// ── Play a Model card ──────────────────────────────────────────────
export function playModel(s: GameState, cardId: string): GameState {
  let state = s;
  const pid = state.currentPlayer;
  const card = getCardById(cardId);
  if (!card) return state;
  const p = { ...state.players[pid] };
  const cost = card.playCost ?? 0;
  if (p.credits < cost) return addLog(state, 'Not enough credits to play model.', 'system');
  p.credits -= cost;
  const hand = [...p.hand];
  const idx = hand.indexOf(cardId);
  if (idx === -1) return addLog(state, 'Card not in hand.', 'system');
  hand.splice(idx, 1);
  p.hand = hand;
  const newModel: ModelState = {
    instanceId: uid(), cardId, ownerId: pid,
    loraCardId: null, noiseTurnsRemaining: 0, queueSkipReady: false,
    activationsThisRound: 0, activatedThisTurnBy: null,
  };
  state = updPlayer(state, pid, { ...p, hand });
  state = { ...state, sharedModels: [...state.sharedModels, newModel] };
  state = addLog(state, `${pid} played Model: ${card.name} (cost: ${cost} Credits).`, 'action');
  return state;
}

// ── Activate a Model ───────────────────────────────────────────────
export function activateModel(
  s: GameState, modelInstanceId: string, promptIds: string[], useFavPrompt: boolean
): GameState {
  let state = s;
  const pid = state.currentPlayer;
  const model = state.sharedModels.find(m => m.instanceId === modelInstanceId);
  if (!model) return addLog(state, 'Model not found.', 'system');

  // Activation rules: player who placed can activate turn they placed (round 1)
  // From round 2 onwards, both players can activate
  const isOwner = model.ownerId === pid;
  if (!isOwner && state.round < 2) {
    return addLog(state, 'Cannot activate opponent models in Round 1.', 'system');
  }
  if (model.activatedThisTurnBy !== null) {
    return addLog(state, 'This model was already activated this turn.', 'system');
  }

  const p = { ...state.players[pid] };
  const card = getCardById(model.cardId)!;
  let activateCost = card.activateCost ?? 0;

  // LoRA surcharge: +1 per LoRA
  if (model.loraCardId) activateCost += 1;
  // PRO Sub: half cost (once per turn)
  if (p.mods.proSub && !p.mods.proSub.halfCostUsedThisTurn) {
    activateCost = Math.floor(activateCost / 2);
    p.mods = { ...p.mods, proSub: { ...p.mods.proSub!, halfCostUsedThisTurn: true } };
  }
  // Server Overload: +1 credit
  if (state.serverOverloadRounds > 0) activateCost += 1;

  if (p.credits < activateCost) return addLog(state, 'Not enough credits to activate model.', 'system');

  // Check prompt limit and validity
  // Max 2 prompts, each of different subtype
  const allPromptIds = useFavPrompt ? [...promptIds, '__fav__'] : promptIds;
  const subtypes = new Set<string>();
  for (const pId of promptIds) {
    const pc = getCardById(pId);
    if (!pc) return addLog(state, `Prompt ${pId} not found.`, 'system');
    if (!p.hand.includes(pId)) return addLog(state, `Prompt ${pId} not in hand.`, 'system');
    const subtype = pc.promptType ?? pc.subtype ?? '';
    if (subtypes.has(subtype)) return addLog(state, `Cannot use two ${subtype} prompts.`, 'system');
    subtypes.add(subtype);
  }
  if (useFavPrompt) {
    const favSubtype = state.players[pid].creatorId === 'C-001' ? 'Atmosphere' : 'Style';
    if (subtypes.has(favSubtype)) return addLog(state, `Cannot use two ${favSubtype} prompts.`, 'system');
  }
  if (promptIds.length > (useFavPrompt ? 1 : 2)) {
    return addLog(state, 'Too many prompts.', 'system');
  }

  // Pay for prompts + apply First Post discount
  let totalCost = activateCost;
  for (const pid2 of promptIds) {
    const pc = getCardById(pid2);
    totalCost += pc?.cost ?? 0;
  }
  // First Post: -2 credits on this activation (Anon ability 1)
  if (p.firstPostUsedThisTurn) {
    totalCost = Math.max(0, totalCost - 2);
    p.firstPostUsedThisTurn = false; // consumed
  }
  if (p.credits < totalCost) return addLog(state, 'Not enough credits for activation.', 'system');

  p.credits -= totalCost;

  // Remove prompts from hand
  let hand = [...p.hand];
  for (const pid2 of promptIds) {
    const idx = hand.indexOf(pid2);
    if (idx !== -1) hand.splice(idx, 1);
  }
  p.hand = hand;

  state = updPlayer(state, pid, p);

  // Contention: if this model has been activated once already this round, +1 Runtime to the new creation
  const contention = model.activationsThisRound >= 1;

  // Build creation
  const creation = computeCreationOnActivation(state, pid, model.cardId, promptIds, useFavPrompt, model);

  // Mark model as activated this turn
  const models = state.sharedModels.map(m =>
    m.instanceId === modelInstanceId
      ? { ...m, activationsThisRound: m.activationsThisRound + 1, activatedThisTurnBy: pid }
      : m
  );

  // Queue Skip consumed
  if (model.queueSkipReady) {
    state = { ...state, sharedModels: models.map(m => m.instanceId === modelInstanceId ? { ...m, queueSkipReady: false } : m) };
  } else {
    state = { ...state, sharedModels: models };
  }

  // Contention: +1 runtime to this creation
  const finalCreation = contention ? { ...creation, runtime: creation.runtime + 1 } : creation;

  state = addLog(state, `${pid} activated ${card.name}. Creation queued (Quality ${finalCreation.quality}, Runtime ${finalCreation.runtime}).`, 'action');

  // Last opponent activation tracking (for Prompt Theft)
  state = { ...state, lastOpponentActivation: { modelId: model.cardId, promptIds } };

  // Add to queue or field
  const pCurrent = state.players[pid];
  if (finalCreation.runtime <= 0) {
    // Enters field immediately (Queue Skip)
    state = enterCreation(state, pid, finalCreation);
  } else {
    if (pCurrent.queue.length >= MAX_QUEUE) {
      return addLog(state, 'Queue is full (max 2 creations).', 'system');
    }
    const pu = { ...state.players[pid], queue: [...state.players[pid].queue, finalCreation] };
    state = updPlayer(state, pid, pu);
  }

  state = checkDestroyZeroQuality(state, pid);
  return state;
}

// ── Play Modifier ──────────────────────────────────────────────────
export function playModifier(
  s: GameState, cardId: string, targetId: string, targetType: 'creator' | 'model' | 'creation'
): GameState {
  let state = s;
  const pid = state.currentPlayer;
  const card = getCardById(cardId);
  if (!card) return state;
  const p = { ...state.players[pid] };
  if (!p.hand.includes(cardId)) return addLog(state, 'Card not in hand.', 'system');
  const cost = card.cost ?? 0;
  if (p.credits < cost) return addLog(state, 'Not enough credits.', 'system');

  p.credits -= cost;
  const hand = [...p.hand]; hand.splice(hand.indexOf(cardId), 1);
  p.hand = hand;
  state = updPlayer(state, pid, p);

  switch (cardId) {
    case 'MO-001': { // The Astronaut — Universal Creator Modifier
      // Target: friendly creator
      const tp = targetId as PlayerId;
      const target = { ...state.players[tp] };
      target.loyalty = Math.min(target.loyalty + 3, 999); // Loyalty doesn't have a cap
      target.mods = { ...target.mods, astronaut: { turnsRemaining: 3 } };
      state = updPlayer(state, tp, target);
      state = addLog(state, `Astronaut attached to ${tp}'s Creator. +3 Loyalty immediately.`, 'effect');
      break;
    }
    case 'MO-002': case 'MO-003': case 'MO-004': { // LoRA — attach to model
      const model = state.sharedModels.find(m => m.instanceId === targetId);
      if (!model) { state = addLog(state, 'Model not found.', 'system'); break; }
      if (model.loraCardId) { state = addLog(state, 'Model already has a LoRA.', 'system'); break; }
      // Coherent variants can't have Anime LoRA
      if (cardId === 'MO-002' && (model.cardId === 'M-001')) { state = addLog(state, 'Anime LoRA cannot be attached to Coherent variants.', 'system'); break; }
      state = { ...state, sharedModels: state.sharedModels.map(m => m.instanceId === targetId ? { ...m, loraCardId: cardId } : m) };
      state = addLog(state, `${card.name} LoRA attached to ${getCardById(model.cardId)?.name}.`, 'effect');
      break;
    }
    case 'MO-005': { // Trending — creator modifier, 3 rounds
      state = applyCreatorMod(state, targetId as PlayerId, 'trending', { roundsRemaining: 3 });
      state = addLog(state, `Trending modifier applied to ${targetId}'s Creator.`, 'effect');
      break;
    }
    case 'MO-006': { // Ban — creator modifier
      const targetPid = targetId as PlayerId;
      const oppCount = state.sharedModels.filter(m => m.ownerId !== pid).length;
      const duration = Math.max(1, oppCount);
      state = applyCreatorMod(state, targetPid, 'ban', { turnsRemaining: duration });
      state = addLog(state, `Ban applied to ${targetPid}'s Creator for ${duration} turn(s).`, 'effect');
      break;
    }
    case 'MO-007': { // PRO Subscription
      const tp = targetId as PlayerId;
      const target = { ...state.players[tp] };
      target.creditCap = Math.min(CREDIT_CAP_MAX, target.creditCap + 3);
      target.mods = { ...target.mods, proSub: { turnsRemaining: 3, halfCostUsedThisTurn: false } };
      state = updPlayer(state, tp, target);
      state = addLog(state, `PRO Subscription attached to ${tp}'s Creator. Credit cap +3, Runtimes -1.`, 'effect');
      break;
    }
    case 'MO-008': { // Featured — attach to a creation with 6+ vis
      const creation = findCreation(state, pid, targetId);
      if (!creation) { state = addLog(state, 'Creation not found.', 'system'); break; }
      if (creation.visibilityCounters < 6) { state = addLog(state, 'Featured requires 6+ Visibility.', 'system'); break; }
      const pu = { ...state.players[pid] };
      pu.activeCreations = pu.activeCreations.map(c =>
        c.instanceId === targetId ? { ...c, featuredTurnsRemaining: 3 } : c
      );
      state = updPlayer(state, pid, pu);
      state = addLog(state, `Featured modifier attached to a creation.`, 'effect');
      break;
    }
    case 'MO-009': { // Queue Skip — attach to model
      state = { ...state, sharedModels: state.sharedModels.map(m =>
        m.instanceId === targetId ? { ...m, queueSkipReady: true } : m
      )};
      state = addLog(state, `Queue Skip attached to model.`, 'effect');
      break;
    }
    case 'MO-010': { // Noise — attach to model
      state = { ...state, sharedModels: state.sharedModels.map(m =>
        m.instanceId === targetId ? { ...m, noiseTurnsRemaining: 5 } : m
      )};
      state = addLog(state, `Noise modifier attached to model. All future creations -1 Quality for 5 turns.`, 'effect');
      break;
    }
  }
  return state;
}

function applyCreatorMod(s: GameState, pid: PlayerId, key: keyof CreatorModifiers, value: any): GameState {
  const p = { ...s.players[pid], mods: { ...s.players[pid].mods, [key]: value } };
  return updPlayer(s, pid, p);
}

// ── Play Artifact ──────────────────────────────────────────────────
export function playArtifact(s: GameState, cardId: string, targetCreationId?: string): GameState {
  let state = s;
  const pid = state.currentPlayer;
  const card = getCardById(cardId);
  if (!card) return state;
  const p = { ...state.players[pid] };
  if (!p.hand.includes(cardId)) return addLog(state, 'Card not in hand.', 'system');
  const cost = card.cost ?? 0;
  if (p.credits < cost) return addLog(state, 'Not enough credits.', 'system');
  p.credits -= cost;
  const hand = [...p.hand]; hand.splice(hand.indexOf(cardId), 1);
  p.hand = hand;
  state = updPlayer(state, pid, p);
  state = addLog(state, `${pid} plays Artifact: ${card.name}.`, 'action');

  switch (cardId) {
    case 'A-001': // Centaur Problem — 3 rounds
      state = { ...state, centaurProblemRounds: 3 };
      state = addLog(state, `Centaur Problem active! All Fantasy Creations take Glitch tokens.`, 'effect');
      break;
    case 'A-002': // Queue Timeout — 3 rounds, all Runtimes +1
      state = { ...state, queueTimeoutRounds: 3 };
      // Apply to existing queued creations
      for (const p2id of ['player', 'ai'] as PlayerId[]) {
        const p2 = { ...state.players[p2id] };
        p2.queue = p2.queue.map(c => ({ ...c, runtime: c.runtime + 1 }));
        state = updPlayer(state, p2id, p2);
      }
      state = addLog(state, `Queue Timeout active! All Runtimes +1.`, 'effect');
      break;
    case 'A-003': // Double Dragon Head — attach to Fantasy or Portrait creation
      if (!targetCreationId) { state = addLog(state, 'Select a target creation.', 'system'); break; }
      {
        const targetPid: PlayerId = findCreationOwner(state, targetCreationId) ?? pid;
        const tc = findCreation(state, targetPid, targetCreationId);
        if (!tc) { state = addLog(state, 'Creation not found.', 'system'); break; }
        const eStyle = effectiveStyle(tc.styleTag, state);
        if (eStyle !== 'Fantasy' && eStyle !== 'Portrait') { state = addLog(state, 'Double Dragon Head only targets Fantasy or Portrait.', 'system'); break; }
        const tp = { ...state.players[targetPid] };
        tp.activeCreations = tp.activeCreations.map(c =>
          c.instanceId === targetCreationId ? { ...c, dragonHeadTurnsRemaining: 3 } : c
        );
        state = updPlayer(state, targetPid, tp);
      }
      break;
    case 'A-004': // Credit Drop — all players +3 credits
      for (const p2id of ['player', 'ai'] as PlayerId[]) state = applyCredits(state, p2id, 3);
      state = addLog(state, `Credit Drop! All players gain 3 Credits.`, 'effect');
      break;
    case 'A-005': // Server Overload — 3 rounds, cannot be removed
      state = { ...state, serverOverloadRounds: 3 };
      state = addLog(state, `Server Overload! All activations +1 Credit, Creations generate less Visibility.`, 'effect');
      break;
    case 'A-006': // Algorithm Swap
      // Let player choose via UI — for now set pending state
      // Actually, we need style tags from the caller. This would be passed as extra params.
      // For simplicity, swap Fantasy and Portrait (most common)
      state = {
        ...state,
        algorithmSwap: { style1: 'Fantasy', style2: 'Portrait', expiresAbsTurn: state.absTurn + 1 }
      };
      state = addLog(state, `Algorithm Swap! Fantasy and Portrait styles are swapped until next turn.`, 'effect');
      break;
  }
  return state;
}

// ── Play Event ─────────────────────────────────────────────────────
export function playEvent(s: GameState, cardId: string, targetId?: string): GameState {
  let state = s;
  const pid = state.currentPlayer;
  const card = getCardById(cardId);
  if (!card) return state;
  const p = { ...state.players[pid] };
  if (!p.hand.includes(cardId)) return addLog(state, 'Card not in hand.', 'system');

  // Events cannot be played in Round 1 (except Mass Report)
  if (state.round <= 1 && cardId !== 'E-001') {
    return addLog(state, 'Events cannot be played in Round 1.', 'system');
  }

  const costCredits = (card.costType === 'credits' || !card.costType) ? (card.cost ?? 0) : 0;
  const costRep = card.costType === 'reputation' ? (card.cost ?? 0) : 0;
  if (p.credits < costCredits) return addLog(state, 'Not enough credits.', 'system');
  if (p.reputation < costRep) return addLog(state, 'Not enough reputation.', 'system');

  p.credits -= costCredits;
  p.reputation = Math.max(0, p.reputation - costRep);
  const hand = [...p.hand]; hand.splice(hand.indexOf(cardId), 1);
  p.hand = hand; p.discard = [...p.discard, cardId];
  state = updPlayer(state, pid, p);
  state = addLog(state, `${pid} plays Event: ${card.name}.`, 'action');

  const oppId: PlayerId = pid === 'player' ? 'ai' : 'player';

  switch (cardId) {
    case 'E-001': { // Mass Report — counters a modifier being played
      // This is handled reactively; here we just cancel pending modifier
      if (state.pendingModifierPlay) {
        state = { ...state, pendingModifierPlay: null };
        state = addLog(state, `Mass Report cancelled the modifier!`, 'effect');
      }
      break;
    }
    case 'E-002': { // Community Drama — opponent -2 Loyalty, draw 1 card
      state = applyLoyaltyDamage(state, oppId, 2);
      if (state.phase !== 'gameover') {
        state = drawCard(state, oppId, 1);
        state = addLog(state, `Community Drama! Opponent loses 2 Loyalty and draws 1 card.`, 'damage');
      }
      break;
    }
    case 'E-003': { // Prompt Theft — copy opponent's last prompt, activate own model
      if (!state.lastOpponentActivation) { state = addLog(state, 'No opponent activation to copy.', 'system'); break; }
      if (!targetId) { state = addLog(state, 'Select a model to activate.', 'system'); break; }
      const model = state.sharedModels.find(m => m.instanceId === targetId);
      if (!model) { state = addLog(state, 'Model not found.', 'system'); break; }
      const copiedPrompts = state.lastOpponentActivation.promptIds.slice(0, 1); // copy one prompt
      state = activateModel(state, targetId, copiedPrompts, false);
      break;
    }
    case 'E-004': { // Priority Rendering — queued creation arrives next turn
      const pu = { ...state.players[pid] };
      const idx = pu.queue.findIndex(c => c.instanceId === targetId && !c.isInRemixQueue);
      if (idx === -1) { state = addLog(state, 'Queued creation not found.', 'system'); break; }
      pu.queue[idx] = { ...pu.queue[idx], runtime: 1 }; // arrives next refresh
      state = updPlayer(state, pid, pu);
      state = addLog(state, `Priority Rendering! Creation will arrive at the start of next turn.`, 'effect');
      break;
    }
    case 'E-005': { // GPU Boost — reduce runtime of queued creation by 2
      const pu = { ...state.players[pid] };
      const idx = pu.queue.findIndex(c => c.instanceId === targetId && !c.isInRemixQueue);
      if (idx === -1) { state = addLog(state, 'Queued creation not found.', 'system'); break; }
      pu.queue[idx] = { ...pu.queue[idx], runtime: Math.max(1, pu.queue[idx].runtime - 2) };
      state = updPlayer(state, pid, pu);
      state = addLog(state, `GPU Boost! Queued creation runtime -2.`, 'effect');
      break;
    }
    case 'E-006': { // Queue Crash — opponent queued creation runtime +2
      const opp = { ...state.players[oppId] };
      const inQueue = opp.queue.findIndex(c => c.instanceId === targetId);
      if (inQueue !== -1) {
        opp.queue[inQueue] = { ...opp.queue[inQueue], runtime: opp.queue[inQueue].runtime + 2 };
        state = updPlayer(state, oppId, opp);
      } else if (opp.remixQueue?.instanceId === targetId) {
        opp.remixQueue = { ...opp.remixQueue, runtime: opp.remixQueue.runtime + 2 };
        state = updPlayer(state, oppId, opp);
      }
      state = addLog(state, `Queue Crash! Opponent's creation delayed by 2 turns.`, 'effect');
      break;
    }
    case 'E-007': { // Tip Received — requires PRO Sub, gain 4 credits
      if (!state.players[pid].mods.proSub) { state = addLog(state, 'Tip Received requires PRO Subscription.', 'system'); break; }
      state = applyCredits(state, pid, 4);
      state = addLog(state, `Tip Received! Gained 4 Credits.`, 'effect');
      break;
    }
    case 'E-008': { // Generation Cancelled — remove opponent queued creation
      const opp = { ...state.players[oppId] };
      const idx = opp.queue.findIndex(c => c.instanceId === targetId && !c.isInRemixQueue);
      if (idx === -1) { state = addLog(state, 'Target not found in opponent queue.', 'system'); break; }
      opp.queue.splice(idx, 1);
      state = updPlayer(state, oppId, opp);
      state = addLog(state, `Generation Cancelled! Opponent's queued creation was removed.`, 'effect');
      break;
    }
    case 'E-009': { // Daily Challenge: Abstractions — this round
      state = { ...state, dailyChallengeAbstracts: { round: state.round } };
      state = addLog(state, `Daily Challenge: Abstractions! Abstract Creations generate double Rep this round.`, 'effect');
      break;
    }
    case 'E-010': { // Daily Challenge: Portraits — this round
      state = { ...state, dailyChallengePortraits: { round: state.round } };
      state = addLog(state, `Daily Challenge: Portraits! Portrait Creations generate double Rep this round.`, 'effect');
      break;
    }
  }
  return state;
}

// ── Use Creator Ability ────────────────────────────────────────────
export function useCreatorAbility(
  s: GameState, abilityNum: number | 'signature', targetId?: string, extraTargets?: string[]
): GameState {
  let state = s;
  const pid = state.currentPlayer;
  const p = { ...state.players[pid] };
  const creatorId = p.creatorId;
  const oppId: PlayerId = pid === 'player' ? 'ai' : 'player';

  if (p.creatorExhaustedThisTurn) return addLog(state, 'Creator already used an ability this turn.', 'system');
  if (p.mods.ban) return addLog(state, 'Creator is Banned and cannot use abilities.', 'system');

  // Aia (C-001) abilities
  if (creatorId === 'C-001') {
    if (abilityNum === 1) {
      // Overrender: 3 Rep — target opponent Creation loses 1 Quality (or 2 if has glitch)
      if (p.reputation < 3) return addLog(state, 'Need 3 Reputation for Overrender.', 'system');
      if (!targetId) return addLog(state, 'Select a target creation.', 'system');
      const tc = findCreation(state, oppId, targetId);
      if (!tc) return addLog(state, 'Target creation not found.', 'system');
      if (tc.clipLocked) return addLog(state, 'CLIP-LOCKed Creations cannot be targeted.', 'system');
      if (tc.immuneToOpponentUntilAbsTurn > state.absTurn) return addLog(state, 'Target is immune.', 'system');
      if (tc.safetyInNumbersThisTurn) return addLog(state, 'Target is protected by Safety in Numbers.', 'system');
      const qualityLoss = tc.glitchTokens > 0 ? 2 : 1;
      p.reputation -= 3;
      state = updPlayer(state, pid, { ...p, creatorExhaustedThisTurn: true });
      const opp = { ...state.players[oppId] };
      opp.activeCreations = opp.activeCreations.map(c =>
        c.instanceId === targetId ? { ...c, quality: Math.max(0, c.quality - qualityLoss) } : c
      );
      state = updPlayer(state, oppId, opp);
      state = addLog(state, `Overrender! Opponent creation loses ${qualityLoss} Quality.`, 'damage');
      state = checkDestroyZeroQuality(state, oppId);
    } else if (abilityNum === 2) {
      // Positive Feedback: 5 Rep — remove CLIP-LOCK, gain Loyalty = turns locked (max 3)
      if (p.reputation < 5) return addLog(state, 'Need 5 Reputation for Positive Feedback.', 'system');
      if (!targetId) return addLog(state, 'Select a CLIP-LOCKed creation.', 'system');
      const tc = findCreation(state, pid, targetId);
      if (!tc?.clipLocked) return addLog(state, 'Target must be CLIP-LOCKed.', 'system');
      const turns = Math.min(3, Math.max(0, state.absTurn - tc.clipLockAppliedAbsTurn - 1));
      p.reputation -= 5;
      state = updPlayer(state, pid, { ...p, creatorExhaustedThisTurn: true });
      const pu = { ...state.players[pid] };
      pu.activeCreations = pu.activeCreations.map(c =>
        c.instanceId === targetId ? { ...c, clipLocked: false } : c
      );
      state = updPlayer(state, pid, pu);
      state = applyLoyaltyDamage(state, pid, -turns); // gain Loyalty (negative damage)
      const pp = { ...state.players[pid], loyalty: state.players[pid].loyalty + turns };
      state = updPlayer(state, pid, pp);
      state = addLog(state, `Positive Feedback! CLIP-LOCK removed, gained ${turns} Loyalty.`, 'effect');
    } else if (abilityNum === 3) {
      // Iridescent Shift: 6 Rep — +2 vis, immune to opponent targeting until next turn
      if (p.reputation < 6) return addLog(state, 'Need 6 Reputation for Iridescent Shift.', 'system');
      if (!targetId) return addLog(state, 'Select a target creation.', 'system');
      p.reputation -= 6;
      state = updPlayer(state, pid, { ...p, creatorExhaustedThisTurn: true });
      state = addVisibility(state, pid, targetId, 2);
      const pu = { ...state.players[pid] };
      pu.activeCreations = pu.activeCreations.map(c =>
        c.instanceId === targetId ? { ...c, iridescShiftImmuneThisTurn: true } : c
      );
      state = updPlayer(state, pid, pu);
      state = addLog(state, `Iridescent Shift! Creation gains 2 Visibility and is protected this turn.`, 'effect');
    } else if (abilityNum === 'signature') {
      // Copy That!: 4 Loyalty + 14 Rep — up to 3 CLIP-LOCKed → remove, each deals 1 Loyalty to opponent
      if (p.loyalty < 4) return addLog(state, 'Need 4 Loyalty for Copy That!', 'system');
      if (p.reputation < 14) return addLog(state, 'Need 14 Reputation for Copy That!', 'system');
      const targets = extraTargets ?? (targetId ? [targetId] : []);
      const locked = targets.filter(tid => findCreation(state, pid, tid)?.clipLocked);
      if (locked.length === 0) return addLog(state, 'No CLIP-LOCKed Creations selected.', 'system');
      p.loyalty -= 4; p.reputation -= 14;
      state = updPlayer(state, pid, { ...p, creatorExhaustedThisTurn: true });
      const pu = { ...state.players[pid] };
      pu.activeCreations = pu.activeCreations.map(c =>
        locked.includes(c.instanceId) ? { ...c, clipLocked: false } : c
      );
      state = updPlayer(state, pid, pu);
      for (let i = 0; i < locked.length; i++) {
        state = applyLoyaltyDamage(state, oppId, 1);
        if (state.phase === 'gameover') return state;
      }
      if (locked.length >= 2) {
        state = applyRep(state, oppId, -2);
        state = addLog(state, `Copy That! ${locked.length} Creations fired. Opponent loses ${locked.length} Loyalty and 2 Reputation.`, 'damage');
      } else {
        state = addLog(state, `Copy That! ${locked.length} Creation fired. Opponent loses ${locked.length} Loyalty.`, 'damage');
      }
    }
  }

  // Anonymous User (C-002) abilities
  if (creatorId === 'C-002') {
    if (abilityNum === 1) {
      // First Post: 1 Rep — next activation -2 credits. Only if no active creations or queue.
      if (p.reputation < 1) return addLog(state, 'Need 1 Reputation for First Post.', 'system');
      const hasCreations = p.activeCreations.length > 0 || p.queue.length > 0 || p.remixQueue !== null;
      if (hasCreations) return addLog(state, 'First Post requires no active creations or queue.', 'system');
      p.reputation -= 1;
      state = updPlayer(state, pid, { ...p, creatorExhaustedThisTurn: true, firstPostUsedThisTurn: true });
      state = addLog(state, `First Post! Next model activation costs 2 fewer Credits this turn.`, 'effect');
    } else if (abilityNum === 2) {
      // Flood the Feed: 6 Rep — move all queued to field, +1 glitch each
      if (p.reputation < 6) return addLog(state, 'Need 6 Reputation for Flood the Feed.', 'system');
      if (p.queue.length === 0) return addLog(state, 'No queued creations.', 'system');
      p.reputation -= 6;
      state = updPlayer(state, pid, { ...p, creatorExhaustedThisTurn: true });
      const toFlood = [...state.players[pid].queue];
      const pu = { ...state.players[pid], queue: [] };
      state = updPlayer(state, pid, pu);
      for (const c of toFlood) {
        const withGlitch = { ...c, glitchTokens: c.glitchTokens + 1 };
        state = enterCreation(state, pid, withGlitch);
        if (state.phase === 'gameover') return state;
      }
      state = addLog(state, `Flood the Feed! All queued creations enter with +1 Glitch.`, 'effect');
    } else if (abilityNum === 3) {
      // More Than You: 4 Rep — if more creations than opponent, deal 1 Loyalty, gain 1 Loyalty
      if (p.reputation < 4) return addLog(state, 'Need 4 Reputation for More Than You.', 'system');
      const myCount = p.activeCreations.length;
      const oppCount = state.players[oppId].activeCreations.length;
      if (myCount <= oppCount) return addLog(state, 'Need more active Creations than opponent.', 'system');
      p.reputation -= 4;
      state = updPlayer(state, pid, { ...p, creatorExhaustedThisTurn: true });
      state = applyLoyaltyDamage(state, oppId, 1);
      if (state.phase !== 'gameover') {
        const pp = { ...state.players[pid], loyalty: state.players[pid].loyalty + 1 };
        state = updPlayer(state, pid, pp);
        state = addLog(state, `More Than You! Opponent loses 1 Loyalty, you gain 1 Loyalty.`, 'damage');
      }
    } else if (abilityNum === 'signature') {
      // Going Viral: 4 Loyalty + 12 Rep — all active creations +3 vis, cross thresholds = opponent -1 Loyalty
      if (p.loyalty < 4) return addLog(state, 'Need 4 Loyalty for Going Viral.', 'system');
      if (p.reputation < 12) return addLog(state, 'Need 12 Reputation for Going Viral.', 'system');
      p.loyalty -= 4; p.reputation -= 12;
      state = updPlayer(state, pid, { ...p, creatorExhaustedThisTurn: true });
      let loyaltyDamage = 0;
      for (const c of state.players[pid].activeCreations) {
        const oldVis = c.visibilityCounters;
        state = addVisibility(state, pid, c.instanceId, 3);
        const newVis = state.players[pid].activeCreations.find(x => x.instanceId === c.instanceId)?.visibilityCounters ?? oldVis;
        // Check threshold crossings
        if (oldVis < 6 && newVis >= 6) loyaltyDamage += 1; // Liked
        if (oldVis < 10 && newVis >= 10) loyaltyDamage += 1; // Featured
      }
      for (let i = 0; i < loyaltyDamage; i++) {
        state = applyLoyaltyDamage(state, oppId, 1);
        if (state.phase === 'gameover') return state;
      }
      state = addLog(state, `Going Viral! All creations +3 Visibility. Opponent loses ${loyaltyDamage} Loyalty.`, 'damage');
    }
  }

  return state;
}

// ── Apply CLIP-LOCK ────────────────────────────────────────────────
export function applyClipLock(s: GameState, creationInstanceId: string): GameState {
  let state = s;
  const pid = state.currentPlayer;
  const p = state.players[pid];
  if (p.creatorId !== 'C-001') return addLog(state, 'Only Aia can apply CLIP-LOCK.', 'system');
  if (p.clipLockAppliedThisTurn) return addLog(state, 'Already applied CLIP-LOCK this turn.', 'system');

  const creation = p.activeCreations.find(c => c.instanceId === creationInstanceId);
  if (!creation) return addLog(state, 'Creation not found.', 'system');

  // Only Coherent variants (M-001)
  if (creation.modelId !== 'M-001') {
    return addLog(state, 'CLIP-LOCK can only be applied to Coherent variant Creations.', 'system');
  }
  if (creation.clipLocked) return addLog(state, 'Already CLIP-LOCKed.', 'system');
  if (creation.isInRemixQueue) return addLog(state, 'Cannot CLIP-LOCK a creation in Remix Queue.', 'system');

  const pu = { ...state.players[pid] };
  pu.activeCreations = pu.activeCreations.map(c =>
    c.instanceId === creationInstanceId
      ? { ...c, clipLocked: true, clipLockAppliedAbsTurn: state.absTurn }
      : c
  );
  pu.clipLockAppliedThisTurn = true;
  state = updPlayer(state, pid, pu);
  state = addLog(state, `CLIP-LOCK applied to a Coherent creation.`, 'effect');
  return state;
}

// ── Remix a creation ───────────────────────────────────────────────
export function remixCreation(s: GameState, creationInstanceId: string, promptId?: string): GameState {
  let state = s;
  const pid = state.currentPlayer;
  const p = state.players[pid];
  if (p.remixQueue !== null) return addLog(state, 'Remix Queue is full (max 1).', 'system');

  const creation = p.activeCreations.find(c => c.instanceId === creationInstanceId);
  if (!creation) return addLog(state, 'Creation not found.', 'system');
  if (creation.clipLocked) return addLog(state, 'Cannot remix a CLIP-LOCKed creation.', 'system');

  let newStyle: StyleTag | null = creation.styleTag;
  let promptCost = 0;

  if (promptId) {
    const pc = getCardById(promptId);
    if (!pc) return addLog(state, 'Prompt not found.', 'system');
    if (!p.hand.includes(promptId)) return addLog(state, 'Prompt not in hand.', 'system');
    promptCost = pc.cost ?? 0;
    // Determine new style from prompt
    switch (promptId) {
      case 'P-001': newStyle = 'Fantasy'; break;
      case 'P-002': newStyle = 'Portrait'; break;
      case 'P-009': newStyle = 'Landscape'; break;
      default: break;
    }
  }

  if (p.credits < promptCost) return addLog(state, 'Not enough credits for remix.', 'system');

  // Send to remix queue
  const pu = { ...state.players[pid] };
  pu.activeCreations = pu.activeCreations.filter(c => c.instanceId !== creationInstanceId);
  pu.credits -= promptCost;
  if (promptId) {
    const idx = pu.hand.indexOf(promptId);
    if (idx !== -1) { const h = [...pu.hand]; h.splice(idx, 1); pu.hand = h; pu.discard = [...pu.discard, promptId]; }
  }

  const modelCard = getCardById(creation.modelId);
  const remixCreation: CreationState = {
    ...creation,
    isInRemixQueue: true, isOnField: false,
    runtime: 1, // returns next turn
    glitchTokens: 0, // fresh render
    remixNewStyle: newStyle,
    styleTag: newStyle,
    quality: modelCard?.quality ?? creation.quality, // reset to base quality
    visibilityCounters: 0, // reset
    clipLocked: false, // not clip-locked in remix
  };
  pu.remixQueue = remixCreation;
  state = updPlayer(state, pid, pu);
  state = addLog(state, `Creation sent to Remix Queue. Returns next turn with new style.`, 'effect');
  return state;
}

// ── Remove artifact (spending credits) ────────────────────────────
export function removeArtifact(s: GameState, artifactInstanceId: string, spendCredits: number): GameState {
  let state = s;
  const pid = state.currentPlayer;
  const p = state.players[pid];
  if (p.credits < spendCredits) return addLog(state, 'Not enough credits.', 'system');

  const artifact = state.artifacts.find(a => a.instanceId === artifactInstanceId);
  if (!artifact) return addLog(state, 'Artifact not found.', 'system');

  const card = getCardById(artifact.cardId);
  // Check if removable
  if (artifact.cardId === 'A-005') return addLog(state, 'Server Overload cannot be removed.', 'system');

  const pu = clampCredits({ ...p, credits: p.credits - spendCredits });
  state = updPlayer(state, pid, pu);
  state = { ...state, artifacts: state.artifacts.filter(a => a.instanceId !== artifactInstanceId) };
  state = addLog(state, `Artifact removed: ${card?.name}.`, 'effect');
  return state;
}

// ────────────────────────────────────────────────────────────────────
// END PHASE
// ────────────────────────────────────────────────────────────────────
export function runEndPhase(s: GameState): GameState {
  let state = s;
  const pid = state.currentPlayer;
  const oppId: PlayerId = pid === 'player' ? 'ai' : 'player';

  state = addLog(state, `── ${pid === 'player' ? 'Player' : 'AI'} END PHASE ──`, 'system');

  // Until-end-of-turn effects expire (iridescent shift clears)
  const pu = { ...state.players[pid] };
  pu.activeCreations = pu.activeCreations.map(c => ({
    ...c, iridescShiftImmuneThisTurn: false, safetyInNumbersThisTurn: false,
  }));
  state = updPlayer(state, pid, pu);

  // Algorithm Swap: if it was this player who played it, check if it should expire
  if (state.algorithmSwap && state.absTurn >= state.algorithmSwap.expiresAbsTurn) {
    state = { ...state, algorithmSwap: null };
    state = addLog(state, `Algorithm Swap effect ended.`, 'effect');
  }

  // Credit carryover: half remaining credits (round down), rest lost
  const p = state.players[pid];
  const carryover = Math.floor(p.credits / 2);
  const pu2 = { ...state.players[pid], credits: carryover };
  state = updPlayer(state, pid, pu2);

  // Discard to 7 (player chooses, AI auto-discards lowest value cards)
  const p3 = state.players[pid];
  if (p3.hand.length > 7) {
    if (pid === 'ai') {
      // AI auto-discards
      const toDiscard = p3.hand.length - 7;
      const pu3 = { ...p3, hand: p3.hand.slice(0, 7), discard: [...p3.discard, ...p3.hand.slice(7)] };
      state = updPlayer(state, pid, pu3);
    }
    // Player discard handled by UI
  }

  // Draw 1 card
  state = drawCard(state, pid, 1);
  if (state.phase === 'gameover') return state;

  // Deck out check
  const p4 = state.players[pid];
  if (p4.deck.length === 0 && p4.hand.length === 0) {
    state = { ...state, phase: 'gameover', winner: oppId };
    state = addLog(state, `${pid} has no cards! ${oppId} wins!`, 'system');
    return state;
  }

  // Decrement global rounds
  if (state.serverOverloadRounds > 0 && pid === oppId) state = { ...state, serverOverloadRounds: state.serverOverloadRounds - 1 };
  if (state.queueTimeoutRounds > 0 && pid === oppId) state = { ...state, queueTimeoutRounds: state.queueTimeoutRounds - 1 };
  if (state.centaurProblemRounds > 0 && pid === oppId) state = { ...state, centaurProblemRounds: state.centaurProblemRounds - 1 };

  // Reset model activated flags at end of each player's turn
  state = { ...state, sharedModels: state.sharedModels.map(m => ({ ...m, activatedThisTurnBy: null })) };

  // Advance turn
  const nextPlayer = oppId;
  const newAbsTurn = state.absTurn + 1;
  // Round advances when second player ends their turn
  const newRound = nextPlayer === 'player' ? state.round + 1 : state.round;

  // Reset per-round model activations
  const newModels = nextPlayer === 'player'
    ? state.sharedModels.map(m => ({ ...m, activationsThisRound: 0 }))
    : state.sharedModels;

  // End of round daily challenge evaluation
  if (nextPlayer === 'player' && state.round > 0) {
    // Check daily challenge abstract winners
    if (state.dailyChallengeAbstracts?.round === state.round) {
      const pRep = state.players.player.repFromAbstractThisRound;
      const aRep = state.players.ai.repFromAbstractThisRound;
      if (pRep > aRep) state = applyRep(state, 'player', 3);
      else if (aRep > pRep) state = applyRep(state, 'ai', 3);
      const pu = { ...state.players.player, repFromAbstractThisRound: 0 };
      const au = { ...state.players.ai, repFromAbstractThisRound: 0 };
      state = { ...state, players: { player: pu, ai: au }, dailyChallengeAbstracts: null };
    }
    // Check daily challenge portrait winners (most portrait creations)
    if (state.dailyChallengePortraits?.round === state.round) {
      const pCount = state.players.player.activeCreations.filter(c => effectiveStyle(c.styleTag, state) === 'Portrait').length;
      const aCount = state.players.ai.activeCreations.filter(c => effectiveStyle(c.styleTag, state) === 'Portrait').length;
      if (pCount > aCount) state = applyRep(state, 'player', 3);
      else if (aCount > pCount) state = applyRep(state, 'ai', 3);
      const pu = { ...state.players.player, repFromPortraitThisRound: 0 };
      const au = { ...state.players.ai, repFromPortraitThisRound: 0 };
      state = { ...state, players: { player: pu, ai: au }, dailyChallengePortraits: null };
    }
  }

  state = {
    ...state,
    currentPlayer: nextPlayer,
    round: newRound,
    absTurn: newAbsTurn,
    turnPhase: 'refresh',
    sharedModels: newModels,
  };

  return state;
}

// ── Helper: find creation by ID across both players ────────────────
export function findCreation(s: GameState, pid: PlayerId, cid: string): CreationState | undefined {
  return s.players[pid].activeCreations.find(c => c.instanceId === cid)
    || s.players[pid].queue.find(c => c.instanceId === cid);
}

export function findCreationOwner(s: GameState, cid: string): PlayerId | null {
  for (const pid of ['player', 'ai'] as PlayerId[]) {
    if (findCreation(s, pid, cid)) return pid;
  }
  return null;
}

// ── Check if player can afford a creator ability ────────────────────
export function canUseAbility(s: GameState, pid: PlayerId, abilityNum: number | 'signature'): boolean {
  const p = s.players[pid];
  if (p.creatorExhaustedThisTurn || p.mods.ban) return false;

  if (p.creatorId === 'C-001') {
    if (abilityNum === 1) return p.reputation >= 3;
    if (abilityNum === 2) return p.reputation >= 5 && p.activeCreations.some(c => c.clipLocked);
    if (abilityNum === 3) return p.reputation >= 6 && p.activeCreations.length > 0;
    if (abilityNum === 'signature') return p.loyalty >= 4 && p.reputation >= 14 && p.activeCreations.some(c => c.clipLocked);
  }
  if (p.creatorId === 'C-002') {
    if (abilityNum === 1) return p.reputation >= 1 && p.activeCreations.length === 0 && p.queue.length === 0 && !p.remixQueue;
    if (abilityNum === 2) return p.reputation >= 6 && p.queue.length > 0;
    if (abilityNum === 3) {
      const oppId: PlayerId = pid === 'player' ? 'ai' : 'player';
      return p.reputation >= 4 && p.activeCreations.length > s.players[oppId].activeCreations.length;
    }
    if (abilityNum === 'signature') return p.loyalty >= 4 && p.reputation >= 12 && p.activeCreations.length > 0;
  }
  return false;
}

export function creatorGlowColor(s: GameState, pid: PlayerId): 'none' | 'yellow' | 'red' {
  if (canUseAbility(s, pid, 'signature')) return 'red';
  if (canUseAbility(s, pid, 1) || canUseAbility(s, pid, 2) || canUseAbility(s, pid, 3)) return 'yellow';
  return 'none';
}
