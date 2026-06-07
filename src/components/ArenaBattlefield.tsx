// ============================================================
// PROMPT BATTLE — Arena Battlefield (vs AI)
// Full game UI + heuristic AI opponent
// ============================================================
import { useState, useEffect, useRef } from 'react';
import { getCardById } from '../data';
import type { GameState, CreationState, ModelState, PlayerId, StyleTag } from '../game/gameTypes';
import {
  initGame, applyMulligan, runRefreshPhase, runEndPhase, resolveSlotOverflow,
  playModel, activateModel, playModifier, playArtifact, playEvent,
  useCreatorAbility, applyClipLock, remixCreation, removeArtifact,
  effectiveQuality, effectiveStyle, canUseAbility, creatorGlowColor,
  getAllDecks, loadDeckStore, addLog,
} from '../game/gameEngine';
import { aiDecideMulligan, runAiTurn } from '../game/aiEngine';

// ─── Storage for deck meta ───────────────────────────────────────
const META_KEY = 'pb_play_meta';
function loadMeta(): { lastDeck?: string; favouriteDeck?: string } {
  try { return JSON.parse(localStorage.getItem(META_KEY) ?? '{}'); } catch { return {}; }
}
function saveMeta(m: object) { localStorage.setItem(META_KEY, JSON.stringify(m)); }

// ─── Pending action type ─────────────────────────────────────────
type PendingAction =
  | { kind: 'activate'; modelInstanceId: string; prompts: string[]; useFav: boolean }
  | { kind: 'play-modifier'; cardId: string }
  | { kind: 'play-artifact'; cardId: string }
  | { kind: 'play-event'; cardId: string }
  | { kind: 'ability'; abilityNum: number | 'signature'; targets: string[] }
  | { kind: 'clip-lock' }
  | { kind: 'remix' }
  | { kind: 'discard'; count: number; selected: string[] };

const STYLE_CLR: Record<string, string> = {
  Fantasy:'text-purple-400', Landscape:'text-green-400',
  Portrait:'text-pink-400', Abstract:'text-orange-400', Atmosphere:'text-blue-400',
};

// ─── Loyalty bar ─────────────────────────────────────────────────
function LoyaltyBar({val,max,label}:{val:number;max:number;label:string}) {
  const pct = Math.max(0, Math.min(100, (val/max)*100));
  const clr = pct>50?'bg-[#a1d0c6]':pct>25?'bg-amber-400':'bg-red-500';
  return (
    <div className="flex items-center gap-2 w-full">
      <span className="text-[9px] text-[#c0c8c5]/50 w-12 shrink-0">{label}</span>
      <div className="flex-1 bg-[#0d1211] rounded-full h-2 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${clr}`} style={{width:`${pct}%`}} />
      </div>
      <span className="text-xs font-bold text-[#dfe3e1] w-8 text-right">{val}</span>
    </div>
  );
}

// ─── Tiny vis bar ────────────────────────────────────────────────
function VisBar({vis}:{vis:number}) {
  const pct = Math.min(100,(vis/12)*100);
  const clr = vis>=10?'bg-amber-400':vis>=6?'bg-cyan-400':vis>=3?'bg-teal-500':'bg-[#a1d0c6]/20';
  return (
    <div className="w-full bg-[#0d1211] rounded-full h-1 overflow-hidden">
      <div className={`h-full rounded-full ${clr}`} style={{width:`${pct}%`}} />
    </div>
  );
}

// ─── Creation card ───────────────────────────────────────────────
function CreationCard({c,onClick,ring,opp}:{c:CreationState;onClick?:()=>void;ring?:boolean;opp?:boolean}) {
  const eq = effectiveQuality(c);
  const vis = c.visibilityCounters;
  const label = vis>=10?'Featured':vis>=6?'Liked':vis>=3?'Noticed':'—';
  return (
    <div
      onClick={onClick}
      className={`flex flex-col gap-1 p-2 rounded-xl border cursor-pointer transition-all select-none
        ${ring?'border-amber-400 bg-amber-400/10 shadow-lg':'border-[#a1d0c6]/20 bg-[#1c2120]/60 hover:border-[#a1d0c6]/40'}
        ${eq<=0?'border-red-500/60 opacity-60':''}
        ${c.clipLocked?'ring-1 ring-cyan-400/50':''}
      `}
      style={{minWidth:88,maxWidth:108}}
    >
      <div className="flex gap-0.5 flex-wrap">
        {c.clipLocked && <span className="text-[7px] bg-cyan-400/20 text-cyan-400 px-0.5 rounded">CLK</span>}
        {!c.isOnField && <span className="text-[7px] bg-[#cebefa]/20 text-[#cebefa] px-0.5 rounded">Q{c.runtime}</span>}
        {c.isInRemixQueue && <span className="text-[7px] bg-orange-400/20 text-orange-400 px-0.5 rounded">RMX</span>}
        {c.immuneToOpponentUntilAbsTurn>0 && <span className="text-[7px] bg-green-400/20 text-green-400 px-0.5 rounded">IMM</span>}
        {c.featuredTurnsRemaining>0 && <span className="text-[7px] bg-amber-400/20 text-amber-400 px-0.5 rounded">★FT</span>}
      </div>
      <div className="flex items-center gap-1">
        <span className={`text-sm font-bold ${eq<=0?'text-red-400':eq<=1?'text-amber-400':'text-[#a1d0c6]'}`}>Q{eq}</span>
        {c.glitchTokens>0 && <span className="text-[9px] text-red-400">⚡{c.glitchTokens}</span>}
      </div>
      {c.styleTag && <span className={`text-[8px] font-bold ${STYLE_CLR[c.styleTag]||''}`}>{c.styleTag}</span>}
      <VisBar vis={vis}/>
      <div className="flex justify-between">
        <span className="text-[7px] text-[#c0c8c5]/40">{label}</span>
        <span className="text-[7px] text-[#a1d0c6]/50">{vis}✦</span>
      </div>
      <span className="text-[7px] text-[#c0c8c5]/30 truncate">{getCardById(c.modelId)?.name}</span>
    </div>
  );
}

