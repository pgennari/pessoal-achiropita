# Feature Specification: Montagem de Equipes

**Feature Branch**: `022-montagem-equipes`

**Created**: 2026-08-25

**Status**: Draft

**Input**: User description: "Tela de montagem de equipes com pontuacao de match baseada em historico, avaliacoes e presencas. Permissao edicao.montagem. Menu Edicao da Festa > Montagem."

## User Scenarios & Testing

### User Story 1 - Selecionar equipe e visualizar pessoas candidatas (Priority: P1)

Um usuario com permissao edicao.montagem acessa a tela de Montagem (via menu Edicao da Festa > Montagem). A tela carrega com um campo de filtro de equipes e, logo abaixo, uma listagem horizontal de cards representando as equipes da edicao ativa. Ao selecionar uma equipe, uma secao inicialmente vazia exibe as pessoas ja alocadas naquela equipe. Abaixo dessa secao, aparece uma listagem de pessoas candidatas com lazy-loading e rolagem infinita, ordenada por pontuacao de match decrescente.

**Why this priority**: E o fluxo principal da feature — sem a selecao de equipe e a listagem de candidatos, nenhuma outra acao e possivel.

**Independent Test**: Pode ser testado acessando a tela, verificando que as equipes sao exibidas como cards, selecionando uma equipe e confirmando que a lista de pessoas candidatas aparece com lazy-loading e ordenacao por match.

**Acceptance Scenarios**:

1. **Given** um usuario com permissao edicao.montagem na tela de Montagem, **When** a tela carrega, **Then** o sistema exibe um campo de filtro de equipes e uma listagem horizontal de cards das equipes da edicao ativa
2. **Given** a tela de Montagem carregada, **When** o usuario seleciona uma equipe, **Then** o sistema exibe a secao de pessoas alocadas (vazia inicialmente) e a listagem de pessoas candidatas com lazy-loading e rolagem infinita
3. **Given** uma equipe selecionada, **When** o usuario rola a listagem de candidatos, **Then** novas pessoas sao carregadas automaticamente (lazy-loading) e a listagem continua ordenada por match decrescente
4. **Given** a listagem de candidatos exibida, **When** o usuario visualiza cada pessoa, **Then** sao exibidos: nome, pontuacao de match, botao "adicionar Coordenador" (icone user-round-cog) e botao "adicionar Equipista" (icone users-round)
5. **Given** uma equipe selecionada com pessoas ja alocadas, **When** o usuario visualiza a secao de alocados, **Then** as pessoas alocadas sao exibidas com seus dados basicos

---

### User Story 2 - Visualizar detalhes da pessoa e historico de match (Priority: P1)

Ao clicar em uma pessoa na listagem de candidatos, a pessoa e expandida mostrando informacoes detalhadas: foto, idade, detalhamento da pontuacao do match, comentarios e sugestoes da avaliacao da edicao anterior. Dentro da area expandida, um card exibe o detalhamento do match com dados da edicao retrasada, com uma seta na lateral para navegar entre edicoes anteriores ("voltando no tempo").

**Why this priority**: Permite ao organizador tomar decisoes informadas sobre alocacao, entendendo por que uma pessoa tem determinada pontuacao de match.

**Independent Test**: Pode ser testado clicando em uma pessoa da listagem e verificando que todas as informacoes detalhadas sao exibidas, incluindo foto, idade, detalhamento do match, comentarios e navegacao historica.

**Acceptance Scenarios**:

1. **Given** a listagem de candidatos exibida, **When** o usuario clica em uma pessoa, **Then** a pessoa e expandida mostrando foto, idade, detalhamento da pontuacao do match e comentarios/sugestoes da avaliacao da edicao anterior
2. **Given** a area expandida da pessoa, **When** o usuario visualiza o detalhamento do match, **Then** o sistema exibe a pontuacao desagregada por componente (historico na equipe, criterios da avaliacao, convidar novamente, presencas)
3. **Given** a area expandida da pessoa, **When** o usuario visualiza o card de edicao retrasada, **Then** o sistema exibe o detalhamento do match com dados da edicao anterior a anterior (N-2)
4. **Given** o card de edicao retrasada exibido, **When** o usuario clica na seta lateral, **Then** o sistema navega para dados de edicoes anteriores, permitindo "voltar no tempo"
5. **Given** a area expandida da pessoa, **When** o usuario clica novamente na pessoa ou em outra pessoa, **Then** a area expandida anterior e recolhida

---

### User Story 3 - Adicionar pessoa a equipe (Priority: P1)

O organizador, após revisar os detalhes de uma pessoa candidata, pode adiciona-la a equipe selecionada como Coordenador ou Equipista, clicando nos botoes correspondentes. A pessoa e vinculada a equipe na edicao corrente com a funcao selecionada.

