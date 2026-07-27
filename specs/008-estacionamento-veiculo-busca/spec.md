# Feature Specification: Remocao de Associacao Pessoa-Estacionamento e Busca de Veiculos

**Feature Branch**: `008-estacionamento-veiculo-busca`

**Created**: 2026-07-27

**Status**: Draft

**Input**: User description: "Na tela de Estacionamentos, nao deve ter mais as pessoas associadas. A associacao deve ser feita pelo veiculo. Deve ter uma busca de veiculos, por nome do fabricante, modelo, cor, placa ou dados das pessoas vinculadas ao veiculo (nome ou cracha)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Remover aba de pessoas associadas do estacionamento (Priority: P1)

**Como** ORG ou ADM,
**quero** que a tela de detalhes do estacionamento nao exiba mais a aba de "Pessoas Associadas",
**para** que a associacao entre pessoa e estacionamento seja feita exclusivamente via veiculo.

**Por que esta prioridade**: Essa e a mudanca principal — eliminar a aba de pessoas para forcar o modelo de associacao por veiculo.

**Teste independente**: Pode ser testado acessando a tela de detalhes de qualquer estacionamento e verificando que nao existe mais a aba "Pessoas Associadas".

**Cenarios de aceite**:

1. **Dado** que o usuario esta na tela de detalhes de um estacionamento, **Quando** ele visualiza as abas disponiveis, **Entao** nao existe aba "Pessoas Associadas".
2. **Dado** que o usuario esta na tela de detalhes de um estacionamento, **Quando** ele visualiza as abas disponiveis, **Entao** as abas sao "Check-in" e "Veiculos".
3. **Dado** que existem pessoas diretamente associadas ao estacionamento no banco de dados, **Quando** a tela e carregada, **Entao** essas pessoas nao sao exibidas (dados legados permanecem no banco mas nao sao mostrados).

---

### User Story 2 - Busca de veiculos no detalhe do estacionamento (Priority: P1)

**Como** ORG ou ADM,
**quero** buscar veiculos por fabricante, modelo, cor, placa ou dados das pessoas vinculadas ao veiculo (nome ou cracha),
**para** localizar rapidamente um veiculo ao gerenciar o estacionamento.

**Por que esta prioridade**: Essa e a funcionalidade central que substitui a aba de pessoas — busca por veiculos com filtros abrangentes.

**Teste independente**: Pode ser testado acessando a aba "Veiculos" no detalhe do estacionamento, digitando termos de busca e verificando que os resultados incluem veiculos cujo fabricante, modelo, cor, placa ou dados de pessoas vinculadas correspondem ao termo.

**Cenarios de aceite**:

1. **Dado** que o usuario esta na aba "Veiculos" do estacionamento, **Quando** ele digita um termo de busca, **Entao** o sistema filtra os veiculos por fabricante, modelo, cor ou placa.
2. **Dado** que o usuario digita o nome de uma pessoa vinculada a um veiculo, **Quando** a busca e executada, **Entao** o veiculo vinculado a essa pessoa aparece nos resultados.
3. **Dado** que o usuario digita o numero do cracha de uma pessoa vinculada a um veiculo, **Quando** a busca e executada, **Entao** o veiculo vinculado a essa pessoa aparece nos resultados.
4. **Dado** que o usuario digita um termo que nao corresponde a nenhum veiculo, **Quando** a busca e executada, **Entao** exibe "Nenhum veiculo encontrado".
5. **Dado** que o usuario nao digitou nada na busca, **Quando** a aba e carregada, **Entao** todos os veiculos do estacionamento sao exibidos.
6. **Dado** que a busca retorna veiculos, **Quando** o usuario visualiza cada resultado, **Entao** exibe: fabricante, modelo, cor, placa e nomes das pessoas vinculadas.

---

### User Story 3 - Associar veiculo ao estacionamento a partir do detalhe (Priority: P2)

**Como** ORG ou ADM,
**quero** associar um veiculo ao estacionamento a partir da aba de veiculos no detalhe do estacionamento,
**para** vincular veiculos ao local correto de estacionamento.

**Por que esta prioridade**: Mantem a funcionalidade ja existente de associar veiculos, agora com busca aprimorada.

**Teste independente**: Pode ser testado acessando a aba "Veiculos" e usando o campo de busca para localizar e associar um veiculo.

**Cenarios de aceite**:

1. **Dado** que o usuario esta na aba "Veiculos" do estacionamento, **Quando** ele busca por um veiculo nao associado, **Entao** o resultado exibe botao "Associar".
2. **Dado** que o usuario clica em "Associar" em um veiculo, **Quando** a operacao e concluida, **Entao** o veiculo aparece na lista de associados do estacionamento.
3. **Dado** que o veiculo ja esta associado a outro estacionamento, **Quando** o usuario tenta associar, **Entao** o sistema transfere o veiculo para o novo estacionamento (desassociando do anterior).
4. **Dado** que o usuario e EQP, **Quando** ele acessa a aba "Veiculos", **Entao** ele nao ve opcao de associar (somente leitura).

---

### User Story 4 - Desassociar veiculo do estacionamento (Priority: P2)

**Como** ORG ou ADM,
**quero** remover um veiculo da lista de associados ao estacionamento,
**para** corrigir erros de associacao ou quando o veiculo nao sera utilizado.

**Por que esta prioridade**: Permite desfazer associacoes incorretas.

