// ============================================================
// PROMPT BATTLE — ArenaBattlefield · v0.3
// ============================================================

import { useReducer, useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ALL_CARDS, PREBUILT_DECKS } from '../data';
import type { Card } from '../types';
import { gameReducer } from '../game-engine';
import type { GameState, GameAction, Creation, PlayerId } from '../game-engine';
import { createAI } from '../ai-engine';
import type { Difficulty } from '../ai-engine';
import CreatorAbilityPanel from './CreatorAbilityPanel';

// ─────────────────────────────────────────────────────────────
// Constants & helpers
// ─────────────────────────────────────────────────────────────

const CMAP = new Map(ALL_CARDS.map(c => [c.id, c]));

// ─────────────────────────────────────────────────────────────
// Deck preference storage
// ─────────────────────────────────────────────────────────────

const PREF_KEY = 'pb_prefs';
interface Prefs { lastUsedId?: string; favouriteId?: string; }
function loadPrefs(): Prefs {
  try { return JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}'); } catch { return {}; }
}
function savePrefs(p: Prefs) { localStorage.setItem(PREF_KEY, JSON.stringify(p)); }

// ─────────────────────────────────────────────────────────────
// Card detail modal (reuses CardGallery logic inline)
// ─────────────────────────────────────────────────────────────

const RARITY_COL: Record<string, string> = {
  common: 'text-[#8a9490]', uncommon: 'text-[#4a9a6e]',
  rare:   'text-[#a1d0c6]', mythic:   'text-[#cebefa]',
};
const TYPE_BORDER: Record<string, string> = {
  creator:  'border-[#a1d0c6]/60 bg-[#a1d0c6]/10',
  model:    'border-[#cebefa]/40 bg-[#cebefa]/10',
  prompt:   'border-[#4a9a6e]/40 bg-[#4a9a6e]/10',
  modifier: 'border-[#b8842a]/40 bg-[#b8842a]/10',
  artifact: 'border-[#9b3dbb]/40 bg-[#9b3dbb]/10',
  event:    'border-[#3d6abb]/40 bg-[#3d6abb]/10',
};
const MOOD_G: Record<string, string> = {
  iridescent: 'from-purple-900/40 via-teal-900/30 to-amber-900/20',
  chaotic:    'from-red-900/30 via-purple-900/20 to-green-900/20',
  precise:    'from-blue-900/30 to-teal-900/20',
  bold:       'from-orange-900/30 to-amber-900/20',
  neutral:    'from-slate-800/60 to-slate-900/40',
  grainy:     'from-stone-800/50 to-stone-900/40',
  epic:       'from-amber-900/40 to-yellow-900/20',
  ethereal:   'from-indigo-900/40 to-violet-900/20',
  dark:       'from-zinc-900/60 to-neutral-900/50',
  warm:       'from-rose-900/30 to-orange-900/20',
};
function moodG(card: import('../types').Card) {
  return MOOD_G[card.illustrationMood ?? 'neutral'] ?? MOOD_G.neutral;
}

