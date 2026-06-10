// ============================================================
// PROMPT BATTLE — Arena Battlefield v3
// Drag-to-play, toast notifications, win screen with bubbles,
// card image+text toggle, ability gating, hidden nav in game,
// first-turn restriction, corrected credits/mulligan bonus
// ============================================================
import { useState, useRef, useEffect, useCallback } from 'react';
import { getCardById } from '../data';
import type { GameState, CreationState, ModelState, PlayerId, StyleTag } from '../game/gameTypes';
import {
  initGame, applyMulligan, runRefreshPhase, runEndPhase, resolveSlotOverflow,
  playModel, activateModel, playModifier, playArtifact, playEvent,
  useCreatorAbility, applyClipLock, remixCreation,
  effectiveQuality, effectiveStyle, canUseAbility, creatorGlowColor,
  getAllDecks, addLog, buildHelpers,
} from '../game/gameEngine';
import { aiDecideMulligan, runAiTurn } from '../game/aiEngine';

// ─── Props ───────────────────────────────────────────────────
interface Props { onInGame?: (v: boolean) => void; onExit?: () => void; }

// ─── Storage ─────────────────────────────────────────────────
const META_KEY = 'pb_play_meta';
const loadMeta = (): { lastDeck?: string; favDeck?: string } => {
  try { return JSON.parse(localStorage.getItem(META_KEY) ?? '{}'); } catch { return {}; }
};
const saveMeta = (m: object) => localStorage.setItem(META_KEY, JSON.stringify(m));

// ─── Toast system ─────────────────────────────────────────────
interface Toast { id: string; msg: string; type: 'info'|'damage'|'effect'|'error'; }
let _toastSeq = 0;
function makeToast(msg: string, type: Toast['type'] = 'info'): Toast {
  return { id: `t${++_toastSeq}`, msg, type };
}

// ─── Styles ───────────────────────────────────────────────────
const STYLES: StyleTag[] = ['Fantasy','Landscape','Portrait','Abstract','Atmosphere'];
const STYLE_CLR: Record<StyleTag, string> = {
  Fantasy:'text-purple-300', Landscape:'text-green-300',
  Portrait:'text-pink-300', Abstract:'text-orange-300', Atmosphere:'text-blue-300',
};

// ─── Target spec (unchanged from v2) ─────────────────────────
interface TargetSpec {
  label: string; cardId?: string; abilityNum?: number|'signature';
  ownCreator?: boolean; oppCreator?: boolean;
  ownActive?: boolean; oppActive?: boolean;
  ownQueue?: boolean; oppQueue?: boolean;
  anyModel?: boolean; ownModel?: boolean;
  clipLockedOnly?: boolean; notClipLocked?: boolean;
  minVis?: number; styleFilter?: StyleTag[];
  selected: string[]; maxTargets: number;
  _isClipLock?: boolean; _isRemix?: boolean;
}

function getTargetSpec(cardId: string): TargetSpec | null {
  const b = (label: string, x: Partial<TargetSpec>): TargetSpec =>
    ({ label, selected:[], maxTargets:1, cardId, ...x });
  switch(cardId) {
    case 'MO-001': return b('Select your Creator', {ownCreator:true});
    case 'MO-002': case 'MO-003': case 'MO-004':
      return b('Select a Model', {anyModel:true});
    case 'MO-005': return b('Select your Creator', {ownCreator:true});
    case 'MO-006': return b('Select opponent Creator', {oppCreator:true});
    case 'MO-007': return b('Select your Creator', {ownCreator:true});
    case 'MO-008': return b('Select your Creation with 6+ Visibility', {ownActive:true, minVis:6});
    case 'MO-009': case 'MO-010': return b('Select a Model', {anyModel:true});
    case 'A-003':  return b('Select Fantasy or Portrait Creation',
      {ownActive:true, oppActive:true, styleFilter:['Fantasy','Portrait']});
    case 'E-004': case 'E-005': return b('Select your queued Creation', {ownQueue:true});
    case 'E-006':  return b('Select opponent queued Creation', {oppQueue:true});
    case 'E-008':  return b('Select opponent queued Creation', {oppQueue:true});
    default: return null;
  }
}

function getAbilitySpec(n: number|'signature', creatorId: string): TargetSpec|null {
  const b = (label: string, x: Partial<TargetSpec>): TargetSpec =>
    ({ label, selected:[], maxTargets:1, abilityNum:n, ...x });
  if (creatorId==='C-001') {
    if (n===1) return b('Select opponent Creation (Overrender)',{oppActive:true,notClipLocked:true});
    if (n===2) return b('Select your CLIP-LOCKed Creation',{ownActive:true,clipLockedOnly:true});
    if (n===3) return b('Select your Creation (Iridescent Shift)',{ownActive:true});
    if (n==='signature') return b('Select up to 3 CLIP-LOCKed Creations',
      {ownActive:true, clipLockedOnly:true, maxTargets:3});
  }
  return null; // Anon abilities are all auto-targeting
}

function isValidTarget(
  spec: TargetSpec,
  itype: 'own-creator'|'opp-creator'|'own-active'|'opp-active'|
         'own-queue'|'opp-queue'|'own-model'|'opp-model',
  item: CreationState|ModelState|null, gs: GameState
): boolean {
  const ok = (
    (itype==='own-creator'  && spec.ownCreator)  ||
    (itype==='opp-creator'  && spec.oppCreator)  ||
    (itype==='own-active'   && spec.ownActive)   ||
    (itype==='opp-active'   && spec.oppActive)   ||
    (itype==='own-queue'    && spec.ownQueue)     ||
    (itype==='opp-queue'    && spec.oppQueue)     ||
    (itype==='own-model'    && (spec.anyModel||spec.ownModel)) ||
    (itype==='opp-model'    && spec.anyModel)
  );
  if (!ok) return false;
  if (item && 'quality' in item) {
    const c = item as CreationState;
    if (spec.clipLockedOnly && !c.clipLocked) return false;
    if (spec.notClipLocked  &&  c.clipLocked) return false;
    if (spec.minVis !== undefined && c.visibilityCounters < spec.minVis) return false;
    if (spec.styleFilter?.length) {
      const es = effectiveStyle(c.styleTag, gs);
      if (!es || !spec.styleFilter.includes(es)) return false;
    }
    const isOpp = itype==='opp-active'||itype==='opp-queue';
    if (isOpp && c.immuneToOpponentUntilAbsTurn > gs.absTurn) return false;
    if (isOpp && c.safetyInNumbersThisTurn) return false;
  }
  return true;
}

// ─── Pending action ───────────────────────────────────────────
type PA =
  | { kind:'activate'; modelId:string; prompts:string[]; useFav:boolean }
  | { kind:'target';   spec:TargetSpec }
  | { kind:'styles';   cardId:string; chosen:StyleTag[] }
  | { kind:'discard';  count:number; selected:string[] };

// ─── Long-press hook ──────────────────────────────────────────
function useLongPress(onLong: () => void, onShort?: () => void, ms = 450) {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const fired = useRef(false);
  const start = () => { fired.current = false; timer.current = setTimeout(() => { fired.current = true; onLong(); }, ms); };
  const stop  = () => { clearTimeout(timer.current); };
  const end   = () => { stop(); if (!fired.current) onShort?.(); };
  return {
    onMouseDown: start, onMouseUp: end, onMouseLeave: stop,
    onTouchStart: start, onTouchEnd: end,
    style: { WebkitUserSelect: 'none' as const, userSelect: 'none' as const },
  };
}

// ─── Tiny display components ──────────────────────────────────
function VisBar({vis}:{vis:number}) {
  const pct=Math.min(100,(vis/12)*100);
  const c=vis>=10?'bg-amber-400':vis>=6?'bg-cyan-400':vis>=3?'bg-teal-500':'bg-white/10';
  return <div className="w-full bg-black/40 rounded-full h-1 overflow-hidden"><div className={`h-full rounded-full ${c}`} style={{width:`${pct}%`}}/></div>;
}
function LoyBar({val,max,label}:{val:number;max:number;label:string}) {
  const pct=Math.max(0,Math.min(100,(val/max)*100));
  const c=pct>50?'bg-[#a1d0c6]':pct>25?'bg-amber-400':'bg-red-500';
  return (
    <div className="flex items-center gap-2 flex-1">
      <span className="text-[9px] text-white/35 w-12 shrink-0">{label}</span>
      <div className="flex-1 bg-black/40 rounded-full h-2 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${c}`} style={{width:`${pct}%`}}/>
      </div>
      <span className="text-xs font-bold text-white w-8 text-right">{val}</span>
    </div>
  );
}

