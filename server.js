const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const N8N_DASHBOARD_URL =
  process.env.N8N_DASHBOARD_URL ||
  'https://n8n-production-a7337.up.railway.app/webhook/dashboard-bona';

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/dashboard', async (req, res) => {
  try {
    const response = await fetch(N8N_DASHBOARD_URL, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });

    if (!response.ok) {
      return res.status(502).json({
        error: 'Erro ao consultar o n8n',
        status: response.status
      });
    }

    const data = await response.json();
    res.set('Cache-Control', 'no-store');
    res.json(data);
  } catch (error) {
    res.status(500).json({
      error: 'Falha ao carregar os dados do dashboard',
      details: error.message
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Dashboard rodando na porta ${PORT}`);
});