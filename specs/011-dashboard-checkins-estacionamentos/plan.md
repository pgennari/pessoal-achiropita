# Implementation Plan: Dashboard de Check-ins em Tempo Real

**Branch**: `011-dashboard-checkins-estacionamentos` | **Date**: 2026-07-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-dashboard-checkins-estacionamentos/spec.md`

## Summary

Criar um dashboard em tempo real para o centro de gestao de estacionamentos, exibindo ocupacao de todos os estacionamentos (check-ins do dia / vagas contratadas) e lista de ultimos check-ins, com notificacoes visuais chamativas via push do backend (SSE). A arquitetura usa o padrao existente de Hono + React, adicionando SSE para eventos em tempo real.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend + backend), Node.js 22

**Primary Dependencies**: 
- Backend: Hono (existente), `postgres` (existente), `@hono/node-server` (existente)
- Frontend: React 18 (existente), `@tanstack/react-query` (existente), `react-router-dom` (existente)
- Novo: nenhuma dependencia externa — SSE e nativo (EventSource no browser, `c.stream()` no Hono)

**Storage**: PostgreSQL (Neon) — sem novas tabelas, apenas consultas nas tabelas existentes `estacionamentos`, `checkins`, `veiculos`, `pessoa_veiculo`

**Testing**: Nenhum test runner configurado no projeto — validacao manual via quickstart

**Target Platform**: Navegador desktop (widescreen 1920x1080+), Firebase Hosting + Cloud Run

**Project Type**: SPA (Vite + React) com API REST + SSE (Hono em Cloud Run)

**Performance Goals**: 
- Ocupacao e check-ins exibidos em ate 3 segundos no carregamento inicial
- Notificacao push chega ao frontend em ate 3 segundos apos o check-in
- Dashboard mantem-se estavel por 8 horas de uso continuo

**Constraints**: 
- Cloud Run timeout de 60 min para streaming — reconexao SSE obrigatoria
- Sem dependencias externas novas — SSE nativo apenas
- Autenticacao via Firebase ID Token (existente)
- Perfil ADM/ORG obrigatorio para acessar o dashboard

**Scale/Scope**: 
- ~5-10 estacionamentos
- ~50-100 check-ins/dia (pico em horarios de entrada)
- 1-2 telas de dashboard abertas simultaneamente (centro de gestao)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Gates from project principles (CLAUDE.md)

| Gate | Principle | Check |
|------|-----------|-------|
| G1 | **Simples > esperto** | Aprovado — SSE e mais simples que WebSocket para push unidirecional; sem filas ou broker externo |
| G2 | **MVP estrito** | Aprovado — apenas o que esta no spec: ocupacao, ultimos check-ins, notificacao visual |
| G3 | **Sem implementacao parcial** | Aprovado — dashboard completo em uma unica entrega |
| G4 | **Sem dependencias por capricho** | Aprovado — 0 novas dependencias (SSE nativo) |
| G5 | **Sem camadas prematuras** | Aprovado — usa hooks e servicos existentes; sem repositories/services |
| G6 | **Autorizacao no backend** | Aprovado — SSE endpoint verifica ADM/ORG assim como as demais rotas |
| G7 | **snake_case no banco / camelCase no TS** | Aprovado — seguira a convencao existente |
| G8 | **PT-BR em UI e identificadores** | Aprovado — dashboard em PT-BR, nomes de rotas e componentes em portugues |

**Resultado**: GATE PASS — todas as gates aprovadas sem violacoes.

**Re-check pos-design (Phase 1)**: GATE PASS — design com SSE nativo, zero novas dependencias, sem camadas prematuras, autorizacao no backend. Nenhuma violacao identificada.

## Project Structure

### Documentation (this feature)

```text
specs/011-dashboard-checkins-estacionamentos/
├── spec.md              # Feature specification
├── plan.md              # This file (implementation plan)
├── research.md          # Phase 0 output (push mechanism research)
├── data-model.md        # Phase 1 output (data model / queries)
├── quickstart.md        # Phase 1 output (validation guide)
└── contracts/           # Phase 1 output (API contracts)
    └── dashboard-api.md
```

### Source Code (repository root)

```text
# Frontend (src/)
src/
├── pages/
│   └── DashboardEstacionamentos.tsx   # Nova pagina do dashboard
├── components/
│   ├── CardOcupacao.tsx               # Card individual de estacionamento
│   ├── ListaCheckinsRecentes.tsx      # Tabela de ultimos check-ins
│   └── NotificacaoCheckin.tsx         # Toast/banner de novo check-in
├── lib/
│   ├── dashboard.ts                   # Servico: fetch inicial + conexao SSE
│   └── hooks.ts                       # Hook useDashboardEstacionamentos (adicionar ao arquivo existente)
└── App.tsx                            # + Rota /dashboard/estacionamentos

# Backend (api/src/)
api/src/
├── rotas/
│   └── dashboard.ts                   # Novas rotas: GET /api/estacionamentos/dashboard, GET .../eventos
├── index.ts                           # + app.route("/api/estacionamentos/dashboard", dashboard)

# Modificacoes em arquivos existentes:
api/src/rotas/checkin.ts               # + emitir evento apos INSERT de check-in
```

**Structure Decision**: Frontend e backend separados (monorepo), seguindo a estrutura existente do projeto. Nenhuma camada nova introduzida.

## Complexity Tracking

Nenhuma violacao constitucional — todas as gates passam sem justificativa adicional.
