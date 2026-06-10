// P-002 Men...
// Style. Assigns Portrait, +1 Vis. NOT compatible with Coherent variants.
import type { CardModule } from '../_types';
const card: CardModule = {
  id: 'P-002',
  effects: {
    onActivation: (draft, ctx) => {
      if (ctx.modelCardId === 'M-001') return draft; // incompatible
      return { ...draft, styleTag: 'Portrait', visibilityCounters: draft.visibilityCounters + 1 };
    },
  },
};
export default card;
