# Feature Specification: Avaliacao de Equipistas

**Feature Branch**: `019-avaliacao-equipistas`

**Created**: 2026-08-18

**Status**: Draft

**Input**: User description: "Transformar o formulario fisico de avaliacao de equipistas em funcionalidade digital integrada ao sistema. Coordenadores avaliam equipistas da propria equipe via link publico, criterios com notas, aptidao e comentarios."

## Clarifications

### Session 2026-08-18

- Q: O link publico e unico no sistema ou por equipe? → A: Unico por edicao. A diferenciação da equipe se da pelo numero do cracha informado pelo coordenador.
- Q: E necessario informar ano de nascimento junto com o cracha? → A: Nao, somente o cracha.
- Q: Onde o link publico de avaliacao e visualizado pelo ADM/ORG? → A: Na tela de detalhes da edicao (rota /edicoes/:id), nao em tela separada.
- Q: Coordenador pode liderar mais de uma equipe? → A: Nao, cada coordenador coordena exatamente uma equipe.
- Q: Equipista pode ter participacao em mais de uma equipe? → A: Nao, cada equipista pertence a exatamente uma equipe por edicao.
- Q: O que acontece quando a participacao de um equipista e removida apos avaliacao iniciada? → A: O equipista some da lista de avaliacao no link publico.
- Q: Como funciona o salvamento de rascunho ao recarregar a pagina? → A: Salvamento automatico com debounce de 2 segundos.
- Q: Um equipista pode ter quantas avaliacoes por edicao? → A: Apenas uma avaliacao por edicao.
- Q: O que acontece quando o link e revogado apos avaliacoes iniciadas? → A: As avaliacoes ficam no status em que estiverem.
- Q: Limite de caracteres do campo de comentarios? → A: 4000 caracteres.
- Q: A avaliacao aparece em alguma outra tela alem da edicao? → A: Sim, na tela de detalhes da Pessoa, em aba "Historico de Avaliacoes" junto com as outras abas de historicos.

## User Scenarios & Testing

### User Story 1 - Gerenciamento do link e avaliacoes pela tela da edicao (Priority: P1)

Um usuario ADM ou ORG, ao acessar a tela de detalhes de uma edicao (rota /edicoes/:id), visualiza o link de acesso publico de avaliacao daquela edicao. O link e unico por edicao e pode ser copiado e enviado aos coordenadores. A tela da edicao tambem exibe a listagem de avaliacoes realizadas na edicao, com filtros por equipe, avaliador e status.

**Why this priority**: Sem o link publico, o coordenador nao tem como acessar o fluxo de avaliacao. E o ponto de entrada da feature, integrado a tela ja existente de gestao de edicoes.

**Independent Test**: Pode ser testado abrindo a tela de detalhes de uma edicao e verificando que o link publico de avaliacao e exibido e copiavel, e que a listagem de avaliacoes da edicao esta disponivel. Sem nenhuma avaliacao registrada, o teste ja valida o ponto de entrada.

**Acceptance Scenarios**:

1. **Given** um usuario ADM/ORG logado na tela de detalhes de uma edicao, **When** ele visualiza a secao de avaliacao, **Then** o link publico unico da edicao e exibido com acao de copiar para a area de transferencia
2. **Given** a tela de detalhes da edicao aberta, **When** o usuario aciona a acao de copiar, **Then** o link publico de avaliacao da edicao e copiado para a area de transferencia
3. **Given** a tela de detalhes da edicao aberta, **When** o usuario visualiza a listagem de avaliacoes, **Then** sao exibidas todas as avaliacoes da edicao com filtros por equipe, avaliador e status
4. **Given** avaliacoes existentes na edicao, **When** o usuario aplica filtro por equipe, **Then** apenas avaliacoes da equipe selecionada sao exibidas
5. **Given** avaliacoes existentes na edicao, **When** o usuario aplica filtro por status (Rascunho/Finalizada), **Then** apenas avaliacoes com o status selecionado sao exibidas
6. **Given** avaliacoes existentes na edicao, **When** o usuario seleciona uma avaliacao, **Then** os detalhes completos sao exibidos, incluindo todos os criterios, aptidao, comentarios, avaliador, equipe, pessoa e datas
7. **Given** uma avaliacao finalizada, **When** o usuario ADM/ORG a visualiza, **Then** os dados sao exibidos em modo leitura