// ─── Creation chip ────────────────────────────────────────────
function CreationChip({c,onClick,glow,dim,sublabel}:{
  c:CreationState; onClick?:()=>void; glow?:boolean; dim?:boolean; sublabel?:string;
}) {
  const eq=effectiveQuality(c), vis=c.visibilityCounters;
  const visLabel=vis>=10?'Featured':vis>=6?'Liked':vis>=3?'Noticed':'—';
  return (
    <div onClick={onClick} className={`flex flex-col gap-1 p-2 rounded-xl border cursor-pointer select-none transition-all
      ${glow?'border-amber-400 bg-amber-400/15 shadow-lg shadow-amber-400/20 scale-105':'border-white/12 bg-white/5 hover:border-white/25'}
      ${dim?'opacity-25 pointer-events-none':''}
      ${eq<=0?'border-red-500/40':''}
      ${c.clipLocked?'ring-1 ring-cyan-400/50':''}
    `} style={{width:96,minHeight:96}}>
      <div className="flex gap-0.5 flex-wrap">
        {c.clipLocked&&<span className="text-[7px] bg-cyan-400/20 text-cyan-300 px-0.5 rounded font-bold">CLK</span>}
        {!c.isOnField&&!c.isInRemixQueue&&<span className="text-[7px] bg-purple-400/20 text-purple-300 px-0.5 rounded font-bold">⏳{c.runtime}t</span>}
        {c.isInRemixQueue&&<span className="text-[7px] bg-orange-400/20 text-orange-300 px-0.5 rounded font-bold">RMX</span>}
        {c.immuneToOpponentUntilAbsTurn>0&&<span className="text-[7px] bg-green-400/20 text-green-300 px-0.5 rounded font-bold">IMM</span>}
        {c.safetyInNumbersThisTurn&&<span className="text-[7px] bg-blue-400/20 text-blue-300 px-0.5 rounded font-bold">SFT</span>}
        {c.featuredTurnsRemaining>0&&<span className="text-[7px] bg-amber-400/20 text-amber-300 px-0.5 rounded font-bold">★</span>}
      </div>
      <div className="flex items-center gap-1">
        <span className={`text-sm font-bold ${eq<=0?'text-red-400':eq<=1?'text-amber-300':'text-[#a1d0c6]'}`}>Q{eq}</span>
        {c.glitchTokens>0&&<span className="text-[9px] text-red-400">⚡{c.glitchTokens}</span>}
      </div>
      {c.styleTag&&<span className={`text-[8px] font-bold ${STYLE_CLR[c.styleTag]??''}`}>{c.styleTag}</span>}
      <VisBar vis={vis}/>
      <div className="flex justify-between"><span className="text-[7px] text-white/25">{visLabel}</span><span className="text-[7px] text-[#a1d0c6]/40">{vis}✦</span></div>
      <span className="text-[7px] text-white/20 truncate">{getCardById(c.modelId)?.name}</span>
      {sublabel&&<span className="text-[7px] text-amber-400/60">{sublabel}</span>}
    </div>
  );
}

// ─── Model chip ───────────────────────────────────────────────
function ModelChip({m,onClick,onInspect,glow,activating}:{m:ModelState;onClick?:()=>void;onInspect?:()=>void;glow?:boolean;activating?:boolean}) {
  const card=getCardById(m.cardId);
  if(!card) return null;
  const used=m.activatedThisTurnBy!==null;
  const lp = useLongPress(()=>onInspect?.(), onClick);
  return (
    <div {...lp} className={`flex flex-col gap-1 p-2 rounded-xl border cursor-pointer select-none transition-all
      ${glow?'border-amber-400 bg-amber-400/10 scale-105':'border-[#cebefa]/20 bg-white/5 hover:border-[#cebefa]/40'}
      ${(used&&!activating)?'opacity-40':''}
      ${activating?'ring-2 ring-amber-400':''}
    `} style={{width:96}}>
      <span className="text-[9px] font-bold text-[#cebefa] truncate">{card.name}</span>
      <div className="flex gap-1 flex-wrap">
        <span className="text-[7px] bg-[#cebefa]/10 text-[#cebefa]/60 px-1 rounded">Q{card.quality}</span>
        <span className="text-[7px] bg-white/8 text-white/50 px-1 rounded">⏳{card.runtime}</span>
        <span className="text-[7px] bg-white/8 text-white/50 px-1 rounded">⚡{card.activateCost}¢</span>
      </div>
      {m.loraCardId&&<span className="text-[7px] text-amber-400 truncate">{getCardById(m.loraCardId)?.name}</span>}
      {m.noiseTurnsRemaining>0&&<span className="text-[7px] text-red-400">NOISE {m.noiseTurnsRemaining}t</span>}
      {m.queueSkipReady&&<span className="text-[7px] text-green-400">SKIP✓</span>}
      <div className="flex justify-between text-[7px] text-white/20">
        <span>by {m.ownerId}</span>{used&&<span>used</span>}
      </div>
    </div>
  );
}

// ─── Hand card (2:3 portrait / 3:2 landscape for models) ─────
function HandCard({id,selected,dim,onDragStart,onClick,onInspect}:{
  id:string; selected?:boolean; dim?:boolean;
  onDragStart?:()=>void; onClick?:()=>void; onInspect?:()=>void;
}) {
  const card=getCardById(id);
  if(!card) return null;
  const isModel=card.type==='model';
  const W=isModel?108:66, H=isModel?72:99;
  const border: Record<string,string>={
    model:'border-[#cebefa]/40 bg-[#cebefa]/5',
    prompt:'border-green-500/40 bg-green-500/5',
    modifier:'border-amber-500/40 bg-amber-500/5',
    artifact:'border-purple-500/40 bg-purple-500/5',
    event:'border-blue-500/40 bg-blue-500/5',
  };
  return (
    <div className="relative group flex-shrink-0" style={{width:W,height:H}}>
      <div
        draggable={!dim}
        onDragStart={e=>{ e.dataTransfer.setData('cardId',id); onDragStart?.(); }}
        onClick={onClick}
        className={`flex flex-col gap-1 p-2 rounded-xl border cursor-grab active:cursor-grabbing select-none transition-all w-full h-full overflow-hidden
          ${selected?'border-amber-400 bg-amber-400/15 scale-105 shadow-lg shadow-amber-400/20':border[card.type]??'border-white/15 bg-white/5'}
          ${dim?'opacity-20 pointer-events-none':'hover:brightness-125'}
        `}
      >
        <span className="text-[7px] uppercase tracking-wider text-white/30 font-bold">{card.type}</span>
        <span className={`font-bold text-white leading-tight ${isModel?'text-[9px]':'text-[8px]'} line-clamp-2`}>{card.name}</span>
        {isModel
          ? <div className="flex gap-1 items-end mt-auto text-[7px] text-white/40 flex-wrap"><span>Q{card.quality}</span><span>⏳{card.runtime}</span><span className="ml-auto">▶{card.activateCost}¢</span></div>
          : <><span className="text-[7px] text-[#a1d0c6]/50">{card.cost??0}{card.costType==='reputation'?'★':'¢'}</span>
              {card.promptType&&<span className="text-[7px] text-green-400/60">{card.promptType}</span>}
              <p className="text-[6px] text-white/25 leading-tight mt-auto line-clamp-2">{card.effect}</p>
            </>
        }
      </div>
      <button onClick={e=>{e.stopPropagation();onInspect?.();}}
        className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 text-[7px] text-white/30 hover:text-white bg-black/50 rounded px-0.5 transition-opacity">
        👁
      </button>
    </div>
  );
}

