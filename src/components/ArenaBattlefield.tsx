// ============================================================
// PROMPT BATTLE — ArenaBattlefield · v0.1
// ============================================================
// Full game board. Wires game-engine.ts, ai-engine.ts,
// and CreatorAbilityPanel together into a playable UI.
// ============================================================

import { useReducer, useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ALL_CARDS, PREBUILT_DECKS } from '../data';
import type { Card } from '../types';
import {
  gameReducer,
  selectGameOver,
  selectActiveCreations,
  selectQueue,
} from '../game-engine';
import type { GameState, GameAction, Creation, PlayerId } from '../game-engine';
import { createAI } from '../ai-engine';
import type { Difficulty } from '../ai-engine';
import CreatorAbilityPanel from './CreatorAbilityPanel';

// ─────────────────────────────────────────────────────────────
// Card map (singleton)
// ─────────────────────────────────────────────────────────────

const ALL_CARDS_MAP = new Map(ALL_CARDS.map(c => [c.id, c]));

// ─────────────────────────────────────────────────────────────
// Tiny helpers
// ─────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function effectiveQ(c: Creation) { return c.quality - c.glitchTokens; }

const VIS_LABEL = (v: number) =>
  v >= 10 ? 'Featured'
  : v >= 6 ? 'Liked'
  : v >= 3 ? 'Noticed'
  : 'Unnoticed';

const VIS_COLOR = (v: number) =>
  v >= 10 ? 'text-yellow-300'
  : v >= 6 ? 'text-[#a1d0c6]'
  : v >= 3 ? 'text-[#c0c8c5]/80'
  : 'text-[#c0c8c5]/30';

// ─────────────────────────────────────────────────────────────
// Creation token component
// ─────────────────────────────────────────────────────────────

