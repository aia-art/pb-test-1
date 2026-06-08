// ============================================================
// PROMPT BATTLE — Arena Battlefield v2
// Fixed: targeting system, aspect ratios, queue display,
// card detail modal, global-effect cards, creator targeting
// ============================================================
import { useState, useRef, useEffect } from 'react';
import { getCardById } from '../data';
import type { GameState, CreationState, ModelState, PlayerId, StyleTag } from '../game/gameTypes';
import {
  initGame, applyMulligan, runRefreshPhase, runEndPhase, resolveSlotOverflow,
  playModel, activateModel, playModifier, playArtifact, playEvent,
  useCreatorAbility, applyClipLock, remixCreation,
  effectiveQuality, effectiveStyle, creatorGlowColor,
  getAllDecks, findCreationOwner, addLog,
} from '../game/gameEngine';
import { aiDecideMulligan, runAiTurn } from '../game/aiEngine';

// ─── Storage ────────────────────────────────────────────────
const META_KEY = 'pb_play_meta';
const loadMeta = (): { lastDeck?: string; favDeck?: string } => {
  try { return JSON.parse(localStorage.getItem(META_KEY) ?? '{}'); } catch { return {}; }
};
const saveMeta = (m: object) => localStorage.setItem(META_KEY, JSON.stringify(m));

const STYLES: StyleTag[] = ['Fantasy','Landscape','Portrait','Abstract','Atmosphere'];
const STYLE_CLR: Record<StyleTag,string> = {
  Fantasy:'text-purple-400 border-purple-400/30',
  Landscape:'text-green-400 border-green-400/30',
  Portrait:'text-pink-400 border-pink-400/30',
  Abstract:'text-orange-400 border-orange-400/30',
  Atmosphere:'text-blue-400 border-blue-400/30',
};

// ─── Target specification ────────────────────────────────────
interface TargetSpec {
  label: string;
  cardId?: string;
  abilityNum?: number | 'signature';
  // What kinds of things can be selected
  ownCreator?:     boolean;
  oppCreator?:     boolean;
  ownActive?:      boolean;
  oppActive?:      boolean;
  ownQueue?:       boolean;
  oppQueue?:       boolean;
  anyModel?:       boolean;
  ownModel?:       boolean;
  // Filters
  clipLockedOnly?: boolean;
  notClipLocked?:  boolean;
  minVis?:         number;
  styleFilter?:    StyleTag[];
  // Selection
  selected: string[];
  maxTargets: number;
}

function getTargetSpec(cardId: string, gs: GameState): TargetSpec | null {
  const base = (label: string, extra: Partial<TargetSpec>): TargetSpec =>
    ({ label, selected: [], maxTargets: 1, cardId, ...extra });

  switch (cardId) {
    // ── Modifiers ──
    case 'MO-001': return base('Select your Creator', { ownCreator: true });
    case 'MO-002':
    case 'MO-003':
    case 'MO-004': return base('Select a Model in the shared zone', { anyModel: true });
    case 'MO-005': return base('Select your Creator', { ownCreator: true });
    case 'MO-006': return base('Select opponent Creator', { oppCreator: true });
    case 'MO-007': return base('Select your Creator', { ownCreator: true });
    case 'MO-008': return base('Select your Creation with 6+ Visibility', { ownActive: true, minVis: 6 });
    case 'MO-009': return base('Select a Model to attach Queue Skip', { anyModel: true });
    case 'MO-010': return base('Select a Model to attach Noise', { anyModel: true });
    // ── Artifacts ──
    case 'A-001': return null; // global — no target
    case 'A-002': return null;
    case 'A-003': return base('Select a Fantasy or Portrait Creation',
      { ownActive: true, oppActive: true, styleFilter: ['Fantasy','Portrait'] });
    case 'A-004': return null;
    case 'A-005': return null;
    case 'A-006': return null; // handled by style-picker modal
    // ── Events ──
    case 'E-001': return null;
    case 'E-002': return null; // auto-targets opponent creator
    case 'E-003': return base('Select your Model to activate with copied prompt', { ownModel: true });
    case 'E-004': return base('Select your queued Creation (priority render)', { ownQueue: true });
    case 'E-005': return base('Select your queued Creation (GPU boost)', { ownQueue: true });
    case 'E-006': return base('Select opponent queued or remix Creation (crash it)', { oppQueue: true });
    case 'E-007': return null;
    case 'E-008': return base('Select opponent queued Creation (cancel it)', { oppQueue: true });
    case 'E-009': return null;
    case 'E-010': return null;
    default: return null;
  }
}

function getAbilityTargetSpec(abilityNum: number | 'signature', creatorId: string, gs: GameState): TargetSpec | null {
  const base = (label: string, extra: Partial<TargetSpec>): TargetSpec =>
    ({ label, selected: [], maxTargets: 1, abilityNum, ...extra });

  if (creatorId === 'C-001') { // Aia
    if (abilityNum === 1) return base('Select an opponent Creation (Overrender)',
      { oppActive: true, notClipLocked: true });
    if (abilityNum === 2) return base('Select your CLIP-LOCKed Creation (Positive Feedback)',
      { ownActive: true, clipLockedOnly: true });
    if (abilityNum === 3) return base('Select your Creation (Iridescent Shift)',
      { ownActive: true });
    if (abilityNum === 'signature') return base('Select up to 3 CLIP-LOCKed Creations (Copy That!)',
      { ownActive: true, clipLockedOnly: true, maxTargets: 3 });
  }
  if (creatorId === 'C-002') { // Anon — all abilities are auto-targeting
    return null;
  }
  return null;
}

function isValidTarget(
  spec: TargetSpec,
  itemType: 'own-creator' | 'opp-creator' | 'own-active' | 'opp-active' |
            'own-queue' | 'opp-queue' | 'own-model' | 'opp-model',
  item: CreationState | ModelState | string | null,
  gs: GameState
): boolean {
  // Check type match
  const typeOk = (
    (itemType === 'own-creator'  && spec.ownCreator)  ||
    (itemType === 'opp-creator'  && spec.oppCreator)  ||
    (itemType === 'own-active'   && spec.ownActive)   ||
    (itemType === 'opp-active'   && spec.oppActive)   ||
    (itemType === 'own-queue'    && spec.ownQueue)     ||
    (itemType === 'opp-queue'    && spec.oppQueue)     ||
    (itemType === 'own-model'    && (spec.anyModel || spec.ownModel)) ||
    (itemType === 'opp-model'    && spec.anyModel)
  );
  if (!typeOk) return false;

  // Apply creation filters
  if (item && typeof item === 'object' && 'quality' in item) {
    const c = item as CreationState;
    if (spec.clipLockedOnly && !c.clipLocked) return false;
    if (spec.notClipLocked && c.clipLocked) return false;
    if (spec.minVis !== undefined && c.visibilityCounters < spec.minVis) return false;
    if (spec.styleFilter && spec.styleFilter.length > 0) {
      const eStyle = effectiveStyle(c.styleTag, gs);
      if (!eStyle || !spec.styleFilter.includes(eStyle)) return false;
    }
    // Immune to opponent effects
    if ((itemType === 'opp-active' || itemType === 'opp-queue') && c.immuneToOpponentUntilAbsTurn > gs.absTurn) return false;
    if ((itemType === 'opp-active' || itemType === 'opp-queue') && c.safetyInNumbersThisTurn) return false;
  }
  return true;
}

// ─── Pending action ──────────────────────────────────────────
type PA =
  | { kind: 'activate';     modelId: string; prompts: string[]; useFav: boolean }
  | { kind: 'target';       spec: TargetSpec }
  | { kind: 'pick-styles';  cardId: string; chosen: StyleTag[] }
  | { kind: 'discard';      count: number; selected: string[] };

// ─── Tiny helpers ────────────────────────────────────────────
const eq = (c: CreationState) => effectiveQuality(c);

