// M-004 Stable Diffusion 1.5
// All creations +1 Glitch on entry (regardless of style)
import type { CardModule } from '../_types';
const card: CardModule = {
  id: 'M-004',
  effects: {
    onCreationEnter: (s, h, pid, creation) =>
      h.addGlitch(s, pid, creation.instanceId, false),
  },
};
export default card;
