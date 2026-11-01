/* =====================================================================
   LocalizaFavela | auth.js — Fluxos de autenticação (Supabase Auth)
   Regras de negócio:
   - Usuário comum: cadastro por EMAIL (login técnico), mas a sessão é
     identificada pelo CPF no perfil (exigência do PIE).
   - Login "por documento": como o Supabase Auth autentica por email,
     resolvemos documento → email via RPC segura (fn_resolve_login),
     criada no 02_Supabase_Database.sql (versão estendida na Fase 4).
     Fallback: o usuário também pode digitar o próprio email.
   ===================================================================== */

import { cpfValido, documentoValido, senhaForte, whatsappValido, cepValido, emailValido, soDigitos } from './validators.js';

const sb = window.LF_SUPABASE;

/** Cadastro de USUÁRIO COMUM. payload vem do formulário da página. */
export async function cadastrarUsuario({ nome, whatsapp, cpf, email, redeSocial, cep, estado, cidade, bairro, senha }) {
  if (!nome || nome.trim().split(/\s+/).length < 2) throw new Error('Informe seu nome completo.');
  if (!whatsappValido(whatsapp)) throw new Error('WhatsApp inválido. Use DDD + número.');
  if (!cpfValido(cpf)) throw new Error('CPF inválido (verifique os dígitos).');
  if (!emailValido(email)) throw new Error('E-mail inválido.');
  if (!cepValido(cep)) throw new Error('CEP inválido.');
  if (!senhaForte(senha)) throw new Error('Senha fraca: use 8+ caracteres, maiúscula, minúscula, número e símbolo.');

  const { error } = await sb.auth.signUp({
    email: email.trim().toLowerCase(),
    password: senha,
    options: {
      data: {
        account_type: 'usuario',           // lido pelo trigger fn_criar_perfil_na_signup
        nome_completo: nome.trim(),
        whatsapp: soDigitos(whatsapp),
        cpf: soDigitos(cpf),
        rede_social: redeSocial?.trim() || null,
        cep: soDigitos(cep),
        estado: estado.toUpperCase(),
        cidade: cidade.trim(),
        bairro: bairro.trim(),
      },
    },
  });
  if (error) throw new Error(traduzErroAuth(error));
  return true;
}

/** Cadastro de ONG. documento = CPF ou CNPJ. */
export async function cadastrarONG({ nomeOng, telefone, redeSocial, documento, cep, estado, cidade, bairro, finalidade, publicoAlvo, senha }) {
  if (!nomeOng || nomeOng.trim().length < 3) throw new Error('Informe o nome da ONG.');
  if (!whatsappValido(telefone)) throw new Error('Telefone inválido.');
  if (!documentoValido(documento)) throw new Error('CPF/CNPJ inválido.');
  if (!cepValido(cep)) throw new Error('CEP inválido.');
  if (!finalidade || finalidade.trim().length < 20) throw new Error('Descreva a finalidade da ONG (mín. 20 caracteres).');
  if (!senhaForte(senha)) throw new Error('Senha fraca: use 8+ caracteres, maiúscula, minúscula, número e símbolo.');

  // ONG também precisa de um email técnico para o Supabase Auth.
  // Estratégia PIE: email gerado a partir do documento + domínio gerenciado,
  // OU campo extra de email coletado no formulário. Aqui usamos campo opcional.
  const emailOng = gerarEmailTecnicoONG(documento);

  const { error } = await sb.auth.signUp({
    email: emailOng,
    password: senha,
    options: {
      data: {
        account_type: 'ong',
        nome_ong: nomeOng.trim(),
        telefone: soDigitos(telefone),
        rede_social: redeSocial?.trim() || null,
        documento: soDigitos(documento),
        cep: soDigitos(cep),
        estado: estado.toUpperCase(),
        cidade: cidade.trim(),
        bairro: bairro.trim(),
        finalidade: finalidade.trim(),
        publico_alvo: publicoAlvo?.trim() || null,
      },
    },
  });
  if (error) throw new Error(traduzErroAuth(error));
  return true;
}

function gerarEmailTecnicoONG(documento) {
  const d = soDigitos(documento);
  const dom = d.length === 14 ? 'ongs.localizafavela.app' : 'ongpf.localizafavela.app';
  return `ong.${d}@${dom}`; // único por documento; domínio verificado no Supabase
}

/**
 * LOGIN por documento + senha.
 * 1) Tenta resolver documento → email via RPC (requer view/função da Fase 4).
 * 2) Se a RPC ainda não existir, aceita email diretamente.
 */
export async function entrar({ documento, senha, tipo }) {
  const identificador = documento.trim().toLowerCase();
  let email = identificador;

  if (!identificador.includes('@')) {
    const d = soDigitos(identificador);
    if (tipo === 'usuario' && !cpfValido(d)) throw new Error('CPF inválido.');
    if (tipo === 'ong' && !documentoValido(d)) throw new Error('CPF/CNPJ inválido.');
    try {
      const { data, error: rpcErr } = await sb.rpc('fn_resolve_login', { p_documento: d });
      if (!rpcErr && data) email = data;
      else email = tipo === 'ong' ? gerarEmailTecnicoONG(d) : d; // fallback heurístico
    } catch {
      email = tipo === 'ong' ? gerarEmailTecnicoONG(d) : d;
    }
  }

  const { error } = await sb.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(traduzErroAuth(error));

  // checagem de role contra o perfil (defesa em profundidade)
  const { data: { user } } = await sb.auth.getUser();
  const tabela = tipo === 'ong' ? 'profiles_ongs' : 'profiles_usuarios';
  const { data: perfil } = await sb.from(tabela).select('id').eq('id', user.id).maybeSingle();
  if (!perfil) {
    await sb.auth.signOut();
    throw new Error(`Esta conta não é de ${tipo === 'ong' ? 'ONG' : 'usuário'}. Use o fluxo correto.`);
  }
  return perfilDestino(tipo);
}

function perfilDestino(tipo) {
  return tipo === 'ong' ? 'ong/dashboard.html' : 'usuario/dashboard.html';
}

export async function sair() {
  await sb.auth.signOut();
  location.href = 'index.html';
}

export async function sessaoAtual() {
  const { data: { session } } = await sb.auth.getSession();
  return session;
}

function traduzErroAuth(error) {
  const msg = (error.message || '').toLowerCase();
  if (msg.includes('already registered') || msg.includes('already exists')) return 'Este cadastro já existe. Tente entrar.';
  if (msg.includes('invalid login credentials')) return 'Documento/e-mail ou senha incorretos.';
  if (msg.includes('confirm')) return 'Confirme seu e-mail antes de entrar (checar caixa de entrada).';
  if (msg.includes('password')) return 'Senha fora dos requisitos de segurança.';
  return error.message || 'Falha na autenticação. Tente novamente.';
}
