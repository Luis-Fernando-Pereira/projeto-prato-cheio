# TRABALHO EM SALA: CRITÉRIOS DE ACEITE, HIPÓTESES E RISCOS (AULA 04)

## INTEGRANTES

- GUSTAVO VINIUS TAQUES
- JOAO PEDRO ANGELICO
- LUIS FERNANDO PEREIRA
- VYNICYUS CANDIDO

---

## 1. CRITÉRIOS DE ACEITE (DADO / QUANDO / ENTÃO) PARA 3 HISTÓRIAS

As histórias são as definidas na Aula 03 (`aula3.md`). Critério de aceite é o
acordo em linguagem de negócio sobre *quando a história está pronta* — não é o
teste automatizado, embora um critério possa virar um ou mais testes.

### História 1 — Doador cadastra uma doação

> Como doador, quero cadastrar uma doação na aplicação Prato Cheio, para que as
> ONGs possam identificá-la e coletá-la antes que ela estrague.

- **CA 1.1: publicação válida aparece para as ONGs**
  - **Dado** que informei tipo, quantidade, unidade e validade da doação
  - **Quando** confirmo a publicação
  - **Então** a doação é registrada como "disponível" e passa a aparecer na lista
    pública de doações.

- **CA 1.2: publicação com dado inválido é recusada**
  - **Dado** que deixei em branco um campo obrigatório (tipo, quantidade, unidade
    ou validade), ou informei quantidade menor ou igual a zero, ou uma validade
    que já venceu
  - **Quando** tento publicar
  - **Então** o sistema recusa a publicação, informa o motivo e nada é gravado.

- **CA 1.3: a doação registra o mínimo para rastreabilidade**
  - **Dado** uma doação publicada
  - **Quando** ela é consultada
  - **Então** constam pelo menos tipo do alimento, quantidade, unidade, validade e
    a data/hora em que foi criada.

### História 2 — Funcionário da ONG seleciona uma doação disponível

> Como funcionário de uma ONG, quero selecionar uma doação quando ela estiver
> disponível, para que o entregador possa coletá-la antes que ela estrague.

- **CA 2.1 — aceite de doação disponível**
  - **Dado** uma doação com status "disponível"
  - **Quando** a ONG a seleciona (aceita)
  - **Então** a doação passa para "aceita", fica vinculada a essa ONG e sai da
    lista pública de disponíveis.

- **CA 2.2 — não é possível aceitar duas vezes**
  - **Dado** uma doação já aceita pela ONG A
  - **Quando** a ONG B tenta aceitar a mesma doação
  - **Então** o sistema recusa a ação, informa que a doação já foi aceita e o
    vínculo com a ONG A é mantido.

- **CA 2.3: lista mostra o necessário para decidir a coleta**
  - **Dado** que a ONG abre a lista de doações disponíveis
  - **Quando** a lista é exibida
  - **Então** cada item mostra tipo, quantidade com unidade e validade/janela de
    retirada, e a lista vem ordenada da validade mais próxima para a mais distante.

### História 4 — Coordenador da ONG acompanha o volume coletado

> Como coordenador da ONG, quero saber quantas doações coletamos em um período
> determinado, para que eu possa acompanhar a quantidade de doações coletadas.

- **CA 4.1 — contagem por período**
  - **Dado** um intervalo de datas (início e fim)
  - **Quando** o coordenador consulta o total de doações aceitas pela sua ONG
    nesse intervalo
  - **Então** o sistema retorna a quantidade de doações aceitas cuja data de
    aceite está dentro do intervalo.

- **CA 4.2 — período sem coletas**
  - **Dado** um intervalo em que a ONG não aceitou nenhuma doação
  - **Quando** o coordenador faz a consulta
  - **Então** o sistema retorna zero, sem erro.

- **CA 4.3 — recorte por ONG**
  - **Dado** doações aceitas por várias ONGs no mesmo período
  - **Quando** o coordenador da ONG A consulta o total
  - **Então** apenas as doações aceitas pela ONG A são contadas.

> Das três histórias acima, a **1** e a **2** compõem a história zero e já estão
> implementadas e testadas (seção 4). A **4** tem os critérios definidos, mas a
> implementação fica para a Unidade 2.

---

## 2. SUPOSIÇÃO → HIPÓTESE TESTÁVEL + EXPERIMENTO

### Suposição do caso

O caso afirma: *"Marta acha que o gargalo é o tempo de coleta, mas não há medição
que confirme."* Assumimos, sem ter testado, que **o problema principal é a demora
das ONGs em ficarem sabendo que há comida disponível** — se soubessem antes,
aceitariam e coletariam a tempo.

