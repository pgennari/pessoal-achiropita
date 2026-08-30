# Data Model: Avaliacao de Coordenadores pelo Equipista

Modelo derivado da spec, do research (Phase 0) e do padrao das features 019 e 027. Fonte de verdade do DDL: `schema.sql`.

## Entidades novas

### LinkAvaliacaoEquipista — `links_avaliacao_equipista`

| Campo | Tipo | Detalhe |
|---|---|---|
| `id` | TEXT PK | referencia da edicao (`edicoes.ano` em texto, ex.: "2026") — vai na URL publica |
| `edicao_id` | TEXT NOT NULL FK → edicoes(id) ON DELETE CASCADE | edicao alvo |
| `status` | `status_link` NOT NULL DEFAULT 'ativo' | ativo / revogado (enum existente) |
| `criado_por_uid` | TEXT NOT NULL | uid do ADM/ORG |
| `criado_por_nome` | TEXT NOT NULL | nome do ADM/ORG |
| `criado_em` | TIMESTAMPTZ NOT NULL DEFAULT now() | criacao |

Regras:
- Token = referencia (ano em texto), unicidada na pratica: gerar um novo revoga o ativo anterior. Manter "1 ativo por edicao" via `CREATE UNIQUE INDEX ... ON links_avaliacao_equipista(edicao_id) WHERE status='ativo'` (mesmo padrao da 027) OU por controle na API ao gerar (revoga o anterior antes de inserir).
- Sem expiracao por prazo; validade so pelo status. Sem `contador_usos`.
- `CREATE INDEX IF NOT EXISTS idx_links_avaliacao_equipista_edicao ON links_avaliacao_equipista(edicao_id);`

### AvaliacaoEquipistaCoordenador — `avaliacoes_equipista_coordenador`

| Campo | Tipo | Detalhe |
|---|---|---|
| `id` | TEXT PK DEFAULT gen_random_uuid()::text | uuid |
| `edicao_id` | TEXT NOT NULL FK → edicoes(id) ON DELETE CASCADE | edicao |
| `equipe_id` | TEXT NOT NULL FK → equipes(id) ON DELETE CASCADE | equipe do equipista avaliador (de onde vem os coordenadores-alvo) |
| `avaliador_pessoa_id` | TEXT NOT NULL FK → pessoas(id) ON DELETE CASCADE | equipista identificado pelo cracha e confirmado |
| `avaliador_cracha` | INTEGER NOT NULL | snapshot do cracha do equipista |
| `avaliador_nome` | TEXT NOT NULL | snapshot do nome do equipista |
| `pessoa_id` | TEXT NOT NULL FK → pessoas(id) ON DELETE CASCADE | coordenador avaliado (alvo) |
| `criterios` | JSONB NOT NULL DEFAULT '{}' | 6 criterios da Avaliacao do Equipista: `pontualidade`, `dedicacao`, `companheirismo`, `espiritualidade`, `comprometimento`, `uniforme` — valores `Otimo`/`Bom`/`Regular`/`Ruim` ou null |
| `comentarios` | TEXT | campo aberto opcional "Comentarios e Sugestoes" |
| `status` | TEXT NOT NULL DEFAULT 'finalizada' | sempre `finalizada` (nao ha rascunho; a avaliacao so existe ao finalizar) |
| `criado_em` | TIMESTAMPTZ NOT NULL DEFAULT now() | criacao (momento da finalizacao) |
| `atualizado_em` | TIMESTAMPTZ NOT NULL DEFAULT now() | ultima atualizacao |
| `finalizado_em` | TIMESTAMPTZ NOT NULL DEFAULT now() | sempre preenchida (nao ha rascunho) |

