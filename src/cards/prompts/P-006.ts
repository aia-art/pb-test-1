// P-006 Are You Crazy?!
// Style. +3 Quality, +1 Runtime. Only for Coherent variants and SD 1.5.
import type { CardModule } from '../_types';
const card: CardModule = {
  id: 'P-006',
  effects: {
    onActivation: (draft, ctx) => {
      if (ctx.modelCardId !== 'M-001' && ctx.modelCardId !== 'M-004') return draft;
      return { ...draft, quality: draft.quality + 3, runtime: draft.runtime + 1 };
    },
  },
};
export default card;
