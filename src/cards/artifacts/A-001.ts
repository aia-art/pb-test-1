// A-001 Centaur Problem
// Anomaly. 3 rounds. Fantasy creations entering: +1 Glitch.
// Each round start, all Fantasy active creations +1 Glitch.
// Removable for 3 Credits.
import type { CardModule } from '../_types';
const card: CardModule = {
  id: 'A-001',
  effects: {
    onPlay: (s, h, pid) => {
      const state = { ...s, centaurProblemRounds: 3 };
      return h.addLog(state, `Centaur Problem! All Fantasy Creations gain Glitch each round.`, 'effect');
    },
  },
};
export default card;
