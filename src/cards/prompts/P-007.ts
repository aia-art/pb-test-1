// P-007 What's Wrong with the Hands
// Negative. +1 Quality.
import type { CardModule } from '../_types';
const card: CardModule = {
  id: 'P-007',
  effects: {
    onActivation: (draft) => ({ ...draft, quality: draft.quality + 1 }),
  },
};
export default card;
