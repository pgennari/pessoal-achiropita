# Feature Specification: Tabela de Veículos com Relacionamento Múltiplo

**Feature Branch**: `007-veiculos-tabela`

**Created**: 2026-07-26

**Status**: Draft

**Input**: User description: "Crie uma tabela no banco de dados exclusiva para o veículos, e altere o vinculo com as pessoas. Cada pessoa pode ter mais de um veiculos. Cada veículo pode estar associado mais de uma pessoa. No estacionamento, é o veículo que deve ser associado ao estacionamento. O relacionamento entre veículo e estacionamento é de um para um. Na tela de checkin, a consulta da placa, deve retornar o carro, com o nome das pessoas associadas dentro do 'card' do veículo."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cadastrar veículo como entidade independente (Priority: P1)

**Como** ADM ou ORG,
**quero** cadastrar veículos de forma independente (fabricante, modelo, placa, cor),
**para** que cada veículo tenha sua própria identidade no sistema e possa ser vinculado a uma ou mais pessoas.

**Por que esta prioridade**: Base de toda a feature — sem a tabela de veículos não é possível estabelecer os relacionamentos.

**Teste independente**: Pode ser testado criando um veículo novo e verificando que ele aparece na listagem de veículos.

**Cenários de aceite**:

1. **Dado** que o usuário está na tela de veículos, **Quando** ele clica em "Novo Veículo", **Então** exibe um formulário com campos: fabricante, modelo, placa e cor.
2. **Dado** que o usuário preenche todos os campos obrigatórios, **Quando** ele salva, **Então** o veículo é criado e aparece na listagem.
3. **Dado** que o usuário tenta salvar um veículo com placa já cadastrada, **Quando** ele confirma, **Então** o sistema exibe erro informando que a placa já existe.
4. **Dado** que o veículo foi criado, **Quando** o usuário visualiza a listagem, **Então** exibe fabricante, modelo, placa e cor de cada veículo.

---

### User Story 2 - Vincular veículos a pessoas (many-to-many) (Priority: P1)

**Como** ADM ou ORG,
**quero** vincular um ou mais veículos a uma pessoa, e uma pessoa pode ter mais de um veículo,
**para** que o cadastro reflita a realidade (uma família pode ter vários carros, e um carro pode ser compartilhado entre familiares).

**Por que esta prioridade**: Essencial para o funcionamento do check-in — o sistema precisa saber quais pessoas estão associadas a cada veículo.

**Teste independente**: Pode ser testando vinculando dois veículos a uma pessoa e verificando que ambos aparecem no detalhe da pessoa.

**Cenários de aceite**:

1. **Dado** que o usuário está no detalhe de uma pessoa, **Quando** ele clica em "Vincular Veículo", **Então** exibe lista de veículos disponíveis para vincular.
2. **Dado** que o usuário seleciona um veículo, **Quando** ele confirma, **Então** o vínculo é criado e o veículo aparece na lista de veículos da pessoa.
3. **Dado** que uma pessoa já possui dois veículos vinculados, **Quando** o usuário visualiza o detalhe, **Então** ambos os veículos estão listados.
4. **Dado** que um veículo está vinculado a duas pessoas, **Quando** o usuário visualiza o detalhe de qualquer uma delas, **Então** o veículo aparece na lista de veículos da pessoa.
5. **Dado** que o usuário deseja desvincular um veículo de uma pessoa, **Quando** ele clica em "Remover", **Então** o vínculo é removido mas o veículo continua existindo no sistema.

---

### User Story 3 - Associar veículo ao estacionamento (1:1) (Priority: P1)

**Como** ADM ou ORG,
**quero** associar um veículo a um estacionamento,
**para** que o sistema saiba qual estacionamento o veículo utilize, sendo que cada veículo pode estar em apenas um estacionamento.

**Por que esta prioridade**: Requerido para que o check-in funcione corretamente — a busca por placa deve filtrar apenas veículos do estacionamento.

