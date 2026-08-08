# Implementation Plan: PBAC - Catalogo de Permissoes e Validacao Unica de Acesso

**Branch**: `014-pbac-permissoes` | **Date**: 2026-08-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/014-pbac-permissoes/spec.md`

## Summary

Implementar PBAC (Permission-Based Access Control) na base existente (API Hono + PostgreSQL em `api/`, SPA React + TanStack Query em `src/`), em tres frentes:

1. **Catalogo de permissoes editavel**: hoje o catalogo e hardcoded em `api/src/perfis.ts` (9 itens) e espelhado em `src/lib/perfis.ts` (10 itens, inclui `presenca.gerenciar`). Passa a ser uma tabela `permissoes` no banco com rotas CRUD (`GET/POST/PUT /api/permissoes`), permitindo criar, editar (rotulo/descricao) e desativar permissoes. Codigo imutavel; desativacao em vez de exclusao.
2. **Associacao aos perfis**: a tela de perfis (`Perfis.tsx`) passa a listar as permissoes vindas do catalogo editavel (somente ativas); `apenasPermissoesValidas` valida contra o catalogo ativo no banco, nao contra o array hardcoded.
3. **Funcao unica de validacao**: funcao `pode(sessao, codigo)` como unico ponto de decisao de autorizacao (backend e frontend). As guards legadas (`podeAdministrar`, `podeEditarPessoa`, `podeZerar`, `podeOperarEstacionamentos`, `podeGerirPerfis`, `temPermissao`) passam a delegar a `pode()`; os checks por letra de perfil (ADM/ORG/OPC/CRD) sao removidos das guards e consolidados na regra "ADM sempre tem todas as permissoes" + seed dos perfis padrao que reproduz o acesso atual (migracao adiciona `pessoas.editar` ao CRD).

A adequacao de cada tela/funcionalidade para usar a funcao unica em decisoes de interface acontece em um segundo momento (as chamadas das paginas nao mudam; so a implementacao das guards e consolidadas).

## Technical Context

**Language/Version**: TypeScript 5.6 strict (SPA) e na API (Node.js 22, ESM)

**Primary Dependencies**: Frontend — React 18, Vite 5, Tailwind 3, TanStack Query. API — Hono/OpenAPIHono, zod, postgres.js, firebase-admin. Nenhuma dependencia nova.

**Storage**: PostgreSQL (Neon). Nova tabela `permissoes` adicionada a `schema.sql` (padrao idempotente); ajustes de seed nos perfis padrao (ADM recebe todas as permissoes, CRD recebe `pessoas.editar`).

**Testing**: Sem test runner configurado. Validacao por build: `npm run build` (= `tsc -b && vite build`), `npm run lint` (= `tsc -b --noEmit`) e `api/ npm run build` (= `tsc`).

**Target Platform**: Web (SPA Vite) + HTTP API Hono (Node 22)

**Project Type**: Aplicacao web (SPA + API HTTP)

**Performance Goals**: Consultas de catalogo e validacao de acesso em < 100ms; catalogo pequeno (dezenas de permissoes). Sem alvo especial.

**Constraints**: Sem novas dependencias; codigo de permissao imutavel e sem exclusao (somente desativacao); a permissao `perfis.gerenciar` nunca pode ser desativada; ADM (fixo) sempre possui todas as permissoes; nenhum usuario perde o acesso que ja tem apos a migracao; mensagens PT-BR; autorizacao sempre no backend.

**Scale/Scope**: ~6 perfis padrao, ~10 permissoes iniciais, ~centenas de usuarios.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Avaliacao | Status |
|-----------|-----------|--------|
| I. Simplicidade | Reuso dos padroes existentes: rota Hono no estilo `rotas/perfis.ts`, hooks TanStack no estilo `usePerfis`, tela no estilo `Perfis.tsx`, tabela no padrao idempotente de `schema.sql`. A funcao `pode()` substitui guards inline com uma unica regra simples (ADM superuser + lista de permissoes ativas). Sem camadas novas. | PASS |
| II. MVP Estrito | Apenas o que a spec pede: catalogo editavel, associacao aos perfis, funcao unica de validacao. Sem adaptacao das telas existentes (segundo momento), sem controle de menus novos, sem delegacao direta de permissao a usuario. | PASS |
| III. TypeScript & Seguranca de Tipos | Tipos novos em `api/src/tipos.ts` e `src/lib/tipos.ts` (`Permissao` com `ativo`); sem `any` novo. | PASS |
| IV. Convencoes & Consistencia | PT-BR em UI, mensagens, identificadores e commits; datas ISO; sem emojis. | PASS |
| V. Dependencias & Autorizacao | Zero dependencias novas. Autorizacao consolidada em `pode()` no backend; rotas de catalogo exigem `perfis.gerenciar` (na pratica ADM); `perfis.gerenciar` e protegida contra desativacao; ADM fixo nunca perde acesso. | PASS |

*Re-check apos Phase 1:* sem violacoes identificadas na fase de design (detalhes em research.md). Nenhuma justificativa de complexidade necessaria.

## Project Structure

### Documentation (this feature)

```text
specs/014-pbac-permissoes/
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
├── auth.ts                    # comAuth passa a filtrar permissoes ativas; guards delegam a pode()
├── pbac.ts                    # NOVO: funcao unica pode(sessao, codigo) + helpers de catalogo
├── perfis.ts                  # REMOVIDO: catalogo hardcoded vira seed em schema.sql
├── rotas/
│   ├── permissoes.ts          # NOVO: GET/POST /api/permissoes, PUT /api/permissoes/:codigo
│   └── perfis.ts              # validacao de permissoes passa a consultar catalogo ativo no banco
├── tipos.ts                   # + Permissao (com ativo), Variaveis
└── index.ts                   # + app.route("/api/permissoes", permissoes)

src/
├── pages/
│   ├── Permissoes.tsx         # NOVO: tela de controle de permissoes (/permissoes)
│   └── Perfis.tsx             # usa catalogo vivo (usePermissoes) em vez de CATALOGO_PERMISSOES
├── lib/
│   ├── perfis.ts              # CATALOGO_PERMISSOES removido; + usePermissoes; rotuloPermissao via catalogo
│   ├── sessao.ts              # + pode(); guards delegam; remove checks por letra de perfil
│   ├── tipos.ts               # Permissao + ativo/criadoEm/atualizadoEm
│   └── hooks.ts               # + usePermissoes()
├── components/
│   └── Sidebar.tsx            # + item "Permissões" na secao Administração (perfis.gerenciar)
└── App.tsx                    # + rota protegida /permissoes

schema.sql                     # + tabela permissoes (seed dos 10 codigos), ajuste do seed dos perfis
```

**Structure Decision**: Estrutura plana existente, sem camadas novas. O catalogo de permissoes segue o mesmo padrao de `rotas/perfis.ts` (CRUD com `comAuth` + guard) e de `Perfis.tsx` (tela com TanStack Query). A funcao `pode()` fica em modulo proprio (`api/src/pbac.ts` e `src/lib/sessao.ts`) e as guards existentes viram aliases de uma linha para nao alterar os call sites (adaptacao das telas fica para o segundo momento).

## Complexity Tracking

> Sem violacoes de constituicao identificadas. Nenhuma justificativa de complexidade necessaria.
