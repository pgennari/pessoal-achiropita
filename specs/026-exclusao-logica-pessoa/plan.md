# Implementation Plan: Exclusao logica de pessoas

**Branch**: `026-exclusao-logica-pessoa` | **Date**: 2026-08-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/026-exclusao-logica-pessoa/spec.md`

## Summary

Excluir uma pessoa deixa de apagar o registro e passa a marcar a pessoa como `excluida` no banco. A exclusao (transacao unica) desfaz todos os vinculos ativos — alocacoes em equipes de edicoes nao encerradas (registrando cada desalocacao no historico de movimentacoes da pessoa), vinculos de veiculo, vaga de estacionamento e lacos de parentesco nos dois sentidos — sem apagar nenhum cadastro de equipe, veiculo, vaga, estacionamento ou parente. Cada veiculo que fica sem nenhuma outra pessoa vinculada tambem e marcado como `excluida`. Toda leitura de pessoas e de veiculos na API passa a filtrar `excluida = FALSE`, tornando a pessoa excluida invisivel em 100% das telas, inclusive nos fluxos publicos (validacao por cracha); o acesso por link direto resulta em "nao encontrada". O dialogo de exclusao informa, antes da confirmacao, a quantidade de vinculos que serao desfeitos e de veiculos que ficarao sem pessoa (FR-003), sem usar termos de apagamento permanente (FR-011). Tudo preservado para historico e auditoria; o cracha e a placa permanecem reservados. A mudanca segue o mesmo padrao ja implementado em `024-exclusao-logica-equipe`.

## Technical Context

**Language/Version**: TypeScript (strict) — API Hono no Node.js 22 (`api/`) + React 18 SPA com Vite 5 (`src/`).

**Primary Dependencies**: `@hono/zod-openapi`, `postgres.js` (API); React Query (front). **Nenhuma dependencia nova** (constituicao §V).

**Storage**: PostgreSQL (Neon). Schema de referencia em `schema.sql`; delta de producao via migration SQL idempotente (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) no Neon.

**Testing**: Nao ha test runner configurado. Validacao por `npm run lint` (= `tsc -b --noEmit`), builds (`npm run build` no frontend e `api/npm run build`) e cenario manual do `quickstart.md`.

**Target Platform**: SPA (Firebase Hosting) + API web service (Node 22, `DATABASE_URL`/`PORT`).

**Project Type**: Web service + SPA (frente + back no mesmo repo, `src/` + `api/`).

**Performance Goals**: Exclusao de pessoa com vinculos concluida em <5s (SC-005); listagens atuais sem degradacao perceptivel (tabela pequena, sem novos indices).

**Constraints**: PT-BR em UI/mensagens/comentarios; sem emojis; permissoes PBAC no backend (`pessoas.excluir`, `pessoas.associar`, etc. ja existentes); zero dependencias novas; toda leitura de pessoas e veiculos deve ignorar `excluida = TRUE`.

**Scale/Scope**: ~2-3 mil pessoas e ~1-2 mil veiculos — sem necessidade de paginacao ou indices adicionais (precedente 024).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Simplicidade** — PASS: coluna booleana `excluida` em `pessoas` e `veiculos` + filtro `WHERE excluida = FALSE` nas leituras + transacao no `DELETE` (mesmo padrao de 024). Sem camadas, servicos ou abstracoes.
- **II. MVP estrito** — PASS: implementa exatamente o que a spec pede (marcar excluida, desfazer vinculos, invisibilidade total, veiculo orfao so na exclusao de pessoa, preservar historico). Fora de escopo: restauracao de pessoa/veiculo, limpeza fisica, migracao de dados.
- **III. TypeScript & Seguranca de Tipos** — PASS: `excluida: boolean` tipado nas interfaces `Pessoa` e `Veiculo`; sem `any` novo.
- **IV. Convencoes & Consistencia** — PASS: PT-BR, `snake_case` no banco / `camelCase` no TS, sem emojis, datas ISO-8601, commits no imperativo.
- **V. Dependencias & Autorizacao** — PASS: nenhuma dependencia nova; autorizacao via `temPermissao(sessao, "pessoas.excluir")` ja existente no backend.

*Re-check pos-design: nenhuma violacao introduzida pelos artefatos gerados.*

## Project Structure

### Documentation (this feature)

```text
specs/026-exclusao-logica-pessoa/
├── plan.md              # Este arquivo (/speckit.plan)
├── research.md          # Decisoes de design (Phase 0)
├── data-model.md        # Modelo de dados e transicoes (Phase 1)
├── quickstart.md        # Guia de validacao manual (Phase 1)
├── contracts/           # Contratos de API alterados (Phase 1)
│   └── exclusao-pessoas-api.md
└── tasks.md             # Phase 2 output (/speckit.tasks - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
api/src/rotas/pessoas.ts          # DELETE vira soft-delete em transacao; GET /:id/exclusao-previa
                                  # (contagem dos vinculos); filtro excluida em listagem, detalhe,
                                  # busca, veiculos, edicao, ativacao e foto
api/src/rotas/participacoes.ts    # alocacao rejeita pessoa excluida
api/src/rotas/veiculos.ts         # listagem e vinculos filtram pessoas e veiculos excluidos
api/src/rotas/vagas.ts            # ocupacao/consulta rejeitam pessoa excluida; ocupantes filtrados
api/src/rotas/montagem.ts         # selecao e validacao de pessoas filtram excluidas
api/src/rotas/bloqueios.ts        # listagem e validacao de pessoas filtram excluidas
api/src/rotas/sincronizacao.ts    # contexto de pessoas ignora excluidas
api/src/rotas/publico.ts          # validacao por cracha ignora excluidas ("nao encontrada")
api/src/rotas/presencaPublico.ts  # fluxo publico ignora pessoas excluidas
api/src/rotas/avaliacaoPublico.ts # fluxo publico ignora pessoas excluidas
schema.sql                        # ADD COLUMN excluida em pessoas e veiculos
scripts/exclusao-logica-pessoa.sql  # migration idempotente do delta (criado em /speckit.tasks)
src/lib/tipos.ts                  # interfaces Pessoa e Veiculo ganham excluida: boolean
src/lib/pessoas.ts                # pessoaDeSnap mapeia excluida; excluirPessoa usa exclusao-previa
                                  # e invalida caches de vinculos
src/lib/veiculos.ts               # veiculoDeSnap mapeia excluida
src/pages/PessoaDetalhe.tsx       # dialogo com contagem de vinculos e novo texto (FR-003/FR-011)
```

**Structure Decision**: Mantem a estrutura plana existente (`api/src/rotas/`, `src/lib/`, `src/pages/`) sem novas camadas — a mudanca e transversal (filtro em queries de pessoas e veiculos + transacao no DELETE), mesma decisao de 024 (constituicao §I).

## Complexity Tracking

> Sem violacoes da constituicao — tabela nao preenchida.