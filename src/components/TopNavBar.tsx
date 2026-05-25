import { useState } from 'react';
import { MessageSquare, Zap, Users, BookOpen, Library, Menu, X } from 'lucide-react';
import { AnnouncementBell } from './AnnouncementModal';

type Tab = 'home' | 'rules' | 'cards' | 'decks' | 'play';

interface Props {
  activeTab: Tab;
  setActiveTab: (t: Tab) => void;
  onFeedback: () => void;
  onAnnouncement: () => void;
  annUnread: boolean;
}

export default function TopNavBar({ activeTab, setActiveTab, onFeedback, onAnnouncement, annUnread }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'home',  label: 'Home',  icon: <Zap  className="w-4 h-4" /> },
    { id: 'rules', label: 'Info',  icon: <BookOpen className="w-4 h-4" /> },
    { id: 'cards', label: 'Cards', icon: <Library className="w-4 h-4" /> },
    { id: 'decks', label: 'Decks', icon: <Users className="w-4 h-4" /> },
    { id: 'play',  label: 'Play ⚡', icon: <Zap className="w-4 h-4" /> },
  ];

  function nav(t: Tab) { setActiveTab(t); setMenuOpen(false); }

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-[#0d1211]/90 backdrop-blur-xl border-b border-[#a1d0c6]/10">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-6">
        {/* Logo */}
        <button onClick={() => nav('home')} className="text-lg font-black text-[#dfe3e1] tracking-tight hover:text-[#a1d0c6] transition-colors shrink-0">
          Prompt<span className="text-[#a1d0c6]">Battle</span>
        </button>

        {/* Desktop tabs */}
        <div className="hidden md:flex items-center gap-1 flex-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => nav(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === t.id
                  ? 'bg-[#a1d0c6]/15 text-[#a1d0c6]'
                  : 'text-[#c0c8c5]/60 hover:text-[#c0c8c5] hover:bg-white/5'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 ml-auto">
          <AnnouncementBell onClick={onAnnouncement} unread={annUnread} />
          <button onClick={onFeedback}
            className="hidden md:flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-[#c0c8c5]/70 hover:text-[#a1d0c6] hover:bg-[#a1d0c6]/10 border border-transparent hover:border-[#a1d0c6]/20 transition-all">
            <MessageSquare className="w-4 h-4" /> Feedback
          </button>
          {/* Mobile menu */}
          <button className="md:hidden p-2 rounded-xl text-[#c0c8c5]/60 hover:text-[#dfe3e1] hover:bg-white/5 transition-all" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-[#a1d0c6]/10 bg-[#0d1211]/95 px-4 py-3 space-y-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => nav(t.id)}
              className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === t.id ? 'bg-[#a1d0c6]/15 text-[#a1d0c6]' : 'text-[#c0c8c5]/60 hover:text-[#c0c8c5] hover:bg-white/5'}`}>
              {t.icon}{t.label}
            </button>
          ))}
          <button onClick={() => { onFeedback(); setMenuOpen(false); }}
            className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-[#c0c8c5]/60 hover:text-[#a1d0c6] hover:bg-[#a1d0c6]/10 transition-all">
            <MessageSquare className="w-4 h-4" /> Feedback
          </button>
        </div>
      )}
    </nav>
  );
}
