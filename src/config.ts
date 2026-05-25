// ============================================================
// PROMPT BATTLE — Config
// Beta tokens, Google Forms IDs, field entry IDs
// ============================================================

export const BETA_TOKENS: string[] = [
  'FIRSTRENDER-DEV',
  'FIRSTRENDER-001',
  'FIRSTRENDER-002',
  'FIRSTRENDER-003',
  'FIRSTRENDER-004',
  'FIRSTRENDER-005',
  // Add more as needed — one per tester
];

// ── Google Forms ─────────────────────────────────────────────
// Replace with your real Form IDs (the long string from the form URL)
export const FORMS = {
  FEEDBACK:       '1FAIpQLSdbdBcywYmLC5tkK2vnDonQUjvvjPCG50rBCu16EjIKmrH1aA',
  VOTE:           '1FAIpQLSd_jzQ5tj0_732HaEmdUswDrLnycPODK7VdMTlSZ0XWf5ZnQw',
  DECK_SHARE:     '1FAIpQLSc7B0mNiZLXz8TMenlmgRJUBom-IiXiBEW_WNCQS6K5Kp1OFQ',
  GAME_DATA:      '1FAIpQLSdY66PR5uZDtF5wQPcjH_iBhfBs0iTEBDbJROx99EDcXRymdA',
  SUGGEST_ARTIST: '1FAIpQLSfap7_bhmM_tJKJXfkYvC_Zy-APhIPhDLaePuQcZg2K_iCEJA',  // ← create this form and paste ID here
} as const;

// ── Google Forms field entry IDs ─────────────────────────────
// Get these from the pre-fill URL of each form
export const FIELDS = {
  FEEDBACK: {
    handle:   'entry.1729611190',
    category: 'entry.383732830',
    rating:   'entry.1017203369',
    subject:  'entry.345710300',
    message:  'entry.1019137159',
  },
  VOTE: {
    id:       'entry.351581076',
    cardId:   'entry.1721897188',
    chosen:   'entry.1211225117',
    rejected: 'entry.1356359397',
    handle:   'entry.1257226562',
  },
  DECK_SHARE: {
    name:     'entry.1570134932',
    creator:  'entry.677791792',
    cards:    'entry.596088459',
    handle:   'entry.308643562',
    note:     'entry.738460153',
  },
  GAME_DATA: {
    winner:   'entry.461987758',
    loser:    'entry.1532166155',
    turns:    'entry.986542292',
    reason:   'entry.862861704',
  },
  SUGGEST_ARTIST: {
    nc_tag:    'entry.1912910786',
    faction:   'entry.987337233',
    abilities: 'entry.588699424',
    prompts:   'entry.692347102',
    reason:    'entry.485841808',
    submitter: 'entry.687526102',
  },
} as const;

// ── Glossary ─────────────────────────────────────────────────
export const GLOSSARY: Record<string, string> = {
  'CLIP-LOCK':         'A protective state for Coherent Creations. Blocks opponent Glitch tokens and single-target abilities.',
  'Glitch token':      "Reduces a Creation's Quality by 1. Quality 0 = immediate destruction, Creator loses 1 Loyalty.",
  'Quality':           "A Creation's power level. Affects Reputation generation. Quality 0 = immediate destruction.",
  'Visibility Counter':'Tracks public exposure. 0–2: Unnoticed (0 Rep). 3–5: Noticed (1 Rep). 6–9: Liked (2 Rep). 10+: Featured (3 Rep + burst).',
  'Loyalty':           "A Creator's health. Reaches 0 = eliminated.",
  'Reputation':        'Currency for Creator abilities. Capped at 20. Earned from Creations based on Visibility.',
  'Credits':           'Main resource. Capped at 10 (13 with PRO). Used to play cards and activate Models.',
  'Runtime':           'Turns a Creation waits in the Queue before entering the field.',
  'Queue':             'Where Creations wait before entering the field. Max 2 per player.',
  'Remix Queue':       'Holds 1 Creation per player while being Remixed. Cannot be destroyed here.',
  'Style tag':         'Labels a Creation: Fantasy, Landscape, Portrait, Abstract, or Atmosphere.',
  'Creator Stress':    'End your turn (Turn 2+) with no Creations on field or in Queue = Creator loses 1 Loyalty.',
  'LoRA':              'A Modifier that attaches permanently to a Model, enhancing certain Creation types.',
  'Slot Overflow':     'All 3 Creation Slots full when a new one arrives — must destroy an existing one or lose the incoming one.',
  'Contention':        'Activating a Model for the 2nd time in a round adds +1 Runtime to the resulting Creation.',
  'Featured':          '10+ Visibility. Generates 3 Rep/turn. First time reaching 10: +5 Rep burst.',
  'Liked':             '6–9 Visibility. Generates 2 Rep/turn.',
  'Noticed':           '3–5 Visibility. Generates 1 Rep/turn.',
  'Main Phase':        'The second phase of your turn where most actions happen.',
  'Refresh Phase':     'First phase of your turn. Gain Credits, reduce Runtime, collect Reputation.',
};
