import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { criarApp } from '../src/app.js';
import { migrar, limparBanco, encerrar, query } from '../src/db.js';
import * as repo from '../src/repositorio.js';

const app = criarApp();

// Datas relativas ao dia da execução, para o teste não ficar frágil com o tempo.
const emDias = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const validadeFutura = emDias(7);
const validadePassada = emDias(-1);

// Payload padrão de uma publicação válida; sobrescreva os campos que o teste precisa.
const doacaoValida = (extra = {}) => ({
  tipo: 'Sopa',
  quantidade: 10,
  unidade: 'porções',
  validade: validadeFutura,
  ...extra,
});

// Este teste já passa e não depende do banco:
// prova que a aplicação sobe e que o CI está funcionando.
describe('a aplicação sobe', () => {
  it('responde na verificação de saúde', async () => {
    const res = await request(app).get('/api/saude');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Walking skeleton: história zero ponta a ponta:
// um doador publica uma doação -> uma ONG vê a doação -> a ONG a aceita e ela
// some da lista para as demais.
// Banco: SQLite em memória (vitest.config.js): nada a instalar, nada a subir.
// ---------------------------------------------------------------------------
describe('publicar e listar doações', () => {
  beforeEach(async () => {
    await migrar();
    await limparBanco();
  });
  afterAll(async () => {
    await encerrar();
  });

  // CA 1.1: publicação válida aparece para as ONGs
  // CA 1.3: a doação registra o mínimo para rastreabilidade
  it('mostra a doação publicada na lista de disponíveis', async () => {
    const criada = await request(app).post('/api/doacoes').send(doacaoValida());
    expect(criada.status).toBe(201);

    const res = await request(app).get('/api/doacoes');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);

    const [d] = res.body;
    expect(d.tipo).toBe('Sopa');
    expect(d.quantidade).toBe(10);
    expect(d.unidade).toBe('porções');
    expect(d.validade).toBe(validadeFutura);
    expect(d.status).toBe('disponivel');
    expect(d.criada_em).toBeTruthy(); // CA 1.3: data/hora de criação registrada
  });

  // CA 1.2: publicação sem dado obrigatório é recusada
  it('recusa doação sem os campos obrigatórios', async () => {
    const res = await request(app).post('/api/doacoes').send({ tipo: 'Pão' }); // sem quantidade, unidade e validade

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/obrigat/i);

    const lista = await request(app).get('/api/doacoes');
    expect(lista.body).toHaveLength(0); // nada é gravado
  });

  // RN1: quantidade tem de ser maior que zero
  it('recusa doação com quantidade zero ou negativa', async () => {
    const zero = await request(app)
      .post('/api/doacoes')
      .send(doacaoValida({ quantidade: 0 }));
    expect(zero.status).toBe(400);
    expect(zero.body.erro).toMatch(/quantidade/i);

    const negativa = await request(app)
      .post('/api/doacoes')
      .send(doacaoValida({ quantidade: -3 }));
    expect(negativa.status).toBe(400);

    const lista = await request(app).get('/api/doacoes');
    expect(lista.body).toHaveLength(0);
  });

  // RN1 / RN2: validade já vencida é recusada na publicação
  it('recusa doação com validade já vencida', async () => {
    const res = await request(app)
      .post('/api/doacoes')
      .send(doacaoValida({ validade: validadePassada }));

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/validade/i);

    const lista = await request(app).get('/api/doacoes');
    expect(lista.body).toHaveLength(0);
  });

  // RN2: só aparece na lista o que ainda não venceu
  it('não mostra na lista doação cuja validade já passou', async () => {
    // Inserida direto pelo repositório: simula uma doação publicada ontem que venceu hoje.
    await repo.inserir({ tipo: 'Leite', quantidade: 2, unidade: 'litros', validade: validadePassada });
    await repo.inserir({ tipo: 'Arroz', quantidade: 5, unidade: 'kg', validade: validadeFutura });

    const lista = await request(app).get('/api/doacoes');
    expect(lista.body).toHaveLength(1);
    expect(lista.body[0].tipo).toBe('Arroz');
  });

  // CA 2.3: a lista vem ordenada da validade mais próxima para a mais distante
  it('lista as doações da validade mais próxima para a mais distante', async () => {
    await request(app)
      .post('/api/doacoes')
      .send(doacaoValida({ tipo: 'Longe', validade: emDias(9) }));
    await request(app)
      .post('/api/doacoes')
      .send(doacaoValida({ tipo: 'Perto', validade: emDias(2) }));
    await request(app)
      .post('/api/doacoes')
      .send(doacaoValida({ tipo: 'Médio', validade: emDias(5) }));

    const res = await request(app).get('/api/doacoes');
    expect(res.body.map((d) => d.tipo)).toEqual(['Perto', 'Médio', 'Longe']);
  });
});

describe('aceitar uma doação', () => {
  beforeEach(async () => {
    await migrar();
    await limparBanco();
  });
  afterAll(async () => {
    await encerrar();
  });

  async function publicar(dados) {
    const { body } = await request(app)
      .post('/api/doacoes')
      .send(doacaoValida({ tipo: 'Frutas', quantidade: 3, unidade: 'caixas', ...dados }));
    return body;
  }

  // CA 2.1: aceite de doação disponível
  it('marca a doação como aceita pela ONG', async () => {
    const doacao = await publicar();

    const res = await request(app).post(`/api/doacoes/${doacao.id}/aceitar`).send({ ong: 'Casa da Sopa' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('aceita');
    expect(res.body.ong).toBe('Casa da Sopa');
    expect(res.body.aceita_em).toBeTruthy(); // data/hora do aceite (história 4 e experimento)
  });

  // CA 2.1: a doação aceita sai da lista pública
  it('remove a doação da lista de disponíveis depois de aceita', async () => {
    const doacao = await publicar();
    await request(app).post(`/api/doacoes/${doacao.id}/aceitar`).send({ ong: 'ONG A' });

    const lista = await request(app).get('/api/doacoes');
    expect(lista.body).toHaveLength(0);
  });

  // CA 2.2: não é possível aceitar duas vezes
  it('recusa aceitar uma doação que já foi aceita por outra ONG', async () => {
    const doacao = await publicar();

    const primeira = await request(app).post(`/api/doacoes/${doacao.id}/aceitar`).send({ ong: 'ONG A' });
    expect(primeira.status).toBe(200);

    const segunda = await request(app).post(`/api/doacoes/${doacao.id}/aceitar`).send({ ong: 'ONG B' });
    expect(segunda.status).toBe(400);
    expect(segunda.body.erro).toMatch(/já foi aceita/i);
  });

  // Caminho de erro: aceitar uma doação que não existe
  it('recusa aceitar uma doação inexistente', async () => {
    const res = await request(app).post('/api/doacoes/999999/aceitar').send({ ong: 'ONG A' });

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/não encontrada/i);
  });

  // Caminho de erro: aceitar sem informar qual ONG está aceitando
  it('usa "ONG" como valor padrão quando o corpo não informa a ong', async () => {
    const doacao = await publicar();

    const res = await request(app).post(`/api/doacoes/${doacao.id}/aceitar`).send({});

    expect(res.status).toBe(200);
    expect(res.body.ong).toBe('ONG');
  });
});

// ---------------------------------------------------------------------------
// História 3: o entregador confirma a retirada de uma doação aceita pela ONG.
// ---------------------------------------------------------------------------
describe('confirmar a retirada de uma doação', () => {
  beforeEach(async () => {
    await migrar();
    await limparBanco();
  });
  afterAll(async () => {
    await encerrar();
  });

  async function publicarEAceitar() {
    const { body: doacao } = await request(app).post('/api/doacoes').send(doacaoValida());
    await request(app).post(`/api/doacoes/${doacao.id}/aceitar`).send({ ong: 'Casa da Sopa' });
    return doacao;
  }

  // CA 3.1: retirada de doação aceita
  it('marca a doação aceita como coletada e registra a data/hora da coleta', async () => {
    const doacao = await publicarEAceitar();

    const res = await request(app).post(`/api/doacoes/${doacao.id}/coletar`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('coletada');
    expect(res.body.ong).toBe('Casa da Sopa');
    expect(res.body.coletada_em).toBeTruthy();
  });

  // CA 3.1: a doação coletada sai das pendentes de retirada
  it('lista as aceitas pendentes de retirada e remove a doação depois de coletada', async () => {
    const doacao = await publicarEAceitar();

    const antes = await request(app).get('/api/doacoes/aceitas');
    expect(antes.status).toBe(200);
    expect(antes.body.map((d) => d.id)).toEqual([doacao.id]);

    await request(app).post(`/api/doacoes/${doacao.id}/coletar`);

    const depois = await request(app).get('/api/doacoes/aceitas');
    expect(depois.body).toHaveLength(0);
  });

  // CA 3.2: não é possível coletar uma doação que nenhuma ONG aceitou
  it('recusa confirmar a retirada de uma doação ainda disponível', async () => {
    const { body: doacao } = await request(app).post('/api/doacoes').send(doacaoValida());

    const res = await request(app).post(`/api/doacoes/${doacao.id}/coletar`);

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/ainda não foi aceita/i);

    const lista = await request(app).get('/api/doacoes');
    expect(lista.body.map((d) => d.id)).toEqual([doacao.id]); // continua disponível
  });

  // CA 3.3: não é possível confirmar a mesma retirada duas vezes
  it('recusa confirmar duas vezes e mantém a data/hora da primeira coleta', async () => {
    const doacao = await publicarEAceitar();

    const primeira = await request(app).post(`/api/doacoes/${doacao.id}/coletar`);
    expect(primeira.status).toBe(200);

    const segunda = await request(app).post(`/api/doacoes/${doacao.id}/coletar`);
    expect(segunda.status).toBe(400);
    expect(segunda.body.erro).toMatch(/já foi coletada/i);

    const gravada = await repo.buscarPorId(doacao.id);
    expect(gravada.coletada_em).toBe(primeira.body.coletada_em);
  });

  // Jornada completa: publicar -> aceitar -> confirmar retirada, conferindo as
  // duas listas que a interface mostra a cada etapa.
  it('acompanha a doação da publicação até a retirada nas duas listas', async () => {
    const ids = async (rota) => (await request(app).get(rota)).body.map((d) => d.id);

    const { body: doacao } = await request(app).post('/api/doacoes').send(doacaoValida());
    expect(await ids('/api/doacoes')).toEqual([doacao.id]);
    expect(await ids('/api/doacoes/aceitas')).toEqual([]);

    const aceita = await request(app).post(`/api/doacoes/${doacao.id}/aceitar`).send({ ong: 'Casa da Sopa' });
    expect(aceita.body.status).toBe('aceita');
    expect(await ids('/api/doacoes')).toEqual([]);
    expect(await ids('/api/doacoes/aceitas')).toEqual([doacao.id]);

    const coletada = await request(app).post(`/api/doacoes/${doacao.id}/coletar`);
    expect(coletada.body.status).toBe('coletada');
    expect(await ids('/api/doacoes')).toEqual([]);
    expect(await ids('/api/doacoes/aceitas')).toEqual([]);

    const gravada = await repo.buscarPorId(doacao.id);
    expect(gravada.criada_em).toBeTruthy();
    expect(gravada.aceita_em).toBeTruthy();
    expect(gravada.coletada_em).toBeTruthy();
  });

  // CA 3.4: doação inexistente
  it('recusa confirmar a retirada de uma doação inexistente', async () => {
    const res = await request(app).post('/api/doacoes/999999/coletar');

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/não encontrada/i);
  });
});

// ---------------------------------------------------------------------------
// História 4: o coordenador da ONG consulta quantas doações coletou num período.
// ---------------------------------------------------------------------------
describe('total de doações coletadas no período', () => {
  beforeEach(async () => {
    await migrar();
    await limparBanco();
  });
  afterAll(async () => {
    await encerrar();
  });

  // Publica, aceita pela ONG e confirma a retirada. Com `em`, reescreve a
  // data/hora da coleta para simular uma retirada feita em outro dia.
  async function coletada(ong, em) {
    const { body: doacao } = await request(app).post('/api/doacoes').send(doacaoValida());
    await request(app).post(`/api/doacoes/${doacao.id}/aceitar`).send({ ong });
    await request(app).post(`/api/doacoes/${doacao.id}/coletar`);
    if (em) await query('UPDATE doacoes SET coletada_em = ? WHERE id = ?', [em, doacao.id]);
    return doacao;
  }

  const consultar = (params) => request(app).get('/api/relatorios/coletas').query(params);

  // CA 4.1: contagem por período, com início e fim inclusivos
  it('conta as coletas da ONG dentro do período, incluindo o primeiro e o último dia', async () => {
    await coletada('Casa da Sopa', '2026-09-30 23:59:59'); // antes do período
    await coletada('Casa da Sopa', '2026-10-01 00:00:00'); // primeiro dia
    await coletada('Casa da Sopa', '2026-10-05 14:30:00');
    await coletada('Casa da Sopa', '2026-10-10 23:59:59'); // último dia
    await coletada('Casa da Sopa', '2026-10-11 00:00:00'); // depois do período

    const res = await consultar({ ong: 'Casa da Sopa', inicio: '2026-10-01', fim: '2026-10-10' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ong: 'Casa da Sopa', inicio: '2026-10-01', fim: '2026-10-10', total: 3 });
  });

  // CA 4.2: período sem coletas
  it('retorna zero, sem erro, quando a ONG não coletou nada no período', async () => {
    await coletada('Casa da Sopa', '2026-10-05 10:00:00');

    const res = await consultar({ ong: 'Casa da Sopa', inicio: '2026-11-01', fim: '2026-11-30' });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });

  // CA 4.3: recorte por ONG
  it('conta só as coletas da ONG consultada', async () => {
    await coletada('ONG A', '2026-10-05 10:00:00');
    await coletada('ONG A', '2026-10-06 10:00:00');
    await coletada('ONG B', '2026-10-05 11:00:00');

    const res = await consultar({ ong: 'ONG A', inicio: '2026-10-01', fim: '2026-10-31' });

    expect(res.body.total).toBe(2);
  });

  // CA 4.3: o nome da ONG é o mesmo no aceite e na consulta, mesmo com espaços nas pontas
  it('conta a coleta de uma ONG aceita com espaços extras no nome', async () => {
    await coletada('  Casa da Sopa ', '2026-10-05 10:00:00');

    const res = await consultar({ ong: 'Casa da Sopa', inicio: '2026-10-01', fim: '2026-10-31' });

    expect(res.body.total).toBe(1);
  });

  it('ignora espaços nas pontas do nome da ONG na consulta', async () => {
    await coletada('Casa da Sopa', '2026-10-05 10:00:00');

    const res = await consultar({ ong: '  Casa da Sopa ', inicio: '2026-10-01', fim: '2026-10-31' });

    expect(res.body.total).toBe(1);
    expect(res.body.ong).toBe('Casa da Sopa');
  });

  // CA 4.4: só conta o que foi retirado
  it('não conta doações aceitas que ainda não foram coletadas', async () => {
    await coletada('Casa da Sopa');
    const { body: pendente } = await request(app).post('/api/doacoes').send(doacaoValida());
    await request(app).post(`/api/doacoes/${pendente.id}/aceitar`).send({ ong: 'Casa da Sopa' });

    const res = await consultar({ ong: 'Casa da Sopa', inicio: emDias(-1), fim: emDias(1) });

    expect(res.body.total).toBe(1);
  });

  // CA 4.5: consulta inválida é recusada
  it('recusa a consulta sem a ONG', async () => {
    const res = await consultar({ inicio: '2026-10-01', fim: '2026-10-31' });

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/ONG/);
  });

  it('recusa a consulta com o nome da ONG só de espaços', async () => {
    const res = await consultar({ ong: '   ', inicio: '2026-10-01', fim: '2026-10-31' });

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/ONG/);
  });

  it('recusa data fora do formato AAAA-MM-DD ou ausente', async () => {
    const formato = await consultar({ ong: 'ONG A', inicio: '01/10/2026', fim: '2026-10-31' });
    expect(formato.status).toBe(400);
    expect(formato.body.erro).toMatch(/início inválido/i);

    const semFim = await consultar({ ong: 'ONG A', inicio: '2026-10-01' });
    expect(semFim.status).toBe(400);
    expect(semFim.body.erro).toMatch(/fim inválido/i);
  });

  it('recusa data que não existe no calendário', async () => {
    const res = await consultar({ ong: 'ONG A', inicio: '2026-02-31', fim: '2026-10-31' });

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/início inválido/i);
  });

  it('recusa período com início depois do fim', async () => {
    const res = await consultar({ ong: 'ONG A', inicio: '2026-10-31', fim: '2026-10-01' });

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/início é depois do fim/i);
  });
});

