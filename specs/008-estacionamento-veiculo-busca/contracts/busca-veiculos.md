# UI Contract: Busca e Lista de Veiculos no Estacionamento

**Feature**: 008-estacionamento-veiculo-busca
**Componente**: `ListaVeiculosEstacionamento`

## Interface

### Props

```typescript
interface Props {
  estacionamentoId: string;
}
```

### Data Source

A componente consome `useVeiculosEstacionamento(estacionamentoId)` que retorna `VeiculoComPessoas[]`.

Para associacao de novos veiculos, consome `useVeiculos()` que retorna `Veiculo[]` (todos os veiculos do sistema).

## UI Structure

```
┌─────────────────────────────────────────────┐
│ Veiculos Associados              [N de M]  │
├─────────────────────────────────────────────┤
│ [Buscar por fabricante, modelo, cor,       │
│  placa, nome ou cracha...]                 │
├─────────────────────────────────────────────┤
│ ┌───────────────────────────────────────┐  │
│ │ Fiat Argo                             │  │
│ │ ABC-1D23 · Branco                     │  │
│ │ Pessoas: Joao Silva, Maria Santos     │  │
│ │                        [Remover]      │  │
│ └───────────────────────────────────────┘  │
│ ┌───────────────────────────────────────┐  │
│ │ Volkswagen Gol                        │  │
│ │ XYZ-9E78 · Preto                      │  │
│ │                                        │  │
│ │                        [Remover]      │  │
│ └───────────────────────────────────────┘  │
│                                            │
│ ── Associar novo veiculo ──────────────── │
│ [Buscar veiculo para associar...]          │
│ ┌───────────────────────────────────────┐  │
│ │ Toyota Corolla       [Associar]       │  │
│ │ DEF-2F45 · Vermelho                   │  │
│ └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

## Behavior

### Campo de busca (veiculos associados)

- Placeholder: "Buscar por fabricante, modelo, cor, placa, nome ou cracha..."
- Filtra `veiculosEstacionamento` em memoria com debounce de 300ms
- Resultado: lista filtrada de `VeiculoComPessoas[]`
- Quando vazio: exibe "Nenhum veiculo encontrado"
- Quando sem busca: exibe todos os veiculos do estacionamento

### Lista de veiculos associados

Para cada veiculo na lista:
- **Linha 1**: `{fabricante} {modelo}` (font-semibold)
- **Linha 2**: `{placa} · {cor}` (text-xs, font-mono, ardesia)
- **Linha 3** (condicional): `Pessoas: {nomes}` (text-xs, ardesia) — so aparece se `veiculo.pessoas.length > 0`
- **Botao**: "Remover" (btn-perigo btn-pequeno) — so aparece se `podeEditar`

### Campo de busca (associacao)

- Placeholder: "Buscar veiculo para associar..."
- Filtra `todosVeiculos` que nao possuem `estacionamentoId`
- Resultado: lista filtrada de `Veiculo[]`
- Para cada resultado: exibe `placa - modelo` e botao "Associar"
- Ao clicar "Associar": chama `associarVeiculoEstacionamento(estacionamentoId, veiculoId)`
- Quando todos ja estao associados: exibe "Todos os veiculos ja estao associados a estacionamentos."

### Permissoes

- ORG/ADM: veem campo de busca, botoes "Associar" e "Remover"
- EQP: veem apenas a lista de veiculos associados (somente leitura), sem busca de associacao

## Accessibility

- Campo de busca com `aria-label="Buscar veiculos"`
- Lista com `role="list"` e itens com `role="listitem"`
- Botoes com texto descritivo (nao apenas cor)
