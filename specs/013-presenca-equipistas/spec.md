# Feature Specification: Presenca de Equipistas

**Feature Branch**: `013-presenca-equipistas`

**Created**: 2026-08-04

**Status**: Draft

**Input**: User description: "Criar um controle de presenca dos equipistas da festa."

## User Scenarios & Testing

### User Story 1 - Tela de Presenca com abas por dia e link publico (Priority: P1)

Um usuario ADM ou ORG, dentro do menu Pessoal, acessa a tela "Presenca" e visualiza uma aba para cada dia da festa cadastrado na edicao ativa. Em cada aba, o sistema disponibiliza um link de acesso publico para aquele dia, que pode ser copiado e enviado aos coordenadores da festa.

**Why this priority**: Sem esse ponto de entrada, os coordenadores nao tem como acessar o fluxo de registro de presenca. E a fundacao da feature e o primeiro passo de uso.

**Independent Test**: Pode ser testado abrindo o menu Pessoal, entrando em "Presenca" e verificando que existe uma aba por dia da festa, cada uma com um link publico copiavel. Sem registrar presenca nenhuma, o teste ja valida o ponto de entrada.

**Acceptance Scenarios**:

1. **Given** um usuario ADM/ORG logado com uma edicao ativa que possui dias de festa cadastrados, **When** ele acessa o menu Pessoal e clica em "Presenca", **Then** a tela exibe uma aba para cada dia da festa, ordenados cronologicamente
2. **Given** a tela de Presenca aberta em uma das abas, **When** o usuario aciona a acao de copiar, **Then** o link publico de presenca daquele dia e copiado para a area de transferencia
3. **Given** uma edicao sem dias de festa cadastrados, **When** o usuario abre a tela de Presenca, **Then** o sistema exibe um estado vazio orientando o cadastro dos dias na edicao
4. **Given** o link publico de um dia, **When** ele e aberto em uma janela anonima (sem sessao), **Then** a pagina publica de presenca daquele dia e carregada sem exigir login

---

### User Story 2 - Identificacao do coordenador pelo link publico (Priority: P1)

Um coordenador recebe o link publico do dia, abre a pagina e informa o numero do proprio cracha. O sistema valida se a pessoa vinculada ao cracha e coordenador na edicao daquele dia. Se for, cumprimenta "Ola, {nome}" e libera o campo para informar crachas de equipistas. Se nao for, exibe mensagem de acesso negado.

**Why this priority**: E a porta de entrada do fluxo de registro pelo coordenador. Sem a validacao de coordenador nao ha como registrar equipistas com seguranca.

**Independent Test**: Pode ser testado abrindo o link publico em janela anonima e informando o cracha de um coordenador e o cracha de um nao-coordenador. O primeiro recebe a saudacao e o campo de equipista; o segundo recebe a mensagem de acesso negado.

**Acceptance Scenarios**:

1. **Given** o link publico de um dia aberto, **When** o coordenador informa o numero do proprio cracha, **Then** o sistema exibe a saudacao "Ola, {nome do coordenador}" e habilita o campo para informar o cracha do equipista
2. **Given** o link publico de um dia aberto, **When** o usuario informa o numero de um cracha inexistente, **Then** o sistema exibe uma mensagem de acesso negado sem revelar dados
3. **Given** o link publico de um dia aberto, **When** o usuario informa o cracha de uma pessoa que nao e coordenador na edicao daquele dia, **Then** o sistema exibe uma mensagem de acesso negado sem revelar dados
4. **Given** um link publico invalido ou revogado, **When** o usuario o abre, **Then** o sistema exibe mensagem de link invalido

---

### User Story 3 - Registro e confirmacao da presenca dos equipistas (Priority: P1)

Apos se identificar, o coordenador informa o cracha de um equipista de sua equipe. O sistema valida se a pessoa pertence a mesma equipe do coordenador na edicao. Se pertencer, mostra os dados da pessoa (nome, nome impresso no cracha e numero do cracha) com um botao INCLUIR; ao incluir, a pessoa entra na listagem da tela e o campo de cracha volta vazio e com foco para o proximo registro. Ao final, o botao CONFIRMAR PRESENCA pede a confirmacao "Confirma o check-in dos equipistas relacionados para hoje DD/MM/YYYY?" e, confirmado, registra a presenca dos equipistas da lista para o dia.

**Why this priority**: E o objetivo central da feature — registrar a presenca efetiva dos equipistas por dia, garantindo que o coordenador so registra pessoas da propria equipe.

