# Feature Specification: PBAC - Catalogo de Permissoes e Validacao Unica de Acesso

**Feature Branch**: `014-pbac-permissoes`

**Created**: 2026-08-07

**Status**: Draft

**Input**: User description: "Vamos criar um PBAC para o sistema. Quero poder criar permissões para associar aos perfis. O sistema deverá ter uma função única para validar o acesso do usuário. O ajuste de cada tela e/ou funcionalidade para se adequar a esse novo controle, será feito em um segundo momento."

## Clarifications

### Session 2026-08-07

- Q: Edicao do codigo de uma permissao ja associada a perfis? → A: O codigo e imutavel apos a criacao; a tela nao oferece edicao do codigo (impede quebrar o acesso dos perfis)
- Q: Ultima permissao de gerencia do catalogo desativada? → A: A permissao de gerencia do catalogo nunca pode ser desativada; esta sempre associada ao perfil ADM, que nunca pode ser excluido
- Q: Permissao desativada que ainda consta em perfis gravados? → A: A validacao restringe o acesso: mesmo gravada no perfil, a permissao desativada nao concede acesso
- Q: Dois administradores criam a mesma permissao ao mesmo tempo? → A: Virtualmente impossivel; sem tratamento especial alem da rejeicao de codigo duplicado
- Q: Usuario logado com permissao desativada/removida durante a sessao? → A: Ele mantem o acesso ate a proxima validacao; ao tentar algo que exija validacao, o acesso e restringido automaticamente
- Q: Perfis fixos (ADM) ao associar ou remover permissoes? → A: O ADM sempre tem acesso a todas as permissoes; novas permissoes sao associadas ao perfil ADM automaticamente
- Q: Catalogo de permissoes cresce muito? → A: Fora de escopo nesta fase; nao requer tratamento especial agora

## User Scenarios & Testing

### User Story 1 - Catalogo de permissoes editavel (Priority: P1)

O administrador do sistema acessa uma tela de controle de permissoes e visualiza a lista de todas as permissoes existentes (as padrao e as criadas). Ele pode criar uma nova permissao informando um codigo unico, um rotulo de exibicao e uma descricao; pode tambem editar o rotulo e a descricao de uma permissao existente e desativar uma permissao que nao sera mais concedida. Uma permissao desativada deixa de ser oferecida na associacao aos perfis e nao concede mais acesso a ninguem.

**Why this priority**: E o bloco fundamental do PBAC — sem um catalogo de permissoes editavel, nao ha como criar novas permissoes para associar aos perfis. E o primeiro passo do controle de acesso.

**Independent Test**: Pode ser testado criando uma permissao com codigo novo, editando o rotulo dela e desativando-a, verificando que a tela reflete cada mudanca e que a permissao desativada desaparece da lista de selecao dos perfis.

**Acceptance Scenarios**:

1. **Given** um administrador logado, **When** ele acessa a tela de controle de permissoes, **Then** a tela exibe a lista de todas as permissoes ativas, cada uma com rotulo e descricao
2. **Given** a tela de controle de permissoes aberta, **When** o administrador cria uma permissao com codigo, rotulo e descricao validos, **Then** a nova permissao aparece na lista e passa a estar disponivel para associacao aos perfis
3. **Given** a tela de controle de permissoes aberta, **When** o administrador tenta criar uma permissao com um codigo que ja existe, **Then** o sistema rejeita com mensagem clara de que o codigo ja esta em uso
4. **Given** uma permissao existente, **When** o administrador edita o rotulo e a descricao, **Then** as novas informacoes aparecem na lista e em todos os pontos que exibem a permissao
5. **Given** uma permissao existente, **When** o administrador a desativa, **Then** ela deixa de aparecer como opcao de associacao nos perfis e nao concede mais acesso a nenhum usuario
6. **Given** a tela de controle de permissoes, **When** um usuario sem autorizacao para gerir permissoes tenta acessa-la, **Then** o sistema nega o acesso sem revelar o conteudo do catalogo
7. **Given** uma permissao existente com associacoes em perfis, **When** o administrador tenta alterar o codigo dela, **Then** o sistema bloqueia a alteracao e mantem o codigo original
8. **Given** a criacao ou desativacao de uma permissao, **When** a operacao e concluida com sucesso, **Then** o sistema gera um registro de auditoria rastreavel com autor e data
9. **Given** a permissao de gerencia do catalogo, **When** o administrador tenta desativa-la, **Then** o sistema bloqueia a operacao, pois essa permissao nunca pode ser desativada (esta sempre associada ao ADM, que nunca e excluido)
10. **Given** a criacao de uma permissao nova, **When** ela e salva no catalogo, **Then** o sistema a associa automaticamente ao perfil ADM, que passa a ter acesso a ela

