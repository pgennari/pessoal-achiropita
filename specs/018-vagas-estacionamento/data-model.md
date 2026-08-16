# Data Model: Vagas de Estacionamento

## Entidades Novas

### Vaga

Tabela: `vagas` (nova em `schema.sql`) | Tipo TS: `Vaga` (novo em `src/lib/tipos.ts`)

Vaga de estacionamento disponibilizada pela festa aos voluntarios. Possui identificacao, pode estar associada a no maximo um estacionamento (0..1) e a uma ou mais pessoas (via `pessoa_vaga`).

| Campo | Tipo | Origem | Descricao |
|-------|------|--------|-----------|
| `id` | `TEXT PK DEFAULT gen_random_uuid()::text` | banco | Identificador unico |
| `identificacao` | `TEXT NOT NULL` | rota (POST/PUT) | Nome/etiqueta da vaga (ex.: "A1", "Setor B"); nao ha numeracao automatica |
| `estacionamento_id` | `TEXT? FK` | rota (POST/PUT) | Estacionamento associado (`estacionamentos.id`, `ON DELETE SET NULL`). `NULL` = vaga sem estacionamento |
| `criado_em` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | banco | Data de criacao |
| `atualizado_em` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | banco | Data da ultima alteracao |

**Regras**:
- Uma vaga em no maximo um estacionamento (FR-003) — cardinalidade natural da coluna FK simples
- Exclusao do estacionamento mantem a vaga e a deixa sem estacionamento (FR-020) — `ON DELETE SET NULL`
- Vagas contratadas cheias nao bloqueiam associacao (FR-019) — nenhuma validacao de capacidade no banco

### PessoaVaga (vinculo pessoa ↔ vaga)

Tabela: `pessoa_vaga` (nova em `schema.sql`) | Tipo TS: `PessoaVaga` (novo em `src/lib/tipos.ts`)

Permite que uma vaga tenha mais de uma pessoa (FR-002) e garante que uma pessoa esteja em no maximo uma vaga (FR-006).

| Campo | Tipo | Origem | Descricao |
|-------|------|--------|-----------|
| `pessoa_id` | `TEXT PK` | rota (POST/PUT) | FK → `pessoas.id` (`ON DELETE CASCADE`) |
| `vaga_id` | `TEXT NOT NULL` | rota (POST/PUT) | FK → `vagas.id` (`ON DELETE CASCADE`) |
| `criado_em` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | banco | Data do vinculo |

**Regras**:
- `PRIMARY KEY (pessoa_id)` — uma pessoa em no maximo uma vaga (FR-006) garantido no banco
- Indice em `vaga_id` — uma vaga com varias pessoas (FR-002) e listagem de vagas por estacionamento
- `ON DELETE CASCADE` nas duas FKs — excluir pessoa/vaga remove o vinculo sem orfao
- Pessoa inativada permanece vinculada (`pessoa_vaga` intacta); a derivacao de estacionamento ignora pessoas inativas (FR-021)

```sql
CREATE TABLE IF NOT EXISTS vagas (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  identificacao     TEXT NOT NULL,
  estacionamento_id TEXT REFERENCES estacionamentos(id) ON DELETE SET NULL,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pessoa_vaga (
  pessoa_id   TEXT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  vaga_id     TEXT NOT NULL REFERENCES vagas(id) ON DELETE CASCADE,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (pessoa_id)
);

CREATE INDEX IF NOT EXISTS idx_pessoa_vaga_vaga_id ON pessoa_vaga (vaga_id);
CREATE INDEX IF NOT EXISTS idx_vagas_estacionamento_id ON vagas (estacionamento_id);
```

### HistoricoEstacionamentoVaga (historico vaga ↔ estacionamento)

Tabela: `vaga_estacionamento_historico` (nova em `schema.sql`) | Tipo TS: `HistoricoEstacionamentoVaga` (novo em `src/lib/tipos.ts`)

Historico append-only das mudancas de estacionamento da vaga (FR-012), no mesmo padrao da tabela legada `veiculo_estacionamento_historico`. Cada associacao (inclusive a inicial, na criacao da vaga), transferencia e desassociacao gera uma linha, exibida no detalhe da vaga.

| Campo | Tipo | Origem | Descricao |
|-------|------|--------|-----------|
| `id` | `TEXT PK DEFAULT gen_random_uuid()::text` | banco | Identificador unico |
| `vaga_id` | `TEXT NOT NULL` | sistema | FK → `vagas.id` (`ON DELETE CASCADE`) |
| `estacionamento_id` | `TEXT? FK` | sistema | Estacionamento associado no evento (`estacionamentos.id`, `ON DELETE SET NULL`); `NULL` na desassociacao |
| `estacionamento_nome` | `TEXT NOT NULL` | sistema | Snapshot do nome no evento (preserva o nome mesmo se renomeado/excluido) |
| `operacao` | `TEXT NOT NULL` | sistema | `'associar'` \| `'transferir'` \| `'desassociar'` |
| `autor` | `TEXT NOT NULL` | sistema | UID do autor (da sessao `comAuth`) |
| `autor_nome` | `TEXT NOT NULL` | sistema | Nome do autor |
| `criado_em` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | banco | Data do evento |

