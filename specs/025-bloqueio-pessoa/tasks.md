---

description: "Task list for feature 025-bloqueio-pessoa"
---

# Tasks: Bloqueio de Pessoas (equipistas)

**Input**: Design documents from `/specs/025-bloqueio-pessoa/` (spec.md, plan.md, research.md, data-model.md, contracts/bloqueios-api.md, quickstart.md)

**Prerequisites**: plan.md (required), spec.md (user stories), research.md, data-model.md, contracts/bloqueios-api.md, quickstart.md

**Tests**: Sem test runner no projeto. Validacao e manual via `specs/025-bloqueio-pessoa/quickstart.md` (cenarios S1-S7) + `npm run lint` (front, = `tsc -b --noEmit`) + `api/npm run build` (back). Nenhuma tarefa de teste automatizado.

**Organization**: Tasks grouped by user story (spec.md) para implementacao e validacao independentes. Backend e contrato vao na fase Foundational (recurso `/api/bloqueios` e consumido por US1, US3, US4, US6); cada user story e uma fatia de interface/integracao testavel isoladamente.

**Rework (2026-08-29)**: A spec 025 passou de **modal** para **paginas dedicadas** (`/pessoas/:id/bloquear` e `/pessoas/:id/desbloquear`). Os botoes no detalhe da Pessoa navegam (`useNavigate`) em vez de abrir overlay, e o submit de cada pagina redireciona para a tela Bloqueios. O backend (contrato `/api/bloqueios`) e o modelo de dados **nao mudam** — apenas a apresentacao/navegacao no front. Tasks T010-T014 (US1), T022-T024 (US4) e T040 refletem a nova abordagem e estao desmarcadas (rework pendente).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1...US7)
- Include exact file paths in descriptions

## Path Conventions

- Frontend (SPA React): `src/`
- Backend (API Hono): `api/src/`
- Banco: `schema.sql` (source of truth) + `scripts/` (migrations standalone)

---

## Phase 1: Setup (Compartilhado)

**Purpose**: Infraestrutura de banco e permissoes da feature.

- [X] T001 Adicionar o bloco `025-bloqueio-pessoa` em `schema.sql`: tabela `bloqueios` (append-only, conforme data-model.md), coluna `pessoas.bloqueada BOOLEAN NOT NULL DEFAULT FALSE`, indices `uq_bloqueios_pendente_pessoa` / `idx_bloqueios_pessoa_criado` / `idx_bloqueios_status` e seeds das permissoes `pessoas.bloqueio` e `exclusivoPessoal` (INSERT ON CONFLICT DO NOTHING + UPDATE perfis sigla='ORG')
- [X] T002 [P] Criar `scripts/adicionar-bloqueios.sql` idempotente (copia fiel do bloco do T001) com cabecalho "Quando/Onde rodar", no padrao de `scripts/adicionar-coluna-excluida-equipes.sql`
- [ ] T003 Aplicar a migration no banco de desenvolvimento (psql ou Neon SQL Editor) e conferir via `SELECT codigo FROM permissoes WHERE codigo IN ('pessoas.bloqueio','exclusivoPessoal')` que as permissoes estao ativas
  - **Decisao do usuario (2026-08-29)**: nao aplicar automaticamente ao banco Aiven de dev; rodar `scripts/adicionar-bloqueios.sql` manualmente.

**Checkpoint**: Banco com `bloqueios` criada, `pessoas.bloqueada` presente e catalogo de permissoes com as duas chaves.

---

## Phase 2: Foundational (Bloqueadores)

**Purpose**: Tipo, cliente de API, hooks e o modulo de rotas `/api/bloqueios` completo (contrato). Sem isso, nenhuma user story funciona.

**⚠️ CRITICAL**: Nenhuma user story comeca antes deste fase.

