import { useState, useEffect } from 'react';
import { Award, Lock } from 'lucide-react';
import { BETA_TOKENS } from '../config';

interface BetaGateProps { onUnlock: () => void; }

export default function BetaGate({ onUnlock }: BetaGateProps) {
  const [code, setCode]       = useState('');
  const [error, setError]     = useState(false);
  const [shaking, setShaking] = useState(false);

  function tryUnlock() {
    const v = code.trim().toUpperCase();
    if (BETA_TOKENS.includes(v)) {
      localStorage.setItem('pb_beta_token', v);
      onUnlock();
    } else {
      setError(true);
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
    }
  }

  return (
    <div className="min-h-screen bg-[#0d1211] bg-radial-[at_top_right] from-[#1c2925] via-[#0d1211] to-[#050606] flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-[#a1d0c6]/10 border border-[#a1d0c6]/30 flex items-center justify-center">
            <Award className="w-8 h-8 text-[#a1d0c6]" />
          </div>
          <h1 className="text-4xl font-bold text-[#dfe3e1] tracking-tight">Prompt Battle TCG</h1>
          <p className="text-[#c0c8c5]/60 text-sm font-mono uppercase tracking-widest">
            Set 001 · First Render · Beta Access
          </p>
        </div>

        <div className={`bg-[#1c2120]/80 backdrop-blur-xl border rounded-2xl p-8 space-y-5 shadow-2xl transition-all
          ${shaking ? 'animate-[shake_0.4s_ease]' : ''}
          ${error ? 'border-red-500/30' : 'border-[#a1d0c6]/10'}`}>

          <div className="flex items-center gap-2 text-[#c0c8c5]/60 justify-center">
            <Lock className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-widest">Beta Access Code</span>
          </div>

          <input
            type="text"
            value={code}
            onChange={e => { setCode(e.target.value); setError(false); }}
            onKeyDown={e => e.key === 'Enter' && tryUnlock()}
            placeholder="FIRSTRENDER-000"
            spellCheck={false}
            autoComplete="off"
            className="w-full bg-[#0d1211]/80 border border-[#a1d0c6]/20 focus:border-[#a1d0c6]/60 rounded-xl px-4 py-3 text-center font-mono text-lg text-[#dfe3e1] tracking-widest placeholder-[#c0c8c5]/20 outline-none transition-all"
          />

          {error && (
            <p className="text-red-400 text-xs font-semibold animate-fade-in">
              Invalid code. Check your beta invite.
            </p>
          )}

          <button
            onClick={tryUnlock}
            className="w-full py-3 bg-[#a1d0c6] text-[#033730] font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-[#a1d0c6]/20"
          >
            Enter Beta →
          </button>
        </div>

        <p className="text-[#c0c8c5]/30 text-xs font-mono">
          Access codes distributed privately by @aia
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-8px)}
          40%{transform:translateX(8px)}
          60%{transform:translateX(-5px)}
          80%{transform:translateX(5px)}
        }
      `}</style>
    </div>
  );
}
