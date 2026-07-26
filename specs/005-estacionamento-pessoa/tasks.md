# Tasks: Associacao Pessoa-Estacionamento

**Input**: Design documents from `/specs/005-estacionamento-pessoa/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), data-model.md, contracts/, research.md, quickstart.md

**Tests**: Nao solicitados — projeto nao tem test runner configurado.

**Organization**: Tasks organizados por user story para implementacao e teste independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependencias)
- **[Story]**: User story que a tarefa pertence (US1, US2, US3)

## Phase 1: Setup (Infraestrutura Compartilhada)

**Purpose**: Migration do banco e atualizacao de tipos

- [x] T001 Executar migration SQL: adicionar coluna `estacionamento_id` na tabela `pessoas` em `schema.sql`
- [x] T002 Atualizar interface `Pessoa` em `src/lib/tipos.ts` com campos `estacionamentoId`, `estacionamentoNome` e `temEstacionamento`
- [x] T003 [P] Atualizar schema Zod `EstacionamentoSchema` em `api/src/rotas/estacionamentos.ts` para incluir campos de pessoas

---

## Phase 2: Foundational (Prerequisitos Bloqueantes)

**Purpose**: Backend API e hooks compartilhados — DEVEM estar completos antes de qualquer user story

- [x] T004 Criar rota `GET /api/estacionamentos/:id/pessoas` em `api/src/rotas/estacionamentos.ts`
- [x] T005 Criar rota `POST /api/estacionamentos/:id/pessoas` em `api/src/rotas/estacionamentos.ts`
- [x] T006 Criar rota `DELETE /api/estacionamentos/:id/pessoas/:pessoaId` em `api/src/rotas/estacionamentos.ts`
- [x] T007 Atualizar rota `GET /api/pessoas/:id` em `api/src/rotas/pessoas.ts` para incluir LEFT JOIN com estacionamentos
- [x] T008 Adicionar hook `usePessoasEstacionamento(estacionamentoId)` em `src/lib/hooks.ts`
- [x] T009 Adicionar funcoes `associarPessoaEstacionamento`, `desassociarPessoaEstacionamento` em `src/lib/estacionamentos.ts`

**Checkpoint**: Backend funcional — API pronta para integracao com frontend

---

## Phase 3: User Story 1 - Associar pessoa a partir do detalhe da pessoa (Priority: P1) 🎯 MVP

**Goal**: ORG/ADM podem associar uma pessoa a um estacionamento a partir da tela de detalhes da pessoa

**Independent Test**: Acessar tela de detalhes de pessoa, clicar "Associar estacionamento", selecionar estacionamento, salvar. Verificar que o estacionamento aparece na listagem.

### Implementation for User Story 1

- [x] T010 [P] [US1] Criar componente `EstacionamentoPessoa` em `src/components/EstacionamentoPessoa.tsx`
- [x] T011 [US1] Adicionar secao "Estacionamento" em `src/pages/PessoaDetalhe.tsx` com componente `EstacionamentoPessoa`
- [x] T012 [US1] Implementar logica de associacao/desassociacao no componente (selecao de estacionamento, confirmacao)
- [x] T013 [US1] Adicionar validacao de permissao (ORC/ADM para editar, EQP somente leitura)

**Checkpoint**: US1 funcional — pessoa pode ser associada a estacionamento

---

## Phase 4: User Story 2 - Gerenciar pessoas a partir do estacionamento (Priority: P2)

**Goal**: ORG/ADM podem adicionar/remover pessoas a partir da tela de detalhes do estacionamento

**Independent Test**: Acessar detalhe do estacionamento, adicionar pessoa via busca, verificar que aparece na lista. Remover pessoa e verificar decremento do contador.

### Implementation for User Story 2

- [x] T014 [P] [US2] Criar componente `ListaPessoasEstacionamento` em `src/components/ListaPessoasEstacionamento.tsx`
- [x] T015 [US2] Adicionar secao "Pessoas Associadas" em `src/pages/EstacionamentoDetalhe.tsx`
- [x] T016 [US2] Implementar busca de pessoa por nome/cracha no componente de adicao
- [x] T017 [US2] Implementar logica de adicionar/remover pessoa com atualizacao de contador
- [x] T018 [US2] Adicionar feedback visual para vagas distribuidas vs contratadas

**Checkpoint**: US2 funcional — estacionamento pode gerenciar pessoas associadas

---

## Phase 5: User Story 3 - Visualizar associacao no detalhe da pessoa (Priority: P3)

**Goal**: Todos os usuarios podem visualizar o estacionamento associado a pessoa

**Independent Test**: Acessar detalhe de pessoa com estacionamento associado e verificar que o nome do estacionamento aparece como link clicavel.

### Implementation for User Story 3

- [x] T019 [P] [US3] Adicionar exibicao do estacionamento em `src/pages/PessoaDetalhe.tsx` (secao de dados)
- [x] T020 [US3] Implementar link clicavel para navegacao ao detalhe do estacionamento
- [x] T021 [US3] Adicionar mensagem "Nenhum estacionamento associado" quando nao houver vinculo

**Checkpoint**: US3 funcional — visualizacao completa da associacao

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Melhorias transversais e validacao final

- [x] T022 Executar `npm run lint` no frontend e `api/npm run build` no backend
- [ ] T023 Verificar consistencia do contador `vagas_distribuidas` via query SQL do quickstart.md
- [x] T024 Executar `npm run build` no frontend para validacao final
- [x] T025 Documentar migration no `schema.sql` com comentários

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependencias — pode iniciar imediatamente
- **Foundational (Phase 2)**: Depende do Setup — BLOQUEIA todas as user stories
- **User Stories (Phase 3+)**: Todas dependem do Foundational
  - US1 pode iniciar primeiro (P1 — MVP)
  - US2 pode rodar em paralelo com US1
  - US3 pode rodar em paralelo com US1 e US2
- **Polish (Phase 6)**: Depende de todas as user stories completas

### User Story Dependencies

- **US1 (P1)**: Depende do Foundational — Sem dependencias de outras stories
- **US2 (P2)**: Depende do Foundational — Pode rodar em paralelo com US1
- **US3 (P3)**: Depende do Foundational — Pode rodar em paralelo com US1 e US2

### Within Each User Story

- Componentes [P] podem rodar em paralelo
- Implementacao depende dos componentes criados
- Integracao depende da implementacao

### Parallel Opportunities

- T002 e T003 podem rodar em paralelo (arquivos diferentes)
- T010 pode rodar em paralelo com T011 (componente vs pagina)
- T014 pode rodar em paralelo com T015 (componente vs pagina)
- T019 pode rodar em paralelo com T020 e T021

---

## Parallel Example: User Story 1

```bash
# Componente e pagina podem ser criados em paralelo:
Task: "Criar componente EstacionamentoPessoa em src/components/EstacionamentoPessoa.tsx"
Task: "Adicionar secao Estacionamento em src/pages/PessoaDetalhe.tsx"

