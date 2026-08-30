# Tasks: Avaliacao de Coordenadores pelo Equipista

**Input**: Design documents from `/specs/028-avaliacao-equipista-coordenador/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Nao ha test runner no projeto (AGENTS.md). Nenhuma task de teste automatizado; a validacao e manual via `quickstart.md` (fases de Polish) + `npm run lint` / `npm run build` / `api/npm run build`.

**Organization**: Tasks grouped by user story (US1-US4, prioridades P1/P2 da spec).

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

- [X] T001 Create branch `028-avaliacao-equipista-coordenador` (git) e conferir que `npm run lint`, `npm run build` e `api/npm run build` passam no estado atual (linha de base antes das mudancas)

**Checkpoint**: Branch criada e baseline green.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Tipos, sessao e DDL de que TODAS as user stories dependem.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 [P] Add DDL no final de schema.sql: tabela `links_avaliacao_equipista` (campos: `id TEXT PK` [= ano da edicao em texto], `edicao_id TEXT NOT NULL REFERENCES edicoes(id) ON DELETE CASCADE`, `status status_link NOT NULL DEFAULT 'ativo'`, `criado_por_uid TEXT NOT NULL`, `criado_por_nome TEXT NOT NULL`, `criado_em TIMESTAMPTZ NOT NULL DEFAULT now()`) + `CREATE UNIQUE INDEX IF NOT EXISTS idx_links_avaliacao_equipista_edicao_ativo ON links_avaliacao_equipista(edicao_id) WHERE status = 'ativo'` (espelho de `links_avaliacao_coordenador`, schema.sql:930-940) + index `idx_links_avaliacao_equipista_edicao ON links_avaliacao_equipista(edicao_id)`
- [X] T003 [P] Add DDL no final de schema.sql: tabela `avaliacoes_equipista_coordenador` (campos: `id TEXT PK DEFAULT gen_random_uuid()::text`, `edicao_id`, `equipe_id`, `avaliador_pessoa_id`, `avaliador_cracha INTEGER`, `avaliador_nome TEXT`, `pessoa_id` — todos TEXT NOT NULL com FK ON DELETE CASCADE — `criterios JSONB NOT NULL DEFAULT '{}'`, `comentarios TEXT`, `status TEXT NOT NULL DEFAULT 'finalizada'`, `criado_em`, `atualizado_em`, `finalizado_em TIMESTAMPTZ NOT NULL DEFAULT now()`, `UNIQUE(edicao_id, avaliador_pessoa_id, pessoa_id)` — sem estado `rascunho`; a avaliacao so existe finalizada) + indices `idx_avaliacoes_equipista_coord_edicao`/`_pessoa`/`_avaliador`
- [X] T004 [P] Add tipos `SessaoEquipista` (`{ pessoaId, cracha, edicaoId, equipeId: string, linkToken }` — equipeId singular, pois a pessoa tem uma unica equipe por edicao) e `VariaveisVerificacaoEquipista` em api/src/tipos.ts (junto aos tipos de sessao existentes, ~linha 110, espelho de `SessaoCoordenador`)
- [X] T005 Create api/src/sessaoEquipista.ts espelhando api/src/sessaoCoordenador.ts: `criarSessaoEquipistaJwt(sessao)` (SignJWT HS256 1h, `getSecret()`) e middleware `comSessaoEquipista` (exige `Authorization: Bearer`, verify → 401, revalida `links_avaliacao_equipista.status = 'ativo'` via `sessao.linkToken` → 410 `"Link inativo."`, injeta `c.set("sessaoEquipista", sessao)`)
- [X] T006 Create src/lib/avaliacaoEquipistaCoordenador.ts na pasta src/lib/ espelhando src/lib/avaliacaoCoordenador.ts: `gerarLinkAvaliacaoEquipista`, `revogarLinkAvaliacaoEquipista`, `buscarLinkAvaliacaoEquipistaAtivo`, `listarAvaliacoesEquipistaCoordenador`, `buscarAvaliacaoEquipistaCoordenador`, `verificarLinkAvaliacaoEquipista` (`apiPublica`), `identificarEquipista` (`apiPublica` "POST" `/api/publico/avaliacao-equipista/identificar`), `listarAlvosAvaliacaoEquipista` (`api.get` com sessaoToken), `salvarAvaliacaoEquipistaCoordenador` — usar as rotas do contrato `./contracts/avaliacao-equipista-coordenador-integracao.md`

**Checkpoint**: Schema aplicavel, sessao JWT disponivel, cliente frontend pronto. Implementacao de user stories pode comecar.

---

## Phase 3: User Story 1 - Nova aba "Coordenador" e link publico na tela de Avaliacao (Priority: P1) 🎯 MVP

**Goal**: ADM/ORG ve, na tela de Avaliacao (`/avaliacao`, PaginaAvaliacao), uma nova terceira aba **"Coordenador"** ao lado das abas "Equipistas" e "Apoio", com o link publico `/avaliacao/equipista/{referencia}` (token = ano da edicao), acao de copiar e controle de ativo/revogado (FR-001 a FR-004). A listagem completa com filtros e detalhe vem na US4.

**Independent Test**: Abrir `/avaliacao`, ver a nova aba "Coordenador" ao lado de "Equipistas" e "Apoio", gerar o link, copiar e revogar; regenerar revoga o anterior (um ativo por edicao). Rotas internas exigem permissao `avaliacao.gerenciar` (403 sem ela).

### Implementation for User Story 1

- [X] T007 Create api/src/rotas/avaliacaoEquipistaCoordenador.ts com as rotas internas de link (handler com `comAuth` + `temPermissao(sessao, "avaliacao.gerenciar")`, padrao de api/src/rotas/avaliacaoCoordenador.ts): `POST /links` (body `{ edicaoId }`; `SELECT ano FROM edicoes WHERE id = $1` e `ano::text` como id/token; revogar o ativo anterior da edicao; insert; auditoria `registrarEvento(sessao, "avaliacaoEquipistaLink.gerou", ...)`; 201), `PUT /links/{id}/revogar` (200 `{ ok: true }` ou 404; auditoria `.revogou`), `GET /links/{edicaoId}` (link ativo ou 204). Rotas registradas com `@hono/zod-openapi` como no padrao existente
- [X] T008 [US1] Montar `app.route("/api/avaliacao-equipista", avaliacaoEquipistaCoordenador)` em api/src/index.ts (junto as montagens ~linha 100, apos a 99 do coordenador) — a rota de listagem `/api/avaliacoes-equipista-coordenador` sera montada na US4
- [X] T009 [P] [US1] Add hook em src/lib/hooks.ts: `useLinkAvaliacaoEquipistaAtivo(edicaoId)` (queryKey `["avaliacaoEquipistaLink", edicaoId]`, espelho de `useLinkAvaliacaoCoordenadorAtivo`/`useAvaliacaoLinkAtivo`)
- [X] T010 [P] [US1] Create src/pages/SecaoAvaliacaoEquipistaCoordenadores.tsx com o painel do link (estado `carregando/link vazio`: botao "Gerar link"; com link: URL `${window.location.origin}/avaliacao/equipista/${link.id}` legivel, acao copiar via `navigator.clipboard.writeText` com feedback, botao revogar, estado ativo/revogado com badge) — espelhar o card de link de src/pages/Avaliacao.tsx (~linhas 141-200) e a SecaoAvaliacaoCoordenadores
- [X] T011 [US1] Integrar no src/pages/Avaliacao.tsx (PaginaAvaliacao): estender `abaAtiva` (hoje `"equipistas" | "coordenadores"`, ~linha 53) para incluir `"equipistaCoordenador"`, adicionar a terceira aba **"Coordenador"** na `.tabs-lista` (~linhas 143-164, ao lado de "Equipistas" e "Apoio"), renderizar `SecaoAvaliacaoEquipistaCoordenadores` no painel apenas com `temPermissao(sessao, "avaliacao.gerenciar")` (guard como na linha 55) — NAO alterar a aba "Apoio" (coordenadores/027)

**Checkpoint**: US1 funcional — nova aba "Coordenador" com link gerado/copiado/revogado na tela de Avaliacao.

---

## Phase 4: User Story 2 - Identificacao e confirmacao de identidade pelo link publico (Priority: P1)

**Goal**: Equipista abre `/avaliacao/equipista/:referencia`, informa o cracha e, se tiver cadastro ativo (ativo e nao excluida logicamente) com participacao na edicao do link, ve foto, nome e equipe e **confirma se e ele mesmo**; somente apos confirmar o fluxo prossegue. Se o equipista ja enviou a avaliacao, exibe apenas "avaliacao ja enviada" sem mostrar respostas (FR-005 a FR-010, FR-017).

**Independent Test**: Abrir o link em janela anonima e testar: cracha com cadastro ativo → tela de confirmacao (foto/nome/equipe) → confirmar prossegue; "nao sou eu" encerra; cracha inexistente ou cadastro nao ativo → MESMA mensagem generica "Acesso negado"; cracha de quem ja enviou → mensagem "avaliacao ja enviada". Link revogado → `{ valido: false }`.

### Implementation for User Story 2

- [X] T012 Create api/src/rotas/avaliacaoEquipistaCoordenadorPublico.ts (padrao de api/src/rotas/avaliacaoCoordenadorPublico.ts) com: `GET /api/publico/avaliacao-equipista/{referencia}` (retorna `{ valido: true, edicaoId, edicaoNumero }` se link `ativo`, senao `{ valido: false }`, sem vazar dados) e `POST /api/publico/avaliacao-equipista/identificar` (body `{ token, cracha }`; cadeia de validacao: pessoa existe/`ativo=true`/`excluida=false`; participacao `funcao='Equipista'` na edicao do link; falha em qualquer etapa → `200 { erro: "Acesso negado" }` identico; sucesso → `SELECT COUNT(*)` de avaliacaos ja finalizadas do equipista na edicao para `jaEnviou`, monta `SessaoEquipista` com `equipeId` (da participacao), `criarSessaoEquipistaJwt`, auditoria `avaliacaoEquipista.identificou`, retorna `{ nome, fotoUrl, equipeNome, sessaoToken, jaEnviou }` — `fotoUrl` = `pessoas.foto_url` (pode ser null))
- [X] T013 [US2] Montar `app.route("/api/publico", avaliacaoEquipistaCoordenadorPublico)` em api/src/index.ts (~linha 100, apos a rota publica do coordenador)
- [X] T014 [P] [US2] Add rota publica `/avaliacao/equipista/:referencia` (anonima, sem Layout/ProtegerRota) em src/App.tsx apontando para `AvaliacaoEquipistaCoordenadorPublico` (junto as rotas publicas ~linhas 75-82, apos a rota `/avaliacao/coordenadores/:referencia`)
- [X] T015 [US2] Create src/pages/AvaliacaoEquipistaCoordenadorPublico.tsx (sem Layout, layout publico com logo como ValidarPublico.tsx:154) com maquina de etapas (`carregando | invalido | identificacao | verificando | confirmacao | jaEnviada | alvos | erro`): validar link no mount, renderizar campo de cracha, chamar `identificarEquipista`; se `jaEnviou` → etapa `jaEnviada` exibindo "Avaliacao ja enviada" sem respostas; se falha → mensagem generica "Acesso negado"; se sucesso → etapa `confirmacao` mostrando foto (`fotoUrl` ou inicial), `nome` e `equipeNome` com botoes "Confirmar" (prossegue a `alvos`) e "Nao sou eu" (encerra o fluxo, sem prosseguir), guardando `sessaoToken`/`nome` em estado (padrao de AvaliacaoCoordenadorPublico.tsx ~linhas 31-100, 370-410)

**Checkpoint**: US2 funcional — equipista elegivel se identifica e confirma; demais recebem negado generico; quem ja enviou ve "avaliacao ja enviada".

---

## Phase 5: User Story 3 - Listagem e avaliacao dos coordenadores (Priority: P1)

**Goal**: Apos confirmar a identidade, o equipista ve os nomes dos coordenadores da sua equipe com status (pendente/finalizada) e avalia cada um com o questionario de 6 criterios (Pontualidade, Dedicacao, Companheirismo, Espiritualidade, Comprometimento, Uniforme) + comentarios. **NAO ha salvamento automatico nem rascunho**: o preenchimento fica no estado local e a avaliacao e persistida somente ao finalizar, apos aviso "nao sera possivel editar apos finalizado" e confirmacao (FR-011 a FR-016, FR-018 a FR-022).

**Independent Test**: Listagem mostra os coordenadores da equipe com status; preencher e fechar/trocar de coordenador → nada e salvo; finalizar com criterio em branco → bloqueio; finalizar tudo → aviso de imutabilidade + modal de confirmacao → badge "Finalizada"; reabrir o alvo finalizado → imutavel/respostas nao editaveis.

### Implementation for User Story 3

- [X] T016 [US3] Extender api/src/rotas/avaliacaoEquipistaCoordenadorPublico.ts com `GET /api/publico/avaliacao-equipista/alvos` (middleware `comSessaoEquipista`; SQL espelhando `avaliacaoPublico.ts:31-44`: pessoas ativas com participacao `funcao='Coordenador'` na edicao da sessao e `equipe_id = sessao.equipeId` (equipe do equipista), `LEFT JOIN avaliacoes_equipista_coordenador` em `(pessoa_id, edicao_id, avaliador_pessoa_id = sessao.pessoaId)`, excluindo `pessoa_id = sessao.pessoaId`, retornando `[{ pessoaId, pessoaNome, pessoaCracha, avaliacaoId, statusAvaliacao }]` onde `statusAvaliacao` e `null` ou `"finalizada"`; `criterios`/`comentarios` sempre `null` nesta listagem — nao revelar respostas); registrar ESSA rota ANTES da rota dinamica `{referencia}` no arquivo (padrao avaliacaoPublico.ts:13-15)
- [X] T017 [P] [US3] Add hook `listarAlvosAvaliacaoEquipista(sessaoToken)` ja em src/lib/avaliacaoEquipistaCoordenador.ts (T006) e conferir tipagem `AlvoAvaliacaoEquipista` em src/lib/tipos.ts (`{ pessoaId, pessoaNome, pessoaCracha, avaliacaoId, statusAvaliacao }`)
- [X] T018 [US3] Extender src/pages/AvaliacaoEquipistaCoordenadorPublico.tsx: apos `sessaoToken`, chamar `listarAlvosAvaliacaoEquipista` e renderizar a etapa `alvos` — lista dos coordenadores com badge de status (pendente = "Avaliar", finalizada = verde) e nome (padrao de AvaliacaoCoordenadorPublico.tsx ~437-460); selecionar alvo finalizada abre em modo leitura imutavel
- [X] T019 [US3] Extender api/src/rotas/avaliacaoEquipistaCoordenadorPublico.ts com `POST /api/publico/avaliacao-equipista` (middleware `comSessaoEquipista`; Zod: `criterios` enum `["Otimo","Bom","Regular","Ruim"]` para os 6 criterios `pontualidade|dedicacao|companheirismo|espiritualidade|comprometimento|uniforme` (todos obrigatorios, sem `.nullable()`), `comentarios` `z.string().max(4000).nullable()`; buscar existente por `(pessoa_id, edicao_id, avaliador_pessoa_id)`; se `finalizada` → 409 `"Avaliação finalizada não pode ser alterada"`; validar coordenador-alvo com participacao `funcao='Coordenador'` na mesma equipe na edicao → 422 se invalido; INSERT com `avaliador_cracha`/`avaliador_nome` da sessao, `status='finalizada'`, `finalizado_em=now()`; retorna `{ id, status: "finalizada", finalizadoEm }`) — sem atualizar rascunho (nao ha rascunho)
- [X] T020 [P] [US3] Extender src/lib/tipos.ts com `CriteriosEquipistaCoordenador` (`{ pontualidade: "Otimo"|"Bom"|"Regular"|"Ruim"; dedicacao; companheirismo; espiritualidade; comprometimento; uniforme }`) e tipagem de `QuestionarioEquipistaCoordenador` (`criterios: CriteriosEquipistaCoordenador; comentarios: string | null`) alinhada ao contrato
- [X] T021 [US3] Extender src/pages/AvaliacaoEquipistaCoordenadorPublico.tsx: ao selecionar alvo pendente, renderizar o formulario (6 criterios como grupos de radio/select fechados + campo de comentarios `textarea maxLength={4000}`) com estado local apenas (sem autosave, sem `dadosRef`/`setTimeout`); ao acionar FINALIZAR, validar os 6 criterios no frontend (mensagem se faltar), exibir aviso "Nao sera possivel editar apos finalizado" + modal de confirmacao, e apos confirmar chamar `salvarAvaliacaoEquipistaCoordenador(sessaoToken, { pessoaId, criterios, comentarios })`, retornar a lista e atualizar o badge (padrao de AvaliacaoCoordenadorPublico.tsx ~470-560, mas SEM autosave)

**Checkpoint**: US3 funcional — formulario de 6 criterios + comentarios, sem autosave, finalizacao com aviso de imutabilidade e confirmacao, imutavel apos finalizar.

---

## Phase 6: User Story 4 - Acompanhamento das avaliacoes pela organizacao (Priority: P2)

**Goal**: Na aba "Coordenador" (PaginaAvaliacao), ADM/ORG ve todas as avaliacoes finalizadas com filtros por equipe, avaliador e status, e detalhe em modo leitura mostrando os 6 criterios e comentarios (FR-023, FR-024).

**Independent Test**: Com avaliacoes registradas (dados do cenario US3), listar com filtros e abrir detalhe em modo leitura exibindo avaliador, avaliado, equipe, edicao, datas, 6 criterios e comentarios.

### Implementation for User Story 4

- [X] T022 [US4] Extender api/src/rotas/avaliacaoEquipistaCoordenador.ts com `GET /api/avaliacoes-equipista-coordenador` (query `edicaoId` obrigatorio, `equipeId`, `avaliadorPessoaId`, `status`; JOIN equipes/pessoas para `equipeNome`, `pessoaNome`, `pessoaCracha`, `avaliadorNome`; `ORDER BY atualizado_em DESC` — espelho de avaliacaoCoordenador.ts:204-243) e `GET /api/avaliacoes-equipista-coordenador/{id}` (detalhe completo com `criterios` JSONB parseado e `comentarios`; 404 senao) + montar `app.route("/api/avaliacoes-equipista-coordenador", avaliacaoEquipistaCoordenador)` em api/src/index.ts
- [X] T023 [P] [US4] Add hook `useAvaliacoesEquipistaCoordenador(edicaoId, {equipeId?, avaliadorPessoaId?, status?})` em src/lib/hooks.ts (queryKey espelhando `useAvaliacoes`/~`useAvaliacoesCoordenador`)
- [X] T024 [US4] Extender src/pages/SecaoAvaliacaoEquipistaCoordenadores.tsx: alem do painel do link (US1), adicionar a listagem completa (tabela `.tabela-larga` com colunas avaliado/cracha/equipe/avaliador/status/atualizado em), filtros por equipe/avaliador/status (padrao de relatorios existentes como RelatorioAvaliacoes.tsx ~157-263), e detalhe em modo leitura com o questionario via `buscarAvaliacaoEquipistaCoordenador`

**Checkpoint**: US4 funcional — organizacao acompanha o processo completo na aba "Coordenador".

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validacao end-to-end, builds e documentacao.

- [X] T025 [P] Rodar os 4 cenarios de `specs/028-avaliacao-equipista-coordenador/quickstart.md` (gestao do link e aba; identificacao e confirmacao de identidade + "ja enviada"; listagem e preenchimento sem autosave com finalizacao com aviso de imutabilidade; acompanhamento e integridade) e corrigir desvios
- [X] T026 [P] Rodar `npm run lint`, `npm run build` e `api/npm run build` e garantir green
- [X] T027 Atualizar AGENTS.md (tabela de rotas ~linha 55-75): adicionar rota publica `/avaliacao/equipista/:referencia` (AvaliacaoEquipistaCoordenadorPublico, anonimo, sem Layout) e a nova terceira aba "Coordenador" na tela de Avaliacao

**Checkpoint**: Feature completa, validada e documentada.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — pode comecar imediatamente.
- **Foundational (Phase 2)**: Depende de Setup; BLOQUEIA todas as user stories (schema, tipos, sessao, cliente).
- **User Stories**: Dependem de Foundational.
  - US1 (P1) e US2 (P1) independem entre si apos o Foundational (arquivos objetivos distintos: `avaliacaoEquipistaCoordenador.ts` vs `avaliacaoEquipistaCoordenadorPublico.ts`; a UI da US1 usa `Avaliacao.tsx`/`SecaoAvaliacaoEquipistaCoordenadores.tsx`, a UI da US2 usa `AvaliacaoEquipistaCoordenadorPublico.tsx`).
  - US3 depende de US2 (usa `sessaoToken` e o mesmo arquivo publico).
  - US4 depende de US1 (mesmo arquivo interno e a aba) e idealmente de US3 para haver dados; a listagem pode ser implementada em paralelo a US3.
- **Polish (Final Phase)**: Depende de todas as user stories.

### User Story Dependencies

- **US1 (P1)**: So Foundational.
- **US2 (P1)**: So Foundational.
- **US3 (P1)**: US2 (mesmo arquivo `avaliacaoEquipistaCoordenadorPublico.ts` e fluxo de sessao).
- **US4 (P2)**: US1 (mesmo arquivo interno `avaliacaoEquipistaCoordenador.ts` e a aba na PaginaAvaliacao) + dados criados por US3 para validacao completa.

### Within Each User Story

- Tipos/contrato antes do handler; handler antes da UI; UI antes do checkpoint.
- Cada story termina com `npm run lint`/`npm run build`/`api/npm run build` green.

### Parallel Opportunities

- Foundational: T002/T003/T004 independentes ([P]); T005 depende de T004, T006 de T003+contrato.
- US1 e US2 em paralelo (arquivos diferentes) apos Foundational.
- Dentro de US1: T009/T010 em paralelo ([P]) antes de T011 (integra as duas).
- Dentro de US2: T014 em paralelo a T012/T013.
- Dentro de US3: T017/T020 em paralelo aos handlers ([P]); T018 depende de T016/T017, T021 depende de T019/T020.
- US4 backend (T022) e independe de US3; pode rodar junto.

---

## Parallel Example: Foundational

```bash
# Tabelas (schema.sql) e tipos em paralelo:
Task: "Add DDL links_avaliacao_equipista + avaliacoes_equipista_coordenador em schema.sql"
Task: "Add SessaoEquipista em api/src/tipos.ts"
Task: "Add tipos de frontend em src/lib/tipos.ts"
```

## Parallel Example: US1 + US2

```bash
Task: "Create api/src/rotas/avaliacaoEquipistaCoordenador.ts (links internos) e montar em index.ts"
Task: "Create api/src/rotas/avaliacaoEquipistaCoordenadorPublico.ts (validar link + identificar) e montar em index.ts"
# Depois a UI de cada story:
Task: "Create src/pages/SecaoAvaliacaoEquipistaCoordenadores.tsx + 3a aba no Avaliacao.tsx"
Task: "Create src/pages/AvaliacaoEquipistaCoordenadorPublico.tsx + rota em App.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup (branch 028-avaliacao-equipista-coordenador).
2. Phase 2: Foundational (schema, tipos, sessao, cliente API).
3. Phase 3: US1 (aba "Coordenador" na PaginaAvaliacao + gerar/copiar/revogar link).
4. **STOP and VALIDATE**: US1 sozinha na tela de Avaliacao.
5. Deploy se desejado (hosting + api).