- [X] T004 [P] Adicionar em `src/lib/tipos.ts` as interfaces `StatusBloqueio`, `TipoBloqueio`, `Bloqueio` e `ResumoBloqueio`, e os campos opcionais `bloqueada?: boolean` e `bloqueio?: ResumoBloqueio | null` na interface `Pessoa` (espelho do schema em data-model.md e contracts/bloqueios-api.md)
- [X] T005 [P] Criar `src/lib/bloqueio.ts`: `listarBloqueios({status?, pessoaId?})` (GET /api/bloqueios), `criarSolicitacaoBloqueio(sessao, {pessoaId, tipo, motivo})` (POST /api/bloqueios), `aprovarSolicitacaoBloqueio(sessao, id)` (POST /api/bloqueios/:id/aprovar) + `podeAprovar`; invalidar em `queryClient` as chaves `["bloqueios"]`, `["pessoas"]`, `["participacoes"]`, `["equipes"]`, `["montagem-candidatos"]` (padrao de `src/lib/participacoes.ts`; note: `listarBloqueiosDaPessoa` movido para `hooks.ts` reutilizando `listarBloqueios({pessoaId})`)
- [X] T006 [P] Adicionar em `src/lib/hooks.ts` os hooks `useBloqueios(status?): EstadoLista<Bloqueio>` e `useBloqueiosDaPessoa(pessoaId): EstadoLista<Bloqueio>` (padrao `usePessoas`/`usePessoa`, `queryKey: ["bloqueios", ...]`)
- [X] T007 [P] Em `api/src/rotas/pessoas.ts`: no mapper `pessoaDeRow`, mapear `bloqueada: Boolean(row.bloqueada)`; a GET lista ja retorna `p.*` (inclui a coluna nova); na GET `/:id` adicionar objeto `bloqueio` com `ativo` (pessoas.bloqueada), `bloqueadoEm`/`motivo`/`aprovadores` do ultimo `bloqueio` aprovado e `pendente` da solicitacao pendente (helper `resumoBloqueioDaPessoa`), conforme contracts/bloqueios-api.md
- [X] T008 [P] Criar `api/src/rotas/bloqueios.ts` completo (contrato contracts/bloqueios-api.md): `GET /` (comAuth + `pessoas.bloqueio`, filtros `pessoaId`/`status`, join com `pessoas` para nome/cracha, `ORDER BY criado_em DESC`), `POST /` (zod `CriarBloqueioSchema`: motivo btrim>=100; `sql.begin` com `SELECT ... FOR UPDATE` na pessoa validando bloqueada/no-bloqueada; INSERT status pendente com aprovador1 = sessao; 409 via `isErroDuplicado` p/ pendente duplicado; auditoria `bloqueio.solicitou`), `POST /:id/aprovar` (UPDATE condicional `WHERE id AND status='pendente' AND aprovador1_uid <> sessao.uid RETURNING`; transacao liga/desliga `pessoas.bloqueada` conforme tipo; 409 "Voce nao pode aprovar sua propria solicitacao." / "Solicitacao ja aprovada."; auditoria `bloqueio.aprovou` + `pessoa.bloqueou`/`pessoa.desbloqueou`); montar `app.route("/api/bloqueios", bloqueios)` em `api/src/index.ts`
- [X] T009 Aplicar a restricao de aprovador e re-coferir o modulo: `cd api && npm run build` (GATE: tipo/limpeza; sem erros) + `npm run lint` no front. Teste manual via Swagger /docs pendente (banco sem a migration)

**Checkpoint**: Foundation ready - user story implementation pode comecar em paralelo.

---

## Phase 3: User Story 1 - Bloquear com dupla aprovacao (Priority: P1) 🎯 MVP

**Goal**: No detalhe da Pessoa, o usuario de Pessoal clica em "Bloquear" e navega para a **pagina dedicada** `/pessoas/:id/bloquear`, preenche o motivo (>= 100 caracteres) e o pedido sai pendente com 1o aprovador = usuario atual; ao confirmar, redireciona para a tela Bloqueios. Um segundo aprovador confirma pelo card de pendencia do detalhe (ou tela Bloqueios) e o bloqueio ativa.

**Independent Test**: Dois usuarios com `pessoas.bloqueio`: A navega do detalhe para `/pessoas/:id/bloquear`, cria o pedido e e redirecionado a Bloqueios; B aprova no card de pendencia do mesmo detalhe; a pessoa fica bloqueada e o pedido sai da pendencia (cenario S1 do quickstart, sem depender da tela Bloqueios/US3).

### Implementation for User Story 1

