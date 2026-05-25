# DOCUMENT 5: QUICK REFERENCE SHEET
## NightCafe: The Card Game — First Render
### Keep this on the table during play

---

## TURN ORDER

```
REFRESH
  1. Gain Credits (5 + carryover, max active cap)
     First turn: First player 4 + bonus, Second player 6 + bonus
  2. Reduce Runtime counters by 1 (incl. Remix Queue)
  3. Creations with Runtime 0 enter field
     (incl. Creations returning from Remix Queue)
  4. Active Creations gain 1 Visibility Counter
  5. Collect Reputation (max 20)
  6. Passive bonuses

MAIN PHASE (any order)
  · Play Models into Shared Zone
  · Activate 1 Model (pay cost + 1 Credit per LoRA)
    + up to 2 Prompts of different subtypes (pay their costs)
    (Favourite Prompt counts as 1 Prompt, always free)
  · Apply CLIP-LOCK (eligible Creators, once per turn)
  · Use Creator ability (one per Creator per turn)
  · Play Modifiers, Artifacts, Main Phase Events (pay costs)
  · Play Instant Events (any point this turn; Mass Report
    may also be played during opponent's turn)
  · Remix one Creation (once per turn, max 1 in Remix Queue)

END PHASE
  1. Carryover: half unspent Credits (round down)
  2. Creator Stress (Turn 2+ only)
     No Creations on field or in Queue → −1 Loyalty
  3. Discard to 7 cards
  4. Draw 1 card
  5. Check: no deck + no hand = lose immediately
  6. Pass turn
```

---

## STYLE COMPATIBILITY

Any Style may be used with any Model.
- Compatible Style = +1 Quality on entry
- Incompatible Style = +1 Glitch on entry
- Unlisted Style = no effect

---

## REPUTATION THRESHOLDS

| Visibility | Status | Rep/Turn | Quality Mod |
|---|---|---|---|
| 0–2 | Unnoticed | 0 | Q1: −1 |
| 3–5 | Noticed | 1 | Q2/3: +0 |
| 6–9 | Liked | 2 | Q4: +1 |
| 10+ | Featured | 3 | Q5: +2 |

**Featured burst:** +5 Reputation once only, first time reaching 10.
**Rep cap:** 20. Excess lost immediately.

---

## STARTING VALUES

| | Aia | Anonymous User |
|---|---|---|
| Loyalty | 11 | 16 |
| Starting Bonus | +1 Credit | +1 Reputation |
| Guaranteed Models | Coherent / Juggernaut | SDXL / SD1.5 |

---

## CREDIT ECONOMY

| | Value |
|---|---|
| Gained per turn | 5 + carryover |
| Cap | 10 (13 with PRO) |
| Carryover | Half unspent, round down |
| First player Turn 1 | 4 + Starting Bonus |
| Second player Turn 1 | 6 + Starting Bonus |
| LoRA surcharge | +1 Credit per LoRA per activation |

---

## LOYALTY DAMAGE SOURCES

- Opponent abilities targeting Creators
- Community Drama (−2 Loyalty)
- Creator Stress (−1/turn from Turn 2)
- Creation destroyed — any reason (−1 Loyalty, always)
- Self-deletion to free slot (−1 Loyalty, standard destruction)
- Signature ability activation (self, varies)
- Going Viral — Liked or Featured threshold crossed (−1 per threshold per Creation)
- More Than You — board advantage (−1 Loyalty)
- PRO Subscription expiry with Credits above 10 (−5 Rep; if Rep hits 0 or below, −1 Loyalty)

---

## MODEL LIMITS (QUICK DUEL)

| Limit | Value |
|---|---|
| Your activations per turn | 1 |
| Activations per Model per round (both players) | 2 |
| Contention penalty (2nd activation of same Model) | +1 Runtime |
| Your Queue capacity | 2 (excl. Remix Queue) |
| Creations queued per Model (both players) | 3 |
| LoRAs per Model (Quick Duel) | 1 |
| LoRA activation surcharge | +1 Credit per LoRA |

---

## CLIP-LOCK SUMMARY

- Apply once per turn, Main Phase, eligible Creators only
- Coherent Creations only — not automatic
- Blocks: opponent Glitch tokens, opponent single-target abilities
- Does NOT block: field-wide Artifacts, area Events, own card effects
- Turn of application: does not count toward Positive Feedback
- Removed by: Positive Feedback, Copy That!
- Cannot be Remixed while active

---

## REMIX SUMMARY

- Once per turn across all your Creations
- Max 1 Creation in Remix Queue per player at any time
- Cannot Remix CLIP-LOCKed Creations
- In Remix Queue: treated as queued Creation, cannot be destroyed, immunities ignored
- Queue Crash can delay return; Generation Cancelled cannot remove
- PRO Subscription Runtime reduction does not apply

---

## PROMPT RULES

- Maximum 2 Prompts per activation, different subtypes
- Favourite Prompt counts as 1 (subtype applies, always free)
- Subtypes: Style · Artist · Negative · Atmosphere
- Pay the printed Credit cost of each Prompt card

---

## ROUND 1 RESTRICTIONS

May play: Models · Prompts
May activate: only Models you personally placed
May use: Favourite Prompt · Starting Bonus · Creator abilities only if card text explicitly permits
May NOT play: Modifiers · Artifacts · Events (incl. Instants)
No Contention · No Creator Stress on Turn 1

---

## ABSOLUTE RULES

1. Loyalty 0 = eliminated immediately
2. Any Creation destroyed = Creator loses 1 Loyalty
3. Creator Stress: end of turn, Turn 2+, no Creations anywhere
4. Turn 1 exemptions and Round 1 restrictions are inviolable (except where card text explicitly permits)
5. Quality 0 = immediate destruction
6. Reputation cap: 20
7. Credits cap: 10 (or active modified cap)

---

## KEY TERMS

**Turn** — One player's complete Refresh → Main → End sequence.
**Round** — A full cycle from one player's turn back to the start of that same player's next turn. Contains exactly two turns. Durations tracked from the controlling player's perspective.
**Exhaust** — Used ability this turn. Cannot use another until next turn.
**Contention** — 2nd activation of same Model in a round. +1 Runtime.
**Creator Stress** — No Creations on field or in Queue at end of turn (Turn 2+). −1 Loyalty.
**Featured** — 10+ Visibility. +5 burst once. 3 Rep/turn.
**CLIP-LOCK** — Coherent only. Manual. Blocks opponent Glitch and single-target abilities.
**Remix Queue** — Temporary. Treated as Queue. Cannot be destroyed. Max 1 per player.
**Slot Overflow** — No free slot when Creation arrives. Destroy existing (−1 Loyalty) or lose incoming.
**Starting Bonus** — Printed on Creator card. Applied once at game start.
**Style Compatibility** — Compatible = +1 Quality on entry. Incompatible = +1 Glitch on entry.
