// E-010 Daily Challenge: Portraits
// 2 Credits. Main Phase. This round: Portrait creations double rep.
// Each Portrait entering this round +1 Vis. Most Portraits at round end +3 rep.
import type { CardModule } from '../_types';
const card: CardModule = {
  id: 'E-010',
  effects: {
    onEvent: (s, h, pid) => {
      const state = { ...s, dailyChallengePortraits: { round: s.round } };
      return h.addLog(state, `Daily Challenge: Portraits! Portrait creations generate double Rep.`, 'effect');
    },
  },
};
export default card;