- [X] T010 [US1] Em `src/pages/PessoaDetalhe.tsx`, adicionar botao "Bloquear" no header (visivel com `temPermissao(sessao, "pessoas.bloqueio")` e somente quando `!pessoa.bloqueada && !pessoa.bloqueio?.pendente`); o clique navega (`useNavigate`) para `/pessoas/:id/bloquear`; **remover** o antigo overlay de modal de bloqueio desta pagina
- [X] T011 [US1] Criar `src/pages/BloqueioPessoa.tsx` (pagina dedicada, substitui o modal): titulo "Bloqueio de Pessoa", alerta verbatim "A função de bloqueio serve para identificarmos as pessoas que não devem ser chamados para a Festa! Usar essa função com responsabilidade.", textarea com texto-guia "Informe o motivo do bloqueio, seja detalhista. **Lembre-se que outras pessoas poderão estar responsável pela equipe de Pessoal e elas devem entender o por quê do bloqueio, para não chamar mais essa pessoa para a Festa.**", contador/aviso de minimo 100 caracteres com envio desabilitado abaixo disso, box aprovadores "Serão necessários 2 aprovadores para bloquear a pessoa." com nome do usuario atual (`sessao.nome`) como 1o aprovador e slot reservado vazio para a 2a aprovacao; botao Voltar para o detalhe; dados da pessoa via `usePessoa(id)`
- [X] T012 [US1] Adicionar rota protegida `<Route path="pessoas/:id/bloquear" .../>` em `src/App.tsx` (antes de `pessoas/:id`); na pagina, desviar/negar acesso (redirect para o detalhe) quando `pessoa.bloqueada` ou `pessoa.bloqueio?.pendente` (FR-015); integrar submit com `criarSolicitacaoBloqueio` (tipo `bloqueio`) tratando erros 400/409 como mensagem e, ao confirmar com sucesso, `useNavigate("/pessoas/bloqueios")`
- [X] T013 [US1] Manter/ajustar o card de pendencia acima dos dados em `src/pages/PessoaDetalhe.tsx` quando `pessoa.bloqueio?.pendente` (justificativa, 1o aprovador e botao "Aprovar" so quando o usuario atual difere do `aprovador1Uid`), chamando `aprovarSolicitacaoBloqueio` e invalidando queries
- [ ] T014 [US1] Validar MVP: rodar cenario S1 do quickstart (bloquear via pagina com dupla aprovacao, redirecionamento a Bloqueios) e os builds (`npm run lint` + `api/npm run build`) — **manual**: exige a migration aplicada no banco

**Checkpoint**: US1 funcional — bloqueio ativa so com 2 aprovadores distintos, criado a partir da pagina `/pessoas/:id/bloquear`.

---

## Phase 4: User Story 2 - Nunca ativa com aprovador unico (Priority: P1)

**Goal**: Garantia de integridade da dupla aprovacao: pedido pendente nunca conclui sozinho, o proprio solicitante nunca aprova o proprio pedido, aprovacao ja concluida nao duplica efeito e nao existe mais de um pendente por pessoa.

**Independent Test**: Cenarios anti do S1 + S7 do quickstart: verificar 409s (propria solicitacao, ja aprovada, ja bloqueada, pendente duplicado) e que nenhum bloqueio ativa com menos de 2 aprovadores distintos.

### Implementation for User Story 2

- [X] T015 [US2] Em `src/lib/bloqueio.ts`, adicionar helper `podeAprovar(bloqueio, sessao): boolean` (usuario atual difere de `aprovador1Uid`); usar no card de pendencia (T013) e, depois, na tela Bloqueios (US3) para desabilitar/ocultar Aprovar em pedidos proprios
- [X] T016 [US2] Em `src/pages/PessoaDetalhe.tsx` (e no card de pendencia), tratar as mensagens de erro 409 do backend ("Voce nao pode aprovar sua propria solicitacao.", "Solicitacao ja aprovada.", "Esta pessoa ja esta bloqueada.", "Ja existe um pedido pendente para esta pessoa.") como feedback claro e nao-criptico ao usuario (mensagens verbatim propagadas pela `api.ts` e exibidas em `bloqueioErro`/`acaoErro`)
- [ ] T017 [US2] Executar os anti-cenarios do quickstart (S1 e S7): aprovacao propria recusada, aprovacao concorrente unica, 1 pendente por pessoa, desbloqueio so em pessoa bloqueada; conferir na auditoria que nenhum `pessoa.bloqueou` ocorre sem os eventos `bloqueio.*` correspondentes — **manual**: exige a migration aplicada no banco

