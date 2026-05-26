import { useState, useEffect, useRef } from 'react';
import { ALL_CARDS, PREBUILT_DECKS } from '../data';
import { FORMS, FIELDS } from '../config';
import { submitToGoogleForm } from '../utils/forms';
import type { Card } from '../types';
import { X, ExternalLink } from 'lucide-react';
import { linkTerms } from './GlossaryTooltip';

// ── Colour maps ───────────────────────────────────────────────
const RARITY_COLOR: Record<string, string> = {
  common: 'text-[#8a9490]', uncommon: 'text-[#4a9a6e]',
  rare: 'text-[#a1d0c6]',   mythic:   'text-[#cebefa]',
};
const TYPE_COLOR: Record<string, string> = {
  creator:  'border-[#a1d0c6]/60 bg-[#a1d0c6]/10',
  model:    'border-[#cebefa]/40 bg-[#cebefa]/10',
  prompt:   'border-[#4a9a6e]/40 bg-[#4a9a6e]/10',
  modifier: 'border-[#b8842a]/40 bg-[#b8842a]/10',
  artifact: 'border-[#9b3dbb]/40 bg-[#9b3dbb]/10',
  event:    'border-[#3d6abb]/40 bg-[#3d6abb]/10',
};
export const MOOD_GRAD: Record<string, string> = {
  iridescent:  'from-purple-900/40 via-teal-900/30 to-amber-900/20',
  chaotic:     'from-red-900/30 via-purple-900/20 to-green-900/20',
  precise:     'from-blue-900/30 to-teal-900/20',
  bold:        'from-orange-900/30 to-amber-900/20',
  neutral:     'from-slate-800/60 to-slate-900/40',
  grainy:      'from-stone-800/50 to-stone-900/40',
  epic:        'from-amber-900/40 to-yellow-900/20',
  generic:     'from-rose-900/30 to-pink-900/20',
  layered:     'from-green-900/30 to-teal-900/20',
  guilty:      'from-amber-900/30 to-stone-900/30',
  intense:     'from-orange-900/40 to-red-900/20',
  absurd:      'from-green-900/30 to-emerald-900/20',
  ironic:      'from-indigo-900/30 to-purple-900/20',
  pastoral:    'from-green-900/40 to-lime-900/20',
  surreal:     'from-violet-900/40 to-rose-900/20',
  isolated:    'from-blue-900/30 to-slate-900/30',
  bright:      'from-yellow-900/30 to-amber-900/20',
  painterly:   'from-stone-800/40 to-amber-900/20',
  hyperreal:   'from-green-900/20 to-slate-900/30',
  rising:      'from-yellow-900/30 to-amber-900/20',
  severe:      'from-red-900/40 to-rose-900/20',
  premium:     'from-yellow-700/30 to-amber-800/30',
  spotlight:   'from-yellow-800/40 to-amber-900/30',
  urgent:      'from-blue-900/40 to-slate-900/30',
  corrupted:   'from-slate-800/60 to-gray-900/50',
  frozen:      'from-blue-900/40 to-cyan-900/20',
  confused:    'from-orange-900/30 to-stone-900/30',
  celebratory: 'from-yellow-800/50 to-amber-700/30',
  catastrophic:'from-red-900/50 to-orange-900/30',
  collective:  'from-blue-900/30 to-indigo-900/20',
  sneaky:      'from-slate-800/50 to-indigo-900/20',
  efficient:   'from-green-900/30 to-teal-900/20',
  energetic:   'from-yellow-900/40 to-amber-900/30',
  disruptive:  'from-red-900/30 to-orange-900/20',
  warm:        'from-amber-900/30 to-orange-900/20',
  abrupt:      'from-slate-800/40 to-blue-900/20',
  competitive: 'from-stone-800/30 to-amber-900/20',
};
function moodGrad(c: Card) {
  return MOOD_GRAD[c.illustrationMood ?? 'neutral'] ?? MOOD_GRAD.neutral;
}

