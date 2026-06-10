// E-007 Tip Received
// 0 Credits. Main Phase. Requires PRO Subscription. Gain 4 Credits.
import type { CardModule } from '../_types';
const card: CardModule = {
  id: 'E-007',
  effects: {
    onEvent: (s, h, pid) => {
      if (!s.players[pid].mods.proSub)
        return h.addLog(s, `Tip Received requires PRO Subscription.`, 'system');
      return h.addLog(h.applyCredits(s, pid, 4), `Tip Received! +4 Credits.`, 'effect');
    },
  },
};
export default card;
