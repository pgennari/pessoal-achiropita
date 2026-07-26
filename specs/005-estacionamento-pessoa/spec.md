# Feature Specification: Associacao Pessoa-Estacionamento

**Feature Branch**: `005-estacionamento-pessoa`

**Created**: 2026-07-25

**Status**: Draft

**Input**: User description: "Na tela de detalhes da pessoa, deve existir a opcao de associar aquela pessoa com algum estacionamento cadastrado. No cadastro de estacionamento, deve ter a opcao de associar as pessoas ao estacionamento."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Associar pessoa a estacionamento a partir do cadastro da pessoa (Priority: P1)

**Como** ORG ou ADM,
**quero** associar uma pessoa a um estacionamento a partir da tela de detalhes da pessoa,
**para** controlar qual estacionamento o equipista utiliza durante a festa.

**Por que esta prioridade**: Essa e a forma mais natural de associar — o organizador ja esta no cadastro da pessoa e quer vincular ao estacionamento correto.

**Teste independente**: Pode ser testado acessando a tela de detalhes de qualquer pessoa, selecionando um estacionamento na lista suspensa e salvando. A associacao aparece na listagem do estacionamento.

**Cenarios de aceite**:

1. **Dado** que o usuario esta na tela de detalhes de uma pessoa, **Quando** ele clica em "Associar estacionamento" e seleciona um estacionamento da lista, **Entao** a associacao e registrada com sucesso.
2. **Dado** que a pessoa ja possui uma associacao ativa, **Quando** o usuario seleciona outro estacionamento, **Entao** a associacao anterior e substituida pela nova.
3. **Dado** que a pessoa nao possui associacao, **Quando** o usuario clica em "Associar estacionamento", **Entao** exibe a lista de estacionamentos disponiveis com vagas.
4. **Dado** que o usuario e EQP, **Quando** ele acessa seu proprio cadastro, **Entao** ele visualiza o estacionamento associado (somente leitura).

---

### User Story 2 - Associar pessoas a estacionamento a partir do cadastro do estacionamento (Priority: P2)

**Como** ORG ou ADM,
**quero** gerenciar as pessoas associadas a um estacionamento a partir da tela de detalhes do estacionamento,
**para** visualizar o quadro completo de vagas distribuidas e pessoas vinculadas.

**Por que esta prioridade**: Complementa a US-01 — permite ver o estacionamento como ponto central e adicionar/remover pessoas de la.

**Teste independente**: Pode ser testado acessando a tela de detalhes do estacionamento, onde e possivel adicionar pessoas a lista e removê-las.

**Cenarios de aceite**:

1. **Dado** que o usuario esta na tela de detalhes de um estacionamento, **Quando** ele clica em "Adicionar pessoa", **Entao** exibe uma busca por pessoa (nome ou cracha) para selecionar.
2. **Dado** que uma pessoa foi selecionada, **Quando** o usuario confirma, **Entao** a pessoa e adicionada a lista de associados do estacionamento.
3. **Dado** que o estacionamento ja possui mais pessoas associadas que vagas contratadas, **Quando** o usuario adiciona outra pessoa, **Entao** a adicao e permitida e o contador de vagas distribuidas e incrementado normalmente.
4. **Dado** que existe uma pessoa associada, **Quando** o usuario clica em "Remover", **Entao** a pessoa e desvinculada do estacionamento.
5. **Dado** que a pessoa removida tinha vaga distribuida, **Quando** a remocao e confirmada, **Entao** o contador de vagas distribuidas e decrementado.

---

### User Story 3 - Visualizar associacao no detalhe da pessoa (Priority: P3)

**Como** qualquer usuario com acesso,
**quero** ver na tela de detalhes da pessoa qual estacionamento ela esta vinculada,
**para** consultar rapidamente durante a operacao da festa.

**Por que esta prioridade**: Informacao consultiva — nao requer acao, mas e util para operacao diaria.

**Teste independente**: Pode ser testado acessando qualquer pessoa e verificando se o estacionamento associado aparece na secao de dados.

