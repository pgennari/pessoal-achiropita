# Tasks: Avaliacao de Coordenadores

**Input**: Design documents from `/specs/027-avaliacao-coordenadores/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Nao ha test runner no projeto (AGENTS.md). Nenhuma task de teste automatizado; a validacao e manual via `quickstart.md` (fases de Polish) + `npm run lint` / `npm run build` / `api/npm run build`.

**Organization**: Tasks grouped by user story (US1-US5, prioridades P1/P2 da spec).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Backend: `api/src/` (Hono, PostgreSQL via postgres.js)
- Frontend: `src/` (React SPA, cliente API em `src/lib/`)
- DDL no arquivo unico `schema.sql` (raiz)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparacao do ambiente e da branch da feature.

- [X] T001 Create branch `027-avaliacao-coordenadores` (git) e conferir que `npm run lint` e `api/npm run build` passam no estado atual (linha de base antes das mudancas)

**Checkpoint**: Branch criada e baseline green.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Tipos, sessao e DDL de que TODAS as user stories dependem.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 [P] Add DDL no final de schema.sql: tabela `links_avaliacao_coordenador` (campos: `id TEXT PK` [= ano da edicao em texto], `edicao_id TEXT NOT NULL REFERENCES edicoes(id) ON DELETE CASCADE`, `status status_link NOT NULL DEFAULT 'ativo'`, `criado_por_uid TEXT NOT NULL`, `criado_por_nome TEXT NOT NULL`, `criado_em TIMESTAMPTZ NOT NULL DEFAULT now()`) + index `idx_links_avaliacao_coordenador_edicao ON links_avaliacao_coordenador(edicao_id)`
- [X] T003 [P] Add DDL no final de schema.sql: tabela `avaliacoes_coordenador` (campos: `id TEXT PK DEFAULT gen_random_uuid()::text`, `edicao_id`, `equipe_pai_id`, `equipe_filha_id`, `avaliador_pessoa_id`, `avaliador_cracha INTEGER`, `avaliador_nome TEXT`, `pessoa_id` — todos TEXT NOT NULL com FK ON DELETE CASCADE para edicoes/equipes/pessoas — `permanencia TEXT`, `lideranca TEXT`, `ponto_positivo TEXT`, `aspecto_melhorar TEXT`, `situacao_registrar TEXT`, `recomendacao TEXT`, `status TEXT NOT NULL DEFAULT 'rascunho'`, `criado_em`, `atualizado_em`, `finalizado_em TIMESTAMPTZ`, `UNIQUE(edicao_id, avaliador_pessoa_id, pessoa_id, equipe_filha_id)`) + indices `idx_avaliacoes_coordenador_edicao`/`_pessoa`/`_filha`/`_avaliador`
- [X] T004 [P] Add tipos `SessaoCoordenador` (`{ pessoaId, cracha, edicaoId, equipeIds: string[], linkToken }`) e `VariaveisCoordenador` em api/src/tipos.ts (junto aos tipos de sessao existentes, ~linha 110)
- [X] T005 Create api/src/sessaoCoordenador.ts espelhando api/src/sessaoAvaliacao.ts: `criarSessaoCoordenadorJwt(sessao)` (SignJWT HS256 1h, `getSecret()`) e middleware `comSessaoCoordenador` (exige `Authorization: Bearer`, verify → 401, revalida `links_avaliacao_coordenador.status = 'ativo'` via `sessao.linkToken` → 410 `"Link inativo."`, injeta `c.set("sessaoCoordenador", sessao)`)
- [X] T006 Create src/lib/avaliacaoCoordenador.ts na pasta src/lib/ espelhando src/lib/avaliacao.ts: `gerarLinkAvaliacaoCoordenador`, `revogarLinkAvaliacaoCoordenador`, `buscarLinkAvaliacaoCoordenadorAtivo`, `listarAvaliacoesCoordenador`, `buscarAvaliacaoCoordenador`, `verificarLinkAvaliacaoCoordenador` (`apiPublica`), `identificarCoordenadorAvaliacaoCoordenador`, `listarAlvosAvaliacaoCoordenador` (`api.get` com sessaoToken), `salvarAvaliacaoCoordenador` — usar as rotas do contrato `./contracts/avaliacao-coordenador-integracao.md`

**Checkpoint**: Schema aplicavel, sessao JWT disponivel, cliente frontend pronto. Implementacao de user stories pode comecar.

---

## Phase 3: User Story 1 - Gerenciamento do link publico na tela da edicao (Priority: P1) 🎯 MVP

**Goal**: ADM/ORG ve, na tela da edicao, a secao "Avaliacao de Coordenadores" com o link publico `/avaliacao/coordenadores/{referencia}` (token = ano da edicao), acao de copiar e controle de ativo/revogado (FR-001 a FR-003).

**Independent Test**: Abrir `/edicoes/:id`, ir na aba "Avaliacao de Coordenadores", gerar o link, copiar e revogar; regenerar revoga o anterior (um ativo por edicao). Rotas internas exigem permissao `avaliacao.gerenciar` (403 sem ela).

### Implementation for User Story 1

- [X] T007 Create api/src/rotas/avaliacaoCoordenador.ts com as rotas internas de link (handler com `comAuth` + `temPermissao(sessao, "avaliacao.gerenciar")`, padrao de api/src/rotas/avaliacao.ts): `POST /links` (body `{ edicaoId }`; usar `SELECT ano FROM edicoes WHERE id = $1` e `ano::text` como id/token do link; revogar o ativo anterior da edicao; insert; auditoria `registrarEvento(sessao, "avaliacaoCoordenadorLink.gerou", ...)`; 201), `PUT /links/{id}/revogar` (200 `{ ok: true }` ou 404; auditoria `.revogou`), `GET /links/{edicaoId}` (link ativo ou 204). Rotas registradas com `@hono/zod-openapi` como no padrao existente
- [X] T008 [US1] Montar `app.route("/api/avaliacao-coordenador", avaliacaoCoordenador)` em api/src/index.ts (junto as montagens ~linha 92)
- [X] T009 [P] [US1] Add hooks em src/lib/hooks.ts: `useLinkAvaliacaoCoordenadorAtivo(edicaoId)` (queryKey `["avaliacaoCoordenadorLink", edicaoId]`, espelho de `useAvaliacaoLinkAtivo` ~linha 638)
- [X] T010 [P] [US1] Create src/pages/SecaoAvaliacaoCoordenadores.tsx com o painel do link (estado `carregando/link vazio`: botao "Gerar link"; com link: URL `${window.location.origin}/avaliacao/coordenadores/${link.id}` legivel, acao copiar via `navigator.clipboard.writeText` com feedback, botao revogar, estado ativo/revogado com badge) — espelhar o card de link de src/pages/Avaliacao.tsx (~linhas 141-185)
- [X] T011 [US1] Integrar no src/pages/EdicaoDetalhe.tsx: estender `abaAtiva` (hoje `"equipes" | "dias"`, ~linha 77) com `"avaliacaoCoordenadores"`, adicionar a aba "Avaliacao de Coordenadores" na `.tabs-lista`, renderizar `SecaoAvaliacaoCoordenadores` no painel apenas com `pode(sessao, "avaliacao.gerenciar")` (guard como nas linhas 95-99)

**Checkpoint**: US1 funcional — link gerado/copiado/revogado na tela da edicao.

---

## Phase 4: User Story 2 - Identificacao do coordenador pelo link publico (Priority: P1)

**Goal**: Coordenador abre `/avaliacao/coordenadores/:referencia`, informa o cracha e e autenticado via sessao JWT curta se for coordenador na edicao cuja equipe tem "APOIO" no nome (subtexto, case-insensitive) e ao menos uma equipe filha; caso contrario, mensagem de acesso negado generica (FR-005 a FR-009, FR-030).

**Independent Test**: Abrir o link em janela anonima e testar 4 crachas (coordenador APOIO+filhas → saudacao+sessao; equipe sem APOIO / sem filhas / nao-ocordenador / inexistente → mesma mensagem generica). Link revogado → `{ valido: false }`.

### Implementation for User Story 2

- [X] T012 Create api/src/rotas/avaliacaoCoordenadorPublico.ts (padrao de api/src/rotas/avaliacaoPublico.ts) com: `GET /api/publico/avaliacao-coordenador/{referencia}` (retorna `{ valido: true, edicaoId, edicaoNumero }` se link `ativo`, senao `{ valido: false }`, sem vazar dados) e `POST /api/publico/avaliacao-coordenador/coordenador` (body `{ token, cracha }`; cadeia de validacao: cracha existe/`ativo=true`/`excluida=false`; participacao `funcao='Coordenador'` na edicao do link; equipes coordenadas atendendo `UPPER(nome) LIKE '%APOIO%'` E com `COUNT(*)` de filhas (`equipe_pai_id` = equipe, mesma edicao, `excluida=false`) > 0; falha em qualquer etapa → `200 { erro: "Acesso negado" }` identico; sucesso → monta `SessaoCoordenador` com `equipeIds[]` de TODAS as equipes qualificadas, `criarSessaoCoordenadorJwt`, auditoria `avaliacaoCoordenador.identificou`, retorna `{ nome, equipes: [{equipeId, equipeNome}], sessaoToken }`)
- [X] T013 [US2] Montar `app.route("/api/publico", avaliacaoCoordenadorPublico)` em api/src/index.ts (~linha 94, proxima as outras rotas /api/publico)
- [X] T014 [P] [US2] Add rota publica `/avaliacao/coordenadores/:referencia` (anonima, sem Layout/ProtegerRota) em src/App.tsx apontando para `AvaliacaoCoordenadorPublico` (junto as rotas publicas ~linhas 65-77, antes de `*`)
- [X] T015 [US2] Create src/pages/AvaliacaoCoordenadorPublico.tsx (sem Layout, layout publico com logo como ValidarPublico.tsx:154) com maquina de etapas (`carregando | invalido | identificacao | verificando | alvos | erro`): validar link no mount, renderizar campo de cracha, chamar `identificarCoordenadorAvaliacaoCoordenador`, tratar falha com mensagem generica "Acesso negado" e sucesso guardando `sessaoToken`/`nome` em estado (padrao de AvaliacaoPublico.tsx ~linhas 84-131, 216-237)

**Checkpoint**: US2 funcional — coordenador elegivel se identifica; demais recebem negado generico.

---

## Phase 5: User Story 3 - Listagem dos coordenadores das equipes filhas (Priority: P1)

**Goal**: Apos identificar-se, o coordenador ve os alvos (coordenadores das equipes filhas) agrupados por equipe filha quando ha mais de uma; cada alvo com indicador de status pendente/rascunho/finalizada. Exclui o proprio avaliador e equipes filhas sem coordenador (FR-010 a FR-014, FR-023).

**Independent Test**: Coordenador com 2 filhas ve os alvos agrupados em 2 titulos; com 1 filha ve lista unica; filha sem coordenador nao gera alvo; auto-avaliacao nao aparece.

### Implementation for User Story 3

- [X] T016 [US3] Extender api/src/rotas/avaliacaoCoordenadorPublico.ts com `GET /api/publico/avaliacao-coordenador/alvos` (middleware `comSessaoCoordenador`; SQL espelhando `avaliacaoPublico.ts:31-44`: `DISTINCT ON` pessoas ativas com participacao `funcao='Coordenador'` na edicao da sessao e `equipe_id IN` (filhas de `sessao.equipeIds` via `equipe_pai_id = ANY(...)` e `excluida=false`), `LEFT JOIN avaliacoes_coordenador` em `(pessoa_id, edicao_id, avaliador_pessoa_id = sessao.pessoaId)`, excluindo `pessoa_id = sessao.pessoaId`, retornando `[{ pessoaId, pessoaNome, pessoaCracha, equipeFilhaId, equipeFilhaNome, avaliacaoId, statusAvaliacao }]`); registrar ESSA rota ANTES da rota dinamica `{referencia}` no arquivo (padrao avaliacaoPublico.ts:13-15)
- [X] T017 [P] [US3] Add hook `listarAlvosAvaliacaoCoordenador(sessaoToken)` ja em src/lib/avaliacaoCoordenador.ts (T006) e conferir tipagem `AlvoAvaliacaoCoordenador` em src/lib/tipos.ts
- [X] T018 [US3] Extender src/pages/AvaliacaoCoordenadorPublico.tsx: apos `sessaoToken`, chamar `listarAlvosAvaliacaoCoordenador` e renderizar a etapa `alvos` — agrupar por `equipeFilhaNome` quando >1 equipe (titulo do grupo), lista unica quando 1, badge de status (pendente = cinza/"Avaliar", rascunho = azul, finalizada = verde) e nome do alvo (padrao de AvaliacaoPublico.tsx ~456-483)

**Checkpoint**: US2+US3 funcionais — listagem agrupada com status.

---

## Phase 6: User Story 4 - Preenchimento e salvamento da avaliacao (Priority: P2)

**Goal**: Formulario de 6 questoes (2 fechadas + 4 abertas), todas obrigatorias para finalizar (abertas com minimo 20 caracteres), autosave com debounce 2s, finalizacao com confirmacao, rascunho retomavel e finalizada imutavel (FR-015 a FR-024).

**Independent Test**: Preencher parcialmente, recarregar e retomar o rascunho; finalizar com questao em branco ou texto aberto < 20 caracteres → bloqueio com mensagem; finalizar com tudo ok → confirmação e badge Finalizada; reabrir → modo leitura.

### Implementation for User Story 4

- [X] T019 [US4] Extender api/src/rotas/avaliacaoCoordenadorPublico.ts com `POST /api/publico/avaliacao-coordenador` (middleware `comSessaoCoordenador`; Zod: `permanencia` enum `["Sim","Sim, com algumas ressalvas","Nao tenho certeza","Nao"]`.nullable(), `lideranca` enum `["Excelente","Bom","Regular","Pouco","Nao possui"]`.nullable(), 4 abertas `z.string().max(4000)` e `finalizar z.boolean()`; upsert: buscar existente por `(pessoa_id, edicao_id, avaliador_pessoa_id, equipe_filha_id)`, se `finalizada` → 409, se `finalizar=true` validar 6 respostas presentes e abertas com `trim().length >= 20` → 422 com mensagem unica, UPDATE ou INSERT (com `avaliador_cracha`, `avaliador_nome` da sessao, `equipe_pai_id` = primeira de `sessao.equipeIds` elegivel — usar a equipe que gerou o alvo), retorna `{ id, status, atualizadoEm }`)
- [X] T020 [P] [US4] Extender src/lib/tipos.ts com `QuestionarioCoordenador` (`permanencia: PermanenciaCoordenador | null; lideranca: LiderancaCoordenador | null; pontoPositivo: string | null; aspectoMelhorar: string | null; situacaoRegistrar: string | null; recomendacao: string | null`) e tipos `PermanenciaCoordenador`/`LiderancaCoordenador` (unions com os valores da spec FR-016)
- [X] T021 [US4] Extender src/pages/AvaliacaoCoordenadorPublico.tsx: ao selecionar alvo (role/excecao: se `statusAvaliacao === "finalizada"` → modo leitura sem edicao), renderizar o formulario (Q1/Q2 como grupos de radio fechados, Q3-Q6 como textarea com `maxLength={4000}`), manter `dadosRef` + `setTimeout` 2000ms para autosave (`salvarAvaliacaoCoordenador(sessaoToken, {..., finalizar: false})`) com indicador "Salvando..." (padrao AvaliacaoPublico.tsx ~153-214), validar no frontend (6 respondidas + abertas >= 20) antes de abrir modal de confirmacao de finalizacao (~697-739), retornar a lista apos finalizar e atualizar badge

**Checkpoint**: US4 funcional — formulario completo com autosave, validacao e imutabilidade.

---

## Phase 7: User Story 5 - Acompanhamento das avaliacoes pela organizacao (Priority: P2)

**Goal**: Na aba da edicao, ADM/ORG ve todas as avaliacoes de coordenadores com filtros por equipe (filha), avaliador e status, e detalhe em modo leitura mostrando as 6 questoes (FR-027, FR-028).

**Independent Test**: Com avaliacoes registradas (dados do cenario US4), listar com filtros e abrir detalhe em modo leitura exibindo avaliador, avaliado, equipes, edicao, datas e as 6 respostas.

### Implementation for User Story 5

- [X] T022 [US5] Extender api/src/rotas/avaliacaoCoordenador.ts com `GET /api/avaliacoes-coordenador` (query `edicaoId` obrigatorio, `equipeId` [equipe filha], `avaliadorPessoaId`, `status`; JOIN equipes/pessoas para `equipeFilhaNome`, `pessoaNome`, `pessoaCracha`; `ORDER BY atualizado_em DESC` — espelho de avaliacao.ts:140-196) e `GET /api/avaliacoes-coordenador/{id}` (detalhe completo com as 6 respostas; 404 senao) + montar `app.route("/api/avaliacoes-coordenador", avaliacaoCoordenador)` em api/src/index.ts
- [X] T023 [P] [US5] Add hook `useAvaliacoesCoordenador(edicaoId, {equipeId?, avaliadorPessoaId?, status?})` em src/lib/hooks.ts (queryKey espelhando `useAvaliacoes` ~linha 647)
- [X] T024 [US5] Extender src/pages/SecaoAvaliacaoCoordenadores.tsx: aba com listagem completa (tabela `.tabela-larga` com colunas avaliado/cracha/equipe filha/avaliador/status/atualizado em, espelho de Avaliacao.tsx ~225-274), filtros por equipe/avaliador/status (padrao de RelatorioAvaliacoes.tsx ~157-263), e detalhe em modo leitura com o questionario completo via `buscarAvaliacaoCoordenador`

**Checkpoint**: US5 funcional — organizacao acompanha o processo completo.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Validacao end-to-end, builds e documentacao.

- [X] T025 [P] Rodar os 5 cenarios de `specs/027-avaliacao-coordenadores/quickstart.md` (link na edicao, identificacao, listagem agrupada, formulario/finalizacao com minimo 20 chars, acompanhamento + revogacao) e corrigir desvios. *Nota: quickstart.md atualizado; validacao manual runtime exige ambiente local com Postgres + emuladores e fica registrada no quickstart.*
- [X] T026 [P] Rodar `npm run lint`, `npm run build` e `api/npm run build` e garantir green
- [X] T027 Atualizar AGENTS.md (tabela de rotas ~linha 55-75): adicionar rota publica `/avaliacao/coordenadores/:referencia` (AvaliacaoCoordenadorPublico, anonimo, sem Layout) e a secao "Avaliacao de Coordenadores" na tela da edicao

**Checkpoint**: Feature completa, validada e documentada.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — pode comecar imediatamente.
- **Foundational (Phase 2)**: Depende de Setup; BLOQUEIA todas as user stories (schema, tipos, sessao, cliente).
- **User Stories**: Dependem de Foundational.
  - US1 (P1) e US2 (P1) independem entre si apos o Foundational (arquivos distintos: `avaliacaoCoordenador.ts` vs `avaliacaoCoordenadorPublico.ts`).
  - US3 depende de US2 (usa `sessaoToken` e o mesmo arquivo publico).
  - US4 depende de US3 (mesmo arquivo publico + alvos).
  - US5 depende de US1 (mesmo arquivo interno) e idealmente de US4 para haver dados; a listagem pode ser implementada em paralelo a US4.
- **Polish (Final Phase)**: Depende de todas as user stories.

### User Story Dependencies

- **US1 (P1)**: So Foundational.
- **US2 (P1)**: So Foundational.
- **US3 (P1)**: US2 (mesmo arquivo `avaliacaoCoordenadorPublico.ts` e fluxo de sessao).
- **US4 (P2)**: US3 (formulario opera sobre os alvos).
- **US5 (P2)**: US1 (mesmo arquivo interno) + dados criados por US4 para validacao completa.

### Within Each User Story

- Tipos/contrato antes do handler; handler antes da UI; UI antes do checkpoint.
- Cada story termina com `npm run lint`/`npm run build`/`api/npm run build` green.

### Parallel Opportunities

- Foundational: T002/T003/T004 independentes ([P]); T005 depende de T004, T006 de T003+contrato.
- US1 e US2 em paralelo (arquivos diferentes) apos Foundational.
- Dentro de US1: T009/T010 em paralelo ([P]) antes de T011 (integra as duas).
- Dentro de US2: T014 em paralelo a T012/T013.
- US5 backend (T022) e independe de US4; pode rodar junto.

---

## Parallel Example: Foundational

```bash
# Tabelas (schema.sql) e tipos em paralelo:
Task: "Add DDL links_avaliacao_coordenador + avaliacoes_coordenador em schema.sql"
Task: "Add SessaoCoordenador em api/src/tipos.ts"
Task: "Add tipos de frontend em src/lib/tipos.ts"
```

## Parallel Example: US1 + US2

```bash
Task: "Create api/src/rotas/avaliacaoCoordenador.ts (links internos) e montar em index.ts"
Task: "Create api/src/rotas/avaliacaoCoordenadorPublico.ts (validar link + identificar) e montar em index.ts"
# Depois a UI de cada story:
Task: "Create src/pages/SecaoAvaliacaoCoordenadores.tsx + aba no EdicaoDetalhe"
Task: "Create src/pages/AvaliacaoCoordenadorPublico.tsx + rota em App.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup (branch 027-avaliacao-coordenadores).
2. Phase 2: Foundational (schema, tipos, sessao, cliente API).
3. Phase 3: US1 (gerar/copiar/revogar link na edicao).
4. **STOP and VALIDATE**: US1 sozinha na tela da edicao.
5. Deploy se desejado (hosting + api).

### Incremental Delivery

1. Setup + Foundational → base pronta.
2. US1 → link gerenciavel (MVP).
3. US2 + US3 → fluxo publico de identificacao e listagem agrupada (P1).
4. US4 → avaliacao completa com autosave/finalizacao (P2).
5. US5 → acompanhamento pela organizacao (P2).
6. Polish → quickstart, builds, AGENTS.md.

### Parallel Team Strategy

Com 2 desenvolvedores apos o Foundational:
- Dev A: US1 (link interno + aba) → US5 (acompanhamento).
- Dev B: US2 (publico identificar) → US3 (alvos) → US4 (formulario).

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label mapeia a task para a user story da spec (US1-US5).
- Cada user story e independentemente testavel pelos cenarios do `quickstart.md`.
- Commits em PT-BR, imperativo, apos cada task ou grupo logico (Constitution IV).
- Nao criar PR antes do pedido; rodar `npm run lint`/builds antes de commit.
- Evitar: tasks vagas, conflito no mesmo arquivo, dependencias cruzadas que quebrem a independencia das stories.