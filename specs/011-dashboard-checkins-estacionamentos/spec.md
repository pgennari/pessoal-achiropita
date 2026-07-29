# Feature Specification: Dashboard de Check-ins em Tempo Real

**Feature Branch**: `011-dashboard-checkins-estacionamentos`

**Created**: 2026-07-28

**Status**: Draft

**Input**: User description: "Criar um dashboard para acompanhar os check-ins nos estacionamentos em tempo real. Deve mostrar todos os estacionamentos e baseado nos veiculos associados e vagas contratadas, mostrar o quao cheio cada estacionamento esta. Numa secao abaixo, deve mostrar os ultimos check-ins realizados. A cada check-in realizado, deve ter algum indicativo visual bem chamativo, informando os dados do check-in. A intencao e manter esse dashboard aberto em uma tela no centro de gestao de estacionamentos."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visualizar ocupacao dos estacionamentos em tempo real (Priority: P1)

**Como** gestor no centro de monitoramento,
**quero** ver todos os estacionamentos em uma unica tela, com indicadores visuais de quao cheio cada um esta,
**para** identificar rapidamente quais estacionamentos estao proximos da capacidade maxima e tomar decisoes operacionais.

**Por que esta prioridade**: Funcionalidade central do dashboard — sem ela nao ha monitoramento de ocupacao.

**Teste independente**: Pode ser testado acessando o dashboard e verificando que todos os estacionamentos aparecem com sua ocupacao calculada e visivel.

**Cenarios de aceite**:

1. **Dado** que o usuario acessa o dashboard, **Quando** a pagina carrega, **Entao** exibe todos os estacionamentos cadastrados em formato de cards ou linhas, cada um com nome, endereco, vagas contratadas e ocupacao atual.
2. **Dado** que um estacionamento possui ocupacao calculada, **Quando** o indicador e exibido, **Entao** mostra a porcentagem de ocupacao (numero de check-ins realizados hoje / vagas contratadas) com codigo de cores: verde (ate 50%), amarelo (51% a 80%), vermelho (acima de 80%).
3. **Dado** que um estacionamento tem 0 vagas contratadas, **Quando** o dashboard exibe, **Entao** mostra indicacao "N/A" ou "Sem vagas contratadas" em vez de uma porcentagem.
4. **Dado** que o dashboard esta aberto, **Quando** um novo check-in e registrado em qualquer estacionamento, **Entao** a ocupacao daquele estacionamento atualiza automaticamente sem necessidade de recarregar a pagina.
5. **Dado** que nao existem estacionamentos cadastrados, **Quando** o usuario acessa o dashboard, **Entao** exibe mensagem "Nenhum estacionamento cadastrado."

---

### User Story 2 - Visualizar ultimos check-ins realizados (Priority: P2)

**Como** gestor no centro de monitoramento,
**quero** ver uma lista dos check-ins mais recentes em todos os estacionamentos,
**para** acompanhar quem esta entrando e ter visibilidade da operacao em tempo real.

**Por que esta prioridade**: Complementa a US-01 — a ocupacao mostra o quadro geral, mas os check-ins individuais dao visibilidade operacional.

**Teste independente**: Pode ser testado verificando que a secao de check-ins recentes aparece no dashboard com os registros mais recentes.

**Cenarios de aceite**:

1. **Dado** que existem check-ins registrados, **Quando** o usuario visualiza o dashboard, **Entao** exibe uma secao "Ultimos check-ins" com os 20 registros mais recentes (valor fixo), independente do estacionamento.
2. **Dado** que a secao de check-ins e exibida, **Quando** o usuario le os registros, **Entao** cada linha mostra: data/hora, nome da pessoa, placa do veiculo, modelo/cor e nome do estacionamento.
3. **Dado** que nao existem check-ins registrados hoje, **Quando** o usuario visualiza a secao, **Entao** exibe "Nenhum check-in realizado hoje."
4. **Dado** que o dashboard esta aberto, **Quando** um novo check-in acontece, **Entao** a lista de check-ins recentes se atualiza automaticamente com o novo registro no topo.

---

### User Story 3 - Receber notificacao visual de novo check-in (Priority: P2)

**Como** gestor no centro de monitoramento,
**quero** ser alertado visualmente de forma chamativa sempre que um novo check-in e registrado,
**para** nao perder nenhuma entrada mesmo que nao esteja olhando diretamente para a lista de check-ins.

**Por que esta prioridade**: Essencial para o proposito do dashboard — garantir que cada entrada seja percebida pela equipe de gestao.

**Teste independente**: Pode ser testado realizando um check-in externamente e observando se o indicativo visual aparece no dashboard.

**Cenarios de aceite**:

1. **Dado** que o dashboard esta aberto e um novo check-in e registrado, **Quando** a notificacao e exibida, **Entao** aparece um indicativo visual proeminente (ex.: toast/banner no topo da tela, animacao, flash) com os dados: nome da pessoa, placa, estacionamento e horario.
2. **Dado** que a notificacao foi exibida, **Quando** o tempo de exibicao termina (ex.: 5 segundos), **Entao** a notificacao desaparece automaticamente sem acao do usuario.
3. **Dado** que multiplos check-ins acontecem em sequencia rapida, **Quando** as notificacoes sao exibidas, **Entao** cada notificacao aparece e some independentemente, sem acumular ou causar sobreposicao ilegivel.
4. **Dado** que uma notificacao de check-in esta ativa, **Quando** o usuario interage com ela (clica/toca), **Entao** a notificacao desaparece imediatamente.

---

### Edge Cases

- O que acontece se a conexao persistente (WebSocket/SSE) cai? O dashboard deve continuar exibindo os ultimos dados carregados, tentar reconectar automaticamente e exibir um indicativo visual de que a conexao foi perdida (ex.: "Atualizacao pausada - reconectando..."). Ao reconectar, deve buscar o estado atual completo para evitar lacunas.
- O que acontece se muitos check-ins acontecem simultaneamente (ex.: horario de pico)? As notificacoes devem ser exibidas em fila, uma de cada vez ou com empilhamento controlado, sem travar a interface.
- O que acontece se um estacionamento e excluido enquanto o dashboard esta aberto? O backend deve emitir um evento `estacionamento-excluido` no SSE para que o frontend remova o card imediatamente. Em caso de reconexao, o estado completo e obtido via GET /api/estacionamentos/dashboard.
- O que acontece se a ocupacao de um estacionamento ultrapassa 100% (mais check-ins que vagas contratadas)? O indicador deve mostrar o valor real (ex.: 120%) e manter a cor vermelha — o numero de check-ins pode superar vagas contratadas em situacoes excepcionais.
- O que acontece quando um estacionamento tem check-ins de dias anteriores? A ocupacao e calculada apenas com check-ins do dia atual — check-ins de dias anteriores nao contam para a ocupacao.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O dashboard DEVE exibir todos os estacionamentos cadastrados, cada um com: nome, endereco, numero de vagas contratadas e ocupacao percentual.
- **FR-002**: A ocupacao percentual DEVE ser calculada como: (numero de check-ins unicos do dia atual / vagas contratadas) * 100.
- **FR-003**: Cada estacionamento DEVE ter um indicador visual de ocupacao com codigo de cores: verde (ate 50%), amarelo (51% a 80%), vermelho (acima de 80%).
- **FR-004**: O dashboard DEVE incluir uma secao "Ultimos check-ins" listando os 20 registros mais recentes (valor fixo) de todos os estacionamentos, ordenados do mais recente para o mais antigo.
- **FR-005**: Cada registro na lista de ultimos check-ins DEVE exibir: data/hora, nome da pessoa, placa, modelo/cor e nome do estacionamento.
- **FR-006**: O dashboard DEVE receber atualizacoes dos dados de ocupacao e check-ins atraves de push do backend — o backend DEVE enviar uma notificacao ao frontend sempre que um check-in for registrado, sem necessidade de polling.
- **FR-007**: Ao receber a notificacao de novo check-in vinda do backend, o sistema DEVE exibir uma notificacao visual proeminente contendo: nome da pessoa, placa do veiculo, nome do estacionamento e horario do check-in, e DEVE atualizar os dados de ocupacao e a lista de check-ins na tela.
- **FR-008**: A notificacao visual DEVE desaparecer automaticamente apos um periodo curto (ex.: 5 segundos) OU ao clique do usuario.
- **FR-009**: O dashboard DEVE ser acessivel apenas para usuarios logados com perfil ADM ou ORG.
- **FR-010**: Se a conexao com o servidor for perdida, o dashboard DEVE exibir os ultimos dados carregados e mostrar um indicador de "sem conexao" ou "atualizacao pausada".
- **FR-011**: Estacionamentos com 0 vagas contratadas DEVEM exibir "N/A" como ocupacao, sem indicador de cor.
- **FR-012**: O dashboard DEVE ser otimizado para exibicao em tela widescreen (monitor de centro de gestao), com layout em grid de ate 4 colunas para estacionamentos com cards de proporcao igual, resolucao minima 1280x720, aproveitando o espaco horizontal.

