# Feature Specification: Pesquisa de Satisfacao da Cantina

**Feature Branch**: `020-cantina-pesquisa`

**Created**: 2026-08-22

**Status**: Draft

**Input**: User description: "Criar uma seção nova no sistema chamada 'Cantina', com uma subseção 'Pesquisa'. Criar a página Pesquisa, onde deve ter uma seção com o link público 'https://achiropita-pessoal.web.app/cantina/pesquisa' e os botões Copiar, Abrir e QR Code. Também deve listar as pesquisas realizadas, com 20 por página, e lazy-loading. No link público, deve ter um formulário para pesquisa de satisfação com seção de identificação (Nome completo*, E-mail*, Telefone, Dia da ida à cantina com os dias de festa e data atual por padrão, Número convite), critérios de 1 a 5 (Atendimento*, Alimentação*, Organização*, Ambiente*, Atendimento dos Voluntários*), recomendação da Cantina Madonna Achiropita para amigos e familiares (Sim/Não/Talvez)* e campo aberto 'O que poderíamos melhorar?'."

## Clarifications

### Session 2026-08-22

- Q: Deve existir campo de opt-in para receber informacoes da festa no formulario publico? → A: Sim — pergunta "Deseja receber informacoes sobre a Festa de Nossa Senhora Achiropita?" na secao de identificacao
- Q: Quando o E-mail e obrigatorio? → A: Somente quando o visitante marca que deseja receber informacoes; caso contrario, o E-mail e opcional
- Q: Qual e o escopo desta versao para os contatos que marcaram Sim no opt-in? → A: Apenas registro e exibicao na area logada (detalhe da resposta mostra Sim/Nao); sem exportacao ou disparo nesta versao

## User Scenarios & Testing

### User Story 1 - Acesso ao link publico na pagina Cantina > Pesquisa (Priority: P1)

