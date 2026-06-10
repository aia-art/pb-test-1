// ============================================================
// PROMPT BATTLE — Heuristic AI Engine
// Simple but strategic AI opponent
// ============================================================
import { getCardById } from '../data';
import type { GameState, PlayerId, CreationState, ModelState } from './gameTypes';
import {
  playModel, activateModel, playModifier, playArtifact,
  playEvent, useCreatorAbility, applyClipLock, remixCreation,
  runEndPhase, effectiveQuality, effectiveStyle, canUseAbility,
  applyMulligan, findCreation, uid, addLog,
} from './gameEngine';

const AI_ID: PlayerId = 'ai';
const PLAYER_ID: PlayerId = 'player';

// ── Scoring helpers ────────────────────────────────────────────────
function scoreCreation(c: CreationState): number {
  const eq = effectiveQuality(c);
  if (eq <= 0) return -999;
  return eq * 10 + c.visibilityCounters * 2;
}

function totalFieldScore(s: GameState, pid: PlayerId): number {
  return s.players[pid].activeCreations.reduce((acc, c) => acc + scoreCreation(c), 0);
}

// ── Decide mulligan ────────────────────────────────────────────────
export function aiDecideMulligan(s: GameState): GameState {
  const p = s.players.ai;
  // Count cards that cost ≤ available credits (cheap playable cards)
  const playableCards = p.hand.filter(cardId => {
    const card = getCardById(cardId);
    if (!card) return false;
    if (card.type === 'model') return true; // models are always good
    const cost = card.cost ?? 0;
    return cost <= 6; // affordable early game
  });
  // Mulligan if fewer than 3 playable cards
  const doMulligan = playableCards.length < 3;
  return applyMulligan(s, AI_ID, doMulligan);
}

// ── Evaluate best model to play ───────────────────────────────────
function bestModelToPlay(s: GameState): string | null {
  const p = s.players[AI_ID];
  let best: { cardId: string; score: number } | null = null;

  for (const cardId of p.hand) {
    const card = getCardById(cardId);
    if (!card || card.type !== 'model') continue;
    const cost = card.playCost ?? 0;
    if (p.credits < cost) continue;
    // Don't play if shared zone already has a model from AI
    const alreadyInZone = s.sharedModels.some(m => m.cardId === cardId && m.ownerId === AI_ID);
    if (alreadyInZone) continue;
    const score = (card.quality ?? 1) * 10 - cost + (card.runtime ?? 2) * (-2);
    if (!best || score > best.score) best = { cardId, score };
  }
  return best?.cardId ?? null;
}

// ── Evaluate best model to activate ──────────────────────────────
function bestModelToActivate(
  s: GameState
): { modelInstanceId: string; promptIds: string[]; useFavPrompt: boolean } | null {
  const p = s.players[AI_ID];
  // Can't have more than 2 in queue
  if (p.queue.length >= 2) return null;

  let best: { modelInstanceId: string; promptIds: string[]; useFavPrompt: boolean; score: number } | null = null;

  for (const model of s.sharedModels) {
    if (model.activatedThisTurnBy !== null) continue;
    if (model.ownerId !== AI_ID && s.round < 2) continue;

    const card = getCardById(model.cardId);
    if (!card) continue;

    let cost = (card.activateCost ?? 0) + (model.loraCardId ? 1 : 0);
    if (s.serverOverloadRounds > 0) cost += 1;

    // PRO Sub: half cost
    if (p.mods.proSub && !p.mods.proSub.halfCostUsedThisTurn) cost = Math.floor(cost / 2);

    // First Post discount
    if (p.firstPostUsedThisTurn) cost = Math.max(0, cost - 2);

    if (p.credits < cost) continue;

    // Pick prompts — decide fav first so we don't exceed 2-prompt total
    const willUseFav = canUseFavPrompt(s, model.cardId, []);
    const maxRegular = willUseFav ? 1 : 2;          // fav counts as 1 of the 2 slots
    const promptOptions = pickPrompts(s, model.cardId, maxRegular);
    const useFav = willUseFav && canUseFavPrompt(s, model.cardId, promptOptions);
    const totalCost = cost + promptOptions.reduce((acc, pid) => acc + (getCardById(pid)?.cost ?? 0), 0);
    if (p.credits < totalCost) continue;
    const baseQuality = card.quality ?? 1;
    const score = baseQuality * 10 - totalCost + 5; // prefer activating over not

    if (!best || score > best.score) {
      best = { modelInstanceId: model.instanceId, promptIds: promptOptions, useFavPrompt: useFav, score };
    }
  }
  return best ?? null;
}

