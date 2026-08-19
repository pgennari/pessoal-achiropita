# Implementation Plan: Avaliacao de Equipistas

**Branch**: `019-avaliacao-equipistas` | **Date**: 2026-08-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/019-avaliacao-equipistas/spec.md`

## Summary

Transformar o formulario fisico de avaliacao de equipistas em funcionalidade digital. Coordenadores avaliam equipistas da propria equipe via link publico unico por edicao, identificando-se pelo numero do cracha. A avaliacao contem 6 criterios (Otimo/Bom/Regular/Ruim), aptidao para coordenar e comentarios. Rascunhos sao salvos automaticamente (debounce 2s). Avaliacoes finalizadas sao imutaveis. A avaliacao tambem e exibida na tela de detalhes da pessoa (aba "Historico de Avaliacoes") e na tela de detalhes da edicao (link + listagem).

Arquitetura existente reutilizada: API Hono + PostgreSQL (`api/`), SPA React + TanStack Query (`src/`), autenticacao Firebase com `comAuth`/`podeAdministrar`, fluxo publico anonimo com JWT curto assinado (`sessaoPublica.ts`/`sessaoPresenca.ts`) e rotas publicas em `/api/publico`.

## Technical Context

**Language/Version**: TypeScript 5.6 strict (SPA) e na API (Node.js 22, ESM)

**Primary Dependencies**: Frontend — React 18, Vite 5, Tailwind 3, TanStack Query. API — Hono/OpenAPIHono, zod, postgres.js, jose (JWT), firebase-admin. Nenhuma dependencia nova.

**Storage**: PostgreSQL (Neon). Novas tabelas `links_avaliacao` e `avaliacoes` adicionadas a `schema.sql`.

**Testing**: Sem test runner configurado. Validacao por build: `npm run build` (= `tsc -b && vite build`), `npm run lint` (= `tsc -b --noEmit`) e `api/ npm run build` (= `tsc`).

**Target Platform**: Web (SPA Vite) + HTTP API Hono (Node 22)

**Project Type**: Aplicacao web (SPA + API HTTP)

**Performance Goals**: Lookup de cracha e listagem de equipistas em < 1s; auto-save com debounce 2s; volume pequeno (dezenas de equipistas por equipe). Sem alvo especial.

**Constraints**: Sem novas dependencias; rotas publicas expoem apenas dados minimos; mensagens PT-BR; autorizacao sempre no backend; link unico por edicao; maximo 1 avaliacao por equipista por edicao.

**Scale/Scope**: ~400 pessoas, ~40 equipes, ~27 edicoes historicas, poucas edicoes ativas.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Avaliacao | Status |
|-----------|-----------|--------|
| I. Simplicidade | Reuso dos padroes existentes: rotas Hono (`links.ts`, `presenca.ts`), hooks/mutacoes (`links.ts`, `formacoes.ts`), pagina publica anonima (`CheckinPublico.tsx`, `PresencaPublico.tsx`), tabs (`EdicaoDetalhe.tsx`), sessao publica JWT (`sessaoPublica.ts`, `sessaoPresenca.ts`). Sem camadas novas. | PASS |
| II. MVP Estrito | Apenas o fluxo da spec: link publico por edicao, identificacao do coordenador, avaliacao de equipistas com 6 criterios, aptidao e comentarios. Rascunho com auto-save. Finalizacao imutavel. Tela interna na edicao (link + listagem). Aba na tela da pessoa. Sem relatorios, sem exportacao, sem dashboard. | PASS |
| III. TypeScript & Seguranca de Tipos | Tipos novos em `api/src/tipos.ts` e `src/lib/tipos.ts`; mappers de linha tipados (padrao `*DeRow`); sem `any` novo. | PASS |
| IV. Convencoes & Consistencia | PT-BR em UI, mensagens, identificadores e commits; datas ISO (`YYYY-MM-DD` / ISO timestamp); sem emojis. | PASS |
| V. Dependencias & Autorizacao | Zero dependencias novas. Rotas internas exigem ADM/ORG (`comAuth` + `podeAdministrar`); fluxo publico valida coordenador via participacoes e protege chamadas seguintes com JWT curto assinado; nenhuma rota publica retorna dados de terceiros. | PASS |

*Re-check apos Phase 1:* sem violacoes identificadas na fase de design.

## Project Structure

### Documentation (this feature)

```text
specs/019-avaliacao-equipistas/
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
│   ├── avaliacao.ts           # Rotas internas: GET/POST /api/avaliacao (ADM/ORG)
│   └── avaliacaoPublico.ts    # Rotas publicas em /api/publico/avaliacao (anonimo)
├── sessaoAvaliacao.ts         # Assina/valida JWT curto do coordenador (reusa jose)
└── tipos.ts                   # + SessaoAvaliacao, VariaveisAvaliacao

src/
├── pages/
│   ├── AvaliacaoPublico.tsx   # Pagina publica /avaliacao/:token
│   └── PessoaDetalhe.tsx      # + aba "Historico de Avaliacoes"
├── lib/
│   ├── avaliacao.ts           # Cliente: gerar link, identificar coordenador, listar equipistas, salvar/finalizar
│   ├── tipos.ts               # + LinkAvaliacao, Avaliacao, CriterioAvaliacao
│   └── hooks.ts               # + useAvaliacoes(edicaoId), useAvaliacoesPessoa(pessoaId)
├── components/
│   └── EdicaoDetalhe.tsx      # + aba/link de avaliacao na secao da edicao
└── App.tsx                    # + rota publica /avaliacao/:token

schema.sql                     # + tabelas links_avaliacao e avaliacoes
```

**Structure Decision**: Estrutura plana existente, sem camadas novas. Segue os mesmos padroes de `links.ts`/`links_validacao` (link com token), `presenca.ts`/`presencas` (registro com id composto), `sessaoPresenca.ts` (JWT de sessao publica) e `PresencaPublico.tsx` (pagina publica anonima). As rotas publicas de avaliacao ficam em roteador proprio (`/api/publico/avaliacao`), espelhando o padrao do check-in e presenca.

## Complexity Tracking

> Sem violacoes de constituicao identificadas. Nenhuma justificativa de complexidade necessaria.
