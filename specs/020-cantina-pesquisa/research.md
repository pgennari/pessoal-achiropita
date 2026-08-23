# Research: Pesquisa de Satisfacao da Cantina

**Feature**: `020-cantina-pesquisa` | **Data**: 2026-08-22

Nenhum item `NEEDS CLARIFICATION` restante do Technical Context. As decisoes abaixo
resolvem os pontos de design abertos da especificacao, sempre reutilizando padroes
ja existentes no codigo.

## D1. Rota publica fixa vs. link com token

- **Decision**: Rota publica fixa `/cantina/pesquisa`, sem token e sem autenticacao, exatamente como a URL divulgada pelo usuario (`https://achiropita-pessoal.web.app/cantina/pesquisa`).
- **Rationale**: A spec (FR-012) define link estatico e fixo; o dia da ida diferencia as respostas, nao o token. QR Code impresso nao pode expirar.
- **Alternatives considered**: Link com token por edicao (padrao de `links_avaliacao`/`links_presenca`) — rejeitado: criaria URL diferente da divulgada e exigiria gestao de revogacao fora do escopo.
- **Consequencia aceita**: Sem token, qualquer pessoa com a URL envia respostas; sem antispam nesta versao (Assumptions da spec). O POST publico grava apenas dados do formulario, sem retornar dados de terceiros.

## D2. Conflito de caminho entre pagina publica e pagina logada

- **Decision**: Pagina publica em `/cantina/pesquisa` (sem Layout); pagina da area logada em `/cantina/pesquisas`, com item "Pesquisa" dentro da nova secao "Cantina" do menu.
- **Rationale**: A URL divulgada pertence ao publico; react-router resolve a primeira correspondencia, entao a rota publica e declarada antes das rotas com Layout. Manter a pagina logada no mesmo caminho esconderia uma das duas.
- **Alternatives considered**: Area logada em `/cantina` (indice da secao) — rejeitado: o item "Pesquisa" apontaria para um caminho que nao descreve o conteudo; area logada em `/cantina/pesquisa/admin` — rejeitado: caminho confuso para navegacao manual.

## D3. Armazenamento das notas dos 5 criterios

- **Decision**: Coluna `notas JSONB NOT NULL DEFAULT '{}'` com chaves `atendimento`, `alimentacao`, `organizacao`, `ambiente`, `voluntarios` (inteiros 1–5), espelhando `avaliacoes.criterios`.
- **Rationale**: Precedente direto na tabela `avaliacoes`; o mapper converte para camelCase; permite novos criterios sem migracao.
- **Alternatives considered**: 5 colunas INTEGER NOT NULL — mais rigidas para consulta agregada simples, mas exigiriam ALTER TABLE para qualquer criterio novo e fogem do padrao existente. Rejeitado por consistencia.

## D4. Dia da ida: FK para dias_festa vs. data solta

- **Decision**: Coluna `dia_ida DATE` (nullable) sem chave estrangeira para `dias_festa`.
- **Rationale**: A resposta historica nao pode desaparecer ou mudar se o dia de festa for removido/recadastrado depois; a data ISO basta para agrupamento e analise. Nullable porque a spec permite envio sem dia selecionado quando nao ha dias cadastrados.
- **Alternatives considered**: FK `dia_festa_id REFERENCES dias_festa(id)` — rejeitado: ON DELETE obrigaria CASCADE (perda de resposta) ou SET NULL + JOIN desnecessario.

## D5. Opt-in "Deseja receber informacoes"

- **Decision**: Coluna `deseja_informacoes BOOLEAN NOT NULL DEFAULT FALSE`. Sem resposta equivale a Nao (edge case da spec). E-mail fica `NULL` quando opcional e nao informado; validacao condicional aplicada no cliente e no servidor (zod `.superRefine`: `email` obrigatorio e com formato valido somente quando opt-in = Sim).
- **Rationale**: Regra de obrigatoriedade condicional definida na clarificacao de 2026-08-22; duplicar a regra no servidor evita envio invalido contornando o cliente.
- **Alternatives considered**: TEXT 'Sim'/'Nao'/'SemResposta' — rejeitado: tres estados sem uso pratico nesta versao (sem exportacao/disparo).

