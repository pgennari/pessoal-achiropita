# Data Model: Check-in nos Estacionamentos

## Entidades

### Check-in (nova)

| campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| id | TEXT (UUID) | Sim | Chave primaria |
| timestamp | TIMESTAMPTZ | Sim | Data/hora do check-in |
| data | DATE | Sim | Data do check-in (para unicidade por dia) |
| pessoa_id | TEXT (UUID) | Sim | FK para pessoas(id) |
| pessoa_nome | TEXT | Sim | Nome da pessoa (denormalizado) |
| carro_id | TEXT | Sim | ID do carro dentro da pessoa |
| placa | TEXT | Sim | Placa do carro (denormalizado) |
| modelo | TEXT | Sim | Modelo do carro (denormalizado) |
| cor | TEXT | Sim | Cor do carro (denormalizado) |
| estacionamento_id | TEXT (UUID) | Sim | FK para estacionamentos(id) |
| estacionamento_nome | TEXT | Sim | Nome do estacionamento (denormalizado) |

**Constraints**:
- `UNIQUE(estacionamento_id, carro_id, data)` — check-in unico por carro no estacionamento por dia
- `REFERENCES pessoas(id) ON DELETE SET NULL` — se pessoa for excluida, mantem registro
- `REFERENCES estacionamentos(id) ON DELETE SET NULL` — se estacionamento for excluido, mantem registro

### Estacionamento (atualizada)

| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| id | TEXT (UUID) | Sim | Chave primaria |
| nome | TEXT | Sim | Nome do estacionamento |
| token_checkin | TEXT | Sim | Token unico para link publico (24 chars hex) |
| ... | ... | ... | (campos existentes mantidos) |

**Mudanca**: Adicionar coluna `token_checkin` com constraint UNIQUE.

## Relacionamentos

```
checkins.pessoa_id → pessoas.id (N:1, ON DELETE SET NULL)
checkins.estacionamento_id → estacionamentos.id (N:1, ON DELETE SET NULL)
estacionamentos.token_checkin → UNIQUE
```

- Um estacionamento pode ter N check-ins
- Um carro pode ter no maximo 1 check-in por estacionamento (UNIQUE constraint)
- Uma pessoa pode ter multiplos check-ins (em estacionamentos diferentes)

## Regras de Negocio

1. **Unicidade por carro**: Antes de inserir check-in, verificar se ja existe registro com mesmo `(estacionamento_id, carro_id)`. Se existir, bloquear.
2. **Denormalizacao**: `pessoa_nome`, `placa`, `modelo`, `cor`, `estacionamento_nome` sao gravados no momento do check-in para preservar dados mesmo que a pessoa ou estacionamento sejam alterados/excluidos depois.
3. **Exclusao de estacionamento**: Check-ins sao mantidos (estacionamento_id fica NULL).
4. **Exclusao de pessoa**: Check-ins sao mantidos (pessoa_id fica NULL).

## Migration

```sql
-- Adicionar coluna token_checkin na tabela estacionamentos
ALTER TABLE estacionamentos 
ADD COLUMN IF NOT EXISTS token_checkin TEXT;

-- Gerar tokens para estacionamentos existentes
UPDATE estacionamentos 
SET token_checkin = REPLACE(gen_random_uuid()::text, '-', '')
WHERE token_checkin IS NULL;

-- Constraint UNIQUE no token_checkin
ALTER TABLE estacionamentos 
ADD CONSTRAINT uq_estacionamentos_token_checkin UNIQUE (token_checkin);

-- Tornar token_checkin NOT NULL apos gerar para todos
ALTER TABLE estacionamentos 
ALTER COLUMN token_checkin SET NOT NULL;

-- Criar tabela de check-ins
CREATE TABLE IF NOT EXISTS checkins (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  timestamp           TIMESTAMPTZ NOT NULL DEFAULT now(),
  data                DATE NOT NULL DEFAULT CURRENT_DATE,
  pessoa_id           TEXT REFERENCES pessoas(id) ON DELETE SET NULL,
  pessoa_nome         TEXT NOT NULL,
  carro_id            TEXT NOT NULL,
  placa               TEXT NOT NULL,
  modelo              TEXT NOT NULL,
  cor                 TEXT NOT NULL,
  estacionamento_id   TEXT REFERENCES estacionamentos(id) ON DELETE SET NULL,
  estacionamento_nome TEXT NOT NULL
);

-- Unicidade por carro no estacionamento por dia
DROP INDEX IF EXISTS uq_checkins_estacionamento_carro;
CREATE UNIQUE INDEX IF NOT EXISTS uq_checkins_estacionamento_carro_dia
ON checkins(estacionamento_id, carro_id, data);

-- Indices para consultas
CREATE INDEX IF NOT EXISTS idx_checkins_estacionamento 
ON checkins(estacionamento_id);

CREATE INDEX IF NOT EXISTS idx_checkins_timestamp 
ON checkins(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_checkins_pessoa 
ON checkins(pessoa_id);
```

## Indices

- `uq_checkins_estacionamento_carro_dia`: Unicidade por carro no estacionamento por dia
- `idx_checkins_estacionamento`: Para listar check-ins de um estacionamento
- `idx_checkins_timestamp`: Para ordenacao por data
- `idx_checkins_pessoa`: Para buscas por pessoa
