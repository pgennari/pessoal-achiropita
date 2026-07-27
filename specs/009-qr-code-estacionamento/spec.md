# Feature Specification: QR Code para Check-in de Estacionamento

**Created**: 2026-07-27

**Status**: Draft

**Input**: User description: "No detalhe do estacionamento, no bloco do link publico, incluir um botao 'QR Code', que deve abrir uma nova janela com o um QR Code que direcione para o link em um formato para ser impresso. Deve conter um titulo: Check-in dos carros da Achiropita. Inclua o logo da Achiropita. Inclua tb o nome do estacionamento."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Gerar QR Code para impressao (Priority: P1)

**Como** ADM ou ORG,
**quero** clicar em um botao "QR Code" na secao de link publico do detalhe do estacionamento e abrir uma nova janela com o QR Code formatado para impressao,
**para** imprimir o QR Code e colocar no estacionamento para que os operadores escaneiem com o celular.

**Por que esta prioridade**: Funcionalidade principal — sem ela nao e possivel gerar o QR Code para impressao.

**Teste independente**: Pode ser testado acessando o detalhe de um estacionamento com token de check-in ativo, clicando no botao "QR Code" e verificando que uma nova janela se abre com o QR Code, titulo, logo e nome do estacionamento.

**Cenarios de aceite**:

1. **Dado** que o usuario esta na pagina de detalhe do estacionamento, **Quando** observa a secao "Link Publico", **Entao** o botao "QR Code" esta visivel ao lado dos botoes "Abrir" e "Copiar".
2. **Dado** que o usuario clica no botao "QR Code", **Quando** o clique acontece, **Entao** uma nova janela (aba do navegador) se abre exibindo o QR Code apontando para a URL publica de check-in do estacionamento.
3. **Dado** que a nova janela com o QR Code esta aberta, **Quando** o usuario visualiza, **Entao** a pagina exibe na seguinte ordem de cima para baixo: logo da Festa Achiropita, nome do estacionamento, titulo "Check-in dos carros da Achiropita", QR Code e URL por extenso.
4. **Dado** que a nova janela com o QR Code esta aberta, **Quando** o usuario utiliza a funcao de impressao do navegador (Ctrl+P), **Entao** o resultado impresso e limpo e legivel, com o QR Code em tamanho adequado para leitura por câmera de celular, sem elementos visuais desnecessarios (botoes, navegacao, etc.).
5. **Dado** que o usuario escaneia o QR Code impresso com a câmera de um celular, **Quando** o scan e concluido, **Entao** o celular oferece a opcao de abrir o link de check-in publico do estacionamento.

---

## Functional Requirements *(mandatory)*

### FR-01: Botao QR Code na secao Link Publico

O detalhe do estacionamento deve exibir um botao rotulado "QR Code" dentro da secao "Link Publico", posicionado ao lado dos botoes existentes "Abrir" e "Copiar". O botao deve estar disponivel sempre que o estacionamento possui um token de check-in valido.

### FR-02: Nova janela com QR Code para impressao

Ao clicar no botao "QR Code", o sistema deve abrir uma nova janela/aba do navegador com uma pagina dedicada ao QR Code. A URL da nova janela deve apontar para a URL publica de check-in do estacionamento (`/checkin/{token}`).

### FR-03: Conteudo da pagina de impressao

A pagina de impressao do QR Code deve conter, de cima para baixo:

1. **Logo**: Imagem do logo da Festa Achiropita, centralizado.
2. **Nome do estacionamento**: Nome do estacionamento exibido abaixo do logo.
3. **Titulo**: "Check-in dos carros da Achiropita" em fonte grande e em negrito.
4. **QR Code**: Codigo QR apontando para a URL publica de check-in, em tamanho dominante e legivel.
5. **URL por extenso**: Endereco URL escrito por extenso abaixo do QR Code, para que o usuario tambem possa digitar manualmente.

### FR-04: Otimizacao para impressao

A pagina de impressao deve ser otimizada para papel A4, com fundo branco, sem elementos de navegacao da aplicacao (sidebar, topbar, botoes de acao). O QR Code deve ocupar a maior area possible na folha para facilitar a leitura. A ao imprimir (via Ctrl+P ou botao dedicado), apenas o conteudo relevante deve aparecer no papel.

### FR-05: Botao "Imprimir" na tela

A pagina de impressao deve exibir, visivel apenas na tela (nao no papel), um botao "Imprimir" que aciona a funcao de impressao nativa do navegador.

---

## Assumptions

- O `qrcode` (v1.5.4) ja esta instalado como dependencia do projeto e sera utilizado para gerar o SVG do QR Code, seguindo o mesmo padrao ja existente na funcionalidade de QR Code da formacao.
- O logo da Achiropita (`/logo-achiropita.png`) ja existe no diretorio `public/` e sera reutilizado na pagina de impressao.
- O token de checkin do estacionamento e permanente (nao expira), diferente dos links de formacao que tem validade. Portanto, nao e necessario exibir data de expiracao no QR Code.
- A URL do QR Code apontara para a rota publica `/checkin/{token}` — a mesma URL que ja e gerada na secao "Link Publico" do detalhe.
- A pagina de impressao seguira o padrao visual ja estabelecido pela pagina `QrTurma` (rota `/v-qr/:token`), adaptada para o contexto de estacionamento.

## Key Entities

- **Estacionamento**: contem `id`, `nome`, `tokenCheckin` — dados necessarios para gerar o QR Code e identificar o estacionamento na pagina de impressao.
- **URL publica de check-in**: Formato `{origin}/checkin/{tokenCheckin}` — destino do QR Code.

## Out of Scope

- Gerenciamento de multiplos QR Codes por estacionamento.
- QR Codes com expiration ou revogacao (o token de checkin e permanente).
- Historico de impressoes ou audit trail de QR Codes gerados.
- Customizacao visual do QR Code (cores, moldura, etc.) alem do padrao definido.
