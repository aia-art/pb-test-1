// ============================================================
// PROMPT BATTLE — Forms utility
// Auto-submit to Google Forms via hidden iframe POST (no redirects)
// ============================================================

export function submitToGoogleForm(
  formId: string,
  fields: Record<string, string>
): void {
  if (!formId || formId.startsWith('YOUR_')) {
    console.log('[DEV] Form not configured. Would submit:', fields);
    return;
  }

  const frame = document.createElement('iframe');
  frame.name = `gf_${Date.now()}`;
  frame.style.cssText = 'display:none;width:0;height:0;border:none;position:absolute;';
  document.body.appendChild(frame);

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = `https://docs.google.com/forms/d/e/${formId}/formResponse`;
  form.target = frame.name;
  form.style.display = 'none';

  for (const [name, value] of Object.entries(fields)) {
    const inp = document.createElement('input');
    inp.type = 'hidden';
    inp.name = name;
    inp.value = value;
    form.appendChild(inp);
  }

  document.body.appendChild(form);
  form.submit();
  setTimeout(() => { frame.remove(); form.remove(); }, 5000);
}

// ── localStorage helpers ──────────────────────────────────────
export function getHandle(): string {
  return localStorage.getItem('pb_handle') || '';
}
export function setHandle(handle: string): void {
  localStorage.setItem('pb_handle', handle);
}

// ── Clipboard + NightCafe redirect ───────────────────────────
export async function tryOnNightCafe(promptText: string): Promise<void> {
  const clean = promptText.replace(/^["']|["']$/g, '').trim();
  try {
    await navigator.clipboard.writeText(clean);
  } catch {
    // clipboard unavailable — just redirect
  }
  window.open('https://creator.nightcafe.studio/studio?ru=aia', '_blank');
}
