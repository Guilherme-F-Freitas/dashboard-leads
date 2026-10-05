const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const N8N_DASHBOARD_URL =
  process.env.N8N_DASHBOARD_URL ||
  'https://n8n-production-a7337.up.railway.app/webhook/dashboard-bona';

const N8N_LIBERAR_AUTOMACAO_URL =
  process.env.N8N_LIBERAR_AUTOMACAO_URL ||
  'https://n8n-production-a7337.up.railway.app/webhook/liberar-automacao';

app.use(express.json());
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

app.post('/api/liberar-automacao', async (req, res) => {
  try {
    const telefone = String(req.body?.telefone || '').trim();

    if (!telefone) {
      return res.status(400).json({ error: 'Telefone não informado' });
    }

    const response = await fetch(N8N_LIBERAR_AUTOMACAO_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ telefone })
    });

    const text = await response.text();

    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      return res.status(502).json({
        error: 'Erro ao liberar automação no n8n',
        status: response.status,
        details: data
      });
    }

    res.json({
      ok: true,
      telefone,
      resultado: data
    });
  } catch (error) {
    res.status(500).json({
      error: 'Falha ao liberar automação',
      details: error.message
    });
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Dashboard rodando na porta ${PORT}`);
});