**Regras**:
- Append-only: sem UPDATE/DELETE via API (mesmo padrao da tabela legada); leitura exige `vaga.detalhe`
- Criacao da vaga com estacionamento grava `operacao = 'associar'` (associacao inicial — FR-012)
- Troca de estacionamento grava `operacao = 'transferir'` com o novo `estacionamento_id`
- Desassociacao (`estacionamentoId: null`) grava `operacao = 'desassociar'` com `estacionamento_id = NULL`
- Dados legados sao migrados por backfill (script `scripts/backfill-vaga-estacionamento-historico.sql`, idempotente); registros sem vaga correspondente permanecem em `veiculo_estacionamento_historico` (FR-024/SC-008)

```sql
CREATE TABLE IF NOT EXISTS vaga_estacionamento_historico (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  vaga_id             TEXT NOT NULL REFERENCES vagas(id) ON DELETE CASCADE,
  estacionamento_id   TEXT REFERENCES estacionamentos(id) ON DELETE SET NULL,
  estacionamento_nome TEXT NOT NULL,
  operacao            TEXT NOT NULL, -- 'associar' | 'transferir' | 'desassociar'
  autor               TEXT NOT NULL,
  autor_nome          TEXT NOT NULL,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vaga_est_hist_vaga
ON vaga_estacionamento_historico(vaga_id, criado_em DESC);
```

## Entidades Existentes Alteradas

### Veiculo

Tabela: `veiculos` | Tipo TS: `Veiculo`

| Ajuste | Detalhe |
|--------|---------|
| Remover `estacionamento_id` | `ALTER TABLE veiculos DROP COLUMN IF EXISTS estacionamento_id;` — fim do vinculo direto veiculo↔estacionamento (FR-011) |
| Remover indice `idx_veiculos_estacionamento` | Remove junto com a coluna |
| `estacionamentoId?` → `estacionamentos[]` | O tipo passa a expor os estacionamentos **derivados** das vagas das pessoas vinculadas (FR-010), como lista `{ id, nome }[]` (multi-valor) |

### Pessoa

Tabela: `pessoas` | Tipo TS: `Pessoa`

| Ajuste | Detalhe |
|--------|---------|
| Remover `estacionamento_id` | `ALTER TABLE pessoas DROP COLUMN IF EXISTS estacionamento_id;` — fim da associacao direta pessoa↔estacionamento (FR-007) |
| `estacionamentoId?/estacionamentoNome?` → derivados da vaga | A rota retorna `vagaId`, `vagaIdentificacao`, `estacionamentoId`, `estacionamentoNome` calculados por join `pessoa_vaga → vagas → estacionamentos` (FR-008). `tem_estacionamento` (flag) e mantido como esta — nao e a associacao |
| `pessoas.associar` | Permissao do catalogo mantida para outros vinculos (equipes); a associacao a estacionamento via pessoa deixa de existir |

### Estacionamento

Tabela: `estacionamentos` | Tipo TS: `Estacionamento`

| Ajuste | Detalhe |
|--------|---------|
| `vagas_distribuidas` deixa de ser manual | `ALTER TABLE estacionamentos DROP COLUMN IF EXISTS vagas_distribuidas;` — a contagem passa a ser calculada (FR-016) |
| Resposta com `vagasDistribuidas` calculada | `GET /api/estacionamentos` e `GET /api/estacionamentos/:id` retornam `vagasDistribuidas = COUNT(vagas WHERE estacionamento_id = id)` (query LEFT JOIN) |
| `vagasContratadas` permanece | Base dos indicadores de lotacao e porcentagem de vagas distribuídas (FR-014/FR-015) |

### Checkin

Tabela: `checkins` | Tipo TS: `Checkin`

Sem mudanca de schema. `carro_id` continua apontando o veiculo e `estacionamento_id` o estacionamento do check-in registrado (historico preservado).

### Removido

| Objeto | Motivo |
|--------|--------|
| Rota `GET /api/veiculos/:id/historico-estacionamentos` | Veiculo nao exibe mais historico de associacao (FR-012) |
| Tipo TS `HistoricoEstacionamentoVeiculo` / `OperacaoHistoricoEstacionamento` | Removidos junto com a rota e a secao da tela `VeiculoDetalhe.tsx` |

> **Legado preservado**: a tabela `veiculo_estacionamento_historico` **nao e removida**. Permanece no banco, oculta e sem novas escritas; seus dados sao migrados por backfill para `vaga_estacionamento_historico` (via pessoas do veiculo → vaga, deduplicado) e os registros sem vaga correspondente permanecem nela (FR-024, confirmado em clarificacao).

### Permissoes (catalogo)

Novos codigos no seed de `permissoes` (idempotente, `INSERT ... ON CONFLICT (codigo) DO NOTHING`):

