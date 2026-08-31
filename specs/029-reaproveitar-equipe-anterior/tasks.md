---

description: "Task list for feature 029 - reaproveitar equipe da edicao anterior"
---

# Tasks: Reaproveitar Equipe da Edicao Anterior

**Input**: Design documents from `/specs/029-reaproveitar-equipe-anterior/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/equipe-anterior.md, quickstart.md

**Tests**: Nao ha test runner configurado e a spec nao solicita testes. Validacao funcional e manual via `quickstart.md` (3 cenarios) + gates de build.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend (API Hono)**: `api/src/rotas/*.ts` (monorepo raiz)
- **Frontend (SPA Vite/React)**: `src/lib/`, `src/components/`, `src/pages/` na raiz
- Fonte das convencoes: `AGENTS.md`, `CLAUDE.md`, `src/lib/tipos.ts`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline e ambientacao da feature

- [x] T001 Confirmar branch `029-reaproveitar-equipe-anterior` e validar baseline de build antes de qualquer mudanca: `npm run lint` na raiz e `cd api && npm run build`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Camada de dados do painel — consumida por US1, US2 e US3. Sem ela nenhuma story entrega valor.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 [P] Adicionar tipos `MembroEquipeAnterior`, `RespostaEquipeAnterior` e a funcao `listarEquipeAnterior(edicaoId, equipeId)` em `src/lib/participacoes.ts` conforme `contracts/equipe-anterior.md` (monta query string `?edicaoId=&equipeId=` no padrao das funcoes existentes do arquivo)
- [x] T003 [P] Adicionar rota `GET /equipe-anterior` em `api/src/rotas/participacoes.ts` (so `comAuth`; valida status `planejamento` → 400; resolve edicao N-1 ativa/encerrada; corresponde equipe por nome normalizado com helper local replicando a regex de sufixo romano/arabo de `api/src/rotas/montagem.ts`; filtra pessoas ativas/nao bloqueadas/nao excluidas; computa `jaNaEquipe`/`emOutraEquipe`; resposta no formato do contrato)
- [x] T004 Adicionar hook `useEquipeAnterior(edicaoId, equipeId)` em `src/lib/hooks.ts` com queryKey `["participacoes", "equipe-anterior", equipeId]` e `staleTime` no padrao dos hooks de leitura existentes (depende de T002)

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Visualizar equipe da edicao anterior (Priority: P1) MVP

**Goal**: Ao abrir o detalhe de uma equipe de edicao em `planejamento`, ver um painel lateral listando as pessoas que participaram da equipe correspondente na edicao anterior (N-1), com nome e funcao anterior e marcacao visual para quem ja esta na equipe atual.

**Independent Test**: Abrir `/edicoes/:edicaoId/barracas/:id` em uma edicao `planejamento` com edicao N-1 ativa/encerrada e equipe de nome correspondente (ex.: "Calabresa Chapa" na N e "Calabresa Chapa II" na N-1): o botao "Equipe da edicao anterior" aparece; o painel abre e lista as pessoas com nome, funcao anterior e badge "ja na equipe" para quem esta alocado na equipe atual. Unicamente com dados existentes no banco — sem escrita.

### Implementation for User Story 1

- [x] T005 [US1] Criar componente `PainelEquipeAnterior.tsx` em `src/components/` (drawer lateral direito: overlay dark + painel fixo `inset-y-0 right-0` largura maxima ~`md`, fechar por X/`Esc`/clique no overlay; usa `useEquipeAnterior`; renderiza estado de carregamento e a lista com `pessoaNome`, `funcaoAnterior` e indicador para `jaNaEquipe` — sem botoes de acao, que entram na US2)
- [x] T006 [US1] Integrar em `src/pages/EquipeDetalhe.tsx`: botao "Equipe da edicao anterior" no cabecalho da equipe, visivel somente quando `edicao.status === "planejamento"`; ao clicar abre o `PainelEquipeAnterior` (repassa `edicaoId`/`equipeId`; fecha via estado local) (depende de T005)

**Checkpoint**: User Story 1 fully functional and independently testable

---

## Phase 4: User Story 2 - Adicionar pessoa da equipe anterior (Priority: P1)

**Goal**: No painel, adicionar uma pessoa da equipe anterior como Equipista ou Coordenador na equipe atual, reusando o fluxo de alocacao existente, com impossibilidades indicadas claramente.

**Independent Test**: No painel da US1, acionar "adicionar como Equipista" e "adicionar como Coordenador": a pessoa entra na equipe atual com a funcao escolhida, aparece na lista de participacoes da equipe e, reabrindo o painel, fica marcada como "ja na equipe" (botoes desabilitados). Pessoa com `emOutraEquipe` tem botoes desabilitados com mensagem. Com `vagasCoordenador` preenchida, o botao de Coordenador fica desabilitado mostrando vaga indisponivel (FR-011); "adicionar como Equipista" segue ativo.

### Implementation for User Story 2

- [x] T007 [US2] Adicionar botoes "Adicionar como Equipista" e "Adicionar como Coordenador" por linha em `src/components/PainelEquipeAnterior.tsx`, desabilitados com mensagem/titulo para `jaNaEquipe` e `emOutraEquipe` (FR-009/FR-010); botoes chamam callback `onAdicionar(pessoaId, funcao)` (depende de T005)
- [x] T008 [US2] Em `src/pages/EquipeDetalhe.tsx`, implementar handler `onAdicionar` reusando `alocar` de `src/lib/participacoes.ts` (permissao `edicao.equipeAlocar`); apos sucesso, invalidar a query `["participacoes", "equipe-anterior", equipeId]` via `queryClient` para reflitir `jaNaEquipe`; feedback de sucesso/erro via toast no padrao existente da pagina (depende de T007)
- [x] T009 [US2] Guard de vaga de coordenador em `src/components/PainelEquipeAnterior.tsx`: ao receber o total de Coordenadores da equipe atual (repassado de `EquipeDetalhe.tsx`) e `equipe.vagasCoordenador`, desabilitar "Adicionar como Coordenador" quando o total >= vagas, com mensagem informativa (FR-011, decisao D6) (depende de T007)

**Checkpoint**: User Story 2 works on its own on top of US1

---

## Phase 5: User Story 3 - Estados vazios e indisponibilidade (Priority: P2)

**Goal**: O painel comunica com clareza ausencia de dados (sem edicao anterior / sem equipe correspondente) e respeita a permissao de alocacao (modo leitura), sem nunca expor regras internas ao usuario.

**Independent Test**: (a) Edicao atual sem N-1 (ou N-1 em planejamento): painel abre com "Nao ha dados de edicao anterior" e tela intacta. (b) N-1 existente sem equipe correspondente ou sem participacoes: "Nenhuma pessoa encontrada para esta equipe na edicao anterior". (c) Usuario logado sem `edicao.equipeAlocar`: painel abre em modo leitura, sem botoes de adicao (FR-014).

### Implementation for User Story 3

- [x] T010 [US3] Adicionar estados vazios distintos em `src/components/PainelEquipeAnterior.tsx`: para `edicaoAnterior === null` mensagem "Nao ha dados de edicao anterior"; para `pessoas` vazio "Nenhuma pessoa encontrada para esta equipe na edicao anterior" (FR-013, decisao D10) (depende de T005)
- [x] T011 [US3] Modo leitura em `src/components/PainelEquipeAnterior.tsx`: prop `podeAlocar` (calculada em `src/pages/EquipeDetalhe.tsx` a partir de `edicao.equipeAlocar`) esconde/desabilita os botoes de adicao e a guard de vaga, mantendo a lista legivel (FR-014) (depende de T007)
- [x] T012 [US3] Revisar o SQL do endpoint em `api/src/rotas/participacoes.ts`: assegurar que pessoas com `ativo=false`, `bloqueada=true` ou `excluida=true` nao retornam, e que equipe anterior com `excluida=true` nao e candidata ao match (FR-012, decisao D4) (depende de T003)

**Checkpoint**: All user stories functional independently on top of US1

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validacao final end-to-end e qualidade

- [ ] T013 Executar os 3 cenarios de `specs/029-reaproveitar-equipe-anterior/quickstart.md` em navegador + API local (painel em planejamento; adicao como Equipista/Coordenador; conflitos, vaga de coordenador e modo leitura; estados vazios)
- [x] T014 [P] Gates de build: `npm run lint` e `npm run build` na raiz; `cd api && npm run build`
- [x] T015 Revisao de convencoes no diff: PT-BR na UI, mensagens da API e logs sem acentos; campos `snake_case` no SQL e `camelCase` no TS; datas ISO-8601; sem dependencias novas; sem emojis em codigo/commits

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational (endpoint + hook + types)
- **US2 (Phase 4)**: Depends on US1 (reusa o painel); a guard de vaga (T009) tambem depende de US1
- **US3 (Phase 5)**: Depends on US1 (painel); T010/T011 estendem o mesmo componente
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - no dependencies on other stories (MVP)
- **User Story 2 (P1)**: Builds on US1's panel (add action buttons appear in the same drawer)
- **User Story 3 (P2)**: Builds on US1's panel (empty states and read-only mode)

### Within Each Phase

- Foundational: T002 [P] and T003 [P] can run in parallel (frontend lib vs API rota); T004 depends on T002 (imports the types/function)
- US1: T005 before T006 (component before page integration)
- US2: T007 before T008 and T009 (buttons before wiring/guard)
- US3: T010/T011 extend `PainelEquipeAnterior.tsx` (sequencial no mesmo arquivo); T012 revisa a API (independente do frontend)

### Parallel Opportunities

- T002 [P] (frontend types/helper) e T003 [P] (API endpoint): nomes de arquivos distintos — o backend pode ser desenvolvido em paralelo com todo o frontend, ja que o contrato (`contracts/equipe-anterior.md`) define o formato
- T012 [P] dentro de US3 (apenas revisao de SQL) nao conflita com T010/T011 (componente)
- T014 [P] roda sozinho ao final

---

## Parallel Example: Foundational

```bash
Task: "T002 [P] Adicionar tipos MembroEquipeAnterior/RespostaEquipeAnterior e listarEquipeAnterior() em src/lib/participacoes.ts"
Task: "T003 [P] Adicionar rota GET /equipe-anterior em api/src/rotas/participacoes.ts"
```

```bash
# Depois de T002:
Task: "T004 Adicionar useEquipeAnterior(edicaoId, equipeId) em src/lib/hooks.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002-T004) — endpoint GET de leitura + hook + tipos
3. Complete Phase 3: User Story 1 (T005-T006) — painel lista a equipe da edicao anterior
4. **STOP and VALIDATE**: abrir detalhe da equipe em planejamento e conferir a lista (cenario 1 do quickstart.md); rodar os 3 builds
5. Deploy/demonstrar se houver interesse (somente leitura, sem risco de escrita)

### Incremental Delivery

1. Setup + Foundational → camada de dados do painel pronta
2. US1 → painel de visualizacao (MVP) → validar via quickstart cenario 1
3. US2 → adicao reusando `alocar` + guard de vaga → validar via quickstart cenario 2
4. US3 → estados vazios e modo leitura → validar via quickstart cenario 3
5. Cada story entrega valor sem quebrar as anteriores; a adicao nunca cria funcionalidade nova no backend (reusa `POST /api/participacoes`)

### Parallel Team Strategy

Com dois desenvolvedores:

1. Ambos completam Phase 1 + 2 juntos (T002/T003 em paralelo por arquivos diferentes)
2. Depois da Foundational:
   - Dev A: US1 (componente + integracao)
   - Dev B: US3 T012 (revisao SQL do endpoint) ou Polish T014 (builds)
   - US2 e US3 T010/T011 tocam o mesmo componente → serializar entre Dev A e B para evitar conflito

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Cada story e independentemente completa/testavel a partir do painel ja entregue na US1
- Nenhum endpoint de mutacao novo: a adicao reusa `POST /api/participacoes` (perm `edicao.equipeAlocar`, auditoria e historico inclusos)
- Validacao funcional e manual (sem test runner): os 3 cenarios de quickstart.md
- Commit apos cada grupo logico (PT-BR, imperativo)
- Parar em cada checkpoint para validar a story de forma independente
- Evitar: tasks vagas, conflito no mesmo arquivo, dependencias transversais que quebrem a independencia