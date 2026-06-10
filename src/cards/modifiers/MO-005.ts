// MO-005 Trending
// Creator Modifier. 3 rounds. All new creations +1 Vis.
import type { CardModule } from '../_types';
const card: CardModule = {
  id: 'MO-005',
  effects: {
    onAttach: (s, h, pid) => {
      const p = { ...s.players[pid], mods: { ...s.players[pid].mods, trending: { roundsRemaining: 3 } } };
      return h.addLog({ ...s, players: { ...s.players, [pid]: p } },
        `Trending attached to ${pid}'s Creator. New creations +1 Vis for 3 rounds.`, 'effect');
    },
  },
};
export default card;
