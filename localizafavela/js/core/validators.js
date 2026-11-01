/* =====================================================================
   LocalizaFavela | validators.js — Validações de negócio (ES6, sem libs)
   CPF com dígitos verificadores • CNPJ com dígitos • Senha forte
   WhatsApp • CEP • Máscaras de digitação
   ===================================================================== */

/** Remove tudo que não for dígito. */
export const soDigitos = (v = '') => String(v).replace(/\D/g, '');

/** CPF: 11 dígitos + algoritmo de dígitos verificadores. */
export function cpfValido(cpf) {
  cpf = soDigitos(cpf);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (const pos of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < pos; i++) soma += Number(cpf[i]) * (pos + 1 - i);
    const dv = (soma % 11 < 2) ? 0 : 11 - (soma % 11);
    if (dv !== Number(cpf[pos])) return false;
  }
  return true;
}

/** CNPJ: 14 dígitos + dois dígitos verificadores (pesos 5..2 / 6..2). */
export function cnpjValido(cnpj) {
  cnpj = soDigitos(cnpj);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calcDV = (baseLen) => {
    let peso = baseLen - 7, soma = 0;
    for (let i = 0; i < baseLen; i++) {
      soma += Number(cnpj[i]) * peso--;
      if (peso < 2) peso = 9;
    }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calcDV(12) === Number(cnpj[12]) && calcDV(13) === Number(cnpj[13]);
}

/** Aceita CPF (11) ou CNPJ (14) — usado no login/cadastro de ONG. */
export function documentoValido(doc) {
  const d = soDigitos(doc);
  return d.length === 11 ? cpfValido(d) : cnpjValido(d);
}

/**
 * Senha forte LocalizaFavela: >=8 chars, maiúscula, minúscula,
 * número e símbolo. Retorna nível 0–4 para o medidor da UI.
 */
export function forcaSenha(senha = '') {
  let nivel = 0;
  if (senha.length >= 8) nivel++;
  if (/[A-Z]/.test(senha) && /[a-z]/.test(senha)) nivel++;
  if (/\d/.test(senha)) nivel++;
  if (/[^A-Za-z0-9]/.test(senha)) nivel++;
  return nivel; // 4 = atende TODAS as regras; submit exige >= 4
}

export function senhaForte(senha) {
  return forcaSenha(senha) === 4;
}

/** WhatsApp BR: 10 (fixo) ou 11 (celular com DDD) dígitos. */
export function whatsappValido(num) {
  const d = soDigitos(num);
  if (d.length !== 10 && d.length !== 11) return false;
  const ddd = Number(d.slice(0, 2));
  return ddd >= 11 && ddd <= 99;
}

/** CEP: 8 dígitos e primeiro não pode ser 0 (prefixos inválidos). */
export function cepValido(cep) {
  return /^\d{8}$/.test(soDigitos(cep));
}

export function emailValido(email = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/* ------------------- MÁSCARAS (aplicar no 'input') ------------------- */
export function mascaraCPF(v) {
  const d = soDigitos(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function mascaraCNPJ(v) {
  const d = soDigitos(v).slice(0, 14);
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

/** Máscara dinâmica: se passar de 11 dígitos assume CNPJ. */
export function mascaraDocumento(v) {
  return soDigitos(v).length > 11 ? mascaraCNPJ(v) : mascaraCPF(v);
}

export function mascaraWhatsapp(v) {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6)  return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}

export function mascaraCEP(v) {
  const d = soDigitos(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0,5)}-${d.slice(5)}` : d;
}

/** Aplica máscara a um input em tempo real. */
export function ligarMascara(inputEl, fnMascara) {
  inputEl.addEventListener('input', () => {
    const pos = inputEl.selectionStart;
    const antes = inputEl.value.length;
    inputEl.value = fnMascara(inputEl.value);
    // tenta preservar o cursor
    const delta = inputEl.value.length - antes;
    inputEl.setSelectionRange(pos + delta, pos + delta);
  });
}
