import { useState, useEffect } from 'react';
import BetaGate        from './components/BetaGate';
import TopNavBar       from './components/TopNavBar';
import LandingHero     from './components/LandingHero';
import RulesBrowser    from './components/RulesBrowser';
import CardGallery     from './components/CardGallery';
import DeckBuilder     from './components/DeckBuilder';
import ArenaBattlefield from './components/ArenaBattlefield';
import FeedbackModal   from './components/FeedbackModal';
import SuggestArtistModal from './components/SuggestArtistModal';
import { GlossaryProvider } from './components/GlossaryTooltip';
import { useAnnouncements } from './components/AnnouncementModal';
import { BETA_TOKENS }  from './config';

type Tab = 'home' | 'rules' | 'cards' | 'decks' | 'play';

function checkAuth(): boolean {
  const saved = localStorage.getItem('pb_beta_token');
  return !!saved && BETA_TOKENS.includes(saved);
}

export default function App() {
  const [authed,       setAuthed]       = useState(checkAuth);
  const [activeTab,    setActiveTab]    = useState<Tab>('home');
  const [showFeedback, setShowFeedback] = useState(false);
  const [showSuggest,  setShowSuggest]  = useState(false);

  const { modal: annModal, openAnn, unread: annUnread } = useAnnouncements();
  const [inGame, setInGame] = useState(false);

  // Keyboard shortcut: Escape closes modals
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setShowFeedback(false); setShowSuggest(false); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!authed) return <BetaGate onUnlock={() => setAuthed(true)} />;

  return (
    <div className="min-h-screen bg-[#0d1211] text-[#dfe3e1]">
      <GlossaryProvider />

      {!inGame && <TopNavBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onFeedback={() => setShowFeedback(true)}
        onAnnouncement={openAnn}
        annUnread={annUnread}
      />}

      {/* Spacer for fixed nav */}
      <div className={inGame ? "" : "pt-16"}>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {activeTab === 'home'  && <LandingHero onNavigate={setActiveTab} />}
          {activeTab === 'rules' && <RulesBrowser />}
          {activeTab === 'cards' && <CardGallery />}
          {activeTab === 'decks' && <DeckBuilder />}
          {activeTab === 'play'  && <ArenaBattlefield onInGame={setInGame} onExit={() => { setInGame(false); setActiveTab('home'); }} />}
        </main>
      </div>

      {/* Floating feedback FAB */}
      <button
        onClick={() => setShowFeedback(true)}
        className={`fixed bottom-6 right-6 z-30 flex items-center gap-2 px-5 py-3 bg-[#a1d0c6] text-[#033730] font-bold rounded-2xl shadow-2xl shadow-[#a1d0c6]/25 hover:brightness-110 active:scale-95 transition-all ${inGame ? "hidden" : ""}`}
      >
        ✉ Feedback
      </button>

      {/* Modals */}
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
      {showSuggest  && <SuggestArtistModal onClose={() => setShowSuggest(false)} />}
      {annModal}
    </div>
  );
}
