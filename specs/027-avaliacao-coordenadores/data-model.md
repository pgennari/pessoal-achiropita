# Data Model: Avaliacao de Coordenadores

Modelo derivado da spec e da pesquisa de Phase 0 (espelhando o padrao da avaliacao de equipistas, feature 019). Fonte de verdade do DDL: `schema.sql`.

## Entidades

### LinkAvaliacaoCoordenador — `links_avaliacao_coordenador`

| Campo | Tipo | Detalhe |
|---|---|---|
| `id` | TEXT PK | token da URL = referencia da edicao (`edicoes.ano`, ex.: "2026") |
| `edicao_id` | TEXT NOT NULL FK → edicoes(id) ON DELETE CASCADE | edicao alvo |
| `status` | `status_link` NOT NULL DEFAULT 'ativo' | ativo / revogado (enum existente) |
| `criado_por_uid` | TEXT NOT NULL | uid do ADM/ORG |
| `criado_por_nome` | TEXT NOT NULL | nome do ADM/ORG |
| `criado_em` | TIMESTAMPTZ NOT NULL DEFAULT now() | criacao |

Regras:
- Token = referencia (ano em texto) — unico por edicao na pratica; a API mantem no maximo um ativo por edicao (gerar revoga o anterior).
- Sem expiracao por prazo; validade so pelo status. Sem `contador_usos` (padrao `links_avaliacao`).
- `CREATE INDEX IF NOT EXISTS idx_links_avaliacao_coordenador_edicao ON links_avaliacao_coordenador(edicao_id);`

### AvaliacaoCoordenador — `avaliacoes_coordenador`

| Campo | Tipo | Detalhe |
|---|---|---|
| `id` | TEXT PK DEFAULT gen_random_uuid()::text | uuid |
| `edicao_id` | TEXT NOT NULL FK → edicoes(id) ON DELETE CASCADE | edicao |
| `equipe_pai_id` | TEXT NOT NULL FK → equipes(id) ON DELETE CASCADE | equipe do avaliador (APOIO) |
| `equipe_filha_id` | TEXT NOT NULL FK → equipes(id) ON DELETE CASCADE | equipe do avaliado |
| `avaliador_pessoa_id` | TEXT NOT NULL FK → pessoas(id) ON DELETE CASCADE | avaliador identificado pelo cracha |
| `avaliador_cracha` | INTEGER NOT NULL | snapshot do cracha do avaliador |
| `avaliador_nome` | TEXT NOT NULL | snapshot do nome do avaliador |
| `pessoa_id` | TEXT NOT NULL FK → pessoas(id) ON DELETE CASCADE | coordenador avaliado |
| `permanencia` | TEXT | Q1: Sim / Sim, com algumas ressalvas / Nao tenho certeza / Nao |
| `lideranca` | TEXT | Q2: Excelente / Bom / Regular / Pouco / Nao possui |
| `ponto_positivo` | TEXT | Q3 aberta (min 20 / max 4000) |
| `aspecto_melhorar` | TEXT | Q4 aberta (min 20 / max 4000) |
| `situacao_registrar` | TEXT | Q5 aberta (min 20 / max 4000) |
| `recomendacao` | TEXT | Q6 aberta (min 20 / max 4000) |
| `status` | TEXT NOT NULL DEFAULT 'rascunho' | `rascunho` / `finalizada` (integridade na API, como `avaliacoes`) |
| `criado_em` | TIMESTAMPTZ NOT NULL DEFAULT now() | criacao |
| `atualizado_em` | TIMESTAMPTZ NOT NULL DEFAULT now() | ultima atualizacao |
| `finalizado_em` | TIMESTAMPTZ | null enquanto rascunho |

