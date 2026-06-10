// P-003 Copygazelle
// Negative. Creation immune to opponent effects for 3 turns.
import type { CardModule } from '../_types';
const card: CardModule = {
  id: 'P-003',
  effects: {
    onActivation: (draft, ctx) => ({
      ...draft,
      immuneUntilAbsTurn: ctx.absTurn + 3,
    }),
  },
};
export default card;
