# Research: Exclusao lógica de equipes

**Date**: 2026-08-29

## R1: Onde filtrar equipes excluídas — API ou client?

**Decision**: Filtrar na API, na fonte: adicionar `e.excluida = FALSE` (ou `WHERE excluida = FALSE`) em TODAS as consultas que leem `equipes`.

**Rationale**: A spec exige invisibilidade total (FR-004/FR-005), inclusive em telas que **não** consomem `useEquipes` — a grade de presença usa `GET /api/presenca/resumo-equipes` (`presenca.ts:287`), que faz `FROM equipes` direto. Filtrar na API cobre todas as telas de uma vez, incluindo relatórios servidos por endpoints próprios, e evita esquecer pontos no front. É o ponto único de verdade, barato e simples (constituição §I).

**Alternatives considered**:
- Filtro client-side em cada tela: rejeitado — não cobre `resumo-equipes` e deixaria pontos vazando mesmo se a API não filtrada.
- Filtro só em `useEquipes`/`useTodasEquipes`: insuficiente — relatório de equipistas e grade de presença buscam equipes via endpoints dedicados.

## R2: Como marcar a equipe excluída no banco

**Decision**: Coluna `excluida BOOLEAN NOT NULL DEFAULT FALSE` na tabela `equipes`, adicionada por migration idempotente (`ALTER TABLE equipes ADD COLUMN IF NOT EXISTS exclusiva...` → `ADD COLUMN IF NOT EXISTS excluida BOOLEAN NOT NULL DEFAULT FALSE`).

**Rationale**: Segue o padrão já existente de flags booleanas no sistema (`pessoas.ativo`, `permissoes.ativo`, `parametros.ativo`) e é o mínimo necessário. Não há consumo de "quando" a equipe foi excluída fora da auditoria (`auditoria` já registra `equipe.removeu` com responsável/data).

**Alternatives considered**:
- `excluida_em TIMESTAMPTZ`: daria o momento da exclusão, mas não há tela consumindo isso; auditoria já cobre. Rejeitado por minimalismo (MVP estrito).
- Enum de status (`ativa`/`excluida`): overkill para um estado binário; não há terceiro estado previsto. Rejeitado.

## R3: Comportamento do DELETE /api/equipes/:id (soft delete)

**Decision**: Transformar o `DELETE FROM equipes` em uma transação (`sql.begin`) que, para a equipe alvo (ativo e não excluída):

1. Lê as alocações da equipe (id, edição, pessoa, função, nome da equipe).
2. Remove as participações (`DELETE FROM participacoes WHERE equipe_id = ...`).
3. Para cada pessoa, registra a desalocação em `pessoa_equipe_historico` (origem = equipe, destino = NULL, autor = sessão) — **mesmo padrão** já usado em `deleteParticipacaoRoute` (`participacoes.ts:224-236`) e na inativação de pessoa (`pessoas.ts:428-459`).
4. Desatrela subequipes do organograma (`UPDATE equipes SET equipe_pai_id = NULL WHERE equipe_pai_id = id`).
5. Marca `excluida = TRUE`.
6. `registrarEvento(sessao, "equipe.removeu", ...)`.

**Rationale**: A spec (US1) exige desalocar todas as pessoas de uma vez com aviso prévio de contagem, e a assunção A3 da spec exige que a desalocação em massa fique registrada no histórico da pessoa. Registrar no histórico preserva a trilha da pessoa (a equipe excluída continua nomeada nos registros antigos). Desatrelar subequipes implementa FR-006/spec (subequipes permanecem ativas sem superior), que o `ON DELETE SET NULL` faria num hard delete — agora precisa ser feito explicitamente porque a linha não é removida.

**Alternatives considered**:
- Manter hard delete e só consertar a FK: rejeitado — a spec pede explicitamente exclusão lógica; e consertar apenas a FK no banco não impediria o erro em bancos com drift.
- Soft delete sem registrar histórico (só `DELETE FROM participacoes`): rejeitado — viola a assunção da spec sobre preservar a movimentação da pessoa.

## R4: Semântica de leitura — listagem, detalhe, relatórios e cópia

**Decision**:
- `GET /api/equipes` (todas as variantes: com edicaoId, escopo CRD, sem filtro) e `GET /api/equipes/relatorio-equipistas`: adicionar `AND e.excluida = FALSE`.
- `GET /api/equipes/:id`: retornar 404 "Equipe não encontrada." quando a equipe for inexistente **ou** excluída (FR-005 — link direto não resolve).
- `POST /api/equipes/copiar`: origem ignora excluídas.
- Helpers do organograma (`erroPaiInvalido`, `criaCiclo`) e o lookup do pai: ignoram equipes excluídas (não podem ser selecionadas como superior).

