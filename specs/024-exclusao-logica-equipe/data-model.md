# Data Model: Exclusao lógica de equipes

**Date**: 2026-08-29

## Visao geral

Nenhuma tabela nova. Uma coluna adicionada em `equipes` e a reutilizacao das tabelas `participacoes`, `pessoa_equipe_historico` e `auditoria` para a desalocacao em massa.

## Entidades

### Equipe (`equipes`)

| Atributo | Tipo SQL | Regras | Saida TS/API |
|---|---|---|---|
| `id` | TEXT PK | Gerado no backend | `id` |
| `edicao_id` | TEXT NOT NULL FK edicoes | - | `edicaoId` |
| `nome` | TEXT NOT NULL | - | `nome` |
| `sigla` | TEXT NOT NULL UNIQUE | - | `sigla` |
| `equipe_pai_id` | TEXT NULL FK equipes ON DELETE SET NULL | Subequipe do organograma | `equipePaiId` |
| `ativo` | BOOLEAN NOT NULL DEFAULT TRUE | Flag de estado (mantida sem alteracao) | `ativo` |
| `excluida` | **BOOLEAN NOT NULL DEFAULT FALSE** *(nova)* | `TRUE` = excluida logicamente | `excluida` |
| `criado_em` / `atualizado_em` | TIMESTAMPTZ | - | `criadoEm` / `atualizadoEm` |

**Migration (producao, idempotente):**

```sql
ALTER TABLE equipes ADD COLUMN IF NOT EXISTS excluida BOOLEAN NOT NULL DEFAULT FALSE;
```

Aplicada no Neon (SQL Editor) junto de `scripts/ajustar-fk-exclusao-equipes.sql`. No repo, `schema.sql` ganha a coluna na definicao da tabela.

### Participacao (`participacoes`)

Sem mudanca estrutural. Na exclusao da equipe, todas as linhas `WHERE equipe_id = {id}` sao removidas **e** cada desalocacao e registrada no historico da pessoa (abaixo). Nenhuma outra tabela referencia `equipes.id` de forma a quebrar: `presencas`, `avaliacoes`, `mensagens` referenciam participacao/pessoa, nao equipe.

### Movimentacao (`pessoa_equipe_historico`)

Sem mudanca estrutural. Recebe uma linha por pessoa desalocada, com o **mesmo idempotente** do fluxo de desalocar individual:

```
pessoa_id, edicao_id,
equipe_origem_id   = {id da equipe excluida}, equipe_origem_nome = {nome},
equipe_destino_id  = NULL,  equipe_destino_nome = '',
funcao, autor = sessao.uid, autor_nome = sessao.nome
```

Sem equipe destino (nome vazio) identifica a remocao — padrao ja usado em `participacoes.ts:224-236`.

### Auditoria

Reutiliza `auditoria` existente:

| Acao | Evento | Entidade | Detalhe |
|---|---|---|---|
| Exclusao em massa | `equipe.removeu` | `equipes/{id}` | `{nome} ({contagem} pessoas desalocadas)` |
| Desalocacao individual (ja existente) | `participacao.desalocou` | `participacoes/{id}` | inalterado |

## Transicao de estado

```
equipe.ativa ──DELETE (permissao edicao.equipeExcluir)──> equipe.excluida (estado final)
```

- **Terminal**: sem restauracao (fora de escopo da spec, FR-011 nao existe).
- **Sequencia transacional** (`sql.begin`), uma equipe por chamada:
  1. `SELECT ... FROM equipes WHERE id = {id} AND excluida = FALSE` (404 se ausente/excluida).
  2. `SELECT part.id, part.pessoa_id, part.funcao FROM participacoes part WHERE part.equipe_id = {id}` (0..n linhas).
  3. `DELETE FROM participacoes WHERE equipe_id = {id}`.
  4. Loop: `INSERT INTO pessoa_equipe_historico (...)` por pessoa desalocada.
  5. `UPDATE equipes SET equipe_pai_id = NULL WHERE equipe_pai_id = {id}` (desaninha subequipes).
  6. `UPDATE equipes SET excluida = TRUE, atualizado_em = NOW() WHERE id = {id}`.
  7. `registrarEvento(..., "equipe.removeu", ...)`.

**Mudanca vs. hoje**: antes o `DELETE FROM equipes` dependia do `ON DELETE CASCADE` do banco (quebrado em producao). Agora nao ha remocao fisica e o detach de subequipes e explicito.

## Validacoes / invariantes

- Nao e possivel alocar nova pessoa a uma equipe excluida (`POST /api/participacoes` valida `excluida = FALSE` — R7).
- Subequipes de uma equipe excluida ficam ativas com `equipe_pai_id = NULL`.
- Uma equipe excluida nunca volta a aparecer (nenhuma rota para reverter o flag).
- Equipes excluidas ficam de fora de: listagens, detalhe (404), relatorio de equipistas, grade/relatorios de presenca, contexto e diffs de sincronizacao, lookups de montagem e avaliacao, e selecao de equipe superior no organograma.

## Query de exclusao (referencia)

```sql
-- Estado final de uma equipe excluida
SELECT id, nome, sigla, edicao_id, ativo, excluida
FROM equipes WHERE excluida = TRUE;
-- == 1 registro, excluida = TRUE
```