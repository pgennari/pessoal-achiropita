# Tasks: Pesquisa de Satisfacao da Cantina

**Input**: Design documents from `/specs/020-cantina-pesquisa/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/cantina-interno.md, contracts/cantina-publico.md

**Tests**: Nao solicitados — sem test runner configurado. Validacao por build (`npm run build`, `npm run lint`) e cenarios manuais do quickstart.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Schema do banco, seed de permissao e tipos compartilhados

- [x] T001 Adicionar tabela `pesquisas_cantina` com indice `idx_pesquisas_cantina_criado_em DESC`, seed da permissao `cantina.gerenciar` no catalogo `permissoes` e inclusao do codigo no array de permissoes do perfil ORG em `schema.sql`, conforme data-model.md
- [x] T002 [P] Adicionar tipo `PesquisaCantina` e tipo auxiliar `NotasPesquisa` em `src/lib/tipos.ts`
- [x] T003 [P] Adicionar tipo de retorno do mapper de pesquisa em `api/src/tipos.ts`, seguindo padrao dos tipos existentes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Rotas de API (interna e publica) e cliente HTTP — MUST complete before user stories

**CRITICAL**: Nenhum trabalho de user story comeca ate esta fase estar completa

- [x] T004 Criar `api/src/rotas/cantina.ts` — rota interna `GET /api/cantina/pesquisas?offset=&limit=` (padrao 20, max 20, ordenado `criado_em DESC`, resposta `{ itens, total, temMais }`) com `comAuth` + `temPermissao(sessao, "cantina.gerenciar")` e mapper `pesquisaDeRow`, seguindo padrao de `api/src/rotas/avaliacao.ts`
- [x] T005 Criar `api/src/rotas/cantinaPublico.ts` — rotas publicas anonimas `GET /api/publico/cantina/dias-festa` (apenas `id` e `data` dos dias da edicao ativa, ordenados) e `POST /api/publico/cantina/pesquisas` com validacao zod (nome obrigatorio; e-mail obrigatorio com formato valido somente quando `desejaInformacoes = true`; 5 notas inteiras 1–5; `recomendaria` Sim/Nao/Talvez; `melhorias` max 4000; `diaIda` opcional pertencente aos dias cadastrados), gravando em `pesquisas_cantina` com auditoria autor `publico/cantina`, seguindo padrao de `api/src/rotas/avaliacaoPublico.ts`
- [x] T006 Registrar roteador `cantina` em `/api/cantina` e `cantinaPublico` em `/api/publico` no `api/src/index.ts`
- [x] T007 Criar `src/lib/cantina.ts` — cliente API: `listarPesquisas(offset)` (autenticada), `listarDiasPublicos()` e `enviarPesquisa(payload)` (via `apiPublica`), seguindo padrao de `src/lib/checkin.ts`

**Checkpoint**: Infraestrutura pronta — rotas interna e publicas, tipos e cliente funcionais

---

## Phase 3: User Story 1 — Pagina Cantina > Pesquisa com link publico (Priority: P1) MVP

**Goal**: ADM/ORG acessa a nova secao "Cantina" > "Pesquisa" e visualiza/compartilha o endereco publico com Copiar, Abrir e QR Code

**Independent Test**: Logado como ADM/ORG, abrir `/cantina/pesquisas` via menu, copiar o link, abrir em nova aba e exibir/escanear o QR Code — sem nenhuma resposta registrada

### Implementation for User Story 1

- [x] T008 [US1] Adicionar secao "Cantina" (icone a definir do conjunto `Icone`) com item "Pesquisa" apontando para `/cantina/pesquisas` e `permissoes: ["cantina.gerenciar"]` em `src/components/Sidebar.tsx`, seguindo padrao das secoes existentes
- [x] T009 [US1] Criar `src/pages/CantinaPesquisa.tsx` — secao do link publico com endereco `${origin}/cantina/pesquisa` exibido por extenso, botao Copiar (`navigator.clipboard.writeText` + confirmacao via componente `Toast`), botao Abrir (`window.open` nova aba) e painel/modal de QR Code (`QRCode.toString(url, { type: "svg", errorCorrectionLevel: "H" })`, padrao de `src/pages/QrEstacionamento.tsx`)
- [x] T010 [US1] Registrar rota logada `cantina/pesquisas` dentro do bloco com `Layout` em `src/App.tsx`

**Checkpoint**: US1 funcional — menu, link compartilhavel e QR operam sem respostas

---

## Phase 4: User Story 2 — Identificacao no formulario publico (Priority: P1)

**Goal**: Visitante anonimo abre `/cantina/pesquisa` e preenche a secao de identificacao, com dias de festa da edicao ativa e dia atual pre-selecionado quando constar na lista

**Independent Test**: Abrir `/cantina/pesquisa` em janela anonima (desktop e celular) — formulario visivel sem login; campo "Dia da ida" lista os dias cadastrados e traz hoje pre-selecionado quando aplicavel

### Implementation for User Story 2

- [x] T011 [US2] Criar `src/pages/CantinaPesquisaPublico.tsx` — pagina publica mobile-first sem Layout, seguindo guia visual; secao de identificacao com Nome completo (obrigatorio), E-mail (comportamento condicional definido na US3), Telefone (opcional), Dia da ida a cantina (opcoes de `listarDiasPublicos()`, dia atual pre-selecionado quando constar na lista), Numero do convite (opcional) e pergunta opt-in "Deseja receber informacoes sobre a Festa de Nossa Senhora Achiropita?" (Sim/Nao)
- [x] T012 [US2] Registrar rota publica `/cantina/pesquisa` ANTES das rotas com `Layout` em `src/App.tsx` (sem `ProtegerRota`)

**Checkpoint**: US2 funcional — visitante anonimo ve e preenche a identificacao com dias corretos

---

## Phase 5: User Story 3 — Avaliacao e envio no formulario publico (Priority: P1)

**Goal**: Visitante responde os 5 criterios (1–5), recomendacao (Sim/Nao/Talvez) e campo aberto; envio validado (cliente + servidor) grava a resposta e mostra agradecimento

**Independent Test**: Completar o formulario publico e enviar — resposta gravada (visivel via SQL ou listagem futura); repetir com campos obrigatorios faltantes e verificar bloqueio por campo

### Implementation for User Story 3

- [x] T013 [US3] Implementar secao de avaliacao em `src/pages/CantinaPesquisaPublico.tsx` — 5 criterios com nota inteira 1–5 (Atendimento, Alimentacao, Organizacao, Ambiente, Atendimento dos Voluntarios), pergunta "Voce recomendaria a Cantina Madonna Achiropita para amigos e familiares?" (Sim/Nao/Talvez) e campo aberto "O que poderiamos melhorar para tornar sua experiencia ainda melhor?" (max 4000 caracteres com contador)
- [x] T014 [US3] Implementar validacao de envio em `src/pages/CantinaPesquisaPublico.tsx` — nome obrigatorio; E-mail obrigatorio e com formato valido SOMENTE quando opt-in = Sim (opcional caso contrario), conforme FR-024; criterios e recomendacao obrigatorios; mensagens PT-BR destacando cada campo pendente; falha de envio preserva os dados preenchidos
- [x] T015 [US3] Implementar envio em `src/pages/CantinaPesquisaPublico.tsx` via `enviarPesquisa()` — tela de agradecimento apos sucesso, sem reenvio automatico ao recarregar a pagina

**Checkpoint**: US3 funcional — fluxo completo publico (identificar → avaliar → enviar → agradecimento)

---

## Phase 6: User Story 4 — Listagem das pesquisas realizadas (Priority: P2)

**Goal**: ADM/ORG lista as respostas na pagina logada em lotes de 20 com lazy-loading e abre o detalhe completo de cada registro

**Independent Test**: Com 25+ respostas registradas, abrir `/cantina/pesquisas`: 20 primeiras exibidas (mais recentes primeiro), proximo lote sob demanda sem recarregar, indicador de fim sem duplicatas, detalhe completo ao selecionar registro

### Implementation for User Story 4

- [x] T016 [US4] Implementar listagem lazy-loading em `src/pages/CantinaPesquisa.tsx` abaixo do bloco do link — `useInfiniteQuery` sobre `listarPesquisas(offset)` (lotes de 20, ordenado `criadoEm DESC`), `fetchNextPage` ao chegar ao fim com botao "Carregar mais" como fallback, indicador "Nao ha mais pesquisas" e estado vazio informativo
- [x] T017 [US4] Implementar visualizacao de detalhe da resposta selecionada em `src/pages/CantinaPesquisa.tsx` — identificacao, dia da ida, numero do convite (quando informado), desejo de receber informacoes (Sim/Nao), notas dos 5 criterios, recomendacao, comentario de melhoria e data/hora de envio

**Checkpoint**: US4 funcional — organizacao consulta as respostas com paginacao fluida

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentacao, build e validacao final

- [x] T018 Atualizar tabela de rotas no `AGENTS.md` — adicionar `/cantina/pesquisa` (publica, CantinaPesquisaPublico) e `/cantina/pesquisas` (logada, CantinaPesquisa)
- [x] T019 Rodar `npm run build` e `npm run lint` na raiz e `npm run build` em `api/` — zero erros
- [ ] T020 Executar os cenarios de `specs/020-cantina-pesquisa/quickstart.md` ponta a ponta

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependencias — iniciar imediatamente
- **Foundational (Phase 2)**: Depende do Setup — BLOQUEIA todas as user stories
- **US1 (Phase 3)**: Depende da Foundational
- **US2 (Phase 4)**: Depende da Foundational — pode rodar em paralelo com US1
- **US3 (Phase 5)**: Depende de US2 (mesma pagina `CantinaPesquisaPublico.tsx`)
- **US4 (Phase 6)**: Depende de US1 (mesma pagina `CantinaPesquisa.tsx`) e de respostas existentes para teste real
- **Polish (Phase 7)**: Depende de todas as user stories

### User Story Dependencies

- **US1 (P1)**: Apenas Foundational
- **US2 (P1)**: Apenas Foundational
- **US3 (P1)**: US2 (formulario publico existente)
- **US4 (P2)**: US1 (pagina logada existente)

### Parallel Opportunities

- T002 e T003 em paralelo (diferentes arquivos de tipos)
- US1 e US2 podem avancar em paralelo apos a Foundational — ATENCAO: T010 e T012 editam o mesmo `App.tsx`; sequenciar esses dois tarefas
- T008 (Sidebar.tsx) e T011 (pagina publica) em paralelo

---

## Parallel Example: Setup + Foundational

```
# Fase 1, apos T001 (schema):
Task: "T002 tipos em src/lib/tipos.ts"
Task: "T003 tipos em api/src/tipos.ts"

