// A-002 Queue Timeout
// Anomaly. 3 rounds. All Runtimes +1. Affects existing queue too.
// Removable for 3 Credits.
import type { CardModule } from '../_types';
const card: CardModule = {
  id: 'A-002',
  effects: {
    onPlay: (s, h) => {
      let state = { ...s, queueTimeoutRounds: 3 };
      // Add +1 runtime to all existing queued creations
      for (const pid of ['player', 'ai'] as import('../../game/gameTypes').PlayerId[]) {
        const p = { ...state.players[pid] };
        p.queue = p.queue.map(c => ({ ...c, runtime: c.runtime + 1 }));
        state = { ...state, players: { ...state.players, [pid]: p } };
      }
      return h.addLog(state, `Queue Timeout! All Runtimes +1.`, 'effect');
    },
  },
};
export default card;
