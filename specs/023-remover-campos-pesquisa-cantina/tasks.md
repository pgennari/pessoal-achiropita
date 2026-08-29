# Tasks: Remover campos do formulario publico da Pesquisa da Cantina

**Input**: Design documents from `/specs/023-remover-campos-pesquisa-cantina/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Sem test runner configurado no projeto (constituicao / AGENTS.md). Nenhuma task de teste automatizado — validacao por build (`npm run lint`, `npm run build`, `api/ npm run build`) e pelos cenarios de `quickstart.md`.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Web app: SPA em `src/` + API Hono em `api/` (mesma estrutura existente, sem camadas novas)
- Schema do banco: `schema.sql` (nao alterado nesta feature)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline do repositorio. A feature reutiliza a estrutura existente e nao adiciona dependencias; o build precisa estar verde antes de qualquer mudanca.

- [x] T001 Validar estado atual do build: rodar `npm run lint`, `npm run build` (raiz, SPA `src/`) e `api/ npm run build` e confirmar que todos passam antes de iniciar as alteracoes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Fixar a fronteira da remocao — o fluxo publico muda; o fluxo logado (leitura/historico) e a estrutura do banco ficam intactos. Essa fronteira bloqueia as duas user stories.

**⚠️ CRITICAL**: Nenhuma user story pode comecar sem este entendimento aplicado.

- [x] T002 Fixar a fronteira: verificar que os arquivos de leitura/historico ficam intactos — `api/src/rotas/cantina.ts`, `src/pages/CantinaPesquisa.tsx`, os tipos `PesquisaCantina` em `api/src/tipos.ts` e `src/lib/tipos.ts` (mantendo `diaIda`/`convite`) e as colunas `dia_ida`/`convite` em `schema.sql` nao recebem nenhuma edicao nesta feature

**Checkpoint**: Fronteira definida — implementacao das user stories pode comecar.

---

## Phase 3: User Story 1 - Visitante envia a pesquisa sem dia/convicte (Priority: P1) 🎯 MVP

**Goal**: O formulario publico `/cantina/pesquisa` nao exibe mais os campos "Dia da ida a cantina" e "Numero do convite"; a pagina abre direto (sem requisicao previa de agenda) e o envio conclui normalmente com os demais campos inalterados.

**Independent Test**: Abrir `/cantina/pesquisa` em janela anonima (desktop e celular) — a secao "Sobre voce" mostra apenas Nome completo, E-mail, Telefone e opt-in; nao ha "Dia da ida" nem "Numero do convite"; o DevTools nao mostra requisicao para `/api/publico/cantina/dias-festa`; um envio completo termina na tela de agradecimento.

### Implementation for User Story 1

- [x] T003 [P] [US1] Ajustar a rota publica de envio em `api/src/rotas/cantinaPublico.ts`: remover `diaIda`/`convite` do `corpoSchema`, remover a validacao de `diaIda` contra `dias_festa` da edicao ativa, remover a constante `DATA_RE` (fica sem usos) e parar de citar as colunas `dia_ida`/`convite` no `INSERT INTO pesquisas_cantina` (novas linhas gravam `NULL`)
- [x] T004 [P] [US1] Remover a rota `GET /api/publico/cantina/dias-festa` em `api/src/rotas/cantinaPublico.ts`, com seus tipos/imports residuais (`createRoute`, consulta a `dias_festa`/`edicoes`) — sem alterar a tabela `dias_festa` no banco
- [x] T005 [P] [US1] Ajustar o cliente publico em `src/lib/cantina.ts`: remover a interface `DiaFestaPublico` e a funcao `listarDiasPublicos()` e remover `diaIda`/`convite` da interface `DadosPesquisaForm` (mantendo `enviarPesquisa` e o uso de `apiPublica`)
- [x] T006 [US1] Atualizar o formulario `src/pages/CantinaPesquisaPublico.tsx` (depende de T005): remover estados `diaIda`/`convite`/`dias`, o `useEffect` que buscava dias e preselecionava hoje, o helper `dataHojeIso`, o select "Dia da ida" e o input "Numero do convite", simplificar a grid `grid-cols-1 sm:grid-cols-2` (Telefone+Dia) para Telefone em largura unica, remover o import de `listarDiasPublicos`/`DiaFestaPublico` e enviar o payload de `enviarPesquisa` sem `diaIda`/`convite`

**Checkpoint**: Neste ponto a User Story 1 esta completa e testavel de forma independente (MVP).

---

## Phase 4: User Story 2 - Organizador mantem acesso as respostas ja registradas (Priority: P2)

**Goal**: A area logada `Cantina > Pesquisa` continua exibindo as respostas historicas (com Dia da ida e Numero do convite quando informados) e as respostas novas aparecem normalmente, sem valores para esses campos e sem erro. Nenhum codigo novo e necessario — tarefas de guarda/validacao.

**Independent Test**: Abrir `Cantina > Pesquisa` na area logada — uma resposta registrada antes da remocao mostra "Dia da ida" e "Numero do convite"; uma resposta nova nao apresenta esses valores e nunca bloqueia a listagem por ausencia deles.

### Implementation for User Story 2

- [x] T007 [US2] Conferir que `schema.sql` mantem as colunas `dia_ida` e `convite` em `pesquisas_cantina` (sem `ALTER TABLE`, sem migracao) — a preservacao do historico depende disso
- [x] T008 [US2] Confirmar que `api/src/rotas/cantina.ts` (mapper `pesquisaDeRow`) e `src/pages/CantinaPesquisa.tsx` seguem lendo/exibindo `diaIda`/`convite` e que valores `NULL` de respostas novas sao renderizados sem erro

**Checkpoint**: Neste ponto as User Stories 1 e 2 funcionam independentemente e do ponto de vista de historico nada foi perdido.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Documentacao, regressao de build e validacao ponta a ponta.

- [x] T009 [P] Atualizar documentacao corrente: o contrato publico atual e `specs/023-remover-campos-pesquisa-cantina/contracts/cantina-publico.md` (v2, gerado no plano) — conferir que ele reconhece a remocao do `GET dias-festa` e do par `diaIda`/`convite`; specs/contratos de 020 permanecem como historico, sem edicao
- [x] T010 [P] Rodar regressao de build apos as mudancas: `npm run lint`, `npm run build` e `api/ npm run build` passam sem warnings de tipos
- [x] T011 Executar os cenarios 1 a 5 de `specs/023-remover-campos-pesquisa-cantina/quickstart.md` (formulario sem campos, envio completo, cliente antigo aceito, historico logado, `GET dias-festa` 404) — validacao estatica concluida em codigo; cenario runtime (navegador/API) disponivel no quickstart
- [ ] T012 Fazer commits em PT-BR no imperativo apos cada grupo logico (ex.: "Remove campos do formulario publico da pesquisa da cantina"), seguindo a constituicao

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - defines the unchangeable boundary (logged-in/reading path)
- **User Stories (Phase 3+)**: User Story 1 depends on Foundational boundary being respected; User Story 2 depends on the boundary being respected (no code changes, only guards)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - sem dependencias de outras stories. Internamente: T005 e prerrequisito de T006 (mesmo tipo); T003/T004/T005 atuam em arquivos distintos e podem rodar em paralelo
- **User Story 2 (P2)**: Can start after Foundational - nao integra com US1 (valida o lado que US1 nao toca) e e testavel de forma independente

### Within Each User Story

- Backend antes do frontend onde houver dependencia de contrato (T005 antes de T006)
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- T003 (API) e T005 (cliente) sao arquivos totalmente distintos — podem rodar em paralelo
- T004 (remocao da rota `dias-festa`) tambem independe das demais (mesmo arquivo de T003, exigindo sequencia dentro de `cantinaPublico.ts`)
- T007/T008 (guardas da US2) nao conflitam com a US1
- T009/T010 (polish) rodam em paralelo entre si

---

## Parallel Example: User Story 1

```bash
# Lote 1 — arquivos distintos, sem dependencia entre si:
Task: "API publica de envio sem dia/convite em api/src/rotas/cantinaPublico.ts"   # T003+T004
Task: "Cliente publico sem dia/convite em src/lib/cantina.ts"                     # T005

