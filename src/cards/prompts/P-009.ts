// P-009 Another Landscape
// Style. Assigns Landscape tag.
import type { CardModule } from '../_types';
const card: CardModule = {
  id: 'P-009',
  effects: {
    onActivation: (draft) => ({ ...draft, styleTag: 'Landscape' }),
  },
};
export default card;
