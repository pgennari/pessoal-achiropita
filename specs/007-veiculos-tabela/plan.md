# Implementation Plan: Tabela de Veículos com Relacionamento Múltiplo

**Branch**: `007-veiculos-tabela` | **Date**: 2026-07-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-veiculos-tabela/spec.md`

## Summary

Criar uma tabela independente `veiculos` no PostgreSQL, com tabela de junção `pessoa_veiculo` (many-to-many) e campo `estacionamento_id` (1:1). Migrar dados do JSONB `pessoas.carros` e do `pessoas.estacionamento_id` para o novo modelo. Atualizar a API de check-in para buscar veículos por placa e retornar as pessoas associadas. Atualizar as telas de pessoa, estacionamento e check-in para usar o novo modelo.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Node.js 22

**Primary Dependencies**: Hono (backend API), React 18 (frontend SPA), postgres.js (PostgreSQL driver), Zod (validation via @hono/zod-openapi)

**Storage**: PostgreSQL (Neon, plano gratuito)

**Testing**: Sem test runner configurado. Validação via `npm run lint` (= `tsc -b --noEmit`)

**Target Platform**: Web SPA (desktop e mobile), Cloud Run (backend), Firebase Hosting (frontend)

**Project Type**: Web application (SPA + API separada)

**Performance Goals**: Busca por placa < 2 segundos para estacionamentos com até 500 pessoas associadas

**Constraints**: Sem Cloud Functions. Backend via Hono em Cloud Run. Frontend via Firebase Hosting estático.

**Scale/Scope**: 50-100 usuários simultâneos, ~5.871 pessoas cadastradas, ~27 edições de histórico

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Simplicidade | PASS | Solução direta: tabela veículos + junção + migration script |
| II. MVP Estrito | PASS | Implementa apenas o que está nas US da spec |
| III. TypeScript & Segurança de Tipos | PASS | Interfaces bem definidas para Veiculo, PessoaVeiculo |
| IV. Convenções & Consistência | PASS | snake_case no banco, camelCase no TS, PT-BR em UI |
| V. Dependências & Autorização | PASS | Sem novas dependências. Autorização via `podeAdministrar()` |

## Project Structure

### Documentation (this feature)

```text
specs/007-veiculos-tabela/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 - decisões técnicas
├── data-model.md        # Phase 1 - modelo de dados
├── quickstart.md        # Phase 1 - guia de validação
├── contracts/           # Phase 1 - contratos de API
└── tasks.md             # Phase 2 (não criado por /speckit.plan)
```

### Source Code (repository root)

```text
api/
  src/
    rotas/
      veiculos.ts        # NOVO - CRUD de veículos
      estacionamentos.ts # ALTERADO - associar/desassociar veículos
      checkin.ts         # ALTERADO - buscar por placa retorna veículos com pessoas
    db.ts                #不变
    auth.ts              #不变

src/
  pages/
    Veiculos.tsx         # NOVO - listagem de veículos
    VeiculoDetalhe.tsx   # NOVO - detalhe/edição de veículo
    PessoaDetalhe.tsx    # ALTERADO - seção de veículos vinculados
    EstacaoDetalhe.tsx   # ALTERADO - seção de veículos associados
    CheckinPublico.tsx   # ALTERADO - card de veículo com pessoas
  components/
    VeiculoCard.tsx      # NOVO - card de veículo para check-in
    VeiculoForm.tsx      # NOVO - formulário de cadastro/edição
    VinculoVeiculo.tsx   # NOVO - modal de vínculo pessoa-veículo
  lib/
    tipos.ts             # ALTERADO - interfaces Veiculo, PessoaVeiculo
    hooks.ts             # ALTERADO - hooks de veículos
    veiculos.ts          # NOVO - funções de API para veículos

schema.sql               # ALTERADO - novas tabelas + migration
```

**Structure Decision**: Web application com frontend SPA (React) + backend API (Hono). Estrutura existente mantida, com novos arquivos para veículos.

## Complexity Tracking

> Não há violações de constituição. Feature é uma refatoração de dados (JSONB → tabela independente) que segue o padrão existente do projeto.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (nenhuma) | - | - |
