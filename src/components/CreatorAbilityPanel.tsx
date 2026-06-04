// ============================================================
// PROMPT BATTLE — CreatorAbilityPanel · v0.1
// ============================================================
// Drop-in component that renders a Creator card with:
//  • Glowing border: yellow = ability ready, red = ult ready
//  • Click → 3D flip animation
//  • After flip: ability list floats to the right of the card
//  • Player clicks ability / passive / prompt / ult to use it
//
// Usage:
//   <CreatorAbilityPanel
//     card={creatorCard}
//     currentReputation={playerRep}
//     currentLoyalty={playerLoyalty}
//     isExhausted={creator.isExhausted}
//     isMyTurn={isMyTurn}
//     onSelectAbility={(abilityNum) => handleAbility(abilityNum)}
//   />
// ============================================================

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { Card, Ability } from '../types';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function canAffordAbility(
  ab: Ability,
  rep: number,
  loyalty: number
): boolean {
  return rep >= (ab.cost.reputation ?? 0) && loyalty >= (ab.cost.loyalty ?? 0);
}

function hasUltReady(card: Card, rep: number, loyalty: number): boolean {
  const ult = card.abilities?.find(a => a.num === 'signature');
  return !!ult && canAffordAbility(ult, rep, loyalty);
}

function hasAnyAbilityReady(card: Card, rep: number, loyalty: number): boolean {
  return !!card.abilities?.some(a => canAffordAbility(a, rep, loyalty));
}

// ─────────────────────────────────────────────────────────────
// Glow ring colours
// ─────────────────────────────────────────────────────────────

function glowClass(
  card: Card,
  rep: number,
  loyalty: number,
  exhausted: boolean,
  myTurn: boolean
): { ring: string; shadow: string; pulse: boolean } {
  if (!myTurn || exhausted) return { ring: 'border-[#a1d0c6]/15', shadow: '', pulse: false };

  if (hasUltReady(card, rep, loyalty)) {
    return {
      ring:   'border-red-400/80',
      shadow: 'shadow-[0_0_28px_4px_rgba(248,113,113,0.55)]',
      pulse:  true,
    };
  }
  if (hasAnyAbilityReady(card, rep, loyalty)) {
    return {
      ring:   'border-yellow-400/70',
      shadow: 'shadow-[0_0_24px_4px_rgba(250,204,21,0.40)]',
      pulse:  true,
    };
  }
  return { ring: 'border-[#a1d0c6]/15', shadow: '', pulse: false };
}

// ─────────────────────────────────────────────────────────────
// Ability badge
// ─────────────────────────────────────────────────────────────