function InGameCardModal({ card, onClose }: { card: import('../types').Card; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const abList = [
    card.passive   ? { ...card.passive,   _label: 'Passive'   } : null,
    card.influence ? { ...card.influence, _label: 'Influence' } : null,
    ...(card.abilities ?? []),
  ].filter(Boolean) as any[];

  return createPortal(
    <div
      className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{    opacity: 0, scale: 0.94, y: 8  }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        className="bg-[#1c2120] border border-[#a1d0c6]/15 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/6 shrink-0">
          <div className="flex items-center gap-2">
            <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${TYPE_BORDER[card.type]}`}>{card.type}</span>
            <span className={`text-[9px] font-mono ${RARITY_COL[card.rarity]}`}>{card.rarity}</span>
            <span className="text-[9px] font-mono text-[#c0c8c5]/25">{card.id}</span>
          </div>
          <button onClick={onClose} className="text-[#c0c8c5]/40 hover:text-[#dfe3e1] transition-colors text-lg leading-none px-1">×</button>
        </div>

        <div className="flex overflow-y-auto flex-1">
          {/* Art strip */}
          <div className={`w-32 shrink-0 bg-gradient-to-br ${moodG(card)} flex flex-col justify-end p-3`}>
            <p className="text-[9px] italic text-[#c0c8c5]/40 leading-snug">{card.illustration}</p>
          </div>

          {/* Content */}
          <div className="flex-1 p-4 space-y-3 overflow-y-auto min-w-0">
            <div>
              <h2 className="text-xl font-black text-[#dfe3e1] leading-tight">{card.name}</h2>
              {card.subtype && <p className="text-[10px] text-[#c0c8c5]/40 uppercase tracking-widest mt-0.5">{card.subtype}</p>}
            </div>

            {/* Stats chips */}
            <div className="flex flex-wrap gap-1.5">
              {card.type === 'creator' && <>
                <span className="stat-chip">♥ {card.loyalty} Loyalty</span>
                {card.startingBonus && <span className="stat-chip">{card.startingBonus.display}</span>}
              </>}
              {card.type === 'model' && <>
                <span className="stat-chip">Play {card.playCost ?? 0}Cr</span>
                <span className="stat-chip">Activate {card.activateCost ?? 0}Cr</span>
                <span className="stat-chip">Q{card.quality}</span>
                <span className="stat-chip">RT{card.runtime}</span>
              </>}
              {card.cost !== undefined && card.type !== 'creator' && card.type !== 'model' && (
                <span className="stat-chip">{card.cost}{card.costType === 'reputation' ? ' Rep' : ' Cr'}</span>
              )}
              {card.timing   && <span className="stat-chip">{card.timing}</span>}
              {card.duration && <span className="stat-chip">{card.duration}</span>}
            </div>

            {/* Compatibility */}
            {(card.compatible?.length || card.incompatible?.length) && (
              <div className="flex flex-wrap gap-1">
                {card.compatible?.map  (s => <span key={s} className="text-[9px] px-1.5 py-0.5 rounded-full border border-green-500/30 text-green-400 bg-green-500/8">✔ {s}</span>)}
                {card.incompatible?.map(s => <span key={s} className="text-[9px] px-1.5 py-0.5 rounded-full border border-red-500/30   text-red-400   bg-red-500/8">✘ {s}</span>)}
              </div>
            )}

            {/* Effect / Abilities */}
            {card.effect && (
              <div className="rounded-xl border border-white/6 bg-[#0d1211]/50 p-3">
                <div className="text-[8px] uppercase tracking-widest text-[#c0c8c5]/35 font-mono mb-1">Effect</div>
                <p className="text-xs text-[#c0c8c5]/80 leading-relaxed">{card.effect}</p>
              </div>
            )}
            {abList.map((ab: any, i: number) => {
              const isSig = ab.num === 'signature';
              const label = ab._label ?? (isSig ? 'Signature' : `Ability ${ab.num}`);
              const costParts = [
                ab.cost?.loyalty    && `${ab.cost.loyalty} Loy`,
                ab.cost?.reputation && `${ab.cost.reputation} Rep`,
                ab.cost?.credits    && `${ab.cost.credits} Cr`,
              ].filter(Boolean).join(' · ');
              return (
                <div key={i} className={`rounded-xl p-3 border ${isSig ? 'border-[#a1d0c6]/30 bg-[#a1d0c6]/5' : 'border-white/6 bg-[#0d1211]/40'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 ${isSig ? 'bg-[#a1d0c6] text-[#033730]' : 'bg-[#262b2a] text-[#a1d0c6]'}`}>
                      {isSig ? '⚡' : ab._label ? '◈' : ab.num}
                    </span>
                    <span className="text-[12px] font-bold text-[#dfe3e1]">{ab.name}</span>
                    {ab._label && <span className="text-[9px] text-[#c0c8c5]/35 font-mono uppercase">{ab._label}</span>}
                    {costParts && <span className="ml-auto text-[9px] font-mono text-[#c0c8c5]/45 shrink-0">{costParts}</span>}
                  </div>
                  <p className="text-[11px] text-[#c0c8c5]/75 leading-relaxed pl-6">{ab.text}</p>
                  {ab.timing && <span className="text-[8px] font-mono text-[#c0c8c5]/30 uppercase pl-6 mt-0.5 block">{ab.timing}</span>}
                </div>
              );
            })}
            {card.favouritePrompt && (
              <div className="rounded-xl border border-[#cebefa]/20 bg-[#cebefa]/5 p-3">
                <div className="text-[8px] uppercase tracking-widest text-[#cebefa]/45 font-mono mb-1">Favourite Prompt</div>
                <p className="text-[11px] font-bold text-[#dfe3e1] italic">"{card.favouritePrompt.text}"</p>
                <p className="text-[10px] text-[#c0c8c5]/50 mt-1">{card.favouritePrompt.effect}</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const effQ  = (c: Creation) => Math.max(0, c.quality - c.glitchTokens);

const VIS_TIER = (v: number) => v >= 10 ? 'Featured' : v >= 6 ? 'Liked' : v >= 3 ? 'Noticed' : 'Unnoticed';
const VIS_COL  = (v: number) =>
  v >= 10 ? 'from-yellow-400/20 to-yellow-400/5 border-yellow-400/40 text-yellow-300'
  : v >= 6 ? 'from-[#a1d0c6]/20 to-[#a1d0c6]/5 border-[#a1d0c6]/40 text-[#a1d0c6]'
  : v >= 3 ? 'from-white/8 to-white/3 border-white/15 text-[#c0c8c5]/70'
  : 'from-white/3 to-transparent border-white/8 text-[#c0c8c5]/30';

const TYPE_COLOR: Record<string, string> = {
  model:    '#cebefa',
  prompt:   '#6fcf97',
  modifier: '#f2994a',
  artifact: '#bb6bd9',
  event:    '#56a4f5',
};

function blankPlayer(id: PlayerId): import('../game-engine').PlayerState {
  return { id, creator: { cardId: '', loyalty: 10, reputation: 0, isExhausted: false }, hand: [], guaranteedModels: [], deck: [], discard: [], credits: 0, creditCap: 10, field: [], queue: [], remixQueue: null, modifiers: [], mulliganed: false };
}

const BLANK: GameState = {
  human: blankPlayer('human'), ai: blankPlayer('ai'),
  sharedModels: [], artifactZone: [],
  turn: 1, round: 1, activePlayer: 'human',
  phase: 'mulligan', mulliganPhase: { humanDone: false, aiDone: false },
  winner: null, log: [], abilityUsedThisTurn: [],
};

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

// Health bar (loyalty)
function HealthBar({ current, max, label, flip = false }: { current: number; max: number; label: string; flip?: boolean }) {
  const pct = Math.max(0, Math.min(100, (current / Math.max(1, max)) * 100));
  const segments = max;
  const col = pct > 50 ? '#a1d0c6' : pct > 25 ? '#f2c94c' : '#eb5757';
  const glowCol = pct > 50 ? 'rgba(161,208,198,0.25)' : pct > 25 ? 'rgba(242,196,76,0.25)' : 'rgba(235,87,87,0.35)';
  return (
    <div className={`flex items-center gap-2 w-full ${flip ? 'flex-row-reverse' : ''}`}>
      <span className={`text-[9px] font-mono uppercase tracking-widest text-[#c0c8c5]/40 w-6 shrink-0 ${flip ? 'text-right' : ''}`}>{label}</span>
      <div className="flex-1 flex items-center gap-0.5 h-4">
        {Array.from({ length: segments }).map((_, i) => {
          const filled = flip ? (i >= segments - current) : (i < current);
          return (
            <div key={i} className="flex-1 h-3 rounded-sm transition-all duration-300"
              style={{
                backgroundColor: filled ? col : 'rgba(255,255,255,0.06)',
                boxShadow: filled && i === (flip ? segments - current : current - 1) ? `0 0 6px ${glowCol}` : 'none',
              }}
            />
          );
        })}
      </div>
      <span className={`text-[12px] font-black font-mono shrink-0 w-8 ${flip ? 'text-left' : 'text-right'}`} style={{ color: col }}>
        {current}
      </span>
    </div>
  );
}

// Creation token on the battlefield
function CreationTile({
  c, mini = false, onClick, glow, onInfo,
}: {
  c: Creation; mini?: boolean; onClick?: () => void; glow?: 'red' | 'teal' | 'none'; onInfo?: () => void;
}) {
  const q   = effQ(c);
  const inQ = c.runtimeLeft > 0;
  const vc  = VIS_COL(c.visibility);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.75, y: 12 }}
      animate={{ opacity: inQ ? 0.55 : 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.6, y: -8 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      onClick={onClick}
      whileHover={onClick ? { scale: 1.05, y: -3 } : {}}
      className={`relative rounded-xl border bg-gradient-to-b flex flex-col items-center select-none
        ${vc} ${mini ? 'w-20 py-2 px-1 gap-0.5' : 'w-24 py-3 px-2 gap-1'}
        ${inQ ? 'border-dashed' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${glow === 'red'  ? 'ring-1 ring-red-400/60 shadow-[0_0_12px_rgba(235,87,87,0.35)]' : ''}
        ${glow === 'teal' ? 'ring-1 ring-[#a1d0c6]/50 shadow-[0_0_10px_rgba(161,208,198,0.25)]' : ''}
        ${c.clipLocked ? 'ring-1 ring-blue-400/50' : ''}
      `}
    >
      {inQ && <span className="text-[8px] font-mono text-[#cebefa]/60 uppercase tracking-wide">Queue</span>}
      {inQ
        ? <span className="text-2xl font-black opacity-40">⏳</span>
        : <span className={`font-black leading-none ${mini ? 'text-2xl' : 'text-3xl'} ${q <= 1 ? 'text-red-400' : 'text-[#dfe3e1]'}`}>{q}</span>
      }
      {inQ
        ? <span className="text-[10px] font-mono text-[#cebefa]/70">RT {c.runtimeLeft}</span>
        : <span className={`text-[8px] font-mono uppercase tracking-wide ${mini ? '' : 'mt-0.5'}`}>{VIS_TIER(c.visibility)} {c.visibility}v</span>
      }
      {!inQ && (
        <div className="w-full mt-0.5">
          <div className="w-full h-0.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-current opacity-60 transition-all duration-500" style={{ width: `${Math.min(100, c.visibility * 8)}%` }} />
          </div>
        </div>
      )}
      {c.glitchTokens > 0 && (
        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] font-black flex items-center justify-center">G{c.glitchTokens}</span>
      )}
      {c.clipLocked && (
        <span className="absolute -top-1.5 -left-1.5 text-[10px]">🔒</span>
      )}
      {c.styleTag && (
        <span className="text-[7px] font-mono uppercase tracking-wider opacity-50 mt-0.5">{c.styleTag}</span>
      )}
      {onInfo && (
        <button
          onClick={e => { e.stopPropagation(); onInfo(); }}
          className="absolute top-1 right-1 w-4 h-4 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-[8px] text-white/40 hover:text-white/80 transition-all"
        >?</button>
      )}
    </motion.div>
  );
}

// Card in hand
function HandCard({ card, selected, playable, onClick, onInfo }: {
  card: Card; selected?: boolean; playable: boolean; onClick: () => void; onInfo?: () => void;
}) {
  const accent = TYPE_COLOR[card.type] ?? '#a1d0c6';
  const cost   = card.type === 'model'
    ? `P${card.playCost ?? 0} / A${card.activateCost ?? 0}`
    : card.cost !== undefined ? `${card.cost}${card.costType === 'reputation' ? ' Rep' : ' Cr'}` : '';

  return (
    <motion.button
      onClick={playable || selected ? onClick : undefined}
      whileHover={playable ? { y: -10, scale: 1.06 } : {}}
      whileTap={playable   ? { scale: 0.94 } : {}}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      className={`relative flex flex-col text-left rounded-xl border px-2.5 pt-2 pb-2 w-[90px] shrink-0 gap-1 transition-all duration-150
        ${selected
          ? 'border-[#a1d0c6]/80 shadow-[0_0_14px_rgba(161,208,198,0.4)] bg-[#a1d0c6]/10'
          : playable
            ? 'border-white/10 hover:border-white/25 bg-[#1c2120]/70 cursor-pointer'
            : 'border-white/5 bg-[#1c2120]/30 opacity-35 cursor-not-allowed'
        }`}
    >
      {/* Type stripe */}
      <div className="absolute top-0 inset-x-0 h-[3px] rounded-t-xl" style={{ backgroundColor: accent + '99' }} />
      {/* Type label */}
      <span className="text-[8px] uppercase tracking-widest font-mono mt-0.5" style={{ color: accent + 'aa' }}>{card.type}</span>
      {/* Name */}
      <span className="text-[11px] font-bold text-[#dfe3e1] leading-tight line-clamp-2 flex-1">{card.name}</span>
      {/* Cost */}
      {cost && <span className="text-[9px] font-mono text-[#c0c8c5]/45 mt-auto">{cost}</span>}
      {/* Model quality badge */}
      {card.type === 'model' && (
        <span className="absolute bottom-2 right-2 text-[9px] font-black text-[#cebefa]/60">Q{card.quality}</span>
      )}
      {onInfo && (
        <button
          onClick={e => { e.stopPropagation(); onInfo(); }}
          className="absolute top-1 right-1 w-4 h-4 rounded-full bg-white/8 hover:bg-white/18 flex items-center justify-center text-[8px] text-[#c0c8c5]/50 hover:text-[#dfe3e1] transition-all"
          title="View card details"
        >?</button>
      )}
    </motion.button>
  );
}

// Guaranteed model badge (set aside, always available)
function GuaranteedModelBadge({ card, onPlay, canPlay, onInfo }: { card: Card; onPlay: () => void; canPlay: boolean; onInfo?: () => void }) {
  return (
    <motion.button
      onClick={canPlay ? onPlay : undefined}
      whileHover={canPlay ? { scale: 1.06, y: -3 } : {}}
      whileTap={canPlay   ? { scale: 0.95 } : {}}
      className={`relative flex flex-col items-center gap-1 px-2 py-2 rounded-xl border text-center w-20 shrink-0 transition-all
        ${canPlay
          ? 'border-[#cebefa]/40 bg-[#cebefa]/6 hover:bg-[#cebefa]/12 cursor-pointer shadow-[0_0_8px_rgba(206,190,250,0.1)]'
          : 'border-[#cebefa]/10 bg-transparent opacity-40 cursor-not-allowed'
        }`}
    >
      <span className="text-[7px] uppercase tracking-widest text-[#cebefa]/50 font-mono">Guaranteed</span>
      <span className="text-[10px] font-bold text-[#dfe3e1] leading-tight">{card.name}</span>
      <span className="text-[8px] font-mono text-[#cebefa]/50">Q{card.quality} · Free</span>
      {canPlay && <span className="text-[8px] text-[#cebefa]/60">↑ Play</span>}
      {onInfo && (
        <button onClick={e => { e.stopPropagation(); onInfo(); }}
          className="absolute top-1 right-1 w-4 h-4 rounded-full bg-white/8 hover:bg-white/18 flex items-center justify-center text-[8px] text-white/35 hover:text-white/70 transition-all"
        >?</button>
      )}
    </motion.button>
  );
}

// Model in shared zone
function SharedModelCard({ model, canActivate, onActivate, onInfo }: {
  model: { modelId: string; activatedThisTurn: boolean; placedByPlayer: PlayerId; activationsThisRound: number };
  canActivate: boolean;
  onActivate: () => void;
  onInfo?: () => void;
}) {
  const card = CMAP.get(model.modelId);
  if (!card) return null;
  return (
    <motion.button
      onClick={canActivate ? onActivate : undefined}
      whileHover={canActivate ? { scale: 1.05, y: -2 } : {}}
      whileTap={canActivate   ? { scale: 0.96 } : {}}
      title={canActivate ? `Activate ${card.name} (${card.activateCost ?? 0}Cr)` : model.activatedThisTurn ? 'Already used this turn' : 'Cannot activate now'}
      className={`relative flex flex-col items-center gap-1 rounded-xl border px-3 py-2 text-center min-w-[80px] transition-all
        ${model.activatedThisTurn
          ? 'border-[#cebefa]/8 bg-transparent opacity-25'
          : canActivate
            ? 'border-[#cebefa]/40 bg-[#cebefa]/8 hover:bg-[#cebefa]/14 cursor-pointer'
            : 'border-[#cebefa]/15 bg-transparent opacity-40 cursor-not-allowed'
        }`}
    >
      <span className="text-[8px] uppercase tracking-widest text-[#cebefa]/50 font-mono">Model</span>
      <span className="text-[11px] font-bold text-[#dfe3e1] leading-tight">{card.name}</span>
      <div className="flex items-center gap-1.5 text-[9px] font-mono text-[#c0c8c5]/50">
        <span>Q{card.quality}</span>
        <span className="opacity-40">·</span>
        <span>{card.activateCost ?? 0}Cr</span>
      </div>
      {model.activationsThisRound > 0 && !model.activatedThisTurn && (
        <span className="text-[7px] text-orange-400/60 font-mono">+1 RT (contention)</span>
      )}
      {model.activatedThisTurn && <span className="text-[8px] text-[#c0c8c5]/30 font-mono">Used</span>}
      {onInfo && (
        <button onClick={e => { e.stopPropagation(); onInfo(); }}
          className="absolute top-1 right-1 w-4 h-4 rounded-full bg-white/8 hover:bg-white/18 flex items-center justify-center text-[8px] text-white/35 hover:text-white/70 transition-all"
        >?</button>
      )}
    </motion.button>
  );
}

// ─────────────────────────────────────────────────────────────
// Deck picker screen
// ─────────────────────────────────────────────────────────────

function DeckPickerScreen({ onStart }: {
  onStart: (hCreator: string, hDeck: Card[], aCreator: string, aDeck: Card[], diff: Difficulty, deckId: string) => void;
}) {
  const prefs = loadPrefs();
  const [diff, setDiff]       = useState<Difficulty>('medium');
  const [chosen, setChosen]   = useState<string | null>(prefs.lastUsedId ?? null);
  const [showBrowser, setShowBrowser] = useState(false);
  const [previewId, setPreviewId]     = useState<string | null>(null);
  const [favId, setFavId]             = useState<string | null>(prefs.favouriteId ?? null);
  const [modalCard, setModalCard]     = useState<import('../types').Card | null>(null);

  // All available decks: prebuilt + custom
  const store = (() => {
    try { return JSON.parse(localStorage.getItem('pb_decks') ?? '{"version":1,"decks":[]}'); } catch { return { version: 1, decks: [] }; }
  })();
  const customDecks: import('../types').CustomDeck[] = store.decks ?? [];

  // Build unified deck list
  type AnyDeck = { id: string; name: string; description: string; creator: string | null; guaranteedModels: string[]; cards: Record<string, number>; isCustom: boolean; archetypes?: string[]; difficulty?: string; };
  const allDecks: AnyDeck[] = [
    ...PREBUILT_DECKS.map(d => ({ ...d, creator: d.creator, isCustom: false, guaranteedModels: d.guaranteedModels ?? [] })),
    ...customDecks.map(d => ({ ...d, isCustom: true, archetypes: [], difficulty: 'Custom', guaranteedModels: d.guaranteedModels ?? [] })),
  ];

  // Resolve deck by id
  function getDeck(id: string): AnyDeck | undefined {
    return allDecks.find(d => d.id === id);
  }

  function expandDeck(d: AnyDeck): Card[] {
    const out: Card[] = [];
    for (const gid of d.guaranteedModels) {
      const c = CMAP.get(gid); if (c) out.push(c);
    }
    for (const [id, count] of Object.entries(d.cards)) {
      const c = CMAP.get(id);
      if (c && c.type !== 'creator') for (let i = 0; i < count; i++) out.push(c);
    }
    return out;
  }

  function go(deckId: string) {
    const hd = getDeck(deckId);
    if (!hd || !hd.creator) return;
    // AI gets a different deck (opposite prebuilt, or random custom)
    const others = allDecks.filter(d => d.id !== deckId && d.creator && d.creator !== hd.creator);
    const ad = others[0] ?? allDecks.find(d => d.id !== deckId) ?? allDecks[0];
    if (!ad?.creator) return;
    // Save prefs
    savePrefs({ ...loadPrefs(), lastUsedId: deckId });
    onStart(hd.creator, expandDeck(hd), ad.creator, expandDeck(ad), diff, deckId);
  }

  function toggleFav(id: string) {
    const newFav = favId === id ? undefined : id;
    setFavId(newFav ?? null);
    savePrefs({ ...loadPrefs(), favouriteId: newFav });
  }

  const lastUsedDeck = chosen ? getDeck(chosen) : null;
  const favDeck      = favId  ? getDeck(favId)  : null;
  const previewDeck  = previewId ? getDeck(previewId) : null;

  // Quick deck card
  function QuickDeckCard({ deck, label, accent }: { deck: AnyDeck; label: string; accent: string }) {
    const creator = CMAP.get(deck.creator ?? '');
    const isFav   = favId === deck.id;
    return (
      <div className={`relative rounded-2xl border p-4 flex flex-col gap-2 transition-all ${accent}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[8px] uppercase tracking-[0.2em] font-mono text-[#c0c8c5]/35 mb-0.5">{label}</div>
            <div className="text-base font-black text-[#dfe3e1] leading-tight">{deck.name.split(' — ')[0]}</div>
          </div>
          <button onClick={() => toggleFav(deck.id)}
            className={`shrink-0 text-lg transition-colors mt-0.5 ${isFav ? 'text-yellow-400' : 'text-[#c0c8c5]/20 hover:text-yellow-400/60'}`}
            title={isFav ? 'Remove favourite' : 'Mark as favourite'}
          >★</button>
        </div>
        {creator && (
          <div className="flex items-center gap-1.5 text-[10px] text-[#c0c8c5]/40 font-mono">
            <span>Creator:</span>
            <span className="text-[#a1d0c6]">{creator.name}</span>
            <span className="ml-auto">♥{creator.loyalty}</span>
          </div>
        )}
        {deck.description && (
          <p className="text-[10px] text-[#c0c8c5]/40 leading-relaxed line-clamp-2">{deck.description}</p>
        )}
        <div className="flex gap-2 mt-1">
          <button onClick={() => setPreviewId(deck.id)}
            className="flex-1 py-1.5 rounded-lg border border-white/10 text-[10px] text-[#c0c8c5]/50 hover:border-white/20 hover:text-[#c0c8c5]/80 font-mono transition-all"
          >Preview</button>
          <motion.button
            onClick={() => go(deck.id)}
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            className="flex-1 py-1.5 rounded-lg bg-[#a1d0c6] text-[#0d1211] text-[11px] font-black hover:bg-[#b5dbd4] transition-all"
          >Play →</motion.button>
        </div>
      </div>
    );
  }

  // Deck browser modal
  function DeckBrowser() {
    return createPortal(
      <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={e => { if (e.target === e.currentTarget) setShowBrowser(false); }}
      >
        <motion.div
          initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="bg-[#1c2120] border border-[#a1d0c6]/12 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/6 shrink-0">
            <h2 className="text-base font-black text-[#dfe3e1]">All Decks</h2>
            <button onClick={() => setShowBrowser(false)} className="text-[#c0c8c5]/40 hover:text-[#dfe3e1] text-xl leading-none">×</button>
          </div>
          <div className="overflow-y-auto flex-1 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {allDecks.filter(d => d.creator).map(deck => {
              const creator = CMAP.get(deck.creator ?? '');
              const isFav   = favId === deck.id;
              const isChosen = chosen === deck.id;
              return (
                <div key={deck.id}
                  className={`rounded-xl border p-3 flex flex-col gap-2 transition-all cursor-pointer ${isChosen ? 'border-[#a1d0c6]/40 bg-[#a1d0c6]/6' : 'border-white/8 bg-[#0d1211]/40 hover:border-white/14'}`}
                  onClick={() => { setChosen(deck.id); setShowBrowser(false); }}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-bold text-[#dfe3e1] leading-tight truncate">{deck.name.split(' — ')[0]}</div>
                      <div className="text-[9px] text-[#c0c8c5]/35 font-mono mt-0.5">{deck.isCustom ? 'Custom' : 'Prebuilt'} · {creator?.name}</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={e => { e.stopPropagation(); toggleFav(deck.id); }}
                        className={`text-base transition-colors ${isFav ? 'text-yellow-400' : 'text-[#c0c8c5]/20 hover:text-yellow-400/60'}`}
                      >★</button>
                      <button onClick={e => { e.stopPropagation(); setPreviewId(deck.id); }}
                        className="text-[10px] px-2 py-0.5 rounded border border-white/10 text-[#c0c8c5]/40 hover:text-[#c0c8c5]/70 font-mono transition-all"
                      >?</button>
                    </div>
                  </div>
                  {deck.description && (
                    <p className="text-[9px] text-[#c0c8c5]/35 leading-relaxed line-clamp-2">{deck.description}</p>
                  )}
                  <div className="flex gap-1 flex-wrap">
                    {(deck.archetypes ?? []).map(a => (
                      <span key={a} className="text-[7px] px-1.5 py-0.5 rounded-full border border-white/8 text-[#c0c8c5]/30 font-mono">{a}</span>
                    ))}
                  </div>
                  {isChosen && <span className="text-[9px] text-[#a1d0c6] font-mono">✓ Selected</span>}
                </div>
              );
            })}
            {allDecks.filter(d => d.creator).length === 0 && (
              <div className="col-span-2 text-center py-8 text-[#c0c8c5]/30 text-sm">No decks found. Build one in the Decks tab first!</div>
            )}
          </div>
          {chosen && (
            <div className="px-4 py-3 border-t border-white/6 shrink-0">
              <motion.button onClick={() => { setShowBrowser(false); go(chosen); }}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                className="w-full py-2.5 rounded-xl bg-[#a1d0c6] text-[#0d1211] font-black text-sm"
              >Play with {getDeck(chosen)?.name.split(' — ')[0]} →</motion.button>
            </div>
          )}
        </motion.div>
      </div>,
      document.body
    );
  }

  // Deck preview modal
  function DeckPreview() {
    if (!previewDeck) return null;
    const creator = CMAP.get(previewDeck.creator ?? '');
    const cardCounts = Object.entries(previewDeck.cards)
      .filter(([id]) => CMAP.get(id)?.type !== 'creator')
      .sort(([,a],[,b]) => b - a);
    const typeGroups: Record<string, [string, number][]> = {};
    for (const [id, cnt] of cardCounts) {
      const c = CMAP.get(id); if (!c) continue;
      if (!typeGroups[c.type]) typeGroups[c.type] = [];
      typeGroups[c.type].push([id, cnt]);
    }
    const typeOrder = ['model','prompt','modifier','artifact','event'];
    return createPortal(
      <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={e => { if (e.target === e.currentTarget) setPreviewId(null); }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
          className="bg-[#1c2120] border border-[#a1d0c6]/15 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/6 shrink-0">
            <div>
              <div className="text-base font-black text-[#dfe3e1]">{previewDeck.name.split(' — ')[0]}</div>
              {creator && <div className="text-[10px] text-[#a1d0c6]/60 font-mono">Creator: {creator.name} · ♥{creator.loyalty}</div>}
            </div>
            <button onClick={() => setPreviewId(null)} className="text-[#c0c8c5]/40 hover:text-[#dfe3e1] text-xl">×</button>
          </div>
          <div className="overflow-y-auto flex-1 p-4 space-y-3">
            {/* Guaranteed models */}
            {previewDeck.guaranteedModels.length > 0 && (
              <div>
                <div className="text-[8px] uppercase tracking-widest text-[#cebefa]/45 font-mono mb-1.5">Guaranteed Models</div>
                <div className="flex gap-2 flex-wrap">
                  {previewDeck.guaranteedModels.map(id => {
                    const c = CMAP.get(id);
                    return c ? (
                      <button key={id} onClick={() => setModalCard(c)}
                        className="px-2.5 py-1.5 rounded-lg border border-[#cebefa]/25 bg-[#cebefa]/6 text-[10px] font-bold text-[#dfe3e1] hover:border-[#cebefa]/45 transition-all text-left"
                      >
                        <span className="text-[8px] text-[#cebefa]/50 block font-mono">Q{c.quality}</span>
                        {c.name}
                      </button>
                    ) : null;
                  })}
                </div>
              </div>
            )}
            {/* Cards by type */}
            {typeOrder.filter(t => typeGroups[t]).map(type => (
              <div key={type}>
                <div className="text-[8px] uppercase tracking-widest font-mono mb-1.5" style={{ color: TYPE_COLOR[type] + 'aa' }}>{type}s</div>
                <div className="space-y-0.5">
                  {typeGroups[type].map(([id, cnt]) => {
                    const c = CMAP.get(id); if (!c) return null;
                    return (
                      <button key={id} onClick={() => setModalCard(c)}
                        className="w-full flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/4 transition-all text-left group"
                      >
                        <span className="text-[10px] font-mono text-[#c0c8c5]/35 w-4 text-right">×{cnt}</span>
                        <span className="text-[11px] text-[#dfe3e1] flex-1 truncate">{c.name}</span>
                        <span className="text-[8px] text-[#c0c8c5]/25 group-hover:text-[#a1d0c6]/50 font-mono transition-colors">view</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-white/6 flex gap-2 shrink-0">
            <button onClick={() => { setChosen(previewDeck.id); setPreviewId(null); setShowBrowser(false); }}
              className="flex-1 py-2 rounded-xl border border-[#a1d0c6]/30 text-[#a1d0c6] text-[11px] font-bold hover:bg-[#a1d0c6]/8 transition-all"
            >Select This Deck</button>
            <button onClick={() => go(previewDeck.id)}
              className="flex-1 py-2 rounded-xl bg-[#a1d0c6] text-[#0d1211] text-[11px] font-black hover:bg-[#b5dbd4] transition-all"
            >Play Now →</button>
          </div>
        </motion.div>
      </div>,
      document.body
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Render
  const defaultLastUsed = lastUsedDeck ?? (allDecks.find(d => d.id.includes('B') || d.id.includes('b') || d.id.includes('anon')) ?? allDecks[1] ?? allDecks[0]);
  const defaultFav      = favDeck;

  return (
    <div className="flex flex-col items-center justify-center gap-8 py-12 min-h-[calc(100vh-5rem)] px-4">
      <AnimatePresence>
        {showBrowser && <DeckBrowser />}
        {previewId   && <DeckPreview />}
        {modalCard   && <InGameCardModal card={modalCard} onClose={() => setModalCard(null)} />}
      </AnimatePresence>

      <div className="text-center">
        <div className="text-[9px] uppercase tracking-[0.25em] text-[#a1d0c6]/35 font-mono mb-2">Quick Duel</div>
        <h1 className="text-4xl font-black text-[#dfe3e1] tracking-tight">Choose Your Deck</h1>
        <p className="text-[#c0c8c5]/35 text-sm mt-1.5">You'll face the AI with the opposing deck</p>
      </div>

      {/* Quick options */}
      <div className="w-full max-w-lg grid grid-cols-1 sm:grid-cols-2 gap-4">
        {defaultLastUsed && (
          <QuickDeckCard
            deck={defaultLastUsed}
            label={prefs.lastUsedId ? "Last Used" : "Recommended"}
            accent="border-[#a1d0c6]/20 bg-[#a1d0c6]/4 hover:border-[#a1d0c6]/35"
          />
        )}
        {defaultFav && defaultFav.id !== defaultLastUsed?.id && (
          <QuickDeckCard
            deck={defaultFav}
            label="★ Favourite"
            accent="border-yellow-400/20 bg-yellow-400/3 hover:border-yellow-400/35"
          />
        )}
        {!defaultFav && allDecks.filter(d => d.creator && d.id !== defaultLastUsed?.id).slice(0,1).map(deck => (
          <QuickDeckCard
            key={deck.id}
            deck={deck}
            label="Also Available"
            accent="border-white/8 bg-transparent hover:border-white/15"
          />
        ))}
      </div>

      {/* Choose another */}
      <button
        onClick={() => setShowBrowser(true)}
        className="flex items-center gap-2 px-5 py-2 rounded-xl border border-white/10 text-[#c0c8c5]/50 text-[11px] font-mono hover:border-white/20 hover:text-[#c0c8c5]/80 transition-all"
      >
        <span>⊕</span> Choose another deck ({allDecks.filter(d => d.creator).length} available)
      </button>

      {/* Difficulty */}
      <div className="flex flex-col items-center gap-2">
        <div className="text-[9px] uppercase tracking-widest text-[#c0c8c5]/30 font-mono">AI Difficulty</div>
        <div className="flex gap-1.5 p-1 rounded-xl border border-white/6 bg-[#1c2120]/40">
          {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
            <button key={d} onClick={() => setDiff(d)}
              className={`px-4 py-1.5 rounded-lg text-[11px] font-bold font-mono transition-all
                ${diff === d ? 'bg-[#a1d0c6] text-[#0d1211]' : 'text-[#c0c8c5]/35 hover:text-[#c0c8c5]/65'}`}
            >{d}</button>
          ))}
        </div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────
// Mulligan screen
// ─────────────────────────────────────────────────────────────

function MulliganScreen({ state, onMulligan, onKeep }: {
  state: GameState;
  onMulligan: () => void;
  onKeep: () => void;
}) {
  const p = state.human;
  const creatorCard = CMAP.get(p.creator.cardId);
  const done = state.mulliganPhase.humanDone;

  return (
    <div className="flex flex-col items-center justify-center gap-8 py-16 min-h-[calc(100vh-5rem)]">
      <div className="text-center">
        <div className="text-[10px] uppercase tracking-[0.25em] text-[#a1d0c6]/40 font-mono mb-2">Game Setup</div>
        <h1 className="text-3xl font-black text-[#dfe3e1]">Opening Hand</h1>
        {creatorCard && (
          <p className="text-[#c0c8c5]/40 text-sm mt-1">Playing as <span className="text-[#a1d0c6]">{creatorCard.name}</span></p>
        )}
      </div>

      {/* Guaranteed models */}
      <div className="flex flex-col items-center gap-2">
        <div className="text-[9px] uppercase tracking-widest text-[#cebefa]/40 font-mono">Guaranteed Models (set aside)</div>
        <div className="flex gap-3">
          {p.guaranteedModels.map(c => (
            <div key={c.id} className="px-4 py-2.5 rounded-xl border border-[#cebefa]/25 bg-[#cebefa]/5 text-center">
              <div className="text-[8px] text-[#cebefa]/40 font-mono uppercase">Model</div>
              <div className="text-[12px] font-bold text-[#dfe3e1]">{c.name}</div>
              <div className="text-[9px] text-[#c0c8c5]/40 font-mono">Q{c.quality} · A{c.activateCost}Cr</div>
            </div>
          ))}
        </div>
      </div>

      {/* Opening hand */}
      <div className="flex flex-col items-center gap-3">
        <div className="text-[9px] uppercase tracking-widest text-[#c0c8c5]/40 font-mono">
          Your Opening Hand ({p.hand.length} cards)
        </div>
        <div className="flex gap-2 flex-wrap justify-center max-w-xl">
          {p.hand.map((card, i) => (
            <motion.div
              key={card.id + i}
              initial={{ opacity: 0, y: 20, rotateZ: Math.random() * 6 - 3 }}
              animate={{ opacity: 1, y: 0,  rotateZ: 0 }}
              transition={{ delay: i * 0.06, type: 'spring', stiffness: 280, damping: 22 }}
              className={`flex flex-col gap-0.5 px-3 py-2 rounded-xl border w-24 text-left
                border-white/10 bg-[#1c2120]/70`}
            >
              <div className="text-[7px] uppercase font-mono tracking-widest" style={{ color: TYPE_COLOR[card.type] + '99' }}>{card.type}</div>
              <div className="text-[11px] font-bold text-[#dfe3e1] leading-tight line-clamp-2">{card.name}</div>
              {card.type === 'model' && <div className="text-[8px] text-[#cebefa]/50 font-mono">Q{card.quality}</div>}
              {card.cost !== undefined && <div className="text-[8px] text-[#c0c8c5]/40 font-mono">{card.cost}{card.costType === 'reputation' ? 'R' : 'Cr'}</div>}
            </motion.div>
          ))}
        </div>
      </div>

      {!done ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-[#c0c8c5]/50 text-sm text-center max-w-sm">
            You may mulligan once — shuffle your hand back and draw 6 cards instead.<br/>
            <span className="text-[#c0c8c5]/30 text-xs">If only you mulligan, the AI gains +2 Credits. If only the AI mulligans, you gain +2 Credits.</span>
          </p>
          <div className="flex gap-3">
            <motion.button
              onClick={onMulligan}
              whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}
              className="px-6 py-2.5 rounded-xl border border-[#c0c8c5]/20 text-[#c0c8c5]/70 text-sm font-bold hover:border-[#c0c8c5]/40 hover:text-[#c0c8c5] transition-all"
            >Mulligan (draw 6)</motion.button>
            <motion.button
              onClick={onKeep}
              whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}
              className="px-8 py-2.5 rounded-xl bg-[#a1d0c6] text-[#0d1211] text-sm font-black shadow-[0_4px_16px_rgba(161,208,198,0.25)]"
            >Keep Hand →</motion.button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="px-4 py-2 rounded-xl border border-[#a1d0c6]/30 bg-[#a1d0c6]/8 text-[#a1d0c6] text-sm font-bold">
            ✓ Hand confirmed — waiting for AI…
          </div>
          <motion.div animate={{ opacity: [0.3, 0.8, 0.3] }} transition={{ repeat: Infinity, duration: 1.5 }}
            className="text-[11px] text-[#c0c8c5]/30 font-mono"
          >AI is deciding…</motion.div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Game over
// ─────────────────────────────────────────────────────────────

function GameOverScreen({ winner, onRematch }: { winner: PlayerId | 'draw' | null; onRematch: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 bg-[#0d1211]/95 backdrop-blur-sm flex items-center justify-center z-50"
    >
      <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 240, damping: 22, delay: 0.1 }}
        className="text-center space-y-5 px-8"
      >
        <div className={`text-7xl font-black tracking-tighter ${winner === 'human' ? 'text-[#a1d0c6]' : winner === 'ai' ? 'text-red-400' : 'text-[#cebefa]'}`}>
          {winner === 'human' ? 'You Win' : winner === 'ai' ? 'AI Wins' : 'Draw'}
        </div>
        <p className="text-[#c0c8c5]/40">
          {winner === 'human' ? 'Beautifully played.' : winner === 'ai' ? 'The heuristic got the better of you this time.' : 'Both creators fell simultaneously.'}
        </p>
        <button onClick={onRematch}
          className="px-8 py-3 rounded-xl bg-[#a1d0c6] text-[#0d1211] font-black text-sm hover:bg-[#b5dbd4] transition-colors"
        >Play Again</button>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main game board
// ─────────────────────────────────────────────────────────────

type UIMode = 'idle' | 'awaiting_target' | 'prompts_selected';

export default function ArenaBattlefield() {
  const [started, setStarted]   = useState(false);
  const [difficulty, setDiff]   = useState<Difficulty>('medium');
  const [state, dispatch]       = useReducer((s: GameState, a: GameAction) => gameReducer(s, a, CMAP), BLANK);
  const [uiMode, setUIMode]     = useState<UIMode>('idle');
  const [modalCard, setModalCard] = useState<import('../types').Card | null>(null);
  const [pendingAbility, setPendingAbility] = useState<number | 'signature' | null>(null);
  const [selectedPrompts, setSelectedPrompts] = useState<string[]>([]);
  const [msg, setMsg]           = useState('');
  const logRef                  = useRef<HTMLDivElement>(null);
  const aiRunning               = useRef(false);

  function flash(m: string, duration = 2500) {
    setMsg(m);
    setTimeout(() => setMsg(x => x === m ? '' : x), duration);
  }

  // ── AI mulligan (instant) + AI turns ─────────────────────────
  // AI mulligan: fires once when mulliganPhase.aiDone becomes false
  useEffect(() => {
    if (!started) return;
    if (state.phase !== 'mulligan') return;
    if (state.mulliganPhase.aiDone) return;
    const timer = setTimeout(() => {
      dispatch({ type: 'KEEP_HAND', player: 'ai' });
    }, 900);
    return () => clearTimeout(timer);
  }, [started, state.phase, state.mulliganPhase.aiDone]);

  // AI turn: fires only when it becomes the AI's main phase turn
  useEffect(() => {
    if (!started) return;
    if (state.phase !== 'main') return;
    if (state.activePlayer !== 'ai') return;
    if (aiRunning.current) return;

    aiRunning.current = true;
    const ai   = createAI(difficulty);
    // Snapshot the state at turn start — do NOT close over live state
    const snap = state;
    let endTurnDispatched = false;

    (async () => {
      try {
        await sleep(600);
        const plan = ai.planFullTurn(snap, ALL_CARDS);
        for (const action of plan) {
          await sleep(500 + Math.random() * 400);
          let ga: GameAction | null = null;
          switch (action.type) {
            case 'PLAY_MODEL': {
              const isGuaranteed = snap.ai.guaranteedModels?.some(c => c.id === action.cardId);
              ga = isGuaranteed
                ? { type: 'PLAY_GUARANTEED_MODEL', player: 'ai', cardId: action.cardId! }
                : { type: 'PLAY_MODEL',             player: 'ai', cardId: action.cardId! };
              break;
            }
            case 'ACTIVATE_MODEL':      ga = { type: 'ACTIVATE_MODEL',      player: 'ai', modelId: action.cardId!, promptIds: action.promptIds ?? [] }; break;
            case 'USE_CREATOR_ABILITY': ga = { type: 'USE_CREATOR_ABILITY', player: 'ai', abilityNum: action.abilityNum! }; break;
            case 'PLAY_MODIFIER':       ga = { type: 'PLAY_MODIFIER',       player: 'ai', cardId: action.cardId!, targetId: action.targetId ?? 'creator' }; break;
            case 'PLAY_ARTIFACT':       ga = { type: 'PLAY_ARTIFACT',       player: 'ai', cardId: action.cardId! }; break;
            case 'PLAY_EVENT':          ga = { type: 'PLAY_EVENT',          player: 'ai', cardId: action.cardId! }; break;
            case 'END_TURN':
              ga = { type: 'END_TURN', player: 'ai' };
              endTurnDispatched = true;
              break;
          }
          if (ga) dispatch(ga);
          if (action.type === 'END_TURN') break;
        }
        // Safety END_TURN only if the loop didn't already dispatch one
        if (!endTurnDispatched) {
          await sleep(300);
          dispatch({ type: 'END_TURN', player: 'ai' });
        }
      } finally {
        aiRunning.current = false;
      }
    })();
  // Only re-run when it genuinely becomes the AI's turn (activePlayer flips to 'ai')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, state.activePlayer, state.phase]);

  // Log scroll
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = 0; }, [state.log.length]);

  // ── Not started ───────────────────────────────────────────────
  if (!started) {
    return (
      <DeckPickerScreen onStart={(hc, hd, ac, ad, diff) => {
        setDiff(diff);
        setStarted(true);
        aiRunning.current = false;
        const fp: PlayerId = Math.random() < 0.5 ? 'human' : 'ai';
        dispatch({ type: 'START_GAME', humanCreatorId: hc, humanDeck: hd, aiCreatorId: ac, aiDeck: ad, firstPlayer: fp });
      }} />
    );
  }

  // ── Mulligan phase ────────────────────────────────────────────
  if (state.phase === 'mulligan') {
    return (
      <MulliganScreen
        state={state}
        onMulligan={() => dispatch({ type: 'MULLIGAN',    player: 'human' })}
        onKeep={    () => dispatch({ type: 'KEEP_HAND',   player: 'human' })}
      />
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Game board
  // ─────────────────────────────────────────────────────────────

  const isMyTurn    = state.activePlayer === 'human' && state.phase === 'main';
  const humanP      = state.human;
  const aiP         = state.ai;
  const hCreatorCard = CMAP.get(humanP.creator.cardId);
  const aCreatorCard = CMAP.get(aiP.creator.cardId);
  const aiThinking  = state.activePlayer === 'ai' && state.phase === 'main';

  function endTurn() {
    if (!isMyTurn) { flash("It's not your turn yet"); return; }
    setUIMode('idle'); setSelectedPrompts([]);
    dispatch({ type: 'END_TURN', player: 'human' });
  }

  function handleHandCard(card: Card) {
    if (!isMyTurn) { flash("Wait for your turn"); return; }
    const p = humanP;

    if (card.type === 'model') {
      if (p.credits < (card.playCost ?? 0)) { flash(`Need ${card.playCost}Cr (you have ${p.credits}Cr)`); return; }
      dispatch({ type: 'PLAY_MODEL', player: 'human', cardId: card.id });
      flash(`${card.name} placed in shared zone`);
      return;
    }
    if (card.type === 'prompt') {
      const toggled = selectedPrompts.includes(card.id)
        ? selectedPrompts.filter(x => x !== card.id)
        : [...selectedPrompts.slice(-1), card.id];
      setSelectedPrompts(toggled);
      setUIMode(toggled.length > 0 ? 'prompts_selected' : 'idle');
      flash(toggled.length > 0 ? `${toggled.length} prompt(s) selected — click a model to activate` : 'Prompt deselected');
      return;
    }
    if (card.type === 'modifier') {
      if (p.credits < (card.cost ?? 0)) { flash(`Need ${card.cost}Cr`); return; }
      dispatch({ type: 'PLAY_MODIFIER', player: 'human', cardId: card.id, targetId: 'creator' });
      flash(`${card.name} attached`);
      return;
    }
    if (card.type === 'artifact') {
      if (p.credits < (card.cost ?? 0)) { flash(`Need ${card.cost}Cr`); return; }
      dispatch({ type: 'PLAY_ARTIFACT', player: 'human', cardId: card.id });
      flash(`${card.name} placed`);
      return;
    }
    if (card.type === 'event') {
      if (state.round < 2) { flash('Events can\'t be played in Round 1'); return; }
      if (p.credits < (card.cost ?? 0)) { flash(`Need ${card.cost}Cr`); return; }
      dispatch({ type: 'PLAY_EVENT', player: 'human', cardId: card.id });
      flash(`${card.name} resolved`);
      return;
    }
  }

  function handleModelActivate(modelId: string) {
    if (!isMyTurn) return;
    dispatch({ type: 'ACTIVATE_MODEL', player: 'human', modelId, promptIds: selectedPrompts });
    setSelectedPrompts([]); setUIMode('idle');
    flash('Model activated — creation queued!');
  }

  function handleAbility(num: number | 'signature') {
    if (!isMyTurn || !hCreatorCard) return;
    // Abilities needing targets
    if (num === 1 && hCreatorCard.id === 'C-001') {
      if (aiP.field.length === 0) { flash('No opponent creations to target'); return; }
      setPendingAbility(num); setUIMode('awaiting_target');
      flash('Click an opponent creation to Overrender'); return;
    }
    if (num === 2 && hCreatorCard.id === 'C-001') {
      const locked = humanP.field.filter(c => c.clipLocked);
      if (!locked.length) { flash('No CLIP-LOCKed creations'); return; }
      dispatch({ type: 'USE_CREATOR_ABILITY', player: 'human', abilityNum: num, targetId: locked[0].instanceId });
      flash('Positive Feedback!'); return;
    }
    if (num === 3 && hCreatorCard.id === 'C-001') {
      if (!humanP.field.length) { flash('No creations on field'); return; }
      const target = humanP.field.reduce((best, c) => c.visibility > best.visibility ? c : best, humanP.field[0]);
      dispatch({ type: 'USE_CREATOR_ABILITY', player: 'human', abilityNum: num, targetId: target.instanceId });
      flash('Iridescent Shift applied!'); return;
    }
    dispatch({ type: 'USE_CREATOR_ABILITY', player: 'human', abilityNum: num });
    flash('Ability used!');
  }

  function handleCreationClick(c: Creation, owner: PlayerId) {
    if (uiMode === 'awaiting_target' && owner === 'ai') {
      dispatch({ type: 'USE_CREATOR_ABILITY', player: 'human', abilityNum: pendingAbility!, targetId: c.instanceId });
      setUIMode('idle'); setPendingAbility(null); flash('Ability resolved!'); return;
    }
    if (owner === 'human' && isMyTurn && hCreatorCard?.id === 'C-001' && !c.clipLocked && c.sourceModelId === 'M-001' && c.runtimeLeft === 0) {
      dispatch({ type: 'APPLY_CLIP_LOCK', player: 'human', creationId: c.instanceId });
      flash('CLIP-LOCK applied');
    }
  }

  function cancelMode() { setUIMode('idle'); setPendingAbility(null); setSelectedPrompts([]); }

  // ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-0 py-3 min-h-[calc(100vh-5rem)] relative">

      <AnimatePresence>
        {state.phase === 'game_over' && (
          <GameOverScreen winner={state.winner} onRematch={() => { setStarted(false); aiRunning.current = false; }} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modalCard && <InGameCardModal card={modalCard} onClose={() => setModalCard(null)} />}
      </AnimatePresence>

      {/* Flash message */}
      <AnimatePresence>
        {msg && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none px-4 py-2 rounded-full bg-[#1c2120]/95 border border-[#a1d0c6]/25 text-[#dfe3e1] text-[11px] font-mono shadow-lg"
          >{msg}</motion.div>
        )}
      </AnimatePresence>

      {/* ── Turn bar ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-3 mb-3 pb-2 border-b border-white/6">
        <span className="text-[9px] font-mono uppercase tracking-widest text-[#c0c8c5]/30">
          R{state.round} · T{state.turn}
        </span>
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border transition-all
          ${isMyTurn
            ? 'border-[#a1d0c6]/40 bg-[#a1d0c6]/8 text-[#a1d0c6]'
            : 'border-[#cebefa]/20 bg-[#cebefa]/5 text-[#cebefa]/70'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isMyTurn ? 'bg-[#a1d0c6]' : 'bg-[#cebefa]/50'}`} />
          {isMyTurn ? 'Your Turn' : aiThinking ? 'AI thinking…' : 'AI Turn'}
        </div>
        {uiMode !== 'idle' && (
          <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 px-3 py-1 rounded-full border border-yellow-400/30 bg-yellow-400/6 text-yellow-300 text-[10px] font-mono"
          >
            {uiMode === 'awaiting_target' ? '🎯 Select target' : `📝 ${selectedPrompts.length} prompt(s) selected — click a model`}
            <button onClick={cancelMode} className="text-yellow-400/50 hover:text-yellow-400 transition-colors">✕</button>
          </motion.div>
        )}
        <div className="ml-auto flex items-center gap-3 text-[10px] font-mono text-[#c0c8c5]/35">
          <span>{humanP.deck.length}🂠</span>
          <span>{humanP.credits}Cr</span>
        </div>
      </div>

      {/* ── AI zone ──────────────────────────────────────────────── */}
      <div className={`px-3 pb-3 mb-1 rounded-xl mx-2 transition-all duration-300 ${state.activePlayer === 'ai' ? 'bg-[#cebefa]/3 border border-[#cebefa]/8' : 'border border-transparent'}`}>
        {/* AI creator bar */}
        <div className="flex items-center gap-3 mb-2">
          <div className="flex flex-col gap-0.5 shrink-0">
            <span className="text-[8px] uppercase tracking-widest text-[#c0c8c5]/30 font-mono">AI · {aCreatorCard?.name ?? '—'}</span>
            <HealthBar current={aiP.creator.loyalty} max={aCreatorCard?.loyalty ?? 10} label="AI" flip />
          </div>
          <div className="flex items-center gap-2 ml-auto text-[10px] font-mono text-[#c0c8c5]/30">
            <span>{aiP.creator.reputation}R</span>
            <span>{aiP.credits}Cr</span>
            <span>{aiP.hand.length} cards</span>
          </div>
        </div>

        {/* AI field */}
        <div className="flex gap-2 flex-wrap min-h-[88px] items-end">
          <AnimatePresence>
            {[...aiP.field, ...aiP.queue].map(c => (
              <CreationTile key={c.instanceId} c={c}
                glow={uiMode === 'awaiting_target' && c.runtimeLeft === 0 ? 'red' : 'none'}
                onClick={() => handleCreationClick(c, 'ai')}
                onInfo={() => { const mc = CMAP.get(c.sourceModelId); if (mc) setModalCard(mc); }}
              />
            ))}
          </AnimatePresence>
          {aiP.field.length === 0 && aiP.queue.length === 0 && (
            <span className="text-[10px] text-[#c0c8c5]/15 italic self-center">No AI creations on field</span>
          )}
        </div>
      </div>

      {/* ── Shared zone ──────────────────────────────────────────── */}
      <div className="mx-2 py-3 px-3 border-y border-white/6 bg-[#0d1211]/30">
        <div className="flex flex-col gap-2">
          <div className="text-[8px] uppercase tracking-widest text-[#c0c8c5]/25 font-mono">— Shared Model Zone —</div>
          <div className="flex gap-2 flex-wrap items-center min-h-[52px]">
            {state.sharedModels.length === 0 && (
              <span className="text-[10px] text-[#c0c8c5]/20 italic">
                No models in play yet — play a model card or a guaranteed model to start
              </span>
            )}
            {state.sharedModels.map(m => (
              <SharedModelCard
                key={m.modelId}
                model={m}
                canActivate={isMyTurn && !m.activatedThisTurn && (state.round >= 2 || m.placedByPlayer === 'human') && humanP.credits >= (CMAP.get(m.modelId)?.activateCost ?? 0)}
                onActivate={() => handleModelActivate(m.modelId)}
                onInfo={() => { const mc = CMAP.get(m.modelId); if (mc) setModalCard(mc); }}
              />
            ))}
          </div>
          {state.artifactZone.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {state.artifactZone.map((id, i) => {
                const c = CMAP.get(id);
                return c ? <span key={i} className="text-[8px] px-2 py-0.5 rounded border border-[#bb6bd9]/25 bg-[#bb6bd9]/8 text-[#bb6bd9]/70 font-mono">{c.name}</span> : null;
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Player zone ──────────────────────────────────────────── */}
      <div className={`px-3 pt-3 mx-2 rounded-xl transition-all duration-300 ${isMyTurn ? 'bg-[#a1d0c6]/3 border border-[#a1d0c6]/8' : 'border border-transparent'}`}>

        {/* Player field + creator */}
        <div className="flex items-start gap-3 mb-3">
          {/* Creator ability panel */}
          {hCreatorCard && (
            <CreatorAbilityPanel
              card={hCreatorCard}
              currentReputation={humanP.creator.reputation}
              currentLoyalty={humanP.creator.loyalty}
              isExhausted={state.abilityUsedThisTurn.includes('human')}
              isMyTurn={isMyTurn}
              onSelectAbility={handleAbility}
              className="shrink-0"
            />
          )}

          {/* Player field */}
          <div className="flex-1 flex flex-col gap-2">
            <div className="flex gap-2 flex-wrap min-h-[88px] items-end">
              <AnimatePresence>
                {[...humanP.field, ...humanP.queue].map(c => (
                  <CreationTile
                    key={c.instanceId} c={c}
                    glow={c.clipLocked ? 'teal' : 'none'}
                    onClick={() => handleCreationClick(c, 'human')}
                  />
                ))}
              </AnimatePresence>
              {humanP.field.length === 0 && humanP.queue.length === 0 && (
                <span className="text-[10px] text-[#c0c8c5]/15 italic self-center">Play a model, then activate it to generate a creation</span>
              )}
            </div>
            <HealthBar current={humanP.creator.loyalty} max={hCreatorCard?.loyalty ?? 10} label="You" />
            <div className="flex items-center gap-2 text-[10px] font-mono text-[#c0c8c5]/35">
              <span className="text-[#a1d0c6]/60">{humanP.creator.reputation} Rep</span>
              <span>·</span>
              <span className="text-yellow-400/60">{humanP.credits} Credits</span>
              <span>·</span>
              <span>{humanP.deck.length} in deck</span>
              <span>·</span>
              <span>{humanP.discard.length} discarded</span>
            </div>
          </div>
        </div>

        {/* Guaranteed models */}
        {humanP.guaranteedModels.length > 0 && (
          <div className="flex flex-col gap-1.5 mb-3">
            <div className="text-[8px] uppercase tracking-widest text-[#cebefa]/35 font-mono">Guaranteed Models (free to play)</div>
            <div className="flex gap-2 flex-wrap">
              {humanP.guaranteedModels.map(c => (
                <GuaranteedModelBadge
                  key={c.id} card={c}
                  canPlay={isMyTurn}
                  onPlay={() => {
                    dispatch({ type: 'PLAY_GUARANTEED_MODEL', player: 'human', cardId: c.id });
                    flash(`${c.name} placed in shared zone (free)`);
                  }}
                  onInfo={() => setModalCard(c)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Hand */}
        <div className="flex flex-col gap-1.5 mb-3">
          <div className="flex items-center justify-between">
            <div className="text-[8px] uppercase tracking-widest text-[#c0c8c5]/30 font-mono">Hand ({humanP.hand.length})</div>
            {selectedPrompts.length > 0 && (
              <div className="text-[9px] text-yellow-300/70 font-mono">
                {selectedPrompts.length} prompt(s) ready — click a model above to activate
              </div>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'thin' }}>
            {humanP.hand.map((card, idx) => {
              const p = humanP;
              let playable = isMyTurn;
              if (card.type === 'model')    playable = isMyTurn && p.credits >= (card.playCost ?? 0);
              if (card.type === 'prompt')   playable = isMyTurn && state.sharedModels.some(m => !m.activatedThisTurn);
              if (card.type === 'modifier') playable = isMyTurn && p.credits >= (card.cost ?? 0);
              if (card.type === 'artifact') playable = isMyTurn && p.credits >= (card.cost ?? 0);
              if (card.type === 'event')    playable = isMyTurn && state.round >= 2 && p.credits >= (card.cost ?? 0);
              return (
                <HandCard
                  key={`${card.id}-${idx}`}
                  card={card}
                  selected={selectedPrompts.includes(card.id)}
                  playable={playable}
                  onClick={() => handleHandCard(card)}
                  onInfo={() => setModalCard(card)}
                />
              );
            })}
            {humanP.hand.length === 0 && (
              <span className="text-[10px] text-[#c0c8c5]/20 italic py-4 px-2">Empty hand</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pb-3 border-t border-white/6 pt-2">
          {uiMode !== 'idle' && (
            <button onClick={cancelMode}
              className="px-3 py-1.5 rounded-lg border border-red-400/20 text-red-400/60 text-[10px] font-mono hover:bg-red-400/8 transition-all"
            >✕ Cancel</button>
          )}
          <button
            onClick={() => { if (isMyTurn) dispatch({ type: 'CONCEDE', player: 'human' }); }}
            className="px-3 py-1.5 rounded-lg border border-white/8 text-[#c0c8c5]/25 text-[10px] font-mono hover:text-[#c0c8c5]/50 hover:border-white/15 transition-all"
          >Concede</button>
          <button
            onClick={endTurn}
            disabled={!isMyTurn}
            className={`ml-auto px-6 py-1.5 rounded-xl text-[12px] font-black transition-all
              ${isMyTurn
                ? 'bg-[#a1d0c6] text-[#0d1211] hover:bg-[#b5dbd4] shadow-[0_2px_12px_rgba(161,208,198,0.25)] active:scale-95'
                : 'bg-white/5 text-white/15 cursor-not-allowed'
              }`}
          >End Turn →</button>
        </div>
      </div>

      {/* ── Game log ─────────────────────────────────────────────── */}
      <div ref={logRef}
        className="mx-2 mt-2 rounded-xl border border-white/6 bg-[#0d1211]/40 p-3 max-h-28 overflow-y-auto"
        style={{ scrollbarWidth: 'thin' }}
      >
        <div className="text-[7px] uppercase tracking-widest text-[#c0c8c5]/20 font-mono mb-1">Game Log</div>
        {state.log.slice(0, 80).map(e => (
          <div key={e.id} className={`text-[9px] font-mono leading-relaxed
            ${e.type === 'combat' ? 'text-red-400/60' : e.type === 'action' ? 'text-[#a1d0c6]/55' : e.type === 'error' ? 'text-orange-400/80' : 'text-[#c0c8c5]/25'}`}
          >T{e.turn} {e.text}</div>
        ))}
        {state.log.length === 0 && <span className="text-[9px] text-[#c0c8c5]/15 italic">Game starting…</span>}
      </div>
    </div>
  );
}
