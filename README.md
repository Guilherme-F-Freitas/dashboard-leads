# Dashboard Leads - Bona Chopp

Novidades:
- destaca leads em `aguardando_atendente`
- botão "Devolver para automação"
- proxy backend para chamar o webhook n8n sem problema de CORS
- paginação de pedidos e leads, com indicadores globais
- alertas de execuções que precisam de revisão
- confirmação pela equipe de pedidos em `aguardando_confirmacao`, após verificar estoque, cidade, data e entrega; essa ação não envia mensagem ao cliente
- token administrativo somente no servidor, identificação do operador para auditoria, limites de login e bloqueio de requisições vindas de outras origens

Variáveis obrigatórias para produção:
- `DASHBOARD_USER`, `DASHBOARD_PASSWORD`, `SESSION_SECRET`
- `N8N_ADMIN_TOKEN`: deve corresponder à credencial Header Auth administrativa do n8n. Nunca incluir no HTML público.

Variáveis opcionais no Railway:
- `N8N_DASHBOARD_URL`
- `N8N_LIBERAR_AUTOMACAO_URL`
- `N8N_ATUALIZAR_PRECO_URL`
- `N8N_CONFIRMAR_PEDIDO_URL`
- `DASHBOARD_ORIGIN` (padrão: `https://dashboard-leads-production.up.railway.app`)

Os webhooks administrativos precisam estar publicados antes de implantar o painel. Use HTTPS. O limite de tentativas de login é por processo e reinicia em um deploy; múltiplas réplicas precisam compartilhar esse controle.
