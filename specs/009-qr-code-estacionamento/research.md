# Research: QR Code para Check-in de Estacionamento

**Feature**: 009-qr-code-estacionamento | **Date**: 2026-07-27

## R1: Padrao de pagina publica de QR Code

**Decision**: Criar nova pagina `QrEstacionamento.tsx` como rota publica, seguindo o padrao exato de `QrTurma.tsx`.

**Rationale**: `QrTurma.tsx` ja resolve o mesmo problema (gerar QR Code para impressao) para o contexto de formacao. Reutilizar o padrao minimiza codigo novo e mantem consistencia visual.

**Alternatives considered**:
- Reutilizar `QrTurma.tsx` com parametro: rejeitado porque `QrTurma` tem dependencias de `LinkValidacao` e `carregarLinkPublico` que nao se aplicam a estacionamento.
- Gerar QR inline no detalhe (sem nova aba): rejeitado porque a spec exige nova janela e formato para impressao.

## R2: Parametro de impressao

**Decision**: Usar query param `?imprimir=1` para acionar automaticamente `window.print()`, mesmo padrao de `QrTurma`.

**Rationale**: Ja estabelecido no projeto. O usuario clica "QR Code" no detalhe, a nova aba abre com `?imprimir=1`, e o navegador abre o dialogo de impressao automaticamente.

**Alternatives considered**:
- Botao "Imprimir" apenas (sem auto-print): rejeitado porque o fluxo do usuario e "clicar -> imprimir", dois cliques e menos ergonomico.

## R3: Passagem de dados para a pagina publica

**Decision**: A nova pagina recebe o token via URL param (`:token`) e busca os dados do estacionamento (nome) via API publica existente (`GET /api/publico/checkin/{token}`).

**Rationale**: A API publica de check-in ja retorna `nome` e `endereco` do estacionamento. Nao e necessario criar nova rota.

**Alternatives considered**:
- Passar nome do estacionamento via `window.open()` e query params: rejeitado porque expoe dados na URL e quebra se o nome for muito longo ou contiver caracteres especiais.

## R4: Formato do QR Code

**Decision**: Gerar SVG com `qrcode` lib, `errorCorrectionLevel: "H"`, cores `#000000`/`#FFFFFF`, margem 1. Segue o padrao de `QrTurma`.

**Rationale**: Nivel "H" (High) maximiza tolerancia a erro, ideal para impressao fisica que pode sofrer desgaste. Mesmas cores e margem ja testadas no projeto.

**Alternatives considered**:
- `errorCorrectionLevel: "M"`: rejeitado porque impressao fisica tem maior risco de danos e leitura imperfeita.

## R5: Layout de impressao A4

**Decision**: Layout identico ao de `QrTurma` (imprimir mode) com `@page { size: A4 portrait; margin: 12mm; }`, mas com a ordem de itens ajustada conforme especificado: Logo -> Nome -> Titulo -> QR Code -> URL.

**Rationale**: O layout de impressao do `QrTurma` ja e validado e funcional. A unica diferenca e a ordem dos elementos e a ausencia de data de expiracao (token de estacionamento e permanente).
