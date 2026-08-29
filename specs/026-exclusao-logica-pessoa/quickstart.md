# Quickstart: Exclusao logica de pessoas

**Date**: 2026-08-29

## Pre-requisitos

- Aplicacao rodando localmente (`npm run dev` + API rodando)
- Migration de banco aplicada (producao: Neon SQL Editor; local: rodar o mesmo SQL):
  ```sql
  ALTER TABLE pessoas ADD COLUMN IF NOT EXISTS excluida BOOLEAN NOT NULL DEFAULT FALSE;
  ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS excluida BOOLEAN NOT NULL DEFAULT FALSE;
  ```
- Pelo menos uma edicao ativa com equipes, uma pessoa com vinculos diversos: 1+ alocacao em equipe, 1 veiculo vinculado (compartilhado e/ou exclusivo) e 1 vaga de estacionamento
- Permissao `pessoas.excluir` atribuida ao perfil do usuario de teste

## Cenarios de Validacao

### Cenario 1: Excluir pessoa sem vinculos

1. Faca login como usuario com permissao `pessoas.excluir`
2. Acesse a pessoa sem vinculos ativos > Excluir
3. **Esperado**: Confirmacao mostra contagem 0 de vinculos e 0 veiculos sem pessoa
4. Confirme
5. **Esperado**: Sucesso; a pessoa sai das listagens, busca e detalhe ("Pessoa não encontrada" ao abrir o link direto)

### Cenario 2: Excluir pessoa com vinculos (desfazer em massa)

1. Repita o cenario 1 com uma pessoa que tenha alocacoes em equipes (edicao ativa), veiculo vinculado, vaga de estacionamento e ao menos um parente
2. **Esperado**: Confirmacao mostra a contagem exata (alocacoes + veiculos + vagas + parentes) e quantos veiculos ficarao sem pessoa
3. Confirme
4. **Esperado**: Transacao conclui em <5s e retorna `vinculosDesfeitos = N` e `veiculosExcluidos = M`
5. **Esperado**: A pessoa some de alocacoes, vaga e parentesco nos dois sentidos; nenhum cadastro de equipe/veiculo/vaga/parente foi apagado
6. Verifique no Historico da pessoa: registro de desalocacao com origem = equipe e destino vazio
7. **Esperado**: Na auditoria, evento `pessoa.excluiu` com responsavel, data e contagens, sem redacao de apagamento permanente

### Cenario 3: Veiculo orfao vs compartilhado

1. **Veiculo exclusivo**: exclua a pessoa unica dona de um veiculo → o veiculo tambem sai das listagens; ao abrir o link direto do veiculo, "Veiculo não encontrado"; a placa continua reservada (criar novo veiculo com a mesma placa falha)
2. **Veiculo compartilhado**: exclua uma das pessoas donas → o veiculo permanece ativo e listado, com a outra pessoa ainda vinculada
3. **Desvincular manual**: na tela do veiculo, desvincule manualmente a ultima pessoa de um veiculo → o veiculo **permance ativo** (regra do orfao NAO se aplica fora da exclusao de pessoa)

### Cenario 4: Veiculo excluido com historico

1. Exclua uma pessoa cujo veiculo exclusivo tem historico de estacionamentos/check-ins
2. **Esperado**: A exclusao logica e permitida normalmente e o historico do veiculo permanece armazenado no banco (a retencao que travava a exclusao fisica nao se aplica)

### Cenario 5: Invisibilidade total

Apos excluir uma pessoa ("Maria #101"):

1. Listagem de pessoas / busca global: Maria nao aparece
2. Painel, relatorios, contexto de sincronizacao (planilha da edicao): Maria nao aparece
3. Seletor de pessoa em qualquer tela (vincular veiculo, ocupar vaga, associar parente, alocar em equipe): Maria nao aparece
4. Escala/montagem e bloqueios: Maria nao aparece
5. Estacionamento (ocupantes da vaga): Maria nao aparece
6. **Esperado em todos**: sem mensagens de erro, componentes renderizam normalmente

### Cenario 6: Fluxos publicos

1. **Validacao por cracha**: com a URL publica de validacao, tente validar o cracha da pessoa excluida → mensagem generica "Crachá ou ano de nascimento não conferem." sem exibir dados
2. **Presenca/avaliacao publica**: a pessoa excluida nao aparece como opcao
3. **Cantina**: pessoa excluida nao chega a aparecer (formulario anonimo); nada relacionado a ela e exibido

### Cenario 7: Link direto e acessos de mutacao

