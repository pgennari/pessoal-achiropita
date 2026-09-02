# Spec: Simulacao de Perfil e Associaçoes (ADM)

**Feature Branch**: `031-simulacao-perfil` | **Data**: 2026-09-01

**Input**: User description: "O ADM deve poder simular o perfil e associação com equipes para poder testar as permissões do sistema."

## Resumo

O ADM ativa um **modo simulacao** que troca temporariamente o perfil e as
associacoes de equipes da propria sessao — sem alterar dados no banco — para
enxergar o sistema e ser autorizado exatamente como o perfil simulado. A
simulacao vale para **todas** as rotas autenticadas, inclui **mutacoes**
(criar/editar/apagar): as guards do backend decidem com a sessao simulada e
respondem `403` de verdade. O executor continua sendo o ADM real (uid/nome
reais na auditoria) e todos os eventos executados sob simulacao carregam a
marca `[simulacao perfil X]`.

Por seguranca, a simulacao **nunca amplia** o acesso do ADM: so ADM (perfil
real) pode simular, e a sessao simulada so herda as permissoes **ativas** do
perfil escolhido. Na pratica a simulacao apenas restringe o ADM.

## Decisoes

- **Forma**: dois atalhos — (a) simular um usuario existente (a partir da
  pagina Usuarios, pre-preenchendo perfil + equipes do usuario) e (b) escolher
  perfil e equipes avulsos (libertando combinacoes como "CRD de 2 equipes").
- **Escopo**: leitura **e** escrita; a sessao simulada participa de todas as
  rotas autenticadas como se fosse o perfil escolhido.
- **Estado**: client-side (`localStorage`), enviado como headers
  `X-Simulacao-Perfil` / `X-Simulacao-Equipes` em cada request. O servidor
  confere se o usuario REAL e ADM antes de aplicar.
- **Trilha**: os endpoints `POST /api/simulacao/ativar` e
  `DELETE /api/simulacao` registram eventos `simulacao.ativou` /
  `simulacao.encerrou` na auditoria (somente leitura de trilha; o efeito real e
  pelo header). Eventos executados sob simulacao recebem o sufixo
  `[simulacao perfil X]` nos detalhes.

## Perguntas e respostas

- Q: Persona simulada pode executar mutacoes reais? → A: Sim. Sem isso nao se
  testa permissao de escrita (ex.: CRD sem `pessoas.editar` recebe 403 real).
  O risco de alterar dados e do ADM, mitigado pelo banner sempre visivel e pela
  marca de simulacao na auditoria.
- Q: Quem pode simular? → A: Somente usuario com perfil real `ADM`. Para
  qualquer outro perfil os headers sao ignorados silenciosamente (nunca se
  revela a existencia da simulacao).
- Q: Simular ADM? → A: Sem efeito (sessao identica); a UI nao oferece essa
  opcao.
- Q: A simulacao persiste entre relogins / outra aba? → A: Sim, fica no
  `localStorage` e vale enquanto houver sessao logada como ADM naquele
  navegador. Encerra-se pelo banner ("Encerrar simulacao") ou ao sair do app.
- Q: E o que acontece com `pessoaId` do ADM? → A: A sessao simulada nao herda
  `pessoaId` (evita vazar o escopo `proprio` do ADM na simulacao).
- Q: Permissoes simuladas herdadas sao as do catalogo de perfis? → A: Sim,
  somente as permissoes **ativas** do perfil simulado (mesmo filtro do `comAuth`
  real). Codigo desativado nunca concede acesso.

## Roteiro de implementacao

### US-01 — Simular acesso (P1)

O ADM, na pagina Usuarios (acao "Ver como" por linha) ou pelo botao "Simular
acesso" no topo (perfil/equipes avulsos), ativa a simulacao. Um banner
persistente indica o perfil simulado e as equipes, com botao para encerrar.
Apos encerrar, o ADM volta a ver o sistema com a propria sessao (ADM).

**Historias (Given/When/Then)**

1. **Given** um ADM logado, **When** ele clica em "Simular acesso" e escolhe o
   perfil CRD com 2 equipes, **Then** a sessao passa a ser apresentada como CRD
   com as equipes escolhidas e o menu espelha as permissoes de CRD.
2. **Given** a simulacao ativa, **When** o ADM tenta abrir uma pagina que o
   perfil simulado nao pode acessar, **Then** a pagina mostra "Sem permissao"
   (mesma regra de qualquer usuario do perfil).
3. **Given** a simulacao ativa, **When** o ADM tenta uma mutacao que o perfil
   simulado nao autoriza (ex.: editar pessoa sem `pessoas.editar`), **Then** a
   API responde `403` e o evento fica registrado com a marca de simulacao.
4. **Given** a simulacao ativa, **When** o ADM clica em "Encerrar simulacao",
   **Then** a sessao volta a ser a real (ADM) e o sistema volta ao menu completo.
5. **Given** um usuario ORG logado, **When** ele envia headers de simulacao
   manualmente, **Then** a API ignora a simulacao e trata como sessao ORG normal.
6. **Given** a simulacao ativa, **When** o ADM abre `/api/usuarios/me`, **Then**
   a resposta reflete o perfil simulado (perfil, equipes e permissoes
   simuladas) para que a UI inteira espelhe a simulacao.

**Criterios de aceite (FR)**

- FR-001: Somente perfil real ADM pode simular; qualquer outro perfil ignora os
  headers de simulacao.
- FR-002: A sessao simulada herda apenas as permissoes ativas do perfil
  escolhido (nunca as do ADM) e nao herda `pessoaId`.
- FR-003: A simulacao vale para todas as rotas autenticadas, incluindo
  mutacoes; as guards decidem com a sessao simulada.
- FR-004: Um banner fixo indica "Simulacao ativa" com perfil e equipes e oferece
  "Encerrar simulacao"; o banner independe das permissoes do perfil simulado.
- FR-005: Inicio e fim da simulacao geram eventos de auditoria
  (`simulacao.ativou`, `simulacao.encerrou`); eventos executados sob simulacao
  ganham o sufixo `[simulacao perfil X]` (autor continua sendo o ADM real).
- FR-006: O estado da simulacao fica no `localStorage` e e enviado como headers
  `X-Simulacao-Perfil` / `X-Simulacao-Equipes` em todos os requests
  autenticados (exceto rotas publicas com `sessaoJwt`).
- FR-007: E possivel simular o perfil e as associacoes de equipes de um usuario
  existente (atalho da pagina Usuarios) ou informar perfil e equipes avulsos.

**Criterios de usabilidade (SC)**

- SC-001: O ADM inicia uma simulacao em ate 3 cliques.
- SC-002: O perfil simulado e sempre visivel (banner) enquanto a simulacao
  estiver ativa.

## Fora de escopo

- Simulacao por ORG ou perfis inferiores.
- Impersonacao total (agir em nome do usuario, telas de auditoria creditadas ao
  simulado). O executor e sempre o ADM real.
- Compartilhamento de simulacao entre navegadores/usuarios.