Constraints e indices:
- `UNIQUE(edicao_id, avaliador_pessoa_id, pessoa_id, equipe_filha_id)` — no maximo uma avaliacao por (edicao, avaliador, alvo, equipe filha) (FR-022).
- `idx_avaliacoes_coordenador_edicao ON avaliacoes_coordenador(edicao_id);`
- `idx_avaliacoes_coordenador_pessoa ON avaliacoes_coordenador(pessoa_id);`
- `idx_avaliacoes_coordenador_filha ON avaliacoes_coordenador(equipe_filha_id);`
- `idx_avaliacoes_coordenador_avaliador ON avaliacoes_coordenador(avaliador_pessoa_id);`

Nota: colunas de questionario fixas e tipadas (nao JSONB) — questionario fixo (FR-016). Limite maximo 4000 alinhado aos campos textuais existentes; minimo 20 validado pela API.

### Entidades existentes reutilizadas

- **Equipe** (`equipes`): `id, edicao_id, nome, setor, equipe_pai_id, raiz, excluida`. Hierarquia: filha = `equipe_pai_id` apontando para a equipe-pai, mesma edicao, `excluida = FALSE`. Tipo em `src/lib/tipos.ts:145`, DDL em `schema.sql:124-140`.
- **Participacao** (`participacoes`): `id, edicao_id, equipe_id, pessoa_id, funcao` (`Coordenador`/`Equipista`, enum em `schema.sql:11`), `UNIQUE(edicao_id, pessoa_id)`. Fonte autoritativa de quem e coordenador e em qual equipe (pesquisa item 4).
- **Pessoa** (`pessoas`): `id, cracha, nome, ativo, excluida`. A identificacao publica exige `ativo = true` e `excluida = false`.
- **Edicao** (`edicoes`): `id, numero, ano, status`. `ano` e a referencia do link (ex.: 2026).

## Identificacao e elegibilidade (fluxo publico)

1. Cracha existe, `ativo=true`, `excluida=false`.
2. Participacao `funcao='Coordenador'` na edicao do link (`UNIQUE(edicao_id, pessoa_id)` ⇒ no maximo uma equipe coordenada por pessoa, mas a pessoa pode ter coordenado em outra edicao; a regra de "coordenar mais de uma equipe" da spec refere-se a historico de participacoes — na tabela atual o vínculo e UNIQUE(edicao, pessoa). Se futuro suportar multiplas equipes na mesma edicao, a regra segue por equipe e a sessao usa `equipeIds[]`).
3. Ao menos uma equipe coordenada: `UPPER(nome) LIKE '%APOIO%'` E possui filha (`equipes` com `equipe_pai_id` = equipe.id, mesma edicao, `excluida = FALSE`).

Alvos (listagem): pessoas com `funcao='Coordenador'`, `ativo=true`, em equipes filhas das equipes qualificadas, `excluidas` a pessoa `excluida=false`, excluindo o proprio avaliador e equipes sem coordenador. Agrupamento por `equipe_filha` quando > 1.

## Transicoes de estado

```text
LinkAvaliacaoCoordenador: gerar link (revoga ativo anterior) → ativo → revogar → revogado
                          (nunca reativo automaticamente; ADM/ORG pode gerar de novo)

AvaliacaoCoordenador:  (criacao) → rascunho ──finalizacao──→ finalizada (imutavel)
                       rascunho ↔ edicao livre (autosave 2s)
```

- Revogacao/geracao do link NAO altera avaliacoes ja iniciadas (FR-025/FR-026).
- Mudanca em equipe (nome sem APOIO, filhas alteradas) reflete no proximo acesso; avaliacoes persistidas permanecem (edge cases da spec).
- `finalizada` nao pode ser editada nem excluida; impedido no backend (409) e nao exibido no frontend.

## Datas e auditabilidade

- Timestamps ISO-8601 (`TIMESTAMPTZ`, serializados como `YYYY-MM-DDTHH:mm:ssZ` via postgres.js).
- Eventos de auditoria (tabela `auditoria`, `api/src/auditoria.ts`): `avaliacaoCoordenadorLink.gerou`, `avaliacaoCoordenadorLink.revogou`, `avaliacaoCoordenador.identificou`.