function canUseFavPrompt(s: GameState, modelCardId: string, usedPrompts: string[]): boolean {
  const p = s.players[AI_ID];
  const creator = getCardById(p.creatorId);
  if (!creator?.favouritePrompt) return false;
  // Anon fav prompt: Style subtype — can use if no Style prompt used
  if (p.creatorId === 'C-002') {
    const usedSubtypes = usedPrompts.map(id => getCardById(id)?.promptType ?? '');
    return !usedSubtypes.includes('Style');
  }
  // Aia fav prompt: Atmosphere subtype
  if (p.creatorId === 'C-001') {
    const usedSubtypes = usedPrompts.map(id => getCardById(id)?.promptType ?? '');
    return !usedSubtypes.includes('Atmosphere');
  }
  return false;
}

function pickPrompts(s: GameState, modelCardId: string, max = 2): string[] {
  const p = s.players[AI_ID];
  const modelCard = getCardById(modelCardId);
  if (!modelCard) return [];

  const usedSubtypes = new Set<string>();
  const picked: string[] = [];

  // Score each prompt in hand
  const promptCards = p.hand
    .map(id => ({ id, card: getCardById(id) }))
    .filter(({ card }) => card?.type === 'prompt')
    .map(({ id, card }) => {
      // Check model compatibility
      const models = card?.compatibleModels ?? 'All';
      if (models.includes('except Coherent') && (modelCardId === 'M-001')) return null;
      if (models.includes('Coherent variants and Stable Diffusion 1.5') && modelCardId !== 'M-001' && modelCardId !== 'M-004') return null;
      return { id, card: card! };
    })
    .filter(Boolean) as { id: string; card: NonNullable<ReturnType<typeof getCardById>> }[];

  // Score prompts: prefer quality-boosting ones
  const scored = promptCards.map(({ id, card }) => {
    let score = 0;
    switch (id) {
      case 'P-003': score = 8; break; // Copygazelle immunity is very valuable
      case 'P-007': score = 6; break; // +1 Quality
      case 'P-008': score = 5; break; // +1 Quality
      case 'P-006': score = 7; break; // +3 Quality (if compatible)
      case 'P-001': score = 4; break; // Fantasy style + bonus
      case 'P-009': score = 3; break; // Landscape style
      case 'P-002': score = 3; break; // Portrait + vis
      case 'P-004': score = 2; break; // +2 vis but +1 glitch
      case 'P-010': score = 2; break; // +2 vis but +1 glitch
      case 'P-005': score = 1; break; // +2 vis +2 glitch (risky)
      default: score = 1;
    }
    return { id, card, score, subtype: card.promptType ?? card.subtype ?? '' };
  }).sort((a, b) => b.score - a.score);

  for (const { id, subtype } of scored) {
    if (picked.length >= max) break;
    if (usedSubtypes.has(subtype)) continue;
    picked.push(id);
    usedSubtypes.add(subtype);
  }

  return picked;
}

