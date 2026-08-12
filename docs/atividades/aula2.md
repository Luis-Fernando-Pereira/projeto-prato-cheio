Conflito entre stakeholders — Prato Cheio (Aula 02)

Falas selecionadas (plausíveis, baseadas no domínio):

Fala A (Doador): “Quero publicar doações com o mínimo de informação possível — não quero expor meu telefone ou endereço; quanto menos campos, melhor.”

Fala B (ONG / Operação): “Para que possamos coordenar a retirada e garantir segurança alimentar, precisamos do telefone do doador, endereço aproximado e informações detalhadas sobre validade e acondicionamento.”

Descrição do conflito
- Tensão: Privacidade e fricção para o doador (reduzir campos) versus necessidade operacional e de conformidade para a ONG (mais dados para logística e segurança).
- Efeito prático: se o formulário for muito enxuto, ONGs terão dificuldade logística; se for muito detalhado, doadores podem abandonar o fluxo.

Critério objetivo para decidir (regra de decisão)
- Prioridade: priorizar aceitação operacional mínima necessária para segurança e execução (ONG) enquanto minimiza exposição de dados pessoais.

Regra decisória concretizada:
1. Exigir apenas os dados estritamente necessários para viabilizar a doação e mitigar riscos: {tipo, quantidade, validade, cidade/bairro aproximado, opção de contato (telefone ou e-mail)}.
2. Tornar campos sensíveis opt-in e explicitar uso: por exemplo, endereço completo é opcional; quando fornecido, será usado somente para combinar retirada e não publicado publicamente.
3. Em caso de conflito entre simplificação e conformidade legal (regulador): seguir requisitos legais/regulatórios (obrigatoriedade de rastreabilidade vence).

Como verificar/validar o critério
- Critério observável: API rejeita criação sem {tipo, quantidade, validade, cidade/bairro} e aceita com telefone/o e-mail opcionais; testes automatizados tentam criar doação sem campos obrigatórios e esperam 400.
- Medida de aceitação: taxa de abandono em formulário (métrica futura) e taxa de doações aceitas por ONG. (Métrica operacional — recomendada para U2/U3.)

Regras de negócio explícitas (3) — Prato Cheio (Aula 02)

Regra 1 — Campos obrigatórios para criar uma doação
Enunciado: Uma doação só pode ser criada se os campos `tipo` (string não vazia), `quantidade` (inteiro > 0) e `validade` (data ISO >= data atual) estiverem presentes e válidos.
Critério de verificação: Teste automatizado POST /api/doacoes com cada campo faltando ou inválido deve retornar 400; POST válido retorna 201 e a doação criada contém os campos e status inicial 'disponivel'.

Regra 2 — Somente doações com status 'disponivel' aparecem na listagem pública
Enunciado: `GET /api/doacoes` lista apenas doações cujo atributo `status` é exatamente 'disponivel' e cuja `validade` não esteja expirada.
Critério de verificação: Criar doação com status 'disponivel' e outra com status 'aceito' (ou simular aceitar) e garantir que apenas a primeira é retornada pelo endpoint; também testar que doações com validade passada não aparecem.

Regra 3 — Aceitação é atômica e exclusiva
Enunciado: Quando uma ONG aceita uma doação, a operação deve ser atômica e garantir exclusividade — apenas a primeira requisição de aceitação para uma doação 'disponivel' é bem-sucedida; subsequentes falham com erro indicando que a doação já foi aceita.
Critério de verificação: Simular duas requisições concorrentes de POST /api/doacoes/:id/aceitar; validar que exatamente uma retorna sucesso (200) com campo `ong` preenchido e a outra retorna 400/409; no banco a doação terá `status='aceito'` e `ong` preenchido.

Notas de implementação (observações úteis)
- Regra 1 sugere validação no nível de doacoes.criarDoacao e/ou camada de rota.
- Regra 2 sugere filtro por status e por validade na query de repositorio.listarDisponiveis.
- Regra 3 sugere uso de cláusula SQL atômica/transactional (e.g., UPDATE ... WHERE status='disponivel' RETURNING *) ou mecanismo de lock para garantir que apenas uma aceitação ocorre.

Mapa de Stakeholders — Prato Cheio (Aula 02)

Resumo: Papéis inferidos do repositório e posicionamento em termos de Interesse e Influência.

1) Doador
- Tipo: Usuário
- Interesse: Alto (quer que a doação seja rápida e sem burocracia)
- Influência: Baixo–Médio (pode abandonar uso, mas não controla o sistema)
- Expectativas: publicar doações com campos mínimos; privacidade; receber confirmação rápida.
- Justificativa: Usuário final que inicia o fluxo; suas necessidades guiam UX.

Matriz: Alto Interesse / Baixa-Média Influência

2) ONG (receptora)
- Tipo: Usuário / Beneficiário
- Interesse: Alto (quer acesso a doações úteis e informações logísticas)
- Influência: Médio (pode aceitar/recusar doações, feedback para requisitos)
- Expectativas: ver doações disponíveis com informações suficientes (quantidade, validade, local), aceitar rapidamente.

Matriz: Alto Interesse / Média Influência

3) Mantenedores / Desenvolvedores (grupo da disciplina)
- Tipo: Operação / Técnico
- Interesse: Médio–Alto (quer código testável, CI verde e arquitetura clara)
- Influência: Alto (decidem implementação, codebase e deploy)
- Expectativas: rotas estáveis, testes automatizados, facilidade para migrar DB.

Matriz: Médio-Alto Interesse / Alta Influência

4) Instrutor / Patrocinador (disciplina)
- Tipo: Patrocinador / Avaliador
- Interesse: Alto (quer entrega conforme critérios da disciplina)
- Influência: Alta (avalia nota/aceitação do trabalho)
- Expectativas: entregáveis (docs, testes), aderência aos critérios de cada unidade.

Matriz: Alto Interesse / Alta Influência

5) Operação / Admin do sistema
- Tipo: Operação
- Interesse: Médio (manutenção, disponibilidade)
- Influência: Média (controla deploy/infra)
- Expectativas: rota de saúde, logs, facilidade de manutenção e backups.

Matriz: Médio Interesse / Média Influência

6) Regulador / Autoridade sanitária
- Tipo: Regulador
- Interesse: Baixo–Médio (pode exigir rastreabilidade e segurança quando aplicável)
- Influência: Alta (pode impor regras legais)
- Expectativas: conformidade com normas sanitárias, rastreabilidade mínima quando exigida.

Matriz: Baixo-Médio Interesse / Alta Influência

Observação final: o posicionamento privilegia segurança operacional e requisitos acadêmicos. Se desejar, gerarei uma matriz visual (influência × interesse).
