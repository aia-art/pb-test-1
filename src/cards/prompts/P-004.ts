// P-004 Did You Steal This Prompt?
// Artist. +2 Vis, +1 Glitch locked until start of 2nd turn after entry.
import type { CardModule } from '../_types';
const card: CardModule = {
  id: 'P-004',
  effects: {
    onActivation: (draft, ctx) => ({
      ...draft,
      visibilityCounters: draft.visibilityCounters + 2,
      glitchTokens: draft.glitchTokens + 1,
      jbGlitchLockedUntilAbsTurn: ctx.absTurn + 2,
    }),
  },
};
export default card;
