# Feature Specification: Avaliacao de Coordenadores

**Feature Branch**: `027-avaliacao-coordenadores`

**Created**: 2026-08-29

**Status**: Draft

**Input**: User description: "Criar um novo processo de Avaliacao de Coordenadores. Devera ter um link publico: avaliacao/coordenadores/2026, quando o usuario fornecer o numero do cracha, o sistema deve verificar, alem da funcao coordenador, se a equipe dele possui equipe filhas e se a equipe nao esta na listagem de excecao cadastrada no parametro EquipesSemAvaliacao. Caso positivo, o sistema deve listar para avaliacao, os coordenadores dessas equipes filhas. Caso tenha mais de uma equipe filha, o sistema deve listar os coordenadores agrupados por equipe."

## Clarifications

### Session 2026-08-29

- Q: Qual e a regra de elegibilidade do avaliador no processo? → A: Somente coordenadores de equipes com "APOIO" no nome e com equipes filhas podem avaliar coordenadores (substitui a regra de excecao do parametro EquipesSemAvaliacao, descartada).
- Q: Quais sao os criterios de avaliacao do coordenador? → A: 6 questoes: (1) permanencia na funcao na proxima festa — Sim / Sim, com algumas ressalvas / Nao tenho certeza / Nao; (2) perfil de lideranca — Excelente / Bom / Regular / Pouco / Nao possui; e abertas (3) principal ponto positivo, (4) aspecto a melhorar, (5) situacao especifica a registrar e (6) recomendacao sobre permanencia ou mudanca.
- Q: Todas as perguntas sao obrigatorias para finalizar? → A: Sim, todas as 6; as respostas abertas (questoes 3 a 6) devem ter no minimo 20 caracteres.

## User Scenarios & Testing

### User Story 1 - Gerenciamento do link publico na tela da edicao (Priority: P1)

Um usuario ADM ou ORG, ao acessar a tela de detalhes de uma edicao (/edicoes/:id), visualiza uma secao "Avaliacao de Coordenadores" com o link publico do processo daquela edicao (no formato avaliacao/coordenadores/2026, onde 2026 e a referencia da edicao). O link pode ser copiado e enviado aos coordenadores e pode ser ativado ou revogado pela organizacao.

**Why this priority**: Sem o link publico os coordenadores nao tem como acessar o processo. E o ponto de entrada da feature, integrado a tela ja existente de gestao de edicoes.

**Independent Test**: Pode ser testado abrindo a tela de detalhes de uma edicao, verificando que a secao "Avaliacao de Coordenadores" exibe o link, que ele e copiavel e que e possivel revoga-lo.

**Acceptance Scenarios**:

1. **Given** um usuario ADM/ORG logado na tela de detalhes de uma edicao, **When** ele visualiza a secao "Avaliacao de Coordenadores", **Then** o link publico do processo da edicao e exibido com acao de copiar para a area de transferencia
2. **Given** a secao "Avaliacao de Coordenadores" aberta, **When** o usuario aciona a acao de copiar, **Then** o link publico da edicao e copiado para a area de transferencia
3. **Given** a secao "Avaliacao de Coordenadores" aberta, **When** o usuario revoga o link, **Then** o link deixa de ser acessivel publicamente
4. **Given** o link revogado, **When** o usuario reativa o link, **Then** o link volta a funcionar publicamente

---

### User Story 2 - Identificacao do coordenador pelo link publico (Priority: P1)

Um coordenador recebe o link publico da edicao, abre a pagina e informa o numero do proprio cracha. O sistema verifica se a pessoa vinculada ao cracha e coordenadora na edicao daquele link, se a equipe que ela coordena possui o texto "APOIO" no nome e se essa equipe possui equipes filhas. Se todas as condicoes forem satisfeitas, o sistema cumprimenta o coordenador e mostra a listagem de avaliacao. Caso contrario, exibe mensagem de acesso negado sem revelar dados.

