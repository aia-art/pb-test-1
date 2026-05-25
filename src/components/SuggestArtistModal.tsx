import { useState } from 'react';
import { X } from 'lucide-react';
import { FORMS, FIELDS } from '../config';
import { submitToGoogleForm, getHandle, setHandle } from '../utils/forms';

interface Props { onClose: () => void; }

const Input = "w-full bg-[#0d1211]/80 border border-[#a1d0c6]/20 focus:border-[#a1d0c6]/50 rounded-xl px-3 py-2 text-sm text-[#dfe3e1] placeholder-[#c0c8c5]/30 outline-none transition-all";
const TextArea = `${Input} resize-none min-h-[75px]`;
function Field({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-[#c0c8c5]/50 uppercase tracking-widest">
        {label}{note && <span className="normal-case tracking-normal font-normal text-[#c0c8c5]/30 ml-1">— {note}</span>}
      </label>
      {children}
    </div>
  );
}

export default function SuggestArtistModal({ onClose }: Props) {
  const [ncTag,     setNcTag]     = useState('');
  const [faction,   setFaction]   = useState('');
  const [abilities, setAbilities] = useState('');
  const [prompts,   setPrompts]   = useState('');
  const [reason,    setReason]    = useState('');
  const [submitter, setSubmitter] = useState(getHandle());
  const [sent,      setSent]      = useState(false);
  const [tagError,  setTagError]  = useState(false);

  function submit() {
    if (!ncTag.trim()) { setTagError(true); return; }
    if (submitter) setHandle(submitter);
    submitToGoogleForm(FORMS.SUGGEST_ARTIST, {
      [FIELDS.SUGGEST_ARTIST.nc_tag]:    ncTag,
      [FIELDS.SUGGEST_ARTIST.faction]:   faction,
      [FIELDS.SUGGEST_ARTIST.abilities]: abilities,
      [FIELDS.SUGGEST_ARTIST.prompts]:   prompts,
      [FIELDS.SUGGEST_ARTIST.reason]:    reason,
      [FIELDS.SUGGEST_ARTIST.submitter]: submitter,
    });
    setSent(true);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#1c2120] border border-[#a1d0c6]/15 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center px-6 py-4 border-b border-[#dfe3e1]/5 sticky top-0 bg-[#1c2120] z-10">
          <div>
            <h2 className="text-lg font-bold text-[#dfe3e1]">Suggest an Artist</h2>
            <p className="text-xs text-[#c0c8c5]/50 mt-0.5">Your handle stays private — it won't be shared publicly.</p>
          </div>
          <button onClick={onClose} className="text-[#c0c8c5]/50 hover:text-[#dfe3e1] p-1 rounded-lg hover:bg-white/5"><X className="w-4 h-4" /></button>
        </div>

        {sent ? (
          <div className="p-8 text-center space-y-3">
            <div className="text-3xl">✦</div>
            <h3 className="text-xl font-bold text-[#dfe3e1]">Suggestion sent!</h3>
            <p className="text-sm text-[#c0c8c5]">Thank you. I'll look into them.</p>
            <button onClick={onClose} className="mt-2 px-5 py-2 bg-[#a1d0c6]/10 hover:bg-[#a1d0c6]/20 text-[#a1d0c6] rounded-xl text-sm font-semibold transition-all">Close</button>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <Field label="Artist's NightCafe tag">
              <input className={`${Input} ${tagError ? 'border-red-500/50' : ''}`} value={ncTag}
                onChange={e => { setNcTag(e.target.value); setTagError(false); }} placeholder="@theircreatorname" />
              {tagError && <p className="text-red-400 text-xs mt-1">Artist tag is required.</p>}
            </Field>
            <Field label="Suggested faction(s)" note="optional">
              <input className={Input} value={faction} onChange={e => setFaction(e.target.value)} placeholder="e.g. Experimentalist, Legends..." />
            </Field>
            <Field label="Ability ideas" note="optional">
              <textarea className={TextArea} value={abilities} onChange={e => setAbilities(e.target.value)}
                placeholder="What would make them a unique Creator card? Any mechanics that fit their style?" />
            </Field>
            <Field label="Favourite prompt ideas" note="optional">
              <textarea className={TextArea} value={prompts} onChange={e => setPrompts(e.target.value)}
                placeholder="Their go-to keywords, style, subject matter..." />
            </Field>
            <Field label="Why should they be in the game?" note="optional">
              <textarea className={TextArea} value={reason} onChange={e => setReason(e.target.value)}
                placeholder="What makes them iconic in the community?" />
            </Field>
            <Field label="Your handle" note="private — never shared">
              <input className={Input} value={submitter} onChange={e => setSubmitter(e.target.value)} placeholder="@yourname" />
            </Field>
            <button onClick={submit} className="w-full py-3 bg-[#a1d0c6] text-[#033730] font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-[#a1d0c6]/20">
              Send Suggestion
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
