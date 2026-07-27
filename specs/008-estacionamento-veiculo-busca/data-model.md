# Data Model: Busca de Veiculos no Estacionamento

**Feature**: 008-estacionamento-veiculo-busca
**Date**: 2026-07-27

## Entities

### Veiculo (existente)

| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| id | string (UUID) | sim | Chave primaria |
| fabricante | string | sim | Marca do veiculo (ex: "Fiat", "Volkswagen") |
| modelo | string | sim | Modelo do veiculo (ex: "Argo", "Gol") |
| placa | string | sim | Placa do veiculo (formato: ABC-1D23 ou ABCD1E23) |
| cor | string | sim | Cor do veiculo (ex: "Branco", "Preto") |
| estacionamento_id | string (FK) | nao | ID do estacionamento associado (N:1) |
| criado_em | timestamp | sim | Data de criacao |
| atualizado_em | timestamp | sim | Data de atualizacao |

### VeiculoComPessoas (projecao existente)

Extende `Veiculo` com lista de pessoas vinculadas:

| Campo | Tipo | Descricao |
|-------|------|-----------|
| pessoas | array | Lista de pessoas vinculadas ao veiculo |
| pessoas[].id | string | ID da pessoa |
| pessoas[].nome | string | Nome completo da pessoa |
| pessoas[].cracha | number | Numero do cracha da pessoa |

### PessoaVeiculo (tabela de associacao N:N existente)

| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| pessoa_id | string (FK) | sim | ID da pessoa |
| veiculo_id | string (FK) | sim | ID do veiculo |
| criado_em | timestamp | sim | Data de criacao |

## Relationships

```
Estacionamento (1) ──── (N) Veiculo       [via estacionamento_id]
Veiculo       (N) ──── (N) Pessoa         [via tabela pessoa_veiculo]
```

## Validation Rules

- `estacionamento_id`: UUID valido ou null
- `fabricante`: string nao-vazia
- `modelo`: string nao-vazia
- `placa`: formato de placa brasileira (validacao no frontend e backend)
- `cor`: string nao-vazia

## State Transitions

### Veiculo-Estacionamento

```
[null] ──associar──> [estacionamento_id]
[estacionamento_id] ──desassociar──> [null]
[estacionamento_id_A] ──transferir para B──> [estacionamento_id_B]
```

## Search Behavior

A busca filtra `VeiculoComPessoas[]` em memoria usando case-insensitive matching:

1. **fabricante**: `veiculo.fabricante.toLowerCase().includes(termo)`
2. **modelo**: `veiculo.modelo.toLowerCase().includes(termo)`
3. **cor**: `veiculo.cor.toLowerCase().includes(termo)`
4. **placa**: `veiculo.placa.toLowerCase().includes(termo)`
5. **nome de pessoa**: `veiculo.pessoas.some(p => p.nome.toLowerCase().includes(termo))`
6. **cracha de pessoa**: `veiculo.pessoas.some(p => String(p.cracha).includes(termo))`

Resultado: uniao logica dos items que correspondem a qualquer um dos campos (OR implicito).