// ---------------------------------------------------------------------------
// História 5 (fatiada): a vigilância sanitária consulta as doações que a ONG
// coletou, para auditar a qualidade (ADR 0005).
// ---------------------------------------------------------------------------
describe('estoque da ONG para a vigilância sanitária', () => {
  beforeEach(async () => {
    await migrar();
    await limparBanco();
  });
  afterAll(async () => {
    await encerrar();
  });

  // Insere a doação já pelo repositório (a validade pode estar no passado, o que a
  // publicação não permitiria) e a deixa aceita e coletada pela ONG.
  async function emEstoque(ong, extra = {}) {
    const doacao = await repo.inserir({
      tipo: 'Sopa',
      quantidade: 10,
      unidade: 'porções',
      validade: validadeFutura,
      ...extra,
    });
    await repo.aceitar(doacao.id, ong);
    await repo.coletar(doacao.id);
    return doacao;
  }

  const consultar = (params) => request(app).get('/api/relatorios/estoque').query(params);

  // CA 5.1: lista com os dados da auditoria, da validade mais próxima para a mais distante
  it('lista as doações coletadas pela ONG com os dados da auditoria, da validade mais próxima para a mais distante', async () => {
    await emEstoque('Casa da Sopa', { tipo: 'Longe', validade: emDias(9) });
    await emEstoque('Casa da Sopa', { tipo: 'Perto', quantidade: 3, unidade: 'caixas', validade: emDias(2) });

    const res = await consultar({ ong: 'Casa da Sopa' });

    expect(res.status).toBe(200);
    expect(res.body.ong).toBe('Casa da Sopa');
    expect(res.body.total).toBe(2);
    expect(res.body.itens.map((i) => i.tipo)).toEqual(['Perto', 'Longe']);
    expect(res.body.itens[0]).toMatchObject({
      tipo: 'Perto',
      quantidade: 3,
      unidade: 'caixas',
      validade: emDias(2),
      vencida: false,
    });
    expect(res.body.itens[0].coletada_em).toBeTruthy();
  });

  // CA 5.2: o que já venceu aparece, marcado como vencido
  it('mostra a doação com validade vencida, marcada como vencida', async () => {
    await emEstoque('Casa da Sopa', { tipo: 'Velha', validade: emDias(-3) });
    await emEstoque('Casa da Sopa', { tipo: 'Hoje', validade: emDias(0) });
    await emEstoque('Casa da Sopa', { tipo: 'Nova', validade: emDias(3) });

    const res = await consultar({ ong: 'Casa da Sopa' });
    const vencida = Object.fromEntries(res.body.itens.map((i) => [i.tipo, i.vencida]));

    expect(vencida).toEqual({ Velha: true, Hoje: false, Nova: false });
  });

  // CA 5.3: só entra o que a ONG consultada coletou
  it('lista só o que a ONG consultada coletou, sem disponíveis, só aceitas ou de outras ONGs', async () => {
    await emEstoque('ONG A', { tipo: 'Coletada da A' });
    await emEstoque('ONG B', { tipo: 'Coletada da B' });
    await repo.inserir({ tipo: 'Disponível', quantidade: 1, unidade: 'kg', validade: validadeFutura });
    const aceita = await repo.inserir({
      tipo: 'Só aceita',
      quantidade: 1,
      unidade: 'kg',
      validade: validadeFutura,
    });
    await repo.aceitar(aceita.id, 'ONG A');

    const res = await consultar({ ong: 'ONG A' });

    expect(res.body.itens.map((i) => i.tipo)).toEqual(['Coletada da A']);
    expect(res.body.total).toBe(1);
  });

  // CA 5.4: ONG sem doações coletadas
  it('devolve lista vazia, sem erro, quando a ONG não coletou nada', async () => {
    const res = await consultar({ ong: 'ONG A' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ong: 'ONG A', total: 0, itens: [] });
  });

  it('ignora espaços nas pontas do nome da ONG', async () => {
    await emEstoque('Casa da Sopa');

    const res = await consultar({ ong: '  Casa da Sopa ' });

    expect(res.body.total).toBe(1);
    expect(res.body.ong).toBe('Casa da Sopa');
  });

  // CA 5.5: consulta sem ONG é recusada
  it('recusa a consulta sem a ONG ou com o nome só de espaços', async () => {
    const semOng = await consultar({});
    expect(semOng.status).toBe(400);
    expect(semOng.body.erro).toMatch(/ONG/);

    const vazia = await consultar({ ong: '   ' });
    expect(vazia.status).toBe(400);
    expect(vazia.body.erro).toMatch(/ONG/);
  });
});

