# Implementation Plan: Associar Veiculo a Estacionamento e Pessoas

**Branch**: `012-associar-veiculo-estacionamento` | **Date**: 2026-07-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/012-associar-veiculo-estacionamento/spec.md`

## Summary

Adicionar ao detalhe do veiculo (`VeiculoDetalhe.tsx`) a capacidade de associar/desassociar o veiculo a um estacionamento e vincular/desvincular pessoas. E uma feature exclusivamente frontend — os endpoints de backend e as entidades de banco ja existem.

## Technical Context

**Language/Version**: TypeScript strict, React 18, Vite 5 (frontend) + Hono Node.js 22 (backend — sem alteracoes)

**Primary Dependencies**: React Router, @tanstack/react-query, Tailwind CSS 3

**Storage**: PostgreSQL (schema ja migrado — tabelas `veiculos`, `pessoa_veiculo`, `estacionamentos`)

**Testing**: Nao ha test runner configurado (projeto sem tests automatizados)

**Target Platform**: Web SPA (Firefox/Chrome/Edge desktop)

**Project Type**: Web application (frontend SPA + backend API REST)

**Performance Goals**: N/A — alteracao de UI local sem impacto de performance

**Constraints**: Usar os estilos e padroes existentes (Tailwind classes, componentes `btn`, `card`, `input`, `badge`)

**Scale/Scope**: Um unico componente de pagina (`VeiculoDetalhe`) com duas novas secoes de UI

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Status | Justificativa |
|-----------|--------|---------------|
| I. Simplicidade | PASSA | Reuso de componentes existentes (`EstacionamentoPessoa`, `VinculoVeiculo`). Nenhuma abstracao nova. |
| II. MVP Estrito | PASSA | Feature solicitada diretamente pelo usuario via speckit. Nao e escopo adicional. |
| III. TypeScript & Seguranca de Tipos | PASSA | Tipos ja existentes em `tipos.ts` (`Veiculo`, `PessoaComVeiculos`, `Estacionamento`). |
| IV. Convencoes & Consistencia | PASSA | PT-BR em UI, camelCase no codigo, sem emojis. |
| V. Dependencias & Autorizacao | PASSA | Sem novas dependencias. Reuso do sistema de sessao existente (`useSessao`). |

**Decisao**: GATE aprovado — nenhuma violacao identificada.

## Project Structure

### Documentation (this feature)

```text
specs/012-associar-veiculo-estacionamento/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── veiculo-detalhe-integracao.md
└── spec.md              # Feature specification
```

### Source Code (repository root)

```text
src/
├── pages/
│   ├── VeiculoDetalhe.tsx       # MODIFICAR: add parking selector + person linking
│   └── ...
├── components/
│   ├── VinculoVeiculo.tsx       # REUSAR (inverter fluxo: veiculo -> pessoas)
│   ├── EstacionamentoPessoa.tsx # REUSAR COMO REFERENCIA (padrao seletor)
│   └── ...
└── lib/
    ├── veiculos.ts              # REUSAR (funcoes ja existem)
    ├── hooks.ts                 # REUSAR (hooks ja existem)
    └── ...
```

**Structure Decision**: Estrutura existente do monorepo (frontend + backend). Sem mudancas estruturais.

## Complexity Tracking

Nenhuma violacao a justificar.
