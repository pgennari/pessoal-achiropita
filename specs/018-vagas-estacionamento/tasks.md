# Tasks: Vagas de Estacionamento

**Input**: Design documents from `/specs/018-vagas-estacionamento/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/ (present)

**Tests**: Nenhum test runner configurado (AGENTS.md) e a spec nao solicita testes automatizados. Validacao por build (`npm run lint` = `tsc -b --noEmit`, `npm run build` = `tsc -b && vite build`, `api/` npm run build = `tsc`), validacao manual em quickstart.md e criterios de teste independente por historia.

**Organization**: Tasks grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Inicializacao leve da feature (projeto ja existente, sem dependencias novas)

- [X] T001 Criar branch de feature `018-vagas-estacionamento` a partir de `claude/restart` (nunca commit em `main`)
- [X] T002 [P] Confirmar baseline de build antes das mudancas: `npm run build` e `npm run lint` na raiz e `npm run build` em `api/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, permissoes e tipos que TODAS as historias dependem

**CRITICO**: Nenhuma historia comeca antes desta fase.

- [X] T003 Aplicar DDL em `schema.sql` e `migration.sql`: criar `vagas` (estacionamento_id FK SET NULL), `pessoa_vaga` (PK pessoa_id, indice vaga_id) e `vaga_estacionamento_historico` (append-only, indice (vaga_id, criado_em DESC)); remover `veiculos.estacionamento_id`, `pessoas.estacionamento_id` e `estacionamentos.vagas_distribuidas`; MANTER `veiculo_estacionamento_historico` (legado oculto, sem DROP)
- [X] T004 Aplicar seed de permissoes em `schema.sql` e `migration.sql`: codigos `vaga.lista/detalhe/incluir/editar` (ON CONFLICT DO NOTHING); desativar `estacionamento.associar` e `veiculos.associar`; perfis ORG recebem `vaga.*` e CRD/OPC recebem `vaga.lista/detalhe`
- [X] T005 [P] Adicionar tipos na API em `api/src/tipos.ts`: `Vaga`, `PessoaVaga`, `HistoricoEstacionamentoVaga`; `Veiculo.estacionamentoId?` → `estacionamentos: { id; nome }[]`; `Pessoa` + `vagaId`/`vagaIdentificacao`; remover `HistoricoEstacionamentoVeiculo`/`OperacaoHistoricoEstacionamento`
- [X] T006 [P] Adicionar mesmos tipos no frontend em `src/lib/tipos.ts` (`Vaga`, `PessoaVaga`, `HistoricoEstacionamentoVaga`, `Veiculo.estacionamentos[]`, `Pessoa.vagaId`)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel.

---

## Phase 3: User Story 1 - Criar vaga vinculando pessoas e estacionamento (Priority: P1) 🎯 MVP

**Goal**: ADM/ORG criam uma vaga em tela unica, com identificacao, uma ou mais pessoas e estacionamento opcional. A vaga entra na listagem de vagas, o estacionamento reflete a vaga e o historico de associacao (associar/transferir/desassociar, incluindo a associacao inicial) e gravado e exibido no detalhe da vaga.

**Independent Test**: Abrir a tela de criacao de vaga, informar identificacao, selecionar pessoas e (opcionalmente) um estacionamento e salvar. A vaga aparece na listagem de vagas com as pessoas vinculadas e o estacionamento associado; o detalhe da vaga mostra o historico "associar".

### Implementacao para User Story 1

