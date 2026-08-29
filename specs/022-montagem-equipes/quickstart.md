# Quickstart: Montagem de Equipes

**Date**: 2026-08-25

## Pre-requisitos

- Aplicacao rodando localmente (`npm run dev` + API rodando)
- Pelo menos uma edicao ativa com equipes cadastradas
- Pessoas cadastradas no sistema
- Permissao `edicao.montagem` atribuida ao perfil do usuario de teste

## Cenarios de Validacao

### Cenario 1: Tela carrega com listagem de equipes

1. Faca login como usuario com permissao `edicao.montagem`
2. Acesse o menu Edicao da Festa > Montagem
3. **Esperado**: Campo de filtro de equipes visivel + listagem horizontal de cards das equipes da edicao ativa

### Cenario 2: Selecionar equipe e ver candidatos

1. Na tela de Montagem, clique em uma equipe
2. **Esperado**: Secao de alocados aparece (vazia ou com pessoas)
3. **Esperado**: Listagem de candidatos aparece abaixo, ordenada por match decrescente
4. **Esperado**: Cada candidato mostra nome, match score, botoes "adicionar Coordenador" e "adicionar Equipista"

### Cenario 3: Lazy-loading de candidatos

1. Selecione uma equipe com mais de 20 candidatos
2. Rola a listagem de candidatos
3. **Esperado**: Botao "Carregar mais" aparece
4. Clique em "Carregar mais"
5. **Esperado**: Proximo lote de candidatos e carregado, listagem continua ordenada

### Cenario 4: Detalhar pessoa e ver match

1. Clique em um candidato da listagem
2. **Esperado**: Area expandida mostra foto, idade, detalhamento do match (historico, criterios, convidar novamente, presencas)
3. **Esperado**: Comentarios e sugestoes da avaliacao da edicao anterior sao exibidos
4. **Esperado**: Card de match historico da edicao retrasada (N-2) e exibido

### Cenario 5: Navegar historico de match

1. Na area expandida, clique na seta lateral do card historico
2. **Esperado**: Navega para dados de edicoes anteriores
3. Continue clicando ate a edicao mais antiga
4. **Esperado**: Seta desaparece quando nao ha mais edicoes

### Cenario 6: Adicionar pessoa como Equipista

1. Selecione uma equipe
2. Clique no botao "adicionar Equipista" de um candidato
3. **Esperado**: Pessoa e vinculada a equipe com funcao Equipista
4. **Esperado**: Pessoa aparece na secao de alocados
5. **Esperado**: Pessoa some da listagem de candidatos

### Cenario 7: Adicionar pessoa como Coordenador

1. Selecione uma equipe sem coordenador
2. Clique no botao "adicionar Coordenador" de um candidato
3. **Esperado**: Pessoa e vinculada a equipe com funcao Coordenador

### Cenario 8: Bloqueio de alocacao duplicada

1. Selecione uma equipe
2. Tente adicionar uma pessoa que ja esta alocada em outra equipe
3. **Esperado**: Mensagem de erro informando que a pessoa ja esta alocada

### Cenario 9: Bloqueio de vagas de coordenador

1. Selecione uma equipe com coordenador ja definido
2. Tente adicionar outro coordenador
3. **Esperado**: Mensagem informando que as vagas de coordenador estao preenchidas

### Cenario 10: Filtrar equipes

1. Na tela de Montagem, digite texto no campo de filtro
2. **Esperado**: Apenas equipes cujo nome contem o texto sao exibidas
3. Limpe o campo
4. **Esperado**: Todas as equipes sao exibidas novamente

### Cenario 11: Permissao negada

1. Faca login como usuario SEM permissao `edicao.montagem`
2. Tente acessar a tela de Montagem
3. **Esperado**: Mensagem de acesso negado ou rota nao visivel no menu

### Cenario 12: Match sem avaliacao

1. Selecione uma equipe
2. Verifique o match de uma pessoa que NAO possui avaliacao na edicao anterior
3. **Esperado**: Componentes de criterios e convidar novamente retornam 0
4. **Esperado**: Historico e presencas sao calculados normalmente (se disponiveis)

### Cenario 13: Match sem historico

1. Verifique o match de uma pessoa que NUNCA participou da equipe (ou equivalente)
2. **Esperado**: Componente de historico retorna 0

## Comandos de Validacao

```bash
# Verificar que a permissao foi criada
psql -d achiropita -c "SELECT * FROM permissoes WHERE codigo = 'edicao.montagem';"

# Verificar que o perfil ORG tem a permissao
psql -d achiropita -c "SELECT permissoes FROM perfis WHERE sigla = 'ORG';" | grep montagem

# Testar endpoint de candidatos
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/montagem/candidatos?edicaoId=EDICAO_ID&equipeId=EQUIPE_ID&limit=5"

# Testar endpoint de match historico
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/montagem/match/PESSOA_ID?edicaoId=EDICAO_ID"
```
