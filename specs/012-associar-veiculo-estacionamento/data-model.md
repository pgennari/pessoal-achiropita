# Data Model: Associar Veiculo a Estacionamento e Pessoas

## Entidades Envolvidas

Todas as entidades abaixo ja existem no banco de dados (`schema.sql`) e no frontend (`src/lib/tipos.ts`). Nenhuma migracao ou novo tipo e necessario.

### Veiculo

Tabela: `veiculos` | Tipo TS: `Veiculo` (linha 65)

| Campo | Tipo | Origem | Descricao |
|-------|------|--------|-----------|
| `id` | `TEXT PK` | banco | UUID gerado automaticamente |
| `fabricante` | `TEXT NOT NULL` | formulario | Marca do veiculo |
| `modelo` | `TEXT NOT NULL` | formulario | Modelo do veiculo |
| `placa` | `TEXT NOT NULL UNIQUE` | formulario | Placa do veiculo |
| `cor` | `TEXT NOT NULL` | formulario | Cor do veiculo |
| `estacionamentoId` | `TEXT? FK` | seletor | Estacionamento associado (FK → `estacionamentos.id`, `ON DELETE SET NULL`) |
| `criadoEm` | `TIMESTAMPTZ` | banco | Data de criacao |
| `atualizadoEm` | `TIMESTAMPTZ` | banco | Data de atualizacao |

**Regras de validacao**:
- `placa` deve ser unica no sistema
- `estacionamentoId` pode ser nulo (veiculo sem estacionamento)
- Alterar `estacionamentoId` ajusta `vagas_distribuidas` do estacionamento anterior e do novo (responsabilidade do backend)

### Estacionamento

Tabela: `estacionamentos` | Tipo TS: `Estacionamento` (linha 264)

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `id` | `TEXT PK` | UUID |
| `nome` | `TEXT NOT NULL` | Nome do estacionamento |
| `endereco` | `TEXT NOT NULL` | Endereco |
| `vagasContratadas` | `INTEGER` | Total de vagas contratadas |
| `vagasDistribuidas` | `INTEGER` | Vagas ja alocadas |
| `dentroPerimetro` | `BOOLEAN` | Se esta dentro do perimetro da festa |
| `horarios` | `TEXT` | Horarios de funcionamento |
| `tokenCheckin` | `TEXT UNIQUE` | Token publico para checkin |

### Pessoa

Tabela: `pessoas` | Tipo TS: `Pessoa` (linha 93)

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `id` | `TEXT PK` | UUID |
| `nome` | `TEXT NOT NULL` | Nome completo |
| `cracha` | `INTEGER` | Numero do cracha |
| `estacionamentoId` | `TEXT? FK` | Estacionamento associado a pessoa (independente do veiculo) |
| `estacionamentoNome` | `TEXT?` | Nome do estacionamento (denormalizado) |

### PessoaVeiculo (juncao)

Tabela: `pessoa_veiculo` | Tipo TS: `PessoaVeiculo` (linha 76)

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `pessoaId` | `TEXT PK` | FK → `pessoas.id` (`ON DELETE CASCADE`) |
| `veiculoId` | `TEXT PK` | FK → `veiculos.id` (`ON DELETE CASCADE`) |
| `criadoEm` | `TIMESTAMPTZ` | Data do vinculo |

**Regras**:
- PK composta `(pessoaId, veiculoId)` — sem duplicatas
- `ON DELETE CASCADE` em ambas as FKs

## Relacionamentos

```
Veiculo N --- 1 Estacionamento  (veiculos.estacionamento_id → estacionamentos.id)
Pessoa  N --- 1 Estacionamento  (pessoas.estacionamento_id → estacionamentos.id)
Veiculo N --- N Pessoa           (pessoa_veiculo junction table)
```

## Estados do Veiculo

| Estado | `estacionamentoId` | Descricao |
|--------|-------------------|-----------|
| Sem estacionamento | `null` | Veiculo recém-cadastrado ou associacao removida |
| Associado | `UUID` | Veiculo vinculado a um estacionamento |
| Transferido | `UUID` (novo) | Veiculo movido de um estacionamento para outro |

## Fluxo de Transicao de Estados

```
Sem estacionamento → Associado (selecionar estacionamento)
Associado → Sem estacionamento (remover associacao)
Associado (est A) → Associado (est B) (selecionar outro estacionamento = transferencia)
```
