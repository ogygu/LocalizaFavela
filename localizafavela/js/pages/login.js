/* =====================================================================
   LocalizaFavela | login.js — Página de login (toggle Usuário | ONG)
   Regras: Usuário entra com CPF; ONG entra com CPF/CNPJ. Ambos aceitam
   e-mail como identificador alternativo.
   ===================================================================== */

import { entrar } from '../core/auth.js';
import { mascaraDocumento, soDigitos, cpfValido, documentoValido } from '../core/validators.js';
import { toast } from '../ui/toast.js';

let tipo = 'usuario'; // estado do segmented control

const tabUsuario = document.getElementById('tabUsuario');
const tabOng     = document.getElementById('TabOng');
const labelDoc   = document.getElementById('labelDocumento');
const inputDoc   = document.getElementById('documento');
const form       = document.getElementById('formLogin');
const feedback   = document.getElementById('loginErro');
const btnEntrar  = document.getElementById('btnEntrar');

function definirTipo(novoTipo) {
  tipo = novoTipo;
  tabUsuario.setAttribute('aria-pressed', String(tipo === 'usuario'));
  tabOng.setAttribute('aria-pressed', String(tipo === 'ong'));
  labelDoc.textContent = tipo === 'usuario' ? 'CPF' : 'CPF ou CNPJ da ONG';
  inputDoc.placeholder = tipo === 'usuario' ? '000.000.000-00' : '00.000.000/0000-00';
  inputDoc.value = '';
  esconderErro();
}

tabUsuario.addEventListener('click', () => definirTipo('usuario'));
tabOng.addEventListener('click', () => definirTipo('ong'));

// máscara dinâmica CPF↔CNPJ durante a digitação
inputDoc.addEventListener('input', () => {
  const posicao = inputDoc.selectionStart;
  inputDoc.value = mascaraDocumento(inputDoc.value);
  inputDoc.setSelectionRange(posicao, posicao);
});

// mostrar/ocultar senha
const verSenha = document.getElementById('verSenha');
const inputSenha = document.getElementById('senha');
verSenha.addEventListener('click', () => {
  const visivel = inputSenha.type === 'text';
  inputSenha.type = visivel ? 'password' : 'text';
  verSenha.textContent = visivel ? 'mostrar' : 'ocultar';
  verSenha.setAttribute('aria-label', visivel ? 'Mostrar senha' : 'Ocultar senha');
});

function mostrarErro(msg) {
  feedback.textContent = msg;
  feedback.classList.add('is-visible');
}
function esconderErro() { feedback.classList.remove('is-visible'); }

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  esconderErro();

  const doc = inputDoc.value.trim();
  const senha = inputSenha.value;

  // validação local antes de chamar o Supabase
  if (!doc.includes('@')) {
    const d = soDigitos(doc);
    const ok = tipo === 'usuario' ? cpfValido(d) : documentoValido(d);
    if (!ok) {
      inputDoc.closest('.field').classList.add('has-error');
      mostrarErro(tipo === 'usuario' ? 'Digite um CPF válido.' : 'Digite um CPF ou CNPJ válido.');
      return;
    }
  }
  if (!senha) {
    inputSenha.closest('.field').classList.add('has-error');
    return;
  }

  btnEntrar.classList.add('is-loading');
  try {
    const destino = await entrar({ documento: doc, senha, tipo });
    toast(`Bem-vindo(a) de volta! 🌱`, 'ok', 1800);

    // retoma página que originou o login (guard de auth), senão o dashboard
    const salvo = sessionStorage.getItem('lf_redirect_after_login');
    sessionStorage.removeItem('lf_redirect_after_login');
    setTimeout(() => { location.href = salvo || destino; }, 600);
  } catch (err) {
    mostrarErro(err.message);
  } finally {
    btnEntrar.classList.remove('is-loading');
  }
});

// deep link: /login.html?tipo=ong
const params = new URLSearchParams(location.search);
if (params.get('tipo') === 'ong') definirTipo('ong');
