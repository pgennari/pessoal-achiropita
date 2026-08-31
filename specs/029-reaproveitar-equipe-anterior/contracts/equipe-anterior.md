# Contrato — GET /api/participacoes/equipe-anterior

Contrato de leitura do painel "Equipe da edicao anterior". Definido na feature
029 (spec FR-001 a FR-016; decisoes em [research.md](../research.md) e
[data-model.md](../data-model.md)).

## Visao geral

Retorna as pessoas que participaram da equipe correspondente na edicao anterior
(N-1), com o contexto delas na edicao atual, para o painel lateral do detalhe
da equipe quando a edicao atual esta em `planejamento`.

- Metodo/path: `GET /api/participacoes/equipe-anterior`
- Autenticacao: `Authorization: Bearer <Firebase ID Token>` (comAuth). Qualquer
  perfil autenticado com documento em `/usuarios`.
- Sem paginacao (volume por equipe e pequeno; a lista alimenta um drawer).

## Request

`Query` (obrigatorios):

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `edicaoId` | string | id da edicao atual da equipe |
| `equipeId` | string | id da equipe em que o painel esta aberto |

## Response 200

```jsonc
{
  "edicaoAnterior": { "id": "edicao-99-uuid", "numero": 99 },   // null se nao ha edicao anterior elegivel
  "pessoas": [
    {
      "pessoaId": "pessoa-uuid",
      "pessoaNome": "Maria da Silva",
      "cracha": 123,
      "funcaoAnterior": "Equipista",              // "Coordenador" | "Equipista"
      "jaNaEquipe": false,                        // ja alocada na equipe atual desta edicao
      "emOutraEquipe": false                      // alocada em outra equipe da edicao atual
    }
  ]
}
```

Regras de conteudo:

- `edicaoAnterior`: edicao com `numero = (numero da edicao atual) - 1` e
  `status IN ('ativa','encerrada')`; `null` quando nao existe (FR-013).
- `pessoas`: participantes da equipe correspondente na edicao anterior por nome
  normalizado, restritas a pessoas `ativo = TRUE`, `bloqueada = FALSE`,
  `excluida = FALSE` (D4). `[]` quando nao ha equipe correspondente ou nao ha
  participacoes (FR-013).
- `jaNaEquipe` = existe `participacoes` da pessoa com `edicao_id = edicaoId` e
  `equipe_id = equipeId` (FR-009).
- `emOutraEquipe` = existe `participacoes` da pessoa com `edicao_id = edicaoId`
  e `equipe_id != equipeId` (FR-010).

## Erros

| Status | Condicao | Body |
|--------|----------|------|
| 400 | `edicaoId`/`equipeId` ausentes | `{ "erro": "..." }` |
| 400 | edicao atual nao esta em `planejamento` | `{ "erro": "O painel so esta disponivel para edicoes em planejamento." }` |
| 403 | token invalido / usuario sem acesso | `{ "erro": "..." }` |
| 404 | equipe nao encontrada, nao pertence a edicao ou excluida logicamente | `{ "erro": "Equipe nao encontrada." }` |
| 500 | erro interno | `{ "erro": "..." }` |

## Regras de negocio mapeadas

- FR-001 (so em planejamento) → 400 quando fora.
- FR-002, FR-005, FR-009, FR-010 → campos da resposta.
- FR-012 (ocultar bloqueada/excluida) → filtro da query.
- FR-013 (estados vazios) → `edicaoAnterior: null` e/ou `pessoas: []`.
- FR-015 (reuso de alocacao) → **nao existe POST neste contrato**; a adicao usa o
  contrato existente `POST /api/participacoes`.

## Nota de implementacao

- Endpoint adicionado em `api/src/rotas/participacoes.ts` (montado em
  `/api/participacoes`). Sem conflito de rotas: nao existe `GET /{id}` nessa
  rota hoje.
- Normalizacao de nome reutiliza a mesma regex da montagem
  (`montagem.ts`: `/\s*(I{1,3}|IV|V|VI{0,3}|IX|X|10|[1-9])\s*$/i`), agora como
  helper compartilhado ou copia local explicitada.