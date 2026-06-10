// E-005 GPU Boost
// 2 Credits. Instant. Target queued creation runtime -2 (min 1).
import type { CardModule } from '../_types';
const card: CardModule = {
  id: 'E-005',
  effects: {
    onEvent: (s, h, pid, targetId) => {
      const p = { ...s.players[pid] };
      const idx = p.queue.findIndex(c => c.instanceId === targetId && !c.isInRemixQueue);
      if (idx === -1) return h.addLog(s, `GPU Boost: target not in queue.`, 'system');
      p.queue = p.queue.map((c, i) => i === idx ? { ...c, runtime: Math.max(1, c.runtime - 2) } : c);
      return h.addLog({ ...s, players: { ...s.players, [pid]: p } },
        `GPU Boost! Queued creation runtime -2.`, 'effect');
    },
  },
};
export default card;