Constraints e indices:
- `UNIQUE(edicao_id, avaliador_pessoa_id, pessoa_id)` — no maximo uma avaliacao por (edicao, equipista, coordenador-alvo) (FR-018). A equipe nao entra no UNIQUE porque a pessoa (equipista) tem uma unica equipe por edicao (UNIQUE(edicao, pessoa) de `participacoes`).
- `idx_avaliacoes_equipista_coord_edicao ON avaliacoes_equipista_coordenador(edicao_id);`
- `idx_avaliacoes_equipista_coord_pessoa ON avaliacoes_equipista_coordenador(pessoa_id);`
- `idx_avaliacoes_equipista_coord_avaliador ON avaliacoes_equipista_coordenador(avaliador_pessoa_id);`

Nota: os 6 criterios sao gravados em JSONB (padrao da 019), pois o questionario deriva dos criterios de equipista. `comentarios` em coluna TEXT. O campo "chances de convidar novamente" e "Apto a Coordenar?" NAO sao persistidos (removidos por clarificacao).

## Entidades existentes reutilizadas

- **Pessoa** (`pessoas`): `id, cracha, nome, ativo, excluida, bloqueada, foto_url`. Identificacao publica exige `ativo = true` e `excluida = false`. `foto_url` (R2) usada na tela de confirmacao de identidade.
- **Participacao** (`participacoes`): `id, edicao_id, equipe_id, pessoa_id, funcao` (`Coordenador`/`Equipista`, enum em `schema.sql:11`), `UNIQUE(edicao_id, pessoa_id)`. Define: (a) o equipista avaliador (`funcao='Equipista'`) e sua equipe; (b) os coordenadores-alvo (`funcao='Coordenador'`) da mesma equipe.
- **Equipe** (`equipes`): `id, edicao_id, nome, setor, equipe_pai_id, raiz, excluida`. A equipe do equipista delimita os coordenadores a avaliar.
- **Edicao** (`edicoes`): `id, numero, ano, status`. `ano` e a referencia do link (ex.: 2026).

## Identificacao, confirmacao e alvos (fluxo publico)

1. **Cracha valido**: `pessoas WHERE cracha = X AND ativo = true AND excluida = false`.
2. **Participacao como equipista** na edicao do link: `participacoes` com `funcao='Equipista'`, pessoa ativa, mesma edicao.
3. **Confirmacao de identidade (novo passo)**: a identificacao retorna `nome`, `fotoUrl`, `nomeEquipe`; o frontend mostra e pede "Confirma que e voce?". Somente apos confirmar, carrega a listagem com a mesma sessao. Se "nao sou eu", encerra sem revelar dados.
4. **Alvos (listagem)**: pessoas com `funcao='Coordenador'`, `ativo=true`, `excluida=false`, na MESMA `equipe_id` da participacao do equipista na edicao, excluindo o proprio equipista (se ele tambem for coordenador da propria equipe).

## Transicoes de estado

```text
LinkAvaliacaoEquipista: gerar link (revoga ativo anterior) → ativo → revogar → revogado
                        (nunca reativo automaticamente; ADM/ORG pode gerar de novo)

AvaliacaoEquipistaCoordenador:
                        (criacao no ato da finalizacao) → finalizada (imutavel, unica)
                        nao ha rascunho nem salvamento automatico
```

- Revogacao/geracao do link NAO altera avaliacoes ja finalizadas.
- `finalizada` nao pode ser editada nem excluida; impedido no backend (409) e nao exibido no frontend.
- Reentrada pelo cracha apos envio mostra apenas a mensagem "avaliacao ja enviada", sem revelar respostas.
- Mudanca na participacao do equipista ou dos coordenadores reflete no proximo acesso; avaliacoes persistidas permanecem.

## Datas e auditabilidade

- Timestamps ISO-8601 (`TIMESTAMPTZ`, serializados `YYYY-MM-DDTHH:mm:ssZ` via postgres.js).
- Eventos de auditoria (`api/src/auditoria.ts`): `avaliacaoEquipistaLink.gerou`, `avaliacaoEquipistaLink.revogou`, `avaliacaoEquipista.identificou`, `avaliacaoEquipista.confirmou`.
