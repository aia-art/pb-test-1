// MO-001 The Astronaut
// Creator Modifier. 3 turns. +3 Loyalty on attach. New creations +2 Vis.
// Active creations +1 Vis per turn. On detach: +1 Glitch all, half rep next turn.
import type { CardModule } from '../_types';
const card: CardModule = {
  id: 'MO-001',
  effects: {
    onAttach: (s, h, pid) => {
      const p = { ...s.players[pid], mods: { ...s.players[pid].mods, astronaut: { turnsRemaining: 3 } } };
      let state = { ...s, players: { ...s.players, [pid]: p } };
      state = h.gainLoyalty(state, pid, 3);
      return h.addLog(state, `Astronaut attached to ${pid}'s Creator. +3 Loyalty.`, 'effect');
    },
  },
};
export default card;