**Checkpoint**: US2 valido — regras de `2 aprovadores distintos` garantidas de ponta a ponta.

---

## Phase 5: User Story 3 - Tela Bloqueios no menu (Priority: P2)

**Goal**: Menu Pessoas > Bloqueios exibe pendentes e bloqueados com justificativa, e permite aprovar (2o aprovador).

**Independent Test**: Criar um pedido pendente e um bloqueio ativo (por API ou US1); com usuario de Pessoal, acessar a tela Bloqueios, ver os dois conjuntos distintos e aprovar um pendente (cenario S4).

### Implementation for User Story 3

- [X] T018 [US3] Adicionar rota protegida `<Route path="pessoas/bloqueios" element={<Bloqueios />} />` dentro do layout em `src/App.tsx` (rota estatica tem precedencia sobre `pessoas/:id` no React Router)
- [X] T019 [US3] Em `src/components/Sidebar.tsx`, adicionar item `{ to: "/pessoas/bloqueios", label: "Bloqueios", icone: "cadeado", permissoes: ["pessoas.bloqueio"] }` no array `itens` da secao "Pessoas"
- [X] T020 [US3] Criar `src/pages/Bloqueios.tsx`: gate `temPermissao(sessao, "pessoas.bloqueio")`, dados de `useBloqueios()`, duas secoes/abas (Pendentes e Bloqueados) com nome/cracha da pessoa, justificativa completa, 1o aprovador/data; pendentes com botao "Aprovar" (via `podeAprovar` do T015) chamando `aprovarSolicitacaoBloqueio` e invalidando queries
- [X] T021 [US3] Adicionar a rota `/pessoas/bloqueios` em `src/lib/favoritos.ts` (lista ROTAS, para busca/favoritos); validar cenario S4 do quickstart (S4 manual — exige migration no banco)

**Checkpoint**: US3 funcional — tela Bloqueios acessivel no menu Pessoas.

---

## Phase 6: User Story 4 - Desbloquear com dupla aprovacao (Priority: P2)

**Goal**: A pessoa bloqueada pode ser desbloqueada apenas com 2 aprovacoes e justificativa registrada; permanece bloqueada enquanto o pedido estiver pendente. O fluxo ocorre na pagina `/pessoas/:id/desbloquear`.

**Independent Test**: Cenario S3 do quickstart — A inicia desbloqueio na pagina `/pessoas/:id/desbloquear`, pessoa segue bloqueada ate B aprovar; depois retorna a livre e o historico registra o evento.

### Implementation for User Story 4

- [X] T022 [US4] Em `src/pages/PessoaDetalhe.tsx`, quando `pessoa.bloqueada` e true, exibir botao "Desbloquear" no header (visivel com `temPermissao(sessao, "pessoas.bloqueio")`), navegando (`useNavigate`) para `/pessoas/:id/desbloquear`; **remover** o antigo overlay de modal de desbloqueio desta pagina
- [X] T023 [US4] Criar `src/pages/DesbloqueioPessoa.tsx` (pagina dedicada, substitui o modal): titulo "Desbloqueio de Pessoa", justificativa obrigatoria com minimo de 100 caracteres, box aprovadores com usuario atual + slot vazio; dados da pessoa via `usePessoa(id)`; adicionar rota `<Route path="pessoas/:id/desbloquear" .../>` em `src/App.tsx`; desviar/negar acesso se `!pessoa.bloqueada` (FR-015)
- [X] T024 [US4] Integrar submit da pagina com `criarSolicitacaoBloqueio` tipo `desbloqueio`, com `useNavigate("/pessoas/bloqueios")` ao confirmar; garantir (via card de pendencia do T013, reaproveitado) que a pessoa permanece bloqueada ate a 2a aprovacao e que, apos aprovar, o banner/estado some; validar cenario S3 do quickstart (S3 manual — exige migration no banco)

**Checkpoint**: US4 funcional — ciclo completo bloquear/desbloquear com dupla aprovacao em paginas dedicadas.

---