- [X] T007 [US1] Criar rotas GET /api/vagas e GET /api/vagas/:id em `api/src/rotas/vagas.ts` (padrao openapi + comAuth + temPermissao `vaga.lista`/`vaga.detalhe`): lista com `pessoas` e `estacionamentoNome`, filtro opcional `estacionamentoId`, ordenacao por `identificacao ASC`; detalhe 404 se inexistente
- [X] T008 [US1] Criar rota POST /api/vagas em `api/src/rotas/vagas.ts`: zod (`identificacao` obrigatoria, max 80; `pessoaIds` sem duplicados - FR-005; `estacionamentoId` opcional e existente); pessoa ja em outra vaga → 409 informando a vaga (FR-006); inserir vaga + `pessoa_vaga` + historico `associar` na mesma transacao; `registrarEvento("vaga.criou")`
- [X] T009 [US1] Criar rota PUT /api/vagas/:id em `api/src/rotas/vagas.ts` (`vaga.editar`): substituir `pessoaIds`; mover estacionamento gravando historico `transferir`; desassociar (`estacionamentoId: null`) gravando historico `desassociar`; sem bloqueio por capacidade (FR-019); `registrarEvento("vaga.atualizou")`
- [X] T010 [US1] Criar rota GET /api/vagas/:id/historico em `api/src/rotas/vagas.ts` (`vaga.detalhe`): historico append-only com `estacionamentoId`/`estacionamentoNome`/`operacao`/`autor`/`autorNome`/`criadoEm`, ordenado por `criadoEm DESC`
- [X] T011 [US1] Registrar as rotas de vaga em `api/src/index.ts` com `app.route("/api/vagas", vagas)`
- [X] T012 [P] [US1] Criar lib de API em `src/lib/vagas.ts`: `criarVaga`/`atualizarVaga` (api.post/api.put) com invalidacao de queries de vagas e estacionamentos
- [X] T013 [P] [US1] Adicionar hooks em `src/lib/hooks.ts`: `useVagas`, `useVaga`, `useVagasEstacionamento`, `useHistoricoVaga` (padrao de `useEstacionamentos`)
- [X] T014 [P] [US1] Criar pagina `src/pages/Vagas.tsx` (rota `/vagas`): listagem com identificacao, estacionamento e pessoas por vaga; estados carregando/erro/vazio
- [X] T015 [P] [US1] Criar pagina `src/pages/VagaNova.tsx` (rota `/vagas/nova`): identificacao + multiselecao de pessoas (bloqueando ja vinculadas, tratando 409) + estacionamento opcional com aviso informativo de capacidade (FR-019)
- [X] T016 [US1] Criar pagina `src/pages/VagaDetalhe.tsx` (rota `/vagas/:id`): detalhe/edicao (identificacao, pessoas, mover/desassociar estacionamento) + secao "Historico de estacionamento" listando associar/transferir/desassociar com data e autor
- [X] T017 [US1] Registrar rotas `/vagas`, `/vagas/nova`, `/vagas/:id` em `src/App.tsx` (Layout)
- [X] T018 [P] [US1] Adicionar item "Vagas" em `src/components/Sidebar.tsx` (secao Gestao de Estacionamento, visivel com `pode(sessao, "vaga.lista")`)

**Checkpoint**: US1 funcional e testavel de forma independente. Validar backend com `npm run build` em `api/` e o fluxo da historia.

---

## Phase 4: User Story 2 - Remover associacao direta de veiculo com estacionamento (Priority: P1)

**Goal**: Veiculos deixam de ter qualquer vinculo direto com estacionamento/vaga. A tela de veiculos continua exibindo pessoas, equipes e estacionamentos, agora derivados das vagas das pessoas vinculadas (indireto). O historico legado veiculo↔estacionamento e migrado para o historico da vaga por backfill SQL idempotente.

**Independent Test**: Abrir a listagem e o detalhe de um veiculo: nenhum controle de associar/desassociar estacionamento, sem historico de associacao, e a coluna Estacionamento mostra os estacionamentos derivados das vagas das pessoas vinculadas (inclusive multiplos).

### Implementacao para User Story 2