---

### User Story 2 - Identificacao do coordenador pelo link publico (Priority: P1)

Um coordenador recebe o link publico da edicao, abre a pagina e informa o numero do proprio cracha. O sistema valida se a pessoa vinculada ao cracha e coordenador na edicao correspondente. Se for, cumprimenta, determina a equipe que ele coordena e lista os equipistas dessa equipe. Se nao for, exibe mensagem de acesso negado.

**Why this priority**: E a porta de entrada do fluxo de avaliacao pelo coordenador. Sem a validacao de coordenador nao ha como garantir que apenas avaliadores autorizados acessem o formulario.

**Independent Test**: Pode ser testado abrindo o link publico em janela anonima e informando o cracha de um coordenador valido e de um nao-coordenador. O primeiro recebe a listagem de equipistas; o segundo recebe acesso negado.

**Acceptance Scenarios**:

1. **Given** o link publico da edicao aberto, **When** o coordenador informa o numero do proprio cracha, **Then** o sistema exibe a saudacao "Ola, {nome do coordenador}" e a lista dos equipistas da equipe que ele coordena na edicao
2. **Given** o link publico da edicao aberto, **When** o usuario informa um cracha inexistente, **Then** o sistema exibe mensagem de acesso negado sem revelar dados
3. **Given** o link publico da edicao aberto, **When** o usuario informa o cracha de uma pessoa que nao e coordenador na edicao correspondente, **Then** o sistema exibe mensagem de acesso negado sem revelar dados
4. **Given** um link publico invalido ou revogado, **When** o usuario o abre, **Then** o sistema exibe mensagem de link invalido

---

### User Story 3 - Selecao de equipista e preenchimento da avaliacao (Priority: P1)

Apos se identificar, o coordenador visualiza a lista de equipistas da equipe que coordena. Cada equipista ja avaliado e marcado visualmente. O coordenador seleciona um equipista pendente e preenche os criterios de avaliacao: Pontualidade, Dedicao, Companheirismo, Espiritualidade, Comprometimento e Uniforme, cada um com opcoes Otimo/Bom/Regular/Ruim. Tambem define se a pessoa e "Apta a Coordenar" (Sim/Nao) e pode adicionar comentarios e sugestoes.

**Why this priority**: E o nucleo da feature — o preenchimento efetivo do formulario de avaliacao.

**Independent Test**: Pode ser testado selecionando um equipista da lista, preenchendo todos os criterios, definindo aptidao e salvando. A avaliacao deve ser registrada com status Rascunho.

**Acceptance Scenarios**:

1. **Given** o coordenador identificado na tela de avaliacao, **When** ele visualiza a lista de equipistas, **Then** cada equipista e exibido com nome e indicador visual de avaliacao pendente ou ja realizada
2. **Given** a lista de equipistas exibida, **When** o coordenador seleciona um equipista pendente, **Then** o formulario de avaliacao e aberto com todos os criterios vazios (sem valor selecionado)
3. **Given** o formulario de avaliacao aberto, **When** o coordenador seleciona um valor para cada criterio (Pontualidade, Dedicao, Companheirismo, Espiritualidade, Comprometimento, Uniforme), **Then** o sistema registra a selecao de cada criterio individualmente
4. **Given** o formulario de avaliacao aberto, **When** o coordenador define a aptidao (Sim ou Nao), **Then** o sistema registra a escolha
5. **Given** o formulario de avaliacao aberto, **When** o coordenador preenche o campo de comentarios e sugestoes, **Then** o sistema armazena o texto informado
6. **Given** o coordenador preenchendo o formulario, **When** qualquer campo e alterado, **Then** o sistema salva automaticamente o rascunho com debounce de 2 segundos
7. **Given** o formulario com todos os criterios preenchidos e aptidao definida, **When** o coordenador aciona FINALIZAR, **Then** o sistema solicita confirmacao e, confirmado, registra a avaliacao com status "Finalizada"
8. **Given** uma avaliacao com criterios incompletos, **When** o coordenador tenta finalizar, **Then** o sistema exibe mensagem informando que todos os criterios e a aptidao sao obrigatorios para finalizar