## Phase 7: User Story 5 - Bloqueio visualmente forte (Priority: P2)

**Goal**: Banner chamativo acima dos dados do detalhe quando bloqueada (justificativa legivel), aviso distinto de pendencia, e badges "bloqueado" nas listagens e busca global.

**Independent Test**: Cenario S5 — abrir detalhe de pessoa bloqueada e ver o banner acima do box de dados; conferir badges na listagem de Pessoas e na busca global.

### Implementation for User Story 5

- [X] T025 [US5] Em `src/pages/PessoaDetalhe.tsx`, inserir entre o header e o box de dados (`tabs` "Cadastro da pessoa") um banner chamativo `card border-vermelho/40 card-corpo text-vermelho-escuro` com badge "bloqueada" e a justificativa completa quando `pessoa.bloqueia?.ativo`; manter/compor o aviso de pendencia do T013 como estado visual distinto
- [X] T026 [P] [US5] Em `src/pages/Pessoas.tsx`, adicionar badge `badge-vermelho` "bloqueado" na linha quando `p.bloqueada` (ao lado do badge ativo/inativo existente)
- [X] T027 [P] [US5] Em `src/components/BuscaGlobal.tsx`, adicionar badge "bloqueado" nos resultados de pessoa quando `p.bloqueada` (padrao do badge `inativo` existente)
- [ ] T028 [US5] Validar cenario S5 + conferir S2 no detalhe (banner presente antes de tentar alocar) — **manual**: exige a migration aplicada no banco

**Checkpoint**: US5 funcional — bloqueio inconfundivel em 100% das telas onde a pessoa aparece.

---

## Phase 8: User Story 7 - Pessoa bloqueada nao pode ser chamada/alocada (Priority: P2)

**Goal**: Restricao de selecao (opcao C): pessoa bloqueada nao entra em candidaturas de montagem, nao pode ser alocada/movida, aparece destacada nos fluxos; sem desalocacao automatica.

**Independent Test**: Cenario S2 — com pessoa bloqueada, tentar alocar via dialogo e via `POST /api/participacoes` (409), conferir que nao aparece em `/montagem`, e que quem ja estava alocada permanece no roster porem sem Mover/Trocar funcao.

### Implementation for User Story 7

- [X] T029 [P] [US7] Em `api/src/rotas/participacoes.ts`, nos handlers POST `/` e PUT `/:id`, ler `SELECT bloqueada FROM pessoas WHERE id = ...` e retornar `409` `{"erro":"Pessoa bloqueada. Justificativa: <motivo do bloqueio ativo>."}` quando bloqueada (motivo vindo de `bloqueios`); DELETE continua permitido
- [X] T030 [P] [US7] Em `api/src/rotas/montagem.ts`, adicionar `AND p.bloqueada = FALSE` nas duas CTEs de candidatos (listagem e total) do GET `/api/montagem/candidatos`
- [X] T031 [P] [US7] Em `src/components/AlocarPessoaDialog.tsx`, excluir/marcar bloqueadas (badge "bloqueada" + `opacity-50`, padrao de `idsAlocados`) e bloquear `escolher()` com erro contendo a justificativa
- [X] T032 [P] [US7] Em `src/components/MontagemCandidato.tsx`, para `candidato.bloqueado` (novo campo no tipo `CandidatoMontagem` em `src/lib/tipos.ts`, preenchido pelo backend quando a pessoa tem bloqueio ativo OU simplesmente nao retornar bloqueadas — conforme a abordagem escolhida no T030), desabilitar os botoes Coordenador/Equipista com badge + tooltip da justificativa — **abordagem escolhida (notas)**: bloquear nao e retornada (T030 exclui `p.bloqueada`); badge/tooltip nao se aplicam, sem mudanca em `MontagemCandidato.tsx`
- [X] T033 [US7] Em `src/pages/EquipeDetalhe.tsx`, exibir badge "bloqueada" na linha de pessoas alocadas que estao bloqueadas e vetar acoes Mover/Trocar funcao (mantendo a pessoa no roster — FR-019, sem desalocacao)
- [ ] T034 [US7] Validar cenario S2 do quickstart e conferir que pessoas bloqueadas nao saem das equipes (FR-019) — **manual**: exige a migration aplicada no banco

