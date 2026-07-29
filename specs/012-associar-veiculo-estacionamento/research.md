# Research: Associar Veiculo a Estacionamento e Pessoas

## Status: Nenhuma pesquisa necessaria

Nao ha `NEEDS CLARIFICATION` no Technical Context. Todas as decisoes tecnologicas ja estao estabelecidas no projeto:

- **Frontend**: React 18 + Vite 5 + TypeScript strict + Tailwind 3 (existente)
- **Backend**: Hono Node.js 22 (existente, sem alteracoes)
- **Banco**: PostgreSQL (schema ja migrado)
- **Autenticacao**: Firebase Auth + JWT + `useSessao` hook (existente)
- **Componentes**: `VinculoVeiculo` e `EstacionamentoPessoa` como padroes de UI

## Decisoes

| Decisao | Escolha | Racional | Alternativas Consideradas |
|---------|---------|-------------------------------------|
| Seletor de estacionamento | `<select>` inline (mesmo padrao `EstacionamentoPessoa`) | Consistencia com o resto do sistema, UX simples | Modal de busca (desnecessario — poucos estacionamentos) |
| Vinculo de pessoas | Adaptar `<VinculoVeiculo>` para buscar pessoas (inverter fluxo) | Reuso do componente existente, que ja tem modal de busca | Criar `VinculoPessoa` do zero (mais codigo, menos reuso) |
| Atualizacao de `estacionamento_id` | Usar `PUT /api/veiculos/:id` (dados completos) | Endpoint ja existente, aceita `estacionamentoId` | Usar `POST /api/estacionamentos/:id/veiculos` (alternativa existente) |

## Dependencias

Nenhuma nova dependencia. As funcoes de API ja estao em `veiculos.ts`:
- `vincularPessoaVeiculo(veiculoId, pessoaId)` — ja existe
- `desvincularPessoaVeiculo(veiculoId, pessoaId)` — ja existe
- `atualizarVeiculo(id, dados)` — ja aceita `estacionamentoId`

Os hooks ja existem em `hooks.ts`:
- `useVeiculo(id)` — ja retorna `estacionamentoId`
- `usePessoasVeiculo(veiculoId)` — ja retorna pessoas vinculadas
- `useEstacionamentos()` — ja retorna lista de estacionamentos
- `usePessoas()` — ja retorna lista de pessoas (para busca no modal)
