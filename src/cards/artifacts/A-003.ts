// A-003 Double Dragon Head
// Anomaly. 3 turns. Attaches to Fantasy or Portrait creation.
// Halves rep from that creation. Removable for 2 Credits.
import type { CardModule } from '../_types';
const card: CardModule = {
  id: 'A-003',
  effects: {
    onPlay: (s, h, pid, targetId) => {
      if (!targetId) return h.addLog(s, 'Double Dragon Head needs a target.', 'system');
      const ownerId = (['player', 'ai'] as import('../../game/gameTypes').PlayerId[])
        .find(p => s.players[p].activeCreations.some(c => c.instanceId === targetId));
      if (!ownerId) return h.addLog(s, 'Target not found.', 'system');
      const p = { ...s.players[ownerId] };
      p.activeCreations = p.activeCreations.map(c =>
        c.instanceId === targetId ? { ...c, dragonHeadTurnsRemaining: 3 } : c
      );
      return h.addLog({ ...s, players: { ...s.players, [ownerId]: p } },
        `Double Dragon Head! Target creation generates half Rep for 3 turns.`, 'effect');
    },
  },
};
export default card;
