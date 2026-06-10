// A-006 Algorithm Swap
// Condition. Until start of your next turn. Choose 2 Style tags, swap them.
// Existing creations revert when it ends; new creations keep swapped tag.
import type { CardModule } from '../_types';
const card: CardModule = {
  id: 'A-006',
  effects: {
    onPlay: (s, h, pid, _targetId, extra) => {
      const [style1, style2] = (extra as import('../../game/gameTypes').StyleTag[]) ?? ['Fantasy', 'Portrait'];
      const state = { ...s, algorithmSwap: { style1, style2, expiresAbsTurn: s.absTurn + 2 } };
      return h.addLog(state, `Algorithm Swap! ${style1} ↔ ${style2} until next turn.`, 'effect');
    },
  },
};
export default card;
