# Research — Avaliacao de Coordenadores pelo Equipista (028)

Phase 0 do `/speckit.plan`. Resolve as questoes tecnicas/negocio levantadas no Technical Context e na spec, espelhando o padrao das features 019 e 027.

## 1. Questionario da 028

**Decision**: O questionario tem 6 criterios fechados (Pontualidade, Dedicacao, Companheirismo, Espiritualidade, Comprometimento, Uniforme), cada um com as opcoes da Avaliacao do Equipista (Otimo / Bom / Regular / Ruim), mais um campo aberto "Comentarios e Sugestoes". NAO inclui "chances de convidar novamente" nem "Apto a Coordenar?" (removidos por clarificacao da sessao 2026-08-30).

**Rationale**: Clarificacao explicita do usuario (Q2 da sessao de spec). Os 6 criterios e o campo de comentarios reproduzem a Avaliacao do Equipista (019), agora avaliando o coordenador.

**Alternatives considered**: (a) questionario proprio de coordenador (como a 027, 6 questoes diferentes) — rejeitado por nao atender ao pedido "igual a Avaliacao do Equipista"; (b) incluir a nota de convidar e apto a coordenar — rejeitado (removidos por decisao do usuario).

**Representacao**: os criterios sao gravados em coluna `criterios` JSONB (padrao da 019), pois o questionario e derivado dos criterios de equipista. So os 6 criterios sao persistidos; `comentarios` em coluna TEXT.

## 2. Cadastro ativo (validacao do cracha)

**Decision**: O equipista e considerado elegivel se a pessoa possui participacao (funcao `Equipista`) na edicao do link E `ativo = true` E `excluida = false`. A flag `bloqueada` NAO barra o fluxo, mantendo o comportamente dos fluxos publicos existentes (019/027), que nao filtram bloqueados na identificacao.

**Rationale**: A spec diz "validar se tem um cadastro ativo" — interpretado como a pessoa estar ativa e nao excluida logicamente na edicao, equivalente a regra usada na identificacao das avaliacoes existentes (`ativo = true AND excluida = FALSE`). A flag `bloqueada` nao e usada na identificacao publica atual; muda-la aumentaria escopo e divergiria do padrao.

**Alternatives considered**: (a) exigir tambem `bloqueada = false` — rejeitado por divergir do comportamento atual dos fluxos publicos e ampliar escopo; (b) exigir participacao com funcao especifica diferente de Equipista — rejeitado (a pessoa que avalia e o equipista).

## 3. Confirmacao de identidade (novo passo de UX)

**Decision**: No fluxo publico, apos informar o cracha, o backend valida cadastro ativo e retorna `nome`, `fotoUrl`, `nomeEquipe` e um token de confirmacao temporario (reeaproveitando o JWT de sessao curta). O frontend exibe foto, nome e equipe e pede "Confirma que e voce?". Somente ao confirmar, o frontend carrega a listagem de coordenadores usando a mesma sessao. Se a pessoa declarar "nao sou eu", encerra o fluxo sem revelar dados.

**Rationale**: E o requisito novo trazido pela spec (FR-009/FR-010), ausente nas 019/027. Delegar ao frontend usando os dados ja retornados na identificacao e simples e suficiente; o passo de confirmacao e de UX, nao de seguranca, pois o cracha ja e o identificador.

**Alternatives considered**: (a) confirmacao escalonada (ex.: segundo cracha ou data) — rejeitado, mais complexo e fora do pedido; (b) confirmacao no backend como requisicao separada — desnecessario, os dados ja estao na sessao; apenas nao se prossegue sem clicar "confirmar".

**Observacao**: fotoUrl vem de `pessoas.foto_url` (R2). Se a pessoa nao tem foto, o frontend exibe a inicial (padrao 019/027).

## 4. Alvos da avaliacao (coordenadores da pessoa)

**Decision**: Os alvos sao as pessoas com participacao `funcao = 'Coordenador'` na mesma equipe do equipista na edicao do link (via `participacoes`, que eh `UNIQUE(edicao_id, pessoa_id)`), com a pessoa `ativo = true` e `excluida = false`, excluindo o proprio avaliador. Como `participacoes` permite uma pessoa por edicao, o equipista pertence a uma unica equipe e os coordenadores dessa equipe sao os alvos.

**Rationale**: Clarificacao da sessao (Q3): listar todos os coordenadores da equipe do equipista, avaliáveis em um unico acesso. A equipe do equipista especifica os coordenadores-alvo. O equipista nao pode avaliar a si mesmo (se ele tambem for coordenador da propria equipe).