**Why this priority**: E a porta de entrada do fluxo — sem a validacao em tres etapas (funcao coordenador, equipe com "APOIO" no nome e equipe com filhas) nao se sabe quais coordenadores tem direito a avaliar.

**Independent Test**: Pode ser testado abrindo o link publico em janela anonima e informando o cracha de (1) coordenador de equipe com "APOIO" no nome e com filhas — recebe a listagem; (2) coordenador de equipe sem filhas — recebe acesso negado; (3) coordenador de equipe sem "APOIO" no nome — recebe acesso negado; (4) pessoa que nao e coordenadora ou cracha inexistente — recebe acesso negado.

**Acceptance Scenarios**:

1. **Given** o link publico da edicao aberto, **When** o usuario informa o cracha de uma pessoa que e coordenadora na edicao, cuja equipe possui "APOIO" no nome e possui equipes filhas, **Then** o sistema exibe a saudacao "Ola, {nome do coordenador}" e a listagem de avaliacao dos coordenadores das equipes filhas
2. **Given** o link publico da edicao aberto, **When** o usuario informa um cracha inexistente, **Then** o sistema exibe mensagem de acesso negado sem revelar dados
3. **Given** o link publico da edicao aberto, **When** o usuario informa o cracha de uma pessoa que nao e coordenadora na edicao, **Then** o sistema exibe mensagem de acesso negado sem revelar dados
4. **Given** o link publico da edicao aberto, **When** o coordenador informa o cracha mas a equipe que ele coordena nao possui equipes filhas, **Then** o sistema exibe mensagem de acesso negado sem revelar dados
5. **Given** o link publico da edicao aberto, **When** o coordenador informa o cracha mas a equipe que ele coordena nao possui "APOIO" no nome, **Then** o sistema exibe mensagem de acesso negado sem revelar dados
6. **Given** um link publico invalido ou revogado, **When** o usuario o abre, **Then** o sistema exibe mensagem de link invalido

---

### User Story 3 - Listagem dos coordenadores das equipes filhas (Priority: P1)

Apos se identificar, o coordenador visualiza a lista de coordenadores a avaliar, oriundos das equipes filhas da equipe que ele coordena. Quando a equipe dele possui apenas uma equipe filha, os coordenadores dessa equipe sao exibidos em uma lista unica. Quando possui mais de uma equipe filha, os coordenadores sao exibidos agrupados por equipe filha, com o nome de cada equipe como agrupador. Cada coordenador ja avaliado e marcado visualmente conforme o status da avaliacao (pendente/rascunho/finalizada).

**Why this priority**: E o nucleo da delimitacao do processo — garante que o coordenador avalia somente os coordenadores das equipes subordinadas a equipe dele, organizados de forma legivel quando ha mais de uma equipe.

**Independent Test**: Pode ser testado com um coordenador cuja equipe tem duas equipes filhas com coordenadores alocados. Ao se identificar, as duas equipes aparecem como agrupadores e os coordenadores corretos aparecem sob cada uma.

**Acceptance Scenarios**:

1. **Given** um coordenador identificado na pagina de avaliacao, **When** a equipe dele possui uma unica equipe filha, **Then** o sistema exibe os coordenadores dessa equipe filha em uma lista unica, sem agrupamento
2. **Given** um coordenador identificado na pagina de avaliacao, **When** a equipe dele possui mais de uma equipe filha, **Then** o sistema exibe os coordenadores agrupados por equipe filha, com o nome de cada equipe como titulo do grupo
3. **Given** a listagem de coordenadores exibida, **When** o coordenador visualiza cada alvo, **Then** sao exibidos o nome e um indicador visual do status da avaliacao (pendente/rascunho/finalizada)
4. **Given** a listagem de coordenadores exibida, **When** uma equipe filha nao possui coordenador alocado, **Then** essa equipe nao gera alvos na listagem
5. **Given** a listagem de coordenadores exibida, **When** mais de uma equipe filha possuir coordenadores, **Then** o agrupamento preserva a ordem e a separacao visual entre as equipes

