# Documento de Análise: Prato Cheio

*Trabalho 1 · máximo 4 páginas · entrega na Aula 5*

**Grupo:** Gustavo Vinicius Taques, João Pedro Angélico, Luis Fernando Pereira, Vynicyus Candido

**Estado:** a história zero (publicar, ver, aceitar) roda ponta a ponta; 11 testes verdes com `npm test`. As regras de negócio 1, 2 e 3 estão implementadas e cobertas por teste. As histórias 3, 4 e 5 ficam para a Unidade 2 (ver "Decisão de análise").

## Problema central

Comida ainda boa se perde todos os dias porque as ONGs descobrem tarde demais o que está disponível e não conseguem coletar a tempo. Falta previsibilidade e velocidade entre o momento em que a comida fica disponível e o momento em que ela é coletada.

O pedido original da Marta ("um aplicativo para substituir os grupos de WhatsApp, no qual o doador posta a doação e a ONG aceita") já traz uma solução embutida: assume que o canal de comunicação é a raiz do problema. Não está confirmado se o gargalo real está na comunicação, na coleta ou na logística de entrega.

## Incertezas

1. O volume real de doações por dia ainda não foi medido.
2. Não há confirmação de que o gargalo seja o tempo de coleta, como a Marta supõe.
3. Não se sabe se os doadores vão cadastrar cada doação, nem com que frequência.
4. Não se sabe quantas ONGs vão aderir ao piloto.
5. Não está definido como equilibrar a simplicidade que o doador exige com a rastreabilidade que a vigilância sanitária pede.

## Stakeholders

| Stakeholder | Interesse | Influência | O que espera |
|---|---|---|---|
| Doador (restaurante, padaria, mercado) | Alto | Baixa/Média | Publicar a doação rápido, com o mínimo de campos |
| ONG receptora / cozinha comunitária | Alto | Média | Ver as doações disponíveis com informação suficiente para decidir e coletar |
| Voluntário entregador | Médio | Baixa | Instruções claras de retirada; funciona no celular, na rua, com conexão instável |
| Equipe do projeto | Alto | Alta | Sistema simples de manter, testado, fácil de trocar de banco depois |
| Marta (coordenadora da plataforma) | Alto | Alta | Piloto funcionando no prazo; crescer e mostrar impacto |
| Vigilância sanitária | Baixo/Médio | Alta | Rastreabilidade mínima da doação (o quê, quanto, validade) |

Doador e ONG puxam o sistema para lados opostos: um quer menos campos, o outro quer mais informação. Marta e a equipe decidem prazo e implementação. A vigilância não pressiona hoje, mas pode passar a exigir rastreabilidade, por isso o registro mínimo já é obrigatório.

## Objetivos de impacto

1. **Reduzir a comida boa descartada** no bairro-piloto. Indicador: % de doações publicadas que vencem sem coleta.
2. **Aumentar o número de refeições que chegam a quem precisa.** Indicador: doações coletadas por semana, contra a linha de base do WhatsApp.
3. **Reduzir o tempo entre "comida disponível" e "comida coletada".** Indicador: tempo mediano entre publicação e coleta.

São objetivos de resultado (*outcome*), não de funcionalidade. Nenhuma tela, por si, garante que sejam atingidos.

## Regras de negócio

- **RN1: dados mínimos da doação.** Uma doação só é criada com tipo preenchido, quantidade (número inteiro maior que zero), unidade e validade (data de hoje ou futura). Faltando ou inválido, o sistema recusa e nada é gravado. *Implementada e testada.*
- **RN2: só aparece o que ainda serve.** A lista pública mostra apenas doações com status "disponível" e validade não vencida. Doação aceita ou vencida some da lista. *Implementada e testada.*
- **RN3: uma doação, uma ONG.** Quando uma ONG aceita uma doação, ela deixa de estar disponível para as demais. Em aceite concorrente, só a primeira ONG consegue; a segunda recebe erro. *Implementada e testada* (trava `UPDATE ... WHERE status = 'disponivel'`).
- **RN4: proximidade (fora do escopo da U1).** ONGs mais próximas do doador têm vantagem logística. Não implementada: o modelo ainda não registra localização. Registrada para a Unidade 2.

## Histórias de usuário