---

### User Story 2 - Associacao de permissoes aos perfis (Priority: P1)

Ao editar um perfil de acesso, o administrador seleciona quais permissoes do catalogo aquele perfil concede. A tela de edicao de perfil oferece apenas as permissoes ativas do catalogo (as padrao e as criadas pelo administrador). O sistema aceita somente permissoes validas e ativas: codigos inexistentes ou desativados sao rejeitados. Usuarios vinculados ao perfil passam a ter efetivamente as permissoes associadas.

**Why this priority**: E o elo entre permissoes e acesso real — sem associar permissoes aos perfis, o catalogo nao produz efeito pratico no controle de acesso.

**Independent Test**: Pode ser testado criando um perfil, associando a ele uma permissao recem-criada, vinculando um usuario a esse perfil e verificando que o usuario passa a ter a permissao na validacao de acesso.

**Acceptance Scenarios**:

1. **Given** a edicao de um perfil de acesso, **When** o administrador abre a lista de permissoes, **Then** a lista oferece somente as permissoes ativas do catalogo, com rotulo e descricao
2. **Given** a edicao de um perfil, **When** o administrador associa permissoes do catalogo e salva, **Then** as permissoes associadas ficam gravadas no perfil e sao exibidas na proxima consulta
3. **Given** a edicao de um perfil, **When** o sistema recebe um codigo de permissao inexistente ou desativado, **Then** o sistema rejeita o codigo e nao o grava no perfil
4. **Given** um usuario vinculado a um perfil, **When** uma permissao e associada ao perfil, **Then** o usuario passa a ter aquela permissao na validacao de acesso
5. **Given** um perfil com permissoes associadas, **When** o administrador consulta o perfil, **Then** a tela exibe todas as permissoes associadas com seus rotulos e descricoes
6. **Given** a associacao ou remocao de permissoes em um perfil, **When** a operacao e concluida com sucesso, **Then** o sistema gera um registro de auditoria rastreavel com autor e data
7. **Given** o perfil ADM (fixo), **When** o administrador tenta remover uma permissao desse perfil, **Then** o sistema nao permite, pois o ADM sempre possui todas as permissoes do catalogo

---

### User Story 3 - Funcao unica de validacao de acesso (Priority: P1)

O sistema passa a ter uma unica funcao de validacao de acesso do usuario: para cada pergunta "o usuario pode fazer X?", o sistema consulta essa unica funcao, informando o usuario logado e o codigo da permissao exigida, e recebe como resposta se o acesso e permitido ou negado. Todas as telas e funcionalidades existentes continuam funcionando exatamente como hoje (nenhum usuario perde o acesso que ja tem); a adequacao de cada tela para usar a funcao unica em suas decisoes de interface acontece em um segundo momento.

**Why this priority**: E o objetivo central da feature — um ponto unico de decisao de autorizacao, baseado em permissoes, que substitui as regras espalhadas pelo sistema e garante consistencia no controle de acesso.

**Independent Test**: Pode ser testado consultando a funcao para um usuario com e sem uma determinada permissao: o primeiro recebe acesso permitido e o segundo acesso negado, para o mesmo codigo de permissao.

**Acceptance Scenarios**:

1. **Given** um usuario logado com uma permissao X associada ao perfil dele, **When** o sistema valida o acesso para a permissao X, **Then** o resultado e "permitido"
2. **Given** um usuario logado sem a permissao X, **When** o sistema valida o acesso para a permissao X, **Then** o resultado e "negado"
3. **Given** um usuario deslogado ou sem registro no sistema, **When** o sistema valida qualquer permissao, **Then** o resultado e "negado"
4. **Given** a validacao de acesso de uma permissao desativada, **When** qualquer usuario e avaliado, **Then** o resultado e "negado"
5. **Given** a migracao dos seis perfis padrao (ADM, ORG, CRD, EQP, OPC, REC), **When** cada perfil e avaliado nas acoes que hoje possui, **Then** o resultado continua sendo "permitido" para todas as acoes que ja eram permitidas antes da feature
6. **Given** uma permissao desativada que estava associada a perfis, **When** o sistema encerra o acesso dela, **Then** todos os usuarios daqueles perfis passam a receber "negado" para aquela permissao
7. **Given** um usuario logado com uma permissao do perfil dele, **When** essa permissao e desativada ou removida durante a sessao e o usuario tenta realizar uma acao que exige validacao, **Then** a validacao retorna "negado" automaticamente naquele momento

---

### Edge Cases

- O codigo de uma permissao e imutavel apos a criacao; o administrador nao consegue edita-lo, mesmo que a permissao esteja associada a perfis
- A permissao de gerencia do catalogo nunca pode ser desativada; ela esta sempre associada ao perfil ADM, que nunca pode ser excluido — sempre existe um gestor do catalogo
- Uma permissao desativada que ainda consta em perfis gravados nao concede acesso: a validacao sempre retorna "negado" para ela
- Dois administradores criando a mesma permissao ao mesmo tempo e tratado como impossivel; a rejeicao de codigo duplicado ja cobre a hipotese
- Um usuario logado mantem o acesso ate a proxima validacao; ao tentar uma acao que exija validacao, o acesso ja restringido e negado automaticamente
- O perfil ADM (fixo) sempre possui todas as permissoes do catalogo; novas permissoes sao associadas a ele automaticamente, e nao e possivel remover permissao do ADM
- O crescimento do catalogo de permissoes e a usabilidade da associacao em larga escala nao sao tratados nesta fase

## Requirements

### Functional Requirements

- **FR-001**: O sistema deve manter um catalogo de permissoes que sirva de fonte unica da verdade para o controle de acesso
- **FR-002**: O sistema deve permitir que um usuario autorizado crie novas permissoes informando codigo unico, rotulo e descricao
- **FR-003**: O sistema deve rejeitar a criacao de permissao com codigo duplicado, com mensagem clara
- **FR-004**: O sistema deve permitir editar o rotulo e a descricao de uma permissao existente
- **FR-005**: O codigo de uma permissao deve ser imutavel apos a criacao, pois telas e funcionalidades o referenciam
- **FR-006**: O sistema deve permitir desativar uma permissao (sem exclui-la definitivamente) em vez de apagar o registro
- **FR-007**: Uma permissao desativada deve deixar de conceder acesso a todos os usuarios — inclusive quando o codigo ainda consta em perfis gravados — e deixar de aparecer como opcao de associacao nos perfis
- **FR-008**: A edicao de perfil deve aceitar somente permissoes validas e ativas do catalogo; codigos inexistentes ou desativados devem ser rejeitados
- **FR-009**: O sistema deve expor uma unica funcao de validacao de acesso que recebe o usuario e o codigo da permissao exigida e retorna a decisao de permitir ou negar
- **FR-010**: A funcao unica de validacao deve ser o unico ponto de decisao de autorizacao usado pelo sistema; as regras legadas de perfil devem ser consolidadas nela sem alterar o acesso atual dos seis perfis padrao
- **FR-011**: A validacao de acesso de um usuario deslogado ou sem registro no sistema deve sempre retornar "negado"
- **FR-012**: O sistema deve registrar em auditoria a criacao, edicao e desativacao de permissoes, bem como as associacoes de permissoes a perfis
- **FR-013**: Somente usuarios com permissao de gerencia de perfis/permissoes (perfil ADM ou equivalente) podem criar, editar ou desativar permissoes e alterar associacoes nos perfis
- **FR-014**: O sistema deve preservar o comportamento de acesso existente dos seis perfis padrao durante e apos a migracao
- **FR-015**: A permissao de gerencia do catalogo nunca pode ser desativada, pois esta sempre associada ao perfil ADM, que nunca pode ser excluido — garantindo que sempre exista um gestor do catalogo
- **FR-016**: O perfil ADM (fixo, que nunca pode ser excluido) deve sempre possuir todas as permissoes do catalogo; ao criar uma permissao, o sistema deve associa-la automaticamente ao perfil ADM, e nao deve ser possivel remover permissao do ADM
- **FR-017**: A validacao de acesso deve ser reavaliada a cada tentativa de acesso; um usuario mantem o acesso que ja possui ate a proxima validacao, momento em que uma permissao desativada ou removida passa a negar o acesso automaticamente

