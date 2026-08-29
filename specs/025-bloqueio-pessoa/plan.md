# Implementation Plan: Bloqueio de Pessoas (equipistas)

**Branch**: `025-bloqueio-pessoa` | **Date**: 2026-08-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/025-bloqueio-pessoa/spec.md`

## Summary

Criar o fluxo de bloqueio/desbloqueio de pessoas (equipistas) com **dupla aprovacao obrigatoria**: qualquer solicitacao nasce com o usuario atual como 1o aprovador, fica `pendente`, e so produz efeito (bloquear ou desbloquear a pessoa) quando um **segundo aprovador distinto** aprova. O rastro de decisoes e **append-only**: cada solicitacao vira uma linha na tabela `bloqueios` (tipo `bloqueio`/`desbloqueio`, motivo >= 100 caracteres, aprovadores, autor, datas), que alimenta a tela `Bloqueios` (menu Pessoas), a aba de historico no box "Exclusivo Pessoal" e a auditoria. O estado corrente da pessoa e uma coluna `pessoas.bloqueada` (derivada de forma atomica no ato da aprovacao), que dispara dois efeitos em cascata: (1) UI chamativa — banner no detalhe acima dos dados, badges em listagens/busca/equipe; (2) **restricao de selecao** — a pessoa bloqueada nao pode mais ser chamada/convidada/alocada (recusa nos endpoints de alocacao/movimentacao e exclusao das candidaturas de montagem, espelhada no front). A permissao nova `pessoas.bloqueio` (PBAC, catalogo) controla a area toda; o box "Exclusivo Pessoal" ganha a permissao `exclusivoPessoal` semeada no catalogo (hoje referenciada apenas em codigo).

## Technical Context

**Language/Version**: TypeScript (strict) — API Hono no Node.js 22 (`api/`) + React 18 SPA com Vite 5 (`src/`).

**Primary Dependencies**: `@hono/zod-openapi`, `postgres.js` (API); React Query (front). **Nenhuma dependencia nova** (constituicao §V).

**Storage**: PostgreSQL (Neon). Tabela nova `bloqueios` (append-only) + coluna `pessoas.bloqueada`. Delta em `schema.sql` (idempotente) + script standalone `scripts/adicionar-bloqueios.sql` aplicado manualmente no Neon (SQL Editor), assim como `pessoas.parentes`/`cantina.gerenciar`/`adicionar-coluna-excluida-equipes.sql`.

**Testing**: Sem test runner configurado. Validacao por `npm run lint` (= `tsc -b --noEmit`) no front, `api/npm run build` no backend e cenario manual do `quickstart.md`.

**Target Platform**: SPA (Firebase Hosting) + API web service (Node 22, `DATABASE_URL`/`PORT`).

**Project Type**: Web service + SPA (frente + back no mesmo repo, `src/` + `api/`).

**Performance Goals**: Aprovacao conclui o efeito (bloqueio/desbloqueio ativo) em <5s (SC-001 e SC-008); telas existentes sem degradacao perceptivel — as consultas novas usam indices em `bloqueios` e a coluna booleana em `pessoas`.

**Constraints**: PT-BR em UI/mensagens/comentarios; sem emojis; motivos com >= 100 caracteres de conteudo real; 2 aprovadores sempre distintos (validado no banco); autorizacao PBAC no backend (`pessoas.bloqueio`); backend e sempre a fonte da verdade nas regras de aprovacao e bloqueio de selecao; zero dependencias novas.

**Scale/Scope**: ~10 mil pessoas no cadastro, porem volume pequeno de bloqueios simultaneos (decenas); telas sem paginacao (a tela Bloqueios e enxuta). Sem impacto de performance relevante.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Simplicidade** — PASS: tabela append-only + coluna booleana em `pessoas` + UPDATE condicional com lock; sem camadas, servicos ou abstracoes novas. Nada de state-machine engine: o estado corrente e derivado por regras simples de UPDATE.
- **II. MVP estrito** — PASS: implementa exatamente o que a spec pede (bloquear/desbloquear com dupla aprovacao, tela Bloqueios, banner, aba de historico, restricao de selecao). Fora de escopo: rejeicao/cancelamento de pedidos, notificacoes aos aprovadores, desalocacao automatica no ato do bloqueio, bloqueio de convites de usuario do sistema (nao sao "chamada para a festa").
- **III. TypeScript & Seguranca de Tipos** — PASS: novas interfaces `Bloqueio`/`ResumoBloqueio` e campos em `Pessoa`; sem `any` novo.
- **IV. Convencoes & Consistencia** — PASS: PT-BR, `snake_case` no banco / `camelCase` no TS, sem emojis, datas ISO, commits no imperativo; alem disso, padronizo a permissao `exclusivoPessoal` que hoje existe solta em codigo, semeando-a no catalogo.
- **V. Dependencias & Autorizacao** — PASS: nenhuma dependencia nova; autorizacao no backend via `pode()`/`temPermissao` (PBAC) com a permissao nova `pessoas.bloqueio` catalogada e concedida ao perfil ORG.

*Re-check pos-design: os artefatos de design nao introduzem nenhuma violacao; requisitos de autorizacao estao todos no backend.*

## Project Structure

### Documentation (this feature)

```text
specs/025-bloqueio-pessoa/
├── plan.md              # Este arquivo (/speckit.plan)
├── research.md          # Decisoes de design (Phase 0)
├── data-model.md        # Modelo de dados e transicoes (Phase 1)
├── quickstart.md        # Guia de validacao manual (Phase 1)
├── contracts/           # Contratos de API alterados (Phase 1)
│   └── bloqueios-api.md
└── tasks.md             # Phase 2 output (/speckit.tasks - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Backend (api/)
api/src/rotas/bloqueios.ts          # NOVO — GET /api/bloqueios; POST /api/bloqueios; POST /api/bloqueios/:id/aprovar
api/src/index.ts                    # monta app.route("/api/bloqueios", bloqueios)
api/src/rotas/pessoas.ts            # mapper pessoaDeRow ganha bloqueada; GET / (lista) e GET /:id (detalhe) enriquecidos (bloqueio ativo/pendente)
api/src/rotas/participacoes.ts      # POST e PUT recusam pessoa bloqueada (409 com justificativa)
api/src/rotas/montagem.ts           # GET /api/montagem/candidatos exclui pessoas bloqueadas

