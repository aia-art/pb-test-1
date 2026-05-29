# QUICK REFERENCE SHEET
## Prompt Battle TCG · Set 001: First Render · v0.14

---

## YOUR TURN — IN ORDER

```
REFRESH PHASE
  1. Gain 5 Credits (+ carryover, max Credit cap)
  2. Reduce all Queue Runtime counters by 1
  3. Creations with Runtime 0 enter the field
     → Slot Overflow if all 3 slots are full
  4. All active Creations gain 1 Visibility Counter
  5. Collect Reputation (max 20)
     → Featured burst: +5 Rep first time a Creation hits 10 Visibility
  6. Passive effects trigger
  7. Creator Stress (Turn 2+): no Creations on field or in Queue → −1 Loyalty

MAIN PHASE (any order, as many times as you can afford)
  • Play Model cards into Shared Zone
  • Activate a Model (once per Model per turn)
      + up to 2 Prompts of different subtypes
      + Favourite Prompt counts as one of the 2
  • Play Modifier / Artifact / Event cards
  • Use Creator ability (one per Creator per turn, then Exhausted)
  • Apply CLIP-LOCK (Aia only — once per turn)

END PHASE
  1. End-of-turn effects expire
  2. Carry over half your Credits (round down) — lose the rest
  3. Discard to max 7 cards
  4. Draw 1 card
  5. 0 cards in deck AND 0 in hand simultaneously → lose immediately
```

---

## REPUTATION PER TURN

| Visibility | Status | Rep/turn |
|---|---|---|
| 0–2 | Unnoticed | 0 |
| 3–5 | Noticed | 1 |
| 6–9 | Liked | 2 |
| 10+ | Featured | 3 (+5 burst, once per Creation) |

**Quality modifiers:** Q1: −1 · Q2–3: none · Q4: +1 · Q5: +2

---

## STYLE COMPATIBILITY

| Result | Effect on generated Creation |
|---|---|
| Compatible Style tag | +1 Quality on entry |
| Incompatible Style tag | +1 Glitch token on entry |
| Neither | No change |

**Style tags:** Fantasy · Landscape · Portrait · Abstract · Atmosphere

---

## CREATION DESTRUCTION

A Creation is destroyed immediately when its effective Quality reaches 0.
**Whenever any of your Creations is destroyed (for any reason) → you lose 1 Loyalty.**

*Effective Quality = base Quality − number of Glitch tokens*

---

## CREDITS

| | |
|---|---|
| Gain per turn | 5 (+ carryover) |
| Default cap | 10 |
| Cap with PRO Subscription | 13 (absolute maximum) |
| End of turn carryover | Half remaining, rounded down |
| First player, Turn 1 | 4 Credits |
| Second player, Turn 1 | 6 Credits |

---

## LOYALTY LOSS — COMMON CAUSES

| Cause | Loyalty lost |
|---|---|
| One of your Creations is destroyed | −1 |
| Creator Stress (end turn, no Creations/Queue) | −1 |
| Community Drama (E-002) | −2 |
| Going Viral (each threshold crossed) | −1 per threshold |
| Activating Signature ability (cost to self) | −4 |
| More Than You (if you have board advantage) | opponent −1 |

---

## CLIP-LOCK (AIA ONLY)

- Apply to one Coherent Creation per turn during Main Phase
- Blocks: opponent single-target abilities · opponent Glitch tokens
- Does NOT block: area effects · your own effects · Remix Queue
- Turn of application does NOT count toward Positive Feedback
- Removed by: Positive Feedback (②) · Copy That! (⚡) · end of game

---

## CONTENTION

If a Model is activated for the **2nd time in a round** (by either player) → that Creation gets +1 Runtime.

---

## SLOT OVERFLOW

More than 3 Creations cannot be on your field simultaneously.
When a new Creation arrives and all 3 slots are full → choose:
- Destroy one of your existing Creations (you lose 1 Loyalty), OR
- Discard the arriving Creation (you lose 1 Loyalty)

---

## CREATOR STRESS

Turn 2 onwards: end your turn with **no Creations on field AND nothing in Queue** → Creator loses 1 Loyalty.

---

## LORA RULES

- Maximum 1 LoRA per Model (Quick Duel)
- Each LoRA adds +1 Credit to the Model's Activation Cost
- LoRAs are permanent once attached

---

## PROMPT RULES

- Up to 2 Prompts per activation
- Must be different subtypes (Style / Artist / Negative / Atmosphere)
- Favourite Prompt is free, counts as 1 of the 2, counts toward subtype limit
- Prompts are discarded after use

---

## EVENTS

- **Instant Events** — play at any point during your own turn
- **Main Phase Events** — play only during your Main Phase
- Neither type can be played in Round 1
- Mass Report (E-001) is the only card playable during opponent's turn

---

## ABSOLUTE RULES

1. Loyalty 0 = immediate elimination. Nothing prevents this.
2. Quality 0 = immediate destruction. Nothing prevents this.
3. Creation destroyed = Creator loses exactly 1 Loyalty. Always.
4. Credit cap maximum: 13 (no exceptions).
5. Reputation cap maximum: 20 (no exceptions).
6. Max 3 active Creations on field at once.
7. Max 2 Creations in Queue at once (not counting Remix Queue).
8. Max 1 Creation in Remix Queue at once.
9. The Astronaut and PRO Subscription cannot be cancelled, removed or negated.
10. FAQ overrides card text. Absolute Rules override everything.

---

*Prompt Battle TCG · First Render (Set 001) · v0.14*
