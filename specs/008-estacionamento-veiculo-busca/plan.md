# Implementation Plan: Remocao de Associacao Pessoa-Estacionamento e Busca de Veiculos

**Branch**: `008-estacionamento-veiculo-busca` | **Date**: 2026-07-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-estacionamento-veiculo-busca/spec.md`

## Summary

Remover a aba "Pessoas Associadas" da tela de detalhes do estacionamento e implementar busca de veiculos por fabricante, modelo, cor, placa ou dados de pessoas vinculadas (nome/cracha). A associacao pessoa-estacionamento passa a ser feita exclusivamente via veiculo.

## Technical Context

**Language/Version**: TypeScript (strict mode), React 18, Vite 5

**Primary Dependencies**: React, React Router, React Query, Tailwind CSS

**Storage**: PostgreSQL (Neon) via Hono API

**Testing**: Nenhum test runner configurado (validacao manual via npm run build + lint)

**Target Platform**: Web SPA (desktop e mobile)

**Project Type**: Web application (SPA frontend + Hono API backend)

**Performance Goals**: Busca no cliente com debounce, sem requisicoes adicionais ao backend

**Constraints**: Sem Cloud Functions; tudo cliente + Security Rules. Firebase Spark (gratuito).

**Scale/Scope**: ~50-100 usuarios simultaneos, ~100 estacionamentos, ~500 veiculos

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Simplicidade | PASS | Solucao direta: filtro em array, sem abstracoes |
| II. MVP Estrito | PASS | Implementa apenas o descrito na spec |
| III. TypeScript | PASS | Tipos ja existem (VeiculoComPessoas) |
| IV. Convencoes | PASS | PT-BR em UI, camelCase no TS |
| V. Dependencias | PASS | Nenhuma nova dependencia necessaria |

## Project Structure

### Documentation (this feature)

```text
specs/008-estacionamento-veiculo-busca/
├── plan.md              # Este arquivo
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── busca-veiculos.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── pages/
│   └── EstacionamentoDetalhe.tsx   # Remover aba "Pessoas Associadas", atualizar aba "Veiculos"
├── components/
│   ├── ListaPessoasEstacionamento.tsx   # Removida (nao mais necessaria)
│   └── ListaVeiculosEstacionamento.tsx  # NOVA componente de busca e lista
└── lib/
    ├── veiculos.ts         # Funcoes de associacao veiculo-estacionamento (existentes)
    ├── hooks.ts            # Hooks useVeiculosEstacionamento (existentes)
    └── tipos.ts            # Tipos VeiculoComPessoas (existentes)
```

**Structure Decision**: Modificacao pontual em arquivos existentes. Nenhuma nova estrutura de pastas. Componente `ListaVeiculosEstacionamento` e substituta natural de `ListaPessoasEstacionamento`.

## Complexity Tracking

Nao ha violacoes da constituicao. Feature e uma modificacao direta em UI existente.
