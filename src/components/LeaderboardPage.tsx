/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Users, Trophy, ChevronRight, Sparkles, MessageSquare, Skull } from 'lucide-react';

export default function LeaderboardPage() {
  const leaders = [
    { rank: 1, name: 'VoidWalker', title: 'Grandmaster Creator', xp: 48950, rate: '74.2%', wins: 1482 },
    { rank: 2, name: 'PixelPaladin', title: 'Senior Architect', xp: 42350, rate: '69.1%', wins: 1102 },
    { rank: 3, name: 'CipherQueen', title: 'Syntax Warden', xp: 39800, rate: '68.5%', wins: 984 },
    { rank: 142, name: 'You (@aia)', title: 'First Render Cadet', xp: 1250, rate: '65.9%', wins: 12 },
  ];

  const podium = [
    { rank: 2, name: 'PixelPaladin', winRate: '69.1%', wins: 1102, avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDwldraTNrTxnV2M_4sz-HHJhYWAT1zgWI20ZolZ9MU4gwL_RX7MyqVmATs6kvs3E8gOcmj0sf1FJFipJwJbz4H0BX5MUCZBzJM7fA-AhwwWtM4Y3B9r9s9l5_yxuzb5FS91XYs62SEUOdoPInMucU_wHjdnFuRbYKJnNWmNXmjEJ8DiR25KxT67Z45q9ZTp4hnOiN0DKwsVJwGNZ8bo2d4rvcwySHAiTazsLZja3w78wWIQsFqe2XEFb00_ceHY7-_eQkkKGUX0Lfi' },
    { rank: 1, name: 'VoidWalker', winRate: '74.2%', wins: 1482, avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCLxR6NGjFNWM0thd4T-at0y-HLY3gyVc9AolQNwuR_UYGT4C2uZA7uA4jExkC-fYcKNUubagGqvxuwzCVp6iHZ44S0zhbJlbkrN5e0XMqWkE8RGJcgKut3srg6tmGVVAyGMrVG0Kkh7kni2O6-w6A9dRWz09f7UHlYbBOEV60jJ8N7H-cqnPN2QZF7tHZd3YpsGpMJe-yAiqky5Zq5_kMmzYkgVCUvmO7WRg0hgXa26k3qLZfKjdmlg9Rr1v8dGuezDp397pMY59c3' },
    { rank: 3, name: 'CipherQueen', winRate: '68.5%', wins: 984, avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBe4vystZAHgexWpW91ZZRTIsPC0irIK4xG42O8RFwXIvYzrU1Geht-k-3tV11hA1sP0yTFbcW3U5yYQsPejEFkdnhsJlA9Y_H4Ualj7mIx0v-eOcUTjNC2VXuGDOJnu1tA0zQ16m28_zpqkeyWEKQtihs2KEvEeXfwICaEsSbonkTj4HokW1kkE9nAQ-RnPxjQ8-ybVrgy9LPKqLqJ4uPHkQBT461lK6UkXOnj4LbGqlnzCBWLNP_7gZJT5IbGYilbzUOoLbVL1sMb' },
  ];

  const friends = [
    { name: 'PixelPaladin', status: 'In Match', active: true },
    { name: 'CipherQueen', status: 'Online', active: true },
    { name: 'ByteCrusader', status: 'Offline', active: false },
    { name: 'Synthesizer', status: 'Online', active: true },
  ];

  return (
    <div className="space-y-8 animate-fade-in py-12 text-[#dfe3e1]">
      <header className="space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#4e4174]/15 border border-[#cebefa]/20 text-[#cebefa] text-xs font-semibold uppercase tracking-widest">
          <Trophy className="w-3.5 h-3.5" />
          Hall of Fame
        </div>
        <h1 className="font-headline-xl text-4xl font-bold">Leaderboard</h1>
        <p className="font-body-lg text-[#c0c8c5] max-w-2xl">
          Observe and benchmark against the finest creators in our global system.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Podium + Standings Table */}
        <section className="lg:col-span-8 space-y-8">
          
          {/* Podium representation */}
          <div className="grid grid-cols-3 gap-4 items-end pt-12">
            
            {/* 2nd Place */}
            <div className="bg-[#1c2120]/40 backdrop-blur-md rounded-2xl p-4 border border-[#a1d0c6]/5 text-center flex flex-col items-center gap-2 h-56 justify-end relative">
              <div className="absolute top-[-24px] w-12 h-12 rounded-full border border-[#cebefa]/40 bg-[#1c2120] p-0.5 overflow-hidden">
                <img className="w-full h-full object-cover rounded-full" src={podium[0].avatar} alt="" />
              </div>
              <span className="text-sm font-bold truncate max-w-full">{podium[0].name}</span>
              <span className="text-[10px] text-[#c0c8c5]">Wins: {podium[0].wins}</span>
              <div className="w-full bg-[#cebefa]/10 border border-[#cebefa]/20 py-2.5 rounded-lg text-lg font-black text-[#cebefa]">
                Rank 2
              </div>
            </div>

            {/* 1st Place */}
            <div className="bg-[#1c2120]/60 backdrop-blur-md rounded-2xl p-5 border border-[#a1d0c6]/20 text-center flex flex-col items-center gap-2 h-64 justify-end relative shadow-lg shadow-[#a1d0c6]/5">
              <div className="absolute top-[-30px] w-16 h-16 rounded-full border-2 border-[#a1d0c6] bg-[#1c2120] p-1 overflow-hidden">
                <img className="w-full h-full object-cover rounded-full" src={podium[1].avatar} alt="" />
              </div>
              <div className="flex items-center gap-1.5 text-[#a1d0c6]">
                <Sparkles className="w-4 h-4" />
                <span className="text-base font-bold truncate max-w-[120px]">{podium[1].name}</span>
              </div>
              <span className="text-xs text-[#c0c8c5]">Wins: {podium[1].wins}</span>
              <div className="w-full bg-[#a1d0c6]/20 border border-[#a1d0c6]/30 py-4 rounded-lg text-2xl font-black text-[#a1d0c6] flex items-center justify-center gap-1">
                🏆 Winner
              </div>
            </div>

            {/* 3rd Place */}
            <div className="bg-[#1c2120]/40 backdrop-blur-md rounded-2xl p-4 border border-[#a1d0c6]/5 text-center flex flex-col items-center gap-2 h-48 justify-end relative">
              <div className="absolute top-[-20px] w-10 h-10 rounded-full border border-gray-500/30 bg-[#1c2120] p-0.5 overflow-hidden">
                <img className="w-full h-full object-cover rounded-full" src={podium[2].avatar} alt="" />
              </div>
              <span className="text-sm font-bold truncate max-w-full">{podium[2].name}</span>
              <span className="text-[10px] text-[#c0c8c5]">Wins: {podium[2].wins}</span>
              <div className="w-full bg-[#4e4174]/20 border border-[#4e4174]/30 py-2 rounded-lg text-sm font-extrabold text-[#c0b0eb]">
                Rank 3
              </div>
            </div>

          </div>

          {/* Leaderboard list */}
          <div className="bg-[#1c2120]/80 rounded-2xl border border-[#a1d0c6]/10 overflow-hidden shadow-xl">
            <div className="p-4 md:p-6 border-b border-[#dfe3e1]/5 flex justify-between items-center bg-[#262b2a]/35">
              <h2 className="font-bold text-lg text-[#dfe3e1]">Top Standings</h2>
              <span className="text-xs text-[#c0c8c5]/60">Showing absolute XP leaderboards</span>
            </div>

            <div className="divide-y divide-[#dfe3e1]/5">
              {leaders.map((p) => {
                const isYou = p.rank === 142;
                return (
                  <div
                    key={p.rank}
                    className={`flex items-center justify-between p-4 md:p-5 transition-colors ${
                      isYou 
                        ? 'bg-[#a1d0c6]/5 hover:bg-[#a1d0c6]/10 border-l-2 border-[#a1d0c6]' 
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Rank Indicator */}
                      <span className={`w-8 text-center font-bold text-sm ${isYou ? 'text-[#a1d0c6]' : 'text-[#c0c8c5]'}`}>
                        #{p.rank}
                      </span>
                      {/* Name Card */}
                      <div className="text-left">
                        <p className={`font-bold text-sm md:text-base ${isYou ? 'text-[#a1d0c6]' : 'text-[#dfe3e1]'}`}>
                          {p.name}
                        </p>
                        <p className="text-[10px] text-[#c0c8c5]/50 uppercase tracking-widest">{p.title}</p>
                      </div>
                    </div>

                    {/* Stats metrics */}
                    <div className="flex items-center gap-6 md:gap-12 font-mono text-xs md:text-sm text-[#dfe3e1]/90">
                      <div className="hidden sm:block text-right">
                        <p className="text-[9px] font-bold text-[#c0c8c5]/40 uppercase tracking-widest">Wins</p>
                        <p className="font-bold">{p.wins}</p>
                      </div>
                      <div className="hidden sm:block text-right">
                        <p className="text-[9px] font-bold text-[#c0c8c5]/40 uppercase tracking-widest">Win Rate</p>
                        <p className="font-bold">{p.rate}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-bold text-[#c0c8c5]/40 uppercase tracking-widest">Score XP</p>
                        <p className="font-bold text-[#a1d0c6]">{p.xp.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Right Sidebar: Active Online Friends */}
        <aside className="lg:col-span-4 bg-[#1c2120]/80 rounded-2xl p-6 border border-[#a1d0c6]/10 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#a1d0c6] uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4" />
              Online Friends
            </h2>
            <span className="text-[10px] bg-[#a1d0c6]/20 text-[#a1d0c6] font-bold px-2 py-0.5 rounded-full">
              {friends.filter(f => f.active).length} online
            </span>
          </div>

          <div className="space-y-3.5">
            {friends.map((friend) => (
              <div
                key={friend.name}
                className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-transparent hover:border-[#a1d0c6]/20 hover:bg-white/10 transition-all duration-300 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#353a39] border border-white/5 flex items-center justify-center font-bold text-xs uppercase relative select-none">
                    {friend.name.substring(0, 2)}
                    {friend.active && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border border-[#1c2120]" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#dfe3e1]">{friend.name}</h3>
                    <p className={`text-[10px] uppercase font-bold tracking-wider leading-none ${friend.status === 'In Match' ? 'text-[#cebefa]' : 'text-gray-500'}`}>
                      {friend.status}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button className="text-[#a1d0c6] hover:text-white transition-colors p-1 rounded hover:bg-white/5" title="Message">
                    <MessageSquare className="w-4 h-4" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-[#c0c8c5]/40" />
                </div>
              </div>
            ))}
          </div>
        </aside>

      </div>
    </div>
  );
}