function CreationToken({
  creation,
  isOwn,
  onClick,
  highlight,
}: {
  creation:  Creation;
  isOwn:     boolean;
  onClick?:  () => void;
  highlight?: 'target' | 'glow';
}) {
  const eq = effectiveQ(creation);
  const inQueue = creation.runtimeLeft > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.7, y: isOwn ? 20 : -20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{    opacity: 0, scale: 0.6 }}
      transition={{ type: 'spring', stiffness: 280, damping: 22 }}
      onClick={onClick}
      className={`relative flex flex-col items-center gap-1 rounded-xl px-2 py-2 w-24 shrink-0
        border transition-all duration-200 select-none
        ${inQueue
          ? 'bg-[#1c2120]/40 border-dashed border-[#a1d0c6]/15 opacity-60'
          : eq <= 0
            ? 'bg-red-950/40 border-red-500/30'
            : highlight === 'target'
              ? 'bg-[#1c2120]/80 border-red-400/60 shadow-[0_0_12px_rgba(248,113,113,0.4)] cursor-pointer'
              : highlight === 'glow'
                ? 'bg-[#1c2120]/80 border-[#a1d0c6]/50 shadow-[0_0_10px_rgba(161,208,198,0.25)] cursor-pointer'
                : 'bg-[#1c2120]/60 border-[#a1d0c6]/10'
        }
        ${creation.clipLocked ? 'ring-1 ring-blue-400/40' : ''}
      `}
    >
      {/* Style tag */}
      {creation.styleTag && (
        <span className="text-[8px] uppercase tracking-widest text-[#c0c8c5]/40 font-mono">
          {creation.styleTag}
        </span>
      )}

      {/* Runtime badge (queue) */}
      {inQueue && (
        <span className="text-[9px] font-mono text-[#cebefa]/60">RT {creation.runtimeLeft}</span>
      )}

      {/* Quality */}
      <div className="flex items-baseline gap-0.5">
        <span className="text-lg font-black text-[#dfe3e1]">{eq}</span>
        {creation.glitchTokens > 0 && (
          <span className="text-[9px] text-red-400 font-mono">-{creation.glitchTokens}G</span>
        )}
      </div>

      {/* Visibility bar */}
      {!inQueue && (
        <div className="w-full">
          <div className={`text-[8px] text-center font-mono ${VIS_COLOR(creation.visibility)}`}>
            {creation.visibility}vis · {VIS_LABEL(creation.visibility)}
          </div>
          <div className="w-full h-1 bg-[#0d1211] rounded-full mt-0.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                creation.visibility >= 10 ? 'bg-yellow-400'
                : creation.visibility >= 6  ? 'bg-[#a1d0c6]'
                : creation.visibility >= 3  ? 'bg-[#a1d0c6]/50'
                : 'bg-[#a1d0c6]/15'
              }`}
              style={{ width: `${Math.min(100, creation.visibility * 8)}%` }}
            />
          </div>
        </div>
      )}

      {/* Badges */}
      <div className="flex gap-1 flex-wrap justify-center">
        {creation.clipLocked && (
          <span className="text-[8px] bg-blue-900/50 text-blue-300 px-1 rounded font-mono">🔒CL</span>
        )}
      </div>

      {/* Model source (tiny) */}
      <span className="text-[7px] text-[#c0c8c5]/25 font-mono truncate w-full text-center">
        {ALL_CARDS_MAP.get(creation.sourceModelId)?.name ?? creation.sourceModelId}
      </span>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Creator stat bar
// ─────────────────────────────────────────────────────────────

function CreatorBar({
  label,
  loyalty,
  maxLoyalty,
  rep,
  isActive,
  isExhausted,
}: {
  label: string; loyalty: number; maxLoyalty: number;
  rep: number; isActive: boolean; isExhausted: boolean;
}) {
  const loyPct = Math.max(0, Math.min(100, (loyalty / maxLoyalty) * 100));
  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-xl border transition-all
      ${isActive
        ? 'border-[#a1d0c6]/30 bg-[#a1d0c6]/5'
        : 'border-[#a1d0c6]/8 bg-transparent opacity-70'
      }`}
    >
      <span className="text-[10px] uppercase tracking-widest text-[#c0c8c5]/50 font-mono w-10 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-[#0d1211] rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${loyalty > maxLoyalty * 0.4 ? 'bg-[#a1d0c6]' : loyalty > maxLoyalty * 0.15 ? 'bg-yellow-400' : 'bg-red-500'}`}
          animate={{ width: `${loyPct}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 30 }}
        />
      </div>
      <span className="text-[11px] font-bold text-[#dfe3e1] w-12 text-right font-mono">{loyalty}<span className="text-[#c0c8c5]/30">/{maxLoyalty}</span></span>
      <span className="text-[10px] text-[#a1d0c6]/60 font-mono w-14 text-right shrink-0">{rep}<span className="text-[#c0c8c5]/25"> rep</span></span>
      {isExhausted && <span className="text-[9px] text-orange-400/60 font-mono shrink-0">exhaust</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Hand card (compact)
// ─────────────────────────────────────────────────────────────

const TYPE_ACCENT: Record<string, string> = {
  model:    'border-[#cebefa]/30 hover:border-[#cebefa]/60 hover:bg-[#cebefa]/8',
  prompt:   'border-[#4a9a6e]/30 hover:border-[#4a9a6e]/60 hover:bg-[#4a9a6e]/8',
  modifier: 'border-[#b8842a]/30 hover:border-[#b8842a]/60 hover:bg-[#b8842a]/8',
  artifact: 'border-[#9b3dbb]/30 hover:border-[#9b3dbb]/60 hover:bg-[#9b3dbb]/8',
  event:    'border-[#3d6abb]/30 hover:border-[#3d6abb]/60 hover:bg-[#3d6abb]/8',
};

function HandCard({
  card,
  selected,
  playable,
  onClick,
}: {
  card: Card; selected: boolean; playable: boolean; onClick: () => void;
}) {
  const cost = card.type === 'model'
    ? `P${card.playCost ?? 0}/A${card.activateCost ?? 0}`
    : card.cost !== undefined
      ? `${card.cost}${card.costType === 'reputation' ? 'R' : 'Cr'}`
      : '';

  return (
    <motion.button
      onClick={onClick}
      whileHover={playable ? { y: -8, scale: 1.05 } : {}}
      whileTap={playable  ? { scale: 0.95 } : {}}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`relative flex flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2 w-24 shrink-0 text-left
        transition-all duration-150
        ${selected
          ? 'border-[#a1d0c6]/70 bg-[#a1d0c6]/15 shadow-[0_0_14px_rgba(161,208,198,0.3)]'
          : playable
            ? (TYPE_ACCENT[card.type] ?? 'border-[#a1d0c6]/20 hover:border-[#a1d0c6]/40')
            : 'border-white/5 opacity-30 cursor-not-allowed'
        }`}
    >
      {/* Type pip */}
      <div className={`w-full h-0.5 rounded-full mb-1 ${
        card.type === 'model'    ? 'bg-[#cebefa]/50'
        : card.type === 'prompt' ? 'bg-[#4a9a6e]/60'
        : card.type === 'modifier' ? 'bg-[#b8842a]/60'
        : card.type === 'artifact' ? 'bg-[#9b3dbb]/60'
        : 'bg-[#3d6abb]/60'
      }`} />
      <span className="text-[9px] text-[#c0c8c5]/40 uppercase tracking-widest font-mono">{card.type}</span>
      <span className="text-[11px] font-semibold text-[#dfe3e1] leading-tight line-clamp-2">{card.name}</span>
      {cost && <span className="text-[9px] text-[#a1d0c6]/60 font-mono mt-auto pt-1">{cost}</span>}
    </motion.button>
  );
}

// ─────────────────────────────────────────────────────────────
// Deck picker (before game starts)
// ─────────────────────────────────────────────────────────────

function DeckPicker({
  onStart,
}: {
  onStart: (humanCreatorId: string, humanDeck: Card[], aiCreatorId: string, aiDeck: Card[], difficulty: Difficulty) => void;
}) {
  const deckA = PREBUILT_DECKS.find(d => d.id === 'deck-a');
  const deckB = PREBUILT_DECKS.find(d => d.id === 'deck-b');
  const [chosen, setChosen] = useState<'a' | 'b' | null>(null);
  const [diff, setDiff]     = useState<Difficulty>('medium');

  function expandDeck(deckDef: typeof deckA): Card[] {
    if (!deckDef) return [];
    const cards: Card[] = [];
    for (const [cardId, count] of Object.entries(deckDef.cards)) {
      const card = ALL_CARDS_MAP.get(cardId);
      if (card && card.type !== 'creator') {
        for (let i = 0; i < count; i++) cards.push(card);
      }
    }
    return cards;
  }

  function handleStart() {
    if (!chosen || !deckA || !deckB) return;
    const humanIsA = chosen === 'a';
    const humanDeckDef = humanIsA ? deckA : deckB;
    const aiDeckDef    = humanIsA ? deckB : deckA;
    const humanCreator = humanIsA ? deckA.creator : deckB.creator;
    const aiCreator    = humanIsA ? deckB.creator : deckA.creator;

    onStart(
      humanCreator,
      expandDeck(humanDeckDef),
      aiCreator,
      expandDeck(aiDeckDef),
      diff
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center gap-8 py-12 animate-fade-in">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-[#dfe3e1] mb-1">Choose Your Deck</h1>
        <p className="text-[#c0c8c5]/40 text-sm">Pick a prebuilt deck to duel the AI</p>
      </div>

      <div className="flex gap-4 flex-wrap justify-center">
        {[deckA, deckB].map((deck, i) => {
          if (!deck) return null;
          const key = i === 0 ? 'a' : 'b';
          const creator = ALL_CARDS_MAP.get(deck.creator);
          return (
            <motion.button
              key={key}
              onClick={() => setChosen(key)}
              whileHover={{ scale: 1.03, y: -4 }}
              whileTap={{ scale: 0.97 }}
              className={`w-60 text-left rounded-2xl border p-5 transition-all
                ${chosen === key
                  ? 'border-[#a1d0c6]/60 bg-[#a1d0c6]/8 shadow-[0_0_24px_rgba(161,208,198,0.2)]'
                  : 'border-[#a1d0c6]/12 bg-[#1c2120]/50 hover:border-[#a1d0c6]/30'
                }`}
            >
              <span className="text-[9px] uppercase tracking-widest text-[#a1d0c6]/50 font-mono">Deck {key.toUpperCase()}</span>
              <h3 className="text-lg font-bold text-[#dfe3e1] mt-0.5">{deck.name}</h3>
              <p className="text-[11px] text-[#c0c8c5]/50 mt-1 mb-3">{deck.description}</p>
              {creator && (
                <div className="flex items-center gap-2 pt-2 border-t border-[#a1d0c6]/8">
                  <span className="text-[9px] text-[#c0c8c5]/35 font-mono">Creator:</span>
                  <span className="text-[11px] font-semibold text-[#a1d0c6]">{creator.name}</span>
                  <span className="text-[9px] text-[#c0c8c5]/30 ml-auto">♥ {creator.loyalty}</span>
                </div>
              )}
              <div className="flex gap-1 mt-2 flex-wrap">
                {deck.archetypes.map(a => (
                  <span key={a} className="text-[8px] px-1.5 py-0.5 rounded bg-[#a1d0c6]/8 text-[#a1d0c6]/60 font-mono">{a}</span>
                ))}
              </div>
              <span className={`text-[9px] font-mono mt-2 inline-block ${
                deck.difficulty === 'Beginner' ? 'text-[#4a9a6e]' : deck.difficulty === 'Intermediate' ? 'text-yellow-400' : 'text-red-400'
              }`}>{deck.difficulty}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Difficulty */}
      <div className="flex flex-col items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest text-[#c0c8c5]/40 font-mono">AI Difficulty</span>
        <div className="flex gap-2">
          {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
            <button
              key={d}
              onClick={() => setDiff(d)}
              className={`px-3 py-1 rounded-lg text-[11px] font-mono border transition-all
                ${diff === d
                  ? 'border-[#a1d0c6]/50 bg-[#a1d0c6]/12 text-[#a1d0c6]'
                  : 'border-[#a1d0c6]/10 text-[#c0c8c5]/30 hover:border-[#a1d0c6]/25'
                }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <motion.button
        onClick={handleStart}
        disabled={!chosen}
        whileHover={chosen ? { scale: 1.04, y: -2 } : {}}
        whileTap={chosen   ? { scale: 0.97 } : {}}
        className={`px-8 py-3 rounded-xl font-bold text-sm transition-all
          ${chosen
            ? 'bg-[#a1d0c6] text-[#0d1211] shadow-[0_0_20px_rgba(161,208,198,0.35)] hover:bg-[#b5dbd4]'
            : 'bg-[#a1d0c6]/10 text-[#a1d0c6]/30 cursor-not-allowed'
          }`}
      >
        Start Duel
      </motion.button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Game Over screen
// ─────────────────────────────────────────────────────────────

function GameOver({ winner, onRematch }: { winner: 'human' | 'ai' | 'draw' | null; onRematch: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 bg-[#0d1211]/90 flex items-center justify-center z-50"
    >
      <div className="text-center space-y-4">
        <motion.h1
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0,   opacity: 1 }}
          transition={{ delay: 0.2 }}
          className={`text-5xl font-black ${
            winner === 'human' ? 'text-[#a1d0c6]'
            : winner === 'ai'  ? 'text-red-400'
            : 'text-[#cebefa]'
          }`}
        >
          {winner === 'human' ? 'You Win!' : winner === 'ai' ? 'AI Wins' : 'Draw!'}
        </motion.h1>
        <p className="text-[#c0c8c5]/50 text-sm">
          {winner === 'human' ? "Impressive work." : winner === 'ai' ? "The heuristic outwitted you." : "Simultaneous elimination!"}
        </p>
        <button
          onClick={onRematch}
          className="mt-4 px-6 py-2.5 rounded-xl bg-[#a1d0c6] text-[#0d1211] font-bold text-sm hover:bg-[#b5dbd4] transition-colors"
        >
          Play Again
        </button>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Shared model zone mini display
// ─────────────────────────────────────────────────────────────

function SharedModelZone({
  state,
  onActivate,
  playerCredits,
  isPlayerTurn,
}: {
  state: GameState;
  onActivate: (modelId: string) => void;
  playerCredits: number;
  isPlayerTurn: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 items-center">
      <span className="text-[8px] uppercase tracking-widest text-[#c0c8c5]/30 font-mono">Shared Models</span>
      <div className="flex gap-2 flex-wrap justify-center">
        {state.sharedModels.length === 0 && (
          <span className="text-[10px] text-[#c0c8c5]/20 italic">None in play</span>
        )}
        {state.sharedModels.map(m => {
          const card = ALL_CARDS_MAP.get(m.modelId);
          if (!card) return null;
          const canActivate = isPlayerTurn
            && !m.activatedThisTurn
            && playerCredits >= (card.activateCost ?? 0)
            && (state.round >= 2 || m.placedByPlayer === 'human');
          return (
            <motion.button
              key={m.modelId}
              onClick={canActivate ? () => onActivate(m.modelId) : undefined}
              whileHover={canActivate ? { scale: 1.05 } : {}}
              className={`px-2.5 py-1.5 rounded-lg border text-left transition-all
                ${m.activatedThisTurn
                  ? 'border-[#cebefa]/10 bg-transparent opacity-30'
                  : canActivate
                    ? 'border-[#cebefa]/40 bg-[#cebefa]/8 hover:bg-[#cebefa]/15 cursor-pointer'
                    : 'border-[#cebefa]/15 bg-transparent opacity-50'
                }`}
            >
              <div className="text-[9px] text-[#cebefa]/60 font-mono uppercase tracking-wide">model</div>
              <div className="text-[11px] font-semibold text-[#dfe3e1]">{card.name}</div>
              <div className="text-[9px] text-[#c0c8c5]/40 font-mono">Q{card.quality} A{card.activateCost ?? 0}Cr</div>
              {m.activatedThisTurn && <div className="text-[8px] text-orange-400/60 mt-0.5">Used</div>}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main ArenaBattlefield component
// ─────────────────────────────────────────────────────────────

type UIMode = 'idle' | 'select_target_ability' | 'select_model_to_activate' | 'select_prompts';

interface GameSession {
  humanCreatorId: string;
  humanDeck:      Card[];
  aiCreatorId:    string;
  aiDeck:         Card[];
  difficulty:     Difficulty;
  firstPlayer:    PlayerId;
}

export default function ArenaBattlefield() {
  const [session, setSession]     = useState<GameSession | null>(null);
  const [state, dispatch_raw]     = useReducer(
    (s: GameState, a: GameAction) => gameReducer(s, a, ALL_CARDS_MAP),
    null as unknown as GameState
  );
  const [uiMode, setUiMode]       = useState<UIMode>('idle');
  const [pendingAbility, setPendingAbility] = useState<number | 'signature' | null>(null);
  const [selectedCards, setSelectedCards]   = useState<string[]>([]);
  const [pendingModelId, setPendingModelId] = useState<string | null>(null);
  const [aiThinking, setAiThinking]         = useState(false);
  const [message, setMessage]               = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  const dispatch = useCallback((a: GameAction) => dispatch_raw(a), []);

  // ── Start a new game ────────────────────────────────────────
  function startGame(
    humanCreatorId: string, humanDeck: Card[],
    aiCreatorId: string,    aiDeck: Card[],
    difficulty: Difficulty
  ) {
    const firstPlayer: PlayerId = Math.random() < 0.5 ? 'human' : 'ai';
    setSession({ humanCreatorId, humanDeck, aiCreatorId, aiDeck, difficulty, firstPlayer });
    dispatch({
      type: 'START_GAME',
      humanCreatorId, humanDeck,
      aiCreatorId,    aiDeck,
      firstPlayer,
    });
  }

  // ── AI turn loop ─────────────────────────────────────────────
  useEffect(() => {
    if (!state || !session) return;
    if (state.phase === 'game_over') return;
    if (state.activePlayer !== 'ai') return;
    if (aiThinking) return;

    setAiThinking(true);
    const ai = createAI(session.difficulty);

    (async () => {
      await sleep(600);
      const plan = ai.planFullTurn(state, ALL_CARDS);

      for (const action of plan) {
        await sleep(700 + Math.random() * 300);
        dispatch({ ...action, player: 'ai' } as GameAction);
        if (action.type === 'END_TURN') break;
      }

      // Safety: always end turn
      await sleep(400);
      dispatch({ type: 'END_TURN', player: 'ai' });
      setAiThinking(false);
    })();
  }, [state?.activePlayer, state?.phase, state?.turn]);

  // ── Log auto-scroll ──────────────────────────────────────────
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = 0;
  }, [state?.log?.length]);

  // ── Transient message ────────────────────────────────────────
  function flash(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(''), 2200);
  }

  if (!session || !state) {
    return (
      <DeckPicker onStart={startGame} />
    );
  }

  const isPlayerTurn = state.activePlayer === 'human' && state.phase === 'main';
  const humanCreatorCard = ALL_CARDS_MAP.get(state.human.creator.cardId)!;
  const aiCreatorCard    = ALL_CARDS_MAP.get(state.ai.creator.cardId)!;

  // ── Interaction handlers ─────────────────────────────────────

  function handleHandCardClick(card: Card) {
    if (!isPlayerTurn) return;
    const p = state.human;

    if (card.type === 'model') {
      if (p.credits < (card.playCost ?? 0)) { flash('Not enough credits'); return; }
      dispatch({ type: 'PLAY_MODEL', player: 'human', cardId: card.id });
      flash(`${card.name} placed in shared zone`);
      return;
    }
    if (card.type === 'prompt') {
      // Prompts need a model selected first
      if (!pendingModelId) {
        // Check if any model is activatable
        const activatable = state.sharedModels.filter(m =>
          !m.activatedThisTurn
          && (state.round >= 2 || m.placedByPlayer === 'human')
          && p.credits >= ((ALL_CARDS_MAP.get(m.modelId)?.activateCost ?? 0) + (card.cost ?? 0))
        );
        if (activatable.length === 0) { flash('No model available to activate with this prompt'); return; }
        // Auto-select if only one
        if (activatable.length === 1) {
          setPendingModelId(activatable[0].modelId);
          setSelectedCards(prev => prev.includes(card.id) ? prev.filter(x => x !== card.id) : [...prev, card.id]);
        } else {
          setUiMode('select_model_to_activate');
          setPendingModelId(null);
          flash('Select a model to activate with this prompt');
        }
        return;
      }
      setSelectedCards(prev =>
        prev.includes(card.id) ? prev.filter(x => x !== card.id) : [...prev, card.id]
      );
      return;
    }
    if (card.type === 'modifier') {
      dispatch({ type: 'PLAY_MODIFIER', player: 'human', cardId: card.id, targetId: 'creator' });
      flash(`${card.name} attached`);
      return;
    }
    if (card.type === 'artifact') {
      dispatch({ type: 'PLAY_ARTIFACT', player: 'human', cardId: card.id });
      flash(`${card.name} placed in artifact zone`);
      return;
    }
    if (card.type === 'event') {
      dispatch({ type: 'PLAY_EVENT', player: 'human', cardId: card.id });
      flash(`${card.name} resolved`);
      return;
    }
  }

  function handleModelActivate(modelId: string) {
    if (!isPlayerTurn) return;
    // Use selected prompt cards
    const promptIds = selectedCards.filter(id => {
      const c = ALL_CARDS_MAP.get(id);
      return c?.type === 'prompt';
    }).slice(0, 2);

    dispatch({ type: 'ACTIVATE_MODEL', player: 'human', modelId, promptIds });
    setPendingModelId(null);
    setSelectedCards([]);
    setUiMode('idle');
    flash('Model activated — creation queued!');
  }

  function handleAbilitySelect(abilityNum: number | 'signature') {
    if (!isPlayerTurn) return;
    if (abilityNum === 1 && humanCreatorCard.id === 'C-001') {
      // Overrender needs a target from opponent field
      setPendingAbility(abilityNum);
      setUiMode('select_target_ability');
      flash('Select an opponent creation to target');
      return;
    }
    dispatch({ type: 'USE_CREATOR_ABILITY', player: 'human', abilityNum });
    flash(`Ability used!`);
  }

  function handleCreationClick(creation: Creation, owner: PlayerId) {
    if (uiMode === 'select_target_ability' && owner === 'ai') {
      dispatch({ type: 'USE_CREATOR_ABILITY', player: 'human', abilityNum: pendingAbility!, targetId: creation.instanceId });
      setUiMode('idle');
      setPendingAbility(null);
      flash('Ability resolved!');
    }
  }

  function handleEndTurn() {
    if (!isPlayerTurn) { flash("It's not your turn"); return; }
    setSelectedCards([]);
    setPendingModelId(null);
    setUiMode('idle');
    dispatch({ type: 'END_TURN', player: 'human' });
  }

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col gap-0 py-4 relative">

      {/* Game over overlay */}
      <AnimatePresence>
        {state.phase === 'game_over' && (
          <GameOver winner={state.winner} onRematch={() => setSession(null)} />
        )}
      </AnimatePresence>

      {/* Flash message */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{    opacity: 0, y: -10 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-40 bg-[#1c2120] border border-[#a1d0c6]/30 text-[#dfe3e1] text-[12px] px-4 py-2 rounded-full shadow-lg font-mono"
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Turn / round header ───────────────────────────────── */}
      <div className="flex items-center justify-between px-2 mb-3">
        <span className="text-[10px] font-mono text-[#c0c8c5]/40 uppercase tracking-widest">
          Round {state.round} · Turn {state.turn}
        </span>
        <span className={`text-[11px] font-mono font-bold px-3 py-1 rounded-full border
          ${state.activePlayer === 'human'
            ? 'border-[#a1d0c6]/40 text-[#a1d0c6] bg-[#a1d0c6]/8'
            : 'border-[#cebefa]/30 text-[#cebefa] bg-[#cebefa]/6'
          }`}
        >
          {state.activePlayer === 'human' ? '▶ Your Turn' : aiThinking ? '⏳ AI Thinking…' : '● AI Turn'}
        </span>
        <span className="text-[10px] font-mono text-[#c0c8c5]/40">
          {state.human.credits}Cr · {state.human.deck.length}🂠
        </span>
      </div>

      {/* ── AI zone ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 px-2 pb-3 border-b border-[#a1d0c6]/8">
        <CreatorBar
          label="AI"
          loyalty={state.ai.creator.loyalty}
          maxLoyalty={aiCreatorCard.loyalty ?? 10}
          rep={state.ai.creator.reputation}
          isActive={state.activePlayer === 'ai'}
          isExhausted={state.ai.creator.isExhausted}
        />
        {/* AI Creator card (display only) */}
        <div className="flex items-start gap-3">
          <div className="w-16 shrink-0">
            <div className="rounded-lg border border-[#cebefa]/15 bg-[#1c2120]/50 p-1.5 text-center">
              <div className="text-[8px] text-[#c0c8c5]/30 uppercase font-mono">AI</div>
              <div className="text-[10px] font-bold text-[#dfe3e1] leading-tight">{aiCreatorCard.name}</div>
              <div className="text-[9px] text-[#cebefa] mt-0.5">♥{state.ai.creator.loyalty}</div>
            </div>
          </div>
          {/* AI field */}
          <div className="flex gap-2 flex-wrap min-h-[80px] items-center">
            <AnimatePresence>
              {state.ai.field.map(c => (
                <CreationToken
                  key={c.instanceId}
                  creation={c}
                  isOwn={false}
                  highlight={uiMode === 'select_target_ability' ? 'target' : undefined}
                  onClick={() => handleCreationClick(c, 'ai')}
                />
              ))}
              {state.ai.queue.map(c => (
                <CreationToken key={c.instanceId} creation={c} isOwn={false} />
              ))}
            </AnimatePresence>
            {state.ai.field.length === 0 && state.ai.queue.length === 0 && (
              <span className="text-[10px] text-[#c0c8c5]/15 italic">No creations</span>
            )}
          </div>
        </div>
        {/* AI hand count */}
        <div className="text-[9px] text-[#c0c8c5]/25 font-mono pl-1">
          AI hand: {state.ai.hand.length} cards · deck: {state.ai.deck.length}
        </div>
      </div>

      {/* ── Shared zone ──────────────────────────────────────────── */}
      <div className="py-3 px-2 border-b border-[#a1d0c6]/8">
        <SharedModelZone
          state={state}
          onActivate={handleModelActivate}
          playerCredits={state.human.credits}
          isPlayerTurn={isPlayerTurn}
        />
        {state.artifactZone.length > 0 && (
          <div className="mt-2 flex gap-1 justify-center flex-wrap">
            {state.artifactZone.map(id => {
              const card = ALL_CARDS_MAP.get(id);
              return card ? (
                <span key={id} className="text-[9px] px-2 py-0.5 rounded bg-[#9b3dbb]/15 text-[#9b3dbb]/70 border border-[#9b3dbb]/20 font-mono">
                  {card.name}
                </span>
              ) : null;
            })}
          </div>
        )}
      </div>

      {/* ── Player zone ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 px-2 pt-3">
        {/* Field */}
        <div className="flex items-start gap-3">
          {/* Creator ability panel */}
          <CreatorAbilityPanel
            card={humanCreatorCard}
            currentReputation={state.human.creator.reputation}
            currentLoyalty={state.human.creator.loyalty}
            isExhausted={state.human.creator.isExhausted}
            isMyTurn={isPlayerTurn}
            onSelectAbility={handleAbilitySelect}
            className="shrink-0"
          />
          {/* Human field */}
          <div className="flex gap-2 flex-wrap min-h-[80px] items-center flex-1">
            <AnimatePresence>
              {state.human.field.map(c => (
                <CreationToken
                  key={c.instanceId}
                  creation={c}
                  isOwn={true}
                  highlight={c.clipLocked ? 'glow' : undefined}
                  onClick={() => {
                    // Click own creation — apply CLIP-LOCK if Aia
                    if (isPlayerTurn && humanCreatorCard.id === 'C-001' && !c.clipLocked && c.sourceModelId === 'M-001') {
                      dispatch({ type: 'APPLY_CLIP_LOCK', player: 'human', creationId: c.instanceId });
                      flash('CLIP-LOCK applied');
                    }
                  }}
                />
              ))}
              {state.human.queue.map(c => (
                <CreationToken key={c.instanceId} creation={c} isOwn={true} />
              ))}
            </AnimatePresence>
            {state.human.field.length === 0 && state.human.queue.length === 0 && (
              <span className="text-[10px] text-[#c0c8c5]/15 italic">No creations — activate a model!</span>
            )}
          </div>
        </div>

        {/* Creator stat bar */}
        <CreatorBar
          label="You"
          loyalty={state.human.creator.loyalty}
          maxLoyalty={humanCreatorCard.loyalty ?? 10}
          rep={state.human.creator.reputation}
          isActive={isPlayerTurn}
          isExhausted={state.human.creator.isExhausted}
        />

        {/* ── Hand ───────────────────────────────────────────────── */}
        <div className="flex flex-col gap-1 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-widest text-[#c0c8c5]/30 font-mono">
              Hand ({state.human.hand.length}) · {state.human.credits}Cr
            </span>
            {pendingModelId && (
              <span className="text-[9px] text-yellow-400/70 font-mono">
                Prompts selected: {selectedCards.length}/2 · Click model to activate
              </span>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: 'thin' }}>
            <AnimatePresence>
              {state.human.hand.map(card => {
                const isSelected = selectedCards.includes(card.id);
                let playable = isPlayerTurn;
                if (card.type === 'model')    playable = isPlayerTurn && state.human.credits >= (card.playCost ?? 0);
                if (card.type === 'prompt')   playable = isPlayerTurn && state.sharedModels.some(m => !m.activatedThisTurn);
                if (card.type === 'modifier') playable = isPlayerTurn && state.human.credits >= (card.cost ?? 0);
                if (card.type === 'artifact') playable = isPlayerTurn && state.human.credits >= (card.cost ?? 0);
                if (card.type === 'event')    playable = isPlayerTurn && state.round >= 2 && state.human.credits >= (card.cost ?? 0);

                return (
                  <motion.div key={`${card.id}-${Math.random()}`} layout>
                    <HandCard
                      card={card}
                      selected={isSelected}
                      playable={playable}
                      onClick={() => handleHandCardClick(card)}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {state.human.hand.length === 0 && (
              <span className="text-[10px] text-[#c0c8c5]/20 italic py-3">No cards in hand</span>
            )}
          </div>
        </div>

        {/* ── Action buttons ─────────────────────────────────────── */}
        <div className="flex gap-2 flex-wrap pt-1">
          {pendingModelId && (
            <button
              onClick={() => handleModelActivate(pendingModelId)}
              className="px-4 py-1.5 rounded-lg bg-[#cebefa] text-[#0d1211] text-[11px] font-bold hover:bg-[#d8e4ff] transition-colors"
            >
              Activate {ALL_CARDS_MAP.get(pendingModelId)?.name}
              {selectedCards.length > 0 ? ` + ${selectedCards.length} prompt(s)` : ''}
            </button>
          )}
          {uiMode === 'select_target_ability' && (
            <button
              onClick={() => { setUiMode('idle'); setPendingAbility(null); }}
              className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 text-[11px] font-mono hover:bg-red-950/30 transition-colors"
            >
              Cancel ability
            </button>
          )}
          <button
            onClick={handleEndTurn}
            disabled={!isPlayerTurn}
            className={`ml-auto px-5 py-1.5 rounded-lg border text-[11px] font-bold font-mono transition-all
              ${isPlayerTurn
                ? 'border-[#a1d0c6]/40 text-[#a1d0c6] hover:bg-[#a1d0c6]/10 active:scale-95'
                : 'border-[#a1d0c6]/8 text-[#a1d0c6]/20 cursor-not-allowed'
              }`}
          >
            End Turn →
          </button>
        </div>
      </div>

      {/* ── Game log ─────────────────────────────────────────────── */}
      <div
        ref={logRef}
        className="mt-4 mx-2 rounded-xl border border-[#a1d0c6]/8 bg-[#1c2120]/30 p-3 max-h-32 overflow-y-auto"
        style={{ scrollbarWidth: 'thin' }}
      >
        <span className="text-[8px] uppercase tracking-widest text-[#c0c8c5]/25 font-mono block mb-1">Log</span>
        {state.log.slice(0, 40).map(entry => (
          <div key={entry.id} className={`text-[10px] font-mono leading-relaxed
            ${entry.type === 'combat' ? 'text-red-400/70'
            : entry.type === 'action' ? 'text-[#a1d0c6]/60'
            : entry.type === 'error'  ? 'text-orange-400/70'
            : 'text-[#c0c8c5]/30'
            }`}
          >
            T{entry.turn} {entry.text}
          </div>
        ))}
      </div>
    </div>
  );
}
