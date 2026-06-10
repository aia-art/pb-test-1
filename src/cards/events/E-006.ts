// E-006 Queue Crash
// 3 Credits. Instant. Opponent queued or remix-queue creation: runtime +2.
import type { CardModule } from '../_types';
const card: CardModule = {
  id: 'E-006',
  effects: {
    onEvent: (s, h, pid, targetId) => {
      const oppId = pid === 'player' ? 'ai' : 'player';
      const opp = { ...s.players[oppId] };
      const idx = opp.queue.findIndex(c => c.instanceId === targetId);
      if (idx !== -1) {
        opp.queue = opp.queue.map((c, i) => i === idx ? { ...c, runtime: c.runtime + 2 } : c);
        return h.addLog({ ...s, players: { ...s.players, [oppId]: opp } },
          `Queue Crash! Opponent creation delayed +2 turns.`, 'damage');
      }
      if (opp.remixQueue?.instanceId === targetId) {
        opp.remixQueue = { ...opp.remixQueue, runtime: opp.remixQueue.runtime + 2 };
        return h.addLog({ ...s, players: { ...s.players, [oppId]: opp } },
          `Queue Crash! Opponent remix delayed +2 turns.`, 'damage');
      }
      return h.addLog(s, `Queue Crash: target not found.`, 'system');
    },
  },
};
export default card;