---

### User Story 4 - Preenchimento e salvamento da avaliacao (Priority: P2)

Ao selecionar um coordenador da listagem, o coordenador avaliador preenche o formulario de avaliacao com as 6 questoes do questionario (2 fechadas e 4 abertas). O sistema salva automaticamente o rascunho a cada alteracao (com debounce de 2 segundos) e permite finalizar a avaliacao apos responder todas as 6 questoes (obrigatorias), solicitando confirmacao. Avaliacoes finalizadas sao imutaveis; rascunhos podem ser retomados e editados.

**Why this priority**: E o objetivo do processo — registrar a avaliacao dos coordenadores. Uma vez que a listagem esta disponivel, e essencial o fluxo confiavel de preenchimento.

**Independent Test**: Pode ser testado selecionando um coordenador-alvo, preenchendo o formulario, verificando o salvamento automatico do rascunho ao recarregar a pagina e finalizando a avaliacao com confirmacao. Apos finalizada, nova tentativa de edicao deve exibir modo somente leitura.

**Acceptance Scenarios**:

1. **Given** a listagem de coordenadores exibida, **When** o coordenador seleciona um alvo pendente, **Then** o formulario de avaliacao abre com todos os campos vazios
2. **Given** o formulario aberto, **When** o coordenador seleciona um valor para as questoes 1 e 2 (permanencia na funcao e perfil de lideranca), **Then** o sistema registra cada resposta
3. **Given** o formulario aberto, **When** o coordenador preenche as respostas abertas (questoes 3 a 6), **Then** o sistema armazena o texto informado
4. **Given** o formulario sendo preenchido, **When** qualquer campo e alterado, **Then** o sistema salva automaticamente o rascunho com debounce de 2 segundos
5. **Given** o formulario com todas as 6 questoes respondidas, **When** o coordenador aciona FINALIZAR, **Then** o sistema solicita confirmacao e, confirmado, registra a avaliacao como "Finalizada"
6. **Given** uma avaliacao com qualquer questao nao respondida ou resposta aberta inferior a 20 caracteres, **When** o coordenador tenta finalizar, **Then** o sistema exibe mensagem informando que todas as 6 questoes sao obrigatorias e que as respostas abertas exigem no minimo 20 caracteres
7. **Given** uma avaliacao em rascunho existente, **When** o coordenador seleciona o mesmo alvo novamente, **Then** o formulario abre com os dados previamente salvos
8. **Given** uma avaliacao finalizada, **When** o coordenador seleciona o mesmo alvo novamente, **Then** os dados sao exibidos em modo leitura, sem possibilidade de edicao

---

### User Story 5 - Acompanhamento das avaliacoes pela organizacao (Priority: P2)

Na secao "Avaliacao de Coordenadores" da tela de detalhes da edicao, o usuario ADM ou ORG visualiza a listagem das avaliacoes de coordenadores realizadas na edicao, com filtros por equipe, avaliador e status, alem da possibilidade de visualizar os detalhes de cada avaliacao em modo leitura.

**Why this priority**: Permite a organizacao acompanhar o andamento do processo e revisar as avaliacoes sem depender do fluxo publico.

**Independent Test**: Pode ser testado abrindo a tela de detalhes de uma edicao com avaliacoes de coordenadores registradas e aplicando filtros por equipe, avaliador e status, verificando que apenas as avaliacoes correspondentes sao exibidas.

**Acceptance Scenarios**:

1. **Given** a secao "Avaliacao de Coordenadores" da edicao aberta, **When** o usuario visualiza a listagem, **Then** sao exibidas todas as avaliacoes de coordenadores da edicao com filtros por equipe, avaliador e status
2. **Given** avaliacoes existentes na edicao, **When** o usuario aplica filtro por equipe, **Then** apenas avaliacoes da equipe selecionada sao exibidas
3. **Given** avaliacoes existentes na edicao, **When** o usuario aplica filtro por status (Rascunho/Finalizada), **Then** apenas avaliacoes com o status selecionado sao exibidas
4. **Given** a listagem de avaliacoes, **When** o usuario seleciona uma avaliacao, **Then** os detalhes completos sao exibidos em modo leitura, incluindo as 6 questoes com as respostas (2 fechadas e 4 abertas), avaliador, coordenador avaliado, equipes envolvidas, edicao e datas

---

### Edge Cases

- Cracha inexistente, pessoa que nao e coordenadora na edicao, equipe sem "APOIO" no nome e equipe sem equipes filhas resultam na mesma mensagem generica de acesso negado, sem revelar dados
- Um coordenador pode coordenar mais de uma equipe na edicao; a regra de acesso e avaliada para cada equipe que ele coordena (a equipe precisa ter "APOIO" no nome e possuir filhas)
- Quando a equipe do coordenador possui mais de uma equipe filha, os alvos sao agrupados por equipe filha; quando possui apenas uma, nao ha agrupamento
- Equipe filha sem coordenador alocado nao gera alvos na listagem
- O coordenador avaliador nao pode avaliar a si mesmo; se ele tambem coordenar uma equipe filha de si mesmo, ele nao aparece na propria listagem
- Mudancas na hierarquia (equipe filha criada, removida ou sem coordenador) refletem na listagem no momento do acesso
- Quando a equipe do coordenador deixa de possuir "APOIO" no nome apos o inicio de avaliacoes, as avaliacoes ja iniciadas permanecem no status em que estiverem
- Quando o link e revogado apos avaliacoes iniciadas, as avaliacoes permanecem no status em que estiverem — nao sao afetadas pela revogacao
- Um coordenador-alvo pode ter no maximo uma avaliacao (rascunho ou finalizada) por edicao, feita pelo coordenador da equipe-pai
- Se o alvo deixar de ser coordenador da equipe filha apos a avaliacao iniciada, a avaliacao existente permanece como esta

## Requirements

### Functional Requirements

