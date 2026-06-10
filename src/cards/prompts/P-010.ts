// P-010 What's That
// Artist. +2 Vis, +1 Glitch.
import type { CardModule } from '../_types';
const card: CardModule = {
  id: 'P-010',
  effects: {
    onActivation: (draft) => ({
      ...draft,
      visibilityCounters: draft.visibilityCounters + 2,
      glitchTokens: draft.glitchTokens + 1,
    }),
  },
};
export default card;
