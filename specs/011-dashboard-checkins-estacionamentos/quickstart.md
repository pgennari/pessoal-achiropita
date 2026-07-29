# Quickstart: Dashboard de Check-ins em Tempo Real

## Pre-requisitos

- Projeto rodando localmente (`npm run dev` + `api/npm run dev`)
- Banco PostgreSQL com dados de estacionamentos, veiculos e check-ins
- Usuario logado com perfil ADM ou ORG
- Link publico de check-in de algum estacionamento (obtido na tela de detalhes do estacionamento)

## Cenario 1: Visualizar Dashboard

1. Acesse `/dashboard/estacionamentos` no navegador (apos login como ADM/ORG)
2. **Esperado**: Exibe todos os estacionamentos cadastrados com:
   - Nome e endereco
   - Numero de vagas contratadas
   - Indicador de ocupacao (verde/amarelo/vermelho) com percentual
3. Abaixo, exibe a secao "Ultimos check-ins" com registros do dia (ou "Nenhum check-in realizado hoje")
4. Teste: Se nao ha estacionamentos, exibe "Nenhum estacionamento cadastrado."

## Cenario 2: Ocupacao em Tempo Real

1. Acesse o dashboard
2. Em outra aba ou dispositivo, acesse o link publico de check-in de um estacionamento
3. Faca um check-in (pesquise uma placa valida e confirme)
4. **Esperado**: Em ate 3 segundos, o dashboard mostra:
   - Ocupacao do estacionamento atualizada (incrementada)
   - Notificacao visual com nome da pessoa, placa, estacionamento e horario
   - Novo check-in no topo da lista de ultimos check-ins

## Cenario 3: Notificacao Visual

1. Faca um check-in via link publico
2. **Esperado**: No dashboard, uma notificacao proeminente (toast/banner no topo) aparece com:
   - Nome da pessoa
   - Placa do veiculo
   - Nome do estacionamento
   - Horario do check-in
3. A notificacao desaparece automaticamente apos ~5 segundos
4. Faca multiplos check-ins rapidamente — cada um deve gerar sua propria notificacao

## Cenario 4: Reconexao

1. Abra o dashboard e confirme que esta recebendo atualizacoes
2. Pare o servidor backend (Ctrl+C no terminal da API)
3. **Esperado**: Dashboard exibe indicador "Atualizacao pausada - reconectando..." mas mantem os dados visiveis
4. Reinicie o servidor backend
5. **Esperado**: Dashboard reconecta automaticamente e o indicador de "pausado" desaparece

## Cenario 5: Estacionamento com 0 vagas

1. Crie ou edite um estacionamento com `vagasContratadas = 0`
2. Acesse o dashboard
3. **Esperado**: Estacionamento exibe "N/A" ou "Sem vagas contratadas" em vez de percentual, sem cor

## Cenario 6: Acesso Negado

1. Faca login com perfil CRD, EQP, OPC ou REC
2. Acesse `/dashboard/estacionamentos`
3. **Esperado**: A rota deve bloquear o acesso (redirecionar ou exibir erro 403)
