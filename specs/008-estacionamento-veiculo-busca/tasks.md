# Tasks: Remocao de Associacao Pessoa-Estacionamento e Busca de Veiculos

**Input**: Design documents from `/specs/008-estacionamento-veiculo-busca/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/busca-veiculos.md

**Tests**: Nenhum test runner configurado. Validacao manual via `npm run build` e `npm run lint`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verificar que o ambiente esta funcional antes de comecar

- [x] T001 Verificar que `npm run build` e `npm run lint` passam sem erros
- [x] T002 Ler `src/pages/EstacionamentoDetalhe.tsx` e `src/components/ListaPessoasEstacionamento.tsx` para entender a estrutura atual

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Preparar o terreno — a nova componente depende de hooks e tipos ja existentes

- [x] T003 Confirmar que `useVeiculosEstacionamento` retorna `VeiculoComPessoas[]` com campo `pessoas` em `src/lib/hooks.ts`
- [x] T004 Confirmar que `associarVeiculoEstacionamento` e `desassociarVeiculoEstacionamento` existem em `src/lib/veiculos.ts`

---

## Phase 3: User Story 1 — Remover aba de pessoas (Priority: P1) 🎯 MVP

**Goal**: A aba "Pessoas Associadas" nao existe mais na tela de detalhes do estacionamento.

**Independent Test**: Acesse detalhe de um estacionamento e verifique que apenas "Check-in" e "Veiculos" estao presentes.

### Implementation for User Story 1

- [x] T005 [US1] Remover import de `ListaPessoasEstacionamento` em `src/pages/EstacionamentoDetalhe.tsx:16`
- [x] T006 [US1] Remover estado `abaAtiva` do tipo `"pessoas"` — mudar union para `"checkins" | "veiculos"` em `src/pages/EstacionamentoDetalhe.tsx:32`
- [x] T007 [US1] Remover o primeiro `<button>` da aba (label "Pessoas Associadas") em `src/pages/EstacionamentoDetalhe.tsx:425-435`
- [x] T008 [US1] Remover o bloco condicional `{abaAtiva === "pessoas" && ...}` em `src/pages/EstacionamentoDetalhe.tsx:460-466`

**Checkpoint**: Aba "Pessoas Associadas" nao aparece mais. Apenas "Check-in" e "Veiculos" ficam.

---

## Phase 4: User Story 2 — Busca de veiculos (Priority: P1) 🎯 MVP

**Goal**: Campo de busca na aba "Veiculos" filtra por fabricante, modelo, cor, placa, nome de pessoa ou cracha.

**Independent Test**: Acesse aba "Veiculos" e digite termos de busca — resultados filtram corretamente.

### Implementation for User Story 2

- [x] T009 [P] [US2] Criar componente `src/components/ListaVeiculosEstacionamento.tsx` com interface `Props { estacionamentoId: string }` — esqueleto basico com titulo e area de busca
- [x] T010 [US2] Implementar estado local `busca` (string) com debounce de 300ms usando `useEffect` em `src/components/ListaVeiculosEstacionamento.tsx`
- [x] T011 [US2] Implementar funcao `veiculosFiltrados` que filtra `veiculosEstacionamento` por: `fabricante`, `modelo`, `cor`, `placa`, `pessoas[].nome`, `pessoas[].cracha` (case-insensitive) em `src/components/ListaVeiculosEstacionamento.tsx`
- [x] T012 [US2] Renderizar lista filtrada com: linha 1 (`fabricante` `modelo`), linha 2 (`placa` · `cor`), linha 3 condicional (`Pessoas: nomes`) em `src/components/ListaVeiculosEstacionamento.tsx`
- [x] T013 [US2] Exibir "Nenhum veiculo encontrado" quando `veiculosFiltrados.length === 0` em `src/components/ListaVeiculosEstacionamento.tsx`
- [x] T014 [US2] Integrar componente `ListaVeiculosEstacionamento` no bloco `{abaAtiva === "veiculos" && ...}` em `src/pages/EstacionamentoDetalhe.tsx`

**Checkpoint**: Busca funciona — digitando "Fiat" so aparecem veiculos Fiat. Busca por nome de pessoa vinculada tambem retorna o veiculo.

---

## Phase 5: User Story 3 — Associar veiculo (Priority: P2)

**Goal**: ORG/ADM podem associar veiculos ao estacionamento a partir da aba "Veiculos" com busca.

**Independent Test**: Na aba "Veiculos", busque um veiculo nao associado e clique "Associar" — veiculo aparece na lista.

### Implementation for User Story 3

- [x] T015 [US3] Adicionar secao "Associar novo veiculo" com campo de busca e lista de `todosVeiculos` filtrados por `!estacionamentoId` em `src/components/ListaVeiculosEstacionamento.tsx`
- [x] T016 [US3] Implementar funcao `handleAssociar` que chama `associarVeiculoEstacionamento(estacionamentoId, veiculoId)` e invalida queries em `src/components/ListaVeiculosEstacionamento.tsx`
- [x] T017 [US3] Adicionar botao "Associar" ao lado de cada veiculo na secao de associacao em `src/components/ListaVeiculosEstacionamento.tsx`
- [x] T018 [US3] Exibir "Todos os veiculos ja estao associados a estacionamentos." quando `todosVeiculos.filter(v => !v.estacionamentoId).length === 0` em `src/components/ListaVeiculosEstacionamento.tsx`
- [x] T019 [US3] Aplicar permissoes: campo de busca e botoes "Associar" so aparecem se `podeEditar` (ADM/ORG) em `src/components/ListaVeiculosEstacionamento.tsx`

**Checkpoint**: ORG/ADM podem buscar e associar veiculos. EQP nao ve opcoes de edicao.

---

## Phase 6: User Story 4 — Desassociar veiculo (Priority: P2)

**Goal**: ORG/ADM podem remover veiculos da lista de associados.

**Independent Test**: Clique "Remover" ao lado de um veiculo — ele sai da lista.

### Implementation for User Story 4

- [x] T020 [US4] Adicionar botao "Remover" ao lado de cada veiculo na lista de associados em `src/components/ListaVeiculosEstacionamento.tsx`
- [x] T021 [US4] Implementar funcao `handleDesassociar` que chama `desassociarVeiculoEstacionamento(estacionamentoId, veiculoId)` e invalida queries em `src/components/ListaVeiculosEstacionamento.tsx`
- [x] T022 [US4] Botao "Remover" so aparece se `podeEditar` em `src/components/ListaVeiculosEstacionamento.tsx`

**Checkpoint**: Remocao funciona — veiculo sai da lista e volta a aparecer na secao de associacao.

---

## Phase 7: User Story 5 — Visualizar pessoas vinculadas (Priority: P3)

**Goal**: Cada veiculo na lista mostra os nomes das pessoas vinculadas.

**Independent Test**: Na aba "Veiculos", veiculos com pessoas exibem os nomes abaixo dos dados.

### Implementation for User Story 5

- [x] T023 [US5] Na renderizacao de cada veiculo, exibir `Pessoas: {nomes}` apenas se `veiculo.pessoas.length > 0` em `src/components/ListaVeiculosEstacionamento.tsx` (implementado junto com T012, verificar se esta completo)

**Checkpoint**: Pessoas vinculadas aparecem nos veiculos que as possuem.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Limpeza e validacao final

- [x] T024 Excluir arquivo `src/components/ListaPessoasEstacionamento.tsx` (codigo morto)
- [x] T025 Verificar que `npm run build` passa sem erros de tipo
- [x] T026 Verificar que `npm run lint` passa sem erros
- [x] T027 Executar quickstart.md — validar os 10 cenarios de validacao

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Sem dependencias — pode comecar imediatamente
- **Phase 2 (Foundational)**: Depende do Setup — BLOQUEIA todas as user stories
- **Phase 3 (US1)**: Depende do Foundational — remove aba antiga
- **Phase 4 (US2)**: Depende do Foundational — cria componente com busca
- **Phase 5 (US3)**: Depende da US2 (precisa da componente existente)
- **Phase 6 (US4)**: Depende da US2 (precisa da componente existente)
- **Phase 7 (US5)**: Depende da US2 (ja implementado em T012, apenas verificar)
- **Phase 8 (Polish)**: Depende de todas as user stories

### User Story Dependencies

- **US1 (P1)**: Independente — remove aba antiga
- **US2 (P1)**: Independente — cria componente com busca (prioridade alta)
- **US3 (P2)**: Depende da US2 — usa componente criada
- **US4 (P2)**: Depende da US2 — usa componente criada
- **US5 (P3)**: Depende da US2 — ja coberto em T012

### Within Each User Story

- Componente base antes de funcionalidades
- Busca antes de associacao/desassociacao
- Permissoes por ultimo

### Parallel Opportunities

- T005, T006, T007, T008 podem ser feitos em paralelo (mesmo arquivo, mas blocos distintos)
- T009 pode comecar imediatamente apos Foundational
- US3 e US4 podem ser feitos em paralelo apos US2

---

## Parallel Example: User Story 2

```bash
# Componente base primeiro:
Task: T009 — Criar esqueleto de ListaVeiculosEstacionamento.tsx

# Depois funcionalidades em paralelo (diferentes blocos do arquivo):
Task: T010 — Debounce na busca
Task: T011 — Funcao de filtragem
Task: T012 — Renderizacao da lista
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Completar Phase 1 (Setup)
2. Completar Phase 2 (Foundational)
3. Completar Phase 3 (US1) — remove aba de pessoas
4. Completar Phase 4 (US2) — componente com busca
5. **PARAR E VALIDAR**: Aba so tem "Check-in" e "Veiculos". Busca funciona.
6. Deploy/demo se pronto

### Incremental Delivery

1. Setup + Foundational → Base pronta
2. US1 + US2 → MVP funcional (aba limpa + busca) → Deploy/Demo
3. US3 + US4 → Associacao/desassociacao completa → Deploy/Demo
4. US5 → Visualizacao de pessoas (ja implementado) → Deploy/Demo
5. Polish → Limpeza final

---

## Notes

- [P] tasks = diferentes arquivos, sem dependencias
- [Story] label mapeia task a user story para rastreabilidade
- Cada user story pode ser completada e testada independentemente
- Validar `npm run build` e `npm run lint` apos cada fase
- Commit apos cada task ou grupo logico
- Parar em qualquer checkpoint para validar story independentemente
