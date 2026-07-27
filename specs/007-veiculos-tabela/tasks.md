# Tasks: Tabela de Veículos com Relacionamento Múltiplo

**Input**: Design documents from `/specs/007-veiculos-tabela/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Sem test runner configurado. Validação via `npm run lint` (= `tsc -b --noEmit`).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `api/src/rotas/` (Hono routes)
- **Frontend**: `src/pages/`, `src/components/`, `src/lib/`
- **Database**: `schema.sql` (DDL), migration script in `specs/007-veiculos-tabela/data-model.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Criar estrutura de banco de dados e tipos TypeScript para a feature

- [x] T001 Atualizar schema.sql com tabelas veiculos e pessoa_veiculo conforme data-model.md
- [x] T002 Criar script de migração SQL em specs/007-veiculos-tabela/migration.sql
- [x] T003 [P] Adicionar interfaces Veiculo e PessoaVeiculo em src/lib/tipos.ts
- [x] T004 [P] Criar arquivo src/lib/veiculos.ts com funções de API para veículos

**Checkpoint**: Banco de dados e tipos prontos para implementação das user stories

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Registrar rotas da API no backend e criar estrutura de navegação no frontend

- [x] T005 Criar arquivo api/src/rotas/veiculos.ts com CRUD de veículos (GET, POST, PUT, DELETE)
- [x] T006 Registrar rota veiculos no api/src/index.ts
- [x] T007 [P] Adicionar rotas de vinculo pessoa-veiculo em api/src/rotas/veiculos.ts (GET/POST/DELETE pessoas)
- [x] T008 [P] Adicionar rotas de vinculo pessoa-veiculo em api/src/rotas/pessoas.ts (GET/POST/DELETE veiculos)
- [x] T009 [P] Adicionar rotas de associacao veiculo-estacionamento em api/src/rotas/estacionamentos.ts (GET/POST/DELETE veiculos)
- [x] T010 [P] Adicionar hooks de veiculos em src/lib/hooks.ts (useVeiculos, useVeiculo, useVinculosPessoa, useVinculosEstacionamento)
- [x] T011 [P] Criar componente VeiculoForm em src/components/VeiculoForm.tsx
- [x] T012 [P] Criar componente VinculoVeiculo em src/components/VinculoVeiculo.tsx

**Checkpoint**: API de veículos funcional e componente de formulário pronto

---

## Phase 3: User Story 1 - Cadastrar veículo como entidade independente (Priority: P1) 🎯 MVP

**Goal**: Permitir que ADM/ORG cadastre, edite e exclua veículos de forma independente

**Independent Test**: Criar um veículo novo e verificar que ele aparece na listagem

### Implementation for User Story 1

- [x] T013 [US1] Criar página src/pages/Veiculos.tsx com listagem de veículos
- [x] T014 [US1] Criar página src/pages/VeiculoDetalhe.tsx com detalhe/edição de veículo
- [x] T015 [US1] Adicionar rota /veiculos no src/App.tsx
- [x] T016 [US1] Adicionar link "Veículos" na navegação do Layout
- [ ] T017 [US1] Implementar validação de placa única no backend (api/src/rotas/veiculos.ts)
- [ ] T018 [US1] Implementar bloqueio de exclusão se existirem check-ins (api/src/rotas/veiculos.ts)

**Checkpoint**: CRUD de veículos funcionando independentemente

---

## Phase 4: User Story 2 - Vincular veículos a pessoas (many-to-many) (Priority: P1)

**Goal**: Permitir que ADM/ORG vincule veículos a pessoas (muitos-para-muitos)

**Independent Test**: Vincular dois veículos a uma pessoa e verificar que ambos aparecem no detalhe

### Implementation for User Story 2

- [x] T019 [US2] Atualizar src/pages/PessoaDetalhe.tsx com seção de veículos vinculados
- [x] T020 [US2] Implementar modal de vínculo pessoa-veículo no componente VinculoVeiculo
- [x] T021 [US2] Implementar função de desvincular veículo da pessoa no backend
- [x] T022 [US2] Atualizar hook usePessoas para incluir veículos vinculados

**Checkpoint**: Vínculo pessoa-veículo funcionando independentemente

---

## Phase 5: User Story 3 - Associar veículo ao estacionamento (1:1) (Priority: P1)

**Goal**: Permitir que ADM/ORG associe veículos a estacionamentos (1:1)

**Independent Test**: Associar um veículo a um estacionamento e verificar que ele aparece na listagem