- [X] T019 [P] [US2] Ajustar `api/src/rotas/veiculos.ts`: GET /api/veiculos e GET /api/veiculos/:id com `estacionamentos[]` derivado (join pessoa_veiculo → pessoas(ativo) → pessoa_vaga → vagas → estacionamentos, FR-010/FR-022); remover GET /:id/historico-estacionamentos (FR-012); manter pessoas e equipes (FR-009)
- [X] T020 [P] [US2] Ajustar `api/src/rotas/estacionamentos.ts`: GET /:id/veiculos por derivacao via vaga; remover POST/DELETE /:id/veiculos e GET/POST/DELETE /:id/pessoas (FR-011/FR-007); remover guardas `estacionamento.associar`
- [X] T021 [P] [US2] Ajustar `api/src/rotas/pessoas.ts`: resposta com `vagaId`/`vagaIdentificacao`/`estacionamentoId`/`estacionamentoNome` derivados da vaga (FR-008); manter `temEstacionamento` como esta
- [X] T022 [P] [US2] Ajustar `src/lib/veiculos.ts`: remover `associarVeiculoEstacionamento`/`desassociarVeiculoEstacionamento`; manter `registrarCheckinsManuais` (rota passa a validar por vaga)
- [X] T023 [P] [US2] Ajustar `src/lib/estacionamentos.ts`: `DadosEstacionamentoForm` sem `vagasDistribuidas`; remover `associarPessoaEstacionamento`/`desassociarPessoaEstacionamento`
- [X] T024 [P] [US2] Ajustar `src/pages/Veiculos.tsx` e `src/pages/VeiculoDetalhe.tsx`: coluna/detalhe exibem `estacionamentos[]` derivados (badges multi-valor); remover controle de associar/desassociar e a secao de historico; manter pessoas/equipes
- [X] T025 [P] [US2] Ajustar `src/pages/PessoaDetalhe.tsx`: remover componente `EstacionamentoPessoa`; exibir vaga + estacionamento derivado (somente leitura); excluir `src/components/EstacionamentoPessoa.tsx`
- [X] T026 [P] [US2] Ajustar `src/components/ListaVeiculosEstacionamento.tsx` ao novo shape de veiculos derivados por vaga
- [X] T027 [US2] Criar `scripts/backfill-vaga-estacionamento-historico.sql`: INSERT ... SELECT ... WHERE NOT EXISTS migrando `veiculo_estacionamento_historico` → `vaga_estacionamento_historico` via pessoas ativas do veiculo → vaga (deduplicado por vaga/evento), em transacao, padrao de `scripts/backfill-historico-alocacao.sql`, com SELECT de contagem (total legado / migrados / mantidos) para validar SC-008 (FR-024)

**Checkpoint**: US2 funcional. Rodar o backfill em banco com vagas adotadas e conferir a contagem (SC-008); rodar de novo nao duplica.

---

## Phase 5: User Story 3 - Visualizar vagas, lotacao e distribuicao do estacionamento (Priority: P2)

**Goal**: O estacionamento exibe as vagas associadas com suas pessoas. A tela de check-in e o dashboard mostram o quao lotado o estacionamento esta e a porcentagem de vagas distribuidas, ambas calculadas (vagas contratadas).

**Independent Test**: Abrir o detalhe de um estacionamento com vagas associadas (aba Vagas) e a tela de check-in publico: as vagas aparecem no detalhe; a lotacao e a porcentagem de vagas distribuidas aparecem na tela de check-in e no dashboard.

### Implementacao para User Story 3

