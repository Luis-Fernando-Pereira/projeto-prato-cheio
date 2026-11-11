import express from 'express';
import * as doacoes from './doacoes.js';

// Executa a regra da rota e responde com o resultado. Erro de regra vira 400 com a
// mensagem, num lugar só, em vez de um try/catch igual em cada rota.
const responder =
  (acao, status = 200) =>
  async (req, res) => {
    try {
      res.status(status).json(await acao(req));
    } catch (erro) {
      res.status(400).json({ erro: erro.message });
    }
  };

export function criarApp() {
  const app = express();
  app.use(express.json());
  app.use(express.static('public'));

  // Verificação de saúde: usada pelo CI para provar que a aplicação sobe.
  app.get('/api/saude', (req, res) => res.json({ ok: true }));

  app.get(
    '/api/doacoes',
    responder(() => doacoes.listarDisponiveis()),
  );
  app.get(
    '/api/doacoes/aceitas',
    responder(() => doacoes.listarAceitas()),
  );
  app.post(
    '/api/doacoes',
    responder((req) => doacoes.criarDoacao(req.body), 201),
  );
  app.post(
    '/api/doacoes/:id/aceitar',
    responder((req) => doacoes.aceitar(req.params.id, req.body?.ong ?? 'ONG')),
  );
  app.post(
    '/api/doacoes/:id/coletar',
    responder((req) => doacoes.coletar(req.params.id)),
  );

  // História 4: total de doações coletadas pela ONG no período.
  app.get(
    '/api/relatorios/coletas',
    responder((req) => doacoes.totalColetadas(req.query)),
  );

  // História 5: doações que a ONG coletou, para a vigilância sanitária.
  app.get(
    '/api/relatorios/estoque',
    responder((req) => doacoes.estoqueDaOng(req.query)),
  );

  return app;
}