### Key Entities *(include if feature involves data)*

- **Checkin**: Entidade existente. Representa o registro de entrada de um veiculo em um estacionamento. Para o dashboard, sao consultados os check-ins do dia atual para calcular ocupacao e alimentar a lista de recentes.
- **Estacionamento**: Entidade existente. Cada estacionamento possui `vagasContratadas` que serve como denominador no calculo de ocupacao.
- **Veiculo**: Entidade existente. Associado a check-ins para exibir placa, modelo e cor na lista de recentes e na notificacao.
- **Pessoa**: Entidade existente. Associada a check-ins via `pessoaNome` para exibir o nome da pessoa que realizou o check-in.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Gestor consegue visualizar a ocupacao de todos os estacionamentos em menos de 3 segundos apos abrir o dashboard.
- **SC-002**: A ocupacao e a lista de check-ins refletem um novo check-in registrado em ate 3 segundos apos o registro no backend (latencia de entrega da notificacao push).
- **SC-003**: Notificacao visual de novo check-in e percebida e legivel em um monitor de centro de gestao a uma distancia de 2 metros.
- **SC-004**: Dashboard mantem-se atualizado continuamente por 8 horas sem travamentos ou perda de dados visiveis.
- **SC-005**: 100% dos check-ins registrados durante a operacao sao exibidos na lista de ultimos check-ins e refletidos na ocupacao do estacionamento correspondente.

## Assumptions

- A ocupacao e calculada com base nos check-ins do dia atual (data do servidor), nao em dados historicos.
- A atualizacao dos dados e orientada a eventos (push do backend), nao por polling — o frontend mantem uma conexao persistente (SSE — Server-Sent Events, conforme decisao tecnica documentada em research.md) para receber notificacoes em tempo real.
- A notificacao visual e implementada como um toast/banner no topo da tela, com duracao de 5 segundos.
- O dashboard e acessado exclusivamente por usuarios logados (ADM/ORG) — nao ha versao publica.
- A lista de ultimos check-ins mostra 20 registros (valor fixo).
- O dashboard e otimizado para monitores widescreen (1920x1080 ou maior) — nao ha requisito de responsivo para dispositivos moveis.
- Estacionamentos com 0 vagas contratadas exibem "N/A" — nao e possivel calcular ocupacao sem denominador.
- O sistema ja possui os endpoints de API necessarios para consultar estacionamentos e check-ins (existentes no backend).

## Clarifications

### Session 2026-07-28

- Q: O metodo de atualizacao deve ser polling ou push? → A: Push. O backend deve enviar a atualizacao ao frontend sempre que um check-in for registrado, sem polling do frontend.