function VisBar({ vis }: { vis: number }) {
  const pct = Math.min(100, (vis / 12) * 100);
  const col = vis >= 10 ? 'bg-amber-400' : vis >= 6 ? 'bg-cyan-400' : vis >= 3 ? 'bg-teal-500' : 'bg-white/10';
  return (
    <div className="w-full bg-black/40 rounded-full h-1 overflow-hidden">
      <div className={`h-full rounded-full ${col}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function LoyaltyBar({ val, max, label }: { val: number; max: number; label: string }) {
  const pct = Math.max(0, Math.min(100, (val / max) * 100));
  const col = pct > 50 ? 'bg-[#a1d0c6]' : pct > 25 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 flex-1">
      <span className="text-[9px] text-white/40 w-12 shrink-0">{label}</span>
      <div className="flex-1 bg-black/40 rounded-full h-2 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${col}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-white w-8 text-right">{val}</span>
    </div>
  );
}

// ─── Creation chip (on field or in queue) ─────────────────────
function CreationChip({
  c, onClick, highlight, dim, label
}: { c: CreationState; onClick?: () => void; highlight?: boolean; dim?: boolean; label?: string }) {
  const eQ = eq(c);
  const vis = c.visibilityCounters;
  const visLabel = vis >= 10 ? 'Featured' : vis >= 6 ? 'Liked' : vis >= 3 ? 'Noticed' : '—';

  return (
    <div
      onClick={onClick}
      className={`flex flex-col gap-1 p-2 rounded-xl border cursor-pointer select-none transition-all
        ${highlight ? 'border-amber-400 bg-amber-400/15 shadow-lg shadow-amber-400/20 scale-105' : 'border-white/15 bg-white/5 hover:border-white/30'}
        ${dim ? 'opacity-30 pointer-events-none' : ''}
        ${eQ <= 0 ? 'border-red-500/50' : ''}
        ${c.clipLocked ? 'ring-1 ring-cyan-400/60' : ''}
      `}
      style={{ minWidth: 96, width: 96 }}
    >
      {/* Status row */}
      <div className="flex gap-0.5 flex-wrap">
        {c.clipLocked && <span className="text-[7px] bg-cyan-400/20 text-cyan-300 px-0.5 rounded font-bold">CLK</span>}
        {!c.isOnField && !c.isInRemixQueue && <span className="text-[7px] bg-purple-400/20 text-purple-300 px-0.5 rounded font-bold">⏳{c.runtime}t</span>}
        {c.isInRemixQueue && <span className="text-[7px] bg-orange-400/20 text-orange-300 px-0.5 rounded font-bold">RMX</span>}
        {c.immuneToOpponentUntilAbsTurn > 0 && <span className="text-[7px] bg-green-400/20 text-green-300 px-0.5 rounded font-bold">IMM</span>}
        {c.featuredTurnsRemaining > 0 && <span className="text-[7px] bg-amber-400/20 text-amber-300 px-0.5 rounded font-bold">★</span>}
        {c.safetyInNumbersThisTurn && <span className="text-[7px] bg-blue-400/20 text-blue-300 px-0.5 rounded font-bold">SFT</span>}
      </div>
      {/* Quality + glitch */}
      <div className="flex items-center gap-1">
        <span className={`text-sm font-bold ${eQ <= 0 ? 'text-red-400' : eQ <= 1 ? 'text-amber-300' : 'text-[#a1d0c6]'}`}>Q{eQ}</span>
        {c.glitchTokens > 0 && <span className="text-[9px] text-red-400">⚡{c.glitchTokens}</span>}
      </div>
      {/* Style */}
      {c.styleTag && (
        <span className={`text-[8px] font-bold ${STYLE_CLR[c.styleTag]?.split(' ')[0] ?? ''}`}>{c.styleTag}</span>
      )}
      <VisBar vis={vis} />
      <div className="flex justify-between">
        <span className="text-[7px] text-white/30">{visLabel}</span>
        <span className="text-[7px] text-[#a1d0c6]/50">{vis}✦</span>
      </div>
      <span className="text-[7px] text-white/25 truncate">{getCardById(c.modelId)?.name ?? c.modelId}</span>
      {label && <span className="text-[7px] text-amber-400/70">{label}</span>}
    </div>
  );
}

// ─── Shared model chip ────────────────────────────────────────
function ModelChip({
  m, onClick, highlight, dim
}: { m: ModelState; onClick?: () => void; highlight?: boolean; dim?: boolean }) {
  const card = getCardById(m.cardId);
  if (!card) return null;
  const used = m.activatedThisTurnBy !== null;
  return (
    <div
      onClick={onClick}
      className={`flex flex-col gap-1 p-2 rounded-xl border cursor-pointer select-none transition-all
        ${highlight ? 'border-amber-400 bg-amber-400/10 scale-105' : 'border-[#cebefa]/20 bg-white/5 hover:border-[#cebefa]/40'}
        ${(used || dim) ? 'opacity-40' : ''}
      `}
      style={{ minWidth: 96, width: 96 }}
    >
      <span className="text-[9px] font-bold text-[#cebefa] leading-tight truncate">{card.name}</span>
      <div className="flex gap-1 flex-wrap">
        <span className="text-[7px] bg-[#cebefa]/10 text-[#cebefa]/70 px-1 rounded">Q{card.quality}</span>
        <span className="text-[7px] bg-white/10 text-white/60 px-1 rounded">⏳{card.runtime}</span>
        <span className="text-[7px] bg-white/10 text-white/60 px-1 rounded">⚡{card.activateCost}¢</span>
      </div>
      {m.loraCardId && <span className="text-[7px] text-amber-400 truncate">{getCardById(m.loraCardId)?.name}</span>}
      {m.noiseTurnsRemaining > 0 && <span className="text-[7px] text-red-400">NOISE {m.noiseTurnsRemaining}t</span>}
      {m.queueSkipReady && <span className="text-[7px] text-green-400">SKIP✓</span>}
      <div className="flex justify-between">
        <span className="text-[7px] text-white/25">by {m.ownerId}</span>
        {used && <span className="text-[7px] text-white/25">used</span>}
      </div>
    </div>
  );
}

// ─── Hand card: 2:3 non-model, 3:2 model ─────────────────────
function HandCard({
  id, selected, dim, onClick, onInspect
}: { id: string; selected?: boolean; dim?: boolean; onClick?: () => void; onInspect?: () => void }) {
  const card = getCardById(id);
  if (!card) return null;
  const isModel = card.type === 'model';

  const borderCol: Record<string, string> = {
    model:    'border-[#cebefa]/40 hover:border-[#cebefa]/80 bg-[#cebefa]/5',
    prompt:   'border-green-500/40 hover:border-green-500/70 bg-green-500/5',
    modifier: 'border-amber-500/40 hover:border-amber-500/70 bg-amber-500/5',
    artifact: 'border-purple-500/40 hover:border-purple-500/70 bg-purple-500/5',
    event:    'border-blue-500/40 hover:border-blue-500/70 bg-blue-500/5',
  };

  // Model: 3:2 landscape (108×72). Others: 2:3 portrait (66×99)
  const w = isModel ? 108 : 66;
  const h = isModel ? 72  : 99;

  return (
    <div className="relative group flex-shrink-0">
      <div
        onClick={onClick}
        title={`${card.name} — ${card.effect ?? ''}`}
        className={`flex flex-col gap-1 p-2 rounded-xl border cursor-pointer select-none transition-all overflow-hidden
          ${selected ? 'border-amber-400 bg-amber-400/15 scale-105 shadow-lg shadow-amber-400/20' : borderCol[card.type] ?? 'border-white/20 bg-white/5'}
          ${dim ? 'opacity-25 pointer-events-none' : ''}
        `}
        style={{ width: w, height: h }}
      >
        <span className="text-[7px] uppercase tracking-wider text-white/35 font-bold">{card.type}</span>
        <span className={`font-bold text-white leading-tight ${isModel ? 'text-[10px]' : 'text-[9px]'} line-clamp-2`}>{card.name}</span>

        {isModel ? (
          // Landscape layout for models
          <div className="flex gap-2 items-end mt-auto">
            <span className="text-[8px] text-[#cebefa]/60">Q{card.quality}</span>
            <span className="text-[8px] text-white/40">⏳{card.runtime}</span>
            <span className="text-[8px] text-white/40 ml-auto">▶{card.activateCost}¢</span>
          </div>
        ) : (
          // Portrait layout for others
          <>
            <span className="text-[7px] text-[#a1d0c6]/50">{card.cost ?? 0}{card.costType === 'reputation' ? '★' : '¢'}</span>
            {card.promptType && <span className="text-[7px] text-green-400/60">{card.promptType}</span>}
            <p className="text-[7px] text-white/30 leading-tight mt-auto line-clamp-2">{card.effect}</p>
          </>
        )}
      </div>
      {/* Inspect button */}
      <button
        onClick={e => { e.stopPropagation(); onInspect?.(); }}
        className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 text-[8px] text-white/40 hover:text-white transition-opacity leading-none bg-black/40 rounded px-0.5"
      >👁</button>
    </div>
  );
}

// ─── Card detail modal ────────────────────────────────────────
function CardDetail({
  id, onClose, onPlay, canPlay, playLabel
}: { id: string; onClose: () => void; onPlay?: () => void; canPlay?: boolean; playLabel?: string }) {
  const card = getCardById(id);
  if (!card) return null;
  const isModel = card.type === 'model';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative bg-[#1a1f1e] border border-[#a1d0c6]/25 rounded-2xl shadow-2xl overflow-hidden flex"
        style={{ width: 340 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Coloured side strip */}
        <div className={`w-1.5 shrink-0 ${isModel ? 'bg-[#cebefa]/50' : card.type === 'prompt' ? 'bg-green-500/50' : card.type === 'modifier' ? 'bg-amber-500/50' : card.type === 'artifact' ? 'bg-purple-500/50' : 'bg-blue-500/50'}`} />

        <div className="flex flex-col gap-3 p-5 flex-1">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[9px] uppercase tracking-widest text-white/35">{card.type}{card.subtype ? ` · ${card.subtype}` : ''}{card.promptType ? ` · ${card.promptType}` : ''}</p>
              <h3 className="text-lg font-bold text-white leading-tight">{card.name}</h3>
            </div>
            <button onClick={onClose} className="text-white/30 hover:text-white text-xl leading-none ml-3">✕</button>
          </div>

          {/* Stats for models */}
          {isModel && (
            <div className="flex gap-3 text-xs text-white/50">
              <span>Play: <strong className="text-white">{card.playCost}¢</strong></span>
              <span>Activate: <strong className="text-white">{card.activateCost}¢</strong></span>
              <span>Quality: <strong className="text-white">{card.quality}</strong></span>
              <span>Runtime: <strong className="text-white">{card.runtime}</strong></span>
            </div>
          )}

          {/* Stats for non-models */}
          {!isModel && (
            <div className="text-xs text-white/50">
              Cost: <strong className="text-white">{card.cost ?? 0}{card.costType === 'reputation' ? ' Rep' : ' Credits'}</strong>
            </div>
          )}

          {/* Keyword */}
          {card.keyword && <p className="text-xs italic text-[#a1d0c6]/60">"{card.keyword}"</p>}

          {/* Effect */}
          {card.effect && (
            <div className="bg-black/30 rounded-xl p-3">
              <p className="text-sm text-white/80 leading-relaxed">{card.effect}</p>
            </div>
          )}

          {/* Compatibility */}
          {(card.compatible?.length > 0 || card.incompatible?.length > 0) && (
            <div className="flex gap-1.5 flex-wrap">
              {card.compatible?.map(t => (
                <span key={t} className="text-[8px] bg-green-500/15 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full">✔ {t}</span>
              ))}
              {card.incompatible?.map(t => (
                <span key={t} className="text-[8px] bg-red-500/15 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">✘ {t}</span>
              ))}
            </div>
          )}

          {/* Flavour */}
          {card.flavourText && (
            <p className="text-[10px] italic text-white/30 border-t border-white/5 pt-3">"{card.flavourText}"</p>
          )}

          {/* Actions */}
          {onPlay && (
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => { onClose(); onPlay(); }}
                disabled={!canPlay}
                className="flex-1 py-2 bg-[#a1d0c6] text-[#033730] font-bold rounded-xl text-sm hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {playLabel ?? 'Use This Card'}
              </button>
              <button onClick={onClose} className="px-4 py-2 border border-white/15 text-white/50 rounded-xl text-sm hover:bg-white/5">
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Creator abilities panel ──────────────────────────────────
function CreatorPanel({
  creatorId, player, isMyTurn, onAbility, onClose
}: {
  creatorId: string;
  player: GameState['players']['player'];
  isMyTurn: boolean;
  onAbility: (n: number | 'signature') => void;
  onClose: () => void;
}) {
  const card = getCardById(creatorId);
  if (!card) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/65 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#1a1f1e] border border-[#a1d0c6]/20 rounded-2xl p-5 w-full max-w-md mx-4 shadow-2xl flex flex-col gap-3 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[8px] uppercase tracking-widest text-[#a1d0c6]/50">Creator Card</p>
            <h2 className="text-xl font-bold text-white">{card.name}</h2>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white text-xl leading-none">✕</button>
        </div>
        {/* Stats */}
        <div className="flex gap-3 text-xs text-white/50 flex-wrap">
          <span>❤ <strong className="text-white">{player.loyalty}</strong></span>
          <span>★ <strong className="text-amber-400">{player.reputation}/20</strong></span>
          <span>¢ <strong className="text-[#a1d0c6]">{player.credits}/{player.creditCap}</strong></span>
          {player.creatorExhaustedThisTurn && <span className="text-red-400 font-bold">EXHAUSTED</span>}
          {player.mods.ban && <span className="text-red-400 font-bold">BANNED</span>}
        </div>

        {/* Passive */}
        {card.passive && (
          <div className="bg-[#a1d0c6]/5 border border-[#a1d0c6]/15 rounded-xl p-3">
            <p className="text-[8px] font-bold uppercase text-[#a1d0c6]/50 mb-1">◈ PASSIVE — {card.passive.name}</p>
            <p className="text-xs text-white/65 leading-relaxed">{card.passive.text}</p>
          </div>
        )}
        {card.influence && (
          <div className="bg-[#a1d0c6]/5 border border-[#a1d0c6]/15 rounded-xl p-3">
            <p className="text-[8px] font-bold uppercase text-[#a1d0c6]/50 mb-1">◈ INFLUENCE — {card.influence.name}</p>
            <p className="text-xs text-white/65 leading-relaxed">{card.influence.text}</p>
          </div>
        )}
        {card.favouritePrompt && (
          <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-3">
            <p className="text-[8px] font-bold uppercase text-green-400/50 mb-1">✦ FAVOURITE PROMPT ({card.favouritePrompt.subtype})</p>
            <p className="text-xs italic text-white/50">{card.favouritePrompt.text}</p>
            <p className="text-[9px] text-green-400/60 mt-1">{card.favouritePrompt.effect}</p>
          </div>
        )}

        {/* Abilities */}
        {(card.abilities ?? []).map((ab, i) => {
          const nums = ['', '①', '②', '③'];
          const numStr = ab.num === 'signature' ? '⚡' : (nums[Number(ab.num)] ?? String(ab.num));
          const costStr = [
            ab.cost?.reputation ? `${ab.cost.reputation} Rep` : '',
            ab.cost?.loyalty    ? `${ab.cost.loyalty} Loyalty` : '',
            ab.cost?.credits    ? `${ab.cost.credits} Credits` : '',
          ].filter(Boolean).join(' + ') || 'Free';
          const isSig = ab.num === 'signature';

          return (
            <button
              key={i}
              onClick={() => { if (isMyTurn) { onAbility(ab.num); onClose(); } }}
              disabled={!isMyTurn}
              className={`text-left p-3 rounded-xl border transition-all
                ${isSig ? 'border-red-500/40 bg-red-500/5 hover:bg-red-500/10' : 'border-white/10 bg-white/3 hover:bg-white/8'}
                ${!isMyTurn ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <div className="flex justify-between mb-1">
                <span className="text-xs font-bold text-white">{numStr} {ab.name}</span>
                <span className="text-[9px] text-amber-400">{costStr}</span>
              </div>
              <p className="text-[9px] text-white/50 leading-relaxed">{ab.text}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Inspector (read-only card view) ─────────────────────────
function Inspector({ id, onClose }: { id: string; onClose: () => void }) {
  const card = getCardById(id);
  if (!card) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-[#1a1f1e] border border-[#a1d0c6]/20 rounded-2xl p-5 max-w-sm w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between mb-3">
          <div>
            <p className="text-[8px] uppercase tracking-widest text-white/35">{card.type}{card.subtype ? ` · ${card.subtype}` : ''}</p>
            <h3 className="text-base font-bold text-white">{card.name}</h3>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white text-xl">✕</button>
        </div>
        {card.type === 'model' && (
          <div className="flex gap-3 text-xs text-white/50 mb-2">
            <span>Play {card.playCost}¢</span>
            <span>Activate {card.activateCost}¢</span>
            <span>Q{card.quality}</span>
            <span>⏳{card.runtime}</span>
          </div>
        )}
        {card.keyword && <p className="text-xs italic text-[#a1d0c6]/50 mb-2">"{card.keyword}"</p>}
        {card.effect && <div className="bg-black/30 rounded-xl p-3 mb-2"><p className="text-sm text-white/75 leading-relaxed">{card.effect}</p></div>}
        {(card.compatible?.length > 0 || card.incompatible?.length > 0) && (
          <div className="flex gap-1.5 flex-wrap mb-2">
            {card.compatible?.map(t => <span key={t} className="text-[8px] bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded-full">✔ {t}</span>)}
            {card.incompatible?.map(t => <span key={t} className="text-[8px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-full">✘ {t}</span>)}
          </div>
        )}
        {card.flavourText && <p className="text-[9px] italic text-white/25 border-t border-white/5 pt-2">"{card.flavourText}"</p>}
      </div>
    </div>
  );
}

// ─── Algorithm Swap style picker ──────────────────────────────
function StylePicker({
  cardId, chosen, onToggle, onConfirm, onCancel
}: { cardId: string; chosen: StyleTag[]; onToggle: (s: StyleTag) => void; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onCancel}>
      <div className="bg-[#1a1f1e] border border-[#a1d0c6]/20 rounded-2xl p-5 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-white mb-1">Algorithm Swap</h3>
        <p className="text-xs text-white/50 mb-4">Choose exactly 2 Style tags to swap for this round.</p>
        <div className="flex gap-2 flex-wrap justify-center mb-4">
          {STYLES.map(s => (
            <button
              key={s}
              onClick={() => onToggle(s)}
              className={`px-3 py-2 rounded-xl border text-sm font-bold transition-all ${chosen.includes(s) ? `border-current ${STYLE_CLR[s].split(' ').join(' ')} bg-white/10 scale-110` : 'border-white/15 text-white/40 hover:border-white/30'}`}
            >{s}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            disabled={chosen.length !== 2}
            className="flex-1 py-2 bg-[#a1d0c6] text-[#033730] font-bold rounded-xl disabled:opacity-40"
          >Confirm Swap ({chosen[0] ?? '?'} ↔ {chosen[1] ?? '?'})</button>
          <button onClick={onCancel} className="px-4 py-2 border border-white/15 text-white/50 rounded-xl">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── DeckSelect ───────────────────────────────────────────────
function DeckSelect({ onStart }: { onStart: (p: string, a: string) => void }) {
  const decks = getAllDecks();
  const meta = loadMeta();
  const [chosen, setChosen] = useState(meta.lastDeck ?? decks[0]?.id ?? 'deckA');
  const [showAll, setShowAll] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fav, setFav] = useState(meta.favDeck ?? '');

  function go() {
    saveMeta({ ...meta, lastDeck: chosen });
    const ai = chosen === 'deckA' ? 'deckB' : 'deckA';
    onStart(chosen, ai);
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center py-12 px-4 gap-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-1">Choose Your Deck</h1>
        <p className="text-white/40 text-sm">The AI takes the opposing starter deck.</p>
      </div>

      <div className="flex flex-col gap-2 w-full max-w-md">
        {/* Last used */}
        {meta.lastDeck && (() => { const d = decks.find(x => x.id === meta.lastDeck); if (!d) return null; return (
          <button onClick={() => setChosen(meta.lastDeck!)} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${chosen === meta.lastDeck ? 'border-[#a1d0c6] bg-[#a1d0c6]/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
            <span className="text-xl">🕑</span>
            <div><p className="text-[8px] uppercase text-white/35">Last Used</p><p className="font-bold text-white">{d.name}</p></div>
          </button>
        ); })()}

        {/* Favourite */}
        {fav && fav !== meta.lastDeck && (() => { const d = decks.find(x => x.id === fav); if (!d) return null; return (
          <button onClick={() => setChosen(fav)} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${chosen === fav ? 'border-[#a1d0c6] bg-[#a1d0c6]/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
            <span className="text-xl">⭐</span>
            <div><p className="text-[8px] uppercase text-white/35">Favourite</p><p className="font-bold text-white">{d.name}</p></div>
          </button>
        ); })()}

        {/* Browse */}
        <button onClick={() => setShowAll(v => !v)} className="flex items-center gap-3 p-4 rounded-2xl border border-white/10 bg-white/5 hover:border-white/20 transition-all">
          <span className="text-xl">📚</span>
          <div className="flex-1 text-left"><p className="text-[8px] uppercase text-white/35">Browse All Decks</p></div>
          <span className="text-white/30">{showAll ? '▲' : '▼'}</span>
        </button>

        {showAll && (
          <div className="flex flex-col gap-2 pl-2">
            {decks.map(d => (
              <div key={d.id} className="flex items-center gap-2">
                <button onClick={() => setChosen(d.id)} className={`flex-1 p-3 rounded-xl border text-left transition-all ${chosen === d.id ? 'border-[#a1d0c6] bg-[#a1d0c6]/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
                  <p className="text-sm font-bold text-white">{d.name}</p>
                  <p className="text-[8px] text-white/35">{d.creator ? getCardById(d.creator)?.name : '—'}</p>
                </button>
                <button onClick={() => { setFav(d.id); saveMeta({ ...meta, favDeck: d.id }); }} className={`text-lg ${fav === d.id ? 'text-amber-400' : 'text-white/20 hover:text-amber-400/60'}`}>⭐</button>
                <button onClick={() => setPreview(preview === d.id ? null : d.id)} className="text-white/30 hover:text-white text-sm">👁</button>
              </div>
            ))}
          </div>
        )}

        {preview && (() => { const d = decks.find(x => x.id === preview); if (!d) return null; return (
          <div className="p-4 rounded-2xl border border-white/10 bg-white/5 text-xs max-h-48 overflow-y-auto">
            <p className="font-bold text-white mb-2">{d.name}</p>
            {Object.entries(d.cards).map(([id, cnt]) => (
              <div key={id} className="flex justify-between text-white/50 py-0.5">
                <span>{getCardById(id)?.name ?? id}</span><span>×{cnt}</span>
              </div>
            ))}
          </div>
        ); })()}
      </div>

      <button onClick={go} className="px-8 py-3 bg-[#a1d0c6] text-[#033730] font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all text-sm">
        Start Game →
      </button>
    </div>
  );
}

// ─── Mulligan screen ──────────────────────────────────────────
function MulliganScreen({ gs, onDecide }: { gs: GameState; onDecide: (m: boolean) => void }) {
  const p = gs.players.player;
  const guaranteed = getAllDecks().find(d => d.id === gs.playerDeckId)?.guaranteedModels ?? [];
  const models = p.hand.filter(id => guaranteed.includes(id));
  const others = p.hand.filter(id => !guaranteed.includes(id));
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center py-12 px-4 gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">Opening Hand</h1>
        <p className="text-white/40 text-sm mt-1">Guaranteed models always stay. Mulligan redraws 6 cards.</p>
      </div>
      {models.length > 0 && (
        <div className="text-center">
          <p className="text-[8px] uppercase text-[#a1d0c6]/50 tracking-widest mb-2">Guaranteed Models (always kept)</p>
          <div className="flex gap-2 justify-center flex-wrap">{models.map((id, i) => <HandCard key={i} id={id} />)}</div>
        </div>
      )}
      <div className="text-center">
        <p className="text-[8px] uppercase text-white/30 tracking-widest mb-2">Drawn Cards</p>
        <div className="flex gap-2 justify-center flex-wrap max-w-2xl">{others.map((id, i) => <HandCard key={i} id={id} />)}</div>
      </div>
      <div className="flex gap-4">
        <button onClick={() => onDecide(false)} className="px-6 py-3 border border-[#a1d0c6]/30 text-[#a1d0c6] rounded-xl hover:bg-[#a1d0c6]/10 font-bold">Keep Hand</button>
        <button onClick={() => onDecide(true)} className="px-6 py-3 bg-[#cebefa]/15 text-[#cebefa] border border-[#cebefa]/30 rounded-xl hover:bg-[#cebefa]/25 font-bold">Mulligan → Draw 6</button>
      </div>
      <p className="text-[9px] text-white/20">AI is deciding…</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function ArenaBattlefield() {
  const [gs, setGs]           = useState<GameState | null>(null);
  const [pa, setPa]           = useState<PA | null>(null);
  const [inspected, setIns]   = useState<string | null>(null);    // card ID for read-only inspector
  const [detailId, setDetail] = useState<string | null>(null);    // card ID for action detail view
  const [detailIdx, setDIdx]  = useState<number | null>(null);    // hand index for the detail card
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [notif, setNotif]     = useState<string | null>(null);
  const logRef                = useRef<HTMLDivElement>(null);

  useEffect(() => { logRef.current?.scrollTo({ top: 9999, behavior: 'smooth' }); }, [gs?.log]);

  const notify = (msg: string) => { setNotif(msg); setTimeout(() => setNotif(null), 2800); };

  function upd(s: GameState) { setGs(s); return s; }

  function runAiAfter(state: GameState) {
    if (state.phase !== 'playing' || state.currentPlayer !== 'ai') return;
    setTimeout(() => {
      setGs(s => {
        if (!s || s.currentPlayer !== 'ai') return s;
        let a = runAiTurn(s);
        if (a.phase === 'playing' && a.currentPlayer === 'player' && a.turnPhase === 'refresh')
          a = runRefreshPhase(a);
        return a;
      });
    }, 750);
  }

  // ── Start ────────────────────────────────────────────────────
  function startGame(pid: string, aid: string) { upd(initGame(pid, aid)); }

  // ── Mulligan ─────────────────────────────────────────────────
  function handleMulligan(doM: boolean) {
    if (!gs) return;
    let s = applyMulligan(gs, 'player', doM);
    s = aiDecideMulligan(s);
    if (s.phase === 'playing') {
      s = runRefreshPhase(s);
      if (s.currentPlayer === 'ai') runAiAfter(s);
    }
    upd(s);
  }

  // ── End turn ─────────────────────────────────────────────────
  function endTurn() {
    if (!gs || gs.currentPlayer !== 'player') return;
    const p = gs.players.player;
    if (p.hand.length > 7) { setPa({ kind: 'discard', count: p.hand.length - 7, selected: [] }); return; }
    let s = runEndPhase(gs);
    if (s.phase === 'gameover') { upd(s); return; }
    if (s.slotOverflowPending) { upd(s); return; }
    s = runRefreshPhase(s);
    upd(s);
    runAiAfter(s);
  }

  function confirmDiscard() {
    if (!gs || pa?.kind !== 'discard') return;
    if (pa.selected.length !== pa.count) { notify(`Select ${pa.count} card(s) to discard`); return; }
    let p = { ...gs.players.player };
    for (const id of pa.selected) {
      const i = p.hand.indexOf(id);
      if (i !== -1) { p.hand = [...p.hand.slice(0, i), ...p.hand.slice(i + 1)]; p.discard = [...p.discard, id]; }
    }
    let s = { ...gs, players: { ...gs.players, player: p } };
    setPa(null);
    s = runEndPhase(s);
    if (s.phase === 'gameover') { upd(s); return; }
    s = runRefreshPhase(s);
    upd(s);
    runAiAfter(s);
  }

  function resolveOverflow(existingId?: string) {
    if (!gs) return;
    const s = resolveSlotOverflow(gs, existingId);
    setPa(null);
    upd(s);
  }

  // ═══════════════════════════════════════════════════════════
  // CARD INITIATION — decides what happens when a card is played
  // ═══════════════════════════════════════════════════════════
  function initiateCard(cardId: string) {
    if (!gs || gs.currentPlayer !== 'player') return;
    const card = getCardById(cardId);
    if (!card) return;
    const p = gs.players.player;

    switch (card.type) {
      case 'model': {
        const cost = card.playCost ?? 0;
        if (p.credits < cost) { notify('Not enough credits.'); return; }
        upd(playModel(gs, cardId));
        break;
      }
      case 'prompt':
        notify('Select a model in the Shared Zone, then add prompts during activation.');
        break;
      case 'modifier': {
        const spec = getTargetSpec(cardId, gs);
        if (!spec) { notify('No target needed — cannot play this modifier without a target.'); return; }
        setPa({ kind: 'target', spec: { ...spec, cardId } });
        break;
      }
      case 'artifact': {
        if (cardId === 'A-006') { setPa({ kind: 'pick-styles', cardId, chosen: [] }); return; }
        const spec = getTargetSpec(cardId, gs);
        if (!spec) {
          // Global effect — play immediately
          upd(playArtifact(gs, cardId));
        } else {
          setPa({ kind: 'target', spec: { ...spec, cardId } });
        }
        break;
      }
      case 'event': {
        if (gs.round < 2 && cardId !== 'E-001') { notify('Events cannot be played in Round 1.'); return; }
        if (cardId === 'E-002') {
          // Auto-targets opponent — no target selection needed
          upd(playEvent(gs, cardId));
          return;
        }
        const spec = getTargetSpec(cardId, gs);
        if (!spec) {
          upd(playEvent(gs, cardId));
        } else {
          setPa({ kind: 'target', spec: { ...spec, cardId } });
        }
        break;
      }
    }
    setDetail(null);
  }

  // ── Confirm target selection and execute ──────────────────────
  function executeTarget() {
    if (!gs || pa?.kind !== 'target') return;
    const { spec } = pa;
    const target = spec.selected[0];
    const targets = spec.selected;

    if (spec.cardId) {
      const cardId = spec.cardId;
      const card = getCardById(cardId);
      if (!card) return;
      if (spec.maxTargets > 0 && targets.length === 0) { notify('Select a target first.'); return; }

      switch (card.type) {
        case 'modifier': {
          // Determine target type
          if (spec.ownCreator || spec.oppCreator) {
            const tpid = target as PlayerId;
            upd(playModifier(gs, cardId, tpid, 'creator'));
          } else if (spec.anyModel || spec.ownModel) {
            upd(playModifier(gs, cardId, target, 'model'));
          } else {
            upd(playModifier(gs, cardId, target, 'creation'));
          }
          break;
        }
        case 'artifact':
          upd(playArtifact(gs, cardId, target));
          break;
        case 'event':
          upd(playEvent(gs, cardId, target));
          break;
      }
    } else if (spec.abilityNum !== undefined) {
      if (spec.maxTargets > 1) {
        upd(useCreatorAbility(gs, spec.abilityNum, targets[0], targets.slice(1)));
      } else {
        upd(useCreatorAbility(gs, spec.abilityNum, target));
      }
    }
    setPa(null);
  }

  // ── Algorithm Swap confirm ────────────────────────────────────
  function confirmSwap() {
    if (!gs || pa?.kind !== 'pick-styles' || pa.chosen.length !== 2) return;
    const [s1, s2] = pa.chosen as [StyleTag, StyleTag];
    upd(playArtifact(gs, pa.cardId, undefined, [s1, s2]));
    setPa(null);
  }

  // ── Model click (shared zone) ─────────────────────────────────
  function onModel(m: ModelState) {
    if (!gs) return;
    if (pa?.kind === 'target') {
      const { spec } = pa;
      const itype: 'own-model' | 'opp-model' = m.ownerId === 'player' ? 'own-model' : 'opp-model';
      if (!isValidTarget(spec, itype, m.instanceId, m, gs)) { notify('Invalid target.'); return; }
      setPa({ ...pa, spec: { ...spec, selected: [m.instanceId] } });
      // Auto-confirm if max 1 target
      if (spec.maxTargets === 1) {
        setTimeout(() => {
          setPa(cur => {
            if (!cur || cur.kind !== 'target') return cur;
            const updated = { ...cur, spec: { ...cur.spec, selected: [m.instanceId] } };
            const { spec: s } = updated;
            if (s.cardId) {
              const card = getCardById(s.cardId);
              if (card?.type === 'modifier') upd(playModifier(gs, s.cardId, m.instanceId, 'model'));
              else if (card?.type === 'event') upd(playEvent(gs, s.cardId, m.instanceId));
            }
            return null;
          });
        }, 50);
      }
      return;
    }
    // Start activation
    if (gs.currentPlayer !== 'player') { notify('Not your turn.'); return; }
    if (m.activatedThisTurnBy !== null) { notify('Already activated this turn.'); return; }
    if (m.ownerId !== 'player' && gs.round < 2) { notify('Cannot use opponent models until Round 2.'); return; }
    if (gs.players.player.queue.length >= 2) { notify('Queue full (max 2).'); return; }
    setPa({ kind: 'activate', modelId: m.instanceId, prompts: [], useFav: false });
  }

  function confirmActivation() {
    if (!gs || pa?.kind !== 'activate') return;
    const state = activateModel(gs, pa.modelId, pa.prompts, pa.useFav);
    upd(state);
    setPa(null);
  }

  // ── Creation click ────────────────────────────────────────────
  function onCreation(c: CreationState, side: PlayerId, isQueue = false) {
    if (!gs) return;

    // Slot overflow resolution
    if (gs.slotOverflowPending?.playerId === 'player' && side === 'player') {
      resolveOverflow(c.instanceId);
      return;
    }

    if (pa?.kind === 'target') {
      const { spec } = pa;
      let itype: 'own-active' | 'opp-active' | 'own-queue' | 'opp-queue';
      if (side === 'player') itype = isQueue ? 'own-queue' : 'own-active';
      else                   itype = isQueue ? 'opp-queue' : 'opp-active';

      if (!isValidTarget(spec, itype, c.instanceId, c, gs)) { notify('Invalid target for this action.'); return; }

      const already = spec.selected.includes(c.instanceId);
      const newSel = already
        ? spec.selected.filter(id => id !== c.instanceId)
        : spec.selected.length < spec.maxTargets ? [...spec.selected, c.instanceId] : spec.selected;

      const newSpec = { ...spec, selected: newSel };
      // Auto-execute single-target
      if (spec.maxTargets === 1 && newSel.length === 1) {
        const target = newSel[0];
        if (spec.cardId) {
          const card = getCardById(spec.cardId);
          if (card?.type === 'modifier') upd(playModifier(gs, spec.cardId, target, 'creation'));
          else if (card?.type === 'artifact') upd(playArtifact(gs, spec.cardId, target));
          else if (card?.type === 'event') upd(playEvent(gs, spec.cardId, target));
          setPa(null);
        } else if (spec.abilityNum !== undefined) {
          upd(useCreatorAbility(gs, spec.abilityNum, target));
          setPa(null);
        } else {
          setPa({ ...pa, spec: newSpec });
        }
      } else {
        setPa({ ...pa, spec: newSpec });
      }
      return;
    }

    if (pa?.kind === 'activate') {
      setIns(c.modelId);
      return;
    }

    // Clip-lock shortcut
    if (!pa) {
      setIns(c.modelId);
    }
  }

  // ── Creator click ─────────────────────────────────────────────
  function onCreator(side: PlayerId) {
    if (!gs) return;
    if (pa?.kind === 'target') {
      const { spec } = pa;
      const itype: 'own-creator' | 'opp-creator' = side === 'player' ? 'own-creator' : 'opp-creator';
      if (!isValidTarget(spec, itype, side, null, gs)) { notify('Invalid target.'); return; }
      // Execute immediately for creator targets
      if (spec.cardId) {
        const card = getCardById(spec.cardId);
        if (card?.type === 'modifier') {
          upd(playModifier(gs, spec.cardId, side, 'creator'));
          setPa(null);
          return;
        }
      }
      return;
    }
    if (side === 'player') setCreatorOpen(true);
    else setIns(gs.players.ai.creatorId);
  }

  // ── Ability trigger from creator panel ────────────────────────
  function triggerAbility(num: number | 'signature') {
    if (!gs) return;
    const p = gs.players.player;
    // Auto-executing abilities (no target)
    if (p.creatorId === 'C-002') {
      // Anon: all abilities auto-execute
      const s = useCreatorAbility(gs, num);
      upd(s);
      return;
    }
    // Aia abilities that need a target
    const spec = getAbilityTargetSpec(num, p.creatorId, gs);
    if (!spec) {
      upd(useCreatorAbility(gs, num));
      return;
    }
    setPa({ kind: 'target', spec: { ...spec, abilityNum: num } });
  }

  // ── CLIP-LOCK shortcut ────────────────────────────────────────
  function doClipLock() {
    if (!gs) return;
    setPa({
      kind: 'target',
      spec: {
        label: 'Select your Coherent Creation to CLIP-LOCK',
        ownActive: true,
        selected: [],
        maxTargets: 1,
      }
    });
    // Override execute to call applyClipLock
    // We'll handle this in executeTarget via a flag — simpler: use abilityNum=-1 as clip-lock signal
    // Actually, let's just detect it differently in onCreation:
    // For clip-lock we set a separate flag
    setPa(prev => prev?.kind === 'target' ? { ...prev, spec: { ...prev.spec, _isClipLock: true as any } } : prev);
  }

  // ── Remix ─────────────────────────────────────────────────────
  function doRemix() {
    if (!gs) return;
    setPa({
      kind: 'target',
      spec: {
        label: 'Select your Creation to Remix (CLIP-LOCKed not allowed)',
        ownActive: true,
        notClipLocked: true,
        selected: [],
        maxTargets: 1,
        _isRemix: true as any,
      }
    });
  }

  // Override onCreation to handle clip-lock / remix targets
  function onCreationWithSpecials(c: CreationState, side: PlayerId, isQueue = false) {
    if (!gs || pa?.kind !== 'target') { onCreation(c, side, isQueue); return; }
    const spec = pa.spec as any;
    if (spec._isClipLock && side === 'player' && !isQueue) {
      upd(applyClipLock(gs, c.instanceId));
      setPa(null);
      return;
    }
    if (spec._isRemix && side === 'player' && !isQueue) {
      if (c.clipLocked) { notify('Cannot remix a CLIP-LOCKed creation.'); return; }
      const stylePrompt = gs.players.player.hand.find(id => {
        const cd = getCardById(id);
        return cd?.promptType === 'Style' || cd?.promptType === 'Artist';
      });
      const pCost = stylePrompt ? (getCardById(stylePrompt)?.cost ?? 0) : 0;
      if (gs.players.player.credits < pCost) { notify('Not enough credits for remix.'); return; }
      upd(remixCreation(gs, c.instanceId, stylePrompt));
      setPa(null);
      return;
    }
    onCreation(c, side, isQueue);
  }

  // ─── RENDER ─────────────────────────────────────────────────
  if (!gs)                        return <DeckSelect onStart={startGame} />;
  if (gs.phase === 'mulligan')    return <MulliganScreen gs={gs} onDecide={handleMulligan} />;
  if (gs.phase === 'gameover')    return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center gap-8">
      <h1 className="text-4xl font-bold text-white">
        {gs.winner === 'player' ? '🎉 You Win!' : gs.winner === 'ai' ? '💀 AI Wins' : '🤝 Draw'}
      </h1>
      <button onClick={() => { setGs(null); setPa(null); }} className="px-8 py-3 bg-[#a1d0c6] text-[#033730] font-bold rounded-xl hover:brightness-110 transition-all">
        Play Again
      </button>
      <div className="text-xs text-white/30 space-y-1 text-center max-w-xs">
        {gs.log.slice(-6).map(l => <p key={l.id}>{l.msg}</p>)}
      </div>
    </div>
  );

  const isPlayerTurn = gs.currentPlayer === 'player';
  const player = gs.players.player;
  const ai     = gs.players.ai;
  const glow   = isPlayerTurn ? creatorGlowColor(gs, 'player') : 'none';
  const maxPLoy = getCardById(player.creatorId)?.loyalty ?? 11;
  const maxALoy = getCardById(ai.creatorId)?.loyalty ?? 16;

  function creatorRing(side: PlayerId) {
    if (pa?.kind !== 'target') return '';
    const spec = pa.spec as any;
    const valid = side === 'player'
      ? (spec.ownCreator && !spec._isClipLock && !spec._isRemix)
      : (spec.oppCreator && !spec._isClipLock && !spec._isRemix);
    return valid ? 'ring-2 ring-amber-400 brightness-125' : '';
  }

  function creationRing(c: CreationState, side: PlayerId, isQueue = false) {
    if (pa?.kind !== 'target') return false;
    const spec = pa.spec as any;
    if (spec.selected?.includes(c.instanceId)) return true;
    // Is this a valid target?
    let itype: 'own-active' | 'opp-active' | 'own-queue' | 'opp-queue';
    if (side === 'player') itype = isQueue ? 'own-queue' : 'own-active';
    else                   itype = isQueue ? 'opp-queue' : 'opp-active';
    return isValidTarget(spec as TargetSpec, itype, c.instanceId, c, gs);
  }

  function modelRing(m: ModelState) {
    if (pa?.kind !== 'target') return false;
    const spec = pa.spec;
    const itype: 'own-model' | 'opp-model' = m.ownerId === 'player' ? 'own-model' : 'opp-model';
    return isValidTarget(spec, itype, m.instanceId, m, gs);
  }

  return (
    <div className="flex flex-col gap-2 pb-4 select-none">
      {/* Notification */}
      {notif && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#1a1f1e] border border-amber-400/40 text-amber-400 px-4 py-2 rounded-xl text-sm font-bold shadow-xl pointer-events-none">
          {notif}
        </div>
      )}

      {/* Modals */}
      {inspected && <Inspector id={inspected} onClose={() => setIns(null)} />}
      {detailId && (
        <CardDetail
          id={detailId}
          onClose={() => setDetail(null)}
          onPlay={() => { initiateCard(detailId); }}
          canPlay={isPlayerTurn}
          playLabel={getCardById(detailId)?.type === 'model' ? 'Play to Shared Zone' : 'Use This Card'}
        />
      )}
      {pa?.kind === 'pick-styles' && (
        <StylePicker
          cardId={pa.cardId}
          chosen={pa.chosen}
          onToggle={s => {
            setPa(prev => {
              if (!prev || prev.kind !== 'pick-styles') return prev;
              const already = prev.chosen.includes(s);
              const next = already ? prev.chosen.filter(x => x !== s)
                : prev.chosen.length < 2 ? [...prev.chosen, s] : prev.chosen;
              return { ...prev, chosen: next };
            });
          }}
          onConfirm={confirmSwap}
          onCancel={() => setPa(null)}
        />
      )}
      {creatorOpen && (
        <CreatorPanel
          creatorId={player.creatorId}
          player={player}
          isMyTurn={isPlayerTurn}
          onAbility={triggerAbility}
          onClose={() => setCreatorOpen(false)}
        />
      )}

      <div className="flex flex-col gap-2 max-w-[1280px] mx-auto w-full px-2">

        {/* ══ AI ZONE ═══════════════════════════════════════════ */}
        <div className="bg-[#0d1211] border border-red-500/15 rounded-2xl p-3 flex flex-col gap-2">
          {/* AI header */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[9px] text-red-400/60 font-bold uppercase shrink-0">AI</span>
            <div className="flex-1 min-w-40"><LoyaltyBar val={ai.loyalty} max={maxALoy} label="Loyalty" /></div>
            <div className="flex gap-3 text-[9px] text-white/40 ml-auto flex-wrap">
              <span>★{ai.reputation}</span><span>¢{ai.credits}/{ai.creditCap}</span>
              <span>✋{ai.hand.length}</span><span>📚{ai.deck.length}</span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap items-start">
            {/* AI hand face-down */}
            <div className="flex gap-0.5 items-end">
              {ai.hand.map((_, i) => (
                <div key={i} className="rounded bg-white/5 border border-white/10" style={{ width: 20, height: 28 }} />
              ))}
            </div>
            {/* AI Creator card (compact, clickable as target) */}
            <div
              onClick={() => onCreator('ai')}
              className={`flex flex-col gap-1 px-3 py-2 rounded-xl border cursor-pointer transition-all bg-[#1a1f1e]/60
                ${creatorRing('ai') ? 'border-amber-400 bg-amber-400/10 shadow-lg shadow-amber-400/20' : 'border-red-500/15 hover:border-red-500/35'}
              `}
            >
              <p className="text-[7px] text-red-400/50 uppercase">AI Creator</p>
              <p className="text-[9px] font-bold text-white">{getCardById(ai.creatorId)?.name}</p>
              <div className="flex gap-1 flex-wrap text-[7px]">
                {ai.mods.ban && <span className="text-red-400">BANNED</span>}
                {ai.mods.astronaut && <span className="text-blue-400">🚀{ai.mods.astronaut.turnsRemaining}t</span>}
                {ai.mods.proSub && <span className="text-amber-400">PRO</span>}
                {ai.mods.trending && <span className="text-green-400">TREND</span>}
                {ai.creatorExhaustedThisTurn && <span className="text-red-400/60">EXHSTD</span>}
              </div>
            </div>
            {/* AI Queue */}
            {ai.queue.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-[7px] text-white/25 uppercase tracking-widest">Queue</span>
                <div className="flex gap-1.5 flex-wrap">
                  {ai.queue.map(c => (
                    <CreationChip key={c.instanceId} c={c}
                      highlight={creationRing(c, 'ai', true)}
                      onClick={() => onCreationWithSpecials(c, 'ai', true)}
                    />
                  ))}
                </div>
              </div>
            )}
            {ai.remixQueue && (
              <div className="flex flex-col gap-1">
                <span className="text-[7px] text-orange-400/50 uppercase tracking-widest">Remixing</span>
                <CreationChip c={ai.remixQueue} onClick={() => setIns(ai.remixQueue!.modelId)} />
              </div>
            )}
            {/* AI Active creations */}
            {ai.activeCreations.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-[7px] text-white/25 uppercase tracking-widest">Active</span>
                <div className="flex gap-1.5 flex-wrap">
                  {ai.activeCreations.map(c => (
                    <CreationChip key={c.instanceId} c={c}
                      highlight={creationRing(c, 'ai')}
                      onClick={() => onCreationWithSpecials(c, 'ai')}
                    />
                  ))}
                </div>
              </div>
            )}
            {ai.activeCreations.length === 0 && ai.queue.length === 0 && !ai.remixQueue && (
              <div className="w-20 h-14 rounded-xl border border-dashed border-white/10 flex items-center justify-center">
                <span className="text-[8px] text-white/20">no creations</span>
              </div>
            )}
          </div>
        </div>

        {/* ══ SHARED ZONE ══════════════════════════════════════ */}
        <div className="bg-black/30 border border-white/8 rounded-2xl p-3 flex flex-col gap-2">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <span className="text-[7px] uppercase tracking-widest text-white/25">Shared Zone · Models & Artifacts</span>
            <div className="flex gap-3 text-[8px] text-white/35">
              <span>Round {gs.round}</span>
              <span>Turn {gs.absTurn}</span>
              <span className={`font-bold ${isPlayerTurn ? 'text-[#a1d0c6]' : 'text-orange-400'}`}>
                {isPlayerTurn ? 'YOUR TURN' : 'AI TURN…'}
              </span>
            </div>
          </div>

          {/* Global effects */}
          <div className="flex gap-1.5 flex-wrap">
            {gs.serverOverloadRounds > 0 && <span className="text-[8px] bg-red-500/15 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">SERVER OVERLOAD {gs.serverOverloadRounds}r</span>}
            {gs.queueTimeoutRounds > 0 && <span className="text-[8px] bg-orange-500/15 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-full">QUEUE TIMEOUT {gs.queueTimeoutRounds}r</span>}
            {gs.centaurProblemRounds > 0 && <span className="text-[8px] bg-purple-500/15 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-full">CENTAUR PROBLEM {gs.centaurProblemRounds}r</span>}
            {gs.algorithmSwap && <span className="text-[8px] bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-full">ALGO SWAP: {gs.algorithmSwap.style1} ↔ {gs.algorithmSwap.style2}</span>}
            {gs.dailyChallengeAbstracts && <span className="text-[8px] bg-orange-400/15 text-orange-300 border border-orange-400/20 px-2 py-0.5 rounded-full">DAILY: ABSTRACT</span>}
            {gs.dailyChallengePortraits && <span className="text-[8px] bg-pink-400/15 text-pink-300 border border-pink-400/20 px-2 py-0.5 rounded-full">DAILY: PORTRAIT</span>}
          </div>

          {/* Models */}
          <div className="flex gap-2 flex-wrap">
            {gs.sharedModels.length === 0 && (
              <span className="text-[8px] text-white/20">No models in play. Play a model card to add one here.</span>
            )}
            {gs.sharedModels.map(m => (
              <ModelChip key={m.instanceId} m={m}
                highlight={modelRing(m)}
                dim={pa?.kind === 'activate' && m.instanceId !== pa.modelId && m.activatedThisTurnBy !== null}
                onClick={() => onModel(m)}
              />
            ))}
          </div>

          {/* Artifacts */}
          {gs.artifacts.length > 0 && (
            <div className="flex gap-2 flex-wrap pt-1 border-t border-white/5">
              {gs.artifacts.map(a => (
                <div key={a.instanceId} onClick={() => setIns(a.cardId)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-purple-500/10 border border-purple-500/15 cursor-pointer hover:bg-purple-500/20 transition-all">
                  <span className="text-[8px] text-purple-400">{getCardById(a.cardId)?.name}</span>
                  <span className="text-[7px] text-white/30">{a.turnsRemaining}t</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ══ PLAYER ZONE ══════════════════════════════════════ */}
        <div className="bg-[#0d1211] border border-[#a1d0c6]/20 rounded-2xl p-3 flex flex-col gap-3">
          {/* Player header */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[9px] text-[#a1d0c6]/70 font-bold uppercase shrink-0">YOU</span>
            <div className="flex-1 min-w-40"><LoyaltyBar val={player.loyalty} max={maxPLoy} label="Loyalty" /></div>
            <div className="flex gap-3 text-[9px] text-white/50 ml-auto">
              <span className="text-amber-400">★{player.reputation}/20</span>
              <span className="text-[#a1d0c6]">¢{player.credits}/{player.creditCap}</span>
              <span>📚{player.deck.length}</span>
            </div>
          </div>

          <div className="flex gap-3 flex-wrap items-start">
            {/* Creator card */}
            <div
              onClick={() => onCreator('player')}
              className={`flex flex-col gap-2 p-3 rounded-2xl border cursor-pointer transition-all bg-[#1a1f1e]/80 shrink-0
                ${glow === 'red'    ? 'border-red-500/70 shadow-[0_0_18px_rgba(239,68,68,0.45)]'
                : glow === 'yellow' ? 'border-amber-400/70 shadow-[0_0_18px_rgba(250,204,21,0.35)]'
                                    : 'border-[#a1d0c6]/20 hover:border-[#a1d0c6]/40'}
                ${creatorRing('player')}
              `}
              style={{ minWidth: 120 }}
            >
              <div className="flex items-center gap-1">
                <p className="text-[7px] text-[#a1d0c6]/40 uppercase font-bold">Creator</p>
                {player.creatorExhaustedThisTurn && <span className="text-[7px] text-red-400 ml-auto">EXHSTD</span>}
              </div>
              <p className="text-sm font-bold text-white leading-tight">{getCardById(player.creatorId)?.name}</p>
              <div className="flex gap-1 flex-wrap text-[7px]">
                {player.mods.ban && <span className="text-red-400">BANNED</span>}
                {player.mods.astronaut && <span className="text-blue-400">🚀{player.mods.astronaut.turnsRemaining}t</span>}
                {player.mods.proSub && <span className="text-amber-400">PRO {player.mods.proSub.turnsRemaining}t</span>}
                {player.mods.trending && <span className="text-green-400">TREND {player.mods.trending.roundsRemaining}r</span>}
              </div>
              {glow !== 'none' && (
                <span className={`text-[7px] px-1.5 py-0.5 rounded font-bold ${glow === 'red' ? 'bg-red-500/20 text-red-400' : 'bg-amber-400/20 text-amber-400'}`}>
                  {glow === 'red' ? '⚡ ULT READY' : '✦ ABILITY'}
                </span>
              )}
              <p className="text-[7px] text-white/25">Click for abilities</p>
            </div>

            {/* Player creations */}
            <div className="flex flex-col gap-2 flex-1">
              {/* Queue row */}
              {(player.queue.length > 0 || player.remixQueue) && (
                <div className="flex flex-col gap-1">
                  <span className="text-[7px] text-white/25 uppercase tracking-widest">Queue (entering field)</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {player.queue.map(c => (
                      <CreationChip key={c.instanceId} c={c}
                        highlight={creationRing(c, 'player', true)}
                        onClick={() => onCreationWithSpecials(c, 'player', true)}
                        label={`Arrives in ${c.runtime} turn${c.runtime !== 1 ? 's' : ''}`}
                      />
                    ))}
                    {player.remixQueue && (
                      <CreationChip c={player.remixQueue}
                        onClick={() => setIns(player.remixQueue!.modelId)}
                        label="Remixing…"
                      />
                    )}
                  </div>
                </div>
              )}
              {/* Active row */}
              <div className="flex flex-col gap-1">
                <span className="text-[7px] text-white/25 uppercase tracking-widest">Active Creations</span>
                <div className="flex gap-1.5 flex-wrap">
                  {player.activeCreations.map(c => (
                    <CreationChip key={c.instanceId} c={c}
                      highlight={creationRing(c, 'player') || (gs.slotOverflowPending?.playerId === 'player')}
                      onClick={() => onCreationWithSpecials(c, 'player')}
                    />
                  ))}
                  {Array.from({ length: Math.max(0, 3 - player.activeCreations.length) }).map((_, i) => (
                    <div key={i} className="flex items-center justify-center rounded-xl border border-dashed border-white/8" style={{ width: 96, height: 96 }}>
                      <span className="text-[7px] text-white/20">Slot {player.activeCreations.length + i + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Slot overflow prompt */}
          {gs.slotOverflowPending?.playerId === 'player' && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-3 flex items-center gap-3">
              <span className="text-sm text-red-400 font-bold">⚡ Slot Overflow!</span>
              <span className="text-xs text-white/50">Click a creation above to destroy it, or:</span>
              <button onClick={() => resolveOverflow()} className="text-[9px] border border-red-500/30 text-red-400 px-2 py-1 rounded hover:bg-red-500/10 ml-auto">
                Reject Incoming (−1 Loyalty)
              </button>
            </div>
          )}
        </div>

        {/* ══ PENDING ACTION BANNER ════════════════════════════ */}
        {pa && (
          <div className="bg-[#1a1f1e] border border-amber-400/30 rounded-2xl p-3">
            {pa.kind === 'activate' && (
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-bold text-amber-400">
                    Activating: {getCardById(gs.sharedModels.find(m => m.instanceId === pa.modelId)?.cardId ?? '')?.name ?? '—'}
                  </p>
                  <p className="text-xs text-white/40">Click prompt cards in your hand (max 2, different subtypes).</p>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {pa.prompts.map(id => (
                      <span key={id} className="text-[9px] bg-green-400/20 text-green-400 px-1.5 py-0.5 rounded-full">
                        {getCardById(id)?.name} ×
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-auto flex-wrap">
                  <label className="flex items-center gap-1 text-[9px] text-white/50 cursor-pointer">
                    <input type="checkbox" className="accent-amber-400" checked={pa.useFav}
                      onChange={e => setPa({ ...pa, useFav: e.target.checked })} />
                    Fav Prompt
                  </label>
                  <button onClick={confirmActivation} className="px-3 py-1.5 bg-[#a1d0c6] text-[#033730] font-bold rounded-lg text-xs hover:brightness-110">Generate →</button>
                  <button onClick={() => setPa(null)} className="px-2 py-1.5 border border-white/15 text-white/40 rounded-lg text-xs">Cancel</button>
                </div>
              </div>
            )}

            {pa.kind === 'target' && (() => {
              const spec = pa.spec as any;
              const needsConfirm = spec.maxTargets > 1;
              return (
                <div className="flex items-center gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-bold text-amber-400">{spec.label}</p>
                    <p className="text-[9px] text-white/40">
                      {spec.maxTargets > 1
                        ? `Select up to ${spec.maxTargets} targets, then confirm.`
                        : 'Click a highlighted target on the board.'}
                    </p>
                    {spec.selected?.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {spec.selected.map((_: string, i: number) => (
                          <span key={i} className="text-[9px] bg-amber-400/20 text-amber-400 px-1.5 py-0.5 rounded-full">Target {i + 1} ✓</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 ml-auto">
                    {needsConfirm && spec.selected?.length > 0 && (
                      <button onClick={executeTarget} className="px-3 py-1.5 bg-amber-400 text-black font-bold rounded-lg text-xs">Confirm</button>
                    )}
                    <button onClick={() => setPa(null)} className="px-2 py-1.5 border border-white/15 text-white/40 rounded-lg text-xs">Cancel</button>
                  </div>
                </div>
              );
            })()}

            {pa.kind === 'discard' && (
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-bold text-red-400">Discard {pa.count} card(s) to end your turn</p>
                  <p className="text-[9px] text-white/40">Click cards below to select ({pa.selected.length}/{pa.count}).</p>
                </div>
                <button onClick={confirmDiscard} disabled={pa.selected.length !== pa.count}
                  className="px-3 py-1.5 bg-red-500/30 text-red-300 font-bold rounded-lg text-xs disabled:opacity-40 ml-auto">
                  Discard & End Turn
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══ HAND + ACTIONS ════════════════════════════════════ */}
        <div className="bg-[#0d1211] border border-white/8 rounded-2xl p-3">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <span className="text-[7px] uppercase tracking-widest text-white/25">Hand ({player.hand.length} cards) — click a card to inspect and play it</span>
            <div className="flex gap-2 flex-wrap items-center">
              {player.creatorId === 'C-001' && !player.clipLockAppliedThisTurn && isPlayerTurn && (
                <button onClick={doClipLock} className="px-2 py-1.5 text-[9px] border border-cyan-400/30 text-cyan-400 rounded-lg hover:bg-cyan-400/10">🔒 CLIP-LOCK</button>
              )}
              {player.activeCreations.length > 0 && !player.remixQueue && isPlayerTurn && (
                <button onClick={doRemix} className="px-2 py-1.5 text-[9px] border border-orange-400/30 text-orange-400 rounded-lg hover:bg-orange-400/10">🔄 Remix</button>
              )}
              {isPlayerTurn ? (
                <button onClick={endTurn} disabled={!!gs.slotOverflowPending} className="px-4 py-1.5 text-xs font-bold bg-[#a1d0c6] text-[#033730] rounded-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-40">
                  End Turn →
                </button>
              ) : (
                <span className="px-4 py-1.5 text-[9px] text-white/25 border border-white/8 rounded-lg">AI thinking…</span>
              )}
            </div>
          </div>

          {/* Hand cards */}
          <div className="flex gap-2 flex-wrap items-end">
            {player.hand.map((id, i) => {
              const card = getCardById(id);
              const isPromptMode  = pa?.kind === 'activate';
              const inPromptSel   = pa?.kind === 'activate' && pa.prompts.includes(id);
              const inDiscardSel  = pa?.kind === 'discard'  && pa.selected.includes(id);
              const dim = !isPlayerTurn
                || (isPromptMode && card?.type !== 'prompt')
                || (pa?.kind === 'target' || pa?.kind === 'discard' && !inDiscardSel);
              const isDimForDiscard = pa?.kind === 'discard' && !inDiscardSel;

              return (
                <HandCard
                  key={`${id}-${i}`}
                  id={id}
                  selected={inPromptSel || inDiscardSel}
                  dim={(!isPlayerTurn) || (isPromptMode && card?.type !== 'prompt')}
                  onClick={() => {
                    if (!isPlayerTurn) { setIns(id); return; }
                    if (pa?.kind === 'activate' && card?.type === 'prompt') {
                      // Add/remove from prompt selection
                      const paCur = pa;
                      if (paCur.prompts.includes(id)) {
                        setPa({ ...paCur, prompts: paCur.prompts.filter(x => x !== id) });
                      } else {
                        const usedSubs = paCur.prompts.map(pid2 => getCardById(pid2)?.promptType ?? '');
                        const sub = card?.promptType ?? '';
                        if (usedSubs.includes(sub)) { notify(`Already using a ${sub} prompt.`); return; }
                        if (paCur.prompts.length >= 2) { notify('Max 2 prompts.'); return; }
                        setPa({ ...paCur, prompts: [...paCur.prompts, id] });
                      }
                      return;
                    }
                    if (pa?.kind === 'discard') {
                      const paCur = pa;
                      const already = paCur.selected.includes(id);
                      const sel = already
                        ? paCur.selected.filter(x => x !== id)
                        : paCur.selected.length < paCur.count ? [...paCur.selected, id] : paCur.selected;
                      setPa({ ...paCur, selected: sel });
                      return;
                    }
                    // Open detail modal
                    setDetail(id);
                    setDIdx(i);
                  }}
                  onInspect={() => setIns(id)}
                />
              );
            })}
            {player.hand.length === 0 && (
              <p className="text-[9px] text-white/20">No cards in hand.</p>
            )}
          </div>
        </div>

        {/* ══ LOG ══════════════════════════════════════════════ */}
        <div ref={logRef} className="bg-black/30 border border-white/8 rounded-2xl p-3 max-h-28 overflow-y-auto">
          <p className="text-[7px] uppercase tracking-widest text-white/20 mb-1.5">Game Log</p>
          {gs.log.slice(-35).map(e => (
            <p key={e.id} className={`text-[8px] leading-relaxed ${
              e.type === 'damage' ? 'text-red-400/80'
              : e.type === 'system' ? 'text-[#a1d0c6]/60 font-bold'
              : e.type === 'effect' ? 'text-[#cebefa]/60'
              : e.type === 'ai'     ? 'text-orange-400/60'
              : 'text-white/45'
            }`}>{e.msg}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
