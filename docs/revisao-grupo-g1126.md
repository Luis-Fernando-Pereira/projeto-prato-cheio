# Revisão de código — grupo g1126

**Repositório revisado:** <https://github.com/migueldufloth/g1126-template-prato-cheio>
**Versão revisada:** commit [`37b2a16`](https://github.com/migueldufloth/g1126-template-prato-cheio/commit/37b2a16) (`main`, 12/11/2026), depois das refatorações da Aula 13
**Revisores:** Gustavo Vinicius Taques, João Pedro Angélico, Luis Fernando Pereira, Vynicyus Candido

## Como revisamos

- Lemos todo o código de `src/` (`app.js`, `db.js`, `status.js`, `doacoes.js`, `repositorio.js`), os
  testes em `tests/`, o `public/index.html`, o CI e as regras de negócio do próprio grupo em
  `docs/analise.md`.
- Conferimos cada achado contra o código. Os links abaixo apontam para as linhas exatas do commit
  revisado.
- **Não executamos o projeto localmente:** ele exige PostgreSQL (`DATABASE_URL`). Para saber se os
  testes passam, usamos o CI do grupo, **verde** no commit revisado. Os comportamentos descritos nos
  achados vêm da leitura do código; onde dizemos "a API responde X", é o que o código faz por
  construção.

**Escala de prioridade:** **Alta** = contradiz uma regra de negócio ou deixa entrar dado inválido;
**Média** = comportamento confuso ou risco de design; **Baixa** = melhoria de qualidade.

## Checklist

| # | Item | Resultado | Achado |
|:--:|---|:--:|---|
| 1 | Testes cobrem as regras de negócio e os caminhos de erro | ✅ | — |
| 2 | Testes rodam e passam no CI | ✅ | CI verde em `37b2a16`, com PostgreSQL como serviço |
| 3 | Validação das entradas | ⚠️ | A1, A6 |
| 4 | Código coerente com as regras de negócio do grupo | ⚠️ | A2 |
| 5 | Cada regra na camada certa (rota → regras → dados) | ⚠️ | A5 |
| 6 | Leituras sem efeito colateral | ❌ | A3 |
| 7 | Mensagens e códigos de erro claros | ⚠️ | A4, A7 |
| 8 | SQL parametrizado, sem risco de injeção | ✅ | ressalva em A8 |
| 9 | Concorrência (duas ONGs ao mesmo tempo) | ✅ | — |
| 10 | Duplicação e strings mágicas | ✅ | já tratadas nas refatorações da Aula 13 |
| 11 | Nomes claros e comentários úteis | ✅ | — |
| 12 | Interface protegida contra XSS | ✅ | — |
| 13 | Ferramentas de qualidade (lint, formatação) | ⚠️ | A9 |

## O que está muito bom

- **Transição de estado atômica.** Toda mudança de estado passa por
  [`transicionar()`](https://github.com/migueldufloth/g1126-template-prato-cheio/blob/37b2a16/src/repositorio.js#L60-L70),
  com `UPDATE ... WHERE id = ? AND status = ?`. Assim, duas ONGs nunca ficam com a mesma doação. Além
  disso, há teste de corrida real com `Promise.all`
  ([`tests/doacoes.test.js:210`](https://github.com/migueldufloth/g1126-template-prato-cheio/blob/37b2a16/tests/doacoes.test.js#L210)
  e [`tests/repositorio.test.js:27`](https://github.com/migueldufloth/g1126-template-prato-cheio/blob/37b2a16/tests/repositorio.test.js#L27)).
- **Testes de caracterização antes de refatorar**
  ([`tests/caracterizacao.test.js`](https://github.com/migueldufloth/g1126-template-prato-cheio/blob/37b2a16/tests/caracterizacao.test.js)).
  Eles fixam até as mensagens de erro, o que é exatamente a rede de segurança que uma refatoração precisa.
- **Filtro por tipo seguro:** os curingas do `LIKE` (`%`, `_`) são escapados, e há teste de injeção de SQL
  ([`repositorio.js:30`](https://github.com/migueldufloth/g1126-template-prato-cheio/blob/37b2a16/src/repositorio.js#L30),
  [`filtro-tipo.test.js:71-91`](https://github.com/migueldufloth/g1126-template-prato-cheio/blob/37b2a16/tests/filtro-tipo.test.js#L71-L91)).
- **Interface escapa o texto do usuário** antes de usar `innerHTML`
  ([`public/index.html:48`](https://github.com/migueldufloth/g1126-template-prato-cheio/blob/37b2a16/public/index.html#L48)).
- **Migração para PostgreSQL feita**, com o banco como serviço no CI e verificação de que a aplicação sobe.

## Achados e propostas

### A1 · Alta · Campos só com espaços e validade em qualquer formato são aceitos

- **Onde:** [`src/doacoes.js:18-24`](https://github.com/migueldufloth/g1126-template-prato-cheio/blob/37b2a16/src/doacoes.js#L18-L24)
- **O que encontramos:** a validação é `!{ tipo, quantidade, validade }[campo]`, que só recusa valores
  "falsos" (vazio, `null`, `undefined`, `0`). Por isso:
  - `tipo: "   "` (só espaços) passa e é gravado;
  - `validade: "abc"`, `"ontem"` ou uma data já passada, como `"2020-01-01"`, passam;
  - `quantidade: 0` é recusada como **"campo obrigatório ausente"**, o que é uma mensagem enganosa (o campo veio).
- **Por que importa:** a primeira regra de negócio do grupo é que "toda doação publicada precisa de
  tipo, quantidade e validade" (`docs/analise.md`), e a vigilância sanitária usa esses três campos para
  rastrear o alimento. Uma validade que não é data não serve para rastrear nem para saber se o alimento
  ainda pode ser doado.
- **Proposta:**
  1. tratar texto só com espaços como ausente (`String(valor).trim() === ''`) e gravar os campos com `trim`;
  2. exigir validade no formato `AAAA-MM-DD`, com data que exista no calendário;
  3. recusar validade já vencida;
  4. escrever um teste para cada caso **antes** de mudar, como vocês já fizeram nos testes de caracterização.

### A2 · Alta · Doação vencida continua aparecendo na lista

- **Onde:** [`src/repositorio.js:27-44`](https://github.com/migueldufloth/g1126-template-prato-cheio/blob/37b2a16/src/repositorio.js#L27-L44)
  e o teste [`tests/doacoes.test.js:22-31`](https://github.com/migueldufloth/g1126-template-prato-cheio/blob/37b2a16/tests/doacoes.test.js#L22-L31)
- **O que encontramos:** `listarDisponiveis` filtra só por `status`, nunca pela validade. O próprio
  teste publica uma doação com `validade: '2026-08-01'`, data que já passou, e espera que ela apareça
  na lista. Ele passa hoje justamente porque a validade é ignorada.
- **Por que importa:** a História 1 do grupo é publicar a doação "para que uma ONG saiba que o alimento
  existe **antes que vença**". Do jeito atual, uma ONG pode reservar e aceitar comida vencida.
- **Proposta:** filtrar `validade >= CURRENT_DATE`. Vale também mudar a coluna `validade` de `TEXT` para
  `DATE` ([`src/db.js:35`](https://github.com/migueldufloth/g1126-template-prato-cheio/blob/37b2a16/src/db.js#L35)),
  agora que estão no PostgreSQL. Usar datas relativas nos testes (hoje + N dias) evita que eles quebrem
  com o passar do tempo.

### A3 · Média · Toda leitura faz uma escrita no banco

- **Onde:** [`atualizarExpiradas()`](https://github.com/migueldufloth/g1126-template-prato-cheio/blob/37b2a16/src/repositorio.js#L15-L22),
  chamada em [`listarDisponiveis`](https://github.com/migueldufloth/g1126-template-prato-cheio/blob/37b2a16/src/repositorio.js#L28),
  [`buscarPorId`](https://github.com/migueldufloth/g1126-template-prato-cheio/blob/37b2a16/src/repositorio.js#L47)
  e [`transicionar`](https://github.com/migueldufloth/g1126-template-prato-cheio/blob/37b2a16/src/repositorio.js#L61)
- **O que encontramos:** antes de cada consulta, roda um `UPDATE` que devolve as reservas vencidas
  para `disponivel`. Um `GET /api/doacoes` altera dados, e um aceite faz até três `UPDATE` (dois de
  expiração e o da transição).
- **Por que importa:**
  - quem lê o código não espera que uma listagem grave no banco;
  - com muitas ONGs consultando ao mesmo tempo, cada leitura disputa bloqueio de escrita na tabela;
  - a reserva só "expira" se alguém fizer uma consulta.
- **Proposta:** tratar a reserva vencida na própria condição, sem gravar. Por exemplo, considerar
  disponível o que for `status = 'disponivel' OR (status = 'reservada' AND reservada_em + prazo < now())`,
  tanto na listagem quanto no `WHERE` das transições. Se preferirem manter a gravação, movam para uma
  rotina periódica e registrem a decisão num ADR.

### A4 · Média · Aceitar uma doação reservada responde "já foi aceita"

- **Onde:** [`src/doacoes.js:47`](https://github.com/migueldufloth/g1126-template-prato-cheio/blob/37b2a16/src/doacoes.js#L47).
  O próprio teste de caracterização registra o problema
  ([`tests/caracterizacao.test.js:65-67`](https://github.com/migueldufloth/g1126-template-prato-cheio/blob/37b2a16/tests/caracterizacao.test.js#L65-L67):
  "Comportamento atual: uma doação reservada também responde 'já foi aceita'").
- **Por que importa:** a ONG lê que outra ONG aceitou, quando na verdade a doação só está reservada e
  pode voltar à lista em 20 minutos. A mensagem leva a uma decisão errada, que é desistir da doação.
- **Proposta:** uma mensagem própria para o estado `reservada`, como "doação está reservada por outra
  ONG; tente de novo após o prazo da reserva", seguindo o mesmo mapa `MENSAGEM_POR_STATUS` que vocês já
  usam em `cancelar`. Depois, atualizar o teste de caracterização, de forma consciente.

### A5 · Média · ONG padrão decidida na rota, e reservas sem dono definido

- **Onde:** [`src/app.js:17-18`](https://github.com/migueldufloth/g1126-template-prato-cheio/blob/37b2a16/src/app.js#L17-L18)
  e [`src/doacoes.js:69`](https://github.com/migueldufloth/g1126-template-prato-cheio/blob/37b2a16/src/doacoes.js#L69)
- **O que encontramos:** sem `ong` no corpo, a rota usa `"ONG"` para aceitar, **reservar e confirmar**.
  A confirmação só confere se `reservada_por` é igual ao texto enviado. Então, dois pedidos sem `ong`
  são tratados como a mesma ONG: um consegue confirmar a reserva do outro.
- **Por que importa:**
  - **Camada errada:** valor padrão de negócio é regra e não deveria ficar na camada HTTP. Quem chamar
    `doacoes.reservar()` por outro caminho não recebe o padrão.
  - **Reserva sem dono:** a reserva existe para garantir a doação a **uma** ONG, e o padrão anula essa
    garantia.
  Sabemos que autenticação está fora do escopo do grupo, e por isso a proposta não depende dela.
- **Proposta:** levar o padrão para `doacoes.js` e, em `reservar` e `confirmarReserva`, **exigir** a
  `ong` (recusar sem ela), mantendo o padrão só no aceite imediato, se o grupo quiser.

### A6 · Baixa · Motivo do cancelamento que não é texto vira erro interno

- **Onde:** [`src/doacoes.js:92`](https://github.com/migueldufloth/g1126-template-prato-cheio/blob/37b2a16/src/doacoes.js#L92)
- **O que encontramos:** `motivo?.trim()` pressupõe texto. Com `{ "motivo": 123 }`, o JavaScript lança
  `TypeError`, e a API responde 400 com a mensagem interna `"motivo?.trim is not a function"`.
- **Por que importa:** a mensagem expõe detalhe de implementação e não diz ao usuário o que corrigir.
- **Proposta:** recusar `motivo` que não seja texto, com uma mensagem clara, e criar um teste para isso.

### A7 · Baixa · Todo erro responde 400

- **Onde:** [`src/app.js:12`](https://github.com/migueldufloth/g1126-template-prato-cheio/blob/37b2a16/src/app.js#L12)
- **O que encontramos:** "doação não encontrada" e "já foi aceita por outra ONG" respondem 400, o
  mesmo código de um formulário inválido.
- **Por que importa:** quem consome a API não consegue distinguir "o pedido está errado" (400) de "não
  existe" (404) ou de "conflito com outra ONG" (409) sem ler o texto da mensagem.
- **Proposta:** como o tratamento já está centralizado em `rota()`, basta um erro com código (por
  exemplo, `erro.status`) para responder 404 e 409. Como isso muda a API, vale registrar a decisão
  num ADR. Temos o mesmo ponto em aberto no nosso projeto.

### A8 · Baixa · SQL montado por interpolação em `transicionar` e troca de `?` por `$n`

- **Onde:** [`src/repositorio.js:60-70`](https://github.com/migueldufloth/g1126-template-prato-cheio/blob/37b2a16/src/repositorio.js#L60-L70)
  e [`src/db.js:17-22`](https://github.com/migueldufloth/g1126-template-prato-cheio/blob/37b2a16/src/db.js#L17-L22)
- **O que encontramos:** `set` e `filtro` entram no SQL por interpolação (`${set}`). **Hoje é seguro**:
  os trechos são fixos no próprio arquivo, e o comentário avisa disso. Além disso, `paraPostgres` troca
  todo `?` por `$1, $2...`, inclusive um `?` que apareça dentro de um texto, limitação também comentada.
- **Por que importa:** as duas regras dependem de quem mexer no código depois ler o comentário. Basta
  passar um valor vindo do usuário em `filtro` para abrir uma injeção de SQL.
- **Proposta:** não é urgente. Como o projeto já está no PostgreSQL, uma saída é escrever o SQL com
  `$1, $2...` direto, eliminando `paraPostgres`. Outra é fazer `transicionar` receber só o nome de uma
  transição conhecida (`'aceitar'`, `'reservar'`...) em vez de trechos de SQL.

### A9 · Baixa · Sem lint e formatação no CI

- **Onde:** [`package.json`](https://github.com/migueldufloth/g1126-template-prato-cheio/blob/37b2a16/package.json)
  e [`.github/workflows/ci.yml`](https://github.com/migueldufloth/g1126-template-prato-cheio/blob/37b2a16/.github/workflows/ci.yml)
- **O que encontramos:** não há ESLint nem Prettier no projeto, então o estilo depende de cada pessoa
  (por exemplo, um bloco inteiro numa linha só em `db.js:52`).
- **Por que importa:** com quatro pessoas commitando, um verificador automático pega erros comuns
  (variável não usada, `await` esquecido) antes da revisão humana.
- **Proposta:** adicionar `eslint` e `prettier --check` como passos do CI. Foi o que fizemos no nosso
  projeto, e o custo é pequeno.

## Resumo das propostas, por prioridade

1. **A1 e A2:** validar as entradas e tirar da lista a doação vencida. São as duas que tocam diretamente
   as regras de negócio do grupo.
2. **A3, A4 e A5:** leitura sem escrita, mensagem certa para reserva e reserva com dono definido.
3. **A6 a A9:** melhorias de qualidade, sem urgência.

## Mensagem para o grupo g1126

> Olá, pessoal! Revisamos o `main` de vocês no commit `37b2a16`. A transição atômica com teste de corrida
> e os testes de caracterização antes das refatorações ficaram muito bons. Os dois pontos que mais
> recomendamos olhar: a publicação aceita validade em qualquer formato, e até campos só com espaços
> (A1), e a lista mostra doação vencida (A2), o que vai contra a História 1 ("antes que vença"). Também
> sugerimos não gravar no banco a cada leitura (A3), uma mensagem própria para doação reservada (A4) e
> exigir a ONG na reserva (A5). Os detalhes, com links para as linhas, estão em
> `docs/revisao-grupo-g1126.md` no nosso repositório. Qualquer dúvida, falem com a gente!
