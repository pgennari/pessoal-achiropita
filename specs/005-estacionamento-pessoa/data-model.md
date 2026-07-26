# Data Model: Associacao Pessoa-Estacionamento

## Entidades

### Pessoa (atualizada)

| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| id | TEXT (UUID) | Sim | Chave primaria |
| cracha | INTEGER | Sim | Numero unico do cracha |
| nome | TEXT | Sim | Nome completo |
| estacionamento_id | TEXT (UUID) | Nao | FK para estacionamentos(id) |
| ... | ... | ... | (campos existentes mantidos) |

**Mudanca**: Adicionar coluna `estacionamento_id` com referencia para `estacionamentos(id)`.

**Constraint**: `REFERENCES estacionamentos(id) ON DELETE SET NULL` — quando estacionamento e excluido, pessoa fica sem vinculo.

### Estacionamento (inalterada)

| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| id | TEXT (UUID) | Sim | Chave primaria |
| nome | TEXT | Sim | Nome do estacionamento |
| vagas_contratadas | INTEGER | Sim | Total de vagas contratadas |
| vagas_distribuidas | INTEGER | Sim | Pessoas atualmente vinculadas |
| ... | ... | ... | (campos existentes mantidos) |

**Nota**: O campo `vagas_distribuidas` continua sendo atualizado manualmente via API. A associacao de pessoas incrementa/decrementa este contador.

## Relacionamentos

```
pessoas.estacionamento_id → estacionamentos.id (N:1)
```

- Uma pessoa pode estar em no maximo 1 estacionamento
- Um estacionamento pode ter N pessoas

## Regras de Negocio

1. **Associacao**: Ao associar pessoa a estacionamento, incrementar `vagas_distribuidas`
2. **Desassociacao**: Ao remover pessoa, decrementar `vagas_distribuidas`
3. **Troca**: Se pessoa ja tem estacionamento e troca, decrementar do antigo e incrementar no novo
4. **Exclusao de estacionamento**: `ON DELETE SET NULL` — pessoas ficam sem vinculo
5. **Inativacao de pessoa**: Manter vinculo (historico) — pessoa inativa nao aparece em buscas padrao

## Migration

```sql
-- Adicionar coluna estacionamento_id na tabela pessoas
ALTER TABLE pessoas 
ADD COLUMN IF NOT EXISTS estacionamento_id TEXT 
REFERENCES estacionamentos(id) ON DELETE SET NULL;

-- Atualizar vagas_distribuidas baseado emAssociacoes existentes
UPDATE estacionamentos e
SET vagas_distribuidas = (
  SELECT COUNT(*) FROM pessoas p 
  WHERE p.estacionamento_id = e.id
);

-- Index para queries por estacionamento
CREATE INDEX IF NOT EXISTS idx_pessoas_estacionamento 
ON pessoas(estacionamento_id);
```

## Indices

- `idx_pessoas_estacionamento`: Para queries que buscam pessoas por estacionamento
- `idx_pessoas_cracha`: Ja existe
- `idx_pessoas_ativo`: Ja existe
