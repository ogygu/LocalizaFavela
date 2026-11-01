/* =====================================================================
   LocalizaFavela | cep-api.js — Autocomplete de endereço via ViaCEP
   Ao digitar 8 dígitos do CEP, preenche estado/cidade/bairro
   (reduz fricção no cadastro — decisão de UX social).
   ===================================================================== */

const UF_NOME_PARA_SIGLA = {
  'ACRE':'AC','ALAGOAS':'AL','AMAPÁ':'AP','AMAZONAS':'AM','BAHIA':'BA',
  'CEARÁ':'CE','DISTRITO FEDERAL':'DF','ESPÍRITO SANTO':'ES','GOIÁS':'GO',
  'MARANHÃO':'MA','MATO GROSSO':'MT','MATO GROSSO DO SUL':'MS','MINAS GERAIS':'MG',
  'PARÁ':'PA','PARAÍBA':'PB','PARANÁ':'PR','PERNAMBUCO':'PE','PIAUÍ':'PI',
  'RIO DE JANEIRO':'RJ','RIO GRANDE DO NORTE':'RN','RIO GRANDE DO SUL':'RS',
  'RONDÔNIA':'RO','RORAIMA':'RR','SANTA CATARINA':'SC','SÃO PAULO':'SP',
  'SERGIPE':'SE','TOCANTINS':'TO'
};

/** Busca endereço completo. Retorna {cep, logradouro, cidade, bairro, estado} ou lança. */
export async function buscarCep(cep) {
  const limpo = String(cep).replace(/\D/g, '');
  if (limpo.length !== 8) throw new Error('CEP incompleto.');

  const resp = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
  if (!resp.ok) throw new Error('Não foi possível consultar o CEP agora.');
  const dados = await resp.json();
  if (dados.erro) throw new Error('CEP não encontrado. Confira os números.');

  return {
    cep: limpo,
    logradouro: dados.logradouro || '',
    cidade: dados.localidade || '',
    bairro: dados.bairro || '',
    estado: UF_NOME_PARA_SIGLA[(dados.uf || '').toUpperCase()] || dados.uf || '',
  };
}

/**
 * Liga o input de CEP a callbacks de preenchimento.
 * @param {HTMLInputElement} inputCEP
 * @param {(endereco) => void} onOk  recebe o endereço normalizado
 * @param {(msg) => void}    onErr   exibe feedback amigável
 */
export function ligarAutocompleteCep(inputCEP, onOk, onErr) {
  let timer;
  inputCEP.addEventListener('input', () => {
    clearTimeout(timer);
    const digitos = inputCEP.value.replace(/\D/g, '');
    if (digitos.length === 8) {
      timer = setTimeout(() => buscarCep(digitos).then(onOk).catch((e) => onErr(e.message)), 350);
    }
  });
}