function AbilityBadge({ n }: { n: number | 'signature' }) {
  const isUlt = n === 'signature';
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black shrink-0
      ${isUlt
        ? 'bg-gradient-to-br from-red-500 to-rose-700 text-white'
        : 'bg-[#a1d0c6]/20 text-[#a1d0c6] border border-[#a1d0c6]/30'
      }`}
    >
      {isUlt ? 'Σ' : n}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Single ability row
// ─────────────────────────────────────────────────────────────

function AbilityRow({
  ability,
  rep,
  loyalty,
  exhausted,
  isUlt,
  onSelect,
}: {
  ability: Ability;
  rep: number;
  loyalty: number;
  exhausted: boolean;
  isUlt: boolean;
  onSelect: () => void;
}) {
  const affordable = canAffordAbility(ability, rep, loyalty);
  const disabled   = exhausted || !affordable;

  const costParts: string[] = [];
  if (ability.cost.reputation) costParts.push(`${ability.cost.reputation} Rep`);
  if (ability.cost.loyalty)    costParts.push(`${ability.cost.loyalty} Loy`);
  const costStr = costParts.join(' + ') || 'Free';

  return (
    <motion.button
      onClick={disabled ? undefined : onSelect}
      whileHover={disabled ? {} : { x: 4, scale: 1.01 }}
      whileTap={disabled   ? {} : { scale: 0.98 }}
      className={`group w-full text-left rounded-xl border px-3 py-2.5 transition-all duration-200
        ${disabled
          ? 'border-white/5 bg-white/3 opacity-40 cursor-not-allowed'
          : isUlt
            ? 'border-red-500/40 bg-red-950/30 hover:bg-red-900/40 hover:border-red-400/60 cursor-pointer'
            : 'border-[#a1d0c6]/20 bg-[#a1d0c6]/5 hover:bg-[#a1d0c6]/12 hover:border-[#a1d0c6]/40 cursor-pointer'
        }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <AbilityBadge n={ability.num} />
        <span className={`text-[13px] font-semibold leading-tight flex-1
          ${isUlt ? 'text-red-300' : 'text-[#dfe3e1]'}`}
        >
          {ability.name}
        </span>
        <span className={`text-[10px] font-mono shrink-0
          ${affordable ? (isUlt ? 'text-red-400' : 'text-yellow-400') : 'text-[#c0c8c5]/30'}`}
        >
          {costStr}
        </span>
      </div>
      <p className="text-[11px] text-[#c0c8c5]/60 leading-relaxed line-clamp-3 pl-8">
        {ability.text}
      </p>
      {ability.timing && (
        <span className="ml-8 mt-0.5 inline-block text-[9px] uppercase tracking-widest text-[#a1d0c6]/40 font-mono">
          {ability.timing}
        </span>
      )}
    </motion.button>
  );
}

// ─────────────────────────────────────────────────────────────
// Passive / Influence / FavPrompt rows (no cost, always visible)
// ─────────────────────────────────────────────────────────────