**Checkpoint**: US7 funcional — bloqueio impede chamada/alocacao com backend autoritativo.

---

## Phase 9: User Story 6 - Historico na aba do box Pessoal (Priority: P3)

**Goal**: Box "Exclusivo para uso do Pessoal" ganha a aba "Bloqueios" com a linha do tempo de bloqueios/desbloqueios da pessoa.

**Independent Test**: Cenario S6 — apos bloquear e desbloquear uma pessoa, usuario com `exclusivoPessoal` ve a aba com ambos os eventos (tipo, motivo, aprovadores, datas).

### Implementation for User Story 6

- [X] T035 [P] [US6] Criar `src/components/HistoricoBloqueiosPessoa.tsx` (recebe `pessoaId` e usa `useBloqueiosDaPessoa`), renderizando a linha do tempo em ordem cronologica: tipo (bloqueio/desbloqueio), motivo, aprovadores 1o/2o, autor e data — no padrao de `HistoricoPresencaPessoa`
- [X] T036 [US6] Em `src/pages/PessoaDetalhe.tsx`, dentro do box "Exclusivo Pessoal" (`podeVerExclusivo`), adicionar "bloqueios" ao union do estado `abaHistorico`, um botao `.aba` "Bloqueios" na `.tabs-lista` e o painel `{abaHistorico === "bloqueios" && (<div className="tabs-painel"><HistoricoBloqueiosPessoa pessoaId={pessoa.id} /></div>)}`
- [ ] T037 [US6] Validar cenario S6 do quickstart (eventos de bloqueio e desbloqueio aparecem, sem perdas) — **manual**: exige a migration aplicada no banco

**Checkpoint**: US6 funcional — historico completo disponivel na aba do box Pessoal.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Consistencia, documentacao e validacao final.

- [X] T038 [P] Atualizar `Permissoes.md` com as linhas `pessoas.bloqueio` (Pessoas > Bloquear/Desbloquear) e `exclusivoPessoal`
- [X] T039 [P] Conferir a trilha de auditoria: eventos `bloqueio.solicitou`/`bloqueio.aprovou`/`pessoa.bloqueou`/`pessoa.desbloqueou` legiveis na tela Auditoria (alvo `bloqueios/{id}`/`pessoas/{id}`) — rotulos PT-BR adicionados ao mapa `ACOES` de `src/pages/Auditoria.tsx`
- [X] T040 [P] Revisar acessibilidade e PT-BR das novas paginas (`BloqueioPessoa.tsx` e `DesbloqueioPessoa.tsx`): cabecalhos (`h1`), foco gerenciado na navegacao, `aria-label` no textarea e erro de validacao acessiveis; os textos verbatim do alerta/texto-guia da spec sao usados tal-qual; Bloqueios.tsx com tabs acessiveis
- [ ] T041 Executar o quickstart completo (S1-S7) + `npm run lint` + `api/npm run build`; confirmar zero erros e estados consistentes apos mutacoes (invalidacoes de `["montagem-candidatos"]`, `["participacoes"]`, `["equipes"]`) — **manual**: exige a migration aplicada no banco (S1-S7)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependencias — pode comecar junto com a leitura dos artefatos
- **Foundational (Phase 2)**: depende do Setup (banco) — BLOQUEIA todas as user stories
- **User Stories (Phase 3+)**: dependem do Foundational
- **Polish (Phase 10)**: depende de todas as user stories desejadas

### User Story Dependencies

- **US1 (P1, MVP)**: Foundational (modulo `/api/bloqueios`) — sem dependencia de outras stories
- **US2 (P1)**: Foundational; reutiliza o card de pendencia da US1 (T013/T015) — recomendado apos US1
- **US3 (P2)**: Foundational (GET /api/bloqueios) + helper `podeAprovar` da US2
- **US4 (P2)**: US1 (estrutura de pagina/card) — independe de US3
- **US5 (P2)**: US1/US2 (card de pendencia) — independe de US3/US4
- **US7 (P2)**: Foundational (campo `bloqueada`/backend) — independe das demais; pode rodar em paralelo com US3-US5
- **US6 (P3)**: Foundational (GET /api/bloqueios) + seed `exclusivoPessoal` da Setup; pode rodar em paralelo

### Within Each User Story

