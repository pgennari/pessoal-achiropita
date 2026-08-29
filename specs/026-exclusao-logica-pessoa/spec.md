# Feature Specification: Exclusao logica de pessoas

**Feature Branch**: `026-exclusao-logica-pessoa`

**Created**: 2026-08-29

**Status**: Draft

**Input**: User description: "Transforma a exclusão da Pessoa em exclusão lógica"

## Clarifications

### Session 2026-08-29

- Q: Destino do cadastro do veiculo desvinculado na exclusao de uma pessoa → A: O cadastro do veiculo, caso nao esteja vinculado a nenhuma outra pessoa, tambem e excluido logicamente; quando ainda vinculado a outra pessoa, permanece ativo
- Q: Alcance da regra do veiculo orfao → A: Vale somente quando o desvinculo acontece dentro da exclusao da pessoa; desvincular manualmente a ultima pessoa na tela do veiculo continua como esta hoje

## User Scenarios & Testing

### User Story 1 - Organizador exclui uma pessoa e o sistema preserva o registro, desfazendo os vinculos ativos (Priority: P1)

Um organizador com permissao de excluir pessoas abre o cadastro de uma pessoa e aciona a exclusao. O sistema pede confirmacao e informa quantos vinculos ativos serao desfeitos naquele momento (equipes em que a pessoa esta alocada, veiculos vinculados e vaga de estacionamento). Ao confirmar, o sistema desfaz todos os vinculos de uma unica vez, marca a pessoa como excluida (o registro e preservado, mas deixa de valer como cadastro ativo) e a pessoa desaparece de todas as telas. Cada veiculo que fica sem nenhuma outra pessoa vinculada tambem e excluido logicamente: o cadastro e preservado e oculto. Um veiculo compartilhado com outra pessoa permanece ativo. Nem a pessoa nem os cadastros relacionados (equipes, veiculos, vagas, estacionamentos, parentes) sao apagados ou perdidos.

**Why this priority**: E o fluxo principal da feature — o organizador precisa conseguir "apagar" uma pessoa de forma segura, sem perder o registro nem onerar a desvinculacao manual de cada cadastro relacionado.

**Independent Test**: Pode ser testado com uma pessoa alocada em equipes, com veiculo vinculado e vaga de estacionamento: excluir a pessoa, confirmar o aviso com a contagem e verificar que todos os vinculos foram desfeitos, a pessoa deixou de aparecer, o registro continua preservado e o veiculo ja sem outros donos tambem deixou de aparecer (ou permaneceu ativo, se compartilhado).

**Acceptance Scenarios**:

1. **Given** uma pessoa com N vinculos ativos (alocacoes em equipes, veiculos e vaga de estacionamento), **When** o organizador confirma a exclusao, **Then** os N vinculos sao desfeitos automaticamente em uma unica operacao, sem acao individual
2. **Given** uma pessoa sem vinculos ativos, **When** o organizador confirma a exclusao, **Then** a pessoa deixa de aparecer sem afetar nenhum outro cadastro
3. **Given** o dialogo de confirmacao da exclusao, **When** a pessoa possui vinculos ativos, **Then** o aviso informa a quantidade exata de vinculos que serao desfeitos antes da confirmacao
4. **Given** uma pessoa sendo excluida, **When** a operacao termina, **Then** nenhum cadastro de equipe, veiculo, vaga, estacionamento ou parente e apagado; os veiculos sem outras pessoas vinculadas passam a exclusao logica com o registro preservado
5. **Given** uma pessoa excluida, **When** a auditoria e consultada, **Then** o evento registra quem excluiu, quando e a identificacao (nome + cracha), sem redacao de apagamento permanente
6. **Given** uma pessoa vinculada a um veiculo compartilhado com outra pessoa, **When** a primeira pessoa e excluida, **Then** o vinculo e desfeito e o veiculo permanece ativo por causa da outra pessoa
7. **Given** uma pessoa cujo unico veiculo nao e compartilhado com ninguem, **When** a pessoa e excluida, **Then** o veiculo tambem e excluido logicamente: deixa de aparecer nas telas e o registro e preservado

---

### User Story 2 - Pessoa excluida nao aparece em lugar nenhum do sistema (Priority: P1)

