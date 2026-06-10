// M-002 Juggernaut v9
// Abstract creations +1 Quality on entry
import type { CardModule } from '../_types';
import { effectiveStyle } from '../../game/gameEngine';
const card: CardModule = {
  id: 'M-002',
  effects: {
    onCreationEnter: (s, h, pid, creation) => {
      const eStyle = h.effectiveStyle(creation.styleTag, s);
      if (eStyle !== 'Abstract') return s;
      const p = { ...s.players[pid] };
      p.activeCreations = p.activeCreations.map(c =>
        c.instanceId === creation.instanceId ? { ...c, quality: c.quality + 1 } : c
      );
      return { ...s, players: { ...s.players, [pid]: p } };
    },
  },
};
export default card;
