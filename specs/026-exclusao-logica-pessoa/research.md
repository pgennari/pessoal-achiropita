# Research: Exclusao lógica de pessoas

**Date**: 2026-08-29

## R1: Onde filtrar pessoas excluidas — API ou client?

**Decision**: Filtrar na API, na fonte: adicionar `excluida = FALSE` (ou `AND p.excluida = FALSE`) em TODAS as consultas que leem `pessoas` (e `veiculos`), nos dois escopos (logado e publico).

**Rationale**: A spec exige invisibilidade total (FR-004/FR-005) em telas que consomem `usePessoas` mas tambem em pontos que leem `pessoas` direto sobre o banco: sincronizacao (`sincronizacao.ts:248`), validacao publica por cracha (`publico.ts:185`), montagem, bloqueios, vagas, veiculos, presenca publica e avaliacao publica. O inventario de leituras (R16) mostra 33 consultas `FROM pessoas` espalhadas por 10 arquivos — filtrar no front por rota seria perder pontos. A API e o ponto unico de verdade; mesmo padrao e justificativa de 024 (R1).

**Alternatives considered**:
- Filtro client-side em cada tela: rejeitado — nao cobre publico, sincronizacao, validacao e relatorios proprio, e deixa pontos vazando.
- Filtro so em `usePessoas`: insuficiente — fluxos publicos e sincronizacao nao passam por ele.

## R2: Como marcar a pessoa e o veiculo excluidos no banco

**Decision**: Coluna `excluida BOOLEAN NOT NULL DEFAULT FALSE` em `pessoas` e em `veiculos`, adicionada por migration idempotente (`ALTER TABLE pessoas ADD COLUMN IF NOT EXISTS excluida BOOLEAN NOT NULL DEFAULT FALSE;` e o equivalente para `veiculos`). Sem novo indice, sem novo enum.

**Rationale**: Segue o padrao de flags booleanas do sistema (`pessoas.ativo`, `equipes.excluida` em 024). O "quando" da exclusao fica na auditoria (`pessoa.excluiu`), como em 024. Tabelas na ordem de milhares de linhas; o `ORDER BY p.cracha` existente ja cobre a listagem sem indice em `excluida` (precedente 024).

**Alternatives considered**:
- Enum (`ativa`/`excluida`): overkill para estado binario, nao ha terceiro estado previsto. Rejeitado.
- `excluida_em TIMESTAMPTZ` em vez de `BOOLEAN`: daria o momento, mas auditoria ja registra quem/quando. Rejeitado por minimalismo.

## R3: Comportamento do DELETE /api/pessoas/:id (soft delete em transacao)

**Decision**: Transformar o `DELETE FROM pessoas` em transacao (`sql.begin`), no mesmo formato de `deleteEquipeRoute` (`equipes.ts:336-401`):

1. `SELECT id, nome, cracha FROM pessoas WHERE id = ${id} AND excluida = FALSE FOR UPDATE` — nao encontrada/excluida → 404 "Pessoa não encontrada.".
2. Desalocar alocacoes **de edicoes nao encerradas** (`JOIN edicoes e ON e.id = part.edicao_id AND e.status <> 'encerrada'`): para cada uma, `INSERT INTO pessoa_equipe_historico` (origem = equipe, destino = NULL, autor = sessao — mesmo padrao de 024 e da desalocacao individual) e `DELETE FROM participacoes ...`.
3. Desvincular veiculos: ler os `veiculo_id` vinculados a pessoa, `DELETE FROM pessoa_veiculo WHERE pessoa_id = ${id}`, e marcar `UPDATE veiculos SET excluida = TRUE WHERE id = ANY(...) AND excluida = FALSE AND NOT EXISTS (SELECT 1 FROM pessoa_veiculo WHERE veiculo_id = veiculos.id)` — so os que ficaram sem nenhuma outra pessoa (FR-012/FR-013).
4. Liberar vaga: `DELETE FROM pessoa_vaga WHERE pessoa_id = ${id}` (edge case "vaga fica livre").
5. Remover parentesco nos dois sentidos: `DELETE FROM parentes WHERE pessoa_id = ${id} OR parente_id = ${id}` sem apagar cadastros dos parentes (edge case + FR-002).
6. `UPDATE pessoas SET excluida = TRUE, atualizado_em = NOW() WHERE id = ${id}`.
7. `registrarEvento(sessao, "pessoa.excluiu", "pessoas/${id}", "${nome} (#${cracha}) — ${N} vinculo(s) desfeito(s), ${M} veiculo(s) excluido(s) logicamente")` — redacao que nao sugere apagamento permanente (FR-008).

