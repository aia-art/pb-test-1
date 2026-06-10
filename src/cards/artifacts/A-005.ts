// A-005 Server Overload
// Condition. 3 rounds. All activations cost +1 Credit.
// Active creations gain 0 extra Vis per turn (server busy).
// Cannot be removed.
import type { CardModule } from '../_types';
const card: CardModule = {
  id: 'A-005',
  effects: {
    onPlay: (s, h) => {
      const state = { ...s, serverOverloadRounds: 3 };
      return h.addLog(state,
        `Server Overload! All activations +1 Credit. Creations gain less Visibility.`, 'effect');
    },
  },
};
export default card;
