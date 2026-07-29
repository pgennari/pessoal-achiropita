# Feature Specification: Associar Veiculo a Estacionamento e Pessoas

**Feature Branch**: `012-associar-veiculo-estacionamento`

**Created**: 2026-07-29

**Status**: Draft

**Input**: User description: "Dentro do detalhe do Veiculo, quero poder associa-lo à um estacionamento e vincular à uma ou mais pessoas."

## User Scenarios & Testing

### User Story 1 - Associar Veiculo a um Estacionamento pelo Detalhe (Priority: P1)

Um usuario ADM ou ORG, ao visualizar o detalhe de um veiculo, quer associar o veiculo a um estacionamento existente para que a vaga contratada seja atribuida corretamente.

**Why this priority**: E a acao principal solicitada — associar o veiculo ao estacionamento. Sem isso o veiculo fica sem estacionamento vinculado, impedindo o controle de vagas e checkin.

**Independent Test**: Pode ser testado navegando ate o detalhe de qualquer veiculo e selecionando um estacionamento no seletor disponivel. O veiculo passa a exibir o nome do estacionamento vinculado.

**Acceptance Scenarios**:

1. **Given** um usuario ADM/ORG logado na pagina de detalhe de um veiculo, **When** ele seleciona um estacionamento da lista suspensa e confirma, **Then** o veiculo e associado ao estacionamento escolhido e o nome do estacionamento aparece no detalhe
2. **Given** um usuario na pagina de detalhe com veiculo ja associado a um estacionamento, **When** ele seleciona outro estacionamento na lista, **Then** o veiculo e transferido para o novo estacionamento
3. **Given** um usuario na pagina de detalhe com veiculo associado a um estacionamento, **When** ele remove a associacao, **Then** o veiculo fica sem estacionamento vinculado

---

### User Story 2 - Vincular Pessoas ao Veiculo pelo Detalhe (Priority: P1)

Um usuario ADM ou ORG, ao visualizar o detalhe de um veiculo, quer vincular uma ou mais pessoas ao veiculo para indicar quem sao os proprietarios ou condutores autorizados.

**Why this priority**: E a segunda acao principal — vincular pessoas. Muitos veiculos podem ter multiplos condutores ou proprietarios, e essa relacao precisa estar visivel e editavel no detalhe do veiculo.

**Independent Test**: Pode ser testado abrindo o detalhe de um veiculo e vinculando uma pessoa existente. A pessoa aparece na lista de vinculos do veiculo.

**Acceptance Scenarios**:

1. **Given** um usuario ADM/ORG na pagina de detalhe de um veiculo, **When** ele busca e seleciona uma pessoa para vincular, **Then** a pessoa e adicionada a lista de vinculados ao veiculo
2. **Given** um veiculo com multiplas pessoas vinculadas, **When** o usuario remove uma delas, **Then** a pessoa e desvinculada do veiculo
3. **Given** um usuario tenta vincular a mesma pessoa ja vinculada ao veiculo, **When** ele confirma a acao, **Then** o sistema informa que a pessoa ja esta vinculada

---

### User Story 3 - Visualizar Vinculos no Detalhe do Veiculo (Priority: P2)

Um usuario (qualquer perfil autorizado) ao acessar o detalhe de um veiculo quer ver claramente:
- A qual estacionamento o veiculo esta associado (se houver)
- Quais pessoas estao vinculadas ao veiculo

**Why this priority**: A visualizacao e o consumo da informacao. Sem ela, os vinculos feitos nas stories anteriores nao sao uteis para os demais perfis (CRD, EQP, OPC, REC).

**Independent Test**: Qualquer perfil autorizado pode abrir o detalhe de um veiculo e ver o estacionamento e a lista de pessoas vinculadas, sem precisar editar nada.

**Acceptance Scenarios**:

1. **Given** um veiculo associado a um estacionamento, **When** qualquer usuario autorizado acessa o detalhe, **Then** o nome do estacionamento e exibido como um link clicavel para o detalhe do estacionamento
2. **Given** um veiculo com pessoas vinculadas, **When** qualquer usuario autorizado acessa o detalhe, **Then** os nomes das pessoas sao exibidos como links clicaveis para o detalhe de cada pessoa
3. **Given** um veiculo sem estacionamento e sem pessoas vinculadas, **When** qualquer usuario acessa o detalhe, **Then** o sistema exibe indicacoes visuais de "Sem estacionamento" e "Nenhuma pessoa vinculada"