Retorna `{ ok: true, vinculosDesfeitos, veiculosExcluidos }` no 200.

**Rationale**: A espec exige "desfazer todos os vinculos de uma unica vez" (US1) com registro no historico (FR-002, US3) e preservacao dos demais cadastros. O lock da linha garante que a segunda exclusao concorrente leia 404 (edge case).

**Alternatives considered**:
- Depender do `ON DELETE CASCADE`: rejeitado — a linha nao e apagada, entao nenhum cascade dispara; e historicos seriam perdidos (FR-007). Todo desfazer e explicito na transacao.
- Rodar cada desvinculo sem transacao: rejeitado — exigiria estados intermediarios visiveis e quebraria SC-001.

## R4: Contagem dos vinculos antes da confirmacao (FR-003)

**Decision**: Novo endpoint prefligth `GET /api/pessoas/:id/exclusao-previa` (permissao `pessoas.excluir`), que retorna as contagens que o dialogo exibe antes do confirm: `{ vinculos: { equipes, veiculos, vagas, parentes }, totalVinculos, veiculosSemVinculos }` para a pessoa alvo (pessoa inexistente ou ja excluida → 404). O `DELETE` parelelo, na transacao, conta o mesmo conjunto e devolve os numeros no 200 (usados na auditoria).

**Rationale**: FR-003 exige avisar contagem **antes** de confirmar. O dialogo atual (`PessoaDetalhe.tsx:392-401`) nao tem esses numeros; deriva-los no front dos dados ja carregados (participacoes, veiculos, vaga, parentes) seria fragil e acoplado a paginas. Endpoint dedicado centraliza a regra de contagem junto da regra de exclusao.

**Alternatives considered**:
- Calcular no front a partir dos dados ja carregados: rejeitado — exige que o detalhe da pessoa carregue participacoes + veiculos + parentes + vaga e duplique a logica de "ativo" da API.
- Retornar a contagem no DELETE e usar no proximo clique: impossivel — FR-003 exige o aviso antes.

## R5: Escopo do desfazer vinculos — so edicoes nao encerradas

**Decision**: Na exclusao, desalocar apenas participacoes cujas edicoes tem `status <> 'encerrada'` (`planejamento` ou `ativa`). Participacoes de edicoes encerradas sao historico e permanecem intactas (US3, FR-007).

**Rationale**: A spec distingue "vinculos ativos" (desfeitos, US1/FR-002) de "historico de equipes preservado" (US3/FR-007). `status_edicao` tem `planejamento|ativa|encerrada` (`schema.sql:10`); os vinculos atuais sao os das edicoes em planejamento/ativa. 024 desalova tudo da equipe porque a equipe vive numa unica edicao; a pessoa participa de uma edicao por vez (UNIQUE(edicao_id, pessoa_id)) e pode ter historico em edicoes encerradas — apagar isso violaria FR-007.

**Alternatives considered**:
- Desalocar todas as participacoes (qualquer status): rejeitado — corrompe historico e contraria FR-007.
- Desalocar so edicoes `ativa`: rejeitado — uma pessoa alocada num planejamento ("agendada") deixaria a alocacao "viva" apontando para pessoa inexistente.

## R6: Veiculo orfao — regra restrita a exclusao de pessoa

**Decision**: A exclusao logica do veiculo sem donos acontece **somente** dentro do fluxo de exclusao de pessoa (passo 3 do R3). O desvincular manual (`DELETE /api/pessoas/:id/veiculos/:veiculoId` e o fluxo oposto na tela do veiculo) permanece como esta: remove o vinculo e o veiculo segue ativo mesmo sem pessoas (clarificacao da sessao 2026-08-29).