# Banco
schema.sql                          # bloco 025: CREATE TABLE bloqueios + coluna bloqueada + indices + seed permissoes
scripts/adicionar-bloqueios.sql     # NOVO — migration standalone (idempotente) p/ prod (Neon SQL Editor)

# Frontend (src/)
src/lib/tipos.ts                    # interface Bloqueio + ResumoBloqueio; Pessoa ganha bloqueada/bloqueioAtivo/bloqueioPendente
src/lib/bloqueio.ts                 # NOVO — listar/criar/aprovar + invalidacoes queryClient
src/lib/hooks.ts                    # useBloqueios(), useBloqueiosDaPessoa(pessoaId)
src/pages/Bloqueios.tsx             # NOVO — tela do menu Pessoas > Bloqueios (pendentes + bloqueados)
src/pages/BloqueioPessoa.tsx        # NOVO — pagina /pessoas/:id/bloquear (novo bloqueio, em pagina, nao modal)
src/pages/DesbloqueioPessoa.tsx     # NOVO — pagina /pessoas/:id/desbloquear (desbloqueio, em pagina, nao modal)
src/pages/PessoaDetalhe.tsx         # botao Bloquear/Desbloquear navega para as paginas + banner acima dos dados + aba Bloqueios no box Exclusivo Pessoal
src/components/HistoricoBloqueiosPessoa.tsx  # NOVO — linha do tempo p/ aba de historico
src/App.tsx                         # rotas /pessoas/bloqueios, /pessoas/:id/bloquear, /pessoas/:id/desbloquear
src/components/Sidebar.tsx          # item "Bloqueios" na secao Pessoas (icone cadeado)
src/components/AlocarPessoaDialog.tsx   # pessoa bloqueada nao selecionavel (badge + erro)
src/components/MontagemCandidato.tsx    # candidato bloqueado: botoes desabilitados + badge
src/pages/EquipeDetalhe.tsx         # badge bloqueada + veto a Mover/Trocar funcao (roster mantem a pessoa)
src/pages/Pessoas.tsx               # badge "bloqueado" na listagem
src/components/BuscaGlobal.tsx      # badge "bloqueado" nos resultados
src/lib/favoritos.ts                # (opcional) rota em ROTAS p/ busca/favoritos
src/lib/perfis.ts                   # (opcional) entrada no CATALOGO_MENUS p/ ControleMenus
```

**Structure Decision**: Mantem a estrutura plana existente (`api/src/rotas/`, `src/lib/`, `src/pages/`) sem novas camadas. O recurso e um novo modulo de rotas montado no index (padrao de `cantina.ts`/`montagem.ts`), um novo modulo `src/lib/bloqueio.ts` (padrao de `participacoes.ts`), duas paginas novas `BloqueioPessoa.tsx`/`DesbloqueioPessoa.tsx` (padrao de `Pessoas.tsx`) no lugar do modal, e edicoes cirurgicas nos pontos de selecao existentes. Os botoes no detalhe da Pessoa **navegam** (`useNavigate`) para `/pessoas/:id/bloquear` e `/pessoas/:id/desbloquear` (decisao de clarificacao), e o submit de cada pagina redireciona para a tela Bloqueios. A tabela `bloqueios` e append-only como `pessoa_equipe_historico`/`auditoria`; a coluna `pessoas.bloqueada` segue o padrao de `ativo`/`excluida` (constituicao §I).

## Complexity Tracking

> Sem violacoes da constituicao — tabela nao preenchida.