# Implementation Plan: Associacao Pessoa-Estacionamento

**Branch**: `005-estacionamento-pessoa` | **Date**: 2026-07-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-estacionamento-pessoa/spec.md`

## Summary

Adicionar funcionalidade de associacao entre pessoas e estacionamentos. Permite vincular uma pessoa a um estacionamento a partir de duas telas (detalhe da pessoa e detalhe do estacionamento), mantendo contador de vagas distribuidas e registro em auditoria. Relacao N:1 — cada pessoa pode estar associada a apenas um estacionamento por vez.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)

**Primary Dependencies**: Vite 5, React 18, Hono (backend), @tanstack/react-query, postgres.js

**Storage**: PostgreSQL (Neon) — adicionar coluna `estacionamento_id` na tabela `pessoas`

**Testing**: Sem test runner configurado (projeto usa validacao manual via `npm run lint` e `npm run build`)

**Target Platform**: Web SPA (desktop e mobile), Firebase Hosting

**Project Type**: Web application (frontend SPA + backend API)

**Performance Goals**: Resposta < 200ms para operacoes CRUD, listagens < 500ms

**Constraints**: Plano Spark (gratuito), sem Cloud Functions, backend Hono no Render

**Scale/Scope**: ~5.871 pessoas, ~27 edicoes, 50-100 usuarios simultaneos

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Status | Observacao |
|-----------|--------|------------|
| I. Simplicidade | ✅ PASS | Solucao direta: adicionar coluna na tabela existente, sem tabelas de associacao desnecessarias |
| II. MVP Estrito | ✅ PASS | Implementa apenas o que esta na spec (3 user stories) |
| III. TypeScript & Seguranca de Tipos | ✅ PASS | Interfaces ja definidas em `tipos.ts`, API com Zod schemas |
| IV. Convencoes & Consistencia | ✅ PASS | Segue padroes existentes (PT-BR, snake_case, camelCase) |
| V. Dependencias & Autorizacao | ✅ PASS | Usa Hono middleware existente (`comAuth`, `podeAdministrar`), sem novas libs |

## Project Structure

### Documentation (this feature)

```text
specs/005-estacionamento-pessoa/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 — decisoes tecnicas
├── data-model.md        # Phase 1 — modelo de dados
├── quickstart.md        # Phase 1 — guia de validacao
├── contracts/           # Phase 1 — contratos de API
│   └── estacionamento-pessoa.md
└── tasks.md             # Phase 2 (/speckit.tasks)
```

### Source Code (repository root)

```text
# Frontend (SPA)
src/
├── pages/
│   ├── PessoaDetalhe.tsx        # Adicionar secao de estacionamento
│   └── EstacionamentoDetalhe.tsx # Adicionar lista de pessoas vinculadas
├── components/
│   └── EstacionamentoPessoa.tsx  # Componente reutilizavel para vinculacao
├── lib/
│   ├── tipos.ts                 # Atualizar interface Pessoa
│   ├── hooks.ts                 # Adicionar usePessoasEstacionamento
│   ├── estacionamentos.ts       # Adicionar funcoes de associacao
│   └── pessoas.ts               # Atualizar PessoaForm
└── styles/
    └── globals.css              # Sem mudancas necessarias

# Backend (API)
api/src/
├── rotas/
│   ├── estacionamentos.ts       # Adicionar rotas de associacao
│   └── pessoas.ts               # Atualizar GET para incluir estacionamento
├── auth.ts                      # Sem mudancas (podeAdministrar ja existe)
└── db.ts                        # Sem mudancas
```

**Structure Decision**: Adicionar coluna `estacionamento_id` na tabela `pessoas` (N:1) e criar rotas de associacao nos endpoints de estacionamentos. Segue padrao existente do projeto.

## Complexity Tracking

> Nenhuma violacao de constituiçao identificada.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | — | — |
