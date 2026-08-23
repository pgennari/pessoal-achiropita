# Feature Specification: Relatorio de Avaliacoes de Equipistas

**Feature Branch**: `021-relatorio-avaliacoes`

**Created**: 2026-08-23

**Status**: Draft

**Input**: User description: "Criar um relatório de avaliações, onde deve ser possível filtrar cada um dos critérios pelos valores possíveis"

## Clarifications

### Session 2026-08-23

- Q: O termo "avaliacoes" no relatorio refere-se as avaliacoes de equipistas ou as respostas da pesquisa de satisfacao da cantina? → A: Avaliacoes de equipistas (feature 019); relatorio na secao "Relatorios", sobre a edicao ativa

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Filtrar avaliacoes pelos valores de cada criterio (Priority: P1)

Um usuario autorizado abre a pagina "Relatorios > Avaliacoes" no menu do sistema. O relatorio lista as avaliacoes de equipistas da edicao ativa — rascunhos e finalizadas, cada uma com indicador visual do status. Para cada campo de criterio da avaliacao, a pagina oferece um filtro com os valores possiveis daquele campo: Otimo/Bom/Regular/Ruim para Pontualidade, Dedicacao, Companheirismo, Espiritualidade, Comprometimento e Uniforme; notas de 1 a 5 para "Chances de convidar novamente". Ao marcar um ou mais valores em um criterio, a listagem passa a exibir somente as avaliacoes cujo valor daquele criterio corresponde a um dos valores marcados. Valores marcados dentro do mesmo criterio se combinam como "ou" (basta atender um deles); filtros de criterios diferentes se combinam como "e" (a avaliacao precisa atender todos os criterios filtrados). Um contador informa quantas avaliacoes atendem aos filtros vigentes.

**Why this priority**: E o nucleo do pedido — sem a filtragem por valor de criterio, o relatorio nao existe. Permite, por exemplo, localizar rapidamente todos os equipistas avaliados com "Ruim" em algum criterio ou com nota baixa de "convidar novamente".

**Independent Test**: Pode ser testado com um conjunto conhecido de avaliacoes registradas na edicao ativa: aplicar filtro por um valor de criterio e conferir que somente os registros correspondentes permanecem; combinar dois criterios e conferir a intersecao; limpar filtros e conferir o retorno da listagem completa.

**Acceptance Scenarios**:

1. **Given** o relatorio aberto com avaliacoes registradas na edicao ativa, **When** nenhum valor de filtro esta marcado, **Then** todas as avaliacoes da edicao sao exibidas, ordenadas da atualizacao mais recente para a mais antiga
2. **Given** o relatorio aberto, **When** o usuario marca o valor "Ruim" no filtro do criterio Pontualidade, **Then** somente as avaliacoes com pontualidade "Ruim" permanecem visiveis
3. **Given** o filtro de Pontualidade com "Ruim" marcado, **When** o usuario marca tambem "Regular" no mesmo criterio, **Then** a listagem exibe as avaliacoes com pontualidade "Ruim" ou "Regular"
4. **Given** o filtro de Pontualidade com "Ruim" ou "Regular" marcado, **When** o usuario marca as notas 1 e 2 no filtro "Chances de convidar novamente", **Then** a listagem exibe apenas as avaliacoes que atendem as duas condicoes ao mesmo tempo (pontualidade Ruim/Regular e nota de retorno 1 ou 2)
5. **Given** filtros aplicados em mais de um criterio, **When** o usuario desmarca todos os valores marcados, **Then** a listagem retorna ao conteudo completo da edicao sem recarregar a pagina
6. **Given** qualquer alteracao de filtros, **When** a listagem e atualizada, **Then** o contador de resultados reflete a quantidade exata de avaliacoes que atendem aos filtros vigentes
7. **Given** uma avaliacao em rascunho cujos criterios ainda nao foram preenchidos, **When** o usuario aplica um filtro em qualquer criterio, **Then** essa avaliacao nao aparece no resultado (nao possui valor que corresponda ao filtro)

---

### User Story 2 - Resumo do relatorio (Priority: P2)

Acima da listagem, o relatorio apresenta um resumo numerico: total de avaliacoes da edicao, total de avaliacoes apos os filtros vigentes e, para cada criterio, a contagem de respostas por valor possivel (por exemplo, Pontualidade: 12 Otimo, 30 Bom, 8 Regular, 2 Ruim). O resumo acompanha os filtros: as contagens por valor refletem o universo restante apos a aplicacao dos demais filtros.

