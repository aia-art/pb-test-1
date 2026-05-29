# FREQUENTLY ASKED QUESTIONS
## Prompt Battle TCG · Set 001: First Render · v0.14

---

*These answers override card text where there is a conflict. The FAQ is updated as questions come in during beta testing.*

---

## GENERAL RULES

**Q: What happens if both players run out of Loyalty at the same time?**
The player who caused the effect wins. If you cannot determine who caused it, the game is a draw.

**Q: Can I play Events in Round 1?**
No. Neither Instant Events nor Main Phase Events can be played in Round 1. This applies to both players.

**Q: Can I activate an opponent's Model on the turn they placed it?**
No. On the turn a Model enters the Shared Zone, only the player who placed it can activate it. From Round 2 onwards, both players may activate any Model in the Shared Zone.

**Q: What does "Contention" mean exactly?**
If a Model is activated for the second time in a single round — by either player — the second Creation generated gets +1 Runtime added to it. The first activation in a round is never affected by Contention.

**Q: Can I have more than 10 Credits?**
Your Credit cap is 10 by default. PRO Subscription raises it to 13. No other effect raises it above 13 — not even multiple PRO Subscriptions stacked together.

**Q: Can I have more than 20 Reputation?**
No. 20 is the absolute cap. Any Reputation earned above 20 is immediately lost.

**Q: What happens at end of turn with Credits?**
Half your remaining Credits carry over (round down). The rest are lost. *Example: 5 Credits remaining → 2 carry over (half of 5 = 2.5, rounded down). 3 are lost.*

---

## CREATIONS AND QUALITY

**Q: A Creation's Quality dropped to 0. What happens?**
It is destroyed immediately. Its Creator loses 1 Loyalty. This cannot be prevented by any card effect — it is an Absolute Rule.

**Q: Does destroying your own Creation still cost you Loyalty?**
Yes. Whenever any of your Creations is destroyed for any reason — including your own Glitch tokens, your own cards, or your own ability effects — you lose 1 Loyalty.

**Q: If I use Flood the Feed and a Creation enters with a Glitch token that drops it to Quality 0, do I lose Loyalty?**
Yes. You played the card, but the game does not care who caused it. Your Creation was destroyed, so you lose 1 Loyalty.

**Q: Can CLIP-LOCK prevent Quality loss from Glitch tokens?**
CLIP-LOCK only blocks opponent Glitch tokens and opponent single-target abilities. Your own effects and area-of-effect cards (like Centaur Problem) still apply normally to CLIP-LOCKed Creations.

**Q: If a Creation has Quality 1 and 1 Glitch token, what is its effective Quality?**
0. It is destroyed immediately. You lose 1 Loyalty.

**Q: Can I remove Glitch tokens?**
Only if a card effect specifically says it removes Glitch tokens. In Set 001, no cards do this directly — but Copycat... I Mean, Copygazelle... (P-003) prevents Glitch tokens from being applied for 3 turns after entry, which achieves a similar result.

---

## CLIP-LOCK

**Q: Does the turn I apply CLIP-LOCK count toward Positive Feedback?**
No. Counting starts from the turn after you applied it. A Creation locked last turn and unlocked this turn has been locked for 1 full turn — you gain 1 Loyalty.

**Q: Can I CLIP-LOCK a Creation on the same turn it enters the field?**
Yes, as long as it enters during your Refresh Phase and you apply CLIP-LOCK during your subsequent Main Phase in the same turn.

**Q: Can I CLIP-LOCK a Creation that already has CLIP-LOCK applied?**
Yes, but it does nothing — the Creation is already locked. You have used your one CLIP-LOCK application for the turn.

**Q: Can my opponent remove CLIP-LOCK from my Creations?**
No card in Set 001 allows an opponent to remove CLIP-LOCK directly. Mass Report (E-001) cancels Modifier cards, but CLIP-LOCK is not a Modifier — it is a game state applied by a passive ability.

**Q: Does CLIP-LOCK protect against Artifacts like Centaur Problem?**
No. Centaur Problem affects all Fantasy Creations — it is an area effect, not a single-target ability. CLIP-LOCK only blocks single-target effects.

---

## MODELS AND ACTIVATION

**Q: Can I activate the same Model twice in one turn?**
No. Each Model can only be activated once per turn across both players.

**Q: Can I play multiple Models in one turn?**
Yes. You may play as many Model cards as you can afford. You can only activate each one once per turn, but you could play three Models and activate all three in the same turn if you have the Credits.

**Q: What happens if I activate a Model with an incompatible Style tag?**
The generated Creation enters with 1 Glitch token. This is in addition to any other Glitch tokens from other sources.

**Q: Can both players use the same Model's compatible Style bonus?**
Yes. Style compatibility bonuses are based on the Style tag chosen for the Creation, not ownership of the Model.

