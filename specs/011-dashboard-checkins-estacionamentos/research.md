# Phase 0 Research: Dashboard de Check-ins em Tempo Real

## Unknown 1: Mecanismo de Push em Tempo Real

**Contexto**: O backend precisa notificar o frontend sempre que um check-in for registrado, sem polling.

### Decisao: SSE (Server-Sent Events)

**Alternativas consideradas**:
1. **SSE (Server-Sent Events)** — escolhido
2. **WebSocket** — rejeitado por ser bidirecional (nao necessario), exigir lib externa, maior complexidade
3. **Polling** — rejeitado pelo requisito explicito do usuario

**Racional**:
- SSE e nativo no browser (EventSource) e no Hono (`c.stream()`)
- Unidirecional (servidor → cliente) — atende exatamente ao caso de uso
- Reconexao automatica nativa no EventSource
- Zero dependencias novas
- Cloud Run suporta streaming HTTP (timeout de 60 min, reconexao resolvida pelo EventSource)

### Arquitetura do Push

```
[POST /api/publico/checkin/{token}] → handler insere checkin → EventEmitter.emit("checkin", dados)
                                                                        ↓
[GET /api/estacionamentos/dashboard/eventos] ← SSE stream ← EventEmitter.on("checkin", escreve SSE)
                                                                        ↓
                                                              Browser EventSource (reconexao auto)
```

1. **EventEmitter singleton** em `api/src/eventos.ts` — `EventEmitter` do Node.js
2. **Checkin route** (`api/src/rotas/checkin.ts`): apos INSERT bem-sucedido, emite evento
3. **Dashboard SSE route** (`api/src/rotas/dashboard.ts`): autenticada (ADM/ORG), mantem SSE aberta, escuta eventos
4. **Frontend**: `EventSource` conecta ao endpoint SSE, processa mensagens `checkin` e atualiza estado

### Formato do Evento SSE

```
event: checkin
data: {"id":"uuid","timestamp":"2026-07-28T10:30:00Z","pessoaNome":"Maria","placa":"ABC1234","modelo":"Gol","cor":"Prata","estacionamentoNome":"Estacionamento Bela Vista"}
```

## Unknown 2: Endpoint de Dados Iniciais do Dashboard

**Contexto**: Ao abrir o dashboard, e necessario carregar o estado completo (ocupacao + ultimos check-ins) antes de conectar o SSE.

### Decisao: Novo endpoint `GET /api/estacionamentos/dashboard`

Retorna:
```json
{
  "estacionamentos": [
    {
      "id": "uuid",
      "nome": "Estacionamento Bela Vista",
      "endereco": "Rua Treze de Maio, 123",
      "vagasContratadas": 50,
      "checkinsHoje": 12,
      "ocupacaoPercentual": 24
    }
  ],
  "ultimosCheckins": [
    {
      "id": "uuid",
      "timestamp": "2026-07-28T10:30:00Z",
      "pessoaNome": "Maria",
      "placa": "ABC1234",
      "modelo": "Gol",
      "cor": "Prata",
      "estacionamentoNome": "Estacionamento Bela Vista"
    }
  ],
  "timestamps": {
    "geradoEm": "2026-07-28T10:30:00Z",
    "dataReferencia": "2026-07-28"
  }
}
```

**Queries SQL**:
- `SELECT e.*, COUNT(c.id) AS checkins_hoje FROM estacionamentos e LEFT JOIN checkins c ON c.estacionamento_id = e.id AND c.data = CURRENT_DATE GROUP BY e.id ORDER BY e.nome`
- `SELECT * FROM checkins WHERE data = CURRENT_DATE ORDER BY timestamp DESC LIMIT 20`

## Unknown 3: Frontend — Hook de Dashboard

**Contexto**: O frontend precisa gerenciar o estado do dashboard (dados iniciais + atualizacoes SSE).

### Decisao: Hook `useDashboardEstacionamentos`

```typescript
interface EstadoDashboard {
  estacionamentos: EstacionamentoComOcupacao[];
  ultimosCheckins: CheckinResumo[];
  timestamps: { geradoEm: string; dataReferencia: string };
  conectado: boolean; // status da conexao SSE
  erros: string | null;
}

function useDashboardEstacionamentos(): {
  dados: EstadoDashboard | null;
  carregando: boolean;
  erro: string | null;
  conectado: boolean;
}
```

Fluxo:
1. `useQuery` carrega `GET /api/estacionamentos/dashboard` (dados iniciais)
2. Apos carregar, abre `EventSource` para `/api/estacionamentos/dashboard/eventos`
3. Ao receber evento `checkin`, atualiza o estado local (adiciona check-in na lista, incrementa contagem do estacionamento)
4. Se SSE desconectar, marca `conectado: false` (EventSource tenta reconectar automaticamente)
5. Ao reconectar, o EventSource reabre a conexao e recebe apenas eventos novos (sem lacunas porque o estado inicial veio do endpoint REST)

## Unknown 4: Autenticacao no SSE

**Contexto**: O endpoint SSE precisa ser autenticado (ADM/ORG).

### Decisao: Token via query string + middleware `comAuth`

SSE (EventSource) nao suporta headers customizados. Duas abordagens:

1. **Token na query string**: `/api/estacionamentos/dashboard/eventos?token=<firebase-id-token>`
2. **Cookie de sessao**: nao implementado no projeto

Escolha: **Token na query string**.
- O frontend obtem o token via `auth().currentUser.getIdToken()`
- O backend extrai o token de `c.req.query("token")` e verifica com Firebase Admin
- Apos verificacao, valida perfil ADM/ORG

**Seguranca**: O token e JWT curto (1h), a conexao e HTTPS, o token aparece nos logs do servidor apenas se configurado — aceitavel para o contexto.

**Alternativa rejeitada**: Usar `Authorization` header nao e possivel com EventSource puro.

## Resumo das Decisoes

| Decisao | Escolha | Justificativa |
|---------|---------|---------------|
| Mecanismo de push | SSE | Nativo, unidirecional, zero dependencias |
| Integracao backend | EventEmitter singleton | Simples, sem fila externa |
| Dados iniciais | `GET /api/estacionamentos/dashboard` | REST padrao, cacheavel |
| Hook frontend | `useDashboardEstacionamentos` | Segue padrao `useQuery` + SSE local |
| Autenticacao SSE | Token na query string | Unica opcao viavel com EventSource nativo |
