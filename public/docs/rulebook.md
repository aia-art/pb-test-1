# PROMPT BATTLE — FULL RULEBOOK
## Set 001: First Render · Rules v0.14

---

*This is the complete rulebook. If you are new to the game, start with Tutorial 1A first — it explains everything step by step with examples. This document is the authoritative reference for all rules.*

---

## PART ONE — THE BASICS

### 1.1 WHAT YOU NEED TO PLAY

- 2 Starter Decks (fourty cards each, plus 1 Creator card and 2 guaranteed Model cards per player, set aside before play)
- Creation Slot cards
- Credit tokens
- Loyalty tokens
- Visibility beads or counters
- Glitch tokens
- Creator coins, Model coins, Style tag coins
- A shared Reputation tracker

### 1.2 OBJECT OF THE GAME

Reduce your opponent's Creator's Loyalty to 0. The first player whose Creator reaches 0 Loyalty loses immediately.

### 1.3 CARD TYPES

**Creator cards** — Your identity for the game. One per player, never shuffled into the deck. Sits in front of you permanently.

**Model cards** — AI generation tools. Played into the Shared Zone. Both players can activate Models from Round 2 onwards.

**Prompt cards** — Played during Model activation to modify the generated Creation. Discarded after use.

**Modifier cards** — Attach to Creators, Models or Creations to grant ongoing effects.

**Artifact cards** — Placed in the Artifact Zone. Condition and Anomaly types affect both players.

**Event cards** — Instant and Main Phase effects. Single use, discarded after resolving.

---

## PART TWO — SETUP

### 2.1 TABLE LAYOUT

Set up the table with each player's Creator card visible in front of them, deck to one side, discard pile offset. Between the two players sits the Shared Zone: Model spaces on both sides of the centre, an Artifact Zone in the middle, and the shared Reputation tracker to one side.

Each player has up to 3 Creation Slots in their own zone, between them and the Shared Zone.

### 2.2 DECKBUILDING RULES (QUICK DUEL)

A legal Quick Duel deck contains exactly fourty cards:

| Component | Count |
|---|---|
| Creator card (set aside) | 1 |
| Guaranteed Model cards (set aside) | 2 |
| Shuffled deck | 37 |

**The shuffled deck (37 cards) must follow these rules:**
- Maximum 3 copies of any single card
- The Astronaut (MO-001): maximum 1 copy
- No Creator cards
- No cards designated as a different deck's guaranteed Model

### 2.3 GAME START

1. Both players reveal their Creator cards simultaneously
2. Shuffle your 37-card deck and place it face-down
3. Set your Creator card and 2 guaranteed Model cards face-up in front of you
4. Draw 7 cards as your opening hand
5. Either player may mulligan once: shuffle your hand back, draw 6 cards instead, keep those
6. If one player mulligans and the other does not, the player who did not mulligan gains 2 bonus Credits at game start
7. Decide who goes first (coin flip or dice roll)
8. Apply starting bonuses from Creator cards
9. First player starts with 4 Credits. Second player starts with 6 Credits.

---

## PART THREE — TURN STRUCTURE

Every turn has three phases in order: Refresh, Main, End. You cannot skip phases or change their order.

### 3.1 REFRESH PHASE

Resolve these steps in order:

**Step 1 — Gain Credits**
Gain 5 Credits. Add any Credits carried over from your previous turn. You cannot hold more than your Credit cap (default 10) at any time. Any excess is lost.

**Step 2 — Reduce Runtime**
Reduce each Creation in your Queue by 1 Runtime counter.

**Step 3 — Creations enter**
Any Creation whose Runtime counter just reached 0 enters the field. If all 3 of your Creation Slots are full when a Creation arrives, **Slot Overflow** occurs — you must choose to either destroy one of your existing active Creations or send the arriving Creation to the discard pile. Either way, if a Creation is destroyed, its Creator loses 1 Loyalty.

**Step 4 — Gain Visibility**
Each of your active Creations on the field gains 1 Visibility Counter.

**Step 5 — Collect Reputation**
For each active Creation, calculate its Reputation generation based on its current Visibility and Quality:

*Visibility brackets:*
- 0–2 Visibility: Unnoticed — 0 Reputation
- 3–5 Visibility: Noticed — 1 Reputation
- 6–9 Visibility: Liked — 2 Reputation
- 10+ Visibility: Featured — 3 Reputation

*Quality modifiers:*
- Quality 1: −1 Reputation per turn (minimum 0 total)
- Quality 2–3: No change
- Quality 4: +1 Reputation per turn
- Quality 5: +2 Reputation per turn

Add all Reputation earned to your total. Reputation is capped at 20. Surplus is lost.

**Featured burst:** The first time any of your Creations reaches exactly 10 Visibility Counters, gain +5 bonus Reputation immediately. This only triggers once per Creation, ever.

**Step 6 — Passive effects**
Resolve any ongoing passive effects that trigger at the start of your turn.

