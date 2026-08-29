# Contrato da API — Bloqueio de Pessoas (025)

**Fase**: Phase 1 (/speckit.plan) | **Data**: 2026-08-29 | **Plan**: [plan.md](plan.md) | **Data model**: [data-model.md](../data-model.md)

Recurso novo montado em `api/src/index.ts` como `app.route("/api/bloqueios", bloqueios)` (modulo `api/src/rotas/bloqueios.ts`). Todos os endpoints exigem `comAuth` e a permissao `pessoas.bloqueio`; respostas de erro seguem o padrao `{ "erro": "..." }` do repo.

> **Nota de frontend**: criar e desbloquear sao renderizados em **paginas dedicadas** (`/pessoas/:id/bloquear` e `/pessoas/:id/desbloquear`), nao em modal. A API abaixo e identica — `POST /api/bloqueios` cria a solicitacao vinda de qualquer das duas paginas, e o submit redireciona para a tela Bloqueios.

## Schemas (zod, espelho em `api/src/rotas/bloqueios.ts`)

```ts
const TipoBloqueio = z.enum(["bloqueio", "desbloqueio"]);
const StatusBloqueio = z.enum(["pendente", "aprovado"]);

const MotivoSchema = z
  .string()
  .min(100, "O motivo deve ter ao menos 100 caracteres.")
  .refine((v) => v.trim().length >= 100, {
    message: "O motivo deve ter ao menos 100 caracteres de conteudo real.",
  });

const CriarBloqueioSchema = z.object({
  pessoaId: z.string().min(1),
  tipo: TipoBloqueio,
  motivo: MotivoSchema,
});

const BloqueioSchema = z.object({
  id: z.string(),
  pessoaId: z.string(),
  pessoaNome: z.string(),   // join com pessoas
  pessoaCracha: z.number(),
  tipo: TipoBloqueio,
  status: StatusBloqueio,
  motivo: z.string(),
  aprovador1Uid: z.string(),
  aprovador1Nome: z.string(),
  aprovador2Uid: z.string().nullable(),
  aprovador2Nome: z.string().nullable(),
  criadoPorUid: z.string(),
  criadoPorNome: z.string(),
  criadoEm: z.string(),      // ISO timestamp
  concluidoEm: z.string().nullable(),
});

const ResumoBloqueioSchema = z.object({
  bloqueada: z.boolean(),
  bloqueioAtivo: BloqueioSchema.partial().nullable(),   // motivo/ids do bloqueio ativo (pendente de desbloqueio n/a)
  bloqueioPendente: BloqueioSchema.nullable(),          // solicitacao pendente, se houver
});
```

## Endpoints

### `GET /api/bloqueios`

Autorizacao: `temPermissao(sessao, "pessoas.bloqueio")` → senao `403`.

Query params (todos opcionais):

| Param | Tipo | Descricao |
|---|---|---|
| `pessoaId` | string | Filtra o historico de uma pessoa (aba do box Exclusivo Pessoal) |
| `status` | `pendente` \| `aprovado` | Filtra por situacao (abas Pendentes / Bloqueados da tela Bloqueios) |

Resposta `200` — `{ itens: BloqueioSchema[] }`, ordenado por `criado_em DESC`.

Descricao de negocio: usado pela tela Bloqueios (todas/pendentes/aprovadas) e pela aba de historico por pessoa. Nao retorna restricao de visibilidade por equipe — apenas quem tem `pessoas.bloqueio` acessa.

### `POST /api/bloqueios`

Autorizacao: `temPermissao(sessao, "pessoas.bloqueio")` → senao `403`.

Corpo: `{ pessoaId, tipo, motivo }` conforme `CriarBloqueioSchema`.

Regras de negocio (no servidor, em `sql.begin` com `SELECT ... FOR UPDATE` na linha da pessoa):

| Regra | Retorno |
|---|---|
| `pessoaId` inexistente | `404` `{"erro":"Pessoa não encontrada."}` |
| `motivo` com < 100 caracteres (ou so espacos) | `400` via zod |
| `tipo = 'bloqueio'` e pessoa ja `bloqueada = TRUE` | `409` `{"erro":"Esta pessoa já está bloqueada."}` |
| `tipo = 'desbloqueio'` e pessoa `bloqueada = FALSE` | `409` `{"erro":"Esta pessoa não está bloqueada."}` |
| pessoa ja tem pedido `pendente` (indice parcial) | `409` via `isErroDuplicado` — `{"erro":"Já existe um pedido pendente para esta pessoa."}` |
| sucesso | `201` `BloqueioSchema` (status `pendente`, `aprovador1Uid/Nome` = sessao) |

Efeitos colaterais: auditoria `bloqueio.solicitou` (alvo `bloqueios/{id}`). **Nao** altera `pessoas.bloqueada` (FR-020).

