# Contract: Vagas de Estacionamento API

Endpoints novos de vaga, remocoes e ajustes nos endpoints existentes de estacionamento, veiculo, pessoa, check-in e dashboard.

## Visao Geral

| Recurso | Metodo | Rota | Descricao | Mudanca |
|---------|--------|------|-----------|---------|
| Vagas | `GET` | `/api/vagas` | Lista vagas com pessoas e estacionamento | NOVO |
| Vagas | `POST` | `/api/vagas` | Cria vaga (identificacao + pessoas + estacionamento opcional) | NOVO |
| Vagas | `GET` | `/api/vagas/:id` | Detalhe da vaga | NOVO |
| Vagas | `PUT` | `/api/vagas/:id` | Altera identificacao, pessoas e estacionamento | NOVO |
| Vagas | `GET` | `/api/vagas/:id/historico` | Historico de associacao de estacionamento da vaga | NOVO |
| Estacionamentos | `GET` | `/api/estacionamentos` | Lista com `vagasDistribuidas` calculada | ALTERADO |
| Estacionamentos | `GET` | `/api/estacionamentos/:id` | Detalhe com `vagasDistribuidas` calculada | ALTERADO |
| Estacionamentos | `GET` | `/api/estacionamentos/:id/veiculos` | Veiculos derivados das vagas das pessoas vinculadas | ALTERADO |
| Estacionamentos | `POST` | `/api/estacionamentos/:id/veiculos` | Associar/transferir veiculo | REMOVIDO |
| Estacionamentos | `DELETE` | `/api/estacionamentos/:id/veiculos/:veiculoId` | Desassociar veiculo | REMOVIDO |
| Estacionamentos | `GET` | `/api/estacionamentos/:id/pessoas` | Listar pessoas associadas | REMOVIDO |
| Estacionamentos | `POST` | `/api/estacionamentos/:id/pessoas` | Associar pessoa | REMOVIDO |
| Estacionamentos | `DELETE` | `/api/estacionamentos/:id/pessoas/:pessoaId` | Desassociar pessoa | REMOVIDO |
| Estacionamentos | `POST` | `/api/estacionamentos/:id/veiculos/:veiculoId/checkins-manuais` | Check-in manual validado por vaga | ALTERADO |
| Veiculos | `GET` | `/api/veiculos` | Lista com `estacionamentos[]` derivados | ALTERADO |
| Veiculos | `GET` | `/api/veiculos/:id` | Detalhe com `estacionamentos[]` derivados | ALTERADO |
| Veiculos | `GET` | `/api/veiculos/:id/historico-estacionamentos` | Historico de associacao | REMOVIDO |
| Pessoas | `GET` | `/api/pessoas` / `/api/pessoas/:id` | Inclui `vagaId`, `vagaIdentificacao`, `estacionamentoId`, `estacionamentoNome` derivados | ALTERADO |
| Check-in publico | `GET` | `/api/publico/checkin/{token}/buscar` | Busca por placa derivada por vaga | ALTERADO |
| Check-in publico | `POST` | `/api/publico/checkin/{token}` | Registra check-in validado por vaga | ALTERADO |
| Dashboard | `GET` | `/api/estacionamentos/dashboard` | + `vagasDistribuidas` por estacionamento | ALTERADO |

Autenticacao: `Authorization: Bearer <token>` via middleware `comAuth` (exceto rotas publicas de check-in, que usam token do estacionamento). Autorizacao por `temPermissao`/`pode()` com os codigos do catalogo granular. Sem autenticacao → 401; sem permissao → 403.

## Tipos Comuns

```json
{
  "id": "uuid",
  "identificacao": "A1",
  "estacionamentoId": "uuid | null",
  "estacionamentoNome": "Estacionamento Sul | null",
  "pessoas": [
    { "id": "uuid", "nome": "Maria", "cracha": 123 }
  ],
  "criadoEm": "2026-08-15T12:00:00Z",
  "atualizadoEm": "2026-08-15T12:00:00Z"
}
```

**HistoricoEstacionamentoVaga** (na resposta de `GET /api/vagas/:id/historico`):

```json
{
  "id": "uuid",
  "vagaId": "uuid",
  "estacionamentoId": "uuid | null",
  "estacionamentoNome": "Estacionamento Sul",
  "operacao": "associar | transferir | desassociar",
  "autor": "uid",
  "autorNome": "Nome do autor",
  "criadoEm": "2026-08-15T12:00:00Z"
}
```

## Endpoints Novos

### GET /api/vagas

**Permissao**: `vaga.lista`

**Query params**: `estacionamentoId` (opcional) — filtra vagas de um estacionamento (inclui somente as associadas; vagas sem estacionamento nao aparecem nesse filtro).