**Step 7 — Creator Stress (Turn 2 onwards)**
If you have no active Creations on the field AND nothing in your Queue (including Remix Queue), your Creator loses 1 Loyalty. This does not apply on Turn 1.

### 3.2 MAIN PHASE

During your Main Phase you may take any of the following actions in any order, as many times as you can afford:

**Play a Model card** — Pay the Model's Play Cost in Credits. Place it face-up in the Shared Zone. A Model can be activated this turn only if you placed it this turn. From Round 2 onwards, both players may activate any Model in the Shared Zone.

**Activate a Model** — Choose a Model in the Shared Zone. Pay its Activation Cost. Optionally play up to 2 Prompt cards of different subtypes. Place a new Creation in your Queue with the appropriate stats. You may only activate each Model **once per turn** (across both players combined in Round 2+). A Model cannot be activated on the same turn it was played if that would be its second activation that round.

**Contention:** If a Model is activated for the 2nd time in a round (by either player), the second Creation generated gains +1 Runtime.

**Play a Modifier card** — Pay its Credit cost and attach it to the appropriate target.

**Play an Artifact card** — Pay its Credit cost and place it in the Artifact Zone.

**Play a Main Phase Event card** — Pay its Credit cost and resolve its effect.

**Play an Instant Event card** — Pay its Credit cost and resolve its effect. Can be played at any point during your own turn.

**Use your Creator's ability** — Pay the Reputation (and Loyalty, for Signature abilities) cost. Each Creator may only use one ability per turn. After using an ability, your Creator is Exhausted until the start of your next turn.

**Apply CLIP-LOCK** *(Aia only)* — Once per turn during your Main Phase, apply CLIP-LOCK to one of your active Coherent Creations.

**Remix a Creation** *(if applicable cards are in play)*

### 3.3 END PHASE

Resolve in order:

1. Any until-end-of-turn effects expire
2. Credit carryover: half your remaining Credits carry over to next turn (round down). The rest are lost
3. Discard down to a maximum of 7 cards in hand
4. Draw 1 card from your deck
5. If you have 0 cards in your deck AND 0 cards in hand at the same time, you lose immediately
6. Pass to your opponent

---

## PART FOUR — MODELS AND GENERATION

### 4.1 THE SHARED MODEL ZONE

Models are played into the Shared Zone between both players. Once there, any player may activate them (from Round 2 onwards). The player who placed a Model can activate it on the turn they placed it.

**LoRA Modifiers:** A Model with a LoRA Modifier attached costs 1 additional Credit per LoRA to activate, above its base Activation Cost. Maximum 1 LoRA per Model in Quick Duel.

### 4.2 PROMPTS

Up to 2 Prompt cards may be played alongside a Model activation, one of each subtype. Prompt subtypes are: Style, Artist, Negative, Atmosphere.

You may use your Creator's Favourite Prompt as one of the 2 Prompts. It counts toward the subtype limit.

### 4.3 STYLE COMPATIBILITY

When a Creation is generated, check the activating Model's compatible and incompatible Style tag list:

- **Compatible:** Creation gains +1 Quality
- **Incompatible:** Creation enters with +1 Glitch token
- **Neither:** No bonus or penalty

Style tags: Fantasy, Landscape, Portrait, Abstract, Atmosphere.

### 4.4 CREATION STATS ON ENTRY

When a Creation enters the Queue, record on its Creation Slot:
- **Quality:** Model's base Quality + compatible Style bonus + any Prompt bonuses
- **Glitch tokens:** From incompatible Style, or SD1.5's base effect, or Prompt penalties
- **Style tag:** From Prompts played, or chosen from the Model's compatible list if no Style Prompt used
- **Visibility Counters:** Any entry bonuses from Prompts or Model effects
- **Runtime counter:** Set to the Model's Runtime value

### 4.5 QUALITY AND GLITCH TOKENS

Each Glitch token reduces a Creation's effective Quality by 1. A Creation with Quality 2 and 2 Glitch tokens has effective Quality 0 — it is destroyed immediately, and its Creator loses 1 Loyalty.

Quality 0 for any reason = immediate destruction.

---

## PART FIVE — CLIP-LOCK

### 5.1 WHAT CLIP-LOCK DOES

CLIP-LOCK is a protective state applied to Coherent Creations by Aia's passive ability.

A CLIP-LOCKed Creation:
- Cannot be targeted by opponent single-target abilities
- Cannot receive Glitch tokens from opponent effects
- Still generates Visibility and Reputation normally
- Still occupies a Creation Slot

### 5.2 WHAT CLIP-LOCK DOES NOT DO

- Does not protect against area-of-effect cards (Centaur Problem, Server Overload, etc.)
- Does not protect against your own effects
- Does not prevent Quality loss from your own Glitch tokens
- Cannot protect a Creation in the Remix Queue

### 5.3 APPLYING AND REMOVING CLIP-LOCK

