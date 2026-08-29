# Tasks: Exclusao lógica de equipes

**Input**: Design documents from `/specs/024-exclusao-logica-equipe/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Não há test runner configurado no projeto. A spec não solicita testes automatizados — a validação é feita por `npm run lint` (= `tsc -b --noEmit`), builds e pelos cenários manuais de `quickstart.md`. Cada fase tem um **Checkpoint** indicando a validação.

**Organization**: Tasks grouped by user story (US1/US2 = P1, US3 = P2).

## Regra de cobertura (boundary) — leia antes de codar

- **Filtra `excluida = FALSE`** onde a equipe é *opção/alvo*: listagens, detalhe, relatórios por equipe, cópia, pai do organograma, contexto de sincronização, alocação novo registro.
- **NÃO filtra** leituras *históricas da pessoa* (registros da pessoa exibem o nome da equipe gravado): `presenca/:diaId`, `presenca/pessoa`, avaliações, montagem (joins sobre participações da pessoa), `historico-equipes` e `participacoes_historicas` — filtrá-los violaria US3/FR-007 (histórico continua presente e coerente).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Nenhuma infraestrutura nova necessária — scripts de migration já existem.

- [X] T001 Adicionar a coluna `excluida BOOLEAN NOT NULL DEFAULT FALSE` na tabela `equipes` em `schema.sql` (após o bloco `raiz`, linha ~130). Produção usa `scripts/adicionar-coluna-excluida-equipes.sql` (já criado, idempotente) + opcional `scripts/ajustar-fk-exclusao-equipes.sql`.

**Checkpoint**: Coluna presente no schema de referência e no banco de desenvolvimento (aplicar o ALTER também no banco local antes de rodar o backend novo).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Contrato do campo `excluida` no retorno da API e no tipo do front — base para US1/US2.

**⚠️ CRITICAL**: O banco precisa ter a coluna (fase 1) antes do primeiro deploy do backend que a lê.

- [X] T002 Adicionar `e.excluida` ao `SEL_EQUIPES` (`api/src/rotas/equipes.ts:28-42`) e mapear `excluida` em `equipeDeRow` (`api/src/rotas/equipes.ts:9-24`) — cobre GET list/detalhe, POST e PUT que reutilizam a CTE.
- [X] T003 [P] Adicionar `excluida: boolean;` na interface `Equipe` (`src/lib/tipos.ts:294`) e mapear em `equipeDeSnap` (`src/lib/equipes.ts:22-34`) com `excluida: (data.excluida as boolean) ?? false` (snapshots antigos não quebram).

**Checkpoint**: `npm run lint` e builds passam; front recebe `excluida` nos objetos de equipe.

---

## Phase 3: User Story 1 - Excluir equipe com desalocação em massa (Priority: P1) 🎯 MVP

**Goal**: `DELETE /api/equipes/:id` deixa de apagar o registro e passa a marcar `excluida = TRUE`, desalocando todas as pessoas em uma operação e registrando cada desalocação no histórico da pessoa (FR-001, FR-002, FR-003, FR-008, FR-009).

**Independent Test**: `quickstart.md` Cenários 1 e 2 — excluir equipe com/sem pessoas, confirmar contagem no aviso e conferir `pessoa_equipe_historico` e ausência da equipe nas listagens.

- [X] T004 [US1] Converter o handler de `DELETE /api/equipes/:id` (`api/src/rotas/equipes.ts:333-343`) em exclusão lógica transacional (`sql.begin`):
  1. `SELECT edicao_id, nome, equipe_pai_id FROM equipes WHERE id = ${id} AND excluida = FALSE` — ausente/excluída → 404 `Equipe não encontrada.`
  2. Ler alocações (`participacoes` + nome da equipe) — padrão `pessoas.ts:428-459`.
  3. `DELETE FROM participacoes WHERE equipe_id = ${id}`.
  4. Para cada pessoa: `INSERT INTO pessoa_equipe_historico` (origem = id/nome da equipe, destino = NULL, autor = sessão) — mesmo formato de `participacoes.ts:224-236`.
  5. `UPDATE equipes SET equipe_pai_id = NULL WHERE equipe_pai_id = ${id}` (FR-006).
  6. `UPDATE equipes SET excluida = TRUE, atualizado_em = NOW() WHERE id = ${id}`.
  7. `registrarEvento(sessao, "equipe.removeu", \`equipes/${id}\`, "${nome} (${N} pessoas desalocadas)")`.
  Resposta `200 { ok: true }` (inalterada — front não lê o corpo).
- [X] T005 [US1] Atualizar o comentário obsoleto "Participações são removidas em cascade pelo banco." em `src/lib/equipes.ts:115` para refletir a exclusão lógica (remover a dependência do cascade do banco).

**Nota (flag de progresso, sem código)**: FR-003 já é atendida por `src/pages/EdicaoDetalhe.tsx:168-182` (`handleRemoverEquipe` exibe a contagem de pessoas alocadas no `confirm`). Validar no Cenario 2 do quickstart.

**Checkpoint**: `quickstart.md` Cenários 1-2 e 8 (permite excluir equipe desalocando pessoas; evento `equipe.removeu` na auditoria; `{ok:true}`).

---

## Phase 4: User Story 2 - Equipe excluída não aparece em lugar nenhum (Priority: P1)

**Goal**: Toda leitura de equipes como *opção* ignora `excluida = TRUE`; link direto e edição resultam em "não encontrada" (FR-004, FR-005, FR-006).

**Independent Test**: `quickstart.md` Cenários 3-6 — após excluir, conferir listagens, organograma, relatórios, busca e link direto.

- [X] T006 [US2] Filtrar `e.excluida = FALSE` nas leituras de `api/src/rotas/equipes.ts`:
  - `GET /` nas três variantes: `equipes.ts:110` (por edição), `equipes.ts:115` (escopo CRD), `equipes.ts:119` (geral).
  - `GET /relatorio-equipistas`: `equipes.ts:145-157`.
  - `GET /:id`: `equipes.ts:181` (excluída → 404).
  - `PUT /:id`: `equipes.ts:257-258` na query do existente (`AND excluida = FALSE`) → 404 não permite editar.
  - `POST /copiar`: `equipes.ts:367-371` (`AND excluida = FALSE` na origem).
  - `erroPaiInvalido`: `equipes.ts:60` (`AND excluida = FALSE`) — equipe excluída não pode ser superior no organograma.
- [X] T007 [US2] Filtrar `eq.excluida = FALSE` em `GET /api/presenca/resumo-equipes` (`api/src/rotas/presenca.ts:281-304`). Não mexer em `presenca/:diaId` nem `presenca/pessoa` (regra de cobertura — US3).
- [X] T008 [US2] Filtrar `excluida = FALSE` no contexto de equipes da sincronização (`api/src/rotas/sincronizacao.ts:260`). Efeito: equipe excluída não é alvo de diffs — linha da planilha com o mesmo nome resolve como `equipe.faltante` (cria nova), sem alterar a equipe excluída.
- [X] T009 [US2] Guard em `POST /api/participacoes` (`api/src/rotas/participacoes.ts:67-114`): antes do INSERT validar `SELECT id FROM equipes WHERE id = ${body.equipeId} AND excluida = FALSE` — ausente → 404 `Equipe não encontrada ou excluída.`

**Nota (sem código)**: selects de equipe no front vêm da API já filtrada — nenhuma tela precisa de filtro próprio (`research.md` R6).

**Checkpoint**: `quickstart.md` Cenários 3-6; `npm run lint` + builds passam.

---

## Phase 5: User Story 3 - Dados históricos preservados (Priority: P2)

**Goal**: Registros históricos da pessoa e da festa (movimentações, presenças, avaliações) permanecem íntegros e visíveis após a exclusão (FR-007, SC-004).

**Independent Test**: `quickstart.md` Cenário 8 — excluir equipe com histórico e conferir nas telas de histórico da pessoa que os registros antigos continuam presentes.

- [X] T010 [US3] Verificar (sem alteração de código, validação regressiva) que as leituras históricas da pessoa **não** ganharam filtro de `excluida`:
  - `presenca/:diaId` e `presenca/pessoa` (`presenca.ts:196-215, 231-252`).
  - Avaliações: joins em `avaliacao.ts:170,224,271`.
  - Montagem: joins sobre participações da pessoa em `montagem.ts:120,273,346`.
  - `GET /pessoas/:id/historico-equipes` (`pessoas.ts:650-736`) e `participacoes_historicas` (`historicoParticipacoes.ts`) — inalterados.
- [X] T011 [US3] Conferir que a desalocação em massa (T004) usa o **nome gravado** da equipe em `pessoa_equipe_historico.equipe_origem_nome` — o `HistoricoEquipesPessoa` continua exibindo "X → (removida)" mesmo com a equipe excluída.

**Checkpoint**: `quickstart.md` Cenário 8 — movimentações, presenças e avaliações antigas exibidas sem quebra; banco sem perdas (SC-004).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Fechamento do delivery.

- [X] T012 Rodar validações finais: `npm run lint` (= `tsc -b --noEmit`), `npm run build` (frontend) e `npm run build` em `api/`.
- [ ] T013 Rodar os 8 cenários de `quickstart.md` (validação manual, com permissões `edicao.equipeExcluir`, `edicao.equipeAlocar`, `presenca.listar`, `equipes.listar`).
- [ ] T014 Commit por grupo lógico em PT-BR no imperativo (ex.: `feat(equipes): exclusao logica com desalocacao em massa`), sem emojis.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: coluna no banco de dev antes de rodar o backend novo — condição para Fases 3 e 4.
- **Foundational (Phase 2)**: T002 deve vir antes de T004 (T004 reutiliza `SEL_EQUIPES`/`equipeDeRow`); T003 independente do backend.
- **US1 (Phase 3)**: depende de Fase 2. O fluxo transacional de T004 é base para US2 (o filtro em GET/:id é quem torna o 404 de link direto consistente).
- **US2 (Phase 4)**: depende de Fase 2 e completa a invisibilidade sobre US1.
- **US3 (Phase 5)**: pode rodar em paralelo à Fase 4 (arquivos/verificações distintos) — valida que os filtros não vazaram para leituras históricas.
- **Polish (Phase 6)**: depende de todas as fases.

### Within Each User Story

- Backend (filtros + transação) antes de validação manual; não há testes-unit a escrever (sem runner).
- US1 → US2 → US3 na ordem de prioridade (P1 antes de P2).

### Parallel Opportunities

- T002 e T003 em paralelo ([P] — arquivos diferentes).
- Fase 4 (US2) e Fase 5 (US3) em paralelo, se houver equipe: T006-T009 (backend, arquivos distintos) independentes entre si.

## Notes

- Não criar novas camadas/dependências (constituição §I/V): a mudança é transversal (condição `excluida = FALSE` em querys existentes).
- Não renomear colunas/tabelas; `excluida` segue o padrão de flags booleanas do sistema.
- A resposta do DELETE permanece `{ ok: true }` — compatibilidade com `removerEquipe` atual.
- ONDE NÃO FILTRAR: ver "Regra de cobertura" no topo — filtrar leituras históricas da pessoa quebra US3.