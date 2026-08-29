# API Contract: Montagem de Equipes

**Date**: 2026-08-25

## Base URL

`/api/montagem`

## Autenticacao

Todos os endpoints requerem Bearer token no header `Authorization`.

## Endpoints

### GET /api/montagem/candidatos

Lista pessoas candidatas a uma equipe com pontuacao de match.

**Permissao**: `edicao.montagem`

**Query Parameters**:

| Parametro | Tipo | Obrigatorio | Default | Descricao |
|-----------|------|-------------|---------|-----------|
| edicaoId | string | Sim | - | ID da edicao ativa |
| equipeId | string | Sim | - | ID da equipe selecionada |
| offset | number | Nao | 0 | Offset para paginacao (minimo 0) |
| limit | number | Nao | 20 | Limite por pagina (maximo 20) |

**Response 200**:

```json
{
  "itens": [
    {
      "pessoaId": "abc-123",
      "pessoaNome": "Maria Silva",
      "pessoaFotoUrl": "https://r2.example.com/pessoas/abc-123/foto.jpg",
      "pessoaNascimento": "1990-05-15",
      "match": 75,
      "matchDetalhe": {
        "historico": 50,
        "criterios": 15,
        "convidarNovamente": 6,
        "presencas": 4
      }
    }
  ],
  "total": 120,
  "temMais": true
}
```

**Response 403**:

```json
{
  "erro": "Acesso negado. Requer permissao edicao.montagem."
}
```

**Response 400** (parametros ausentes):

```json
{
  "erro": "edicaoId e equipeId sao obrigatorios."
}
```

---

### GET /api/montagem/match/:pessoaId

Detalhamento do match de uma pessoa com uma equipe, por edicoes.

**Permissao**: `edicao.montagem`

**Path Parameters**:

| Parametro | Tipo | Obrigatorio | Descricao |
|-----------|------|-------------|-----------|
| pessoaId | string | Sim | ID da pessoa |

**Query Parameters**:

| Parametro | Tipo | Obrigatorio | Default | Descricao |
|-----------|------|-------------|---------|-----------|
| edicaoId | string | Sim | - | ID da edicao ativa (para determinar a equipe) |
| edicaoHistorico | number | Nao | N-2 | Numero da edicao para detalhe historico |

**Response 200**:

```json
{
  "pessoaId": "abc-123",
  "equipeId": "eq-456",
  "edicoes": [
    {
      "edicaoId": "ed-789",
      "edicaoNumero": 98,
      "match": 75,
      "historico": 50,
      "criterios": 15,
      "convidarNovamente": 6,
      "presencas": 4,
      "comentarios": "Excelente participacao, muito prestativo.",
      "avaliadorNome": "Joao Coordenador"
    },
    {
      "edicaoId": "ed-012",
      "edicaoNumero": 97,
      "match": 60,
      "historico": 50,
      "criterios": 10,
      "convidarNovamente": 4,
      "presencas": 1,
      "comentarios": "Bom trabalho, precisa melhorar pontualidade.",
      "avaliadorNome": "Ana Coordenadora"
    }
  ]
}
```

**Response 403**:

```json
{
  "erro": "Acesso negado. Requer permissao edicao.montagem."
}
```

**Response 404**:

```json
{
  "erro": "Pessoa nao encontrada."
}
```

---

## Notas de Implementacao

- O match score e calculado server-side usando CTEs no PostgreSQL
- A normalizacao de nomes de equipes usa `regexp_replace` para remover sufixos numericos (I, II, III, IV, V, VI, VII, VIII, IX, X, 1-10)
- Apenas avaliacoes com `status = 'finalizada'` sao consideradas
- A edicao anterior (N-1) e determinada automaticamente a partir da edicao ativa
- Pessoas ja alocadas na edicao corrente sao excluidas da listagem de candidatos
- Pessoas inativas (`ativo = false`) sao excluidas da listagem