# Fase 2, arquivos distintos:
Task: "T004 api/src/rotas/cantina.ts"
Task: "T005 api/src/rotas/cantinaPublico.ts"  # depois T006 registra ambos
```

---

## Implementation Strategy

### MVP First (Setup + Foundational + US1 + US2 + US3)

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundational (CRITICAL)
3. Completar Phase 3: US1 — link divulgavel (Copiar/Abrir/QR)
4. Completar Phase 4: US2 — formulario publico com identificacao
5. Completar Phase 5: US3 — envio gravado com agradecimento
6. **PARAR e VALIDAR**: ciclo completo de coleta funciona (enviar pelo link e conferir via SQL)
7. Deploy/demo se pronto

Nota: so a US1 isolada nao entrega valor de coleta — o MVP real inclui US2 e US3.

### Incremental Delivery

1. Setup + Foundational → API pronta
2. US1 → organizacao divulga o link (QR impresso)
3. US2 + US3 → visitantes respondem; respostas gravadas
4. US4 → listagem com lazy-loading e detalhe na area logada
5. Polish → rotas documentadas, builds limpos, quickstart validado

---

## Notes

- [P] tasks = diferentes arquivos, sem dependencias
- [Story] label mapeia tarefa a user story para rastreabilidade
- Cada user story deve ser completavel e testavel independentemente
- Commit apos cada tarefa ou grupo logico (PT-BR, imperativo)
- Parar em qualquer checkpoint para validar a story independentemente
- Validar com `npm run build` e `npm run lint` apos cada fase
