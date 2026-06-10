// P-005 Here Goes the Paragraph
// Atmosphere. +2 Glitch, +2 Vis. NOT compatible with Coherent variants.
import type { CardModule } from '../_types';
const card: CardModule = {
  id: 'P-005',
  effects: {
    onActivation: (draft, ctx) => {
      if (ctx.modelCardId === 'M-001') return draft; // incompatible
      return {
        ...draft,
        glitchTokens: draft.glitchTokens + 2,
        visibilityCounters: draft.visibilityCounters + 2,
      };
    },
  },
};
export default card;
