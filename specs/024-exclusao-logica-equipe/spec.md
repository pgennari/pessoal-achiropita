# Feature Specification: Exclusao logica de equipes

**Feature Branch**: `024-exclusao-logica-equipe`

**Created**: 2026-08-29

**Status**: Draft

**Input**: User description: "Criar uma exclusão lógica da equipe. O sistema deve desalocar todas as pessoas da equipe e marcar a equipe como excluida no banco de dados. A equipe 'excluida' não deve aparecer no sistema."

## User Scenarios & Testing

### User Story 1 - Organizador exclui uma equipe e o sistema desaloca as pessoas (Priority: P1)

Um organizador com permissao de excluir equipes abre a edicao e remove uma equipe. O sistema pede confirmacao e informa quantas pessoas estao alocadas naquele momento. Ao confirmar, o sistema desaloca todas as pessoas de uma vez, marca a equipe como excluida (o registro e preservado, mas deixa de valer como equipe ativa) e a equipe desaparece de todas as telas. Nenhuma pessoa nem registro individual e perdido.

**Why this priority**: E o fluxo principal da feature — o organizador precisa conseguir "apagar" uma equipe de forma segura, sem perder o registro nem onerar uma desalocacao manual de cada pessoa.

**Independent Test**: Pode ser testado em uma edicao com uma equipe contendo pessoas alocadas: excluir a equipe, confirmar o aviso com a contagem e verificar que todas as pessoas ficam desalocadas e a equipe nao e mais listada.

**Acceptance Scenarios**:

1. **Given** uma equipe com N pessoas alocadas, **When** o organizador confirma a exclusao da equipe, **Then** as N pessoas sao desalocadas automaticamente em uma unica operacao, sem acao individual
2. **Given** uma equipe sem pessoas alocadas, **When** o organizador confirma a exclusao, **Then** a equipe deixa de aparecer sem afetar nenhuma pessoa
3. **Given** o dialogo de confirmacao da exclusao, **When** a equipe possui pessoas alocadas, **Then** o aviso informa a quantidade exata de pessoas que serao desalocadas antes da confirmacao
4. **Given** uma equipe sendo excluida, **When** a operacao termina, **Then** nenhum cadastro de pessoa e removido nem alterado indevidamente

---

### User Story 2 - Equipe excluida nao aparece em lugar nenhum do sistema (Priority: P1)

Apos a exclusao, a equipe fica invisivel para todos os usuarios: nao aparece em listagens de equipes, filtros, busca global, organograma, relatorios, seletores de equipe (alocacao, movimentacao, formularios de permissao de coordenador, etc.) nem em telas de edicao. Um link direto para a equipe excluida resulta em "nao encontrada" e nao permite visualizar nem editar.

**Why this priority**: A regra de invisibilidade e o que garante a semantica de "excluida" — sem ela, a equipe continuaria "existindo" para o usuario de outras formas.

**Independent Test**: Pode ser testado apos excluir uma equipe: abrir a listagem da edicao, a busca global, o organograma e os relatorios e confirmar que a equipe nao aparece em nenhum; abrir o link direto da equipe e ver "nao encontrada".

**Acceptance Scenarios**:

1. **Given** uma equipe excluida, **When** qualquer usuario abre a listagem de equipes da edicao, **Then** a equipe excluida nao aparece
2. **Given** uma equipe excluida, **When** o usuario faz uma busca global pelo nome da equipe, **Then** a equipe nao aparece nos resultados
3. **Given** uma equipe excluida, **When** o usuario escolhe uma equipe em qualquer seletor do sistema (alocar, mover, filtrar relatorio, definir coordenador etc.), **Then** a equipe excluida nao aparece entre as opcoes
4. **Given** uma equipe excluida, **When** o usuario abre o link/identificador direto dela, **Then** o sistema apresenta a equipe como "nao encontrada", sem exibir dados nem permitir edicao

---

### User Story 3 - Dados historicos da equipe sao preservados (Priority: P2)

A exclusao de uma equipe nao apaga nem corrompe dados historicos que ja existiam: movimentacoes de pessoas entre equipes, presencas e avaliacoes registradas permanecem armazenados e intactos. O registro da propria equipe fica mantido para referencia, apenas sem uso funcional.

**Why this priority**: Evita perda de informacao — historico de pessoas e da festa nao deve sumir junto com a equipe.

**Independent Test**: Pode ser testado excluindo uma equipe que possua pessoas com historico registrado (movimentacao, presenca ou avaliacao) e conferindo nas telas de historico da pessoa que os registros antigos continuam presentes e coerentes.

**Acceptance Scenarios**:

1. **Given** uma equipe com registros historicos (movimentacoes, presencas, avaliacoes) ja gravados, **When** a equipe e excluida, **Then** esses registros permanecem armazenados sem exclusao nem corrupcao
2. **Given** uma pessoa que migrou dessa equipe para outra antes da exclusao, **When** a equipe e excluida, **Then** o historico de movimentacao da pessoa continua exibido normalmente

---

### Edge Cases

- O que acontece com uma equipe com pessoas alocadas? Todas as pessoas sao desalocadas automaticamente na exclusao
- O que acontece com uma equipe sem pessoas alocadas? E excluida normalmente, sem efeito sobre pessoas
- O que acontece com subequipes do organograma (equipes subordinadas)? Elas nao sao excluidas junto; permanecem ativas e deixam de ter equipe superior definida
- O que acontece se a equipe excluida for a raiz do organograma? A edicao fica sem equipe raiz ate uma nova ser definida; as demais equipes continuam visiveis
- O que acontece se o usuario tentar excluir uma equipe ja excluida? O sistema trata como "nao encontrada", sem erro inesperado
- O que acontece com usuarios coordenadores que tinham a equipe excluida entre suas equipes? Nenhuma tela quebra; a equipe apenas deixa de resolver e de ser exibida
- O que acontece se dois organizadores excluirem a mesma equipe ao mesmo tempo? A segunda acao conclui como "nao encontrada", sem duplicar efeitos nem corromper dados

## Requirements

### Functional Requirements

- **FR-001**: O sistema deve permitir excluir (logicamente) uma equipe de uma edicao, preservando o registro no banco em vez de apaga-lo
- **FR-002**: Ao excluir uma equipe, o sistema deve desalocar automaticamente todas as pessoas alocadas nela, em uma unica operacao
- **FR-003**: Antes de confirmar a exclusao, o sistema deve informar ao organizador a quantidade de pessoas que serao desalocadas
- **FR-004**: Equipes excluidas nao devem aparecer em listagens, filtros, busca, organograma, relatorios nem seletores de equipe em nenhuma tela do sistema
- **FR-005**: O acesso por link direto a uma equipe excluida deve resultar em "nao encontrada", sem exibir dados nem permitir edicao
- **FR-006**: Subequipes de uma equipe excluida devem permanecer ativas e deixar de ter equipe superior definida
- **FR-007**: Registros historicos associados a equipe (movimentacoes, presencas e avaliacoes ja registrados) devem ser preservados, sem exclusao ou corrupcao
- **FR-008**: A exclusao de uma equipe deve ficar registrada na trilha de auditoria do sistema
- **FR-009**: A acao de excluir equipe deve exigir a permissao ja existente de exclusao de equipes, sem criar novo perfil ou acesso
- **FR-010**: Todas as mensagens e textos de interface envolvidos devem permanecer em PT-BR

### Key Entities

- **Equipe**: Unidade organizacional da edicao. Passa a ter estado de "ativa" ou "excluida"; o registro excluido conserva identificacao para referencia, sem uso funcional
- **Participacao (alocacao)**: Vinculo ativo entre pessoa e equipe na edicao. E removido automaticamente para todas as pessoas quando a equipe e excluida
- **Movimentacao**: Historico de transferencias de uma pessoa entre equipes. Recebe o registro da desalocacao em massa provocada pela exclusao, preservando o acompanhamento da pessoa
- **Auditoria**: Trilhha de eventos. Guarda o registro de quem excluiu a equipe e quando

## Success Criteria

### Measurable Outcomes

- **SC-001**: Excluir uma equipe desaloca 100% das pessoas alocadas em uma unica confirmacao, sem passos extras por pessoa
- **SC-002**: Em 100% das telas logadas (listagens, filtros, busca, organograma, relatorios e seletores) a equipe excluida nao aparece
- **SC-003**: O acesso direto ao link de uma equipe excluida nunca permite visualizar nem editar a equipe — sempre resulta em "nao encontrada"
- **SC-004**: Apos a exclusao, nenhum registro historico (movimentacoes, presencas, avaliacoes) e perdido ou alterado indevidamente (0 perdas)
- **SC-005**: O organizador conclui a exclusao de uma equipe, inclusive com pessoas alocadas, em menos de 5 segundos

## Assumptions

- A exclusao e definitiva na interface: nao ha restauracao de equipe no escopo desta feature
- Subequipes nao sao excluidas junto; permanecem ativas, apenas sem equipe superior definida
- A desalocacao em massa e registrada no historico de movimentacoes das pessoas, e nao apenas removida silenciosamente
- Equipes excluidas ficam ocultas tambem de relatorios e telas de historico do sistema; os dados subjacentes permanecem armazenados no banco
- Se a equipe excluida era a raiz do organograma, a edicao pode ficar sem raiz ate outra ser definida manualmente
- A exclusao usa a permissao ja existente de excluir equipes; nenhum novo perfil e criado