# Tasks: Associar Veiculo a Estacionamento e Pessoas

**Input**: Design documents from `specs/012-associar-veiculo-estacionamento/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Nao ha test runner configurado no projeto. Testes nao serao gerados.

**Organization**: Tasks grouped by user story. Todas as alteracoes sao frontend — backend ja possui endpoints e schema.

## Format: `[ID] [P] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Frontend**: `src/pages/`, `src/components/` na raiz do repositorio
- **Backend**: `api/src/rotas/` (sem alteracoes previstas)

---

## Phase 1: Setup (Shared Infrastructure)

Nao ha setup necessario — projeto ja configurado (Vite 5 + React 18 + TypeScript + Tailwind 3). Nenhuma nova dependencia.

---

## Phase 2: Foundational (Blocking Prerequisites)

Nao ha tasks fundamentais — todas as APIs (`vincularPessoaVeiculo`, `desvincularPessoaVeiculo`, `atualizarVeiculo`), hooks (`useEstacionamentos`, `usePessoas`, `usePessoasVeiculo`) e tipos (`Veiculo`, `Pessoa`, `Estacionamento`) ja existem.

---

## Phase 3: User Story 1 - Associar Veiculo a Estacionamento pelo Detalhe (Priority: P1) MVP

**Goal**: Usuario ADM/ORG pode associar, transferir ou remover o estacionamento de um veiculo diretamente do detalhe.

**Independent Test**: Navegar ate `/veiculos/:id` de qualquer veiculo, selecionar um estacionamento no seletor, salvar. O nome do estacionamento aparece como link clicavel. Recarregar a pagina e confirmar que o vinculo persiste.

**Nota**: Nao existem testes automatizados no projeto. A validacao e manual via navegador.

### Implementation for User Story 1

- [x] T001 [US1] Adicionar seletor de estacionamento (inline `<select>`) no `src/pages/VeiculoDetalhe.tsx` seguindo o contrato definido em `contracts/veiculo-detalhe-integracao.md` (secao "Seletor de Estacionamento") e o padrao de `src/components/EstacionamentoPessoa.tsx` — importar `useEstacionamentos`, exibir lista ordenada por nome, permitir selecionar/alterar/remover estacionamento, chamar `atualizarVeiculo(id, { ...veiculo, estacionamentoId })` no salvamento, invalidar queries `["veiculos"]` apos salvamento

- [x] T002 [US1] Exibir nome do estacionamento vinculado como `<Link to={/estacionamentos/${id}}>` no modo visualizacao do `src/pages/VeiculoDetalhe.tsx` — substituir o badge "Vinculado" atual pelo nome clicavel do estacionamento (conforme `contracts/veiculo-detalhe-integracao.md`); exibir "Nenhum estacionamento associado." quando `estacionamentoId` for nulo

**Checkpoint**: Ao acessar `/veiculos/:id`, o usuario ve o nome do estacionamento (se houver) como link clicavel. ADM/ORG podem clicar em "Alterar"/"+ Associar" para abrir o seletor, escolher um estacionamento e salvar. O nome atualiza na tela sem recarregamento.

---

## Phase 4: User Story 2 - Vincular Pessoas ao Veiculo pelo Detalhe (Priority: P1)

**Goal**: Usuario ADM/ORG pode vincular e desvincular pessoas ao veiculo diretamente do detalhe.

**Independent Test**: Navegar ate `/veiculos/:id`, clicar em "+ Vincular", buscar uma pessoa pelo nome, seleciona-la. A pessoa aparece na lista de vinculados. Remover a pessoa e confirmar que sai da lista.

### Implementation for User Story 2

- [x] T003 [P] [US2] Criar componente `VinculoPessoa` em `src/components/VinculoPessoa.tsx` seguindo a interface definida em `contracts/veiculo-detalhe-integracao.md` (secao "Vinculo de Pessoas") e o mesmo padrao de `src/components/VinculoVeiculo.tsx` — exibir lista de pessoas vinculadas com nome, modal de busca por nome (usar campo `nome` para filtro), botoes "Vincular" e "Remover". Props: `titulo`, `pessoasDisponiveis: {id,nome}[]`, `pessoasVinculadas: {id,nome}[]`, `aoVincular(pessoaId)`, `aoDesvincular(pessoaId)`

- [x] T004 [US2] Integrar `VinculoPessoa` no `src/pages/VeiculoDetalhe.tsx` — importar o componente, obter lista de pessoas via `usePessoas()`, obter pessoas vinculadas via `usePessoasVeiculo(id)`, calcular `pessoasDisponiveis` (pessoas - pessoasVinculadas), passar callbacks `vincularPessoaVeiculo` e `desvincularPessoaVeiculo` com invalidacao de queries apos cada operacao

