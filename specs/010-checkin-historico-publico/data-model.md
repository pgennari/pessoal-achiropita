# Data Model: Historico de Check-in no Link Publico

## Entidades

Nenhuma nova entidade. Feature usa a tabela `checkins` existente.

### Check-in (existente)

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | TEXT (UUID) | Chave primaria |
| timestamp | TIMESTAMPTZ | Data/hora do check-in |
| data | DATE | Data do check-in |
| pessoa_nome | TEXT | Nome da pessoa (denormalizado) |
| placa | TEXT | Placa do carro (denormalizado) |
| modelo | TEXT | Modelo do carro (denormalizado) |
| cor | TEXT | Cor do carro (denormalizado) |
| estacionamento_id | TEXT (UUID) | FK para estacionamentos(id) |

## Consultas

### Historico publico por token

Busca check-ins de um estacionamento (via token) agrupados por data.

```sql
SELECT 
  c.id, c.timestamp, c.pessoa_nome, c.placa, c.modelo, c.cor
FROM checkins c
JOIN estacionamentos e ON e.id = c.estacionamento_id
WHERE e.token_checkin = $1
ORDER BY c.timestamp DESC;
```

**Indice utilizado**: `idx_checkins_estacionamento` + `idx_checkins_timestamp`

### Agrupamento por data (frontend)

O backend retorna array flat ordenado por timestamp DESC. O frontend agrupa por data usando `toLocaleDateString("pt-BR")` (padrao ja usado em `ListaCheckins`).

## Regras de Negocio

1. **Sem autenticacao**: A rota publica valida apenas o token — qualquer pessoa com o link pode ver o historico.
2. **Sem limite**: Todos os check-ins sao retornados (FR-014).
3. **Dados exibidos**: Apenas dados de exibicao (hora, pessoa, placa, modelo, cor) — sem pessoaId ou estacionamentoId na resposta publica.
4. **Ordenacao**: Por timestamp decrescente (mais recente primeiro).

## Indices Existentes (nao requer migracao)

- `idx_checkins_estacionamento`: Para filtrar por estacionamento
- `idx_checkins_timestamp`: Para ordenacao por data
- `uq_checkins_estacionamento_carro_dia`: Unicidade por carro no estacionamento por dia

**Migration**: Adicionar coluna `data` em tabela existente:
```sql
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS data DATE NOT NULL DEFAULT CURRENT_DATE;
DROP INDEX IF EXISTS uq_checkins_estacionamento_carro;
CREATE UNIQUE INDEX IF NOT EXISTS uq_checkins_estacionamento_carro_dia
ON checkins(estacionamento_id, carro_id, data);
```
