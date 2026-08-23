# Data Model: Relatorio de Avaliacoes de Equipistas

**Feature**: `021-relatorio-avaliacoes` | **Date**: 2026-08-23

Nenhuma entidade nova e nenhuma migracao. O relatorio e somente leitura sobre a tabela `avaliacoes` (feature 019). Este documento descreve as entidades envolvidas, os view-models novos (apenas cliente) e as regras de filtragem/resumo.

## Entidades existentes consumidas

### Avaliacao (tabela `avaliacoes`)

Registro da avaliacao de um equipista pelo coordenador da equipe, criado/gerenciado pela feature 019.

| Campo (API) | Coluna/Tipo | Descricao |
|-------------|-------------|-----------|
| `id` | `TEXT PK` | Identificador |
| `edicaoId` | `edicao_id TEXT FK edicoes` | Edicao da avaliacao; delimita o universo do relatorio |
| `equipeId` / `equipeNome*` | `equipe_id TEXT FK equipes` + JOIN | Equipe do equipista (*nome resolvido por JOIN na rota de listagem) |
| `pessoaId` / `pessoaNome*` / `pessoaCracha*` | `pessoa_id TEXT FK pessoas` + JOIN | Pessoa avaliada (*resolvidos por JOIN) |
| `avaliadorCracha`, `avaliadorNome` | `INTEGER`, `TEXT NOT NULL` | Coordenador que avaliou (identificado pelo link publico) |
| `criterios` | `JSONB NOT NULL DEFAULT '{}'` | Ver shape abaixo |
| `aptoCoordenar` | `BOOLEAN NULL` | "Apta a Coordenar?" — Sim/Nao; null em rascunho incompleto |
| `comentarios` | `TEXT NULL` | Comentarios e sugestoes (limite 4000, feature 019) |
| `status` | `TEXT 'rascunho' \| 'finalizada'` | Estado da avaliacao |
| `criadoEm`, `atualizadoEm`, `finalizadoEm` | `TIMESTAMPTZ` (ISO no JSON) | Datas; ordenacao padrao por `atualizadoEm DESC` |

Restricoes relevantes: `UNIQUE(pessoa_id, edicao_id)` — maximo 1 avaliacao por equipista por edicao; transicoes de status: `rascunho → finalizadas` (irreversivel, imutavel apos finalizar).

Shape de `criterios` (JSONB, chaves fixas da feature 019):

```json
{
  "pontualidade":      "Otimo" | "Bom" | "Regular" | "Ruim" | null,
  "dedicacao":         "Otimo" | "Bom" | "Regular" | "Ruim" | null,
  "companheirismo":    "Otimo" | "Bom" | "Regular" | "Ruim" | null,
  "espiritualidade":   "Otimo" | "Bom" | "Regular" | "Ruim" | null,
  "comprometimento":   "Otimo" | "Bom" | "Regular" | "Ruim" | null,
  "uniforme":          "Otimo" | "Bom" | "Regular" | "Ruim" | null,
  "convidarNovamente": 1 | 2 | 3 | 4 | 5 | null
}
```

Tipos frontend correspondentes ja existentes em `src/lib/tipos.ts`: `ValorCriterio`, `NotaConvidarNovamente`, `CriteriosAvaliacao`, `StatusAvaliacao`.

### Alteracao unica de tipo (frontend)

Interface `Avaliacao` ganha campos opcionais que o endpoint de listagem ja retorna e o tipo omitia:

```ts
export interface Avaliacao {
  // ...campos atuais...
  equipeNome?: string;
  pessoaNome?: string;
  pessoaCracha?: string | null;
}
```

Campos opcionais porque `GET /api/avaliacoes/pessoa/{id}` (outro consumidor do mesmo tipo) nao retorna `pessoaNome`/`pessoaCracha`.

## View-models novos (somente cliente, em `RelatorioAvaliacoes.tsx`)

### FiltrosRelatorio

Estado dos filtros vigentes. Chave = campo filtravel; valor = conjunto de valores marcados (vazio = campo sem restricao).

```ts
type FiltroCriterio = Partial<Record<CampoCriterio, Set<ValorCriterio>>>;
// CampoCriterio = "pontualidade" | "dedicacao" | "companheirismo"
//               | "espiritualidade" | "comprometimento" | "uniforme"

interface FiltrosRelatorio {
  criterios: FiltroCriterio;
  convidarNovamente: Set<NotaConvidarNovamente>;
}
```

Rotulos de exibicao: valores `ValorCriterio` renderizados como Otimo/Bom/Regular/Ruim (com acentuacao na UI); notas 1..5 como numeros.

### Regras de filtragem (`aplicarFiltros(avaliacoes, filtros)`)

1. Para cada campo com filtro ativo, a avaliacao precisa ter valor pertencente ao conjunto marcado (OR dentro do campo).
2. Campos diferentes se combinam por conjuncao (AND entre campos).
3. Valor ausente (`null`) nunca satisfaz filtro ativo: rascunhos com criterio vazio saem do resultado quando aquele criterio e filtrado.
4. Sem nenhum valor marcado em todos os campos, retorna a lista integral.
5. Nenhum registro aparece duplicado (filtro e predicado unico por avaliacao).
6. Ordenacao preservada: `atualizadoEm DESC` (ja garantida pelo endpoint).

### Resumo (`contarPorValor(avaliacoesFiltradas)`)

Para cada campo filtravel, contagem de avaliacoes por valor possivel sobre o universo ja filtrado pelos demais campos:

```ts
interface ContagensCampo {
  totalComValor: number;              // respostas nao nulas no universo
  porValor: Record<ValorCriterio | number, number>;
}
```

- O resumo de um campo considera os filtros dos outros campos (exclui o proprio), evitando contagens sempre zeradas quando o proprio valor esta filtrado.
- Totais exibidos: `totalGeral` (todas as avaliacoes da edicao), `totalFiltrado` (apos aplicar todos os filtros). Com filtros zerando o resultado, todas as contagens exibem zero coerentemente (US-2, cenario 3).

## Relacionamentos utilizados

```
edicoes 1 ──── N avaliacoes N ──── 1 equipes
                        N ──── 1 pessoas (avaliada)
                        (avaliador identificado por cracha/nome denormalizados)
```

## Estados e transicoes visiveis no relatorio

| Status | Exibicao | Efeito nos filtros |
|--------|----------|--------------------|
| `rascunho` | Badge distinta | Entra na listagem sem filtros; sai de resultados cujos filtros exijam criterio ainda nulo |
| `finalizada` | Badge distinta | Idem; `finalizadoEm` preenchido e mostrado no detalhe |

## Fora de escopo

- Novas colunas/tabelas, indices ou migracoes
- Filtros por aptidao, comentarios, equipe, avaliador ou status
- Persistencia de filtros (URL/localStorage)
- Exportacao/impressao
