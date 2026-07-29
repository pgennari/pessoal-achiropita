# Research: Historico de Check-in no Link Publico

## Decisoes Tecnicas

### 1. Rota publica para historico de check-ins

**Decisao**: Criar nova rota `GET /api/publico/checkin/{token}/historico` sem autenticacao.

**Razao**: A pagina publica nao tem acesso autenticado. A rota existente `GET /api/estacionamentos/{id}/checkins` requer autenticacao (comAuth). Para manter a seguranca (token unico por estacionamento), a rota publica valida o token antes de retornar dados.

**Alternativas consideradas**:
- Reutilizar rota autenticada: Impossivel — a pagina publica nao tem sessao de usuario.
- Buscar todos os check-ins no frontend via Firestore: Nao aplicavel — check-ins estao no PostgreSQL.

### 2. Estrutura da resposta do historico

**Decisao**: Retornar check-ins ja agrupados por data no backend, com metadados de contagem por dia.

**Razao**: Evita processamento no frontend para grandes volumes de dados. O backend faz a agregacao SQL e retorna estrutura pronta para renderizacao.

**Formato da resposta**:
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
    }
  ]
}
```

**Alternativas consideradas**:
- Retornar array flat e agrupar no frontend: Simples, mas menos eficiente para muitos check-ins.
- Paginacao: Especificacao pede "listar todos" — sem paginacao por agora.

### 3. Componente de historico com abas

**Decisao**: Criar componente `HistoricoCheckinPublico` que reutiliza a logica de `ListaCheckins` (agrupamento por data, formatacao de hora) mas com abas para navegacao entre dias.

**Razao**: `ListaCheckins` ja resolve formatacao e ordenacao. O novo componente adiciona abas e gerencia aba selecionada (dia atual por padrao).

**Alternativas consideradas**:
- Estender `ListaCheckins` com prop `comAbas`: Acoplaria logica de abas num componente ja existente.
- Reutilizar apenas a funcao `agruparPorData`: Melhor separacao de responsabilidades.

### 4. Limpeza da busca apos check-in

**Decisao**: No `handleConfirmado` do `CheckinPublico`, adicionar `setResultados([])`, `setBuscou(false)`, `setPlaca("")` e focar o input.

**Razao**: A spec determina limpeza da lista e foco no campo de busca para facilitar o proximo registro.

**Implementacao**: Usar `useRef` no input de placa para chamar `.focus()` apos o check-in.

### 5. Atualizacao do historico apos check-in

**Decisao**: Usar React Query invalidation para forçar re-fetch do historico apos check-in.

**Razao**: Ja e o padrao do projeto — `useQuery` com `queryKey` invalidado apos mutacao. O hook `useHistoricoPublico(token)` sera invalidado no `handleConfirmado`.

**Alternativas consideradas**:
- Adicionar o check-in retornado ao estado local: Mais rapido, mas pode causar inconsistencia com o backend.
- Polling periodico: Mais complexo e desnecessario — invalidacao e suficiente.

### 6. Ordenacao das abas

**Decisao**: Abas em ordem cronologica decrescente (dia mais recente primeiro), com aba "Hoje" sempre primeira.

**Razao**: A spec determina ordem cronologica decrescente (FR-015) e aba do dia atual selecionada por padrao (FR-008).

**Formato do label**: "DD/MM (total)" — ex: "27/07 (12)".
