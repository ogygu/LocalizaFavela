/* =====================================================================
   LocalizaFavela | toast.js — Micro-interações de feedback (aria-live)
   Uso: import { toast } from '../ui/toast.js'; toast('Inscrição enviada!', 'ok');
   ===================================================================== */

let stackEl = null;

function garantirStack() {
  if (stackEl) return stackEl;
  stackEl = document.createElement('div');
  stackEl.className = 'toast-stack';
  stackEl.setAttribute('role', 'status');       // semântica de live region
  stackEl.setAttribute('aria-live', 'polite');
  document.body.appendChild(stackEl);
  return stackEl;
}

/**
 * @param {string} mensagem
 * @param {'ok'|'error'} tipo
 * @param {number} ms duração (padrão 3800)
 */
export function toast(mensagem, tipo = 'ok', ms = 3800) {
  const stack = garantirStack();
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  el.textContent = mensagem;
  stack.appendChild(el);

  setTimeout(() => {
    el.classList.add('leaving');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 400); // fallback
  }, ms);
}
