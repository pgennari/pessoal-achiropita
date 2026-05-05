# User Stories — Aplicativo de Gestão da Festa 100° (Achiropita · Bixiga)

## Visão geral

Aplicativo web responsivo (desktop e mobile, PWA) para gerenciar o cadastro e a operação da equipe da Festa de Nossa Senhora Achiropita do Bixiga, substituindo a planilha atual com **5.871 pessoas** e **27 edições de histórico**.

## Personas

| Sigla | Persona | Responsabilidade |
|---|---|---|
| **ADM** | Administrador | Acesso total; configuração do sistema, usuários, importações, auditoria |
| **ORG** | Organizador geral | Gestão da edição corrente: barracas, alocação, formação, comunicação |
| **CRD** | Coordenador de barraca | Gerencia equipe e operação da própria barraca |
| **EQP** | Equipista | Vê própria escala, atualiza dados pessoais, valida cadastro e confirma presença |
| **OPC** | Operador de campo | Controle de entrega de materiais, recepção |
| **REC** | Coordenador da Recreação | Controle das crianças durante a festa |

## Convenções

- **ID** no formato `US-EE-NN` (épico-número)
- **Prioridade**: 🔴 Alta · 🟡 Média · 🟢 Baixa
- **Fase**: `MVP` (entrega 1) · `v2` (operação em campo) · `v3` (otimizações)
- Critérios de aceite no formato GIVEN/WHEN/THEN simplificado quando útil

---

## EP-01 · Autenticação e controle de acesso

### US-01-01 — Login com e-mail e senha
**Como** qualquer usuário cadastrado,
**quero** entrar no sistema com e-mail e senha,
**para** acessar as funcionalidades conforme meu perfil.

**Critérios de aceite:**
- E-mail e senha validados via Firebase Authentication
- Mensagem de erro genérica para credenciais inválidas (sem distinguir e-mail inexistente vs senha errada)
- Bloqueio temporário após 5 tentativas falhas em 10 minutos
- Sessão persistente por 30 dias com opção "Manter conectado"

🔴 Alta · MVP

### US-01-02 — Login com conta Google
**Como** usuário,
**quero** entrar usando minha conta Google,
**para** evitar criar mais uma senha.

**Critérios de aceite:**
- Botão "Entrar com Google" no fluxo de login
- Vincula automaticamente se o e-mail Google bate com cadastro existente
- Bloqueia se o e-mail não estiver autorizado pelo admin

🟡 Média · MVP

### US-01-03 — Recuperação de senha
**Como** usuário que esqueceu a senha,
**quero** redefinir por e-mail,
**para** voltar a acessar o sistema.

**Critérios de aceite:**
- Link de redefinição válido por 1 hora
- Senha nova exige mínimo 8 caracteres com letra e número

🔴 Alta · MVP

### US-01-04 — Convite de novo usuário
**Como** ADM,
**quero** convidar uma pessoa pelo e-mail e atribuir um perfil,
**para** dar acesso controlado ao sistema.

**Critérios de aceite:**
- Convite envia link de cadastro válido por 7 dias
- Perfis disponíveis: ADM, ORG, CRD, EQP, OPC, REC
- CRD recebe vínculo a uma ou mais barracas no convite

🔴 Alta · MVP

### US-01-05 — Encerrar sessões ativas
**Como** usuário,
**quero** ver e encerrar sessões abertas em outros dispositivos,
**para** proteger a conta caso suspeite de acesso indevido.

🟢 Baixa · v3

---

## EP-02 · Cadastro de pessoas

### US-02-01 — Criar nova pessoa
**Como** ORG ou ADM,
**quero** cadastrar uma nova pessoa,
**para** incluí-la no banco da equipe.

**Critérios de aceite:**
- Número de crachá gerado automaticamente (próximo livre) ou definido manualmente
- Campos obrigatórios: nome, nascimento, telefone celular
- Campos opcionais: CPF, RG, e-mail, endereço completo, foto, estado civil
- Validação de CPF (algoritmo + duplicidade no banco)
- Detecção de possível duplicata por nome+nascimento exibe alerta antes de salvar

