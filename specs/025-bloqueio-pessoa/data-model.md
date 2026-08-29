# Modelo de Dados — Bloqueio de Pessoas (025)

**Fase**: Phase 1 (/speckit.plan) | **Data**: 2026-08-29 | **Plan**: [plan.md](plan.md)

## Visao geral

Duas mudancas no schema (PostgreSQL/Neon, idempotentes):

1. Tabela nova **`bloqueios`** — rastro append-only de cada solicitacao de bloqueio/desbloqueio.
2. Coluna nova **`pessoas.bloqueada`** — estado corrente derivado de forma atomica no ato da 2a aprovacao.

Nada e sobrescrito/podado no historico: a linha criada na solicitacao nunca e alterada em seu conteudo (motivo, tipo, 1o aprovador, autor), apenas os campos de conclusao (`status`, `aprovador2_uid/nome`, `concluido_em`) sao preenchidos uma unica vez.

## DDL (delta)

> O conteudo abaixo entra em `schema.sql` (bloco `025-bloqueio-pessoa`, idempotente) e, na forma de script standalone, em `scripts/adicionar-bloqueios.sql` para o banco de producao (Neon Console -> SQL Editor).

```sql
-- ============================================================================
-- 025-bloqueio-pessoa
-- ============================================================================

-- Estado corrente: pessoa esta bloqueada ou nao. A derivacao e atomica (no ato
-- da 2a aprovacao) e e o flag consumido por listagens, montagem, alocacao e UI.
ALTER TABLE pessoas ADD COLUMN IF NOT EXISTS bloqueada BOOLEAN NOT NULL DEFAULT FALSE;

-- Solicitacoes de bloqueio/desbloqueio (append-only). Uma linha por pedido:
-- nasce 'pendente' com o 1o aprovador (= quem solicitou) e so conclui (aprovador2
-- preenchido, status='aprovado') com a 2a aprovacao de usuario distinto.
CREATE TABLE IF NOT EXISTS bloqueios (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  pessoa_id        TEXT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  tipo             TEXT NOT NULL CHECK (tipo IN ('bloqueio', 'desbloqueio')),
  status           TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado')),
  motivo           TEXT NOT NULL CHECK (char_length(btrim(motivo)) >= 100),
  aprovador1_uid   TEXT NOT NULL,
  aprovador1_nome  TEXT NOT NULL,
  aprovador2_uid   TEXT,
  aprovador2_nome  TEXT,
  criado_por_uid   TEXT NOT NULL,
  criado_por_nome  TEXT NOT NULL,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
  concluido_em     TIMESTAMPTZ,
  -- 2o aprovador nunca pode ser o mesmo usuario do 1o.
  CHECK (aprovador2_uid IS NULL OR aprovador1_uid <> aprovador2_uid)
);

-- Um pedido pendente por pessoa por vez (FR-015/R-005).
CREATE UNIQUE INDEX IF NOT EXISTS uq_bloqueios_pendente_pessoa
  ON bloqueios(pessoa_id) WHERE status = 'pendente';
CREATE INDEX IF NOT EXISTS idx_bloqueios_pessoa_criado
  ON bloqueios(pessoa_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_bloqueios_status
  ON bloqueios(status);

-- Permissao dedicada para a area de bloqueios (PBAC). Concedida ao ORG;
-- o ADM e superuser e sempre possui todas as permissoes ativas.
INSERT INTO permissoes (codigo, rotulo, descricao) VALUES
  ('pessoas.bloqueio', 'Pessoas: bloquear/desbloquear',
   'Solicitar e aprovar bloqueios e desbloqueios de pessoas e acessar a tela Bloqueios.')
ON CONFLICT (codigo) DO NOTHING;

UPDATE perfis SET
  permissoes = permissoes || ARRAY['pessoas.bloqueio']
WHERE sigla = 'ORG'
  AND NOT 'pessoas.bloqueio' = ANY(permissoes);

-- Formaliza no catalogo a permissao 'exclusivoPessoal' (hoje apenas referenciada
-- em codigo no box "Exclusivo Pessoal" do detalhe da Pessoa). Concedida ao ORG.
INSERT INTO permissoes (codigo, rotulo, descricao) VALUES
  ('exclusivoPessoal', 'Pessoal: area exclusiva',
   'Ver o box Exclusivo Pessoal no detalhe da Pessoa, incluindo a aba de historico de bloqueios.')
ON CONFLICT (codigo) DO NOTHING;

UPDATE perfis SET
  permissoes = permissoes || ARRAY['exclusivoPessoal']
WHERE sigla = 'ORG'
  AND NOT 'exclusivoPessoal' = ANY(permissoes);
```

> O mecanismo autoritativo de "1 pendente por pessoa" e o indice parcial
> `uq_bloqueios_pendente_pessoa`; a criacao de um segundo pendente gera violacao
> de unicidade (23505) tratada como 409.

## Entidades

