# Research: Montagem de Equipes

**Date**: 2026-08-25

## R1: Match calculation — server-side vs client-side

**Decision**: Server-side calculation in a dedicated API endpoint.

**Rationale**: The match score requires JOINs across 4+ tables (participacoes, participacoes_historicas, avaliacoes, presencas) with normalization logic (team name comparison, criteria scoring). Sending raw data to the client would transfer thousands of rows. Server-side calculation returns pre-computed scores with pagination.

**Alternatives considered**:
- Client-side: Would require loading all pessoas + all participacoes_historicas + all avaliacoes + all presencas upfront. Not feasible at scale (~5.871 pessoas x ~27 edicoes).
- Hybrid (server for list, client for detail): Rejected because the detail view still needs per-edition breakdowns that are expensive to compute client-side.

## R2: Team name normalization for historical comparison

**Decision**: SQL-level normalization using `regexp_replace` to strip Roman (I, II, III, IV, V, VI, VII, VIII, IX, X) and Arabic (1-10) suffixes, then `trim()`.

**Rationale**: The comparison must be done at query time to efficiently match teams across editions. PostgreSQL's `regexp_replace` handles this in a single expression.

**SQL pattern**:
```sql
regexp_replace(equipe_nome, '\s*(I{1,3}|IV|V|VI{0,3}|IX|X|10|[1-9])\s*$', '', 'i')
```

**Alternatives considered**:
- Application-level normalization: Would require loading all team names into memory. Rejected for efficiency.
- Separate normalized name column: Would require schema migration and data backfill. Overkill for this use case.

## R3: Pagination pattern

**Decision**: Offset-based pagination following the cantina pesquisas pattern (`{ itens, total, temMais }`).

**Rationale**: Already proven in the codebase (CantinaPesquisa). The `useInfiniteQuery` + "Carregar mais" button pattern is established. The montagem candidate list has a natural ordering (match score descending) that works well with offset pagination.

**Alternatives considered**:
- Cursor-based: More performant for large datasets but not established in the codebase. Overkill for ~5.871 people max.
- No pagination: Not feasible with lazy-loading requirement in spec.

## R4: API endpoint design for montagem candidates

**Decision**: Single endpoint `GET /api/montagem/candidatos` with query parameters `edicaoId`, `equipeId`, `offset`, `limit`.

**Rationale**: Combines candidate listing with match score computation in one query. The endpoint returns people NOT already allocated in the current edition, sorted by match score descending. The match score is computed server-side using CTEs for each component.

**Response shape**:
```json
{
  "itens": [{
    "pessoaId": "...",
    "pessoaNome": "...",
    "pessoaFotoUrl": "...",
    "pessoaNascimento": "...",
    "match": 75,
    "matchDetalhe": {
      "historico": 50,
      "criterios": 15,
      "convidarNovamente": 6,
      "presencas": 4
    }
  }],
  "total": 120,
  "temMais": true
}
```

## R5: Historical match detail endpoint

**Decision**: Separate endpoint `GET /api/montagem/match/:pessoaId` with query params `edicaoId` (target team's edition) and optional `edicaoHistorico` (which historical edition to show).

**Rationale**: The expanded person view needs per-edition match breakdowns with navigation. This is a separate concern from the main candidate listing. The endpoint returns match details for a specific person-team pair across editions.

**Response shape**:
```json
{
  "pessoaId": "...",
  "equipeId": "...",
  "edicoes": [{
    "edicaoId": "...",
    "edicaoNumero": 99,
    "match": 75,
    "historico": 50,
    "criterios": 15,
    "convidarNovamente": 6,
    "presencas": 4,
    "comentarios": "...",
    "avaliadorNome": "..."
  }]
}
```

## R6: Permission model for allocation from Montagem screen

**Decision**: The Montagem screen requires `edicao.montagem` for viewing. Allocation uses the existing `POST /api/participacoes` endpoint which requires `edicao.equipeAlocar`.

**Rationale**: The allocation mechanism is identical to existing allocation (EquipeDetalhe). The `edicao.montagem` permission gates access to the screen itself (match scores, candidate listing). The existing allocation endpoint and its permission check remain unchanged.

**Alternatives considered**:
- Single `edicao.montagem` permission for everything: Would require duplicating allocation logic or adding permission checks in the existing endpoint. Rejected for simplicity.
- Using `edicao.equipeAlocar` for screen access: Too broad — someone who can allocate shouldn't necessarily see match scores.

## R7: Infinite scroll implementation

**Decision**: "Carregar mais" button pattern (not automatic scroll detection), matching CantinaPesquisa.

**Rationale**: The spec says "lazy-loading e rolagem infinita" but the established pattern in the codebase is click-triggered loading via `useInfiniteQuery` + `fetchNextPage()`. This avoids complexity of IntersectionObserver and is consistent with existing UX.

**Alternatives considered**:
- IntersectionObserver auto-load: More seamless UX but not established in codebase. Adds complexity. Can be added as enhancement in v2.