🔴 Alta · MVP

### US-02-02 — Editar dados da pessoa
**Como** ORG, ADM ou a própria pessoa (EQP),
**quero** atualizar informações cadastrais,
**para** manter os dados corretos.

**Critérios de aceite:**
- EQP só edita os próprios dados
- ORG/ADM editam qualquer cadastro
- Campos sensíveis (CPF, número de crachá) só são editáveis por ADM
- Toda alteração registra autor e data em `/auditoria`

🔴 Alta · MVP

### US-02-03 — Anexar foto da pessoa
**Como** ORG ou EQP,
**quero** enviar uma foto do rosto,
**para** identificação visual em listas, painéis e na entrega de materiais.

**Critérios de aceite:**
- Upload aceita JPG, PNG, HEIC; converte para JPG e redimensiona a 600×600
- Foto armazenada em Firebase Storage com URL no documento da pessoa

🔴 Alta · MVP

### US-02-04 — Marcar pessoa como inativa
**Como** ORG ou ADM,
**quero** desativar um cadastro sem apagar,
**para** preservar histórico mas remover da escala.

**Critérios de aceite:**
- Inativação não exclui o documento; seta `ativo: false`
- Pessoa inativa não aparece em buscas padrão (filtro precisa ser explícito)
- Histórico permanece acessível
- Reativação por ADM com um clique

🟡 Média · MVP

### US-02-05 — Buscar pessoa
**Como** qualquer usuário com acesso,
**quero** buscar por nome, crachá, CPF ou telefone,
**para** abrir o cadastro rapidamente.

**Critérios de aceite:**
- Campo de busca global presente em todas as telas (atalho `⌘+K` / `Ctrl+K`)
- Busca tolera espaços extras e acentos
- Resultado mostra foto, nome, crachá e barraca da edição corrente
- Limite de 20 resultados, paginação por scroll

🔴 Alta · MVP

### US-02-06 — Detectar e tratar duplicatas
**Como** ADM,
**quero** ver uma fila de possíveis cadastros duplicados,
**para** unificar os registros.

**Critérios de aceite:**
- Heurística: nome similar (Levenshtein) + nascimento igual ou CPF igual
- Tela mostra os dois registros lado a lado
- Botão "Mesclar" preserva o crachá mais antigo e move histórico
- Operação é reversível por 7 dias

🟡 Média · v2

### US-02-07 — Histórico de alterações
**Como** ADM,
**quero** ver o log de mudanças de um cadastro,
**para** investigar inconsistências ou auditar.

**Critérios de aceite:**
- Lista campo alterado, valor antigo, valor novo, autor, data/hora
- Filtro por período e por autor
- Exportável em CSV

🟢 Baixa · v2

---

## EP-03 · Família e Recreação

### US-03-01 — Cadastrar filhos
**Como** EQP, ORG ou ADM,
**quero** registrar os filhos da pessoa,
**para** gerenciar a Recreação durante a festa.

**Critérios de aceite:**
- Adicionar/remover múltiplos filhos
- Cada filho: nome, nascimento, flag "frequenta a Recreação"
- Idade calculada automaticamente

🟡 Média · MVP

### US-03-02 — Vincular cônjuge entre cadastros
**Como** ORG ou ADM,
**quero** vincular dois cadastros como cônjuges,
**para** identificar casais que servem juntos.

**Critérios de aceite:**
- Vínculo bidirecional automático
- Estado civil do par é atualizado
- Ao desfazer o vínculo, marca ambos como "separado(a)" se aplicável

🟢 Baixa · v2

### US-03-03 — Marcar parente que também é equipista
**Como** ORG,
**quero** sinalizar que a pessoa tem parentes na equipe,
**para** considerar isso na alocação (não separar famílias entre setores opostos).

🟢 Baixa · v2

---

## EP-04 · Histórico de participação