**Teste independente**: Pode ser testado acessando a aba "Veiculos" e clicando em "Remover" ao lado de um veiculo associado.

**Cenarios de aceite**:

1. **Dado** que existe um veiculo associado ao estacionamento, **Quando** o usuario clica em "Remover", **Entao** o veiculo e desvinculado do estacionamento.
2. **Dado** que o veiculo foi removido, **Quando** a lista e atualizada, **Entao** o veiculo nao aparece mais como associado.
3. **Dado** que o usuario e EQP, **Quando** ele visualiza a lista de veiculos, **Entao** nao ve o botao "Remover".

---

### User Story 5 - Visualizar veiculos vinculados a pessoas no detalhe do estacionamento (Priority: P3)

**Como** ORG ou ADM,
**quero** ver quais pessoas estao vinculadas a cada veiculo listado no estacionamento,
**para** identificar rapidamente quem e responsavel por cada veiculo.

**Por que esta prioridade**: Informacao consultiva — util para operacao diaria, mas nao requer acao imediata.

**Teste independente**: Pode ser testado acessando a aba "Veiculos" e verificando que os nomes das pessoas vinculadas aparecem em cada veiculo listado.

**Cenarios de aceite**:

1. **Dado** que um veiculo possui pessoas vinculadas, **Quando** o usuario visualiza o veiculo na lista, **Entao** os nomes das pessoas aparecem abaixo dos dados do veiculo.
2. **Dado** que um veiculo nao possui pessoas vinculadas, **Quando** o usuario visualiza o veiculo na lista, **Entao** nao exibe secao de pessoas.

---

### Edge Cases

- O que acontece quando um veiculo e removido do sistema? O veiculo deve ser removido automaticamente da lista de associados do estacionamento.
- O que acontece quando uma pessoa vinculada a um veiculo e inativada? O veiculo continua aparecendo na lista do estacionamento.
- Uma pessoa pode ter multiplos veiculos associados ao mesmo estacionamento? Sim — nao ha restricao.
- Um veiculo pode estar associado a mais de um estacionamento ao mesmo tempo? Nao — apenas um por veiculo (campo `estacionamento_id` unico).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Sistema DEVE remover a aba "Pessoas Associadas" da tela de detalhes do estacionamento.
- **FR-002**: Sistema DEVE manter apenas as abas "Check-in" e "Veiculos" na tela de detalhes do estacionamento.
- **FR-003**: Sistema DEVE disponibilizar campo de busca na aba "Veiculos" do estacionamento.
- **FR-004**: Sistema DEVE filtrar veiculos por fabricante, modelo, cor e placa.
- **FR-005**: Sistema DEVE filtrar veiculos por nome ou numero de cracha de pessoas vinculadas ao veiculo.
- **FR-006**: Sistema DEVE exibir fabricante, modelo, cor, placa e nomes de pessoas vinculadas em cada resultado de busca.
- **FR-007**: Sistema DEVE permitir associar veiculos ao estacionamento a partir da aba de veiculos.
- **FR-008**: Sistema DEVE permitir desassociar veiculos do estacionamento.
- **FR-009**: Sistema DEVE exibir "Nenhum veiculo encontrado" quando a busca nao retorna resultados.
- **FR-010**: Apenas usuarios com perfil ORG ou ADM DEVEM poder associar/desassociar veiculos.
- **FR-011**: Usuarios EQP DEVEM visualizar a lista de veiculos associados (somente leitura).
- **FR-012**: Sistema DEVE transferir veiculo automaticamente ao associar a novo estacionamento (desassociando do anterior).

### Key Entities

- **Estacionamento**: Local de estacionamento com vagas contratadas e distribuidas. Campos: nome, endereco, vagas, horarios.
- **Veiculo**: Veiculo cadastrado no sistema. Campos: fabricante, modelo, placa, cor. Campo `estacionamento_id` indica o estacionamento associado.
- **Pessoa-Veiculo**: Relacao N:N entre pessoas e veiculos. Cada veiculo pode ter multiplas pessoas vinculadas.
- **VeiculoComPessoas**: Projecao que inclui dados do veiculo e lista de pessoas vinculadas (id, nome, cracha).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: ORG/ADM podem localizar um veiculo especifico na lista do estacionamento em menos de 10 segundos usando busca.
- **SC-002**: A busca retorna resultados precisos para qualquer campo: fabricante, modelo, cor, placa, nome de pessoa ou cracha.
- **SC-003**: 100% dos veiculos associados ao estacionamento aparecem na aba "Veiculos" com dados completos.
- **SC-004**: A aba "Pessoas Associadas" nao e mais acessivel na tela de detalhes do estacionamento.

## Assumptions

- A aba "Pessoas Associadas" sera completamente removida — nao havera migracao de dados legados (pessoas diretamente associadas ao estacionamento serao ignoradas na UI).
- A busca sera feita no cliente (frontend) usando os veiculos ja carregados, incluindo dados de pessoas vinculadas.
- O campo `estacionamento_id` na tabela `veiculos` ja existe e e utilizado para a associacao veiculo-estacionamento.
- A funcao `useVeiculosEstacionamento` ja retorna `VeiculoComPessoas[]` com dados de pessoas vinculadas.
- A funcionalidade de busca de veiculos existente no campo de associacao (botoes simples) sera substituida por um campo de busca com filtro.
