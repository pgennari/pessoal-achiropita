# Tasks: PBAC - Catalogo de Permissoes e Validacao Unica de Acesso

**Input**: Design documents from `/specs/014-pbac-permissoes/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/permissoes-api.md, quickstart.md

**Tests**: Nao ha test runner configurado no projeto e a spec nao solicita testes automatizados. Validacao por `npm run lint` (typecheck), `npm run build` e `api/ npm run build`.

**Organization**: Tasks agrupadas por user story para permitir implementacao e teste independentes. As tres user stories sao P1; a ordem de entrega e US1 → US2 → US3 porque US2 consome o catalogo (tabela `permissoes`) e US3 consolida a validacao sobre os codigos.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Projeto com duas bases: API Hono em `api/` e SPA React em `src/`. Schema no repositorio raiz (`schema.sql`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Schema e tipos compartilhados — o catalogo editavel de permissoes (tabela `permissoes`) e a base dos tres user stories.

- [X] T001 Add table `permissoes` (codigo PK, rotulo, descricao, ativo, criado_em, atualizado_em) with seed of the 10 active codes (`administracao`, `pessoas.ver`, `pessoas.editar`, `crachas.entregar`, `fotos.pendencias`, `formacao.operar`, `estacionamentos.operar`, `zeramento.executar`, `perfis.gerenciar`, `presenca.gerenciar`) using `CREATE TABLE IF NOT EXISTS` + `INSERT ... ON CONFLICT (codigo) DO NOTHING` in schema.sql (idempotent)
- [X] T002 Add idempotent migration statements to schema.sql (after the seed): ADM gains all active codes (`UPDATE perfis SET permissoes = (SELECT ARRAY(SELECT codigo FROM permissoes WHERE ativo) WHERE sigla='ADM')`) and CRD gains `pessoas.editar` (append only if absent), preserving current access of the six default profiles
- [X] T003 [P] Extend `Permissao` interface with `ativo`, `criadoEm`, `atualizadoEm` in src/lib/tipos.ts
- [X] T004 [P] Add `Permissao` (with `ativo`, `criadoEm`, `atualizadoEm`) and `PermissaoInput` types in api/src/tipos.ts

**Checkpoint**: Base compartilhada pronta — catalogo no banco + tipos em ambas as bases.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Modulo auxiliar de consulta ao catalogo no banco, consumido pelas rotas de perfil (US2) e pela validacao unica (US3).

**⚠️ CRITICAL**: Nenhuma implementacao de US2/US3 pode comecar antes deste modulo existir. US1 pode seguir em paralelo (suas rotas consultam a tabela diretamente).

- [X] T005 Create catalog DB helper functions (`listarPermissoesAtivas(sql)`, `codigoPermissaoAtivo(sql, codigo)`) in api/src/pbac.ts, querying `permissoes.ativo` (sem `any` novo)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel.

---

## Phase 3: User Story 1 - Catalogo de permissoes editavel (Priority: P1) 🎯 MVP

**Goal**: Administrador cria, edita (rotulo/descricao) e desativa permissoes do catalogo, com codigo imutavel, sem exclusao fisica, auditoria, protecao de `perfis.gerenciar` e associacao automatica ao ADM.

**Independent Test**: Logar como ADM, abrir `/permissoes`, criar uma permissao com codigo novo (aparece na lista), editar o rotulo (reflete na lista), tentar criar o mesmo codigo (erro de duplicado), desativar a permissao (some da lista de selecao dos perfis) e tentar desativar `perfis.gerenciar` (bloqueado com 400).

### Implementation for User Story 1

- [X] T006 [P] [US1] Implement `GET/POST /api/permissoes` and `PUT /api/permissoes/:codigo` in api/src/rotas/permissoes.ts: all routes with `comAuth` + `podeGerirPerfis` guard; zod validation of codigo (`[a-z0-9.]{1,40}`, trim), rotulo (nao vazio, max 80), descricao (max 280); POST rejects duplicated codigo with 409 and appends the codigo to the ADM profile (`UPDATE perfis SET permissoes = permissoes || codigo WHERE sigla='ADM'`) via `registrarEvento("permissoes.associar-adm")`; PUT ignores codigo (imutavel), rejects `ativo=false` for `perfis.gerenciar` with 400, 404 for unknown codigo; audit via `registrarEvento` for criar/atualizar/desativar/reativar (spec FR-002..FR-007, FR-012, FR-013, FR-015, FR-016)
- [X] T007 [US1] Register the route in api/src/index.ts with `app.route("/api/permissoes", permissoes)` (depends on T006)
- [X] T008 [P] [US1] Add hook `usePermissoes()` in src/lib/hooks.ts (TanStack Query, `api.get<Permissao[]>("/api/permissoes")`, key `["permissoes"]`, no `todos` param)
- [X] T009 [US1] Create page Permissoes.tsx in src/pages/Permissoes.tsx: lista com rotulo/descricao/ativo, formulario de criacao (codigo + rotulo + descricao), edicao de rotulo/descricao (sem campo de codigo), botao desativar/reativar; `perfis.gerenciar` exibida como protegida (sem botao desativar); mensagens de erro vindas da API (409 duplicado); reusa padroes visuais de Perfis.tsx (card, badge, tabela-rolavel) (depends on T008)
- [X] T010 [US1] Wire route `/permissoes` in src/App.tsx (dentro de `ProtegerRota`/`Layout`) and add item "Permissões" (icone) in the Administracao section of src/components/Sidebar.tsx with `permissoes: ["perfis.gerenciar"]` (depends on T009)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently.

---

## Phase 4: User Story 2 - Associacao de permissoes aos perfis (Priority: P1)

**Goal**: A edicao de perfil oferece somente permissoes ativas do catalogo e aceita somente codigos validos e ativos; perfis gravados com codigos desativados os mostram como "inativa" e os descartam ao salvar.

**Independent Test**: Criar uma permissao nova (US1), editar um perfil nao-fixo associando a ela, salvar, reler o perfil e ver a permissao gravada; enviar um codigo inexistente/desativado na associacao e ver o codigo rejeitado (nao gravado); perfil ADM continua sem edicao.

### Implementation for User Story 2

- [X] T011 [P] [US2] Replace `apenasPermissoesValidas` (array hardcoded) with active-catalog validation using `codigoPermissaoAtivo`/`listarPermissoesAtivas` from api/src/pbac.ts in POST and PUT of api/src/rotas/perfis.ts, so only valid AND active codigos are stored (depends on T005)
- [X] T012 [P] [US2] Remove `CATALOGO_PERMISSOES` from src/lib/perfis.ts and change `rotuloPermissao(codigo, catalogo)` to resolve the rotulo from a passed-in catalog list (fallback: codigo) (depends on T008)
- [X] T013 [US2] Update Perfis.tsx in src/pages/Perfis.tsx: checkbox list from `usePermissoes()` (only active items); badges/table resolve rotulo via `rotuloPermissao(codigo, catalogo)`; codigos gravados no perfil que estao desativados no catalogo aparecem como badge "inativa" e sao removidos da lista ao salvar (depends on T012)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently.

---

## Phase 5: User Story 3 - Funcao unica de validacao de acesso (Priority: P1)

**Goal**: Uma unica funcao `pode(sessao, codigo)` decide todo o acesso (ADM superuser, sem sessao → negado, senao codigo ativo na sessao); guards legadas delegam a ela, sem alterar o acesso dos seis perfis padrao.

**Independent Test**: Consultar `pode()` para um usuario com a permissao X (permitido) e sem ela (negado); deslogado → negado; permissao desativada → negado para todos; perfil ADM → permitido para qualquer codigo; para cada um dos seis perfis padrao, todas as acoes hoje permitidas seguem permitidas.

### Implementation for User Story 3

- [X] T014 [US3] Implement `pode(sessao, codigo)` in api/src/pbac.ts: `!sessao?.perfil` → `false`; `perfil === "ADM"` → `true`; senao `(sessao.permissoes ?? []).includes(codigo)` (pre-condicao: sessao so carrega codigos ativos) (depends on T005)
- [X] T015 [US3] In api/src/auth.ts: update `comAuth` to return in `sessao.permissoes` only active codigos (e.g. `(SELECT ARRAY(SELECT codigo FROM permissoes WHERE ativo AND codigo = ANY(p.permissoes)))` no LEFT JOIN com `perfis`); make guards `temPermissao`, `podeAdministrar`, `podeOperarEstacionamentos`, `podeEditarPessoa`, `podeZerar`, `podeGerirPerfis` delegate to `pode()` removing perfil-letter checks (ORG/OPC/CRD), preserving behavior via the migrated seeds (depends on T014)
- [X] T016 [P] [US3] In src/lib/sessao.ts: add `pode(sessao, codigo)` with the same rules (ADM superuser, senao `permissoes.includes`); refactor `temPermissao`, `podeAdministrar`, `podeOperarEstacionamentos`, `podeEditarPessoa`, `podeZerar`, `podeGerirPerfis` to delegate to `pode()` removing perfil-letter checks (depends on T014)
- [X] T017 [US3] Update src/components/Sidebar.tsx to use `pode` from src/lib/sessao.ts in place of its local `temPermissao` helper in `itemVisivel`, so every authorization decision passes through the single function (depends on T016)

**Checkpoint**: All user stories should now be independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Limpeza do codigo morto, verificacao de consistencia e validacao de build.

- [X] T018 [P] Delete dead api/src/perfis.ts (catalogo hardcoded + `permissaoValida`/`apenasPermissoesValidas`) after US2/US3 remove all imports, and update the stale comment in schema.sql referencing `api/src/perfis.ts`
- [X] T019 Run `npm run lint` and `npm run build` in repo root and `npm run build` in `api/`, fixing any type errors introduced
- [X] T020 Run the manual validation scenarios from specs/014-pbac-permissoes/quickstart.md (ADM cria/edita/desativa permissao; `perfis.gerenciar` protegida; perfil associa somente ativas; CRD mantem edicao de pessoas; deslogado negado) and confirm all pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately (T001 antes de T002, mesmo arquivo schema.sql)
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS US2 e US3
- **User Stories (Phase 3+)**: All depend on Setup (US1) ou Setup+Foundational (US2/US3)
  - US1 e US2/US3 podem seguir em paralelo (arquivos distintos)
  - Ordem de entrega recomendada: US1 → US2 → US3
- **Polish (Final Phase)**: Depends on US2 (T018 remove imports) e US3

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Setup (Phase 1) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Setup + Foundational - Depends on US1 for creating new permissions to associate (o catalogo base ja existe apos T001)
- **User Story 3 (P1)**: Can start after Setup + Foundational - Validation depends on migrated seeds (T002) to preserve access

### Within Each User Story

- Backend (rotas) antes da integracao frontend
- Hook (`usePermissoes`) antes da pagina
- `pode()` antes das guards delegarem
- Story complete before moving to next priority

### Parallel Opportunities

- T003/T004 (tipos de API e frontend, arquivos distintos)
- T006 (rotas API) e T008 (hook frontend) na US1
- T011 (rotas API) e T012 (lib frontend) na US2
- T014 (pbac.ts) e T016 (sessao.ts) na US3
- T018 (limpeza) com T019/T020 (validacao)

---

## Parallel Example: User Story 1

```bash
# Backend e frontend da US1 em paralelo:
Task: "Implement GET/POST/PUT /api/permissoes in api/src/rotas/permissoes.ts"
Task: "Add hook usePermissoes() in src/lib/hooks.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001..T004)
2. Complete Phase 3: User Story 1 (T006..T010) — o modulo da Phase 2 so e necessario na US2/US3
3. **STOP and VALIDATE**: Test User Story 1 independently (criar/editar/desativar permissao)
4. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup → catalogo no banco
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With two developers:

1. Developer A: Setup (T001..T004) + Foundational (T005)
2. Developer A: User Story 1 backend (T006..T007); Developer B: User Story 1 frontend (T008..T010)
3. After US1: Developer A: User Story 3 (T014..T017); Developer B: User Story 2 (T011..T013)
4. Polish (T018..T020) in parallel, then final build validation

---

## Notes

- Commits em PT-BR no imperativo, na branch de feature (nunca em `main`), apos cada task ou grupo logico (ex.: `adiciona tabela permissoes e seed dos perfis`)
- Rodar `npm run lint`/`npm run build` (raiz e `api/`) antes de commit
- Sem test runner: validacao por build + cenario manual do quickstart.md
- Nao alterar o comportamento das telas existentes nesta feature (adequacao das telas e segundo momento); guards preservam assinatura, so mudam implementacao
- `perfis.gerenciar` nunca desativavel; ADM superuser em `pode()`; codigo de permissao imutavel; sem exclusao fisica de permissao
