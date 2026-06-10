// E-002 Community Drama
// 7 Credits. Instant. Opponent Creator loses 2 Loyalty. That player draws 1 card.
import type { CardModule } from '../_types';
const card: CardModule = {
  id: 'E-002',
  effects: {
    onEvent: (s, h, pid) => {
      const oppId = pid === 'player' ? 'ai' : 'player';
      let state = h.applyLoyaltyDamage(s, oppId, 2);
      if (state.phase !== 'gameover') state = h.drawCard(state, oppId, 1);
      return h.addLog(state, `Community Drama! ${oppId} loses 2 Loyalty and draws 1 card.`, 'damage');
    },
  },
};
export default card;
