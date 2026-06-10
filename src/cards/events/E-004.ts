// E-004 Priority Rendering
// 3 Credits. Instant. Move a queued creation to arrive next turn (runtime → 1).
import type { CardModule } from '../_types';
const card: CardModule = {
  id: 'E-004',
  effects: {
    onEvent: (s, h, pid, targetId) => {
      const p = { ...s.players[pid] };
      const idx = p.queue.findIndex(c => c.instanceId === targetId && !c.isInRemixQueue);
      if (idx === -1) return h.addLog(s, `Priority Rendering: target not in queue.`, 'system');
      p.queue = p.queue.map((c, i) => i === idx ? { ...c, runtime: 1 } : c);
      return h.addLog({ ...s, players: { ...s.players, [pid]: p } },
        `Priority Rendering! Creation arrives next turn.`, 'effect');
    },
  },
};
export default card;
