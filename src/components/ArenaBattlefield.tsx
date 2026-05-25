export default function ArenaBattlefield() {
  const phases = [
    { label: 'Rules documents & card data',   done: true  },
    { label: 'Card gallery · Deck builder',   done: true  },
    { label: 'Feedback & form system',        done: true  },
    { label: 'P2P connection (PeerJS)',        active: true },
    { label: 'Game state engine',             done: false },
    { label: 'All card abilities',            done: false },
    { label: 'Online lobby (Firebase)',       done: false },
    { label: 'Beta multiplayer launch',       done: false },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center py-16 gap-10 animate-fade-in">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold text-[#dfe3e1]">Play — Online Duel</h1>
        <p className="text-[#c0c8c5]/50">Multiplayer is being built. Browse cards and build decks while you wait.</p>
      </div>

      <div className="w-full max-w-md bg-[#1c2120]/60 border border-[#a1d0c6]/10 rounded-2xl p-7 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-[#a1d0c6]/60">Build Progress</h2>
        <ul className="space-y-3">
          {phases.map((p, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                p.done    ? 'bg-[#a1d0c6]' :
                p.active  ? 'bg-[#cebefa] animate-pulse' :
                            'bg-[#dfe3e1]/10'
              }`} />
              <span className={`text-sm ${p.done ? 'text-[#c0c8c5]/70' : p.active ? 'text-[#cebefa]' : 'text-[#c0c8c5]/30'}`}>
                {p.label}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-[#c0c8c5]/30 font-mono max-w-sm text-center">
        When ready: P2P via PeerJS · Lobby via Firebase Realtime DB · No server required
      </p>
    </div>
  );
}