### Implementation for User Story 3

- [x] T023 [US3] Atualizar src/pages/EstacionamentoDetalhe.tsx com seção de veículos associados
- [x] T024 [US3] Implementar modal de associação veículo-estacionamento no componente VinculoVeiculo
- [x] T025 [US3] Implementar função de desassociar veículo do estacionamento no backend
- [x] T026 [US3] Atualizar hook useEstacionamento para incluir veículos associados
- [x] T027 [US3] Implementar restrição de 1:1 no backend (veículo só pode estar em um estacionamento)

**Checkpoint**: Associação veículo-estacionamento funcionando independentemente

---

## Phase 6: User Story 4 - Busca de placa no check-in retorna veículo com pessoas (Priority: P1)

**Goal**: Atualizar tela de check-in para buscar veículos por placa e retornar pessoas associadas

**Independent Test**: Acessar link público, digitar placa e verificar que card exibe veículo com pessoas

### Implementation for User Story 4

- [x] T028 [US4] Atualizar query de busca em api/src/rotas/checkin.ts para usar tabela veiculos
- [x] T029 [US4] Atualizar resposta da busca para incluir array de pessoas associadas
- [x] T030 [US4] Criar componente VeiculoCard em src/components/VeiculoCard.tsx
- [x] T031 [US4] Atualizar src/pages/CheckinPublico.tsx para usar novo componente VeiculoCard
- [x] T032 [US4] Atualizar função de check-in no backend para usar veiculoId em vez de carroId
- [x] T033 [US4] Atualizar src/lib/checkin.ts para usar nova estrutura de dados

**Checkpoint**: Check-in com busca por placa retornando veículo com pessoas funcionando

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Melhorias que afetam múltiplas user stories

- [x] T034 [P] Atualizar schema.sql com índices necessários para performance
- [x] T035 [P] Atualizar documentação da API no Swagger (OpenAPI)
- [ ] T036 Executar migração de dados no banco de produção
- [x] T037 Verificar que `npm run lint` passa no frontend
- [x] T038 Verificar que `npm run build` passa no frontend
- [x] T039 Verificar que `npm run build` passa no backend (api/)
- [ ] T040 Executar cenários de validação do quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1 (Cadastrar veículo) - pode começar após Foundational
  - US2 (Vincular pessoa-veículo) - depende de US1 (precisa de veículos cadastrados)
  - US3 (Associar estacionamento) - depende de US1 (precisa de veículos cadastrados)
  - US4 (Check-in) - depende de US1, US2 e US3 (precisa de veículos, vínculos e associações)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Depends on US1 (precisa de veículos para vincular)
- **User Story 3 (P1)**: Depends on US1 (precisa de veículos para associar)
- **User Story 4 (P1)**: Depends on US1, US2 e US3 (precisa de veículos, vínculos e associações)

### Within Each User Story

- Models before services
- Services before endpoints
- Endpoints before frontend integration
- Core implementation before validation

### Parallel Opportunities

- T003 e T004 podem rodar em paralelo (diferentes arquivos)
- T007, T008 e T009 podem rodar em paralelo (diferentes arquivos de rota)
- T010, T011 e T012 podem rodar em paralelo (diferentes componentes)
- T034 e T035 podem rodar em paralelo (schema e documentação)

---

## Parallel Example: User Story 1

```bash
# Tasks que podem rodar em paralelo para US1:
Task: "Criar página src/pages/Veiculos.tsx com listagem de veículos"
Task: "Criar página src/pages/VeiculoDetalhe.tsx com detalhe/edição de veículo"
Task: "Adicionar rota /veiculos no src/App.tsx"
Task: "Adicionar link 'Veículos' na navegação do Layout"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (banco + tipos)
2. Complete Phase 2: Foundational (API + componentes base)
3. Complete Phase 3: User Story 1 (CRUD de veículos)
4. **STOP and VALIDATE**: Testar CRUD de veículos independentemente
5. Deploy/demo se pronto

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Add User Story 4 → Test independently → Deploy/Demo
6. Each story adds value without breaking previous stories

### Recommended Order (Single Developer)

Como todas as US são P1 e há dependências entre elas, a ordem recomendada é:

1. **US1**: Cadastrar veículo (base para tudo)
2. **US2**: Vincular pessoa-veículo (necessário para check-in)
3. **US3**: Associar estacionamento (necessário para check-in)
4. **US4**: Check-in com busca por placa (fluxo principal)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Migration script deve ser executado ANTES de qualquer deploy
