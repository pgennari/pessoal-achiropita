# Implementation Plan: Montagem de Equipes

**Branch**: `022-montagem-equipes` | **Date**: 2026-08-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/022-montagem-equipes/spec.md`

## Summary

Tela de montagem de equipes que permite ao organizador selecionar uma equipe e visualizar pessoas candidatas ordenadas por pontuacao de match (0-100). O match combina historico de participacao (50pts), criterios de avaliacao (30pts), convidar novamente (10pts) e presencas (10pts). Inclui detalhamento por pessoa com navegacao historica e alocacao direta como Coordenador/Equipista.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), React 18, Node.js 22

**Primary Dependencies**: Vite 5, Hono (backend), @tanstack/react-query, Tailwind CSS 3, postgres.js, Firebase Auth, Zod

**Storage**: PostgreSQL (schema em `schema.sql`), Cloudflare R2 (fotos)

**Testing**: Sem test runner configurado

**Target Platform**: Web SPA (desktop e mobile responsivo)

**Project Type**: Web application (SPA frontend + Hono API backend)

**Performance Goals**: Listagem de equipes <2s, primeiro lote de candidatos <3s, detalhe do match instantaneo (client-side)

**Constraints**: Firebase Spark (sem Cloud Functions),SPA estatica com API Hono no Render

**Scale/Scope**: ~5.871 pessoas, ~27 edicoes de historico, ~100 equipes por edicao

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Simplicidade | PASS | Solucao direta: endpoint unico com JOINs, match calculado no backend, UI com componentes existentes |
| II. MVP Estrito | PASS | Implementa apenas o descrito na spec. Sem features antecipadas |
| III. TypeScript & Seguranca de Tipos | PASS | Tipos bem definidos para API response e entidades |
| IV. Convencoes & Consistencia | PASS | PT-BR em UI, snake_case no banco, camelCase no TS, sem emojis |
| V. Dependencias & Autorizacao | PASS | Sem novas dependencias. Nova permissao `edicao.montagem` segue padrao existente |

**Gate result (pre-design)**: PASS — todos os principios atendidos.

**Gate result (post-design)**: PASS — design mantem aderencia. Nenhuma nova dependencia, nenhuma abstracao desnecessaria, endpoint unico com CTEs diretas no PostgreSQL, componentes React simples seguindo padroes existentes.

## Project Structure

### Documentation (this feature)

```text
specs/022-montagem-equipes/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api-montagem.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── pages/
│   └── Montagem.tsx              # Nova pagina principal
├── components/
│   ├── MontagemEquipeCard.tsx     # Card de equipe na listagem horizontal
│   ├── MontagemCandidato.tsx      # Card de candidato com match score
│   ├── MontagemCandidatoDetalhe.tsx # Area expandida com detalhes do match
│   └── MontagemMatchHistorico.tsx # Card de match historico com navegacao
├── lib/
│   ├── montagem.ts               # Funcoes de calculo de match e normalizacao
│   └── hooks.ts                  # Novo hook useMontagemCandidatos

api/src/
├── rotas/
│   └── montagem.ts               # Novo endpoint: GET /api/montagem/candidatos
└── index.ts                      # Registro da nova rota

schema.sql                        # Adicao da permissao edicao.montagem
```

**Structure Decision**: Segue a estrutura existente do projeto. Pagina em `src/pages/`, componentes reutilizaveis em `src/components/`, logica de dominio em `src/lib/`, endpoint da API em `api/src/rotas/`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Nenhuma violacao | Todos os principios foram atendidos | N/A |
