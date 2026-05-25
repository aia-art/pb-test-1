// Global cursor-following tooltip for glossary terms
// Usage: wrap your content with <GlossaryProvider>, then use linkGlossaryTerms(text)
import { useEffect } from 'react';
import { GLOSSARY } from '../config';

export function GlossaryProvider() {
  useEffect(() => {
    const tip = document.getElementById('pb-glossary-tip');
    if (!tip) return;

    function show(e: MouseEvent) {
      const el = (e.target as HTMLElement).closest('[data-def]') as HTMLElement | null;
      if (!el) return;
      tip!.textContent = el.dataset.def || '';
      tip!.style.display = 'block';
    }
    function move(e: MouseEvent) {
      if (tip!.style.display !== 'block') return;
      let x = e.clientX + 14, y = e.clientY - 44;
      if (x + 270 > window.innerWidth) x = e.clientX - 285;
      if (y < 8) y = e.clientY + 20;
      tip!.style.left = `${x}px`;
      tip!.style.top  = `${y}px`;
    }
    function hide(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest('[data-def]')) return;
      tip!.style.display = 'none';
    }

    document.addEventListener('mouseover', show);
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseout', hide);
    return () => {
      document.removeEventListener('mouseover', show);
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseout', hide);
    };
  }, []);

  return (
    <div
      id="pb-glossary-tip"
      style={{ display: 'none' }}
      className="fixed z-[9999] bg-[#0d1211] border border-[#a1d0c6]/20 text-[#c0c8c5] text-xs px-3 py-2 rounded-lg max-w-[260px] leading-relaxed pointer-events-none shadow-xl"
    />
  );
}

// Utility: replace known glossary terms in a string with highlighted spans
export function linkTerms(text: string): string {
  let result = text;
  for (const [term, def] of Object.entries(GLOSSARY)) {
    const esc     = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const safeDef = def.replace(/"/g, '&quot;').replace(/</g, '&lt;');
    result = result.replace(
      new RegExp(`(?<![\\w\\-])\\b(${esc}s?)\\b(?![^<>]*>)`, 'g'),
      `<span class="border-b border-dotted border-[#a1d0c6]/50 text-[#dfe3e1] cursor-help" data-def="${safeDef}">$1</span>`
    );
  }
  return result;
}
