# Implementation Plan: Presenca de Equipistas

**Branch**: `013-presenca-equipistas` | **Date**: 2026-08-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/013-presenca-equipistas/spec.md`

## Summary

Criar controle de presenca dos equipistas da festa, em duas frentes:

1. **Tela interna** (`/presenca`, seção Pessoal, perfis ADM/ORG): abas por dia da festa da edicao ativa (`dias_festa`), cada aba com um link publico copiavel para registro de presenca daquele dia.
2. **Fluxo publico** (`/presenca/:token`, anonimo): o coordenador informa o proprio cracha, o sistema valida se e coordenador na edicao (participacao `funcao='Coordenador'`), sauda "Ola, {nome}" e libera a inclusao de equipistas da **mesma equipe** (participacao na mesma equipe, funcao Equipista/Apoio). Ao final, `CONFIRMAR PRESENCA` registra a presenca dos equipistas da lista para o dia.

Arquitetura existente reutilizada: API Hono + PostgreSQL (`api/`), SPA React + TanStack Query (`src/`), autenticacao Firebase com `comAuth`/`podeAdministrar`, fluxo publico anonimo com JWT curto assinado (`sessaoPublica.ts`) e rotas publicas em `/api/publico` (padrao `checkin.ts`/`publico.ts`).

## Technical Context

**Language/Version**: TypeScript 5.6 strict (SPA) e na API (Node.js 22, ESM)

**Primary Dependencies**: Frontend — React 18, Vite 5, Tailwind 3, TanStack Query. API — Hono/OpenAPIHono, zod, postgres.js, jose (JWT), firebase-admin. Nenhuma dependencia nova.

**Storage**: PostgreSQL (Neon). Novas tabelas `links_presenca` e `presencas` adicionadas a `schema.sql` (padrao idempotente das iteracoes anteriores).

**Testing**: Sem test runner configurado. Validacao por build: `npm run build` (= `tsc -b && vite build`), `npm run lint` (= `tsc -b --noEmit`) e `api/ npm run build` (= `tsc`).

**Target Platform**: Web (SPA Vite) + HTTP API Hono (Node 22)

**Project Type**: Aplicacao web (SPA + API HTTP)

**Performance Goals**: Lookups de cracha e respostas do fluxo publico em < 1s; volume pequeno (centenas de equipistas por dia). Sem alvo especial.

**Constraints**: Sem novas dependencias; rotas publicas expoem apenas dados minimos (sem PII alem de nome/cracha); mensagens PT-BR; autorizacao sempre no backend; requisito 13 (importacao legada) nao e tocado.

**Scale/Scope**: ~400 pessoas, ~40 equipes, poucos dias por edicao (colecao `dias_festa`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Avaliacao | Status |
|-----------|-----------|--------|
| I. Simplicidade | Reuso dos padroes existentes: rotas Hono (links.ts, entregas.ts), hooks/mutacoes (links.ts, formacoes.ts), pagina publica (ValidarPublico/CheckinPublico), tabs (EdicaoDetalhe `.tabs`), sessao publica JWT (sessaoPublica.ts). Sem camadas novas. | PASS |
| II. MVP Estrito | Apenas o fluxo da spec: abas + link publico por dia, identificacao do coordenador, inclusao de equipistas da mesma equipe e confirmacao de presenca. Sem tela interna de listagem de presencas, sem edicao/exclusao de presenca registrada, sem relatorios. | PASS |
| III. TypeScript & Seguranca de Tipos | Tipos novos em `api/src/tipos.ts` e `src/lib/tipos.ts`; mappers de linha tipados (padrao `*DeRow`); sem `any` novo. | PASS |
| IV. Convencoes & Consistencia | PT-BR em UI, mensagens, identificadores e commits; datas ISO (`YYYY-MM-DD` / ISO timestamp); sem emojis. | PASS |
| V. Dependencias & Autorizacao | Zero dependencias novas. Rotas internas exigem ADM/ORG (`comAuth` + `podeAdministrar`); fluxo publico valida coordenador via participacoes e protege as chamadas seguintes com JWT curto assinado; nenhuma rota publica retorna dados de terceiros. | PASS |

*Re-check apos Phase 1:* sem violacoes identificadas na fase de design (detalhes em research.md). Nenhuma justificativa de complexidade necessaria.

## Project Structure

### Documentation (this feature)

```text
specs/013-presenca-equipistas/
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
│   ├── presenca.ts           # Rotas internas: GET/POST /api/presenca/links (ADM/ORG)
│   └── presencaPublico.ts    # Rotas publicas em /api/publico/presenca (anonimo)
├── sessaoPresenca.ts         # Assina/valida JWT curto do coordenador (reusa jose)
└── tipos.ts                  # + SessaoPresenca, VariaveisPresenca

src/
├── pages/
│   ├── Presenca.tsx          # Tela interna: abas por dia + link publico copiavel
│   └── PresencaPublico.tsx   # Pagina publica /presenca/:token
├── lib/
│   ├── presenca.ts           # Cliente: gerar link, identificar coordenador, buscar equipista, confirmar
│   ├── tipos.ts              # + LinkPresenca, Presenca
│   └── hooks.ts              # + useLinksPresenca(edicaoId)
├── components/
│   └── Sidebar.tsx           # + item "Presenca" na secao Pessoal (ADM/ORG)
└── App.tsx                   # + rotas protegida /presenca e publica /presenca/:token

schema.sql                     # + tabelas links_presenca e presencas
```

**Structure Decision**: Estrutura plana existente, sem camadas novas. Segue os mesmos padroes de `links.ts`/`links_validacao` (link com token), `entregas.ts`/`entregas_cracha` (registro por id `${x}__${pessoa}`), `sessaoPublica.ts` (JWT de sessao publica) e `CheckinPublico.tsx` (pagina publica anonima). As rotas publicas de presenca ficam em roteador proprio (`/api/publico/presenca`), espelhando o padrao do check-in.

## Complexity Tracking

> Sem violacoes de constituicao identificadas. Nenhuma justificativa de complexidade necessaria.
