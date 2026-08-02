# Data Model: Dashboard de Check-ins em Tempo Real

Nenhuma nova tabela no banco de dados. O dashboard e uma camada de consulta (leitura) sobre as tabelas existentes.

## Query Model

### DashboardInicial

Retornado pelo endpoint `GET /api/estacionamentos/dashboard`.

| Campo | Tipo | Origem | Descricao |
|-------|------|--------|-----------|
| `estacionamentos` | `EstacionamentoComOcupacao[]` | query agregada | Todos os estacionamentos com ocupacao calculada |
| `ultimosCheckins` | `CheckinResumo[]` | query `checkins` | Todos os check-ins do dia (sem limite) |
| `timestamps` | `{ geradoEm, dataReferencia }` | metadado | Momento da geracao e data de referencia |

### EstacionamentoComOcupacao

| Campo | Tipo | Origem |
|-------|------|--------|
| `id` | `string` | `estacionamentos.id` |
| `nome` | `string` | `estacionamentos.nome` |
| `endereco` | `string` | `estacionamentos.endereco` |
| `vagasContratadas` | `number` | `estacionamentos.vagas_contratadas` |
| `checkinsHoje` | `number` | `COUNT(checkins.id) WHERE data = CURRENT_DATE` |
| `ocupacaoPercentual` | `number` | `(checkinsHoje / vagasContratadas) * 100` ou `null` se vagas = 0 |

### CheckinResumo

| Campo | Tipo | Origem |
|-------|------|--------|
| `id` | `string` | `checkins.id` |
| `timestamp` | `string` (ISO) | `checkins.timestamp` |
| `pessoaNome` | `string` | `checkins.pessoa_nome` |
| `placa` | `string` | `checkins.placa` |
| `modelo` | `string` | `checkins.modelo` |
| `cor` | `string` | `checkins.cor` |
| `estacionamentoId` | `string` | `checkins.estacionamento_id` |
| `estacionamentoNome` | `string` | `checkins.estacionamento_nome` |

## Evento SSE: CheckinEvent

Enviado no canal SSE quando um check-in e registrado.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `tipo` | `"checkin"` | Nome do evento SSE |
| `dados` | `CheckinResumo` | Mesmo formato do CheckinResumo |

## Entidades Existentes Utilizadas

As entidades abaixo ja estao definidas em `schema.sql` e `src/lib/tipos.ts`. Nenhuma alteracao estrutural necessaria.

- **estacionamentos** — tabela raiz, fornece `vagas_contratadas` para calculo de ocupacao
- **checkins** — registros de entrada, unicos por `(estacionamento_id, carro_id, data)`
- **veiculos** — associados logicamente a checkins via `carro_id`
- **pessoa_veiculo** — join table usada para obter o nome da pessoa no momento do check-in

## SQL Queries

### Query 1: Estacionamentos com ocupacao

```sql
SELECT
  e.id,
  e.nome,
  e.endereco,
  e.vagas_contratadas,
  COALESCE(COUNT(c.id) FILTER (WHERE c.data = CURRENT_DATE), 0) AS checkins_hoje
FROM estacionamentos e
LEFT JOIN checkins c ON c.estacionamento_id = e.id AND c.data = CURRENT_DATE
GROUP BY e.id
ORDER BY e.nome
```

### Query 2: Ultimos check-ins

```sql
SELECT
  id,
  timestamp,
  pessoa_nome,
  placa,
  modelo,
  cor,
  estacionamento_nome
FROM checkins
WHERE data = CURRENT_DATE
ORDER BY timestamp DESC
```
