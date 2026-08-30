# Feature Specification: Avaliacao de Coordenadores pelo Equipista

**Feature Branch**: `028-avaliacao-equipista-coordenador`

**Created**: 2026-08-30

**Status**: Draft

**Input**: User description: "Criar uma nova aba na Avaliacao, chamada 'Coordenador'. O link publico deve ser: avaliacao/equipista/2026. No link publico, para acessar, o usuario devera inserir o numero do cracha dele. O sistema deve validar se tem um cadastro ativo, caso tenha, deve mostrar a foto da pessoa, nome e equipe e pedindo para a pessoa confirmar se e ela mesmo. Caso a pessoa confirme, mostrar um questionario igual a Avaliacao do Equipista. Mostre o nome dos coordenadores da pessoa. O funcionamento de salvamento automatico deve ser igual a Avaliacao do Equipista."

## Clarifications

### Session 2026-08-30

- Q: Relacao entre a nova aba "Coordenador" e as abas existentes da tela de Avaliacao ("Equipistas" e "Apoio"). → A: Criar uma nova terceira aba independente, ao lado das abas "Equipistas" e "Apoio"; a aba existente "Apoio" (feature 027) permanece intacta.
- Q: Escopo do questionario "igual a Avaliacao do Equipista". → A: Manter os 6 criterios (Pontualidade, Dedicacao, Companheirismo, Espiritualidade, Comprometimento, Uniforme) e o campo de comentarios. Remover a nota "chances de convidar novamente" e o campo "Apto a Coordenar?".
- Q: Quais coordenadores sao exibidos para avaliacao. → A: Listar todos os coordenadores da equipe em que o equipista participa na edicao daquele link; o equipista pode avaliar todos eles em um unico acesso.
- Q: Funcionamento do salvamento automatico "igual a Avaliacao do Equipista" (solicitado na descricao). → A: NAO deve haver salvamento automatico. O preenchimento e persistido somente ao finalizar; nao existe estado de rascunho.
- Q: Como persistir o preenchimento sem o salvamento automatico. → A: Somente na finalizacao; uma avaliacao so existe quando o equipista a finaliza, sem rascunho intermedio (fechar a meio nao resgata nada).
- Q: Comportamento ao finalizar. → A: Ao acionar FINALIZAR, o sistema exibe aviso de que nao sera possivel editar apos finalizado e solicita confirmacao para finalizar.
- Q: Reentrada apos o envio da avaliacao. → A: Uma vez enviada a avaliacao, ao inserir novamente o numero do cracha o sistema mostra mensagem de que a avaliacao ja foi enviada, sem mostrar as respostas.

## User Scenarios & Testing

### User Story 1 - Nova aba "Coordenador" na tela de Avaliacao (Priority: P1)

Um usuario ADM ou ORG, ao acessar a tela de Avaliacao da edicao ativa, visualiza a nova aba "Coordenador" ao lado das abas existentes ("Equipistas" e "Apoio"). Nessa aba, ve o link publico do processo (formato avaliacao/equipista/2026, onde 2026 e a referencia da edicao) com acao de copiar, o controle de ativo/revogado e a listagem das avaliacoes ja realizadas pelos equipistas sobre os coordenadores.

**Why this priority**: Sem a aba o processo nao tem ponto de entrada para a organizacao gerar e divulgar o link, nem local para acompanhar as avaliacoes. E a porta de entrada da feature.

**Independent Test**: Pode ser testado abrindo a tela de Avaliacao e verificando que a aba "Coordenador" exibe o link publico copiavel, o controle ativo/revogado e a listagem de avaliacoes da edicao.

**Acceptance Scenarios**:

1. **Given** um usuario ADM/ORG na tela de Avaliacao, **When** ele visualiza as abas, **Then** existe uma nova aba "Coordenador" ao lado das abas existentes "Equipistas" e "Apoio"
2. **Given** a aba "Coordenador" aberta, **When** ele visualiza a secao, **Then** o link publico do processo (avaliacao/equipista/{referencia}) e exibido com acao de copiar
3. **Given** a aba "Coordenador" aberta, **When** ele aciona a acao de copiar, **Then** o link publico da edicao e copiado para a area de transferencia
4. **Given** a aba "Coordenador" aberta, **When** ele revoga o link, **Then** o link deixa de ser acessivel publicamente; ao reativar, volta a funcionar
5. **Given** avaliacoes existentes na edicao, **When** ele visualiza a listagem, **Then** sao exibidas todas as avaliacoes com filtros por equipe, avaliador e status

---

### User Story 2 - Identificacao e confirmacao de identidade pelo link publico (Priority: P1)

Um equipista abre o link publico da edicao (avaliacao/equipista/2026) e informa o numero do proprio cracha. O sistema valida se a pessoa vinculada ao cracha possui um cadastro ativo na edicao. Se tiver, exibe a foto, o nome e a equipe da pessoa, pedindo que ela confirme se e ela mesma. Somente apos a confirmacao o fluxo prossegue para o questionario.

**Why this priority**: E a porta de entrada do fluxo e introduz um passo de confirmacao de identidade (foto/nome/equipe) ausente nos fluxos anteriores, elevando a confiabilidade da avaliacao.

**Independent Test**: Pode ser testado abrindo o link publico em janela anonima e (1) informando um cracha com cadastro ativo — o sistema mostra foto, nome e equipe e pede confirmacao; (2) confirmando a identidade — prossegue; (3) informando cracha sem cadastro ativo ou inexistente — recebe acesso negado.

**Acceptance Scenarios**:

1. **Given** o link publico valido aberto, **When** o equipista informa o numero do proprio cracha com cadastro ativo, **Then** o sistema exibe a foto, o nome e a equipe da pessoa e solicita a confirmacao da identidade
2. **Given** a tela de confirmacao exibida, **When** a pessoa confirma ser ela mesma, **Then** o sistema prossegue para o questionario de avaliacao
3. **Given** a tela de confirmacao exibida, **When** a pessoa declara nao ser ela mesma, **Then** o sistema nao prossegue e mantem o acesso encerrado para aquela identificacao
4. **Given** o link publico aberto, **When** o equipista informa um cracha inexistente, **Then** o sistema exibe mensagem de acesso negado sem revelar dados
5. **Given** o link publico aberto, **When** o equipista informa um cracha cujo cadastro nao esta ativo (bloqueado ou excluido), **Then** o sistema exibe mensagem de acesso negado sem revelar dados
6. **Given** um link publico invalido ou revogado, **When** o usuario o abre, **Then** o sistema exibe mensagem de link invalido
7. **Given** um equipista que ja enviou a avaliacao, **When** ele informa novamente o numero do cracha, **Then** o sistema exibe mensagem de que a avaliacao ja foi enviada, sem mostrar as respostas e sem prosseguir ao questionario

---

### User Story 3 - Listagem e avaliacao dos coordenadores (Priority: P1)

Apos confirmar a identidade, o equipista visualiza os nomes dos coordenadores a avaliar. O equipista seleciona um coordenador e preenche o questionario com os 6 criterios da Avaliacao do Equipista (Pontualidade, Dedicacao, Companheirismo, Espiritualidade, Comprometimento, Uniforme) e o campo de comentarios, avaliando o coordenador em cada criterio. O sistema NAO persiste rascunho: o preenchimento e salvo somente ao finalizar. Ao acionar FINALIZAR com o questionario completo, o sistema exibe aviso de que nao sera possivel editar apos finalizado e solicita confirmacao.

**Why this priority**: E o objetivo central da feature — registrar a avaliacao dos coordenadores pelos equipistas com o mesmo questionario do fluxo de equipistas, mas sem salvamento automatico de rascunho.

**Independent Test**: Pode ser testado confirmando a identidade, visualizando a lista de coordenadores, preenchendo o questionario de um coordenador e verificando que nao ha salvamento automatico, que a finalizacao exige o preenchimento completo e pede confirmacao com aviso de imutabilidade.