// ── Decide creator ability ────────────────────────────────────────
function bestCreatorAbility(
  s: GameState
): { abilityNum: number | 'signature'; targetId?: string; extraTargets?: string[] } | null {
  const p = s.players[AI_ID];
  const opp = s.players[PLAYER_ID];

  // Check signature first if conditions are met
  if (canUseAbility(s, AI_ID, 'signature')) {
    if (p.creatorId === 'C-001') {
      // Copy That! — only if it would deal significant damage
      const locked = p.activeCreations.filter(c => c.clipLocked);
      if (locked.length >= 2 || opp.loyalty <= locked.length + 1) {
        return { abilityNum: 'signature', extraTargets: locked.map(c => c.instanceId) };
      }
    }
    if (p.creatorId === 'C-002') {
      // Going Viral — use if opponent loyalty is low or we'd cross thresholds
      const wouldCross = p.activeCreations.filter(c => {
        const newVis = c.visibilityCounters + 3;
        return (c.visibilityCounters < 6 && newVis >= 6) || (c.visibilityCounters < 10 && newVis >= 10);
      });
      if (opp.loyalty <= 4 || wouldCross.length >= 2) {
        return { abilityNum: 'signature' };
      }
    }
  }

  // Aia abilities
  if (p.creatorId === 'C-001') {
    // Positive Feedback: if we have a locked creation for 2+ turns
    if (canUseAbility(s, AI_ID, 2)) {
      const bestLocked = p.activeCreations
        .filter(c => c.clipLocked)
        .sort((a, b) => (s.absTurn - b.clipLockAppliedAbsTurn) - (s.absTurn - a.clipLockAppliedAbsTurn))[0];
      if (bestLocked && s.absTurn - bestLocked.clipLockAppliedAbsTurn >= 2) {
        return { abilityNum: 2, targetId: bestLocked.instanceId };
      }
    }
    // Overrender: if opponent has a low-quality creation
    if (canUseAbility(s, AI_ID, 1)) {
      const targets = opp.activeCreations
        .filter(c => !c.clipLocked && c.immuneToOpponentUntilAbsTurn <= s.absTurn && !c.safetyInNumbersThisTurn)
        .sort((a, b) => effectiveQuality(a) - effectiveQuality(b));
      if (targets.length > 0) {
        const t = targets[0];
        const wouldDestroy = t.glitchTokens > 0 ? (t.quality - t.glitchTokens - 2 <= 0) : (t.quality - 1 <= 0);
        if (wouldDestroy || effectiveQuality(t) <= 2) {
          return { abilityNum: 1, targetId: t.instanceId };
        }
      }
    }
    // Iridescent Shift: if a creation is about to be destroyed or needs protection
    if (canUseAbility(s, AI_ID, 3)) {
      const needsProtection = p.activeCreations.find(c => c.glitchTokens > 0 && effectiveQuality(c) <= 2);
      if (needsProtection) {
        return { abilityNum: 3, targetId: needsProtection.instanceId };
      }
    }
  }

  // Anon abilities
  if (p.creatorId === 'C-002') {
    // Flood the Feed: if we have 2 queued creations
    if (canUseAbility(s, AI_ID, 2) && p.queue.length >= 2) {
      return { abilityNum: 2 };
    }
    // More Than You: deal damage when ahead
    if (canUseAbility(s, AI_ID, 3)) {
      return { abilityNum: 3 };
    }
    // First Post: on turn 1 or when empty
    if (canUseAbility(s, AI_ID, 1)) {
      return { abilityNum: 1 };
    }
  }

  return null;
}

// ── Decide on remix ───────────────────────────────────────────────
function shouldRemix(s: GameState): { creationId: string; promptId?: string } | null {
  const p = s.players[AI_ID];
  if (p.remixQueue !== null) return null; // already remixing

  // Remix a creation that has enough glitches to be a problem
  const risky = p.activeCreations.find(c =>
    !c.clipLocked && !c.isInRemixQueue &&
    effectiveQuality(c) <= 1 && c.glitchTokens > 0
  );
  if (!risky) return null;

  // Find a style prompt to use
  const stylePrompt = p.hand.find(id => {
    const card = getCardById(id);
    return card?.promptType === 'Style' || card?.promptType === 'Artist';
  });

  const promptCost = stylePrompt ? (getCardById(stylePrompt)?.cost ?? 0) : 0;
  if (p.credits < promptCost) return null;

  return { creationId: risky.instanceId, promptId: stylePrompt };
}

// ── Decide CLIP-LOCK to apply ─────────────────────────────────────
function shouldApplyClipLock(s: GameState): string | null {
  const p = s.players[AI_ID];
  if (p.creatorId !== 'C-001') return null;
  if (p.clipLockAppliedThisTurn) return null;

  // CLIP-LOCK the best Coherent creation that isn't already locked
  const eligible = p.activeCreations.filter(c =>
    c.modelId === 'M-001' && !c.clipLocked && c.isOnField
  ).sort((a, b) => effectiveQuality(b) - effectiveQuality(a));

  return eligible[0]?.instanceId ?? null;
}

