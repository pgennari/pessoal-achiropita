# Contracts: Check-in nos Estacionamentos

## Rotas Publicas (sem autenticacao)

### GET /api/publico/checkin/{token}

Retorna dados do estacionamento para exibir na pagina publica.

**Request**:
- Path: `{token}` — token unico do estacionamento (24 chars hex)

**Response 200**:
```json
{
  "estacionamentoId": "uuid",
  "nome": "Estacionamento Central",
  "endereco": "Rua Exemplo, 123"
}
```

**Response 404**:
```json
{
  "erro": "Estacionamento nao encontrado."
}
```

---

### GET /api/publico/checkin/{token}/buscar?placa={placa}

Busca pessoas associadas ao estacionamento por placa do carro.

**Request**:
- Path: `{token}` — token do estacionamento
- Query: `placa` — placa completa ou parcial

**Response 200**:
```json
{
  "resultados": [
    {
      "pessoaId": "uuid",
      "pessoaNome": "Joao Silva",
      "carroId": "carro-001",
      "placa": "ABC-1234",
      "modelo": "Civic",
      "cor": "Prata",
      "jaPossuiCheckin": false
    }
  ]
}
```

**Response 404**:
```json
{
  "erro": "Nenhuma pessoa encontrada para esta placa neste estacionamento."
}
```

---

### POST /api/publico/checkin/{token}

Registra um check-in para uma pessoa/veiculo no estacionamento.

**Request**:
- Path: `{token}` — token do estacionamento
- Body:
```json
{
  "pessoaId": "uuid",
  "carroId": "carro-001"
}
```

**Response 200**:
```json
{
  "sucesso": true,
  "mensagem": "Check-in realizado com sucesso.",
  "checkin": {
    "id": "uuid",
    "timestamp": "2026-07-25T18:00:00Z",
    "pessoaNome": "Joao Silva",
    "placa": "ABC-1234",
    "modelo": "Civic",
    "cor": "Prata",
    "estacionamentoNome": "Estacionamento Central"
  }
}
```

**Response 409**:
```json
{
  "erro": "Este carro ja possui check-in registrado neste estacionamento."
}
```

**Response 404**:
```json
{
  "erro": "Estacionamento nao encontrado."
}
```

---

## Rotas Autenticadas (requer login ADM/ORG/CRD/EQP/OPC/REC)

### GET /api/estacionamentos/{id}/checkins

Lista check-ins de um estacionamento, agrupados por data.

**Request**:
- Path: `{id}` — UUID do estacionamento
- Auth: `comAuth` (qualquer perfil)

**Response 200**:
```json
{
  "checkins": [
    {
      "id": "uuid",
      "timestamp": "2026-07-25T18:00:00Z",
      "pessoaNome": "Joao Silva",
      "placa": "ABC-1234",
      "modelo": "Civic",
      "cor": "Prata"
    }
  ]
}
```

**Response 403**:
```json
{
  "erro": "Acesso negado."
}
```
