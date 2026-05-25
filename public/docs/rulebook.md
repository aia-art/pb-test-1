# DOCUMENT 2: QUICK DUEL RULEBOOK
## NightCafe: The Card Game — First Render Edition
### Complete Rules for 1v1 Play

---

## INTRODUCTION

This rulebook covers everything you need to play a complete Quick Duel game using the First Render starter decks. Quick Duel is a two-player format. Each player fields one Creator card and a 40-card deck. The game ends when one player's Creator is eliminated.

**First Render** is the name of Set 001 — the first set of NightCafe: The Card Game. It contains the Aia — CLIP Starter Deck and the Anonymous User — Horde Starter Deck, along with all the cards in both decks.

---

## THE GOLDEN RULE

If a card's text contradicts these rules, the card text takes priority. Cards are exceptions to rules, not errors.

However, the **FAQ** takes priority over individual card text for clarifications and edge cases. Where a FAQ entry directly addresses how a card works, the FAQ ruling stands.

Additionally, certain rules are **Absolute** — they cannot be overridden by any card text. See the Absolute Rules section.

---

## ABSOLUTE RULES

The following rules cannot be overridden by any card text, FAQ entry or player agreement.

1. **A Creator's Loyalty reaching 0 ends the game immediately.**
2. **Whenever any Creation is destroyed for any reason, its Creator loses 1 Loyalty.**
3. **Creator Stress applies at the end of every turn from Turn 2 onwards** if the affected Creator has no Creations on the field and none in the Queue (including the Remix Queue).
4. **The Turn 1 exemption is absolute.** Creator Stress cannot apply on Turn 1. Round 1 restrictions cannot be bypassed except where explicitly stated on a card.
5. **A Creation's Quality reaching 0 means immediate destruction.**
6. **Reputation cannot exceed 20.** Excess is lost immediately.
7. **Credits cannot exceed the active cap.** Excess is lost immediately.

---

## KEY DEFINITIONS

**Turn:** One player's complete Refresh → Main → End sequence.

**Round:** A round is a full cycle of play measured from the start of one player's turn to the start of that same player's next turn. Each player experiences their own round cycle independently.

When a card says "this round" or "for X rounds," the duration is tracked from the perspective of the player who played the card. One round for that player means: from the point the effect begins, through the opponent's next turn, until the start of that player's next turn.

This means a card played during your Main Phase that lasts "1 round" persists through your End Phase, through your opponent's entire next turn, through your next Refresh Phase, and expires at the start of your next Main Phase.

One round always contains exactly two turns — yours and your opponent's.

**Counting rounds for durations:** When a card says "Duration: 3 rounds," count 3 full cycles from the controlling player's perspective. The effect expires at the start of that player's Main Phase on the turn it would enter its 4th round.

**Round 1 special case:** Round 1 restrictions apply to both players' first turns. Round 1 ends when the second player completes their Turn 1. Round 2 begins with the first player's Turn 2.

---

## COMPONENTS

**Per player:**
- 1 Creator card (set aside before play, never shuffled)
- 2 guaranteed Model cards (set aside before play, never shuffled)
- 37-card shuffled deck
- 1 Creator coin
- Loyalty tokens
- Credit tokens

**Shared:**
- Reputation tracker
- Creation Slot cards
- Visibility markers or beads
- Glitch tokens (red)
- Model coins
- Style tag coins
- Runtime counters

---

## GENERAL RULES

**Paying costs:** When you play any card from your hand — including Prompt cards, Modifier cards, Artifact cards and Event cards — pay its printed Credit cost. If a card's cost is 0, it is free to play but still counts as being played. Some cards cost Reputation instead of Credits — this is stated on the card.

**Discard piles:** Both players' Discard piles are public information. Either player may look through any Discard pile at any time. Cards in the Discard pile are always face-up.

---

