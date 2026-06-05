// ============================================================
// PROMPT BATTLE — ArenaBattlefield · v0.3
// ============================================================

import { useReducer, useEffect, useRef, useState } from 'react';
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

// Loyalty bar
function LoyaltyBar({ current, max, label }: { current: number; max: number; label: string }) {
  const pct = Math.max(0, Math.min(100, (current / Math.max(1, max)) * 100));
  const col = pct > 50 ? '#a1d0c6' : pct > 20 ? '#f2c94c' : '#eb5757';
  return (
    <div className="flex items-center gap-2 w-full">
      <span className="text-[9px] font-mono uppercase tracking-widest text-[#c0c8c5]/40 w-7 shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
        <motion.div className="h-full rounded-full" style={{ backgroundColor: col }} animate={{ width: `${pct}%` }} transition={{ type: 'spring', stiffness: 180, damping: 28 }} />
      </div>
      <span className="text-[11px] font-bold font-mono text-[#dfe3e1] w-10 text-right shrink-0">♥{current}</span>
    </div>
  );
}

// Creation token on the battlefield
function CreationTile({
  c, mini = false, onClick, glow,
}: {
  c: Creation; mini?: boolean; onClick?: () => void; glow?: 'red' | 'teal' | 'none';
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
    </motion.div>
  );
}

// Card in hand
function HandCard({ card, selected, playable, onClick }: {
  card: Card; selected?: boolean; playable: boolean; onClick: () => void;
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
    </motion.button>
  );
}

// Guaranteed model badge (set aside, always available)
function GuaranteedModelBadge({ card, onPlay, canPlay }: { card: Card; onPlay: () => void; canPlay: boolean }) {
  return (
    <motion.button
      onClick={canPlay ? onPlay : undefined}
      whileHover={canPlay ? { scale: 1.06, y: -3 } : {}}
      whileTap={canPlay   ? { scale: 0.95 } : {}}
      className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl border text-center w-20 shrink-0 transition-all
        ${canPlay
          ? 'border-[#cebefa]/40 bg-[#cebefa]/6 hover:bg-[#cebefa]/12 cursor-pointer shadow-[0_0_8px_rgba(206,190,250,0.1)]'
          : 'border-[#cebefa]/10 bg-transparent opacity-40 cursor-not-allowed'
        }`}
    >
      <span className="text-[7px] uppercase tracking-widest text-[#cebefa]/50 font-mono">Guaranteed</span>
      <span className="text-[10px] font-bold text-[#dfe3e1] leading-tight">{card.name}</span>
      <span className="text-[8px] font-mono text-[#cebefa]/50">Q{card.quality} · Free</span>
      {canPlay && <span className="text-[8px] text-[#cebefa]/60">↑ Play</span>}
    </motion.button>
  );
}

// Model in shared zone
function SharedModelCard({ model, canActivate, onActivate }: {
  model: { modelId: string; activatedThisTurn: boolean; placedByPlayer: PlayerId; activationsThisRound: number };
  canActivate: boolean;
  onActivate: () => void;
}) {
  const card = CMAP.get(model.modelId);
  if (!card) return null;
  return (
    <motion.button
      onClick={canActivate ? onActivate : undefined}
      whileHover={canActivate ? { scale: 1.05, y: -2 } : {}}
      whileTap={canActivate   ? { scale: 0.96 } : {}}
      title={canActivate ? `Activate ${card.name} (${card.activateCost ?? 0}Cr)` : model.activatedThisTurn ? 'Already used this turn' : 'Cannot activate now'}
      className={`flex flex-col items-center gap-1 rounded-xl border px-3 py-2 text-center min-w-[80px] transition-all
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
    </motion.button>
  );
}

// ─────────────────────────────────────────────────────────────
// Deck picker screen
// ─────────────────────────────────────────────────────────────