**Rationale**: Clarificacao explicita do usuario: a regra do orfao vale so quando o desvinculo e provocado pela exclusao da pessoa. Muda o minimo necessario no fluxo manual, preservando o comportamento atual.

**Alternatives considered**: Aplicar a regra de orfao tambem ao desvincular manual: rejeitado pelo usuario (resposta "A").

## R7: Leitura — listagem, detalhe, busca, seletores, relatorios

**Decision**: Filtrar `excluida = FALSE` em todas as leituras de `pessoas`:

- `GET /api/pessoas` (escopos geral, equipe e proprio): `WHERE p.excluida = FALSE` (FR-004).
- `GET /api/pessoas/:id`: ignorar excluidas → 404 "Pessoa não encontrada." (FR-006).
- Busca global / links de parente (`pessoas.ts:739,797,856-858`): excluem excluidas.
- Mutacoes da pessoa (`PUT /:id`, `PUT /:id/ativacao`, foto POST/DELETE, `GET/POST/DELETE /:id/veiculos`): guarda `excluida = FALSE` → 404 — impede editar, reativar, vincular (FR-006).
- Endpoints que **escolhem** pessoas em outras telas: `montagem.ts`, `bloqueios.ts`, `vagas.ts`, `veiculos.ts`, `participacoes.ts` (R16).
- `GET /api/pessoas/proximo-cracha`: **inalterado** — como `MAX(cracha)` cobre a tabela inteira (incluindo excluidas), o cracha permanece reservado automaticamente (FR-010).

**Rationale**: Filtro na fonte = invisibilidade em tudo que deriva de `pessoas`, incluindo seletores e relatorios servidos por endpoints proprios. O `proximo-cracha` nao precisa de mudanca porque a reserva ja e consequencia do soft delete.

**Alternatives considered**: 410 Gone na pessoa excluida: desnecessario — o front so precisa de "nao encontrada"; 404 e o codigo ja usado.

## R8: Fluxos publicos — validacao por cracha e telas publicas

**Decision**:

- `publico.ts` (identificar por cracha): `WHERE cracha = ${n} AND ativo = true AND excluida = FALSE` — pessoa excluida cai na mensagem generica "Crachá ou ano de nascimento não conferem." (nao vaza dado, FR-005).
- `presencaPublico.ts` (linhas 137, 203) e `avaliacaoPublico.ts` (linha 131): filtram `excluida = FALSE` nas pessoas oferecidas/validadas.
- Cantina publica: nao referencia pessoa (formulario anonimo em `pesquisas_cantina`, sem `pessoa_id`) — nada a filtrar; pessoa excluida nao chega la pois nao valida. FR-005 satisfeito por via da validacao.

**Rationale**: A validacao por cracha e a porta dos fluxos anonimos; filtrar ai corta o acesso. Sessoes JWT ja emitidas seguem valendo (a pessoa ja foi identificada); o unico resultado e a propria pessoa nao lograr dados de novos fluxos, sem cobertura de dados (FR-007 preservado). Os dados subjacentes seguem no banco.

**Alternatives considered**: Revogar sessoes publicas de pessoas excluidas em pleno voo: rejeitado — o JWT nao referencia o estado atual e o ganho e marginal (janela de segundos); nao ha requisito na spec exigindo revogacao.

## R9: Leitura historica da pessoa — o nome continua resolvendo

**Decision**: Nao filtrar `excluida` em consultas que apenas resolvem o **nome/identificacao** de registros historicos da pessoa (presencas, avaliacoes, formacoes, check-ins, historico de equipes). Como a linha nao e apagada, o `JOIN pessoas` continua devolvendo nome e cracha corretos (US3/FR-007). Links desses historicos para a pagina da pessoa resolvem como "nao encontrada" (R7) — mesmo comportamento de 024 para equipes excluidas (R6).

**Rationale**: A distincao "opcao/alvo" x "registro historico" ja validada em 024 (R5) se aplica igual aqui: exibir o nome gravado preserva o historico; filtrar essas leituras faria presencas/avaliacoes antigas da pessoa sumirem ou perderem nome.