**Why this priority**: Transforma a lista filtrada em relatorio propriamente dito — a organizacao enxata a distribuicao das notas sem abrir registro por registro. Depende apenas dos dados ja presentes na US-1.

**Independent Test**: Pode ser testado comparando as contagens exibidas com os totais conhecidos da massa de dados, antes e depois de aplicar filtros.

**Acceptance Scenarios**:

1. **Given** o relatorio aberto sem filtros, **When** o usuario visualiza o resumo, **Then** o total de avaliacoes da edicao e exibido junto com a distribuicao por valor de cada criterio
2. **Given** o filtro "Ruim" ativo no criterio Uniforme, **When** o usuario visualiza o resumo do criterio Pontualidade, **Then** as contagens por valor consideram somente as avaliacoes com uniforme "Ruim"
3. **Given** filtros que resultam em nenhuma avaliacao, **When** o usuario visualiza o resumo, **Then** os totais exibidos sao zero, coerentes com a listagem vazia

---

### User Story 3 - Abrir o detalhe de uma avaliacao a partir do relatorio (Priority: P3)

Ao selecionar um registro no relatorio, o usuario visualiza o detalhe completo da avaliacao: pessoa avaliada, equipe, avaliador, status, valor de cada um dos seis criterios, nota de "Chances de convidar novamente", aptidao a coordenar, comentarios e datas de criacao/atualizacao/finalizacao.

**Why this priority**: Fecha o ciclo de analise — encontrou pelo filtro, confere o contexto completo. Reapresenta informacao ja existente em outras telas, sem fluxo novo de dados.

**Independent Test**: Pode ser testado selecionando qualquer registro do relatorio e conferindo que todos os campos da avaliacao sao apresentados corretamente.

**Acceptance Scenarios**:

1. **Given** o relatorio com registros visiveis, **When** o usuario seleciona um registro, **Then** o detalhe completo da avaliacao e exibido com todos os campos preenchidos na avaliacao
2. **Given** o detalhe de uma avaliacao em rascunho aberto, **When** o usuario visualiza os criterios ainda nao preenchidos, **Then** esses criterios aparecem indicados como sem resposta, sem impedir a visualizacao dos demais

---

### Edge Cases

- Rascunhos com criterios incompletos aparecem na listagem sem filtros (com status visivel) e somem do resultado quando um filtro ativo exige um criterio que a avaliacao nao tem
- Nenhuma avaliacao registrada na edicao ativa: estado vazio orienta que as avaliacoes sao realizadas pelo link publico da edicao
- Filtros que resultam em zero registros: estado vazio especifico ("nenhuma avaliacao corresponde aos filtros") acompanhado de acao para limpar todos os filtros de uma vez
- Uma mesma avaliacao nunca aparece duplicada no resultado, independentemente da quantidade de valores marcados em um mesmo criterio
- Volume alto de avaliacoes (milhares): a listagem e o resumo permanecem responsivos, sem travar a pagina
- Alteracao de filtros durante carregamento: o resultado final corresponde sempre aos filtros vigentes na tela

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema deve oferecer uma pagina de relatorio de avaliacoes acessivel pela secao "Relatorios" do menu principal, visivel apenas para perfis autorizados (ADM e Organizacao, mesmos perfis que gerenciam avaliacoes)
- **FR-002**: O relatorio deve operar sobre as avaliacoes de equipistas realizadas via link publico pelos coordenadores (feature 019)
- **FR-003**: O relatorio deve considerar as avaliacoes da edicao ativa do sistema
- **FR-004**: A listagem deve incluir avaliacoes em rascunho e finalizadas, com indicador visual do status em cada registro
- **FR-005**: Cada registro listado deve apresentar: pessoa avaliada, equipe, avaliador, status, valores dos seis criterios, nota de "Chances de convidar novamente", aptidao a coordenar e data da ultima atualizacao
- **FR-006**: Para cada um dos criterios Pontualidade, Dedicacao, Companheirismo, Espiritualidade, Comprometimento e Uniforme, o sistema deve oferecer filtro com os valores possiveis: Otimo, Bom, Regular e Ruim
- **FR-007**: Para o campo "Chances de convidar novamente", o sistema deve oferecer filtro com os valores possiveis: notas inteiras de 1 a 5
- **FR-008**: Cada filtro deve permitir marcar multiplos valores; sem nenhum valor marcado, o criterio nao restringe o resultado
- **FR-009**: Valores marcados no mesmo criterio devem se combinar como alternancia (atende qualquer um); filtros de criterios diferentes devem se combinar como conjuncao (atende todos)
- **FR-010**: A aplicacao ou alteracao de filtros deve atualizar a listagem e o contador imediatamente, sem recarregar a pagina
- **FR-011**: O relatorio deve exibir contador com a quantidade de avaliacoes resultante dos filtros vigentes
- **FR-012**: O relatorio deve apresentar resumo com total geral da edicao, total apos filtros e contagem por valor possivel de cada criterio, coerente com os filtros vigentes
- **FR-013**: O relatorio deve oferecer comando para limpar todos os filtros de uma vez
- **FR-014**: A ordenacao padrao deve ser pela data de atualizacao, da mais recente para a mais antiga
- **FR-015**: Ao selecionar um registro, o sistema deve exibir o detalhe completo da avaliacao (criterios, nota de retorno, aptidao, comentarios, avaliador, equipe, pessoa avaliada, status e datas)
- **FR-016**: Estados vazios devem ser informativos: sem avaliacoes na edicao; sem resultados para os filtros aplicados (com acao de limpar filtros)
- **FR-017**: Todos os textos de interface, rotulos e mensagens devem estar em PT-BR
- **FR-018**: A pagina deve seguir o guia visual do projeto (paleta, tipografia e componentes de referencia), inclusive em telas de celular