// ─── Card Detail Modal (image + text toggle) ──────────────────
function CardDetailModal({id,onClose,onPlay,canPlay,playLabel}:{
  id:string; onClose:()=>void; onPlay?:()=>void; canPlay?:boolean; playLabel?:string;
}) {
  const [showText,setShowText]=useState(false);
  const card=getCardById(id);
  if(!card) return null;
  const typeCol: Record<string,string>={
    model:'#cebefa', prompt:'#4ade80', modifier:'#fbbf24',
    artifact:'#a78bfa', event:'#60a5fa', creator:'#a1d0c6',
  };
  const col=typeCol[card.type]??'#a1d0c6';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md" onClick={onClose}>
      <div className="relative bg-[#181d1c] border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{width:320,maxHeight:'90vh'}} onClick={e=>e.stopPropagation()}>
        {/* Image / placeholder area */}
        {!showText&&(
          <div className="relative flex items-center justify-center overflow-hidden"
            style={{height:200, background:`linear-gradient(135deg,#0d1211,${col}22)`}}>
            {/* Placeholder art — replace src with real image when available */}
            <div className="flex flex-col items-center gap-2 opacity-40">
              <span style={{fontSize:48}}>{card.type==='model'?'🤖':card.type==='prompt'?'✍️':card.type==='modifier'?'⚙️':card.type==='artifact'?'💎':card.type==='event'?'⚡':'👤'}</span>
              <span className="text-xs text-white/50 text-center px-4">{card.name}</span>
            </div>
            {/* Coloured border overlay */}
            <div className="absolute inset-0 border-b-2 rounded-t-2xl pointer-events-none" style={{borderColor:col+'66'}}/>
          </div>
        )}
        {/* Info area */}
        <div className="flex flex-col gap-3 p-4 flex-1 overflow-y-auto">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/35">{card.type}{card.subtype?` · ${card.subtype}`:''}</p>
              <h3 className="text-base font-bold text-white leading-tight">{card.name}</h3>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={()=>setShowText(v=>!v)}
                className="text-[9px] border border-white/15 text-white/40 hover:text-white px-2 py-1 rounded-lg transition-all">
                {showText?'🖼 Art':'📝 Text'}
              </button>
              <button onClick={onClose} className="text-white/30 hover:text-white text-lg leading-none">✕</button>
            </div>
          </div>
          {card.type==='model'&&(
            <div className="flex gap-3 text-[10px] text-white/50 flex-wrap">
              <span>Play <strong className="text-white">{card.playCost}¢</strong></span>
              <span>Activate <strong className="text-white">{card.activateCost}¢</strong></span>
              <span>Quality <strong className="text-white">{card.quality}</strong></span>
              <span>Runtime <strong className="text-white">{card.runtime}</strong></span>
            </div>
          )}
          {card.type!=='model'&&<p className="text-[10px] text-white/50">Cost: <strong className="text-white">{card.cost??0}{card.costType==='reputation'?' Rep':' Credits'}</strong></p>}
          {card.keyword&&<p className="text-xs italic text-[#a1d0c6]/50">"{card.keyword}"</p>}
          {card.effect&&<div className="bg-black/30 rounded-xl p-3"><p className="text-sm text-white/80 leading-relaxed">{card.effect}</p></div>}
          {(card.compatible?.length>0||card.incompatible?.length>0)&&(
            <div className="flex gap-1.5 flex-wrap">
              {card.compatible?.map(t=><span key={t} className="text-[8px] bg-green-500/10 text-green-400 border border-green-500/20 px-1.5 py-0.5 rounded-full">✔ {t}</span>)}
              {card.incompatible?.map(t=><span key={t} className="text-[8px] bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-full">✘ {t}</span>)}
            </div>
          )}
          {card.flavourText&&<p className="text-[9px] italic text-white/25 border-t border-white/5 pt-2">"{card.flavourText}"</p>}
          {onPlay&&(
            <div className="flex gap-2 mt-1">
              <button onClick={()=>{onClose();onPlay();}} disabled={!canPlay}
                className="flex-1 py-2 bg-[#a1d0c6] text-[#033730] font-bold rounded-xl text-sm hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                {playLabel??'Use This Card'}
              </button>
              <button onClick={onClose} className="px-4 py-2 border border-white/12 text-white/40 rounded-xl text-sm hover:bg-white/5">Cancel</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Creator abilities panel ──────────────────────────────────
function CreatorPanel({creatorId,player,isMyTurn,gs,onAbility,onClose}:{
  creatorId:string; player:GameState['players']['player'];
  isMyTurn:boolean; gs:GameState; onAbility:(n:number|'signature')=>void; onClose:()=>void;
}) {
  const card=getCardById(creatorId);
  if(!card) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/65 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#181d1c] border border-[#a1d0c6]/20 rounded-2xl p-5 w-full max-w-md mx-4 shadow-2xl flex flex-col gap-3 max-h-[90vh] overflow-y-auto"
        onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[8px] uppercase tracking-widest text-[#a1d0c6]/40">Creator</p>
            <h2 className="text-xl font-bold text-white">{card.name}</h2>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white text-xl leading-none">✕</button>
        </div>
        <div className="flex gap-3 text-xs text-white/50 flex-wrap">
          <span>❤ <strong className="text-white">{player.loyalty}</strong></span>
          <span>★ <strong className="text-amber-400">{player.reputation}/20</strong></span>
          <span>¢ <strong className="text-[#a1d0c6]">{player.credits}/{player.creditCap}</strong></span>
          {player.creatorExhaustedThisTurn&&<span className="text-red-400 font-bold">EXHAUSTED</span>}
          {player.mods.ban&&<span className="text-red-400 font-bold">BANNED</span>}
        </div>
        {card.passive&&<div className="bg-[#a1d0c6]/5 border border-[#a1d0c6]/12 rounded-xl p-3">
          <p className="text-[8px] font-bold uppercase text-[#a1d0c6]/40 mb-1">◈ PASSIVE — {card.passive.name}</p>
          <p className="text-xs text-white/60 leading-relaxed">{card.passive.text}</p>
        </div>}
        {card.influence&&<div className="bg-[#a1d0c6]/5 border border-[#a1d0c6]/12 rounded-xl p-3">
          <p className="text-[8px] font-bold uppercase text-[#a1d0c6]/40 mb-1">◈ INFLUENCE — {card.influence.name}</p>
          <p className="text-xs text-white/60 leading-relaxed">{card.influence.text}</p>
        </div>}
        {card.favouritePrompt&&<div className="bg-green-500/5 border border-green-500/15 rounded-xl p-3">
          <p className="text-[8px] font-bold uppercase text-green-400/40 mb-1">✦ FAV PROMPT ({card.favouritePrompt.subtype})</p>
          <p className="text-xs italic text-white/45">{card.favouritePrompt.text}</p>
          <p className="text-[9px] text-green-400/55 mt-1">{card.favouritePrompt.effect}</p>
        </div>}
        {(card.abilities??[]).map((ab,i)=>{
          const nums=['','①','②','③'];
          const numStr=ab.num==='signature'?'⚡':(nums[Number(ab.num)]??String(ab.num));
          const costStr=[
            ab.cost?.reputation?`${ab.cost.reputation} Rep`:'',
            ab.cost?.loyalty?`${ab.cost.loyalty} Loyalty`:'',
            ab.cost?.credits?`${ab.cost.credits} Credits`:'',
          ].filter(Boolean).join(' + ')||'Free';
          const affordable = isMyTurn && canUseAbility(gs,'player',ab.num);
          return (
            <button key={i} onClick={()=>{if(affordable){onAbility(ab.num);onClose();}}}
              disabled={!affordable}
              className={`text-left p-3 rounded-xl border transition-all
                ${ab.num==='signature'?'border-red-500/35 bg-red-500/5':'border-white/10 bg-white/3'}
                ${affordable?'hover:bg-white/8 cursor-pointer':'opacity-40 cursor-not-allowed'}
              `}>
              <div className="flex justify-between mb-1">
                <span className="text-xs font-bold text-white">{numStr} {ab.name}</span>
                <span className="text-[9px] text-amber-400">{costStr}</span>
              </div>
              <p className="text-[9px] text-white/45 leading-relaxed">{ab.text}</p>
              {!affordable&&isMyTurn&&<p className="text-[8px] text-red-400/60 mt-1">Not enough resources or conditions not met</p>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Style picker (Algorithm Swap) ────────────────────────────
function StylePicker({chosen,onToggle,onConfirm,onCancel}:{
  chosen:StyleTag[]; onToggle:(s:StyleTag)=>void; onConfirm:()=>void; onCancel:()=>void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onCancel}>
      <div className="bg-[#181d1c] border border-[#a1d0c6]/20 rounded-2xl p-5 max-w-xs w-full mx-4" onClick={e=>e.stopPropagation()}>
        <h3 className="font-bold text-white mb-1">Algorithm Swap</h3>
        <p className="text-xs text-white/45 mb-4">Choose exactly 2 Style tags to swap.</p>
        <div className="flex gap-2 flex-wrap justify-center mb-4">
          {STYLES.map(s=>(
            <button key={s} onClick={()=>onToggle(s)}
              className={`px-3 py-2 rounded-xl border text-sm font-bold transition-all
                ${chosen.includes(s)?`border-current ${STYLE_CLR[s]} bg-white/10 scale-110`:'border-white/12 text-white/35 hover:border-white/25'}`}>
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onConfirm} disabled={chosen.length!==2}
            className="flex-1 py-2 bg-[#a1d0c6] text-[#033730] font-bold rounded-xl disabled:opacity-40 text-sm">
            Swap {chosen[0]??'?'} ↔ {chosen[1]??'?'}
          </button>
          <button onClick={onCancel} className="px-4 py-2 border border-white/12 text-white/40 rounded-xl text-sm">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Win screen with bubbles ──────────────────────────────────
function WinScreen({winner,creatorId,onPlayAgain}:{winner:PlayerId|'draw';creatorId:string;onPlayAgain:()=>void}) {
  const card=getCardById(creatorId);
  const playerWon=winner==='player';
  const isDraw=winner==='draw';
  const bubbles=Array.from({length:28},(_,i)=>({
    id:i, left:Math.random()*100, delay:Math.random()*3,
    dur:2.5+Math.random()*2, size:8+Math.random()*18,
  }));
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{background:`radial-gradient(ellipse at center,${playerWon?'#0d2a25':'#1a0a0a'},#000 70%)`}}>
      {/* Bubbles */}
      {bubbles.map(b=>(
        <div key={b.id} className="absolute rounded-full pointer-events-none"
          style={{
            left:`${b.left}%`, bottom:0, width:b.size, height:b.size,
            background:playerWon?'rgba(161,208,198,0.25)':'rgba(255,100,100,0.2)',
            border:`1px solid ${playerWon?'rgba(161,208,198,0.4)':'rgba(255,100,100,0.35)'}`,
            animation:`bubble-rise ${b.dur}s ${b.delay}s infinite ease-in`,
          }}/>
      ))}
      <style>{`
        @keyframes bubble-rise {
          0%   { transform: translateY(0) scale(1); opacity: .8; }
          80%  { opacity: .4; }
          100% { transform: translateY(-110vh) scale(.4); opacity: 0; }
        }
      `}</style>
      {/* Creator image placeholder */}
      <div className="relative mb-6 flex items-center justify-center rounded-full"
        style={{width:160,height:160,background:`radial-gradient(circle,${playerWon?'#a1d0c620':'#ff444420'},transparent)`,
          boxShadow:playerWon?'0 0 60px rgba(161,208,198,0.3)':'0 0 60px rgba(255,68,68,0.3)'}}>
        <span style={{fontSize:80}}>{playerWon?'🏆':isDraw?'🤝':'💀'}</span>
      </div>
      <h1 className="text-5xl font-black text-white mb-2" style={{textShadow:`0 0 40px ${playerWon?'#a1d0c6':'#ff6666'}`}}>
        {playerWon?'You Win!':isDraw?'Draw!':'AI Wins'}
      </h1>
      {card&&<p className="text-lg text-white/50 mb-8">{playerWon?`${card.name} triumphs`:`${card.name} was defeated`}</p>}
      <button onClick={onPlayAgain}
        className="px-10 py-4 bg-[#a1d0c6] text-[#033730] font-black rounded-2xl hover:brightness-110 active:scale-95 transition-all text-lg shadow-xl">
        Play Again →
      </button>
    </div>
  );
}

// ─── Deck Select ──────────────────────────────────────────────
function DeckSelect({onStart}:{onStart:(p:string,a:string)=>void}) {
  const decks=getAllDecks();
  const meta=loadMeta();
  const [chosen,setChosen]=useState(meta.lastDeck??decks[0]?.id??'deckA');
  const [showAll,setShowAll]=useState(false);
  const [preview,setPreview]=useState<string|null>(null);
  const [fav,setFav]=useState(meta.favDeck??'');
  function go(){saveMeta({...meta,lastDeck:chosen});const ai=chosen==='deckA'?'deckB':'deckA';onStart(chosen,ai);}
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center py-12 px-4 gap-6">
      <div className="text-center"><h1 className="text-3xl font-bold text-white mb-1">Choose Your Deck</h1><p className="text-white/35 text-sm">AI takes the opposing starter deck.</p></div>
      <div className="flex flex-col gap-2 w-full max-w-md">
        {meta.lastDeck&&(()=>{const d=decks.find(x=>x.id===meta.lastDeck);if(!d)return null;return(
          <button onClick={()=>setChosen(meta.lastDeck!)} className={`flex items-center gap-3 p-4 rounded-2xl border text-left transition-all ${chosen===meta.lastDeck?'border-[#a1d0c6] bg-[#a1d0c6]/10':'border-white/10 bg-white/5 hover:border-white/20'}`}>
            <span className="text-xl">🕑</span><div><p className="text-[8px] uppercase text-white/30">Last Used</p><p className="font-bold text-white">{d.name}</p></div>
          </button>
        );})()}
        {fav&&fav!==meta.lastDeck&&(()=>{const d=decks.find(x=>x.id===fav);if(!d)return null;return(
          <button onClick={()=>setChosen(fav)} className={`flex items-center gap-3 p-4 rounded-2xl border text-left transition-all ${chosen===fav?'border-[#a1d0c6] bg-[#a1d0c6]/10':'border-white/10 bg-white/5 hover:border-white/20'}`}>
            <span className="text-xl">⭐</span><div><p className="text-[8px] uppercase text-white/30">Favourite</p><p className="font-bold text-white">{d.name}</p></div>
          </button>
        );})()}
        <button onClick={()=>setShowAll(v=>!v)} className="flex items-center gap-3 p-4 rounded-2xl border border-white/10 bg-white/5 hover:border-white/20 transition-all">
          <span className="text-xl">📚</span><div className="flex-1 text-left"><p className="text-[8px] uppercase text-white/30">All Decks</p></div>
          <span className="text-white/25">{showAll?'▲':'▼'}</span>
        </button>
        {showAll&&decks.map(d=>(
          <div key={d.id} className="flex gap-2 pl-3">
            <button onClick={()=>setChosen(d.id)} className={`flex-1 p-3 rounded-xl border text-left ${chosen===d.id?'border-[#a1d0c6] bg-[#a1d0c6]/10':'border-white/8 bg-white/3 hover:border-white/15'}`}>
              <p className="text-sm font-bold text-white">{d.name}</p>
              <p className="text-[8px] text-white/30">{d.creator?getCardById(d.creator)?.name:'—'}</p>
            </button>
            <button onClick={()=>{setFav(d.id);saveMeta({...meta,favDeck:d.id});}} className={`text-lg ${fav===d.id?'text-amber-400':'text-white/15 hover:text-amber-400/50'}`}>⭐</button>
            <button onClick={()=>setPreview(preview===d.id?null:d.id)} className="text-white/25 hover:text-white text-sm">👁</button>
          </div>
        ))}
        {preview&&(()=>{const d=decks.find(x=>x.id===preview);if(!d)return null;return(
          <div className="p-3 rounded-xl border border-white/8 bg-white/3 text-xs max-h-40 overflow-y-auto">
            {Object.entries(d.cards).map(([id,cnt])=><div key={id} className="flex justify-between text-white/45 py-0.5"><span>{getCardById(id)?.name??id}</span><span>×{cnt}</span></div>)}
          </div>
        );})()}
      </div>
      <button onClick={go} className="px-8 py-3 bg-[#a1d0c6] text-[#033730] font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all">Start Game →</button>
    </div>
  );
}

// ─── Mulligan screen ──────────────────────────────────────────
function MulliganScreen({gs,onDecide}:{gs:GameState;onDecide:(m:boolean)=>void}) {
  const p=gs.players.player;
  const guaranteed=getAllDecks().find(d=>d.id===gs.playerDeckId)?.guaranteedModels??[];
  const models=p.hand.filter(id=>guaranteed.includes(id));
  const others=p.hand.filter(id=>!guaranteed.includes(id));
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center py-12 px-4 gap-6">
      <div className="text-center"><h1 className="text-2xl font-bold text-white">Opening Hand</h1><p className="text-white/35 text-sm mt-1">Models always stay. Mulligan redraws 6 cards.</p></div>
      {models.length>0&&<div className="text-center"><p className="text-[8px] uppercase text-[#a1d0c6]/45 tracking-widest mb-2">Guaranteed Models (kept)</p><div className="flex gap-2 justify-center flex-wrap">{models.map((id,i)=><HandCard key={i} id={id}/>)}</div></div>}
      <div className="text-center"><p className="text-[8px] uppercase text-white/25 tracking-widest mb-2">Drawn ({others.length})</p><div className="flex gap-2 justify-center flex-wrap max-w-2xl">{others.map((id,i)=><HandCard key={i} id={id}/>)}</div></div>
      <div className="flex gap-4">
        <button onClick={()=>onDecide(false)} className="px-6 py-3 border border-[#a1d0c6]/25 text-[#a1d0c6] rounded-xl hover:bg-[#a1d0c6]/8 font-bold">Keep Hand</button>
        <button onClick={()=>onDecide(true)} className="px-6 py-3 bg-[#cebefa]/12 text-[#cebefa] border border-[#cebefa]/25 rounded-xl hover:bg-[#cebefa]/20 font-bold">Mulligan → Draw 6</button>
      </div>
      <p className="text-[9px] text-white/20">AI is deciding…</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function ArenaBattlefield({onInGame,onExit}:Props) {
  const [gs,setGs]=useState<GameState|null>(null);
  const [pa,setPa]=useState<PA|null>(null);
  const [detailId,setDetail]=useState<string|null>(null);
  const [creatorOpen,setCreatorOpen]=useState(false);
  const [toasts,setToasts]=useState<Toast[]>([]);
  const [dragOver,setDragOver]=useState(false);
  const logRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{logRef.current?.scrollTo({top:9999,behavior:'smooth'});},[gs?.log]);
  useEffect(()=>{onInGame?.(!!gs&&gs.phase!=='gameover');},[gs?.phase]);

  const toast=useCallback((msg:string,type:Toast['type']='info')=>{
    const t=makeToast(msg,type);
    setToasts(prev=>[...prev.slice(-4),t]);
    setTimeout(()=>setToasts(prev=>prev.filter(x=>x.id!==t.id)),3500);
  },[]);

  function upd(s:GameState){setGs(s);return s;}

  function runAiAfter(s:GameState){
    if(s.phase!=='playing'||s.currentPlayer!=='ai') return;
    setTimeout(()=>{
      setGs(cur=>{
        if(!cur||cur.currentPlayer!=='ai') return cur;
        let a=runAiTurn(cur);
        if(a.phase==='playing'&&a.currentPlayer==='player'&&a.turnPhase==='refresh') a=runRefreshPhase(a);
        return a;
      });
    },750);
  }

  function startGame(p:string,a:string){
    const s=initGame(p,a);
    upd(s);
    onInGame?.(true);
  }

  function handleMulligan(doM:boolean){
    if(!gs) return;
    let s=applyMulligan(gs,'player',doM);
    s=aiDecideMulligan(s);
    if(s.phase==='playing'){s=runRefreshPhase(s);if(s.currentPlayer==='ai') runAiAfter(s);}
    upd(s);
  }

  function endTurn(){
    if(!gs||gs.currentPlayer!=='player') return;
    const p=gs.players.player;
    if(p.hand.length>7){setPa({kind:'discard',count:p.hand.length-7,selected:[]});return;}
    let s=runEndPhase(gs);
    if(s.phase==='gameover'){upd(s);return;}
    if(s.slotOverflowPending){upd(s);return;}
    s=runRefreshPhase(s);
    upd(s);
    runAiAfter(s);
  }

  function confirmDiscard(){
    if(!gs||pa?.kind!=='discard') return;
    if(pa.selected.length!==pa.count){toast(`Select ${pa.count} card(s) to discard`,'error');return;}
    let p={...gs.players.player};
    for(const id of pa.selected){const i=p.hand.indexOf(id);if(i!==-1){p.hand=[...p.hand.slice(0,i),...p.hand.slice(i+1)];p.discard=[...p.discard,id];}}
    let s={...gs,players:{...gs.players,player:p}};
    setPa(null);
    s=runEndPhase(s);
    if(s.phase==='gameover'){upd(s);return;}
    s=runRefreshPhase(s);
    upd(s);
    runAiAfter(s);
  }

  function resolveOverflow(existingId?:string){
    if(!gs) return;
    upd(resolveSlotOverflow(gs,existingId));
    setPa(null);
  }

  // ── Card initiation from hand ─────────────────────────────
  function initiateCard(cardId:string){
    if(!gs||gs.currentPlayer!=='player') return;
    const card=getCardById(cardId);
    if(!card) return;
    const p=gs.players.player;
    switch(card.type){
      case 'model':{
        const cost=card.playCost??0;
        if(p.credits<cost){toast('Not enough credits','error');return;}
        upd(playModel(gs,cardId));
        toast(`${card.name} placed in Shared Zone`,'effect');
        break;
      }
      case 'prompt':
        toast('Select a model in the Shared Zone, then add prompts','info');
        break;
      case 'modifier':{
        const spec=getTargetSpec(cardId);
        if(!spec){toast('Modifier needs no target — check card text','error');return;}
        setPa({kind:'target',spec:{...spec,cardId}});
        break;
      }
      case 'artifact':{
        if(cardId==='A-006'){setPa({kind:'styles',cardId,chosen:[]});return;}
        const spec=getTargetSpec(cardId);
        if(!spec){
          const s=playArtifact(gs,cardId);
          upd(s);
          toast(`${card.name} played`,'effect');
        } else {
          setPa({kind:'target',spec:{...spec,cardId}});
        }
        break;
      }
      case 'event':{
        if(gs.round<2&&cardId!=='E-001'){toast('Events cannot be played in Round 1','error');return;}
        if(cardId==='E-002'){
          upd(playEvent(gs,cardId));
          toast('Community Drama!','damage');
          return;
        }
        const spec=getTargetSpec(cardId);
        if(!spec){upd(playEvent(gs,cardId));toast(`${card.name} played`,'effect');}
        else setPa({kind:'target',spec:{...spec,cardId}});
        break;
      }
    }
    setDetail(null);
  }

  function executeTarget(){
    if(!gs||pa?.kind!=='target') return;
    const {spec}=pa;
    if(spec.maxTargets>1&&spec.selected.length===0){toast('Select at least one target','error');return;}
    const target=spec.selected[0];
    if(spec.cardId){
      const card=getCardById(spec.cardId);
      if(!card) return;
      switch(card.type){
        case 'modifier':
          if(spec.ownCreator||spec.oppCreator) upd(playModifier(gs,spec.cardId,target,'creator'));
          else if(spec.anyModel||spec.ownModel) upd(playModifier(gs,spec.cardId,target,'model'));
          else upd(playModifier(gs,spec.cardId,target,'creation'));
          break;
        case 'artifact': upd(playArtifact(gs,spec.cardId,target)); break;
        case 'event':    upd(playEvent(gs,spec.cardId,target)); break;
      }
      toast(`${card.name} applied`,'effect');
    } else if(spec.abilityNum!==undefined){
      upd(useCreatorAbility(gs,spec.abilityNum,spec.selected[0],spec.selected.slice(1)));
      toast('Ability used','effect');
    }
    setPa(null);
  }

  function confirmSwap(){
    if(!gs||pa?.kind!=='styles'||pa.chosen.length!==2) return;
    const [s1,s2]=pa.chosen as [StyleTag,StyleTag];
    upd(playArtifact(gs,pa.cardId,undefined,[s1,s2]));
    setPa(null);
    toast(`Algorithm Swap: ${s1} ↔ ${s2}`,'effect');
  }

  function onModel(m:ModelState){
    if(!gs) return;
    if(pa?.kind==='target'){
      const {spec}=pa;
      const it: 'own-model'|'opp-model'=m.ownerId==='player'?'own-model':'opp-model';
      if(!isValidTarget(spec,it,m,gs)){toast('Invalid target','error');return;}
      if(spec.cardId){
        const c=getCardById(spec.cardId);
        if(c?.type==='modifier'){upd(playModifier(gs,spec.cardId,m.instanceId,'model'));toast(`${c.name} applied`,'effect');}
        else if(c?.type==='event'){upd(playEvent(gs,spec.cardId,m.instanceId));toast(`${c.name} used`,'effect');}
        setPa(null);
      }
      return;
    }
    if(gs.currentPlayer!=='player'){toast('Not your turn','error');return;}
    if(m.activatedThisTurnBy!==null){toast('Already activated this turn','error');return;}
    const p=gs.players.player;
    if(!p.hasHadFirstTurn&&m.ownerId!=='player'){toast('Cannot use opponent models on your first turn','error');return;}
    if(p.queue.length>=2){toast('Queue full (max 2)','error');return;}
    setPa({kind:'activate',modelId:m.instanceId,prompts:[],useFav:false});
  }

  function confirmActivation(){
    if(!gs||pa?.kind!=='activate') return;
    const s=activateModel(gs,pa.modelId,pa.prompts,pa.useFav);
    upd(s);
    toast('Creation queued!','effect');
    setPa(null);
  }

  function onCreation(c:CreationState,side:PlayerId,isQ=false){
    if(!gs) return;
    if(gs.slotOverflowPending?.playerId==='player'&&side==='player'){resolveOverflow(c.instanceId);return;}
    if(pa?.kind==='target'){
      const {spec}=pa as {spec:TargetSpec&{_isClipLock?:boolean;_isRemix?:boolean}};
      if(spec._isClipLock&&side==='player'&&!isQ){
        if(c.modelId!=='M-001'){toast('Only Coherent (M-001) creations can be CLIP-LOCKed','error');return;}
        upd(applyClipLock(gs,c.instanceId));
        setPa(null); toast('CLIP-LOCK applied','effect'); return;
      }
      if(spec._isRemix&&side==='player'&&!isQ){
        if(c.clipLocked){toast('Cannot remix CLIP-LOCKed creation','error');return;}
        const stylePrompt=gs.players.player.hand.find(id=>{const cd=getCardById(id);return cd?.promptType==='Style'||cd?.promptType==='Artist';});
        const cost=stylePrompt?(getCardById(stylePrompt)?.cost??0):0;
        if(gs.players.player.credits<cost){toast('Not enough credits for remix','error');return;}
        upd(remixCreation(gs,c.instanceId,stylePrompt));
        setPa(null); toast('Creation sent to Remix Queue','effect'); return;
      }
      const it=side==='player'?(isQ?'own-queue':'own-active'):(isQ?'opp-queue':'opp-active');
      if(!isValidTarget(spec,it as any,c,gs)){toast('Invalid target','error');return;}
      const already=spec.selected.includes(c.instanceId);
      const newSel=already?spec.selected.filter(x=>x!==c.instanceId)
        :spec.selected.length<spec.maxTargets?[...spec.selected,c.instanceId]:spec.selected;
      if(spec.maxTargets===1&&newSel.length===1){
        const tgt=newSel[0];
        if(spec.cardId){
          const card=getCardById(spec.cardId);
          if(card?.type==='modifier') upd(playModifier(gs,spec.cardId,tgt,'creation'));
          else if(card?.type==='artifact') upd(playArtifact(gs,spec.cardId,tgt));
          else if(card?.type==='event') upd(playEvent(gs,spec.cardId,tgt));
          toast(`${card?.name} applied`,'effect');
        } else if(spec.abilityNum!==undefined){
          upd(useCreatorAbility(gs,spec.abilityNum,tgt));
          toast('Ability used','effect');
        }
        setPa(null);
      } else {
        setPa({...pa,spec:{...spec,selected:newSel}});
      }
      return;
    }
    setDetail(c.modelId);
  }

  function onCreator(side:PlayerId){
    if(!gs) return;
    if(pa?.kind==='target'){
      const {spec}=pa;
      const it=side==='player'?'own-creator':'opp-creator';
      if(!isValidTarget(spec,it,null,gs)){toast('Invalid target','error');return;}
      if(spec.cardId){
        const c=getCardById(spec.cardId);
        if(c?.type==='modifier'){upd(playModifier(gs,spec.cardId,side,'creator'));toast(`${c.name} applied`,'effect');}
        setPa(null);
      }
      return;
    }
    if(side==='player') setCreatorOpen(true);
    else setDetail(gs.players.ai.creatorId);
  }

  function triggerAbility(n:number|'signature'){
    if(!gs) return;
    const p=gs.players.player;
    const spec=getAbilitySpec(n,p.creatorId);
    if(!spec){
      const s=useCreatorAbility(gs,n);
      upd(s); toast('Ability used','effect'); return;
    }
    setPa({kind:'target',spec:{...spec,abilityNum:n}});
  }

  // ─── Glow / highlight helpers ─────────────────────────────
  function creationGlow(c:CreationState,side:PlayerId,isQ=false):boolean{
    if(!pa||pa.kind!=='target') return false;
    const sp=pa.spec as any;
    if(sp.selected?.includes(c.instanceId)) return true;
    const it=side==='player'?(isQ?'own-queue':'own-active'):(isQ?'opp-queue':'opp-active');
    return isValidTarget(sp,it,c,gs!);
  }
  function creatorGlow2(side:PlayerId):boolean{
    if(!pa||pa.kind!=='target') return false;
    const it=side==='player'?'own-creator':'opp-creator';
    return isValidTarget(pa.spec,it,null,gs!);
  }
  function modelGlow(m:ModelState):boolean{
    if(!pa||pa.kind!=='target') return false;
    const it=m.ownerId==='player'?'own-model':'opp-model';
    return isValidTarget(pa.spec,it,m,gs!);
  }

  // ─── Render ──────────────────────────────────────────────────
  if(!gs) return <DeckSelect onStart={startGame}/>;
  if(gs.phase==='mulligan') return <MulliganScreen gs={gs} onDecide={handleMulligan}/>;
  if(gs.phase==='gameover') return (
    <WinScreen winner={gs.winner??'draw'}
      creatorId={gs.players.player.creatorId}
      onPlayAgain={()=>{setGs(null);setPa(null);onInGame?.(false);}}
    />
  );

  const isPlayerTurn=gs.currentPlayer==='player';
  const player=gs.players.player;
  const ai=gs.players.ai;
  const glow=isPlayerTurn?creatorGlowColor(gs,'player'):'none';
  const maxPLoy=getCardById(player.creatorId)?.loyalty??11;
  const maxALoy=getCardById(ai.creatorId)?.loyalty??16;

  return (
    <div className="fixed inset-0 z-30 bg-[#0d1211] flex flex-col overflow-hidden">
      {/* ── Toasts ─────────────────────────────────────────── */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none" style={{minWidth:280}}>
        {toasts.map(t=>(
          <div key={t.id} className={`px-4 py-2.5 rounded-2xl text-sm font-bold shadow-xl border backdrop-blur-sm text-center
            ${t.type==='damage'?'bg-red-900/80 border-red-500/40 text-red-300'
              :t.type==='effect'?'bg-[#a1d0c6]/15 border-[#a1d0c6]/30 text-[#a1d0c6]'
              :t.type==='error'?'bg-amber-900/80 border-amber-500/40 text-amber-300'
              :'bg-[#1a1f1e]/90 border-white/15 text-white/70'}
          `} style={{animation:'slideDown .25s ease'}}>
            {t.msg}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes slideDown{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* Card detail modal */}
      {detailId&&<CardDetailModal id={detailId} onClose={()=>setDetail(null)}
        onPlay={()=>initiateCard(detailId)} canPlay={isPlayerTurn}
        playLabel={getCardById(detailId)?.type==='model'?'Place in Shared Zone':'Use This Card'}
      />}
      {pa?.kind==='styles'&&<StylePicker chosen={pa.chosen}
        onToggle={s=>setPa(p=>p?.kind==='styles'?{...p,chosen:p.chosen.includes(s)?p.chosen.filter(x=>x!==s):p.chosen.length<2?[...p.chosen,s]:p.chosen}:p)}
        onConfirm={confirmSwap} onCancel={()=>setPa(null)}/>}
      {creatorOpen&&<CreatorPanel creatorId={player.creatorId} player={player}
        isMyTurn={isPlayerTurn} gs={gs}
        onAbility={n=>{triggerAbility(n);}} onClose={()=>setCreatorOpen(false)}/>}

      {/* ── Board ─────────────────────────────────────────── */}
      <div
        className="flex flex-col gap-2 flex-1 overflow-y-auto p-2 max-w-[1280px] mx-auto w-full"
        onDragOver={e=>{e.preventDefault();if(!dragOver)setDragOver(true);}}
        onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setDragOver(false);}}
        onDrop={e=>{
          e.preventDefault();setDragOver(false);
          const cid=e.dataTransfer.getData('cardId');
          if(cid&&isPlayerTurn) initiateCard(cid);
        }}
      >

        {/* AI Zone */}
        <div className="bg-[#0d1211] border border-red-500/12 rounded-2xl p-3 shrink-0">
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <span className="text-[9px] text-red-400/50 font-bold uppercase shrink-0">AI — {getCardById(ai.creatorId)?.name}</span>
            <div className="flex-1 min-w-36"><LoyBar val={ai.loyalty} max={maxALoy} label="Loyalty"/></div>
            <div className="flex gap-3 text-[9px] text-white/35 ml-auto">
              <span>★{ai.reputation}</span><span>¢{ai.credits}/{ai.creditCap}</span><span>✋{ai.hand.length}</span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap items-start">
            {/* AI hand (face-down) */}
            <div className="flex gap-0.5">{ai.hand.map((_,i)=><div key={i} className="rounded bg-white/5 border border-white/8" style={{width:18,height:26}}/>)}</div>
            {/* AI creator */}
            <div onClick={()=>onCreator('ai')}
              className={`flex flex-col gap-1 px-3 py-2 rounded-xl border cursor-pointer transition-all bg-[#181d1c]/60 shrink-0
                ${creatorGlow2('ai')?'border-amber-400 bg-amber-400/10':'border-red-500/12 hover:border-red-500/30'}
              `}>
              <p className="text-[7px] text-red-400/45 uppercase">AI Creator</p>
              <p className="text-[9px] font-bold text-white">{getCardById(ai.creatorId)?.name}</p>
              <div className="flex gap-1 text-[7px] flex-wrap">
                {ai.mods.ban&&<span className="text-red-400">BANNED</span>}
                {ai.mods.astronaut&&<span className="text-blue-400">🚀{ai.mods.astronaut.turnsRemaining}t</span>}
                {ai.mods.proSub&&<span className="text-amber-400">PRO</span>}
              </div>
            </div>
            {/* AI queue */}
            {ai.queue.length>0&&<div className="flex flex-col gap-1">
              <span className="text-[7px] text-white/20 uppercase tracking-widest">Queue</span>
              <div className="flex gap-1.5 flex-wrap">{ai.queue.map(c=><CreationChip key={c.instanceId} c={c} glow={creationGlow(c,'ai',true)} onClick={()=>onCreation(c,'ai',true)}/>)}</div>
            </div>}
            {ai.remixQueue&&<CreationChip c={ai.remixQueue} onClick={()=>setDetail(ai.remixQueue!.modelId)} sublabel="Remixing…"/>}
            {/* AI active */}
            {ai.activeCreations.length>0&&<div className="flex flex-col gap-1">
              <span className="text-[7px] text-white/20 uppercase tracking-widest">Active</span>
              <div className="flex gap-1.5 flex-wrap">{ai.activeCreations.map(c=><CreationChip key={c.instanceId} c={c} glow={creationGlow(c,'ai')} onClick={()=>onCreation(c,'ai')}/>)}</div>
            </div>}
            {ai.activeCreations.length===0&&ai.queue.length===0&&!ai.remixQueue&&<div className="w-16 h-12 rounded-xl border border-dashed border-white/8 flex items-center justify-center"><span className="text-[7px] text-white/15">empty</span></div>}
          </div>
        </div>

        {/* Shared Zone */}
        <div className="bg-black/25 border border-white/6 rounded-2xl p-3 shrink-0">
          <div className="flex justify-between items-center flex-wrap gap-2 mb-2">
            <span className="text-[7px] uppercase tracking-widest text-white/20">Shared Zone</span>
            <div className="flex gap-3 text-[8px] text-white/30">
              <span>R{gs.round}</span><span>T{gs.absTurn}</span>
              <span className={`font-bold ${isPlayerTurn?'text-[#a1d0c6]':'text-orange-400'}`}>{isPlayerTurn?'YOUR TURN':'AI…'}</span>
            </div>
          </div>
          {/* Global effects */}
          <div className="flex gap-1.5 flex-wrap mb-2">
            {gs.serverOverloadRounds>0&&<span className="text-[7px] bg-red-500/12 text-red-400 border border-red-500/15 px-2 py-0.5 rounded-full">SERVER OVERLOAD {gs.serverOverloadRounds}r</span>}
            {gs.queueTimeoutRounds>0&&<span className="text-[7px] bg-orange-500/12 text-orange-400 border border-orange-500/15 px-2 py-0.5 rounded-full">QUEUE TIMEOUT {gs.queueTimeoutRounds}r</span>}
            {gs.centaurProblemRounds>0&&<span className="text-[7px] bg-purple-500/12 text-purple-400 border border-purple-500/15 px-2 py-0.5 rounded-full">CENTAUR PROBLEM {gs.centaurProblemRounds}r</span>}
            {gs.algorithmSwap&&<span className="text-[7px] bg-cyan-500/12 text-cyan-400 border border-cyan-500/15 px-2 py-0.5 rounded-full">ALGO SWAP: {gs.algorithmSwap.style1}↔{gs.algorithmSwap.style2}</span>}
            {gs.dailyChallengeAbstracts&&<span className="text-[7px] bg-orange-400/12 text-orange-300 border border-orange-400/15 px-2 py-0.5 rounded-full">DAILY: ABSTRACT</span>}
            {gs.dailyChallengePortraits&&<span className="text-[7px] bg-pink-400/12 text-pink-300 border border-pink-400/15 px-2 py-0.5 rounded-full">DAILY: PORTRAIT</span>}
          </div>
          <div className="flex gap-2 flex-wrap">
            {gs.sharedModels.length===0&&<span className="text-[8px] text-white/15">No models in play. Drag a model card to the drop zone below.</span>}
            {gs.sharedModels.map(m=><ModelChip key={m.instanceId} m={m} glow={modelGlow(m)}
              activating={pa?.kind==='activate'&&pa.modelId===m.instanceId}
              onClick={()=>onModel(m)} onInspect={()=>setDetail(m.cardId)}/>)}
          </div>
          {gs.artifacts.length>0&&<div className="flex gap-2 flex-wrap pt-2 border-t border-white/5 mt-2">
            {gs.artifacts.map(a=><div key={a.instanceId} onClick={()=>setDetail(a.cardId)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-purple-500/8 border border-purple-500/12 cursor-pointer hover:bg-purple-500/15 transition-all">
              <span className="text-[8px] text-purple-400">{getCardById(a.cardId)?.name}</span>
              <span className="text-[7px] text-white/25">{a.turnsRemaining}t</span>
            </div>)}
          </div>}
        </div>

        {/* Player Zone */}
        <div className="bg-[#0d1211] border border-[#a1d0c6]/18 rounded-2xl p-3 shrink-0">
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <span className="text-[9px] text-[#a1d0c6]/65 font-bold uppercase shrink-0">YOU</span>
            <div className="flex-1 min-w-36"><LoyBar val={player.loyalty} max={maxPLoy} label="Loyalty"/></div>
            <div className="flex gap-3 text-[9px] text-white/45 ml-auto">
              <span className="text-amber-400">★{player.reputation}/20</span>
              <span className="text-[#a1d0c6]">¢{player.credits}/{player.creditCap}</span>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap items-start">
            {/* Creator */}
            <div onClick={()=>onCreator('player')}
              className={`flex flex-col gap-1.5 p-3 rounded-2xl border cursor-pointer transition-all bg-[#181d1c]/80 shrink-0
                ${glow==='red'?'border-red-500/65 shadow-[0_0_18px_rgba(239,68,68,0.4)]'
                  :glow==='yellow'?'border-amber-400/65 shadow-[0_0_18px_rgba(250,204,21,0.3)]'
                  :'border-[#a1d0c6]/18 hover:border-[#a1d0c6]/35'}
                ${creatorGlow2('player')?'ring-2 ring-amber-400':''}
              `} style={{minWidth:118}}>
              <p className="text-[7px] text-[#a1d0c6]/35 uppercase font-bold">Creator</p>
              <p className="text-sm font-bold text-white leading-tight">{getCardById(player.creatorId)?.name}</p>
              <div className="flex gap-1 text-[7px] flex-wrap">
                {player.creatorExhaustedThisTurn&&<span className="text-red-400">EXHSTD</span>}
                {player.mods.ban&&<span className="text-red-400">BANNED</span>}
                {player.mods.astronaut&&<span className="text-blue-400">🚀{player.mods.astronaut.turnsRemaining}t</span>}
                {player.mods.proSub&&<span className="text-amber-400">PRO {player.mods.proSub.turnsRemaining}t</span>}
                {player.mods.trending&&<span className="text-green-400">TREND {player.mods.trending.roundsRemaining}r</span>}
              </div>
              {glow!=='none'&&<span className={`text-[7px] px-1.5 py-0.5 rounded font-bold mt-1
                ${glow==='red'?'bg-red-500/18 text-red-400':'bg-amber-400/18 text-amber-400'}`}>
                {glow==='red'?'⚡ ULT READY':'✦ ABILITY'}
              </span>}
              <p className="text-[7px] text-white/20">Click to open abilities</p>
            </div>
            {/* Favourite Prompt quick-reference */}
            {(()=>{
              const crd=getCardById(player.creatorId);
              const fp=crd?.favouritePrompt;
              if(!fp) return null;
              return (
                <div className="flex flex-col gap-1 p-2 rounded-xl border border-green-500/20 bg-green-500/5 shrink-0 cursor-help"
                  title={fp.effect} style={{maxWidth:110}}>
                  <p className="text-[7px] uppercase font-bold text-green-400/50">✦ Fav Prompt</p>
                  <p className="text-[8px] font-bold text-white/70 leading-tight line-clamp-2">{fp.text}</p>
                  <span className="text-[7px] bg-green-500/15 text-green-400 px-1 rounded self-start">{fp.subtype}</span>
                  <p className="text-[7px] text-white/35 leading-tight">{fp.effect}</p>
                </div>
              );
            })()}
            {/* Creations */}
            <div className="flex flex-col gap-2 flex-1">
              {(player.queue.length>0||player.remixQueue)&&<div>
                <span className="text-[7px] text-white/20 uppercase tracking-widest">Queue</span>
                <div className="flex gap-1.5 flex-wrap mt-1">
                  {player.queue.map(c=><CreationChip key={c.instanceId} c={c} glow={creationGlow(c,'player',true)} sublabel={`${c.runtime}t`} onClick={()=>onCreation(c,'player',true)}/>)}
                  {player.remixQueue&&<CreationChip c={player.remixQueue} sublabel="Remixing…" onClick={()=>onCreation(player.remixQueue!,'player')}/>}
                </div>
              </div>}
              <div>
                <span className="text-[7px] text-white/20 uppercase tracking-widest">Active</span>
                <div className="flex gap-1.5 flex-wrap mt-1">
                  {player.activeCreations.map(c=><CreationChip key={c.instanceId} c={c} glow={creationGlow(c,'player')||(gs.slotOverflowPending?.playerId==='player')} onClick={()=>onCreation(c,'player')}/>)}
                  {Array.from({length:Math.max(0,3-player.activeCreations.length)}).map((_,i)=><div key={i} className="rounded-xl border border-dashed border-white/6 flex items-center justify-center" style={{width:96,height:96}}><span className="text-[7px] text-white/15">Slot {player.activeCreations.length+i+1}</span></div>)}
                </div>
              </div>
            </div>
          </div>
          {gs.slotOverflowPending?.playerId==='player'&&(
            <div className="mt-2 bg-red-900/18 border border-red-500/25 rounded-xl p-3 flex items-center gap-3">
              <span className="text-sm text-red-400 font-bold">⚡ Slot Overflow!</span>
              <span className="text-xs text-white/45">Click a creation above to destroy it, or:</span>
              <button onClick={()=>resolveOverflow()} className="text-[9px] border border-red-500/25 text-red-400 px-2 py-1 rounded hover:bg-red-500/8 ml-auto">Reject Incoming (−1 Loyalty)</button>
            </div>
          )}
        </div>

        {/* ── Drag indicator + Action Banner ───────────────── */}
        <div className="flex flex-col gap-2 shrink-0">
          {dragOver&&(
            <div className="rounded-2xl border-2 border-dashed border-amber-400 bg-amber-400/8 py-3 text-sm text-amber-400 font-bold text-center animate-pulse">
              ⬇ Release to play this card
            </div>
          )}

          {pa?.kind==='activate'&&(
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <p className="text-sm font-bold text-amber-400">Activating: {getCardById(gs.sharedModels.find(m=>m.instanceId===pa.modelId)?.cardId??'')?.name??'—'}</p>
                <p className="text-[9px] text-white/35">Click prompt cards in your hand (max 2, different subtypes).</p>
                <div className="flex gap-1 mt-1">{pa.prompts.map(id=><span key={id} className="text-[9px] bg-green-400/18 text-green-400 px-1.5 py-0.5 rounded-full">{getCardById(id)?.name}</span>)}</div>
              </div>
              <div className="flex items-center gap-2 ml-auto flex-wrap">
                <label className="flex items-center gap-1 text-[9px] text-white/45 cursor-pointer">
                  <input type="checkbox" className="accent-amber-400" checked={pa.useFav} onChange={e=>setPa({...pa,useFav:e.target.checked})}/>
                  Fav Prompt
                </label>
                <button onClick={confirmActivation} className="px-3 py-1.5 bg-[#a1d0c6] text-[#033730] font-bold rounded-lg text-xs hover:brightness-110">Generate →</button>
                <button onClick={()=>setPa(null)} className="px-2 py-1.5 border border-white/12 text-white/35 rounded-lg text-xs">Cancel</button>
              </div>
            </div>
          )}

          {pa?.kind==='target'&&(()=>{
            const sp=pa.spec as any;
            const needsConfirm=sp.maxTargets>1;
            return (
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-bold text-amber-400">{sp.label}</p>
                  <p className="text-[9px] text-white/35">{needsConfirm?`Select up to ${sp.maxTargets} targets, then confirm.`:'Click a highlighted target on the board.'}</p>
                  <div className="flex gap-1 mt-1">{(sp.selected as string[]).map((_:string,i:number)=><span key={i} className="text-[9px] bg-amber-400/18 text-amber-400 px-1.5 py-0.5 rounded-full">✓ Target {i+1}</span>)}</div>
                </div>
                <div className="flex gap-2 ml-auto">
                  {needsConfirm&&sp.selected.length>0&&<button onClick={executeTarget} className="px-3 py-1.5 bg-amber-400 text-black font-bold rounded-lg text-xs">Confirm</button>}
                  <button onClick={()=>setPa(null)} className="px-2 py-1.5 border border-white/12 text-white/35 rounded-lg text-xs">Cancel</button>
                </div>
              </div>
            );
          })()}

          {pa?.kind==='discard'&&(
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <p className="text-sm font-bold text-red-400">Discard {pa.count} card(s) to end turn</p>
                <p className="text-[9px] text-white/35">Click cards below to select ({pa.selected.length}/{pa.count}).</p>
              </div>
              <button onClick={confirmDiscard} disabled={pa.selected.length!==pa.count}
                className="px-3 py-1.5 bg-red-500/28 text-red-300 font-bold rounded-lg text-xs disabled:opacity-35 ml-auto">
                Discard & End Turn
              </button>
            </div>
          )}

          {!pa&&!dragOver&&<p className="text-[8px] text-white/15 text-center">← Drag any card over the board to play it, or click first to inspect</p>}
        </div>

        {/* ── Hand ─────────────────────────────────────────── */}
        <div className="bg-[#0d1211] border border-white/6 rounded-2xl p-3 shrink-0">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <span className="text-[7px] uppercase tracking-widest text-white/20">Hand ({player.hand.length}) — drag to play zone or click to inspect</span>
            <div className="flex gap-2 flex-wrap items-center">
              {player.creatorId==='C-001'&&!player.clipLockAppliedThisTurn&&isPlayerTurn&&(
                <button onClick={()=>setPa({kind:'target',spec:{label:'Select your Coherent Creation to CLIP-LOCK',ownActive:true,selected:[],maxTargets:1,_isClipLock:true} as any})}
                  className="px-2 py-1.5 text-[9px] border border-cyan-400/25 text-cyan-400 rounded-lg hover:bg-cyan-400/8">🔒 CLIP-LOCK</button>
              )}
              {player.activeCreations.length>0&&!player.remixQueue&&isPlayerTurn&&(
                <button onClick={()=>setPa({kind:'target',spec:{label:'Select a Creation to Remix',ownActive:true,notClipLocked:true,selected:[],maxTargets:1,_isRemix:true} as any})}
                  className="px-2 py-1.5 text-[9px] border border-orange-400/25 text-orange-400 rounded-lg hover:bg-orange-400/8">🔄 Remix</button>
              )}
              {onExit&&<button onClick={onExit} className="px-2 py-1.5 text-[9px] border border-white/10 text-white/30 rounded-lg hover:bg-white/5">← Exit</button>}
              {isPlayerTurn?(
                <button onClick={endTurn} disabled={!!gs.slotOverflowPending}
                  className="px-4 py-1.5 text-xs font-bold bg-[#a1d0c6] text-[#033730] rounded-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-35">
                  End Turn →
                </button>
              ):(
                <span className="px-4 py-1.5 text-[9px] text-white/20 border border-white/8 rounded-lg">AI thinking…</span>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap items-end">
            {player.hand.map((id,i)=>{
              const card=getCardById(id);
              const isPromptMode=pa?.kind==='activate';
              const inPromptSel=pa?.kind==='activate'&&pa.prompts.includes(id);
              const inDiscardSel=pa?.kind==='discard'&&pa.selected.includes(id);
              const dim=!isPlayerTurn||(isPromptMode&&card?.type!=='prompt')||(pa?.kind==='target');
              return (
                <HandCard key={`${id}-${i}`} id={id}
                  selected={inPromptSel||inDiscardSel}
                  dim={!isPlayerTurn||(pa?.kind==='target'&&!inPromptSel&&!inDiscardSel)}
                  onDragStart={()=>{}}
                  onClick={()=>{
                    if(!isPlayerTurn){setDetail(id);return;}
                    if(pa?.kind==='activate'&&card?.type==='prompt'){
                      const usedSubs=pa.prompts.map(x=>getCardById(x)?.promptType??'');
                      const sub=card.promptType??'';
                      if(pa.prompts.includes(id)){setPa({...pa,prompts:pa.prompts.filter(x=>x!==id)});return;}
                      if(usedSubs.includes(sub)){toast(`Already using a ${sub} prompt`,'error');return;}
                      if(pa.prompts.length>=2){toast('Max 2 prompts','error');return;}
                      setPa({...pa,prompts:[...pa.prompts,id]});return;
                    }
                    if(pa?.kind==='discard'){
                      const s=pa.selected.includes(id)?pa.selected.filter(x=>x!==id):pa.selected.length<pa.count?[...pa.selected,id]:pa.selected;
                      setPa({...pa,selected:s});return;
                    }
                    setDetail(id);
                  }}
                  onInspect={()=>setDetail(id)}
                />
              );
            })}
            {player.hand.length===0&&<p className="text-[9px] text-white/15">No cards in hand.</p>}
          </div>
        </div>

        {/* ── Log ─────────────────────────────────────────── */}
        <div ref={logRef} className="bg-black/25 border border-white/6 rounded-2xl p-3 max-h-24 overflow-y-auto shrink-0">
          <p className="text-[7px] uppercase tracking-widest text-white/18 mb-1">Log</p>
          {gs.log.slice(-30).map(e=>(
            <p key={e.id} className={`text-[8px] leading-relaxed ${
              e.type==='damage'?'text-red-400/70':e.type==='system'?'text-[#a1d0c6]/50 font-semibold':
              e.type==='effect'?'text-[#cebefa]/55':e.type==='ai'?'text-orange-400/55':'text-white/35'}`}>
              {e.msg}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