**Resposta 200**

```json
{
  "vagas": [
    {
      "id": "uuid",
      "identificacao": "A1",
      "estacionamentoId": "uuid",
      "estacionamentoNome": "Estacionamento Sul",
      "pessoas": [{ "id": "uuid", "nome": "Maria", "cracha": 123 }],
      "criadoEm": "2026-08-15T12:00:00Z",
      "atualizadoEm": "2026-08-15T12:00:00Z"
    }
  ]
}
```

Pessoas retornadas incluem inativas? Sim (o vinculo permanece, FR-021); a UI mostra a pessoa com indicacao de inativa. Ordenacao: `identificacao ASC`.

### POST /api/vagas

**Permissao**: `vaga.incluir`

**Request body**

```json
{
  "identificacao": "A1",
  "pessoaIds": ["uuid", "uuid"],
  "estacionamentoId": "uuid"
}
```

| Campo | Tipo | Obrigatorio | Validacao |
|-------|------|-------------|-----------|
| `identificacao` | `string` | sim | nao vazio apos trim, max 80 |
| `pessoaIds` | `string[]` | sim | sem duplicados; cada pessoa existente e sem outra vaga |
| `estacionamentoId` | `string \| null` | nao | se presente, estacionamento existente |

**Resposta 201** — o objeto Vaga completo (com `pessoas`, `estacionamentoNome`). `estacionamentoId: null` cria vaga sem estacionamento.

**Erros**:
- 400 zod: campos invalidos, `pessoaIds` com duplicados (FR-005)
- 409: pessoa ja vinculada a outra vaga → `{ "erro": "Maria ja esta vinculada a vaga B2." }` (FR-006)
- 404: pessoa ou estacionamento inexistente
- 403 sem `vaga.incluir` / 401 sem autenticacao

**Regras**: capacidade estourada (`vagasDistribuidas > vagasContratadas`) nao bloqueia (FR-019); a UI exibe aviso informativo antes de salvar. Todos os `pessoaIds` sao validados em bloco (nenhuma pessoa fica "meio vinculada" em falha parcial — as insercoes em `pessoa_vaga` sao feitas na mesma transacao da vaga).

**Auditoria**: `registrarEvento(tipo: "vaga.criou", ref: "vagas/{id}", detalhe: identificacao)`.

### GET /api/vagas/:id

**Permissao**: `vaga.detalhe`

**Resposta 200** — objeto Vaga completo. **404** se inexistente.

### GET /api/vagas/:id/historico

**Permissao**: `vaga.detalhe`

Historico de associacao de estacionamento da vaga (FR-012), ordenado por `criadoEm DESC` (mais recente primeiro).

**Resposta 200**

```json
{
  "historico": [
    {
      "id": "uuid",
      "vagaId": "uuid",
      "estacionamentoId": "uuid",
      "estacionamentoNome": "Estacionamento Sul",
      "operacao": "associar",
      "autor": "uid",
      "autorNome": "Coordenador",
      "criadoEm": "2026-08-15T12:00:00Z"
    }
  ]
}
```

**Erros**: 404 se a vaga nao existir; 403 sem `vaga.detalhe` / 401 sem autenticacao.

**Regras**: append-only (sem POST/PUT/DELETE). A associacao inicial na criacao da vaga registra `associar`; a troca de estacionamento registra `transferir`; a desassociacao (`estacionamentoId: null`) registra `desassociar` com `estacionamentoId: null`. O historico legado veiculo↔estacionamento e migrado por backfill (script SQL `scripts/backfill-vaga-estacionamento-historico.sql`, deduplicado por vaga); registros sem vaga correspondente permanecem na tabela legada (FR-024/SC-008).

### PUT /api/vagas/:id

**Permissao**: `vaga.editar`

**Request body** (mesma forma do POST; todos os campos enviados)

```json
{
  "identificacao": "A1 (remanejada)",
  "pessoaIds": ["uuid"],
  "estacionamentoId": null
}
```

**Resposta 200** — objeto Vaga atualizado.

**Erros**: 400/404/409/403/401 como no POST. `estacionamentoId: null` desassocia a vaga (FR-003/FR-004). Ao trocar para outro estacionamento, a contagem dos dois estacionamentos muda automaticamente (FR-004). `pessoaIds` substitui o conjunto atual (remocoes e adicoes na mesma transacao).

**Auditoria**: `registrarEvento(tipo: "vaga.atualizou", ref: "vagas/{id}", detalhe: campos alterados)`.

## Endpoints Removidos

Remover do `api/src/rotas/estacionamentos.ts` e `veiculos.ts` (e do frontend correspondente):