**Why this priority**: E a acao final do fluxo de montagem — sem ela, a listagem de candidatos e apenas informativa.

**Independent Test**: Pode ser testado selecionando uma equipe, escolhendo uma pessoa candidata e clicando em "adicionar Coordenador" ou "adicionar Equipista", verificando que a pessoa aparece na secao de alocados e some da listagem de candidatos.

**Acceptance Scenarios**:

1. **Given** uma equipe selecionada e uma pessoa candidata visualizada, **When** o usuario clica no botao "adicionar Coordenador", **Then** a pessoa e vinculada a equipe na edicao corrente com funcao Coordenador
2. **Given** uma equipe selecionada e uma pessoa candidata visualizada, **When** o usuario clica no botao "adicionar Equipista", **Then** a pessoa e vinculada a equipe na edicao corrente com funcao Equipista
3. **Given** uma pessoa recem-adicionada a equipe, **When** a listagem de candidatos e atualizada, **Then** a pessoa adicionada aparece na secao de alocados e nao mais na listagem de candidatos
4. **Given** uma pessoa ja alocada em outra equipe na mesma edicao, **When** o usuario tenta adiciona-la, **Then** o sistema exibe mensagem informando que a pessoa ja esta alocada em outra equipe e bloqueia a alocacao
5. **Given** uma equipe com vagas de coordenador preenchidas, **When** o usuario tenta adicionar outro coordenador, **Then** o sistema informa que as vagas de coordenador estao preenchidas

---

### User Story 4 - Filtrar equipes (Priority: P2)

O organizador pode usar o campo de filtro para buscar equipes por nome, facilitando a localizacao em edicoes com muitas equipes.

**Why this priority**: Funcionalidade auxiliar que melhora a experiencia em edicoes com grande numero de equipes.

**Independent Test**: Pode ser testado digitando texto no campo de filtro e verificando que apenas as equipes cujo nome corresponde ao texto sao exibidas.

**Acceptance Scenarios**:

1. **Given** a tela de Montagem com a listagem de equipes, **When** o usuario digita no campo de filtro, **Then** apenas as equipes cujo nome contem o texto digitado sao exibidas
2. **Given** o campo de filtro com texto, **When** o usuario limpa o campo, **Then** todas as equipes sao exibidas novamente
3. **Given** o campo de filtro com texto que nao corresponde a nenhuma equipe, **When** o usuario visualiza a listagem, **Then** uma mensagem indicando "Nenhuma equipe encontrada" e exibida

---

### Edge Cases

- O que acontece quando nao ha equipes cadastradas na edicao? O sistema exibe estado vazio informativo na listagem de equipes
- O que acontece quando uma pessoa nao possui avaliacao na edicao anterior? O componente de match por avaliacao retorna 0 pontos
- O que acontece quando uma pessoa nao possui historico de participacao em nenhuma equipe? O componente de historico retorna 0 pontos
- O que acontece quando nao ha edicao anterior (primeira edicao)? O sistema exibe apenas os dados disponiveis (historico e presencas da edicao corrente, se houver)
- O que acontece quando a pessoa ja esta alocada na equipe selecionada? A pessoa aparece na secao de alocados e nao na listagem de candidatos
- O que acontece quando o coordenador ja esta definido na equipe e o usuario tenta adicionar outro? O sistema informa que a vaga de coordenador esta ocupada
- Como o sistema compara nomes de equipes entre edicoes ignorando numeracao? A comparacao textual remove sufixos como "I", "II", "III" antes de comparar

## Requirements

### Functional Requirements

- **FR-001**: A tela de Montagem deve ser acessivel pelo menu Edicao da Festa > Montagem, com permissao obrigatoria edicao.montagem
- **FR-002**: A tela deve exibir um campo de filtro de equipes e uma listagem horizontal de cards das equipes da edicao ativa
- **FR-003**: O campo de filtro deve filtrar equipes por nome em tempo real
- **FR-004**: Ao selecionar uma equipe, o sistema deve exibir a secao de pessoas alocadas e a listagem de pessoas candidatas
- **FR-005**: A listagem de candidatos deve usar lazy-loading com rolagem infinita
- **FR-006**: A listagem de candidatos deve ser ordenada por pontuacao de match em ordem decrescente
- **FR-007**: Cada pessoa na listagem deve exibir: nome, pontuacao de match, botao "adicionar Coordenador" e botao "adicionar Equipista"
- **FR-008**: Ao clicar em uma pessoa, a pessoa deve ser expandida mostrando: foto, idade, detalhamento da pontuacao do match e comentarios/sugestoes da avaliacao da edicao anterior
- **FR-009**: A area expandida deve conter um card com detalhamento do match da edicao retrasada (N-2) com navegacao por setas entre edicoes anteriores
- **FR-010**: O botao "adicionar Coordenador" deve vincular a pessoa a equipe selecionada com funcao Coordenador na edicao corrente
- **FR-011**: O botao "adicionar Equipista" deve vincular a pessoa a equipe selecionada com funcao Equipista na edicao corrente
- **FR-012**: O sistema deve bloquear alocacao de pessoa ja alocada em outra equipe na mesma edicao
- **FR-013**: O sistema deve informar quando vagas de coordenador estao preenchidas
- **FR-014**: A pontuacao de match deve ser calculada conforme as regras definidas na secao Match
- **FR-015**: Todos os textos de interface, mensagens e confirmacoes devem ser em PT-BR
- **FR-016**: A permissao edicao.montagem deve ser criada e disponibilizada no sistema de permissoes