Apos a exclusao, a pessoa fica invisivel para todos os usuarios, com e sem sessao: nao aparece em listagens de pessoas, busca global, painel, relatorios, sincronizacao, alocacoes e escalas de equipes, estacionamento, veiculos, seletores nem qualquer associacao de outra tela. Tambem nao aparece nos fluxos publicos: validacao por cracha e pesquisa de cantina. Um link direto para a pessoa excluida resulta em "nao encontrada" e nao permite visualizar, editar, reativar, bloquear nem desbloquear.

**Why this priority**: A regra de invisibilidade e o que garante a semantica de "excluida" — sem ela, a pessoa continuaria "existindo" para o usuario de outras formas.

**Independent Test**: Pode ser testado apos excluir uma pessoa: abrir a listagem, a busca global, o painel, os relatorios, a alocacao de uma equipe e o fluxo publico de validacao e confirmar que a pessoa nao aparece em nenhum; abrir o link direto da pessoa e ver "nao encontrada".

**Acceptance Scenarios**:

1. **Given** uma pessoa excluida, **When** qualquer usuario abre a listagem de pessoas ou a busca global, **Then** a pessoa excluida nao aparece
2. **Given** uma pessoa excluida, **When** qualquer usuario abre o painel, relatorios, sincronizacao ou telas de alocacao/escala de equipes, **Then** a pessoa excluida nao aparece em nenhum momento
3. **Given** uma pessoa excluida, **When** o usuario escolhe uma pessoa em qualquer seletor do sistema (vincular veiculo, ocupar vaga, associar parente, alocar em equipe etc.), **Then** a pessoa excluida nao aparece entre as opcoes
4. **Given** uma pessoa excluida, **When** um visitante valida o cracha dela no fluxo publico ou a consulta na pesquisa de cantina, **Then** o sistema responde "nao encontrada" e nao exibe nenhum dado
5. **Given** uma pessoa excluida, **When** o usuario abre o link/identificador direto dela, **Then** o sistema apresenta a pessoa como "nao encontrada", sem exibir dados nem permitir edicao, reativacao ou bloqueio

---

### User Story 3 - Dados historicos da pessoa e dos veiculos sao preservados (Priority: P2)

A exclusao de uma pessoa nao apaga nem corrompe dados historicos que ja existiam: historico de equipes, presencas, avaliacoes, formacoes, check-ins de estacionamento e eventos de auditoria passados permanecem armazenados e intactos. O mesmo vale para os veiculos excluidos logicamente junto: o cadastro e o historico de estacionamentos anteriores ficam mantidos para referencia, apenas sem uso funcional. O registro da propria pessoa fica mantido, apenas sem uso funcional.

**Why this priority**: Evita perda de informacao — o historico da pessoa na festa nao deve sumir junto com a exclusao.

**Independent Test**: Pode ser testado excluindo uma pessoa que possua historico registrado (equipes, presenca ou avaliacao) e conferindo no banco que os registros antigos continuam presentes e coerentes apos a exclusao.

**Acceptance Scenarios**:

1. **Given** uma pessoa com registros historicos (equipes, presencas, avaliacoes, formacoes, check-ins) ja gravados, **When** a pessoa e excluida, **Then** esses registros permanecem armazenados sem exclusao nem corrupcao
2. **Given** uma pessoa com vinculos desfeitos na exclusao (alocacoes em equipes), **When** a pessoa e excluida, **Then** a desvinculacao fica registrada no historico da pessoa, preservando a trilha
3. **Given** um veiculo excluido logicamente junto com a pessoa, **When** o historico de estacionamentos do veiculo e consultado, **Then** os registros anteriores permanecem armazenados e coerentes

---

### Edge Cases

- O que acontece com uma pessoa com vinculos ativos? Todos os vinculos (alocacoes em equipes, veiculos, vaga de estacionamento e parentesco) sao desfeitos automaticamente na exclusao
- O que acontece com uma pessoa sem vinculos ativos? E excluida normalmente, sem efeito sobre outros cadastros
- O que acontece com a vaga de estacionamento cuja unica pessoa ocupante e excluida? A vaga fica livre para receber outra pessoa
- O que acontece com os parentes da pessoa excluida? Os lacos de parentesco sao removidos nos dois sentidos, sem apagar os cadastros dos parentes
- O que acontece com um veiculo vinculado a mais de uma pessoa quando uma delas e excluida? O vinculo da pessoa excluida e desfeito e o veiculo permanece ativo por causa da(s) outra(s) pessoa(s)
- O que acontece com um veiculo que, ao ser desvinculado da pessoa excluida, fica sem nenhuma outra pessoa? O veiculo tambem e excluido logicamente: registro preservado, placa reservada, sem uso funcional
- O que acontece com um veiculo cuja ultima pessoa e desvinculada manualmente na tela do veiculo? O vinculo e removido e o veiculo permanece ativo — a regra do veiculo orfao vale somente para a exclusao de pessoa
- O que acontece com um veiculo excluido logicamente que possui historico de estacionamentos? A exclusao e permitida normalmente; o historico permanece armazenado (a retencao que hoje trava a exclusao fisica nao se aplica a exclusao logica)
- O que acontece se o usuario tentar excluir um veiculo ja excluido logicamente? O sistema trata como "nao encontrado", sem erro inesperado
- O que acontece se a pessoa excluida esta bloqueada ou tem bloqueio pendente? A pessoa desaparece e o estado de bloqueio deixa de ser visivel e operacional, sem erro para nenhum usuario
- O que acontece com uma pessoa inativa que e excluida? A exclusao e permitida normalmente; inativacao e exclusao sao estados independentes
- O que acontece se o usuario tentar excluir uma pessoa ja excluida? O sistema trata como "nao encontrada", sem erro inesperado
- O que acontece se o cracha da pessoa excluida for cadastrado novamente? O cracha permanece reservado; o sistema nao reutiliza o numero de cracha de uma pessoa excluida
- O que acontece se um visitante estiver validando a pessoa no exato momento da exclusao? A validacao responde "nao encontrada", sem exibir dados
- O que acontece se dois organizadores excluirem a mesma pessoa ao mesmo tempo? A segunda acao conclui como "nao encontrada", sem duplicar efeitos nem corromper dados

## Requirements

### Functional Requirements

- **FR-001**: O sistema deve permitir excluir (logicamente) uma pessoa, preservando o registro no banco e a foto em vez de apaga-los
- **FR-002**: Ao excluir uma pessoa, o sistema deve desfazer automaticamente todos os vinculos ativos em uma unica operacao — alocacoes em equipes (com registro no historico), veiculos vinculados, vaga de estacionamento e lacos de parentesco nos dois sentidos — e excluir logicamente cada veiculo que fique sem nenhuma outra pessoa vinculada
- **FR-003**: Antes de confirmar a exclusao, o sistema deve informar ao organizador a quantidade de vinculos ativos que serao desfeitos e quantos veiculos ficarao sem pessoas vinculadas (e, portanto, tambem serao excluidos logicamente)
- **FR-004**: Pessoas excluidas nao devem aparecer em listagens, busca global, painel, relatorios, sincronizacao, alocacoes e escalas de equipe, estacionamento, veiculos nem seletores em nenhuma tela do sistema
- **FR-005**: Pessoas excluidas nao devem aparecer nem ser aceitas nos fluxos publicos: validacao por cracha e pesquisa de cantina devem responder "nao encontrada"
- **FR-006**: O acesso por link direto a uma pessoa excluida deve resultar em "nao encontrada", sem exibir dados nem permitir editar, reativar, bloquear ou desbloquear
- **FR-007**: Registros historicos associados a pessoa (historicos de equipes, presencas, avaliacoes, formacoes, check-ins de estacionamento e eventos de auditoria ja gravados) devem ser preservados, sem exclusao ou corrupcao
- **FR-008**: A exclusao de uma pessoa deve ficar registrada na trilha de auditoria do sistema, com quem e quando, e a redacao do evento deve deixar de sugerir apagamento permanente
- **FR-009**: A acao de excluir pessoa deve exigir a permissao ja existente de exclusao de pessoas, sem criar novo perfil ou acesso
- **FR-010**: O numero de cracha de uma pessoa excluida deve permanecer reservado e nao deve ser reutilizado por outro cadastro
- **FR-011**: Todas as mensagens e textos de interface envolvidos devem permanecer em PT-BR; o dialogo de confirmacao deve deixar de usar termos como "definitivamente", "irreversivel" e "removeu permanentemente"
- **FR-012**: Um veiculo desvinculado na exclusao da pessoa deve ser excluido logicamente quando nao restar nenhuma outra pessoa vinculada a ele
- **FR-013**: Um veiculo que ainda possuir outras pessoas vinculadas deve permanecer ativo, sem qualquer alteracao no cadastro
- **FR-014**: Veiculos excluidos logicamente nao devem aparecer em listagens de veiculos, seletores, associacao de pessoas nem fluxos de estacionamento; o acesso direto deve resultar em "nao encontrado"
- **FR-015**: Registros historicos de um veiculo excluido logicamente (estacionamentos e check-ins anteriores) devem ser preservados; o numero da placa do veiculo excluido permanece reservado e nao deve ser reutilizado

