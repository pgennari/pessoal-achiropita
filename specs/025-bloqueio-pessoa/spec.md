# Feature Specification: Bloqueio de Pessoas (equipistas)

**Feature Branch**: `025-bloqueio-pessoa`

**Created**: 2026-08-29

**Status**: Draft

**Input**: User description: "### Bloqueio Equipista — No detalhe da Pessoa, criar um botão para bloquear a pessoa. Ao clicar, o sistema deve abrir um modal bem chamativo (titulo 'Bloqueio de Pessoa', alerta, textarea de motivo com minimo de 100 caracteres, box de aprovadores informando que serao necessarios 2 aprovadores). No box de aprovadores, ja trazer o nome do usuario atual e o espaco mostrando onde vai aparecer a segunda aprovacao. Apos confirmar, salvar a pessoa em uma tabela de bloqueio com justificativa e aprovacoes. No menu, criar uma subsecao 'Bloqueios' dentro da secao 'Pessoas'. Para desbloquear tambem e preciso de 2 aprovacoes e justificativa registrada. No detalhe da Pessoa, a justificativa de bloqueio deve aparecer bem chamativa acima do box de dados. O historico de bloqueios e desbloqueios deve aparecer em uma aba nova no box Exclusivo para uso do Pessoal."

## Clarifications

### Session 2026-08-29

- Q: Ao transformar o modal do bloqueio em pagina, qual escopo cobrir? A: Novo bloqueio E desbloqueio — ambos os fluxos (criar bloqueio e iniciar desbloqueio) viram paginas dedicadas; a aprovacao como 2o aprovador permanece na tela Bloqueios / detalhe da Pessoa
- Q: Em quais rotas ficam as novas paginas? A: Nested sob o detalhe da Pessoa — `/pessoas/:id/bloquear` e `/pessoas/:id/desbloquear`, acessadas via botao no detalhe (e link a partir da tela Bloqueios)
- Q: Apos confirmar o pedido, para onde o sistema leva o usuario? A: Redireciona para a tela Bloqueios (menu Pessoas) para ver o pedido pendente na lista

## User Scenarios & Testing

### User Story 1 - Pessoa e bloqueada com dupla aprovacao (Priority: P1)

Um usuario da equipe de Pessoal abre o detalhe de uma pessoa e clica no botao "Bloquear", que navega para a nova pagina `/pessoas/:id/bloquear`. A pagina apresenta o titulo "Bloqueio de Pessoa", um alerta explicando a responsabilidade da funcao, um campo de texto para o motivo e um box que informa que serao necessarios 2 aprovadores. O usuario preenche um motivo detalhado (minimo de 100 caracteres) e confirma; o proprio nome ja aparece como 1o aprovador e um espaco reservado indica onde aparecera a 2a aprovacao. Ao confirmar, o sistema salva o registro como bloqueio pendente e redireciona para a tela Bloqueios. Um segundo usuario da equipe de Pessoal acessa a pessoa (ou a tela de Bloqueios), confirma a justificativa e aprova como 2o aprovador. Com as duas aprovacoes, o bloqueio fica ativo e a pessoa passa a ser identificada como bloqueada em todo o sistema.

**Why this priority**: E o fluxo principal da feature — sem a capacidade de registrar o bloqueio com as duas aprovacoes, nada mais funciona.

**Independent Test**: Pode ser testado abrindo o detalhe de uma pessoa, clicando em "Bloquear", preenchendo um motivo com mais de 100 caracteres, confirmando e, em seguida, aprovando o pedido com um segundo usuario; a pessoa deve aparecer como bloqueada.

**Acceptance Scenarios**:

1. **Given** uma pessoa nao bloqueada exibida no detalhe, **When** um usuario autorizado clica em "Bloquear", **Then** o sistema navega para a pagina `/pessoas/:id/bloquear`, bem chamativa, com titulo "Bloqueio de Pessoa", alerta, campo de motivo e box de aprovadores
2. **Given** a pagina de bloqueio aberta, **When** o usuario tenta confirmar com motivo menor que 100 caracteres, **Then** o sistema impede o envio e indica que o motivo precisa ter ao menos 100 caracteres
3. **Given** a pagina de bloqueio exibida, **Then** o nome do usuario atual ja aparece como 1o aprovador e ha um espaco reservado (vazio/inativo) mostrando onde aparecera a 2a aprovacao
4. **Given** a pagina de bloqueio confirmada com sucesso, **Then** o sistema salva o registro do bloqueio com status pendente, a justificativa e a 1a aprovacao (usuario atual) e redireciona para a tela Bloqueios; a pessoa ainda nao e considerada bloqueada
5. **Given** um bloqueio pendente com 1 aprovacao, **When** um segundo usuario autorizado confirma a justificativa e aprova, **Then** o bloqueio passa a ativo e a pessoa fica visivelmente bloqueada no sistema