// ── Mini card ─────────────────────────────────────────────────
function MiniCard({ card, onClick }: { card: Card; onClick: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: React.MouseEvent) {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width  - 0.5;
    const y = (e.clientY - r.top)  / r.height - 0.5;
    el.style.transform = `perspective(600px) rotateY(${x*20}deg) rotateX(${-y*20}deg) scale(1.05)`;
    const sh = el.querySelector<HTMLElement>('.card-shine');
    if (sh) sh.style.background = `radial-gradient(circle at ${(x+.5)*100}% ${(y+.5)*100}%, rgba(255,255,255,.15), transparent 65%)`;
  }
  function onLeave() {
    const el = ref.current; if (!el) return;
    el.style.transform = '';
    const sh = el.querySelector<HTMLElement>('.card-shine');
    if (sh) sh.style.background = 'none';
  }

  const cost =
    card.type === 'creator' ? null
    : card.type === 'model'  ? `P${card.playCost ?? 0} / A${card.activateCost ?? 0}`
    : card.cost !== undefined ? `${card.cost}${card.costType === 'reputation' ? ' Rep' : ' Cr'}`
    : null;

  return (
    <div ref={ref} onClick={onClick} onMouseMove={onMove} onMouseLeave={onLeave}
      style={{ transformStyle:'preserve-3d', willChange:'transform', transition:'transform 0.15s ease' }}
      className="relative bg-[#1c2120]/60 border border-[#a1d0c6]/10 hover:border-[#a1d0c6]/30 rounded-2xl overflow-hidden cursor-pointer group shadow-lg hover:shadow-[0_0_30px_rgba(161,208,198,0.12)] flex flex-col">
      <div className="card-shine absolute inset-0 rounded-2xl pointer-events-none z-10 transition-all" />
      <div className={`absolute top-0 inset-x-0 h-1 ${TYPE_COLOR[card.type].split(' ')[0].replace('border-','bg-').replace('/60','').replace('/40','')}`} />
      <div className={`relative w-full aspect-square bg-gradient-to-br ${moodGrad(card)} flex items-end p-2`}>
        <span className="text-[10px] italic text-[#c0c8c5]/40 leading-tight line-clamp-3">{card.illustration}</span>
        <div className="absolute top-2 right-2 flex gap-1">
          {Array.from({ length: card.rarityDots }).map((_, i) => (
            <span key={i} className={`w-1.5 h-1.5 rounded-full ${RARITY_COLOR[card.rarity].replace('text-','bg-')}`} />
          ))}
        </div>
      </div>
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <div className="flex items-start justify-between gap-1">
          <p className="text-xs font-bold text-[#dfe3e1] leading-tight group-hover:text-[#a1d0c6] transition-colors line-clamp-1">{card.name}</p>
          {cost && <span className="text-[10px] font-mono text-[#cebefa] shrink-0">{cost}</span>}
          {card.type === 'creator' && card.loyalty && <span className="text-[10px] font-mono text-[#a1d0c6] shrink-0">{card.loyalty} LOY</span>}
        </div>
        <p className="text-[10px] text-[#c0c8c5]/50 uppercase tracking-widest font-bold">{card.subtype || card.type}</p>
        <div className={`text-[10px] px-2 py-0.5 rounded-full border w-fit font-semibold uppercase tracking-wider ${TYPE_COLOR[card.type]}`}>{card.type}</div>
      </div>
    </div>
  );
}

// ── Ability block (modal) ─────────────────────────────────────
interface AbLike { num?: number | 'signature'; name: string; text: string; cost?: { loyalty?: number; reputation?: number; credits?: number }; _label?: string; }
function AbilityBlock({ ab, isPassive = false }: { ab: AbLike; isPassive?: boolean }) {
  const isSig = ab.num === 'signature';
  const costStr = isPassive || ab._label ? (ab._label ?? 'Passive')
    : [ab.cost?.loyalty && `${ab.cost.loyalty} Loyalty`, ab.cost?.reputation && `${ab.cost.reputation} Rep`, ab.cost?.credits && `${ab.cost.credits} Cr`].filter(Boolean).join(' · ');
  return (
    <div className={`rounded-xl p-3 border ${isSig ? 'border-[#a1d0c6]/40 bg-[#a1d0c6]/5' : 'border-[#dfe3e1]/5 bg-[#0d1211]/40'}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${isSig ? 'bg-[#a1d0c6] text-[#033730]' : 'bg-[#262b2a] text-[#a1d0c6]'}`}>
          {isSig ? '⚡' : isPassive ? '◈' : ab.num}
        </span>
        <span className="text-sm font-bold text-[#dfe3e1]">{ab.name}</span>
        {costStr && <span className="ml-auto text-[10px] font-mono text-[#c0c8c5]/50">{costStr}</span>}
      </div>
      <p className="text-xs text-[#c0c8c5] leading-relaxed" dangerouslySetInnerHTML={{ __html: linkTerms(ab.text) }} />
    </div>
  );
}

// ── Stat chip ─────────────────────────────────────────────────
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#0d1211]/60 border border-[#dfe3e1]/5 rounded-lg px-3 py-1.5 flex flex-col items-center min-w-[52px]">
      <span className="text-[9px] font-bold uppercase tracking-widest text-[#c0c8c5]/40">{label}</span>
      <span className="text-sm font-bold font-mono text-[#dfe3e1]">{value}</span>
    </div>
  );
}
function SecTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#a1d0c6]/60 border-b border-[#dfe3e1]/5 pb-1">{children}</h4>;
}

