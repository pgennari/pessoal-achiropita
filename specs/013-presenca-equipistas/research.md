# Research: Presenca de Equipistas

## Status: Pesquisa concluida sem clarificacoes pendentes

Nao ha `NEEDS CLARIFICATION` no Technical Context. Todas as decisoes de design foram resolvidas com base na arquitetura existente (API Hono + PostgreSQL, SPA React + TanStack Query) e nos padroes ja consagrados no repositorio.

## Decisoes

| Decisao | Escolha | Racional | Alternativas Consideradas |
|---------|---------|----------|---------------------------|
| Identificacao do coordenador no link publico | Somente o numero do cracha (sem segundo fator) | A spec pede explicitamente apenas o cracha; o link publico e o primeiro nivel de acesso e o registro de presenca e de baixo risco | Cracha + ano de nascimento (padrao do fluxo de validacao). Rejeitada por divergir da spec e adicionar fricao ao fluxo de check-in em massa |
| Como saber se o cracha e de coordenador e qual e a equipe | Via `participacoes` com `funcao = 'Coordenador'` na edicao do dia do link | E o modelo autoritativo de alocacao de pessoas em equipes; cobre todos os coordenadores (tenham ou nao usuario cadastrado), e o fluxo publico nao tem login | `usuarios.equipes_crd` (via `pessoa_id`): rejeitado pois so cobre CRDs com conta e pode divergir da alocacao real de equipe na edicao |
| Coordenador com mais de uma equipe | Equipista valido se pertencer a qualquer uma das `equipeIds` do coordenador | Reutiliza a mesma regra de alocacao; evita bloqueio indevido | Exigir equipe unica: rejeitado por nao refletir a realidade (CRD pode liderar varias equipes) |
| Protecao das chamadas apos a identificacao do coordenador | JWT curto assinado (HS256, 1h) com `pessoaId`, `cracha`, `diaFestaId`, `edicaoId`, `equipeIds`, `linkToken`, reusando jose (`sessaoPublica.ts`) | Impede que qualquer pessoa consulte crachas de equipistas sem antes validar como coordenador; segue o padrao ja existente de sessao publica | Enviar `crachaCoordenador` em cada chamada: rejeitado por permitir sondagem da API sem validacao previa |
| Modelo de dados da presenca | Tabela `presencas` com id `${diaFestaId}__${pessoaId}` e snapshot de nome/cracha | Mesmo padrao de `formacoes`/`entregas_cracha`; garante unicidade por dia+pessoa de forma natural | Registro agregado (um doc por confirmacao com lista): rejeitado por dificultar consulta por pessoa/dia e quebrar o padrao de registros unicos do sistema |
| Link por dia | Tabela `links_presenca` com id = token (32 hex, gerado no cliente como `gerarToken()`), `status` ativo/revogado, um unico link ativo por dia | Mesmo padrao de `links_validacao`; gera apenas quando a tela interna pede, mantendo historico ao regenerar (revoga o ativo e cria novo) | Link gerado automaticamente na criacao do dia: rejeitado por acoplar `dias_festa` ao fluxo de presenca e criar lixo se o dia nao tiver presenca |
| Valores de `presencas` apos confirmacao | Cada equipista da lista vira uma linha; revalidacao no servidor por item (mesma equipe + nao ja registrado) | A lista vinda do cliente nao e confiavel; a validacao final acontece no backend (defense in depth) | Confiar na lista enviada: rejeitado por permitir registros indevidos |
| "Nome do cracha" exibido | O proprio `pessoa.nome` | Nao existe campo separado de nome de cracha no cadastro (`pessoas`); o cracha imprime nome + numero | Criar coluna `nome_cracha`: rejeitado por escopo extra sem necessidade na spec (assumption ja documentada) |
| Tela interna de presenca | Apenas abas + link publico (gerar/copiar) | MVP estrito: a spec nao pede listagem interna das presencas registradas | Tela interna de conferencia de presencas por dia: rejeitada por escopo fora da spec |

## Dependencias

Nenhuma nova dependencia.

Infraestrutura existente reutilizada:
- `gerarToken()` em `src/lib/links.ts` — geracao do token do link publico
- `criarSessaoJwt()` / `comSessaoPublica` em `api/src/sessaoPublica.ts` — JWT curto assinado (estendido com `SessaoPresenca`)
- `comAuth` + `podeAdministrar` em `api/src/auth.ts` — rotas internas ADM/ORG
- `registrarEvento` em `api/src/auditoria.ts` — auditoria da geracao de links
- `useEdicaoAtiva` + `useDiasFesta` em `src/lib/hooks.ts` — dias da festa da edicao ativa
- Padrao `.tabs`/`role="tablist"` de `EdicaoDetalhe.tsx` — abas por dia
- Padrao de pagina publica anonima de `CheckinPublico.tsx`/`ValidarPublico.tsx`

## Observacoes de seguranca

- `GET /api/publico/presenca/:token` retorna apenas status do link e dados do dia (data), sem equipes nem pessoas.
- `POST /api/publico/presenca/coordenador` usa a **mesma** mensagem generica para cracha inexistente e nao-coordenador ("Acesso negado") para nao confirmar existencia de cracha.
- `POST /api/publico/presenca/equipista` e `confirmar` exigem Bearer JWT da sessao de presenca e revalidam o link ativo no banco.
- A rota de confirmacao revalida cada equipista no servidor (mesma equipe, nao ja registrado) e grava em transacao.

## Notas sobre o estado do repositorio

A tabela/rota/hook de `dias_festa` ja existem mas estao **sem commit** na arvore de trabalho (feature anterior). A implementacao desta feature depende dessas mudancas; o `git status` atual contem `api/src/rotas/diasFesta.ts`, `src/lib/diasFesta.ts`, `src/lib/hooks.ts`, `src/lib/tipos.ts`, `src/pages/EdicaoDetalhe.tsx` e `schema.sql` modificados.