### Incremental Delivery

1. Setup + Foundational → base pronta.
2. US1 → link gerenciavel na aba "Coordenador" (MVP).
3. US2 → fluxo publico de identificacao/confirmacao de identidade e "ja enviada" (P1).
4. US3 → listagem e avaliacao dos coordenadores com finalizacao (sem autosave) (P1).
5. US4 → acompanhamento pela organizacao com filtros/detalhe (P2).
6. Polish → quickstart, builds, AGENTS.md.

### Parallel Team Strategy

Com 2 desenvolvedores apos o Foundational:
- Dev A: US1 (link interno + aba) → US4 (acompanhamento).
- Dev B: US2 (publico identificar/confirmar) → US3 (alvos + formulario).

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label mapeia a task para a user story da spec (US1-US4).
- Cada user story e independentemente testavel pelos cenarios do `quickstart.md`.
- NAO ha salvamento automatico nem estado `rascunho` (clarificacao da sessao 2026-08-30): o preenchimento e local e a avaliacao so existe finalizada; nao criar `debounceRef`/`dadosRef`/`salvarLockRef`/`pendenteRef`.
- Commits em PT-BR, imperativo, apos cada task ou grupo logico (Constitution IV).
- Nao criar PR antes do pedido; rodar `npm run lint`/builds antes de commit.
- Evitar: tasks vagas, conflito no mesmo arquivo, dependencias cruzadas que quebrem a independencia das stories.
