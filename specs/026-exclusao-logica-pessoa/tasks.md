# Tasks: Exclusao logica de pessoas

**Input**: Design documents from `/specs/026-exclusao-logica-pessoa/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Não há test runner configurado no projeto. A spec não solicita testes automatizados — a validação é feita por `npm run lint` (= `tsc -b --noEmit`), builds (frontend e `api/`) e pelos cenários manuais de `quickstart.md`. Cada fase tem um **Checkpoint** indicando a validação.

**Organization**: Tasks grouped by user story (US1/US2 = P1, US3 = P2).

## Regra de cobertura (boundary) — leia antes de codar

- **Filtra `excluida = FALSE`** onde a pessoa/veiculo é *opção/alvo*: listagens, detalhe, busca, seletores, relatórios, contexto de sincronização, alocação novo registro, ocupação de vaga, montagem, bloqueios, e fluxos públicos (validacao por cracha, presenca/avaliacao publicas). Veja o mapa completo em `research.md` R16.
- **NÃO filtra** leituras *históricas do nome da pessoa* (presencas, avaliacoes, formacoes, check-ins, historico de equipes exibem o nome gravado — a linha nao e apagada, o `JOIN pessoas` resolve): filtrar violaria US3/FR-007.
- **Veiculo orfao**: a regra (`excluida = TRUE` no veiculo sem nenhuma outra pessoa) vale **somente** dentro da exclusao de pessoa (FR-012/FR-013, R6). O desvincular manual (`DELETE /api/pessoas/:id/veiculos/:veiculoId`) permanece como está — não exclui o veiculo.
- **`GET /api/pessoas/proximo-cracha`**: fica **inalterado** (o `MAX(cracha)` já cobre excluidas → cracha permanece reservado, FR-010).
- **Persistência do banco**: nenhuma linha é apagada em tabelas por cascade; o desfazer dos vinculos é explícito e transacional (data-model.md "Transicao de estado").

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Colunas de `excluida` no schema e na migration do delta — condição de banco para o backend novo.

- [X] T001 Adicionar `excluida BOOLEAN NOT NULL DEFAULT FALSE` nas tabelas `pessoas` e `veiculos` em `schema.sql` (colunar `pessoas` na linha ~49 após `ativo`; colunar `veiculos` na linha ~326 após `cracha_carro_impresso`), com comentário no padrão de `equipes.excluida` (`schema.sql:132-134`).
- [X] T002 [P] Criar `scripts/exclusao-logica-pessoa.sql` com a migration idempotente de produção (mesmo padrão de `scripts/adicionar-coluna-excluida-equipes.sql`):
  ```sql
  ALTER TABLE pessoas ADD COLUMN IF NOT EXISTS excluida BOOLEAN NOT NULL DEFAULT FALSE;
  ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS excluida BOOLEAN NOT NULL DEFAULT FALSE;
  ```

**Checkpoint**: Colunas presentes no schema de referência e no banco de desenvolvimento (aplicar o ALTER também no banco local antes de rodar o backend novo).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Contrato do campo `excluida` no retorno da API e nos tipos do front — base para US1/US2.

**⚠️ CRITICAL**: O banco precisa ter as colunas (fase 1) antes do primeiro deploy do backend que as lê.

- [X] T003 Adicionar `excluida: boolean;` na interface `Pessoa` (`src/lib/tipos.ts`, bloco da Pessoa ~linha 204-240) e mapear em `pessoaDeSnap` (`src/lib/pessoas.ts`) com `excluida: (data.excluida as boolean) ?? false` (snapshots antigos não quebram).
- [X] T004 Adicionar `excluida: boolean;` na interface `Veiculo` (`src/lib/tipos.ts`). Não há `veiculoDeSnap` no projeto (front consome `Veiculo` direto da API) — só a interface ganhou o campo.
- [X] T005 [P] Adicionar `excluida: z.boolean()` em `PessoaSchema` e mapear `excluida` em `pessoaDeRow` (`api/src/rotas/pessoas.ts:47-85`) — cobre listagem, detalhe e o novo `exclusao-previa`.
- [X] T006 [P] Adicionar `excluida` no schema/retorno de veiculo em `api/src/rotas/veiculos.ts` (onde existir mapper de linha; garantir que as seleções incluem a coluna).

**Checkpoint**: `npm run lint` e builds passam; front recebe `excluida` nos objetos de pessoa e veiculo; API retorna o campo.

---

## Phase 3: User Story 1 - Excluir pessoa preservando o registro e desfazendo os vinculos (Priority: P1) 🎯 MVP

**Goal**: `DELETE /api/pessoas/:id` deixa de apagar o registro e passa a marcar `excluida = TRUE`, desfazendo em uma transação todas as alocações (edicoes nao encerradas, com registro no historico), vinculos de veiculo, vaga e parentesco — e excluindo logicamente cada veiculo que fica sem nenhuma outra pessoa (FR-001, FR-002, FR-003, FR-008, FR-009, FR-010, FR-011, FR-012, FR-013; SC-001, SC-005, SC-006).

**Independent Test**: `quickstart.md` Cenários 1-3 e 9 — excluir pessoa com/sem vinculos, conferir contagem no aviso (FR-003), `pessoa_equipe_historico`, evento `pessoa.excluiu`, veiculo orfao vs compartilhado, e 403 sem permissão.

- [X] T007 [US1] Criar `GET /api/pessoas/:id/exclusao-previa` em `api/src/rotas/pessoas.ts` (permissao `pessoas.excluir`): conta Alocações em edicoes nao encerradas + `pessoa_veiculo` + `pessoa_vaga` + `parentes` (nos dois sentidos) e os veiculos que ficarao sem nenhuma outra pessoa; pessoa inexistente/excluida → 404 `Pessoa não encontrada.` (contrato: `contracts/exclusao-pessoas-api.md`).
- [X] T008 [US1] Converter o handler de `DELETE /api/pessoas/:id` em exclusão lógica transacional (`sql.begin`, sequência de `data-model.md` "Transicao de estado"): FOR UPDATE com `excluida = FALSE` (404 se ausente); desaloca equipes de edicoes nao encerradas com `pessoa_equipe_historico` (destino NULL, autor = sessão); desfaz `pessoa_veiculo` e marca `veiculos.excluida = TRUE` quando `NOT EXISTS` outra pessoa; `DELETE pessoa_vaga`; `DELETE parentes` (dois sentidos); `UPDATE pessoas SET excluida = TRUE`; `registrarEvento("pessoa.excluiu")` fora da transação com contagem. Response `200 { ok, vinculosDesfeitos, veiculosExcluidos }`.
- [X] T009 [US1] Atualizar `excluirPessoa` (`src/lib/pessoas.ts:206`): `previaExclusaoPessoa` passado ao dialogo via novo `GET /:id/exclusao-previa`; após o `DELETE`, invalidar os caches `["pessoas"]`, `["participacoes"]`, `["equipes"]`, `["veiculos"]`, `["vagas"]`, `["presenca"]`; retorna `{ vinculosDesfeitos, veiculosExcluidos }`.
- [X] T010 [US1] Atualizar o dialogo de confirmacao em `src/pages/PessoaDetalhe.tsx`: exibe contagem de vinculos e de veiculos orfaos (FR-003) e texto sem "definitivamente", "irreversivel" e "removidos permanentemente" (FR-011).

**Checkpoint**: `quickstart.md` Cenários 1-3 e 9; `npm run lint` + builds passam. SC-001/SC-005/SC-006 atendidos.

---

## Phase 4: User Story 2 - Pessoa excluida não aparece em lugar nenhum (Priority: P1)

**Goal**: Toda leitura de pessoa/veiculo como *opção* ignora `excluida = TRUE`, inclusive fluxos públicos; link direto e mutações resultam em "não encontrada" (FR-004, FR-005, FR-006, FR-014; SC-002, SC-003).

**Independent Test**: `quickstart.md` Cenários 3, 5, 6, 7 e 8 — listagens, seletores, sincronizacao, montagem, bloqueios, estacionamento, validacao publica, link direto, mutacoes e permissão.

- [X] T011 [US2] Filtrar `excluida = FALSE` nas leituras de `api/src/rotas/pessoas.ts`: `GET /` nas três variantes, `GET /:id` (excluida → 404). `proximo-cracha` permanece inalterado (MAX reserva o cracha). Leituras historicas (historico-equipes, parentes list) permanecem sem filtro (US3).
- [X] T012 [US2] Guarda `excluida = FALSE` nas mutações de `api/src/rotas/pessoas.ts` — pessoa excluida responde 404 `Pessoa não encontrada.`: `PUT /:id`, `PUT /:id/ativacao`, `POST/DELETE /:id/foto`, `GET/POST /:id/veiculos` (veiculo excluido → 404 `Veiculo nao encontrado.`) e `POST /:id/parentes` (pessoa e parente). Importar-fotos salta excluidas por cracha.
- [X] T013 [P] [US2] Validar pessoa excluida em `POST /api/participacoes` (`api/src/rotas/participacoes.ts`): check `SELECT id FROM pessoas WHERE id = ... AND excluida = FALSE` → 404 `Pessoa não encontrada.` (pessoa excluida não é alocável, FR-004).
- [X] T014 [P] [US2] Filtrar pessoas e veiculos excluidos em `api/src/rotas/veiculos.ts`: `v.excluida = FALSE` na listagem (todas as variantes de escopo) e `GET /:id`; guardas em `PUT /:id`, `GET/POST /:id/pessoas` (veiculo excluido → 404) e `p.excluida = FALSE` na listagem de pessoas do veiculo.
- [X] T015 [P] [US2] Filtrar pessoas excluidas em `api/src/rotas/vagas.ts`: `p.excluida = FALSE` na ocupação/validação (POST) e na listagem de ocupantes e veiculos (`selectVagaCompleto`) — excluidas não aparecem como ocupantes nem são aceitas (FR-004).
- [X] T016 [P] [US2] Filtrar pessoas excluidas em `api/src/rotas/montagem.ts` (candidatos, COUNT) e `GET /match/:pessoaId` → 404 — excluidas não são candidatas nem validam (FR-004).
- [X] T017 [P] [US2] Filtrar pessoas excluidas em `api/src/rotas/bloqueios.ts` (POST solicitação → 404 e aprovação) — excluidas não recebem bloqueio (FR-004/FR-006).
- [X] T018 [P] [US2] Filtrar `excluida = FALSE` no contexto de pessoas da sincronização (`api/src/rotas/sincronizacao.ts`) — pessoa excluida não entra na planilha/diffs (FR-004).
- [X] T019 [P] [US2] Validacao publica por cracha (`api/src/rotas/publico.ts:185`): `AND excluida = FALSE` — pessoa excluida cai na mensagem genérica (FR-005).
- [X] T020 [P] [US2] Filtrar pessoas excluidas nos fluxos publicos: `presencaPublico.ts` (coordenador por cracha e confirmacao em lote) e `avaliacaoPublico.ts` (coordenador por cracha) (FR-005). Filtro adicional em `estacionamentos.ts` (`GET /:id/veiculos`): `v.excluida = FALSE`.

**Nota (sem código)**: seletores de pessoa no front vêm da API já filtrada — nenhuma tela precisa de filtro próprio (`research.md` R1/R7). Cantina publica não referencia pessoa (`pesquisas_cantina` é anônima) — sem mudança (`research.md` R8).

**Checkpoint**: `quickstart.md` Cenários 3-8; `npm run lint` + builds passam.

---

## Phase 5: User Story 3 - Dados históricos preservados (Priority: P2)

**Goal**: Registros históricos da pessoa e dos veiculos permanecem íntegros e visíveis após a exclusão — participações de edicoes encerradas, historico de equipes, presencas, avaliacoes, formacoes, check-ins e historico de estacionamentos dos veiculos (FR-007, FR-015, SC-004).

**Independent Test**: `quickstart.md` Cenário 2 (passo 6) e Cenário 4; comandos psql de historico no `quickstart.md`.

- [X] T021 [US3] Verificado (sem alteração de código): nenhuma leitura histórica do nome ganhou filtro de `excluida` — presencas, avaliacoes, formacoes, check-ins, `pessoa_equipe_historico` e `participacoes_historicas` seguem sem filtro (grep de `excluida` no API confirmou); o único `excluida` em `presenca.ts` é o de equipes (024). Link direto para a página da pessoa excluida → "Pessoa não encontrada" (GET /api/pessoas/:id filtra).
- [X] T022 [US3] Conferido na transação de T008: só participacoes de edicoes `status <> 'encerrada'` são desalocadas (JOIN com `edicoes` no SELECT/`ANY(ids)` no DELETE); `pessoa_equipe_historico` grava origem = id/nome da equipe, destino = NULL/'' e autor = sessão; checkins e `veiculo_estacionamento_historico` não são tocados; placa e cracha permanecem reservados (UNIQUE + `proximo-cracha` inalterado).

**Checkpoint**: `quickstart.md` Cenário 2 (passo 6) e Cenário 4; banco sem perdas (SC-004).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Fechamento do delivery.

- [X] T023 Rodar validações finais: `npm run lint` (= `tsc -b --noEmit`) OK, `npm run build` (frontend) OK e `npm run build` em `api/` OK.
- [ ] T024 Rodar os 9 cenários de `quickstart.md` (validação manual, com permissões `pessoas.excluir`, `pessoas.editar`, `pessoas.ativar`, `pessoas.associar`, `pessoas.listar`). — **pendente de execução manual** (requer banco/API com seed; não executado no ambiente de implementação).
- [ ] T025 Commit por grupo lógico em PT-BR no imperativo (ex.: `feat(pessoas): exclusao logica com desfazer de vinculos em massa`), sem emojis. — **pendente de autorização explícita do usuário** (não commitar sem pedido).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: colunas no banco de dev antes de rodar o backend novo — condição para Fases 2-5.
- **Foundational (Phase 2)**: T003/T004 (tipos do front) e T005/T006 (schema/mapper da API) antes de T007/T008/T011/T012 (mesmos arquivos).
- **US1 (Phase 3)**: depende de Fase 2. T007 (contagem) antes de T008 (transação reusa as mesmas leituras); T009/T010 dependem dos endpoints.
- **US2 (Phase 4)**: depende de Fase 2; completa a invisibilidade sobre US1. T011/T012 no mesmo arquivo (`pessoas.ts`); T013-T020 em arquivos distintos → paralelizáveis.
- **US3 (Phase 5)**: pode rodar em paralelo à Fase 4 (verificações/arquivos distintos) — valida que os filtros não vazaram para leituras históricas.
- **Polish (Phase 6)**: depende de todas as fases.

### Within Each User Story

- Backend (endpoints + filtros + transação) antes da validação manual; não há testes-unit a escrever (sem runner).
- US1 → US2 → US3 na ordem de prioridade (P1 antes de P2).

### Parallel Opportunities

- T002 em paralelo com T001; T005/T006 em paralelo ([P] — arquivos diferentes).
- Fase 4 (US2): T013-T020 em paralelo entre si (arquivos distintos) e em paralelo à Fase 5 (US3), se houver equipe.
- US3 (T021/T022) independe de US2 para iniciar após a Fase 2.

---

## Parallel Example: User Story 2

```bash
# Lançar os filtros de arquivos distintos juntos:
Task: "Validar pessoa excluida em api/src/rotas/participacoes.ts:27"
Task: "Filtrar pessoas e veiculos excluidos em api/src/rotas/veiculos.ts"
Task: "Filtrar pessoas excluidas em api/src/rotas/vagas.ts"
Task: "Filtrar pessoas excluidas em api/src/rotas/montagem.ts"
Task: "Filtrar pessoas excluidas em api/src/rotas/bloqueios.ts"
Task: "Filtrar pessoas excluidas em api/src/rotas/sincronizacao.ts"
Task: "Validacao publica por cracha em api/src/rotas/publico.ts"
Task: "Filtrar pessoas excluidas em api/src/rotas/presencaPublico.ts e avaliacaoPublico.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (colunas `excluida`).
2. Complete Phase 2: Foundational (contrato do campo nos tipos e na API).
3. Complete Phase 3: User Story 1 (endpoints + transação + dialogo com contagem).
4. **STOP and VALIDATE**: Test User Story 1 independentemente (`quickstart.md` Cenários 1-3).
5. Deploy/demo se pronto — sem US2/US3, alguns filtros ainda não cobrem outras telas; o MVP é o fluxo de exclusão em si.