**Alternatives considered**: Filtrar as leituras de nome historico: rejeitado — contraria FR-007 e SC-004.

## R10: Concorrencia — segunda exclusao da mesma pessoa

**Decision**: Usar `FOR UPDATE` (R3) sobre a linha alvo; a segunda exclusao espera o lock e, ao reler, nao encontra a pessoa com `excluida = FALSE` → 404 "Pessoa não encontrada." sem duplicar efeitos nem corromper dados (edge case "dois organizadores").

**Rationale**: Mesmo resultado de 024 (409 na equipe, aqui 404 pois a rota ja usa 404 para inexistente). Simples e suficiente; sem tratadores especiais.

## R11: Cracha e placa reservados

**Decision**:

- Cracha: sem mudanca — `pessoas.cracha` tem UNIQUE e `proximo-cracha` usa MAX sobre a tabela inteira; a exclusao nao reutiliza numero (FR-010, edge case).
- Placa: `veiculos.placa` tem UNIQUE (`schema.sql:336`); a exclusao logica mantem a linha, logo a placa continua reservada (FR-015, edge case).

**Rationale**: Nenhuma mudanca de criacao/cadastro e necessaria; a reserva e consequencia natural de nao apagar a linha.

**Alternatives considered**: Liberar numero/placa de excluidas: explicitamente proibido pela spec (edge cases FR-010/FR-015). Rejeitado.

## R12: Pessoa excluida bloqueada ou com bloqueio pendente

**Decision**: A exclusao nao toca a tabela `bloqueios` (append-only preservado, FR-007). Como a pessoa some de todas as listagens/seletores (R7) e o detalhe responde 404 (FR-006), o estado de bloqueio deixa de ser visivel e operacional, sem erro para ninguem (edge case).

**Rationale**: Limpeza/desbloqueio de excluidas nao e pedido pela spec; esconder a pessoa cobre o efeito operacional. Manter a linha de bloqueio preserva a trilha.

**Alternatives considered**: Revogar solicitacoes pendentes de bloqueio na exclusao: fora do escopo da spec (nao citado); rejeitado por MVP.

## R13: Foto preservada

**Decision**: A exclusao nao chama `deletarFoto` nem toca o Storage/R2; `foto_url` permanece na linha (FR-001). O endpoint `DELETE /:id/foto` (que apaga a foto) ganha o guarda `excluida = FALSE` → 404 (FR-006), mas o fluxo de exclusao nao apaga nada.

**Rationale**: FR-001 e assuncao da spec: nada e apagado do banco nem do armazenamento de fotos. A foto so e removida por acao explicita de "remover foto" em pessoa ativa.

## R14: Inativacao e exclusao sao estados independentes

**Decision**: Manter `ativo` como esta; adicionar `excluida` como flag nova independente. Pessoa inativa pode ser excluida normalmente (edge case); pessoa excluida nao e atingida por `PUT /:id/ativacao` (404). Filtros de leitura usam `ativo = true` **e** `excluida = false` (nunca um no lugar do outro).

**Rationale**: A spec e explicita: "inativacao e exclusao sao estados independentes". Nos fluxos publicos a validacao exige os dois (`publico.ts:185` ganha `AND excluida = FALSE` mantendo `ativo = true`).

## R15: Frontend — tipos, cache e dialogo

**Decision**:

- `src/lib/tipos.ts`: `Pessoa` e `Veiculo` ganham `excluida: boolean`.
- `src/lib/pessoas.ts`: `pessoaDeSnap` mapeia `excluida: (data.excluida as boolean) ?? false` (snapshots antigos nao quebram); `excluirPessoa` chama `GET /:id/exclusao-previa` para popular o dialogo e depois o `DELETE`, invalidando `["pessoas"]`, `["participacoes"]`, `["equipes"]`, `["veiculos"]`, `["vagas"]`, `["presenca"]`.
- `src/pages/PessoaDetalhe.tsx`: dialogo mostra a contagem (FR-003) e troca o texto removendo "definitivamente", "irreversivel" e "removidos permanentemente" (FR-011).
- Nenhuma tela filtra `excluida` no front (a API ja filtra) — mesma regra de 024 (R6).