---

### User Story 2 - Excesso: bloqueio com um unico aprovador nunca se ativa (Priority: P1)

A solidao da dupla aprovacao e o que torna o bloqueio confiavel: enquanto nao houver dois aprovadores distintos, o bloqueio permanece pendente e a pessoa continua livre. O mesmo usuario que criou o pedido nunca pode ser tambem o 2o aprovador. Um pedido pendente nunca se completa sozinho.

**Why this priority**: A regra de seguranca de "2 aprovadores distintos" e central para a confianca no recurso — basta um furo aqui para o bloqueio perder o sentido.

**Independent Test**: Pode ser testado criando um bloqueio pendente e verificando que: ele nao fica ativo sozinho; o 1o aprovador nao consegue aprovar novamente como 2o; apenas um segundo usuario distinto completa a aprovacao.

**Acceptance Scenarios**:

1. **Given** um bloqueio pendente com 1 aprovacao, **When** passa o tempo sem nova aprovacao, **Then** o bloqueio permanece pendente e a pessoa continua nao bloqueada
2. **Given** o 1o aprovador tentando aprovar o proprio pedido, **Then** o sistema recusa e nao conta como 2a aprovacao
3. **Given** um pedido pendente, **When** dois usuarios tentam aprovar ao mesmo tempo, **Then** apenas a primeira aprovacao valida vence e a outra e tratada como "ja aprovado"
4. **Given** um bloqueio ja ativo, **When** alguem tenta criar novo pedido de bloqueio para a mesma pessoa, **Then** o sistema impede, pois a pessoa ja esta bloqueada

---

### User Story 3 - Navegacao em Bloqueios: pendentes e bloqueados (Priority: P2)

No menu, dentro da secao "Pessoas", o usuario encontra a subsecao "Bloqueios". A tela mostra duas situacoes: pessoas com bloqueio pendente de aprovacao e pessoas ja bloqueadas. Nela, o usuario pode aprovar pedidos pendentes (como 2o aprovador) e iniciar o desbloqueio de pessoas bloqueadas. Pessoas bloqueadas aparecem destacadas, com a justificativa legivel.

**Why this priority**: E a tela central de operacao da equipe de Pessoal, onde se cuida das aprovacoes e se decide quem nao deve ser chamado.

**Independent Test**: Pode ser testado criando um bloqueio pendente e um bloqueio ativo e conferindo que ambos aparecem na tela Bloqueios com identificacao clara e acoes disponiveis.

**Acceptance Scenarios**:

1. **Given** o menu do sistema, **Then** existe a secao "Pessoas" com a subsecao "Bloqueios"
2. **Given** a tela Bloqueios, **Then** pedidos pendentes e pessoas bloqueadas aparecem em listagens/abas claramente distintas
3. **Given** um bloqueio pendente na tela Bloqueios, **When** um usuario autorizado diferente do 1o aprovador aprova, **Then** o bloqueio se ativa e sai da lista de pendentes para a lista de bloqueados
4. **Given** uma pessoa bloqueada na tela Bloqueios, **Then** a justificativa do bloqueio fica visivel e ha a acao de desbloquear

---

### User Story 4 - Desbloqueio com dupla aprovacao e justificativa registrada (Priority: P2)

Para desbloquear uma pessoa, o usuario autorizado navega para a pagina `/pessoas/:id/desbloquear` e inicia o desbloqueio justificando o motivo. Como no bloqueio, o solicitante e a 1a aprovacao e e preciso um segundo aprovador distinto. O motivo do desbloqueio fica registrado para sempre, junto das duas aprovacoes. Enquanto nao ha as duas aprovacoes, a pessoa permanece bloqueada. O acesso a pagina de desbloqueio parte de uma pessoa bloqueada (detalhe da Pessoa ou tela Bloqueios).

**Why this priority**: Garante que o desbloqueio tenha a mesma seriedade do bloqueio, com rastro completo do que foi decidido e por quem.

