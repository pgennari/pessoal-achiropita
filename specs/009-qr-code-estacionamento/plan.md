# Implementation Plan: QR Code para Check-in de Estacionamento

**Branch**: `009-qr-code-estacionamento` | **Date**: 2026-07-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-qr-code-estacionamento/spec.md`

## Summary

Adicionar um botao "QR Code" na secao "Link Publico" do detalhe do estacionamento. Ao clicar, abre uma nova aba com uma pagina publica contendo o logo da Achiropita, nome do estacionamento, titulo "Check-in dos carros da Achiropita", QR Code apontando para o link de check-in e a URL por extenso — otimizada para impressao em A4.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)

**Primary Dependencies**: Vite 5, React 18, `qrcode` v1.5.4 (ja instalado)

**Storage**: Sem mudancas de banco — funcionalidade puramente de UI

**Testing**: Sem test runner configurado (validacao manual via `npm run lint` e `npm run build`)

**Target Platform**: Web SPA (desktop e mobile), Firebase Hosting

**Project Type**: Web application (frontend SPA + backend API)

**Performance Goals**: Geracao do SVG do QR Code < 200ms no cliente

**Constraints**: Plano Spark (gratuito), sem Cloud Functions

**Scale/Scope**: ~10 estacionamentos, ~50-100 usuarios simultaneos

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Status | Observacao |
|-----------|--------|------------|
| I. Simplicidade | ✅ PASS | Nova pagina publica + botao — sem novas entidades, tabelas ou API |
| II. MVP Estrito | ✅ PASS | Implementa apenas o que esta na spec (1 user story, 5 FRs) |
| III. TypeScript & Seguranca de Tipos | ✅ PASS | Reutiliza tipo `Estacionamento` existente em `tipos.ts` |
| IV. Convencoes & Consistencia | ✅ PASS | Segue padrao da `QrTurma` (rota publica, `qrcode` lib, `?imprimir=1`) |
| V. Dependencias & Autorizacao | ✅ PASS | Rota publica sem autenticacao, igual `/v-qr/:token` |

## Project Structure

### Documentation (this feature)

```text
specs/009-qr-code-estacionamento/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 — decisoes tecnicas
├── data-model.md        # Phase 1 — modelo de dados
├── quickstart.md        # Phase 1 — guia de validacao
└── tasks.md             # Phase 2 (/speckit.tasks)
```

### Source Code (repository root)

```text
# Frontend (SPA)
src/
├── pages/
│   └── QrEstacionamento.tsx   # Nova — pagina publica de QR Code para impressao
├── components/                # Sem novos componentes
├── lib/
│   └── tipos.ts               # Sem mudancas (tipo Estacionamento ja existe)
├── App.tsx                    # Atualizar — adicionar rota publica /qr-checkin/:token
└── styles/
    └── globals.css            # Sem mudancas necessarias
```

**Structure Decision**: Nova pagina publica `QrEstacionamento.tsx` segue o padrao estabelecido por `QrTurma.tsx`. Rota publica sem autenticacao, registrada em `App.tsx` ao lado de `/v-qr/:token` e `/checkin/:token`. Sem mudancas no backend ou banco de dados.

## Complexity Tracking

> Nenhuma violacao de constituicao identificada.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | — | — |
