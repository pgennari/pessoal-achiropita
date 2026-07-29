# Contrato de Integracao: VeiculoDetalhe

## Visao Geral

Contrato de UI entre o componente de pagina `VeiculoDetalhe` e os componentes de apoio `SeletorEstacionamento` e `VinculoPessoa`. A feature inteira e frontend — os endpoints de API ja existem e nao serao alterados.

## Seletor de Estacionamento (inline)

### Props (interface)
```
interface SeletorEstacionamentoProps {
  veiculoId: string;
  estacionamentoId: string | null;
  estacionamentoNome: string | null;
  podeEditar: boolean;
}
```

### Comportamento
- **Modo visualizacao** (todos os perfis): Exibe o nome do estacionamento como `<Link to={/estacionamentos/${id}}>`. Se `estacionamentoId` for nulo, exibe "Nenhum estacionamento associado."
- **Modo edicao** (ADM/ORG apenas): Exibe `<select>` com a lista de estacionamentos ordenada por nome, com opcao "Nenhum" para remover. Botoes "Salvar" e "Cancelar".
- **Ao salvar**: Chama `PUT /api/veiculos/:id` com `{ ...veiculo, estacionamentoId }`.
- **Apos salvar**: Invalida queries `["veiculos"]` para refletir a alteracao.

### API consumida (existente)
| Metodo | Rota | Frequencia |
|--------|------|------------|
| GET | `/api/estacionamentos` | Unica vez ao abrir pagina |
| PUT | `/api/veiculos/:id` | A cada salvamento |

## Vinculo de Pessoas (modal)

### Props (interface)
```
interface VinculoPessoaProps {
  titulo: string;
  pessoasDisponiveis: { id: string; nome: string }[];
  pessoasVinculadas: { id: string; nome: string }[];
  aoVincular: (pessoaId: string) => Promise<void>;
  aoDesvincular: (pessoaId: string) => Promise<void>;
}
```

### Comportamento
- **Lista de vinculados**: Exibe cada pessoa da lista com nome e botao "Remover" (visivel apenas para ADM/ORG).
- **Modal de busca**: Acionado pelo botao "+ Vincular". Input de texto filtra `pessoasDisponiveis` por `nome`. Cada resultado tem botao "Vincular".
- **Vinculo duplicado**: Prevenir — `pessoasDisponiveis` ja exclui as ja vinculadas.
- **Ao vincular**: Chama `POST /api/veiculos/:veiculoId/pessoas { pessoaId }`.
- **Ao desvincular**: Chama `DELETE /api/veiculos/:veiculoId/pessoas/:pessoaId`.
- **Apos cada operacao**: Invalida queries `["veiculos", veiculoId, "pessoas"]`.

### API consumida (existente)
| Metodo | Rota | Frequencia |
|--------|------|------------|
| GET | `/api/veiculos/:id/pessoas` | Unica vez ao abrir pagina |
| GET | `/api/pessoas` | Unica vez ao abrir pagina |
| POST | `/api/veiculos/:id/pessoas` | A cada vinculo |
| DELETE | `/api/veiculos/:id/pessoas/:pessoaId` | A cada desvinculo |

## Dados Compartilhados (VeiculoDetalhe)

```
Estado local:
  editandoEstacionamento: boolean
  estacionamentoSelecionado: string  // id ou ""
  modalPessoaAberto: boolean
  erroOperacao: string | null

Queries (react-query):
  useVeiculo(id)           → Veiculo
  usePessoasVeiculo(id)    → PessoaComVeiculos[]
  useEstacionamentos()     → Estacionamento[]
  usePessoas()             → Pessoa[]
```

## Fluxo de Autorizacao

```
podeEditar = sessao.perfil === "ADM" || sessao.perfil === "ORG"
podeVisualizar = sessao !== null  // qualquer perfil autenticado
```