| Codigo | Rotulo | Descricao | Concede a |
|--------|--------|-----------|-----------|
| `vaga.lista` | Vagas: ver lista | Ver a listagem de vagas | ORG, CRD, OPC (via seed) |
| `vaga.detalhe` | Vagas: ver detalhes | Ver os detalhes de uma vaga | ORG, CRD, OPC (via seed) |
| `vaga.incluir` | Vagas: incluir | Cadastrar novas vagas | ORG (via seed) |
| `vaga.editar` | Vagas: editar | Editar vaga (identificacao, pessoas, estacionamento) | ORG (via seed) |

Desativados (`UPDATE permissoes SET ativo = FALSE`):

| Codigo | Motivo |
|--------|--------|
| `estacionamento.associar` | Descrevia associar veiculo/pessoa a estacionamento — conceito removido |
| `veiculos.associar` | Descrevia associar veiculo a estacionamento — conceito removido |

ADM e superuser via `pode()` (recebe qualquer permissao nova sem seed). Perfis com codigos desativados gravados mantem o codigo no banco, mas a sessao so carrega ativos.

## Relacionamentos

```
Vaga         N ── 1 Estacionamento   (vagas.estacionamento_id, 0..1 por vaga, SET NULL)
Pessoa       1 ── 0..1 Vaga          (pessoa_vaga.pessoa_id PK, CASCADE)
Vaga         1 ── N Pessoa           (pessoa_vaga.vaga_id, CASCADE)
Vaga         1 ── N HistoricoEstacionamentoVaga  (vaga_estacionamento_historico.vaga_id, append-only, CASCADE)
Veiculo      N ── M Pessoa           (pessoa_veiculo, ja existente)
Estacionamento derivado de veiculo   (veiculo → pessoa_veiculo → pessoas(ativo) → pessoa_vaga → vagas → estacionamentos)
```

## Estados

### Vaga

| Estado | `estacionamento_id` | Descricao |
|--------|---------------------|-----------|
| Sem estacionamento | `NULL` | Vaga criada sem estacionamento ou estacionamento excluido (FR-020) |
| Associada | id valido | Vaga pertence a um estacionamento; conta em `vagasDistribuidas` do mesmo |

Transicoes via `PUT /api/vagas/:id` (`estacionamentoId` novo ou `null`). Ao trocar de estacionamento, a contagem dos dois estacionamentos envolvidos muda automaticamente (FR-004), pois e derivada. Cada mudanca de `estacionamento_id` grava uma linha em `vaga_estacionamento_historico` (associar na criacao, transferir, desassociar — FR-012).

### Migracao do historico legado (backfill)

Script SQL idempotente `scripts/backfill-vaga-estacionamento-historico.sql` (padrao de `scripts/backfill-historico-alocacao.sql`), rodado **apos a adocao das vagas** (as vagas precisam existir e estar vinculadas as pessoas para o mapeamento). Logica em um unico `INSERT ... SELECT ... WHERE NOT EXISTS`, em transacao:

1. Para cada registro de `veiculo_estacionamento_historico` (em ordem de `criado_em`):
   - Resolve as pessoas ativas do veiculo (`pessoa_veiculo → pessoas(ativo)`).
   - Para cada pessoa com vaga (`pessoa_vaga`), cria em `vaga_estacionamento_historico` o registro correspondente (mesmo `estacionamento_nome`, `operacao`, `autor`, `autor_nome`, `criado_em`), salvo se ja existir registro identico para a vaga/evento (`WHERE NOT EXISTS` — deduplicado, SC-008).
2. Registro sem pessoa ativa ou cujas pessoas nao tenham vaga → permanece em `veiculo_estacionamento_historico` (nada e apagado).
3. `SELECT` de contagem ao final (total legado, migrados, mantidos) para validacao de SC-008.

O mapeamento nao e 1:1 (um veiculo pode ter varias pessoas com vagas distintas) — por isso o backfill deduplica por vaga e preserva o que nao migra.

### Fluxo de Transicao

```
[Vaga] criar → sem estacionamento | associada → mover estacionamento → associada (outro)
                                    → desassociar (estacionamentoId=null) → sem estacionamento
```

- Pessoa vinculada a vaga e inativada → `pessoa_vaga` permanece; a vaga deixa de derivar estacionamento para aquela pessoa (FR-021)
- Estacionamento excluido → vaga fica `estacionamento_id = NULL` (FR-020)

## Validacoes (resumo, detalhes em contracts/)

- `identificacao`: obrigatoria, nao vazia apos trim, max 80 (FR-001)
- `estacionamentoId`: opcional; se presente deve existir (`404`); capacidade estourada nao bloqueia (FR-019)
- `pessoaIds`: lista unica (sem duplicados na mesma vaga — FR-005); pessoa ja vinculada a outra vaga → `409` informando a vaga (FR-006)
- Mover a vaga: qualquer estacionamento valido (incluindo outro) ou `null` (FR-003/FR-004)
- Rotas de vaga exigem `vaga.lista/detalhe/incluir/editar` conforme a operacao; o historico exige `vaga.detalhe`