### Incremental Delivery

1. Setup + Foundational → base pronta (coluna + campo `excluida` em tipo/API).
2. + US1 → excluir com vinculos desfeitos e aviso de contagem (MVP).
3. + US2 → invisibilidade total (inclui fluxos públicos e mutações bloqueadas).
4. + US3 → confirmação regressiva de que o historico ficou íntegro.
5. Polish → lint/builds, quickstart completo, commits.

### Parallel Team Strategy

Com mais de um dev:

1. Time conclui Setup + Foundational juntos.
2. Depois da Fase 2:
   - Dev A: Fase 3 (US1) — endpoint de contagem, DELETE transacional e dialogo.
   - Dev B: Fase 4 (US2) — filtros transversais em `participacoes.ts`, `veiculos.ts`, `vagas.ts`, `montagem.ts`, `bloqueios.ts`, `sincronizacao.ts`, `publico.ts`, `presencaPublico.ts`, `avaliacaoPublico.ts` (T013-T020, paralelizáveis).
   - Dev C: Fase 5 (US3) — verificações regressivas de historico.
3. Fases integram independentemente; US1 e US2 são P1 e devem entrar no mesmo deploy.

---

## Notes

- Não criar novas camadas/dependências (constituição §I/V): a mudança é transversal (condição `excluida = FALSE` em querys existentes + transação no DELETE).
- Não renomear colunas/tabelas; `excluida` segue o padrão de flags booleanas do sistema (`pessoas.ativo`, `equipes.excluida`).
- A resposta do DELETE ganha `vinculosDesfeitos`/`veiculosExcluidos` (o front não lê o corpo em `excluirPessoa`, apenas invalida caches — compatibility preservada).
- O desvincular manual de veiculo **não** exclui o veiculo (clarificacao da spec; regra do orfao restrita à exclusao de pessoa).
- ONDE NÃO FILTRAR: ver "Regra de cobertura" no topo — filtrar leituras históricas do nome quebra US3.