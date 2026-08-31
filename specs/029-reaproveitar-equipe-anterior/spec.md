# Feature Specification: Reaproveitar Equipe da Edicao Anterior

**Feature Branch**: `029-reaproveitar-equipe-anterior`

**Created**: 2026-08-30

**Status**: Draft

**Input**: User description: "Na tela de detalhe da equipe, caso a edição ainda está em 'planejamento', o sistema deve mostrar um sidesheet no lado direito, mostrando as pessoas que estiveram na equipe na edição anterior, com a opção de adicionar como equipista ou coordenador na equipe da edição atual."

## User Scenarios & Testing

### User Story 1 - Visualizar pessoas da equipe na edicao anterior (Priority: P1)

A tela de detalhe de uma equipe, quando a edicao da equipe esta em "planejamento", exibe um painel lateral (sidesheet) no lado direito com a lista das pessoas que participaram daquela equipe na edicao anterior. Cada pessoa aparece com o nome e a funcao que teve (Coordenador ou Equipista). O painel indica visualmente as pessoas que ja estao vinculadas a equipe na edicao atual.

**Why this priority**: Sem o painel nao ha como o organizador visualizar rapidamente quem ja participou da equipe, etapa inicial para recompor o time na edicao em montagem.

**Independent Test**: Pode ser testado abrindo o detalhe de uma equipe de uma edicao em planejamento que possua uma equipe correspondente na edicao anterior, verificando que o painel lateral direito lista as pessoas da edicao anterior com nome e funcao.

**Acceptance Scenarios**:

1. **Given** uma equipe de uma edicao em "planejamento" com equipe correspondente na edicao anterior, **When** o usuario abre a tela de detalhe da equipe, **Then** o sistema exibe um painel lateral no lado direito listando as pessoas que participaram daquela equipe na edicao anterior
2. **Given** o painel lateral exibido, **When** o usuario visualiza cada pessoa, **Then** sao exibidos o nome e a funcao (Coordenador ou Equipista) que a pessoa teve na edicao anterior
3. **Given** o painel lateral exibido, **When** ha pessoas ja vinculadas a equipe na edicao atual, **Then** essas pessoas sao identificadas visualmente como "ja na equipe"
4. **Given** uma equipe de edicao em status diferente de "planejamento", **When** o usuario abre a tela de detalhe, **Then** o painel lateral nao e exibido

---

### User Story 2 - Adicionar pessoa da equipe anterior na equipe atual (Priority: P1)

A partir do painel lateral, o usuario pode adicionar uma pessoa da edicao anterior como Equipista ou como Coordenador na equipe da edicao atual, com um clique na funcao desejada. A pessoa passa a constar na equipe atual com aquela funcao e, no painel, e marcada como ja vinculada. Adicoes invalidas (pessoa em outra equipe da edicao atual ou vaga de coordenador indisponivel) sao bloqueadas com mensagem informativa.

**Why this priority**: E a acao principal da feature — possibilita recompor o time da edicao anterior com poucos cliques dentro da propria tela de detalhe da equipe.

**Independent Test**: Pode ser testado abrindo o painel lateral, clicando em "adicionar como Equipista" ou "adicionar como Coordenador" para uma pessoa, e verificando que a pessoa aparece na listagem de pessoas da equipe na edicao atual com a funcao escolhida e deixa de oferecer nova adicao.

**Acceptance Scenarios**:

1. **Given** o painel lateral exibido com uma pessoa ainda nao vinculada na edicao atual, **When** o usuario aciona "adicionar como Equipista", **Then** a pessoa e vinculada a equipe da edicao atual com funcao Equipista
2. **Given** o painel lateral exibido com uma pessoa ainda nao vinculada na edicao atual, **When** o usuario aciona "adicionar como Coordenador", **Then** a pessoa e vinculada a equipe da edicao atual com funcao Coordenador
3. **Given** uma pessoa adicionada, **When** o painel lateral e atualizado, **Then** a pessoa aparece como ja vinculada e as acoes de adicao deixam de estar disponiveis para ela
4. **Given** uma pessoa ja alocada em outra equipe na edicao atual, **When** o usuario tenta adiciona-la, **Then** o sistema bloqueia a acao e exibe mensagem informando que a pessoa ja esta em outra equipe na edicao atual
5. **Given** uma equipe com as vagas de coordenador preenchidas, **When** o usuario tenta adicionar uma pessoa como Coordenador, **Then** o sistema informa que nao ha vaga de coordenador disponivel

