# Implementation Plan: Relatorio de Avaliacoes de Equipistas

**Branch**: `021-relatorio-avaliacoes` | **Date**: 2026-08-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/021-relatorio-avaliacoes/spec.md`

## Summary

Nova pagina "Relatorios > Avaliacoes" (rota `/avaliacoes/relatorio`) que lista as avaliacoes de equipistas da edicao ativa com filtros pelos valores possiveis de cada campo de criterio: Otimo/Bom/Regular/Ruim para Pontualidade, Dedicacao, Companheirismo, Espiritualidade, Comprometimento e Uniforme; notas de 1 a 5 para "Chances de convidar novamente". Multiplos valores no mesmo criterio combinam como "ou"; criterios diferentes combinam como "e". Inclui resumo numerico (total geral, total apos filtros, distribuicao por valor de cada criterio), contador de resultados, estados vazios e detalhe completo por registro.

Nenhum endpoint novo e nenhuma mudanca de schema: o relatorio consome `GET /api/avaliacoes?edicaoId=` (ja existente, gate `avaliacao.gerenciar`) via o hook `useAvaliacoes` e executa filtragem e agregacao no cliente, seguindo o padrao do `RelatorioPresenca.tsx`. A unica alteracao de tipo e a inclusao dos campos de exibicao que a API ja retorna (`equipeNome`, `pessoaNome`, `pessoaCracha`) na interface `Avaliacao` do frontend.

## Technical Context

**Language/Version**: TypeScript 5.6 strict (SPA) e na API (Node.js 22, ESM)

**Primary Dependencies**: Frontend — React 18, Vite 5, Tailwind 3, TanStack Query, react-router-dom 6. API — Hono/OpenAPIHono, zod, postgres.js. Nenhuma dependencia nova.

**Storage**: PostgreSQL (Neon). Tabela `avaliacoes` existente (JSONB `criterios`). Nenhuma migracao nesta feature.

**Testing**: Sem test runner configurado. Validacao por build: `npm run build` (= `tsc -b && vite build`), `npm run lint` (= `tsc -b --noEmit`) e `npm run build` em `api/`, mais o roteiro manual do `quickstart.md`.

**Target Platform**: Web (SPA Vite), desktop e celular

**Performance Goals**: Aplicar/alterar qualquer combinacao de filtros atualiza listagem, contador e resumo em < 2 s com algumas centenas de avaliacoes (SC-002); a busca inicial reutiliza o carregamento unico de `GET /api/avaliacoes`.

**Constraints**: Sem dependencias novas; autorizacao no backend (rota existente exige `temPermissao(sessao, "avaliacao.gerenciar")`); PT-BR na UI; sem exportacao/impressao; sem paginacao nova (a listagem integral da edicao ativa ja e o comportamento atual do endpoint consumido pela tela da edicao).

**Scale/Scope**: Volume esperado de ate alguns milhares de avaliacoes por edicao (um registro por equipista por edicao); 1 pagina nova + item de menu + rota; sem arquivos novos na API.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Avaliacao | Status |
|-----------|-----------|--------|
| I. Simplicidade | Uma pagina nova reutilizando hook (`useAvaliacoes`), endpoint e componentes CSS existentes (`filtro-chip`, `card`, `badge`, `kpi`). Filtragem com funcoes puras nomeadas no proprio arquivo. Sem camadas, servicos ou abstracoes novas. | PASS |
| II. MVP Estrito | Escopo limitado ao pedido: filtros por valor de cada criterio + convidar novamente, resumo numerico, contador, detalhe e estados vazios. Sem filtros adicionais (equipe/avaliador/status/aptidao/comentarios), sem exportacao, sem graficos. | PASS |
| III. TypeScript & Seguranca de Tipos | Filtros tipados com as unions existentes (`ValorCriterio`, `NotaConvidarNovamente`); interface `Avaliacao` estendida com campos opcionais que a API ja retorna; funcoes de filtro/resumo tipadas; sem `any` novo. | PASS |
| IV. Convencoes & Consistencia | PT-BR em UI e comentarios; datas ISO ja normalizadas pelo mapper da API; camelCase/snake_case respeitados nas fronteiras existentes; sem emojis. | PASS |
| V. Dependencias & Autorizacao | Zero dependencias novas. Acesso controlado pela permissao existente `avaliacao.gerenciar` verificada no backend (rota ja publicada) e refletida no menu/pagina, mesmo modelo dos demais relatorios. | PASS |

*Re-check apos Phase 1:* sem violacoes identificadas na fase de design.

## Project Structure

### Documentation (this feature)

```text
specs/021-relatorio-avaliacoes/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── avaliacoes-relatorio.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── pages/
│   └── RelatorioAvaliacoes.tsx   # NOVA pagina /avaliacoes/relatorio (filtros, resumo, detalhe)
├── components/
│   └── Sidebar.tsx               # + item "Avaliacoes" na secao "Relatorios" (permissao avaliacao.gerenciar)
├── App.tsx                       # + rota protegida /avaliacoes/relatorio dentro do Layout
└── lib/
    ├── tipos.ts                  # Avaliacao += equipeNome?, pessoaNome?, pessoaCracha? (campos que a API ja retorna)
    └── hooks.ts                  # useAvaliacoes reutilizado sem alteracao
```

```text
api/            # SEM alteracoes — GET /api/avaliacoes ja atende (filtro por edicao, ordenacao, gate PBAC)
schema.sql      # SEM alteracoes — nenhuma migracao
```

**Structure Decision**: Estrutura plana existente. O relatorio e uma pagina somente-leitura no cliente, espelhando `RelatorioPresenca.tsx` (dados montados no cliente a partir de hooks existentes, sem chamada nova na API) e reaproveitando a semantica de listagem de `CantinaPesquisa.tsx` (expansao inline de detalhe). A API nao muda porque `GET /api/avaliacoes?edicaoId=` ja retorna todos os campos necessarios, incluindo nomes de pessoa/equipe para exibicao, ordenado por `atualizado_em DESC`.

## Complexity Tracking

> Sem violacoes de constituicao identificadas. Nenhuma justificativa de complexidade necessaria.
