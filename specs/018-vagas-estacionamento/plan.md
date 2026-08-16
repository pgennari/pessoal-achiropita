# Implementation Plan: Vagas de Estacionamento

**Branch**: `018-vagas-estacionamento` | **Date**: 2026-08-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/018-vagas-estacionamento/spec.md`

## Summary

Introduzir a entidade **Vaga** de estacionamento e migrar o modelo de vinculo de estacionamento (pessoa↔estacionamento e veiculo↔estacionamento diretos) para um modelo derivado via vagas:

1. **Vagas**: nova tabela `vagas` (uma vaga = no maximo um estacionamento, pode nao ter) + `pessoa_vaga` (uma pessoa em no maximo uma vaga; uma vaga com varias pessoas). Tela unica de criacao vinculando pessoas e (opcionalmente) estacionamento. CRUD na API (`GET/POST/PUT /api/vagas`), listagem e detalhe no frontend, e aba "Vagas" no detalhe do estacionamento.
2. **Remocao dos vinculos diretos**: `veiculos.estacionamento_id` e `pessoas.estacionamento_id` deixam de existir. A contagem manual `estacionamentos.vagas_distribuidas` e substituida por calculo automatico (`COUNT` das vagas associadas). O estacionamento da pessoa e do veiculo passa a ser derivado das vagas das pessoas vinculadas.
3. **Historico de associacao recriado**: o historico de associacao e mantido, recriado para a associacao vaga↔estacionamento. Nova tabela `vaga_estacionamento_historico` registra associar/transferir/desassociar (incluindo a associacao inicial na criacao da vaga), exibido no detalhe da vaga (`GET /api/vagas/:id/historico`). A tabela legada `veiculo_estacionamento_historico` e mantida no banco, oculta e sem novas escritas.
4. **Migracao do historico legado**: script de backfill apos a adocao — para cada registro legado veiculo↔estacionamento, acha as pessoas ativas do veiculo e a vaga delas e cria o registro vaga↔estacionamento correspondente (deduplicado); registros sem vaga correspondente permanecem na tabela legada (FR-024/SC-008).
5. **Check-in adaptado**: o check-in por placa (publico) e o check-in manual passam a localizar o veiculo pelos estacionamentos das vagas das pessoas ativas vinculadas; veiculo sem pessoas nao aparece; placa com vaga em outro estacionamento informa o estacionamento correto.
6. **Indicadores**: tela de check-in/dashboard exibem porcentagem de vagas distribuídas (vagas associadas ÷ vagas contratadas) alem da lotacao atual.

A base e a arquitetura existente (API Hono + PostgreSQL em `api/`, SPA React + Vite + TanStack Query em `src/`), seguindo o padrao de rotas/hooks/telas ja estabelecido (padrao de `rotas/estacionamentos.ts`, `useEstacionamentos`, `EstacionamentoDetalhe.tsx`).

## Technical Context

**Language/Version**: TypeScript 5.6 strict (SPA) e na API (Node.js 22, ESM); backfill como script SQL idempotente (`scripts/backfill-vaga-estacionamento-historico.sql`, padrao de `scripts/backfill-historico-alocacao.sql`)

**Primary Dependencies**: Frontend — React 18, Vite 5, Tailwind 3, TanStack Query. API — Hono/OpenAPIHono, zod, postgres.js, firebase-admin. Nenhuma dependencia nova.

**Storage**: PostgreSQL (Neon). Novas tabelas `vagas`, `pessoa_vaga` e `vaga_estacionamento_historico` em `schema.sql` (idempotente) + `migration.sql` (padrao das specs 016/017); remocao de `veiculos.estacionamento_id` e `pessoas.estacionamento_id`; `estacionamentos.vagas_distribuidas` passa a ser calculada (coluna removida); `veiculo_estacionamento_historico` e **mantida** como legado oculto; migracao dos dados por backfill (script a parte, executado apos a adocao). Permissoes novas do catalogo (`vaga.*`) no seed e desativacao de `estacionamento.associar`/`veiculos.associar`.

**Testing**: Sem test runner configurado. Validacao por build: `npm run build` (= `tsc -b && vite build`), `npm run lint` (= `tsc -b --noEmit`) e `api/ npm run build` (= `tsc`). Backfill validado por consulta de contagem antes/depois (SC-008).

**Target Platform**: Web (SPA Vite) + HTTP API Hono (Node 22)

**Project Type**: Aplicacao web (SPA + API HTTP)

**Performance Goals**: Listagens de vagas e derivacao de estacionamento em < 200ms com join simples (centenas de vagas); sem alvo especial.

**Constraints**: Sem novas dependencias; contagem de vagas distribuídas sempre calculada (nunca digitada); pessoa em no maximo uma vaga (regra de negocio + banco); vagas sao mantidas quando o estacionamento e excluido (`ON DELETE SET NULL`); veiculo sem pessoas nao aparece no check-in; historico legado nao e excluido (dados migrados por backfill; sem vaga correspondente permanece na tabela legada); mensagens PT-BR; autorizacao sempre no backend (rotas de vaga exigem `vaga.*`, ADM superuser via `pode()`).

**Scale/Scope**: ~centenas de vagas, ~6 perfis, dezenas de estacionamentos.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Avaliacao | Status |
|-----------|-----------|--------|
| I. Simplicidade | Reuso dos padroes existentes: rota Hono no estilo `rotas/estacionamentos.ts` (openapi + comAuth + temPermissao), hooks TanStack no estilo `useEstacionamentos`, telas no estilo `EstacionamentoDetalhe.tsx`. Historico na tabela append-only no mesmo padrao da `veiculo_estacionamento_historico` existente. Derivacao de estacionamento por joins simples no SQL (sem materializacao, sem triggers). Backfill como script unico idempotente. Sem camadas novas. | PASS |
| II. MVP Estrito | Apenas o que a spec pede: criacao de vaga (com pessoas e estacionamento), remocao dos vinculos diretos, derivacao de estacionamento, historico recriado (vaga↔estacionamento) com migracao dos dados legados, indicadores de lotacao/distribuicao, adaptacao do check-in. Sem delecao de vaga, sem numeracao automatica, sem gestao de vagas por estacionamento fora do detalhe. | PASS |
| III. TypeScript & Seguranca de Tipos | Tipos novos em `api/src/tipos.ts` e `src/lib/tipos.ts` (`Vaga`, `PessoaVaga`, `HistoricoEstacionamentoVaga`); ajuste de `Veiculo` (estacionamentos derivados, array) e `Pessoa` (vagaId/vagaIdentificacao derivados); sem `any` novo. | PASS |
| IV. Convencoes & Consistencia | PT-BR em UI, mensagens, identificadores e commits; datas ISO; snake_case no banco, camelCase no TS; sem emojis. | PASS |
| V. Dependencias & Autorizacao | Zero dependencias novas. Autorizacao nas rotas de vaga por permissoes do catalogo (`vaga.lista/detalhe/incluir/editar`); ADM superuser via `pode()`; catalogo granular atual desativa `estacionamento.associar`/`veiculos.associar` (conceitos removidos). | PASS |

*Re-check apos Phase 1:* sem violacoes identificadas na fase de design (detalhes em research.md e data-model.md). Nenhuma justificativa de complexidade necessaria.

## Project Structure

### Documentation (this feature)

```text
specs/018-vagas-estacionamento/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
├── migration.sql        # DDL idempotente para aplicacao em Neon (padrao 016/017)
├── spec.md              # Feature specification
└── checklists/          # Checklists de requirements (spec)
```

### Source Code (repository root)

```text
api/src/
├── rotas/
│   ├── vagas.ts                     # NOVO: GET/POST /api/vagas, GET/PUT /api/vagas/:id,
│   │                                #       GET /api/vagas/:id/historico
│   ├── estacionamentos.ts           # GET /:id/veiculos derivado via vagas; GET /:id/pessoas removido;
│   │                                # POST/DELETE /:id/veiculos e checkins-manuais validados por vaga;
│   │                                # vagasDistribuidas calculada; estacionamento.associar removido
│   ├── veiculos.ts                  # GET / lista/detalhe com estacionamentos derivados;
│   │                                # GET /:id/historico-estacionamentos removido (legado oculto);
│   │                                # POST/DELETE /:id/veiculos do estacionamento removidos
│   ├── pessoas.ts                   # estacionamentoId/Nome derivados da vaga (vagaId, estacionamentoId, estacionamentoNome)
│   ├── checkin.ts                   # buscar (placa) e registrar adaptados ao modelo por vaga
│   └── dashboard.ts                 # + vagasDistribuidas por estacionamento
├── auth.ts                          # sem mudanca estrutural (permissoes via pode())
├── tipos.ts                         # + Vaga, PessoaVaga, HistoricoEstacionamentoVaga; ajustes Veiculo/Pessoa/Estacionamento
└── index.ts                         # + app.route("/api/vagas", vagas)

