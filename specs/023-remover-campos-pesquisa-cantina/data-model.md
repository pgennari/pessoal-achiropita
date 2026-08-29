# Data Model: Remover campos do formulario publico da Pesquisa da Cantina

**Feature**: [spec.md](spec.md) | **Date**: 2026-08-28

## Visao geral

A feature muda o **fluxo de escrita** (formulario publico) do dominio Cantina:
os campos "Dia da ida" (antes alimentado por `dias_festa`) e "Numero do
convite" deixam de ser coletados. O **fluxo de leitura** (area logada) e a
**estrutura fisica** permanecem: `dia_ida` e `convite` continuam existindo em
`pesquisas_cantina` para preservar respostas historicas e nao ha migracao.

## Entidades

### PesquisaCantina (modelo de leitura — inalterado)

Resposta de satisfacao enviada pelo publico. Estrutura persistida em
`pesquisas_cantina` e tipo exposto pela API autenticada (`GET
/api/cantina/pesquisas`).

| Campo             | Tipo                        | Regra                                   | Mudanca |
|-------------------|-----------------------------|-----------------------------------------|---------|
| `id`              | TEXT (PK)                   | `gen_random_uuid()`                     | —       |
| `nome`            | TEXT                        | obrigatorio                             | —       |
| `email`           | TEXT \| null                | obrigatorio so com opt-in Sim           | —       |
| `telefone`        | TEXT \| null                | opcional                                | —       |
| `dia_ida`         | DATE \| null                | novas linhas passam a vir `NULL`        | **uso** |
| `convite`         | TEXT \| null                | novas linhas passam a vir `NULL`        | **uso** |
| `deseja_informacoes` | BOOLEAN                 | `DEFAULT FALSE`                         | —       |
| `notas`           | JSONB                       | 5 criterios 1-5                         | —       |
| `recomendaria`    | TEXT                        | CHECK `IN ('Sim','Nao','Talvez')`       | —       |
| `melhorias`       | TEXT \| null                | `char_length <= 4000`                   | —       |
| `criado_em`       | TIMESTAMPTZ                 | `DEFAULT now()`                         | —       |

- **Decisao**: as colunas `dia_ida` e `convite` sao mantidas (sem `ALTER
  TABLE`). O `INSERT` do formulario deixa de cita-las, entao novas respostas
  armazenam `NULL`; respostas existentes preservam os valores.
- **Regra de estado**: colunas sao de leitura retroativa (historico); nao ha
  transicao de estado.

### DiaFesta (entidade existente — sem mudanca)

Dia em que a festa acontece (`dias_festa`), usado por presenca/formacoes.
Deixa de ser consultado pelo formulario publico.

### Modelo de escrita (DadosPesquisaForm — simplificado)

Payload enviado pelo formulario publico. Perde os campos:

- removido: `diaIda: string | null`
- removido: `convite: string | null`

Permanecem: `nome`, `email`, `telefone`, `desejaInformacoes`, `notas`,
`recomendaria`, `melhorias`.

## Relacoes

- `pesquisas_cantina` nao possui FK para `dias_festa` (a antiga validacao de
  `dia_ida` era aplicacional, feita na rota de envio). Com a remocao dos
  campos, essa validacao e eliminada junto.
- Nenhuma nova tabela, indice ou chave.

## Validacoes (fluxo de escrita apos a feature)

O `corpoSchema` do POST publico passa a aceitar somente:

- `nome`: string nao vazia apos trim (obrigatorio)
- `email`: string ou `null`; obrigatorio com formato valido quando
  `desejaInformacoes = true`
- `telefone`: string ou `null`
- `desejaInformacoes`: boolean
- `notas`: objeto com as 5 chaves (inteiros 1-5)
- `recomendaria`: `"Sim" | "Nao" | "Talvez"`
- `melhorias`: string, no maximo 4000 (ou `null`)

Chaves desconhecidas (ex.: `diaIda`/`convite` vindas de cliente antigo) sao
ignoradas pelo zod nao estrito.