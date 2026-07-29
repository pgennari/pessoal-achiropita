# Checklist de Qualidade de Requisitos: Dashboard de Check-ins em Tempo Real

**Propósito**: Validar completeza, clareza e consistencia dos requisitos nas dimensoes de UX, tempo real, API e nao-funcionais
**Criado em**: 2026-07-28
**Funcionalidade**: [spec.md](../spec.md)

## Qualidade dos Requisitos de UX / Visuais

- [x] CHK001 - O "indicador visual de ocupacao com codigo de cores" esta definido com valores hex/cor exatos para verde, amarelo e vermelho? [Clareza, Spec §FR-003]
- [x] CHK002 - As dimensoes, posicionamento (topo-esquerda/centro/direita) e tipo de animacao do toast/banner de notificacao estao especificados? [Completeza, Spec §FR-007, Assumptions]
- [x] CHK003 - "Notificacao visual proeminente" esta quantificada com propriedades mensuraveis (tamanho minimo, razao de contraste, intensidade da animacao)? [Clareza, Spec §FR-007]
- [x] CHK004 - O layout/estrutura de cada card de estacionamento (o que vai onde, tamanhos relativos) esta especificado alem de uma lista de campos? [Completeza, Spec §FR-001]
- [x] CHK005 - Os requisitos para o limite de "N registros mais recentes (ex.: 20)" sao consistentes entre todas as secoes que o referenciam? [Consistencia, Spec §FR-004, Assumptions]
- [x] CHK006 - "Otimizado para exibicao em tela widescreen" esta definido com resolucao minima suportada e comportamento do layout em diferentes proporcoes de tela? [Clareza, Spec §FR-012]
- [x] CHK007 - Os requisitos para feedback visual do status da conexao SSE (conectado/desconectado/reconectando) estao especificados de forma consistente? [Consistencia, Spec §FR-010, Edge Cases]

## Qualidade dos Requisitos de Tempo Real / SSE

- [x] CHK008 - O formato do payload do evento SSE para eventos `checkin` esta completamente especificado com todos os campos e tipos? [Completeza, Contracts §dashboard-api.md]
- [x] CHK009 - O mecanismo de autenticacao nas conexoes SSE (token via query string) esta documentado com implicacoes de seguranca abordadas? [Completeza, Research §Unknown 4]
- [x] CHK010 - O intervalo do heartbeat para conexoes SSE esta explicitamente especificado? [Clareza, Contracts §dashboard-api.md]
- [x] CHK011 - Os requisitos para tratamento de reconexao SSE apos o timeout de 60 min do Cloud Run estao especificados? [Completeza, Plan §Constraints, Edge Cases]
- [x] CHK012 - Os requisitos para conexoes SSE simultaneas de multiplas abas/usuarios do dashboard estao especificados? [Cobertura, Gap]
- [x] CHK013 - O ponto de integracao do EventEmitter no handler POST de checkin esta documentado com tratamento de erros para falhas de emissao? [Completeza, Plan §Summary]

## Qualidade dos Requisitos de API / Contratos de Dados

- [x] CHK014 - Os formatos de resposta de erro para os endpoints do dashboard (403, 500) estao especificados de forma consistente com os padroes de API existentes? [Consistencia, Spec §FR-009]
- [x] CHK015 - O comportamento de calculo do `ocupacaoPercentual` para `null` (0 vagas contratadas) e consistente entre a resposta da API e os requisitos de exibicao no frontend? [Consistencia, Spec §FR-011, Spec §FR-002]
- [x] CHK016 - As convencoes de nomenclatura de campos (camelCase) nas respostas da API estao alinhadas com as convencoes existentes do projeto? [Consistencia, Research §Unknown 2, CLAUDE.md]

## Cobertura de Casos Limite

- [x] CHK017 - O cenario de "estacionamento excluido durante a sessao do dashboard" vai alem de "desaparecer na proxima atualizacao" — existe um mecanismo no stream SSE para notificar sobre a exclusao? [Clareza, Edge Cases]
- [x] CHK018 - Os requisitos para tratamento de backpressure na fila de mensagens SSE durante picos de check-in estao especificados? [Cobertura, Gap, Edge Cases]
- [x] CHK019 - O comportamento para check-ins de dias anteriores (nao devem afetar a ocupacao de hoje) esta claramente distinguido da logica de "data de referencia" em todos os requisitos? [Consistencia, Spec §FR-002, Assumptions]
- [x] CHK020 - Os requisitos para o estado vazio de estacionamentos individuais (0 check-ins hoje) vs. estado vazio global (nenhum estacionamento) estao claramente distinguidos? [Clareza, Spec §FR-001, Spec §FR-004]

## Requisitos Nao-Funcionais

- [x] CHK021 - A meta de latencia de 3 segundos para notificacoes push (SC-002) e consistente com a decisao arquitetural de SSE (que pode ter atrasos de reconexao)? [Consistencia, Spec §SC-002, Research §Unknown 1]
- [x] CHK022 - Os requisitos de performance para o dashboard sob carga maxima (horarios de pico de check-in, todos os estacionamentos) estao especificados? [Completeza, Plan §Scale/Scope]
- [x] CHK023 - O requisito de estabilidade de "8 horas sem travamentos" (SC-004) esta acompanhado de requisitos de monitoramento/logging para a conexao SSE? [Completeza, Spec §SC-004]

## Dependencias e Premissas

- [x] CHK024 - A premissa de que "endpoints de API existentes sao suficientes" esta validada contra a necessidade real do novo endpoint de agregacao do dashboard? [Premissa, Spec §Assumptions]
- [x] CHK025 - A dependencia do suporte a streaming do Cloud Run (timeout de 60 min) esta documentada com mitigacao (reconexao automatica do EventSource)? [Dependencia, Plan §Constraints]

## Notas

- Profundidade: auto-revisao do autor, 25 itens cobrindo UX, tempo real, API, casos limite, nao-funcionais e dependencias.
- Criado apos spec, plan, research e contracts estarem completos.
- Nenhum item testa implementacao — todos os itens avaliam a qualidade dos requisitos.