---

### User Story 4 - Gerenciamento de avaliacoes salvas (Priority: P2)

O coordenador pode visualizar o status das avaliacoes (Rascunho ou Finalizada) e retomar avaliacoes em rascunho para edicao. Avaliacoes finalizadas sao imutaveis — nao podem ser alteradas ou excluidas.

**Why this priority**: Permite que o coordenador trabalhe em varias avaliacoes ao longo do tempo e tenha controle sobre o progresso.

**Independent Test**: Pode ser testado criando uma avaliacao em rascunho, retomando-a para edicao, finalizando-a e verificando que nao e mais possivel altera-la.

**Acceptance Scenarios**:

1. **Given** avaliacoes em rascunho existentes, **When** o coordenador retorna a lista de equipistas, **Then** as avaliacoes em rascunho sao identificadas visualmente como pendentes
2. **Given** uma avaliacao em rascunho, **When** o coordenador seleciona o equipista novamente, **Then** o formulario e aberto com os dados previamente salvos
3. **Given** uma avaliacao finalizada, **When** o coordenador seleciona o equipista novamente, **Then** os dados sao exibidos em modo leitura, sem possibilidade de edicao
4. **Given** uma avaliacao em rascunho, **When** o coordenador tenta finalizar sem todos os criterios e aptidao, **Then** o sistema exibe erro de validacao

---

### User Story 5 - Historico de avaliacoes na tela da Pessoa (Priority: P2)

Ao acessar a tela de detalhes de uma pessoa (/pessoas/:id), o usuario ADM ou ORG visualiza uma aba "Historico de Avaliacoes" junto com as outras abas de historicos existentes. Nesta aba, sao exibidas todas as avaliacoes da pessoa nas edicoes em que participou, ordenadas por data de atualizacao decrescente.

**Why this priority**: Permite que a organizacao acompanhe a evolucao de um equipista ao longo das edicoes, integrando avaliacoes ao perfil ja existente da pessoa.

**Independent Test**: Pode ser testado abrindo a tela de detalhes de uma pessoa que possui avaliacoes e verificando que a aba "Historico de Avaliacoes" exibe as avaliacoes corretas com todos os dados.

**Acceptance Scenarios**:

1. **Given** um usuario ADM/ORG na tela de detalhes de uma pessoa, **When** ele acessa a aba "Historico de Avaliacoes", **Then** sao exibidas todas as avaliacoes dessa pessoa em todas as edicoes, ordenadas por data de atualizacao decrescente
2. **Given** a aba "Historico de Avaliacoes" exibida, **When** o usuario visualiza uma avaliacao, **Then** sao exibidos: edicao, equipe, avaliador, status, data de atualizacao, todos os criterios, aptidao e comentarios
3. **Given** a aba "Historico de Avaliacoes" exibida, **When** a pessoa nao possui nenhuma avaliacao, **Then** o sistema exibe um estado vazio informando que nao ha avaliacoes registradas
4. **Given** avaliacoes de multiplas edicoes existentes, **When** o usuario visualiza a aba, **Then** as avaliacoes sao agrupadas ou ordenadas por edicao

---

### Edge Cases

- Cenarios de coordenador liderando mais de uma equipe ou equipista em mais de uma equipe nao occurrem — cada coordenador coordena exatamente uma equipe e cada equipista pertence a exatamente uma equipe por edicao
- O sistema deve impedir que o coordenador avalie a si mesmo — apenas equipistas da equipe sao listados
- Quando a participacao de um equipista e removida apos uma avaliacao ja ter sido iniciada, o equipista some da lista de avaliacao no link publico
- O sistema salva rascunhos automaticamente com debounce de 2 segundos, preservando dados mesmo com recarga da pagina
- Um equipista pode ter no maximo uma avaliacao por edicao (rascunho ou finalizada)
- Quando o link da edicao e revogado apos coordenadores ja terem iniciado avaliacoes, as avaliacoes permanecem no status em que estiverem
- O campo de comentarios tem limite de 4000 caracteres