**Rationale**: Filtro na fonte garante invisibilidade em tudo que deriva da listagem (todas as telas do front via `useEquipes`/`useTodasEquipes`). Para o detalhe, a spec define que link direto resulta em "não encontrada" — tratar excluída junto com inexistente é a forma mais simples e consistente.

**Alternatives considered**:
- Retornar 410 Gone para excluída: desnecessário — o front só precisa de "não encontrada"; 404 é o código já usado pela rota.

## R5: Cobertura transversal — endpoints que juntam/leem equipes fora de /api/equipes

**Decision**: Filtrar `excluida = FALSE` onde a equipe é **opção/alvo**, e **não filtrar** onde o registro é histórico da pessoa:

- Aplicar o filtro:
  - `presenca.ts` — `GET /api/presenca/resumo-equipes` (`FROM equipes eq`, linha 287): grade do dia some a coluna/linha da equipe excluída.
  - `sincronizacao.ts` — contexto de equipes da edição (linha 260) e, por consequência, os diffs: equipe excluída não é alvo de `equipe.nome`/`participacao.equipe`; linha da planilha com o mesmo nome resolve como `equipe.faltante`.
  - `participacoes.ts` — `POST` (alocar): guarda contra equipe excluída (ver R7).
- **Não** filtrar (leitura histórica da pessoa, exibe o nome gravado — FR-007/US3):
  - `presenca.ts` `GET /:diaId` e `GET /pessoa` (joins de nome nas presenças da pessoa).
  - `avaliacao.ts` joins de nome (`avaliacoes` referenciam a equipe de origem da avaliação).
  - `montagem.ts` joins sobre participações da pessoa (histórico de match).

**Rationale**: A regra de invisibilidade (FR-004) vale para onde o usuário *navega/escolhe* equipes (listagens, seletores, relatórios por equipe, organograma). Registros da pessoa (presenças, avaliações, movimentações) devem continuar exibidos com o nome gravado — filtrá-los viola US3 ("registros antigos continuam presentes e coerentes") e SC-004 (0 perdas). A distinção evita ambos os erros de uma vez.

**Alternatives considered**: Filtrar também as leituras históricas da pessoa: rejeitado — faria presenças/avaliações de equipes excluídas sumirem das telas de histórico da pessoa, contrariando US3 e o teste independente da story.

## R6: Frontend — tipo Equipe e links históricos

**Decision**:
- Interface `Equipe` (`src/lib/tipos.ts`) ganha `excluida: boolean` (mapper `equipeDeSnap` inclui o campo) — sem necessidade de filtro em tela, pois a API já filtra.
- `removerEquipe` (`src/lib/equipes.ts:112`) continua chamando `DELETE /api/equipes/:id`, agora com comportamento soft — nenhuma mudança de contrato no front para a ação; o aviso de confirmação em `EdicaoDetalhe.tsx:168` (contagem de pessoas) permanece.
- Links históricos que apontam para `/edicoes/.../equipes/{id}` de equipes excluídas (HistóricoPessoa, HistóricoEquipesPessoa, GradePresenca) resolverão via `useEquipe(id)` → 404 → tela "não encontrada" (`EquipeDetalhe`).

**Rationale**: Como o front consome a API filtrada, nenhuma tela precisa de lógica própria de exclusão — menor superfície de mudança e menor risco de ponto vazando.

**Alternatives considered**: Filtrar também no front (`equipes.filter(e => !e.excluida)`): redundante e fácil de esquecer em telas novas; rejeitado.

## R7: Alocação e movimentação para equipe excluída

**Decision**: `POST /api/participacoes` (alocar) passa a validar que a equipe existe e não está excluída (404 "Equipe não encontrada ou excluída."), antes do INSERT. O `PUT /api/participacoes/:id` (mover) mantém o fluxo atual (o front só oferece equipes ativas no seletor, e a origem já é uma alocação viva).

**Rationale**: Robustez da API: mesmo que um cliente antigo envie o id de uma equipe excluída, a alocação é bloqueada. Não há tela atual que permita isso, mas o guarda é barato e evita estado inconsistente.

**Alternatives considered**: Confiar apenas no front (seletores já vêm filtrados): suficiente para o fluxo normal, mas deixa a API aceitar equipe excluída; rejeitado por segurança de tipos e consistência.