**Independent Test**: Pode ser testado com um coordenador e um equipista da mesma equipe: informar o cracha do equipista, inclui-lo, confirmar a presenca e verificar o registro do dia.

**Acceptance Scenarios**:

1. **Given** um coordenador identificado no link publico, **When** ele informa o cracha de um equipista da mesma equipe, **Then** o sistema exibe nome, nome impresso no cracha e numero do cracha da pessoa com um botao INCLUIR
2. **Given** os dados de um equipista validos exibidos na tela, **When** o coordenador clica em INCLUIR, **Then** a pessoa e adicionada a listagem da tela e o campo de cracha e limpo e recebe foco novamente
3. **Given** um coordenador identificado, **When** ele informa o cracha de uma pessoa que nao pertence a mesma equipe, **Then** o sistema exibe a mensagem de que a pessoa nao pertence a equipe
4. **Given** a listagem com um ou mais equipistas, **When** o coordenador clica em CONFIRMAR PRESENCA, **Then** o sistema solicita confirmacao com a mensagem "Confirma o check-in dos equipistas relacionados para hoje DD/MM/YYYY?", usando a data do dia selecionado
5. **Given** a confirmacao aceita, **When** o sistema conclui o registro, **Then** a presenca de cada equipista da listagem e registrada para o dia e o sistema exibe feedback de sucesso
6. **Given** um equipista ja registrado para o dia, **When** o coordenador informa o cracha dele novamente, **Then** o sistema informa que a presenca ja foi registrada e nao duplica

---

### Edge Cases

- O que acontece quando o coordenador informa o numero do proprio cracha no campo de equipista?
- O que acontece quando o coordenador informa o cracha de um equipista que ja esta na listagem da tela (duplicado na sessao)?
- Como o sistema se comporta quando o coordenador lidera mais de uma equipe — equipistas de qualquer uma das equipes dele podem ser incluidos?
- O que acontece quando a listagem esta vazia e o coordenador tenta confirmar a presenca?
- O que acontece se o coordenador recarregar a pagina antes de confirmar — a listagem nao confirmada se perde?
- Como o sistema trata o registro de presenca de um equipista cuja participacao foi alterada ou removida apos o inicio do fluxo?
- O que acontece quando o mesmo coordenador abre o link e confirma presenca mais de uma vez no mesmo dia?

## Requirements

### Functional Requirements

- **FR-001**: O menu Pessoal deve exibir o item "Presenca", visivel para os perfis ADM e ORG, levando a tela de presenca da edicao ativa
- **FR-002**: A tela de Presenca deve exibir uma aba para cada dia da festa cadastrado na edicao ativa, ordenadas cronologicamente
- **FR-003**: Cada aba deve exibir um link de acesso publico daquele dia com acao de copiar o link para a area de transferencia
- **FR-004**: O link publico deve funcionar sem autenticacao, permitindo que qualquer pessoa o acesse
- **FR-005**: Ao abrir o link publico, o sistema deve apresentar um campo para o usuario informar o numero do proprio cracha
- **FR-006**: O sistema deve validar que o cracha informado corresponde a uma pessoa cadastrada que e coordenadora na edicao daquele dia
- **FR-007**: Se o cracha informado nao for de um coordenador (ou nao existir), o sistema deve exibir mensagem de acesso negado sem revelar dados da pessoa
- **FR-008**: Se for coordenador, o sistema deve exibir a saudacao "Ola, {nome}" e habilitar o campo para informar o cracha do equipista
- **FR-009**: Ao informar o cracha de um equipista, o sistema deve validar que a pessoa pertence a mesma equipe do coordenador na edicao daquele dia
- **FR-010**: Se a pessoa nao pertencer a equipe do coordenador, o sistema deve exibir a mensagem de que a pessoa nao pertence a equipe
- **FR-011**: Se a pessoa pertencer a equipe, o sistema deve exibir o nome, o nome impresso no cracha e o numero do cracha, com um botao INCLUIR
- **FR-012**: Ao clicar em INCLUIR, o sistema deve adicionar a pessoa a listagem de equipistas da tela, limpar o campo de cracha e devolver o foco ao campo
- **FR-013**: O sistema deve impedir a inclusao duplicada do mesmo equipista na listagem da tela, com mensagem amigavel
- **FR-014**: O sistema deve impedir que o coordenador inclua a si mesmo na listagem, com mensagem amigavel
- **FR-015**: O sistema deve impedir a inclusao de um equipista que ja possui presenca registrada para o dia, com mensagem amigavel
- **FR-016**: A tela deve exibir um botao CONFIRMAR PRESENCA, habilitado apenas quando ha pelo menos um equipista na listagem
- **FR-017**: Ao clicar em CONFIRMAR PRESENCA, o sistema deve solicitar confirmacao com a mensagem "Confirma o check-in dos equipistas relacionados para hoje DD/MM/YYYY?", preenchendo a data do dia selecionado
- **FR-018**: Após a confirmacao, o sistema deve registrar a presenca de cada equipista da listagem para o dia, incluindo dia da festa, edicao, equipe, pessoa (nome e cracha), coordenador que confirmou e data/hora do registro
- **FR-019**: Apos o registro, o sistema deve exibir feedback de sucesso e limpar a listagem
- **FR-020**: Cada dia deve possuir um link publico proprio, gerado com identificador unico e controlado por status ativo/revogado
- **FR-021**: O sistema deve exibir mensagem de link invalido ou revogado quando o token do link nao for valido
- **FR-022**: O sistema deve impedir o registro duplicado de presenca do mesmo equipista para o mesmo dia, mesmo em confirmacoes subsequentes
- **FR-023**: Todas as mensagens de erro e confirmacao devem ser em PT-BR e amigaveis