## Requirements

### Functional Requirements

- **FR-001**: A tela de detalhes da edicao (/edicoes/:id) deve exibir uma secao de avaliacao com o link publico unico da edicao e a listagem de avaliacoes realizadas
- **FR-002**: A secao de avaliacao na tela da edicao deve exibir o link publico com acao de copiar para a area de transferencia
- **FR-003**: O link publico deve ser unico por edicao, gerado com token e controlado por status ativo/revogado
- **FR-004**: O link publico deve funcionar sem autenticacao, permitindo que qualquer pessoa o acesse
- **FR-005**: Ao abrir o link publico, o sistema deve apresentar um campo para o usuario informar o numero do cracha
- **FR-006**: O sistema deve validar que o cracha informado corresponde a uma pessoa que e coordenador na edicao daquele link
- **FR-007**: Se o cracha nao for valido ou a pessoa nao for coordenador, o sistema deve exibir mensagem de acesso negado sem revelar dados
- **FR-008**: Se for coordenador valido, o sistema deve determinar a equipe que ele coordena na edicao e exibir a saudacao "Ola, {nome}" seguida da lista dos equipistas dessa equipe
- **FR-009**: A lista de equipistas deve exibir o nome e um indicador visual do status da avaliacao (pendente/rascunho/finalizada) de cada equipista
- **FR-010**: Ao selecionar um equipista, o sistema deve abrir o formulario de avaliacao com os 6 criterios (Pontualidade, Dedicao, Companheirismo, Espiritualidade, Comprometimento, Uniforme)
- **FR-011**: Cada criterio deve oferecer 4 opcoes de avaliacao: Otimo, Bom, Regular, Ruim
- **FR-012**: O formulario deve incluir o campo "Apto a Coordenar?" com opcoes Sim e Nao
- **FR-013**: O formulario deve incluir o campo "Comentarios e Sugestoes" (texto livre, opcional)
- **FR-014**: O campo de comentarios deve ter limite de 4000 caracteres
- **FR-015**: O sistema deve salvar automaticamente o rascunho a cada alteracao de campo, com debounce de 2 segundos
- **FR-016**: Para finalizar a avaliacao, o sistema deve exigir que todos os 6 criterios tenham valor selecionado e que a aptidao esteja definida
- **FR-017**: Ao finalizar, o sistema deve solicitar confirmacao do usuario antes de alterar o status para "Finalizada"
- **FR-018**: Avaliacoes com status "Finalizada" devem ser imutaveis — nao podem ser editadas ou excluidas
- **FR-019**: Avaliacoes com status "Rascunho" podem ser editadas livremente
- **FR-020**: Um equipista deve ter no maximo uma avaliacao finalizada por edicao
- **FR-021**: Um equipista pode ter no maximo uma avaliacao por edicao (seja rascunho ou finalizada)
- **FR-022**: O sistema deve registrar automaticamente o avaliador (coordenador identificado via link), a equipe, a pessoa avaliada e a edicao
- **FR-023**: O sistema deve registrar data de criacao, data de atualizacao e data de finalizacao para cada avaliacao
- **FR-024**: Na secao de avaliacao da tela da edicao, ADM/ORG devem visualizar todas as avaliacoes da edicao com filtros por equipe, avaliador e status
- **FR-025**: Os detalhes de uma avaliacao devem exibir todos os criterios avaliados, aptidao, comentarios, avaliador, equipe, pessoa e datas
- **FR-026**: Avaliacoes finalizadas exibidas para ADM/ORG devem ser somente leitura
- **FR-027**: O link publico da edicao deve ser revogavel pela tela de detalhes da edicao (ADM/ORG)
- **FR-029**: Quando o link e revogado, avaliacoes em andamento (rascunho ou finalizadas) permanecem no status em que estiverem — nao sao afetadas pela revogacao
- **FR-030**: Quando a participacao de um equipista e removida, ele deve sumir da lista de avaliacao no link publico
- **FR-031**: Todos os textos de interface, mensagens e confirmacoes devem ser em PT-BR
- **FR-032**: A tela de detalhes da pessoa (/pessoas/:id) deve exibir uma aba "Historico de Avaliacoes" junto com as outras abas de historicos
- **FR-033**: A aba "Historico de Avaliacoes" deve exibir todas as avaliacoes da pessoa em todas as edicoes, ordenadas por data de atualizacao decrescente, com edicao, equipe, avaliador, status, criterios, aptidao e comentarios
- **FR-034**: Quando a pessoa nao possui avaliacoes, a aba deve exibir estado vazio informativo

