# Contracts: Veículos API

**Date**: 2026-07-26

## Endpoints

### GET /api/veiculos

Lista todos os veículos.

**Response 200**:
```json
[
  {
    "id": "uuid",
    "fabricante": "Fiat",
    "modelo": "Argo",
    "placa": "ABC1D23",
    "cor": "Prata",
    "estacionamentoId": "uuid" | null,
    "criadoEm": "2026-07-26T00:00:00Z",
    "atualizadoEm": "2026-07-26T00:00:00Z"
  }
]
```

### GET /api/veiculos/:id

Busca veículo por ID.

**Response 200**:
```json
{
  "id": "uuid",
  "fabricante": "Fiat",
  "modelo": "Argo",
  "placa": "ABC1D23",
  "cor": "Prata",
  "estacionamentoId": "uuid" | null,
  "criadoEm": "2026-07-26T00:00:00Z",
  "atualizadoEm": "2026-07-26T00:00:00Z"
}
```

**Response 404**:
```json
{ "erro": "Veiculo nao encontrado." }
```

### POST /api/veiculos

Cadastra novo veículo. Requer perfil ADM ou ORG.

**Request**:
```json
{
  "fabricante": "Fiat",
  "modelo": "Argo",
  "placa": "ABC1D23",
  "cor": "Prata"
}
```

**Response 201**:
```json
{
  "id": "uuid",
  "fabricante": "Fiat",
  "modelo": "Argo",
  "placa": "ABC1D23",
  "cor": "Prata",
  "estacionamentoId": null,
  "criadoEm": "2026-07-26T00:00:00Z",
  "atualizadoEm": "2026-07-26T00:00:00Z"
}
```

**Response 409**:
```json
{ "erro": "Ja existe veiculo com esta placa." }
```

### PUT /api/veiculos/:id

Atualiza veículo. Requer perfil ADM ou ORG.

**Request**:
```json
{
  "fabricante": "Fiat",
  "modelo": "Argo",
  "placa": "ABC1D23",
  "cor": "Branco"
}
```

**Response 200**: Veículo atualizado.

### DELETE /api/veiculos/:id

Exclui veículo. Requer perfil ADM ou ORG. Bloqueado se existirem check-ins.

**Response 200**:
```json
{ "ok": true }
```

**Response 409**:
```json
{ "erro": "Veiculo possui check-ins registrados e nao pode ser excluido." }
```

---

### GET /api/veiculos/:id/pessoas

Lista pessoas vinculadas ao veículo.

**Response 200**:
```json
[
  { "id": "uuid", "nome": "João Silva", "cracha": 123 }
]
```

### POST /api/veiculos/:id/pessoas

Vincula pessoa ao veículo. Requer perfil ADM ou ORG.

**Request**:
```json
{ "pessoaId": "uuid" }
```

**Response 200**:
```json
{ "ok": true }
```

### DELETE /api/veiculos/:id/pessoas/:pessoaId

Desvincula pessoa do veículo. Requer perfil ADM ou ORG.

**Response 200**:
```json
{ "ok": true }
```

---

### GET /api/pessoas/:id/veiculos

Lista veículos vinculados à pessoa.

**Response 200**:
```json
[
  {
    "id": "uuid",
    "fabricante": "Fiat",
    "modelo": "Argo",
    "placa": "ABC1D23",
    "cor": "Prata",
    "estacionamentoId": "uuid" | null
  }
]
```

### POST /api/pessoas/:id/veiculos

Vincula veículo à pessoa. Requer perfil ADM ou ORG.

**Request**:
```json
{ "veiculoId": "uuid" }
```

**Response 200**:
```json
{ "ok": true }
```

### DELETE /api/pessoas/:id/veiculos/:veiculoId

Desvincula veículo da pessoa. Requer perfil ADM ou ORG.

**Response 200**:
```json
{ "ok": true }
```

---

### GET /api/estacionamentos/:id/veiculos

Lista veículos associados ao estacionamento.

**Response 200**:
```json
[
  {
    "id": "uuid",
    "fabricante": "Fiat",
    "modelo": "Argo",
    "placa": "ABC1D23",
    "cor": "Prata",
    "pessoas": [
      { "id": "uuid", "nome": "João Silva" }
    ]
  }
]
```

### POST /api/estacionamentos/:id/veiculos

Associa veículo ao estacionamento. Requer perfil ADM ou ORG.

**Request**:
```json
{ "veiculoId": "uuid" }
```

**Response 200**:
```json
{ "ok": true }
```

**Response 409**:
```json
{ "erro": "Veiculo ja esta associado a outro estacionamento." }
```

### DELETE /api/estacionamentos/:id/veiculos/:veiculoId

Desassocia veículo do estacionamento. Requer perfil ADM ou ORG.

**Response 200**:
```json
{ "ok": true }
```

---

### GET /api/publico/checkin/{token}/buscar?placa=XXX

Busca veículos por placa no estacionamento (público, sem auth).

**Response 200**:
```json
{
  "resultados": [
    {
      "veiculoId": "uuid",
      "placa": "ABC1D23",
      "modelo": "Argo",
      "cor": "Prata",
      "pessoas": [
        { "pessoaId": "uuid", "pessoaNome": "João Silva" }
      ],
      "jaPossuiCheckin": false
    }
  ]
}
```

**Response 404**:
```json
{ "erro": "Nenhum veiculo encontrado para esta placa neste estacionamento." }
```