### Key Entities *(include if feature involves data)*

- **Avaliacao**: Registro existente da avaliacao de um equipista por seu coordenador. Contem: pessoa avaliada, equipe, avaliador, edicao, seis criterios com valores Otimo/Bom/Regular/Ruim, nota de 1 a 5 de "Chances de convidar novamente", aptidao a coordenar (Sim/Nao), comentarios, status (Rascunho/Finalizada) e datas de criacao, atualizacao e finalizacao. E o objeto central do relatorio.
- **Edicao**: Edicao da festa (entidade existente). Delimita o universo do relatorio — a edicao ativa.
- **Equipe**: Equipe da edicao (entidade existente). Exibida em cada registro e utilizavel para leitura contextual dos resultados.
- **Pessoa**: Pessoa cadastrada (entidade existente). Aparece como avaliada (equipista) ou avaliador (coordenador) nos registros e no detalhe.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um usuario autorizado localiza e abre o relatorio de avaliacoes em no maximo 2 cliques a partir do menu
- **SC-002**: Com algumas centenas de avaliacoes registradas, aplicar ou alterar qualquer filtro atualiza a listagem e o resumo em menos de 2 segundos
- **SC-003**: 100% dos registros exibidos satisfazem todas as condicoes dos filtros vigentes (zero falsos positivos/negativos na filtragem)
- **SC-004**: Um gestor identifica todas as avaliacoes com valor critico (por exemplo, "Ruim") em um criterio escolhido em menos de 30 segundos
- **SC-005**: As contagens do resumo batem 100% com os totais reais da massa de dados, antes e depois de aplicar filtros
- **SC-006**: 9 em cada 10 usuarios concluem uma tarefa de filtragem (ex.: encontrar equipistas com nota baixa em dois criterios simultaneamente) sem auxilio externo

## Assumptions

- O termo "avaliacoes" foi confirmado pelo usuario em 2026-08-23 como as avaliacoes de equipistas (feature 019); respostas da pesquisa da cantina (feature 020) ficam fora do escopo deste relatorio
- O relatorio cobre apenas a edicao ativa, padrao adotado pelos demais relatorios do sistema; analise retroativa de edicoes anteriores fica fora desta versao
- Rascunhos entram no relatorio (com status visivel), pois seus criterios preenchidos sao dados validos para filtragem; o detalhe indica criterios sem resposta
- Aptidao a coordenar, comentarios, equipe, avaliador e status nao recebem filtros nesta versao — o pedido restringe-se aos criterios e aos seus valores possiveis; esses campos continuam visiveis nos registros e no detalhe
- Sem exportacao (CSV/PDF) nem impressao nesta versao
- O acesso acompanha os perfis que ja gerenciam avaliacoes (ADM e Organizacao), sem permissao nova dedicada
- A interface reutiliza os componentes e padroes visuais existentes (chips de filtro, cards, badges, tabelas/listagens)
