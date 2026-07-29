# API Contracts: Dashboard de Check-ins

## 1. GET /api/estacionamentos/dashboard

Carrega o estado inicial completo do dashboard (ocupacao + ultimos check-ins).

**Autenticacao**: Firebase ID Token (Bearer), perfil ADM ou ORG

**Resposta 200**:

```json
{
  "estacionamentos": [
    {
      "id": "a1b2c3d4-...",
      "nome": "Estacionamento Bela Vista",
      "endereco": "Rua Treze de Maio, 123",
      "vagasContratadas": 50,
      "checkinsHoje": 12,
      "ocupacaoPercentual": 24
    }
  ],
  "ultimosCheckins": [
    {
      "id": "e5f6g7h8-...",
      "timestamp": "2026-07-28T10:30:00.000Z",
      "pessoaNome": "Maria Silva",
      "placa": "ABC1234",
      "modelo": "Gol",
      "cor": "Prata",
      "estacionamentoId": "a1b2c3d4-...",
      "estacionamentoNome": "Estacionamento Bela Vista"
    }
  ],
  "timestamps": {
    "geradoEm": "2026-07-28T10:30:00.000Z",
    "dataReferencia": "2026-07-28"
  }
}
```

**Resposta 403**:
```json
{ "erro": "Acesso negado. Requer ADM ou ORG." }
```

## 2. GET /api/estacionamentos/dashboard/eventos

Conexao SSE para receber atualizacoes em tempo real.

**Autenticacao**: Firebase ID Token via query string `?token=<id-token>`

**Stream de eventos**:

```
event: checkin
data: {"id":"e5f6g7h8-...","timestamp":"2026-07-28T10:30:00.000Z","pessoaNome":"Maria Silva","placa":"ABC1234","modelo":"Gol","cor":"Prata","estacionamentoId":"a1b2c3d4-...","estacionamentoNome":"Estacionamento Bela Vista"}

event: heartbeat
data: 2026-07-28T10:31:00.000Z
```

| Evento | Frequencia | Descricao |
|--------|------------|-----------|
| `checkin` | A cada check-in registrado | Dados completos do check-in |
| `heartbeat` | A cada 30 segundos | Mantem a conexao ativa, evita timeout |

**Comportamento**:
- Mantem conexao HTTP aberta (streaming)
- Envia `heartbeat` a cada 30s para evitar timeout do Cloud Run / proxies
- Envia `checkin` imediatamente apos cada check-in registrado
- Cliente deve reconectar automaticamente se a conexao cair (EventSource nativo faz isso)

**Erro 403** (token invalido ou perfil sem acesso):
```json
{ "erro": "Acesso negado." }
```
A conexao e encerrada.

## 3. Notificacao Visual (Frontend)

### Formato do evento processado pelo hook `useDashboardEstacionamentos`

```typescript
interface CheckinEvento {
  tipo: "checkin";
  dados: {
    id: string;
    timestamp: string;
    pessoaNome: string;
    placa: string;
    modelo: string;
    cor: string;
    estacionamentoNome: string;
  };
}
```

### Comportamento do hook ao receber evento

1. Adiciona o novo check-in ao inicio da lista `ultimosCheckins` (mantendo max 20)
2. Incrementa `checkinsHoje` do estacionamento correspondente
3. Recalcula `ocupacaoPercentual` do estacionamento
4. Atualiza estado `conectado` (true ao conectar, false ao desconectar)
5. Dispara callback de notificacao visual (toast/banner)

## TypeScript Interfaces

```typescript
// src/lib/dashboard.ts

export interface EstacionamentoComOcupacao {
  id: string;
  nome: string;
  endereco: string;
  vagasContratadas: number;
  checkinsHoje: number;
  ocupacaoPercentual: number | null; // null se vagasContratadas = 0
}

export interface CheckinResumo {
  id: string;
  timestamp: string;
  pessoaNome: string;
  placa: string;
  modelo: string;
  cor: string;
  estacionamentoId: string;
  estacionamentoNome: string;
}

export interface DashboardInicial {
  estacionamentos: EstacionamentoComOcupacao[];
  ultimosCheckins: CheckinResumo[];
  timestamps: {
    geradoEm: string;
    dataReferencia: string;
  };
}
```