function PassiveRow({ label, name, text }: { label: string; name: string; text: string }) {
  return (
    <div className="rounded-xl border border-[#cebefa]/15 bg-[#cebefa]/5 px-3 py-2.5">
      <div className="flex items-center gap-2 mb-1">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[9px] font-black bg-[#cebefa]/15 text-[#cebefa] border border-[#cebefa]/25 shrink-0 uppercase tracking-tight">
          {label.slice(0, 2)}
        </span>
        <span className="text-[13px] font-semibold text-[#cebefa]/90">{name}</span>
        <span className="text-[9px] uppercase tracking-widest text-[#cebefa]/35 font-mono ml-auto">{label}</span>
      </div>
      <p className="text-[11px] text-[#c0c8c5]/55 leading-relaxed line-clamp-3 pl-8">{text}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

interface CreatorAbilityPanelProps {
  card:              Card;
  currentReputation: number;
  currentLoyalty:    number;
  isExhausted:       boolean;
  isMyTurn:          boolean;
  /** Called when the player selects an ability to use */
  onSelectAbility:   (abilityNum: number | 'signature') => void;
  /** Optional: called when closing the panel */
  onClose?:          () => void;
  /** Optional: className override for the outer wrapper */
  className?:        string;
}

export default function CreatorAbilityPanel({
  card,
  currentReputation,
  currentLoyalty,
  isExhausted,
  isMyTurn,
  onSelectAbility,
  onClose,
  className = '',
}: CreatorAbilityPanelProps) {
  const [isOpen,    setIsOpen]    = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const glow = glowClass(card, currentReputation, currentLoyalty, isExhausted, isMyTurn);

  function handleCardClick() {
    if (!isOpen) {
      // Start flip, then open panel once card has turned
      setIsFlipped(true);
      setTimeout(() => setIsOpen(true), 220);
    }
  }

  function handleClose() {
    setIsOpen(false);
    setTimeout(() => setIsFlipped(false), 180);
    onClose?.();
  }

  const hasAbilities    = (card.abilities?.length ?? 0) > 0;
  const hasPassive      = !!card.passive;
  const hasInfluence    = !!card.influence;
  const hasFavPrompt    = !!card.favouritePrompt;

  return (
    <div className={`relative flex items-start gap-0 ${className}`} style={{ perspective: '1000px' }}>

      {/* ── Card with 3D flip ─────────────────────────────── */}
      <div
        ref={cardRef}
        style={{
          transformStyle: 'preserve-3d',
          transition: 'transform 0.42s cubic-bezier(0.4, 0.2, 0.2, 1)',
          transform: isFlipped ? 'rotateY(-12deg)' : 'rotateY(0deg)',
          flexShrink: 0,
        }}
        className="relative"
      >
        {/* Glow pulse ring */}
        {glow.pulse && (
          <motion.div
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
            className={`absolute -inset-[3px] rounded-2xl pointer-events-none z-10 border-2 ${glow.ring} ${glow.shadow}`}
          />
        )}
        {!glow.pulse && (
          <div className={`absolute -inset-[2px] rounded-2xl pointer-events-none border ${glow.ring}`} />
        )}

        {/* Card face */}
        <motion.div
          onClick={handleCardClick}
          whileHover={isOpen ? {} : { scale: 1.03, y: -3 }}
          whileTap={isOpen ? {} : { scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className={`relative w-40 rounded-xl overflow-hidden cursor-pointer select-none
            bg-[#1c2120] border ${glow.ring} shadow-xl`}
          style={{ aspectRatio: '5/7' }}
        >
          {/* Top accent bar */}
          <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-[#a1d0c6]/0 via-[#a1d0c6]/60 to-[#a1d0c6]/0" />

          {/* Illustration area */}
          <div className={`w-full bg-gradient-to-br from-[#1c2120] to-[#0d1211] flex items-center justify-center`}
            style={{ height: '58%' }}
          >
            {card.image && !card.image.includes('placehold.co') ? (
              <img
                src={card.image}
                alt={card.name}
                className="w-full h-full object-cover"
                draggable={false}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3">
                <span className="text-[#a1d0c6]/20 text-[9px] italic text-center leading-tight line-clamp-4">
                  {card.illustration}
                </span>
              </div>
            )}
          </div>

          {/* Card info area */}
          <div className="absolute bottom-0 inset-x-0 p-2 pt-1 bg-gradient-to-t from-[#0d1211] via-[#0d1211]/95 to-transparent">
            {/* Name */}
            <div className="font-bold text-[11px] text-[#dfe3e1] leading-tight truncate">{card.name}</div>

            {/* Type / rarity row */}
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-[9px] uppercase tracking-widest text-[#a1d0c6]/50 font-mono">Creator</span>
              <span className={`text-[9px] ${card.rarity === 'mythic' ? 'text-[#cebefa]' : card.rarity === 'rare' ? 'text-[#a1d0c6]' : 'text-[#8a9490]'}`}>
                {'●'.repeat(card.rarityDots)}
              </span>
            </div>

            {/* Loyalty / Starting bonus */}
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[10px] text-[#dfe3e1]/70">
                ♥ <span className="font-bold text-[#dfe3e1]">{currentLoyalty}</span>/{card.loyalty}
              </span>
              <span className="text-[9px] text-[#a1d0c6]/50 ml-auto font-mono">
                {currentReputation} Rep
              </span>
            </div>

            {/* Exhausted indicator */}
            {isExhausted && (
              <div className="mt-1 text-[9px] uppercase tracking-widest text-orange-400/70 text-center font-mono">
                Exhausted
              </div>
            )}

            {/* Click hint when abilities are ready and not open */}
            {!isOpen && !isExhausted && isMyTurn && hasAnyAbilityReady(card, currentReputation, currentLoyalty) && (
              <motion.div
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="mt-1 text-[8px] uppercase tracking-widest text-[#a1d0c6]/50 text-center"
              >
                tap to use ability
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>

      {/* ── Ability panel (slides in from right) ─────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: -16, scaleX: 0.9 }}
            animate={{ opacity: 1, x: 0,   scaleX: 1   }}
            exit={{    opacity: 0, x: -10,  scaleX: 0.95 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            style={{ originX: 0 }}
            className="ml-3 w-72 flex flex-col gap-2 self-start"
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-1 mb-0.5">
              <span className="text-[11px] uppercase tracking-widest text-[#a1d0c6]/60 font-mono font-bold">
                {card.name}
              </span>
              <button
                onClick={handleClose}
                className="text-[#c0c8c5]/40 hover:text-[#c0c8c5]/80 transition-colors text-xs px-1"
              >
                ✕
              </button>
            </div>

            {/* Passive */}
            {hasPassive && (
              <PassiveRow
                label="Passive"
                name={card.passive!.name}
                text={card.passive!.text}
              />
            )}

            {/* Influence */}
            {hasInfluence && (
              <PassiveRow
                label="Influence"
                name={card.influence!.name}
                text={card.influence!.text}
              />
            )}

            {/* Favourite Prompt */}
            {hasFavPrompt && (
              <PassiveRow
                label="Fav. Prompt"
                name={card.favouritePrompt!.text}
                text={card.favouritePrompt!.effect}
              />
            )}

            {/* Divider between passives and active abilities */}
            {(hasPassive || hasInfluence || hasFavPrompt) && hasAbilities && (
              <div className="border-t border-[#a1d0c6]/8 my-0.5" />
            )}

            {/* Abilities (numbered + signature) */}
            {hasAbilities && (
              <div className="flex flex-col gap-1.5">
                {card.abilities!.map(ab => {
                  const isUlt = ab.num === 'signature';
                  return (
                    <AbilityRow
                      key={String(ab.num)}
                      ability={ab}
                      rep={currentReputation}
                      loyalty={currentLoyalty}
                      exhausted={isExhausted}
                      isUlt={isUlt}
                      onSelect={() => {
                        onSelectAbility(ab.num);
                        handleClose();
                      }}
                    />
                  );
                })}
              </div>
            )}

            {/* No abilities available message */}
            {!hasAbilities && !hasPassive && !hasInfluence && !hasFavPrompt && (
              <p className="text-[11px] text-[#c0c8c5]/30 italic px-1">
                No abilities on this creator.
              </p>
            )}

            {/* Exhausted / not your turn note */}
            {(isExhausted || !isMyTurn) && (
              <p className="text-[10px] text-orange-400/50 italic px-1 mt-0.5">
                {isExhausted
                  ? 'Already used an ability this turn.'
                  : 'Can only use abilities on your turn.'}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// INTEGRATION NOTES
// ─────────────────────────────────────────────────────────────
//
// 1. Import into your game board:
//      import CreatorAbilityPanel from './components/CreatorAbilityPanel';
//
// 2. Pass live game state props:
//      <CreatorAbilityPanel
//        card={playerCreatorCard}
//        currentReputation={gameState.player.creator.reputation}
//        currentLoyalty={gameState.player.creator.loyalty}
//        isExhausted={gameState.player.creator.isExhausted}
//        isMyTurn={gameState.turnOwner === 'human'}
//        onSelectAbility={(num) => dispatch({ type: 'USE_ABILITY', abilityNum: num })}
//      />
//
// 3. Two images per card (from data.ts):
//      - card.image        → the full card frame (used in CardGallery)
//      - card.illustration → art description; swap with a real illustration URL
//                            for the panel's art-only view
//
//    If you add an `illustrationUrl` field to the Card type later, swap the
//    <img src={card.image}> above to use it for a cleaner art-only render.
//
// 4. The glow logic is self-contained — no extra wiring needed.
//    It re-evaluates on every render based on currentReputation / currentLoyalty.
//
// 5. Passives and Prompts show as info-only (no click = no cost).
//    Numbered abilities and signature ult are the only clickable rows.
//
// ─────────────────────────────────────────────────────────────