### Match

O match e uma pontuacao de 0 a 100 pontos baseada nas seguintes regras:

- **Historico na equipe (0-50 pontos)**: Se a pessoa possui historico de participacao na equipe (em edicoes anteriores), recebe 50 pontos. A comparacao da equipe entre edicoes e feita textualmente, considerando apenas o nome sem a numeracao (ex.: "Calabresa Chapa I" equivale a "Calabresa Chapa II")
- **Criterios da avaliacao (0-30 pontos)**: Na avaliacao da pessoa da edicao anterior, cada um dos seis criterios (Pontualidade, Dedicacao, Companheirismo, Espiritualidade, Comprometimento, Uniforme) soma pontos: Otimo = 5 pontos, Bom = 3 pontos, Regular = 1 ponto, Ruim = 0 pontos
- **Convidar novamente (0-10 pontos)**: A resposta a pergunta "Quais as chances de convidar novamente essa pessoa para sua equipe?" (escala 1-5) e multiplicada por 2 antes de ser somada
- **Presencas (0-10 pontos)**: Cada dia de presenca registrado na edicao anterior soma 1 ponto (ate 10 pontos maximo)

### Key Entities

- **Equipe**: Equipe da edicao (entidade existente). Cada equipe tem nome, setor e vagas para coordenador e equipista
- **Pessoa**: Pessoa cadastrada no sistema (entidade existente). Contem dados pessoais, foto e historico de participacoes
- **Participacao**: Vinculo de uma pessoa a uma equipe na edicao corrente com funcao (Coordenador ou Equipista). Existente, criada ao adicionar pessoa via botao
- **Avaliacao**: Avaliacao de um equipista por um coordenador em edicao anterior (entidade existente). Contem 6 criterios, convidar novamente e comentarios
- **Presenca**: Registro de presenca de uma pessoa em um dia de festa (entidade existente)
- **Edicao**: Edicao da festa (entidade existente). Contexto para equipes, participacoes e avaliacoes
- **HistoricoParticipacao**: Registro historico de participacao de pessoa em edicoes anteriores (entidade existente)

## Success Criteria

### Measurable Outcomes

- **SC-001**: Usuarios com permissao edicao.montagem conseguem acessar a tela de Montagem em ate 2 cliques a partir do menu
- **SC-002**: A listagem de equipes e exibida em menos de 2 segundos apos o carregamento da tela
- **SC-003**: A listagem de candidatos com lazy-loading carrega o primeiro lote em menos de 3 segundos
- **SC-004**: O detalhamento do match e exibido instantaneamente ao clicar em uma pessoa (sem nova requisicao)
- **SC-005**: 100% das alocacoes sao validadas contra vagas disponiveis e conflitos existentes
- **SC-006**: A navegacao historica de match funciona para todas as edicoes em que a pessoa possui avaliacao
- **SC-007**: A pontuacao de match e exibida de forma transparente, com todos os componentes desagregados visiveis ao usuario

## Assumptions

- A tela de Montagem e acessivel apenas por usuarios com permissao edicao.montagem (ADM por padrao, ORG tambem)
- A edicao ativa e a referencia para todas as operacoes (equipes, participacoes, avaliacoes)
- A avaliacao da "edicao anterior" refere-se a edicao imediatamente anterior a edicao ativa
- A "edicao retrasada" na area expandida refere-se a edicao N-2 (duas edicoes antes da ativa)
- A navegacao historica permite voltar ate a edicao mais antiga em que a pessoa possui avaliacao
- A normalizacao de nomes de equipes para comparacao historica remove sufixos numericos romanos (I, II, III, IV, V) e arabicos (1, 2, 3, 4, 5)
- O componente de match funciona mesmo quando nao ha avaliacao disponivel (retorna 0 para os componentes ausentes)
- Lazy-loading carrega lotes de 20 pessoas por vez
- A pontuacao de presencas e limitada a 10 pontos maximo (ate 10 dias de presenca)
- Apenas avaliacoes com status "Finalizada" sao consideradas para o calculo de match
- A listagem de candidatos exclui pessoas ja alocadas na equipe selecionada e pessoas inativas