// ── Play modifier if beneficial ───────────────────────────────────
function bestModifierToPlay(
  s: GameState
): { cardId: string; targetId: string; targetType: 'creator' | 'model' | 'creation' } | null {
  const p = s.players[AI_ID];

  for (const cardId of p.hand) {
    const card = getCardById(cardId);
    if (!card || card.type !== 'modifier') continue;
    const cost = card.cost ?? 0;
    if (p.credits < cost) continue;

    switch (cardId) {
      case 'MO-001': // The Astronaut — attach to self
        return { cardId, targetId: AI_ID, targetType: 'creator' };
      case 'MO-002': case 'MO-003': case 'MO-004': { // LoRA — attach to compatible model
        const compatModel = s.sharedModels.find(m => {
          if (m.loraCardId) return false;
          if (cardId === 'MO-002' && m.cardId === 'M-001') return false;
          return true;
        });
        if (compatModel) return { cardId, targetId: compatModel.instanceId, targetType: 'model' };
        break;
      }
      case 'MO-005': // Trending — attach to self
        return { cardId, targetId: AI_ID, targetType: 'creator' };
      case 'MO-006': { // Ban — attach to opponent
        return { cardId, targetId: PLAYER_ID, targetType: 'creator' };
      }
      case 'MO-007': // PRO Sub — attach to self
        return { cardId, targetId: AI_ID, targetType: 'creator' };
      case 'MO-008': { // Featured — attach to high-vis creation
        const target = p.activeCreations.find(c => c.visibilityCounters >= 6 && c.featuredTurnsRemaining === 0);
        if (target) return { cardId, targetId: target.instanceId, targetType: 'creation' };
        break;
      }
      case 'MO-009': { // Queue Skip — attach to model
        const model = s.sharedModels.find(m => !m.queueSkipReady);
        if (model) return { cardId, targetId: model.instanceId, targetType: 'model' };
        break;
      }
      case 'MO-010': { // Noise — attach to opponent's best model
        const model = s.sharedModels.find(m => m.ownerId === PLAYER_ID && !m.noiseTurnsRemaining);
        if (model) return { cardId, targetId: model.instanceId, targetType: 'model' };
        break;
      }
    }
  }
  return null;
}

// ── Play artifact if beneficial ───────────────────────────────────
function bestArtifactToPlay(s: GameState): { cardId: string; targetCreationId?: string } | null {
  const p = s.players[AI_ID];

  for (const cardId of p.hand) {
    const card = getCardById(cardId);
    if (!card || card.type !== 'artifact') continue;
    const cost = card.cost ?? 0;
    if (p.credits < cost) continue;

    switch (cardId) {
      case 'A-001': // Centaur Problem — only if opponent has Fantasy creations
        if (s.players[PLAYER_ID].activeCreations.some(c => effectiveStyle(c.styleTag, s) === 'Fantasy')) {
          return { cardId };
        }
        break;
      case 'A-002': // Queue Timeout — only if opponent has queue creations
        if (s.players[PLAYER_ID].queue.length > 0) return { cardId };
        break;
      case 'A-003': { // Double Dragon Head — attach to opponent's best Fantasy/Portrait
        const target = s.players[PLAYER_ID].activeCreations.find(c => {
          const es = effectiveStyle(c.styleTag, s);
          return es === 'Fantasy' || es === 'Portrait';
        });
        if (target) return { cardId, targetCreationId: target.instanceId };
        break;
      }
      case 'A-004': // Credit Drop — always good
        return { cardId };
      case 'A-005': // Server Overload — aggressive, use when winning
        if (p.activeCreations.length > s.players[PLAYER_ID].activeCreations.length) return { cardId };
        break;
    }
  }
  return null;
}

