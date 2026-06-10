// MO-010 Noise
// Model Modifier. 5 turns. All new creations from any model -1 Quality (min 1).
import type { CardModule } from '../_types';
const card: CardModule = {
  id: 'MO-010',
  effects: {
    onAttach: (s, h, _pid, targetId) => {
      const models = s.sharedModels.map(m =>
        m.instanceId === targetId ? { ...m, noiseTurnsRemaining: 5 } : m
      );
      return h.addLog({ ...s, sharedModels: models },
        `Noise attached to model. New creations -1 Quality for 5 turns.`, 'effect');
    },
  },
};
export default card;
