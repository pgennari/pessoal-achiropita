# Tasks: QR Code para Check-in de Estacionamento

**Feature**: 009-qr-code-estacionamento | **Date**: 2026-07-27

## Phase 1: Setup

Nenhuma tarefa de setup necessaria — a lib `qrcode` ja esta instalada e o logo ja existe em `public/`.

## Phase 2: Fundacional

Nenhuma tarefa fundacional necessaria — nao ha novas entidades, tabelas ou endpoints.

## Phase 3: US1 — Gerar QR Code para impressao

**Objetivo**: Adicionar botao "QR Code" no detalhe do estacionamento que abre nova aba com QR Code formatado para impressao.

**Criterio de teste independente**: Acesse o detalhe de um estacionamento com token, clique "QR Code", verifique que nova aba abre com logo, nome, titulo, QR Code e URL na ordem correta. Verifique que Ctrl+P mostra preview A4 limpo.

- [x] T001 [US1] Criar pagina publica `src/pages/QrEstacionamento.tsx` seguindo o padrao de `QrTurma.tsx` — buscar nome do estacionamento via `buscarEstacionamentoPublico(token)` de `src/lib/checkin.ts`, gerar SVG do QR com `qrcode` (errorCorrectionLevel "H"), renderizar layout de impressao A4 com ordem: logo `/logo-achiropita.png`, nome do estacionamento, titulo "Check-in dos carros da Achiropita", QR Code dominante, URL por extenso. Suportar `?imprimir=1` para auto-print e botao "Imprimir" visivel apenas na tela
- [x] T002 [US1] Adicionar rota publica `/qr-checkin/:token` em `src/App.tsx` importando `QrEstacionamento` — posicionar junto as rotas publicas existentes (`/v-qr/:token`, `/checkin/:token`), sem `ProtegerRota` nem `Layout`
- [x] T003 [US1] Adicionar botao "QR Code" na secao "Link Publico" de `src/pages/EstacionamentoDetalhe.tsx` — `<a>` com `target="_blank"` apontando para `/qr-checkin/${estacionamento.tokenCheckin}?imprimir=1`, classe `btn btn-secundario btn-pequeno shrink-0`, posicionado ao lado dos botoes "Abrir" e "Copiar"

## Phase 4: Polimento

- [x] T004 Executar `npm run lint` e `npm run build` para verificar ausencia de erros de tipo e build

## Dependencias

```text
T001 → T002 → T003 → T004
```

T001 (criar pagina) e prerequisito para T002 ( registrar rota). T003 (botao no detalhe) depende de T002 (rota existir). T004 (build) e ultimo.

## Exemplos de Execucao Paralela

Nao ha oportunidades de paralelismo — todas as tarefas sao sequenciais (arquivos dependem uns dos outros).

## Estrategia de Implementacao

MVP completo em 3 tarefas. A feature e pequena e autocontida — uma unica user story com 5 FRs cobertos por 3 tarefas de implementacao. Nao ha backend novo, banco novo ou dependencias externas.

## Cenarios de Validacao (quickstart.md)

Apos completar T003, seguir `specs/009-qr-code-estacionamento/quickstart.md` para validacao manual (V1-V7).
