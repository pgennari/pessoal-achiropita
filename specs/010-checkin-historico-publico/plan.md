# Implementation Plan: Historico de Check-in no Link Publico

**Branch**: `010-checkin-historico-publico` | **Date**: 2026-07-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-checkin-historico-publico/spec.md`

## Summary

Adicionar ao link publico de check-in dos estacionamentos: (1) limpeza automatica da lista de busca apos check-in, (2) secao "Ultimos check-ins realizados" com historico do dia atual, e (3) abas para navegar entre check-ins de dias anteriores. Requer nova rota publica no backend para buscar historico de check-ins por token.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), React 18, Hono (Node.js 22)

**Primary Dependencies**: Vite 5, React Query (TanStack Query), Hono, postgres.js

**Storage**: PostgreSQL (tabela `checkins` ja existe)

**Testing**: Nenhum test runner configurado — validacao manual via quickstart

**Target Platform**: SPA web (responsiva), API REST

**Project Type**: Web application (frontend SPA + backend API)

**Performance Goals**: Historico carrega em <3s (SC-001), busca por placa <2s

**Constraints**: Sem Cloud Functions (Firebase Spark), sem autenticacao na rota publica

**Scale/Scope**: Ate 500 pessoas por estacionamento, multiplas edicoes da festa

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Status | Observacao |
|-----------|--------|------------|
| I. Simplicidade | PASS | Solucao direta — reutiliza componentes existentes (ListaCheckins) |
| II. MVP Estrito | PASS | Implementa apenas o que a spec pede, sem features antecipadas |
| III. TypeScript | PASS | TypeScript em todo o codigo, sem `any` |
| IV. Convencoes | PASS | PT-BR em UI, commits no imperativo |
| V. Dependencias | PASS | Nenhuma nova dependencia necessaria |

## Project Structure

### Documentation (this feature)

```text
specs/010-checkin-historico-publico/
├── plan.md              # Este arquivo
├── research.md          # Fase 0
├── data-model.md        # Fase 1
├── quickstart.md        # Fase 1
├── contracts/           # Fase 1
└── tasks.md             # Fase 2 (/speckit.tasks)
```

### Source Code (repository root)

```text
# Frontend (src/)
src/
├── pages/
│   └── CheckinPublico.tsx        # Atualizar: limpar busca + secao historico
├── components/
│   ├── VeiculoCard.tsx           # Manter (ja existe)
│   ├── ModalCheckin.tsx          # Manter (ja existe)
│   └── HistoricoCheckinPublico.tsx  # NOVO: secao de historico com abas
├── lib/
│   ├── checkin.ts                # Atualizar: adicionar buscarHistoricoPublico()
│   └── hooks.ts                  # Atualizar: adicionar useHistoricoPublico()

# Backend (api/src/)
api/src/
├── rotas/
│   └── checkin.ts                # Atualizar: adicionar GET /{token}/historico
└── db.ts                         # Manter (ja existe)
```

**Structure Decision**: Frontend SPA + Backend API. Modificacoes em arquivos existentes + 1 componente novo.

## Complexity Tracking

Nenhuma violacao da constituição. Projeto segue padroes existentes.
