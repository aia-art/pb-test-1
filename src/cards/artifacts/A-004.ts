// A-004 Credit Drop
// Condition. Immediate. All players +3 Credits.
import type { CardModule } from '../_types';
const card: CardModule = {
  id: 'A-004',
  effects: {
    onPlay: (s, h) => {
      let state = h.applyCredits(s, 'player', 3);
      state = h.applyCredits(state, 'ai', 3);
      return h.addLog(state, `Credit Drop! All players gain 3 Credits.`, 'effect');
    },
  },
};
export default card;
