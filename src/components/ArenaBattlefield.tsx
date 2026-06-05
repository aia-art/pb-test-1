// ============================================================
// PROMPT BATTLE — ArenaBattlefield · v0.2
// ============================================================

import { useReducer, useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ALL_CARDS, PREBUILT_DECKS } from '../data';
import type { Card } from '../types';
import {
  gameReducer,
} from '../game-engine';
import type { GameState, GameAction, Creation, PlayerId } from '../game-engine';
import { createAI } from '../ai-engine';
import type { Difficulty } from '../ai-engine';
import CreatorAbilityPanel from './CreatorAbilityPanel';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const ALL_CARDS_MAP = new Map(ALL_CARDS.map(c => [c.id, c]));

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function effectiveQ(c: Creation) { return Math.max(0, c.quality - c.glitchTokens); }

const VIS_LABEL = (v: number) =>
  v >= 10 ? 'Featured' : v >= 6 ? 'Liked' : v >= 3 ? 'Noticed' : 'Unnoticed';

const VIS_COLOR = (v: number) =>
  v >= 10 ? 'text-yellow-300' : v >= 6 ? 'text-[#a1d0c6]' : v >= 3 ? 'text-[#c0c8c5]/70' : 'text-[#c0c8c5]/25';

// ─────────────────────────────────────────────────────────────
// Blank initial state (used before START_GAME dispatched)
// ─────────────────────────────────────────────────────────────

function blankPlayer(id: PlayerId): import('../game-engine').PlayerState {
  return {
    id, creator: { cardId: '', loyalty: 10, reputation: 0, isExhausted: false },
    hand: [], deck: [], discard: [],
    credits: 0, creditCap: 10,
    field: [], queue: [], remixQueue: null, modifiers: [],
  };
}

const INITIAL_STATE: GameState = {
  human: blankPlayer('human'),
  ai:    blankPlayer('ai'),
  sharedModels: [], artifactZone: [],
  turn: 1, round: 1,
  activePlayer: 'human',
  phase: 'main',
  winner: null,
  log: [],
  abilityUsedThisTurn: [],
};

// ─────────────────────────────────────────────────────────────
// Creation token
// ─────────────────────────────────────────────────────────────