**Independent Test**: Pode ser testado iniciando um desbloqueio em uma pessoa bloqueada, confirmando com dois aprovadores distintos e verificando que a pessoa volta a ficar livre e que o motivo e as aprovacoes ficam registrados no historico.

**Acceptance Scenarios**:

1. **Given** uma pessoa bloqueada, **When** um usuario autorizado inicia o desbloqueio, **Then** o sistema exige uma justificativa obrigatoria antes de registrar a solicitacao
2. **Given** uma solicitacao de desbloqueio com 1 aprovacao, **When** um segundo usuario autorizado confirma, **Then** a pessoa deixa de ser bloqueada e o evento fica registrado
3. **Given** uma solicitacao de desbloqueio com apenas 1 aprovacao, **Then** a pessoa permanece bloqueada ate a 2a aprovacao
4. **Given** o desbloqueio concluido, **Then** o historico exibe quem o solicitou, os dois aprovadores, a justificativa e a data

---

### User Story 5 - Bloqueio visualmente forte no detalhe da Pessoa (Priority: P2)

No detalhe da pessoa, acima do box que traz os dados dela, aparece um aviso bem chamativo quando a pessoa esta bloqueada, com a justificativa completa e legivel. Se ha apenas um bloqueio pendente, um aviso distinto informa essa pendencia. Em toda a navegacao — detalhe, listagens, telas de equipe e seletores de pessoa — a pessoa bloqueada recebe destaque visual claro, para que quem consulta entenda na hora, sem procurar, que aquela pessoa nao deve ser chamada para a Festa e por qual motivo.

**Why this priority**: E a forma mais forte de "identificacao" no dia a dia — quem consulta a pessoa precisa ver o bloqueio sem esforco.

**Independent Test**: Pode ser testado abrindo o detalhe de uma pessoa bloqueada e conferindo que o aviso chamativo acima dos dados mostra a justificativa; repetir com uma pessoa com pedido pendente.

**Acceptance Scenarios**:

1. **Given** o detalhe de uma pessoa bloqueada, **Then** um aviso bem chamativo aparece acima do box de dados com a justificativa do bloqueio
2. **Given** o detalhe de uma pessoa com bloqueio pendente, **Then** um aviso claro informa o status pendente e a justificativa registrada
3. **Given** uma pessoa nao bloqueada, **Then** nenhum aviso de bloqueio aparece no detalhe
4. **Given** uma pessoa bloqueada, **When** um usuario navega por listagens, telas de equipe ou seletores de pessoa, **Then** a pessoa aparece destacada como bloqueada

---

### User Story 6 - Historico de bloqueios e desbloqueios na aba do box Pessoal (Priority: P3)

Dentro do box "Exclusivo para uso do Pessoal" no detalhe da Pessoa, uma nova aba apresenta a linha do tempo completa de bloqueios e desbloqueios daquela pessoa: cada evento com tipo (bloqueio/desbloqueio), justificativa, aprovadores e data. Nada e apagado; a aba funciona como o rastro oficial de decisoes sobre a pessoa.

**Why this priority**: Fecha o ciclo de transparencia e auditoria da feature, mas nao bloqueia o uso do recurso.

**Independent Test**: Pode ser testado bloqueando e desbloqueando uma pessoa e conferindo que a aba do box Pessoal mostra os dois eventos com dados completos.

**Acceptance Scenarios**:

1. **Given** o detalhe de uma pessoa com historico de bloqueios, **Then** o box "Exclusivo para uso do Pessoal" possui uma aba "Bloqueios" listando os eventos em ordem cronologica
2. **Given** a aba Bloqueios aberta, **Then** cada evento informa tipo, justificativa, aprovadores e data
3. **Given** eventos de bloqueio e desbloqueio registrados, **Then** todos aparecem na aba, sem perda de nenhum registro

---

### User Story 7 - Pessoa bloqueada nao pode ser chamada, convidada nem alocada (Priority: P2)

Alem de identificada, a pessoa bloqueada fica inutilizavel nos fluxos de chamada: em qualquer fluxo que chame, convide ou aloque pessoas — montagem de equipes, alocacao/movimentacao, convites — a pessoa bloqueada nao pode ser selecionada. Quando alguem tenta inclui-la, o sistema impede a acao com um aviso claro de que a pessoa esta bloqueada, e o usuario responsavel entende o motivo. Assim, o proposito "nao chamar mais essa pessoa para a Festa" passa a ser garantido pelo proprio sistema, e nao apenas pela boa vontade de quem consulta.