| Rota | Motivo |
|------|--------|
| `GET/POST /api/estacionamentos/:id/pessoas`, `DELETE /api/estacionamentos/:id/pessoas/:pessoaId` | Associacao direta pessoa↔estacionamento removida (FR-007); pessoas passam a ser vinculadas pela vaga |
| `POST /api/estacionamentos/:id/veiculos`, `DELETE /api/estacionamentos/:id/veiculos/:veiculoId` | Associacao direta veiculo↔estacionamento removida (FR-011) |
| `GET /api/veiculos/:id/historico-estacionamentos` | Veiculo nao exibe mais historico (FR-012); a tabela legada `veiculo_estacionamento_historico` permanece no banco, oculta e sem novas escritas, com dados migrados por backfill para `vaga_estacionamento_historico` (FR-024) |

## Endpoints Alterados

### GET /api/estacionamentos e GET /api/estacionamentos/:id

Resposta atual (inclui `vagasDistribuidas`) passa a ter o valor **calculado**:

```sql
SELECT e.*,
  (SELECT COUNT(*) FROM vagas v WHERE v.estacionamento_id = e.id) AS vagas_distribuidas
FROM estacionamentos e
```

O campo continua no contrato (`vagasDistribuidas`). `POST/PUT /api/estacionamentos` deixam de aceitar `vagasDistribuidas` (campo ignorado/removido do zod).

### GET /api/estacionamentos/:id/veiculos

Veiculos cujas pessoas (ativas) possuem vaga neste estacionamento:

```sql
SELECT DISTINCT v.id, v.fabricante, v.modelo, v.placa, v.cor,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome, 'cracha', p.cracha))
    FROM pessoa_veiculo pv2
    JOIN pessoas p ON p.id = pv2.pessoa_id
    WHERE pv2.veiculo_id = v.id
  ), '[]'::jsonb) AS pessoas
FROM veiculos v
JOIN pessoa_veiculo pv ON pv.veiculo_id = v.id
JOIN pessoas p ON p.id = pv.pessoa_id AND p.ativo = true
JOIN pessoa_vaga pvg ON pvg.pessoa_id = p.id
JOIN vagas vg ON vg.id = pvg.vaga_id
WHERE vg.estacionamento_id = $id
ORDER BY v.placa
```

**404** se o estacionamento nao existir.

### POST /api/estacionamentos/:id/veiculos/:veiculoId/checkins-manuais

A validacao `veiculo.estacionamento_id === id` e substituida por: o veiculo possui ao menos uma pessoa ativa com vaga neste estacionamento (mesma derivacao do `GET /:id/veiculos`). Se nao → 404 `"Veiculo nao possui vaga neste estacionamento."`. O restante (datas, unicidade por dia, insercao) permanece igual.

### GET /api/veiculos e GET /api/veiculos/:id

O campo `estacionamentoId` (single) e substituido por `estacionamentos` (array) derivado das vagas das pessoas ativas vinculadas:

```sql
SELECT v.*,
  COALESCE((
    SELECT jsonb_agg(DISTINCT jsonb_build_object('id', e.id, 'nome', e.nome) ORDER BY e.nome)
    FROM pessoa_veiculo pv
    JOIN pessoas p ON p.id = pv.pessoa_id AND p.ativo = true
    JOIN pessoa_vaga pvg ON pvg.pessoa_id = p.id
    JOIN vagas vg ON vg.id = pvg.vaga_id
    JOIN estacionamentos e ON e.id = vg.estacionamento_id
    WHERE pv.veiculo_id = v.id
  ), '[]'::jsonb) AS estacionamentos
FROM veiculos v
```

Veiculo sem pessoas ou sem vaga → `estacionamentos: []` (FR-022). `GET /api/veiculos/:id` mantem o objeto unico com `estacionamentos[]`. O detalhe continua retornando `pessoas` como hoje (rota `GET /api/veiculos/:id/pessoas` inalterada).

### GET /api/pessoas e GET /api/pessoas/:id

Os campos `estacionamentoId`/`estacionamentoNome` passam a ser derivados da vaga (e nao do `LEFT JOIN` na coluna removida):

```sql
-- por pessoa:
SELECT vg.id AS vaga_id, vg.identificacao AS vaga_identificacao,
       e.id AS estacionamento_id, e.nome AS estacionamento_nome
FROM pessoa_vaga pvg
JOIN vagas vg ON vg.id = pvg.vaga_id
LEFT JOIN estacionamentos e ON e.id = vg.estacionamento_id
WHERE pvg.pessoa_id = $pessoaId
```

Novos campos na resposta: `vagaId`, `vagaIdentificacao`. Pessoa sem vaga → todos nulos/ausentes. O mapeamento `temEstacionamento` e mantido como esta (flag de cadastro).