// ─── Shared model card ───────────────────────────────────────────
function ModelCard({m,onClick,ring}:{m:ModelState;onClick?:()=>void;ring?:boolean}) {
  const card = getCardById(m.cardId);
  if (!card) return null;
  const used = m.activatedThisTurnBy!==null;
  return (
    <div
      onClick={onClick}
      className={`flex flex-col gap-1 p-2 rounded-xl border cursor-pointer transition-all select-none
        ${ring?'border-amber-400 bg-amber-400/10':'border-[#cebefa]/20 bg-[#1c2120]/60 hover:border-[#cebefa]/50'}
        ${used?'opacity-40':''}
      `}
      style={{minWidth:88,maxWidth:108}}
    >
      <span className="text-[9px] font-bold text-[#cebefa] leading-tight">{card.name}</span>
      <div className="flex gap-1 flex-wrap">
        <span className="text-[7px] bg-[#cebefa]/10 text-[#cebefa]/70 px-1 rounded">Q{card.quality}</span>
        <span className="text-[7px] bg-[#a1d0c6]/10 text-[#a1d0c6]/70 px-1 rounded">⚡{card.activateCost}¢</span>
        <span className="text-[7px] text-[#c0c8c5]/40">⧗{card.runtime}</span>
      </div>
      {m.loraCardId && <span className="text-[7px] text-amber-400">{getCardById(m.loraCardId)?.name}</span>}
      {m.noiseTurnsRemaining>0 && <span className="text-[7px] text-red-400">NOISE({m.noiseTurnsRemaining})</span>}
      {m.queueSkipReady && <span className="text-[7px] text-green-400">SKIP✓</span>}
      <span className="text-[7px] text-[#c0c8c5]/30">by {m.ownerId}</span>
      {used && <span className="text-[7px] text-[#c0c8c5]/30">activated</span>}
    </div>
  );
}

// ─── Hand card ───────────────────────────────────────────────────
function HandCard({id,onClick,sel,dim}:{id:string;onClick?:()=>void;sel?:boolean;dim?:boolean}) {
  const card = getCardById(id);
  if (!card) return null;
  const border: Record<string,string> = {
    model:'border-[#cebefa]/40 hover:border-[#cebefa]/80',
    prompt:'border-green-500/40 hover:border-green-500/80',
    modifier:'border-amber-500/40 hover:border-amber-500/80',
    artifact:'border-purple-500/40 hover:border-purple-500/80',
    event:'border-blue-500/40 hover:border-blue-500/80',
  };
  return (
    <div
      onClick={onClick}
      title={`${card.name} — ${card.effect||card.type}`}
      className={`relative flex flex-col gap-1 p-2 rounded-xl border cursor-pointer transition-all select-none
        ${sel?'border-amber-400 bg-amber-400/10 scale-105 shadow-lg':border[card.type]||'border-[#a1d0c6]/20'}
        ${dim?'opacity-30 pointer-events-none':''}
        bg-[#1c2120]/60
      `}
      style={{minWidth:68,maxWidth:82,minHeight:88}}
    >
      <span className="text-[7px] uppercase tracking-wider text-[#c0c8c5]/40 font-bold">{card.type}</span>
      <span className="text-[9px] font-bold text-[#dfe3e1] leading-tight line-clamp-2">{card.name}</span>
      <span className="text-[7px] text-[#a1d0c6]/60">{card.cost??0}{card.costType==='reputation'?'★':'¢'}</span>
      {card.type==='model' && <span className="text-[7px] text-[#cebefa]/50">Q{card.quality} ⧗{card.runtime}</span>}
      {card.promptType && <span className="text-[7px] text-green-400/70">{card.promptType}</span>}
    </div>
  );
}

// ─── Creator abilities panel ─────────────────────────────────────
function AbilitiesPanel({
  creatorId, playerState, isMyTurn,
  onAbility, onClose,
}: {
  creatorId: string;
  playerState: GameState['players']['player'];
  isMyTurn: boolean;
  onAbility: (num: number|'signature') => void;
  onClose: () => void;
}) {
  const card = getCardById(creatorId);
  if (!card) return null;
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#1c2120] border border-[#a1d0c6]/20 rounded-2xl p-5 max-w-md w-full mx-4 shadow-2xl flex flex-col gap-3"
        onClick={e=>e.stopPropagation()}
        style={{animation:'fadeIn .2s ease'}}
      >
        <div className="flex justify-between items-center">
          <h2 className="font-bold text-[#dfe3e1] text-lg">{card.name}</h2>
          <button onClick={onClose} className="text-[#c0c8c5]/40 hover:text-[#dfe3e1] text-xl leading-none">✕</button>
        </div>
        <div className="flex gap-3 text-xs text-[#c0c8c5]/60">
          <span>★ {playerState.reputation}/20</span>
          <span>❤ {playerState.loyalty}</span>
          {playerState.creatorExhaustedThisTurn && <span className="text-red-400">EXHAUSTED this turn</span>}
          {playerState.mods.ban && <span className="text-red-400">BANNED</span>}
        </div>

        {card.passive && (
          <div className="p-3 bg-[#0d1211]/60 rounded-xl border border-[#a1d0c6]/10">
            <p className="text-[9px] uppercase font-bold text-[#a1d0c6]/50 mb-1">◈ PASSIVE: {card.passive.name}</p>
            <p className="text-xs text-[#c0c8c5]/70 leading-relaxed">{card.passive.text}</p>
          </div>
        )}
        {card.influence && (
          <div className="p-3 bg-[#0d1211]/60 rounded-xl border border-[#a1d0c6]/10">
            <p className="text-[9px] uppercase font-bold text-[#a1d0c6]/50 mb-1">◈ INFLUENCE: {card.influence.name}</p>
            <p className="text-xs text-[#c0c8c5]/70 leading-relaxed">{card.influence.text}</p>
          </div>
        )}
        {card.favouritePrompt && (
          <div className="p-3 bg-[#0d1211]/60 rounded-xl border border-green-500/20">
            <p className="text-[9px] uppercase font-bold text-green-400/50 mb-1">✦ FAV PROMPT ({card.favouritePrompt.subtype})</p>
            <p className="text-xs italic text-[#c0c8c5]/60">{card.favouritePrompt.text}</p>
            <p className="text-[9px] text-green-400/70 mt-1">{card.favouritePrompt.effect}</p>
          </div>
        )}

        {(card.abilities??[]).map(ab => {
          const nums = ['','①','②','③'];
          const label = ab.num==='signature'?'⚡ SIGNATURE':`${nums[Number(ab.num)]??ab.num} ${ab.name}`;
          const costStr = [
            ab.cost.reputation ? `${ab.cost.reputation} Rep` : '',
            ab.cost.loyalty ? `${ab.cost.loyalty} Loyalty` : '',
            ab.cost.credits ? `${ab.cost.credits} Credits` : '',
          ].filter(Boolean).join(' + ') || 'Free';
          return (
            <button
              key={String(ab.num)}
              onClick={() => { if(isMyTurn) onAbility(ab.num); }}
              disabled={!isMyTurn}
              className={`p-3 rounded-xl border text-left transition-all
                ${ab.num==='signature'?'border-red-500/40 hover:bg-red-500/10':'border-[#a1d0c6]/20 hover:bg-[#a1d0c6]/5'}
                ${!isMyTurn?'opacity-50 cursor-not-allowed':'cursor-pointer'}
              `}
            >
              <div className="flex justify-between mb-1">
                <span className="text-xs font-bold text-[#dfe3e1]">{label}</span>
                <span className="text-[9px] text-amber-400">{costStr}</span>
              </div>
              <p className="text-[9px] text-[#c0c8c5]/60 leading-relaxed">{ab.text}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Card inspector ──────────────────────────────────────────────
function Inspector({id,onClose}:{id:string;onClose:()=>void}) {
  const card = getCardById(id);
  if(!card) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-[#1c2120] border border-[#a1d0c6]/20 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between mb-3">
          <div>
            <p className="text-[9px] uppercase tracking-widest text-[#a1d0c6]/50">{card.type}{card.subtype?` · ${card.subtype}`:''}</p>
            <h3 className="text-base font-bold text-[#dfe3e1]">{card.name}</h3>
          </div>
          <button onClick={onClose} className="text-[#c0c8c5]/40 hover:text-[#dfe3e1] text-xl">✕</button>
        </div>
        {card.keyword && <p className="text-xs italic text-[#a1d0c6]/60 mb-2">"{card.keyword}"</p>}
        {card.effect && <p className="text-sm text-[#c0c8c5]/80 mb-3 leading-relaxed">{card.effect}</p>}
        {card.type==='model' && (
          <div className="flex gap-3 text-xs text-[#c0c8c5]/60 mb-2">
            <span>Play {card.playCost}¢</span><span>Activate {card.activateCost}¢</span>
            <span>Q{card.quality}</span><span>⧗{card.runtime}</span>
          </div>
        )}
        {card.compatible && (
          <div className="flex gap-1 flex-wrap mt-2">
            {card.compatible.map(t=><span key={t} className="text-[8px] bg-green-400/10 text-green-400 px-1.5 py-0.5 rounded">✔ {t}</span>)}
            {(card.incompatible??[]).map(t=><span key={t} className="text-[8px] bg-red-400/10 text-red-400 px-1.5 py-0.5 rounded">✘ {t}</span>)}
          </div>
        )}
        {card.flavourText && <p className="text-xs italic text-[#c0c8c5]/40 mt-3 border-t border-[#a1d0c6]/10 pt-3">"{card.flavourText}"</p>}
      </div>
    </div>
  );
}

// ─── Deck select screen ──────────────────────────────────────────
function DeckSelect({onStart}:{onStart:(p:string,a:string)=>void}) {
  const decks = getAllDecks();
  const meta = loadMeta();
  const [chosen, setChosen] = useState(meta.lastDeck ?? 'deckA');
  const [showAll, setShowAll] = useState(false);
  const [preview, setPreview] = useState<string|null>(null);
  const [fav, setFav] = useState(meta.favouriteDeck ?? '');

  function markFav(id:string){ setFav(id); saveMeta({...meta,favouriteDeck:id}); }

  function go() {
    saveMeta({...meta,lastDeck:chosen});
    const ai = chosen==='deckA'?'deckB':'deckA';
    onStart(chosen,ai);
  }

  const deckName = decks.find(d=>d.id===chosen)?.name ?? chosen;
  const prebuilt = decks.filter(d=>['deckA','deckB'].includes(d.id));
  const custom = decks.filter(d=>!['deckA','deckB'].includes(d.id));

  function DeckBtn({id}:{id:string}) {
    const d = decks.find(x=>x.id===id); if(!d) return null;
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={()=>setChosen(id)}
          className={`flex-1 p-3 rounded-xl border text-left transition-all ${chosen===id?'border-[#a1d0c6] bg-[#a1d0c6]/10':'border-[#a1d0c6]/10 bg-[#1c2120]/40 hover:border-[#a1d0c6]/30'}`}
        >
          <p className="text-sm font-bold text-[#dfe3e1]">{d.name}</p>
          <p className="text-[9px] text-[#c0c8c5]/40">{d.creator?getCardById(d.creator)?.name:'—'}</p>
        </button>
        <button onClick={()=>markFav(id)} className={`text-lg transition-all ${fav===id?'text-amber-400':'text-[#c0c8c5]/20 hover:text-amber-400/60'}`}>⭐</button>
        <button onClick={()=>setPreview(preview===id?null:id)} className="text-[#a1d0c6]/40 hover:text-[#a1d0c6] text-sm">👁</button>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center py-16 px-4 gap-6 animate-fade-in">
      <div className="text-center space-y-1">
        <h1 className="text-3xl font-bold text-[#dfe3e1]">Choose Your Deck</h1>
        <p className="text-[#c0c8c5]/50 text-sm">AI takes the opposing starter deck. Custom decks → AI gets Anon starter.</p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-md">
        {/* Last used */}
        {meta.lastDeck && (()=>{const d=decks.find(x=>x.id===meta.lastDeck);if(!d)return null;return(
          <button onClick={()=>setChosen(meta.lastDeck!)} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${chosen===meta.lastDeck?'border-[#a1d0c6] bg-[#a1d0c6]/10':'border-[#a1d0c6]/20 bg-[#1c2120]/60 hover:border-[#a1d0c6]/40'}`}>
            <span className="text-xl">🕑</span>
            <div className="text-left"><p className="text-[9px] text-[#c0c8c5]/40 uppercase">Last Used</p><p className="font-bold text-[#dfe3e1]">{d.name}</p></div>
          </button>
        );})()}
        {/* Favourite */}
        {fav && fav!==meta.lastDeck && (()=>{const d=decks.find(x=>x.id===fav);if(!d)return null;return(
          <button onClick={()=>setChosen(fav)} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${chosen===fav?'border-[#a1d0c6] bg-[#a1d0c6]/10':'border-[#a1d0c6]/20 bg-[#1c2120]/60 hover:border-[#a1d0c6]/40'}`}>
            <span className="text-xl">⭐</span>
            <div className="text-left"><p className="text-[9px] text-[#c0c8c5]/40 uppercase">Favourite</p><p className="font-bold text-[#dfe3e1]">{d.name}</p></div>
          </button>
        );})()}
        {/* Browse all */}
        <button onClick={()=>setShowAll(v=>!v)} className="flex items-center gap-3 p-4 rounded-2xl border border-[#a1d0c6]/20 bg-[#1c2120]/60 hover:border-[#a1d0c6]/40 transition-all">
          <span className="text-xl">📚</span>
          <div className="text-left flex-1"><p className="text-[9px] text-[#c0c8c5]/40 uppercase">Browse All Decks</p></div>
          <span className="text-[#a1d0c6]/50">{showAll?'▲':'▼'}</span>
        </button>
        {showAll && (
          <div className="flex flex-col gap-2 pl-2">
            {[...prebuilt,...custom].map(d=><DeckBtn key={d.id} id={d.id}/>)}
          </div>
        )}
        {preview && (()=>{const d=decks.find(x=>x.id===preview);if(!d)return null;return(
          <div className="p-4 rounded-2xl border border-[#a1d0c6]/10 bg-[#1c2120]/60 text-xs">
            <p className="font-bold text-[#dfe3e1] mb-2">{d.name}</p>
            {Object.entries(d.cards).slice(0,10).map(([id,cnt])=>(
              <div key={id} className="flex justify-between text-[#c0c8c5]/60 py-0.5">
                <span>{getCardById(id)?.name??id}</span><span>×{cnt}</span>
              </div>
            ))}
          </div>
        );})()}
      </div>
      <div className="text-center">
        <p className="text-xs text-[#c0c8c5]/40 mb-3">Selected: <strong className="text-[#dfe3e1]">{deckName}</strong></p>
        <button onClick={go} className="px-8 py-3 bg-[#a1d0c6] text-[#033730] font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all">
          Start Game →
        </button>
      </div>
    </div>
  );
}

// ─── Mulligan screen ─────────────────────────────────────────────
function MulliganScreen({gs,onDecide}:{gs:GameState;onDecide:(m:boolean)=>void}) {
  const p = gs.players.player;
  const guaranteed = getAllDecks().find(d=>d.id===gs.playerDeckId)?.guaranteedModels??[];
  const models = p.hand.filter(id=>guaranteed.includes(id));
  const others = p.hand.filter(id=>!guaranteed.includes(id));
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center py-16 px-4 gap-6 animate-fade-in">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[#dfe3e1]">Opening Hand</h1>
        <p className="text-[#c0c8c5]/50 text-sm mt-1">Guaranteed models always stay. Mulligan draws 6 new cards.</p>
      </div>
      {models.length>0&&<div className="text-center">
        <p className="text-[9px] text-[#a1d0c6]/60 uppercase tracking-widest mb-2">Guaranteed Models (always kept)</p>
        <div className="flex gap-2 justify-center flex-wrap">{models.map((id,i)=><HandCard key={i} id={id}/>)}</div>
      </div>}
      <div className="text-center">
        <p className="text-[9px] text-[#c0c8c5]/50 uppercase tracking-widest mb-2">Drawn ({others.length} cards)</p>
        <div className="flex gap-2 justify-center flex-wrap max-w-xl">{others.map((id,i)=><HandCard key={i} id={id}/>)}</div>
      </div>
      <div className="flex gap-4">
        <button onClick={()=>onDecide(false)} className="px-6 py-3 border border-[#a1d0c6]/30 text-[#a1d0c6] rounded-xl hover:bg-[#a1d0c6]/10 font-bold transition-all">Keep Hand</button>
        <button onClick={()=>onDecide(true)} className="px-6 py-3 bg-[#cebefa]/20 text-[#cebefa] border border-[#cebefa]/30 rounded-xl hover:bg-[#cebefa]/30 font-bold transition-all">Mulligan → Draw 6</button>
      </div>
      <p className="text-[9px] text-[#c0c8c5]/30">AI is deciding…</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────
export default function ArenaBattlefield() {
  const [gs, setGs] = useState<GameState|null>(null);
  const [pending, setPending] = useState<PendingAction|null>(null);
  const [inspected, setInspected] = useState<string|null>(null);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [notif, setNotif] = useState<string|null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(()=>{logRef.current?.scrollTo({top:9999,behavior:'smooth'});},[gs?.log]);

  function notify(msg:string){ setNotif(msg); setTimeout(()=>setNotif(null),2500); }

  function upd(s:GameState){ setGs(s); return s; }

  // After player ends turn, run AI
  function runAiAfter(state:GameState) {
    if(state.phase!=='playing'||state.currentPlayer!=='ai') return;
    setTimeout(()=>{
      setGs(s=>{
        if(!s||s.currentPlayer!=='ai') return s;
        let a = runAiTurn(s);
        // After AI done, run player's refresh if it's now player's turn
        if(a.phase==='playing'&&a.currentPlayer==='player'&&a.turnPhase==='refresh') a=runRefreshPhase(a);
        return a;
      });
    },700);
  }

  function startGame(p:string,a:string){ upd(initGame(p,a)); }

  function handleMulligan(doM:boolean){
    if(!gs) return;
    let s = applyMulligan(gs,'player',doM);
    s = aiDecideMulligan(s);
    if(s.phase==='playing'){
      s = runRefreshPhase(s);
      if(s.currentPlayer==='ai') runAiAfter(s);
    }
    upd(s);
  }

  function endTurn(){
    if(!gs||gs.currentPlayer!=='player') return;
    const p = gs.players.player;
    if(p.hand.length>7){ setPending({kind:'discard',count:p.hand.length-7,selected:[]}); return; }
    let s = runEndPhase(gs);
    if(s.phase==='gameover'){ upd(s); return; }
    if(s.slotOverflowPending){ upd(s); return; }
    s = runRefreshPhase(s);
    upd(s);
    runAiAfter(s);
  }

  function confirmDiscard(){
    if(!gs) return;
    const pa = pending as {kind:'discard';count:number;selected:string[]}|null;
    if(!pa||pa.kind!=='discard'||pa.selected.length!==pa.count){ notify(`Select ${pa?.count??0} card(s).`); return; }
    let p = {...gs.players.player};
    for(const id of pa.selected){const i=p.hand.indexOf(id);if(i!==-1){p.hand=[...p.hand.slice(0,i),...p.hand.slice(i+1)];p.discard=[...p.discard,id];}}
    let s={...gs,players:{...gs.players,player:p}};
    setPending(null);
    s=runEndPhase(s);
    if(s.phase==='gameover'){upd(s);return;}
    s=runRefreshPhase(s);
    upd(s);
    runAiAfter(s);
  }

  function resolveOverflow(existingId?:string){
    if(!gs) return;
    const s=resolveSlotOverflow(gs,existingId);
    setPending(null);
    upd(s);
  }

  // ── Hand card click ──────────────────────────────────────────────
  function onHandCard(id:string){
    if(!gs||gs.currentPlayer!=='player') return;
    const card=getCardById(id);
    if(!card) return;

    if(pending?.kind==='discard'){
      const pa=pending;
      const already=pa.selected.includes(id);
      const sel=already?pa.selected.filter(x=>x!==id):pa.selected.length<pa.count?[...pa.selected,id]:pa.selected;
      setPending({...pa,selected:sel}); return;
    }
    if(pending?.kind==='activate'){
      if(card.type!=='prompt'){notify('Select prompt cards during activation.');return;}
      const pa=pending;
      if(pa.prompts.includes(id)){setPending({...pa,prompts:pa.prompts.filter(x=>x!==id)});return;}
      const usedSubs=pa.prompts.map(x=>getCardById(x)?.promptType??'');
      const sub=card.promptType??'';
      if(usedSubs.includes(sub)){notify(`Already using a ${sub} prompt.`);return;}
      if(pa.prompts.length>=2){notify('Max 2 prompts.');return;}
      setPending({...pa,prompts:[...pa.prompts,id]}); return;
    }

    switch(card.type){
      case 'model': {
        const cost=card.playCost??0;
        if(gs.players.player.credits<cost){notify('Not enough credits.');return;}
        upd(playModel(gs,id)); break;
      }
      case 'prompt': notify('Click a model in the shared zone first, then add prompts.'); break;
      case 'modifier': setPending({kind:'play-modifier',cardId:id}); break;
      case 'artifact': setPending({kind:'play-artifact',cardId:id}); break;
      case 'event':
        if(gs.round<2&&id!=='E-001'){notify('Events cannot be played in Round 1.');return;}
        setPending({kind:'play-event',cardId:id}); break;
    }
  }

  // ── Shared model click ──────────────────────────────────────────
  function onModel(m:ModelState){
    if(!gs) return;
    if(pending?.kind==='play-modifier'){
      const card=getCardById(pending.cardId);
      if(card?.modifierType==='LoRA'||card?.modifierType==='Model'){
        upd(playModifier(gs,pending.cardId,m.instanceId,'model')); setPending(null); return;
      }
    }
    if(pending?.kind==='play-event'){
      upd(playEvent(gs,pending.cardId,m.instanceId)); setPending(null); return;
    }
    if(gs.currentPlayer!=='player'){notify('Not your turn.');return;}
    if(m.activatedThisTurnBy!==null){notify('Already activated this turn.');return;}
    if(m.ownerId!=='player'&&gs.round<2){notify('Cannot activate opponent models in Round 1.');return;}
    if(gs.players.player.queue.length>=2){notify('Queue full (max 2).');return;}
    setPending({kind:'activate',modelInstanceId:m.instanceId,prompts:[],useFav:false});
  }

  function confirmActivation(){
    if(!gs||pending?.kind!=='activate') return;
    const s=activateModel(gs,pending.modelInstanceId,pending.prompts,pending.useFav);
    upd(s); setPending(null);
  }

  // ── Creation click ──────────────────────────────────────────────
  function onCreation(c:CreationState,pid:PlayerId){
    if(!gs) return;
    if(gs.slotOverflowPending?.playerId==='player'&&pid==='player'){resolveOverflow(c.instanceId);return;}
    if(pending?.kind==='ability'){
      const pa=pending;
      const already=pa.targets.includes(c.instanceId);
      setPending({...pa,targets:already?pa.targets.filter(x=>x!==c.instanceId):[...pa.targets,c.instanceId]});
      return;
    }
    if(pending?.kind==='clip-lock'){
      if(pid!=='player'){notify('Own creations only.');return;}
      upd(applyClipLock(gs,c.instanceId)); setPending(null); return;
    }
    if(pending?.kind==='remix'){
      if(pid!=='player'){notify('Own creations only.');return;}
      if(c.clipLocked){notify('Cannot remix CLIP-LOCKed creation.');return;}
      const stylePrompt=gs.players.player.hand.find(id=>{const card=getCardById(id);return card?.promptType==='Style'||card?.promptType==='Artist';});
      upd(remixCreation(gs,c.instanceId,stylePrompt)); setPending(null); return;
    }
    if(pending?.kind==='play-event'){upd(playEvent(gs,pending.cardId,c.instanceId));setPending(null);return;}
    if(pending?.kind==='play-artifact'){upd(playArtifact(gs,pending.cardId,c.instanceId));setPending(null);return;}
    if(pending?.kind==='play-modifier'){
      const card=getCardById(pending.cardId);
      if(card?.modifierType==='Creation'||card?.artifactType==='Anomaly'){
        upd(playModifier(gs,pending.cardId,c.instanceId,'creation'));setPending(null);return;
      }
    }
    setInspected(c.modelId);
  }

  // ── Creator click ───────────────────────────────────────────────
  function onCreator(pid:PlayerId){
    if(!gs) return;
    if(pending?.kind==='play-modifier'){
      const card=getCardById(pending.cardId);
      const forOpponent=pending.cardId==='MO-006';
      if(forOpponent&&pid==='player'){notify('Ban targets opponent.');return;}
      if(!forOpponent&&pid==='ai'){notify('This modifier targets your creator.');return;}
      upd(playModifier(gs,pending.cardId,pid,'creator'));setPending(null);return;
    }
    setCreatorOpen(true);
  }

  function execAbility(){
    if(!gs||pending?.kind!=='ability') return;
    const s=useCreatorAbility(gs,pending.abilityNum,pending.targets[0],pending.targets.slice(1));
    upd(s); setPending(null); setCreatorOpen(false);
  }

  function playArtDirect(id:string){ if(gs){ upd(playArtifact(gs,id)); setPending(null); } }
  function playEvtDirect(id:string){ if(gs){ upd(playEvent(gs,id)); setPending(null); } }

  // ── RENDER ──────────────────────────────────────────────────────
  if(!gs) return <DeckSelect onStart={startGame}/>;
  if(gs.phase==='mulligan') return <MulliganScreen gs={gs} onDecide={handleMulligan}/>;
  if(gs.phase==='gameover') return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center gap-8 animate-fade-in">
      <h1 className="text-4xl font-bold text-[#dfe3e1]">
        {gs.winner==='player'?'🎉 You Win!':gs.winner==='ai'?'💀 AI Wins':'🤝 Draw'}
      </h1>
      <div className="flex gap-4">
        <button onClick={()=>{setGs(null);setPending(null);}} className="px-6 py-3 bg-[#a1d0c6] text-[#033730] font-bold rounded-xl hover:brightness-110 transition-all">Play Again</button>
      </div>
      <div className="text-xs text-[#c0c8c5]/40 space-y-1 max-w-sm text-center">
        {gs.log.slice(-5).map(l=><p key={l.id}>{l.msg}</p>)}
      </div>
    </div>
  );

  const s=gs;
  const player=s.players.player;
  const ai=s.players.ai;
  const isPlayerTurn=s.currentPlayer==='player';
  const pGlow=isPlayerTurn?creatorGlowColor(s,'player'):'none';
  const maxPLoy=getCardById(player.creatorId)?.loyalty??11;
  const maxALoy=getCardById(ai.creatorId)?.loyalty??16;

  const glowBorder = pGlow==='red'?'border-red-500/70 shadow-[0_0_18px_rgba(239,68,68,0.5)]'
    :pGlow==='yellow'?'border-amber-400/70 shadow-[0_0_18px_rgba(250,204,21,0.4)]'
    :'border-[#a1d0c6]/20';

  return (
    <div className="flex flex-col gap-2 pb-4 select-none">
      {/* Notification */}
      {notif&&<div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#1c2120] border border-amber-400/40 text-amber-400 px-4 py-2 rounded-xl text-sm font-bold shadow-xl">{notif}</div>}

      {/* Inspector */}
      {inspected&&<Inspector id={inspected} onClose={()=>setInspected(null)}/>}

      {/* Creator abilities panel */}
      {creatorOpen&&(
        <AbilitiesPanel
          creatorId={player.creatorId}
          playerState={player}
          isMyTurn={isPlayerTurn}
          onAbility={num=>{ setCreatorOpen(false); setPending({kind:'ability',abilityNum:num,targets:[]}); }}
          onClose={()=>setCreatorOpen(false)}
        />
      )}

      <div className="flex flex-col gap-2 max-w-[1280px] mx-auto w-full px-2">

        {/* ── AI ZONE ── */}
        <div className="bg-[#0d1211] border border-red-500/15 rounded-2xl p-3 flex flex-col gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[9px] text-red-400/60 font-bold uppercase">AI — {getCardById(ai.creatorId)?.name}</span>
            <div className="flex-1"><LoyaltyBar val={ai.loyalty} max={maxALoy} label="Loyalty"/></div>
            <div className="flex gap-3 text-[9px] text-[#c0c8c5]/50">
              <span>★{ai.reputation}</span><span>¢{ai.credits}/{ai.creditCap}</span><span>✋{ai.hand.length}</span><span>📚{ai.deck.length}</span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap items-start">
            {/* AI hand face-down */}
            <div className="flex gap-0.5">
              {ai.hand.map((_,i)=>(
                <div key={i} className="w-8 h-10 rounded-lg bg-[#1c2120] border border-[#a1d0c6]/10 flex items-center justify-center">
                  <span className="text-[6px] text-[#a1d0c6]/20">PB</span>
                </div>
              ))}
            </div>
            {/* AI queue */}
            {ai.queue.map(c=><CreationCard key={c.instanceId} c={c} onClick={()=>setInspected(c.modelId)}/>)}
            {ai.remixQueue&&<CreationCard c={ai.remixQueue} onClick={()=>setInspected(ai.remixQueue!.modelId)}/>}
            {/* AI active */}
            {ai.activeCreations.map(c=>(
              <CreationCard key={c.instanceId} c={c}
                ring={pending?.kind==='ability'&&pending.targets.includes(c.instanceId)}
                onClick={()=>{
                  if(pending?.kind==='ability'||pending?.kind==='play-event'||pending?.kind==='play-artifact'||pending?.kind==='play-modifier')
                    onCreation(c,'ai');
                  else setInspected(c.modelId);
                }}
              />
            ))}
            {ai.activeCreations.length===0&&ai.queue.length===0&&(
              <div className="w-20 h-14 rounded-xl border border-dashed border-[#a1d0c6]/10 flex items-center justify-center">
                <span className="text-[8px] text-[#c0c8c5]/20">empty</span>
              </div>
            )}
            {/* AI creator (clickable to target) */}
            <div
              onClick={()=>onCreator('ai')}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-xl border cursor-pointer transition-all ml-auto
                ${pending?.kind==='play-modifier'&&pending.cardId==='MO-006'?'border-amber-400 bg-amber-400/10':'border-red-500/15 bg-[#1c2120]/40 hover:border-red-500/30'}
              `}
            >
              <div>
                <p className="text-[8px] text-red-400/50">AI Creator</p>
                <p className="text-[9px] font-bold text-[#dfe3e1]">{getCardById(ai.creatorId)?.name}</p>
              </div>
              <div className="flex flex-col gap-0.5 text-[7px]">
                {ai.mods.ban&&<span className="text-red-400">BANNED</span>}
                {ai.mods.astronaut&&<span className="text-blue-400">🚀{ai.mods.astronaut.turnsRemaining}</span>}
                {ai.mods.proSub&&<span className="text-amber-400">PRO</span>}
              </div>
            </div>
          </div>
        </div>

        {/* ── SHARED ZONE ── */}
        <div className="bg-[#0d1211]/60 border border-[#a1d0c6]/10 rounded-2xl p-3 flex flex-col gap-2">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <span className="text-[8px] uppercase tracking-widest text-[#c0c8c5]/30">Shared Zone — Models & Artifacts</span>
            <div className="flex gap-2 text-[8px] text-[#c0c8c5]/40">
              <span>Round {s.round}</span><span>Turn {s.absTurn}</span>
              <span className={isPlayerTurn?'text-[#a1d0c6] font-bold':'text-orange-400 font-bold'}>
                {isPlayerTurn?'YOUR TURN':'AI TURN'}
              </span>
            </div>
          </div>
          {/* Global effects */}
          <div className="flex gap-1.5 flex-wrap">
            {s.serverOverloadRounds>0&&<span className="text-[8px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">SERVER OVERLOAD ({s.serverOverloadRounds}r)</span>}
            {s.queueTimeoutRounds>0&&<span className="text-[8px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded">QUEUE TIMEOUT ({s.queueTimeoutRounds}r)</span>}
            {s.centaurProblemRounds>0&&<span className="text-[8px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">CENTAUR PROBLEM ({s.centaurProblemRounds}r)</span>}
            {s.algorithmSwap&&<span className="text-[8px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded">ALGO SWAP: {s.algorithmSwap.style1}↔{s.algorithmSwap.style2}</span>}
            {s.dailyChallengeAbstracts&&<span className="text-[8px] bg-orange-400/20 text-orange-300 px-1.5 py-0.5 rounded">CHALLENGE: ABSTRACT</span>}
            {s.dailyChallengePortraits&&<span className="text-[8px] bg-pink-400/20 text-pink-300 px-1.5 py-0.5 rounded">CHALLENGE: PORTRAIT</span>}
          </div>
          {/* Models */}
          <div className="flex gap-2 flex-wrap">
            {s.sharedModels.length===0&&<span className="text-[8px] text-[#c0c8c5]/20">No models. Play a model card to add one.</span>}
            {s.sharedModels.map(m=>(
              <ModelCard key={m.instanceId} m={m}
                ring={pending?.kind==='activate'&&pending.modelInstanceId===m.instanceId}
                onClick={()=>onModel(m)}
              />
            ))}
          </div>
          {/* Artifacts */}
          {s.artifacts.length>0&&(
            <div className="flex gap-2 flex-wrap border-t border-[#a1d0c6]/10 pt-2">
              {s.artifacts.map(a=>(
                <div key={a.instanceId} onClick={()=>setInspected(a.cardId)} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 cursor-pointer hover:bg-purple-500/20">
                  <span className="text-[8px] text-purple-400">{getCardById(a.cardId)?.name}</span>
                  <span className="text-[7px] text-[#c0c8c5]/40">{a.turnsRemaining}t</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── PLAYER ZONE ── */}
        <div className="bg-[#0d1211] border border-[#a1d0c6]/20 rounded-2xl p-3 flex flex-col gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[9px] text-[#a1d0c6]/80 font-bold uppercase">YOU — {getCardById(player.creatorId)?.name}</span>
            <div className="flex-1"><LoyaltyBar val={player.loyalty} max={maxPLoy} label="Loyalty"/></div>
            <div className="flex gap-3 text-[9px] text-[#c0c8c5]/60">
              <span className="text-amber-400">★{player.reputation}/20</span>
              <span className="text-[#a1d0c6]">¢{player.credits}/{player.creditCap}</span>
              <span>📚{player.deck.length}</span>
            </div>
          </div>

          <div className="flex gap-3 flex-wrap items-start">
            {/* Creator card with glow */}
            <div
              onClick={()=>onCreator('player')}
              className={`flex flex-col gap-2 p-3 rounded-2xl border cursor-pointer transition-all
                ${glowBorder}
                ${pending?.kind==='play-modifier'&&!['MO-002','MO-003','MO-004','MO-006','MO-008','MO-009','MO-010'].includes(pending.cardId)?'ring-2 ring-amber-400/60':''}
                bg-[#1c2120]/80
              `}
              style={{minWidth:120}}
            >
              <p className="text-[8px] text-[#a1d0c6]/50 uppercase font-bold">Creator</p>
              <p className="text-sm font-bold text-[#dfe3e1]">{getCardById(player.creatorId)?.name}</p>
              <div className="flex gap-2 text-[8px] flex-wrap">
                {player.creatorExhaustedThisTurn&&<span className="text-red-400">EXHSTD</span>}
                {player.mods.ban&&<span className="text-red-400">BANNED</span>}
                {player.mods.astronaut&&<span className="text-blue-400">🚀{player.mods.astronaut.turnsRemaining}t</span>}
                {player.mods.proSub&&<span className="text-amber-400">PRO {player.mods.proSub.turnsRemaining}t</span>}
                {player.mods.trending&&<span className="text-green-400">TREND {player.mods.trending.roundsRemaining}r</span>}
              </div>
              {pGlow!=='none'&&(
                <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${pGlow==='red'?'bg-red-500/20 text-red-400':'bg-amber-400/20 text-amber-400'}`}>
                  {pGlow==='red'?'⚡ ULT READY':'✦ ABILITY'}
                </span>
              )}
              <p className="text-[7px] text-[#c0c8c5]/30">Click for abilities</p>
            </div>

            {/* Player creations */}
            <div className="flex flex-col gap-2">
              {/* Queue */}
              {(player.queue.length>0||player.remixQueue)&&(
                <div className="flex gap-2 items-center flex-wrap">
                  <span className="text-[8px] text-[#c0c8c5]/30">Queue:</span>
                  {player.queue.map(c=><CreationCard key={c.instanceId} c={c} onClick={()=>onCreation(c,'player')}/>)}
                  {player.remixQueue&&<CreationCard c={player.remixQueue} onClick={()=>onCreation(player.remixQueue!,'player')}/>}
                </div>
              )}
              {/* Active */}
              <div className="flex gap-2 flex-wrap">
                {player.activeCreations.map(c=>(
                  <CreationCard key={c.instanceId} c={c}
                    ring={
                      (pending?.kind==='ability'&&pending.targets.includes(c.instanceId))||
                      (gs.slotOverflowPending?.playerId==='player')
                    }
                    onClick={()=>onCreation(c,'player')}
                  />
                ))}
                {Array.from({length:Math.max(0,3-player.activeCreations.length)}).map((_,i)=>(
                  <div key={i} className="w-20 h-14 rounded-xl border border-dashed border-[#a1d0c6]/10 flex items-center justify-center">
                    <span className="text-[8px] text-[#c0c8c5]/20">Slot {player.activeCreations.length+i+1}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Slot overflow */}
          {s.slotOverflowPending?.playerId==='player'&&(
            <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-xl">
              <p className="text-xs text-red-400 font-bold mb-2">⚡ Slot Overflow! Click a creation above to destroy it, or reject the incoming one.</p>
              <button onClick={()=>resolveOverflow()} className="text-[9px] border border-red-500/30 text-red-400 px-2 py-1 rounded hover:bg-red-500/10">
                Reject Incoming (−1 Loyalty)
              </button>
            </div>
          )}
        </div>

        {/* ── PENDING ACTION BANNER ── */}
        {pending&&(
          <div className="bg-[#1c2120] border border-amber-400/30 rounded-2xl p-3 flex flex-col gap-2">
            {pending.kind==='activate'&&(
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-bold text-amber-400">Activating {getCardById(s.sharedModels.find(m=>m.instanceId===pending.modelInstanceId)?.cardId??'')?.name}</p>
                  <p className="text-xs text-[#c0c8c5]/50">Click prompt cards in your hand below (max 2, different types)</p>
                  <div className="flex gap-1 mt-1">{pending.prompts.map(id=><span key={id} className="text-[9px] bg-green-400/20 text-green-400 px-1.5 rounded">{getCardById(id)?.name}</span>)}</div>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <label className="flex items-center gap-1 text-[9px] text-[#c0c8c5]/60 cursor-pointer">
                    <input type="checkbox" checked={pending.useFav} onChange={e=>setPending({...pending,useFav:e.target.checked})} className="accent-amber-400"/>
                    Fav Prompt
                  </label>
                  <button onClick={confirmActivation} className="px-3 py-1.5 bg-[#a1d0c6] text-[#033730] font-bold rounded-lg text-xs">Generate →</button>
                  <button onClick={()=>setPending(null)} className="px-2 py-1.5 border border-[#a1d0c6]/20 text-[#c0c8c5]/50 rounded-lg text-xs">Cancel</button>
                </div>
              </div>
            )}
            {pending.kind==='ability'&&(
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-bold text-amber-400">Ability: {pending.abilityNum==='signature'?'⚡ Signature':`#${pending.abilityNum}`}</p>
                  <p className="text-xs text-[#c0c8c5]/50">Click target creation(s) on the board {pending.abilityNum==='signature'?'(up to 3 CLIP-LOCKed)':''}.</p>
                  <div className="flex gap-1 mt-1">{pending.targets.map((_,i)=><span key={i} className="text-[9px] bg-amber-400/20 text-amber-400 px-1.5 rounded">target {i+1}</span>)}</div>
                </div>
                <div className="flex gap-2 ml-auto">
                  <button onClick={execAbility} className="px-3 py-1.5 bg-amber-400 text-black font-bold rounded-lg text-xs">Confirm</button>
                  <button onClick={()=>setPending(null)} className="px-2 py-1.5 border border-[#a1d0c6]/20 text-[#c0c8c5]/50 rounded-lg text-xs">Cancel</button>
                </div>
              </div>
            )}
            {(pending.kind==='play-modifier'||pending.kind==='play-artifact'||pending.kind==='play-event')&&(
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-bold text-amber-400">Playing: {getCardById(pending.cardId)?.name}</p>
                  <p className="text-xs text-[#c0c8c5]/50">Click the target on the board above.</p>
                </div>
                <div className="flex gap-2 ml-auto">
                  {pending.kind==='play-artifact'&&['A-001','A-002','A-004','A-005'].includes(pending.cardId)&&(
                    <button onClick={()=>playArtDirect(pending.cardId)} className="px-3 py-1.5 bg-purple-400/30 text-purple-300 font-bold rounded-lg text-xs">Play (no target)</button>
                  )}
                  {pending.kind==='play-event'&&['E-002','E-007','E-009','E-010'].includes(pending.cardId)&&(
                    <button onClick={()=>playEvtDirect(pending.cardId)} className="px-3 py-1.5 bg-blue-400/30 text-blue-300 font-bold rounded-lg text-xs">Play (no target)</button>
                  )}
                  <button onClick={()=>setPending(null)} className="px-2 py-1.5 border border-[#a1d0c6]/20 text-[#c0c8c5]/50 rounded-lg text-xs">Cancel</button>
                </div>
              </div>
            )}
            {pending.kind==='discard'&&(
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-bold text-red-400">Discard {pending.count} card(s) to end turn</p>
                  <p className="text-xs text-[#c0c8c5]/50">Click cards below to select ({pending.selected.length}/{pending.count}).</p>
                </div>
                <button onClick={confirmDiscard} disabled={pending.selected.length!==pending.count} className="px-3 py-1.5 bg-red-500/30 text-red-300 font-bold rounded-lg text-xs disabled:opacity-40 ml-auto">
                  Discard & End Turn
                </button>
              </div>
            )}
            {pending.kind==='clip-lock'&&(
              <div className="flex items-center gap-3">
                <p className="text-sm font-bold text-cyan-400">CLIP-LOCK: Click one of your Coherent creations.</p>
                <button onClick={()=>setPending(null)} className="px-2 py-1.5 border border-[#a1d0c6]/20 text-[#c0c8c5]/50 rounded-lg text-xs ml-auto">Cancel</button>
              </div>
            )}
            {pending.kind==='remix'&&(
              <div className="flex items-center gap-3">
                <p className="text-sm font-bold text-orange-400">Remix: Click one of your active (non-CLIP-LOCKed) creations.</p>
                <button onClick={()=>setPending(null)} className="px-2 py-1.5 border border-[#a1d0c6]/20 text-[#c0c8c5]/50 rounded-lg text-xs ml-auto">Cancel</button>
              </div>
            )}
          </div>
        )}

        {/* ── HAND + ACTIONS ── */}
        <div className="bg-[#0d1211] border border-[#a1d0c6]/10 rounded-2xl p-3">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <span className="text-[8px] uppercase tracking-widest text-[#c0c8c5]/30">Your Hand ({player.hand.length} cards)</span>
            <div className="flex gap-2 flex-wrap">
              {player.creatorId==='C-001'&&!player.clipLockAppliedThisTurn&&isPlayerTurn&&(
                <button onClick={()=>setPending({kind:'clip-lock'})} className="px-2 py-1.5 text-[9px] border border-cyan-400/30 text-cyan-400 rounded-lg hover:bg-cyan-400/10">🔒 CLIP-LOCK</button>
              )}
              {player.activeCreations.length>0&&!player.remixQueue&&isPlayerTurn&&(
                <button onClick={()=>setPending({kind:'remix'})} className="px-2 py-1.5 text-[9px] border border-orange-400/30 text-orange-400 rounded-lg hover:bg-orange-400/10">🔄 Remix</button>
              )}
              {isPlayerTurn?(
                <button onClick={endTurn} disabled={!!s.slotOverflowPending} className="px-4 py-1.5 text-xs font-bold bg-[#a1d0c6] text-[#033730] rounded-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-40">
                  End Turn →
                </button>
              ):(
                <span className="px-4 py-1.5 text-xs text-[#c0c8c5]/30 border border-[#a1d0c6]/10 rounded-lg">AI thinking…</span>
              )}
            </div>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {player.hand.map((id,i)=>{
              const card=getCardById(id);
              const isPromptMode=pending?.kind==='activate';
              const inSel=pending?.kind==='activate'?pending.prompts.includes(id):pending?.kind==='discard'?pending.selected.includes(id):false;
              const dim=!isPlayerTurn||(isPromptMode&&card?.type!=='prompt');
              return (
                <div key={`${id}-${i}`} className="relative">
                  <HandCard id={id} sel={inSel} dim={dim} onClick={()=>{if(isPlayerTurn)onHandCard(id);else setInspected(id);}}/>
                  <button onClick={e=>{e.stopPropagation();setInspected(id);}} className="absolute top-0.5 right-0.5 text-[7px] text-[#c0c8c5]/20 hover:text-[#a1d0c6]">👁</button>
                </div>
              );
            })}
            {player.hand.length===0&&<p className="text-[8px] text-[#c0c8c5]/20">No cards in hand.</p>}
          </div>
        </div>

        {/* ── LOG ── */}
        <div ref={logRef} className="bg-[#0d1211]/60 border border-[#a1d0c6]/10 rounded-2xl p-3 max-h-32 overflow-y-auto">
          <p className="text-[7px] uppercase tracking-widest text-[#c0c8c5]/30 mb-1.5">Game Log</p>
          {gs.log.slice(-30).map(e=>(
            <p key={e.id} className={`text-[8px] leading-relaxed ${
              e.type==='damage'?'text-red-400/80':e.type==='system'?'text-[#a1d0c6]/60 font-bold':
              e.type==='effect'?'text-[#cebefa]/70':e.type==='ai'?'text-orange-400/70':'text-[#c0c8c5]/60'
            }`}>{e.msg}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
