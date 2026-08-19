# Contratos de Integracao: Avaliacao de Equipistas

## Rotas Internas (requerem autenticacao ADM/ORG)

### Gerenciar Link de Avaliacao

**`POST /api/avaliacao/links`** — Gerar link de avaliacao para a edicao

Request:
```json
{ "edicaoId": "string" }
```

Response 201:
```json
{
  "id": "string (token 32 hex)",
  "edicaoId": "string",
  "status": "ativo",
  "criadoPorUid": "string",
  "criadoPorNome": "string",
  "criadoEm": "ISO timestamp"
}
```

Comportamento: Se ja existe link ativo para a edicao, revoga o anterior e cria novo. Registra evento de auditoria.

---

**`PUT /api/avaliacao/links/:token/revogar`** — Revogar link de avaliacao

Response 200:
```json
{ "ok": true }
```

Comportamento: Altera status para `revogado`. Avaliacoes em andamento nao sao afetadas.

---

**`GET /api/avaliacao/links/:edicaoId`** — Buscar link ativo da edicao

Response 200:
```json
{
  "id": "string (token)",
  "edicaoId": "string",
  "status": "ativo",
  "criadoEm": "ISO timestamp"
}
```

Response 204: Nenhum link ativo para a edicao.

---

### Listar Avaliacoes (interno)

**`GET /api/avaliacoes?edicaoId=:edicaoId&equipeId=:equipeId&status=:status`** — Listar avaliacoes da edicao

Query params: `edicaoId` (obrigatorio), `equipeId` (opcional), `status` (opcional: `rascunho`/`finalizada`)

Response 200:
```json
[
  {
    "id": "string",
    "pessoaId": "string",
    "pessoaNome": "string",
    "equipeId": "string",
    "equipeNome": "string",
    "avaliadorCracha": 12345,
    "avaliadorNome": "string",
    "criterios": {
      "pontualidade": "Otimo",
      "dedicacao": "Bom",
      "companheirismo": "Regular",
      "espiritualidade": "Otimo",
      "comprometimento": "Bom",
      "uniforme": "Ruim"
    },
    "aptoCoordenar": true,
    "comentarios": "string",
    "status": "rascunho",
    "criadoEm": "ISO timestamp",
    "atualizadoEm": "ISO timestamp",
    "finalizadoEm": null
  }
]
```

---

**`GET /api/avaliacoes/:id`** — Detalhes de uma avaliacao

Response 200: Objeto Avaliacao completo (mesmo formato acima).

---

### Listar Avaliacoes por Pessoa (interno)

**`GET /api/avaliacoes/pessoa/:pessoaId`** — Avaliacoes de uma pessoa em todas as edicoes

Response 200:
```json
[
  {
    "id": "string",
    "edicaoId": "string",
    "edicaoNumero": 100,
    "equipeNome": "string",
    "avaliadorNome": "string",
    "criterios": { "..." },
    "aptoCoordenar": true,
    "comentarios": "string",
    "status": "finalizada",
    "atualizadoEm": "ISO timestamp"
  }
]
```

Ordenado por `atualizado_em` DESC.

---

## Rotas Publicas (anonimas, sem autenticacao)

### Verificar Link

**`GET /api/publico/avaliacao/:token`** — Verificar status do link

Response 200:
```json
{
  "valido": true,
  "edicaoId": "string",
  "edicaoNumero": 100
}
```

Response 200 (link invalido/revogado):
```json
{ "valido": false }
```

---

### Identificar Coordenador

**`POST /api/publico/avaliacao/coordenador`** — Validar cracha e identificar coordenador

Request:
```json
{
  "token": "string (link token)",
  "cracha": 12345
}
```

Response 200 (coordenador valido):
```json
{
  "nome": "string",
  "equipeId": "string",
  "equipeNome": "string",
  "sessaoToken": "string (JWT curto)"
}
```

Response 200 (acesso negado — mesma mensagem para cracha inexistente e nao-coordenador):
```json
{ "erro": "Acesso negado" }
```

Comportamento: Gera JWT curto (1h) com `pessoaId, cracha, edicaoId, equipeId, linkToken`.

---

### Listar Equipistas

**`GET /api/publico/avaliacao/equipistas`** — Listar equipistas da equipe do coordenador

Headers: `Authorization: Bearer <sessaoToken>`

Response 200:
```json
[
  {
    "pessoaId": "string",
    "nome": "string",
    "avaliacaoId": "string ou null",
    "statusAvaliacao": "rascunho" | "finalizada" | null
  }
]
```

Comportamento: Retorna apenas equipistas da equipe do coordenador (participacao com funcao Equipista). AvaliacaoId e statusAvaliacao indicam se ja existe avaliacao para essa pessoa na edicao.

---

### Salvar/Finalizar Avaliacao

**`POST /api/publico/avaliacao`** — Criar ou atualizar avaliacao (rascunho ou finalizada)

Headers: `Authorization: Bearer <sessaoToken>`

Request (criar ou atualizar rascunho):
```json
{
  "pessoaId": "string",
  "criterios": {
    "pontualidade": "Otimo" | "Bom" | "Regular" | "Ruim" | null,
    "dedicacao": "Otimo" | "Bom" | "Regular" | "Ruim" | null,
    "companheirismo": "Otimo" | "Bom" | "Regular" | "Ruim" | null,
    "espiritualidade": "Otimo" | "Bom" | "Regular" | "Ruim" | null,
    "comprometimento": "Otimo" | "Bom" | "Regular" | "Ruim" | null,
    "uniforme": "Otimo" | "Bom" | "Regular" | "Ruim" | null
  },
  "aptoCoordenar": true | false | null,
  "comentarios": "string ou null",
  "finalizar": false
}
```

Request (finalizar):
```json
{
  "pessoaId": "string",
  "criterios": { "... todos com valor ..." },
  "aptoCoordenar": true | false,
  "comentarios": "string ou null",
  "finalizar": true
}
```

Response 200:
```json
{
  "id": "string",
  "status": "rascunho" | "finalizada",
  "atualizadoEm": "ISO timestamp"
}
```

Response 422 (finalizar com dados incompletos):
```json
{
  "erro": "Para finalizar, todos os criterios e a aptidao devem ser preenchidos"
}
```

Response 409 (tentar alterar avaliacao finalizada):
```json
{
  "erro": "Avaliacao finalizada nao pode ser alterada"
}
```

Comportamento:
- Se `avaliacaoId` ja existe para a pessoa na edicao e status e `rascunho`: atualiza
- Se `avaliacaoId` ja existe e status e `finalizada`: rejeita com 409
- Se nao existe: cria novo registro com status `rascunho`
- Se `finalizar=true`: valida completude, altera para `finalizada` e preenche `finalizadoEm`
- Auto-save no frontend envia `finalizar=false` a cada alteracao com debounce 2s