scripts/
└── backfill-vaga-estacionamento-historico.sql   # NOVO: migra veiculo_estacionamento_historico → vaga_estacionamento_historico (SQL idempotente)

src/
├── pages/
│   ├── Vagas.tsx                    # NOVO: listagem de vagas (/vagas)
│   ├── VagaNova.tsx                 # NOVO: criacao de vaga com pessoas + estacionamento (/vagas/nova)
│   ├── VagaDetalhe.tsx              # NOVO: detalhe/edicao + historico de estacionamentos (/vagas/:id)
│   ├── EstacionamentoDetalhe.tsx    # aba "Vagas" com pessoas; remove aba/vinculo de veiculos diretos
│   ├── EstacionamentoNovo.tsx       # remove campo manual de vagas distribuidas
│   ├── Veiculos.tsx                 # coluna Estacionamento passa a mostrar derivados (multi-valor)
│   ├── VeiculoDetalhe.tsx           # remove associar/desassociar estacionamento e historico
│   └── PessoaDetalhe.tsx            # remove EstacionamentoPessoa; mostra vaga + estacionamento derivado
├── components/
│   ├── EstacionamentoPessoa.tsx     # REMOVIDO (associacao direta pessoa↔estacionamento)
│   ├── ListaVeiculosEstacionamento.tsx # passa a usar derivacao por vagas
│   └── CardOcupacao.tsx             # + porcentagem de vagas distribuídas
├── lib/
│   ├── tipos.ts                     # + Vaga, PessoaVaga, HistoricoEstacionamentoVaga; Veiculo.estacionamentos[]; Pessoa.vagaId/...
│   ├── hooks.ts                     # + useVagas, useVaga, useVagasEstacionamento, useHistoricoVaga; ajustes estacionamentos/veiculos
│   ├── vagas.ts                     # NOVO: criarVaga, atualizarVaga
│   ├── estacionamentos.ts           # DadosEstacionamentoForm sem vagasDistribuidas
│   └── veiculos.ts                  # remove associar/desassociar estacionamento; adapta checkins-manuais
├── components/Sidebar.tsx           # + item "Vagas" na secao Gestão de Estacionamento (vaga.lista)
└── App.tsx                          # + rotas /vagas, /vagas/nova, /vagas/:id