### Hipótese testável

> **Se** as ONGs do bairro forem avisadas de cada nova doação em até 15 minutos
> após a publicação, **então** pelo menos **60% das doações publicadas serão
> aceitas em até 2 horas** e **coletadas no mesmo dia**, contra a linha de base
> atual do grupo de WhatsApp.

É testável porque tem população (ONGs de um bairro), intervenção (aviso em 15
min), métrica (% de aceite em 2h e de coleta no mesmo dia), número (60%) e prazo
(2 horas / mesmo dia). Pode ser refutada.

### Experimento

- **Duração:** 2 semanas. **Escopo:** 1 bairro, os doadores e ONGs do piloto.
- **Linha de base:** as 2 semanas anteriores, com a articulação pelo WhatsApp;
  registrar manualmente, para cada doação, o horário em que foi anunciada, o
  horário do aceite e o horário da coleta.
- **Intervenção:** durante o piloto, toda publicação no Prato Cheio dispara um
  aviso às ONGs do bairro em até 15 minutos.
- **Instrumentação:** o próprio sistema grava os carimbos de tempo — `criada_em`
  (já existe), `aceita_em` e `coletada_em` (a acrescentar).
- **Métricas:**
  1. tempo mediano entre publicação e aceite;
  2. tempo mediano entre publicação e coleta;
  3. % de doações aceitas em até 2 h;
  4. % de doações coletadas no mesmo dia;
  5. % de doações que venceram sem coleta.
- **Critério de decisão:**
  - **Confirma** a hipótese se (3) ≥ 60% **e** o tempo mediano até a coleta cair
    pelo menos 30% em relação à linha de base.
  - **Refuta** caso contrário. Se refutada, o gargalo provavelmente está na
    **logística de coleta** (falta de entregador/veículo disponível), não na
    velocidade da informação — e o próximo experimento deve atacar isso.

---

## 3. DOIS RISCOS DO CASO E MITIGAÇÃO CONCRETA

| # | Risco | Probabilidade | Impacto |
|---|---|---|---|
| R1 | Doador não cadastra a doação por fricção (formulário longo, pressa na cozinha, "depois eu faço") | Alta | Alto — sem oferta publicada, o produto não tem o que distribuir |
| R2 | Alimento perecível vence antes de alguém coletar | Alta | Alto — comida perdida é exatamente o problema que o piloto deveria reduzir |

### R1 — Fricção no cadastro do doador

**Mitigação concreta:**
- Formulário de publicação limitado a **3 campos** (tipo, quantidade,
  validade/retirar até); o contato do doador vem do cadastro único, feito uma vez.
- Campos com exemplo preenchido (*placeholder*) e teclado adequado no celular.
- Medir na **semana 1** do piloto a taxa de abandono do formulário (publicações
  iniciadas × concluídas); se passar de 30%, cortar mais campos.
- **Responsável:** LUIS FERNANDO PEREIRA — acompanha a métrica e propõe o corte.

### R2 — Perecível vence antes da coleta

**Mitigação concreta:**
- Campo **"retirar até"** obrigatório e exibido em destaque em cada item da lista.
- Lista de disponíveis **ordenada por validade crescente** (mais urgente no topo)
  — já implementado no walking skeleton (`ORDER BY validade ASC`).
- Doação vencida sai automaticamente da lista pública (regra a implementar na
  Unidade 2, junto com o filtro por data).
- Alerta às ONGs quando faltarem menos de X horas para o fim da janela de uma
  doação ainda disponível.
- **Responsável:** VYNICYUS CANDIDO — acompanha o indicador "% vencidas sem
  coleta" durante o piloto.

---

## 4. WALKING SKELETON — HISTÓRIA ZERO EXECUTANDO

### Primeiro caso de uso (história zero)

**Um doador publica uma doação (tipo, quantidade, unidade, validade) → uma ONG vê
a doação disponível → a ONG a aceita, e ela some da lista para as demais.**

Atravessa todas as camadas: interface (`public/index.html`) → API
(`src/app.js`) → regras (`src/doacoes.js`) → dados (`src/repositorio.js` +
`src/db.js`, SQLite).

### O que foi implementado nesta aula

- **`src/db.js`**: schema da tabela `doacoes` com `quantidade` numérica (inteiro) e
  `unidade` em campo próprio, além de `validade`, `status`, `ong` e `criada_em`.
- **`src/repositorio.js`**: `inserir`, `listarDisponiveis`, `buscarPorId` e
  `aceitar`, com SQL parametrizado. `listarDisponiveis` filtra
  `status = 'disponivel' AND validade >= date('now')` (Regra de Negócio 2). O
  aceite usa `UPDATE ... WHERE id = ? AND status = 'disponivel'` como trava contra
  aceite duplo: só a primeira ONG casa com a condição (Regra de Negócio 3).
