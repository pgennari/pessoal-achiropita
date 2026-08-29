# Quickstart: Exclusao lógica de equipes

**Date**: 2026-08-29

## Pre-requisitos

- Aplicacao rodando localmente (`npm run dev` + API rodando)
- Migration de banco aplicada: `ALTER TABLE equipes ADD COLUMN IF NOT EXISTS excluida BOOLEAN NOT NULL DEFAULT FALSE;` (producao: Neon SQL Editor; local: rodar o mesmo SQL)
- Pelo menos uma edicao ativa com equipes cadastradas (2+ equipes, duas pessoas alocadas para validar desalocacao em massa)
- Permissao `edicao.equipeExcluir` atribuida ao perfil do usuario de teste

## Cenarios de Validacao

### Cenario 1: Excluir equipe sem pessoas

1. Faca login como usuario com permissao `edicao.equipeExcluir`
2. Acesse Edicao da Festa > equipe desejada > Excluir
3. **Esperado**: Confirmacao mostra contagem 0 de pessoas alocadas
4. Confirme
5. **Esperado**: Mensagem de sucesso e a equipe sai das listagens (montagem, edicao, relatorios)

### Cenario 2: Excluir equipe com pessoas alocadas (desalocacao em massa)

1. Repita o cenario 1 com uma equipe que tenha 2+ pessoas alocadas
2. **Esperado**: Confirmacao mostra a contagem correta de pessoas alocadas
3. Confirme
4. **Esperado**: Transacao conclui em <5s e retorna `pessoasDesalocadas = N`
5. **Esperado**: Cada pessoa desalocada deixa de aparecer na equipe (nenhuma outra equipe ganha a pessoa automaticamente)
6. Verifique no Historico da pessoa: registro de desalocacao aparece com origem = equipe excluida e destino vazio

### Cenario 3: Invisibilidade total

Apos excluir uma equipe (ex.: "Barraca de Pastel"):

1. Tela de montagem de equipes: equipe nao aparece
2. Organograma da edicao: equipe nao aparece
3. Grade/relatorios de presenca da edicao: coluna/linha da equipe nao aparece
4. Relatorio de equipistas: equipe nao aparece
5. Busca/pesquisa de equipes: nao retorna a equipe excluida
6. **Esperado em todos**: sem mensagens de erro, componentes renderizam normalmente

### Cenario 4: Link direto para equipe excluida

1. Copie a URL de uma equipe existente, exclua a equipe, cole a URL
2. **Esperado**: Tela "Equipe não encontrada"

### Cenario 5: Subequipes apos exclusao da raiz

1. Tenha uma equipe pai com uma subequipe
2. Exclua a equipe pai
3. **Esperado**: A subequipe permanece ativa e visivel, agora sem equipe superior (organograma nao quebra)

### Cenario 6: Alocacao apos exclusao

1. Com uma equipe excluida, tente alocar pessoa nela atraves da tela de montagem
2. **Esperado**: A equipe nao esta disponivel no seletor de destino

### Cenario 7: Permissao negada

1. Faca login como usuario SEM permissao `edicao.equipeExcluir`
2. Tente excluir uma equipe (via API)
3. **Esperado**: `403 { "erro": "Acesso negado. Requer permissao edicao.equipeExcluir." }` e nenhum registro foi alterado

### Cenario 8: Equipe removida de relatorios de copia

1. Tenha uma edicao anterior com a equipe excluida
2. Use a funcao "copiar equipes" da edicao
3. **Esperado**: A equipe excluida nao e copiada

## Comandos de Validacao

```bash
# Verificar que a coluna foi criada
psql -d achiropita -c "SELECT column_name FROM information_schema.columns WHERE table_name='equipes' AND column_name='excluida';"

# Verificar o estado final de uma equipe excluida
psql -d achiropita -c "SELECT id, nome, ativo, excluida FROM equipes WHERE excluida = TRUE;"

# Verificar que participacoes da equipe foram removidas
psql -d achiropita -c "SELECT COUNT(*) FROM participacoes WHERE equipe_id = 'EQUIPE_EXCLUIDA';"  # == 0

# Verificar o historico de movimentacao das pessoas desalocadas
psql -d achiropita -c "SELECT pessoa_id, equipe_origem_nome, equipe_destino_nome, funcao, autor_nome FROM pessoa_equipe_historico WHERE equipe_origem_id = 'EQUIPE_EXCLUIDA';"

# Proteger contra recorrencia do erro de FK do hard delete
psql -d achiropita -c "DELETE FROM participacoes WHERE id = 'NAO_EXISTE';"  # nao deve retornar erro

# Testar endpoints via API
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/equipes/EQUIPE_EXCLUIDA"
# == 404 { "erro": "Equipe não encontrada." }

curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/equipes?edicaoId=EDICAO_ID"
# == lista SEM a equipe excluida

curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/equipes/relatorio-equipistas"
# == relatorio SEM a equipe excluida

curl -H "Authorization: Bearer $TOKEN" \
  -X POST -H "Content-Type: application/json" \
  -d '{"edicaoId":"EDICAO_ID","equipeId":"EQUIPE_EXCLUIDA","pessoaId":"PESSOA_ID","funcao":"eqp","pessoaNome":"X","equipeNome":"Y"}' \
  "http://localhost:8080/api/participacoes"
# == 404 { "erro": "Equipe não encontrada ou excluída." }
```

## Nota de implementacao esperada nas telas

As telas nao filtram no front: a API retorna listas ja limpas. Se uma equipe excluida aparecer em alguma tela, e bug do backend (filtro faltando em um endpoint), nao do front.