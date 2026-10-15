# Dashboard Leads - Bona Chopp

## Next.js (nova interface)

O painel foi reconstruído em Next.js com a mesma integração n8n e os mesmos fluxos administrativos: login, atualização automática, paginação, entregas, confirmação/recusa de pedidos, devolução de leads para automação e gestão do catálogo.

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`. Para produção, use `npm run build` e `npm start`.

As variáveis de ambiente existentes continuam necessárias: `DASHBOARD_USER`, `DASHBOARD_PASSWORD`, `SESSION_SECRET`, `N8N_ADMIN_TOKEN` e as URLs `N8N_*` documentadas abaixo.

Novidades:
- destaca leads em `aguardando_atendente`
- botão "Devolver para automação"
- proxy backend para chamar o webhook n8n sem problema de CORS
- paginação de pedidos e leads, com indicadores globais
- alertas de execuções que precisam de revisão
- confirmação pela equipe de pedidos em `aguardando_confirmacao`, após verificar estoque, cidade, data e entrega; após confirmar, o n8n envia a mensagem automática ao cliente pela Evolution
- navegação por abas entre Entregas, Pedidos, Catálogo e Leads, com contadores e uma seção visível por vez
- pedidos com vários barris: itens listados um a um no painel, marcação de barril CONDICIONAL e valor principal separado do valor condicional
- conclusão de entregas diretamente pela aba Entregas: o pedido é marcado como entregue, some da lista de tarefas pendentes e permanece registrado no histórico de pedidos
- inclusão, alteração de preço e exclusão segura de produtos; a exclusão desativa o item para preservar o histórico e todas as operações ficam auditadas no n8n
- token administrativo somente no servidor, identificação do operador para auditoria, limites de login e bloqueio de requisições vindas de outras origens

Variáveis obrigatórias para produção:
- `DASHBOARD_USER`, `DASHBOARD_PASSWORD`, `SESSION_SECRET`
- `N8N_ADMIN_TOKEN`: deve corresponder à credencial Header Auth administrativa do n8n. Nunca incluir no HTML público.

Variáveis opcionais no Railway:
- `N8N_DASHBOARD_URL`
- `N8N_LIBERAR_AUTOMACAO_URL`
- `N8N_ATUALIZAR_PRECO_URL`
- `N8N_CONFIRMAR_PEDIDO_URL`
- `N8N_RECUSAR_PEDIDO_URL`
- `N8N_CONCLUIR_ENTREGA_URL`
- `DASHBOARD_ORIGIN` (padrão: `https://dashboard-leads-production.up.railway.app`)

Os webhooks administrativos precisam estar publicados antes de implantar o painel. Use HTTPS. O limite de tentativas de login é por processo e reinicia em um deploy; múltiplas réplicas precisam compartilhar esse controle.