- **`src/doacoes.js`**: `criarDoacao` aplica a Regra de Negócio 1 inteira: tipo,
  quantidade, unidade e validade preenchidos; quantidade inteira maior que zero;
  validade no formato `AAAA-MM-DD` e não vencida. `aceitar` verifica existência da
  doação e devolve erro quando ela já foi aceita.
- **`tests/doacoes.test.js`**: os `it.todo` viraram testes de verdade e o grupo
  acrescentou casos de erro e de borda (quantidade inválida, validade vencida,
  ordenação, aceitar doação inexistente).

### Testes (todos passando com `npm test`)

```
✓ a aplicação sobe > responde na verificação de saúde
✓ publicar e listar doações > mostra a doação publicada na lista de disponíveis
✓ publicar e listar doações > recusa doação sem os campos obrigatórios
✓ publicar e listar doações > recusa doação com quantidade zero ou negativa
✓ publicar e listar doações > recusa doação com validade já vencida
✓ publicar e listar doações > não mostra na lista doação cuja validade já passou
✓ publicar e listar doações > lista as doações da validade mais próxima para a mais distante
✓ aceitar uma doação > marca a doação como aceita pela ONG
✓ aceitar uma doação > remove a doação da lista de disponíveis depois de aceita
✓ aceitar uma doação > recusa aceitar uma doação que já foi aceita por outra ONG
✓ aceitar uma doação > recusa aceitar uma doação inexistente

Test Files  1 passed (1)
     Tests  11 passed (11)
```

Rastreabilidade critério para teste:

| Critério de aceite | Teste automatizado |
|---|---|
| CA 1.1 | "mostra a doação publicada na lista de disponíveis" |
| CA 1.2 (campo faltando) | "recusa doação sem os campos obrigatórios" |
| CA 1.2 (quantidade ≤ 0) | "recusa doação com quantidade zero ou negativa" |
| CA 1.2 (validade vencida) | "recusa doação com validade já vencida" |
| CA 1.3 | "mostra a doação publicada na lista de disponíveis" (verifica tipo, quantidade, unidade, validade e `criada_em`) |
| CA 2.1 | "marca a doação como aceita pela ONG" |
| CA 2.1 (sai da lista) | "remove a doação da lista de disponíveis depois de aceita" |
| CA 2.2 | "recusa aceitar uma doação que já foi aceita por outra ONG" |
| CA 2.3 (ordenação) | "lista as doações da validade mais próxima para a mais distante" |
| RN2 (vencida some) | "não mostra na lista doação cuja validade já passou" |

### Como rodar

```bash
npm install
npm run db:migrar
npm start          # http://localhost:3000
npm test           # roda os testes
```

### Decisão de recorte (para o documento de análise)

O recorte da Unidade 1 é **implementar só a história zero** (publicar, ver,
aceitar) com as Regras de Negócio 1, 2 e 3 completas e testadas, e **adiar as
histórias 3, 4 e 5 para a Unidade 2**. As alternativas consideradas e a
justificativa estão em `docs/analise.md`, seção "Decisão de análise". A Regra de
Negócio 4 do caso (ONGs mais próximas têm vantagem logística) também fica para a
U2, por depender de localização, que o modelo ainda não registra.

---

## 5. USO DE IA

Nível declarado da aula: **IA como colaboradora.**

- **Gerado com IA:** rascunho dos critérios de aceite a partir das histórias da
  Aula 03; redação da hipótese e do experimento a partir da suposição do caso;
  primeira versão da implementação de `repositorio.js`, `doacoes.js` e dos testes.
- **Verificado e alterado pelo grupo:** revisão de cada critério contra o caso;
  escolha dos 2 riscos e definição dos responsáveis; execução de `npm test` e do
  teste manual da API (publicar, listar, aceitar, recusar segundo aceite, recusar
  quantidade ≤ 0, recusar validade vencida); decisão de separar `quantidade`
  (número) de `unidade`, e de implementar a recusa de validade vencida e a
  filtragem da lista por data em vez de adiá-las; ajuste da ordenação da lista por
  validade.
- Uma revisão assistida por IA sobre os entregáveis da unidade apontou critérios
  sem teste (CA 1.3 e CA 2.3) e a incoerência da quantidade e da validade vencida;
  as correções acima vieram dessa revisão e foram conferidas pelo grupo.
- O grupo é responsável por verificar, testar, corrigir e defender o resultado.