## D6. Paginacao lazy-loading da listagem

- **Decision**: Endpoint interno `GET /api/cantina/pesquisas?offset=0&limit=20` ordenado por `criado_em DESC`; frontend acumula lotes com `useInfiniteQuery` (TanStack Query v5, dependencia existente) acionando `fetchNextPage` ao chegar ao fim da lista (scroll) com botao "Carregar mais" como fallback.
- **Rationale**: `hasMore` derivado de `limit + 1` linhas na consulta (ou total retornado); atende FR-008/009 sem carregar tudo. TanStack Query ja esta no projeto; nenhum virtualizador necessario para 20 itens por lote.
- **Alternatives considered**: Cursor keyset (`criado_em < anterior`) — tecnicamente superior em volumes enormes, mas offset/20 e trivial e suficiente para o volume esperado (milhares); rejeitar complexidade extra (Principio I).

## D7. Autorizacao da area logada

- **Decision**: Novo codigo de permissao `cantina.gerenciar` ("Cantina: gerenciar pesquisas") semeado no catalogo `permissoes` e adicionado ao perfil ORG no seed de `perfis` (padrao `avaliacao.gerenciar`). Gate unico nas rotas internas: `temPermissao(sessao, "cantina.gerenciar")`. No menu, a secao Cantina usa `permissoes: ["cantina.gerenciar"]`.
- **Rationale**: PBAC e o unico ponto de decisao de acesso (`pode()`); ADM tem acesso implicito. Spec assume ADM/ORG.
- **Alternatives considered**: Reutilizar `edicao.editar` — rejeitado: acoplaria cantina a permissao de edicao e impediria delegacao fina futura.

## D8. Lista publica de dias de festa

- **Decision**: Novo endpoint publico anonimo `GET /api/publico/cantina/dias-festa` retornando apenas `{ id, data }` dos dias de festa da edicao ativa (`status = 'ativa'`), ordenados por data.
- **Rationale**: O formulario publico nao tem sessao Firebase; a rota interna `GET /api/dias-festa` exige `comAuth`. Exposicao minima (so datas, sem nomes/ids internos sensiveis — id incluido apenas para mapear selecao).
- **Alternatives considered**: Embedar as datas no build — rejeitado: dias podem ser recadastrados apos o deploy; endpoint publico de edicoes generico — rejeitado: exporia mais dados que o necessario.

## D9. Envio do formulario publico

- **Decision**: `POST /api/publico/cantina/pesquisas` com zod validando payload completo (nome, email condicional, telefone/convite strings curtas, diaIda ISO date opcional e pertencente aos dias cadastrados quando informado, notas 1–5 completas, recomendaria enum, melhorias <= 4000). Resposta 201 com `{ ok: true }`; auditoria leve (`registrarEvento`) com autor "publico/cantina".
- **Rationale**: Mesma validacao da UI no servidor (fonte unica de verdade); auditoria segue padrao das rotas publicas existentes.
- **Alternatives considered**: Rate limiting por IP — adiado: sem precedentes nos fluxos publicos atuais e fora do escopo desta versao (documentado na spec).

## D10. QR Code e copia de link na pagina logada

- **Decision**: Modal/painel com SVG gerado por `QRCode.toString(url, { type: "svg", errorCorrectionLevel: "H" })` (lib `qrcode` ja usada em `QrEstacionamento.tsx`); Copiar via `navigator.clipboard.writeText` com confirmacao pelo componente `Toast` existente; Abrir via `window.open(url, "_blank")`.
- **Rationale**: Reuso direto de padroes implementados; zero dependencia nova.
- **Alternatives considered**: Gerar PNG para download — SVG inline atende visualizacao e impressao (padrao atual); download de arquivo fica fora do escopo.