**Rationale**: Menor superficie de mudanca no front; a API filtrada garante invisibilidade sem duplicacao de regra.

## R16: Inventario — leituras de `pessoas` e tabelas referenciadas (mapa transversal)

**Decision**: Mapa para a implementacao:

| Onde | Consulta | Acao |
|------|----------|------|
| `pessoas.ts` lista/detalhe/`proximo-cracha` | linhas 213-248, 304-312, 265 | lista/detalhe filtram; proximo-cracha inalterado |
| `pessoas.ts` busca/valida links | linhas 739, 797, 856-870, 1014 | filtrar excluida |
| `pessoas.ts` mutacoes (PUT/ativacao/foto/veiculos) | linhas 606, 629, 665, 580 | guarda excluida → 404 |
| `participacoes.ts` | linha 27 (valida pessoa ao alocar) | filtrar excluida |
| `veiculos.ts` | linhas 354, 392, 431 | filtrar pessoas e veiculos excluidos |
| `vagas.ts` | linhas 145, 153 | filtrar pessoas excluidas |
| `montagem.ts` | linhas 106, 219, 268 | filtrar pessoas excluidas |
| `bloqueios.ts` | linhas 173, 275 | filtrar pessoas excluidas |
| `sincronizacao.ts` | linha 248 | filtrar pessoas excluidas |
| `publico.ts` | linha 185 (validacao por cracha) | `AND excluida = FALSE` |
| `presencaPublico.ts` | linhas 137, 203 | filtrar pessoas excluidas |
| `avaliacaoPublico.ts` | linha 131 | filtrar pessoas excluidas |
| `presenca.ts` (registros da pessoa) | joins de nome | **nao** filtrar (R9) |
| `avaliacao.ts` (joins de nome) | joins | **nao** filtrar (R9) |

Tabelas que referenciam `pessoas.id` (`schema.sql`, 13 FKs) e o destino de cada uma na exclusao:

| Tabela | FK | Destino |
|--------|-----|---------|
| `participacoes` | CASCADE (141) | so edicoes nao encerradas sao desalocadas na tx (R5); demais preservadas |
| `pessoa_equipe_historico` | CASCADE (266) | preservado; tx adiciona a desalocacao da exclusao |
| `participacoes_historicas` | sem cascade (285) | preservado |
| `formacoes` | CASCADE (205) | preservado |
| `presencas` | CASCADE (480) | preservado |
| `links_foto` | CASCADE (222) | preservado |
| `links_avaliacao`/`avaliacoes` | CASCADE (796) | preservado |
| `checkins` | SET NULL (420) | preservado (sem DELETE, nao dispara SET NULL) |
| `pessoa_veiculo` | CASCADE (347) | desvinculos removidos na tx (R3) |
| `pessoa_vaga` | CASCADE (388) | vinculo removido na tx (R3) |
| `parentes` | CASCADE ambos (731/732) | removidos nos dois sentidos na tx (R3) |
| `bloqueios` | CASCADE (877) | preservado (R12) |
| `veiculo_estacionamento_historico` | via `veiculos` | preservado (FR-015) |

**Rationale**: O soft delete remove a dependencia dos CASCADEs: nenhum `DELETE FROM pessoas` ocorre mais, entao nada cascadeia; o que precisa "sumir" (vinculos) e removido explicitamente; o que deve permanecer (historico) fica intacto por construcao.

## NEEDS CLARIFICATION

> Nenhum. As unicas ambiguidades (destino do veiculo orfao e alcance da regra) foram esclarecidas na sessao 2026-08-29 e estao registradas em `spec.md` § Clarifications.

## Risks / Open Questions

- **JWT publico ja emitido**: uma sessao publica iniciada segundos antes da exclusao leva a pessoa ate a primeira validacao seguinte; a porta (identificar por cracha) ja filtra. Impacto desprezivel; registrado em R8.
- **Historico com link para pagina**: presencas/avaliacoes/check-ins antigos de pessoa excluida exibem nome mas o link para `/pessoas/{id}` responde "nao encontrada". Comportamento intencional (R9), igual a 024 para equipes.