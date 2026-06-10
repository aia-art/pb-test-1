// MO-007 PRO Subscription
// Creator Modifier. 3 turns. Half activation cost 1/turn. Credit cap +3.
// +1 Credit per turn. All Runtimes -1 (min 1).
// Expiry: cap returns to 10; if >10 credits lose 5 rep; if rep<=0 lose 1 loyalty reset rep.
import type { CardModule } from '../_types';
const CREDIT_CAP_DEFAULT = 10;
const card: CardModule = {
  id: 'MO-007',
  effects: {
    onAttach: (s, h, pid) => {
      const p = {
        ...s.players[pid],
        creditCap: s.players[pid].creditCap + 3,
        mods: { ...s.players[pid].mods, proSub: { turnsRemaining: 3, halfCostUsedThisTurn: false } },
      };
      return h.addLog({ ...s, players: { ...s.players, [pid]: p } },
        `PRO Subscription attached to ${pid}. Credit cap +3, Runtimes -1.`, 'effect');
    },
  },
};
export default card;