**Why this priority**: E o fechamento do proposito declarado no alerta — sem essa restricao, a pessoa ainda poderia ser chamada por engano em telas que a escolhem.

**Independent Test**: Pode ser testado bloqueando uma pessoa e tentando inclui-la em fluxos de montagem de equipes, alocacao/movimentacao e convites, verificando que a selecao e impedida com aviso do motivo.

**Acceptance Scenarios**:

1. **Given** uma pessoa bloqueada, **When** um usuario tenta seleciona-la em um fluxo de montagem de equipes, **Then** o sistema impede a selecao e exibe um aviso informando que ela esta bloqueada
2. **Given** uma pessoa bloqueada, **When** um usuario tenta aloca-la ou move-la para uma equipe, **Then** o sistema tambem impede a acao, com o mesmo tipo de aviso
3. **Given** uma pessoa bloqueada, **When** o usuario pesquisa/filtra pessoas para convidar, **Then** a pessoa ou aparece marcada como bloqueada (nao selecionavel) ou nao e oferecida entre as opcoes
4. **Given** uma pessoa ja alocada que recebe um bloqueio ativo, **Then** ela permanece onde esta (sem desalocacao automatica), mas passa a ficar proibida de novas chamadas/alocacoes e marcada nos fluxos

---

### Edge Cases

- O que acontece se o motivo tem menos de 100 caracteres? O sistema bloqueia o envio e indica o minimo
- O que acontece se o mesmo usuario tenta ser o 2o aprovador do proprio pedido? A aprovacao e recusada
- O que acontece se dois usuarios aprovam o mesmo pedido pendente ao mesmo tempo? Apenas a primeira aprovacao vale; a segunda e tratada como "ja aprovado"
- O que acontece se alguem abre a pagina de bloqueio (`/pessoas/:id/bloquear`) para uma pessoa ja bloqueada? O sistema nao permite novo bloqueio; apenas desbloqueio (redireciona/nega o acesso)
- O que acontece se alguem acessa diretamente a URL `/pessoas/:id/desbloquear` de uma pessoa nao bloqueada? O acesso e negado/redirecionado, pois nao ha bloqueio a desfazer
- O que acontece ao confirmar um pedido de bloqueio/desbloqueio nas novas paginas? O sistema salva o pedido e redireciona para a tela Bloqueios
- O que acontece com a pessoa bloqueada nas listagens (Pessoas, Bloqueios, relatorios)? Ela fica destacada/identificada como bloqueada, para quem decidir chamadas nao a convidar
- O que acontece se um pedido pendente nunca recebe a 2a aprovacao? A pessoa permanece nao bloqueada e o pedido continua pendente na tela Bloqueios
- O que acontece ao desbloquear uma pessoa que nunca foi bloqueada? O sistema nao oferece essa acao
- O que acontece se o usuario responsavel pelo pedido deixa de ter acesso? O pedido continua valido e aguardando a 2a aprovacao de outro usuario autorizado
- O que acontece se a justificativa contem apenas espacos ou caracteres repetidos? O sistema valida que ha conteudo real e suficiente (contagem de caracteres visiveis)
- O que acontece se a pessoa bloqueada e editada/cadastrada com novos dados? A pessoa permanece bloqueada; o bloqueio e independente dos dados do cadastro
- O que acontece se alguem tenta selecionar uma pessoa bloqueada em um seletor de equipe/alocacao? A selecao e impedida com aviso do motivo
- O que acontece com a pessoa ja alocada quando recebe bloqueio ativo? Ela nao e desalocada automaticamente; passa a nao poder ser movida nem re-alocada e aparece destacada
- O que acontece se um pedido de bloqueio esta pendente e alguem tenta alocar a pessoa? Enquanto pendente a pessoa ainda nao e considerada bloqueada, entao fluxos de selecao seguem permitidos para ela
- O que acontece se uma pessoa bloqueada aparece em uma busca que lista pessoas para convite? Ela e marcada como bloqueada (nao selecionavel) ou nao e oferecida entre as opcoes

## Requirements

### Functional Requirements

