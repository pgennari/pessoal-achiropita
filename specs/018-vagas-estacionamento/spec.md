# Feature Specification: Gestão de Estacionamento — Vagas, Veículos e Estacionamentos

**Feature Branch**: `018-vagas-estacionamento`

**Created**: 2026-08-15

**Status**: Draft

**Input**: User description:

> # Gestão de Estacionamento
>
> # Vagas
>
> Criar a entidades **Vagas**, elas representam as vagas de estacionamento disponibilizadas pela festa aos voluntários.
>
> Uma vaga pode ter **mais de uma pessoa** vinculada a ela.
>
> Uma vaga só poderá ser associada a **um** **estacionamento por vez.** Mas pode não ter estacionamento associado.
>
> Deve ter uma tela onde o usuário cria a vaga, já vinculando as pessoas e, se quiser, definindo um estacionamento para essa nova vaga.
>
> # Veículos
>
> Os veículos tem cadastro próprio e são vinculados a Pessoas.
>
> Não possui vínculos com Estacionamentos, nem com Vagas.
>
> Remover a associação de veículos com os estacionamento.
>
> Na tela de veículos deve continuar mostrando as pessoas, equipes e estacionamentos ligados ao veículo, mesmo que a relação seja indireta.
>
> # Estacionamentos
>
> Os Estacionamentos terão Vagas associadas a eles.
>
> O número de vagas contratadas, serve para mostrar o quão lotado o estacionamento está na tela de check-in e a porcentagem de vagas distribuídas.

## Clarifications

### Session 2026-08-15

- Q: Ao transferir uma vaga de um estacionamento para outro, a contagem de vagas distribuídas dos dois estacionamentos é atualizada? → A: Sim, ambos são atualizados.
- Q: Quando o estacionamento associado a uma vaga é excluído, a vaga é excluída? → A: Não, a vaga é mantida e fica sem estacionamento.
- Q: Pode-se associar uma vaga a um estacionamento cujas vagas contratadas já foram todas distribuídas? → A: Sim, a quantidade de vagas distribuídas pode superar a de vagas contratadas.
- Q: O que acontece com a vaga quando uma pessoa vinculada é inativada? → A: A vaga permanece vinculada à pessoa, mas sua associação com o estacionamento é desfeita.
- Q: Em qual estacionamento o check-in é permitido para veículo com pessoas em vagas de estacionamentos diferentes? → A: Cada vaga pertence a um único estacionamento; o veículo pode fazer check-in em todos os estacionamentos das vagas de suas pessoas.
- Q: Veículo sem pessoas vinculadas deve aparecer no check-in? → A: Não aparece no check-in nem exibe estacionamento.
- Q: Funcionalidades que dependiam do vínculo direto veículo↔estacionamento (ex.: check-in manual) devem ser adaptadas? → A: Sim, devem ser adaptadas ao novo modelo.
- Q: O histórico de associação do veículo com o estacionamento deve ser mantido, sendo recriado para a associação vaga↔estacionamento; onde deve ser exibido? → A: No detalhe da vaga.
- Q: Quais eventos devem gerar entrada no histórico de associação vaga↔estacionamento? → A: Associar, transferir e desassociar — incluindo a associação inicial na criação da vaga.
- Q: O que fazer com o histórico legado de associação veículo↔estacionamento existente? → A: Migrar os dados para o novo histórico vaga↔estacionamento por backfill (via pessoas do veículo → vaga, deduplicado); registros sem vaga correspondente permanecem na tabela legada, oculta e sem novas escritas.

## User Scenarios & Testing

### User Story 1 - Criar vaga vinculando pessoas e estacionamento (Priority: P1)

Um usuário ADM ou ORG, na tela de criação de vaga, informa a identificação da vaga, seleciona uma ou mais pessoas e, se quiser, define um estacionamento. Ao salvar, a vaga é criada com as pessoas vinculadas e passa a pertencer ao estacionamento escolhido (se houver). O estacionamento passa a refletir essa vaga na contagem de vagas distribuídas.

**Why this priority**: É a ação principal solicitada — criar a vaga já com as pessoas e o estacionamento em um único fluxo. Sem ela, não existe o novo modelo de gestão.

**Independent Test**: Pode ser testado abrindo a tela de criação de vaga, informando identificação, selecionando pessoas e (opcionalmente) um estacionamento, e salvando. A vaga criada aparece na listagem de vagas com as pessoas vinculadas e o estacionamento associado.

**Acceptance Scenarios**:

1. **Given** um usuário ADM/ORG na tela de criação de vaga, **When** ele informa a identificação, seleciona uma ou mais pessoas e um estacionamento e confirma, **Then** a vaga é criada, as pessoas ficam vinculadas a ela e ela fica associada ao estacionamento escolhido
2. **Given** um usuário criando uma vaga, **When** ele não seleciona estacionamento, **Then** a vaga é criada com as pessoas vinculadas e fica sem estacionamento associado
3. **Given** um usuário criando uma vaga, **When** ele tenta salvar sem informar a identificação, **Then** o sistema impede o salvamento e informa que a identificação é obrigatória
4. **Given** uma pessoa já vinculada a outra vaga, **When** o usuário tenta vinculá-la a uma nova vaga, **Then** o sistema impede o vínculo e informa em qual vaga a pessoa já está vinculada

---

### User Story 2 - Remover associação direta de veículo com estacionamento (Priority: P1)

Os veículos deixam de ter qualquer vínculo direto com estacionamentos ou vagas. A tela de veículos continua exibindo pessoas, equipes e estacionamentos, mas os estacionamentos passam a ser apresentados de forma indireta (via pessoas vinculadas → vaga → estacionamento).

**Why this priority**: É a mudança estrutural explícita — remover a associação veículo↔estacionamento. Sem isso, o novo modelo de vagas não faz sentido e o dado antigo conflita com o novo.

**Independent Test**: Pode ser testado abrindo a listagem e o detalhe de um veículo: não existe mais nenhum controle de associar/desassociar estacionamento nem histórico de associação, e a coluna de estacionamento passa a mostrar os estacionamentos derivados das vagas das pessoas vinculadas.

**Acceptance Scenarios**:

1. **Given** a tela de detalhe de um veículo, **When** o usuário abre a tela, **Then** não há mais campo nem controle para associar ou desassociar estacionamento, e o histórico de associação veículo↔estacionamento não é mais exibido
2. **Given** um veículo com pessoas vinculadas que possuem vaga em um estacionamento, **When** o usuário visualiza a listagem de veículos, **Then** o estacionamento é exibido na coluna Estacionamento derivado das vagas das pessoas vinculadas
3. **Given** um veículo com pessoas vinculadas a vagas em estacionamentos distintos, **When** o usuário visualiza a listagem, **Then** todos os estacionamentos derivados são exibidos
4. **Given** um veículo sem pessoas vinculadas ou cujas pessoas não possuem vaga, **When** o usuário visualiza a listagem, **Then** o veículo aparece sem estacionamento
5. **Given** a tela de veículos, **When** o usuário acessa a listagem ou o detalhe, **Then** pessoas e equipes continuam sendo exibidas como antes

---

### User Story 3 - Visualizar vagas, lotação e distribuição do estacionamento (Priority: P2)

O estacionamento passa a exibir as vagas associadas a ele. A tela de check-in mostra o quão lotado o estacionamento está e a porcentagem de vagas distribuídas, ambas calculadas com base nas vagas contratadas.

**Why this priority**: É o consumo da informação do novo modelo — sem a visualização, a criação de vagas não gera valor para o check-in e para o planejamento.

**Independent Test**: Pode ser testado abrindo o detalhe de um estacionamento com vagas associadas e abrindo a tela de check-in pública: as vagas aparecem no detalhe, e a lotação e a porcentagem de vagas distribuídas aparecem na tela de check-in.

**Acceptance Scenarios**:

1. **Given** um estacionamento com vagas associadas, **When** o usuário acessa o detalhe do estacionamento, **Then** a lista de vagas associadas é exibida com as pessoas vinculadas a cada vaga
2. **Given** um estacionamento com X vagas associadas de N vagas contratadas, **When** um operador abre a tela de check-in, **Then** a porcentagem de vagas distribuídas exibida é X/N
3. **Given** um estacionamento com N vagas contratadas, **When** um operador abre a tela de check-in, **Then** o grau de lotação é exibido com base nas N vagas contratadas
4. **Given** um estacionamento sem vagas associadas, **When** o operador abre a tela de check-in, **Then** a porcentagem de vagas distribuídas é exibida como 0%
5. **Given** um estacionamento com vagas associadas, **When** uma nova vaga é associada ou desassociada, **Then** a porcentagem de vagas distribuídas é atualizada automaticamente, sem recálculo manual

---

### User Story 4 - Adaptar o check-in por placa ao novo modelo (Priority: P2)

O check-in público por placa passa a identificar o veículo dentro de um estacionamento pela vaga das pessoas vinculadas ao veículo, já que o vínculo direto veículo↔estacionamento deixou de existir.

**Why this priority**: É consequência necessária da remoção do vínculo direto. Sem essa adaptação, o operador de campo não consegue localizar o veículo na tela de check-in.

**Independent Test**: Pode ser testado buscando, na tela de check-in de um estacionamento, a placa de um veículo cuja pessoa vinculada possui vaga naquele estacionamento — o veículo deve aparecer no resultado.

**Acceptance Scenarios**:

1. **Given** um veículo com pessoa vinculada que possui vaga no estacionamento do link de check-in, **When** o operador busca a placa, **Then** o veículo aparece como resultado e o check-in pode ser registrado
2. **Given** um veículo cuja pessoa vinculada possui vaga em outro estacionamento, **When** o operador busca a placa, **Then** o sistema informa que a placa está vinculada a uma vaga de outro estacionamento
3. **Given** um veículo sem pessoas com vaga em estacionamento algum, **When** o operador busca a placa, **Then** o sistema orienta a pessoa a procurar a gestão de estacionamento

---

### Edge Cases

- Quando a vaga é transferida de um estacionamento para outro, a contagem de vagas distribuídas de ambos os estacionamentos é atualizada automaticamente (decidido em clarificação)
- Quando o estacionamento associado a uma vaga é excluído, a vaga é mantida e fica sem estacionamento (não é excluída) (decidido em clarificação)
- A associação de uma vaga a um estacionamento com todas as vagas contratadas distribuídas é permitida; a quantidade de vagas distribuídas pode superar a de vagas contratadas (decidido em clarificação)
- Quando uma pessoa vinculada a uma vaga é inativada, a vaga permanece vinculada à pessoa, mas a associação da vaga com o estacionamento é desfeita (decidido em clarificação)
- Como cada vaga pertence a um único estacionamento, o veículo com pessoas em vagas de estacionamentos diferentes pode fazer check-in em todos os estacionamentos das vagas de suas pessoas (decidido em clarificação)
- Veículos sem pessoas vinculadas não aparecem no check-in nem exibem estacionamento (decidido em clarificação)
- Funcionalidades existentes que dependiam do vínculo direto veículo↔estacionamento (ex.: check-in manual) devem ser adaptadas ao novo modelo (decidido em clarificação)
- O histórico de associação é mantido e recriado para a associação vaga↔estacionamento: a vaga registra os estacionamentos por onde passou (associar, transferir, desassociar — incluindo a associação inicial na criação) e o histórico é exibido no detalhe da vaga; o histórico legado veículo↔estacionamento é migrado por backfill (via pessoas do veículo → vaga, deduplicado) e os registros sem vaga correspondente permanecem na tabela legada, oculta e sem novas escritas (decidido em clarificação)

## Requirements

### Functional Requirements