### Key Entities

- **Presenca**: Registro de presenca de um equipista em um dia da festa. Identificado pelo dia da festa e pela pessoa; contem edicao, equipe, dados da pessoa (nome e cracha), coordenador que confirmou e data/hora do registro. Nao admite duplicata por dia e pessoa.
- **LinkPresenca**: Link de acesso publico de um dia da festa, com token unico e status ativo/revogado. E compartilhado com todos os coordenadores daquele dia.
- **DiaFesta**: Dia da festa cadastrado na edicao (entidade existente), utilizado como base das abas da tela de Presenca.
- **Pessoa**: Pessoa cadastrada com numero de cracha (entidade existente). Atua como coordenador ou equipista conforme a participacao.
- **Participacao**: Vinculo de uma pessoa a uma equipe da edicao com funcao (Coordenador, Equipista ou Apoio) (entidade existente). Define quem e coordenador e a qual equipe cada equipista pertence.
- **Equipe**: Equipe da edicao (entidade existente), utilizada para validar que equipista e coordenador pertencem a mesma equipe.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Usuarios ADM/ORG conseguem copiar o link publico de presenca de um dia em ate 2 cliques a partir da tela de Presenca
- **SC-002**: Coordenadores conseguem registrar o primeiro equipista em menos de 30 segundos a partir da abertura do link publico
- **SC-003**: 100% dos acessos por crachas de nao-coordenadores exibem mensagem de acesso negado sem revelar dados de pessoas
- **SC-004**: Coordenadores conseguem incluir equipistas da propria equipe e confirmar a presenca sem erros, em um unico fluxo de tela
- **SC-005**: 100% dos registros de presenca de um equipista para um dia sao unicos (sem duplicatas), mesmo com confirmacoes repetidas do mesmo coordenador

## Assumptions

- Um coordenador e identificado pela participacao com funcao "Coordenador" na edicao do dia; a equipe do coordenador e derivada dessa participacao
- Um coordenador pode liderar mais de uma equipe; equipistas de qualquer uma das equipes do coordenador podem ser incluidos
- "Equipista" e toda pessoa com participacao na mesma equipe do coordenador na edicao, com funcao Equipista ou Apoio, excluindo o proprio coordenador
- O "nome impresso no cracha" corresponde ao nome da pessoa registrado no cadastro, pois nao existe campo separado de nome de cracha
- O link publico e unico por dia e compartilhado entre todos os coordenadores daquele dia
- A tela interna de Presenca e acessivel apenas pelos perfis ADM e ORG
- A listagem de equipistas e mantida apenas na tela ate a confirmacao; recarregar a pagina perde a listagem ainda nao confirmada
- A presenca confirmada e definitiva na versao inicial; nao ha edicao ou exclusao de presenca registrada
- A confirmacao de presenca usa a data do dia selecionado na aba, independentemente da data real em que o registro ocorre
- O registro de presenca de um equipista que ja possui presenca para o dia e ignorado (idempotente)
- O fluxo reutiliza as regras e padroes de publicacao de links ja existentes na aplicacao (link publico anonimo com token)