---

### Edge Cases

- O que acontece quando o usuario tenta associar o veiculo a um estacionamento que ja atingiu o limite de vagas distribuidas?
- O que acontece quando o veiculo e associado a um estacionamento diferente daquele ja associado a alguma de suas pessoas vinculadas?
- Como o sistema se comporta quando o estacionamento ao qual o veiculo estava associado e excluido (ON DELETE SET NULL)?

## Requirements

### Functional Requirements

- **FR-001**: O detalhe do veiculo deve exibir um seletor de estacionamento que permite ao usuario ADM/ORG escolher um estacionamento entre os existentes
- **FR-002**: O sistema deve permitir que o usuario ADM/ORG remova a associacao de um veiculo com um estacionamento
- **FR-003**: Ao alterar a associacao de estacionamento de um veiculo, o sistema deve ajustar a contagem de vagas distribuidas (vagas_distribuidas) do estacionamento anterior e do novo
- **FR-004**: O detalhe do veiculo deve permitir ao usuario ADM/ORG buscar e vincular pessoas existentes ao veiculo
- **FR-005**: O detalhe do veiculo deve permitir ao usuario ADM/ORG desvincular pessoas do veiculo
- **FR-006**: O sistema deve impedir vinculo duplicado da mesma pessoa ao mesmo veiculo com mensagem de erro amigavel
- **FR-007**: O detalhe do veiculo deve exibir, para usuarios de qualquer perfil autorizado, o nome do estacionamento associado (se houver) como link para o detalhe do estacionamento
- **FR-008**: O detalhe do veiculo deve exibir, para usuarios de qualquer perfil autorizado, a lista de pessoas vinculadas (se houver) com links para o detalhe de cada pessoa
- **FR-009**: O sistema deve exibir indicacoes visuais claras quando nao houver estacionamento associado ou pessoas vinculadas
- **FR-010**: O sistema deve validar se o estacionamento possui vagas disponiveis antes de permitir a associacao

### Key Entities

- **Veiculo**: Representa um veiculo cadastrado (fabricante, modelo, placa, cor). Pode estar associado a um estacionamento e a uma ou mais pessoas.
- **Estacionamento**: Representa um estacionamento com endereco, vagas contratadas e distribuidas. Um veiculo pode estar associado a exatamente um estacionamento.
- **Pessoa**: Representa uma pessoa cadastrada. Pode estar vinculada a um ou mais veiculos.
- **PessoaVeiculo**: Entidade de juncao que representa o vinculo muitos-para-muitos entre pessoa e veiculo.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Usuarios ADM/ORG conseguem associar um veiculo a um estacionamento em ate 2 cliques a partir do detalhe do veiculo
- **SC-002**: Usuarios ADM/ORG conseguem vincular uma pessoa a um veiculo em ate 3 cliques a partir do detalhe do veiculo
- **SC-003**: A informacao de estacionamento e pessoas vinculadas e visivel instantaneamente (sem recarregamento) apos qualquer alteracao
- **SC-004**: 100% dos perfis autorizados (ADM, ORG, CRD, EQP, OPC, REC) conseguem visualizar os vinculos sem encontrar erros de permissao

## Assumptions

- O backend ja possui os endpoints necessarios (`PUT /api/veiculos/:id` para atualizar `estacionamento_id`, e `POST /api/veiculos/:id/pessoas` / `DELETE /api/veiculos/:id/pessoas/:pessoaId`) — trata-se principalmente de implementacao frontend
- O componente `VinculoVeiculo` (usado em PessoaDetalhe) pode ser reutilizado ou adaptado para o fluxo inverso (veiculo -> pessoas)
- O seletor de estacionamento segue o mesmo padrao do componente `EstacionamentoPessoa` ja existente
- Perfis autorizados seguem as regras de autorizacao existentes: ADM/ORG para escrita, todos os perfis autenticados para leitura