**Q: Does SD1.5's extra Glitch token apply even when using Are You Crazy!? with it?**
Yes. SD1.5 always gives +1 Glitch token regardless of other cards. Are You Crazy?! gives +3 Quality and +1 Runtime. You end up with Quality 4 (1 base + 3 bonus), Runtime 2 (1 + 1), and 1 Glitch token. Effective Quality 3 after the Glitch token — still quite strong.

---

## PROMPTS

**Q: Can I use two of the same Prompt subtype in one activation?**
No. You may use up to 2 Prompts per activation, but they must be different subtypes (Style, Artist, Negative, Atmosphere). The Favourite Prompt counts as one of the 2 and its subtype counts toward the limit.

**Q: Do I have to use my Favourite Prompt?**
No. It is always available but never compulsory.

**Q: Can I use my Favourite Prompt without activating any Model cards from my hand?**
You must always be activating a Model to use Prompts. You cannot use Prompts or the Favourite Prompt outside of a Model activation.

---

## MODIFIERS

**Q: Can The Astronaut be cancelled by Mass Report?**
No. The Astronaut and PRO Subscription are the only two Modifiers that cannot be cancelled by Mass Report. This is an exception printed on Mass Report and stated in the Absolute Rules.

**Q: What happens when PRO Subscription expires and I have more than 10 Credits?**
You lose 5 Reputation. If that takes your Reputation below 0, you lose 1 Loyalty and your Reputation resets to 0.

**Q: Can I have two PRO Subscriptions active at the same time?**
You can attach two, but the Credit cap does not stack above 13. The second one still gives you the other bonuses (half-cost activation, Runtime reduction, +1 Credit per turn), but the cap stays at 13.

**Q: Can I attach more than one LoRA to the same Model?**
In Quick Duel, maximum 1 LoRA per Model. This is a deckbuilding restriction.

---

## EVENTS AND INSTANTS

**Q: Can Mass Report be played in response to The Astronaut being played?**
Yes. Mass Report is the only Instant that can be played during the opponent's turn (in response to a Modifier being played). However, it cannot cancel The Astronaut.

**Q: Can I play GPU Boost to reduce the Runtime of a Creation that is in the Remix Queue?**
No. GPU Boost and Priority Rendering specifically cannot target Creations in the Remix Queue.

**Q: Can Queue Crash target a Creation in the Remix Queue?**
Yes. Queue Crash can target Creations in either the regular Queue or the Remix Queue.

**Q: Can Generation Cancelled target a Creation in the Remix Queue?**
No. Generation Cancelled cannot target Creations in the Remix Queue.

---

## SPECIFIC CARD INTERACTIONS

**Q: P-004 (Did You Steal This Prompt?) says the Glitch token cannot be removed. Does CLIP-LOCK prevent it from being applied in the first place?**
CLIP-LOCK is applied after the Creation enters the field. P-004's Glitch token is applied on entry — it happens before CLIP-LOCK could be applied that turn. The Creation enters with the Glitch token already present, and the token cannot be removed by any means until the specified turns have passed.

**Q: A-001 (Centaur Problem) says it affects "all Fantasy Creations." Does this include CLIP-LOCKed ones?**
Yes. Centaur Problem is an area effect, not a single-target ability. CLIP-LOCK does not protect against it.

**Q: E-001 (Mass Report) says it can be played during "either player's turn." Can I play it on my own turn too?**
Yes. Mass Report can be played on your turn or your opponent's turn, but only in response to a Modifier card being played. It cannot be played proactively or against anything other than a Modifier being played.

**Q: MO-008 (Featured) says the attached Creation can now be "targeted by all abilities." Does that override CLIP-LOCK?**
Yes. If Featured is attached to one of your CLIP-LOCKed Creations, it can now be targeted by opponent abilities — Featured overrides CLIP-LOCK's single-target protection for that Creation.

**Q: Can I apply CLIP-LOCK to a Creation that has Featured attached?**
Yes, but CLIP-LOCK's single-target protection is negated by Featured (see above). The CLIP-LOCK still exists and Positive Feedback still works on it — it just does not block targeting.

---

## REPUTATION AND VISIBILITY

**Q: Is the Featured burst (+5 Reputation when reaching 10 Visibility) once per game or once per turn?**
Once per Creation, ever. The first time that specific Creation reaches 10 Visibility Counters, the burst triggers. It does not trigger again even if the Creation's Visibility drops below 10 and rises back above it.

**Q: If Going Viral pushes multiple Creations past the Featured threshold at once, does each one deal 1 Loyalty damage?**
Yes. Each Creation that crosses either the Liked threshold (6) or the Featured threshold (10) via Going Viral deals 1 Loyalty damage to the target Creator — separately. Three Creations crossing thresholds = 3 Loyalty damage.

---

*FAQ v0.14 — updated with beta feedback. Last revision: Set 001 First Render.*
