import { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { linkTerms } from './GlossaryTooltip';

// Dynamically import marked at runtime (it's in package.json already)
declare const marked: { parse: (md: string) => string };

const DOC_MAP: Record<string, string> = {
  betatester:  'betatestermessage.md',
  tutorial1a:  'tutorial1a.md',
  tutorial1b:  'tutorial1b.md',
  rulebook:    'rulebook.md',
  quickref:    'quickreferencesheet.md',
  faq:         'faq.md',
  cardindex:   'cardindex.md',
  deckguide:   'deckbuildersguide.md',
  flagged:     'flaggeditemsforbetatesting.md',
};

const DOC_NEXT: Record<string, { label: string; doc: string; primary?: boolean }[]> = {
  betatester:  [{ label: 'Start Tutorial 1A →', doc: 'tutorial1a', primary: true }],
  tutorial1a:  [
    { label: 'Continue to Tutorial 1B →', doc: 'tutorial1b', primary: true },
    { label: 'Full Rulebook', doc: 'rulebook' },
    { label: 'FAQ', doc: 'faq' },
    { label: 'Flagged Items', doc: 'flagged' },
  ],
  tutorial1b:  [
    { label: 'Full Rulebook →', doc: 'rulebook', primary: true },
    { label: 'Card Index', doc: 'cardindex' },
    { label: 'Quick Reference', doc: 'quickref' },
    { label: 'Deck Builder Guide', doc: 'deckguide' },
  ],
  rulebook:    [{ label: 'Quick Reference →', doc: 'quickref', primary: true }, { label: 'FAQ', doc: 'faq' }],
  quickref:    [{ label: 'FAQ →', doc: 'faq', primary: true }],
  faq:         [{ label: 'Card Index →', doc: 'cardindex', primary: true }, { label: 'Flagged Items', doc: 'flagged' }],
};

const SIDEBAR = [
  { title: 'Getting Started', docs: [
    { id: 'betatester', label: 'Beta Tester Message' },
    { id: 'tutorial1a', label: 'Tutorial 1A — Horde Deck' },
    { id: 'tutorial1b', label: 'Tutorial 1B — CLIP Deck' },
  ]},
  { title: 'Rules', docs: [
    { id: 'rulebook', label: 'Full Rulebook' },
    { id: 'quickref', label: 'Quick Reference' },
    { id: 'faq',     label: 'FAQ' },
  ]},
  { title: 'Cards & Decks', docs: [
    { id: 'cardindex', label: 'Card Index' },
    { id: 'deckguide', label: 'Deck Builder\'s Guide' },
  ]},
  { title: 'Beta', docs: [
    { id: 'flagged', label: 'Flagged Items' },
  ]},
];

const docCache: Record<string, string> = {};

export default function RulesBrowser() {
  const [active,   setActive]   = useState('tutorial1a');
  const [html,     setHtml]     = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [sideOpen, setSideOpen] = useState(false);

  useEffect(() => { loadDoc(active); }, [active]);

  async function loadDoc(key: string) {
    setLoading(true); setError('');
    try {
      if (!docCache[key]) {
        // Load marked lazily if not on window
        if (!(window as any).marked) {
          await new Promise<void>((res, rej) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
            s.onload = () => res(); s.onerror = () => rej(new Error('marked failed'));
            document.head.appendChild(s);
          });
        }
        const r = await fetch(import.meta.env.BASE_URL + `docs/${DOC_MAP[key]}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const md = await r.text();
        docCache[key] = linkTerms((window as any).marked.parse(md));
      }
      setHtml(docCache[key]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function nav(doc: string) { setActive(doc); setSideOpen(false); window.scrollTo({ top: 0 }); }

  const nexts = DOC_NEXT[active] || [];

  return (
    <div className="flex min-h-[calc(100vh-4rem)] animate-fade-in">
      {/* Sidebar — desktop always visible, mobile overlay */}
      <aside className={`
        fixed md:sticky top-16 z-30 md:z-auto
        bg-[#0d1211]/95 md:bg-transparent backdrop-blur-xl md:backdrop-blur-none
        border-r border-[#a1d0c6]/10
        w-64 shrink-0 h-[calc(100vh-4rem)] overflow-y-auto
        transition-transform duration-300
        ${sideOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-4 space-y-6">
          {SIDEBAR.map(group => (
            <div key={group.title}>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#a1d0c6]/40 mb-2 px-2">{group.title}</p>
              {group.docs.map(d => (
                <button key={d.id} onClick={() => nav(d.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-all mb-0.5 ${
                    active === d.id
                      ? 'bg-[#a1d0c6]/15 text-[#a1d0c6] font-semibold border-l-2 border-[#a1d0c6]'
                      : 'text-[#c0c8c5]/60 hover:text-[#c0c8c5] hover:bg-white/5'
                  }`}>
                  {d.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>

      {/* Overlay backdrop on mobile */}
      {sideOpen && (
        <div className="fixed inset-0 z-20 bg-black/60 md:hidden" onClick={() => setSideOpen(false)} />
      )}

      {/* Content */}
      <div className="flex-1 min-w-0 py-10 px-4 md:px-12 max-w-3xl">

        {/* Mobile sidebar toggle */}
        <button onClick={() => setSideOpen(true)} className="md:hidden flex items-center gap-2 text-xs text-[#a1d0c6] border border-[#a1d0c6]/20 rounded-lg px-3 py-1.5 mb-6 hover:bg-[#a1d0c6]/10 transition-all">
          <ChevronRight className="w-3 h-3" /> Menu
        </button>

        {loading && (
          <div className="flex items-center gap-3 text-sm text-[#c0c8c5]/40 py-12">
            <div className="w-4 h-4 border-2 border-[#a1d0c6]/20 border-t-[#a1d0c6] rounded-full animate-spin" />
            Loading document…
          </div>
        )}

        {error && !loading && (
          <div className="py-12 space-y-2">
            <p className="text-red-400/70 text-sm">Could not load document: {error}</p>
            <p className="text-[#c0c8c5]/40 text-xs">Make sure the docs/ folder is present in the repo root and you're running from a server (not file://).</p>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="prose-rules" dangerouslySetInnerHTML={{ __html: html }} />

            {nexts.length > 0 && (
              <div className="mt-12 pt-8 border-t border-[#dfe3e1]/5 flex flex-wrap gap-3">
                {nexts.map(n => (
                  <button key={n.doc} onClick={() => nav(n.doc)}
                    className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      n.primary
                        ? 'bg-[#a1d0c6] text-[#033730] hover:brightness-110 shadow-lg shadow-[#a1d0c6]/20'
                        : 'border border-[#a1d0c6]/20 text-[#a1d0c6] hover:bg-[#a1d0c6]/10'
                    }`}>
                    {n.label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Inline prose styles scoped to .prose-rules */}
      <style>{`
        .prose-rules h1 { font-family: inherit; font-size: 2rem; font-weight: 800; color: #dfe3e1; margin-bottom: 0.5rem; padding-bottom: 0.75rem; border-bottom: 1px solid rgba(161,208,198,0.12); }
        .prose-rules h2 { font-size: 1.25rem; font-weight: 700; color: #dfe3e1; margin-top: 2.5rem; margin-bottom: 0.75rem; }
        .prose-rules h3 { font-size: 1.05rem; font-weight: 700; color: #c0c8c5; margin-top: 1.75rem; margin-bottom: 0.5rem; }
        .prose-rules h4 { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #a1d0c6; margin-top: 1.5rem; margin-bottom: 0.4rem; }
        .prose-rules p  { line-height: 1.85; color: #9db5b0; margin-bottom: 1rem; font-size: 0.9rem; }
        .prose-rules ul, .prose-rules ol { padding-left: 1.5rem; margin-bottom: 1rem; }
        .prose-rules li { line-height: 1.75; color: #9db5b0; margin-bottom: 0.3rem; font-size: 0.9rem; }
        .prose-rules strong { color: #dfe3e1; font-weight: 700; }
        .prose-rules em    { color: #b0c4c0; }
        .prose-rules code  { font-family: 'DM Mono', monospace; font-size: 0.8rem; background: rgba(161,208,198,0.08); padding: 0.1em 0.4em; border-radius: 4px; color: #a1d0c6; }
        .prose-rules pre   { background: #0d1211; border: 1px solid rgba(161,208,198,0.1); border-radius: 10px; padding: 1rem 1.25rem; overflow-x: auto; margin: 1.25rem 0; }
        .prose-rules pre code { background: none; padding: 0; color: #9db5b0; font-size: 0.8rem; }
        .prose-rules table { border-collapse: collapse; width: 100%; margin: 1.25rem 0; font-size: 0.85rem; }
        .prose-rules th { background: rgba(161,208,198,0.05); text-align: left; padding: 0.6rem 1rem; font-size: 0.7rem; letter-spacing: 0.1em; text-transform: uppercase; color: #7a9e99; border-bottom: 1px solid rgba(161,208,198,0.1); font-weight: 700; }
        .prose-rules td { padding: 0.6rem 1rem; border-bottom: 1px solid rgba(161,208,198,0.05); color: #9db5b0; }
        .prose-rules blockquote { border-left: 3px solid #a1d0c6; padding: 0.75rem 1.25rem; margin: 1.25rem 0; background: rgba(161,208,198,0.04); border-radius: 0 8px 8px 0; font-style: italic; color: #9db5b0; }
        .prose-rules hr { border: none; border-top: 1px solid rgba(161,208,198,0.1); margin: 2rem 0; }
        .prose-rules a { color: #a1d0c6; text-decoration: underline; }
      `}</style>
    </div>
  );
}
