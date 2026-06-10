// MO-008 Featured
// Creation Modifier. 3 turns. Doubles rep. Negative effects also hit it.
// If Vis drops below 6: lose 1 Quality and modifier discarded.
// Requires 6+ Vis to attach (enforced by target spec in engine).
import type { CardModule } from '../_types';
const card: CardModule = {
  id: 'MO-008',
  effects: {
    onAttach: (s, h, pid, targetId) => {
      const p = { ...s.players[pid] };
      p.activeCreations = p.activeCreations.map(c =>
        c.instanceId === targetId ? { ...c, featuredTurnsRemaining: 3 } : c
      );
      return h.addLog({ ...s, players: { ...s.players, [pid]: p } },
        `Featured modifier attached. Creation generates double Rep for 3 turns.`, 'effect');
    },
  },
};
export default card;