- **FR-001**: A tela de detalhes da edicao (/edicoes/:id) deve exibir uma secao "Avaliacao de Coordenadores" com o link publico do processo e a listagem das avaliacoes realizadas
- **FR-002**: O link publico deve seguir o formato avaliacao/coordenadores/2026, onde 2026 e a referencia da edicao, e deve ser unico por edicao
- **FR-003**: O link publico deve ter controle de ativo/revogado, gerenciavel pela tela de detalhes da edicao
- **FR-004**: O link publico deve funcionar sem autenticacao, permitindo que qualquer pessoa o acesse
- **FR-005**: Ao abrir o link publico, o sistema deve apresentar um campo para o usuario informar o numero do cracha
- **FR-006**: O sistema deve validar que o cracha informado corresponde a uma pessoa que e coordenadora na edicao daquele link
- **FR-007**: O sistema deve verificar que a equipe coordenada pela pessoa possui ao menos uma equipe filha na edicao
- **FR-008**: O sistema deve verificar que a equipe coordenada pela pessoa possui o texto "APOIO" no nome
- **FR-009**: Se qualquer condicao (funcao coordenador, equipe com "APOIO" no nome ou equipe com filhas) nao for satisfeita, o sistema deve exibir mensagem de acesso negado sem revelar dados
- **FR-010**: Em caso de sucesso, o sistema deve exibir a saudacao "Ola, {nome do coordenador}" e listar para avaliacao os coordenadores das equipes filhas da equipe dele
- **FR-011**: Quando a equipe do coordenador possuir mais de uma equipe filha, o sistema deve exibir os coordenadores agrupados por equipe filha
- **FR-012**: Quando a equipe do coordenador possuir apenas uma equipe filha, o sistema deve exibir os coordenadores em uma lista unica, sem agrupamento
- **FR-013**: Equipes filhas sem coordenador alocado nao devem gerar alvos na listagem
- **FR-014**: Cada coordenador listado deve exibir o nome e um indicador visual do status da avaliacao (pendente/rascunho/finalizada)
- **FR-015**: Ao selecionar um coordenador pendente, o sistema deve abrir o formulario de avaliacao com todos os campos vazios
- **FR-016**: O formulario deve conter 6 questoes: (1) "Voce considera que este coordenador deve permanecer na funcao na proxima festa?" com opcoes Sim / Sim, com algumas ressalvas / Nao tenho certeza / Nao; (2) "Voce considera que este coordenador possui perfil de lideranca?" com opcoes Excelente / Bom / Regular / Pouco / Nao possui; e as questoes abertas (3) "Qual e o principal ponto positivo deste coordenador?", (4) "Qual aspecto este coordenador precisa melhorar?", (5) "Houve alguma situacao especifica que merece ser registrada?" e (6) "Ha alguma recomendacao sobre a permanencia ou mudanca deste coordenador?"
- **FR-017**: O sistema deve salvar automaticamente o rascunho a cada alteracao de campo, com debounce de 2 segundos
- **FR-018**: Para finalizar, o sistema deve exigir que todas as 6 questoes estejam respondidas, sendo as respostas abertas (questoes 3 a 6) com no minimo 20 caracteres
- **FR-019**: Ao finalizar, o sistema deve solicitar confirmacao antes de alterar o status para "Finalizada"
- **FR-020**: Avaliacoes com status "Finalizada" devem ser imutaveis — nao podem ser editadas ou excluidas
- **FR-021**: Avaliacoes com status "Rascunho" podem ser editadas e retomadas com os dados preservados
- **FR-022**: Um coordenador-alvo deve ter no maximo uma avaliacao por edicao (rascunho ou finalizada) feita pelo coordenador da equipe-pai
- **FR-023**: O sistema deve impedir que o coordenador avaliador avalie a si mesmo
- **FR-024**: O sistema deve registrar automaticamente o avaliador (coordenador identificado), o coordenador avaliado, a equipe filha, a equipe do avaliador, a edicao, as respostas do questionario e as datas de criacao, atualizacao e finalizacao
- **FR-025**: Quando a equipe do coordenador deixar de possuir "APOIO" no nome, avaliacoes ja iniciadas devem permanecer no status em que estiverem
- **FR-026**: Quando o link for revogado, avaliacoes em andamento devem permanecer no status em que estiverem — nao afetadas pela revogacao
- **FR-027**: Na secao "Avaliacao de Coordenadores" da edicao, ADM/ORG devem visualizar todas as avaliacoes de coordenadores da edicao com filtros por equipe, avaliador e status
- **FR-028**: Os detalhes de uma avaliacao de coordenador devem exibir as 6 questoes com as respostas (2 fechadas e 4 abertas), avaliador, coordenador avaliado, equipes envolvidas, edicao e datas, em modo leitura para ADM/ORG
- **FR-029**: Todos os textos de interface, mensagens e confirmacoes devem ser em PT-BR

### Key Entities

