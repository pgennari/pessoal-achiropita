# Feature Specification: Historico de Check-in no Link Publico

**Feature Branch**: `010-checkin-historico-publico`

**Created**: 2026-07-27

**Status**: Draft

**Input**: User description: "Na link publico de cada estacionamento, ao fazer o check-in de um veiculo o sistema de limpar a lista mostrada durante a busca. Abaixo da listagem da busca, deve ter uma secao 'Ultimos check-ins realizados', mostrando os check-ins com data e hora decrescente. Deve conter tambem, os check-ins dos dias anteriores separados em abas, cada dia em uma aba."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Limpar resultados de busca apos check-in (Priority: P1)

**Como** operador de estacionamento,
**quero** que a lista de resultados de busca seja limpa automaticamente apos confirmar um check-in,
**para** que a tela fique limpa e pronta para o proximo veiculo.

**Por que esta prioridade**: Funcionalidade principal da feature — o operador precisa de um fluxo rapido e repetivel para check-ins em sequencia.

**Teste independente**: Pode ser testado acessando o link publico, buscando uma placa, realizando check-in e verificando que a lista de resultados desaparece.

**Cenarios de aceite**:

1. **Dado** que o operador buscou uma placa e viu resultados, **Quando** ele confirma o check-in de uma pessoa, **Entao** a lista de resultados e removida da tela e o campo de busca fica vazio e focado.
2. **Dado** que o check-in foi realizado com sucesso, **Quando** a tela e atualizada, **Entao** a mensagem de sucesso continua visivel e a secao "Ultimos check-ins realizados" e exibida abaixo da busca.
3. **Dado** que o operador fez check-in e a lista foi limpa, **Quando** ele digita uma nova placa e clica em buscar, **Entao** a busca funciona normalmente com a nova placa.

---

### User Story 2 - Exibir ultimos check-in realizados (Priority: P1)

**Como** operador de estacionamento,
**quero** ver os check-ins mais recentes do estacionamento abaixo do formulario de busca,
**para** conferir rapidamente se o check-in anterior foi registrado corretamente.

**Por que esta prioridade**: Proporciona feedback imediato ao operador e evita duplicacao de check-ins.

**Teste independente**: Pode ser testado acessando o link publico e verificando que a secao "Ultimos check-ins realizados" aparece com os registros ordenados por data e hora decrescente.

**Cenarios de aceite**:

1. **Dado** que o operador acessa o link publico, **Quando** a pagina carrega, **Entao** exibe a secao "Ultimos check-ins realizados" abaixo do formulario de busca, com os check-ins do dia atual ordenados por hora (mais recente primeiro).
2. **Dado** que existem check-ins registrados, **Quando** o operador visualiza a secao, **Entao** cada registro exibe: hora, nome da pessoa, placa do carro e modelo/cor.
3. **Dado** que nenhum check-in foi registrado no dia, **Quando** a pagina e carregada, **Entao** a secao exibe "Nenhum check-in registrado hoje."
4. **Dado** que o operador realizou um check-in, **Quando** a tela e atualizada, **Entao** o check-in recem-criado aparece no topo da lista "Ultimos check-ins realizados".
5. **Dado** que existem check-ins de dias anteriores, **Quando** o operador visualiza a secao, **Entao** os check-ins de hoje sao exibidos por padrao e os check-ins de dias anteriores estao organizados em abas separadas.

---

### User Story 3 - Navegar entre abas de dias anteriores (Priority: P2)

**Como** operador de estacionamento,
**quero** navegar entre abas que representam dias diferentes com check-ins,
**para** consultar o historico de check-ins de dias anteriores sem sair da pagina publica.

**Por que esta prioridade**: Complementa a visualizacao do historico — permite consulta rapida de dias anteriores sem necessidade de acesso ao painel administrativo.

**Teste independente**: Pode ser testado acessando o link publico em um dia seguinte a check-ins anteriores e verificando que as abas de dias anteriores aparecem e funcionam.

**Cenarios de aceite**:

1. **Dado** que existem check-ins de apenas um dia (hoje), **Quando** o operador visualiza a secao de historico, **Entao** nao exibe abas — apenas a lista do dia atual.
2. **Dado** que existem check-ins de dois ou mais dias distintos, **Quando** o operador visualiza a secao de historico, **Entao** exibe abas para cada dia, com a aba do dia atual selecionada por padrao.
3. **Dado** que existem abas de dias anteriores, **Quando** o operador clica em uma aba de dia anterior, **Entao** exibe os check-ins daquele dia ordenados por hora (mais recente primeiro).
4. **Dado** que o operador esta visualizando uma aba de dia anterior, **Quando** ele clica na aba de "Hoje", **Entao** volta a exibir os check-ins do dia atual.
5. **Dado** que as abas estao visiveis, **Quando** o operador visualiza os labels das abas, **Entao** cada aba exibe a data no formato "DD/MM" e o total de check-ins daquele dia (ex: "27/07 (12)").

