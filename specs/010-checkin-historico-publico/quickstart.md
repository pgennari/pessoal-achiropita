# Quickstart: Historico de Check-in no Link Publico

## Pre-requisitos

1. Banco PostgreSQL com schema executado (tabela `checkins` existente)
2. Backend Hono rodando localmente
3. Frontend Vite rodando localmente
4. Pelo menos 1 estacionamento cadastrado com token_checkin
5. Pelo menos 1 check-in registrado no estacionamento

## Cenarios de Validacao

### Cenario 1: Limpeza da busca apos check-in

1. Acesse `/checkin/{token}` (link publico)
2. Digite uma placa existente e clique em "Buscar"
3. Clique em "Check-in" em uma pessoa e confirme
4. **Esperado**: Lista de resultados desaparece, campo de placa fica vazio e focado, mensagem de sucesso visivel

### Cenario 2: Visualizar historico do dia atual

1. Acesse `/checkin/{token}`
2. **Esperado**: Secao "Ultimos check-ins realizados" aparece abaixo do formulario
3. **Esperado**: Check-ins do dia atual listados com hora, nome, placa e modelo/cor

### Cenario 3: Navegar entre abas de dias anteriores

1. Acesse `/checkin/{token}` em um dia seguinte a check-ins anteriores
2. **Esperado**: Abas visiveis para cada dia com check-ins
3. Clique em uma aba de dia anterior
4. **Esperado**: Check-ins daquele dia exibidos
5. Clique na aba de "Hoje"
6. **Esperado**: Volta a exibir check-ins do dia atual

### Cenario 4: Historico vazio

1. Acesse `/checkin/{token}` de um estacionamento sem check-ins
2. **Esperado**: Secao exibe "Nenhum check-in registrado."

### Cenario 5: Atualizacao apos check-in

1. Acesse `/checkin/{token}`
2. Realize um check-in
3. **Esperado**: O check-in recem-criado aparece no topo da lista "Ultimos check-ins realizados" sem recarregar a pagina

### Cenario 6: Token invalido

1. Acesse `/checkin/invalido123`
2. **Esperado**: Mensagem de erro, historico nao carregado

## Comandos de Validacao

```bash
# Build do frontend
npm run build

# Typecheck do frontend
npm run lint

# Build do backend
cd api && npm run build

# Testar endpoint de historico (sem token de autenticacao)
curl http://localhost:3000/api/publico/checkin/{token}/historico

# Testar historico de estacionamento inexistente
curl http://localhost:3000/api/publico/checkin/token_invalido/historico
```

## Verificacao de Performance

Para estacionamentos com muitos check-ins, verificar se a resposta do historico e retornada em menos de 3 segundos (SC-001).

```bash
# Medir tempo de resposta
time curl -s http://localhost:3000/api/publico/checkin/{token}/historico > /dev/null
```
