# TRABALHO EM SALA: STAKEHOLDERS, OBJETIVOS E CONFLITOS (AULA 02)

## INTEGRANTES

- GUSTAVO VINIUS TAQUES
- JOAO PEDRO ANGELICO
- LUIS FERNANDO PEREIRA
- VYNICYUS CANDIDO

## 1. MAPA DE STAKEHOLDERS

| Stakeholder | Tipo | Interesse | Influência | O que espera |
|---|---|---|---|---|
| Doador | Usuário | Alto | Baixa/Média | Publicar a doação rápido, com o mínimo de dados possível |
| ONG | Usuário | Alto | Média | Ver as doações disponíveis com informação suficiente para decidir e coletar |
| Equipe do projeto (nós) | Operação | Alto | Alta | Sistema simples de manter, testado e fácil de trocar de banco depois |
| Marta / avaliação da disciplina | Patrocinador | Alto | Alta | Piloto funcionando no prazo, entregas de acordo com os critérios de cada unidade |
| Vigilância sanitária | Regulador | Baixo/Médio | Alta | Rastreabilidade mínima da doação (o quê, quando, validade), mesmo sem regra explícita hoje |

Doador e ONG puxam o sistema para lados opostos: um quer menos campos, o outro quer mais informação. Marta e a equipe têm alta influência porque decidem prazo e implementação. O regulador hoje não pressiona diretamente, mas pode passar a exigir rastreabilidade — por isso vale prever o campo mesmo sem ser obrigatório ainda.

## 2. CONFLITO ENTRE STAKEHOLDERS

**Fala do Doador:** "Quero publicar a doação com o mínimo de informação possível — não quero dar meu telefone ou endereço; quanto menos campos, melhor."

**Fala da ONG:** "Para coordenar a retirada com segurança, precisamos do telefone do doador, endereço aproximado e detalhes de validade e acondicionamento."

**O conflito:** o doador quer menos fricção (menos campos), a ONG quer mais informação para logística. Formulário curto demais dificulta a coleta; formulário longo demais afasta o doador.

**Critério para decidir:**
1. Só exigir o que é indispensável para a doação acontecer: tipo, quantidade, validade e uma forma de contato (telefone ou e-mail).
2. Deixar o resto opcional (endereço completo, por exemplo) e explicar para que serve: só é usado para combinar a retirada, não é público.
3. Se um dia a lei/regulador exigir mais dados, essa exigência vence a simplicidade.

## 3. TRÊS REGRAS DE NEGÓCIO IMPLÍCITAS, EXPLICITADAS

**Regra 1 — Toda doação precisa dos dados mínimos**
Uma doação só pode ser criada se tiver tipo (preenchido), quantidade (maior que zero) e validade (uma data que ainda não passou). Sem isso, o sistema recusa.

**Regra 2 — Só aparece na lista o que ainda está disponível**
A listagem pública mostra apenas doações com status "disponível" e validade ainda não vencida. Doação já aceita ou vencida some da lista.

**Regra 3 — Só uma ONG pode aceitar cada doação**
Quando uma ONG aceita uma doação, ela deixa de estar disponível para as outras. Se duas ONGs tentarem aceitar ao mesmo tempo, só a primeira consegue; a segunda recebe um erro dizendo que a doação já foi aceita.

Essas três regras estão implícitas no pedido original da Marta ("doador posta, ONG aceita") e precisam virar testes automatizados no `src/doacoes.js` e `src/repositorio.js` para não ficarem só no papel.
