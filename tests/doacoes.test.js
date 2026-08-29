import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { criarApp } from '../src/app.js';
import { migrar, limparBanco, encerrar } from '../src/db.js';
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
    const res = await request(app)
      .post('/api/doacoes')
      .send({ tipo: 'Pão' }); // sem quantidade, unidade e validade

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/obrigat/i);

    const lista = await request(app).get('/api/doacoes');
    expect(lista.body).toHaveLength(0); // nada é gravado
  });

  // RN1: quantidade tem de ser maior que zero
  it('recusa doação com quantidade zero ou negativa', async () => {
    const zero = await request(app).post('/api/doacoes').send(doacaoValida({ quantidade: 0 }));
    expect(zero.status).toBe(400);
    expect(zero.body.erro).toMatch(/quantidade/i);

    const negativa = await request(app).post('/api/doacoes').send(doacaoValida({ quantidade: -3 }));
    expect(negativa.status).toBe(400);

    const lista = await request(app).get('/api/doacoes');
    expect(lista.body).toHaveLength(0);
  });

  // RN1 / RN2: validade já vencida é recusada na publicação
  it('recusa doação com validade já vencida', async () => {
    const res = await request(app).post('/api/doacoes').send(doacaoValida({ validade: validadePassada }));

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
    await request(app).post('/api/doacoes').send(doacaoValida({ tipo: 'Longe', validade: emDias(9) }));
    await request(app).post('/api/doacoes').send(doacaoValida({ tipo: 'Perto', validade: emDias(2) }));
    await request(app).post('/api/doacoes').send(doacaoValida({ tipo: 'Médio', validade: emDias(5) }));

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

    const res = await request(app)
      .post(`/api/doacoes/${doacao.id}/aceitar`)
      .send({ ong: 'Casa da Sopa' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('aceita');
    expect(res.body.ong).toBe('Casa da Sopa');
  });

  // CA 2.1: a doação aceita sai da lista pública
  it('remove a doação da lista de disponíveis depois de aceita', async () => {
    const doacao = await publicar();
    await request(app)
      .post(`/api/doacoes/${doacao.id}/aceitar`)
      .send({ ong: 'ONG A' });

    const lista = await request(app).get('/api/doacoes');
    expect(lista.body).toHaveLength(0);
  });

  // CA 2.2: não é possível aceitar duas vezes
  it('recusa aceitar uma doação que já foi aceita por outra ONG', async () => {
    const doacao = await publicar();

    const primeira = await request(app)
      .post(`/api/doacoes/${doacao.id}/aceitar`)
      .send({ ong: 'ONG A' });
    expect(primeira.status).toBe(200);

    const segunda = await request(app)
      .post(`/api/doacoes/${doacao.id}/aceitar`)
      .send({ ong: 'ONG B' });
    expect(segunda.status).toBe(400);
    expect(segunda.body.erro).toMatch(/já foi aceita/i);
  });

  // Caminho de erro: aceitar uma doação que não existe
  it('recusa aceitar uma doação inexistente', async () => {
    const res = await request(app)
      .post('/api/doacoes/999999/aceitar')
      .send({ ong: 'ONG A' });

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/não encontrada/i);
  });
});
