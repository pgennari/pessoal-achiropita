# Contrato de Integracao — Avaliacao de Coordenadores

Contrato REST da feature 027, espelhando o padrao de `avaliacao-integracao.md` (feature 019) e o codigo real de `api/src/rotas/avaliacao.ts`, `avaliacaoPublico.ts`, `sessaoAvaliacao.ts`. Responses documentadas com schemas abertos (`z.any()`), como no codigo existente.

Prefixos montados em `api/src/index.ts`:
- `/api/avaliacao-coordenador` e `/api/avaliacoes-coordenador` → rotas internas (`rotas/avaliacaoCoordenador.ts`)
- `/api/publico` → rotas publicas (`rotas/avaliacaoCoordenadorPublico.ts`)

Autenticacao:
- Internas: `Authorization: Bearer <Firebase ID token>` + permissao `avaliacao.gerenciar` (403 se sem permissao; 401 token invalido).
- Publicas identificadas: `Authorization: Bearer <sessaoCoordenadorJwt>` (JWT HS256 1h), revalidado a cada chamada (link revogado → **410**).
- Publicas de descoberta: sem auth.

## Rotas internas (ADM/ORG)

### POST /api/avaliacao-coordenador/links
Cria o link publico da edicao (revoga o ativo anterior). Token = referencia da edicao (`edicoes.ano`).

Request:
```json
{ "edicaoId": "<uuid>" }
```
Response 201:
```json
{
  "id": "2026",
  "edicaoId": "<uuid>",
  "status": "ativo",
  "criadoPorUid": "<uid>",
  "criadoPorNome": "Nome",
  "criadoEm": "2026-08-29T12:00:00Z"
}
```
Erros: `403 { erro }` sem permissao; `422 { erro }` edicao inexistente ou sem ano valido.

### PUT /api/avaliacao-coordenador/links/{id}/revogar
Revoga o link. Response 200: `{ "ok": true }`. `404 { erro: "Link não encontrado." }` se inexistente. `403` sem permissao.

### GET /api/avaliacao-coordenador/links/{edicaoId}
Busca o link ativo da edicao. Response 200:
```json
{ "id": "2026", "edicaoId": "<uuid>", "status": "ativo", "criadoEm": "2026-08-29T12:00:00Z" }
```
`204` sem corpo se nao ha link ativo. `403` sem permissao.

### GET /api/avaliacoes-coordenador?edicaoId=&equipeId=&avaliadorPessoaId=&status=
Lista avaliacoes da edicao (filtros opcionais: `equipeId` = equipe filha, `avaliadorPessoaId`, `status` = `rascunho`|`finalizada`). `edicaoId` obrigatorio. Ordenado por `atualizado_em DESC`.

Response 200:
```json
[
  {
    "id": "<uuid>",
    "edicaoId": "<uuid>",
    "equipePaiId": "<uuid>",
    "equipeFilhaId": "<uuid>",
    "equipeFilhaNome": "Equipe Filha",
    "pessoaId": "<uuid>",
    "pessoaNome": "Nome do Avaliado",
    "pessoaCracha": "1234",
    "avaliadorPessoaId": "<uuid>",
    "avaliadorNome": "Nome do Avaliador",
    "status": "finalizada",
    "criadoEm": "2026-08-29T12:00:00Z",
    "atualizadoEm": "2026-08-29T12:05:00Z",
    "finalizadoEm": "2026-08-29T12:05:00Z"
  }
]
```
`403` sem permissao.

### GET /api/avaliacoes-coordenador/{id}
Detalhe completo (modo leitura). Response 200 = item da listagem + questionario:
```json
{
  "id": "<uuid>",
  "edicaoId": "<uuid>",
  "equipePaiId": "<uuid>",
  "equipeFilhaId": "<uuid>",
  "equipeFilhaNome": "Equipe Filha",
  "pessoaId": "<uuid>",
  "pessoaNome": "Nome do Avaliado",
  "pessoaCracha": "1234",
  "avaliadorPessoaId": "<uuid>",
  "avaliadorCracha": 9999,
  "avaliadorNome": "Nome do Avaliador",
  "permanencia": "Sim",
  "lideranca": "Excelente",
  "pontoPositivo": "texto com ao menos 20 caracteres",
  "aspectoMelhorar": "texto com ao menos 20 caracteres",
  "situacaoRegistrar": "texto com ao menos 20 caracteres",
  "recomendacao": "texto com ao menos 20 caracteres",
  "status": "finalizada",
  "criadoEm": "2026-08-29T12:00:00Z",
  "atualizadoEm": "2026-08-29T12:05:00Z",
  "finalizadoEm": "2026-08-29T12:05:00Z"
}
```
`404` se inexistente. `403` sem permissao.

## Rotas publicas (anonimas)

### GET /api/publico/avaliacao-coordenador/{referencia}
Valida o link (existe + ativo), sem revelar dados. Response 200:
```json
{ "valido": true, "edicaoId": "<uuid>", "edicaoNumero": 100 }
```
ou `{ "valido": false }`.

### POST /api/publico/avaliacao-coordenador/coordenador
Identifica o coordenador pelo cracha. Erros de identificacao SEMPRE `200 { erro: "Acesso negado" }` (nao revela qual etapa falhou).

