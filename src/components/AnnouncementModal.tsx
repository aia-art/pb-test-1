import { useEffect, useState } from 'react';
import { Bell, X, AlertTriangle } from 'lucide-react';
import type { Announcement, AnnouncementIndex } from '../types';

// Tries to load from /announcements/. Works on GitHub Pages + local server.
async function fetchAnnouncements(): Promise<Announcement | null> {
  try {
    const idxRes  = await fetch(import.meta.env.BASE_URL + 'announcements/index.json');
    if (!idxRes.ok) return null;
    const list: AnnouncementIndex[] = await idxRes.json();
    if (!list.length) return null;
    const latest  = list[list.length - 1];
    const annRes  = await fetch(import.meta.env.BASE_URL + `announcements/${latest.id}.json`);
    if (!annRes.ok) return null;
    return await annRes.json();
  } catch { return null; }
}

// ── Bell badge (shown in TopNavBar) ──────────────────────────
interface BellProps { onClick: () => void; unread: boolean; }
export function AnnouncementBell({ onClick, unread }: BellProps) {
  return (
    <button
      onClick={onClick}
      className="text-[#c0c8c5] hover:text-[#a1d0c6] transition-colors relative p-1.5 rounded-full hover:bg-white/5 active:scale-95 duration-200"
    >
      <Bell className="w-5 h-5" />
      {unread && (
        <span className="absolute top-1 right-1 w-2 h-2 bg-[#cebefa] rounded-full animate-ping" />
      )}
    </button>
  );
}

// ── Modal ─────────────────────────────────────────────────────
interface ModalProps { ann: Announcement; onClose: () => void; }
function AnnouncementContent({ ann, onClose }: ModalProps) {
  // Simple markdown to JSX — just paragraphs, bold, bullet lists
  const renderBody = (md: string) =>
    md.split('\n\n').map((block, i) => {
      if (block.startsWith('- ') || block.startsWith('* ')) {
        const items = block.split('\n').map(l => l.replace(/^[-*]\s/, ''));
        return (
          <ul key={i} className="list-disc pl-5 space-y-1">
            {items.map((item, j) => (
              <li key={j} className="text-[#c0c8c5] text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.*?)\*\*/g, '<strong class="text-[#dfe3e1]">$1</strong>') }} />
            ))}
          </ul>
        );
      }
      return (
        <p key={i} className="text-[#c0c8c5] text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: block.replace(/\*\*(.*?)\*\*/g, '<strong class="text-[#dfe3e1]">$1</strong>') }} />
      );
    });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#1c2120] border border-[#a1d0c6]/20 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in">
        <div className="p-6 pb-4">
          {ann.priority === 'urgent' && (
            <div className="flex items-center gap-2 text-red-400 text-xs font-bold uppercase tracking-widest mb-3">
              <AlertTriangle className="w-3.5 h-3.5" /> Important
            </div>
          )}
          <div className="text-[#a1d0c6] font-mono text-[11px] uppercase tracking-widest mb-1">
            {ann.date} · {ann.author}
          </div>
          <h2 className="text-2xl font-bold text-[#dfe3e1]">{ann.title}</h2>
        </div>
        <div className="px-6 pb-4 space-y-3 max-h-64 overflow-y-auto">
          {renderBody(ann.body)}
        </div>
        <div className="px-6 py-4 border-t border-[#dfe3e1]/5 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#a1d0c6]/10 hover:bg-[#a1d0c6]/20 text-[#a1d0c6] rounded-xl text-sm font-semibold transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Hook: use in App ──────────────────────────────────────────
export function useAnnouncements() {
  const [ann, setAnn]         = useState<Announcement | null>(null);
  const [open, setOpen]       = useState(false);
  const [unread, setUnread]   = useState(false);

  useEffect(() => {
    fetchAnnouncements().then(data => {
      if (!data) return;
      setAnn(data);
      const lastSeen = localStorage.getItem('pb_ann_seen') || '1970-01-01';
      if (data.date > lastSeen) { setUnread(true); setOpen(true); }
    });
  }, []);

  function openAnn()  { setOpen(true); }
  function closeAnn() {
    setOpen(false); setUnread(false);
    localStorage.setItem('pb_ann_seen', new Date().toISOString().split('T')[0]);
  }

  const modal = ann && open ? <AnnouncementContent ann={ann} onClose={closeAnn} /> : null;
  return { modal, openAnn, unread };
}