### Key Entities

- **Permissao**: Item do catalogo de controle de acesso. Atributos: codigo unico (imutavel), rotulo de exibicao, descricao, status ativo/desativado e datas de criacao e atualizacao
- **Perfil**: Grupo de permissoes concedidas a um usuario. Um perfil referencia permissoes do catalogo; perfis padrao existentes sao preservados, e o ADM e fixo, sempre possui todas as permissoes e nao tem a lista editavel
- **Usuario**: Pessoa autenticada no sistema. Acesso efetivo de um usuario = soma das permissoes associadas ao perfil dele
- **Decisao de acesso**: Resultado da validacao unica: "permitido" ou "negado", calculado a partir do usuario e da permissao exigida

## Success Criteria

### Measurable Outcomes

- **SC-001**: Um administrador cria uma permissao nova e ela fica disponivel para associacao aos perfis imediatamente, sem intervencao manual ou reinicio
- **SC-002**: 100% das acoes que cada um dos seis perfis padrao (ADM, ORG, CRD, EQP, OPC, REC) realiza hoje continuam permitidas apos a migracao para o PBAC
- **SC-003**: 100% das decisoes de autorizacao do sistema passam pela funcao unica de validacao, sem regras de perfil espalhadas em pontos individuais
- **SC-004**: Nenhuma permissao pode ser apagada permanentemente; toda remocao de acesso ocorre por desativacao
- **SC-005**: Toda criacao, edicao e desativacao de permissao e toda associacao de permissao a perfil geram registro de auditoria rastreavel
- **SC-006**: Toda permissao criada passa a estar disponivel ao perfil ADM automaticamente, sem acao manual do administrador
- **SC-007**: A permissao de gerencia do catalogo permanece sempre ativa e associada ao perfil ADM; nenhuma operacao consegue desativa-la ou remove-la do ADM

## Assumptions

- A gerencia de permissoes segue o mesmo controle atual de perfis: somente administradores (perfil ADM ou perfil com a permissao de gerencia) podem criar, editar e desativar permissoes
- As permissoes existentes hoje (catalogo atual do sistema) migram para o catalogo editavel sem perda de semantica
- O codigo da permissao e imutavel; alteracoes de codigo nao fazem parte desta feature
- Permissoes nao sao excluidas permanentemente — apenas desativadas — porque telas e funcionalidades referenciam os codigos
- A permissao de gerencia do catalogo nunca pode ser desativada e esta sempre associada ao perfil ADM (fixo, nunca excluido)
- Novas permissoes sao associadas automaticamente ao perfil ADM; o perfil ADM sempre possui todas as permissoes
- Nao ha revogacao ativa de acesso em sessoes abertas: a validacao e feita a cada tentativa de acesso e o usuario mantem o acesso atual ate a proxima validacao
- Criacao concorrente da mesma permissao nao requer tratamento especial; a rejeicao de codigo duplicado ja cobre a hipotese
- O crescimento do catalogo e a usabilidade da associacao em larga escala estao fora de escopo nesta fase
- O ajuste de cada tela e/ou funcionalidade para usar a funcao unica de validacao sera feito em um segundo momento; nesta fase o comportamento atual das telas e preservado
- A associacao de permissoes a perfis e a unica via de concessao (um usuario tem um perfil; nao ha concesao direta de permissao ao usuario nesta fase)
- Usuarios anonimos (validacao publica) sao tratados como deslogados e nao recebem acesso por permissoes
