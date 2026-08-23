# Implementation Plan: Pesquisa de Satisfacao da Cantina

**Branch**: `020-cantina-pesquisa` | **Date**: 2026-08-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/020-cantina-pesquisa/spec.md`

## Summary

Nova secao "Cantina" no sistema com a subsecao "Pesquisa". Na area logada, uma pagina exibe o endereco publico fixo da pesquisa (`/cantina/pesquisa`) com os botoes Copiar, Abrir e QR Code, e lista as respostas em lotes de 20 com lazy-loading. No link publico (sem autenticacao), um formulario de satisfacao coleta identificacao (nome completo obrigatorio; e-mail obrigatorio apenas quando o visitante responde Sim ao opt-in "Deseja receber informacoes sobre a Festa de Nossa Senhora Achiropita?"), dia da ida entre os dias de festa cadastrados (dia atual pre-selecionado quando constar na lista), numero do convite, 5 criterios com nota de 1 a 5, recomendacao (Sim/Nao/Talvez) e comentario aberto opcional.

Arquitetura existente reutilizada: API Hono + PostgreSQL (`api/`), SPA React + TanStack Query (`src/`), rotas publicas anonimas em `/api/publico` chamadas via `apiPublica`, PBAC com catalogo `permissoes` + `pode()`/`temPermissao`, QR Code via lib `qrcode` (padrao `QrEstacionamento.tsx`).

## Technical Context

**Language/Version**: TypeScript 5.6 strict (SPA) e na API (Node.js 22, ESM)

**Primary Dependencies**: Frontend — React 18, Vite 5, Tailwind 3, TanStack Query, react-router-dom 6, qrcode 1.5.4. API — Hono/OpenAPIHono, zod, postgres.js, firebase-admin. Nenhuma dependencia nova.

**Storage**: PostgreSQL (Neon). Nova tabela `pesquisas_cantina` adicionada a `schema.sql` + seed do codigo de permissao `cantina.gerenciar` (catalogo `permissoes` e perfil ORG em `perfis`).

**Testing**: Sem test runner configurado. Validacao por build: `npm run build` (= `tsc -b && vite build`), `npm run lint` (= `tsc -b --noEmit`) e `api/ npm run build`.

**Target Platform**: Web (SPA Vite) + HTTP API Hono (Node 22)

**Performance Goals**: Envio do formulario publico processado em < 1s; listagem carrega cada lote de 20 em < 1s; formulario publico utilizavel em tela de celular.

**Constraints**: Sem novas dependencias; rota publica fixa sem token (URL divulgada impressa no QR); autorizacao sempre no backend; mensagens PT-BR; sem captcha/antispam nesta versao (aceito, padrao dos demais fluxos publicos); dados do formulario publico limitados ao minimo necessario.

**Scale/Scope**: Volume esperado de milhares de respostas por edicao (fluxo publico aberto ao publico geral da festa); area logada restrita a ADM/ORG; 2 paginas novas + 1 arquivo de rotas interno + 1 arquivo de rotas publico.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Avaliacao | Status |
|-----------|-----------|--------|
| I. Simplicidade | Reuso dos padroes existentes: pagina publica anonima (`CheckinPublico.tsx`, `AvaliacaoPublico.tsx`), QR inline (`QrEstacionamento.tsx`), cliente publico (`apiPublica` em `api.ts`), rotas OpenAPIHono (`avaliacaoPublico.ts`), listagem por lote com TanStack Query. Sem camadas novas. | PASS |
| II. MVP Estrito | Apenas o fluxo da spec: pagina Cantina > Pesquisa (link + 3 acoes + listagem), formulario publico (identificacao + 5 criterios + recomendacao + campo aberto). Opt-in registrado e exibido no detalhe; sem exportacao, sem disparo de contato, sem dashboard, sem filtros, sem antispam nesta versao. | PASS |
| III. TypeScript & Seguranca de Tipos | Tipos novos em `api/src/tipos.ts` e `src/lib/tipos.ts`; mapper `pesquisaDeRow` tipado; validacao de entrada com zod (inclusive regra condicional do e-mail no servidor); sem `any` novo fora dos casts idiomaticos ja usados no projeto. | PASS |
| IV. Convencoes & Consistencia | PT-BR em UI, mensagens e commits; datas ISO (`YYYY-MM-DD` para dia da ida, ISO timestamp para envio); snake_case no banco, camelCase no TypeScript; sem emojis. | PASS |
| V. Dependencias & Autorizacao | Zero dependencias novas. Rotas internas exigem `temPermissao(sessao, "cantina.gerenciar")` (ADM tem acesso implicito; ORG recebe o codigo no seed). Rotas publicas nao expõem dados de terceiros: GET publico retorna apenas datas de dias de festa; POST publico so grava. | PASS |

*Re-check apos Phase 1:* sem violacoes identificadas na fase de design.

## Project Structure

### Documentation (this feature)

```text
specs/020-cantina-pesquisa/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── cantina-interno.md
│   └── cantina-publico.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
api/src/
├── rotas/
│   ├── cantina.ts           # GET /api/cantina/pesquisas (lote 20) — requer cantina.gerenciar
│   └── cantinaPublico.ts    # GET dias-festa + POST pesquisas — anonimo em /api/publico/cantina
└── tipos.ts                 # + PesquisaCantina, Variaveis existentes

src/
├── pages/
│   ├── CantinaPesquisa.tsx         # Area logada /cantina/pesquisas: link publico + Copiar/Abrir/QR + listagem
│   └── CantinaPesquisaPublico.tsx  # Publica /cantina/pesquisa: formulario de satisfacao
├── lib/
│   ├── cantina.ts           # Cliente: listar respostas (lotes), listar dias publicos, enviar resposta
│   └── tipos.ts             # + PesquisaCantina
├── components/Sidebar.tsx   # + secao "Cantina" com item "Pesquisa" (permissao cantina.gerenciar)
└── App.tsx                  # + rota publica /cantina/pesquisa e rota logada /cantina/pesquisas

schema.sql                   # + tabela pesquisas_cantina + seed permissao cantina.gerenciar (catalogo + perfil ORG)
```

**Structure Decision**: Estrutura plana existente, sem camadas novas. A URL publica divulgada (`/cantina/pesquisa`) pertence a pagina publica sem Layout, seguindo o padrao das demais rotas publicas top-level (`/checkin/:token`, `/presenca/:token`). Como essa URL esta reservada ao publico, a pagina da area logada fica em `/cantina/pesquisas` (item "Pesquisa" na secao "Cantina" do menu). As rotas publicas da API ficam em roteador proprio montado em `/api/publico/cantina`, espelhando `checkin`/`presencaPublico`/`avaliacaoPublico`; as rotas internas em `/api/cantina` com gate PBAC.

## Complexity Tracking

> Sem violacoes de constituicao identificadas. Nenhuma justificativa de complexidade necessaria.
