# Feature Specification: Remover campos do formulario publico da Pesquisa da Cantina

**Feature Branch**: `023-remover-campos-pesquisa-cantina`

**Created**: 2026-08-28

**Status**: Draft

**Input**: User description: "Na link pública da Pesquisa da Cantina, tirar os campos: Dia da ida a cantina; Numero do convite"

## User Scenarios & Testing

### User Story 1 - Visitante envia a pesquisa sem o dia da ida e o numero do convite (Priority: P1)

Uma pessoa que visitou a cantina abre o link publico da pesquisa (sem login) e nao encontra mais os campos "Dia da ida a cantina" e "Numero do convite". O formulario continua coletando nome, telefone, e-mail/opt-in de informacoes, notas dos criterios, recomendacao e campo aberto de melhorias, e o envio funciona normalmente como antes.

**Why this priority**: E o unico fluxo existente da feature — remover os campos encurta o formulario e reduz friccao para quem responde, sem mudar o restante da pesquisa.

**Independent Test**: Pode ser testado abrindo o link publico em janela anonima, confirmando que os dois campos nao aparecem em nenhum ponto do formulario e concluindo um envio completo com sucesso.

**Acceptance Scenarios**:

1. **Given** o formulario publico da pesquisa aberto, **When** o visitante visualiza a secao "Sobre você", **Then** o sistema nao exibe o campo "Dia da ida a cantina"
2. **Given** o formulario publico da pesquisa aberto, **When** o visitante visualiza a secao "Sobre você", **Then** o sistema nao exibe o campo "Número do convite"
3. **Given** o formulario sem os dois campos, **When** o visitante preenche nome, responde o opt-in de informacoes (com e-mail valido quando quiser receber informacoes), da notas aos criterios, responde a recomendacao e envia, **Then** a pesquisa e registrada com sucesso e a tela de agradecimento e exibida
4. **Given** o formulario publico da pesquisa, **When** o visitante visualiza a secao "Sobre você", **Then** o campo "Telefone" permanece presente e utilizavel, sem qualquer indicacao visual de dia ou convite

---

### User Story 2 - Organizador mantem acesso as respostas ja registradas (Priority: P2)

Um organizador com acesso a area logada da pesquisa consulta as respostas recebidas e continua vendo, nas respostas registradas antes da mudanca, o dia da ida e o numero do convite informados na epoca. Respostas novas, sem esses dados, aparecem normalmente sem os valores nao informados.

**Why this priority**: A mudanca nao deve apagar historico; preservar os dados ja coletados evita perda de informacao para analise.

**Independent Test**: Pode ser testado abrindo a listagem de pesquisas na area logada e verificando que respostas antigas ainda exibem dia/convite quando informados e que respostas novas nao apresentam esses campos com erro.

**Acceptance Scenarios**:

1. **Given** a area logada de listagem de pesquisas, **When** o organizador abre uma resposta registrada antes da remocao dos campos, **Then** o dia da ida e o numero do convite que haviam sido informados continuam visiveis
2. **Given** a area logada de listagem de pesquisas, **When** o organizador abre uma resposta enviada apos a remocao dos campos, **Then** a resposta e exibida normalmente sem exigir valores de dia ou convite

---

### Edge Cases

- O que acontece com respostas ja gravadas antes da mudanca? Dados de dia da ida e convite sao preservados e continuam exibidos na area logada
- O que acontece se algum visitante acessar o formulario em dispositivo antigo/cache antigo? O novo formulario e carregado e apresenta apenas os campos atualmente ativos; nenhuma informacao de dia/convite e solicitada
- O que acontece se a edicao nao tiver dias de festa cadastrados? Irrelevante, pois a selecao de dias nao existe mais no formulario
- Como fica o layout da secao "Sobre você" sem o campo "Dia da ida"? O campo "Telefone" fica em largura unica/redistribuida, sem lacunas visuais

## Requirements

### Functional Requirements

- **FR-001**: O formulario publico da pesquisa nao deve exibir o campo "Dia da ida a cantina"
- **FR-002**: O formulario publico da pesquisa nao deve exibir o campo "Número do convite"
- **FR-003**: O visitante deve conseguir concluir o envio da pesquisa sem informar dia da ida ou numero do convite, com todos os demais campos inalterados
- **FR-004**: O campo "Telefone" deve permanecer presente e opcional no formulario publico
- **FR-005**: Novas respostas registradas nao devem conter valor de dia da ida nem numero do convite
- **FR-006**: Respostas registradas antes da remocao devem preservar os valores de dia da ida e numero do convite informados
- **FR-007**: A area logada deve continuar exibindo as respostas normalmente, com dia da ida e numero do convite apenas quando existirem na resposta
- **FR-008**: Todas as mensagens e textos de interface envolvidos devem permanecer em PT-BR

### Key Entities

- **PesquisaCantina**: Resposta de satisfacao enviada pelo publico (entidade existente). A partir da remocao, novas respostas nao carregam dia da ida nem numero do convite; respostas antigas conservam os valores ja gravados
- **DiaFesta**: Dia em que a festa acontece (entidade existente). Deixa de ser fonte de opcoes para o formulario publico, pois a selecao de dia sai do formulario

## Success Criteria

### Measurable Outcomes

- **SC-001**: Ao abrir o formulario publico, em 100% das visitas os campos "Dia da ida a cantina" e "Número do convite" nao aparecem
- **SC-002**: O visitante conclui o envio em menos de 1 minuto sem precisar informar dia da ida ou numero do convite
- **SC-003**: 100% das respostas registradas antes da remocao mantem dia da ida e numero do convite visiveis na area logada, quando informados
- **SC-004**: Nenhuma resposta nova e bloqueada ou falha por ausencia dos dois campos removidos
- **SC-005**: O campo "Telefone" permanece presente no formulario, sem reducao da experiencia atual

## Assumptions

- A mudanca atinge apenas o formulario publico da pesquisa; a area logada mantem a exibicao dos dados das respostas ja registradas
- Respostas historicas sao preservadas integralmente, sem apagar dados existentes
- Nenhum outro campo do formulario e alterado (nome, telefone, e-mail/opt-in, notas dos criterios, recomendacao, campo aberto)
- O link publico e o caminho de acesso a pesquisa nao mudam
- A exclusao dos campos visa apenas o fluxo de coleta; a analise de respostas antigas nao perde informacao