### US-04-01 — Ver linha do tempo da pessoa
**Como** ORG, CRD ou ADM,
**quero** ver o histórico completo de edições da pessoa,
**para** entender experiência e relacionamento.

**Critérios de aceite:**
- Linha do tempo visual da edição mais recente para a mais antiga
- Cada item mostra edição, barraca, função e setor
- Destaque visual para edições como Coordenador
- Resumo: total de edições, anos consecutivos, barracas frequentadas

🔴 Alta · MVP

### US-04-02 — Filtrar histórico por barraca ou função
**Como** ORG,
**quero** filtrar quem já trabalhou em determinada barraca/função,
**para** identificar veteranos ao montar a escala.

**Critérios de aceite:**
- Filtros combinados: barraca, função, edições mínimas, faixa etária
- Resultado exportável em CSV

🟡 Média · MVP

### US-04-03 — Sugerir candidatos a coordenador
**Como** ORG,
**quero** receber sugestões de pessoas aptas a coordenar uma barraca,
**para** acelerar o preenchimento das vagas-chave.

**Critérios de aceite:**
- Regra base: ≥3 edições como equipista na mesma barraca, idade ≥21
- ORG pode ajustar parâmetros da regra
- Lista pode ser marcada manualmente como "apto a coordenar"

🟡 Média · v2

---

## EP-05 · Edição corrente e alocação

### US-05-01 — Criar nova edição
**Como** ADM,
**quero** abrir uma nova edição da festa,
**para** começar a montar a escala.

**Critérios de aceite:**
- Define número, ano, datas de início e fim, status (planejamento, ativa, encerrada)
- Apenas uma edição em status "ativa" por vez
- Ao criar, oferece copiar barracas e estrutura da edição anterior

🔴 Alta · MVP

### US-05-02 — Cadastrar barracas e vagas
**Como** ORG,
**quero** definir as barracas da edição e quantas vagas cada uma tem por função,
**para** controlar o preenchimento.

**Critérios de aceite:**
- Barraca tem nome, setor (Interna/Externa/Alimentação) e vagas por função (coordenador, equipista, apoio)
- Edição em massa por importação CSV
- Indicação visual quando a soma de equipistas alocados ultrapassa as vagas previstas

🔴 Alta · MVP

### US-05-03 — Alocar pessoa em barraca
**Como** ORG ou CRD da barraca-destino,
**quero** atribuir uma pessoa a uma barraca e função,
**para** montar a escala.

**Critérios de aceite:**
- Drag-and-drop em desktop, seleção em lista no mobile
- Cria documento em `/participacoes`
- Mostra na hora o histórico da pessoa (foto, edições anteriores, função habitual)
- Conflito é bloqueado: a mesma pessoa não pode ser alocada em duas barracas na mesma edição

🔴 Alta · MVP

### US-05-04 — Mover pessoa entre barracas
**Como** ORG,
**quero** transferir alguém de uma barraca para outra,
**para** balancear a equipe.

**Critérios de aceite:**
- Histórico da movimentação fica auditado
- CRD da barraca de origem é notificado por push

🟡 Média · MVP

### US-05-05 — Ver vagas abertas vs preenchidas
**Como** ORG,
**quero** um painel com status de preenchimento por barraca,
**para** focar nas mais críticas.

**Critérios de aceite:**
- Tabela com barraca, vagas previstas, alocados, % de preenchimento
- Filtro por setor
- Linha em vermelho se preenchimento < 60%, amarelo entre 60-90%, verde acima

🔴 Alta · MVP

### US-05-06 — Importar escala da edição anterior
**Como** ORG,
**quero** começar a montagem com a escala da edição anterior pré-carregada,
**para** não montar do zero.

**Critérios de aceite:**
- Botão "Copiar escala da edição N-1" cria participações em rascunho
- Pessoas inativas e falecidas são automaticamente excluídas da cópia
- ORG revisa e confirma antes de publicar

🟡 Média · v2

### US-05-07 — Bloquear alocação de pessoa não-formada após prazo
**Como** ORG,
**quero** que após uma data X o sistema bloqueie alocar quem não fez formação,
**para** garantir que toda a equipe seja formada.

🟢 Baixa · v2

---

## EP-06 · Formação

### US-06-01 — Agendar sessões de formação
**Como** ORG,
**quero** cadastrar datas e turmas de formação,
**para** organizar a chamada e o controle de presença.

**Critérios de aceite:**
- Cada turma tem: data, horário, local, capacidade máxima
- Vínculo opcional com setor ou barraca específica

🟡 Média · MVP

### US-06-02 — Registrar presença manualmente
**Como** ORG,
**quero** marcar presença manualmente na lista,
**para** casos em que o equipista não conseguiu validar via link (falta de celular, problemas de acesso).

**Critérios de aceite:**
- Botão "Marcar presença manual" exige justificativa breve
- Pessoa marcada manualmente entra na lista de "validação pendente" (US-06-04)
- Registro fica auditado com nome do organizador que marcou

🟡 Média · MVP

### US-06-04 — Pendências de formação e validação
**Como** ORG,
**quero** ver duas listas separadas — quem ainda não fez formação e quem fez mas não validou os dados — para cobrar cada caso.

**Critérios de aceite:**
- Lista A: "Sem formação" — substitui completamente a aba "FALTA FORMAÇÃO" da planilha
- Lista B: "Formação feita, dados não validados" — pessoas marcadas manualmente
- Ambas agrupadas por barraca, com filtros por setor e função
- Botão "Gerar link individual de validação" na lista B (envia por WhatsApp/e-mail)
- Botão "Notificar todos" envia push e e-mail

🔴 Alta · MVP

### US-06-05 — Gerar link de validação para turma
**Como** ORG,
**quero** gerar um link público de validação por turma de formação,
**para** que os equipistas confirmem presença após validar seus dados.

**Critérios de aceite:**
- Botão "Gerar link" na tela da turma cria token único de ~24 caracteres
- URL pública no formato `https://achiropita100.app/v/{token}`
- Configurar prazo de expiração com data e hora final (sugestão: 2h após o término da formação)
- Exibe QR Code grande para projetar na sala e link curto para copiar
- Link pode ser revogado manualmente antes da expiração
- Painel mostra status (ativo, expirado, revogado) e contador de uso (quantos validaram)
- Reuso: se o link expirar antes do fim da turma, ORG gera um novo com poucos cliques

🔴 Alta · MVP

### US-06-06 — Validar dados via link público
**Como** EQP,
**quero** acessar o link disponibilizado pela organização, conferir e atualizar meus dados,
**para** confirmar minha presença na formação.

**Critérios de aceite:**
- Página acessível pelo link sem necessidade de login (autenticação por token + segundo fator)
- **Se token expirado ou revogado:** tela "Prazo expirado — fale com a organização"
- **Se válido:** identificação por número do crachá + ano de nascimento (segundo fator simples)
- Mostra dados atuais lado a lado: nome, contato, endereço, estado civil, filhos, foto
- Permite editar campos não-sensíveis (telefone, e-mail, endereço, filhos)
- Permite enviar/atualizar foto pelo celular (acesso à câmera)
- Botão final "Confirmar dados e presença"
- Ao confirmar: registra `dataFormacao` na participação da edição corrente, marca `dadosValidados: true` no perfil, incrementa contador do link
- Tela final de sucesso: "Presença registrada. Bem-vindo(a) à 100ª Festa da Achiropita."

🔴 Alta · MVP

---

## EP-07 · Entrega de materiais

> O crachá é **produzido externamente** pela organização. O app trata exclusivamente do **controle de entrega** dos materiais já produzidos (crachá, camiseta).

### US-07-02 — Marcar crachá entregue
**Como** OPC ou ORG,
**quero** registrar a entrega do crachá ao equipista,
**para** controlar quem já recebeu.

**Critérios de aceite:**
- Busca pela pessoa (nome ou número do crachá)
- Mostra foto do cadastro para conferência visual antes de confirmar
- Botão "Marcar entregue" registra data, hora e operador responsável
- Bloqueia segunda entrega; ADM pode desbloquear em casos de reposição
- Painel agrupado por barraca com totais "X de Y entregues"

🔴 Alta · MVP

### US-07-03 — Marcar camiseta entregue
**Como** OPC,
**quero** registrar entrega da camiseta com tamanho,
**para** evitar entrega duplicada.

**Critérios de aceite:**
- Busca por nome ou número do crachá
- Registra tamanho (PP, P, M, G, GG, XG, EG)
- Bloqueia segunda entrega; ADM pode desbloquear
- Painel mostra quantidades entregues por tamanho

🟡 Média · v2

### US-07-04 — Lista de pendências de fotos
**Como** ORG,
**quero** ver quem ainda não tem foto cadastrada,
**para** cobrar antes da impressão externa dos crachás.

**Critérios de aceite:**
- Substitui a aba "FALTA FOTO" da planilha
- Botão "Solicitar foto por e-mail" dispara mensagem com link de upload (link com expiração, mesma mecânica do EP-06)
- Filtros por barraca, setor

🔴 Alta · MVP

---

## EP-09 · Comunicação

### US-09-01 — Enviar e-mail por segmento
**Como** ORG,
**quero** disparar e-mail para um segmento,
**para** comunicar formação, escala, mudanças.

**Critérios de aceite:**
- Segmentos por barraca, função, setor, status (formação pendente, validação pendente, etc.)
- Modelos reutilizáveis com variáveis `{{nome}}`, `{{barraca}}`, `{{link_validacao}}`
- Envio via Firebase Extensions + SendGrid; histórico de envios em `/comunicacoes`
- Preview antes de enviar; teste para um e-mail próprio

🟡 Média · v2

### US-09-02 — Push notification
**Como** ORG,
**quero** enviar push para o app,
**para** comunicações urgentes.

**Critérios de aceite:**
- FCM com tópicos por barraca, setor, edição
- Apenas usuários com app instalado/PWA recebem

🟢 Baixa · v3

### US-09-03 — Mensagem para WhatsApp
**Como** ORG,
**quero** abrir uma conversa do WhatsApp pré-preenchida com a pessoa,
**para** falar diretamente quando o e-mail não basta.

**Critérios de aceite:**
- Botão "Abrir WhatsApp" no perfil; usa link `wa.me`
- Não envia automaticamente; só prepara a mensagem
- Suporta envio do link de validação (US-06-05) por WhatsApp em massa

🟢 Baixa · v2

---

## EP-10 · Dashboards e relatórios

### US-10-01 — KPIs da edição corrente
**Como** ORG ou ADM,
**quero** ver os indicadores principais em uma única tela,
**para** acompanhar o progresso.

**Critérios de aceite:**
- Cards com: total alocado, % vagas preenchidas, % formação concluída, **% dados validados**, % crachás entregues, % fotos cadastradas
- Atualização em tempo real via Firestore listeners

🔴 Alta · MVP

### US-10-02 — Distribuição demográfica
**Como** ORG,
**quero** ver gráficos de idade, gênero, estado civil e bairro,
**para** entender o perfil da equipe.

🟡 Média · v2

### US-10-03 — Retenção entre edições
**Como** ORG ou ADM,
**quero** ver quantos voltam edição após edição,
**para** medir engajamento.

**Critérios de aceite:**
- Gráfico de coorte: quem entrou na edição N e está ativo nas seguintes
- Top 10 pessoas com mais edições no histórico

🟡 Média · v2


---

## EP-11 · Recreação

### US-11-01 — Lista de crianças cadastradas
**Como** REC,
**quero** ver todas as crianças com flag "frequenta Recreação",
**para** preparar a operação.

**Critérios de aceite:**
- Total, faixa etária, responsáveis
- Filtro por dia da festa, idade

🟡 Média · v2

### US-11-02 — Check-in/check-out de criança
**Como** REC,
**quero** registrar entrada e saída da criança identificando o equipista responsável,
**para** auditar quem retirou.