**Acceptance Scenarios**:

1. **Given** a identidade confirmada, **When** o sistema carrega a listagem, **Then** sao exibidos os nomes dos coordenadores da pessoa a avaliar, com indicador visual do status da avaliacao (pendente/finalizada)
2. **Given** a listagem de coordenadores exibida, **When** o equipista seleciona um coordenador pendente, **Then** o formulario abre com os campos do questionario (6 criterios e comentarios), com todos os campos vazios, e nao ha salvamento automatico
3. **Given** o formulario preenchido em parte, **When** o equipista fecha a pagina ou troca de coordenador, **Then** o preenchimento nao e salvo, ja que o processo nao possui rascunho
4. **Given** o formulario com todos os campos obrigatorios preenchidos, **When** o equipista aciona FINALIZAR, **Then** o sistema exibe aviso de que nao sera possivel editar apos finalizado e solicita confirmacao
5. **Given** o formulario com campos obrigatorios incompletos, **When** o equipista tenta finalizar, **Then** o sistema exibe mensagem informando que os campos obrigatorios precisam ser preenchidos
6. **Given** a confirmacao de finalizacao aceita, **When** a avaliacao e registrada, **Then** o sistema a marca como "Finalizada" e ela se torna imutavel e sem possibilidade de edicao
7. **Given** uma avaliacao ja enviada, **When** o equipista informa novamente o cracha, **Then** o sistema exibe mensagem de que a avaliacao ja foi enviada, sem mostrar as respostas

---

### User Story 4 - Acompanhamento das avaliacoes pela organizacao (Priority: P2)

Na aba "Coordenador" da tela de Avaliacao, o usuario ADM ou ORG visualiza a listagem das avaliacoes feitas pelos equipistas sobre os coordenadores na edicao, com filtros por equipe, avaliador e status, alem de visualizar os detalhes de cada avaliacao em modo leitura.

**Why this priority**: Permite a organizacao acompanhar e revisar as avaliacoes sem depender do fluxo publico.

**Independent Test**: Pode ser testado abrindo a aba "Coordenador" com avaliacoes registradas e aplicando filtros por equipe, avaliador e status, verificando que apenas as avaliacoes correspondentes sao exibidas.

**Acceptance Scenarios**:

1. **Given** a aba "Coordenador" aberta, **When** o usuario visualiza a listagem, **Then** sao exibidas todas as avaliacoes da edicao com filtros por equipe, avaliador e status
2. **Given** avaliacoes existentes, **When** o usuario aplica filtro por equipe, **Then** apenas avaliacoes da equipe selecionada sao exibidas
3. **Given** avaliacoes existentes, **When** o usuario aplica filtro por status, **Then** apenas avaliacoes com o status selecionado sao exibidas
4. **Given** a listagem de avaliacoes, **When** o usuario seleciona uma avaliacao, **Then** os detalhes completos sao exibidos em modo leitura

---

### Edge Cases

- Cracha inexistente e cracha de pessoa com cadastro nao ativo (bloqueada ou excluida logicamente) resultam na mesma mensagem generica de acesso negado, sem revelar dados
- Ao confirmar a identidade, se a pessoa nao possuir coordenador a avaliar na edicao, a listagem apresenta estado vazio
- Quando a pessoa pertence a mais de uma equipe na edicao, sao listados os coordenadores de cada equipe em que ela participa; cada coordenador pode aparecer em uma unica avaliacao por equipista por edicao
- Quando a equipe possui mais de um coordenador, todos eles sao listados como alvos de avaliacao
- Quando o link e revogado apos avaliacoes iniciadas, as avaliacoes permanecem no status em que estiverem
- Quando o cadastro da pessoa deixa de estar ativo apos o inicio de avaliacoes, as avaliacoes ja iniciadas permanecem no status em que estiverem
- Um coordenador-alvo pode ter no maximo uma avaliacao por edicao feita pelo mesmo equipista
- O equipista nao pode avaliar a si mesmo; se ele tambem for coordenador da propria equipe, ele nao aparece na propria listagem
- Nao ha salvamento automatico nem rascunho: se o equipista fechar a pagina ou trocar de coordenador antes de finalizar, o preenchimento e perdido
- Uma vez finalizada, a avaliacao e imutavel e, ao informar novamente o cracha, o sistema apenas avisa que a avaliacao ja foi enviada, sem revelar as respostas

