# Tasks: Dashboard de Check-ins em Tempo Real

**Input**: Design documents from `/specs/011-dashboard-checkins-estacionamentos/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/dashboard-api.md

**Tests**: Nao incluidos — sem test runner configurado no projeto.

**Organization**: Tasks agrupados por user story para implementacao e validacao independente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependencias)
- **[Story]**: Qual user story o task pertence (US1, US2, US3)
- Incluir caminhos exatos dos arquivos nas descricoes

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Inicializacao do projeto e configuracao basica

- [x] T001 [P] Criar arquivo de tipos do dashboard `src/lib/dashboard.ts` com interfaces `EstacionamentoComOcupacao`, `CheckinResumo`, `DashboardInicial`
- [x] T002 [P] Criar singleton EventEmitter em `api/src/eventos.ts` para emitir eventos de check-in

**Checkpoint**: Infrastructure ready — types defined, event bus available.

---

## Phase 2: User Story 1 — Visualizar ocupacao dos estacionamentos (Priority: P1) 🎯 MVP

**Goal**: Gestor ve todos os estacionamentos em tela unica com indicadores visuais de ocupacao

**Independent Test**: Acessar `/dashboard/estacionamentos` logado como ADM/ORG e confirmar que todos os estacionamentos aparecem com nome, endereco, vagas contratadas e barra/indicador de ocupacao colorido.

### Implementation for User Story 1

- [x] T003 [US1] Implementar `GET /api/estacionamentos/dashboard` em `api/src/rotas/dashboard.ts` — endpoint autenticado (comAuth, perfis ADM/ORG), query agregada que retorna estacionamentos com `checkins_hoje` e `ocupacaoPercentual`
- [x] T004 [US1] Registrar rota `app.route("/api/estacionamentos/dashboard", dashboard)` em `api/src/index.ts`
- [x] T005 [P] [US1] Adicionar hook `useDashboardEstacionamentos` em `src/lib/hooks.ts` usando `useQuery` para `GET /api/estacionamentos/dashboard`
- [x] T006 [P] [US1] Criar componente `CardOcupacao` em `src/components/CardOcupacao.tsx` — card individual exibindo nome, endereco, vagas contratadas e barra de ocupacao colorida (verde/amarelo/vermelho)
- [x] T007 [US1] Criar pagina `DashboardEstacionamentos` em `src/pages/DashboardEstacionamentos.tsx` — renderiza grade de `CardOcupacao` usando `useDashboardEstacionamentos`
- [x] T008 [US1] Adicionar rota `path="dashboard/estacionamentos"` apontando para `<DashboardEstacionamentos />` em `src/App.tsx`

**Checkpoint**: US1 completo — dashboard estatico funcional com ocupacao de todos os estacionamentos.

---

## Phase 3: User Story 2 — Visualizar ultimos check-ins realizados (Priority: P2)

**Goal**: Gestor ve lista dos check-ins mais recentes em todos os estacionamentos

**Independent Test**: Apos US1 funcionando, conferir se ha secao "Ultimos check-ins" abaixo dos cards, com registros do dia (ou "Nenhum check-in realizado hoje").

### Implementation for User Story 2

- [x] T009 [P] [US2] Incluir `ultimosCheckins` no retorno de `GET /api/estacionamentos/dashboard` em `api/src/rotas/dashboard.ts` — query `SELECT ... FROM checkins WHERE data = CURRENT_DATE ORDER BY timestamp DESC` (sem limite, todos os check-ins do dia)
- [x] T010 [P] [US2] Criar componente `ListaCheckinsRecentes` em `src/components/ListaCheckinsRecentes.tsx` — tabela com data/hora, pessoaNome, placa, modelo/cor, estacionamentoNome
- [x] T011 [US2] Integrar `ListaCheckinsRecentes` na pagina `src/pages/DashboardEstacionamentos.tsx` abaixo dos cards de ocupacao

**Checkpoint**: US2 completo — lista de check-ins recentes visivel no dashboard.

---

## Phase 4: User Story 3 — Receber notificacao visual de novo check-in (Priority: P2)

**Goal**: Gestor e alertado visualmente sempre que um novo check-in e registrado

**Independent Test**: Realizar check-in via link publico em outra aba e observar notificacao toast aparecendo no dashboard com dados do check-in.

### Implementation for User Story 3

- [x] T012 [US3] Emitir evento `checkin` no `EventEmitter` apos INSERT bem-sucedido em `api/src/rotas/checkin.ts` — importar `eventos` e chamar `emit("checkin", dados)` no handler POST
- [x] T013 [US3] Adicionar endpoint SSE `GET /api/estacionamentos/dashboard/eventos` em `api/src/rotas/dashboard.ts` — autenticado via `comAuth`, token na query string, mantem conexao streaming com heartbeat a cada 30s
- [x] T014 [P] [US3] Adicionar cliente SSE em `src/lib/dashboard.ts` — funcao `conectarDashboardSSE(token, onCheckin, onStatus)` que abre `EventSource` com token na query string e gerencia reconexao
- [x] T015 [P] [US3] Criar componente `NotificacaoCheckin` em `src/components/NotificacaoCheckin.tsx` — toast/banner no topo com dados do check-in, auto-dismiss apos 5s, dismissivel ao clique
- [x] T016 [US3] Integrar SSE + notificacao na pagina `src/pages/DashboardEstacionamentos.tsx` — conectar SSE apos carregar dados iniciais, exibir `NotificacaoCheckin` ao receber evento, atualizar estado local (ocupacao + lista)

**Checkpoint**: US3 completo — notificacoes em tempo real funcionando via SSE.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Melhorias que afetam multiplas user stories

- [x] T017 [P] Adicionar indicador de status da conexao SSE (conectado/desconectado/reconectando) no cabecalho do dashboard em `src/pages/DashboardEstacionamentos.tsx`
- [x] T018 Tratar estado vazio (nenhum estacionamento cadastrado) em `src/pages/DashboardEstacionamentos.tsx`
- [x] T019 Otimizar layout para widescreen em `src/pages/DashboardEstacionamentos.tsx` — grid responsivo, maximo aproveitamento horizontal
- [x] T020 Rodar quickstart.md para validacao manual completa

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependencias — pode comecar imediatamente
- **US1 (Phase 2)**: Depende de T001 (tipos) concluido
- **US2 (Phase 3)**: Depende de US1 (Phase 2) — adiciona dados ao endpoint existente e componente novo
- **US3 (Phase 4)**: Depende de T002 (EventEmitter) e de US1+US2 (Phase 2+3) — adiciona camada de tempo real
- **Polish (Phase 5)**: Depende de todos os US estarem completos

### User Story Dependencies

- **US1 (P1)**: Pode comecar apos Setup — MVP independente
- **US2 (P2)**: Depende do endpoint de US1 — estende o retorno e adiciona UI
- **US3 (P2)**: Depende de US1+US2 — adiciona SSE e notificacao sobre a base existente

### Within Each User Story

- Tipos/interface antes da implementacao
- Backend endpoints antes do frontend consumir
- Componentes UI independentes antes da integracao na pagina

### Parallel Opportunities

| Task ID | Pairs with | Why |
|---------|-----------|-----|
| T001 | T002 | Arquivos independentes (frontend types vs backend event bus) |
| T005 | T006 | Hook React vs componente UI — sem dependencia mutua |
| T009 | T010 | Query SQL no backend vs componente React — independentes |
| T014 | T015 | Cliente SSE vs componente de notificacao — independentes |
| T017 | — | Independente de outros polish tasks |

---

## Parallel Example: User Story 1

```bash
# Models/services independentes:
Task: "Criar hook useDashboardEstacionamentos em src/lib/hooks.ts"
Task: "Criar componente CardOcupacao em src/components/CardOcupacao.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup (T001, T002)
2. Phase 2: US1 (T003-T008)
3. **STOP and VALIDATE**: Dashboard estatico com ocupacao — funcional e testavel
4. Deploy/demo se desejado

### Incremental Delivery

1. Setup + US1 → Dashboard estatico funcional (MVP!)
2. Add US2 → Lista de check-ins recentes
3. Add US3 → Notificacoes em tempo real via SSE
4. Add Polish → Indicador de conexao, estados vazios, layout widescreen

### Parallel Team Strategy

1. Dev A: T001 (types) + T002 (EventEmitter)
2. Dev A: US1 backend (T003-T004)
3. Dev B (paralelo): US1 frontend (T005-T008)
4. Dev A: US2 backend (T009)
5. Dev B: US2 frontend (T010-T011)
6. Dev A: US3 backend (T012-T013)
7. Dev B: US3 frontend (T014-T016)
8. Qualquer dev: Polish (T017-T020)

---

## Notes

- [P] tasks = arquivos diferentes, sem dependencias
- [Story] label mapeia task para user story especifica
- Cada user story e independentemente completavel e testavel
- Commits apos cada task ou grupo logico
- Parar em qualquer checkpoint para validar a historia independentemente
- Nenhuma nova dependencia externa — SSE e EventEmitter sao nativos do Node.js/browser
- Autenticacao SSE: token Firebase via query string (`?token=<id-token>`)