function DeckPickerScreen({ onStart }: {
  onStart: (hCreator: string, hDeck: Card[], aCreator: string, aDeck: Card[], diff: Difficulty) => void;
}) {
  const [chosen, setChosen] = useState<number | null>(null);
  const [diff, setDiff]     = useState<Difficulty>('medium');

  function expandDeck(d: typeof PREBUILT_DECKS[0]): Card[] {
    const out: Card[] = [];
    // Guaranteed models go in separately
    for (const gid of d.guaranteedModels) {
      const c = CMAP.get(gid);
      if (c) out.push(c);
    }
    for (const [id, count] of Object.entries(d.cards)) {
      const c = CMAP.get(id);
      if (c && c.type !== 'creator') for (let i = 0; i < count; i++) out.push(c);
    }
    return out;
  }

  function go() {
    if (chosen === null) return;
    const hd = PREBUILT_DECKS[chosen];
    const ad = PREBUILT_DECKS[chosen === 0 ? 1 : 0];
    onStart(hd.creator, expandDeck(hd), ad.creator, expandDeck(ad), diff);
  }

  return (
    <div className="flex flex-col items-center justify-center gap-10 py-16 min-h-[calc(100vh-5rem)]">
      <div className="text-center">
        <div className="text-[10px] uppercase tracking-[0.25em] text-[#a1d0c6]/40 font-mono mb-2">Quick Duel</div>
        <h1 className="text-4xl font-black text-[#dfe3e1] tracking-tight">Choose Your Deck</h1>
        <p className="text-[#c0c8c5]/40 text-sm mt-2">You'll face the AI with the opposing deck</p>
      </div>

      <div className="flex gap-5 flex-wrap justify-center">
        {PREBUILT_DECKS.map((deck, i) => {
          const creator = CMAP.get(deck.creator);
          const isChosen = chosen === i;
          return (
            <motion.button
              key={deck.id}
              onClick={() => setChosen(i)}
              whileHover={{ scale: 1.02, y: -5 }}
              whileTap={{ scale: 0.98 }}
              className={`relative w-72 text-left rounded-2xl border p-6 transition-all duration-200 overflow-hidden
                ${isChosen
                  ? 'border-[#a1d0c6]/50 bg-[#a1d0c6]/6 shadow-[0_8px_32px_rgba(161,208,198,0.15)]'
                  : 'border-white/8 bg-[#1c2120]/60 hover:border-white/15'
                }`}
            >
              {/* Decorative corner */}
              <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full transition-all ${isChosen ? 'bg-[#a1d0c6]/6' : 'bg-white/3'}`} />
              <div className="text-[9px] uppercase tracking-[0.2em] font-mono text-[#a1d0c6]/40 mb-1">Deck {i + 1}</div>
              <h2 className="text-lg font-black text-[#dfe3e1] leading-tight">{deck.name.split('—')[0].trim()}</h2>
              <p className="text-[11px] text-[#c0c8c5]/50 leading-relaxed mt-2 mb-4">{deck.description}</p>
              {creator && (
                <div className="flex items-center gap-2 py-2 border-t border-white/6">
                  <span className="text-[9px] text-[#c0c8c5]/30 font-mono">CREATOR</span>
                  <span className="text-[11px] font-bold text-[#a1d0c6]">{creator.name}</span>
                  <span className="ml-auto text-[9px] font-mono text-[#c0c8c5]/30">♥{creator.loyalty}</span>
                </div>
              )}
              <div className="flex gap-1 mt-2 flex-wrap">
                {deck.archetypes.map(a => (
                  <span key={a} className="text-[8px] px-2 py-0.5 rounded-full border border-white/10 text-[#c0c8c5]/40 font-mono">{a}</span>
                ))}
                <span className={`text-[8px] px-2 py-0.5 rounded-full font-mono ml-auto ${
                  deck.difficulty === 'Beginner' ? 'text-[#6fcf97] border border-[#6fcf97]/30'
                  : deck.difficulty === 'Intermediate' ? 'text-yellow-400 border border-yellow-400/30'
                  : 'text-red-400 border border-red-400/30'
                }`}>{deck.difficulty}</span>
              </div>
              {isChosen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="absolute top-4 right-4 w-5 h-5 rounded-full bg-[#a1d0c6] flex items-center justify-center text-[#0d1211] text-[10px] font-black"
                >✓</motion.div>
              )}
            </motion.button>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="text-[9px] uppercase tracking-widest text-[#c0c8c5]/35 font-mono">AI Difficulty</div>
        <div className="flex gap-2 p-1 rounded-xl border border-white/8 bg-[#1c2120]/40">
          {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
            <button key={d} onClick={() => setDiff(d)}
              className={`px-4 py-1.5 rounded-lg text-[11px] font-bold font-mono transition-all
                ${diff === d ? 'bg-[#a1d0c6] text-[#0d1211]' : 'text-[#c0c8c5]/40 hover:text-[#c0c8c5]/70'}`}
            >{d}</button>
          ))}
        </div>
      </div>

      <motion.button
        onClick={go}
        disabled={chosen === null}
        whileHover={chosen !== null ? { scale: 1.04, y: -2 } : {}}
        whileTap={chosen !== null   ? { scale: 0.97 } : {}}
        className={`px-10 py-3.5 rounded-2xl font-black text-sm tracking-wide transition-all
          ${chosen !== null
            ? 'bg-[#a1d0c6] text-[#0d1211] shadow-[0_4px_24px_rgba(161,208,198,0.3)]'
            : 'bg-white/5 text-white/20 cursor-not-allowed'
          }`}
      >
        {chosen !== null ? `Play as ${PREBUILT_DECKS[chosen]?.name.split('—')[0].trim().split(' — ')[0].trim()} →` : 'Select a deck to continue'}
      </motion.button>
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
  useEffect(() => {
    if (!started) return;
    if (state.phase === 'game_over') return;

    // AI mulligan: always keeps
    if (state.phase === 'mulligan' && !state.mulliganPhase.aiDone) {
      const timer = setTimeout(() => {
        dispatch({ type: 'KEEP_HAND', player: 'ai' });
      }, 800);
      return () => clearTimeout(timer);
    }

    // AI main phase
    if (state.phase !== 'main' || state.activePlayer !== 'ai') return;
    if (aiRunning.current) return;

    aiRunning.current = true;
    const ai   = createAI(difficulty);
    const snap = state;

    (async () => {
      try {
        await sleep(500);
        const plan = ai.planFullTurn(snap, ALL_CARDS);
        for (const action of plan) {
          await sleep(550 + Math.random() * 350);
          let ga: GameAction | null = null;
          switch (action.type) {
            case 'PLAY_MODEL': {
              // Check if it's a guaranteed model (still in guaranteedModels list)
              const isGuaranteed = snap.ai.guaranteedModels?.some(c => c.id === action.cardId);
              ga = isGuaranteed
                ? { type: 'PLAY_GUARANTEED_MODEL', player: 'ai', cardId: action.cardId! }
                : { type: 'PLAY_MODEL',             player: 'ai', cardId: action.cardId! };
              break;
            }
            case 'ACTIVATE_MODEL':       ga = { type: 'ACTIVATE_MODEL',       player: 'ai', modelId: action.cardId!, promptIds: action.promptIds ?? [] }; break;
            case 'USE_CREATOR_ABILITY':  ga = { type: 'USE_CREATOR_ABILITY',  player: 'ai', abilityNum: action.abilityNum! }; break;
            case 'PLAY_MODIFIER':        ga = { type: 'PLAY_MODIFIER',        player: 'ai', cardId: action.cardId!, targetId: action.targetId ?? 'creator' }; break;
            case 'PLAY_ARTIFACT':        ga = { type: 'PLAY_ARTIFACT',        player: 'ai', cardId: action.cardId! }; break;
            case 'PLAY_EVENT':           ga = { type: 'PLAY_EVENT',           player: 'ai', cardId: action.cardId! }; break;
            case 'END_TURN':             ga = { type: 'END_TURN',             player: 'ai' }; break;
          }
          if (ga) dispatch(ga);
          if (action.type === 'END_TURN') break;
        }
        await sleep(300);
        dispatch({ type: 'END_TURN', player: 'ai' });
      } finally {
        aiRunning.current = false;
      }
    })();
  }, [started, state.phase, state.activePlayer, state.turn, state.mulliganPhase.aiDone]);

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
            <LoyaltyBar current={aiP.creator.loyalty} max={aCreatorCard?.loyalty ?? 10} label="AI" />
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
            <LoyaltyBar current={humanP.creator.loyalty} max={hCreatorCard?.loyalty ?? 10} label="You" />
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