**Teste independente**: Pode ser testando associando um veículo a um estacionamento e verificando que ele aparece na listagem de veículos do estacionamento.

**Cenários de aceite**:

1. **Dado** que o usuário está no detalhe de um estacionamento, **Quando** ele clica em "Associar Veículo", **Então** exibe lista de veículos disponíveis (não associados a nenhum estacionamento).
2. **Dado** que o usuário seleciona um veículo, **Quando** ele confirma, **Então** o veículo é associado ao estacionamento e aparece na listagem de veículos do estacionamento.
3. **Dado** que um veículo já está associado a um estacionamento, **Quando** o usuário tenta associá-lo a outro, **Então** o sistema bloqueia e informa que o veículo já está associado a outro estacionamento.
4. **Dado** que o veículo está associado a um estacionamento, **Quando** o usuário remove a associação, **Então** o veículo fica disponível para ser associado a outro estacionamento.

---

### User Story 4 - Busca de placa no check-in retorna veículo com pessoas (Priority: P1)

**Como** operador de estacionamento,
**quero** ao digitar uma placa na tela de check-in, ver o veículo encontrado com o nome das pessoas associadas dentro do card do veículo,
**para** identificar rapidamente a quem o veículo pertence e realizar o check-in.

**Por que esta prioridade**: Fluxo principal do check-in — o operador precisa ver as pessoas associadas ao veículo para registrar a entrada.

**Teste independente**: Pode ser testando acessando o link público, digitando uma placa e verificando que o card do veículo exibe os nomes das pessoas associadas.

**Cenários de aceite**:

1. **Dado** que o operador acessa o link público do estacionamento, **Quando** ele digita uma placa, **Então** o sistema retorna um card com os dados do veículo (placa, modelo, cor) e os nomes das pessoas associadas.
2. **Dado** que o veículo possui duas pessoas associadas, **Quando** o card é exibido, **Então** ambos os nomes aparecem no card do veículo.
3. **Dado** que o veículo já possui check-in registrado, **Quando** o card é exibido, **Então** aparece indicativo visual de que o check-in já foi realizado.
4. **Dado** que o operador clica em "Check-in" de uma pessoa, **Quando** o clique acontece, **Então** exibe um modal de confirmação com data/hora, dados do veículo e nome da pessoa.
5. **Dado** que o operador digita uma placa inexistente no estacionamento, **Quando** a busca não encontra resultados, **Então** exibe mensagem informando que nenhum veículo foi encontrado para aquela placa.

---

### Edge Cases

- O que acontece quando um veículo é desvinculado de todas as pessoas? O veículo continua existindo no sistema, vinculado ao estacionamento.
- O que acontece quando um veículo associado a um estacionamento é excluído? O sistema deve bloquear a exclusão se existirem check-ins associados ao veículo.
- O que acontece quando uma pessoa é inativada? Os vínculos com veículos são mantidos, e o check-in continua funcionando.
- O que acontece quando o estacionamento é excluído? Os veículos perdem a associação (ON DELETE SET NULL) e continuam existindo no sistema.
- O que acontece quando o operador digita uma placa parcial que retorna múltiplos veículos? Todos os veículos correspondentes devem ser exibidos, cada um com suas pessoas associadas.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE possuir uma tabela de veículos independente, com campos: id, fabricante, modelo, placa (única), cor, criado_em, atualizado_em.
- **FR-002**: O sistema DEVE possuir uma tabela de junção pessoa_veiculo com campos: pessoa_id, veiculo_id, com chave primária composta (pessoa_id, veiculo_id).
- **FR-003**: Cada pessoa DEVE poder ter múltiplos veículos vinculados (muitos-para-muitos).
- **FR-004**: Cada veículo DEVE poder estar vinculado a múltiplas pessoas (muitos-para-muitos).
- **FR-005**: A coluna carros (JSONB) na tabela pessoas DEVE ser removida após a migração dos dados.
- **FR-006**: A tabela veículos DEVE possuir um campo estacionamento_id (opcional) com relacionamento 1:1 — cada veículo pode estar em no máximo um estacionamento.
- **FR-007**: A tabela checkins DEVE ser atualizada para referenciar veiculos.id em vez do campo carro_id genérico.
- **FR-008**: A tela de check-in (link público) DEVE, ao buscar por placa, retornar o veículo com os nomes das pessoas associadas exibidos dentro do card do veículo.
- **FR-009**: A busca por placa no check-in DEVE filtrar apenas veículos associados ao estacionamento específico.
- **FR-010**: O sistema DEVE permitir o cadastro, edição e exclusão de veículos (com restrição de exclusão se existirem check-ins).
- **FR-011**: O sistema DEVE permitir vincular e desvincular veículos a pessoas a partir da tela de detalhe da pessoa.
- **FR-012**: O sistema DEVE permitir associar e desassociar veículos a estacionamentos a partir da tela de detalhe do estacionamento.
- **FR-013**: A tela de detalhe do estacionamento DEVE listar os veículos associados ao estacionamento.
- **FR-014**: A tabela pessoas DEVE manter o campo tem_estacionamento (booleano) para indicar se a pessoa possui vaga, mas o campo estacionamento_id DEVE ser removido da tabela pessoas (agora está na tabela veículos).
- **FR-015**: A constraint de unicidade no check-in DEVE ser mantida: um veículo só pode ter um check-in por estacionamento.