Request:
```json
{ "token": "2026", "cracha": 9999 }
```
Response 200 (sucesso):
```json
{
  "nome": "Nome do Coordenador",
  "equipes": [
    { "equipeId": "<uuid>", "equipeNome": "APOIO X", "equipeNomePai": "APOIO X" }
  ],
  "sessaoToken": "<jwt 1h>"
}
```
`equipes` lista as equipes coordenadas que atendem APOIO + filhas (pode haver mais de uma).

### GET /api/publico/avaliacao-coordenador/alvos
Requer Bearer `sessaoToken`. Lista os alvos (coordenadores das equipes filhas) com status da avaliacao, agrupaveis por equipe filha no frontend.

Response 200:
```json
[
  {
    "pessoaId": "<uuid>",
    "pessoaNome": "Nome do Coordenador Filho",
    "pessoaCracha": "4321",
    "equipeFilhaId": "<uuid>",
    "equipeFilhaNome": "Equipe Filha A",
    "avaliacaoId": null,
    "statusAvaliacao": null
  }
]
```
`statusAvaliacao`: `null` (pendente) | `"rascunho"` | `"finalizada"`. Registrada antes da rota dinamica `{referencia}` para nao ser capturada (padrao `avaliacaoPublico.ts`).

### POST /api/publico/avaliacao-coordenador
Requer Bearer `sessaoToken`. Cria/atualiza rascunho ou finaliza.

Request:
```json
{
  "pessoaId": "<uuid>",
  "equipeFilhaId": "<uuid>",
  "permanencia": "Sim",
  "lideranca": "Excelente",
  "pontoPositivo": "texto com ao menos 20 caracteres",
  "aspectoMelhorar": "texto com ao menos 20 caracteres",
  "situacaoRegistrar": "texto com ao menos 20 caracteres",
  "recomendacao": "texto com ao menos 20 caracteres",
  "finalizar": false
}
```
Campos do questionario sao nullable no request (rascunho parcial); `finalizar` boolean.

Response 200: `{ "id": "<uuid>", "status": "rascunho", "atualizadoEm": "2026-08-29T12:03:00Z" }`.

Erros:
- `409 { erro: "Avaliação finalizada não pode ser alterada" }` — alvo ja finalizado.
- `422 { erro: "Para finalizar, todas as 6 questões devem ser respondidas e as respostas abertas devem ter no mínimo 20 caracteres" }` — `finalizar: true` com dados incompletos ou texto aberto curto.
- `422 { erro: "Coordenador não encontrado na edição." }` — alvo sem participacao valida como coordenador na edicao.
- `401` JWT invalido/expirado; `410 { erro: "Link inativo." }` link revogado.

Valores validos (Zod):
```ts
permanencia: z.enum(["Sim", "Sim, com algumas ressalvas", "Nao tenho certeza", "Nao"]).nullable(),
lideranca:   z.enum(["Excelente", "Bom", "Regular", "Pouco", "Nao possui"]).nullable(),
// abertas:
z.string().min(20).max(4000).nullable()  // validado apenas quando finalizar
```
> Nota: PT-BR sem acentos nos valores de enum por convencao do codigo (Zod/JS); a UI exibe com acentuacao.

## Erros padronizados

| Status | Significado |
|---|---|
| 401 | sessao ausente/invalida/expirada |
| 403 | sem permissao (`avaliacao.gerenciar`) |
| 404 | recurso inexistente |
| 409 | finalizada imutavel |
| 410 | link revogado/inativo |
| 422 | dados incompletos / regra de negocio |
| 500 | erro nao tratado (`{ erro }`) |

## Cliente frontend (`src/lib/avaliacaoCoordenador.ts`)

Espelho de `src/lib/avaliacao.ts`:
- `gerarLinkAvaliacaoCoordenador(edicaoId)` → `api.post("/api/avaliacao-coordenador/links", { edicaoId })`
- `revogarLinkAvaliacaoCoordenador(token)` → `api.put("/api/avaliacao-coordenador/links/{token}/revogar")`
- `buscarLinkAvaliacaoCoordenadorAtivo(edicaoId)` → `api.get("/api/avaliacao-coordenador/links/{edicaoId}")` (null em erro/204)
- `listarAvaliacoesCoordenador(edicaoId, {equipeId?, avaliadorPessoaId?, status?})` → `api.get("/api/avaliacoes-coordenador?...")`
- `buscarAvaliacaoCoordenador(id)` → `api.get("/api/avaliacoes-coordenador/{id}")`
- `verificarLinkAvaliacaoCoordenador(referencia)` → `apiPublica("GET", "/api/publico/avaliacao-coordenador/{referencia}")`
- `identificarCoordenadorAvaliacao(referencia, cracha)` → `apiPublica("POST", "/api/publico/avaliacao-coordenador/coordenador", { token: referencia, cracha })`
- `listarAlvosAvaliacaoCoordenador(sessaoToken)` → `api.get("/api/publico/avaliacao-coordenador/alvos", sessaoToken)`
- `salvarAvaliacaoCoordenador(sessaoToken, dados)` → `api.post("/api/publico/avaliacao-coordenador", dados, sessaoToken)`

URL publica montada como `${window.location.origin}/avaliacao/coordenadores/${link.id}` (ex.: `/avaliacao/coordenadores/2026`).