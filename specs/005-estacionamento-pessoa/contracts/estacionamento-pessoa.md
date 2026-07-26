# API Contract: Associacao Pessoa-Estacionamento

## Endpoints

### POST /api/estacionamentos/:id/pessoas

**Descricao**: Associa uma pessoa a um estacionamento

**Autenticacao**: Requer Bearer token (ADM ou ORG)

**Request Body**:
```json
{
  "pessoaId": "string (UUID)"
}
```

**Responses**:

- **201 Created**:
```json
{
  "pessoaId": "uuid",
  "estacionamentoId": "uuid",
  "vagasDistribuidas": 15
}
```

- **400 Bad Request**:
```json
{
  "erro": "Pessoa ja esta associada a este estacionamento."
}
```

- **403 Forbidden**:
```json
{
  "erro": "Acesso negado. Requer ADM ou ORG."
}
```

- **404 Not Found**:
```json
{
  "erro": "Estacionamento nao encontrado."
}
```

---

### DELETE /api/estacionamentos/:id/pessoas/:pessoaId

**Descricao**: Remove a associacao de uma pessoa ao estacionamento

**Autenticacao**: Requer Bearer token (ADM ou ORG)

**Responses**:

- **200 OK**:
```json
{
  "ok": true,
  "vagasDistribuidas": 14
}
```

- **403 Forbidden**:
```json
{
  "erro": "Acesso negado. Requer ADM ou ORG."
}
```

- **404 Not Found**:
```json
{
  "erro": "Associacao nao encontrada."
}
```

---

### GET /api/estacionamentos/:id/pessoas

**Descricao**: Lista pessoas associadas ao estacionamento

**Autenticacao**: Requer Bearer token

**Query Parameters**: Nenhum

**Responses**:

- **200 OK**:
```json
[
  {
    "id": "uuid",
    "cracha": 1234,
    "nome": "Joao Silva",
    "telefone": "(11) 99999-9999",
    "fotoUrl": "https://...",
    "ativo": true
  }
]
```

- **404 Not Found**:
```json
{
  "erro": "Estacionamento nao encontrado."
}
```

---

### GET /api/pessoas/:id

**Descricao**: Busca pessoa por ID (atualizado para incluir estacionamento)

**Autenticacao**: Requer Bearer token

**Responses**:

- **200 OK**:
```json
{
  "id": "uuid",
  "cracha": 1234,
  "nome": "Joao Silva",
  "estacionamentoId": "uuid",
  "estacionamentoNome": "Estacionamento Central",
  "temEstacionamento": true,
  "vagasDistribuidas": 15,
  ...
}
```

**Nota**: Os campos `estacionamentoId`, `estacionamentoNome` e `temEstacionamento` sao adicionados na resposta. `temEstacionamento` e derivado de `estacionamentoId != null`.

---

## Schemas

### PessoaComEstacionamento

```typescript
interface PessoaComEstacionamento extends Pessoa {
  estacionamentoId?: string;
  estacionamentoNome?: string;
  temEstacionamento: boolean;
}
```

### EstacionamentoComPessoas

```typescript
interface EstacionamentoComPessoas extends Estacionamento {
  pessoas: PessoaResumo[];
}

interface PessoaResumo {
  id: string;
  cracha: number;
  nome: string;
  telefone: string;
  fotoUrl?: string;
  ativo: boolean;
}
```

## Auditoria

Eventos registrados:
- `estacionamento.associou` — quando pessoa e vinculada
- `estacionamento.desassociou` — quando pessoa e desvinculada

Formato: `registrarEvento(sessao, acao, alvo, detalhes)`