---

### Edge Cases

- O que acontece quando o token do link publico e invalido ou expirado? A pagina exibe mensagem de erro — o historico nao e carregado.
- O que acontece quando nao existem check-ins para o estacionamento? A secao de historico exibe "Nenhum check-in registrado."
- O que acontece quando o operador acessa o link publico em um dispositivo diferente? O historico e o mesmo — os dados sao compartilhados.
- Todos os check-ins de cada dia sao exibidos, sem limite.
- Check-in e unico por dia — o mesmo carro pode fazer check-in novamente em um dia diferente.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Ao confirmar um check-in, o sistema DEVE limpar a lista de resultados de busca e esvaziar o campo de placa.
- **FR-002**: O campo de placa DEVE receber foco automaticamente apos o check-in para facilitar o proximo registro.
- **FR-003**: A pagina publica DEVE exibir uma secao "Ultimos check-ins realizados" abaixo do formulario de busca.
- **FR-004**: A secao de historico DEVE exibir os check-ins do dia atual por padrao, ordenados por hora decrescente.
- **FR-005**: Cada registro de check-in na listagem DEVE exibir: hora, nome da pessoa, placa do carro e modelo/cor.
- **FR-006**: Quando nao existem check-ins para o dia, a secao DEVE exibir "Nenhum check-in registrado hoje."
- **FR-007**: Quando existem check-ins de dias anteriores, o sistema DEVE exibir abas para cada dia distinto.
- **FR-008**: A aba do dia atual DEVE ser selecionada por padrao.
- **FR-009**: O label de cada aba DEVE exibir a data no formato "DD/MM" e o total de check-ins daquele dia.
- **FR-010**: Ao clicar em uma aba de dia anterior, o sistema DEVE exibir apenas os check-ins daquele dia.
- **FR-011**: Dentro de cada aba, os check-ins DEVEM estar ordenados por hora (mais recente primeiro).
- **FR-012**: O sistema DEVE buscar os dados de historico via API publica (sem autenticacao) usando o token do estacionamento.
- **FR-013**: A secao de historico DEVE atualizar automaticamente apos um check-in ser realizado (sem necessidade de recarregar a pagina).
- **FR-014**: A secao de historico DEVE exibir todos os check-ins registrados, sem limite.
- **FR-015**: Quando existem abas de dias anteriores, as abas DEVEM ser exibidas em ordem cronologica decrescente (dia mais recente primeiro).

### Key Entities

- **Check-in**: Registro de entrada no estacionamento. Campos: id, timestamp, pessoaNome, placa, modelo, cor, estacionamentoNome. Ja existe.
- **HistoricoPublico**: Projecao publica dos check-ins. Exibe apenas dados de exibicao (hora, pessoa, placa, modelo, cor) sem dados sensiveis. Nao inclui estacionamentoId ou pessoaId.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Operador consegue realizar um check-in e ver o historico atualizado em menos de 3 segundos.
- **SC-002**: 100% dos check-in realizados aparecem na secao de historico do dia atual.
- **SC-003**: A navegacao entre abas de dias anteriores funciona sem recarregar a pagina.
- **SC-004**: A secao de historico e responsiva e funciona em qualquer dispositivo.
- **SC-005**: O operador nao precisa recarregar a pagina para ver check-ins novos — a secao atualiza apos cada check-in.

## Assumptions

- O historico publico exibe apenas check-ins do mesmo estacionamento (filtrado pelo token).
- A busca por historico e feita no backend via API publica (sem autenticacao) — a seguranca depende da imprevisibilidade do token.
- A secao de historico e sempre visivel na pagina publica, independentemente de o operador ter feito busca.
- A primeira aba exibida e sempre a do dia atual — nao ha necessidade de "voltar" para a aba de hoje.
- Check-ins sao append-only — nao sao editados nem excluidos por usuarios.
- A agrupacao por data usa a data local do timestamp do check-in.

## Clarifications

### Session 2026-07-27

- O historico publico deve exibir check-ins de todos os dias ou apenas os recentes? → Resposta: Todos os dias disponiveis, separados em abas.
- A secao de historico deve ser visivel sempre ou apenas apos o primeiro check-in? → Resposta: Sempre visivel, mesmo que vazio.
- O limite de 50 check-ins por dia e aceitavel? → Resposta: Nao — listar todos os check-ins, sem limite.