**Checkpoint**: Ao acessar `/veiculos/:id`, o usuario ADM/ORG ve a lista de pessoas vinculadas. Pode clicar em "+ Vincular", buscar por nome, selecionar. A pessoa aparece na lista. Pode remover com o botao "Remover". Tudo sem recarregamento da pagina.

---

## Phase 5: User Story 3 - Visualizar Vinculos no Detalhe do Veiculo (Priority: P2)

**Goal**: Qualquer perfil autorizado (CRD, EQP, OPC, REC) consegue visualizar o estacionamento e as pessoas vinculadas ao veiculo.

**Independent Test**: Logar com perfil CRD ou REC, navegar ate `/veiculos/:id`, ver o nome do estacionamento como link clicavel e os nomes das pessoas vinculadas como links clicaveis para `/pessoas/:id`.

### Implementation for User Story 3

- [x] T005 [US3] Exibir nomes das pessoas vinculadas como `<Link to={/pessoas/${id}}>` no `src/pages/VeiculoDetalhe.tsx` — adicionar link para `/pessoas/:id` em cada item da lista de pessoas vinculadas; exibir "Nenhuma pessoa vinculada." quando a lista estiver vazia

**Checkpoint**: Qualquer perfil autenticado ve os vinculos corretamente. Nomes de estacionamento e pessoas sao links clicaveis para suas respectivas paginas de detalhe.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verificacao final e build.

- [x] T006 Executar `npm run build` e `npm run lint` para verificar se o codigo compila e passa no typecheck — confirmar que `tsc -b` nao apresenta erros
- [x] T007 Executar os 8 cenarios de validacao manual do `quickstart.md` e confirmar que todos passam — US1 (cenarios 1-3), US2 (cenarios 4-5), US3 (cenarios 6-8)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Nao ha tasks
- **Foundational (Phase 2)**: Nao ha tasks
- **US1 (Phase 3)**: Pode comecar imediatamente — sem dependencias de setup
- **US2 (Phase 4)**: Pode comecar apos US1 — ambas modificam `VeiculoDetalhe.tsx`, portanto devem ser sequenciais para evitar conflitos de merge
- **US3 (Phase 5)**: Depende de US1 e US2 estarem completos (visualizacao dos vinculos criados)
- **Polish (Phase 6)**: Apos todas as stories

### User Story Dependencies

- **US1 (P1)**: Sem dependencias de outras stories
- **US2 (P1)**: Sem dependencias de outras stories (mas mesmo arquivo que US1 → sequencial)
- **US3 (P2)**: Depende de US1 e US2 (visualiza os dados criados por elas)

### Within Each User Story

- Implementacao direta (sem testes no projeto)

### Parallel Opportunities

- **T003** (`VinculoPessoa.tsx`) pode rodar em paralelo com T001/T002 — sao arquivos diferentes
- Demais tasks sao sequenciais (mesmo arquivo `VeiculoDetalhe.tsx`)

---

## Parallel Example: User Story 2

```bash
# T003 pode rodar em paralelo com US1 (arquivo diferente):
Task: "Criar VinculoPessoa em src/components/VinculoPessoa.tsx"
# T004 depende de T003 e de US1 (mesmo arquivo)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 3: US1 (seletor de estacionamento)
2. **PARAR e VALIDAR**: Testar US1 independentemente — associar/alterar/remover estacionamento
3. Deploy/demo se necessario

### Incremental Delivery

1. Adicionar US1 (seletor estacionamento) → Testar → Deploy/Demo
2. Adicionar US2 (vinculo pessoas) → Testar → Deploy/Demo
3. Adicionar US3 (links nos nomes) → Testar → Deploy/Demo

### Parallel Team Strategy

Com dois desenvolvedores:
1. Dev A: T001-T002 (US1 - seletor estacionamento em VeiculoDetalhe)
2. Dev B: T003 (US2 - VinculoPessoa componente)
3. Apos T003: Dev B integra T004 (US2 - VinculoPessoa em VeiculoDetalhe)
4. Unificar e prosseguir com US3 e Polish

---

## Notes

- Tasks T001, T002, T004, T005 modificam o mesmo arquivo `VeiculoDetalhe.tsx` → executar em ordem sequencial para evitar conflitos
- T003 cria arquivo novo → pode ser paralelizado com US1
- `VinculoPessoa.tsx` deve seguir a interface definida em `contracts/veiculo-detalhe-integracao.md` e o padrao de `VinculoVeiculo.tsx` (mesma estrutura de modal, filtro por campo `nome` em vez de `placa`)
- O seletor de estacionamento deve seguir o contrato em `contracts/veiculo-detalhe-integracao.md` e o padrao de `EstacionamentoPessoa.tsx` (`<select>` inline com botoes Salvar/Cancelar)
- `data-model.md` documenta as entidades e relacoes — consultar para entender os tipos envolvidos
- `quickstart.md` contem os cenarios de validacao manual para cada user story
- Commit apos cada task ou grupo logico de tasks