- **FR-001**: O sistema deve permitir criar uma vaga de estacionamento em uma tela única, com identificação da vaga, seleção de uma ou mais pessoas e seleção opcional de um estacionamento
- **FR-002**: Uma vaga pode ter mais de uma pessoa vinculada a ela
- **FR-003**: Uma vaga pode estar associada a no máximo um estacionamento por vez, e pode não ter estacionamento associado
- **FR-004**: Ao mudar o estacionamento de uma vaga, o sistema deve desassociá-la do estacionamento anterior e atualizar a contagem de vagas distribuídas dos dois estacionamentos envolvidos
- **FR-005**: O sistema deve impedir o vínculo duplicado da mesma pessoa à mesma vaga, com mensagem amigável
- **FR-006**: O sistema deve impedir que uma pessoa seja vinculada a mais de uma vaga; ao tentar vincular uma pessoa que já possui vaga, o sistema deve informar em qual vaga ela está vinculada
- **FR-007**: O sistema deve remover a capacidade de associar uma pessoa diretamente a um estacionamento; o estacionamento da pessoa passa a ser derivado da vaga a que ela está vinculada
- **FR-008**: O detalhe da pessoa deve exibir a vaga a que ela está vinculada e o estacionamento derivado (se houver)
- **FR-009**: A tela de veículos (listagem e detalhe) deve exibir as pessoas e equipes vinculadas ao veículo
- **FR-010**: A tela de veículos (listagem e detalhe) deve exibir os estacionamentos ligados indiretamente ao veículo, derivados das vagas das pessoas vinculadas, mesmo sem vínculo direto
- **FR-011**: O sistema deve remover qualquer capacidade de associar ou desassociar um veículo a um estacionamento ou a uma vaga
- **FR-012**: O sistema deve manter o histórico de associação, recriado para a associação vaga↔estacionamento: cada associação (inclusive a inicial, na criação da vaga), transferência e desassociação de estacionamento é registrada e exibida no detalhe da vaga; o veículo não exibe mais histórico de associação
- **FR-024**: O sistema deve migrar os registros do histórico legado de associação veículo↔estacionamento para o histórico vaga↔estacionamento por backfill (via pessoas do veículo → vaga, deduplicado), preservando na tabela legada os registros sem vaga correspondente
- **FR-013**: O detalhe do estacionamento deve listar as vagas associadas a ele, com as pessoas vinculadas a cada vaga
- **FR-014**: A tela de check-in deve exibir o quão lotado o estacionamento está, com base nas vagas contratadas
- **FR-015**: A tela de check-in deve exibir a porcentagem de vagas distribuídas, calculada como o número de vagas associadas dividido pelas vagas contratadas
- **FR-016**: A quantidade de vagas distribuídas de um estacionamento deve ser calculada automaticamente a partir das vagas associadas, sem entrada manual
- **FR-017**: O check-in por placa deve localizar o veículo em qualquer estacionamento em que uma das pessoas vinculadas possua vaga; cada vaga pertence a um único estacionamento
- **FR-018**: Ao buscar no check-in uma placa vinculada a uma vaga de outro estacionamento, o sistema deve informar o outro estacionamento
- **FR-019**: O sistema deve permitir associar uma vaga a um estacionamento mesmo quando a quantidade de vagas distribuídas ultrapassar as vagas contratadas, exibindo um aviso informativo sem impedir a associação
- **FR-020**: Quando o estacionamento associado a uma vaga é excluído, a vaga deve ser mantida e ficar sem estacionamento
- **FR-021**: Quando uma pessoa vinculada a uma vaga é inativada, a vaga deve permanecer vinculada à pessoa e sua associação com o estacionamento deve ser desfeita
- **FR-022**: Veículos sem pessoas vinculadas não devem aparecer no check-in por placa nem exibir estacionamento
- **FR-023**: As funcionalidades existentes que dependiam do vínculo direto veículo↔estacionamento (ex.: check-in manual) devem ser adaptadas ao novo modelo

### Key Entities

