// MO-009 Queue Skip
// Model Modifier. Single use. Next creation from this model enters immediately.
import type { CardModule } from '../_types';
const card: CardModule = {
  id: 'MO-009',
  effects: {
    onAttach: (s, h, _pid, targetId) => {
      const models = s.sharedModels.map(m =>
        m.instanceId === targetId ? { ...m, queueSkipReady: true } : m
      );
      return h.addLog({ ...s, sharedModels: models },
        `Queue Skip attached. Next creation enters the field immediately.`, 'effect');
    },
  },
};
export default card;