// ---------------------------------------------------------------------------
// Cobertura adicional de validação (RN1): casos de borda que ainda não tinham
// teste próprio, mas já são tratados pelo código em src/doacoes.js.
// ---------------------------------------------------------------------------
describe('validações adicionais de publicação', () => {
  beforeEach(async () => {
    await migrar();
    await limparBanco();
  });
  afterAll(async () => {
    await encerrar();
  });

  it('recusa quantidade não inteira', async () => {
    const res = await request(app)
      .post('/api/doacoes')
      .send(doacaoValida({ quantidade: 1.5 }));
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/quantidade/i);
  });

  it('recusa quantidade que não é um número', async () => {
    const res = await request(app)
      .post('/api/doacoes')
      .send(doacaoValida({ quantidade: 'abc' }));
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/quantidade/i);
  });

  it('recusa validade que não existe no calendário', async () => {
    const res = await request(app)
      .post('/api/doacoes')
      .send(doacaoValida({ validade: '2099-02-31' }));

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/validade/i);
  });

  it('recusa validade fora do formato AAAA-MM-DD', async () => {
    const res = await request(app)
      .post('/api/doacoes')
      .send(doacaoValida({ validade: '31/12/2026' }));
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/validade/i);
  });

  it('trata campo só com espaços em branco como ausente', async () => {
    const res = await request(app)
      .post('/api/doacoes')
      .send(doacaoValida({ tipo: '   ' }));
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/obrigat/i);
  });

  it('remove espaços extras de tipo e unidade antes de salvar', async () => {
    const criada = await request(app)
      .post('/api/doacoes')
      .send(doacaoValida({ tipo: '  Sopa  ', unidade: '  porções  ' }));

    expect(criada.status).toBe(201);
    expect(criada.body.tipo).toBe('Sopa');
    expect(criada.body.unidade).toBe('porções');
  });
});

// ---------------------------------------------------------------------------
// Caminho de erro das rotas de listagem: até aqui nenhum teste fazia essas rotas
// falharem. Protege a refatoração que centraliza o tratamento de erro em app.js.
// A falha é real: a tabela é apagada e o SELECT quebra no banco.
// ---------------------------------------------------------------------------
describe('erro do banco nas rotas de listagem', () => {
  beforeEach(async () => {
    await migrar();
    await query('DROP TABLE doacoes');
  });
  afterAll(async () => {
    await migrar();
    await encerrar();
  });

  it('responde 400 com a mensagem do erro na lista de disponíveis', async () => {
    const res = await request(app).get('/api/doacoes');
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/no such table/i);
  });

  it('responde 400 com a mensagem do erro na lista de aceitas', async () => {
    const res = await request(app).get('/api/doacoes/aceitas');
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/no such table/i);
  });
});

describe('frontend estático', () => {
  it('serve a página inicial em /', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toMatch(/Prato Cheio/);
  });
});