- [X] T028 [P] [US3] Ajustar `api/src/rotas/estacionamentos.ts`: `vagasDistribuidas` calculada (COUNT de vagas associadas) em GET /api/estacionamentos e GET /api/estacionamentos/:id; remover `vagasDistribuidas` do zod de POST/PUT (FR-016)
- [X] T029 [P] [US3] Ajustar `api/src/rotas/dashboard.ts`: incluir `vagasDistribuidas` (COUNT) em cada estacionamento (FR-015)
- [X] T030 [P] [US3] Ajustar GET /api/publico/checkin/{token} em `api/src/rotas/checkin.ts`: resposta do estacionamento passa a incluir `vagasContratadas` e `vagasDistribuidas` para os indicadores da tela de check-in (FR-014/FR-015)
- [X] T031 [P] [US3] Ajustar `src/pages/EstacionamentoDetalhe.tsx`: aba "Vagas" listando as vagas associadas com as pessoas de cada vaga (`useVagasEstacionamento`, FR-013); remover campo de edicao de `vagasDistribuidas`
- [X] T032 [P] [US3] Ajustar `src/pages/EstacionamentoNovo.tsx`: remover campo manual `vagasDistribuidas` do formulario (FR-016)
- [X] T033 [P] [US3] Ajustar `src/components/CardOcupacao.tsx` e `src/pages/DashboardEstacionamentos.tsx`: exibir porcentagem de vagas distribuidas (`vagasDistribuidas / vagasContratadas`) alem da lotacao atual (FR-015)
- [X] T034 [P] [US3] Ajustar `src/pages/CheckinPublico.tsx`: exibir grau de lotacao (baseado em `vagasContratadas`) e porcentagem de vagas distribuidas (FR-014/FR-015)

**Checkpoint**: US3 funcional. Associar/desassociar uma vaga atualiza a porcentagem sem recalculculo manual (FR-016).

---

## Phase 6: User Story 4 - Adaptar o check-in por placa ao novo modelo (Priority: P2)

**Goal**: O check-in publico por placa e o check-in manual localizam o veiculo pelos estacionamentos das vagas das pessoas vinculadas, ja que o vinculo direto veiculo↔estacionamento deixou de existir.

**Independent Test**: Buscar na tela de check-in de um estacionamento a placa de um veiculo cuja pessoa vinculada possui vaga naquele estacionamento: o veiculo aparece no resultado e o check-in pode ser registrado; placa de outro estacionamento informa o nome; veiculo sem vaga orienta a procurar a Gestao de Estacionamento.

### Implementacao para User Story 4

- [X] T035 [P] [US4] Adaptar GET /api/publico/checkin/{token}/buscar em `api/src/rotas/checkin.ts`: derivacao por vaga (pessoas ativas com vaga no estacionamento do token); placa com vaga em outro estacionamento → 404 informando o nome (FR-018); veiculo sem vaga → 404 orientando procurar a Gestao de Estacionamento (FR-022); manter formato de resposta atual (FR-017)
- [X] T036 [P] [US4] Adaptar POST /api/publico/checkin/{token} em `api/src/rotas/checkin.ts`: validacao por derivacao de vaga em vez de `veiculo.estacionamento_id` (FR-017); unicidade por dia, insercao e evento SSE permanecem iguais
- [X] T037 [P] [US4] Adaptar POST /api/estacionamentos/:id/veiculos/:veiculoId/checkins-manuais em `api/src/rotas/estacionamentos.ts`: validacao por derivacao de vaga (veiculo com pessoa ativa com vaga no estacionamento); resto inalterado (FR-023)

**Checkpoint**: US4 funcional - check-in publico e manual operando com o novo modelo.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validacao final, seguranca e documentacao

- [X] T038 [P] Conferir SC-004: nenhuma rota ou tela de associacao direta veiculo↔estacionamento/vaga permanece (grep por `estacionamento.associar`, `veiculos.associar`, `historico-estacionamentos`)
- [ ] T039 [P] Rodar validacao manual conforme `specs/018-vagas-estacionamento/quickstart.md` (criar vaga, transferir, desassociar, historico, backfill SC-008, indicadores, checkin)
- [X] T040 [P] Rodar validacoes finais de build: `npm run lint`, `npm run build` (raiz) e `npm run build` (em `api/`)
- [X] T041 [P] Atualizar a tabela de rotas em `AGENTS.md` com `/vagas`, `/vagas/nova`, `/vagas/:id`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependencias - comeca imediatamente
- **Foundational (Phase 2)**: Depende do Setup - BLOQUEIA todas as historias
- **User Stories (Phase 3+)**: Todas dependem da Foundational
  - **US1 (P1)**: MVP. Nenhuma dependencia de outras historias
  - **US2 (P1)**: Depende da US1 (a derivacao consome `pessoa_vaga`/`vagas` e o backfill depende das vagas adotadas)
  - **US3 (P2)**: Depende da US1 (a lista de vagas do estacionamento e o COUNT usam `vagas`)
  - **US4 (P2)**: Depende da US1 (derivacao por vaga) e da US2 (remocao do vinculo direto)