- **Vaga**: vaga de estacionamento disponibilizada pela festa. Possui uma identificação, pode estar associada a um estacionamento (0 ou 1) e a uma ou mais pessoas. Mantém o histórico de associação com estacionamentos (associar, transferir, desassociar), exibido no detalhe da vaga.
- **Pessoa**: voluntário da festa. Pode estar vinculada a no máximo uma vaga; seu estacionamento é derivado da vaga, e o vínculo direto pessoa↔estacionamento deixa de existir.
- **Estacionamento**: local com N vagas contratadas. Passa a ter vagas associadas; a quantidade de vagas distribuídas é derivada das vagas associadas. Não se vincula mais diretamente a veículos.
- **Veículo**: cadastro próprio, vinculado a pessoas. Não possui vínculo com estacionamentos nem com vagas; os estacionamentos exibidos são derivados indiretamente.
- **PessoaVaga**: vínculo entre pessoa e vaga, permitindo que uma vaga tenha mais de uma pessoa.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Usuários ADM/ORG conseguem criar uma vaga com pessoas e estacionamento em até 3 minutos na primeira tentativa
- **SC-002**: 100% dos veículos cadastrados continuam exibindo estacionamento de forma indireta (quando aplicável) após a remoção do vínculo direto
- **SC-003**: A porcentagem de vagas distribuídas exibida na tela de check-in reflete as vagas associadas sem nenhum recálculo manual
- **SC-004**: Nenhuma tela do sistema permite mais associar veículo a estacionamento ou vaga
- **SC-005**: Operadores localizam por placa, na tela de check-in, qualquer veículo cuja pessoa vinculada possua vaga no estacionamento, sem exceção
- **SC-006**: A listagem de veículos exibe corretamente múltiplos estacionamentos para veículos cujas pessoas têm vagas em estacionamentos diferentes
- **SC-007**: Cada associação, transferência e desassociação de estacionamento de uma vaga (incluindo a associação inicial na criação) gera entrada no histórico exibido no detalhe da vaga, sem perda de eventos registrados
- **SC-008**: Após a migração, todo registro legado de veículo↔estacionamento cujas pessoas possuam vaga gera entrada correspondente no histórico da vaga, sem duplicação, e nenhum registro é perdido (os sem vaga permanecem na tabela legada)

## Assumptions

- Cada vaga possui uma identificação (nome/etiqueta) informada pelo usuário no momento da criação; não há numeração automática
- ADM e ORG podem criar e editar vagas; os demais perfis autenticados podem visualizar vagas e estacionamentos
- O grau de lotação exibido na tela de check-in corresponde aos check-ins registrados no dia em relação às vagas contratadas (comportamento já existente mantido), enquanto a porcentagem de vagas distribuídas é um novo indicador (vagas associadas ÷ vagas contratadas)
- Quando um estacionamento é excluído, as vagas associadas são mantidas e ficam sem estacionamento
- O campo manual de vagas distribuídas do estacionamento deixa de existir, sendo substituído pelo cálculo automático a partir das vagas associadas
- As funcionalidades que dependiam do vínculo direto veículo↔estacionamento (ex.: check-in manual) serão adaptadas ao novo modelo (confirmado em clarificação)
- O histórico de associação veículo↔estacionamento é substituído pelo histórico de associação vaga↔estacionamento, exibido no detalhe da vaga; os dados do histórico legado são migrados por backfill (via pessoas do veículo → vaga), e os registros sem vaga correspondente permanecem na tabela legada, oculta e sem novas escritas (confirmado em clarificação)
- Cada pessoa pode estar vinculada a no máximo uma vaga; ao criar/editar uma vaga, pessoas já vinculadas a outra vaga são bloqueadas com mensagem informando a vaga atual
- O vínculo direto pessoa↔estacionamento deixa de existir; o estacionamento da pessoa é derivado da vaga a que ela está vinculada
- O termo "vaga" neste documento refere-se a vaga de estacionamento, e não às vagas de capacidade de equipe/barraca
