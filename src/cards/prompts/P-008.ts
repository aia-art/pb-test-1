// P-008 So That's How They Trained It
// Negative. +1 Quality, creation is watermark-immune.
import type { CardModule } from '../_types';
const card: CardModule = {
  id: 'P-008',
  effects: {
    onActivation: (draft) => ({
      ...draft,
      quality: draft.quality + 1,
      watermarkImmune: true,
    }),
  },
};
export default card;