# Lote 2 — depende do cliente tipado (T005):
Task: "Formulario em src/pages/CantinaPesquisaPublico.tsx"                        # T006
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (build baseline)
2. Complete Phase 2: Foundational (boundary dos arquivos da area logada)
3. Complete Phase 3: User Story 1 (T003/T004/T005 paralelos, depois T006)
4. **STOP and VALIDATE**: abrir `/cantina/pesquisa` anonimo — dois campos ausentes, sem request `dias-festa`, envio OK
5. Entregar/demonstrar se pronto (hotfix de formulario publico)

### Incremental Delivery

1. Setup + Foundational → fronteira pronta
2. User Story 1 → testada sozinha (MVP)
3. User Story 2 → guardas de historico validadas
4. Polish → quickstart completo, build verde

### Parallel Team Strategy

Com mais de um dev:

1. Setup + Foundational juntos
2. Dev A: T003+T004 (API). Dev B: T005 (cliente) em paralelo
3. Dev B conclui T006 (formulario) apos o tipo ficar consistente
4. Guards da US2 e polish em qualquer dev livre

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Cada user story e completavel e testavel de forma independente
- Sem test runner no projeto; validacao por `npm run lint`/`npm run build`/`api/ npm run build` + `quickstart.md`
- Nenhum `ALTER TABLE`; colunas `dia_ida`/`convite` permanecem para o historico (guardado pela T002/T007)
- Chave desconhecida de cliente antigo e ignorada pelo zod nao estrito (nao rejeita o POST) — cenarios 3 do quickstart
- Commit em PT-BR no imperativo apos cada grupo logico
- Parar nos checkpoints para validar cada story isoladamente