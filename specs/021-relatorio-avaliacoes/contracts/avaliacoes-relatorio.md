# Contracts: Relatorio de Avaliacoes de Equipistas

**Feature**: `021-relatorio-avaliacoes` | **Date**: 2026-08-23

A feature nao expoe endpoints novos nem altera contratos existentes. O contrato abaixo documenta o endpoint interno reutilizado, na perspectiva do consumidor (pagina de relatorio). Nao ha interface publica anonima nesta feature.

## GET /api/avaliacoes — listar avaliacoes da edicao (existente)

Autenticacao: `Authorization: Bearer <JWT Firebase>` (middleware `comAuth`).
Autorizacao: requer permissao `avaliacao.gerenciar`; sem ela responde `403`.

### Request

| Query param | Tipo | Obrigatorio | Uso no relatorio |
|-------------|------|-------------|------------------|
| `edicaoId`  | string | Sim | Sempre o id da **edicao ativa** (`useEdicaoAtiva`) |
| `equipeId`  | string | Nao | Nao utilizado (filtros de equipe fora de escopo) |
| `status`    | `"rascunho" \| "finalizada"` | Nao | Nao utilizado (relatorio lista ambos) |

Consumo: chamada unica por montagem da pagina, via hook `useAvaliacoes(edicaoId)`.

### Response 200 — `Avaliacao[]`

Ordenacao garantida: `atualizadoEm DESC`.

```json
[
  {
    "id": "uuid",
    "edicaoId": "uuid",
    "equipeId": "uuid",
    "equipeNome": "Barraca do Espeto",
    "pessoaId": "uuid",
    "pessoaNome": "Maria Souza",
    "pessoaCracha": "1234",
    "avaliadorCracha": 777,
    "avaliadorNome": "Joao Coordenador",
    "criterios": {
      "pontualidade": "Otimo",
      "dedicacao": "Bom",
      "companheirismo": null,
      "espiritualidade": "Regular",
      "comprometimento": "Ruim",
      "uniforme": "Otimo",
      "convidarNovamente": 2
    },
    "aptoCoordenar": false,
    "comentarios": "texto livre ou null",
    "status": "rascunho",
    "criadoEm": "2026-08-23T12:00:00Z",
    "atualizadoEm": "2026-08-23T12:34:56Z",
    "finalizadoEm": null
  }
]
```

Notas de contrato relevantes ao relatorio:

- `criterios.*` podem ser `null` (rascunho incompleto); o relatorio exibe indicador de sem resposta e os exclui de filtros ativos naquele campo
- `equipeNome`, `pessoaNome`, `pessoaCracha` sao resolvidos por JOIN neste endpoint e passam a constar como campos opcionais na interface `Avaliacao` do frontend
- Erros: `403` (sem permissao), demais erros tratados com mensagem generica PT-BR pela pagina

## Contrato de interacao da pagina (UI)

Regras observaveis que a implementacao deve satisfazer (fonte: spec FRs):

| Regra | Comportamento |
|-------|---------------|
| Filtro por campo | Chips multi-selecao; valores possiveis = Otimo/Bom/Regular/Ruim (6 criterios) e 1..5 (convidar novamente) |
| Sem selecao | Campo nao restringe o resultado |
| OR/AND | Valores do mesmo campo em alternancia; campos distintos em conjuncao |
| Atualizacao | Listagem, contador e resumo reagem a cada marcar/desmarcar sem recarregar a pagina |
| Contador | Quantidade exata de registros resultante dos filtros vigentes |
| Resumo | Total geral, total filtrado e contagem por valor de cada campo sobre o universo filtrado pelos demais campos |
| Limpar filtros | Um comando zera todos os filtros |
| Detalhe | Selecionar registro expande inline todos os campos da avaliacao |
| Acesso | Perfis sem `avaliacao.gerenciar`: item ausente no menu e bloco "Sem permissao" na pagina; API responde 403 |

## Endpoints publicos

Nenhum. Toda a feature vive na area logada.
