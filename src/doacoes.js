// Regras de negócio das doações (história zero da Unidade 1).
import * as repo from './repositorio.js';

const CAMPOS_OBRIGATORIOS = ['tipo', 'quantidade', 'unidade', 'validade'];

// Nome gravado quando o pedido de aceite não diz qual ONG está aceitando.
const ONG_PADRAO = 'ONG';

const vazio = (valor) => valor === undefined || valor === null || String(valor).trim() === '';
const hoje = () => new Date().toISOString().slice(0, 10);
// Formato AAAA-MM-DD e dia que existe no calendário (recusa, por exemplo, 2026-02-31).
const dataValida = (valor) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
};

// Busca a doação pelo id; se não existir, recusa (usado no aceite e na coleta).
async function buscarExistente(id) {
  const doacao = await repo.buscarPorId(id);
  if (!doacao) {
    throw new Error('doação não encontrada');
  }
  return doacao;
}

// Nome da ONG obrigatório e sem espaços nas pontas (usado nos relatórios das histórias 4 e 5).
function nomeDaOng(ong) {
  if (vazio(ong)) {
    throw new Error('informe a ONG');
  }
  return String(ong).trim();
}

// Data obrigatória no formato AAAA-MM-DD; o rótulo entra na mensagem de erro.
function dataObrigatoria(valor, rotulo) {
  const data = String(valor ?? '').trim();
  if (!dataValida(data)) {
    throw new Error(`${rotulo} inválido: use o formato AAAA-MM-DD`);
  }
  return data;
}

// "Um doador publica uma doação."
// Regra de negócio 1 (aula 2): tipo, quantidade, unidade e validade preenchidos;
// quantidade inteira maior que zero; validade é uma data que ainda não passou
// (esta última também sustenta a Regra de negócio 2: ver docs/analise.md).
export async function criarDoacao(dados = {}) {
  const faltando = CAMPOS_OBRIGATORIOS.filter((campo) => vazio(dados?.[campo]));
  if (faltando.length > 0) {
    throw new Error(`campos obrigatórios ausentes: ${faltando.join(', ')}`);
  }

  const quantidade = Number(dados.quantidade);
  if (!Number.isInteger(quantidade) || quantidade <= 0) {
    throw new Error('quantidade deve ser um número inteiro maior que zero');
  }

  const validade = String(dados.validade).trim();
  if (!dataValida(validade)) {
    throw new Error('validade inválida: use o formato AAAA-MM-DD');
  }
  if (validade < hoje()) {
    throw new Error('validade já vencida: a data precisa ser hoje ou no futuro');
  }

  return repo.inserir({
    tipo: String(dados.tipo).trim(),
    quantidade,
    unidade: String(dados.unidade).trim(),
    validade,
  });
}

// "Uma ONG vê as doações disponíveis."
export async function listarDisponiveis() {
  return repo.listarDisponiveis();
}

// "Uma ONG aceita uma doação."
// Regra de negócio 3 (aula 2): uma doação aceita não fica disponível para outra ONG.
export async function aceitar(id, ong) {
  await buscarExistente(id);

  // Sem ONG informada, grava o nome padrão. O nome vai sem espaços nas pontas,
  // igual à consulta da história 4.
  const aceita = await repo.aceitar(id, String(ong ?? ONG_PADRAO).trim());
  if (!aceita) {
    throw new Error('doação já foi aceita por outra ONG');
  }
  return aceita;
}

// "O entregador vê as doações aceitas que aguardam retirada."
export async function listarAceitas() {
  return repo.listarAceitas();
}

// "O entregador confirma a retirada da doação no local do doador." (história 3)
// Só uma doação aceita pode ser coletada, e uma única vez.
export async function coletar(id) {
  const doacao = await buscarExistente(id);
  if (doacao.status === 'disponivel') {
    throw new Error('doação ainda não foi aceita por uma ONG');
  }

  const coletada = await repo.coletar(id);
  if (!coletada) {
    throw new Error('doação já foi coletada');
  }
  return coletada;
}

// "O coordenador da ONG vê quantas doações coletou num período." (história 4)
// Conta pela data da coleta, com início e fim inclusivos (ADR 0004).
export async function totalColetadas({ ong, inicio, fim } = {}) {
  const nome = nomeDaOng(ong);
  const desde = dataObrigatoria(inicio, 'início');
  const ate = dataObrigatoria(fim, 'fim');
  if (desde > ate) {
    throw new Error('período inválido: o início é depois do fim');
  }

  const total = await repo.contarColetadas(nome, desde, ate);
  return { ong: nome, inicio: desde, fim: ate, total };
}

// "A vigilância sanitária consulta o que a ONG coletou, para auditar a qualidade." (história 5)
// O sistema não registra baixa (consumo ou distribuição), então "estoque" é o que a ONG
// coletou, e cada item diz se a validade já passou (ADR 0005).
export async function estoqueDaOng({ ong } = {}) {
  const nome = nomeDaOng(ong);
  const limite = hoje();
  const itens = (await repo.listarColetadasDaOng(nome)).map((d) => ({
    id: d.id,
    tipo: d.tipo,
    quantidade: d.quantidade,
    unidade: d.unidade,
    validade: d.validade,
    coletada_em: d.coletada_em,
    vencida: d.validade < limite,
  }));
  return { ong: nome, total: itens.length, itens };
}
