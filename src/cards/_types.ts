// ============================================================
// PROMPT BATTLE — Card Module Types
// Each card gets its own file. Adding a new card = new file
// + one import in index.ts. No engine changes needed.
// ============================================================
import type { GameState, CreationState, PlayerId, StyleTag, LogType } from '../game/gameTypes';

// ── Mutable draft built up during activation ────────────────
export interface CreationDraft {
  quality: number;
  glitchTokens: number;
  visibilityCounters: number;
  styleTag: StyleTag | null;
  runtime: number;
  immuneUntilAbsTurn: number;
  jbGlitchLockedUntilAbsTurn: number;
  watermarkImmune: boolean;
  anonFavPromptVisBonusTurns: number;
}

// ── Context supplied to prompt cards during activation ───────
export interface ActivationContext {
  pid: PlayerId;
  modelCardId: string;
  otherPromptIds: string[];
  useFavPrompt: boolean;
  absTurn: number;
  round: number;
  state: GameState;
}

// ── Engine helper functions injected into card effects ───────
// Cards never import from gameEngine directly – helpers are
// passed at call-time, so there are zero circular imports.
export interface H {
  addLog(s: GameState, msg: string, t?: LogType): GameState;
  applyLoyaltyDamage(s: GameState, pid: PlayerId, n: number): GameState;
  gainLoyalty(s: GameState, pid: PlayerId, n: number): GameState;
  addGlitch(s: GameState, pid: PlayerId, cid: string, fromOpponent: boolean): GameState;
  addVisibility(s: GameState, pid: PlayerId, cid: string, n: number): GameState;
  applyRep(s: GameState, pid: PlayerId, n: number): GameState;
  applyCredits(s: GameState, pid: PlayerId, n: number): GameState;
  drawCard(s: GameState, pid: PlayerId, n?: number): GameState;
  destroyCreation(s: GameState, pid: PlayerId, cid: string): GameState;
  findCreation(s: GameState, pid: PlayerId, cid: string): CreationState | undefined;
  effectiveStyle(tag: StyleTag | null, s: GameState): StyleTag | null;
}

// ── Card effect hook signatures ──────────────────────────────
export interface CardEffects {
  /** Prompts: modify the creation being generated */
  onActivation?: (draft: CreationDraft, ctx: ActivationContext) => CreationDraft;

  /** Models: extra effect when a creation enters the field */
  onCreationEnter?: (s: GameState, h: H, pid: PlayerId, creation: CreationState) => GameState;

  /** Modifiers: side-effects when attached to creator/model/creation */
  onAttach?: (s: GameState, h: H, pid: PlayerId, targetId: string, targetType: 'creator' | 'model' | 'creation') => GameState;

  /** Modifiers: called once per turn (owner's refresh phase) */
  onTick?: (s: GameState, h: H, pid: PlayerId) => GameState;

  /** Modifiers: called when the modifier expires or is removed */
  onDetach?: (s: GameState, h: H, pid: PlayerId) => GameState;

  /** Artifacts and global events */
  onPlay?: (s: GameState, h: H, pid: PlayerId, targetId?: string, extra?: unknown) => GameState;

  /** Targeted events */
  onEvent?: (s: GameState, h: H, pid: PlayerId, targetId?: string) => GameState;
}

export interface CardModule {
  id: string;
  effects: CardEffects;
}