- **FR-001**: O sistema deve exibir um botao "Bloquear" no detalhe da Pessoa e tornar a acao visivel somente para usuarios autorizados da area Pessoal; ao clicar, o sistema navega para a pagina `/pessoas/:id/bloquear`
- **FR-002**: A pagina `/pessoas/:id/bloquear` deve ser bem chamativa, com o titulo "Bloqueio de Pessoa" e o alerta: "A função de bloqueio serve para identificarmos as pessoas que não devem ser chamados para a Festa! Usar essa função com responsabilidade."
- **FR-003**: A pagina de bloqueio deve conter campo de texto (text area) para o motivo do bloqueio, com o texto-guia: "Informe o motivo do bloqueio, seja detalhista. **Lembre-se que outras pessoas poderão estar responsável pela equipe de Pessoal e elas devem entender o por quê do bloqueio, para não chamar mais essa pessoa para a Festa.**"
- **FR-004**: O motivo do bloqueio deve ter minimo de 100 caracteres e sem limite maximo; o sistema deve impedir o envio com menos 100 de caracteres
- **FR-005**: A pagina de bloqueio deve conter um box de aprovadores informando "Serão necessários 2 aprovadores para bloquear a pessoa."
- **FR-006**: No box de aprovadores, o sistema deve preencher o nome do usuario atual como 1o aprovador e exibir um espaco reservado onde aparecera a 2a aprovacao
- **FR-007**: Ao confirmar, o sistema deve salvar o registro de bloqueio com a pessoa, a justificativa, a 1a aprovacao e o status pendente (aguardando 2a aprovacao) e redirecionar para a tela Bloqueios
- **FR-008**: Um segundo usuario autorizado e distinto do 1o aprovador deve poder aprovar o bloqueio pendente; com a 2a aprovacao, o bloqueio se torna ativo e a pessoa passa a ser considerada bloqueada
- **FR-009**: O mesmo usuario nao pode ser os dois aprovadores de um mesmo bloqueio (ou desbloqueio)
- **FR-010**: O menu deve conter a secao "Pessoas" com uma subsecao "Bloqueios" que lista as pessoas bloqueadas e os pedidos pendentes de aprovacao, com a justificativa visivel
- **FR-011**: O desbloqueio ocorre na pagina `/pessoas/:id/desbloquear`, exige justificativa obrigatoria e duas aprovacoes de usuarios autorizados e distintos; a pessoa permanece bloqueada ate a conclusao das duas aprovacoes
- **FR-012**: O sistema deve registrar todo bloqueio e desbloqueio com tipo, justificativa, aprovadores (1o e 2o), autor e data, preservando o historico completo
- **FR-013**: No detalhe da Pessoa, o sistema deve exibir um aviso bem chamativo acima do box de dados quando a pessoa esta bloqueada, com a justificativa completa; quando ha bloqueio pendente, um aviso distinto deve informar a pendencia
- **FR-014**: O box "Exclusivo para uso do Pessoal" do detalhe da Pessoa deve ter uma nova aba "Bloqueios" com a linha do tempo de bloqueios e desbloqueios da pessoa
- **FR-015**: O sistema deve impedir o acesso a pagina `/pessoas/:id/bloquear` para uma pessoa ja bloqueada ou com pedido pendente, e a pagina `/pessoas/:id/desbloquear` para uma pessoa nao bloqueada; o acesso indevido e redirecionado/inedito e novo bloqueio nao e criado
- **FR-016**: Apenas uma aprovacao de cada par deve contar para cada bloqueio/desbloqueio; aprovacoes concorrentes nao devem duplicar efeito
- **FR-017**: Pessoas bloqueadas devem ser identificadas de forma destacada em toda a navegacao em que aparecem (detalhe, listagens, telas de equipe, seletores de pessoa), para que quem organiza chamadas nao as convide
- **FR-018**: O sistema deve impedir a selecao de uma pessoa bloqueada em fluxos que a chamem, convidem ou aloquem (montagem de equipes, alocacao/movimentacao, convites e buscas para convite), exibindo aviso claro do motivo
- **FR-019**: Uma pessoa ja alocada nao deve ser desalocada automaticamente ao receber bloqueio ativo; a restricao vale para novas chamadas, convites e alocacoes/movimentacoes
- **FR-020**: Enquanto um bloqueio esta pendente (1 aprovacao), a pessoa nao deve ser tratada como bloqueada — fluxos de selecao permanecem permitidos ate a conclusao das duas aprovacoes
- **FR-021**: Todas as mensagens e textos de interface envolvidos devem permanecer em PT-BR

