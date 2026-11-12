# Refatorações — Prato Cheio

*Atividade de refatoração · quatro refatorações, uma seção por refatoração · o que importa é o motivo e a evidência*

**Ponto de partida:** `main` em `caf5c66`. **Branch:** `refatoracao/quatro-refatoracoes`.

Refatorar aqui é mudar a estrutura sem mudar o comportamento. Por isso a regra foi a mesma em todas:
antes de mexer, conferir se havia teste protegendo o trecho; onde não havia, escrever o teste primeiro.
Depois de cada refatoração, a suíte inteira tinha de continuar verde, sem alterar nenhum teste existente.

## Resumo da evidência

| Commit | O que é | Testes unitários (`npm test`) | Testes de ponta a ponta (`npm run test:e2e`) |
|---|---|:--:|:--:|
| `caf5c66` | ponto de partida (`main`) | 42 passando | 20 passando |
| `5e91531` | teste novo antes da R1 | 44 passando | — |
| `c4df893` | R1 | 44 passando | — |
| `08eddb4` | R2 | 44 passando | — |
| `24adf9d` | R3 | 44 passando | — |
| `f994ad2` | R4 | 44 passando | 20 passando |

Cobertura das linhas de `src/`: **98,3% antes, 100% depois**. Em `src/app.js` subiu de 93,9% para 100%,
por causa do teste novo da R1. Lint (`npm run lint`) sem erros em todos os commits.

Nenhum teste existente foi alterado. Os dois testes a mais são os do caminho de erro das listagens (R1).

---

## R1 — Tratamento de erro repetido em todas as rotas

- **Cheiro atacado:** código duplicado. As 7 rotas de `src/app.js` tinham o mesmo bloco
  `try { ... } catch (erro) { res.status(400).json({ erro: erro.message }) }`.
- **Qual dor concreta isso resolvia:** qualquer mudança na forma de responder um erro (por exemplo,
  passar a usar 404 para "não encontrada", como apontado nos diagramas) teria de ser feita 7 vezes, e
  bastava esquecer uma rota para a API ficar inconsistente. Cada rota nova também copiava o bloco.
- **Teste criado antes de refatorar:** a cobertura mostrou que o `catch` de `GET /api/doacoes` e de
  `GET /api/doacoes/aceitas` (linhas 16 e 24 do `app.js` original) nunca era executado: nenhum teste
  fazia essas rotas falharem. Antes de mexer, criamos o bloco "erro do banco nas rotas de listagem" em
  `tests/doacoes.test.js` (commit `5e91531`). Ele apaga a tabela para provocar uma falha real no
  `SELECT` e verifica que as duas rotas respondem 400 com a mensagem do erro.
- **O que mudou:** `src/app.js` ganhou a função `responder(acao, status)`, que executa a regra, responde
  com o resultado e transforma o erro em 400 num lugar só. Cada rota virou uma chamada a `responder`.
  O arquivo caiu de 71 para 58 linhas.
- **O que NÃO mudou:** as rotas, os códigos HTTP (200, 201 na publicação, 400 no erro) e o corpo das
  respostas.
- **Evidência:** 44 testes passando antes (`5e91531`) e depois (`c4df893`).

## R2 — Regra de negócio dentro da rota

- **Cheiro atacado:** regra na camada errada. A rota `POST /api/doacoes/:id/aceitar` decidia que, sem
  ONG informada, o nome gravado seria `'ONG'` (`req.body?.ong ?? 'ONG'`).
- **Qual dor concreta isso resolvia:** o projeto separa as camadas `app.js` (HTTP) → `doacoes.js`
  (regras) → `repositorio.js` (SQL), e é isso que os diagramas e o `docs/projeto.md` (D5) afirmam. Essa
  regra quebrava a separação: quem chamasse `aceitar()` sem passar pela rota gravaria `"undefined"`
  como nome da ONG.
- **O que mudou:** a rota só repassa `req.body?.ong`. Em `src/doacoes.js`, `aceitar()` aplica o padrão
  com a constante `ONG_PADRAO`.
- **O que NÃO mudou:** o padrão só vale quando a ONG não vem (`undefined` ou `null`), exatamente como
  antes. Texto vazio continua sendo gravado como veio.
- **Evidência:** o teste "usa 'ONG' como valor padrão quando o corpo não informa a ong" protege a
  regra. 44 testes passando antes (`c4df893`) e depois (`08eddb4`).

