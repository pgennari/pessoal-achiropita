# Feature Specification: Check-in nos Estacionamentos

**Feature Branch**: `006-estacionamento-checkin`

**Created**: 2026-07-25

**Status**: Draft

**Input**: User description: "Criar um controle de 'check-in' nos estacionamentos. Cada estacionamento deve ter um link publico, acessivel sem precisar de login. Neste link o usuario ira pesquisar a placa do carro, deve trazer as pessoas associadas ao carro. O usuario ira clicar em check-in na pessoa que esta apresentando o carro. O sistema deve mostrar um modal com data e hora, os dados do carro, pessoa e o estacionamento para confirmar o check-in. Na area logada do sistema, os detalhes do estacionamento deve ter uma secao de controle dos check-in realizados nos estacionamento, agrupados por data."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Realizar check-in via link publico (Priority: P1)

**Como** operador de estacionamento (pode ser qualquer pessoa com o link),
**quero** acessar um link publico do estacionamento, pesquisar a placa do carro e registrar o check-in da pessoa que esta apresentando o carro,
**para** controlar quem entrou no estacionamento e quando.

**Por que esta prioridade**: Funcionalidade principal da feature — sem ela nao existe controle de check-in.

**Teste independente**: Pode ser testado acessando a URL publica de qualquer estacionamento, digitando uma placa valida e confirmando o check-in.

**Cenarios de aceite**:

1. **Dado** que o operador acessa o link publico do estacionamento, **Quando** a pagina carrega, **Entao** exibe o nome do estacionamento e um campo de busca por placa.
2. **Dado** que o operador digita uma placa existente, **Quando** a busca retorna resultados, **Entao** exibe as pessoas associadas a aquele carro com um botao de "Check-in" ao lado de cada uma — se o carro ja possui check-in registrado no estacionamento, todos os botoes devem aparecer desabilitados com indicativo visual.
3. **Dado** que o operador clica em "Check-in" de uma pessoa, **Quando** o clique acontece, **Entao** exibe um modal de confirmacao com data/hora atual, dados do carro, nome da pessoa e nome do estacionamento.
4. **Dado** que o operador confirma o check-in no modal, **Quando** a confirmacao e registrada, **Entao** o sistema salva o registro de check-in e exibe uma mensagem de sucesso.
5. **Dado** que o operador digita uma placa inexistente, **Quando** a busca nao encontra resultados, **Entao** exibe mensagem informando que nenhuma pessoa foi encontrada para aquela placa.
6. **Dado** que o operador tenta realizar check-in de uma pessoa cuja carro ja possui check-in registrado, **Quando** ele seleciona a pessoa, **Entao** o sistema bloqueia a operacao e exibe mensagem informando que aquele carro ja realizou check-in.

---

### User Story 2 - Visualizar historico de check-in no detalhe do estacionamento (Priority: P2)

**Como** ADM ou ORG,
**quero** visualizar na tela de detalhes do estacionamento a lista de check-ins realizados, agrupados por data,
**para** monitorar a operacao e ter visibilidade de quem passou pelo estacionamento.

**Por que esta prioridade**: Complementa a US-01 — sem o historico o operador nao consegue auditar as entradas.

**Teste independente**: Pode ser testado acessando a tela de detalhes do estacionamento e verificando que a secao de check-ins aparece com os registros agrupados por data.

**Cenarios de aceite**:

1. **Dado** que existem check-ins registrados para o estacionamento, **Quando** o usuario acessa o detalhe, **Entao** exibe uma secao "Check-ins" com os registros agrupados por data (data mais recente primeiro).
2. **Dado** que um grupo de check-ins do mesmo dia e exibido, **Quando** o usuario visualiza, **Entao** cada registro mostra: hora do check-in, nome da pessoa, placa do carro e modelo/cor.
3. **Dado** que nao existem check-ins para o estacionamento, **Quando** o usuario acessa o detalhe, **Entao** a secao de check-ins exibe "Nenhum check-in registrado."
4. **Dado** que o usuario esta na secao de check-ins, **Quando** ele visualiza os dados, **Entao** os check-ins estao ordenados por hora (mais recente primeiro) dentro de cada dia.

---

### User Story 3 - Gerenciar link publico do estacionamento (Priority: P3)

**Como** ADM ou ORG,
**quero** visualizar e copiar o link publico do estacionamento a partir da tela de detalhes,
**para** compartilhar com os operadores de estacionamento.

**Por que esta prioridade**: Necessario para que os operadores possam acessar a pagina de check-in.

**Teste independente**: Pode ser testado acessando a tela de detalhes do estacionamento e verificando que o link publico esta disponivel para copia.

**Cenarios de aceite**:

1. **Dado** que o usuario esta na tela de detalhes do estacionamento, **Quando** ele visualiza a secao do link publico, **Entao** exibe o link completo com botao para copiar.
2. **Dado** que o usuario clica em "Copiar link", **Quando** o clique acontece, **Entao** o link e copiado para a area de transferencia e exibe feedback visual de sucesso.
3. **Dado** que o usuario esta listando estacionamentos, **Quando** ele visualiza os cards, **Entao** cada card exibe um icone ou indicador de que o link publico esta disponivel.

---

### Edge Cases

