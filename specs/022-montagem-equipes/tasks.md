# Tasks: Montagem de Equipes

**Input**: Design documents from `/specs/022-montagem-equipes/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-montagem.md

**Tests**: Sem test runner configurado. Tasks de teste nao aplicaveis.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Exact file paths included in descriptions

---

## Phase 1: Setup (Permissao e Menu)

**Purpose**: Criar a permissao `edicao.montagem`, adicionar ao perfil ORG e registrar no menu lateral

- [X] T001 [P] Adicionar permissao `edicao.montagem` na tabela `permissoes` em `schema.sql` (INSERT com codigo, rotulo, descricao)
- [X] T002 [P] Adicionar `edicao.montagem` ao array `permissoes` do perfil ORG no seed de perfis em `schema.sql`
- [X] T003 [P] Adicionar `edicao.montagem` ao array `permissoes` do perfil ADM no seed de perfis em `schema.sql`
- [X] T004 Adicionar item "Montagem" ao array `secoes` em `src/components/Sidebar.tsx`, dentro da secao "Edicao da Festa", com rota `/montagem`, icone e permissoes `["edicao.montagem"]`

**Checkpoint**: Permissao criada, menu visivel para ADM/ORG

---

## Phase 2: API — Endpoint de Candidatos com Match

**Purpose**: Implementar `GET /api/montagem/candidatos` com calculo de match server-side e paginacao offset

**⚠️ CRITICAL**: US1, US2 e US3 dependem deste endpoint

- [X] T005 Criar arquivo `api/src/rotas/montagem.ts` com a rota `GET /candidatos` usando OpenAPIHono, middleware `comAuth`, verificacao de permissao `edicao.montagem`
- [X] T006 Implementar query SQL com CTEs para calculo dos 4 componentes do match: historico (50pts com normalizacao de nome via `regexp_replace`), criterios (30pts com scoring Otimo=5/Bom=3/Regular=1/Ruim=0), convidar novamente (10pts = valor*2), presencas (10pts = COUNT DISTINCT dia, max 10)
- [X] T007 Adicionar paginacao offset-based na query: COUNT total, ORDER BY match DESC, LIMIT/OFFSET, retorno `{ itens, total, temMais }`
- [X] T008 Registrar a rota em `api/src/index.ts` como `app.route("/api/montagem", montagem)` antes do export

**Checkpoint**: Endpoint retornando pessoas com match score, paginado, excludo alocados e inativos

---

## Phase 3: API — Endpoint de Match Historico

**Purpose**: Implementar `GET /api/montagem/match/:pessoaId` com detalhamento por edicao

- [X] T009 Adicionar rota `GET /match/:pessoaId` em `api/src/rotas/montagem.ts` com query params `edicaoId` e `edicaoHistorico`
- [X] T010 Implementar query SQL que busca avaliacoes e presencas da pessoa para todas as edicoes anteriores, calcula match detalhado por edicao e retorna array `edicoes[]` com `edicaoId, edicaoNumero, match, historico, criterios, convidarNovamente, presencas, comentarios, avaliadorNome`

**Checkpoint**: Endpoint retornando historico de match por edicao

---

## Phase 4: Tipos e Hooks Frontend

**Purpose**: Criar tipos TypeScript, funcoes de API e hook React Query para o frontend

- [X] T011 [P] Adicionar tipos `CandidatoMontagem`, `MatchDetalhe`, `ListaCandidatosMontagem`, `EdicaoMatchHistorico`, `MatchHistoricoResponse` em `src/lib/tipos.ts`
- [X] T012 [P] Criar funcoes `listarCandidatos(edicaoId, equipeId, offset)` e `buscarMatchHistorico(pessoaId, edicaoId)` em `src/lib/montagem.ts` seguindo padrao de `src/lib/cantina.ts`
- [X] T013 Criar hook `useMontagemCandidatos(edicaoId, equipeId)` em `src/lib/hooks.ts` usando `useInfiniteQuery` seguindo padrao de `CantinaPesquisa.tsx`, com `TAMANHO_LOTE = 20` e queryKey `["montagem-candidatos", edicaoId, equipeId]`

**Checkpoint**: Hooks prontos para uso na pagina

---

## Phase 5: User Story 1 — Tela com Equipes e Candidatos (Priority: P1) 🎯 MVP

**Goal**: Tela de Montagem com selecao de equipe e listagem de candidatos ordenados por match, com lazy-loading

**Independent Test**: Acessar `/montagem`, ver cards de equipes, selecionar uma, ver candidatos com match e botoes de alocacao

### Implementation

- [X] T014 Criar pagina `src/pages/Montagem.tsx` com: permissao `edicao.montagem`, hooks `useEdicaoAtiva`, `useEquipes`, `useParticipacoes`, `useMontagemCandidatos`, estado local `equipeSelecionada`, verificacao de permissao com `temPermissao`
- [X] T015 Criar componente `src/components/MontagemEquipeCard.tsx` com card clicavel exibindo nome e setor da equipe, indicador de equipe selecionada, estado vazio quando nao ha equipes
- [X] T016 Implementar secao de equipes na pagina: listagem horizontal de `MontagemEquipeCard`, campo de busca por nome (filtro local com `useState`), responsividade horizontal scroll em mobile
- [X] T017 Criar componente `src/components/MontagemCandidato.tsx` exibindo: nome da pessoa, badge com pontuacao de match, botao "adicionar Coordenador" (icone user-round-cog), botao "adicionar Equipista" (icone users-round)
- [X] T018 Implementar secao de alocados na pagina: listagem das pessoas com participacao na equipe selecionada, exibindo nome e funcao
- [X] T019 Implementar secao de candidatos com `useInfiniteQuery`: lista de `MontagemCandidato`, botao "Carregar mais" (padrao CantinaPesquisa), mensagem "Todas as X pessoas exibidas" quando nao ha mais, loading state

**Checkpoint**: Tela funcional com selecao de equipe, listagem de candidatos com match e lazy-loading

---

## Phase 6: User Story 2 — Detalhes da Pessoa e Historico de Match (Priority: P1)

**Goal**: Ao clicar em candidato, expandir mostrando foto, idade, detalhamento do match, comentarios e navegacao historica

**Independent Test**: Clicar em candidato, ver foto/idade/detalhe do match/comentarios, navegar entre edicoes com setas

### Implementation

- [X] T020 Criar componente `src/components/MontagemCandidatoDetalhe.tsx` com: foto da pessoa (ou placeholder), idade calculada via `calcularIdade()`, detalhamento do match (4 componentes com barras/numeros), comentarios e sugestoes da avaliacao da edicao anterior
- [X] T021 Criar componente `src/components/MontagemMatchHistorico.tsx` com: card de match da edicao retrasada (N-2), seta esquerda para voltar edicao, seta direita para avancar, dados da edicao atual (match, criterios, comentarios, avaliador)
- [X] T022 Integrar `MontagemCandidatoDetalhe` e `MontagemMatchHistorico` no `MontagemCandidato.tsx`: estado `expandido` por candidato, chamada a `buscarMatchHistorico` ao expandir, acordion expand/collapse
- [X] T023 Adicionar fetch de dados da pessoa (foto, nascimento) ao expandir: usar `usePessoas` existente ou buscar por ID, calcular idade com `calcularIdade()`

**Checkpoint**: Detalhes completos com foto, idade, match desagregado, comentarios e navegacao historica

---

## Phase 7: User Story 3 — Adicionar Pessoa a Equipe (Priority: P1)

**Goal**: Botoes de alocacao que vinculam pessoa a equipe como Coordenador ou Equipista

**Independent Test**: Clicar "adicionar Equipista", ver pessoa na secao de alocados e sumir da listagem de candidatos

### Implementation

- [X] T024 Implementar handler `handleAlocar` em `Montagem.tsx`: chamar `alocar()` de `src/lib/participacoes.ts` com `edicaoId, equipeId, pessoaId, funcao`, tratar erro 409 (pessoa ja alocada) e validacao de vagas de coordenador
- [X] T025 Conectar botoes do `MontagemCandidato` ao `handleAlocar`: botao "adicionar Coordenador" chama `handleAlocar(pessoa, "Coordenador")`, botao "adicionar Equipista" chama `handleAlocar(pessoa, "Equipista")`, estado `enviando` durante operacao
- [X] T026 Adicionar invalidacao de cache apos alocacao: `queryClient.invalidateQueries({ queryKey: ["montagem-candidatos"] })` e `queryClient.invalidateQueries({ queryKey: ["participacoes"] })` para atualizar listagem automaticamente
- [X] T027 Adicionar validacao visual de vagas: desabilitar botao "adicionar Coordenador" quando `vagasCoordenador` estiver preenchida, exibir tooltip informativo

**Checkpoint**: Alocacao funcionando com invalidacao de cache e validacao de vagas

---

## Phase 8: User Story 4 — Filtrar Equipes (Priority: P2)

**Goal**: Campo de filtro que busca equipes por nome em tempo real

**Independent Test**: Digitar texto, ver apenas equipes correspondentes, limpar e ver todas

### Implementation

- [X] T028 Implementar filtro de equipes em `Montagem.tsx`: `useState` para termo de filtro, filtragem local com `normalizar()` de `src/lib/utilsDominio`, exibicao de "Nenhuma equipe encontrada" quando resultado vazio

**Checkpoint**: Filtro funcionando com feedback visual

---

## Phase 9: Polish & Cross-Cutting

**Purpose**: Melhorias transversais e validacao final

- [X] T029 Verificar erros de build: rodar `npm run build` no frontend e `npm run build` no backend, corrigir quaisquer erros de tipo
- [X] T030 Verificar lint: rodar `npm run lint` (= `tsc -b --noEmit`) e corrigir quaisquer erros
- [X] T031 Revisar estados vazios: tela sem equipes, equipe sem alocados, listagem sem candidatos, pessoa sem avaliacao, edicoes sem historico
- [X] T032 Revisar responsividade: listagem horizontal de equipes em mobile, layout de candidatos em telas pequenas

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Sem dependencias — iniciar imediatamente
- **Phase 2 (API Candidatos)**: Depende de Phase 1 (permissao deve existir)
- **Phase 3 (API Historico)**: Depende de Phase 2 (mesma rota)
- **Phase 4 (Tipos/Hooks)**: Depende de Phase 2 (tipos da API)
- **Phase 5 (US1)**: Depende de Phase 1 + Phase 4
- **Phase 6 (US2)**: Depende de Phase 3 + Phase 5 (precisa da listagem para expandir)
- **Phase 7 (US3)**: Depende de Phase 5 (botoes ja existem na listagem)
- **Phase 8 (US4)**: Depende de Phase 5 (filtro na tela ja existente)
- **Phase 9 (Polish)**: Depende de todas as anteriores

### User Story Dependencies

- **US1 (P1)**: Depende de Setup + API + Tipos — foundational
- **US2 (P1)**: Depende de US1 (precisa da listagem para expandir) — sequencial
- **US3 (P1)**: Depende de US1 (botoes ja existem) — sequencial
- **US4 (P2)**: Depende de US1 (filtro na tela) — sequencial

### Within Each User Story

- Componentes antes da integracao
- Integracao antes da validacao
- Story completa antes de avancar

### Parallel Opportunities

- T001, T002, T003 sao paralelos (arquivos diferentes)
- T005, T006, T007 sao sequenciais (mesmo arquivo)
- T011, T012 sao paralelos (arquivos diferentes)
- T015, T017 sao paralelos (componentes diferentes)
- T020, T021 sao paralelos (componentes diferentes)

---

## Parallel Example: User Story 1

```
# Tarefas paralelas dentro de US1:
T015: MontagemEquipeCard.tsx (componente de equipe)
T017: MontagemCandidato.tsx (componente de candidato)

# Tarefas sequenciais:
T014: Montagem.tsx (pagina principal — precisa dos componentes)
T016: Integrar equipe cards na pagina
T018: Integrar secao de alocados
T019: Integrar secao de candidatos com lazy-loading
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1: Setup (permissao + menu)
2. Completar Phase 2: API de candidatos
3. Completar Phase 4: Tipos e hooks
4. Completar Phase 5: US1 completa
5. **PARAR e VALIDAR**: Testar tela de montagem independentemente

### Incremental Delivery

1. Setup + API → Backend pronto
2. US1 → Tela funcional com selecao + listagem (MVP!)
3. US2 → Detalhes expandidos + historico
4. US3 → Alocacao funcional
5. US4 → Filtro de equipes
6. Polish → Build passa, estados vazios, responsividade

---

## Notes

- [P] tasks = arquivos diferentes, sem dependencias
- [Story] label mapeia tarefa a user story para rastreabilidade
- Nao ha testes configurados neste projeto
- Cada phase tem checkpoint para validacao manual
- Commit apos cada tarefa ou grupo logico
- `npm run build` e `npm run lint` devem passar ao final