Aia may apply CLIP-LOCK to one Coherent Creation per turn during her Main Phase. She may apply it to a different Creation each turn.

CLIP-LOCK is removed by: Positive Feedback (ability ②), Copy That! (Signature), or end-of-game.

The turn CLIP-LOCK is applied does not count as a "locked turn" for Positive Feedback purposes. Counting starts from the turn after application.

---

## PART SIX — REMIXING

### 6.1 THE REMIX QUEUE

A Creation may be sent to the Remix Queue instead of being destroyed or discarded in certain situations. While in the Remix Queue:

- The Creation cannot be targeted or destroyed
- It does not generate Visibility or Reputation
- Immunities from Prompts or Modifiers do not apply

A Creation in the Remix Queue returns to the field at the start of the owning player's turn after the Remix resolves.

### 6.2 REMIX TYPES

**Standard Remix:** The Creation returns with a Style tag of your choice. Runtime resets to the original Model's Runtime value.

**LoRA Remix:** The Creation returns with the benefits of a LoRA Modifier applied. Follow specific LoRA rules for which Style tags are affected.

A player may have maximum 1 Creation in their Remix Queue at a time.

---

## PART SEVEN — MODIFIERS, ARTIFACTS, EVENTS

### 7.1 MODIFIERS

Modifier cards attach to Creators, Models or Creations (as specified on the card). Their effect is ongoing until the Modifier expires or is removed.

- **Duration:** Modifiers last for the number of turns or rounds printed on the card. Permanent Modifiers (LoRAs) have no duration limit.
- **Removal:** Unless stated otherwise, Modifiers cannot be removed before their duration expires. Some Artifacts and Events can remove specific Modifiers.
- **Stacking:** Multiple Modifiers may attach to the same target unless the card states otherwise.

**The Astronaut** and **PRO Subscription** cannot be cancelled by Mass Report (E-001).

### 7.2 ARTIFACTS

Artifact cards are placed in the Artifact Zone and affect both players unless stated otherwise.

- **Anomaly Artifacts:** Ongoing environmental effects. Some can be removed early by spending Credits.
- **Condition Artifacts:** Immediate effects that then remain as a condition until their duration expires or their removal condition is met.

### 7.3 EVENTS

- **Instant Events:** Played at any point during your own turn. Cannot be played during opponent's turn in Quick Duel, except Mass Report (E-001).
- **Main Phase Events:** Played only during your Main Phase.

Neither type can be played in Round 1.

---

## PART EIGHT — WINNING AND LOSING

### 8.1 LOYALTY DAMAGE

A Creator loses Loyalty when:
- An opponent's ability or Event targets them for Loyalty damage
- One of their Creations is destroyed (any reason, including their own effects)
- Creator Stress triggers (no Creations on field or in Queue at end of turn, Turn 2+)
- A Signature ability is used (costs Loyalty from its owner)
- Certain Modifier expiry effects trigger

### 8.2 WIN CONDITIONS

- **Primary:** Reduce opponent Creator's Loyalty to 0
- **Deck out:** A player with 0 cards in their deck AND 0 cards in hand loses immediately
- **Concede:** A player may concede at any time during their own turn

### 8.3 SIMULTANEOUS LOSS

If both Creators reach 0 Loyalty at the same time (from the same effect), the player who caused the effect wins. If that cannot be determined, the game is a draw.

---

## PART NINE — ROUNDS AND TURNS

### 9.1 TURNS VS ROUNDS

A **turn** is one player's complete sequence of phases. A **round** is completed when both players have each taken one turn. Round 1 is the first round — both players take their first turn, then Round 1 ends and Round 2 begins.

Some effects reference turns and some reference rounds — they are different things.

### 9.2 TURN ORDER IN ROUND 1

The first player takes the first turn of Round 1. No Events can be played in Round 1 (Instant or Main Phase). No Contention applies in Round 1. Models placed in Round 1 can only be activated by the player who placed them, until Round 2.

---

## PART TEN — ABSOLUTE RULES

*These rules override any card text in any situation.*

1. Loyalty reaching 0 = immediate elimination. Nothing prevents this.
2. Quality reaching 0 = immediate destruction. Nothing prevents this.
3. When any Creation is destroyed, its Creator loses exactly 1 Loyalty. No card effect increases or decreases this.
4. The Credit cap cannot exceed 13 under any circumstances, even with multiple PRO Subscriptions.
5. The Reputation cap cannot exceed 20 under any circumstances.
6. A player cannot have more than 3 active Creations on the field at any time.
7. A player cannot have more than 2 Creations in their Queue at any time (not including the Remix Queue).
8. A player cannot have more than 1 Creation in their Remix Queue at any time.
9. The Astronaut and PRO Subscription cannot be cancelled, removed, negated or modified by any card effect.
10. Card text takes priority over the rulebook in all cases not covered by Absolute Rules. FAQ takes priority over card text.

---

*Prompt Battle TCG — First Render (Set 001) · Rules v0.14*
