# Importação da planilha legada → PostgreSQL

Arquivos `.sql` para popular o banco do app (Neon) com os dados da
planilha histórica da Festa. Cobrem US-13-01 a US-13-04.

## Pré-requisitos

1. `schema.sql` (raiz do repo) já aplicado no banco-destino.
2. Acesso SQL ao banco (Neon Console → SQL Editor ou `psql`).

## Ordem de execução

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f 01-edicoes.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f 02-barracas.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f 03-pessoas.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f 04-participacoes.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f 05-participacoes-historicas.sql
```

Ou em uma chamada só:

```sh
cat 0*.sql | psql "$DATABASE_URL" -v ON_ERROR_STOP=1
```

A ordem importa por causa das FKs: edições → barracas (FK edicao_id),
pessoas, participações (FK pessoa_id + barraca_id + edicao_id),
participações históricas (FK pessoa_id).

## O que tem em cada arquivo

| Arquivo                             | Tabela                     | Linhas |
|-------------------------------------|----------------------------|--------|
| `01-edicoes.sql`                    | `edicoes`                  | 27     |
| `02-barracas.sql`                   | `barracas` (edição 100)    | 103    |
| `03-pessoas.sql`                    | `pessoas`                  | 5.869  |
| `04-participacoes.sql`              | `participacoes` (ed. 100)  | 1.260  |
| `05-participacoes-historicas.sql`   | `participacoes_historicas` | 28.433 |

- **Edições**: 74 a 100 (anos 2000 a 2026). Status: `100 = 'ativa'`,
  demais = `'encerrada'`. Datas `inicio`/`fim` são placeholders
  (1–31 de agosto) — ADM ajusta no app.
- **Barracas**: extraídas da coluna BARRACA 100 da planilha. Setor
  inferido por palavras-chave (heurística). Vagas = 0; ORG configura.
- **Pessoas**: todas as 5.871 linhas com nome — 2 descartadas por
  crachá duplicado, restantes 5.869 importadas.
- **Participações da edição 100**: par (pessoa, barraca, função)
  extraído da coluna BARRACA 100 + FUNÇÃO. Respeita o `UNIQUE(edicao_id,
  pessoa_id)` do schema.
- **Participações históricas (74–99)**: somente texto
  (`barraca_nome`), sem FK a `barracas`. Usado pela página de
  Histórico (US-12-01).

## Idempotência

Todos os arquivos usam IDs determinísticos (`pessoa-cracha-NNNNN`,
`barraca-100-<slug>`, etc.) e `ON CONFLICT … DO NOTHING`. Pode rodar a
sequência inteira **n vezes** que o resultado é o mesmo. Útil para
re-tentar após erro de rede ou para re-importar depois de ajustes na
planilha de origem.

## Dados pendentes / a revisar

Após a importação:

```sql
-- Pessoas com nascimento sentinela (data real estava em branco na planilha)
SELECT cracha, nome FROM pessoas
WHERE observacoes LIKE '%NASCIMENTO PENDENTE%'
ORDER BY cracha;
```

Esperado: ~1.226 pessoas. O texto `[NASCIMENTO PENDENTE]` aparece no
início do campo observações; remova quando preencher a data real.

```sql
-- Pessoas marcadas como inativas (planilha tinha "faleceu" no histórico)
SELECT cracha, nome FROM pessoas WHERE ativo = FALSE;
```

Esperado: ~4 pessoas.

Ver também `relatorio-importacao.json`:
- `descartadas` — pessoas que não entraram (crachá ausente/duplicado).
- `avisos` — pessoas que entraram com algum campo problemático
  (CPF inválido, data de filho não reconhecida, etc.).
- `contadores.nascimentoSentinela` — quantas receberam a data
  `1900-01-01` como sentinela.

## Reverter

```sql
-- Apaga só os dados importados (preserva schema). Em ordem inversa às FKs.
DELETE FROM participacoes_historicas WHERE id LIKE 'historica-%';
DELETE FROM participacoes WHERE id LIKE 'participacao-%';
DELETE FROM pessoas WHERE id LIKE 'pessoa-cracha-%';
DELETE FROM barracas WHERE id LIKE 'barraca-100-%';
DELETE FROM edicoes WHERE id LIKE 'edicao-%';
```

## Regenerar a partir da planilha

Se a planilha mudar, ou se algum tratamento precisar ser ajustado:

```sh
node scripts/gerar-sql-importacao.mjs --file=/caminho/para/planilha.xlsx
```

Opções:
- `--saida=<dir>` — pasta de saída (default `scripts/sql-importacao/`).
- `--limit=N` — processa só as N primeiras linhas (debug).

O gerador é one-shot, segue o estilo de `importar-planilha.mjs` (do
era Firestore) e `import-edicoes-barracas.mjs`. Não tem teste automatizado:
após regenerar, confira o `relatorio-importacao.json` e rode os SQLs
contra um banco de teste antes de aplicar em produção.
