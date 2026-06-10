// P-001 Good Old Greg
// Artist. Assigns Fantasy. If already Fantasy: +1 Quality. If SD 1.5: +1 Vis.
import type { CardModule } from '../_types';
const card: CardModule = {
  id: 'P-001',
  effects: {
    onActivation: (draft, ctx) => {
      const d = { ...draft };
      if (d.styleTag === 'Fantasy') d.quality += 1;
      else d.styleTag = 'Fantasy';
      if (ctx.modelCardId === 'M-004') d.visibilityCounters += 1;
      return d;
    },
  },
};
export default card;
