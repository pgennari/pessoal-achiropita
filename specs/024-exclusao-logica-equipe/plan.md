# Implementation Plan: Exclusao lógica de equipes

**Branch**: `024-exclusao-logica-equipe` | **Date**: 2026-08-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/024-exclusao-logica-equipe/spec.md`

## Summary

Excluir uma equipe deixa de apagar o registro e passa a marcar a equipe como `excluida` no banco. A exclusão desaloca automaticamente todas as pessoas da equipe (registrando a desalocação no histórico de movimentações da pessoa, como já ocorre em desalocações individuais) e desatrela subequipes do organograma. Toda leitura de equipes na API passa a filtrar `excluida = FALSE`, tornando a equipe excluída invisível em 100% das telas; o acesso por link direto resulta em "não encontrada". A mudança remove o hard delete e, de quebra, elimina a dependência do `ON DELETE CASCADE` que estava quebrado no banco de produção (erro `participacoes_equipe_id_fkey`).

## Technical Context

**Language/Version**: TypeScript (strict) — API Hono no Node.js 22 (`api/`) + React 18 SPA com Vite 5 (`src/`).

**Primary Dependencies**: `@hono/zod-openapi`, `postgres.js` (API); React Query (front). **Nenhuma dependência nova** (constituição §V).

**Storage**: PostgreSQL (Neon). Schema de referência em `schema.sql`; delta de produção via migration SQL no Neon.

**Testing**: Não há test runner configurado. Validação por `npm run lint` (= `tsc -b --noEmit`), builds (`npm run build` no frontend e `api/npm run build`) e cenários manuais do `quickstart.md`.

**Target Platform**: SPA (Firebase Hosting) + API web service (Node 22, `DATABASE_URL`/`PORT`).

**Project Type**: Web service + SPA (frente + back no mesmo repo, `src/` + `api/`).

**Performance Goals**: Exclusão de equipe concluída em <5s mesmo com pessoas alocadas (SC-005); listagens atuais sem degradação perceptível.

**Constraints**: PT-BR em UI/mensagens/comentários; sem emojis; permissões PBAC no backend (`edicao.equipeExcluir`); zero dependências novas; toda leitura de equipes deve ignorar `excluida = TRUE`.

**Scale/Scope**: ~40 equipes por edição ativa, ~100 edições históricas — tabela pequena, sem necessidade de índices adicionais nem paginação.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Simplicidade** — PASS: coluna booleana + filtro `WHERE excluida = FALSE` nas leituras + transação no `DELETE`. Sem camadas, serviços ou abstrações.
- **II. MVP estrito** — PASS: implementa exatamente o que a spec pede (marcar excluída, desalocar pessoas, invisibilidade total, preservar histórico). Fora de escopo: restauração de equipe, limpeza de `equipes_crd` em usuários, migração de dados.
- **III. TypeScript & Segurança de Tipos** — PASS: campo `excluida` tipado na interface `Equipe`; sem `any` novo.
- **IV. Convenções & Consistência** — PASS: PT-BR, `snake_case` no banco / `camelCase` no TS, sem emojis, datas ISO-8601, commits no imperativo.
- **V. Dependências & Autorização** — PASS: nenhuma dependência nova; autorização segue no backend via `temPermissao(sessao, "edicao.equipeExcluir")` já existente.

*Re-check pós-design: nenhuma violação introduzida pelos artefatos gerados.*

## Project Structure

### Documentation (this feature)

```text
specs/024-exclusao-logica-equipe/
├── plan.md              # Este arquivo (/speckit.plan)
├── research.md          # Decisões de design (Phase 0)
├── data-model.md        # Modelo de dados e transições (Phase 1)
├── quickstart.md        # Guia de validação manual (Phase 1)
├── contracts/           # Contratos de API alterados (Phase 1)
│   └── exclusao-equipes-api.md
└── tasks.md             # Phase 2 output (/speckit.tasks - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
api/src/rotas/equipes.ts          # DELETE vira soft-delete; leituras filtram excluida
api/src/rotas/presenca.ts         # resumo-equipes exclui equipes excluidas (grade/relatorio)
api/src/rotas/sincronizacao.ts    # contexto de equipes ignora excluidas
api/src/rotas/participacoes.ts    # alocacao rejeita equipe excluida
schema.sql                        # ADD COLUMN excluida
scripts/ajustar-fk-exclusao-equipes.sql  # migration do delta (já criado)
scripts/adicionar-coluna-excluida-equipes.sql  # migration do delta (criado)
src/lib/tipos.ts                  # interface Equipe ganha excluida: boolean
src/lib/equipes.ts                # equipeDeSnap mapeia excluida; comentario sobre cascade atualizado
```

**Structure Decision**: Mantém a estrutura plana existente (`api/src/rotas/`, `src/lib/`, `src/pages/`) sem novas camadas — a mudança é transversal (filtro em queries de equipes) e não merece abstração (constituição §I).

## Complexity Tracking

> Sem violações da constituição — tabela não preenchida.