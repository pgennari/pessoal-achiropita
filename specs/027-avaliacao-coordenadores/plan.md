# Implementation Plan: Avaliacao de Coordenadores

**Branch**: `027-avaliacao-coordenadores` | **Date**: 2026-08-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/027-avaliacao-coordenadores/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Criar o processo de avaliacao de coordenadores com link publico proprio por edicao (`/avaliacao/coordenadores/{referencia}`, ex.: `.../2026`). Coordenadores cuja equipe possui o texto "APOIO" no nome e ao menos uma equipe filha se identificam pelo cracha e avaliam os coordenadores das equipes filhas (agrupados por equipe quando ha mais de uma), respondendo a um questionario fixo de 6 questoes (2 fechadas, 4 abertas; todas obrigatorias, abertas com minimo 20 caracteres). O fluxo segue o padrao consolidado da avaliacao de equipistas (019): rotas publicas com sessao JWT curta + revalidacao do link ativo, autosave com debounce de 2s, finalizacao com confirmacao, rascunho editavel e finalizada imutavel. ADM/ORG gerem o link (ativo/revogado/copiar) e acompanham as avaliacoes em uma nova aba da tela de detalhes da edicao, com filtros por equipe, avaliador e status e detalhe em modo leitura.

## Technical Context

**Language/Version**: TypeScript 5 (strict) em todo o codigo. Frontend React 18 + Vite 5 (SPA). Backend Hono no Node 22 (`api/`).

**Primary Dependencies**: Frontend: `react`, `@tanstack/react-query`, `vite`. Backend: `hono` + `@hono/zod-openapi` (contratos Zod `z.any()` nas responses, `zod` tipado nos requests, seguindo o padrao de `api/src/rotas/avaliacaoPublico.ts`), `jose` (JWT HS256 1h), `zod`, `firebase-admin` (verificacao do ID token), `postgres.js` (SQL por template tag). **Nenhuma dependencia nova** — todas ja presentes em `api/package.json` e `package.json`.

**Storage**: PostgreSQL (Render), schema em `schema.sql`. Novas tabelas: `links_avaliacao_coordenador` e `avaliacoes_coordenador` (colunas fixas, sem JSONB — questionario e fixo).

**Testing**: Nao ha test runner configurado. Validacao via `npm run build` (frontend: `tsc -b && vite build`), `npm run lint` (`tsc -b --noEmit`) e `api/npm run build`. Validacao funcional manual pelo guia `quickstart.md`.

**Target Platform**: Web (SPA hosteada em Firebase Hosting + API em Cloud Run/Render), acessivel tambem por celular no fluxo publico anonimo.

**Project Type**: Web application (frontend SPA + backend REST HTTP).

**Performance Goals**: Sem metas agressivas. Escala estimada de 50-100 coordenadores-avaliadores e ate ~100 alvos; consultas pontuais com indices (por edicao, equipe, pessoa), sem paginacao no MVP.

**Constraints**: Plano Firebase Spark — sem Cloud Functions no fluxo dessa feature (backends ja em `api/`). Autorizacao: ADM/ORG via PBAC (`pode(sessao, "avaliacao.gerenciar")`), anonimos via sessao JWT curta (1h) com revalidacao do link ativo a cada chamada (padrao `comSessaoAvaliacao`). Mensagens de acesso negado genericas no fluxo publico. Sem novas permissoes no catalogo.

**Scale/Scope**: Uma edicao ativa por vez; link unico por edicao (token = referencia da edicao); no maximo uma avaliacao por (edicao, avaliador, alvo, equipe filha).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Simplicidade** — OK: codifica direto nos handlers (SQL por template tag), sem camadas `services/`/`repositories/`. Espelha o modulo `avaliacao.ts`/`avaliacaoPublico.ts` existente, ja boring e comprovado.
- **II. MVP Estrito** — OK: apenas as 5 user stories da spec. Historico por pessoa fora do escopo (registrado em Assumptions da spec); sem paginacao, sem exportacao, sem relatorio agregado.
- **III. TypeScript & Seguranca de Tipos** — OK: tipos novos em `src/lib/tipos.ts` e `api/src/tipos.ts`; questionario em colunas tipadas; Zod nos requests publicos.
- **IV. Convencoes & Consistencia** — OK: PT-BR em UI/mensagens/commits/identificadores; sem emojis; datas ISO-8601; nomes camelCase no TS, snake_case no banco.
- **V. Dependencias & Autorizacao** — OK: zero dependencias novas; autorizacao via `temPermissao`/`pode` + sessao anonima JWT com revalidacao de link.
- **Restricoes Tecnicas** — OK: SPA no frontend, Hono no `api/`, PostgreSQL, sem Cloud Functions novas, sem Firestore.

Nenhuma violacao — tabela Complexity Tracking nao preenchida.

## Project Structure

### Documentation (this feature)

```text
specs/027-avaliacao-coordenadores/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── avaliacao-coordenador-integracao.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
schema.sql                                    # DDL: links_avaliacao_coordenador + avaliacoes_coordenador (+indices)
api/src/
├── index.ts                                  # monta /api/avaliacao-coordenador, /api/avaliacoes-coordenador e /api/publico
├── tipos.ts                                  # SessaoCoordenador + VariaveisCoordenador (tipos de sessao anonima)
├── sessaoCoordenador.ts                      # criarSessaoCoordenadorJwt + comSessaoCoordenador (espelho de sessaoAvaliacao.ts)
├── rotas/
│   ├── avaliacaoCoordenador.ts               # internas ADM/ORG: links (gerar/revogar/buscar) + listagem/detalhe
│   └── avaliacaoCoordenadorPublico.ts        # publicas: validar link, identificar coordenador, listar alvos, salvar
src/
├── App.tsx                                   # rota publica /avaliacao/coordenadores/:referencia (sem Layout)
├── lib/
│   ├── tipos.ts                              # LinkAvaliacaoCoordenador, AvaliacaoCoordenador, QuestionarioCoordenador, Permanencia/Lideranca
│   ├── avaliacaoCoordenador.ts               # cliente da API (publico + interno), espelho de lib/avaliacao.ts
│   └── hooks.ts                              # useLinkAvaliacaoCoordenadorAtivo, useAvaliacoesCoordenador
└── pages/
    ├── AvaliacaoCoordenadorPublico.tsx       # fluxo anonimo (identificacao, alvos agrupados, formulario 6 questoes)
    ├── EdicaoDetalhe.tsx                     # 3a aba "Avaliacao de Coordenadores" (link + listagem + detalhe)
    └── SecaoAvaliacaoCoordenadores.tsx       # painel da aba (link copiavel + filtros + tabela + detalhe leitura)
```

**Structure Decision**: Segue a estrutura atual do repositorio — backend em `api/src/rotas/` com dois arquivos por dominio (interno + publico, espelhando `avaliacao.ts`/`avaliacaoPublico.ts`), cliente API na `src/lib/`, paginas em `src/pages/`. Nenhuma camada nova.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Sem violacoes — nada a justificar.