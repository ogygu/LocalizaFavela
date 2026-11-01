/* =====================================================================
   LocalizaFavela | cadastro.js — Dois fluxos de cadastro (Usuário | ONG)
   - Segmented control acessível + deep link ?tipo=ong
   - Máscaras em tempo real (CPF/CNPJ/WhatsApp/CEP)
   - Autocomplete de endereço via ViaCEP (menos fricção = inclusão)
   - Medidor de força de senha (forcaSenha 0–4)
   - Valida TUDO no cliente antes de chamar o Supabase (defesa + UX)
   ===================================================================== */

import {
  mascaraCPF, mascaraDocumento, mascaraWhatsapp, mascaraCEP, ligarMascara,
  cpfValido, documentoValido, whatsappValido, cepValido, emailValido,
  forcaSenha, senhaForte, soDigitos,
} from '../core/validators.js';
import { cadastrarUsuario, cadastrarONG } from '../core/auth.js';
import { ligarAutocompleteCep } from '../core/cep-api.js';
import { toast } from '../ui/toast.js';

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

/* ---------- POPULA SELECTS DE ESTADO ---------- */
for (const selId of ['u_estado', 'o_estado']) {
  const sel = document.getElementById(selId);
  sel.innerHTML = '<option value="" disabled selected>UF</option>' +
    UFS.map(uf => `<option value="${uf}">${uf}</option>`).join('');
}

/* ---------- TOGGLE USUÁRIO / ONG ---------- */
let tipo = 'usuario';
const tabUsuario = document.getElementById('tabUsuario');
const tabOng     = document.getElementById('tabOng');
const formUsuario = document.getElementById('formUsuario');
const formOng     = document.getElementById('formOng');

function definirTipo(novo) {
  tipo = novo;
  tabUsuario.setAttribute('aria-pressed', String(tipo === 'usuario'));
  tabOng.setAttribute('aria-pressed', String(tipo === 'ong'));
  formUsuario.hidden = tipo !== 'usuario';
  formOng.hidden = tipo !== 'ong';
  esconderFeedback();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
tabUsuario.addEventListener('click', () => definirTipo('usuario'));
tabOng.addEventListener('click', () => definirTipo('ong'));
if (new URLSearchParams(location.search).get('tipo') === 'ong') definirTipo('ong');

/* ---------- FEEDBACK ---------- */
const elErro = document.getElementById('cadErro');
const elOk   = document.getElementById('cadOk');
function mostrarErro(msg) { elOk.classList.remove('is-visible'); elErro.textContent = msg; elErro.classList.add('is-visible'); elErro.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
function mostrarOk(msg)   { elErro.classList.remove('is-visible'); elOk.textContent = msg; elOk.classList.add('is-visible'); elOk.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
function esconderFeedback() { elErro.classList.remove('is-visible'); elOk.classList.remove('is-visible'); }

/* ---------- MÁSCARAS ---------- */
ligarMascara(document.getElementById('u_whatsapp'), mascaraWhatsapp);
ligarMascara(document.getElementById('u_cpf'), mascaraCPF);
ligarMascara(document.getElementById('u_cep'), mascaraCEP);
ligarMascara(document.getElementById('o_telefone'), mascaraWhatsapp);
ligarMascara(document.getElementById('o_documento'), mascaraDocumento);
ligarMascara(document.getElementById('o_cep'), mascaraCEP);

/* ---------- MOSTRAR/OCULTAR SENHAS ---------- */
document.querySelectorAll('.senha-toggle').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.alvo);
    const visivel = input.type === 'text';
    input.type = visivel ? 'password' : 'text';
    btn.textContent = visivel ? 'mostrar' : 'ocultar';
    btn.setAttribute('aria-label', visivel ? 'Mostrar senha' : 'Ocultar senha');
  });
});

/* ---------- MEDIDOR DE FORÇA DE SENHA ---------- */
function ligarMedidor(inputId, meterId) {
  const input = document.getElementById(inputId);
  const meter = document.getElementById(meterId);
  input.addEventListener('input', () => {
    const nivel = forcaSenha(input.value);
    meter.className = `pw-meter lv${nivel}`;
  });
}
ligarMedidor('u_senha', 'u_pwMeter');
ligarMedidor('o_senha', 'o_pwMeter');

/* ---------- AUTOCOMPLETE CEP → estado/cidade/bairro ---------- */
function preencheEndereco(prefixo) {
  return (end) => {
    if (prefixo === 'u') {
      document.getElementById('u_estado').value = end.estado;
      document.getElementById('u_cidade').value = end.cidade;
      if (!document.getElementById('u_bairro').value) document.getElementById('u_bairro').value = end.bairro;
    } else {
      document.getElementById('o_estado').value = end.estado;
      document.getElementById('o_cidade').value = end.cidade;
      if (!document.getElementById('o_bairro').value) document.getElementById('o_bairro').value = end.bairro;
    }
    const status = document.getElementById(`${prefixo}_cepStatus`);
    status.textContent = end.logradouro ? `✓ ${end.logradouro}, ${end.bairro}` : '✓ Endereço localizado';
    status.style.color = 'var(--c-verde-700)';
  };
}
function erroCep(prefixo) {
  return (msg) => {
    const status = document.getElementById(`${prefixo}_cepStatus`);
    status.textContent = msg;
    status.style.color = 'var(--c-status-rejeitado-fg)';
  };
}
ligarAutocompleteCep(document.getElementById('u_cep'), preencheEndereco('u'), erroCep('u'));
ligarAutocompleteCep(document.getElementById('o_cep'), preencheEndereco('o'), erroCep('o'));