### Key Entities

- **Pessoa**: Cadastro de um membro. Passa a ter estado de "ativa" ou "excluida"; o registro excluido conserva identificacao, dados e foto para referencia, sem uso funcional
- **Participacao (alocacao)**: Vinculo ativo entre pessoa e equipe na edicao. E desfeito automaticamente para todas as equipes quando a pessoa e excluida
- **Vinculo de veiculo**: Associacao pessoa-veiculo. E desfeito na exclusao da pessoa; se era a ultima associacao, o veiculo tambem e excluido logicamente
- **Veiculo**: Cadastro de um carro, vinculado a uma ou mais pessoas. Passa a ter estado de "ativo" ou "excluido" quando fica sem nenhuma pessoa vinculada na exclusao de uma pessoa; o registro excluido conserva dados e placa para referencia, sem uso funcional
- **Vaga de estacionamento**: Associacao pessoa-vaga. E desfeita na exclusao, liberando a vaga para outra pessoa
- **Parentesco**: Laco bidirecional entre duas pessoas. E removido nos dois sentidos na exclusao, sem apagar os cadastros dos parentes
- **Historico**: Registros temporais da pessoa (equipes, presencas, avaliacoes, formacoes, check-ins). Preservados integros apos a exclusao; a desvinculacao de equipes fica registrada nele
- **Auditoria**: Trilha de eventos. Guarda quem excluiu a pessoa e quando

## Success Criteria

### Measurable Outcomes

- **SC-001**: Excluir uma pessoa desfaz 100% dos vinculos ativos em uma unica confirmacao, sem passos extras por vinculo
- **SC-002**: Em 100% das telas logadas e publicas (listagens, busca, painel, relatorios, seletores, validacao e cantina) a pessoa excluida nao aparece
- **SC-003**: O acesso direto ao link de uma pessoa excluida nunca permite visualizar, editar, reativar ou bloquear — sempre resulta em "nao encontrada"
- **SC-004**: Apos a exclusao, nenhum registro historico e perdido ou alterado indevidamente (0 perdas)
- **SC-005**: O organizador conclui a exclusao de uma pessoa, inclusive com vinculos ativos, em menos de 5 segundos
- **SC-006**: Um veiculo que fica sem nenhuma pessoa vinculada na exclusao e ocultado de 100% das telas; um veiculo compartilhado nunca e excluido nem alterado

## Assumptions

- A exclusao e definitiva na interface: nao ha restauracao de pessoa no escopo desta feature
- O registro da pessoa e a foto permanecem armazenados; nada e apagado do banco nem do armazenamento de fotos
- O cracha de uma pessoa excluida permanece reservado e nao e reutilizado
- A inativacao (estado ja existente que retira a pessoa do quadro corrente sem apagar o registro) continua existindo como estado separado e independente da exclusao
- Vinculos ativos (alocacoes em equipes, veiculos, vaga de estacionamento e parentesco) sao desfeitos na exclusao; o historico correspondente e preservado, inclusive o registro da desvinculacao de equipes
- Veiculos que ficam sem nenhuma pessoa vinculada na exclusao da pessoa sao excluidos logicamente junto; o registro e a placa permanecem armazenados e reservados
- A regra do veiculo orfao se aplica somente ao desvinculo provocado pela exclusao de pessoa; desvincular manualmente a ultima pessoa na tela do veiculo nao exclui o veiculo
- A exclusao logica do veiculo prevalece sobre a retencao atual do fluxo fisico: historico de estacionamentos nao impede a exclusao logica, pois o registro e preservado
- Pessoas excluidas ficam ocultas tambem de relatorios e fluxos publicos; os dados subjacentes permanecem armazenados no banco
- A exclusao usa a permissao ja existente de excluir pessoas; nenhum novo perfil e criado