### Bloqueio (linha em `bloqueios`)

| Campo | Tipo | Obrigatorio | Descricao |
|---|---|---|---|
| `id` | TEXT (uuid) | sim | Chave primaria, `gen_random_uuid()` |
| `pessoa_id` | TEXT (FK `pessoas`) | sim | Pessoa alvo. `ON DELETE CASCADE` |
| `tipo` | TEXT | sim | `'bloqueio'` | `'desbloqueio'` |
| `status` | TEXT | sim | `'pendente'` (default) | `'aprovado'` |
| `motivo` | TEXT | sim | Justificativa. `char_length(btrim(motivo)) >= 100` |
| `aprovador1_uid` | TEXT | sim | Usuario que solicitou (= 1a aprovacao) |
| `aprovador1_nome` | TEXT | sim | Nome do solicitante (snapshot) |
| `aprovador2_uid` | TEXT | nao | 2a aprovacao (preenchido so na conclusao) |
| `aprovador2_nome` | TEXT | nao | Nome do 2o aprovador (snapshot) |
| `criado_por_uid` | TEXT | sim | Usuario que criou o pedido (espelha aprovador1) |
| `criado_por_nome` | TEXT | sim | Nome do criador (snapshot) |
| `criado_em` | TIMESTAMPTZ | sim | Criacao (`now()`) |
| `concluido_em` | TIMESTAMPTZ | nao | Preenchido na 2a aprovacao |

Restricoes explicitas da tabela:
- `motivo` valido com conteudo real (btrim) e >= 100 caracteres — espelha FR-004/FR-011.
- `aprovador2_uid <> aprovador1_uid` (FR-009) — a segunda aprovacao nunca e do mesmo usuario.
- Indice parcial `uq_bloqueios_pendente_pessoa`: maximo 1 pedido `pendente` por pessoa (FR-015).
- Indice `(pessoa_id, criado_em DESC)`: leitura do historico por pessoa e do estado ativo.

### Pessoa (coluna nova)

| Campo | Tipo | Default | Descricao |
|---|---|---|---|
| `bloqueada` | BOOLEAN | `FALSE` | Estado corrente (FR-017/FR-018). Derivada de forma atomica na 2a aprovacao |

`bloqueada` e independente de `ativo` (FR-017: "o estado de bloqueio e independente dos dados do cadastro") e nao desaloca ninguem (FR-019).

## Transicoes de estado

### Bloqueio (normal)

```text
[livre]
   │  POST /api/bloqueios {tipo:'bloqueio', motivo>=100}   (requer: nao bloqueada, sem pendente)
   ▼
[pendente]  aprovador1 = usuario atual; pessoas.bloqueada = FALSE (nao afeta selecao)
   │  POST /api/bloqueios/:id/aprovar  (usuario distinto do aprovador1)
   ▼
[aprovado]  aprovador2 preenchido; pessoas.bloqueada = TRUE (bloqueio ativo)
```

### Desbloqueio (normal)

```text
[bloqueada]
   │  POST /api/bloqueios {tipo:'desbloqueio', motivo>=100}   (requer: bloqueada, sem pendente)
   ▼
[pendente]  aprovador1 = usuario atual; pessoas.bloqueada = TRUE (permanece bloqueada, FR-011)
   │  POST /api/bloqueios/:id/aprovar  (usuario distinto do aprovador1)
   ▼
[aprovado]  aprovador2 preenchido; pessoas.bloqueada = FALSE (pessoa livre)
```

### Regras de exclusao

- Nao criar `bloqueio` para quem ja esta `bloqueada`; nao criar `desbloqueio` para quem nao esta (FR-015; validado sob `FOR UPDATE` na linha da pessoa).
- Nao criar novo pedido enquanto a pessoa tem um pendente (indice parcial → 409).
- Nao aprovar o proprio pedido (CHECK + `WHERE aprovador1_uid <> $me`).
- Nao aprovar pedido ja concluido (UPDATE condicional → "ja aprovado").
- Aprovacoes concorrentes: apenas a primeira vence (FR-016).

## Regras de validacao (contrato)

- `motivo`: string, `btrim` com >= 100 caracteres; invalido → `400`. O front conta caracteres visiveis e desabilita o envio abaixo do minimo.
- `tipo`: somente `'bloqueio'` | `'desbloqueio'`; `tipo` invalido → `400`.
- `pessoa_id`: deve existir em `pessoas` → `404` se nao.

## Referencias de leitura

- Tela `Bloqueios`: `GET /api/bloqueios` (com `?status=` e c/ pessoa join).
- Aba de historico (box Exclusivo Pessoal): `GET /api/bloqueios?pessoaId=`.
- Banner, paginas de bloqueio/desbloqueio e listagens: `GET /api/pessoas` / `GET /api/pessoas/:id` enriquecidos (ver [contracts/bloqueios-api.md](contracts/bloqueios-api.md)).