---

### User Story 3 - Estados vazios e indisponibilidade (Priority: P2)

Quando nao ha edicao anterior, quando nao ha equipe correspondente na edicao anterior ou quando nao ha pessoas com cadastro ativo naquela equipe, o painel lateral exibe um estado informativo. Quando o usuario nao possui permissao para alocar pessoas, o painel e exibido somente em modo leitura. Pessoas bloqueadas ou excluidas logicamente nao aparecem na lista.

**Why this priority**: Garante que o painel se comporte corretamente em todos os cenarios de dados e de permissao, evitando telas quebradas ou acoes indevidas.

**Independent Test**: Pode ser testado abrindo o detalhe de equipe em planejamento (1) sem edicao anterior — mensagem informativa; (2) sem equipe correspondente na edicao anterior — mensagem informativa; (3) sem permissao de alocacao — painel somente leitura.

**Acceptance Scenarios**:

1. **Given** uma edicao sem edicao anterior, **When** o usuario abre o detalhe de uma equipe em planejamento, **Then** o painel lateral exibe mensagem informativa de que nao ha dados de edicao anterior
2. **Given** uma edicao anterior sem equipe correspondente ou sem participacoes, **When** o usuario abre o detalhe de uma equipe em planejamento, **Then** o painel lateral exibe mensagem informativa de que nenhuma pessoa foi encontrada
3. **Given** o painel lateral exibido, **When** o usuario nao possui permissao para alocar pessoas na equipe, **Then** o painel e exibido em modo leitura, sem acoes de adicao
4. **Given** pessoas da equipe anterior com cadastro bloqueado ou excluido logicamente, **When** o painel lateral e montado, **Then** essas pessoas nao aparecem na lista

---

### Edge Cases

- O que acontece quando a edicao anterior nao possui nenhuma participacao registrada? O painel exibe estado vazio informativo
- O que acontece quando nao existe edicao anterior (primeira edicao do sistema)? O painel exibe mensagem informativa e nao quebra a tela
- Como a equipe da edicao anterior e identificada? Por nome, desconsiderando sufixos numericos romanos e arabicos (ex.: "Calabresa Chapa I" equivale a "Calabresa Chapa II"), mesma regra do match da montagem de equipes
- O que acontece quando uma pessoa ja esta na equipe atual? Ela e exibida marcada como "ja na equipe", sem acoes de adicao
- O que acontece quando uma pessoa esta em outra equipe da edicao atual? A adicao e bloqueada com mensagem explicativa
- O que acontece quando a equipe ja atingiu as vagas de coordenador? A adicao como Coordenador e bloqueada com mensagem explicativa
- Pessoas bloqueadas ou excluidas logicamente nao aparecem na lista do painel
- O painel lateral somente e exibido para edicoes em "planejamento"; em edicoes "ativa" ou "encerrada" nada muda na tela

## Requirements

### Functional Requirements

