// M-003 SDXL
// Portrait creations: +1 Vis, +1 Glitch on entry
import type { CardModule } from '../_types';
const card: CardModule = {
  id: 'M-003',
  effects: {
    onCreationEnter: (s, h, pid, creation) => {
      const eStyle = h.effectiveStyle(creation.styleTag, s);
      if (eStyle !== 'Portrait') return s;
      let state = h.addVisibility(s, pid, creation.instanceId, 1);
      state = h.addGlitch(state, pid, creation.instanceId, false);
      return state;
    },
  },
};
export default card;
