// E-008 Generation Cancelled
// 2 Credits. Instant. Remove target opponent queued creation. No Loyalty loss.
import type { CardModule } from '../_types';
const card: CardModule = {
  id: 'E-008',
  effects: {
    onEvent: (s, h, pid, targetId) => {
      const oppId = pid === 'player' ? 'ai' : 'player';
      const opp = { ...s.players[oppId] };
      const before = opp.queue.length;
      opp.queue = opp.queue.filter(c => c.instanceId !== targetId || c.isInRemixQueue);
      if (opp.queue.length === before)
        return h.addLog(s, `Generation Cancelled: target not in opponent queue.`, 'system');
      return h.addLog({ ...s, players: { ...s.players, [oppId]: opp } },
        `Generation Cancelled! Opponent's queued creation removed.`, 'damage');
    },
  },
};
export default card;