- **FR-001**: A tela de detalhe da equipe deve exibir um painel lateral (sidesheet) no lado direito somente quando a edicao da equipe esta em status "planejamento"
- **FR-002**: O painel lateral deve listar as pessoas que participaram da equipe correspondente na edicao anterior, com o nome e a funcao (Coordenador ou Equipista) que tiveram
- **FR-003**: A correspondencia entre a equipe da edicao atual e a da edicao anterior deve ser por nome, desconsiderando sufixos numericos romanos e arabicos
- **FR-004**: A edicao anterior deve ser a edicao imediatamente anterior em numero a edicao da equipe
- **FR-005**: Cada pessoa da lista deve oferecer as acoes "adicionar como Equipista" e "adicionar como Coordenador"
- **FR-006**: Adicionar uma pessoa como Equipista deve vincula-la a equipe da edicao atual com funcao Equipista
- **FR-007**: Adicionar uma pessoa como Coordenador deve vincula-la a equipe da edicao atual com funcao Coordenador
- **FR-008**: Apos a adicao, a pessoa deve ser marcada como ja vinculada no painel e deixar de oferecer acoes de adicao
- **FR-009**: Pessoas ja vinculadas a equipe da edicao atual devem aparecer no painel como "ja na equipe", sem acoes de adicao
- **FR-010**: O sistema deve bloquear a adicao de uma pessoa ja alocada em outra equipe na edicao atual, com mensagem informativa
- **FR-011**: O sistema deve bloquear a adicao como Coordenador quando a equipe ja atingiu suas vagas de coordenador, com mensagem informativa
- **FR-012**: Pessoas com cadastro bloqueado ou excluido logicamente nao devem aparecer na lista do painel
- **FR-013**: Quando nao houver edicao anterior ou equipe correspondente com participacoes, o painel deve exibir estado informativo
- **FR-014**: As acoes de adicao devem exigir a permissao de alocacao de pessoas em equipes; sem ela, o painel deve ser exibido em modo leitura
- **FR-015**: A adicao deve seguir o mesmo fluxo de alocacao existente da tela de detalhe da equipe, com a mesma validacao de vagas e conflitos e os mesmos registros de historico e auditoria
- **FR-016**: Todos os textos, mensagens e confirmacoes devem ser em PT-BR

### Key Entities

- **Equipe**: Entidade existente. A equipe da edicao atual cujo detalhe esta aberto; a correspondencia com a edicao anterior e por nome normalizado
- **Edicao**: Entidade existente, com status "planejamento/ativa/encerrada". Define quando o painel aparece (planejamento) e qual e a edicao anterior (imediatamente anterior em numero)
- **Participacao**: Entidade existente. Registra os vinculos de pessoas a equipes por edicao; fonte das pessoas da equipe anterior e alvo das novas adicoes na edicao atual
- **Pessoa**: Entidade existente. As pessoas listadas no painel; bloqueadas ou excluidas logicamente sao ocultadas

## Success Criteria

### Measurable Outcomes

- **SC-001**: Em edicoes em "planejamento", o painel lateral da equipe e acessivel em ate 2 cliques a partir da tela de detalhe da equipe
- **SC-002**: A lista de pessoas da edicao anterior e exibida em menos de 2 segundos apos a abertura do painel
- **SC-003**: 100% das pessoas com cadastro ativo que participaram da equipe na edicao anterior aparecem no painel
- **SC-004**: Uma pessoa da edicao anterior pode ser adicionada a equipe atual com a funcao escolhida em ate 2 cliques
- **SC-005**: 100% das tentativas de adicionar uma pessoa ja alocada em outra equipe ou coordenador alem das vagas sao bloqueadas com mensagem informativa
- **SC-006**: Em edicoes fora do "planejamento", nenhum painel lateral e exibido na tela de detalhe da equipe

## Assumptions

- "Edicao anterior" refere-se a edicao imediatamente anterior em numero a edicao da equipe, com participacoes registradas no sistema
- A correspondencia de equipes entre edicoes e textual por nome, removendo sufixos numericos romanos (I, II, III, IV, V) e arabicos (1, 2, 3, 4, 5), mesma regra do match da montagem de equipes
- O painel e exibido na tela de detalhe da equipe (rota /edicoes/:edicaoId/barracas/:id) e e visivel para qualquer perfil autenticado; as acoes de adicao seguem a permissao existente de alocacao de pessoas em equipes
- A adicao reusa o fluxo de alocacao existente da tela de detalhe da equipe, com a mesma validacao de vagas e conflitos (pessoa em outra equipe) e os mesmos registros de historico e auditoria
- Pessoas bloqueadas ou excluidas logicamente sao ocultadas da lista, consistente com as demais listagens do sistema
- Pessoas ja vinculadas a equipe da edicao atual nao oferecem acao de adicao; pessoas em outra equipe da edicao atual sao bloqueadas