// ── Play event if beneficial ──────────────────────────────────────
function bestEventToPlay(s: GameState): { cardId: string; targetId?: string } | null {
  const p = s.players[AI_ID];
  const opp = s.players[PLAYER_ID];
  if (s.round < 2) return null; // no events in round 1

  for (const cardId of p.hand) {
    const card = getCardById(cardId);
    if (!card || card.type !== 'event') continue;
    const costCredits = card.costType !== 'reputation' ? (card.cost ?? 0) : 0;
    const costRep = card.costType === 'reputation' ? (card.cost ?? 0) : 0;
    if (p.credits < costCredits || p.reputation < costRep) continue;

    switch (cardId) {
      case 'E-002': // Community Drama — always deal damage
        if (opp.loyalty <= 3) return { cardId }; // kill shot
        if (p.credits >= costCredits && p.credits > 8) return { cardId }; // when credits are high
        break;
      case 'E-006': { // Queue Crash — if opponent has queue
        const target = opp.queue[0];
        if (target) return { cardId, targetId: target.instanceId };
        break;
      }
      case 'E-008': { // Generation Cancelled — remove opponent's best queue creation
        if (opp.queue.length > 0) {
          const best = [...opp.queue].sort((a, b) => b.quality - a.quality)[0];
          return { cardId, targetId: best.instanceId };
        }
        break;
      }
      case 'E-005': { // GPU Boost — if we have creations in queue
        const target = p.queue[0];
        if (target && target.runtime > 1) return { cardId, targetId: target.instanceId };
        break;
      }
      case 'E-004': { // Priority Rendering
        const target = p.queue[0];
        if (target && target.runtime > 1) return { cardId, targetId: target.instanceId };
        break;
      }
      case 'E-007': // Tip Received
        if (p.mods.proSub) return { cardId };
        break;
      case 'E-009': // Daily Challenge Abstractions
        if (p.activeCreations.some(c => effectiveStyle(c.styleTag, s) === 'Abstract')) return { cardId };
        break;
      case 'E-010': // Daily Challenge Portraits
        if (p.activeCreations.some(c => effectiveStyle(c.styleTag, s) === 'Portrait')) return { cardId };
        break;
    }
  }
  return null;
}

// ── Full AI turn ───────────────────────────────────────────────────
export function runAiTurn(initialState: GameState): GameState {
  let state = initialState;
  if (state.currentPlayer !== AI_ID) return state;
  if (state.turnPhase !== 'main') return state;

  // Tick counter to prevent infinite loops
  let actions = 0;
  const MAX_ACTIONS = 20;

  while (actions < MAX_ACTIONS && state.phase === 'playing' && state.currentPlayer === AI_ID) {
    actions++;
    let acted = false;

    // 1. Remix if a creation is dangerously glitched
    const remix = shouldRemix(state);
    if (remix) {
      state = remixCreation(state, remix.creationId, remix.promptId);
      state = addLog(state, `AI uses Remix to clean up a glitched creation.`, 'ai');
      acted = true; continue;
    }

    // 2. Apply CLIP-LOCK if Aia
    const clipTarget = shouldApplyClipLock(state);
    if (clipTarget) {
      state = applyClipLock(state, clipTarget);
      acted = true; continue;
    }

    // 3. Use creator ability if beneficial
    const abilityChoice = bestCreatorAbility(state);
    if (abilityChoice) {
      state = useCreatorAbility(state, abilityChoice.abilityNum, abilityChoice.targetId, abilityChoice.extraTargets);
      acted = true; continue;
    }

    // 4. Play a Model (if we don't have one in shared zone, or need more)
    const noActivatableModel = !state.sharedModels.some(m =>
      (m.ownerId === AI_ID || state.round >= 2) && m.activatedThisTurnBy === null
    );
    if (noActivatableModel || state.sharedModels.filter(m => m.ownerId === AI_ID).length < 2) {
      const modelToPlay = bestModelToPlay(state);
      if (modelToPlay) {
        state = playModel(state, modelToPlay);
        acted = true; continue;
      }
    }

    // 5. Activate a Model (generate a creation)
    const activation = bestModelToActivate(state);
    if (activation) {
      state = activateModel(state, activation.modelInstanceId, activation.promptIds, activation.useFavPrompt);
      acted = true; continue;
    }

    // 6. Play a modifier
    const mod = bestModifierToPlay(state);
    if (mod) {
      state = playModifier(state, mod.cardId, mod.targetId, mod.targetType);
      acted = true; continue;
    }

    // 7. Play an event
    const evt = bestEventToPlay(state);
    if (evt) {
      state = playEvent(state, evt.cardId, evt.targetId);
      acted = true; continue;
    }

    // 8. Play an artifact
    const art = bestArtifactToPlay(state);
    if (art) {
      state = playArtifact(state, art.cardId, art.targetCreationId);
      acted = true; continue;
    }

    // Nothing more to do
    break;
  }

  // End AI's main phase
  state = runEndPhase(state);
  return state;
}