### `POST /api/bloqueios/:id/aprovar`

Autorizacao: `temPermissao(sessao, "pessoas.bloqueio")` → senao `403`.

Sem corpo. Regras:

| Regra | Retorno |
|---|---|
| `id` inexistente | `404` `{"erro":"Solicitação não encontrada."}` |
| sessao ja e `aprovador1Uid` do pedido | `409` `{"erro":"Você não pode aprovar sua própria solicitação."}` |
| pedido ja `aprovado` | `409` `{"erro":"Solicitação já aprovada."}` |
| sucesso | `200` `BloqueioSchema` (status `aprovado`, `aprovador2Uid/Nome` = sessao, `concluidoEm`) |

**Atualizacao atomica** (dentro de `sql.begin`):

```sql
UPDATE bloqueios SET
  status = 'aprovado',
  aprovador2_uid = ${sessao.uid},
  aprovador2_nome = ${sessao.nome},
  concluido_em = now()
WHERE id = ${id}
  AND status = 'pendente'
  AND aprovador1_uid <> ${sessao.uid}
RETURNING *;
```

Se 0 linhas → decide entre "ja aprovado" (status `aprovado`) e "nao pode aprovar o proprio pedido" (`aprovador1_uid = sessao.uid`). Com a linha retornada, o lock na pessoa e re-checado e a coluna e ligada/desligada conforme o tipo:

- `tipo = 'bloqueio'` → `UPDATE pessoas SET bloqueada = TRUE WHERE id = $pessoaId` (auditoria `bloqueio.aprovou` + `pessoa.bloqueou`).
- `tipo = 'desbloqueio'` → `UPDATE pessoas SET bloqueada = FALSE WHERE id = $pessoaId` (auditoria `bloqueio.aprovou` + `pessoa.desbloqueou`).

## Contrato de leitura de pessoas (alteracoes)

`GET /api/pessoas` (lista) — cada item ganha `bloqueada: boolean` (mapper `pessoaDeRow`).

`GET /api/pessoas/:id` (detalhe) — resposta ganha um objeto `bloqueio` (espelho de `ResumoBloqueioSchema`):
- `bloqueio.ativo: boolean` — `pessoas.bloqueada`.
- `bloqueio.bloqueadoEm`, `bloqueio.motivo`, `bloqueio.aprovadores` — derivados da ultima solicitacao `aprovado` do tipo `bloqueio` para a pessoa (junta com `pessoa_equipe_historico`-like lookup em `bloqueios`).
- `bloqueio.pendente?: { id, tipo, motivo, aprovador1Nome, criadoEm }` — a solicitacao pendente, se houver (FR-013 formas de pendencia).

> Exemplo (detalhe):
> ```json
> { "id": "...", "nome": "Maria", "cracha": 42, "ativo": true, "bloqueada": true,
>   "bloqueio": { "ativo": true, "motivo": "...100+ chars...",
>     "aprovadores": ["Usuaria A", "Usuario B"], "pendente": null } }
> ```

## Contrato de restricao de selecao (alteracoes em rotas existentes)

### `POST /api/participacoes` e `PUT /api/participacoes/:id` (`api/src/rotas/participacoes.ts`)

Antes do INSERT/UPDATE, verificar `bloqueada` da pessoa:

```sql
SELECT bloqueada FROM pessoas WHERE id = ${body.pessoaId | row.pessoa_id}
```

Se `bloqueada = TRUE` → `409` `{"erro":"Pessoa bloqueada. Justificativa: <motivo do bloqueio ativo>."}` (FR-018). O motivo e o da solicitacao ativa (buscado como no detalhe).

### `GET /api/montagem/candidatos` (`api/src/rotas/montagem.ts`)

Ambas as CTEs de candidatos (listagem e total) ganham `AND p.bloqueada = FALSE` ao lado do `p.ativo = TRUE` existente. `CandidatoMontagem` nao precisa de campo novo — o bloqueado simplesmente nao aparece.

## Permissoes e perfil

- Nova permissao `pessoas.bloqueio` (catalogo) exige: tela Bloqueios, criar/aprovar pedidos, historico.
- `exclusivoPessoal` semeada: box "Exclusivo Pessoal" + aba de historico.
- Concedidas ao perfil `ORG` via seed (veja [data-model.md](../data-model.md)). ADM e superuser.

## Auditoria (eventos novos)

| Evento | Alvo | Quando |
|---|---|---|
| `bloqueio.solicitou` | `bloqueios/{id}` | criacao de pedido (detalhe: tipo + pessoa) |
| `bloqueio.aprovou` | `bloqueios/{id}` | aprovacao que conclui (detalhe: aprovador2) |
| `pessoa.bloqueou` | `pessoas/{id}` | bloqueio ativado |
| `pessoa.desbloqueou` | `pessoas/{id}` | desbloqueio concluido |