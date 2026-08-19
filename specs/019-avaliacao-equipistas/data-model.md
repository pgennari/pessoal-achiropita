# Data Model: Avaliacao de Equipistas

## Entidades Novas

### LinkAvaliacao

Tabela: `links_avaliacao` (nova em `schema.sql`) | Tipo TS: `LinkAvaliacao` (novo em `src/lib/tipos.ts`)

Link de acesso publico de avaliacao, unico por edicao. Uma edicao possui um unico link ativo por vez; ao regenerar, o ativo anterior e revogado (historico mantido, mesmo padrao de `links_validacao` e `links_presenca`).

| Campo | Tipo | Origem | Descricao |
|-------|------|--------|-----------|
| `id` | `TEXT PK` | cliente (`gerarToken()`) | Token da URL publica (32 hex) |
| `edicaoId` (`edicao_id`) | `TEXT NOT NULL FK` | rota | Edicao (`edicoes.id`, `ON DELETE CASCADE`) |
| `status` | `status_link NOT NULL DEFAULT 'ativo'` | rota | `ativo` / `revogado` (enum existente) |
| `criadoPorUid` (`criado_por_uid`) | `TEXT NOT NULL` | sessao | Usuario ADM/ORG que gerou |
| `criadoPorNome` (`criado_por_nome`) | `TEXT NOT NULL` | sessao | Nome do usuario que gerou |
| `criadoEm` (`criado_em`) | `TIMESTAMPTZ` | banco | Data de criacao |

**Regras**:
- `id` = token unico (PK); nao ha expiracao por prazo nesta versao (apenas status ativo/revogado)
- Uma edicao pode ter varios registros (historico), mas apenas um `ativo` por vez
- Gerar link: revoga o ativo existente da edicao (se houver) e insere novo ativo

### Avaliacao

Tabela: `avaliacoes` (nova em `schema.sql`) | Tipo TS: `Avaliacao` (novo em `src/lib/tipos.ts`)

Registro da avaliacao de um equipista por um coordenador. Contem 6 criterios, aptidao e comentarios.

| Campo | Tipo | Origem | Descricao |
|-------|------|--------|-----------|
| `id` | `TEXT PK` | backend (UUID) | Identificador unico |
| `edicaoId` (`edicao_id`) | `TEXT NOT NULL FK` | fluxo publico | Edicao (`edicoes.id`, `ON DELETE CASCADE`) |
| `equipeId` (`equipe_id`) | `TEXT NOT NULL FK` | fluxo publico | Equipe do equipista (`equipes.id`, `ON DELETE CASCADE`) |
| `pessoaId` (`pessoa_id`) | `TEXT NOT NULL FK` | fluxo publico | Pessoa avaliada (`pessoas.id`, `ON DELETE CASCADE`) |
| `avaliadorCracha` (`avaliador_cracha`) | `INTEGER NOT NULL` | fluxo publico | Cracha do coordenador avaliador |
| `avaliadorNome` (`avaliador_nome`) | `TEXT NOT NULL` | fluxo publico | Nome do coordenador avaliador (snapshot) |
| `criterios` | `JSONB NOT NULL` | fluxo publico | `{pontualidade, dedicacao, companheirismo, espiritualidade, comprometimento, uniforme}` — cada um com valor `Otimo`/`Bom`/`Regular`/`Ruim` ou `null` |
| `aptoCoordenar` (`apto_coordenar`) | `BOOLEAN` | fluxo publico | `true` (Sim) / `false` (Nao) / `null` (nao definido) |
| `comentarios` | `TEXT` | fluxo publico | Texto livre, opcional, max 4000 chars |
| `status` | `status_avaliacao NOT NULL DEFAULT 'rascunho'` | fluxo publico | `rascunho` / `finalizada` |
| `criadoEm` (`criado_em`) | `TIMESTAMPTZ NOT NULL DEFAULT now()` | banco | Data de criacao |
| `atualizadoEm` (`atualizado_em`) | `TIMESTAMPTZ NOT NULL DEFAULT now()` | banco | Data da ultima atualizacao |
| `finalizadoEm` (`finalizado_em`) | `TIMESTAMPTZ` | fluxo publico | Data da finalizacao (null se rascunho) |

