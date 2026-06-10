// E-001 Mass Report
// 7 Rep. Instant (either turn). Cancel a Modifier being played.
// Cannot cancel Astronaut or PRO Sub.
import type { CardModule } from '../_types';
const card: CardModule = {
  id: 'E-001',
  effects: {
    onEvent: (s, h, pid) => {
      if (s.pendingModifierPlay) {
        const state = { ...s, pendingModifierPlay: null };
        return h.addLog(state, `Mass Report! Modifier cancelled.`, 'effect');
      }
      return h.addLog(s, `Mass Report played but no modifier to cancel.`, 'system');
    },
  },
};
export default card;
