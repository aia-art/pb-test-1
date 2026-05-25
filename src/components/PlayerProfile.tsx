/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Award, ShieldAlert, Sparkles, Plus, Edit2, Check, BookOpen, Clock, Heart } from 'lucide-react';

export default function PlayerProfile() {
  const [bio, setBio] = useState('First Render Architect. Exploring coherent generative latents and defensive CLIP tokens.');
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [tempBio, setTempBio] = useState(bio);

  const achievements = [
    { id: 'alpha-tester', label: 'Alpha Tester', desc: 'Participated in the first network render.', icon: Award, color: 'text-[#a1d0c6] bg-[#a1d0c6]/10' },
    { id: 'top-creator', label: 'Top 1% Global', desc: 'Ranked in the top percentage of early testers.', icon: Sparkles, color: 'text-[#cebefa] bg-[#cebefa]/10' },
    { id: 'syntax-warden', label: 'Glitch Hunter', desc: 'Successfully recovered from 10 consecutive syntax crashes.', icon: ShieldAlert, color: 'text-red-400 bg-red-400/10' },
  ];

  const publishedDecks = [
    { title: 'Whispering Woods', plays: 124, likes: 45, wins: 84, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCLxR6NGjFNWM0thd4T-at0y-HLY3gyVc9AolQNwuR_UYGT4C2uZA7uA4jExkC-fYcKNUubagGqvxuwzCVp6iHZ44S0zhbJlbkrN5e0XMqWkE8RGJcgKut3srg6tmGVVAyGMrVG0Kkh7kni2O6-w6A9dRWz09f7UHlYbBOEV60jJ8N7H-cqnPN2QZF7tHZd3YpsGpMJe-yAiqky5Zq5_kMmzYkgVCUvmO7WRg0hgXa26k3qLZfKjdmlg9Rr1v8dGuezDp397pMY59c3' },
    { title: 'Obsidian Swarm', plays: 89, likes: 32, wins: 41, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDIauibtYhsRD9WGCCHP1VK6_FZPCY6x5pL0yBMVFbFXKzi9PPHA6bNieeXfzTFnt9-EhItVAty3iUtizmbBce1RZfPTbF0ws13wfJuQ58dRC6012Big3kfdwqZC1pEMdNIPSke-ew3HHEP60TpH8rRl5ZSg7GyGsKnamgZ1CGtgAZg7PKK9g212q1qWzZPDuH-MzT2yAUWa5UZw-rvN-yIlcx7inwkS53F9K5mk485n6tXAKZF_4yRZ-JQSu3IHj8pq1l-oCHpA-fr' }
  ];

  const handleSaveBio = () => {
    setBio(tempBio);
    setIsEditingBio(false);
  };

  return (
    <div className="space-y-10 animate-fade-in py-12 text-[#dfe3e1]">
      {/* Profile Header */}
      <header className="bg-[#1c2120]/60 border border-[#dfe3e1]/10 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row gap-6 items-center md:items-start text-center md:text-left relative overflow-hidden shadow-xl">
        <div className="w-24 h-24 rounded-full border-2 border-[#a1d0c6] overflow-hidden p-1 shrink-0 bg-[#262b2a]">
          <img 
            alt="@aia avatar" 
            className="w-full h-full object-cover rounded-full select-none" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDwldraTNrTxnV2M_4sz-HHJhYWAT1zgWI20ZolZ9MU4gwL_RX7MyqVmATs6kvs3E8gOcmj0sf1FJFipJwJbz4H0BX5MUCZBzJM7fA-AhwwWtM4Y3B9r9s9l5_yxuzb5FS91XYs62SEUOdoPInMucU_wHjdnFuRbYKJnNWmNXmjEJ8DiR25KxT67Z45q9ZTp4hnOiN0DKwsVJwGNZ8bo2d4rvcwySHAiTazsLZja3w78wWIQsFqe2XEFb00_ceHY7-_eQkkKGUX0Lfi"
          />
        </div>

        <div className="flex-grow space-y-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-[#dfe3e1]">@aia</h1>
            <p className="text-xs uppercase tracking-widest font-extrabold text-[#a1d0c6]">First Render Cadet</p>
          </div>

          <div className="text-sm max-w-2xl leading-relaxed">
            {isEditingBio ? (
              <div className="flex flex-col sm:flex-row gap-2 mt-1">
                <input 
                  className="bg-[#181d1c]/80 border border-[#a1d0c6]/30 rounded-lg px-3 py-1.5 focus:outline-none text-white text-xs md:text-sm grow"
                  type="text" 
                  value={tempBio}
                  onChange={e => setTempBio(e.target.value)}
                />
                <button 
                  onClick={handleSaveBio}
                  className="px-3.5 py-1.5 bg-[#a1d0c6] text-[#033730] hover:brightness-110 font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save
                </button>
              </div>
            ) : (
              <div className="flex justify-center md:justify-start items-center gap-2">
                <p className="text-[#c0c8c5]/90 italic">"{bio}"</p>
                <button 
                  onClick={() => { setTempBio(bio); setIsEditingBio(true); }}
                  className="p-1 text-[#c0c8c5]/50 hover:text-[#a1d0c6] cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Core Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1 border-t border-[#dfe3e1]/5">
            <div className="py-2">
              <span className="text-[10px] font-bold text-[#c0c8c5]/40 uppercase tracking-widest block mb-0.5">Wins</span>
              <span className="text-xl font-bold font-mono text-[#a1d0c6]">1,248</span>
            </div>
            <div className="py-2">
              <span className="text-[10px] font-bold text-[#c0c8c5]/40 uppercase tracking-widest block mb-0.5">Played</span>
              <span className="text-xl font-bold font-mono">1,892</span>
            </div>
            <div className="py-2">
              <span className="text-[10px] font-bold text-[#c0c8c5]/40 uppercase tracking-widest block mb-0.5">Win Rate</span>
              <span className="text-xl font-bold font-mono text-[#cebefa]">65.9%</span>
            </div>
            <div className="py-2">
              <span className="text-[10px] font-bold text-[#c0c8c5]/40 uppercase tracking-widest block mb-0.5">Reputation</span>
              <span className="text-xl font-bold font-mono">45.2K</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Grid: Achievements / Published Decks */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Achievements list */}
        <section className="lg:col-span-4 bg-[#1c2120]/80 border border-[#dfe3e1]/10 rounded-2xl p-6 shadow-xl space-y-6">
          <h2 className="text-sm font-bold text-[#a1d0c6] uppercase tracking-wider">Achievements</h2>
          
          <div className="space-y-4">
            {achievements.map((ach) => {
              const IconComp = ach.icon;
              return (
                <div key={ach.id} className="flex gap-3 items-start p-3 rounded-xl bg-white/5 border border-transparent hover:border-[#a1d0c6]/20 transition-all">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${ach.color}`}>
                    <IconComp className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#dfe3e1]">{ach.label}</h3>
                    <p className="text-xs text-[#c0c8c5]/70 leading-relaxed mt-0.5">{ach.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Published Decks lists */}
        <section className="lg:col-span-8 bg-[#1c2120]/80 border border-[#dfe3e1]/10 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-[#a1d0c6] uppercase tracking-wider">Published Decks</h2>
            <button className="flex items-center gap-1 text-xs font-bold text-[#cebefa] hover:underline cursor-pointer">
              <Plus className="w-4 h-4" />
              Publish New
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {publishedDecks.map((deck, idx) => (
              <div 
                key={idx}
                className="group border border-[#a1d0c6]/10 hover:border-[#a1d0c6]/30 bg-[#181d1c]/40 rounded-xl overflow-hidden shadow-md flex items-center p-3 gap-4 hover:-translate-y-0.5 transition-all duration-300"
              >
                <div className="w-16 h-20 rounded bg-black/20 overflow-hidden relative shrink-0">
                  <img 
                    alt={deck.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                    src={deck.img}
                  />
                </div>
                <div className="flex-grow min-w-0 space-y-2">
                  <h3 className="font-bold text-sm text-[#dfe3e1] group-hover:text-[#a1d0c6] transition-colors truncate">
                    {deck.title}
                  </h3>
                  
                  <div className="flex gap-4 text-[10px] text-[#c0c8c5]/70 font-mono">
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5" />
                      {deck.plays}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5" />
                      {deck.likes}
                    </span>
                    <span className="text-[#a1d0c6]">{deck.wins}% WL</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