- Backend/infra: no Foundational (contrato unico)
- `src/lib` (tipos/hook/cliente) antes das paginas
- Paginas/componentes antes da validacao manual do cenario do quickstart

### Parallel Opportunities

- Phase 2: T004, T005, T006, T007 e T008 rodam em paralelo (arquivos distintos)
- Fases posteriores: US3 (T018-T021), US5 (T025-T027), US7 (T029-T033) e US6 (T035) tem blocos `[P]` paralelizaveis
- Stories independentes podem ser alocadas em paralelo apos o Foundational: ex. Dev A = US1+US2; Dev B = US7; Dev C = US6

---

## Parallel Example: Foundational (Phase 2)

```bash
# Lançar os 5 blocos juntos:
Task: "T004 tipos.ts (interfaces Bloqueio/Pessoa)"
Task: "T005 src/lib/bloqueio.ts (cliente de API)"
Task: "T006 src/lib/hooks.ts (useBloqueios)"
Task: "T007 api/src/rotas/pessoas.ts (enriquecimento)"
Task: "T008 api/src/rotas/bloqueios.ts + montagem no index.ts"
```

## Parallel Example: User Story 7

```bash
# Lançar os 4 blocos independentes juntos:
Task: "T029 api/src/rotas/participacoes.ts (veto 409)"
Task: "T030 api/src/rotas/montagem.ts (excluir bloqueadas)"
Task: "T031 src/components/AlocarPessoaDialog.tsx"
Task: "T032 src/components/MontagemCandidato.tsx"
# Depois T033 (EquipeDetalhe — depende de T029 para o comportamento) e T034 (validação S2)
```

---

## Implementation Strategy

### MVP First (User Story 1 apenas)

1. Tag 1: Phase 1 (Setup) — schema + seeds
2. Tag 2: Phase 2 (Foundational) — tipos, lib, hooks, backend `/api/bloqueios` — `api/npm run build` verde
3. Tag 3: Phase 3 (US1) — paginas `BloqueioPessoa.tsx` + navegacao no detalhe + redirecionamento a Bloqueios
4. **STOP e VALIDE**: cenario S1 sozinho (duas aprovacoes end-to-end via pagina e detalhe)
5. Deploy/demo possivel com US1 + US2 (integralidade da aprovacao)

### Incremental Delivery

1. Foundational → backend pronto (Swagger /docs)
2. + US1 → MVP (bloquear com dupla aprovacao) → validar S1
3. + US2 → robustez anti-cenarios
4. + US3 (tela Bloqueios) → operacao central
5. + US4 (desbloquear em pagina) → + US5 (visual forte) → + US7 (restricao de selecao) → + US6 (historico)
6. Cada step valida seu cenario (S2-S7) sem quebrar os anteriores

### Parallel Team Strategy

Com mais devs, apos o Foundational: Dev A (US1→US2), Dev B (US7), Dev C (US6); depois Dev A continua (US3→US5) e todos validam quickstart no final.

---

## Notes

- **Rework modal→pagina**: US1 (T010-T014) e US4 (T022-T024) foram reescritas para usar as paginas dedicadas `/pessoas/:id/bloquear` e `/pessoas/:id/desbloquear` no lugar dos overlays; T040 revisa a acessibilidade das paginas. O backend (`api/src/rotas/bloqueios.ts`) e o schema **nao mudam** — a transformacao e exclusivamente de apresentacao/navegacao no front.
- T032 depende de decisao: backend pode RETORNAR o campo `bloqueado` na montagem (candidato visivel mas travado) OU EXCLUIR bloqueadas (T030). O custo de UI do badge/tooltip so se justifica com a primeira opcao. Manter consistente com o T030 (recomendado: excluir da lista, badge nao necessario) e so adicionar o campo ao tipo se o backend o retornar.
- [P] tasks = arquivos diferentes, sem dependencias
- Commit apos cada tarefa ou grupo logico (PT-BR, imperativo)
- Validar cada story no seu checkpoint antes de seguir
- `schema.sql` e a fonte; `scripts/adicionar-bloqueios.sql` e copia aplicavel em producao
- FR-019 (nao desalocar ao bloquear) e coberto pelo T033/T029 (DELETE permitido, sem auto-desalocacao)