## Requirements

### Functional Requirements

- **FR-001**: A tela de Avaliacao deve exibir uma nova aba "Coordenador" ao lado das abas existentes
- **FR-002**: A aba "Coordenador" deve exibir o link publico do processo (avaliacao/equipista/{referencia}, sendo a referencia o ano da edicao) com acao de copiar
- **FR-003**: O link publico deve ter controle de ativo/revogado, gerenciavel pela aba da tela de Avaliacao
- **FR-004**: O link publico deve funcionar sem autenticacao, permitindo que qualquer pessoa o acesse
- **FR-005**: Ao abrir o link publico, o sistema deve apresentar um campo para o usuario informar o numero do cracha
- **FR-006**: O sistema deve validar que o cracha informado corresponde a uma pessoa com cadastro ativo na edicao daquele link
- **FR-007**: Cadastro "ativo" significa pessoa nao bloqueada e nao excluida logicamente na edicao
- **FR-008**: Se o cracha nao for valido ou o cadastro nao estiver ativo, o sistema deve exibir mensagem de acesso negado sem revelar dados
- **FR-009**: Em caso de sucesso, o sistema deve exibir a foto, o nome e a equipe da pessoa e solicitar a confirmacao da identidade
- **FR-010**: O sistema so deve prosseguir para o questionario apos a confirmacao da identidade pela pessoa
- **FR-011**: Apos confirmar, o sistema deve exibir os nomes dos coordenadores da pessoa para avaliacao, com indicador visual do status da avaliacao (pendente/finalizada)
- **FR-012**: O questionario deve conter os 6 criterios (Pontualidade, Dedicacao, Companheirismo, Espiritualidade, Comprometimento, Uniforme) com as opcoes da Avaliacao do Equipista e o campo de comentarios, aplicados a cada coordenador a avaliar
- **FR-013**: O sistema nao deve persistir rascunho; o preenchimento e salvo somente quando o equipista finaliza a avaliacao
- **FR-014**: Para finalizar, o sistema deve exigir o preenchimento de todos os campos obrigatorios do questionario
- **FR-015**: Ao finalizar, o sistema deve exibir aviso de que nao sera possivel editar a avaliacao apos a finalizacao e solicitar confirmacao antes de alterar o status para "Finalizada"
- **FR-016**: Avaliacoes finalizadas devem ser imutaveis — nao podem ser editadas ou excluidas
- **FR-017**: Uma vez enviada a avaliacao, ao informar novamente o numero do cracha o sistema deve exibir mensagem de que a avaliacao ja foi enviada, sem mostrar as respostas e sem prosseguir ao questionario
- **FR-018**: Um coordenador-alvo deve ter no maximo uma avaliacao por edicao feita pelo mesmo equipista
- **FR-019**: O sistema deve impedir que o equipista avalie a si mesmo
- **FR-020**: O sistema deve registrar automaticamente o avaliador (equipista identificado e confirmado), o coordenador avaliado, a equipe, a edicao, as respostas do questionario e as datas de criacao, atualizacao e finalizacao
- **FR-021**: Quando o link for revogado, avaliacoes em andamento devem permanecer no status em que estiverem
- **FR-022**: Quando o cadastro da pessoa deixar de estar ativo, avaliacoes ja iniciadas devem permanecer no status em que estiverem
- **FR-023**: Na aba "Coordenador", ADM/ORG devem visualizar todas as avaliacoes da edicao com filtros por equipe, avaliador e status
- **FR-024**: Os detalhes de uma avaliacao devem ser exibidos em modo leitura para ADM/ORG
- **FR-025**: Todos os textos de interface, mensagens e confirmacoes devem ser em PT-BR

