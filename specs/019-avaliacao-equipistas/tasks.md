# Tasks: Avaliacao de Equipistas

**Input**: Design documents from `/specs/019-avaliacao-equipistas/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/avaliacao-integracao.md

**Tests**: Nao solicitados — sem test runner configurado. Validacao por build (`npm run build`, `npm run lint`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Schema do banco, tipos compartilhados e dependencias de infraestrutura

- [x] T001 Adicionar tabelas `links_avaliacao` e `avaliacoes` em `schema.sql` conforme data-model.md
- [x] T002 [P] Adicionar tipos `LinkAvaliacao`, `Avaliacao`, `CriterioAvaliacao`, `StatusAvaliacao` em `src/lib/tipos.ts`
- [x] T003 [P] Adicionar tipos `SessaoAvaliacao`, `VariaveisAvaliacao` em `api/src/tipos.ts`
- [x] T004 [P] Adicionar permissao `avaliacao.gerenciar` em `schema.sql` (tabela `permissoes`) e perfil ADM/ORG em `schema.sql` (tabela `perfis`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Sessao JWT publica, rotas internas de link e cliente API — MUST complete before user stories

**CRITICAL**: Nenhum trabalho de user story comeca ate esta fase estar completa

- [x] T005 Criar `api/src/sessaoAvaliacao.ts` — JWT curto (HS256, 1h) com `pessoaId, cracha, edicaoId, equipeId, linkToken` e middleware `comSessaoAvaliacao`, seguindo padrao de `api/src/sessaoPresenca.ts`
- [x] T006 Criar `api/src/rotas/avaliacao.ts` — Rotas internas: `POST /api/avaliacao/links` (gerar link), `PUT /api/avaliacao/links/:token/revogar`, `GET /api/avaliacao/links/:edicaoId`, `GET /api/avaliacoes` (listar com filtros), `GET /api/avaliacoes/:id`, `GET /api/avaliacoes/pessoa/:pessoaId` — usando `comAuth` + `podeAdministrar` e `sql` tagged template, conforme contracts/avaliacao-integracao.md
- [x] T007 Criar `api/src/rotas/avaliacaoPublico.ts` — Rotas publicas: `GET /api/publico/avaliacao/:token`, `POST /api/publico/avaliacao/coordenador`, `GET /api/publico/avaliacao/equipistas`, `POST /api/publico/avaliacao` (criar/atualizar/finalizar) — seguindo padrao de `api/src/rotas/presencaPublico.ts`
- [x] T008 Registrar rotas `avaliacao` e `avaliacaoPublico` no `api/src/index.ts` (ou arquivo de rotas principal)
- [x] T009 Criar `src/lib/avaliacao.ts` — Cliente API: `gerarLink()`, `revogarLink()`, `buscarLinkAtivo()`, `listarAvaliacoes()`, `buscarAvaliacao()`, `listarAvaliacoesPessoa()`, `identificarCoordenador()`, `listarEquipistas()`, `salvarAvaliacao()` — seguindo padrao de `src/lib/links.ts` e `src/lib/presenca.ts`
- [x] T010 [P] Adicionar hooks `useAvaliacoes(edicaoId)` e `useAvaliacoesPessoa(pessoaId)` em `src/lib/hooks.ts`, seguindo padrao de `useLinksEdicao` e `useHistoricoParticipacoesDePessoa`

**Checkpoint**: Infraestrutura pronta — rotas internas, publicas, tipos, hooks e cliente API funcionais

---

## Phase 3: User Story 1 — Gerenciamento do link e avaliacoes pela tela da edicao (Priority: P1) MVP

**Goal**: ADM/ORG visualiza e gerencia o link publico de avaliacao e a listagem de avaliacoes na tela de detalhes da edicao

**Independent Test**: Abrir `/edicoes/:id`, verificar que o link de avaliacao e exibido e copiavel, e que a listagem de avaliacoes da edicao esta disponivel com filtros

### Implementation for User Story 1

- [x] T011 [US1] Adicionar aba "Avaliacao" na secao de detalhes da edicao em `src/pages/EdicaoDetalhe.tsx`, seguindo padrao de abas existente (`.tabs`/`.aba`) — exibir secao com link publico (copiavel) e listagem de avaliacoes da edicao com filtros por equipe, avaliador e status
- [x] T012 [US1] Implementar componente de listagem de avaliacoes na aba da edicao — exibir tabela com pessoa, equipe, avaliador, status, data de atualizacao; filtros por equipe, avaliador e status; clique na avaliacao exibe detalhes (criterios, aptidao, comentarios, datas)
- [x] T013 [US1] Implementar logica de copiar link para area de transferencia na aba da edicao — botao de copiar que usa `navigator.clipboard.writeText()` com feedback visual

**Checkpoint**: US1 funcional — link gerenciavel e avaliacoes listaveis na tela da edicao

---

## Phase 4: User Story 2 — Identificacao do coordenador pelo link publico (Priority: P1)

**Goal**: Coordenador acessa link publico, informa cracha, e sistema valida se e coordenador na edicao

**Independent Test**: Abrir link publico em aba anonima, informar cracha de coordenador valido (recebe listagem) e de nao-coordenador (recebe acesso negado)

### Implementation for User Story 2

- [x] T014 [P] [US2] Criar `src/pages/AvaliacaoPublico.tsx` — Pagina publica em `/avaliacao/:token` com campo para informar cracha, sem Layout, seguindo padrao de `src/pages/PresencaPublico.tsx`
- [x] T015 [US2] Implementar fluxo de identificacao do coordenador na `AvaliacaoPublico.tsx` — ao informar cracha, chamar `identificarCoordenador()`, exibir saudacao "Ola, {nome}" e armazenar `sessaoToken` JWT para chamadas seguintes
- [x] T016 [US2] Implementar estados de erro na `AvaliacaoPublico.tsx` — link invalido/revogado, acesso negado (cracha invalido ou nao-coordenador), ambos com mensagens genericas sem revelar dados
- [x] T017 [US2] Adicionar rota publica `/avaliacao/:token` em `src/App.tsx` (sem `ProtegerRota`, sem `Layout`)

**Checkpoint**: US2 funcional — coordenador consegue se identificar via link publico

---

## Phase 5: User Story 3 — Selecao de equipista e preenchimento da avaliacao (Priority: P1)

**Goal**: Coordenador seleciona equipista e preenche formulario de avaliacao com criterios, aptidao e comentarios, com auto-save

**Independent Test**: Apos identificacao, selecionar equipista, preencher criterios, definir aptidao e finalizar — verificando que rascunho e salvo automaticamente

### Implementation for User Story 3

- [x] T018 [US3] Implementar listagem de equipistas na `AvaliacaoPublico.tsx` apos identificacao do coordenador — exibir nome e indicador visual de status (pendente/rascunho/finalizada) de cada equipista, chamando `listarEquipistas()`
- [x] T019 [US3] Implementar formulario de avaliacao na `AvaliacaoPublico.tsx` — ao selecionar equipista, exibir 6 criterios (Pontualidade, Dedicao, Companheirismo, Espiritualidade, Comprometimento, Uniforme) com opcoes Otimo/Bom/Regular/Ruim, campo "Apto a Coordenar?" (Sim/Nao) e campo "Comentarios e Sugestoes" (textarea, max 4000 chars)
- [x] T020 [US3] Implementar auto-save com debounce de 2 segundos no formulario — a cada alteracao de campo, aguardar 2s e chamar `salvarAvaliacao()` com `finalizar: false`; exibir indicador de "Salvando..." / "Salvo"
- [x] T021 [US3] Implementar botao FINALIZAR com confirmacao — validar que todos os 6 criterios e aptidao estao preenchidos antes de permitir; ao finalizar, chamar `salvarAvaliacao()` com `finalizar: true`; exibir modal de confirmacao antes de alterar status para "Finalizada"
- [x] T022 [US3] Implementar estado de leitura para avaliacao finalizada — ao selecionar equipista ja avaliado com status "Finalizada", exibir dados em modo somente leitura sem possibilidade de edicao
- [x] T023 [US3] Implementar estado de edicao para avaliacao em rascunho — ao selecionar equipista com rascunho, carregar dados previamente salvos no formulario

**Checkpoint**: US3 funcional — fluxo completo de avaliacao (identificar → selecionar → preencher → auto-save → finalizar)

---

## Phase 6: User Story 4 — Gerenciamento de avaliacoes salvas (Priority: P2)

**Goal**: Coordenador visualiza status das avaliacoes e retoma rascunhos; finalizadas sao imutaveis

**Independent Test**: Criar rascunho, recarregar pagina, retomar, finalizar e verificar que nao e mais possivel alterar

### Implementation for User Story 4

- [x] T024 [US4] Implementar indicador visual de status na listagem de equipistas — equipista com rascunho exibe indicador "Rascunho", equipista avaliado exibe "Finalizado", equipista pendente sem indicador
- [x] T025 [US4] Implementar retomada de rascunho — ao selecionar equipista com rascunho, formulario e aberto com dados previamente salvos (via `salvarAvaliacao()` com `finalizar: false`)
- [x] T026 [US4] Implementar imutabilidade de avaliacao finalizada — ao tentar editar avaliacao finalizada, backend rejeita com 409; frontend exibe mensagem de que avaliacao finalizada nao pode ser alterada

**Checkpoint**: US4 funcional — rascunhos persistem entre acessos, finalizadas sao imutaveis

---

## Phase 7: User Story 5 — Historico de avaliacoes na tela da Pessoa (Priority: P2)

**Goal**: ADM/ORG visualiza avaliacoes de uma pessoa em todas as edicoes na aba "Historico de Avaliacoes"

**Independent Test**: Abrir `/pessoas/:id` de pessoa com avaliacoes, verificar que aba "Historico de Avaliacoes" exibe todas as avaliacoes com dados completos

### Implementation for User Story 5

- [x] T027 [P] [US5] Adicionar aba "Historico de Avaliacoes" em `src/pages/PessoaDetalhe.tsx` — seguindo padrao de abas de historicos existentes; exibir listagem de avaliacoes da pessoa em todas as edicoes, ordenadas por `atualizadoEm` DESC
- [x] T028 [US5] Implementar detalhes de cada avaliacao na aba — exibir edicao, equipe, avaliador, status, data de atualizacao, todos os 6 criterios, aptidao e comentarios; estado vazio quando nao ha avaliacoes

**Checkpoint**: US5 funcional — historico de avaliacoes integrado a tela da pessoa

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Melhorias transversais e validacao final

- [x] T029 Adicionar navegacao na `Sidebar.tsx` — verificar se e necessario item de menu ou se a aba na edicao e suficiente (conforme decisao: link na tela da edicao, nao em tela separada)
- [x] T030 Rodar `npm run build` (frontend) e `cd api && npm run build` (API) — validar que todos os tipos estao corretos e nao ha erros de compilacao
- [x] T031 Rodar `npm run lint` — validar typecheck sem erros

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependencias — iniciar imediatamente
- **Foundational (Phase 2)**: Depende do Setup — BLOQUEIA todas as user stories
- **US1 (Phase 3)**: Depende da Foundational — pode iniciar imediatamente apos
- **US2 (Phase 4)**: Depende da Foundational — pode iniciar imediatamente apos
- **US3 (Phase 5)**: Depende de US2 (precisa de `AvaliacaoPublico.tsx` existente)
- **US4 (Phase 6)**: Depende de US3 (precisa do fluxo de avaliacao)
- **US5 (Phase 7)**: Depende da Foundational — pode iniciar em paralelo com US1/US2/US3
- **Polish (Phase 8)**: Depende de todas as user stories desejadas

### User Story Dependencies

- **US1 (P1)**: Depende apenas da Foundational
- **US2 (P1)**: Depende apenas da Foundational
- **US3 (P1)**: Depende de US2 (precisa da pagina publica e identificacao do coordenador)
- **US4 (P2)**: Depende de US3 (precisa do fluxo de avaliacao funcional)
- **US5 (P2)**: Depende apenas da Foundational (pode rodar em paralelo com US1-US4)

### Parallel Opportunities

- T002, T003, T004 podem rodar em paralelo (diferentes arquivos de tipos)
- US1 e US2 podem rodar em paralelo apos Foundational
- US5 pode rodar em paralelo com US1, US2 e US3
- T014 e T011 podem rodar em paralelo (diferentes paginas)

---

## Parallel Example: User Story 1

```
# US1 pode iniciar imediatamente apos Foundational:
Task: "T011 Adicionar aba Avaliacao na EdicaoDetalhe.tsx"
Task: "T012 Implementar componente de listagem de avaliacoes"
Task: "T013 Implementar copiar link"
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3)

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundational (CRITICAL)
3. Completar Phase 3: US1 (link + listagem na edicao)
4. Completar Phase 4: US2 (identificacao do coordenador)
5. Completar Phase 5: US3 (formulario de avaliacao com auto-save)
6. **PARAR e VALIDAR**: Testar fluxo completo de ponta a ponta
7. Deploy/demo se pronto

### Incremental Delivery

1. Setup + Foundational → Infraestrutura pronta
2. US1 → Link e listagem na edicao (ADM/ORG consegue gerar link e ver avaliacoes)
3. US2 + US3 → Fluxo publico funcional (coordenador consegue avaliar)
4. US4 → Rascunhos persistem, finalizadas imutaveis
5. US5 → Historico na tela da pessoa
6. Polish → Build limpo, validacao final

---

## Notes

- [P] tasks = diferentes arquivos, sem dependencias
- [Story] label mapeia tarefa a user story para rastreabilidade
- Cada user story deve ser completavel e testavel independentemente
- Commit apos cada tarefa ou grupo logico
- Parar em qualquer checkpoint para validar a story independentemente
- Validar com `npm run build` e `npm run lint` apos cada fase
