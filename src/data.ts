// ============================================================
// PROMPT BATTLE — Card Data · Set 001 First Render
// ============================================================
import type { Card, PrebuiltDeck } from './types';

// Placeholder image used until real illustrations are ready
const PH = (mood: string) => `https://placehold.co/400x560/1c2120/a1d0c6?text=${encodeURIComponent(mood)}`;

export const ALL_CARDS: Card[] = [

  // ── CREATORS ───────────────────────────────────────────────
  {
    id: 'C-001', name: 'Aia', type: 'creator', rarity: 'rare', rarityDots: 3,
    factions: ['CLIP Resistance', 'Experimentalist'],
    loyalty: 11, startingBonus: { type: 'credit', amount: 1, display: '+1 Credit' },
    image: PH('Aia'), illustration: 'Fox mask and hood, floating iridescent Coherent imagery, holographic prompt panels, ink sketches', illustrationMood: 'iridescent',
    passive: {
      name: 'CLIP-LOCK Mastery',
      text: 'Once per turn, during your Main Phase, you may apply CLIP-LOCK to one of your active Coherent Creations. Coherent Creations do not enter with CLIP-LOCK automatically.',
      keywords: ['CLIP-LOCK', 'Main Phase'],
    },
    abilities: [
      { num: 1, name: 'Overrender', cost: { reputation: 3 }, timing: 'main', keywords: ['Quality', 'Glitch token'],
        text: 'Target one opponent Creation. It loses 1 Quality. If that Creation already has 1 or more Glitch tokens, it loses 1 additional Quality (total −2). Quality 0 = destroyed immediately.' },
      { num: 2, name: 'Positive Feedback', cost: { reputation: 5 }, timing: 'main', keywords: ['CLIP-LOCK', 'Loyalty'],
        text: 'Choose one of your active CLIP-LOCKed Creations and remove its CLIP-LOCK. Gain Loyalty equal to the number of full turns that Creation has been CLIP-LOCKed (maximum 3). The turn CLIP-LOCK was applied does not count.' },
      { num: 3, name: 'Iridescent Shift', cost: { reputation: 6 }, timing: 'main', keywords: ['Visibility Counter'],
        text: 'Target one of your active Creations. It gains 2 Visibility Counters and cannot be targeted by opponent single-target abilities until the start of your next turn.' },
      { num: 'signature', name: 'Copy That!', cost: { loyalty: 4, reputation: 14 }, timing: 'main', keywords: ['CLIP-LOCK', 'Loyalty', 'Reputation'],
        text: 'Choose up to 3 of your active CLIP-LOCKed Creations. Remove CLIP-LOCK from each. Each deals 1 Loyalty damage to target opponent Creator. If 2 or more target the same Creator, that Creator also loses 2 Reputation.' },
    ],
    favouritePrompt: { text: '"vibrant expressionism by Aia, soft iridescent water reflections"', subtype: 'Atmosphere', effect: 'The generated Creation gains +1 Quality and enters with 1 bonus Visibility Counter.' },
    creatorNotes: 'always experimenting, never settling.',
    inDecks: { deckA: 1, deckB: 0 },
  },

  {
    id: 'C-002', name: 'Anonymous User', type: 'creator', rarity: 'mythic', rarityDots: 5,
    factions: ['Legends', 'Newbies'],
    loyalty: 16, startingBonus: { type: 'reputation', amount: 1, display: '+1 Reputation' },
    image: PH('Anonymous'), illustration: 'Plain white mask, dozens of identical low-quality portrait Creations flooding the frame, chaotic', illustrationMood: 'chaotic',
    passive: {
      name: 'Copycat',
      text: "Whenever this Creator generates a Creation that shares a Style tag with an opponent's active Creation, steal 2 Visibility Counters from that Creation (minimum 0). You choose if multiple are eligible.",
      keywords: ['Style tag', 'Visibility Counter'],
    },
    influence: {
      name: 'Safety in Numbers',
      text: 'At the start of each of your turns, all friendly Creations with 3 or fewer Visibility Counters cannot be targeted by opponent single-target abilities until the start of your next turn.',
      keywords: ['Visibility Counter'],
    },
    abilities: [
      { num: 1, name: 'First Post', cost: { reputation: 1 }, timing: 'main', keywords: ['Queue', 'Remix Queue', 'Credits'],
        text: 'Your next Model activation this turn costs 2 fewer Credits (minimum 0). Only usable if you control no active Creations on the field and none in your Queue (including Remix Queue). May be used on Turn 1.' },
      { num: 2, name: 'Flood the Feed', cost: { reputation: 6 }, timing: 'main', keywords: ['Queue', 'Runtime', 'Glitch token', 'Slot Overflow'],
        text: 'Move all your currently queued Creations to the field immediately, regardless of remaining Runtime. Each Creation that arrives this way enters with 1 additional Glitch token. Slot overflow rules apply normally.' },
      { num: 3, name: 'More Than You', cost: { reputation: 4 }, timing: 'main', keywords: ['Loyalty'],
        text: "If you control more active Creations than your opponent, target opponent Creator loses 1 Loyalty. You gain 1 Loyalty for each point of Loyalty removed this way." },
      { num: 'signature', name: 'Going Viral', cost: { loyalty: 4, reputation: 12 }, timing: 'main', keywords: ['Visibility Counter', 'Liked', 'Featured', 'Loyalty'],
        text: 'All your active Creations immediately gain 3 Visibility Counters. For each Creation that crosses the Liked or Featured threshold this way, target opponent Creator loses 1 Loyalty.' },
    ],
    favouritePrompt: { text: '"a beautiful wonan"', subtype: 'Style', effect: 'The generated Creation gains 2 bonus Visibility Counters on its first 2 turns on the field, but enters with 1 Glitch token.' },
    inDecks: { deckA: 0, deckB: 1 },
  },

  // ── MODELS ─────────────────────────────────────────────────
  {
    id: 'M-001', name: 'Coherent (Low Settings)', type: 'model', rarity: 'rare', rarityDots: 3,
    subtype: 'Standard — Coherent Variant',
    playCost: 3, activateCost: 4, quality: 3, runtime: 2,
    compatible: ['Fantasy', 'Landscape'], incompatible: ['Portrait'],
    image: PH('Coherent'), illustration: 'Glowing render interface, soft geometric forms emerging from light, clean and precise', illustrationMood: 'precise',
    effect: 'Creations generated by this Model enter the field with 1 bonus Visibility Counter. CLIP-LOCK may be applied to Creations generated by this Model.',
    inDecks: { deckA: 1, deckB: 0 }, guaranteed: 'deckA',
  },
  {
    id: 'M-002', name: 'Juggernaut v9', type: 'model', rarity: 'uncommon', rarityDots: 2,
    subtype: 'Standard',
    playCost: 2, activateCost: 3, quality: 2, runtime: 2,
    compatible: ['Portrait', 'Abstract'], incompatible: ['Landscape'],
    image: PH('Juggernaut'), illustration: 'Heavy industrial render engine, bold colours, dramatic lighting, powerful and dynamic', illustrationMood: 'bold',
    effect: 'Abstract Creations generated by this Model gain +1 Quality on entry.',
    inDecks: { deckA: 1, deckB: 0 }, guaranteed: 'deckA',
  },
  {
    id: 'M-003', name: 'SDXL', type: 'model', rarity: 'uncommon', rarityDots: 2,
    subtype: 'Standard',
    playCost: 1, activateCost: 2, quality: 2, runtime: 1,
    compatible: ['Portrait', 'Landscape'], incompatible: ['Abstract', 'Atmosphere'],
    image: PH('SDXL'), illustration: 'Clean digital render space, neutral tones, versatile and workmanlike', illustrationMood: 'neutral',
    effect: 'Portrait Creations generated by this Model enter with 1 bonus Visibility Counter and 1 Glitch token.',
    inDecks: { deckA: 0, deckB: 1 }, guaranteed: 'deckB',
  },
  {
    id: 'M-004', name: 'Stable Diffusion 1.5', type: 'model', rarity: 'common', rarityDots: 1,
    subtype: 'Standard',
    playCost: 0, activateCost: 0, quality: 1, runtime: 1,
    compatible: ['Fantasy', 'Landscape'], incompatible: ['Portrait', 'Atmosphere'],
    image: PH('SD1.5'), illustration: 'Grainy, slightly corrupted render space, nostalgic early AI aesthetic', illustrationMood: 'grainy',
    effect: 'All Creations generated by this Model enter with 1 additional Glitch token, regardless of any other modifiers or effects.',
    designNote: 'Without a Quality-boosting Prompt or compatible Style, SD1.5 Creations are destroyed immediately on entry — intentional.',
    inDecks: { deckA: 0, deckB: 1 }, guaranteed: 'deckB',
  },

  // ── PROMPTS ────────────────────────────────────────────────
  {
    id: 'P-001', name: 'Good Old Greg', type: 'prompt', rarity: 'common', rarityDots: 1,
    subtype: 'Artist', promptType: 'Artist', keyword: 'by Greg Rutkowski', cost: 1, compatibleModels: 'All',
    image: PH('Greg'), illustration: 'Dramatic fantasy oil painting aesthetic, classical epic composition, warm light', illustrationMood: 'epic',
    effect: 'Assigns the Fantasy Style tag to the generated Creation. If this Creation already has the Fantasy Style tag from another source, it gains +1 Quality instead. If the activating Model is Stable Diffusion 1.5, this Creation also gains 1 bonus Visibility Counter on entry.',
    inDecks: { deckA: 0, deckB: 3 },
  },
  {
    id: 'P-002', name: 'Men...', type: 'prompt', rarity: 'common', rarityDots: 1,
    subtype: 'Style', promptType: 'Style', keyword: 'beautiful woman', cost: 1, compatibleModels: 'All except Coherent variants',
    image: PH('Portrait'), illustration: 'Yet another AI portrait of a woman, slightly off, suspiciously generic', illustrationMood: 'generic',
    effect: 'Assigns the Portrait Style tag to the generated Creation. That Creation gains 1 bonus Visibility Counter on entry.',
    inDecks: { deckA: 0, deckB: 3 },
  },
  {
    id: 'P-003', name: 'Copycat... I Mean, Copygazelle...', type: 'prompt', rarity: 'uncommon', rarityDots: 2,
    subtype: 'Negative', promptType: 'Negative', keyword: 'Liz Gael', cost: 3, compatibleModels: 'All',
    image: PH('Copygazelle'), illustration: 'Elegant referential artwork, layered style echoes, something borrowed, something new', illustrationMood: 'layered',
    effect: 'The generated Creation cannot be affected by opponent Modifiers, Artifacts, abilities or Glitch tokens for 3 turns after it enters the field.',
    inDecks: { deckA: 3, deckB: 0 },
  },
  {
    id: 'P-004', name: 'Did You Steal This Prompt?', type: 'prompt', rarity: 'common', rarityDots: 1,
    subtype: 'Artist', promptType: 'Artist', keyword: 'by JB', cost: 1, compatibleModels: 'All',
    image: PH('Stolen'), illustration: "Atmospheric moody render, someone else's aesthetic worn like a costume, beautiful and slightly guilty", illustrationMood: 'guilty',
    effect: "The generated Creation gains 2 bonus Visibility Counters on entry and 1 Glitch token on entry. This Glitch token cannot be removed or negated by any ability or effect until the start of your second turn after this Creation entered the field.",
    inDecks: { deckA: 0, deckB: 2 },
  },
  {
    id: 'P-005', name: 'Here Goes the Paragraph', type: 'prompt', rarity: 'common', rarityDots: 1,
    subtype: 'Atmosphere', promptType: 'Atmosphere', keyword: 'narrative prompt', cost: 2, compatibleModels: 'All except Coherent variants',
    image: PH('Paragraph'), illustration: 'A prompt box overflowing with text, chaotic word salad, something surprisingly coherent emerging', illustrationMood: 'chaotic',
    effect: 'The generated Creation enters with 2 Glitch tokens and 2 bonus Visibility Counters.',
    inDecks: { deckA: 0, deckB: 2 },
  },
  {
    id: 'P-006', name: 'Are You Crazy?!', type: 'prompt', rarity: 'uncommon', rarityDots: 2,
    subtype: 'Style', promptType: 'Style', keyword: 'long coherent prompt', cost: 3, compatibleModels: 'Coherent variants and Stable Diffusion 1.5',
    image: PH('Crazy'), illustration: 'An impossibly long prompt scrolling across a render screen, someone clearly having a great time', illustrationMood: 'intense',
    effect: "The generated Creation gains +3 Quality but its Runtime increases by 1.",
    inDecks: { deckA: 3, deckB: 0 },
  },
  {
    id: 'P-007', name: "What's Wrong with the Hands?", type: 'prompt', rarity: 'common', rarityDots: 1,
    subtype: 'Negative', promptType: 'Negative', keyword: 'poorly drawn hands', cost: 1, compatibleModels: 'All',
    image: PH('Hands'), illustration: 'Seven fingers, backwards thumbs, a hand that is also somehow a foot, confidently rendered', illustrationMood: 'absurd',
    effect: 'The generated Creation gains +1 Quality.',
    inDecks: { deckA: 3, deckB: 0 },
  },
  {
    id: 'P-008', name: "So That's How They Trained It...", type: 'prompt', rarity: 'common', rarityDots: 1,
    subtype: 'Negative', promptType: 'Negative', keyword: 'watermark', cost: 2, compatibleModels: 'All',
    image: PH('Watermark'), illustration: 'Faint Getty Images watermark visible beneath a pristine AI render, knowingly presented', illustrationMood: 'ironic',
    effect: 'The generated Creation gains +1 Quality and is permanently immune to Watermark Artifact effects.',
    inDecks: { deckA: 0, deckB: 0 },
  },
  {
    id: 'P-009', name: 'Another Landscape', type: 'prompt', rarity: 'common', rarityDots: 1,
    subtype: 'Style', promptType: 'Style', keyword: 'oil painting landscape', cost: 1, compatibleModels: 'All',
    image: PH('Landscape'), illustration: 'Sweeping painterly hills, golden hour, AI brushwork that almost looks like a real painting', illustrationMood: 'pastoral',
    effect: 'Assigns the Landscape Style tag to the generated Creation.',
    inDecks: { deckA: 2, deckB: 0 },
  },
  {
    id: 'P-010', name: "What's That?", type: 'prompt', rarity: 'common', rarityDots: 1,
    subtype: 'Artist', promptType: 'Artist', keyword: 'Salvador Dalí', cost: 1, compatibleModels: 'All',
    image: PH('Dali'), illustration: 'Melting clocks, impossible architecture, a dreamscape that refuses to make any sense', illustrationMood: 'surreal',
    effect: 'The generated Creation gains 2 bonus Visibility Counters on entry and 1 Glitch token on entry.',
    inDecks: { deckA: 1, deckB: 1 },
  },

  // ── MODIFIERS ──────────────────────────────────────────────
  {
    id: 'MO-001', name: 'The Astronaut', type: 'modifier', rarity: 'mythic', rarityDots: 5,
    subtype: 'Universal Creator', modifierType: 'Universal Creator', cost: 3, duration: '3 turns',
    attachesTo: 'Any friendly Creator', deckLimit: 1,
    image: PH('Astronaut'), illustration: 'A lone astronaut suspended in a vast creative void, spotlight from above, beautiful and isolating', illustrationMood: 'isolated',
    effect: 'While attached, the target Creator gains: +3 Loyalty immediately; all Creations they generate enter with 2 bonus Visibility Counters; all their active Creations gain 1 bonus Visibility Counter at the start of each of your turns.\n\nOn detach (after 3 turns): each of that Creator\'s active Creations gains 1 Glitch token (CLIP-LOCK does not block this). Reputation from that Creator\'s Creations is halved next turn.\n\nCannot be removed, negated or targeted by any card effect. Cannot be cancelled by Mass Report. Duration cannot be extended or reduced.',
    flavourText: 'The spotlight finds you. For now.',
    inDecks: { deckA: 1, deckB: 1 },
  },
  {
    id: 'MO-002', name: 'Anime LoRA', type: 'modifier', rarity: 'common', rarityDots: 1,
    subtype: 'LoRA', modifierType: 'LoRA', cost: 1, duration: 'Permanent',
    attachesTo: 'Any Model except Coherent variants',
    image: PH('Anime'), illustration: 'Cel-shaded anime aesthetic overlay on a render interface, bright and clean', illustrationMood: 'bright',
    effect: 'Portrait and Fantasy Creations generated by this Model gain +1 Quality. Landscape Creations generated by this Model lose 1 Quality (minimum 1).',
    inDecks: { deckA: 0, deckB: 2 },
  },
  {
    id: 'MO-003', name: 'Painting LoRA', type: 'modifier', rarity: 'common', rarityDots: 1,
    subtype: 'LoRA', modifierType: 'LoRA', cost: 1, duration: 'Permanent',
    attachesTo: 'Any Model',
    image: PH('Painting'), illustration: 'Painterly textures bleeding into a digital render, brushstrokes and pixels coexisting', illustrationMood: 'painterly',
    effect: 'Abstract and Atmosphere Creations generated by this Model gain +1 Quality and 1 bonus Visibility Counter on entry.',
    inDecks: { deckA: 2, deckB: 0 },
  },
  {
    id: 'MO-004', name: 'Realism LoRA', type: 'modifier', rarity: 'common', rarityDots: 1,
    subtype: 'LoRA', modifierType: 'LoRA', cost: 1, duration: 'Permanent',
    attachesTo: 'Any Model',
    image: PH('Realism'), illustration: 'Hyperrealistic render overlay, photographic precision, every pore and pixel accounted for', illustrationMood: 'hyperreal',
    effect: 'Portrait Creations generated by this Model gain +2 Quality but their Runtime increases by 1.',
    inDecks: { deckA: 0, deckB: 0 },
  },
  {
    id: 'MO-005', name: 'Trending', type: 'modifier', rarity: 'common', rarityDots: 1,
    subtype: 'Creator', modifierType: 'Creator', cost: 2, duration: '3 rounds',
    attachesTo: 'Any friendly Creator',
    image: PH('Trending'), illustration: 'Upward arrow of light cutting through a crowded feed, one image rising above all others', illustrationMood: 'rising',
    effect: 'All Creations generated by the attached Creator enter the field with 1 bonus Visibility Counter.',
    inDecks: { deckA: 2, deckB: 0 },
  },
  {
    id: 'MO-006', name: 'Ban', type: 'modifier', rarity: 'uncommon', rarityDots: 2,
    subtype: 'Creator', modifierType: 'Creator', cost: 2, duration: '1 turn per opponent Creator on field at time of play (minimum 1)',
    attachesTo: 'Any Creator',
    image: PH('Ban'), illustration: 'A crossed-circle stamp landing hard on a creator profile, red and absolute', illustrationMood: 'severe',
    effect: "The affected Creator cannot activate abilities. Their active Creations generate no Reputation while this Modifier is attached. May be played on opponent Creators.",
    inDecks: { deckA: 0, deckB: 2 },
  },
  {
    id: 'MO-007', name: 'PRO Subscription', type: 'modifier', rarity: 'uncommon', rarityDots: 2,
    subtype: 'Creator', modifierType: 'Creator', cost: 3, duration: '3 turns',
    attachesTo: 'Any friendly Creator',
    image: PH('PRO'), illustration: 'Gleaming PRO badge on a creator profile, golden border, premium interface glow', illustrationMood: 'premium',
    effect: 'Once per turn, you may activate one Model at half its activation cost (round down). Credit cap increases by 3. Gain 1 bonus Credit at the start of each of your turns. All Runtimes for this Creator\'s Creations are reduced by 1 (minimum 1).\n\nCannot be cancelled by Mass Report.\n\nOn expiry: Credit cap returns to 10. If you had more than 10 Credits at expiry, lose 5 Reputation. If Reputation reaches 0 or below, lose 1 Loyalty and reset Reputation to 0.',
    inDecks: { deckA: 1, deckB: 0 },
  },
  {
    id: 'MO-008', name: 'Featured', type: 'modifier', rarity: 'uncommon', rarityDots: 2,
    subtype: 'Creation', modifierType: 'Creation', cost: 2, duration: '3 turns',
    attachesTo: 'One of your active Creations with 6 or more Visibility Counters',
    image: PH('Featured'), illustration: 'A single Creation in a spotlight on the front page, everything else fading behind it', illustrationMood: 'spotlight',
    effect: 'Doubles Reputation generation for the attached Creation (subject to cap). That Creation may now be targeted by all abilities.\n\nWhenever any of your other active Creations receives a negative effect (Glitch token, Quality reduction, or similar), that effect is also applied to this Creation. This cannot be prevented.\n\nIf this Creation\'s Visibility Counters drop below 6 while attached, it immediately loses 1 Quality and this Modifier is discarded.',
    inDecks: { deckA: 0, deckB: 2 },
  },
  {
    id: 'MO-009', name: 'Queue Skip', type: 'modifier', rarity: 'uncommon', rarityDots: 2,
    subtype: 'Model', modifierType: 'Model', cost: 2, duration: 'Single use',
    attachesTo: 'Any Model in the shared zone',
    image: PH('QueueSkip'), illustration: 'A render jumping forward in a queue line, everyone else frozen mid-wait', illustrationMood: 'urgent',
    effect: 'The next Creation generated by the attached Model enters the field immediately, bypassing its Runtime entirely. Discard this Modifier after it triggers.',
    inDecks: { deckA: 2, deckB: 0 },
  },
  {
    id: 'MO-010', name: 'Noise', type: 'modifier', rarity: 'common', rarityDots: 1,
    subtype: 'Model', modifierType: 'Model', cost: 1, duration: '5 turns',
    attachesTo: 'Any Model in the shared zone',
    image: PH('Noise'), illustration: 'Static interference crawling across a render in progress, corrupted signal', illustrationMood: 'corrupted',
    effect: 'All Creations generated by the attached Model enter with −1 Quality (minimum 1) for the duration. May be played on any Model in the shared zone, including opponent-played Models.',
    inDecks: { deckA: 0, deckB: 2 },
  },

  // ── ARTIFACTS ──────────────────────────────────────────────
  {
    id: 'A-001', name: 'Centaur Problem', type: 'artifact', rarity: 'uncommon', rarityDots: 2,
    subtype: 'Anomaly', artifactType: 'Anomaly', cost: 2, duration: '3 rounds',
    image: PH('Centaur'), illustration: 'A magnificently wrong centaur rendered with complete confidence, too many legs, proud of itself', illustrationMood: 'absurd',
    effect: 'All Fantasy Creations entering the field arrive with 1 Glitch token. At the start of each round, all existing Fantasy Creations on the field gain 1 Glitch token. Affects both players.\n\nAny player may spend 3 Credits during their Main Phase to remove this Artifact.',
    inDecks: { deckA: 2, deckB: 0 },
  },
  {
    id: 'A-002', name: 'Queue Timeout', type: 'artifact', rarity: 'common', rarityDots: 1,
    subtype: 'Anomaly', artifactType: 'Anomaly', cost: 2, duration: '3 rounds',
    image: PH('Timeout'), illustration: 'A loading bar frozen at 99%, a cursor blinking in patient despair', illustrationMood: 'frozen',
    effect: 'All Model Runtimes increase by 1 turn for the duration. Affects existing queued Creations and all future Creations generated while active. Affects both players.\n\nAny player may spend 3 Credits during their Main Phase to remove this Artifact.',
    inDecks: { deckA: 0, deckB: 2 },
  },
  {
    id: 'A-003', name: 'Double Dragon Head', type: 'artifact', rarity: 'common', rarityDots: 1,
    subtype: 'Anomaly', artifactType: 'Anomaly', cost: 2, duration: '3 turns',
    image: PH('Dragon'), illustration: 'A dragon with two heads facing opposite directions, both equally confused', illustrationMood: 'confused',
    effect: "Attach to one target Fantasy or Portrait Creation on the field. That Creation's Reputation generation is halved for the duration (round down). May be attached to any Creation on the field, including opponent Creations.\n\nAny player may spend 2 Credits during their Main Phase to remove this Artifact.",
    inDecks: { deckA: 0, deckB: 1 },
  },
  {
    id: 'A-004', name: 'Credit Drop', type: 'artifact', rarity: 'common', rarityDots: 1,
    subtype: 'Condition', artifactType: 'Condition', cost: 0, duration: 'Immediate',
    image: PH('Credits'), illustration: 'A shower of golden credit coins falling across the interface, everyone equally surprised', illustrationMood: 'celebratory',
    effect: 'All players gain 3 bonus Credits immediately (subject to Credit cap).',
    inDecks: { deckA: 2, deckB: 1 },
  },
  {
    id: 'A-005', name: 'Server Overload', type: 'artifact', rarity: 'uncommon', rarityDots: 2,
    subtype: 'Condition', artifactType: 'Condition', cost: 8, duration: '3 rounds',
    image: PH('Overload'), illustration: 'Server racks glowing red, error messages cascading, everyone\'s renders slowing to a crawl', illustrationMood: 'catastrophic',
    effect: 'All Model activations cost 1 additional Credit for the duration. All active Creations generate 1 fewer Visibility Counter per turn (minimum 0). Affects both players.\n\nCannot be removed.',
    inDecks: { deckA: 0, deckB: 1 },
  },
  {
    id: 'A-006', name: 'Algorithm Swap', type: 'artifact', rarity: 'uncommon', rarityDots: 2,
    subtype: 'Condition', artifactType: 'Condition', cost: 2, duration: 'Until the start of your next turn',
    image: PH('Algorithm'), illustration: 'Two Style tag icons swapping positions on a recommendation feed, the algorithm confused', illustrationMood: 'surreal',
    effect: 'Choose two Style tags. Until the start of your next turn, all existing Creations on the field and in Queues with one of the chosen Style tags are treated as having the other for all game purposes. Creations generated while this card is active are assigned the swapped Style tag permanently. Affects both players.',
    inDecks: { deckA: 1, deckB: 0 },
  },

  // ── EVENTS ─────────────────────────────────────────────────
  {
    id: 'E-001', name: 'Mass Report', type: 'event', rarity: 'uncommon', rarityDots: 2,
    subtype: 'Drama', eventType: 'Drama', cost: 7, costType: 'reputation', timing: 'instant',
    image: PH('MassReport'), illustration: 'A report button being clicked by many hands simultaneously, a Modifier card dissolving mid-play', illustrationMood: 'collective',
    effect: "May be played during either player's turn, in response to a Modifier card being played. Cancel that Modifier — it is discarded without effect. Mass Report is then discarded.\n\nCannot cancel The Astronaut or PRO Subscription.\n\nThis is the only Instant in First Render that may be played during the opponent's turn.",
    inDecks: { deckA: 0, deckB: 0 },
  },
  {
    id: 'E-002', name: 'Community Drama', type: 'event', rarity: 'uncommon', rarityDots: 2,
    subtype: 'Drama', eventType: 'Drama', cost: 7, costType: 'credits', timing: 'instant',
    image: PH('Drama'), illustration: 'A comment section on fire, reactions everywhere, everyone watching someone else\'s problem', illustrationMood: 'chaotic',
    effect: 'Target opponent Creator loses 2 Loyalty. That Creator\'s controller draws 1 card.',
    inDecks: { deckA: 0, deckB: 3 },
  },
  {
    id: 'E-003', name: 'Prompt Theft', type: 'event', rarity: 'uncommon', rarityDots: 2,
    subtype: 'Drama', eventType: 'Drama', cost: 3, costType: 'credits', timing: 'instant',
    image: PH('PromptTheft'), illustration: 'A prompt being copied character by character from one screen to another, no shame, complete confidence', illustrationMood: 'sneaky',
    effect: "During your Main Phase, if your opponent activated a Model during their most recent turn, you may play this card. Choose one of your Models in the Shared Zone and activate it, copying one Prompt used in the opponent's activation (if any). You pay your own Model's activation cost plus any LoRA surcharge. This counts as your Model activation for this turn.",
    inDecks: { deckA: 0, deckB: 3 },
  },
  {
    id: 'E-004', name: 'Priority Rendering', type: 'event', rarity: 'uncommon', rarityDots: 2,
    subtype: 'Site Update', eventType: 'Site Update', cost: 3, costType: 'credits', timing: 'instant',
    image: PH('Priority'), illustration: 'A single render jumping to the front of a processing queue, green light, everything else waiting', illustrationMood: 'efficient',
    effect: 'Move one of your queued Creations to arrive at the start of your next turn, regardless of its remaining Runtime. Cannot target Creations in the Remix Queue.',
    inDecks: { deckA: 3, deckB: 0 },
  },
  {
    id: 'E-005', name: 'GPU Boost', type: 'event', rarity: 'common', rarityDots: 1,
    subtype: 'Site Update', eventType: 'Site Update', cost: 2, costType: 'credits', timing: 'instant',
    image: PH('GPU'), illustration: 'A graphics card glowing with effort, fans spinning fast, a render completing ahead of schedule', illustrationMood: 'energetic',
    effect: 'Reduce the Runtime of one of your queued Creations by 2 (minimum 1). Cannot target Creations in the Remix Queue.',
    inDecks: { deckA: 3, deckB: 0 },
  },
  {
    id: 'E-006', name: 'Queue Crash', type: 'event', rarity: 'uncommon', rarityDots: 2,
    subtype: 'Site Update', eventType: 'Site Update', cost: 3, costType: 'credits', timing: 'instant',
    image: PH('QueueCrash'), illustration: 'A render queue collapsing, progress bars resetting, someone\'s afternoon thoroughly ruined', illustrationMood: 'disruptive',
    effect: 'Target one opponent queued Creation or one opponent Creation in the Remix Queue. Its Runtime increases by 2 (or return is delayed by 2 turns if in Remix Queue).',
    inDecks: { deckA: 0, deckB: 3 },
  },
  {
    id: 'E-007', name: 'Tip Received', type: 'event', rarity: 'uncommon', rarityDots: 2,
    subtype: 'Community Event', eventType: 'Community Event', cost: 0, costType: 'credits', timing: 'main',
    image: PH('Tip'), illustration: 'A small notification lighting up a screen, a PRO badge glowing warm, a creator quietly pleased', illustrationMood: 'warm',
    effect: 'Requires a PRO Subscription Modifier attached to one of your Creators. Gain 4 Credits immediately (subject to Credit cap).',
    inDecks: { deckA: 2, deckB: 0 },
  },
  {
    id: 'E-008', name: 'Generation Cancelled', type: 'event', rarity: 'uncommon', rarityDots: 2,
    subtype: 'Site Update', eventType: 'Site Update', cost: 2, costType: 'credits', timing: 'instant',
    image: PH('Cancelled'), illustration: 'A cancel button mid-press, a half-formed image dissolving back into nothing', illustrationMood: 'abrupt',
    effect: "Target one of your opponent's queued Creations. Remove it from the Queue. Its controller does not lose Loyalty. Credits spent on its activation are not refunded. Cannot target Creations in the Remix Queue.",
    inDecks: { deckA: 2, deckB: 0 },
  },
  {
    id: 'E-009', name: 'Daily Challenge: Abstractions', type: 'event', rarity: 'uncommon', rarityDots: 2,
    subtype: 'Daily Challenge', eventType: 'Daily Challenge', cost: 2, costType: 'credits', timing: 'main',
    image: PH('Abstract'), illustration: 'A challenge banner, geometric abstract forms competing for attention, everyone trying their best', illustrationMood: 'competitive',
    effect: 'Duration: This round. All Abstract Creations on the field generate double Reputation this round (subject to cap). The player who gains the most Reputation from Abstract Creations this round gains 3 bonus Reputation at the end of the round.',
    inDecks: { deckA: 2, deckB: 0 },
  },
  {
    id: 'E-010', name: 'Daily Challenge: Portraits', type: 'event', rarity: 'uncommon', rarityDots: 2,
    subtype: 'Daily Challenge', eventType: 'Daily Challenge', cost: 2, costType: 'credits', timing: 'main',
    image: PH('Portraits'), illustration: 'A challenge banner, dozens of near-identical AI women staring from thumbnails, the challenge briefly regretting itself', illustrationMood: 'ironic',
    effect: 'Duration: This round. All Portrait Creations on the field generate double Reputation this round. Each time a Portrait Creation enters the field this round, its controller gains 1 bonus Visibility Counter on it immediately. The player who controls the most Portrait Creations at the end of this round gains 3 bonus Reputation.',
    inDecks: { deckA: 0, deckB: 3 },
  },
];

