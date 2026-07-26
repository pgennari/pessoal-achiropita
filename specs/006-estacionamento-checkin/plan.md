# Implementation Plan: Check-in nos Estacionamentos

**Branch**: `006-estacionamento-checkin` | **Date**: 2026-07-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-estacionamento-checkin/spec.md`

## Summary

Adicionar controle de check-in nos estacionamentos. Cada estacionamento ganha um link publico (token unico) acessivel sem login. Atraves desse link, o operador pesquisa a placa do carro, visualiza as pessoas associadas e realiza o check-in. O check-in e unico por carro — uma vez feito, todas as pessoas daquele carro ficam com o botao desabilitado. Na area logada, o detalhe do estacionamento exibe historico de check-ins agrupados por data.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)

**Primary Dependencies**: Vite 5, React 18, Hono (backend), @tanstack/react-query, postgres.js

**Storage**: PostgreSQL (Neon) — nova tabela `checkins` + coluna `token_checkin` na tabela `estacionamentos`

**Testing**: Sem test runner configurado (projeto usa validacao manual via `npm run lint` e `npm run build`)

**Target Platform**: Web SPA (desktop e mobile), Firebase Hosting

**Project Type**: Web application (frontend SPA + backend API)

**Performance Goals**: Resposta < 200ms para operacoes de check-in, busca por placa < 2s para ate 500 pessoas

**Constraints**: Plano Spark (gratuito), sem Cloud Functions, backend Hono no Render

**Scale/Scope**: ~5.871 pessoas, ~27 edicoes, 50-100 usuarios simultaneos, ~10 estacionamentos

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Status | Observacao |
|-----------|--------|------------|
| I. Simplicidade | ✅ PASS | Tabela nova `checkins` + coluna `token_checkin` — solucao direta |
| II. MVP Estrito | ✅ PASS | Implementa apenas o que esta na spec (3 user stories) |
| III. TypeScript & Seguranca de Tipos | ✅ PASS | Interfaces em `tipos.ts`, API com Zod schemas |
| IV. Convencoes & Consistencia | ✅ PASS | Segue padroes existentes (PT-BR, snake_case, camelCase) |
| V. Dependencias & Autorizacao | ✅ PASS | Usa middleware `comAuth` e `apiPublica` existentes |

## Project Structure

### Documentation (this feature)

```text
specs/006-estacionamento-checkin/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 — decisoes tecnicas
├── data-model.md        # Phase 1 — modelo de dados
├── quickstart.md        # Phase 1 — guia de validacao
├── contracts/           # Phase 1 — contratos de API
│   └── checkin.md
└── tasks.md             # Phase 2 (/speckit.tasks)
```

### Source Code (repository root)

```text
# Frontend (SPA)
src/
├── pages/
│   ├── CheckinPublico.tsx          # Nova — pagina publica de check-in
│   └── EstacionamentoDetalhe.tsx   # Atualizar — adicionar secao de check-ins
├── components/
│   ├── ModalCheckin.tsx            # Novo — modal de confirmacao de check-in
│   └── ListaCheckins.tsx           # Novo — listagem de check-ins agrupados por data
├── lib/
│   ├── tipos.ts                    # Atualizar — adicionar interfaces Checkin, Estacionamento (token)
│   ├── hooks.ts                    # Atualizar — adicionar useCheckins, useBuscaPlaca
│   └── checkin.ts                  # Novo — funcoes de check-in (apiPublica)
└── styles/
    └── globals.css                 # Sem mudancas necessarias

# Backend (API)
api/src/
├── rotas/
│   ├── estacionamentos.ts          # Atualizar — adicionar token_checkin ao schema
│   └── checkin.ts                  # Novo — rotas publicas de check-in
├── auth.ts                         # Sem mudancas
└── db.ts                           # Sem mudancas

# Database
schema.sql                          # Atualizar — nova tabela checkins + coluna token_checkin
```

**Structure Decision**: Nova tabela `checkins` para armazenar registros de check-in, coluna `token_checkin` na tabela `estacionamentos` para o link publico, e novas rotas publicas sob `/api/publico/checkin/`. Segue padrao existente de rotas publicas (como `/api/publico/convite/` e `/api/publico/link/`).

## Complexity Tracking

> Nenhuma violacao de constituicao identificada.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | — | — |
