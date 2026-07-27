# Data Model: Tabela de Veículos com Relacionamento Múltiplo

**Date**: 2026-07-26

## New Tables

### veiculos

```sql
CREATE TABLE veiculos (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  fabricante        TEXT NOT NULL,
  modelo            TEXT NOT NULL,
  placa             TEXT NOT NULL UNIQUE,
  cor               TEXT NOT NULL,
  estacionamento_id TEXT REFERENCES estacionamentos(id) ON DELETE SET NULL,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_veiculos_placa ON veiculos(placa);
CREATE INDEX idx_veiculos_estacionamento ON veiculos(estacionamento_id);
```

### pessoa_veiculo

```sql
CREATE TABLE pessoa_veiculo (
  pessoa_id   TEXT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  veiculo_id  TEXT NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (pessoa_id, veiculo_id)
);

CREATE INDEX idx_pessoa_veiculo_veiculo ON pessoa_veiculo(veiculo_id);
```

## Modified Tables

### pessoas

```sql
-- REMOVER após migração:
-- carros JSONB NOT NULL DEFAULT '[]'
-- estacionamento_id TEXT REFERENCES estacionamentos(id) ON DELETE SET NULL

-- MANTER:
-- tem_estacionamento BOOLEAN NOT NULL DEFAULT FALSE
```

### checkins

```sql
-- MANTER carro_id TEXT NOT NULL (agora referencia veiculos.id)
-- MANTER constraint de unicidade: UNIQUE(estacionamento_id, carro_id)
```

## Relationships

```
pessoas 1:N pessoa_veiculo N:1 veiculos
veiculos 1:1 estacionamento_id (opcional)
veiculos 1:N checkins (carro_id)
```

## Migration Script

```sql
-- Etapa 1: Criar tabelas novas
CREATE TABLE veiculos (...);
CREATE TABLE pessoa_veiculo (...);

-- Etapa 2: Migrar veículos do JSONB para tabela veiculos
INSERT INTO veiculos (id, fabricante, modelo, placa, cor)
SELECT
  gen_random_uuid()::text,
  carro->>'fabricante',
  carro->>'modelo',
  UPPER(carro->>'placa'),
  carro->>'cor'
FROM pessoas p,
     jsonb_array_elements(p.carros::jsonb) AS carro
WHERE carro->>'placa' IS NOT NULL AND carro->>'placa' != '';

-- Etapa 3: Criar vínculos pessoa_veiculo
INSERT INTO pessoa_veiculo (pessoa_id, veiculo_id)
SELECT p.id, v.id
FROM pessoas p,
     jsonb_array_elements(p.carros::jsonb) AS carro
JOIN veiculos v ON UPPER(v.placa) = UPPER(carro->>'placa')
WHERE p.carros::jsonb != '[]'::jsonb;

-- Etapa 4: Migrar estacionamento_id de pessoas para veículos
UPDATE veiculos v
SET estacionamento_id = (
  SELECT pv.estacionamento_id
  FROM pessoa_veiculo pv
  JOIN pessoas p ON p.id = pv.pessoa_id
  WHERE pv.veiculo_id = v.id
    AND pv.estacionamento_id IS NOT NULL
  LIMIT 1
);

-- Etapa 5: Migrar carro_id dos checkins
UPDATE checkins ck
SET carro_id = (
  SELECT v.id
  FROM veiculos v
  WHERE UPPER(v.placa) = UPPER(ck.placa)
  LIMIT 1
);

-- Etapa 6: Remover colunas antigas
ALTER TABLE pessoas DROP COLUMN IF EXISTS carros;
ALTER TABLE pessoas DROP COLUMN IF EXISTS estacionamento_id;

-- Etapa 7: Criar índices
CREATE INDEX idx_veiculos_estacionamento ON veiculos(estacionamento_id);
CREATE INDEX idx_pessoa_veiculo_veiculo ON pessoa_veiculo(veiculo_id);
```

## TypeScript Interfaces

```typescript
export interface Veiculo {
  id: string;
  fabricante: string;
  modelo: string;
  placa: string;
  cor: string;
  estacionamentoId?: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface PessoaVeiculo {
  pessoaId: string;
  veiculoId: string;
  criadoEm: string;
}

export interface PessoaComVeiculos extends Pessoa {
  veiculos: Veiculo[];
}

export interface VeiculoComPessoas extends Veiculo {
  pessoas: { id: string; nome: string; cracha: number }[];
}
```
