// Regras de negócio das doações (história zero da Unidade 1).
import * as repo from './repositorio.js';

const CAMPOS_OBRIGATORIOS = ['tipo', 'quantidade', 'unidade', 'validade'];

const vazio = (valor) => valor === undefined || valor === null || String(valor).trim() === '';
const hoje = () => new Date().toISOString().slice(0, 10);

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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(validade) || Number.isNaN(Date.parse(validade))) {
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
  const doacao = await repo.buscarPorId(id);
  if (!doacao) {
    throw new Error('doação não encontrada');
  }

  const aceita = await repo.aceitar(id, ong);
  if (!aceita) {
    throw new Error('doação já foi aceita por outra ONG');
  }
  return aceita;
}