- **Polish (Phase 7)**: Depende das historias desejadas concluidas

### User Story Dependencies

- **US1 (P1)**: Pode comecar apos Foundational - sem dependencias de outras historias (MVP)
- **US2 (P1)**: Apos Foundational + US1 (backend da US2 pode comecar logo apos a US1 criar `vagas`/`pessoa_vaga`)
- **US3 (P2)**: Apos Foundational + US1
- **US4 (P2)**: Apos Foundational + US1 + US2 (o vinculo direto precisa ser removido)

### Within Each User Story

- Modelos/tipos antes de servicos; servicos antes de endpoints; endpoints antes de integracao frontend
- Core implementation before integration
- Historia completa antes de avancar para a proxima prioridade

### Parallel Opportunities

- Fase 2: T005 e T006 paralelos (tipos API vs frontend)
- US1: T012, T013, T014, T015 e T018 paralelos (arquivos distintos); T016 e T017 apos T013/T014/T015
- US2: T019-T026 paralelos (arquivos distintos); T027 apos as vagas existirem (post-US1)
- US3: T028-T034 paralelos (arquivos distintos; todos apos US1)
- US4: T035, T036 e T037 paralelos (arquivos distintos, mas T035/T036 no mesmo `checkin.ts` — sequencial entre si)
- Polish: T038-T041 paralelos

---

## Parallel Example: User Story 1

```bash
# Launcher todos os arquivos novos e independentes da US1 juntos:
Task: "Criar lib de API em src/lib/vagas.ts"
Task: "Adicionar hooks em src/lib/hooks.ts"
Task: "Criar pagina src/pages/Vagas.tsx"
Task: "Criar pagina src/pages/VagaNova.tsx"
Task: "Adicionar item Vagas em src/components/Sidebar.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundational (CRITICO - bloqueia todas as historias)
3. Completar Phase 3: US1 (criar vaga com pessoas/estacionamento + historico)
4. **PARAR e VALIDAR**: testar a US1 de forma independente (build + fluxo manual)
5. Deploy/demo se pronto

### Incremental Delivery

1. Setup + Foundational → fundacao pronta
2. US1 → testar → Deploy/Demo (MVP!)
3. US2 (remocao do vinculo direto + backfill do historico) → testar → Deploy/Demo
4. US3 (indicadores de lotacao/distribuicao) → testar → Deploy/Demo
5. US4 (check-in adaptado) → testar → Deploy/Demo
6. Cada historia agrega valor sem quebrar as anteriores

### Parallel Team Strategy

Com multiplos devs:

1. Time completa Setup + Foundational juntos
2. Apos a US1 (MVP) entregue:
   - Dev A: US2 (backend + frontend de remocao do vinculo direto)
   - Dev B: US3 (indicadores)
3. US4 apos US2, para fechar o modelo sem vinculo direto

---

## Notes

- [P] tasks = arquivos diferentes, sem dependencias
- [Story] label mapeia a task para a user story especifica
- Nenhuma task de testes automatizados: a spec nao solicita e nao ha runner configurado
- Validacao: `npm run lint`, `npm run build` (raiz) e `npm run build` (api/) apos cada historia
- Commit apos cada task ou grupo logico (PT-BR, imperativo)
- O backfill (`scripts/backfill-vaga-estacionamento-historico.sql`) roda apos a adocao das vagas em producao; e idempotente
- O `migration.sql` deve rodar no Neon antes do deploy da API; a tabela legada `veiculo_estacionamento_historico` NAO e removida