### Key Entities

- **AvaliacaoEquipistaCoordenador**: Registro da avaliacao de um coordenador por um equipista. Contem: coordenador avaliado, avaliador (equipista), equipe, edicao, respostas do questionario (igual ao de equipistas), status (somente "Finalizada", pois nao ha rascunho) e datas. No maximo uma avaliacao por alvo por edicao por equipista.
- **LinkAvaliacaoEquipistaCoordenador**: Link de acesso publico do processo, unico por edicao (formato avaliacao/equipista/{referencia}), com controle de status ativo/revogado.
- **Pessoa**: Entidade existente com numero de cracha, foto, nome e status de cadastro (ativo/bloqueada/excluida logicamente). Identifica o equipista avaliador no fluxo publico.
- **Participacao**: Vinculo de uma pessoa a uma equipe da edicao com funcao (existente). Define a equipe do equipista e, por consequencia, os coordenadores dessa equipe a avaliar.
- **Equipe**: Entidade existente. A equipe da pessoa determina quais coordenadores sao exibidos como alvos da avaliacao.
- **Edicao**: Entidade existente. Referencia do link publico (2026) e contexto de todas as avaliacoes do processo.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Usuarios ADM/ORG conseguem copiar o link publico do processo em ate 2 cliques a partir da aba "Coordenador"
- **SC-002**: Equipistas com cadastro ativo conseguem confirmar a identidade e chegar ao questionario em menos de 1 minuto a partir da abertura do link publico
- **SC-003**: 100% dos acessos por crachas inexistentes ou com cadastro nao ativo exibem a mesma mensagem de acesso negado, sem revelar dados
- **SC-004**: Em 100% dos casos, o questionario exibido contem os 6 criterios (Pontualidade, Dedicacao, Companheirismo, Espiritualidade, Comprometimento, Uniforme) e o campo de comentarios, e lista os coordenadores da equipe da pessoa
- **SC-005**: 100% das avaliacoes finalizadas possuem todos os campos obrigatorios preenchidos, exibem aviso de imutabilidade antes da confirmacao e sao imutaveis; reentradas pelo cracha exibem apenas a mensagem de que a avaliacao ja foi enviada, sem mostrar as respostas
- **SC-006**: A organizacao consegue consultar todas as avaliacoes da edicao com filtros por equipe, avaliador e status em um unico local

## Assumptions

- A referencia "2026" no link publico identifica a edicao alvo (o ano da edicao), no mesmo padrao do processo de coordenadores existente (avaliacao/coordenadores/{referencia})
- O processo segue o mesmo padrao de links publicos anonimos ja existentes na aplicacao (link publico unico por edicao, sem autenticacao, com controle de ativo/revogado)
- "Cadastro ativo" e definido pela pessoa nao estar bloqueada e nao estar excluida logicamente na edicao, reaproveitando os mecanismos de bloqueio e exclusao logica ja existentes
- Cada equipista pertence a uma unica equipe por edicao (mesma premissa do fluxo de avaliacao de equipistas); os coordenadores a avaliar sao os coordenadores dessa equipe
- "Questionario igual a Avaliacao do Equipista" significa reproduzir os 6 criterios (Pontualidade, Dedicacao, Companheirismo, Espiritualidade, Comprometimento, Uniforme) e o campo de comentarios, removendo as perguntas "chances de convidar novamente" e "Apto a Coordenar?"; o questionario avalia cada coordenador
- O fluxo de preenchimento nao possui salvamento automatico de rascunho: a avaliacao e persistida somente ao finalizar, com aviso de imutabilidade e confirmacao, e reentradas pelo cracha apos o envio mostram apenas a mensagem de que a avaliacao ja foi enviada
- A aba "Coordenador" e o acompanhamento das avaliacoes sao acessiveis na tela de Avaliacao, visiveis apenas para os perfis ADM e ORG
