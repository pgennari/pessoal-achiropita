# Data Model: Exclusao lógica de pessoas

**Date**: 2026-08-29

## Visao geral

Nenhuma tabela nova. Duas colunas adicionadas: `pessoas.excluida` e `veiculos.excluida`. O fluxo de exclusao reutiliza as tabelas `participacoes`, `pessoa_equipe_historico`, `pessoa_veiculo`, `pessoa_vaga`, `parentes` e `auditoria`. Nenhuma linha historica e apagada: as tabelas que hoje dependem de `ON DELETE CASCADE` deixam de ser atingidas porque nao ha mais `DELETE FROM pessoas`.

## Entidades

### Pessoa (`pessoas`)

| Atributo | Tipo SQL | Regras | Saida TS/API |
|---|---|---|---|
| `id` | TEXT PK | Gerado no backend | `id` |
| `cracha` | INTEGER NOT NULL UNIQUE | Reservado mesmo apos exclusao (FR-010) | `cracha` |
| `nome` | TEXT NOT NULL | - | `nome` |
| `ativo` | BOOLEAN NOT NULL DEFAULT TRUE | Estado de inativacao (separado, R14) | `ativo` |
| `excluida` | **BOOLEAN NOT NULL DEFAULT FALSE** *(nova)* | `TRUE` = excluida logicamente | `excluida` |
| `foto_url` | TEXT NULL | Preservada na exclusao (FR-001, R13) | `fotoUrl` |
| ... demais colunas | inalteradas | - | - |
| `criado_em` / `atualizado_em` | TIMESTAMPTZ | - | `criadoEm` / `atualizadoEm` |

### Veiculo (`veiculos`)

| Atributo | Tipo SQL | Regras | Saida TS/API |
|---|---|---|---|
| `id` | TEXT PK | Gerado no backend | `id` |
| `placa` | TEXT NOT NULL UNIQUE | Reservada mesmo apos exclusao (FR-015) | `placa` |
| `excluida` | **BOOLEAN NOT NULL DEFAULT FALSE** *(nova)* | `TRUE` = excluido logicamente (so via exclusao de pessoa, R6) | `excluida` |
| ... demais colunas | inalteradas | - | - |
| `criado_em` / `atualizado_em` | TIMESTAMPTZ | - | `criadoEm` / `atualizadoEm` |

**Migration (producao, idempotente):**

```sql
-- 026-exclusao-logica-pessoa
ALTER TABLE pessoas ADD COLUMN IF NOT EXISTS excluida BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS excluida BOOLEAN NOT NULL DEFAULT FALSE;
```

Aplicada no Neon (SQL Editor). No repo, `schema.sql` ganha as colunas na definicao das tabelas, com comentario seguindo o padrao de `equipes.excluida` (linhas 132-134).

### Participacao (`participacoes`)

Sem mudanca estrutural. Na exclusao da pessoa, somente as participacoes de edicoes **nao encerradas** sao removidas (R5) e cada desalocacao e registrada no historico da pessoa — mesmo padrao de `equipes.ts:336-401` e da desalocacao individual (`participacoes.ts:224-236`). Participacoes de edicoes encerradas ficam intactas (historico, FR-007).

### Movimentacao (`pessoa_equipe_historico`)

Sem mudanca estrutural. Recebe uma linha por participacao desalocada na exclusao:

```
pessoa_id, edicao_id,
equipe_origem_id   = {id da equipe}, equipe_origem_nome = {nome},
equipe_destino_id  = NULL,  equipe_destino_nome = '',
funcao, autor = sessao.uid, autor_nome = sessao.nome
```

Sem equipe destino (nome vazio) identifica a remocao — a mesma convencao de 024 e do fluxo individual.

### Vinculo de veiculo (`pessoa_veiculo`)

Sem mudanca estrutural. Na exclusao, todas as linhas `WHERE pessoa_id = {id}` sao removidas. Apos isso, veiculos que nao tenham nenhuma outra linha em `pessoa_veiculo` sao marcados com `excluida = TRUE` (FR-012); os compartilhados permanecem ativos (FR-013). O desvincular manual continua sem marcar o veiculo (R6).

### Vaga de estacionamento (`pessoa_vaga`)

Sem mudanca estrutural. Na exclusao, `DELETE FROM pessoa_vaga WHERE pessoa_id = {id}` libera a vaga (edge case). `vaga_estacionamento_historico` e `veiculo_estacionamento_historico` permanecem intactos (historico do vinculo da vaga/veiculo, FR-007/FR-015).

### Parentesco (`parentes`)

Sem mudanca estrutural. Na exclusao, `DELETE FROM parentes WHERE pessoa_id = {id} OR parente_id = {id}` remove os lacos nos dois sentidos sem apagar cadastros (FR-002, edge case).

### Auditoria

Reutiliza `auditoria` existente:

| Acao | Evento | Entidade | Detalhe |
|---|---|---|---|
| Exclusao da pessoa | `pessoa.excluiu` | `pessoas/{id}` | `{nome} (#{cracha}) — {N} vinculo(s) desfeito(s), {M} veiculo(s) excluido(s) logicamente` (FR-008, sem redacao de apagamento permanente) |
| Desalocacao em massa (dentro da mesma exclusao) | `pessoa.excluiu` (um evento so) | `pessoas/{id}` | contagem acima; as desalocacoes individuais ficam em `pessoa_equipe_historico` |

Sem novo codigo de evento; o evento `pessoa.excluiu` ja existe.

## Transicao de estado

```
pessoa.ativa ──DELETE (permissao pessoas.excluir)──> pessoa.excluida (estado final)
veiculo.ativo ─(orfao apos exclusao da ultima pessoa)──> veiculo.excluida (estado final)
```

- **Terminal**: sem restauracao (fora de escopo da spec).
- **Sequencia transacional** (`sql.begin`), uma pessoa por chamada:
  1. `SELECT id, nome, cracha FROM pessoas WHERE id = {id} AND excluida = FALSE FOR UPDATE` (404 se ausente/excluida — R10).
  2. `SELECT part.id, part.equipe_id, eq.nome, part.edicao_id, part.funcao FROM participacoes part JOIN edicoes e ON e.id = part.edicao_id AND e.status <> 'encerrada' JOIN equipes eq ON eq.id = part.equipe_id WHERE part.pessoa_id = {id}` (0..n linhas).
  3. `DELETE FROM participacoes WHERE pessoa_id = {id} AND edicao_id IN ({edicoes nao encerradas})`.
  4. Loop: `INSERT INTO pessoa_equipe_historico (...)` por participacao desalocada (origem = equipe, destino = NULL).
  5. `SELECT veiculo_id FROM pessoa_veiculo WHERE pessoa_id = {id}`; `DELETE FROM pessoa_veiculo WHERE pessoa_id = {id}`.
  6. `UPDATE veiculos SET excluida = TRUE, atualizado_em = NOW() WHERE id = ANY({ids}) AND excluida = FALSE AND NOT EXISTS (SELECT 1 FROM pessoa_veiculo WHERE veiculo_id = veiculos.id)`.
  7. `DELETE FROM pessoa_vaga WHERE pessoa_id = {id}`.
  8. `DELETE FROM parentes WHERE pessoa_id = {id} OR parente_id = {id}`.
  9. `UPDATE pessoas SET excluida = TRUE, atualizado_em = NOW() WHERE id = {id}`.
  10. `registrarEvento(..., "pessoa.excluiu", ...)`.

**Mudanca vs. hoje**: antes, `DELETE FROM pessoas` apagava a linha e dependia dos 13 `ON DELETE CASCADE`/`SET NULL`. Agora nao ha remocao fisica; o desfazer dos vinculos e explicito e atomico, e historico, avaliacoes, presencas, formacoes, check-ins e bloqueios seguem intactos por construcao.

## Validacoes / invariantes

- Nao e possivel alocar uma pessoa excluida em equipe, por ceouso, vincular-lhe veiculo, vaga ou parente (todas as mutacoes guardam `excluida = FALSE` → 404).
- Uma pessoa excluida nunca volta a aparecer (nenhuma rota reverte o flag).
- Pessoas excluidas ficam de fora de: listagens, detalhe (404), busca global, painel/relatorios, contexto da edicao (sincronizacao), montagem, bloqueios, vagas, veiculos, seletores, validacao publica por cracha e presenca/avaliacao publicas.
- Veiculos excluidos ficam de fora de: listagens, detalhe (404), seletores de vinculo e fluxos de estacionamento.
- `pessoas.excluida` e independente de `pessoas.ativo` (R14); fluxos publicos exigem `excluida = FALSE` **e** `ativo = true`.
- O cracha da pessoa excluida e a placa do veiculo excluido permanecem UNIQUE e nunca reutilizados (FR-010/FR-015).
- A regra de veiculo orfao se aplica somente a exclusao de pessoa; o desvincular manual nao exclui o veiculo (R6).
- Veiculos excluidos logicamente com historico de estacionamentos sao excluidos normalmente (a retencao do fluxo fisico nao se aplica).

```sql
-- Estado final de uma pessoa excluida
SELECT id, nome, cracha, ativo, excluida
FROM pessoas WHERE excluida = TRUE;
-- == 1 registro, excluida = TRUE

-- Veiculos excluidos junto (sem nenhuma pessoa vinculada restante)
SELECT v.id, v.placa FROM veiculos v
WHERE v.excluida = TRUE
  AND NOT EXISTS (SELECT 1 FROM pessoa_veiculo pv WHERE pv.veiculo_id = v.id);

-- Desalocacoes registradas na exclusao (destino vazio)
SELECT pessoa_id, equipe_origem_nome, equipe_destino_nome
FROM pessoa_equipe_historico
WHERE pessoa_id = {id} AND equipe_destino_id IS NULL
ORDER BY criado_em DESC;
```