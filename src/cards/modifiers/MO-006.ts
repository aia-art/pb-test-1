// MO-006 Ban
// Creator Modifier. Duration: 1 turn per opponent model in play.
// Target creator cannot use abilities; no rep from creations.
import type { CardModule } from '../_types';
const card: CardModule = {
  id: 'MO-006',
  effects: {
    onAttach: (s, h, pid, targetId) => {
      const oppModels = s.sharedModels.filter(m => m.ownerId !== targetId).length;
      const duration = Math.max(1, oppModels);
      const target = targetId as import('../../game/gameTypes').PlayerId;
      const p = { ...s.players[target], mods: { ...s.players[target].mods, ban: { turnsRemaining: duration } } };
      return h.addLog({ ...s, players: { ...s.players, [target]: p } },
        `Ban applied to ${target}'s Creator for ${duration} turn(s).`, 'effect');
    },
  },
};
export default card;