**Cenarios de aceite**:

1. **Dado** que a pessoa possui uma associacao ativa, **Quando** o usuario acessa o detalhe, **Entao** o nome do estacionamento e exibido como link clicavel.
2. **Dado** que a pessoa nao possui associacao, **Quando** o usuario acessa o detalhe, **Entao** exibe "Nenhum estacionamento associado" com botao para associar.
3. **Dado** que o usuario clica no link do estacionamento, **Quando** o clique acontece, **Entao** navega para a tela de detalhes do estacionamento.

---

### Edge Cases

- O que acontece quando uma pessoa e inativada? A associacao com estacionamento deve ser removida automaticamente?
- O que acontece quando um estacionamento e excluido? As pessoas associadas devem ficar sem vinculo?
- Uma pessoa pode estar associada a mais de um estacionamento ao mesmo tempo? (Resposta: Nao — apenas um por pessoa, conforme o schema atual com `tem_estacionamento` boolean)
- O que acontece se o estacionamento atingir 100% das vagas e um ADM tentar forcar a adicao? (Resposta: Permitir — nao ha bloqueio por vagas)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Sistema DEVE permitir associar uma pessoa a um estacionamento a partir da tela de detalhes da pessoa.
- **FR-002**: Sistema DEVE permitir associar pessoas a um estacionamento a partir da tela de detalhes do estacionamento.
- **FR-003**: Sistema DEVE manter apenas uma associacao ativa por pessoa (N-to-1).
- **FR-004**: Sistema DEVE atualizar o contador `vagas_distribuidas` do estacionamento ao adicionar/remover pessoas.
- **FR-005**: Sistema DEVE permitir adicao de pessoa independente do numero de vagas contratadas (sem bloqueio por vagas).
- **FR-006**: Sistema DEVE exibir o estacionamento associado na tela de detalhes da pessoa.
- **FR-007**: Sistema DEVE permitir desfazer a associacao (remover pessoa do estacionamento).
- **FR-008**: Sistema DEVE registrar em auditoria toda operacao de associacao/desassociacao.
- **FR-009**: Apenas usuarios com perfil ORG ou ADM DEVEM podem criar/remover associacoes.
- **FR-010**: Usuarios EQP DEVEM visualizar apenas o proprio estacionamento associado (somente leitura).

### Key Entities

- **Pessoa**: Cadastro do equipista. Possui campo `tem_estacionamento` (boolean) que indica se possui vinculo.
- **Estacionamento**: Local de estacionamento com vagas contratadas e distribuidas. Campos: nome, endereco, vagas, horarios.
- **Associacao Pessoa-Estacionamento**: Relacao N:1 (uma pessoa, um estacionamento). Implementada via campo `estacionamento_id` na tabela `pessoas` ou tabela de associacao separada.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: ORG/ADM podem associar uma pessoa a um estacionamento em menos de 30 segundos.
- **SC-002**: 100% das pessoas com estacionamento possuem vinculo correto no sistema.
- **SC-003**: Contador de vagas distribuidas esta sempre consistente com o numero real de pessoas associadas.
- **SC-004**: Pessoas podem ser associadas a qualquer estacionamento, mesmo quando vagas distribuidas excedem vagas contratadas.

## Assumptions

- A relacao e N:1 — cada pessoa pode estar associada a apenas um estacionamento por vez (consistente com o campo `tem_estacionamento` boolean existente).
- O campo `estacionamento_id` sera adicionado a tabela `pessoas` (ou criada tabela de associacao se necessario).
- A gestao de vagas ja e feita manualmente hoje — o app apenas registra a associacao e mantem o contador.
- Usuarios EQP nao podem criar associacoes — apenas visualizar a propria.
- A operacao de associacao e exclusivamente manual (sem regras automaticas de alocacao).

## Clarifications

### Session 2026-07-25

- Q: Sistema deve bloquear adicao quando vagas distribuidas >= vagas contratadas? → A: Nao — permitir adicao mesmo quando vagas distribuidas excedem vagas contratadas.