| # | História (Como… quero… para…) | INVEST: o que falha |
|---|---|---|
| 1 | Como **doador**, quero cadastrar uma doação, para que as ONGs a identifiquem e coletem antes que estrague. | Sã. É a metade "publicar" da história zero. |
| 2 | Como **funcionário de ONG**, quero selecionar uma doação disponível, para que o entregador a colete antes que estrague. | Depende da 1 (não totalmente **I**ndependente), aceitável. É a metade "aceitar" da história zero. |
| 3 | Como **entregador**, quero confirmar a presença do doador no ponto de entrega, para receber a doação. | Falha **V** e **I**: não entrega valor sozinha (não há fluxo de coleta) e "ponto de entrega" é conceito não modelado. Adiada para a U2. |
| 4 | Como **coordenador da ONG**, quero saber quantas doações coletamos num período, para acompanhar o volume. | Sã em valor, mas só **E**stimável depois de existir histórico de coletas. Critérios definidos; implementação na U2. |
| 5 | Como **agente da vigilância sanitária**, quero consultar os alimentos perecíveis em estoque da ONG, para auditar a qualidade. | Falha **E** e **S**: "estoque" pressupõe inventário no tempo, que o modelo não tem. Precisa ser fatiada. Adiada para a U2. |

## Critérios de aceite

**História 1: doador cadastra uma doação**

- **CA 1.1**: Dado que informei tipo, quantidade, unidade e validade; Quando confirmo a publicação; Então a doação é registrada como "disponível" e passa a aparecer na lista pública.
- **CA 1.2**: Dado que deixei em branco um campo obrigatório, ou informei quantidade menor ou igual a zero, ou validade já vencida; Quando tento publicar; Então o sistema recusa, informa o motivo e nada é gravado.
- **CA 1.3**: Dado uma doação publicada; Quando ela é consultada; Então constam tipo, quantidade, unidade, validade e a data/hora de criação.

**História 2: ONG seleciona uma doação disponível**

- **CA 2.1**: Dado uma doação "disponível"; Quando a ONG a aceita; Então ela passa para "aceita", fica vinculada a essa ONG e sai da lista pública.
- **CA 2.2**: Dado uma doação já aceita pela ONG A; Quando a ONG B tenta aceitar a mesma doação; Então o sistema recusa, informa que já foi aceita e o vínculo com a ONG A é mantido.
- **CA 2.3**: Dado que a ONG abre a lista de disponíveis; Quando a lista é exibida; Então cada item mostra tipo, quantidade/unidade e validade, e a lista vem ordenada da validade mais próxima para a mais distante.

**História 4: coordenador acompanha o volume coletado** (critérios definidos; implementação na U2)

- **CA 4.1**: Dado um intervalo de datas; Quando o coordenador consulta o total de doações aceitas pela sua ONG no intervalo; Então o sistema retorna a quantidade cuja data de aceite está dentro do intervalo.
- **CA 4.2**: Dado um intervalo sem coletas da ONG; Quando o coordenador consulta; Então o sistema retorna zero, sem erro.
- **CA 4.3**: Dado doações aceitas por várias ONGs no mesmo período; Quando o coordenador da ONG A consulta; Então apenas as doações da ONG A são contadas.

## Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| **R1**: o doador não cadastra a doação por fricção (formulário longo, pressa na cozinha) | Alta | Alto: sem oferta publicada, o produto não tem o que distribuir | Formulário curto (tipo, quantidade, unidade, validade); contato vem do cadastro único; medir taxa de abandono na semana 1 e cortar campos se passar de 30%. Responsável: Luis Fernando Pereira. |
| **R2**: o alimento perecível vence antes de alguém coletar | Alta | Alto: comida perdida é o problema que o piloto deveria reduzir | Campo validade obrigatório e em destaque; lista ordenada por validade crescente; doação vencida barrada na publicação e removida da lista (RN1, RN2, já implementadas); alerta às ONGs quando faltar pouco para o fim da janela (U2). Responsável: Vynicyus Cândido. |

## Hipótese e experimento

**Suposição do caso:** a Marta acha que o gargalo é o tempo de coleta, sem medição que confirme. Assumimos que o problema principal é a **demora das ONGs em saber que há comida disponível**.

