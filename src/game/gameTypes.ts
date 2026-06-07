// ============================================================
// PROMPT BATTLE — Game Engine Types
// ============================================================

export type PlayerId = 'player' | 'ai';
export type StyleTag = 'Fantasy' | 'Landscape' | 'Portrait' | 'Abstract' | 'Atmosphere';
export type GamePhase = 'deck-select' | 'mulligan' | 'playing' | 'gameover';
export type TurnPhase = 'refresh' | 'main' | 'end';
export type LogType  = 'action' | 'effect' | 'damage' | 'system' | 'ai';

// ── Creation on field or in queue ──────────────────────────────────
export interface CreationState {
  instanceId: string;
  modelId: string;              // card ID of model that generated this
  quality: number;              // base quality (effective = quality - glitchTokens)
  glitchTokens: number;
  visibilityCounters: number;
  styleTag: StyleTag | null;
  runtime: number;              // turns remaining in queue (0 = on field or entering)
  isOnField: boolean;
  clipLocked: boolean;
  clipLockAppliedAbsTurn: number;  // for Positive Feedback calculation
  promptsUsed: string[];           // card IDs of prompts used in activation
  loraUsed: string | null;         // LoRA card ID if LoRA remix or activation
  // Prompt/modifier effect tracking
  immuneToOpponentUntilAbsTurn: number; // P-003 Copygazelle: absolute turn when immunity ends
  iridescShiftImmuneThisTurn: boolean;  // Aia ability 3: temp protection
  featuredBurstTriggered: boolean;       // once per creation at 10 visibility
  anonFavPromptVisBonusTurns: number;   // turns remaining for +2 vis (Anon favourite prompt)
  jbGlitchLockedUntilAbsTurn: number;   // P-004: abs turn when lock expires
  watermarkImmune: boolean;             // P-008
  safetyInNumbersThisTurn: boolean;      // Anon's influence: immune to targeting
  // Modifier effects
  featuredTurnsRemaining: number;        // MO-008 Featured (0 = not featured)
  dragonHeadTurnsRemaining: number;      // A-003 Double Dragon Head (0 = not affected)
  // For Remix
  isInRemixQueue: boolean;
  remixNewStyle: StyleTag | null;
}

// ── Model in shared zone ───────────────────────────────────────────
export interface ModelState {
  instanceId: string;
  cardId: string;
  ownerId: PlayerId;
  loraCardId: string | null;
  noiseTurnsRemaining: number;     // MO-010 Noise duration
  queueSkipReady: boolean;         // MO-009 Queue Skip
  activationsThisRound: number;    // for Contention
  activatedThisTurnBy: PlayerId | null;
}

// ── Artifact in shared zone ────────────────────────────────────────
export interface ArtifactState {
  instanceId: string;
  cardId: string;
  playerId: PlayerId;
  turnsRemaining: number;
  attachedCreationId: string | null; // A-003 Double Dragon Head
}

// ── Per-player creator modifiers ───────────────────────────────────
export interface CreatorModifiers {
  ban:       { turnsRemaining: number } | null;
  trending:  { roundsRemaining: number } | null;
  astronaut: { turnsRemaining: number } | null;
  proSub:    { turnsRemaining: number; halfCostUsedThisTurn: boolean } | null;
  astronautExpiredHalfRepThisTurn: boolean;
}

// ── Player state ───────────────────────────────────────────────────
export interface PlayerState {
  id: PlayerId;
  creatorId: string;
  loyalty: number;
  reputation: number;
  credits: number;
  creditCap: number;
  hand: string[];               // card IDs (array with duplicates for copies)
  deck: string[];
  discard: string[];
  activeCreations: CreationState[];  // max 3
  queue: CreationState[];            // max 2 (not counting remix queue)
  remixQueue: CreationState | null;  // max 1
  mods: CreatorModifiers;
  creatorExhaustedThisTurn: boolean;
  clipLockAppliedThisTurn: boolean;
  mulliganed: boolean;
  firstPostUsedThisTurn: boolean;
  // Daily challenge tracking
  repFromAbstractThisRound: number;
  repFromPortraitThisRound: number;
}

// ── Pending slot overflow choice ────────────────────────────────────
export interface SlotOverflowPending {
  incomingCreation: CreationState;
  playerId: PlayerId;
}

// ── Full game state ────────────────────────────────────────────────
export interface GameState {
  phase: GamePhase;
  absTurn: number;
  round: number;
  currentPlayer: PlayerId;
  turnPhase: TurnPhase;
  players: { player: PlayerState; ai: PlayerState };
  sharedModels: ModelState[];
  artifacts: ArtifactState[];
  winner: PlayerId | 'draw' | null;
  log: LogEntry[];
  // Global artifact effects
  serverOverloadRounds: number;
  queueTimeoutRounds: number;
  centaurProblemRounds: number;
  algorithmSwap: { style1: StyleTag; style2: StyleTag; expiresAbsTurn: number } | null;
  dailyChallengeAbstracts: { round: number } | null;
  dailyChallengePortraits: { round: number } | null;
  // Pending effects
  slotOverflowPending: SlotOverflowPending | null;
  pendingModifierPlay: { cardId: string; playerId: PlayerId; targetId: string; targetType: string } | null;
  // Event tracking
  lastOpponentActivation: { modelId: string; promptIds: string[] } | null;
  // Mulligan state
  mulligan: { player: 'pending' | 'yes' | 'no'; ai: 'pending' | 'yes' | 'no' };
  playerDeckId: string;
  aiDeckId: string;
}

export interface LogEntry {
  id: string;
  msg: string;
  type: LogType;
  absTurn: number;
}

// ── Game actions (dispatched from UI or AI) ────────────────────────
export type GameAction =
  | { type: 'SELECT_PLAYER_DECK'; deckId: string }
  | { type: 'MULLIGAN'; playerId: PlayerId; doMulligan: boolean }
  | { type: 'PLAY_MODEL'; cardId: string }
  | { type: 'ACTIVATE_MODEL'; modelInstanceId: string; promptIds: string[]; useFavPrompt: boolean }
  | { type: 'PLAY_MODIFIER'; cardId: string; targetId: string; targetType: 'creator' | 'model' | 'creation' }
  | { type: 'PLAY_ARTIFACT'; cardId: string; targetCreationId?: string }
  | { type: 'PLAY_EVENT'; cardId: string; targetId?: string }
  | { type: 'USE_CREATOR_ABILITY'; abilityNum: number | 'signature'; targetId?: string; targetId2?: string[] }
  | { type: 'APPLY_CLIP_LOCK'; creationInstanceId: string }
  | { type: 'REMIX_CREATION'; creationInstanceId: string; promptId?: string }
  | { type: 'REMOVE_ARTIFACT'; artifactInstanceId: string; spendCredits: number }
  | { type: 'RESOLVE_SLOT_OVERFLOW'; destroyExistingId?: string }  // undefined = destroy incoming
  | { type: 'END_MAIN_PHASE' }
  | { type: 'MASS_REPORT_RESPONSE'; cancel: boolean };
