# Implementation Plan: Reaproveitar Equipe da Edicao Anterior

**Branch**: `029-reaproveitar-equipe-anterior` | **Date**: 2026-08-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/029-reaproveitar-equipe-anterior/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Na tela de detalhe da equipe (`/edicoes/:edicaoId/barracas/:equipeId`), quando a edicao da equipe esta em status `planejamento`, um painel lateral direito (drawer/sidesheet) lista as pessoas que participaram da equipe correspondente na edicao anterior (N-1), com as acoes "adicionar como Equipista" e "adicionar como Coordenador". A lista vem de um novo endpoint de leitura na API Hono que resolve a equipe anterior por nome normalizado (mesma regra do match de montagem); a acao de adicao **reutiliza** o fluxo de alocacao existente (`POST /api/participacoes`, permissao `edicao.equipeAlocar`, auditoria e historico ja inclusos). Nenhuma tabela nova e nenhuma dependencia nova.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict). API: Node.js 22 (Hono 4 + @hono/zod-openapi 1.4). Frontend: React 18.3 + Vite 5.

**Primary Dependencies**: `hono`, `@hono/zod-openapi`, `postgres.js`, `firebase-admin` (API); `@tanstack/react-query`, `react-router-dom`, `tailwindcss`, `lucide-react` (frontend). Sem dependencias novas.

**Storage**: PostgreSQL. Schema em `schema.sql` (sem framework de migracao; padrao `ALTER TABLE ... IF NOT EXISTS`). Tabelas envolvidas: `edicoes`, `equipes`, `participacoes`, `pessoas`. Sem mudanca de schema.

**Testing**: Sem test runner configurado. Gate de qualidade: `npm run lint` (= `tsc -b --noEmit`) no frontend e `api/npm run build` (= `tsc`) na API. Validacao funcional via `quickstart.md`.

**Target Platform**: Browser (SPA com PWA) + API Node.js 22 em Cloud Run/Render. Firebase Auth (email/senha + Google) com foto e o JWT verificado pela API via Firebase Admin.

**Project Type**: Web application (SPA frontend + REST API Hono em `/api`).

**Performance Goals**: Lista do painel carregada em menos de 2 segundos. Volume trivial (equipes com dezenas de pessoas; uma query de junta por equipe).

**Constraints**: Sem Cloud Functions — toda regra fica na API Hono. Sem dependencias novas. Backend valida autorizacao por rota via `temPermissao(sessao, codigo)`. Textos em PT-BR; identificadores/mensagens da API sem acentos (convencao existente). SPA statico em Firebase Hosting.

**Scale/Scope**: ~dezenas de equipes por edicao; equipes com dezenas de participacoes. Endpoint novo simples e sem paginacao.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Simplicidade**: Solucao direta: endpoint GET de leitura unico + drawer no frontend reusando `alocar` existente. Nao cria camadas (sem `services/`, `repositories/`). Utilitario de normalizacao de nome de equipe ja existe na montagem. **PASS**.
- **II. MVP Estrito**: Implementa somente o descrito no spec (FR-001 a FR-016). Nao antecipa outras telas nem padroniza um componente generico de sidesheet em outras paginas. Adicao NAO cria endpoint novo — reusa o de alocacao, mantendo regras iguais. **PASS**.
- **III. TypeScript & Seguranca de Tipos**: Tipos novos no contrato (`MembroEquipeAnterior`, `RespostaEquipeAnterior`) com `as never`/`as any` apenas na fronteira do zod-openapi (padrao existente em `rotas/*`). Frontend typado, sem `any`. **PASS**.
- **IV. Convencoes & Consistencia**: PT-BR na UI e em identificadores; campos SQL `snake_case`; camelCase no TS; datas ISO-8601. Normalizacao de nome de equipe identica a `montagem.ts` (regex de sufixos romanos/arabicos). **PASS**.
- **V. Dependencias & Autorizacao**: Zero dependencias novas. Autorizacao por rota: GET de leitura com `comAuth` (pagina de detalhe ja e visivel a qualquer perfil autenticado); adicao depende de `edicao.equipeAlocar` (herdada do `POST /api/participacoes`). **PASS**.

## Project Structure

### Documentation (this feature)

```text
specs/029-reaproveitar-equipe-anterior/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
api/src/
├── rotas/
│   └── participacoes.ts        # + GET /equipe-anterior (lista do painel)
└── index.ts                    # sem mudanca (rota ja montada em /api/participacoes)

src/
├── lib/
│   ├── participacoes.ts        # + tipo MembroEquipeAnterior + listarEquipeAnterior()
│   └── hooks.ts                # + useEquipeAnterior(edicaoId, equipeId)
├── components/
│   └── PainelEquipeAnterior.tsx  # novo: drawer lateral direito
└── pages/
    └── EquipeDetalhe.tsx       # + botao/abertura do painel quando edicao em planejamento
```

**Structure Decision**: Estrutura plana ja existente (rotas na API, `src/lib/` + `src/components/` + `src/pages/` no frontend). A feature adiciona 1 endpoint numa rota existente e 3 arquivos novos/reaproveita 1 pagina. Sem projets novos nem camadas.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Sem violacoes — a feature nao introduz complexidade que exija justificativa documental.

## Reavaliacao pos-design

Re-checagem apos a Fase 1 (research.md, data-model.md, contracts):

- A feature nao cria tabela, index, dependencia, permissao nova nem endpoint de mutacao (reusa `POST /api/participacoes`). Regra de "edicao anterior" e normalizacao de nome sao as mesmas da montagem (consistencia, principio I).
- Todos os gates da secao Constitution Check permanecem PASS; nenhuma decisao de design exigiu abrir excecao justificada. Nenhum [NEEDS CLARIFICATION] restante.