import { useState, useEffect, useCallback } from 'react';
import { Plus, Save, X, ChevronLeft, Copy } from 'lucide-react';
import { MOOD_GRAD } from './CardGallery';
import { ALL_CARDS, PREBUILT_DECKS, DECK_BUILD_RULES, getCardById } from '../data';
import type { Card, CustomDeck, DecksStore, PrebuiltDeck } from '../types';
import { submitToGoogleForm, getHandle, setHandle } from '../utils/forms';
import { FORMS, FIELDS } from '../config';

// ── localStorage helpers ──────────────────────────────────────
const STORE_KEY = 'pb_decks';
function loadStore(): DecksStore {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{"version":1,"decks":[]}'); }
  catch { return { version: 1, decks: [] }; }
}
function saveStore(s: DecksStore) { localStorage.setItem(STORE_KEY, JSON.stringify(s)); }

// ── Validation ────────────────────────────────────────────────
function validateDeck(d: CustomDeck): string[] {
  const errs: string[] = [];
  if (!d.creator)                   errs.push('No creator selected');
  if (d.guaranteedModels.length < 2) errs.push(`Need ${2 - d.guaranteedModels.length} more guaranteed model(s)`);
  const total = Object.values(d.cards).reduce((a, b) => a + b, 0);
  if (total !== 37)                 errs.push(`Shuffled deck: ${total}/37 cards`);
  for (const [id, cnt] of Object.entries(d.cards)) {
    const c = getCardById(id);
    if (cnt > (c?.deckLimit ?? 3))  errs.push(`${c?.name ?? id}: max ${c?.deckLimit ?? 3} copies`);
  }
  return errs;
}

// ── Tiny card strip (sidebar list item) ──────────────────────
function DeckSlot({ card, count, onRemove, fixed = false }: { card: Card; count: number; onRemove?: () => void; fixed?: boolean }) {
  const typeColor: Record<string, string> = {
    creator:'bg-[#a1d0c6]/20 text-[#a1d0c6]', model:'bg-[#cebefa]/20 text-[#cebefa]',
    prompt:'bg-green-500/20 text-green-400', modifier:'bg-amber-500/20 text-amber-400',
    artifact:'bg-purple-500/20 text-purple-400', event:'bg-blue-500/20 text-blue-400',
  };
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-[#dfe3e1]/5 last:border-0 group">
      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${typeColor[card.type] || ''}`}>{card.type[0]}</span>
      <span className="text-xs text-[#c0c8c5] flex-1 leading-tight truncate">{card.name}</span>
      <span className="text-[10px] font-mono text-[#a1d0c6]/70">×{count}</span>
      {!fixed && onRemove && (
        <button onClick={onRemove} className="opacity-0 group-hover:opacity-100 text-red-400/60 hover:text-red-400 transition-all">
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ── Mini card for editor grid ─────────────────────────────────

function EditorCard({ card, deck, onAdjust }: { card: Card; deck: CustomDeck | null; onAdjust: (id: string, delta: number) => void }) {
  if (!deck) return null;
  const count = deck.cards[card.id] || 0;
  const isCreator   = card.type === 'creator';
  const isModel     = card.type === 'model';
  const isSelCreator = deck.creator === card.id;
  const isGuaranteed = deck.guaranteedModels.includes(card.id);
  const atMax = count >= (card.deckLimit ?? 3);
  const modelFull = isModel && !isGuaranteed && deck.guaranteedModels.length >= 2;
  const grad = MOOD_GRAD[card.illustrationMood || 'neutral'] || MOOD_GRAD.neutral;

  return (
    <div className="bg-[#1c2120]/60 border border-[#a1d0c6]/10 rounded-xl overflow-hidden flex flex-col">
      <div className={`h-14 bg-gradient-to-br ${grad} flex items-end p-1.5`}>
        <span className="text-[9px] italic text-[#c0c8c5]/30 line-clamp-2 leading-tight">{card.illustration}</span>
      </div>
      <div className="p-2 flex flex-col gap-1.5">
        <p className="text-[11px] font-bold text-[#dfe3e1] leading-tight line-clamp-1">{card.name}</p>
        <p className="text-[9px] text-[#c0c8c5]/40 uppercase tracking-wider">{card.subtype || card.type}</p>
        <div className="flex gap-1 mt-0.5">
          {isCreator && (
            <button onClick={() => onAdjust(card.id, isSelCreator ? -99 : 99)}
              className={`flex-1 py-1 text-[10px] font-bold rounded-lg border transition-all ${isSelCreator ? 'bg-[#a1d0c6] text-[#033730] border-[#a1d0c6]' : 'border-[#a1d0c6]/20 text-[#a1d0c6] hover:bg-[#a1d0c6]/10'}`}>
              {isSelCreator ? '✓ Creator' : 'Set Creator'}
            </button>
          )}
          {isModel && (
            <button onClick={() => onAdjust(card.id, isGuaranteed ? -99 : 99)}
              disabled={modelFull}
              className={`flex-1 py-1 text-[10px] font-bold rounded-lg border transition-all disabled:opacity-30 disabled:cursor-not-allowed ${isGuaranteed ? 'bg-[#cebefa] text-[#1a0e2e] border-[#cebefa]' : 'border-[#cebefa]/20 text-[#cebefa] hover:bg-[#cebefa]/10'}`}>
              {isGuaranteed ? '✓ Guaranteed' : 'Guaranteed'}
            </button>
          )}
          {!isCreator && !isModel && (
            <>
              <button disabled={count === 0} onClick={() => onAdjust(card.id, -1)}
                className="w-6 h-6 rounded-lg border border-[#dfe3e1]/10 text-[#c0c8c5] hover:border-[#a1d0c6]/40 hover:text-[#a1d0c6] disabled:opacity-20 disabled:cursor-not-allowed transition-all flex items-center justify-center text-sm">−</button>
              <span className="flex-1 text-center text-[11px] font-mono text-[#c0c8c5]">{count > 0 ? `×${count}` : ''}</span>
              <button disabled={atMax} onClick={() => onAdjust(card.id, 1)}
                className="w-6 h-6 rounded-lg border border-[#dfe3e1]/10 text-[#c0c8c5] hover:border-[#a1d0c6]/40 hover:text-[#a1d0c6] disabled:opacity-20 disabled:cursor-not-allowed transition-all flex items-center justify-center text-sm">+</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Deck Share Modal ──────────────────────────────────────────
function ShareModal({ deck, onClose }: { deck: CustomDeck; onClose: () => void }) {
  const [handle, setHandleState] = useState(getHandle());
  const [note,   setNote]       = useState('');
  const [sent,   setSent]       = useState(false);
  const creator = getCardById(deck.creator || '');
  const total   = Object.values(deck.cards).reduce((a,b)=>a+b,0) + 3;
  const isDefault = deck.name === 'New Deck';

  function submit() {
    if (handle) setHandle(handle);
    submitToGoogleForm(FORMS.DECK_SHARE, {
      [FIELDS.DECK_SHARE.name]:    deck.name,
      [FIELDS.DECK_SHARE.creator]: deck.creator || '',
      [FIELDS.DECK_SHARE.cards]:   JSON.stringify(deck.cards),
      [FIELDS.DECK_SHARE.handle]:  handle,
      [FIELDS.DECK_SHARE.note]:    note,
    });
    setSent(true);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#1c2120] border border-[#a1d0c6]/15 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
        <div className="flex justify-between items-start">
          <h2 className="text-lg font-bold text-[#dfe3e1]">Share with @aia</h2>
          <button onClick={onClose} className="text-[#c0c8c5]/40 hover:text-[#dfe3e1] p-1"><X className="w-4 h-4" /></button>
        </div>
        {sent ? (
          <div className="text-center py-4 space-y-2">
            <div className="text-3xl">📦</div>
            <p className="font-bold text-[#dfe3e1]">Deck shared!</p>
            <p className="text-sm text-[#c0c8c5]/60">@aia will check it out.</p>
            <button onClick={onClose} className="px-4 py-2 bg-[#a1d0c6]/10 hover:bg-[#a1d0c6]/20 text-[#a1d0c6] rounded-xl text-sm font-semibold transition-all">Close</button>
          </div>
        ) : (<>
          <div className="bg-[#0d1211]/60 rounded-xl p-3 text-xs font-mono text-[#c0c8c5]/70 space-y-0.5">
            <p><span className="text-[#a1d0c6]">Name:</span> {deck.name}</p>
            <p><span className="text-[#a1d0c6]">Creator:</span> {creator?.name || 'None'}</p>
            <p><span className="text-[#a1d0c6]">Cards:</span> {total}/40</p>
          </div>
          {isDefault && <p className="text-[#a1d0c6] text-xs italic">⚠ Deck still has the default name. Rename it before sharing?</p>}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#c0c8c5]/40">Your handle</label>
            <input className={IN} value={handle} onChange={e => setHandleState(e.target.value)} placeholder="@yourname" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#c0c8c5]/40">Note (optional)</label>
            <textarea className={`${IN} resize-none min-h-[60px]`} value={note} onChange={e => setNote(e.target.value)} placeholder="Anything about the deck..." />
          </div>
          <div className="flex gap-2">
            <button onClick={submit} className="flex-1 py-2.5 bg-[#a1d0c6] text-[#033730] font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all text-sm">Share →</button>
            <button onClick={onClose} className="flex-1 py-2.5 border border-[#dfe3e1]/10 text-[#c0c8c5] rounded-xl hover:bg-white/5 transition-all text-sm">Cancel</button>
          </div>
        </>)}
      </div>
    </div>
  );
}
const IN = "w-full bg-[#0d1211]/80 border border-[#a1d0c6]/20 focus:border-[#a1d0c6]/50 rounded-xl px-3 py-2 text-sm text-[#dfe3e1] placeholder-[#c0c8c5]/30 outline-none transition-all";

// ── Main DeckBuilder component ────────────────────────────────
export default function DeckBuilder() {
  const [store,       setStoreState] = useState<DecksStore>(loadStore);
  const [view,        setView]       = useState<'list' | 'detail' | 'editor'>('list');
  const [detailId,    setDetailId]   = useState<string | null>(null);
  const [editingDeck, setEditingDeck] = useState<CustomDeck | null>(null);
  const [typeFilter,  setTypeFilter] = useState('all');
  const [shareTarget, setShareTarget] = useState<CustomDeck | null>(null);

  function persist(s: DecksStore) { setStoreState(s); saveStore(s); }

  function newDeck() {
    const d: CustomDeck = { id: `deck_${Date.now()}`, name: 'New Deck', description: '', createdAt: new Date().toISOString(), creator: null, guaranteedModels: [], cards: {} };
    const s = { ...store, decks: [...store.decks, d] };
    persist(s);
    setEditingDeck(JSON.parse(JSON.stringify(d)));
    setView('editor');
  }

  function duplicate(src: CustomDeck | PrebuiltDeck) {
    const d: CustomDeck = { ...JSON.parse(JSON.stringify(src)), id: `deck_${Date.now()}`, name: src.name + ' (Copy)', createdAt: new Date().toISOString(), description: (src as any).description || '' };
    const s = { ...store, decks: [...store.decks, d] };
    persist(s);
  }

  function deleteDeck(id: string) {
    if (!confirm('Delete this deck? This cannot be undone.')) return;
    persist({ ...store, decks: store.decks.filter(d => d.id !== id) });
    if (detailId === id) { setDetailId(null); setView('list'); }
  }

  const adjust = useCallback((id: string, delta: number) => {
    setEditingDeck(prev => {
      if (!prev) return prev;
      const d = { ...prev, cards: { ...prev.cards } };
      const card = getCardById(id);
      if (!card) return d;

      if (card.type === 'creator') {
        d.creator = delta > 0 ? id : null;
        return d;
      }
      if (card.type === 'model') {
        const gm = [...d.guaranteedModels];
        const idx = gm.indexOf(id);
        if (delta > 0 && idx === -1 && gm.length < 2) gm.push(id);
        else if (delta < 0 && idx !== -1) gm.splice(idx, 1);
        d.guaranteedModels = gm;
        return d;
      }
      d.cards[id] = Math.max(0, Math.min(card.deckLimit ?? 3, (d.cards[id] || 0) + delta));
      if (d.cards[id] === 0) delete d.cards[id];
      return d;
    });
  }, []);

  function saveEdit() {
    if (!editingDeck) return;
    const s = { ...store, decks: store.decks.map(d => d.id === editingDeck.id ? editingDeck : d) };
    persist(s);
    setView('list');
    setEditingDeck(null);
  }

  function cancelEdit() { setEditingDeck(null); setView('list'); }

  const TYPES = ['all','creator','model','prompt','modifier','artifact','event'];
  const filteredCards = ALL_CARDS.filter(c => typeFilter === 'all' || c.type === typeFilter);

  // ── LIST VIEW ───────────────────────────────────────────────
  if (view === 'list') return (
    <div className="space-y-8 animate-fade-in py-12">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-4xl font-bold text-[#dfe3e1]">Decks</h1>
        <button onClick={newDeck} className="flex items-center gap-2 px-5 py-2.5 bg-[#a1d0c6] text-[#033730] font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-[#a1d0c6]/20">
          <Plus className="w-4 h-4" /> New Deck
        </button>
      </div>

      {/* Prebuilt decks */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-[#a1d0c6]/50 mb-3">Official Starter Decks</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PREBUILT_DECKS.map(d => {
            const creator = getCardById(d.creator);
            const total   = Object.values(d.cards).reduce((a,b)=>a+b,0) + 3;
            const grad    = MOOD_GRAD[creator?.illustrationMood || 'neutral'] || MOOD_GRAD.neutral;
            return (
              <div key={d.id} onClick={() => { setDetailId(d.id); setView('detail'); }}
                className="bg-[#1c2120]/60 border border-[#a1d0c6]/20 hover:border-[#a1d0c6]/50 rounded-2xl overflow-hidden cursor-pointer transition-all group shadow-lg hover:shadow-[0_0_30px_rgba(161,208,198,0.1)]">
                <div className={`h-16 bg-gradient-to-br ${grad} flex items-center px-4`}>
                  <span className="text-xs font-bold text-[#dfe3e1]/70 font-mono">{creator?.name || d.creator}</span>
                  <span className="ml-auto text-[10px] font-mono text-[#a1d0c6]/50">Official · {total} cards</span>
                </div>
                <div className="p-4 space-y-2">
                  <h3 className="font-bold text-[#dfe3e1] group-hover:text-[#a1d0c6] transition-colors">{d.name}</h3>
                  <p className="text-xs text-[#c0c8c5]/50 line-clamp-2">{d.description}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {d.archetypes.map(a => <span key={a} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#a1d0c6]/10 text-[#a1d0c6] border border-[#a1d0c6]/15">{a}</span>)}
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${d.difficulty === 'Beginner' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>{d.difficulty}</span>
                  </div>
                </div>
                <div className="px-4 py-3 border-t border-[#dfe3e1]/5 flex justify-end" onClick={e => e.stopPropagation()}>
                  <button onClick={() => duplicate(d)} className="flex items-center gap-1.5 text-xs text-[#c0c8c5]/50 hover:text-[#a1d0c6] transition-colors">
                    <Copy className="w-3 h-3" /> Duplicate
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom decks */}
      {store.decks.length > 0 && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#a1d0c6]/50 mb-3">Your Decks</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {store.decks.map(d => {
              const creator = getCardById(d.creator || '');
              const total   = Object.values(d.cards).reduce((a,b)=>a+b,0) + 3;
              const errs    = validateDeck(d);
              const grad    = MOOD_GRAD[creator?.illustrationMood || 'neutral'] || MOOD_GRAD.neutral;
              return (
                <div key={d.id} onClick={() => { setDetailId(d.id); setView('detail'); }}
                  className="bg-[#1c2120]/60 border border-[#dfe3e1]/10 hover:border-[#a1d0c6]/30 rounded-2xl overflow-hidden cursor-pointer transition-all group">
                  <div className={`h-12 bg-gradient-to-br ${grad} flex items-center px-4`}>
                    <span className="text-[10px] font-mono text-[#dfe3e1]/40">{creator?.name || 'No creator'}</span>
                    <span className="ml-auto text-[10px] font-mono text-[#c0c8c5]/30">{total}/40</span>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-[#dfe3e1] group-hover:text-[#a1d0c6] transition-colors">{d.name}</h3>
                    {d.description && <p className="text-xs text-[#c0c8c5]/50 mt-1 line-clamp-1">{d.description}</p>}
                    <p className="text-[10px] font-mono text-[#c0c8c5]/30 mt-1">{new Date(d.createdAt).toLocaleDateString()}</p>
                    {errs.length > 0 && <p className="text-[10px] text-amber-400/70 mt-1">⚠ {errs[0]}</p>}
                  </div>
                  <div className="px-4 py-2.5 border-t border-[#dfe3e1]/5 flex gap-3 justify-end" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setShareTarget(d)} className="text-xs text-[#c0c8c5]/40 hover:text-[#a1d0c6] transition-colors">Share</button>
                    <button onClick={() => { setEditingDeck(JSON.parse(JSON.stringify(d))); setView('editor'); }} className="text-xs text-[#c0c8c5]/40 hover:text-[#a1d0c6] transition-colors">Edit</button>
                    <button onClick={() => deleteDeck(d.id)} className="text-xs text-[#c0c8c5]/40 hover:text-red-400 transition-colors">Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {shareTarget && <ShareModal deck={shareTarget} onClose={() => setShareTarget(null)} />}
    </div>
  );

  // ── DETAIL VIEW ─────────────────────────────────────────────
  if (view === 'detail') {
    const prebuilt = PREBUILT_DECKS.find(d => d.id === detailId);
    const custom   = store.decks.find(d => d.id === detailId);
    const deck     = prebuilt || custom;
    if (!deck) return null;
    const isPrebuilt = !!prebuilt;
    const creator  = getCardById(deck.creator || '');
    const entries  = Object.entries(deck.cards).sort(([a],[b]) => {
      const ord = ['creator','model','prompt','modifier','artifact','event'];
      return ord.indexOf(getCardById(a)?.type||'') - ord.indexOf(getCardById(b)?.type||'');
    });

    return (
      <div className="space-y-6 animate-fade-in py-12">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => { setDetailId(null); setView('list'); }} className="flex items-center gap-1.5 text-sm text-[#c0c8c5]/60 hover:text-[#a1d0c6] transition-colors">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="text-2xl font-bold text-[#dfe3e1] flex-1">{deck.name}</h1>
          {!isPrebuilt && custom && <>
            <button onClick={() => { setEditingDeck(JSON.parse(JSON.stringify(custom))); setView('editor'); }}
              className="px-4 py-2 text-sm border border-[#a1d0c6]/20 text-[#a1d0c6] rounded-xl hover:bg-[#a1d0c6]/10 transition-all">Edit</button>
            <button onClick={() => setShareTarget(custom)}
              className="px-4 py-2 text-sm bg-[#a1d0c6]/10 text-[#a1d0c6] border border-[#a1d0c6]/20 rounded-xl hover:bg-[#a1d0c6]/20 transition-all">Share with @aia</button>
          </>}
          {isPrebuilt && <button onClick={() => duplicate(prebuilt!)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-[#dfe3e1]/10 text-[#c0c8c5] rounded-xl hover:bg-white/5 transition-all">
            <Copy className="w-3 h-3" /> Duplicate
          </button>}
        </div>
        <p className="text-sm text-[#c0c8c5]/60 italic">{(deck as any).subtitle || (deck as any).description}</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Cards grid */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {(deck.guaranteedModels || []).map(mid => {
                const c = getCardById(mid); if (!c) return null;
                const g = MOOD_GRAD[c.illustrationMood || 'neutral'];
                return (
                  <div key={mid} className="relative bg-[#1c2120]/60 border border-[#cebefa]/20 rounded-xl overflow-hidden">
                    <div className="absolute top-2 left-2 z-10 text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#cebefa] text-[#1a0e2e]">G</div>
                    <div className={`h-20 bg-gradient-to-br ${g}`} />
                    <div className="p-2"><p className="text-[11px] font-bold text-[#dfe3e1] line-clamp-1">{c.name}</p></div>
                  </div>
                );
              })}
              {entries.map(([cid, cnt]) => {
                const c = getCardById(cid); if (!c) return null;
                const g = MOOD_GRAD[c.illustrationMood || 'neutral'];
                return (
                  <div key={cid} className="relative bg-[#1c2120]/60 border border-[#dfe3e1]/5 rounded-xl overflow-hidden">
                    {cnt > 1 && <div className="absolute top-2 right-2 z-10 text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#1c2120] text-[#a1d0c6] border border-[#a1d0c6]/20">×{cnt}</div>}
                    <div className={`h-20 bg-gradient-to-br ${g}`} />
                    <div className="p-2"><p className="text-[11px] font-bold text-[#dfe3e1] line-clamp-1">{c.name}</p></div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sidebar */}
          <div className="bg-[#1c2120]/60 border border-[#dfe3e1]/5 rounded-2xl p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#a1d0c6]/50 mb-3">Deck List</p>
            {creator && <DeckSlot card={creator} count={1} fixed />}
            <div className="my-2 border-t border-[#dfe3e1]/5" />
            {(deck.guaranteedModels || []).map(mid => { const c = getCardById(mid); return c ? <DeckSlot key={mid} card={c} count={1} fixed /> : null; })}
            <div className="my-2 border-t border-[#dfe3e1]/5" />
            {entries.map(([cid, cnt]) => { const c = getCardById(cid); return c ? <DeckSlot key={cid} card={c} count={cnt} fixed /> : null; })}
            <div className="mt-3 pt-2 border-t border-[#dfe3e1]/5 text-xs font-bold font-mono text-[#dfe3e1]">
              Total: {entries.reduce((s,[,n])=>s+n,0)+3}/40
            </div>
          </div>
        </div>
        {shareTarget && <ShareModal deck={shareTarget} onClose={() => setShareTarget(null)} />}
      </div>
    );
  }

  // ── EDITOR VIEW ─────────────────────────────────────────────
  if (view === 'editor' && editingDeck) {
    const errors   = validateDeck(editingDeck);
    const deckTotal = Object.values(editingDeck.cards).reduce((a,b)=>a+b,0);
    const entries  = Object.entries(editingDeck.cards).filter(([,n])=>n>0).sort(([a],[b]) => {
      const ord = ['prompt','modifier','artifact','event'];
      return ord.indexOf(getCardById(a)?.type||'') - ord.indexOf(getCardById(b)?.type||'');
    });

    return (
      <div className="space-y-6 animate-fade-in py-12">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={cancelEdit} className="flex items-center gap-1.5 text-sm text-[#c0c8c5]/60 hover:text-[#a1d0c6] transition-colors shrink-0">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <input value={editingDeck.name} onChange={e => setEditingDeck(d => d ? {...d, name: e.target.value} : d)}
            className="flex-1 min-w-0 bg-transparent border-b border-[#a1d0c6]/20 focus:border-[#a1d0c6]/60 py-1 text-2xl font-bold text-[#dfe3e1] outline-none transition-all" />
          <button onClick={saveEdit} className="flex items-center gap-2 px-5 py-2 bg-[#a1d0c6] text-[#033730] font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-[#a1d0c6]/20 shrink-0">
            <Save className="w-4 h-4" /> Save
          </button>
          <button onClick={cancelEdit} className="p-2 text-[#c0c8c5]/40 hover:text-[#dfe3e1] border border-[#dfe3e1]/5 rounded-xl hover:bg-white/5 transition-all shrink-0"><X className="w-4 h-4" /></button>
        </div>
        <input value={editingDeck.description || ''} onChange={e => setEditingDeck(d => d ? {...d, description: e.target.value} : d)}
          placeholder="Strategy notes, description..."
          className="w-full bg-transparent border-b border-[#dfe3e1]/5 focus:border-[#a1d0c6]/20 py-1 text-sm italic text-[#c0c8c5]/50 placeholder-[#c0c8c5]/20 outline-none transition-all" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Card picker */}
          <div className="lg:col-span-2 space-y-3">
            <p className="text-xs text-[#c0c8c5]/40 italic">Set Creator, pick 2 Guaranteed Models, then +/− to add cards (need 37 total).</p>
            <div className="flex flex-wrap gap-1.5">
              {TYPES.map(t => (
                <button key={t} onClick={() => setTypeFilter(t)}
                  className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border transition-all ${typeFilter === t ? 'bg-[#a1d0c6]/20 text-[#a1d0c6] border-[#a1d0c6]/30' : 'border-transparent text-[#c0c8c5]/40 hover:text-[#c0c8c5] hover:bg-white/5'}`}>
                  {t}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredCards.map(c => <EditorCard key={c.id} card={c} deck={editingDeck} onAdjust={adjust} />)}
            </div>
          </div>

          {/* Sidebar */}
          <div className="bg-[#1c2120]/60 border border-[#dfe3e1]/5 rounded-2xl p-4 sticky top-24 max-h-[calc(100vh-120px)] overflow-y-auto">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#a1d0c6]/50 mb-3">Deck List</p>

            {editingDeck.creator
              ? (() => { const c = getCardById(editingDeck.creator!); return c ? <DeckSlot card={c} count={1} onRemove={() => adjust(c.id, -99)} /> : null; })()
              : <p className="text-[10px] font-mono text-red-400/60 mb-2">⚠ No creator set</p>}

            {editingDeck.guaranteedModels.length > 0
              ? editingDeck.guaranteedModels.map(mid => { const c = getCardById(mid); return c ? <DeckSlot key={mid} card={c} count={1} onRemove={() => adjust(mid, -99)} /> : null; })
              : <p className="text-[10px] font-mono text-[#c0c8c5]/30 mb-2">No guaranteed models</p>}

            {entries.length > 0 && <div className="my-2 border-t border-[#dfe3e1]/5" />}
            {entries.map(([cid, cnt]) => { const c = getCardById(cid); return c ? <DeckSlot key={cid} card={c} count={cnt} onRemove={() => adjust(cid, -cnt)} /> : null; })}

            <div className="mt-3 pt-2 border-t border-[#dfe3e1]/5">
              <p className="text-xs font-bold font-mono text-[#dfe3e1]">Total: {deckTotal+3}/40</p>
              <div className={`mt-2 p-2 rounded-lg text-[10px] font-mono leading-relaxed ${errors.length ? 'bg-red-500/5 text-red-400/80 border border-red-500/10' : 'bg-green-500/5 text-green-400/80 border border-green-500/10'}`}>
                {errors.length ? errors.map((e,i) => <div key={i}>⚠ {e}</div>) : '✓ Deck looks valid'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
