// Camada de dados do Prato Cheio — acesso ao banco.
// A conexão e o schema já estão prontos em src/db.js.
//
// Marcador de parâmetro é `?` (SQL parametrizado evita injeção):
//   const { rows } = await query('SELECT * FROM doacoes WHERE id = ?', [id]);
import { query } from './db.js';
import { STATUS } from './status.js';

// Insere a doação e devolve a linha criada (com id, status e criada_em).
export async function inserir({ tipo, quantidade, unidade, validade }) {
  const { rows } = await query(
    `INSERT INTO doacoes (tipo, quantidade, unidade, validade)
     VALUES (?, ?, ?, ?)
     RETURNING *`,
    [tipo, quantidade, unidade, validade],
  );
  return rows[0];
}

// Devolve apenas as doações disponíveis e ainda não vencidas,
// mais urgentes primeiro (validade crescente). Regra de negócio 2 (aula 2).
export async function listarDisponiveis() {
  const { rows } = await query(
    `SELECT * FROM doacoes
     WHERE status = ?
       AND validade >= date('now')
     ORDER BY validade ASC, id ASC`,
    [STATUS.DISPONIVEL],
  );
  return rows;
}

// Busca uma doação pelo id (undefined se não existir).
export async function buscarPorId(id) {
  const { rows } = await query('SELECT * FROM doacoes WHERE id = ?', [id]);
  return rows[0];
}

// Marca a doação como aceita pela ONG e devolve a linha atualizada.
// O `AND status = disponível` é a trava contra aceite duplo: só a primeira ONG
// casa com a condição; para a segunda o UPDATE não afeta nenhuma linha e o
// RETURNING volta vazio.
export async function aceitar(id, ong) {
  const { rows } = await query(
    `UPDATE doacoes
     SET status = ?, ong = ?, aceita_em = datetime('now')
     WHERE id = ? AND status = ?
     RETURNING *`,
    [STATUS.ACEITA, ong, id, STATUS.DISPONIVEL],
  );
  return rows[0];
}

// Doações aceitas aguardando retirada pelo entregador, mais urgentes primeiro.
export async function listarAceitas() {
  const { rows } = await query(
    `SELECT * FROM doacoes
     WHERE status = ?
     ORDER BY validade ASC, id ASC`,
    [STATUS.ACEITA],
  );
  return rows;
}

// Marca a doação como coletada e devolve a linha atualizada.
// Mesma trava do aceite: o `AND status = aceita` impede coletar uma doação
// que ainda não foi aceita ou confirmar duas vezes a mesma retirada.
export async function coletar(id) {
  const { rows } = await query(
    `UPDATE doacoes
     SET status = ?, coletada_em = datetime('now')
     WHERE id = ? AND status = ?
     RETURNING *`,
    [STATUS.COLETADA, id, STATUS.ACEITA],
  );
  return rows[0];
}

// Quantas doações a ONG coletou entre as datas `inicio` e `fim` (AAAA-MM-DD),
// contando os dois dias. Só entra o que foi de fato retirado (status 'coletada'),
// pela data da coleta. História 4 / ADR 0004.
// Limitação: coletada_em está em UTC, então o dia comparado é o dia em UTC
// (coleta depois das 21h no Brasil conta no dia seguinte). Ver ADR 0004.
export async function contarColetadas(ong, inicio, fim) {
  const { rows } = await query(
    `SELECT COUNT(*) AS total FROM doacoes
     WHERE status = ?
       AND ong = ?
       AND date(coletada_em) BETWEEN ? AND ?`,
    [STATUS.COLETADA, ong, inicio, fim],
  );
  // Number(): no PostgreSQL o COUNT(*) volta como bigint, que o driver entrega como texto.
  return Number(rows[0].total);
}

// Doações que a ONG coletou, da validade mais próxima para a mais distante.
// Não filtra por validade: a vigilância precisa ver também o que já venceu.
// História 5 / ADR 0005.
export async function listarColetadasDaOng(ong) {
  const { rows } = await query(
    `SELECT * FROM doacoes
     WHERE status = ?
       AND ong = ?
     ORDER BY validade ASC, id ASC`,
    [STATUS.COLETADA, ong],
  );
  return rows;
}