function CreationToken({
  creation, isOwn, onClick, highlight,
}: {
  creation: Creation; isOwn: boolean;
  onClick?: () => void; highlight?: 'target' | 'glow';
}) {
  const eq = effectiveQ(creation);
  const inQueue = creation.runtimeLeft > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.7, y: isOwn ? 20 : -20 }}
      animate={{ opacity: 1, scale: 1,   y: 0 }}
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
      {creation.styleTag && (
        <span className="text-[8px] uppercase tracking-widest text-[#c0c8c5]/40 font-mono">{creation.styleTag}</span>
      )}
      {inQueue && (
        <span className="text-[9px] font-mono text-[#cebefa]/60">RT {creation.runtimeLeft}</span>
      )}
      <div className="flex items-baseline gap-0.5">
        <span className="text-lg font-black text-[#dfe3e1]">{eq}</span>
        {creation.glitchTokens > 0 && (
          <span className="text-[9px] text-red-400 font-mono">-{creation.glitchTokens}G</span>
        )}
      </div>
      {!inQueue && (
        <div className="w-full">
          <div className={`text-[8px] text-center font-mono ${VIS_COLOR(creation.visibility)}`}>
            {creation.visibility}v · {VIS_LABEL(creation.visibility)}
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
      {creation.clipLocked && (
        <span className="text-[8px] bg-blue-900/50 text-blue-300 px-1 rounded font-mono">🔒</span>
      )}
      <span className="text-[7px] text-[#c0c8c5]/20 font-mono truncate w-full text-center">
        {ALL_CARDS_MAP.get(creation.sourceModelId)?.name ?? '?'}
      </span>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Creator stat bar
// ─────────────────────────────────────────────────────────────

function CreatorBar({
  label, loyalty, maxLoyalty, rep, credits, isActive, isExhausted,
}: {
  label: string; loyalty: number; maxLoyalty: number;
  rep: number; credits: number; isActive: boolean; isExhausted: boolean;
}) {
  const loyPct = Math.max(0, Math.min(100, (loyalty / Math.max(1, maxLoyalty)) * 100));
  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-xl border transition-all
      ${isActive ? 'border-[#a1d0c6]/30 bg-[#a1d0c6]/5' : 'border-[#a1d0c6]/8 opacity-60'}`}
    >
      <span className="text-[10px] uppercase tracking-widest text-[#c0c8c5]/50 font-mono w-8 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-[#0d1211] rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${
            loyPct > 40 ? 'bg-[#a1d0c6]' : loyPct > 15 ? 'bg-yellow-400' : 'bg-red-500'
          }`}
          animate={{ width: `${loyPct}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 30 }}
        />
      </div>
      <span className="text-[11px] font-bold text-[#dfe3e1] font-mono shrink-0">
        ♥{loyalty}<span className="text-[#c0c8c5]/30">/{maxLoyalty}</span>
      </span>
      <span className="text-[10px] text-[#a1d0c6]/60 font-mono shrink-0">{rep}R</span>
      <span className="text-[10px] text-yellow-400/60 font-mono shrink-0">{credits}Cr</span>
      {isExhausted && <span className="text-[8px] text-orange-400/60 font-mono shrink-0">exhaust</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Hand card
// ─────────────────────────────────────────────────────────────

const TYPE_ACCENT: Record<string, string> = {
  model:    'border-[#cebefa]/30 hover:border-[#cebefa]/60 hover:bg-[#cebefa]/8',
  prompt:   'border-[#4a9a6e]/30 hover:border-[#4a9a6e]/60 hover:bg-[#4a9a6e]/8',
  modifier: 'border-[#b8842a]/30 hover:border-[#b8842a]/60 hover:bg-[#b8842a]/8',
  artifact: 'border-[#9b3dbb]/30 hover:border-[#9b3dbb]/60 hover:bg-[#9b3dbb]/8',
  event:    'border-[#3d6abb]/30 hover:border-[#3d6abb]/60 hover:bg-[#3d6abb]/8',
};

function HandCard({ card, selected, playable, onClick }: {
  card: Card; selected: boolean; playable: boolean; onClick: () => void;
}) {
  const cost = card.type === 'model'
    ? `P${card.playCost ?? 0}/A${card.activateCost ?? 0}`
    : card.cost !== undefined ? `${card.cost}${card.costType === 'reputation' ? 'R' : 'Cr'}` : '';

  return (
    <motion.button
      onClick={onClick}
      whileHover={playable ? { y: -8, scale: 1.05 } : {}}
      whileTap={playable   ? { scale: 0.95 } : {}}
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
      <div className={`w-full h-0.5 rounded-full mb-1 ${
        card.type === 'model'    ? 'bg-[#cebefa]/50'
        : card.type === 'prompt'   ? 'bg-[#4a9a6e]/60'
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
// Shared model zone
// ─────────────────────────────────────────────────────────────

function SharedModelZone({ state, onActivate, playerCredits, isPlayerTurn }: {
  state: GameState; onActivate: (modelId: string) => void;
  playerCredits: number; isPlayerTurn: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 items-center">
      <span className="text-[8px] uppercase tracking-widest text-[#c0c8c5]/30 font-mono">— Shared Models —</span>
      <div className="flex gap-2 flex-wrap justify-center min-h-[40px] items-center">
        {state.sharedModels.length === 0 && (
          <span className="text-[10px] text-[#c0c8c5]/20 italic">No models in play yet — play a model card from your hand</span>
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
              title={canActivate ? `Click to activate (${card.activateCost ?? 0}Cr)` : m.activatedThisTurn ? 'Already activated this turn' : 'Cannot activate'}
              className={`px-2.5 py-1.5 rounded-lg border text-left transition-all
                ${m.activatedThisTurn
                  ? 'border-[#cebefa]/8 bg-transparent opacity-25'
                  : canActivate
                    ? 'border-[#cebefa]/40 bg-[#cebefa]/8 hover:bg-[#cebefa]/15 cursor-pointer'
                    : 'border-[#cebefa]/15 bg-transparent opacity-40 cursor-not-allowed'
                }`}
            >
              <div className="text-[8px] text-[#cebefa]/50 font-mono uppercase">model</div>
              <div className="text-[11px] font-semibold text-[#dfe3e1]">{card.name}</div>
              <div className="text-[9px] text-[#c0c8c5]/40 font-mono">Q{card.quality} · A{card.activateCost ?? 0}Cr</div>
              {m.activatedThisTurn && <div className="text-[8px] text-orange-400/60">Used</div>}
              {!m.activatedThisTurn && state.round === 1 && m.placedByPlayer === 'ai' && (
                <div className="text-[8px] text-[#c0c8c5]/30">AI only (R1)</div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Deck picker
// ─────────────────────────────────────────────────────────────

function DeckPicker({ onStart }: {
  onStart: (humanCreatorId: string, humanDeck: Card[], aiCreatorId: string, aiDeck: Card[], diff: Difficulty) => void;
}) {
  const [chosen, setChosen] = useState<number | null>(null);
  const [diff, setDiff]     = useState<Difficulty>('medium');

  function expandDeck(deckDef: typeof PREBUILT_DECKS[0]): Card[] {
    const cards: Card[] = [];
    // Include guaranteed models
    for (const modelId of deckDef.guaranteedModels) {
      const card = ALL_CARDS_MAP.get(modelId);
      if (card) cards.push(card);
    }
    // Include rest of deck cards (excluding creator)
    for (const [cardId, count] of Object.entries(deckDef.cards)) {
      const card = ALL_CARDS_MAP.get(cardId);
      if (card && card.type !== 'creator') {
        for (let i = 0; i < count; i++) cards.push(card);
      }
    }
    return cards;
  }

  function handleStart() {
    if (chosen === null) return;
    const humanDeckDef = PREBUILT_DECKS[chosen];
    const aiDeckDef    = PREBUILT_DECKS[chosen === 0 ? 1 : 0];

    onStart(
      humanDeckDef.creator,
      expandDeck(humanDeckDef),
      aiDeckDef.creator,
      expandDeck(aiDeckDef),
      diff
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center gap-8 py-12 animate-fade-in">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-[#dfe3e1] mb-1">Choose Your Deck</h1>
        <p className="text-[#c0c8c5]/40 text-sm">Pick a prebuilt deck to duel the AI opponent</p>
      </div>

      <div className="flex gap-4 flex-wrap justify-center">
        {PREBUILT_DECKS.map((deck, i) => {
          const creator = ALL_CARDS_MAP.get(deck.creator);
          return (
            <motion.button
              key={deck.id}
              onClick={() => setChosen(i)}
              whileHover={{ scale: 1.03, y: -4 }}
              whileTap={{ scale: 0.97 }}
              className={`w-64 text-left rounded-2xl border p-5 transition-all
                ${chosen === i
                  ? 'border-[#a1d0c6]/60 bg-[#a1d0c6]/8 shadow-[0_0_24px_rgba(161,208,198,0.2)]'
                  : 'border-[#a1d0c6]/12 bg-[#1c2120]/50 hover:border-[#a1d0c6]/30'
                }`}
            >
              <span className="text-[9px] uppercase tracking-widest text-[#a1d0c6]/50 font-mono">Deck {i + 1}</span>
              <h3 className="text-base font-bold text-[#dfe3e1] mt-0.5 leading-tight">{deck.name}</h3>
              <p className="text-[11px] text-[#c0c8c5]/50 mt-2 mb-3 leading-relaxed">{deck.description}</p>
              {creator && (
                <div className="flex items-center gap-2 pt-2 border-t border-[#a1d0c6]/8">
                  <span className="text-[9px] text-[#c0c8c5]/35 font-mono">Creator:</span>
                  <span className="text-[11px] font-semibold text-[#a1d0c6]">{creator.name}</span>
                  <span className="text-[9px] text-[#c0c8c5]/30 ml-auto font-mono">♥{creator.loyalty}</span>
                </div>
              )}
              <div className="flex gap-1 mt-2 flex-wrap">
                {deck.archetypes.map(a => (
                  <span key={a} className="text-[8px] px-1.5 py-0.5 rounded bg-[#a1d0c6]/8 text-[#a1d0c6]/60 font-mono">{a}</span>
                ))}
              </div>
              <span className={`text-[9px] font-mono mt-2 inline-block ${
                deck.difficulty === 'Beginner' ? 'text-[#4a9a6e]'
                : deck.difficulty === 'Intermediate' ? 'text-yellow-400'
                : 'text-red-400'
              }`}>{deck.difficulty}</span>
            </motion.button>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest text-[#c0c8c5]/40 font-mono">AI Difficulty</span>
        <div className="flex gap-2">
          {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
            <button key={d} onClick={() => setDiff(d)}
              className={`px-3 py-1 rounded-lg text-[11px] font-mono border transition-all
                ${diff === d
                  ? 'border-[#a1d0c6]/50 bg-[#a1d0c6]/12 text-[#a1d0c6]'
                  : 'border-[#a1d0c6]/10 text-[#c0c8c5]/30 hover:border-[#a1d0c6]/25'
                }`}
            >{d}</button>
          ))}
        </div>
      </div>

      <motion.button
        onClick={handleStart}
        disabled={chosen === null}
        whileHover={chosen !== null ? { scale: 1.04, y: -2 } : {}}
        whileTap={chosen !== null   ? { scale: 0.97 } : {}}
        className={`px-8 py-3 rounded-xl font-bold text-sm transition-all
          ${chosen !== null
            ? 'bg-[#a1d0c6] text-[#0d1211] shadow-[0_0_20px_rgba(161,208,198,0.35)] hover:bg-[#b5dbd4]'
            : 'bg-[#a1d0c6]/10 text-[#a1d0c6]/30 cursor-not-allowed'
          }`}
      >
        {chosen !== null ? `Play as ${PREBUILT_DECKS[chosen]?.name.split('—')[0].trim()}` : 'Select a deck first'}
      </motion.button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Game over
// ─────────────────────────────────────────────────────────────

function GameOver({ winner, onRematch }: { winner: PlayerId | 'draw' | null; onRematch: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 bg-[#0d1211]/92 flex items-center justify-center z-50 backdrop-blur-sm"
    >
      <div className="text-center space-y-4">
        <motion.h1
          initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}
          className={`text-5xl font-black ${
            winner === 'human' ? 'text-[#a1d0c6]' : winner === 'ai' ? 'text-red-400' : 'text-[#cebefa]'
          }`}
        >
          {winner === 'human' ? '✦ You Win!' : winner === 'ai' ? 'AI Wins' : 'Draw'}
        </motion.h1>
        <p className="text-[#c0c8c5]/50 text-sm">
          {winner === 'human' ? 'The AI couldn\'t keep up.' : winner === 'ai' ? 'The heuristic outplayed you.' : 'Simultaneous elimination.'}
        </p>
        <button onClick={onRematch}
          className="mt-4 px-6 py-2.5 rounded-xl bg-[#a1d0c6] text-[#0d1211] font-bold text-sm hover:bg-[#b5dbd4] transition-colors"
        >
          Play Again
        </button>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

type UIMode = 'idle' | 'select_target_ability' | 'await_model_for_prompts';

export default function ArenaBattlefield() {
  const [gameStarted, setGameStarted] = useState(false);
  const [state, dispatch]  = useReducer(
    (s: GameState, a: GameAction) => gameReducer(s, a, ALL_CARDS_MAP),
    INITIAL_STATE
  );
  const [difficulty, setDifficulty]   = useState<Difficulty>('medium');
  const [uiMode, setUiMode]           = useState<UIMode>('idle');
  const [pendingAbility, setPendingAbility] = useState<number | 'signature' | null>(null);
  const [selectedPromptIds, setSelectedPromptIds] = useState<string[]>([]);
  const [pendingModelId, setPendingModelId]       = useState<string | null>(null);
  const [aiThinking, setAiThinking]   = useState(false);
  const [message, setMessage]         = useState('');
  const logRef  = useRef<HTMLDivElement>(null);
  const aiRunning = useRef(false);

  // ── Flash helper ─────────────────────────────────────────────
  function flash(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(m => m === msg ? '' : m), 2400);
  }

  // ── Start game ───────────────────────────────────────────────
  function startGame(humanCreatorId: string, humanDeck: Card[], aiCreatorId: string, aiDeck: Card[], diff: Difficulty) {
    setDifficulty(diff);
    setGameStarted(true);
    setUiMode('idle');
    setSelectedPromptIds([]);
    setPendingModelId(null);
    setPendingAbility(null);
    aiRunning.current = false;
    const firstPlayer: PlayerId = Math.random() < 0.5 ? 'human' : 'ai';
    dispatch({ type: 'START_GAME', humanCreatorId, humanDeck, aiCreatorId, aiDeck, firstPlayer });
  }

  // ── AI turn ──────────────────────────────────────────────────
  useEffect(() => {
    if (!gameStarted) return;
    if (state.phase === 'game_over') return;
    if (state.activePlayer !== 'ai') return;
    if (aiRunning.current) return;

    aiRunning.current = true;
    setAiThinking(true);
    const ai = createAI(difficulty);

    // Capture state snapshot for this turn
    const snap = state;

    (async () => {
      try {
        await sleep(700);
        const plan = ai.planFullTurn(snap, ALL_CARDS);

        for (const action of plan) {
          await sleep(600 + Math.random() * 400);

          // Map AI engine action → GameAction (add player field)
          let gameAction: GameAction | null = null;
          switch (action.type) {
            case 'PLAY_MODEL':
              if (action.cardId) gameAction = { type: 'PLAY_MODEL', player: 'ai', cardId: action.cardId };
              break;
            case 'ACTIVATE_MODEL':
              if (action.cardId) gameAction = { type: 'ACTIVATE_MODEL', player: 'ai', modelId: action.cardId, promptIds: action.promptIds ?? [] };
              break;
            case 'USE_CREATOR_ABILITY':
              if (action.abilityNum !== undefined) gameAction = { type: 'USE_CREATOR_ABILITY', player: 'ai', abilityNum: action.abilityNum };
              break;
            case 'PLAY_MODIFIER':
              if (action.cardId) gameAction = { type: 'PLAY_MODIFIER', player: 'ai', cardId: action.cardId, targetId: action.targetId ?? 'creator' };
              break;
            case 'PLAY_ARTIFACT':
              if (action.cardId) gameAction = { type: 'PLAY_ARTIFACT', player: 'ai', cardId: action.cardId };
              break;
            case 'PLAY_EVENT':
              if (action.cardId) gameAction = { type: 'PLAY_EVENT', player: 'ai', cardId: action.cardId };
              break;
            case 'END_TURN':
              gameAction = { type: 'END_TURN', player: 'ai' };
              break;
          }
          if (gameAction) dispatch(gameAction);
          if (action.type === 'END_TURN') break;
        }

        // Safety: always end turn
        await sleep(300);
        dispatch({ type: 'END_TURN', player: 'ai' });
      } finally {
        aiRunning.current = false;
        setAiThinking(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStarted, state.activePlayer, state.turn, state.phase]);

  // ── Log scroll ───────────────────────────────────────────────
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = 0;
  }, [state.log.length]);

  // ── Not started yet ──────────────────────────────────────────
  if (!gameStarted) {
    return <DeckPicker onStart={startGame} />;
  }

  // ─────────────────────────────────────────────────────────────
  const isPlayerTurn = state.activePlayer === 'human' && state.phase === 'main';
  const humanCreatorCard = ALL_CARDS_MAP.get(state.human.creator.cardId);
  const aiCreatorCard    = ALL_CARDS_MAP.get(state.ai.creator.cardId);

  // ── Interaction handlers ─────────────────────────────────────

  function handleHandCardClick(card: Card) {
    if (!isPlayerTurn) { flash("It's not your turn"); return; }
    const p = state.human;

    if (card.type === 'model') {
      if (p.credits < (card.playCost ?? 0)) { flash(`Need ${card.playCost}Cr — you have ${p.credits}Cr`); return; }
      dispatch({ type: 'PLAY_MODEL', player: 'human', cardId: card.id });
      flash(`${card.name} placed in shared zone`);
      return;
    }

    if (card.type === 'prompt') {
      // Toggle prompt selection, then wait for model click
      setSelectedPromptIds(prev =>
        prev.includes(card.id) ? prev.filter(x => x !== card.id) : [...prev.slice(-1), card.id]
      );
      setUiMode('await_model_for_prompts');
      flash('Prompt selected — now click a model in the shared zone to activate it');
      return;
    }

    if (card.type === 'modifier') {
      if (p.credits < (card.cost ?? 0)) { flash(`Need ${card.cost}Cr`); return; }
      dispatch({ type: 'PLAY_MODIFIER', player: 'human', cardId: card.id, targetId: 'creator' });
      flash(`${card.name} attached to creator`);
      return;
    }

    if (card.type === 'artifact') {
      if (p.credits < (card.cost ?? 0)) { flash(`Need ${card.cost}Cr`); return; }
      dispatch({ type: 'PLAY_ARTIFACT', player: 'human', cardId: card.id });
      flash(`${card.name} placed in artifact zone`);
      return;
    }

    if (card.type === 'event') {
      if (state.round < 2) { flash('No events in Round 1'); return; }
      if (p.credits < (card.cost ?? 0)) { flash(`Need ${card.cost}Cr`); return; }
      dispatch({ type: 'PLAY_EVENT', player: 'human', cardId: card.id });
      flash(`${card.name} resolved`);
      return;
    }
  }

  function handleModelClick(modelId: string) {
    if (!isPlayerTurn) return;
    // Use selected prompts (if any)
    const promptIds = selectedPromptIds.filter(id => state.human.hand.some(c => c.id === id));
    dispatch({ type: 'ACTIVATE_MODEL', player: 'human', modelId, promptIds });
    setSelectedPromptIds([]);
    setPendingModelId(null);
    setUiMode('idle');
    flash('Model activated — creation queued!');
  }

  function handleAbilitySelect(abilityNum: number | 'signature') {
    if (!isPlayerTurn) return;
    if (!humanCreatorCard) return;
    // Abilities that need a target
    if (abilityNum === 1 && humanCreatorCard.id === 'C-001') {
      setPendingAbility(abilityNum);
      setUiMode('select_target_ability');
      flash('Select an opponent creation to Overrender');
      return;
    }
    if (abilityNum === 2 && humanCreatorCard.id === 'C-001') {
      // Need to select own CLIP-LOCKed creation
      const locked = state.human.field.filter(c => c.clipLocked);
      if (locked.length === 0) { flash('No CLIP-LOCKed creations'); return; }
      // Auto-select first if only one
      dispatch({ type: 'USE_CREATOR_ABILITY', player: 'human', abilityNum, targetId: locked[0].instanceId });
      flash('Positive Feedback resolved!');
      return;
    }
    if (abilityNum === 3 && humanCreatorCard.id === 'C-001') {
      // Target own creation for Iridescent Shift
      const field = state.human.field;
      if (field.length === 0) { flash('No creations on field'); return; }
      dispatch({ type: 'USE_CREATOR_ABILITY', player: 'human', abilityNum, targetId: field[0].instanceId });
      flash('Iridescent Shift applied!');
      return;
    }
    dispatch({ type: 'USE_CREATOR_ABILITY', player: 'human', abilityNum });
    flash('Ability used!');
  }

  function handleCreationClick(creation: Creation, owner: PlayerId) {
    if (uiMode === 'select_target_ability' && owner === 'ai') {
      dispatch({ type: 'USE_CREATOR_ABILITY', player: 'human', abilityNum: pendingAbility!, targetId: creation.instanceId });
      setUiMode('idle');
      setPendingAbility(null);
      flash('Ability resolved!');
      return;
    }
    // Clicking own Coherent creation → apply CLIP-LOCK (Aia only)
    if (owner === 'human' && isPlayerTurn && humanCreatorCard?.id === 'C-001') {
      if (!creation.clipLocked && creation.sourceModelId === 'M-001') {
        dispatch({ type: 'APPLY_CLIP_LOCK', player: 'human', creationId: creation.instanceId });
        flash('CLIP-LOCK applied');
      }
    }
  }

  function handleEndTurn() {
    if (!isPlayerTurn) { flash("Wait for your turn"); return; }
    setSelectedPromptIds([]);
    setPendingModelId(null);
    setUiMode('idle');
    dispatch({ type: 'END_TURN', player: 'human' });
  }

  function handleCancelMode() {
    setUiMode('idle');
    setPendingAbility(null);
    setSelectedPromptIds([]);
    setPendingModelId(null);
  }

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col gap-0 py-4 relative">

      <AnimatePresence>
        {state.phase === 'game_over' && (
          <GameOver winner={state.winner} onRematch={() => { setGameStarted(false); }} />
        )}
      </AnimatePresence>

      {/* Flash */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-40 bg-[#1c2120] border border-[#a1d0c6]/30 text-[#dfe3e1] text-[12px] px-4 py-2 rounded-full shadow-lg font-mono pointer-events-none"
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Turn header */}
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
          {state.activePlayer === 'human' ? '▶ Your Turn' : aiThinking ? '⏳ AI is thinking…' : '● AI Turn'}
        </span>
        <span className="text-[10px] font-mono text-[#c0c8c5]/40">
          {state.human.deck.length} cards left
        </span>
      </div>

      {/* ── AI zone ── */}
      <div className="flex flex-col gap-2 px-2 pb-3 border-b border-[#a1d0c6]/8">
        {aiCreatorCard && (
          <CreatorBar
            label="AI" loyalty={state.ai.creator.loyalty} maxLoyalty={aiCreatorCard.loyalty ?? 10}
            rep={state.ai.creator.reputation} credits={state.ai.credits}
            isActive={state.activePlayer === 'ai'} isExhausted={state.ai.creator.isExhausted}
          />
        )}
        <div className="flex items-start gap-3">
          <div className="w-16 shrink-0 rounded-lg border border-[#cebefa]/12 bg-[#1c2120]/50 p-1.5 text-center">
            <div className="text-[8px] text-[#c0c8c5]/25 uppercase font-mono">AI</div>
            <div className="text-[10px] font-bold text-[#dfe3e1] leading-tight">{aiCreatorCard?.name ?? '—'}</div>
            <div className="text-[9px] text-[#cebefa] mt-0.5">♥{state.ai.creator.loyalty}</div>
            <div className="text-[8px] text-[#c0c8c5]/25 font-mono mt-0.5">{state.ai.hand.length} cards</div>
          </div>
          <div className="flex gap-2 flex-wrap min-h-[80px] items-center flex-1">
            <AnimatePresence>
              {[...state.ai.field, ...state.ai.queue].map(c => (
                <CreationToken key={c.instanceId} creation={c} isOwn={false}
                  highlight={uiMode === 'select_target_ability' && c.runtimeLeft === 0 ? 'target' : undefined}
                  onClick={() => handleCreationClick(c, 'ai')}
                />
              ))}
            </AnimatePresence>
            {state.ai.field.length === 0 && state.ai.queue.length === 0 && (
              <span className="text-[10px] text-[#c0c8c5]/15 italic">No AI creations</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Shared zone ── */}
      <div className="py-3 px-2 border-b border-[#a1d0c6]/8">
        <SharedModelZone
          state={state}
          onActivate={handleModelClick}
          playerCredits={state.human.credits}
          isPlayerTurn={isPlayerTurn || uiMode === 'await_model_for_prompts'}
        />
        {state.artifactZone.length > 0 && (
          <div className="mt-2 flex gap-1 justify-center flex-wrap">
            {state.artifactZone.map((id, i) => {
              const card = ALL_CARDS_MAP.get(id);
              return card ? (
                <span key={i} className="text-[9px] px-2 py-0.5 rounded bg-[#9b3dbb]/15 text-[#9b3dbb]/70 border border-[#9b3dbb]/20 font-mono">
                  {card.name}
                </span>
              ) : null;
            })}
          </div>
        )}
      </div>

      {/* ── Player zone ── */}
      <div className="flex flex-col gap-2 px-2 pt-3">
        <div className="flex items-start gap-3">
          {humanCreatorCard && (
            <CreatorAbilityPanel
              card={humanCreatorCard}
              currentReputation={state.human.creator.reputation}
              currentLoyalty={state.human.creator.loyalty}
              isExhausted={state.human.creator.isExhausted || state.abilityUsedThisTurn.includes('human')}
              isMyTurn={isPlayerTurn}
              onSelectAbility={handleAbilitySelect}
              className="shrink-0"
            />
          )}
          <div className="flex gap-2 flex-wrap min-h-[80px] items-center flex-1">
            <AnimatePresence>
              {[...state.human.field, ...state.human.queue].map(c => (
                <CreationToken key={c.instanceId} creation={c} isOwn={true}
                  highlight={c.clipLocked ? 'glow' : undefined}
                  onClick={() => handleCreationClick(c, 'human')}
                />
              ))}
            </AnimatePresence>
            {state.human.field.length === 0 && state.human.queue.length === 0 && (
              <span className="text-[10px] text-[#c0c8c5]/15 italic">No creations — play a model card!</span>
            )}
          </div>
        </div>

        {humanCreatorCard && (
          <CreatorBar
            label="You" loyalty={state.human.creator.loyalty} maxLoyalty={humanCreatorCard.loyalty ?? 10}
            rep={state.human.creator.reputation} credits={state.human.credits}
            isActive={isPlayerTurn} isExhausted={state.human.creator.isExhausted}
          />
        )}

        {/* Hand */}
        <div className="flex flex-col gap-1 pt-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[9px] uppercase tracking-widest text-[#c0c8c5]/30 font-mono">
              Hand ({state.human.hand.length})
            </span>
            {uiMode === 'await_model_for_prompts' && (
              <span className="text-[9px] text-yellow-400/80 font-mono">
                {selectedPromptIds.length} prompt(s) selected — click a model above to activate
              </span>
            )}
            {uiMode === 'select_target_ability' && (
              <span className="text-[9px] text-red-400/80 font-mono animate-pulse">
                Click an opponent creation to target it
              </span>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: 'thin' }}>
            {state.human.hand.map((card, idx) => {
              const isSelected = selectedPromptIds.includes(card.id);
              const p = state.human;
              let playable = isPlayerTurn;
              if (card.type === 'model')    playable = isPlayerTurn && p.credits >= (card.playCost ?? 0);
              if (card.type === 'prompt')   playable = isPlayerTurn && state.sharedModels.some(m => !m.activatedThisTurn);
              if (card.type === 'modifier') playable = isPlayerTurn && p.credits >= (card.cost ?? 0);
              if (card.type === 'artifact') playable = isPlayerTurn && p.credits >= (card.cost ?? 0);
              if (card.type === 'event')    playable = isPlayerTurn && state.round >= 2 && p.credits >= (card.cost ?? 0);

              return (
                <HandCard
                  key={`${card.id}-${idx}`}
                  card={card}
                  selected={isSelected}
                  playable={playable}
                  onClick={() => handleHandCardClick(card)}
                />
              );
            })}
            {state.human.hand.length === 0 && (
              <span className="text-[10px] text-[#c0c8c5]/20 italic py-4">No cards in hand</span>
            )}
          </div>
        </div>

        {/* Action bar */}
        <div className="flex gap-2 flex-wrap items-center pt-1 border-t border-[#a1d0c6]/8">
          {uiMode !== 'idle' && (
            <button onClick={handleCancelMode}
              className="px-3 py-1.5 rounded-lg border border-red-500/25 text-red-400/70 text-[11px] font-mono hover:bg-red-950/20 transition-colors"
            >
              ✕ Cancel
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

      {/* Log */}
      <div ref={logRef}
        className="mt-4 mx-2 rounded-xl border border-[#a1d0c6]/8 bg-[#1c2120]/30 p-3 max-h-32 overflow-y-auto"
        style={{ scrollbarWidth: 'thin' }}
      >
        <span className="text-[8px] uppercase tracking-widest text-[#c0c8c5]/25 font-mono block mb-1">Game Log</span>
        {state.log.slice(0, 60).map(entry => (
          <div key={entry.id} className={`text-[10px] font-mono leading-relaxed
            ${entry.type === 'combat' ? 'text-red-400/70'
            : entry.type === 'action' ? 'text-[#a1d0c6]/60'
            : entry.type === 'error'  ? 'text-orange-400/80'
            : 'text-[#c0c8c5]/30'}`}
          >
            T{entry.turn} {entry.text}
          </div>
        ))}
        {state.log.length === 0 && (
          <span className="text-[9px] text-[#c0c8c5]/20 italic">Game starting…</span>
        )}
      </div>
    </div>
  );
}
