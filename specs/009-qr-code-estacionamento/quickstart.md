# Quickstart: QR Code para Check-in de Estacionamento

**Feature**: 009-qr-code-estacionamento | **Date**: 2026-07-27

## Pre-requisitos

- Aplicacao rodando localmente (`npm run dev`)
- Pelo menos um estacionamento cadastrado com `tokenCheckin` valido

## Cenarios de Validacao

### V1: Botao QR Code aparece no detalhe

1. Acesse `/estacionamentos`
2. Clique em um estacionamento com token de check-in
3. Rola ate a secao "Link Publico"
4. **Esperado**: Botao "QR Code" visivel ao lado de "Abrir" e "Copiar"

### V2: Nova aba abre com QR Code

1. Clique no botao "QR Code"
2. **Esperado**: Nova aba do navegador se abre
3. **Esperado**: Dialogo de impressao do navegador e acionado automaticamente

### V3: Conteudo da pagina de impressao

1. Na nova aba (antes de imprimir, cancele o dialogo), observe o conteudo
2. **Esperado**: Na ordem de cima para baixo:
   - Logo da Festa Achiropita (centralizado)
   - Nome do estacionamento
   - Titulo "Check-in dos carros da Achiropita"
   - QR Code (tamanho dominante)
   - URL por extenso em fonte monospace
3. **Esperado**: Fundo branco, sem sidebar/topbar/botoes de navegacao

### V4: Impressao em A4

1. Pressione Ctrl+P (ou Cmd+P no Mac) na pagina de impressao
2. **Esperado**: Preview mostra layout A4 com todos os elementos visiveis
3. **Esperado**: QR Code e grande e legivel
4. **Esperado**: Nao aparece o botao "Imprimir" no papel

### V5: QR Code escaneavel

1. Imprima a pagina ou use o preview
2. Escaneie o QR Code com a camera de um celular
3. **Esperado**: O celular oferece abrir o link `/checkin/{token}` no navegador

### V6: Botao "Imprimir" funciona

1. Na pagina de impressao (versao de tela), clique no botao "Imprimir"
2. **Esperado**: Dialogo de impressao do navegador e aberto

### V7: Build limpo

1. Execute `npm run lint`
2. Execute `npm run build`
3. **Esperado**: Ambos completam sem erros