1. Copie a URL de uma pessoa, exclua-a e cole a URL → "Pessoa não encontrada", sem permitir ver, editar, reativar, bloquear nem excluir de novo
2. Tente (via API) `PUT /api/pessoas/{id}`, `PUT /api/pessoas/{id}/ativacao`, `POST /api/pessoas/{id}/veiculos`, `DELETE /api/pessoas/{id}/foto` → todos `404`
3. Tente excluir a mesma pessoa de novo (`DELETE /api/pessoas/{id}`) → `404` (e nao duplica efeito nem corrompe dados)

### Cenario 8: Bloqueio e inativacao

1. Pessoa excluida que estava bloqueada / com bloqueio pendente → some de tudo sem erro; estado de bloqueio deixa de ser visivel e operacional
2. Pessoa inativa excluida → exclusao permitida normalmente (inativacao e exclusao sao independentes)

### Cenario 9: Permissao negada

1. Faca login como usuario SEM permissao `pessoas.excluir`
2. Tente excluir uma pessoa (via API) e chamar `GET /api/pessoas/:id/exclusao-previa`
3. **Esperado**: `403 { "erro": "Acesso negado. Requer permissao pessoas.excluir." }` e nenhum registro alterado

## Comandos de Validacao

```bash
# Verificar que as colunas foram criadas
psql -d achiropita -c "SELECT table_name, column_name FROM information_schema.columns WHERE column_name='excluida' AND table_name IN ('pessoas','veiculos');"

# Estado final de uma pessoa excluida (registro preservado)
psql -d achiropita -c "SELECT id, nome, cracha, ativo, excluida FROM pessoas WHERE excluida = TRUE;"

# Veiculos excluidos junto (sem nenhuma pessoa restante)
psql -d achiropita -c "SELECT v.id, v.placa FROM veiculos v WHERE v.excluida = TRUE AND NOT EXISTS (SELECT 1 FROM pessoa_veiculo pv WHERE pv.veiculo_id = v.id);"

# Desalocacoes registradas na exclusao (origem = equipe, destino vazio)
psql -d achiropita -c "SELECT pessoa_id, equipe_origem_nome, equipe_destino_nome FROM pessoa_equipe_historico WHERE pessoa_id = 'ID' AND equipe_destino_id IS NULL ORDER BY criado_em DESC;"

# Vinculos desfeitos: alocacoes (ativas da pessoa), pessoa_veiculo, pessoa_vaga e parentes
psql -d achiropita -c "SELECT COUNT(*) FROM participacoes WHERE pessoa_id = 'ID';"   # participacoes de edicoes NAO encerradas == 0 (historicas preservadas)
psql -d achiropita -c "SELECT COUNT(*) FROM pessoa_veiculo WHERE pessoa_id = 'ID';"  # == 0
psql -d achiropita -c "SELECT COUNT(*) FROM pessoa_vaga WHERE pessoa_id = 'ID';"     # == 0
psql -d achiropita -c "SELECT COUNT(*) FROM parentes WHERE pessoa_id = 'ID' OR parente_id = 'ID';"  # == 0

# Historico preservado (nao foi apagado pelo cascade)
psql -d achiropita -c "SELECT COUNT(*) FROM presencas WHERE pessoa_id = 'ID';"     # == registros antigos intactos
psql -d achiropita -c "SELECT COUNT(*) FROM avaliacoes WHERE pessoa_id = 'ID';"    # == registros antigos intactos
psql -d achiropita -c "SELECT COUNT(*) FROM formacoes WHERE pessoa_id = 'ID';"     # == registros antigos intactos
psql -d achiropita -c "SELECT COUNT(*) FROM checkins WHERE pessoa_id = 'ID';"      # == registros antigos intactos

# Testar endpoints via API
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/pessoas/ID/exclusao-previa"
# == 200 { "vinculos": {...}, "totalVinculos": N, "veiculosSemVinculos": M }

curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/pessoas/ID"
# == 200 { "ok": true, "vinculosDesfeitos": N, "veiculosExcluidos": M }

curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/pessoas/ID"
# == 404 { "erro": "Pessoa não encontrada." }

curl -H "Authorization: Bearer $TOKEN" "http://localhost:8080/api/pessoas"
# == lista SEM a pessoa excluida

curl -H "Authorization: Bearer $TOKEN" "http://localhost:8080/api/pessoas/ID"
# == 404 { "erro": "Pessoa não encontrada." }
```

## Nota de implementacao esperada nas telas

As telas nao filtram no front: a API retorna listas ja limpas (pessoas e veiculos). Se uma pessoa ou veiculo excluido aparecer em alguma tela — inclusive publica — e bug do backend (filtro faltando em um endpoint), nao do front.