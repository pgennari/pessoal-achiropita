# Contracts: Historico de Check-in no Link Publico

## Rota Publica (sem autenticacao)

### GET /api/publico/checkin/{token}/historico

Retorna historico de check-ins do estacionamento agrupados por data.

**Request**:
- Path: `{token}` — token unico do estacionamento (24 chars hex)

**Response 200**:
```json
{
  "dias": [
    {
      "data": "2026-07-27",
      "total": 12,
      "checkins": [
        {
          "id": "uuid",
          "timestamp": "2026-07-27T18:00:00Z",
          "pessoaNome": "Joao Silva",
          "placa": "ABC-1234",
          "modelo": "Civic",
          "cor": "Prata"
        }
      ]
    },
    {
      "data": "2026-07-26",
      "total": 5,
      "checkins": [
        {
          "id": "uuid",
          "timestamp": "2026-07-26T14:30:00Z",
          "pessoaNome": "Maria Santos",
          "placa": "XYZ-5678",
          "modelo": "Onix",
          "cor": "Branco"
        }
      ]
    }
  ]
}
```

**Response 404**:
```json
{
  "erro": "Estacionamento nao encontrado."
}
```

**Response 200 (vazio)**:
```json
{
  "dias": []
}
```

---

## Rotas Existentes (sem alteracoes)

As rotas existentes de check-in permanecem inalteradas:
- `GET /api/publico/checkin/{token}` — dados do estacionamento
- `GET /api/publico/checkin/{token}/buscar?placa=XXX` — busca por placa
- `POST /api/publico/checkin/{token}` — registrar check-in
