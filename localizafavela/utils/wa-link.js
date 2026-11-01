/* =====================================================================
   LocalizaFavela | wa-link.js — Montador de links WhatsApp (wa.me)
   Fluxo: ONG aprova candidato → botão "Chamar no WhatsApp" abre conversa
   com mensagem pré-escrita, humanizada e contextual do projeto.
   Uso: import { linkWhatsApp, mensagemAprovacao } from '../utils/wa-link.js';
   ===================================================================== */

/**
 * Normaliza número BR para o formato internacional do wa.me (55 + DDD + nº).
 * @param {string} numero  com ou sem máscara, com ou sem 55
 */
export function normalizarNumeroWa(numero) {
  let d = String(numero || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('0')) d = d.slice(1);            // remove leading zero (0xx)
  if (d === '55') return null;
  if (!d.startsWith('55') && (d.length === 10 || d.length === 11)) d = '55' + d;
  return d.length >= 12 ? d : null;
}

/**
 * Monta a URL wa.me com texto pré-preenchido.
 * @param {string} numero destino
 * @param {string} mensagem texto (será codificado)
 */
export function linkWhatsApp(numero, mensagem) {
  const n = normalizarNumeroWa(numero);
  if (!n) return null; // sem número válido → caller oferece fallback email
  return `https://wa.me/${n}?text=${encodeURIComponent(mensagem)}`;
}

/** Mensagem-padrão de APROVAÇÃO enviada pela ONG ao candidato. */
export function mensagemAprovacao({ ongNome, projetoTitulo, proximosPassos }) {
  return [
    `Olá! Aqui é da ${ongNome} 🌱`,
    '',
    `Parabéns! Você foi ${'aprovado(a)'} no processo seletivo do projeto "${projetoTitulo}" pelo LocalizaFavela.`,
    '',
    proximosPassos ? `Próximos passos: ${proximosPassos}` : 'Vamos combinar os próximos passos por aqui!',
  ].join('\n');
}

/** Mensagem alternativa quando o usuário precisa escrever do zero. */
export function mensagemContatoGeral({ nome, contexto }) {
  return `Olá${nome ? ', ' + nome : ''}! ${contexto || 'Gostaríamos de falar com você sobre seu cadastro no LocalizaFavela.'}`;
}

/** Link mailto com assunto e corpo prontos (fallback sem WhatsApp). */
export function linkEmail(email, assunto, corpo) {
  if (!email) return null;
  return `mailto:${email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
}