/* ---------- HELPERS DE VALIDAÇÃO NA UI ---------- */
function marcarErro(inputId, temErro) {
  const field = document.getElementById(inputId).closest('.field');
  field.classList.toggle('has-error', temErro);
  return !temErro;
}

/* =====================================================
   SUBMIT — USUÁRIO COMUM
   ===================================================== */
formUsuario.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  esconderFeedback();

  const dados = {
    nome: document.getElementById('u_nome').value,
    whatsapp: document.getElementById('u_whatsapp').value,
    cpf: document.getElementById('u_cpf').value,
    email: document.getElementById('u_email').value,
    redeSocial: document.getElementById('u_rede').value,
    cep: document.getElementById('u_cep').value,
    estado: document.getElementById('u_estado').value,
    cidade: document.getElementById('u_cidade').value,
    bairro: document.getElementById('u_bairro').value,
    senha: document.getElementById('u_senha').value,
  };

  let ok = true;
  ok &= marcarErro('u_nome', !dados.nome.trim() || dados.nome.trim().split(/\s+/).length < 2);
  ok &= marcarErro('u_whatsapp', !whatsappValido(dados.whatsapp));
  ok &= marcarErro('u_cpf', !cpfValido(dados.cpf));
  ok &= marcarErro('u_email', !emailValido(dados.email));
  ok &= marcarErro('u_cep', !cepValido(dados.cep));
  ok &= marcarErro('u_estado', !dados.estado);
  ok &= marcarErro('u_cidade', !dados.cidade.trim());
  ok &= marcarErro('u_bairro', !dados.bairro.trim());
  ok &= marcarErro('u_senha', !senhaForte(dados.senha));
  if (!ok) { mostrarErro('Revise os campos destacados em vermelho.'); return; }

  const btn = document.getElementById('btnCadUsuario');
  btn.classList.add('is-loading');
  try {
    await cadastrarUsuario({ ...dados, cpf: soDigitos(dados.cpf), cep: soDigitos(dados.cep), whatsapp: soDigitos(dados.whatsapp) });
    mostrarOk('🌱 Conta criada! Enviamos uma confirmação para seu e-mail. Depois dela, faça login com seu CPF.');
    toast('Cadastro realizado com sucesso!', 'ok');
    formUsuario.reset();
    setTimeout(() => { location.href = 'login.html'; }, 5200);
  } catch (err) {
    mostrarErro(err.message);
  } finally {
    btn.classList.remove('is-loading');
  }
});

/* =====================================================
   SUBMIT — ONG / PROJETO SOCIAL
   ===================================================== */
formOng.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  esconderFeedback();

  const dados = {
    nomeOng: document.getElementById('o_nome').value,
    telefone: document.getElementById('o_telefone').value,
    documento: document.getElementById('o_documento').value,
    email: document.getElementById('o_email').value,
    redeSocial: document.getElementById('o_rede').value,
    cep: document.getElementById('o_cep').value,
    estado: document.getElementById('o_estado').value,
    cidade: document.getElementById('o_cidade').value,
    bairro: document.getElementById('o_bairro').value,
    finalidade: document.getElementById('o_finalidade').value,
    publicoAlvo: document.getElementById('o_publico').value,
    senha: document.getElementById('o_senha').value,
  };

  let ok = true;
  ok &= marcarErro('o_nome', dados.nomeOng.trim().length < 3);
  ok &= marcarErro('o_telefone', !whatsappValido(dados.telefone));
  ok &= marcarErro('o_documento', !documentoValido(dados.documento));
  ok &= marcarErro('o_email', !emailValido(dados.email));
  ok &= marcarErro('o_cep', !cepValido(dados.cep));
  ok &= marcarErro('o_estado', !dados.estado);
  ok &= marcarErro('o_cidade', !dados.cidade.trim());
  ok &= marcarErro('o_bairro', !dados.bairro.trim());
  ok &= marcarErro('o_finalidade', dados.finalidade.trim().length < 20);
  ok &= marcarErro('o_senha', !senhaForte(dados.senha));
  if (!ok) { mostrarErro('Revise os campos destacados em vermelho.'); return; }

  const btn = document.getElementById('btnCadOng');
  btn.classList.add('is-loading');
  try {
    await cadastrarONG({ ...dados, documento: soDigitos(dados.documento), cep: soDigitos(dados.cep), telefone: soDigitos(dados.telefone) });
    mostrarOk('✅ ONG cadastrada! Confirme o e-mail institucional e depois entre com o CPF/CNPJ.');
    toast('Bem-vinda, comunidade! 🏡', 'ok');
    formOng.reset();
    setTimeout(() => { location.href = 'login.html?tipo=ong'; }, 5200);
  } catch (err) {
    mostrarErro(err.message);
  } finally {
    btn.classList.remove('is-loading');
  }
});