// ── Prebuilt Decks ─────────────────────────────────────────
export const PREBUILT_DECKS: PrebuiltDeck[] = [
  {
    id: 'deckA',
    name: 'Aia — CLIP Starter Deck',
    subtitle: 'CLIP Resistance · Control',
    description: "Protect. Lock. Overrender. Win with Copy That! Aia plays slow and deep — build a small number of powerful, CLIP-LOCKed Creations and use them as weapons. Patient, precise, and devastating at full power.",
    creator: 'C-001',
    guaranteedModels: ['M-001', 'M-002'],
    cards: {
      'P-003': 3, 'P-006': 3, 'P-007': 3, 'P-009': 2, 'P-010': 1,
      'MO-001': 1, 'MO-003': 2, 'MO-005': 2, 'MO-009': 2, 'MO-007': 1,
      'A-001': 2, 'A-004': 2, 'A-006': 1,
      'E-004': 3, 'E-005': 3, 'E-007': 2, 'E-008': 2, 'E-009': 2,
    },
    archetypes: ['Control', 'Protection', 'Late Game'],
    difficulty: 'Intermediate',
  },
  {
    id: 'deckB',
    name: 'Anonymous User — Horde Starter Deck',
    subtitle: 'Legends / Newbies · Aggression',
    description: "Generate. Flood. Push Visibility. Win with Going Viral before opponent stabilises. Anon is chaotic, fast, and overwhelming — get as many Creations on the field as possible.",
    creator: 'C-002',
    guaranteedModels: ['M-003', 'M-004'],
    cards: {
      'P-001': 3, 'P-002': 3, 'P-004': 2, 'P-005': 2, 'P-010': 1,
      'MO-001': 1, 'MO-002': 2, 'MO-006': 2, 'MO-008': 2, 'MO-010': 2,
      'A-002': 2, 'A-003': 1, 'A-004': 1, 'A-005': 1,
      'E-002': 3, 'E-003': 3, 'E-006': 3, 'E-010': 3,
    },
    archetypes: ['Aggression', 'Flood', 'Early Game'],
    difficulty: 'Beginner',
  },
];

// ── Build rules ────────────────────────────────────────────
export const DECK_BUILD_RULES = {
  totalCards:       40,
  shuffledDeck:     37,
  creatorCards:      1,
  guaranteedModels:  2,
  maxCopiesPerCard:  3,
} as const;

// ── Helpers ────────────────────────────────────────────────

// ── Set numbering (FR = First Render, 054 total slots) ──────
export const SET_NUMBER: Record<string, string> = {
  // Creators 001–002
  'C-001': '001', 'C-002': '002',
  // Models 003–006
  'M-001': '003', 'M-002': '004', 'M-003': '005', 'M-004': '006',
  // Prompts 007–016
  'P-001': '007', 'P-002': '008', 'P-003': '009', 'P-004': '010',
  'P-005': '011', 'P-006': '012', 'P-007': '013', 'P-008': '014',
  'P-009': '015', 'P-010': '016',
  // Modifiers 017–026
  'MO-001': '017', 'MO-002': '018', 'MO-003': '019', 'MO-004': '020',
  'MO-005': '021', 'MO-006': '022', 'MO-007': '023', 'MO-008': '024',
  'MO-009': '025', 'MO-010': '026',
  // Artifacts 027–032
  'A-001': '027', 'A-002': '028', 'A-003': '029',
  'A-004': '030', 'A-005': '031', 'A-006': '032',
  // Events 033–042
  'E-001': '033', 'E-002': '034', 'E-003': '035', 'E-004': '036',
  'E-005': '037', 'E-006': '038', 'E-007': '039', 'E-008': '040',
  'E-009': '041', 'E-010': '042',
  // 043–046 showcase/full arts (reserved)
  // 047–054 reserved
};
export const SET_TOTAL = '054';
export const SET_CODE  = 'FR';

export function getCardSetNumber(id: string): string {
  return SET_NUMBER[id] ?? '???';
}
export function getCardById(id: string): Card | undefined {
  return ALL_CARDS.find(c => c.id === id);
}

export function getCardsByType(type: Card['type']): Card[] {
  return ALL_CARDS.filter(c => c.type === type);
}

export function getDeckCardList(deckId: string): Card[] {
  const deck = PREBUILT_DECKS.find(d => d.id === deckId);
  if (!deck) return [];
  const cards: Card[] = [];
  for (const [id, count] of Object.entries(deck.cards)) {
    const card = getCardById(id);
    if (card) for (let i = 0; i < count; i++) cards.push(card);
  }
  return cards;
}