Um usuario autorizado acessa a nova secao "Cantina" no menu do sistema e, dentro dela, a subsecao "Pesquisa". A pagina exibe o endereco publico da pesquisa de satisfacao (https://achiropita-pessoal.web.app/cantina/pesquisa) acompanhado de tres acoes: Copiar (copia o link para a area de transferencia), Abrir (abre o link publico) e QR Code (exibe um codigo QR do link para distribuicao impressa/digital).

**Why this priority**: Sem o endereco publico visivel e compartilhavel, nao ha como divulgar a pesquisa aos frequentadores da cantina — e o ponto de entrada da feature.

**Independent Test**: Pode ser testado acessando a pagina Cantina > Pesquisa logado, conferindo que o link publico aparece e que cada botao executa sua acao (copiar, abrir, QR Code).

**Acceptance Scenarios**:

1. **Given** um usuario autorizado logado, **When** ele abre o menu de navegacao, **Then** a secao "Cantina" esta disponivel e, dentro dela, a subsecao "Pesquisa"
2. **Given** a pagina Cantina > Pesquisa aberta, **When** o usuario visualiza a secao do link, **Then** o endereco publico https://achiropita-pessoal.web.app/cantina/pesquisa e exibido por extenso
3. **Given** a pagina Cantina > Pesquisa aberta, **When** o usuario aciona "Copiar", **Then** o link publico e copiado para a area de transferencia e o sistema confirma a copiacao
4. **Given** a pagina Cantina > Pesquisa aberta, **When** o usuario aciona "Abrir", **Then** o link publico e aberto sem necessidade de login
5. **Given** a pagina Cantina > Pesquisa aberta, **When** o usuario aciona "QR Code", **Then** o sistema exibe o codigo QR correspondente ao link publico, permitindo baixa-lo ou escanea-lo diretamente

---

### User Story 2 - Identificacao do visitante no formulario publico (Priority: P1)

Uma pessoa que visitou a cantina abre o link publico (sem login) e encontra o formulario de pesquisa de satisfacao. A primeira secao coleta a identificacao: Nome completo (obrigatorio), E-mail (obrigatorio apenas se o visitante marcar que deseja receber informacoes), Telefone (opcional), Dia da ida a cantina (selecao entre os dias de festa cadastrados, com o dia atual previamente selecionado quando possivel), Numero do convite (opcional) e a pergunta "Deseja receber informacoes sobre a Festa de Nossa Senhora Achiropita?" (Sim/Nao).

**Why this priority**: A identificacao qualifica a resposta e permite cruzar os dados com os dias de festa e o consentimento de contato. Faz parte do nucleo do formulario publico.

**Independent Test**: Pode ser testado abrindo o link publico em janela anonima, preenchendo a identificacao com dados validos e invalidos e observando validacoes e o valor padrao do dia.

**Acceptance Scenarios**:

1. **Given** o link publico aberto em navegador sem sessao, **When** a pagina carrega, **Then** o formulario de pesquisa de satisfacao e exibido com a secao de identificacao visivel
2. **Given** o formulario publico carregado, **When** o usuario visualiza o campo "Dia da ida a cantina", **Then** sao oferecidas as datas dos dias de festa cadastrados e o dia atual aparece previamente selecionado quando constar na lista
3. **Given** o formulario preenchido sem o nome completo, **When** o usuario tenta avancar/enviar, **Then** o sistema indica o campo obrigatorio pendente em linguagem clara
4. **Given** a pergunta "Deseja receber informacoes sobre a Festa de Nossa Senhora Achiropita?" respondida com Sim e o E-mail vazio ou invalido, **When** o usuario tenta enviar, **Then** o sistema bloqueia o envio indicando que o E-mail e obrigatorio e deve ter formato valido
5. **Given** a pergunta "Deseja receber informacoes sobre a Festa de Nossa Senhora Achiropita?" respondida com Nao (ou sem resposta) e o E-mail em branco, **When** o usuario envia a pesquisa, **Then** o envio e aceito normalmente
6. **Given** o formulario preenchido com telefone e numero de convite opcionais em branco, **When** o usuario envia a pesquisa, **Then** o envio e aceito normalmente
7. **Given** o campo de telefone preenchido, **When** o usuario informa um formato qualquer de telefone, **Then** o sistema aceita o conteudo sem bloquear o envio (campo informativo)

---

### User Story 3 - Resposta da avaliacao e envio no formulario publico (Priority: P1)

Apos a identificacao, o visitante responde as perguntas de avaliacao: cinco criterios com nota de 1 a 5 (Atendimento, Alimentacao, Organizacao, Ambiente, Atendimento dos Voluntarios), todos obrigatorios; a pergunta "Voce recomendaria a Cantina Madonna Achiropita para amigos e familiares?" com opcoes Sim/Nao/Talvez, obrigatoria; e o campo aberto opcional "O que poderiamos melhorar para tornar sua experiencia ainda melhor?". Ao enviar, o sistema registra a resposta e confirma o sucesso de forma amigavel.

**Why this priority**: E o nucleo da feature — coletar a opiniao. Sem o envio registrado, a pesquisa nao existe.

**Independent Test**: Pode ser testado respondendo o formulario publico completo e verificando a confirmacao de envio; repetindo com criterios faltantes e verificando o bloqueio com mensagem de validacao.

**Acceptance Scenarios**:

1. **Given** o formulario publico aberto, **When** o usuario avalia cada criterio, **Then** pode escolher uma nota inteira de 1 a 5 para cada um dos cinco criterios (Atendimento, Alimentacao, Organizacao, Ambiente, Atendimento dos Voluntarios)
2. **Given** um ou mais criterios sem nota, **When** o usuario tenta enviar, **Then** o sistema impede o envio e destaca os criterios pendentes
3. **Given** o formulario preenchido, **When** o usuario responde a pergunta de recomendacao com Sim, Nao ou Talvez, **Then** o sistema registra exatamente a opcao escolhida
4. **Given** a pergunta de recomendacao sem resposta, **When** o usuario tenta enviar, **Then** o sistema impede o envio e indica que a resposta e obrigatoria
5. **Given** o campo aberto de melhorias, **When** o usuario preenche ou deixa em branco, **Then** o envio funciona nos dois casos
6. **Given** todos os campos obrigatorios preenchidos, **When** o usuario envia, **Then** o sistema registra a resposta com data e hora do envio e apresenta confirmacao de agradecimento
7. **Given** a confirmacao de envio exibida, **When** o usuario tenta reenviar a mesma pagina (recarregar), **Then** o sistema nao duplica automaticamente a resposta sem nova acao explicita de envio

---

### User Story 4 - Listagem das pesquisas realizadas (Priority: P2)

Na pagina Cantina > Pesquisa, abaixo do bloco do link publico, o usuario autorizado visualiza a lista das pesquisas ja respondidas. A lista carrega inicialmente 20 registros e busca os proximos 20 sob demanda (lazy-loading), conforme o usuario rola a pagina ou pede mais registros. Cada linha mostra informacoes essenciais da resposta (identificacao do respondente, dia da ida, notas, recomendacao e data de envio), e o detalhe completo fica disponivel ao selecionar um registro.

**Why this priority**: Agrega valor de analise a organizacao, mas so faz sentido apos o fluxo de resposta existir (US-2 e US-3).

**Independent Test**: Pode ser testado com 25+ respostas registradas: a pagina exibe 20 inicialmente e carrega as demais sob demanda; clicar num registro abre o detalhe completo.

**Acceptance Scenarios**:

1. **Given** menos de 21 pesquisas registradas, **When** o usuario abre a listagem, **Then** todas aparecem de uma vez, ordenadas da mais recente para a mais antiga
2. **Given** 45 pesquisas registradas, **When** a listagem carrega, **Then** apenas as 20 primeiras sao buscadas/exibidas inicialmente
3. **Given** a listagem com 20 itens exibidos, **When** o usuario rola ate o fim (ou aciona carregar mais), **Then** os proximos 20 registros sao carregados sem recarregar a pagina
4. **Given** todos os registros ja carregados, **When** o usuario rola novamente, **Then** o sistema indica que nao ha mais registros, sem repeticoes
5. **Given** nenhuma pesquisa registrada, **When** o usuario abre a listagem, **Then** o estado vazio informa que ainda nao ha respostas
6. **Given** a listagem exibida, **When** o usuario seleciona um registro, **Then** o detalhe completo e apresentado: identificacao, dia da ida, numero do convite (quando informado), desejo de receber informacoes (Sim/Nao), notas dos 5 criterios, recomendacao, comentario de melhoria e data/hora de envio

---

### Edge Cases

- Envio do formulario publico com campos obrigatorios vazios (nome, criterios ou recomendacao) e bloqueado com indicacao clara de cada campo pendente
- Obrigatoriedade condicional do E-mail: com opt-in "Deseja receber informacoes" marcado como Sim, E-mail vazio/invalido bloqueia o envio; com Nao (ou sem resposta), E-mail em branco nao bloqueia
- O mesmo visitante pode enviar mais de uma resposta (ex.: foi em dias diferentes); nao ha deduplicacao por e-mail nesta versao
- Se hoje nao consta na lista de dias de festa cadastrados, o campo "Dia da ida" inicia sem selecao e o visitante escolhe livremente
- Se nao houver dias de festa cadastrados, o campo "Dia da ida" permanece opcional/vazio e o restante do formulario continua utilizavel
- O campo aberto de melhorias tem limite de 4000 caracteres, com contador para o visitante
- Interrupcao de conexao durante o preenchimento: o envio so ocorre com acao explicita; falha de envio mantem os dados preenchidos para nova tentativa
- Acesso ao link publico por mecanismos de busca/bots nao gera respostas (formulario exige interacao humana)
- Listagem com muitos registros nunca carrega tudo de uma vez — sempre em lotes de 20

## Requirements

### Functional Requirements

- **FR-001**: O sistema deve exibir uma nova secao "Cantina" no menu principal, visivel apenas para perfis autorizados (ADM e ORG)
- **FR-002**: A secao Cantina deve conter a subsecao "Pesquisa", com pagina propria na area logada
- **FR-003**: A pagina Pesquisa deve exibir a secao do link publico com o endereco https://achiropita-pessoal.web.app/cantina/pesquisa mostrado por extenso
- **FR-004**: A pagina Pesquisa deve oferecer o botao Copiar, que copia o link publico para a area de transferencia e confirma a acao
- **FR-005**: A pagina Pesquisa deve oferecer o botao Abrir, que abre o link publico sem exigir login
- **FR-006**: A pagina Pesquisa deve oferecer o botao QR Code, que apresenta o codigo QR do link publico para visualizacao e download
- **FR-007**: A pagina Pesquisa deve listar as pesquisas realizadas, ordenadas da mais recente para a mais antiga
- **FR-008**: A listagem deve carregar registros em lotes de 20, buscando o lote seguinte somente sob demanda (lazy-loading), sem recarregar a pagina
- **FR-009**: A listagem deve indicar o fim dos registros quando nao houver mais itens
- **FR-010**: A listagem deve apresentar estado vazio informativo quando nao existirem respostas
- **FR-011**: Cada registro listado deve permitir abrir o detalhe completo da resposta
- **FR-012**: O link publico deve ser estatico e fixo (mesmo endereco divulgado em todas as edicoes/dias) e funcionar sem autenticacao
- **FR-013**: O formulario publico deve conter a secao de identificacao com: Nome completo (obrigatorio), E-mail (obrigatorio somente quando o visitante responde Sim ao opt-in de informacoes, com formato valido nesses casos; opcional caso contrario), Telefone (opcional), Dia da ida a cantina (selecao entre os dias de festa cadastrados), Numero do convite (opcional) e a pergunta "Deseja receber informacoes sobre a Festa de Nossa Senhora Achiropita?" (Sim/Nao)
- **FR-014**: O campo "Dia da ida a cantina" deve listar os dias de festa cadastrados e trazer o dia atual previamente selecionado sempre que ele constar na lista
- **FR-015**: O formulario publico deve oferecer 5 criterios de avaliacao com nota de 1 a 5, todos obrigatorios: Atendimento, Alimentacao, Organizacao, Ambiente e Atendimento dos Voluntarios
- **FR-016**: As notas dos criterios devem aceitar valores inteiros de 1 a 5, sendo 1 pior avaliacao e 5 melhor
- **FR-017**: O formulario publico deve incluir a pergunta "Voce recomendaria a Cantina Madonna Achiropita para amigos e familiares?" com opcoes Sim, Nao e Talvez, de resposta obrigatoria
- **FR-018**: O formulario publico deve incluir o campo aberto opcional "O que poderiamos melhorar para tornar sua experiencia ainda melhor?", com limite de 4000 caracteres
- **FR-019**: O envio deve ser bloqueado com mensagens claras quando qualquer campo obrigatorio estiver pendente ou invalido
- **FR-020**: Ao enviar com sucesso, o sistema deve registrar a resposta completa com data e hora e exibir confirmacao de agradecimento ao visitante
- **FR-021**: O detalhe de cada resposta deve exibir identificacao, dia da ida, numero do convite (quando informado), desejo de receber informacoes (Sim/Nao), notas dos 5 criterios, recomendacao, comentario de melhoria e data/hora de envio
- **FR-022**: Todos os textos de interface, rotulos, validacoes e confirmacoes devem ser em PT-BR
- **FR-023**: A pagina publica e a area logada devem seguir o guia visual do projeto (paleta, tipografia e componentes de referencia)
- **FR-024**: A pergunta "Deseja receber informacoes sobre a Festa de Nossa Senhora Achiropita?" deve oferecer opcoes Sim e Nao; respondida com Sim, o E-mail se torna obrigatorio para o envio; respondida com Nao (ou deixada sem resposta), o E-mail permanece opcional

### Key Entities

- **PesquisaCantina**: Resposta individual da pesquisa de satisfacao. Contem: nome completo, e-mail (preenchido sobretudo quando o visitante aceita receber informacoes), telefone (opcional), dia da ida (data de um dia de festa), numero do convite (opcional), desejo de receber informacoes sobre a festa (Sim/Nao), notas de 1 a 5 para Atendimento, Alimentacao, Organizacao, Ambiente e Atendimento dos Voluntarios, recomendacao (Sim/Nao/Talvez), comentario de melhorias (opcional) e data/hora de envio.
- **DiaFesta**: Dia em que a festa acontece (entidade existente, com data). Alimenta a lista de opcoes do campo "Dia da ida a cantina".
- **Edicao**: Edicao da festa (entidade existente). Contexto dos dias de festa exibidos no formulario publico.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Um usuario autorizado localiza o link publico e copia seu endereco em no maximo 2 cliques a partir do menu
- **SC-002**: Um visitante consegue abrir o link publico e visualizar o formulario completo em menos de 5 segundos, sem login e em tela de celular
- **SC-003**: Um visitante conclui e envia a pesquisa completa em menos de 3 minutos
- **SC-004**: 100% dos envios incompletos (faltando campos obrigatorios) sao bloqueados com indicacao clara do campo pendente
- **SC-005**: 100% das respostas enviadas ficam visiveis na listagem da area logada em ate 1 minuto apos o envio
- **SC-006**: Com 100+ respostas registradas, a listagem permanece fluida, carregando sempre lotes de 20 sob demanda
- **SC-007**: O codigo QR gerado e escaneavel por camera de celular levando corretamente ao formulario publico

## Assumptions

- Acesso administrativo (pagina Cantina > Pesquisa) restrito aos perfis ADM e ORG, padrao adotado nas demais areas de gestao do sistema
- O texto "Na p" na descricao original foi interpretado como continuacao truncada introduzindo a secao de perguntas da pesquisa (criterios, recomendacao e campo aberto)
- Somente os campos marcados com asterisco na descricao original seriam obrigatorios; a partir da clarificacao de 2026-08-22, o E-mail tornou-se condicional ao opt-in "Deseja receber informacoes" — obrigatorios: Nome completo, os 5 criterios, a pergunta de recomendacao e o E-mail apenas com opt-in Sim
- O link publico e fixo (rota unica), sem token por edicao — o mesmo endereco serve para toda a festa, diferenciando os dias pelo campo "Dia da ida"
- Os dias de festa listados vem da edicao ativa corrente do sistema
- Nao ha limite de respostas por pessoa nesta versao; cada envio cria um novo registro
- Os contatos coletados via opt-in "Deseja receber informacoes" sao apenas registrados e exibidos no detalhe da resposta; sem exportacao, disparo ou integracao de marketing nesta versao
- Sem mecanismo antispam/captcha no formulario publico nesta versao, em linha com os demais fluxos publicos existentes do sistema
- A listagem nao precisa de filtros ou exportacao nesta versao; apenas listagem paginada com lazy-loading e detalhe
- A pesquisa segue o padrao visual e os componentes de interface ja existentes no sistema
