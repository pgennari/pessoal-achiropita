# Tasks: Relatorio de Avaliacoes de Equipistas

**Input**: Design documents from `/specs/021-relatorio-avaliacoes/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Nenhum test runner configurado no projeto. Validacao por `npm run lint`, `npm run build` e roteiro manual do `quickstart.md`. Sem tarefas de teste automatizado.

**Organization**: Agrupadas por user story para implementacao e teste independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependencia pendente)
- **[Story]**: User story dona da tarefa (US1, US2, US3)
- Incluir caminho exato de arquivo nas descricoes

## Path Conventions

Projeto web app existente: SPA em `src/` + API em `api/` (API nao sera alterada nesta feature).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline verificada antes de qualquer mudanca

- [x] T001 Verificar baseline verde antes das alteracoes: rodar `npm run lint` na raiz (typecheck strict) e registrar resultado como referencia

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Tipo estendido, pagina, rota e menu — prerequisito de todas as user stories

**⚠️ CRITICAL**: Nenhuma user story comeca antes desta fase

- [x] T002 Estender interface `Avaliacao` com campos opcionais de exibicao `equipeNome?: string`, `pessoaNome?: string`, `pessoaCracha?: string | null` em `src/lib/tipos.ts` (ver data-model.md; API ja retorna esses campos em GET /api/avaliacoes)
- [x] T003 Criar pagina `src/pages/RelatorioAvaliacoes.tsx` com gate `temPermissao(sessao, "avaliacao.gerenciar")` (bloco "Sem permissao" padrao), cabecalho "Relatorios > Avaliacoes", carregamento via `useEdicaoAtiva()` + `useAvaliacoes(edicao?.id)` e tratamento dos estados carregando/erro/sem edicao ativa
- [x] T004 Registrar rota protegida `/avaliacoes/relatorio` apontando para `RelatorioAvaliacoes` dentro do Layout autenticado em `src/App.tsx` (depende de T003)
- [x] T005 Adicionar item "Avaliacoes" (icone existente "avaliar") na secao "Relatorios" do menu com permissao `avaliacao.gerenciar` em `src/components/Sidebar.tsx` (depende de T003; rota ja registrada em T004)

**Checkpoint**: Menu exibe o item, rota responde e a pagina carrega a listagem integral da edicao ativa (ainda sem filtros)

---

## Phase 3: User Story 1 - Filtrar avaliacoes pelos valores de cada criterio (Priority: P1) 🎯 MVP

**Goal**: Usuario autorizado filtra a listagem marcando valores possiveis de cada criterio (Otimo/Bom/Regular/Ruim nos 6 criterios; notas 1..5 em "Chances de convidar novamente"), com contador e limpeza de filtros

**Independent Test**: Com massa conhecida, marcar "Ruim" em Pontualidade mostra somente os registros correspondentes; acrescentar "Regular" amplia (OR); filtrar tambem convidar novamente restringe (AND); limpar restaura a listagem completa

### Implementation for User Story 1

Todas as tarefas desta story editam `src/pages/RelatorioAvaliacoes.tsx` — execucao sequencial.

- [x] T006 [US1] Definir constantes `CRITERIOS_RELATORIO` (chave de `CriteriosAvaliacao`, rotulo PT-BR acentuado, valores `ValorCriterio`) e `NOTAS_CONVIDAR` (1..5) no topo de `src/pages/RelatorioAvaliacoes.tsx`
- [x] T007 [US1] Implementar estado `FiltrosRelatorio` (`criterios: Partial<Record<CampoCriterio, Set<ValorCriterio>>>`, `convidarNovamente: Set<NotaConvidarNovamente>`) e handler de marcar/desmarcar valor em `src/pages/RelatorioAvaliacoes.tsx`
- [x] T008 [US1] Implementar funcao pura `aplicarFiltros(avaliacoes, filtros)` em `src/pages/RelatorioAvaliacoes.tsx`: OR dentro do mesmo campo, AND entre campos, valor `null` nunca satisfaz filtro ativo, preservando ordenacao `atualizadoEm DESC` (regras 1-6 do data-model.md); memoizar com `useMemo`
- [x] T009 [US1] Renderizar painel de filtros acima da listagem usando classes `filtro-chip`/`filtro-chip-ativo`: um grupo por criterio com seus 4 valores e um grupo de notas 1..5 para "Chances de convidar novamente" em `src/pages/RelatorioAvaliacoes.tsx`
- [x] T010 [US1] Renderizar listagem filtrada com pessoa avaliada, equipe, avaliador, status (badge rascunho/finalizada), valores dos 6 criterios, nota de retorno, aptidao e data de atualizacao formatada em `src/pages/RelatorioAvaliacoes.tsx`
- [x] T011 [US1] Exibir contador de resultados ("X avaliacoes") refletindo exatamente os filtros vigentes em `src/pages/RelatorioAvaliacoes.tsx`
- [x] T012 [US1] Adicionar comando "Limpar filtros" (zera todos os conjuntos) e estados vazios distintos: sem avaliacoes na edicao vs. nenhum resultado para os filtros aplicados em `src/pages/RelatorioAvaliacoes.tsx`
- [ ] T013 [US1] Validar US1: `npm run lint` e `npm run build` passando; cenarios 2, 3, 5 e 6 do `specs/021-relatorio-avaliacoes/quickstart.md` conferidos com massa de teste

**Checkpoint**: US1 funcional e testavel independentemente — filtros, contador, limpeza e estados vazios operantes

---

## Phase 4: User Story 2 - Resumo do relatorio (Priority: P2)

**Goal**: Resumo numerico acima da listagem: total geral, total filtrado e contagem por valor de cada campo, coerente com os filtros

**Independent Test**: Comparar contagens exibidas com totais conhecidos da massa, antes e depois de aplicar filtros; com filtros que zeram o resultado, todos os numeros exibem zero

### Implementation for User Story 2

- [x] T014 [US2] Implementar funcao `contarPorCampo(avaliacoesUniverse, campoExcluido)` que conta respostas por valor possivel excluindo o proprio campo do universo filtrado (regra do resumo no data-model.md), memoizada em `src/pages/RelatorioAvaliacoes.tsx`
- [x] T015 [US2] Renderizar secao de resumo com KPIs `kpi` (total geral da edicao, total apos filtros) e distribuicao por valor de cada campo (rotulo + contagem), zerando coerentemente quando nenhum registro atende, em `src/pages/RelatorioAvaliacoes.tsx` (depende de T008, T010)
- [ ] T016 [US2] Validar US2: cenario 4 do `specs/021-relatorio-avaliacoes/quickstart.md` conferido (somas batem antes/depois de filtros; zero coerente) e `npm run lint` passando

**Checkpoint**: Stories 1 E 2 funcionam de forma independente

---

## Phase 5: User Story 3 - Abrir o detalhe de uma avaliacao (Priority: P3)

**Goal**: Selecionar um registro expande inline o detalhe completo da avaliacao

**Independent Test**: Expandir qualquer registro e conferir todos os campos (criterios, nota de retorno, aptidao, comentarios, avaliador, pessoa, equipe, status, datas); rascunho indica criterios sem resposta

### Implementation for User Story 3

- [x] T017 [US3] Adicionar estado `detalheAbertoId` + handler de alternancia por linha (padrao `alternarDetalhe`) em `src/pages/RelatorioAvaliacoes.tsx`
- [x] T018 [US3] Renderizar bloco de detalhe expandido inline com pessoa avaliada, equipe, avaliador, status, os 6 criterios, nota de "Chances de convidar novamente", aptidao a coordenar, comentarios e datas criado/atualizado/finalizado, indicando "—" (sem resposta) para criterios nulos, em `src/pages/RelatorioAvaliacoes.tsx` (depende de T010, T017)
- [ ] T019 [US3] Validar US3: cenario 7 e parte do cenario 6 do `specs/021-relatorio-avaliacoes/quickstart.md` conferidos e `npm run lint` passando

**Checkpoint**: Todas as user stories funcionam de forma independente

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Refinamentos que afetam multiplas stories

- [x] T020 Revisar responsividade da pagina em largura de celular (grupos de chips com wrap, listagem legivel, resumo empilhado) em `src/pages/RelatorioAvaliacoes.tsx` (cenario 8 do quickstart)
- [ ] T021 Executar roteiro completo de `specs/021-relatorio-avaliacoes/quickstart.md` (cenarios 1-8, incluindo acesso negado para perfil sem `avaliacao.gerenciar`) e corrigir desvios encontrados
- [x] T022 Fechamento: `npm run lint` e `npm run build` verdes na raiz; confirmar que `api/` e `schema.sql` nao foram alterados

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: imediata, sem dependencias
- **Foundational (Phase 2)**: depende do Setup; BLOQUEIA todas as user stories (T002 → T003 → T004/T005)
- **US1 (Phase 3)**: depende da Foundational; nucleo do relatorio
- **US2 (Phase 4)**: depende de US1 concluida (usa a lista filtrada e a estrutura de filtros)
- **US3 (Phase 5)**: depende de US1 concluida (expande linhas da listagem); independente de US2
- **Polish (Phase 6)**: depende de todas as stories desejadas concluidas

### User Story Dependencies

- **US1**: pode iniciar apos a Foundational — nenhuma dependencia de outras stories
- **US2**: integra-se ao resultado filtrado da US1, mas valida-se isoladamente contra a massa
- **US3**: anexa-se as linhas da US1, mas valida-se isoladamente abrindo qualquer detalhe

### Within Each User Story

- Constantes/estado antes das funcoes puras; funcoes puras antes da UI que as consome
- Listagem antes do resumo (US2) e antes do detalhe (US3)
- Validacao (lint/build/quickstart parcial) fecha cada story

### Parallel Opportunities

- T002 pode rodar em paralelo com nada nesta feature de arquivo unico — mas T004 e T005 sao [P] entre si (arquivos diferentes, ambos dependem apenas de T003)
- US2 e US3 sao independentes entre si apos US1, porem editam o mesmo arquivo: executar sequencialmente para evitar conflito
- Sem tarefas de teste automatizado (projeto sem runner)

---

## Parallel Example: Foundational

```text
# Apos T003 (pagina criada), lancar juntos:
Task: "Registrar rota /avaliacoes/relatorio em src/App.tsx"      (T004)
Task: "Adicionar item Avaliacoes na secao Relatorios em src/components/Sidebar.tsx" (T005)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Concluir Phase 1 (Setup) e Phase 2 (Foundational)
2. Concluir Phase 3 (US1)
3. **STOP e VALIDATE**: cenarios 2, 3, 5 e 6 do quickstart com massa de teste
4. Demo pronto: relatorio com filtros utilizavel

### Incremental Delivery

1. Foundation → US1 → validar → entrega minima (MVP)
2. + US2 (resumo) → validar cenario 4
3. + US3 (detalhe) → validar cenarios 6-7
4. Polish (responsividade + roteiro completo + builds) → pronto para merge

---

## Notes

- Commits em PT-BR no imperativo, um por tarefa ou grupo logico
- Nenhuma alteracao em `api/`, `schema.sql` ou dependencias — violacao = rever o plano
- [P] = arquivos diferentes sem dependencia pendente
- Parar em qualquer checkpoint para validar a story independentemente