**Alternatives considered**: (a) coordenadores de todas as equipes da edicao — rejeitado (fora do pedido); (b) apenas coordenadores de equipes "APOIO" — rejeitado (nao se aplica, o avaliador e o equipista, nao um coordenador de equipe APOIO).

## 5. Link publico e referencia

**Decision**: Tabela `links_avaliacao_equipista` com `id` = referencia = `String(edicoes.ano)` (ex.: "2026"), no mesmo padrao da 027 (`links_avaliacao_coordenador`). Rota publica `GET /api/publico/avaliacao-equipista/{referencia}`. URL publica montada como `${origin}/avaliacao/equipista/${referencia}`. Controle ativo/revogado pelo mesmo enum `status_link`; "1 ativo por edicao" via UNIQUE parcial (padrao 027) ou controle na API.

**Rationale**: O usuario pediu expressamente o formato `avaliacao/equipista/2026`. Reutiliza o padrao de referencia-por-ano da 027, que eh deterministico e legivel.

**Alternatives considered**: (a) token aleatorio de 32 hex (como a 019) — rejeitado, o usuario pediu o formato legivel com o ano; (b) nova rota dentro de `/avaliacao/coordenadores` — rejeitado, o link deve ser distinto (`equipista`).

## 6. Sessao curta do equipista

**Decision**: Novo `api/src/sessaoEquipista.ts` com `criarSessaoEquipistaJwt` (HS256, 1h, `API_SECRET`/dev `dev-secret-achiropita-2026`) e middleware `comSessaoEquipista` que revalida o link ativo a cada chamada (410 se revogado). Payload `SessaoEquipista` em `api/src/tipos.ts`: `pessoaId`, `cracha`, `edicaoId`, `equipeId`, `linkToken`.

**Rationale**: Espelha exatamente `sessaoAvaliacao.ts`/`sessaoCoordenador.ts`. O equipista tem uma unica equipe (UNIQUE(edicao, pessoa)), entao a sessao carrega `equipeId` singular, como na 019.

**Alternatives considered**: (a) reutilizar `sessaoAvaliacao`/`sessaoCoordenador` diretamente — rejeitado, cada dominio tem payload e tabela de links propria (revalidacao em tabela especifica); (b) sessao sem revalidacao de link (como `sessaoPublica`) — rejeitado, o fluxo 028 usa link revogavel e deve revalidar.

## 7. Painel ADM/ORG e acompanhamento

**Decision**: Componente `SecaoAvaliacaoEquipistaCoordenadores.tsx` com link (copiar/gerar/revogar) e listagem com filtros por equipe, avaliador e status, espelhando `SecaoAvaliacaoCoordenadores.tsx`. Acesso com permissao `avaliacao.gerenciar`. Sem aba de historico na Pessoa nesta entrega (MVP: nao consta na spec da 028).

**Rationale**: A spec pede a listagem com filtros (FR-023/FR-024). O historico na Pessoa (presente na 019) nao foi pedido na 028 e fica fora de escopo (constitucao II).

**Alternatives considered**: (a) historico na Pessoa — rejeitado, fora do escopo da spec; (b) painel no detalhe da edicao — rejeitado, o padrao consolidado coloca o painel na pagina `/avaliacao` na aba.

## 8. Finalizacao e imutabilidade (sem rascunho)

**Decision**: NAO ha salvamento automatico de rascunho. O preenchimento fica apenas no estado do formulario no navegador; a avaliacao e persistida somente quando o equipista aciona FINALIZAR e confirma. Ao finalizar, o frontend exibe aviso "nao sera possivel editar apos finalizado" e pede confirmacao (modal). Apos o envio, avaliacao finalizada e imutavel (409 no backend) e a chave natural `(edicao_id, avaliador_pessoa_id, pessoa_id)` garante no maximo 1 avaliacao por equipista por coordenador por edicao. Na reentrada pelo cracha, o sistema apenas avisa "avaliacao ja enviada", sem revelar as respostas.

**Rationale**: Clarificacao da sessao 2026-08-30 emendou o pedido original: remover o salvamento automatico. Como nao ha mais rascunho, nao ha retorno com dados salvos; fechar a pagina a meio perde o preenchimento. A persistencia somente na finalizacao simplifica o modelo (nem estado `rascunho`, nem debounce, nem refs de autosave) e o "ja enviada" sem respostas atende a imutabilidade e a privacidade.

**Alternatives considered**: (a) manter autosave com debounce (como a 019) — rejeitado por decisao do usuario; (b) salvar rascunho manual — rejeitado, manteve o estado `rascunho` e o retorno com dados, contrariando o pedido de persistencia somente na finalizacao. Todos os 6 criterios sao obrigatorios para finalizar; comentario opcional.