### GET /api/publico/checkin/{token}/buscar

Busca por placa passa a usar a derivacao por vaga. Algoritmo:

1. Resolver estacionamento por `token` (404 se nao existir).
2. Buscar veiculos cujas pessoas ativas possuem vaga neste estacionamento e cuja placa casa com `%PLACA%`:

```sql
SELECT DISTINCT v.id, v.fabricante, v.modelo, v.placa, v.cor
FROM veiculos v
JOIN pessoa_veiculo pv ON pv.veiculo_id = v.id
JOIN pessoas p ON p.id = pv.pessoa_id AND p.ativo = true
JOIN pessoa_vaga pvg ON pvg.pessoa_id = p.id
JOIN vagas vg ON vg.id = pvg.vaga_id
WHERE vg.estacionamento_id = $estId
  AND UPPER(v.placa) LIKE $padrao
```

3. Se vazio:
   - Se o veiculo tem pessoa ativa com vaga em outro estacionamento → 404 `{ "erro": "Esta placa esta vinculada ao estacionamento:\n{nome}" }` (FR-018).
   - Se nao tem vaga em estacionamento algum → 404 `{ "erro": "Veículo não cadastrado.\n\nOriente a pessoa a procurar o *coordenador da equipe* ou a equipe de *Gestão de Estacionamento*" }` (FR-022).
4. Para cada veiculo encontrado: monta `{ veiculoId, placa, modelo, cor, fabricante, pessoas: [{id, nome}], jaPossuiCheckin }` (mesma forma atual) e retorna `{ resultados }`.

Resposta e erros mantem o formato atual para nao quebrar `CheckinPublico.tsx`.

### POST /api/publico/checkin/{token}

A validacao `veiculo.estacionamento_id === est.id` e substituida por: o veiculo possui ao menos uma pessoa ativa com vaga neste estacionamento (mesma derivacao do `buscar`). Se nao → 404 `{ "erro": "Veiculo nao pertence a este estacionamento." }`. Unicidade por dia, insercao e evento SSE permanecem iguais.

### GET /api/estacionamentos/dashboard

Cada item de `estacionamentos[]` passa a incluir `vagasDistribuidas` (COUNT de vagas associadas) alem dos campos atuais (`vagasContratadas`, check-ins do dia). A UI usa `vagasDistribuidas / vagasContratadas` para a porcentagem de vagas distribuídas (FR-015) e mantem a lotacao atual por check-ins (FR-014).

## Funcoes/Guardas Afetadas

- `estacionamento.associar` (rotas removidas) — nao e mais consultado; codigo desativado no catalogo.
- `veiculos.associar` — idem.
- `estacionamento.checkinManual` — permanece; a rota passa a validar por vaga.
- Novas `vaga.*` usadas somente nas rotas de vaga.

## Regras de Negocio (resumo)

| Regra | Comportamento | Onde |
|-------|---------------|------|
| Pessoa em no maximo uma vaga | bloqueio com 409 informando a vaga | POST/PUT vaga (validacao + PK `pessoa_id`) |
| Pessoa duplicada na mesma vaga | 400 (lista com duplicados) | POST/PUT vaga |
| Vaga em no maximo um estacionamento | coluna FK unica | banco |
| Vaga sem estacionamento permitida | `estacionamentoId: null` | POST/PUT vaga |
| Capacidade estourada nao bloqueia | associa mesmo assim; aviso na UI | POST/PUT vaga + tela |
| Mover vaga atualiza contagem dos dois | `vagasDistribuidas` e derivada (COUNT) | qualquer associacao |
| Excluir estacionamento mantem vaga | `ON DELETE SET NULL` | banco |
| Pessoa inativada nao deriva estacionamento | joins filtram `pessoas.ativo = true` | rotas de derivacao |
| Veiculo sem pessoas nao aparece no check-in | derivacao por `pessoa_veiculo` | check-in publico/manual |
| Placa de outro estacionamento informa o nome | mensagem 404 especifica | `buscar` |
| `vagasDistribuidas` sempre calculada | COUNT em vez da coluna manual | estacionamentos/dashboard |

## Configuracao

Sem variaveis novas. Requer a migracao do schema (novas tabelas `vagas`, `pessoa_vaga` e `vaga_estacionamento_historico`, remocao das colunas de vinculo direto, desativacao dos codigos antigos e seed de `vaga.*`) antes do deploy da API. A tabela legada `veiculo_estacionamento_historico` e mantida; a migracao dos dados (backfill, `scripts/backfill-vaga-estacionamento-historico.sql`) roda apos a adocao das vagas.
