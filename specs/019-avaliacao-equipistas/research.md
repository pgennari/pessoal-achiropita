# Research: Avaliacao de Equipistas

## Status: Pesquisa concluida sem clarificacoes pendentes

Nao ha `NEEDS CLARIFICATION` no Technical Context. Todas as decisoes de design foram resolvidas com base na arquitetura existente (API Hono + PostgreSQL, SPA React + TanStack Query) e nos padroes ja consagrados no repositorio.

## Decisoes

| Decisao | Escolha | Racional | Alternativas Consideradas |
|---------|---------|----------|---------------------------|
| Identificacao do coordenador no link publico | Somente o numero do cracha | A spec define apenas cracha como campo de identificacao; o link publico ja e o primeiro nivel de acesso e o risco e baixo (avaliacao, nao operacao critica) | Cracha + ano de nascimento: descartado conforme decisao do usuario. Cracha + PIN: descartado por adicionar fricao desnecessaria |
| Como saber se o cracha e de coordenador e qual e a equipe | Via `participacoes` com `funcao = 'Coordenador'` na edicao do link | E o modelo autoritativo de alocacao de pessoas em equipes; cobre todos os coordenadores, incluindo os sem usuario cadastrado | `usuarios.equipes_crd`: descartado por so cobre CRDs com conta e poder divergir da alocacao real |
| Modelo de dados da avaliacao | Tabela `avaliacoes` com id gerado no backend, UNIQUE(pessoa_id, edicao_id) | Garante maximo 1 avaliacao por equipista por edicao; segue o padrao de registros unicos do sistema (presencas, formacoes) | ID composto `${edicaoId}__${pessoaId}`: considerado mas rejeitado por nao permitir rascunho + finalizada (mesmo que apenas 1 por edicao, o ID composto limita a criacao antes da finalizacao) |
| Link de avaliacao | Tabela `links_avaliacao` com id = token (32 hex), um unico link ativo por edicao | Mesmo padrao de `links_validacao` e `links_presenca`; gera apenas quando a tela interna pede | Link pre-gerado na criacao da edicao: descartado por acoplar edicao ao fluxo de avaliacao |
| Protecao das chamadas apos identificacao do coordenador | JWT curto assinado (HS256, 1h) com `pessoaId, cracha, edicaoId, equipeId, linkToken`, reusando `jose` | Impede que qualquer pessoa consulte equipistas sem validar como coordenador; segue o padrao de `sessaoPresenca.ts` | Enviar `crachaCoordenador` em cada chamada: rejeitado por permitir sondagem da API |
| Salvamento de rascunho | Auto-save no frontend com debounce de 2 segundos, chamando `PUT /api/avaliacao/:id` | Conforme spec: "salvamento automatico com debounce de 2 segundos"; mantem dados即使 com recarga de pagina | Botao "Salvar" manual: descartado por divergir da spec que pede auto-save |
| Criterios de avaliacao | Campos JSONB na tabela `avaliacoes` armazenando `{pontualidade, dedicacao, companheirismo, espiritualidade, comprometimento, uniforme}` | 6 criterios fixos com 4 opcoes cada; JSONB e flexivel e evita 6 colunas separadas; consulta por criterio e possivel com `->>` | 6 colunas separadas: considerado mas rejeitado por poluir o schema com campos que sempre vêm juntos |
| Exibicao na tela da Pessoa | Nova aba "Historico de Avaliacoes" em `PessoaDetalhe.tsx`, listando avaliacoes por edicao | Conforme spec: aba junto com as outras abas de historicos existentes; segue o padrao de tabs ja existente | Tela separada: descartado por nao integrar ao fluxo existente de visualizacao da pessoa |
| Exibicao na tela da Edicao | Secao de avaliacao em `EdicaoDetalhe.tsx` com link + listagem | Conforme spec: link publico e listagem de avaliacoes na tela de detalhes da edicao | Tela separada `/avaliacoes`: descartado pelo usuario |
| Revogacao do link | Revogacao nao afeta avaliacoes em andamento | Conforme spec: avaliacoes permanecem no status em que estiverem | Excluir avaliacoes ao revogar: descartado pela spec |
| Participacao removida | Equipista some da lista de avaliacao no link publico | Conforme spec: "deve sumir da lista de avaliacao no link publico" | Manter na lista com indicador: descartado pela spec |

## Dependencias

Nenhuma nova dependencia.

Infraestrutura existente reutilizada:
- `gerarToken()` em `src/lib/links.ts` — geracao do token do link publico
- `criarSessaoPresencaJwt()` / `comSessaoPresenca` em `api/src/sessaoPresenca.ts` — JWT curto assinado (estendido com `SessaoAvaliacao`)
- `comAuth` + `podeAdministrar` em `api/src/auth.ts` — rotas internas ADM/ORG
- `registrarEvento` em `api/src/auditoria.ts` — auditoria da geracao de links
- `useEdicaoAtiva` em `src/lib/hooks.ts` — edicao ativa
- Padrao `.tabs`/`role="tablist"` de `EdicaoDetalhe.tsx` — abas na edicao e na pessoa
- Padrao de pagina publica anonima de `CheckinPublico.tsx`/`PresencaPublico.tsx`

## Observacoes de seguranca

- `GET /api/publico/avaliacao/:token` retorna apenas status do link e dados basicos da edicao, sem equipes nem pessoas.
- `POST /api/publico/avaliacao/coordenador` usa a **mesma** mensagem generica para cracha inexistente e nao-coordenador ("Acesso negado") para nao confirmar existencia de cracha.
- `POST /api/publico/avaliacao/equipistas` e `PUT /api/publico/avaliacao/:id` exigem Bearer JWT da sessao de avaliacao e revalidam o link ativo no banco.
- A rota de listagem de equipistas revalida que o coordenador so ve equipistas da propria equipe.
- Avaliacoes finalizadas nao podem ser alteradas — validacao no backend impede UPDATE quando `status = 'finalizada'`.
