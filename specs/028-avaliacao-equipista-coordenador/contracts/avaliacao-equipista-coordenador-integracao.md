# Contrato de Integracao — Avaliacao de Coordenadores pelo Equipista

Contrato REST da feature 028, espelhando o padrao de `avaliacao-coordenador-integracao.md` (027) e `avaliacao-integracao.md` (019) e o codigo real de `api/src/rotas/`. Responses documentadas com schemas abertos (`z.any()`), como no codigo existente.

Prefixos montados em `api/src/index.ts`:
- `/api/avaliacao-equipista` e `/api/avaliacoes-equipista-coordenador` → rotas internas (`rotas/avaliacaoEquipistaCoordenador.ts`)
- `/api/publico` → rotas publicas (`rotas/avaliacaoEquipistaCoordenadorPublico.ts`)

Autenticacao:
- Internas: `Authorization: Bearer <Firebase ID token>` + permissao `avaliacao.gerenciar` (403 se sem permissao; 401 token invalido).
- Publicas identificadas: `Authorization: Bearer <sessaoEquipistaJwt>` (JWT HS256 1h), revalidado a cada chamada (link revogado → **410**).
- Publicas de descoberta: sem auth.

## Rotas internas (ADM/ORG)

### POST /api/avaliacao-equipista/links
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
  "criadoEm": "2026-08-30T12:00:00Z"
}
```
Erros: `403 { erro }` sem permissao; `422 { erro }` edicao inexistente ou sem ano.

### PUT /api/avaliacao-equipista/links/{id}/revogar
Revoga o link. Response 200: `{ "ok": true }`. `404 { erro: "Link não encontrado." }`. `403` sem permissao.

### GET /api/avaliacao-equipista/links/{edicaoId}
Busca o link ativo da edicao. Response 200:
```json
{ "id": "2026", "edicaoId": "<uuid>", "status": "ativo", "criadoEm": "2026-08-30T12:00:00Z" }
```
`204` sem corpo se nao ha link ativo. `403` sem permissao.

### GET /api/avaliacoes-equipista-coordenador?edicaoId=&equipeId=&avaliadorPessoaId=&status=
Lista avaliacoes da edicao (filtros opcionais: `equipeId`, `avaliadorPessoaId`, `status` = `finalizada`). `edicaoId` obrigatorio. Ordenado por `atualizado_em DESC`. Nao ha rascunho; toda avaliacao persistida ja esta finalizada.

Response 200:
```json
[
  {
    "id": "<uuid>",
    "edicaoId": "<uuid>",
    "equipeId": "<uuid>",
    "equipeNome": "Equipe",
    "pessoaId": "<uuid>",
    "pessoaNome": "Nome do Coordenador Avaliado",
    "pessoaCracha": "4321",
    "avaliadorPessoaId": "<uuid>",
    "avaliadorNome": "Nome do Equipista",
    "status": "finalizada",
    "criadoEm": "2026-08-30T12:00:00Z",
    "atualizadoEm": "2026-08-30T12:05:00Z",
    "finalizadoEm": "2026-08-30T12:05:00Z"
  }
]
```
`403` sem permissao.

### GET /api/avaliacoes-equipista-coordenador/{id}
Detalhe completo (modo leitura). Response 200 = item da listagem + questionario:
```json
{
  "id": "<uuid>",
  "edicaoId": "<uuid>",
  "equipeId": "<uuid>",
  "equipeNome": "Equipe",
  "pessoaId": "<uuid>",
  "pessoaNome": "Nome do Coordenador Avaliado",
  "pessoaCracha": "4321",
  "avaliadorPessoaId": "<uuid>",
  "avaliadorCracha": 8888,
  "avaliadorNome": "Nome do Equipista",
  "criterios": {
    "pontualidade": "Otimo",
    "dedicacao": "Bom",
    "companheirismo": "Otimo",
    "espiritualidade": "Regular",
    "comprometimento": "Bom",
    "uniforme": "Otimo"
  },
  "comentarios": "texto opcional",
  "status": "finalizada",
  "criadoEm": "2026-08-30T12:00:00Z",
  "atualizadoEm": "2026-08-30T12:05:00Z",
  "finalizadoEm": "2026-08-30T12:05:00Z"
}
```
`404` se inexistente. `403` sem permissao.

## Rotas publicas (anonimas)

### GET /api/publico/avaliacao-equipista/{referencia}
Valida o link (existe + ativo), sem revelar dados. Response 200:
```json
{ "valido": true, "edicaoId": "<uuid>", "edicaoNumero": 100 }
```
ou `{ "valido": false }`.

### POST /api/publico/avaliacao-equipista/identificar
Identifica o equipista pelo cracha e retorna os dados para confirmacao de identidade + sessao. Erros de identificacao SEMPRE `200 { erro: "Acesso negado" }` (nao revela qual etapa falhou).

Request:
```json
{ "token": "2026", "cracha": 8888 }
```
Response 200 (sucesso):
```json
{
  "nome": "Nome do Equipista",
  "fotoUrl": "https://.../pessoas/xxx/foto.jpg",
  "equipeNome": "Equipe",
  "sessaoToken": "<jwt 1h>",
  "jaEnviou": false
}
```
`fotoUrl` pode ser `null` (frontend mostra a inicial). `equipeNome` e exibido na confirmacao. `jaEnviou` `true` quando o equipista ja tem ao menos uma avaliacao finalizada na edicao: nesse caso o frontend exibe apenas a mensagem "avaliacao ja enviada", sem mostrar as respostas e sem prosseguir ao questionario.

### GET /api/publico/avaliacao-equipista/alvos
Requere Bearer `sessaoToken`. Lista os coordenadores da equipe do equipista com status da avaliacao. Chamada somente apos a confirmacao de identidade no frontend.

Response 200:
```json
[
  {
    "pessoaId": "<uuid>",
    "pessoaNome": "Nome do Coordenador",
    "pessoaCracha": "1234",
    "avaliacaoId": null,
    "statusAvaliacao": null,
    "criterios": null,
    "comentarios": null
  }
]
```
`statusAvaliacao`: `null` (pendente) | `"finalizada"`. Quando finalizada, `avaliacaoId` preenchido; `criterios`/`comentarios` sao `null` (o frontend nao revela as respostas nesta listagem). Registrada antes da rota dinamica `{referencia}` para nao ser capturada.

### POST /api/publico/avaliacao-equipista
Requere Bearer `sessaoToken`. Persiste a avaliacao quando o equipista finaliza (nao ha rascunho parcial).

Request:
```json
{
  "pessoaId": "<uuid>",
  "criterios": {
    "pontualidade": "Otimo",
    "dedicacao": "Bom",
    "companheirismo": "Otimo",
    "espiritualidade": "Regular",
    "comprometimento": "Bom",
    "uniforme": "Otimo"
  },
  "comentarios": "texto opcional"
}
```
Todos os 6 criterios sao obrigatorios (nao nullable); `comentarios` opcional. Sem `finalizar` boolean: a chamada ja representa a finalizacao.

Response 200: `{ "id": "<uuid>", "status": "finalizada", "finalizadoEm": "2026-08-30T12:03:00Z" }`.

Erros:
- `409 { erro: "Avaliação finalizada não pode ser alterada" }` — alvo ja finalizado.
- `422 { erro: "Para finalizar, todos os critérios devem ser preenchidos" }` — `finalizar: true` com criterio faltando.
- `422 { erro: "Coordenador não encontrado na edição." }` — alvo sem participacao valida como coordenador na mesma equipe na edicao.
- `401` JWT invalido/expirado; `410 { erro: "Link inativo." }` link revogado.

Valores validos (Zod) — na finalizacao todos os criterios sao obrigatorios:
```ts
criterios: z.object({
  pontualidade: z.enum(["Otimo", "Bom", "Regular", "Ruim"]),
  dedicacao:          z.enum(["Otimo", "Bom", "Regular", "Ruim"]),
  companheirismo:     z.enum(["Otimo", "Bom", "Regular", "Ruim"]),
  espiritualidade:    z.enum(["Otimo", "Bom", "Regular", "Ruim"]),
  comprometimento:    z.enum(["Otimo", "Bom", "Regular", "Ruim"]),
  uniforme:           z.enum(["Otimo", "Bom", "Regular", "Ruim"]),
}),
comentarios: z.string().max(4000).nullable(),
```
> Nota: valores sem acento por convencao do codigo; a UI exibe acentuados.

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

## Cliente frontend (`src/lib/avaliacaoEquipistaCoordenador.ts`)

Espelho de `src/lib/avaliacaoCoordenador.ts`:
- `gerarLinkAvaliacaoEquipista(edicaoId)` → `api.post("/api/avaliacao-equipista/links", { edicaoId })`
- `revogarLinkAvaliacaoEquipista(token)` → `api.put("/api/avaliacao-equipista/links/{token}/revogar")`
- `buscarLinkAvaliacaoEquipistaAtivo(edicaoId)` → `api.get("/api/avaliacao-equipista/links/{edicaoId}")` (null em erro/204)
- `listarAvaliacoesEquipistaCoordenador(edicaoId, {equipeId?, avaliadorPessoaId?, status?})` → `api.get("/api/avaliacoes-equipista-coordenador?...")`
- `buscarAvaliacaoEquipistaCoordenador(id)` → `api.get("/api/avaliacoes-equipista-coordenador/{id}")`
- `verificarLinkAvaliacaoEquipista(referencia)` → `apiPublica("GET", "/api/publico/avaliacao-equipista/{referencia}")`
- `identificarEquipista(referencia, cracha)` → `apiPublica("POST", "/api/publico/avaliacao-equipista/identificar", { token: referencia, cracha })`
- `listarAlvosAvaliacaoEquipista(sessaoToken)` → `api.get("/api/publico/avaliacao-equipista/alvos", sessaoToken)`
- `salvarAvaliacaoEquipistaCoordenador(sessaoToken, dados)` → `api.post("/api/publico/avaliacao-equipista", dados, sessaoToken)`

URL publica montada como `${window.location.origin}/avaliacao/equipista/${link.id}` (ex.: `/avaliacao/equipista/2026`).