**Critérios de aceite:**
- Busca do equipista responsável por nome ou número do crachá
- Após selecionar, lista os filhos cadastrados
- Toque seleciona qual criança está entrando/saindo
- Permite cadastrar autorização alternativa (avô, tio) com nome+RG
- Hora e operador ficam registrados

🔴 Alta · v2

### US-11-03 — Painel ao vivo da Recreação
**Como** REC ou coordenação geral,
**quero** ver quantas crianças estão na Recreação no momento,
**para** controle de capacidade.

🟡 Média · v2

---

## EP-12 · Configurações e administração

### US-12-01 — Definir edição corrente
**Como** ADM,
**quero** marcar qual edição é a "ativa",
**para** que o resto do sistema use essa referência.

🔴 Alta · MVP

### US-12-02 — Gerenciar usuários e permissões
**Como** ADM,
**quero** adicionar, remover e mudar perfil de usuários,
**para** controlar acesso.

🔴 Alta · MVP

### US-12-03 — Auditoria de alterações sensíveis
**Como** ADM,
**quero** consultar log de mudanças críticas,
**para** investigar incidentes.

**Critérios de aceite:**
- Eventos rastreados: criação/edição/inativação de pessoa, alteração de permissão, importação, exclusão de participação, emissão e revogação de link público, validações via link
- Filtros por usuário, módulo, período

🟡 Média · v2

### US-12-04 — Backup e exportação
**Como** ADM,
**quero** exportar todos os dados em JSON e CSV,
**para** ter backup independente do Firebase.

**Critérios de aceite:**
- Exportação manual sob demanda
- Inclui pessoas, participações, edições, barracas, auditoria, links de validação

🟡 Média · v2

### US-12-05 — Painel de links públicos ativos
**Como** ADM,
**quero** ver todos os links de validação emitidos,
**para** revogar acessos indevidos e auditar uso.

**Critérios de aceite:**
- Lista com tipo, turma associada, criado por, data de emissão, expiração, status, contador de uso
- Botão "Revogar" individual e em massa
- Filtros por status (ativo, expirado, revogado) e por criador

🟡 Média · v2

---

## EP-13 · Migração e importação inicial

### US-13-01 — Importar planilha legada
**Como** ADM,
**quero** carregar a planilha XLSX atual,
**para** popular o banco do app.

**Critérios de aceite:**
- Wizard com pré-visualização linha a linha
- Mapeamento das 90 colunas para a nova estrutura
- Aborta se houver erro crítico; gera relatório de inconsistências

🔴 Alta · MVP

### US-13-02 — Aplicar regras de limpeza
**Como** ADM,
**quero** que a importação aplique limpezas automáticas,
**para** não trazer o lixo da planilha.

**Critérios de aceite:**
- `trim()` em todos os campos texto (resolve "EQUIPISTA " vs "EQUIPISTA")
- Normalização de Estado Civil para 5 valores fechados
- Detecção de datas digitadas como número (`11061977` → revisão manual)
- Padronização de bairros via dicionário (`JD>` → `Jardim`)

🔴 Alta · MVP

### US-13-03 — Migrar histórico horizontal para vertical
**Como** ADM,
**quero** que as 52 colunas de histórico (Barraca_74 a Barraca_99) virem ~50 mil registros em `/participacoes`,
**para** ter o modelo certo para o futuro.

**Critérios de aceite:**
- Cada par (Barraca_X, Funcao_X) preenchido vira um documento
- Edição inferida do nome da coluna
- Pessoas com pares vazios não geram documentos espúrios

🔴 Alta · MVP

### US-13-04 — Relatório de qualidade da migração
**Como** ADM,
**quero** ver um relatório do que foi importado e o que ficou pendente,
**para** decidir o que revisar manualmente.

**Critérios de aceite:**
- Total de pessoas, participações, fotos importadas
- Lista de pendências: CPF inválido, data inválida, duplicatas suspeitas, bairro não normalizado

🔴 Alta · MVP


*Documento vivo — revisar antes de cada planning. Última atualização: 03/05/2026.*