## THE FIELD

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│              [OPPONENT'S CREATOR — centred]               │
│                                                          │
│        [OPP CREATION]  [OPP CREATION]  [OPP CREATION]    │
│                                              [OPP DISC]  │
│                                              [OPP DECK]  │
│                                                          │
│  ════════════════════════════════════════════════════════ │
│  [MODEL]  [MODEL]   [ARTIFACT ZONE]   [MODEL]  [MODEL]  │
│                    [REPUTATION TRACKER]                   │
│  ════════════════════════════════════════════════════════ │
│                                                          │
│                                              [YOUR DISC] │
│                                              [YOUR DECK] │
│        [YOUR CREATION]  [YOUR CREATION]  [YOUR CREATION] │
│                                                          │
│                [YOUR CREATOR — centred]                   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## GAME SETUP

**1.** Both players set their Creator cards face-up, centred on their side of the field.

**2.** Both players reveal their Creator cards simultaneously.

**3.** Each player sets aside their 2 guaranteed Model cards face-down. These form part of the opening hand and are never shuffled into the deck.

**4.** Both players shuffle their remaining 37 cards and place them face-down as their deck, to the far right of their side.

**5.** Determine who goes first by any agreed method.

**6.** Both players draw 5 cards from their deck. Combined with their 2 guaranteed Model cards, each player begins with 7 cards.

**7.** Each player may mulligan once. Shuffle the 5 drawn cards back into the deck and draw 4 new cards. Guaranteed Model cards are never part of a mulligan. A second mulligan is not permitted. If your opponent mulligans and you do not, gain 2 bonus Credits at the start of Round 1.

**8.** Each player applies their Creator's Starting Bonus as printed on their Creator card.

**9.** First player begins with 4 Credits (plus Starting Bonus if applicable). Second player begins with 6 Credits (plus Starting Bonus if applicable).

**10.** Place all shared components in the centre of the table.

---

## TURN STRUCTURE

---

### REFRESH PHASE

**A. Gain Credits**
Gain 5 Credits plus any Credits carried over. Credits above the active cap are lost immediately.

**B. Reduce Runtime Counters**
Reduce all Runtime counters on queued Creations by 1, including any Creation in the Remix Queue.

**C. Creations Enter the Field**
Any Creation whose Runtime counter just reached 0 enters the field, including Creations returning from the Remix Queue. If no Creation Slot is available, see Slot Overflow.

**D. Visibility Counters**
All active Creations on the field gain 1 Visibility Counter.

**E. Collect Reputation**
Collect Reputation from all active Creations. Apply threshold rate and Quality modifier. Reputation above 20 is lost immediately.

**F. Passive Bonuses**
Resolve passive bonuses from Creator cards and active Artifacts.

---

### MAIN PHASE

During the Main Phase you may take any of the following actions in any order:

**Play a Model card**
Pay the Play Cost. Place face-up in the Shared Model Zone. In Round 1, you may only activate Models you personally placed in the Shared Zone.

**Activate a Model**
Pay the Activation Cost plus 1 Credit per attached LoRA. Optionally play up to 2 Prompt cards of different subtypes (paying their Credit costs). Generate a Creation into your Queue.

**You may activate a maximum of 1 Model per turn.**

Each Model may be activated a maximum of 2 times per round across both players combined. The second activation adds 1 extra Runtime (Contention). Each Model may have a maximum of 3 Creations queued from it across both players at any one time.

**Use Favourite Prompt**
Use your Creator's Favourite Prompt for free instead of or alongside a card Prompt. Counts as one Prompt toward the 2-Prompt limit. Its subtype counts for duplicate checking.

**Apply CLIP-LOCK**
Creators with CLIP-LOCK access may apply CLIP-LOCK to one eligible active Coherent Creation once per turn during the Main Phase. The turn of application does not count toward Positive Feedback tracking.

**Activate a Creator ability**
Pay the full cost simultaneously. One ability per Creator per turn. A Creator who activates an ability this turn is Exhausted until their next turn. In Round 1, Creator abilities cannot be used unless the specific ability's card text explicitly states it may be used on Turn 1 or in Round 1.

**Play a Modifier card**
Pay its Credit cost. Attach to a valid target. Maximum 1 LoRA per Model in Quick Duel. Each attached LoRA increases the Model's activation cost by 1 Credit per activation. Cannot be played in Round 1.

**Play an Artifact card**
Pay its Credit cost. Place in the Shared Artifact Zone. Cannot be played in Round 1.

**Play a Main Phase Event card**
Pay its Credit cost. Resolve its effect. Discard it. Cannot be played in Round 1.

**Play an Instant Event card**
May be played at any point during your own turn. Cannot be played during the opponent's turn, except for Mass Report (see card). Cannot be played in Round 1.

**Remix a Creation**
Once per turn across all your Creations. The Remix Queue holds a maximum of 1 Creation per player at any time.

To Remix: choose an active Creation that is not CLIP-LOCKed. Discard 1 Prompt card from hand. Pay the Remix cost. Place the Creation in your Remix Queue — it is treated as a queued Creation, cannot be destroyed or permanently removed, and its immunities are ignored while here. Queue effects can delay its return. The Creation returns at the start of your next turn unless delayed. Each Creation may only be Remixed once per turn.

| Remix Type | Prompt Required | Cost | Effect |
|---|---|---|---|
| Style Change | Any | 2 Credits | Change Style tag |
| Style Change + Quality Boost | Artist or Atmosphere | 4 Credits | Change Style tag, +1 Quality |
| Glitch Removal | Any | +1 Credit per Glitch removed | Remove Glitch tokens |

---

### END PHASE

**A. Credit Carryover**
Half unspent Credits carry over (round down). All remaining Credits are lost.

**B. Resolve Effects**
Resolve any until-end-of-turn effects.

**C. Creator Stress**
From Turn 2 onwards only. Any Creator with no Creations on the field and none in the Queue (including the Remix Queue) loses 1 Loyalty.

**D. Discard**
Discard down to 7 cards if needed.

**E. Draw**
Draw 1 card from your deck.

**F. Check**
If you have no cards in your deck AND no cards in your hand simultaneously, you lose immediately.

**G. Pass**
Your opponent begins their turn.

---

## THE CREDIT SYSTEM

**Credit cap:** 10 (13 while PRO Subscription is active).

**Starting Credits:**
- First player: 4 Credits plus Starting Bonus
- Second player: 6 Credits plus Starting Bonus
- From Turn 2: both players gain 5 Credits plus carryover

**Carryover:** Half unspent Credits at end of turn (round down).

---

## STARTING BONUSES

Each Creator has a Starting Bonus printed on their card. This bonus is applied once at the start of the game, before the first turn begins.

- **Aia:** +1 Credit
- **Anonymous User:** +1 Reputation

Future Creators may have different Starting Bonuses. The Starting Bonus is part of the Creator card's identity and cannot be modified by card effects.

---

## THE REPUTATION SYSTEM

**Reputation cap:** 20 maximum. Excess lost immediately from any source.

| Visibility | Status | Rep/Turn |
|---|---|---|
| 0–2 | Unnoticed | 0 |
| 3–5 | Noticed | 1 |
| 6–9 | Liked | 2 |
| 10+ | Featured | 3 |

**Quality modifier:**

| Quality | Modifier |
|---|---|
| 1 | −1 (minimum 0) |
| 2 | +0 |
| 3 | +0 |
| 4 | +1 |
| 5 | +2 |

**Featured burst:** First time a Creation reaches 10 Visibility, its controller gains +5 Reputation immediately (subject to cap). Once only per Creation.

---

## LOYALTY

**Loyalty is reduced by:**
- Opponent cards and abilities targeting Creators
- Creator Stress
- Any Creation destroyed — its Creator loses 1 Loyalty (Absolute Rule)
- Signature ability activation (self)
- PRO Subscription expiry penalty (if applicable)

**Loyalty has no maximum.**

**Elimination:** Loyalty reaches 0 — game ends immediately. That player loses.

---

## STYLE COMPATIBILITY

Every Model lists Compatible and Incompatible Style tags. These are not hard restrictions — any Style tag may be assigned to any Creation from any Model. However:

- **Compatible Style:** The Creation gains **+1 Quality** on entry.
- **Incompatible Style:** The Creation gains **1 Glitch token** on entry.
- **Unlisted Style** (neither compatible nor incompatible): No bonus or penalty.

These bonuses and penalties are applied when the Creation enters the Queue, at the moment of generation. They stack with all other entry effects from Prompts, LoRAs and Model abilities.

---

## PROMPTS

Maximum 2 Prompts per activation, of different subtypes (Style, Artist, Negative, Atmosphere). Favourite Prompt counts as one Prompt. Prompt cards are discarded after use. Pay the printed Credit cost of each Prompt card when you play it.

---

## MODELS

**Guaranteed Models:** 2 per player, set aside before shuffling. Always in the opening hand. Never affected by mulligans.

**Limits (Quick Duel):**
- 1 activation per player per turn
- 2 activations per Model per round across both players
- 3 Creations queued per Model across both players
- Second activation same round: +1 Runtime (Contention)
- Round 1: only Models you personally placed may be activated

---

## QUEUE LIMITS (QUICK DUEL)

- Each player may have a maximum of **2 Creations** in their Queue at any one time (not counting the Remix Queue, which has its own limit of 1)
- The Remix Queue holds a maximum of **1 Creation** per player at any time

---

## LORA MODIFIERS

- Maximum 1 LoRA per Model in Quick Duel
- +1 Credit to activation cost per LoRA per activation
- Do not affect Creations already in Queue when attached
- Permanent unless removed by a card effect
- Cannot be played in Round 1

---

## CLIP-LOCK

Applied manually once per turn during Main Phase. Coherent Creations only. Turn of application does not count toward Positive Feedback.

**While CLIP-LOCKed:**
- Cannot receive Glitch tokens from opponent sources
- Cannot be targeted by opponent single-target abilities
- Can be affected by field-wide Artifacts and area Events
- Cannot be Remixed
- Controller's own Glitch token effects still apply

---

## REMIX

Once per turn across all your Creations. Maximum 1 Creation in Remix Queue per player at any time.

**Remix Queue rules:**
- Treated as queued Creation for targeting purposes
- Cannot be destroyed or permanently removed
- Immunities ignored while in Remix Queue
- Queue effects can delay return
- Counts as being in the Queue for Creator Stress purposes
- PRO Subscription Runtime reduction does not apply to the Remix Queue

---

## CREATIONS

Tracked on Creation Slot cards. Maximum 3 active Creations per Creator. Quality 0 = immediate destruction (Absolute Rule). Each destruction costs Creator 1 Loyalty (Absolute Rule).

---

## STYLE TAGS

In First Render, each Creation has exactly one Style tag. If an effect would assign a second Style tag to a Creation that already has one, the new tag replaces the existing one unless the effect explicitly states otherwise.

---

## SLOT OVERFLOW

When a Creation arrives with no free slot:

1. **Destroy an existing Creation** — The destroyed Creation's controller loses 1 Loyalty (standard destruction penalty). The incoming Creation fills the freed slot.
2. **Lose the queued Creation** — The incoming Creation is discarded. No Loyalty loss. Credits not refunded.

---

## PRO SUBSCRIPTION — EXPIRY

When PRO Subscription expires:
- Credit cap returns to 10. Credits above 10 lost immediately.
- If you had more than 10 Credits at the moment of expiry: lose 5 Reputation.
- If that brings Reputation to 0 or below: lose 1 Loyalty. Reputation resets to 0.

---

## WIN CONDITIONS

**Loyalty reaches 0 — eliminated immediately.** (Absolute Rule)

**No cards in deck AND no cards in hand simultaneously — lose immediately.**

---

## ROUND 1 RESTRICTIONS

During Round 1, the following restrictions apply to both players:

**You may play:**
- Model cards (into the Shared Zone)
- Prompt cards (during Model activation)

**You may activate:**
- Only Models that you personally placed in the Shared Zone this round

**You may use:**
- Your Creator's Favourite Prompt
- Starting Bonuses (these are applied before Round 1 begins)
- Creator abilities, but only if the specific ability's card text explicitly states it may be used in Round 1 or on Turn 1

**You may NOT play or use:**
- Modifier cards (LoRAs, Creator Modifiers, Creation Modifiers, Model Modifiers)
- Artifact cards
- Event cards (including Instants)
- Creator abilities (unless explicitly permitted by card text)

**Additional Round 1 rules:**
- No Contention (second activation penalty does not apply)
- Creator Stress does not apply on Turn 1 (Absolute Rule)

All restrictions lift at the start of Round 2.
