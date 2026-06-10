// ============================================================
// PROMPT BATTLE — Card Registry
// To add a new card: create its file, import it here, add to MAP.
// ============================================================
import type { CardModule, CardEffects } from './_types';

// ── Models ───────────────────────────────────────────────────
import M001 from './models/M-001';
import M002 from './models/M-002';
import M003 from './models/M-003';
import M004 from './models/M-004';

// ── Prompts ──────────────────────────────────────────────────
import P001 from './prompts/P-001';
import P002 from './prompts/P-002';
import P003 from './prompts/P-003';
import P004 from './prompts/P-004';
import P005 from './prompts/P-005';
import P006 from './prompts/P-006';
import P007 from './prompts/P-007';
import P008 from './prompts/P-008';
import P009 from './prompts/P-009';
import P010 from './prompts/P-010';

// ── Modifiers ────────────────────────────────────────────────
import MO001 from './modifiers/MO-001';
import MO002 from './modifiers/MO-002';
import MO003 from './modifiers/MO-003';
import MO004 from './modifiers/MO-004';
import MO005 from './modifiers/MO-005';
import MO006 from './modifiers/MO-006';
import MO007 from './modifiers/MO-007';
import MO008 from './modifiers/MO-008';
import MO009 from './modifiers/MO-009';
import MO010 from './modifiers/MO-010';

// ── Artifacts ────────────────────────────────────────────────
import A001 from './artifacts/A-001';
import A002 from './artifacts/A-002';
import A003 from './artifacts/A-003';
import A004 from './artifacts/A-004';
import A005 from './artifacts/A-005';
import A006 from './artifacts/A-006';

// ── Events ───────────────────────────────────────────────────
import E001 from './events/E-001';
import E002 from './events/E-002';
import E003 from './events/E-003';
import E004 from './events/E-004';
import E005 from './events/E-005';
import E006 from './events/E-006';
import E007 from './events/E-007';
import E008 from './events/E-008';
import E009 from './events/E-009';
import E010 from './events/E-010';

// ── Creators ─────────────────────────────────────────────────
import C001 from './creators/C-001';
import C002 from './creators/C-002';

// ── Registry map ─────────────────────────────────────────────
const REGISTRY: Record<string, CardModule> = {
  // Models
  'M-001': M001, 'M-002': M002, 'M-003': M003, 'M-004': M004,
  // Prompts
  'P-001': P001, 'P-002': P002, 'P-003': P003, 'P-004': P004, 'P-005': P005,
  'P-006': P006, 'P-007': P007, 'P-008': P008, 'P-009': P009, 'P-010': P010,
  // Modifiers
  'MO-001': MO001, 'MO-002': MO002, 'MO-003': MO003, 'MO-004': MO004, 'MO-005': MO005,
  'MO-006': MO006, 'MO-007': MO007, 'MO-008': MO008, 'MO-009': MO009, 'MO-010': MO010,
  // Artifacts
  'A-001': A001, 'A-002': A002, 'A-003': A003, 'A-004': A004, 'A-005': A005, 'A-006': A006,
  // Events
  'E-001': E001, 'E-002': E002, 'E-003': E003, 'E-004': E004, 'E-005': E005,
  'E-006': E006, 'E-007': E007, 'E-008': E008, 'E-009': E009, 'E-010': E010,
  // Creators
  'C-001': C001, 'C-002': C002,
};

export function getCardModule(id: string): CardModule | undefined {
  return REGISTRY[id];
}

export function getCardEffects(id: string): CardEffects | undefined {
  return REGISTRY[id]?.effects;
}

export type { CardModule, CardEffects };
