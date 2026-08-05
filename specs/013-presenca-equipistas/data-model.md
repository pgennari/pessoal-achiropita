# Data Model: Presenca de Equipistas

## Entidades Novas

### LinkPresenca

Tabela: `links_presenca` (nova em `schema.sql`) | Tipo TS: `LinkPresenca` (novo em `src/lib/tipos.ts`)

Link de acesso publico de presenca de um dia da festa. Um dia possui um unico link ativo por vez; ao regenerar, o ativo anterior e revogado (historico mantido, mesmo padrao de `links_validacao`).

| Campo | Tipo | Origem | Descricao |
|-------|------|--------|-----------|
| `id` | `TEXT PK` | cliente (`gerarToken()`) | Token da URL publica (32 hex) |
| `diaFestaId` (`dia_festa_id`) | `TEXT NOT NULL FK` | rota | Dia da festa vinculado (`dias_festa.id`, `ON DELETE CASCADE`) |
| `edicaoId` (`edicao_id`) | `TEXT NOT NULL FK` | rota | Edicao (`edicoes.id`, `ON DELETE CASCADE`) — denormalizada para filtros |
| `status` | `status_link NOT NULL DEFAULT 'ativo'` | rota | `ativo` / `revogado` (enum existente) |
| `criadoPorUid` (`criado_por_uid`) | `TEXT NOT NULL` | sessao | Usuario ADM/ORG que gerou |
| `criadoPorNome` (`criado_por_nome`) | `TEXT NOT NULL` | sessao | Nome do usuario que gerou |
| `criadoEm` (`criado_em`) | `TIMESTAMPTZ` | banco | Data de criacao |

**Regras**:
- `id` = token unico (PK); nao ha expiracao por prazo nesta versao (apenas status ativo/revogado, conforme spec)
- Um dia pode ter varios registros (historico), mas apenas um `ativo` por vez
- Gerar link: revoga o ativo existente do dia (se houver) e insere novo ativo

### Presenca

Tabela: `presencas` (nova em `schema.sql`) | Tipo TS: `Presenca` (novo em `src/lib/tipos.ts`)

Registro de presenca de um equipista em um dia da festa.

| Campo | Tipo | Origem | Descricao |
|-------|------|--------|-----------|
| `id` | `TEXT PK` | backend | `${diaFestaId}__${pessoaId}` |
| `diaFestaId` (`dia_festa_id`) | `TEXT NOT NULL FK` | fluxo publico | Dia (`dias_festa.id`, `ON DELETE CASCADE`) |
| `edicaoId` (`edicao_id`) | `TEXT NOT NULL FK` | fluxo publico | Edicao (`edicoes.id`, `ON DELETE CASCADE`) |
| `equipeId` (`equipe_id`) | `TEXT NOT NULL FK` | fluxo publico | Equipe do equipista (`equipes.id`, `ON DELETE CASCADE`) |
| `pessoaId` (`pessoa_id`) | `TEXT NOT NULL FK` | fluxo publico | Pessoa registrada (`pessoas.id`, `ON DELETE CASCADE`) |
| `pessoaNome` (`pessoa_nome`) | `TEXT NOT NULL` | fluxo publico | Snapshot do nome (imune a renomeacao posterior) |
| `cracha` | `INTEGER NOT NULL` | fluxo publico | Snapshot do numero do cracha |
| `confirmadoPorCracha` (`confirmado_por_cracha`) | `INTEGER NOT NULL` | fluxo publico | Cracha do coordenador que confirmou |
| `confirmadoPorNome` (`confirmado_por_nome`) | `TEXT NOT NULL` | fluxo publico | Nome do coordenador que confirmou |
| `registradoEm` (`registrado_em`) | `TIMESTAMPTZ NOT NULL DEFAULT now()` | banco | Data/hora do registro |

**Regras**:
- `UNIQUE(dia_festa_id, pessoa_id)` — um equipista so pode ter uma presenca por dia
- Idempotencia: `INSERT ... ON CONFLICT (id) DO NOTHING` — confirmacoes repetidas nao duplicam
- Sem UPDATE/DELETE via API nesta versao (presenca confirmada e definitiva)

## Entidades Existentes Reutilizadas

### DiaFesta

Tabela: `dias_festa` | Tipo TS: `DiaFesta` (linha 157 em `src/lib/tipos.ts`)

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `id` | `TEXT PK` | UUID |
| `edicaoId` | `TEXT NOT NULL FK` | Edicao da festa |
| `data` | `DATE` | Data do dia (numeracao derivada da ordem cronologica) |

Base das abas da tela interna de Presenca (edicao ativa) e do vinculo `dia` no fluxo publico.

### Participacao

Tabela: `participacoes` | Tipo TS: `Participacao` (linha 198 em `src/lib/tipos.ts`)

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `id` | `TEXT PK` | UUID |
| `edicaoId` | `TEXT NOT NULL FK` | Edicao |
| `equipeId` | `TEXT NOT NULL FK` | Equipe |
| `pessoaId` | `TEXT NOT NULL FK` | Pessoa |
| `funcao` | `funcao_participacao` | `Coordenador` / `Equipista` / `Apoio` |

Define coordenador (funcao Coordenador na edicao do dia) e o vinculo equipista↔equipe. `UNIQUE(edicao_id, pessoa_id)` = uma equipe por edicao por pessoa.

### Pessoa

Tabela: `pessoas` | Tipo TS: `Pessoa` (linha 95 em `src/lib/tipos.ts`)

Identificada pelo numero de `cracha` (unico). Campos usados: `id`, `cracha`, `nome`, `ativo`.

## Relacionamentos

```
DiaFesta 1 ── N LinkPresenca   (links_presenca.dia_festa_id → dias_festa.id)
DiaFesta 1 ── N Presenca        (presencas.dia_festa_id → dias_festa.id)
Presenca  N ── 1 Pessoa         (presencas.pessoa_id → pessoas.id)
Presenca  N ── 1 Equipe         (presencas.equipe_id → equipes.id)
Pessoa    N ── 1 Participacao   (participacoes.pessoa_id → pessoas.id)
Equipe    1 ── N Participacao   (participacoes.equipe_id → equipes.id)
```

## Estados

### LinkPresenca

| Estado | `status` | Descricao |
|--------|----------|-----------|
| Ativo | `ativo` | Acessivel pelo link publico (max. 1 por dia) |
| Revogado | `revogado` | Link desativado (historico) |

### Presenca (por dia + pessoa)

| Estado | Descricao |
|--------|-----------|
| Nao registrada | Equipista ainda nao confirmou presenca no dia |
| Registrada | Equipista confirmado para o dia (sem transicoes nesta versao) |

## Fluxo de Transicao de Estados

```
[LinkPresenca] gerar link → ativo (revoga ativo anterior) → revogar → revogado

[Presenca] nao registrada → confirmacao do coordenador → registrada
```

## Validacoes (resumo, detalhes em contracts/)

- Cracha do coordenador deve existir (`pessoas.ativo`) e ter participacao `funcao = 'Coordenador'` na edicao do dia
- Equipista deve ter participacao na mesma equipe do coordenador na edicao (funcao `Equipista` ou `Apoio`, exceto o proprio coordenador)
- Equipista nao pode ja possuir presenca no dia
- Confirmacao revalida cada item no servidor antes de gravar