# Apos ambos prontos, implementar logica:
Task: "Implementar logica de associacao/desassociacao no componente"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundamental (CRITICO — bloqueia tudo)
3. Completar Phase 3: US1
4. **PARAR E VALIDAR**: Testar US1 independentemente
5. Deploy se pronto

### Incremental Delivery

1. Setup + Foundational → Infraestrutura pronta
2. Adicionar US1 → Testar independentemente → Deploy/Demo (MVP!)
3. Adicionar US2 → Testar independentemente → Deploy/Demo
4. Adicionar US3 → Testar independentemente → Deploy/Demo
5. Cada story agrega valor sem quebrar as anteriores

### Parallel Team Strategy

Com multiplos desenvolvedores:

1. Time completa Setup + Foundational junto
2. Apos Foundational completo:
   - Developer A: US1
   - Developer B: US2
   - Developer C: US3
3. Stories completam e integram independentemente

---

## Notes

- [P] tasks = arquivos diferentes, sem dependencias
- [Story] label mapeia task a user story para rastreabilidade
- Cada user story deve ser completavel e testavel independentemente
- Commit apos cada task ou grupo logico
- Parar em qualquer checkpoint para validar story independentemente
- Seguir convencoes: PT-BR, snake_case no banco, camelCase no TS, sem emojis