**Hipótese testável:** se as ONGs do bairro forem avisadas de cada nova doação em até 15 minutos após a publicação, então pelo menos **60% das doações serão aceitas em até 2 horas e coletadas no mesmo dia**, contra a linha de base do grupo de WhatsApp. É refutável: tem população (ONGs de um bairro), intervenção (aviso em 15 min), métrica (% de aceite em 2h e de coleta no mesmo dia) e prazo.

**Experimento:** 2 semanas, 1 bairro. Linha de base: as 2 semanas anteriores, com registro manual dos horários de anúncio, aceite e coleta de cada doação. Intervenção: toda publicação dispara aviso às ONGs em até 15 min. Instrumentação: o sistema grava `criada_em` (já existe); `aceita_em` e `coletada_em` entram na U2. Métricas: tempo mediano publicação→aceite e publicação→coleta; % aceitas em 2h; % coletadas no mesmo dia; % vencidas sem coleta.

**Critério de decisão:** confirma se % aceitas em 2h ≥ 60% e o tempo mediano até a coleta cair ao menos 30% ante a linha de base. Se refutada, o gargalo provavelmente está na logística de coleta (falta de entregador ou veículo), e o próximo experimento ataca isso.

## Decisão de análise

- **Problema:** o Trabalho 1 pede uma fatia executável ponta a ponta em poucas semanas, mas as 5 histórias levantadas cobrem 4 papéis (doador, ONG, entregador, coordenador, vigilância) e 3 fluxos distintos (publicação/aceite, coleta, auditoria/relatório). Não cabe implementar tudo no piloto.
- **Alternativas:**
  1. **Implementar as 5 histórias no piloto.** Prós: cobre todos os stakeholders de uma vez. Contras: não cabe no prazo; H3 e H5 ainda estão mal fatiadas e virariam retrabalho; dilui o aprendizado da unidade.
  2. **Implementar só a história zero** (publicar → ver → aceitar), com RN1, RN2 e RN3 completas e testadas; adiar H3, H4 e H5 para a U2. *(escolhida)*
  3. **História zero + H4** (relatório do coordenador), por já ter critérios definidos. Contras: H4 depende de histórico de coletas que só existe depois de o piloto rodar; adianta esforço sem reduzir risco novo.
- **Decisão e justificativa:** alternativa 2. A história zero é a menor fatia que atravessa interface, regra e dados e já exercita os conflitos centrais do caso (menos campos × rastreabilidade; disponibilidade × concorrência). Ela ataca o risco técnico principal (a fatia vertical executa de verdade?) e o risco R2 (validade vencida agora é barrada e sai da lista). H3 e H5 precisam ser refatoradas antes de valer a pena; H4 não reduz risco que a história zero já não cubra.
- **Riscos e limitações:** adiar H4 deixa a Marta sem indicador de volume durante o piloto (mitigado pelo registro manual de horários na linha de base do experimento). Adiar H3 significa que o fluxo de coleta em si não é validado na U1. RN4 (proximidade) fica fora: sem localização, a lista não prioriza por distância. A comparação de validade usa `date('now')` em UTC, o que pode divergir do fuso local perto da meia-noite; aceitável no piloto e revisto na U2.

## Uso de IA

Nível da unidade: **IA como colaboradora.**

- **Gerado com IA:** rascunho dos critérios de aceite a partir das histórias; redação da hipótese e do experimento a partir da suposição do caso; primeira versão de `repositorio.js`, `doacoes.js` e dos testes.
- **Verificado e alterado pelo grupo:** revisão de cada critério contra o caso; escolha dos 2 riscos e dos responsáveis; execução de `npm test` e teste manual da API (publicar → listar → aceitar → recusar segundo aceite → recusar quantidade ≤ 0 → recusar validade vencida); decisão de separar `quantidade` (número) de `unidade` e de implementar a regra de validade vencida em vez de adiá-la; ajuste da ordenação da lista por validade.
- Uma revisão assistida por IA (lentes adversarial, edge-case e verification-gap) apontou critérios sem teste (CA 1.3 e CA 2.3), a divergência da quantidade e o buraco da validade vencida; as correções acima vieram dessa revisão.
- O grupo é responsável por verificar, testar, corrigir e defender o resultado.
