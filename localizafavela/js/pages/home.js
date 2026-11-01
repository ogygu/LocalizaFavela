/* =====================================================================
   LocalizaFavela | home.js — Interações da Home pública
   1) Menu mobile acessível (aria-expanded + Esc)
   2) Contadores de impacto animados ao entrar no viewport
      (respeita prefers-reduced-motion)
   3) Se já logado, CTA vira "Ir para meu painel"
   ===================================================================== */

/* ---------- 1. MENU MOBILE ---------- */
const toggle = document.getElementById('navToggle');
if (toggle) {
  toggle.addEventListener('click', () => {
    const aberto = document.body.classList.toggle('nav-open');
    toggle.setAttribute('aria-expanded', String(aberto));
    toggle.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('nav-open')) {
      document.body.classList.remove('nav-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    }
  });
}

/* ---------- 2. CONTADORES ANIMADOS ---------- */
const reduzMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function animarContador(el) {
  const alvo = Number(el.dataset.count || 0);
  const sufixo = el.dataset.suffix || '';
  if (reduzMovimento) { el.textContent = alvo.toLocaleString('pt-BR') + sufixo; return; }

  const duracao = 1400;
  const inicio = performance.now();
  const passo = (agora) => {
    const t = Math.min((agora - inicio) / duracao, 1);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    el.textContent = Math.round(alvo * eased).toLocaleString('pt-BR') + sufixo;
    if (t < 1) requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}

const numeros = document.querySelectorAll('.impact-number[data-count]');
if (numeros.length && 'IntersectionObserver' in window) {
  const obs = new IntersectionObserver((entradas) => {
    entradas.forEach((entrada) => {
      if (entrada.isIntersecting) {
        animarContador(entrada.target);
        obs.unobserve(entrada.target); // anima uma única vez
      }
    });
  }, { threshold: 0.4 });
  numeros.forEach((n) => obs.observe(n));
} else {
  numeros.forEach(animarContador);
}

/* ---------- 3. CTA INTELIGENTE SE HOUVER SESSÃO ---------- */
(async () => {
  try {
    const sb = window.LF_SUPABASE;
    if (!sb) return;
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;

    // descobre o destino pelo tipo de conta
    const uid = session.user.id;
    const { data: ong } = await sb.from('profiles_ongs').select('id').eq('id', uid).maybeSingle();
    const destino = ong ? 'ong/dashboard.html' : 'usuario/dashboard.html';

    document.querySelectorAll('.hero-ctas .btn-primary').forEach((cta) => {
      cta.href = destino;
      cta.textContent = 'Ir para meu painel';
    });
  } catch { /* home continua 100% funcional sem Supabase configurado */ }
})();