- **AvaliacaoCoordenador**: Registro da avaliacao de um coordenador (da equipe filha) pelo coordenador da equipe-pai. Contem: coordenador avaliado, avaliador, equipe filha, equipe do avaliador, edicao, respostas do questionario (2 questoes fechadas e 4 abertas), status (Rascunho/Finalizada) e datas. No maximo uma avaliacao por alvo por edicao.
- **LinkAvaliacaoCoordenador**: Link de acesso publico do processo, unico por edicao (formato avaliacao/coordenadores/{referencia}), com controle de status ativo/revogado.
- **Equipe**: Entidade existente com hierarquia (equipe pai/filha). A relacao "equipe filha" define quais coordenadores sao alvos da avaliacao.
- **Participacao**: Vinculo de uma pessoa a uma equipe da edicao com funcao (existente). Identifica quem e coordenador na edicao (avaliador e alvos) e a qual equipe pertence.
- **Pessoa**: Entidade existente com numero de cracha. Identifica avaliador e alvos no fluxo publico.
- **Edicao**: Entidade existente. Referencia do link publico (2026) e contexto de todas as avaliacoes do processo.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Usuarios ADM/ORG conseguem copiar o link publico do processo em ate 2 cliques a partir da tela de detalhes da edicao
- **SC-002**: Coordenadores elegiveis conseguem chegar a listagem de avaliacao em menos de 1 minuto a partir da abertura do link publico
- **SC-003**: 100% dos acesso por crachas que nao atendem as condicoes (nao-coordenador, equipe sem "APOIO" no nome ou equipe sem filhas) exibem a mesma mensagem de acesso negado, sem revelar dados
- **SC-004**: 100% dos casos com mais de uma equipe filha exibem os coordenadores agrupados por equipe
- **SC-005**: Em 100% dos casos, somente coordenadores de equipes com "APOIO" no nome e com equipes filhas acessam a listagem, e a lista contem somente os coordenadores dessas equipes filhas
- **SC-006**: Coordenadores avaliadores conseguem salvar rascunhos e retoma-los com todos os dados preservados; 100% das avaliacoes finalizadas possuem todas as 6 questoes respondidas, com respostas abertas (questoes 3 a 6) de no minimo 20 caracteres, e sao imutaveis
- **SC-007**: A organizacao consegue consultar todas as avaliacoes de coordenadores da edicao com filtros por equipe, avaliador e status em um unico local

## Assumptions

- A referencia "2026" no link publico identifica a edicao alvo; cada edicao possui o proprio link no formato avaliacao/coordenadores/{referencia da edicao}
- O processo segue o mesmo padrao de links publicos anonimos ja existentes na aplicacao (link publico unico por edicao, sem autenticacao, com controle de ativo/revogado)
- Um coordenador e identificado pela participacao com funcao "Coordenador" na edicao; a equipe dele e derivada dessa participacao
- Um coordenador pode coordenar mais de uma equipe na edicao; a regra de acesso (equipe com "APOIO" no nome e com filhas) e avaliada para cada equipe que ele coordena
- Somente a equipe cujo nome contem o texto "APOIO" habilita o coordenador a avaliar (correspondencia por subtexto no nome da equipe); a verificacao aplica-se a equipe coordenada pelo avaliador, nao as equipes filhas
- "Equipe filha" e definida pela hierarquia de equipes ja existente no organograma da edicao (equipe subordinada a outra equipe)
- Cada equipe filha possui no maximo uma equipe-pai na edicao
- Calculada a lista de alvos, o fluxo de preenchimento reutiliza o padrao da avaliacao ja existente: salvamento automatico de rascunho com debounce de 2 segundos, finalizacao com confirmacao, rascunho editavel e finalizada imutavel
- O formulario reutiliza os mesmos padroes de interacao da avaliacao existente (salvamento automatico de rascunho, finalizacao com confirmacao, rascunho editavel e finalizada imutavel), mas com questionario proprio: 6 questoes fixas (2 fechadas e 4 abertas), todas obrigatorias para finalizar; as respostas abertas (questoes 3 a 6) exigem no minimo 20 caracteres e respeitam um limite de caracteres alinhado aos campos textuais ja existentes
- Equipes filhas sem coordenador alocado sao omitidas da listagem de avaliacao
- A secao de gerenciamento do link e das avaliacoes e acessivel na tela de detalhes da edicao, visivel apenas para os perfis ADM e ORG
- O acompanhamento das avaliacoes pela organizacao fica restrito a secao da edicao na versao inicial; historico agrupado por pessoa nao faz parte desta entrega