## R3 — Validações repetidas nas regras

- **Cheiro atacado:** código duplicado e laço difícil de ler em `src/doacoes.js`:
  - "doação não encontrada" (buscar e recusar) estava repetido em `aceitar` e `coletar`;
  - "informe a ONG" mais o `trim` do nome estavam repetidos em `totalColetadas` e `estoqueDaOng`;
  - as duas datas do período eram validadas num laço sobre pares `[campo, rótulo]`, montado só para
    reaproveitar a mensagem.
- **Qual dor concreta isso resolvia:** uma correção numa dessas validações (por exemplo, normalizar o
  nome da ONG para minúsculas, o problema da "Casa da Sopa" registrado nos diagramas) teria de ser feita
  em dois lugares, e era fácil corrigir um e esquecer o outro.
- **O que mudou:** três funções internas, cada uma com uma responsabilidade:
  `buscarExistente(id)`, `nomeDaOng(ong)` e `dataObrigatoria(valor, rotulo)`. As funções exportadas
  ficaram mais curtas e dizem o que validam pelo nome.
- **O que NÃO mudou:** as mensagens de erro e a ordem das validações (primeiro a ONG, depois o início,
  depois o fim, depois o período).
- **Evidência:** protegem esta refatoração os testes de id inexistente (aceite e coleta), ONG ausente e
  só com espaços (histórias 4 e 5), data fora do formato, data inexistente e início depois do fim.
  44 testes passando antes (`08eddb4`) e depois (`24adf9d`).

## R4 — Strings mágicas de status

- **Cheiro atacado:** strings mágicas (*magic strings*). Os textos `'disponivel'`, `'aceita'` e
  `'coletada'` apareciam 8 vezes no código, entre `src/doacoes.js` e o SQL de `src/repositorio.js`.
- **Qual dor concreta isso resolvia:** um erro de digitação, como `'aceito'` num `WHERE`, não dá erro
  nenhum: a consulta só passa a não encontrar nada, em silêncio. E não havia um lugar que dissesse
  quais são os estados possíveis de uma doação.
- **O que mudou:** novo arquivo `src/status.js` com a constante `STATUS` (`DISPONIVEL`, `ACEITA`,
  `COLETADA`), congelada com `Object.freeze`. As regras usam a constante, e o SQL recebe o status como
  parâmetro (`status = ?`), igual aos outros valores. Um nome errado, como `STATUS.ACEITO`, vira
  `undefined` e quebra os testes, em vez de passar despercebido.
- **O que NÃO mudou:** as travas contra aceite duplo e coleta dupla continuam dentro do próprio
  `UPDATE ... WHERE id = ? AND status = ?`. Os valores gravados no banco são os mesmos.
- **Evidência:** protegem esta refatoração os testes de fluxo completo (publicar → aceitar → coletar),
  de aceite duplo, de coleta dupla e de coleta de doação ainda disponível. Como ela mexe nas travas,
  rodamos também os 20 testes de ponta a ponta (Playwright), que passaram antes (`caf5c66`) e depois
  (`f994ad2`). Unitários: 44 passando antes (`24adf9d`) e depois (`f994ad2`).

---

## Limitações e o que ficou de fora

- **`DEFAULT 'disponivel'` no `CREATE TABLE` de `src/db.js`:** continua como texto, porque é SQL de
  schema e não pode usar uma constante JavaScript. Fica para a migração para PostgreSQL, quando o schema
  for reescrito.
- **`ORDER BY validade ASC, id ASC` repetido em três consultas:** é SQL curto e legível; extrair isso
  deixaria as consultas mais difíceis de ler do que repetir uma linha.
- **Todo erro de regra continua respondendo 400:** usar 404 ("não encontrada") e 409 ("já aceita")
  mudaria o comportamento da API. Isso é uma decisão de projeto, não uma refatoração. A R1 deixa a
  mudança mais fácil, porque agora ela ficaria em um lugar só.
- **Migração de SQLite para PostgreSQL:** decidida no ADR 0001, mas ainda não implementada. Não entrou
  nesta atividade.

## Uso de IA

Usamos o Claude Code (Anthropic) para identificar os cheiros, conferir a cobertura de testes de cada
trecho e propor as refatorações. O grupo conferiu cada mudança, rodou a suíte depois de cada commit e
manteve as que não alteravam o comportamento. A ordem foi sempre a mesma: teste antes, refatoração
depois, suíte verde em cada commit.