### Key Entities

- **Veículo**: Entidade independente. Campos: id, fabricante, modelo, placa (única), cor, estacionamento_id (opcional), criado_em, atualizado_em.
- **Pessoa_Veículo**: Tabela de junção (many-to-many). Campos: pessoa_id, veiculo_id.
- **Pessoa**: Entidade existente. Campo carros (JSONB) removido. Campo estacionamento_id removido (agora está no veículo). Mantém tem_estacionamento (booleano).
- **Estacionamento**: Entidade existente. Agora vinculada a veículos (1:1) em vez de pessoas.
- **Check-in**: Entidade existente. Campo carro_id atualizado para referenciar veiculos.id.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Todos os veículos existentes no JSONB pessoas.carros são migrados para a nova tabela veículos com vinculação correta à(s) pessoa(s).
- **SC-002**: A busca por placa no check-in retorna o veículo com os nomes das pessoas associadas em menos de 2 segundos.
- **SC-003**: 100% dos check-ins existentes são atualizados para referenciar veiculos.id corretamente.
- **SC-004**: A tela de check-in exibe corretamente o card do veículo com as pessoas associadas para 100% dos cenários de busca.
- **SC-005**: Não há perda de dados na migração — todos os veículos, vínculos e check-ins são preservados.

## Assumptions

- A placa do veículo é única no sistema (uma placa não pode pertencer a dois veículos diferentes).
- Um veículo pode estar associado a no máximo um estacionamento por vez.
- A migração dos dados do JSONB pessoas.carros para a tabela veículos deve ser feita antes da remoção da coluna.
- Os checkins existentes referenciam carro_id que será mapeado para veiculos.id durante a migração.
- O campo tem_estacionamento na tabela pessoas continua existindo para indicar se a pessoa possui vaga no estacionamento (independente da associação veículo-estacionamento).
- A exclusão de um veículo deve ser bloqueada se existirem check-ins associados a ele.
- A tela de check-in continua sendo pública (sem autenticação), acessada via token.
- O operador de check-in não é identificado (a tela é sempre anônima).

## Clarifications

### Session 2026-07-26

- Q: A placa deve ser única no sistema? → A: Sim, uma placa não pode pertencer a dois veículos diferentes.
- Q: Um veículo pode estar associado a mais de um estacionamento? → A: Não, o relacionamento é 1:1 — cada veículo pode estar em no máximo um estacionamento.
- Q: O campo estacionamento_id na tabela pessoas deve ser removido? → A: Sim, agora o estacionamento está vinculado ao veículo, não à pessoa. O campo tem_estacionamento continua para indicar se a pessoa possui vaga.
