import { useState } from 'react';
import { X, Star } from 'lucide-react';
import { FORMS, FIELDS } from '../config';
import { submitToGoogleForm, getHandle, setHandle } from '../utils/forms';

interface Props { onClose: () => void; }

export default function FeedbackModal({ onClose }: Props) {
  const [handle,   setHandleState] = useState(getHandle());
  const [category, setCategory]    = useState('Bug');
  const [rating,   setRating]      = useState(0);
  const [subject,  setSubject]     = useState('');
  const [message,  setMessage]     = useState('');
  const [sent,     setSent]        = useState(false);
  const [msgError, setMsgError]    = useState(false);

  function submit() {
    if (!message.trim()) { setMsgError(true); return; }
    if (handle) setHandle(handle);
    submitToGoogleForm(FORMS.FEEDBACK, {
      [FIELDS.FEEDBACK.handle]:   handle,
      [FIELDS.FEEDBACK.category]: category,
      [FIELDS.FEEDBACK.rating]:   String(rating),
      [FIELDS.FEEDBACK.subject]:  subject,
      [FIELDS.FEEDBACK.message]:  message,
    });
    setSent(true);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#1c2120] border border-[#a1d0c6]/15 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in">
        <div className="flex justify-between items-center px-6 py-4 border-b border-[#dfe3e1]/5">
          <h2 className="text-lg font-bold text-[#dfe3e1]">Send Feedback</h2>
          <button onClick={onClose} className="text-[#c0c8c5]/50 hover:text-[#dfe3e1] p-1 rounded-lg hover:bg-white/5"><X className="w-4 h-4" /></button>
        </div>

        {sent ? (
          <div className="p-8 text-center space-y-3">
            <div className="text-3xl">✉</div>
            <h3 className="text-xl font-bold text-[#dfe3e1]">Thank you!</h3>
            <p className="text-sm text-[#c0c8c5]">Your feedback has been sent. It means a lot.</p>
            <button onClick={onClose} className="mt-2 px-5 py-2 bg-[#a1d0c6]/10 hover:bg-[#a1d0c6]/20 text-[#a1d0c6] rounded-xl text-sm font-semibold transition-all">Close</button>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <Field label="Your handle">
              <input className={Input} value={handle} onChange={e => setHandleState(e.target.value)} placeholder="@yourname" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <select className={Input} value={category} onChange={e => setCategory(e.target.value)}>
                  {['Bug', 'Balance', 'Suggestion', 'Praise', 'Other'].map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Rating">
                <div className="flex gap-1 pt-1">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => setRating(n)} className={`text-xl transition-colors ${n <= rating ? 'text-[#a1d0c6]' : 'text-[#c0c8c5]/20 hover:text-[#a1d0c6]/50'}`}>★</button>
                  ))}
                </div>
              </Field>
            </div>

            <Field label="Subject">
              <input className={Input} value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief description" />
            </Field>

            <Field label="Message">
              <textarea
                className={`${Input} resize-none min-h-[90px] ${msgError ? 'border-red-500/50' : ''}`}
                value={message}
                onChange={e => { setMessage(e.target.value); setMsgError(false); }}
                placeholder="Tell me more..."
              />
              {msgError && <p className="text-red-400 text-xs mt-1">Message is required.</p>}
            </Field>

            <button onClick={submit} className="w-full py-3 bg-[#a1d0c6] text-[#033730] font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-[#a1d0c6]/20">
              Send Feedback
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const Input = "w-full bg-[#0d1211]/80 border border-[#a1d0c6]/20 focus:border-[#a1d0c6]/50 rounded-xl px-3 py-2 text-sm text-[#dfe3e1] placeholder-[#c0c8c5]/30 outline-none transition-all";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-[#c0c8c5]/50 uppercase tracking-widest">{label}</label>
      {children}
    </div>
  );
}