### Key Entities

- **Pessoa**: Cadastro de equipista. Ganha o estado de "bloqueada" a partir da conclusao do bloqueio, e volta a "livre" na conclusao de um desbloqueio; o estado de bloqueio e independente dos dados do cadastro
- **Registro de Bloqueio**: Registro que guarda pessoa, justificativa, aprovadores (1o e 2o) e estado (pendente ou ativo). Roda o ciclo bloquear/desbloquear de uma pessoa por vez (um pedido ativo por pessoa)
- **Historico de bloqueio**: Linha do tempo por pessoa com os eventos de bloqueio e desbloqueio (tipo, justificativa, aprovadores, autor, data). Preserva tudo, sem exclusao
- **Permissao da area Pessoal**: Privilegio exigido para iniciar e aprovar bloqueios e desbloqueios (o mesmo acesso usado no box "Exclusivo para uso do Pessoal")

## Success Criteria

### Measurable Outcomes

- **SC-001**: Com duas aprovacoes validas, o bloqueio se torna ativo em ate 5 segundos apos a 2a aprovacao
- **SC-002**: 100% dos bloqueios e desbloqueios registrados possuem justificativa de ao menos 100 caracteres com conteudo real (o sistema impede salvar abaixo disso)
- **SC-003**: Nenhum bloqueio se ativa com menos de dois aprovadores distintos (0 violacoes)
- **SC-004**: O aviso de bloqueio aparece acima do box de dados em 100% das visitas ao detalhe de uma pessoa bloqueada
- **SC-005**: O usuario autorizado conclui a solicitacao de bloqueio (motivo + 1a aprovacao) em menos de 2 minutos
- **SC-006**: O historico da aba Bloqueios do box Pessoal apresenta 100% dos eventos de bloqueio e desbloqueio da pessoa, sem perdas
- **SC-007**: O usuario localiza, na tela Bloqueios, um pedido pendente ou uma pessoa bloqueada sem mais de 1 clique do menu
- **SC-008**: Em 100% dos fluxos de chamada, convite e alocacao, pessoas bloqueadas nao conseguem ser selecionadas, com aviso do motivo

## Assumptions

- A iniciacao e a aprovacao de bloqueios e desbloqueios sao exclusivas de usuarios com acesso a area Pessoal (o mesmo privilegio que libera o box "Exclusivo para uso do Pessoal")
- O solicitante do bloqueio/desbloqueio ja conta como 1a aprovacao; nunca pode ser tambem a 2a
- So existe um pedido de bloqueio (pendente ou ativo) por pessoa por vez; novos pedidos so sao possiveis apos o desbloqueio
- Nao ha fluxo de rejeicao ou cancelamento de pedido pendente nesta versao: um pedido pendente permanece na tela Bloqueios ate receber a 2a aprovacao
- O bloqueio funciona como identificacao forte da pessoa em todo o sistema (banner no detalhe, destaque em listagens, justificativa legivel) e tambem restringe ativamente a selecao da pessoa bloqueada nos fluxos de chamada, convite e alocacao (decisao de escopo: opcao C)
- A aba de historico fica visivel apenas para quem tem acesso ao box "Exclusivo para uso do Pessoal"
- O bloqueio nao altera os dados cadastrais da pessoa; permanece vinculado por identificador unico, independente de edicoes posteriores
- O historico e a tela Bloqueios usam as praticas ja existentes do sistema para permissao e visibilidade (ProtegerRota), sem criar novos perfis fixos

## Scope Boundaries

- Incluido: criar bloqueio e desbloqueio em **paginas dedicadas** (`/pessoas/:id/bloquear` e `/pessoas/:id/desbloquear`) com dupla aprovacao, aprovacao como 2o aprovador na tela Bloqueios/detalhe, tela Bloqueios no menu, banner no detalhe, aba de historico, identificacao destacada nas listagens, tratamento visual de destaque em toda a navegacao e restricao de selecao da pessoa bloqueada nos fluxos de chamada, convite e alocacao
- Nao planejado nesta versao: rejeicao/cancelamento de pedidos, notificacoes automaticas aos aprovadores, auditoria em outros fluxos, mudanca de dados cadastrais da pessoa ao bloquear, desalocacao automatica de pessoas ja alocadas no momento do bloqueio (a pessoa bloqueada permanece onde esta, apenas restrita a novas acoes)