- O que acontece quando o token do link publico e invalido ou expirado? O sistema deve exibir mensagem de erro amigavel e nao permitir busca.
- O que acontece quando a pessoa associada ao carro foi inativada? O check-in deve ser permitido mesmo assim (a pessoa ja estava no sistema quando associada ao carro).
- O que acontece quando o operador tenta fazer check-in de uma pessoa de outro estacionamento? Isso nao deve ser possivel — o link publico e especifico de um estacionamento, e as pessoas listadas sao apenas as associadas a ele.
- O que acontece se o estacionamento for excluido? Os check-ins devem ser mantidos para historico, mas o link publico deixa de funcionar.
- Multiplas pessoas no mesmo carro — o operador deve conseguir fazer check-in de qualquer uma delas individualmente, mas uma vez feito o check-in por qualquer pessoa, todas as pessoas daquele carro ficam com o botao desabilitado.
- Carro ja fez check-in — ao pesquisar a placa, todas as pessoas associadas ao carro devem exibir o botao de check-in desabilitado.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Cada estacionamento DEVE possuir um link publico unico e estavel, acessivel sem autenticacao.
- **FR-002**: O link publico DEVE exibir o nome do estacionamento e um campo de busca por placa.
- **FR-003**: A busca por placa DEVE retornar apenas as pessoas associadas ao estacionamento que possuem carro com aquela placa — carros de pessoas nao associadas ao estacionamento NAO devem aparecer.
- **FR-004**: A busca DEVE funcionar com a placa completa ou com parte dela (busca parcial).
- **FR-005**: Cada pessoa resultante DEVE exibir um botao de "Check-in" — se o carro associado ja possui check-in registrado no estacionamento, o botao deve aparecer desabilitado.
- **FR-006**: Ao clicar em "Check-in", o sistema DEVE exibir um modal de confirmacao com: data e hora atual, dados do carro (placa, modelo, cor), nome da pessoa e nome do estacionamento.
- **FR-007**: Ao confirmar no modal, o sistema DEVE registrar o check-in com: timestamp, pessoaId, carroId e estacionamentoId.
- **FR-008**: O sistema DEVE exibir mensagem de sucesso apos o check-in confirmado.
- **FR-009**: Na tela de detalhes do estacionamento (area logada), DEVE existir uma secao "Check-ins" com os registros agrupados por data.
- **FR-010**: Dentro de cada grupo de data, os check-ins DEVEM estar ordenados por hora (mais recente primeiro).
- **FR-011**: Cada registro de check-in na listagem DEVE exibir: hora, nome da pessoa, placa do carro e modelo/cor.
- **FR-012**: O link publico do estacionamento DEVE ser visivel e copiavel na tela de detalhes do estacionamento (area logada).
- **FR-013**: O check-in e unico por carro — o sistema NAO DEVE permitir check-in de qualquer pessoa associada a um carro que ja possui check-in registrado no estacionamento.
- **FR-014**: O link publico DEVE ser invalidado se o estacionamento for excluido.
- **FR-015**: Antes de permitir o check-in, o sistema DEVE verificar se ja existe check-in para aquele carro no estacionamento — se existir, bloquear e informar.

### Key Entities

- **Check-in**: Registro de entrada no estacionamento. Campos: id, timestamp, pessoaId, pessoaNome, carroId, placa, modelo, cor, estacionamentoId, estacionamentoNome.
- **Estacionamento**: Entidade existente. Ganha um token unico para o link publico de check-in.
- **Pessoa**: Entidade existente. Ja possui lista de carros com campo placa.
- **Carro**: Entidade existente dentro de Pessoa. Campos: fabricante, modelo, placa, cor.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Operador consegue realizar um check-in completo (abrir link, buscar placa, confirmar) em menos de 30 segundos.
- **SC-002**: 100% dos check-ins sao registrados com todos os dados obrigatorios (timestamp, pessoa, carro, estacionamento).
- **SC-003**: O historico de check-ins no detalhe do estacionamento carrega e exibe todos os registros sem erro.
- **SC-004**: O link publico e acessivel em qualquer dispositivo (responsivo) e funciona sem necessidade de login.
- **SC-005**: Busca por placa retorna resultados em menos de 2 segundos para estacionamentos com ate 500 pessoas associadas.

## Assumptions

- O link publico utiliza um token unico por estacionamento, gerado no cadastro.
- A busca por placa filtra as pessoas associadas ao estacionamento especifico.
- A tela publica de check-in e sempre acessada sem login — nao ha identificacao do operador.
- Nao ha necessidade de autenticacao para o link publico — a seguranca depende da imprevisibilidade do token.
- Check-ins sao registros append-only (nao sao editados nem excluidos por usuarios).
- A pessoa associada ao carro pode estar inativada — o check-in continua sendo registrado (a associacao ja existia).
- A busca por placa opera sobre a lista de pessoas ja associadas ao estacionamento.
- A agrupacao por data na tela de detalhes usa a data local do timestamp do check-in.

## Clarifications

### Session 2026-07-25

- Q: A busca por placa deve retornar carros de todo o sistema ou apenas os associados ao estacionamento? → A: Apenas carros de pessoas associadas ao estacionamento.
- Q: E permitido mais de um check-in por pessoa no mesmo dia? → A: Nao — o check-in e unico por carro. Uma vez feito por qualquer pessoa associada ao veiculo, todas as pessoas daquele carro ficam com o botao desabilitado.
- Q: O check-in deve registrar o operador que fez o check-in? → A: Nao — a tela publica e sempre acessada sem login, sem identificacao do operador.
