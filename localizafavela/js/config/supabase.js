/* =====================================================================
   LocalizaFavela | supabase.js — Bootstrap do cliente Supabase
   Equipe PIE UniSales: Gustavo Bonjardim | Andressa Gonçalves | Giovanna Vargas
   ---------------------------------------------------------------------
   ⚠️ SUBSTITUA os valores abaixo pelos dados reais do seu projeto:
   Supabase Dashboard → Project Settings → API
   ===================================================================== */

const SUPABASE_URL = 'https://SEU-PROJETO.supabase.co';
const SUPABASE_ANON_KEY = 'SUA_ANON_PUBLIC_KEY';

// Expõe uma única instância global para todos os módulos ES6.
// (CDN UMD do supabase-js já está carregado no <head> das páginas.)
window.LF_SUPABASE_URL = SUPABASE_URL;
window.LF_SUPABASE = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Guarda de sessão reutilizável por todas as páginas autenticadas.
 * @param {'usuario'|'ong'} role esperada na página
 * @returns {Promise<{user, profile}>} resolve apenas se logado e com role certa
 */
window.LF_requireAuth = async function LF_requireAuth(role) {
  const sb = window.LF_SUPABASE;
  const { data: { session } } = await sb.auth.getSession();

  if (!session) {
    // guarda para onde voltar após login (UX de fluxo contínuo)
    sessionStorage.setItem('lf_redirect_after_login', location.href);
    location.href = '../login.html';
    return null;
  }

  let perfil = null;
  if (role === 'ong') {
    const { data } = await sb.from('profiles_ongs').select('*').eq('id', session.user.id).maybeSingle();
    perfil = data;
    if (!perfil) { location.href = '../login.html'; return null; }
  } else {
    const { data } = await sb.from('profiles_usuarios').select('*').eq('id', session.user.id).maybeSingle();
    perfil = data;
    if (!perfil) { location.href = '../login.html'; return null; }
  }

  return { user: session.user, profile: perfil };
};