### Key Entities

- **Avaliacao**: Registro da avaliacao de um equipista por um coordenador. Contem: pessoa avaliada, equipe, avaliador (coordenador), edicao, 6 criterios com valores (Otimo/Bom/Regular/Ruim), aptidao (Sim/Nao), comentarios, status (Rascunho/Finalizada) e datas (criacao, atualizacao, finalizacao). Uma pessoa pode ter no maximo uma avaliacao finalizada por edicao.
- **LinkAvaliacao**: Link de acesso publico para avaliacao, unico por edicao, com token e status ativo/revogado. Vinculado a uma edicao.
- **Equipe**: Equipe da edicao (entidade existente). Cada coordenador coordena exatamente uma equipe. Equipistas sao pessoas com participacao na mesma equipe do coordenador.
- **Pessoa**: Pessoa cadastrada com numero de cracha (entidade existente). Atua como avaliador (coordenador) ou avaliando (equipista) conforme a participacao.
- **Participacao**: Vinculo de uma pessoa a uma equipe da edicao com funcao (entidade existente). Define quem e coordenador e a qual equipe cada equipista pertence.
- **Edicao**: Edicao da festa (entidade existente). Contexto das avaliacoes; o link publico e unico por edicao.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Usuarios ADM/ORG conseguem copiar o link publico de avaliacao da edicao em ate 2 cliques a partir da tela de detalhes da edicao
- **SC-002**: Coordenadores conseguem acessar o formulario e avaliar o primeiro equipista em menos de 2 minutos a partir da abertura do link publico
- **SC-003**: 100% dos acessos por crachas de nao-coordenadores exibem mensagem de acesso negado sem revelar dados
- **SC-004**: Coordenadores conseguem salvar avaliacoes em rascunho e retoma-las posteriormente com todos os dados preservados
- **SC-005**: 100% das avaliacoes finalizadas possuem todos os 6 criterios preenchidos e aptidao definida
- **SC-006**: Avaliacoes finalizadas sao completamente imutaveis — nenhuma tentativa de edicao e bem-sucedida
- **SC-007**: Coordenadores conseguem avaliar todos os equipistas da equipe que coordena em um unico acesso ao link, sem necessidade de reautenticacao

## Assumptions

- Um coordenador e identificado pela participacao com funcao "Coordenador" na edicao; a equipe do coordenador e derivada da participacao com funcao Coordenador naquela edicao (cada coordenador coordena exatamente uma equipe)
- O link publico e unico por edicao e compartilhado entre todos os coordenadores daquela edicao
- Um equipista pertence a exatamente uma equipe por edicao e so pode ser avaliado pelo coordenador dessa equipe
- A secao de avaliacao e acessivel na tela de detalhes da edicao, visivel apenas para os perfis ADM e ORG
- As avaliacoes em rascunho sao salvas automaticamente com debounce de 2 segundos apos cada alteracao de campo
- Avaliacoes finalizadas sao definitivas na versao inicial; nao ha edicao ou exclusao de avaliacao finalizada
- O fluxo de avaliacao reutiliza os padroes de links publicos anonimos ja existentes na aplicacao (link publico com token, sem autenticacao)
- O campo "Apto a Coordenar?" e uma pergunta binaria (Sim/Nao), sem opcao "Nao se aplica" ou similar
- A ordem dos criterios na interface e fixa: Pontualidade, Dedicao, Companheirismo, Espiritualidade, Comprometimento, Uniforme