**Regras**:
- `UNIQUE(pessoa_id, edicao_id)` — maximo 1 avaliacao por equipista por edicao (rascunho ou finalizada)
- Status `rascunho`: campos `criterios`, `apto_coordenar` e `comentarios` podem ser atualizados livremente
- Status `finalizada`: nenhum campo pode ser alterado (validacao no backend impede UPDATE)
- Para finalizar: todos os 6 criterios devem ter valor nao-nulo e `apto_coordenar` deve ser nao-nulo
- `finalizadoEm` e preenchido automaticamente ao transicionar para `finalizada`

## Entidades Existentes Reutilizadas

### Edicao

Tabela: `edicoes` | Tipo TS: `Edicao` (linha 130 em `src/lib/tipos.ts`)

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `id` | `TEXT PK` | UUID |
| `numero` | `INTEGER` | Numero da edicao |
| `ano` | `INTEGER` | Ano da edicao |
| `status` | `status_edicao` | `planejamento` / `ativa` / `encerrada` |

Contexto das avaliacoes; o link publico e unico por edicao.

### Equipe

Tabela: `equipes` | Tipo TS: `Equipe` (linha 145 em `src/lib/tipos.ts`)

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `id` | `TEXT PK` | UUID |
| `edicaoId` | `TEXT NOT NULL FK` | Edicao |
| `nome` | `TEXT` | Nome da equipe |
| `setor` | `setor` | `Interna` / `Externa` / `Alimentacao` |

### Pessoa

Tabela: `pessoas` | Tipo TS: `Pessoa` (linha 95 em `src/lib/tipos.ts`)

Identificada pelo numero de `cracha` (unico). Campos usados: `id`, `cracha`, `nome`, `ativo`.

### Participacao

Tabela: `participacoes` | Tipo TS: `Participacao` (linha 198 em `src/lib/tipos.ts`)

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `id` | `TEXT PK` | UUID |
| `edicaoId` | `TEXT NOT NULL FK` | Edicao |
| `equipeId` | `TEXT NOT NULL FK` | Equipe |
| `pessoaId` | `TEXT NOT NULL FK` | Pessoa |
| `funcao` | `funcao_participacao` | `Coordenador` / `Equipista` |

Define coordenador (funcao Coordenador na edicao do link) e o vinculo equipista↔equipe. `UNIQUE(edicao_id, pessoa_id)` = uma equipe por edicao por pessoa.

## Relacionamentos

```
Edicao      1 ── N LinkAvaliacao  (links_avaliacao.edicao_id → edicoes.id)
Edicao      1 ── N Avaliacao      (avaliacoes.edicao_id → edicoes.id)
Avaliacao   N ── 1 Pessoa         (avaliacoes.pessoa_id → pessoas.id)
Avaliacao   N ── 1 Equipe         (avaliacoes.equipe_id → equipes.id)
Pessoa      N ── 1 Participacao   (participacoes.pessoa_id → pessoas.id)
Equipe      1 ── N Participacao   (participacoes.equipe_id → equipes.id)
```

## Estados

### LinkAvaliacao

| Estado | `status` | Descricao |
|--------|----------|-----------|
| Ativo | `ativo` | Acessivel pelo link publico (max. 1 por edicao) |
| Revogado | `revogado` | Link desativado (historico) |

### Avaliacao

| Estado | `status` | Descricao |
|--------|----------|-----------|
| Rascunho | `rascunho` | Editavel; criterios/aptidao podem estar incompletos |
| Finalizada | `finalizada` | Imutavel; todos os criterios e aptidao obrigatorios |

## Fluxo de Transicao de Estados

```
[LinkAvaliacao] gerar link → ativo (revoga ativo anterior) → revogar → revogado

[Avaliacao] (criacao) → rascunho ↔ finalizacao → finalizada
                 ↑                              ↓
              (edição)                      (imutavel)
```

## Validacoes (resumo, detalhes em contracts/)

- Cracha do coordenador deve existir (`pessoas.ativo`) e ter participacao `funcao = 'Coordenador'` na edicao do link
- Equipista deve ter participacao na mesma equipe do coordenador na edicao (funcao `Equipista`, exceto o proprio coordenador)
- Equipista nao pode ja possuir avaliacao na edicao (UNIQUE constraint)
- Para finalizar: todos os 6 criterios devem ter valor e `apto_coordenar` deve ser definido
- Rascunho pode ter campos incompletos
- Finalizada nao pode ser alterada (backend rejeita UPDATE quando `status = 'finalizada'`)
- Link revogado nao afeta avaliacoes existentes