schema.sql                           # + tabelas vagas/pessoa_vaga/vaga_estacionamento_historico,
                                     #   remocao dos vinculos diretos, seed vaga.* (legado preservado)
```

**Structure Decision**: Estrutura plana existente, sem camadas novas. A entidade Vaga segue o mesmo padrao de `rotas/estacionamentos.ts` (CRUD com `comAuth` + `temPermissao`) e de `EstacionamentoDetalhe.tsx`/`Pessoas.tsx` (telas com TanStack Query). O historico vaga↔estacionamento replica o padrao append-only da `veiculo_estacionamento_historico` (tabela + rota GET + secao na tela). A derivacao de estacionamento para pessoa/veiculo e feita por joins simples nas queries (mesmo estilo ja usado para `pessoa_veiculo`), sem triggers nem materializacao. As rotas de associacao direta removidas (`/api/estacionamentos/:id/pessoas`, `/api/estacionamentos/:id/veiculos` POST/DELETE, `/api/veiculos/:id/historico-estacionamentos`) sao excluidas de `estacionamentos.ts`/`veiculos.ts` e o `estacionamento.associar`/`veiculos.associar` sao desativados no catalogo. A migracao dos dados legados e um script SQL unico idempotente (`scripts/backfill-vaga-estacionamento-historico.sql`, padrao de `scripts/backfill-historico-alocacao.sql`), rodado uma vez apos a adocao das vagas.

## Complexity Tracking

> Sem violacoes de constituicao identificadas. Nenhuma justificativa de complexidade necessaria.
