// E-009 Daily Challenge: Abstractions
// 2 Credits. Main Phase. This round: Abstract creations double rep.
// Most rep from Abstract this round gains +3 rep at round end.
import type { CardModule } from '../_types';
const card: CardModule = {
  id: 'E-009',
  effects: {
    onEvent: (s, h, pid) => {
      const state = { ...s, dailyChallengeAbstracts: { round: s.round } };
      return h.addLog(state, `Daily Challenge: Abstractions! Abstract creations generate double Rep.`, 'effect');
    },
  },
};
export default card;
