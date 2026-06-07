import { Sword, BookOpen, Library, Users } from 'lucide-react';

type Tab = 'home' | 'rules' | 'cards' | 'decks' | 'play';
interface Props { onNavigate: (tab: Tab) => void; }

export default function LandingHero({ onNavigate }: Props) {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-centre justify-centre py-16 space-y-16 animate-fade-in">

      {/* Hero */}
      <div className="text-centre space-y-4 max-w-2xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#a1d0c6]/60">Set 001 · First Render · Beta v0.14</p>
        <h1 className="text-6xl sm:text-7xl font-black text-[#dfe3e1] tracking-tight leading-none">
          Prompt<span className="text-[#a1d0c6]">Battle</span>
        </h1>
        <p className="text-lg text-[#c0c8c5]/60 italic font-light">Two creators. One feed. Who goes viral first?</p>
      </div>

      {/* Welcome message */}
      <div className="max-w-xl w-full bg-[#1c2120]/60 backdrop-blur-sm border border-[#a1d0c6]/15 rounded-2xl p-7 space-y-4 shadow-xl shadow-black/30">
        <p className="text-sm text-[#c0c8c5] leading-relaxed italic">
          Hello, and thank you. You are holding one of the very first copies of Prompt Battle TCG to exist anywhere in the world. You are not just a player — you are part of building something from the ground up.
        </p>
        <p className="text-sm text-[#c0c8c5] leading-relaxed italic">
          This is Set 001 — First Render. Two starter decks, fourty cards each, one complete experience. Rules v0.14. Things will change.
        </p>
        <div className="pt-2 border-t border-[#dfe3e1]/5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#a1d0c6]/50 mb-2">What I need from you</p>
          <ul className="space-y-1.5 text-xs text-[#c0c8c5]/70">
            {[
              'Play it. Tell me what feels wrong. Tell me what feels right.',
              'Focus on the Reputation economy and the 20-cap.',
              'Test the SD1.5 destruction mechanic — clever or confusing?',
              'Try CLIP-LOCK — rewarding or tedious?',
              'Push for Going Viral — satisfying or too hard to set up?',
              'See Flagged Items doc for the full list.',
            ].map((item, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-[#a1d0c6]/40 shrink-0">—</span>{item}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-right text-[10px] text-[#c0c8c5]/30 italic">— @aia · First Render (Set 001)</p>
      </div>

      {/* Nav buttons */}
      <div className="flex flex-wrap gap-4 justify-centre">
        <NavBtn icon={<BookOpen className="w-5 h-5" />} label="Start Tutorial" sub="New to the game?" onClick={() => onNavigate('rules')} />
        <NavBtn icon={<Sword className="w-6 h-6" />}    label="Play" sub="Find a game" onClick={() => onNavigate('play')} primary />
        <NavBtn icon={<Library className="w-5 h-5" />}  label="Card Index" sub="42 cards" onClick={() => onNavigate('cards')} />
        <NavBtn icon={<Users className="w-5 h-5" />}    label="Decks" sub="Build & browse" onClick={() => onNavigate('decks')} />
      </div>

      <p className="text-[10px] font-mono text-[#c0c8c5]/20 tracking-widest uppercase">
        Prompt Battle TCG · First Render (Set 001) · Rules v0.14 · Beta
      </p>
    </div>
  );
}

function NavBtn({ icon, label, sub, onClick, primary = false }: { icon: React.ReactNode; label: string; sub: string; onClick: () => void; primary?: boolean }) {
  return (
    <button onClick={onClick}
      className={`flex flex-col items-centre gap-2 px-7 py-5 min-w-[140px] rounded-2xl border transition-all group active:scale-95 ${
        primary
          ? 'bg-[#a1d0c6] text-[#033730] border-[#a1d0c6] shadow-xl shadow-[#a1d0c6]/25 hover:brightness-110'
          : 'bg-[#1c2120]/60 text-[#c0c8c5] border-[#a1d0c6]/15 hover:border-[#a1d0c6]/40 hover:text-[#a1d0c6] hover:bg-[#a1d0c6]/5 shadow-lg'
      }`}>
      <span className={`transition-transform group-hover:scale-110 duration-200 ${primary ? '' : ''}`}>{icon}</span>
      <span className="font-bold text-sm">{label}</span>
      <span className={`text-[10px] font-mono ${primary ? 'opacity-60' : 'opacity-40'}`}>{sub}</span>
    </button>
  );
}
