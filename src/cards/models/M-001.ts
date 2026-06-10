// M-001 Coherent Low Settings
// +1 Vis on entry; CLIP-LOCK eligible (handled by engine passive)
import type { CardModule } from '../_types';
const card: CardModule = {
  id: 'M-001',
  effects: {
    onCreationEnter: (s, h, pid, creation) =>
      h.addVisibility(s, pid, creation.instanceId, 1),
  },
};
export default card;