// ── Card detail modal ─────────────────────────────────────────
function CardModal({ card, onClose }: { card: Card; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  async function handleTry() {
    const text = (card.favouritePrompt?.text ?? '').replace(/^["']|["']$/g, '').trim();
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
    setCopied(true);
    setTimeout(() => { setCopied(false); window.open('https://creator.nightcafe.studio/studio?ru=aia', '_blank'); }, 1000);
  }

  const abList: AbLike[] = [
    card.passive   ? { ...card.passive,   _label: 'Passive',   num: undefined } : null,
    card.influence ? { ...card.influence, _label: 'Influence', num: undefined } : null,
    ...(card.abilities ?? []),
  ].filter((x): x is AbLike => x !== null);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1c2120] border border-[#a1d0c6]/15 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header strip */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#dfe3e1]/5 shrink-0">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${TYPE_COLOR[card.type]}`}>{card.type}</span>
            <span className={`text-[10px] font-mono ${RARITY_COLOR[card.rarity]}`}>{card.rarity}</span>
            <span className="text-[10px] font-mono text-[#c0c8c5]/30">{card.id}</span>
          </div>
          <button onClick={onClose} className="text-[#c0c8c5]/40 hover:text-[#dfe3e1] p-1 rounded-lg hover:bg-white/5"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex overflow-y-auto flex-1">
          {/* Art panel */}
          <div className={`w-44 shrink-0 bg-gradient-to-br ${moodGrad(card)} flex flex-col justify-between p-3`}>
            <div className="flex gap-0.5">
              {Array.from({ length: card.rarityDots }).map((_, i) => (
                <span key={i} className={`w-2 h-2 rounded-full ${RARITY_COLOR[card.rarity].replace('text-','bg-')}`} />
              ))}
            </div>
            <p className="text-[10px] italic text-[#c0c8c5]/50 leading-tight">{card.illustration}</p>
            <p className="text-[9px] font-mono text-[#c0c8c5]/20 mt-2">SET 001 · Prompt Battle</p>
          </div>

          {/* Info panel */}
          <div className="flex-1 p-5 space-y-4 overflow-y-auto min-w-0">
            <div>
              <h2 className="text-2xl font-bold text-[#dfe3e1] leading-tight">{card.name}</h2>
              <p className="text-xs text-[#c0c8c5]/50 italic mt-0.5">{card.subtype}</p>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-2">
              {card.type === 'creator' && <>
                <Stat label="Loyalty" value={String(card.loyalty)} />
                <Stat label="Bonus"   value={card.startingBonus?.display ?? ''} />
              </>}
              {card.type === 'model' && <>
                <Stat label="Play"     value={String(card.playCost ?? 0)} />
                <Stat label="Activate" value={String(card.activateCost ?? 0)} />
                <Stat label="Quality"  value={String(card.quality ?? 0)} />
                <Stat label="Runtime"  value={String(card.runtime ?? 0)} />
              </>}
              {card.cost !== undefined && card.type !== 'creator' && card.type !== 'model' && <>
                <Stat label="Cost"     value={`${card.cost}${card.costType === 'reputation' ? ' Rep' : ' Cr'}`} />
                {card.duration && <Stat label="Duration" value={card.duration} />}
                {card.timing   && <Stat label="Timing"   value={card.timing} />}
              </>}
            </div>

            {/* Compatibility */}
            {(card.compatible?.length || card.incompatible?.length) && (
              <div className="flex flex-wrap gap-1.5">
                {card.compatible?.map(s  => <span key={s} className="text-[10px] px-2 py-0.5 rounded-full border border-green-500/30 text-green-400 bg-green-500/10">✔ {s}</span>)}
                {card.incompatible?.map(s => <span key={s} className="text-[10px] px-2 py-0.5 rounded-full border border-red-500/30 text-red-400 bg-red-500/10">✘ {s}</span>)}
              </div>
            )}

            {/* Deck badges */}
            <div className="flex flex-wrap gap-1.5">
              {card.inDecks.deckA > 0 && <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#a1d0c6]/10 text-[#a1d0c6] border border-[#a1d0c6]/20">×{card.inDecks.deckA} Aia Deck</span>}
              {card.inDecks.deckB > 0 && <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#cebefa]/10 text-[#cebefa] border border-[#cebefa]/20">×{card.inDecks.deckB} Anon Deck</span>}
            </div>

            {/* Abilities */}
            {abList.length > 0 && (
              <div className="space-y-2">
                <SecTitle>Abilities</SecTitle>
                {abList.map((ab, i) => <AbilityBlock key={i} ab={ab} isPassive={!!ab._label} />)}
              </div>
            )}

            {/* Favourite prompt */}
            {card.favouritePrompt && (
              <div className="space-y-2">
                <SecTitle>Favourite Prompt</SecTitle>
                <div className="rounded-xl p-3 border border-[#dfe3e1]/5 bg-[#0d1211]/40">
                  <div className="flex items-start gap-2 mb-1.5">
                    <span className="w-5 h-5 rounded-full bg-[#262b2a] text-[#a1d0c6] flex items-center justify-center text-[10px] shrink-0">✦</span>
                    <span className="text-xs text-[#dfe3e1] font-mono leading-relaxed">{card.favouritePrompt.text}</span>
                  </div>
                  <p className="text-xs text-[#c0c8c5] leading-relaxed pl-7 mb-2">{card.favouritePrompt.effect}</p>
                  <button onClick={handleTry}
                    className="ml-7 flex items-center gap-1.5 text-[10px] font-semibold text-[#a1d0c6] border border-[#a1d0c6]/30 rounded-lg px-2.5 py-1 hover:bg-[#a1d0c6]/10 transition-all">
                    <ExternalLink className="w-3 h-3" />
                    {copied ? 'Copied! Redirecting…' : 'Try on NightCafe'}
                  </button>
                </div>
              </div>
            )}

            {/* Effect */}
            {card.effect && (
              <div className="space-y-2">
                <SecTitle>Effect</SecTitle>
                {card.effect.split('\n\n').map((block, i) => (
                  <p key={i} className="text-xs text-[#c0c8c5] leading-relaxed" dangerouslySetInnerHTML={{ __html: linkTerms(block) }} />
                ))}
              </div>
            )}

            {card.attachesTo     && <div className="space-y-1"><SecTitle>Attaches To</SecTitle><p className="text-xs text-[#c0c8c5]">{card.attachesTo}</p></div>}
            {card.compatibleModels && <div className="space-y-1"><SecTitle>Compatible Models</SecTitle><p className="text-xs text-[#c0c8c5]">{card.compatibleModels}</p></div>}
            {card.deckLimit      && <p className="text-[10px] font-mono text-[#c0c8c5]/40">⚑ Deck limit: {card.deckLimit}</p>}
            {card.flavourText    && <p className="text-xs italic text-[#c0c8c5]/40 border-t border-[#dfe3e1]/5 pt-3">"{card.flavourText}"</p>}
            {card.creatorNotes   && <p className="text-xs italic text-[#c0c8c5]/40">"{card.creatorNotes}"</p>}
            {card.designNote     && <p className="text-[10px] font-mono text-[#a1d0c6]/50 bg-[#a1d0c6]/5 rounded-lg px-3 py-2">⚑ {card.designNote}</p>}

            {/* Vote link */}
            {card.type === 'creator' && (
              <button className="text-[10px] font-semibold text-[#cebefa]/60 hover:text-[#cebefa] border border-[#cebefa]/10 hover:border-[#cebefa]/30 rounded-lg px-3 py-1.5 transition-all">
                🗳 See design vote alternatives
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── By-Deck view ──────────────────────────────────────────────
function ByDeckView({ onSelectCard }: { onSelectCard: (c: Card) => void }) {
  return (
    <div className="space-y-10">
      {PREBUILT_DECKS.map(deck => {
        const deckCards = ALL_CARDS.filter(c => (c.inDecks[deck.id as 'deckA' | 'deckB'] ?? 0) > 0);
        return (
          <div key={deck.id}>
            <div className="mb-4 pb-3 border-b border-[#dfe3e1]/5">
              <h3 className="text-xl font-bold text-[#dfe3e1]">{deck.name}</h3>
              <p className="text-sm text-[#c0c8c5]/60 mt-0.5">{deck.subtitle}</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {deckCards.map(c => <MiniCard key={c.id} card={c} onClick={() => onSelectCard(c)} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Votes view ────────────────────────────────────────────────
interface VoteOption { label: string; description: string; image?: string; }
interface VoteQuestion { id: string; cardId: string; question: string; optionA: VoteOption; optionB: VoteOption; }
interface VoteRecord   { id: string; cardId: string; chosen: string; }

function VotesView() {
  const [votes,   setVotes]   = useState<VoteQuestion[]>([]);
  const [done,    setDone]    = useState<VoteRecord[]>(() => JSON.parse(localStorage.getItem('pb_votes_done') ?? '[]'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/data/votes.json')
      .then(r => r.json())
      .then((data: VoteQuestion[]) => { setVotes(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function castVote(voteId: string, chosen: string, rejected: string, cardId: string) {
    submitToGoogleForm(FORMS.VOTE, {
      [FIELDS.VOTE.id]:       voteId,
      [FIELDS.VOTE.cardId]:   cardId,
      [FIELDS.VOTE.chosen]:   chosen,
      [FIELDS.VOTE.rejected]: rejected,
      [FIELDS.VOTE.handle]:   localStorage.getItem('pb_handle') ?? '',
    });
    const updated: VoteRecord[] = [...done, { id: voteId, cardId, chosen }];
    localStorage.setItem('pb_votes_done', JSON.stringify(updated));
    setDone(updated);
  }

  if (loading) return <div className="text-center py-12 text-[#c0c8c5]/40">Loading votes…</div>;
  if (!votes.length) return <div className="text-center py-12 text-[#c0c8c5]/40 italic">No active design votes right now. Check back soon.</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      {votes.map(v => {
        const voted = done.find(d => d.id === v.id);
        const card  = ALL_CARDS.find(c => c.id === v.cardId);
        return (
          <div key={v.id} className="bg-[#1c2120]/60 border border-[#a1d0c6]/10 rounded-2xl p-5 space-y-4">
            <div>
              <p className="text-[10px] font-mono text-[#a1d0c6]/50 uppercase tracking-widest">{card?.name ?? v.cardId} · Design Vote</p>
              <p className="text-base font-semibold text-[#dfe3e1] mt-1">{v.question}</p>
            </div>
            {voted ? (
              <p className="text-sm text-[#a1d0c6]/70 italic">✓ You voted: <strong>{voted.chosen}</strong> — thanks!</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(['A', 'B'] as const).map(side => {
                  const opt   = v[`option${side}`];
                  const other = v[side === 'A' ? 'optionB' : 'optionA'];
                  return (
                    <button key={side} onClick={() => castVote(v.id, opt.label, other.label, v.cardId)}
                      className="text-left bg-[#0d1211]/60 border-2 border-[#dfe3e1]/5 hover:border-[#a1d0c6]/40 hover:bg-[#a1d0c6]/5 rounded-xl p-4 transition-all group">
                      {opt.image && <img src={opt.image} alt={opt.label} className="w-full rounded-lg mb-3 object-cover aspect-video" />}
                      <p className="font-bold text-sm text-[#dfe3e1] group-hover:text-[#a1d0c6] mb-1">{opt.label}</p>
                      <p className="text-xs text-[#c0c8c5]/60 leading-relaxed">{opt.description}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main gallery ──────────────────────────────────────────────
type ViewTab = 'gallery' | 'bydeck' | 'votes';

export default function CardGallery() {
  const [filter,     setFilter]     = useState('all');
  const [search,     setSearch]     = useState('');
  const [selected,   setSelected]   = useState<Card | null>(null);
  const [activeView, setActiveView] = useState<ViewTab>('gallery');

  const TYPES = ['all','creator','model','prompt','modifier','artifact','event'] as const;

  const filtered = ALL_CARDS.filter(c => {
    if (filter !== 'all' && c.type !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q)
        || c.id.toLowerCase().includes(q)
        || (c.effect ?? '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-8 animate-fade-in py-12">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-4xl font-bold text-[#dfe3e1]">Card Index</h1>
          <div className="flex gap-1 bg-[#1c2120]/60 rounded-xl p-1 border border-[#dfe3e1]/5">
            {(['gallery','bydeck','votes'] as const).map(v => (
              <button key={v} onClick={() => setActiveView(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${activeView === v ? 'bg-[#a1d0c6]/20 text-[#a1d0c6]' : 'text-[#c0c8c5]/50 hover:text-[#c0c8c5]'}`}>
                {v === 'gallery' ? 'Gallery' : v === 'bydeck' ? 'By Deck' : 'Votes'}
              </button>
            ))}
          </div>
        </div>

        {activeView !== 'votes' && (
          <div className="flex flex-wrap gap-2 items-center">
            {TYPES.map(t => (
              <button key={t} onClick={() => setFilter(t)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider border transition-all ${filter === t ? 'bg-[#a1d0c6]/20 text-[#a1d0c6] border-[#a1d0c6]/30' : 'border-transparent text-[#c0c8c5]/50 hover:text-[#c0c8c5] hover:bg-white/5'}`}>
                {t === 'all' ? `All (${ALL_CARDS.length})` : t}
              </button>
            ))}
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search cards…"
              className="ml-auto bg-[#1c2120]/60 border border-[#a1d0c6]/15 focus:border-[#a1d0c6]/40 rounded-xl px-3 py-1.5 text-xs text-[#dfe3e1] placeholder-[#c0c8c5]/30 outline-none w-44" />
          </div>
        )}
      </header>

      {activeView === 'gallery' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filtered.map(c => <MiniCard key={c.id} card={c} onClick={() => setSelected(c)} />)}
          {!filtered.length && <p className="col-span-full text-center text-[#c0c8c5]/40 py-12">No cards match.</p>}
        </div>
      )}

      {activeView === 'bydeck'  && <ByDeckView onSelectCard={setSelected} />}
      {activeView === 'votes'   && <VotesView />}

      {selected && <CardModal card={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
