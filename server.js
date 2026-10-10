const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const N8N_DASHBOARD_URL =
  process.env.N8N_DASHBOARD_URL ||
  'https://n8n-production-a7337.up.railway.app/webhook/dashboard-bona';

const N8N_LIBERAR_AUTOMACAO_URL =
  process.env.N8N_LIBERAR_AUTOMACAO_URL ||
  'https://n8n-production-a7337.up.railway.app/webhook/liberar-automacao';

const N8N_ATUALIZAR_PRECO_URL =
  process.env.N8N_ATUALIZAR_PRECO_URL ||
  'https://n8n-production-a7337.up.railway.app/webhook/produtos-preco';

const DASHBOARD_USER = process.env.DASHBOARD_USER || '';
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const N8N_ADMIN_TOKEN = process.env.N8N_ADMIN_TOKEN || '';

function n8nHeaders(extra = {}) {
  return {
    Accept: 'application/json',
    ...extra,
    ...(N8N_ADMIN_TOKEN ? { 'X-Bona-Admin-Token': N8N_ADMIN_TOKEN } : {})
  };
}

const SESSION_COOKIE = 'bona_dashboard_session';
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

app.use(express.json());

function safeCompare(a, b) {
  const hashA = crypto.createHash('sha256').update(String(a)).digest();
  const hashB = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return header.split(';').reduce((cookies, item) => {
    const index = item.indexOf('=');
    if (index === -1) return cookies;
    const key = item.slice(0, index).trim();
    const value = item.slice(index + 1).trim();
    if (key) {
      try { cookies[key] = decodeURIComponent(value); } catch { /* Cookie inválido. */ }
    }
    return cookies;
  }, {});
}

function createSessionToken(username) {
  const issuedAt = Date.now();
  const payload = `${username}.${issuedAt}`;
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('hex');

  return Buffer.from(
    JSON.stringify({ username, issuedAt, signature })
  ).toString('base64url');
}

function validateSessionToken(token) {
  if (!token || !SESSION_SECRET) return false;

  try {
    const decoded = JSON.parse(
      Buffer.from(token, 'base64url').toString('utf8')
    );

    const username = String(decoded.username || '');
    const issuedAt = Number(decoded.issuedAt);
    const signature = String(decoded.signature || '');

    if (!username || !Number.isFinite(issuedAt) || !signature) return false;
    if (issuedAt > Date.now() || Date.now() - issuedAt > SESSION_DURATION_MS) return false;

    const payload = `${username}.${issuedAt}`;
    const expectedSignature = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(payload)
      .digest('hex');

    if (!safeCompare(signature, expectedSignature)) return false;
    return safeCompare(username, DASHBOARD_USER);
  } catch {
    return false;
  }
}

function isAuthenticated(req) {
  const cookies = parseCookies(req);
  return validateSessionToken(cookies[SESSION_COOKIE]);
}

function requireAuth(req, res, next) {
  if (isAuthenticated(req)) return next();

  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  return res.redirect('/login');
}

app.get('/login', (req, res) => {
  if (isAuthenticated(req)) return res.redirect('/');
  return res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/api/login', (req, res) => {
  try {
    if (!DASHBOARD_USER || !DASHBOARD_PASSWORD || !SESSION_SECRET) {
      return res.status(500).json({
        error: 'Variáveis de autenticação não configuradas no Railway'
      });
    }

    const usuario = String(req.body?.usuario || '').trim();
    const senha = String(req.body?.senha || '');

    if (
      !safeCompare(usuario, DASHBOARD_USER) ||
      !safeCompare(senha, DASHBOARD_PASSWORD)
    ) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }

    const token = createSessionToken(DASHBOARD_USER);
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: SESSION_DURATION_MS,
      path: '/'
    });

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({
      error: 'Falha ao realizar login',
      details: error.message
    });
  }
});

app.post('/api/logout', (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';

  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/'
  });

  return res.json({ ok: true });
});

app.get('/api/session', (req, res) => {
  return res.json({ autenticado: isAuthenticated(req) });
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.use(requireAuth);
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/dashboard', async (req, res) => {
  try {
    const response = await fetch(N8N_DASHBOARD_URL, {
      headers: n8nHeaders(),
      signal: AbortSignal.timeout(15000),
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
    return res.json(data);
  } catch (error) {
    return res.status(500).json({
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
      headers: n8nHeaders({ 'Content-Type': 'application/json' }),
      signal: AbortSignal.timeout(15000),
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

    return res.json({ ok: true, telefone, resultado: data });
  } catch (error) {
    return res.status(500).json({
      error: 'Falha ao liberar automação',
      details: error.message
    });
  }
});

app.post('/api/produtos/preco', async (req, res) => {
  try {
    const id = Number(req.body?.id);
    const preco = Number(req.body?.preco);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID do produto inválido' });
    }

    if (req.body?.preco == null || String(req.body.preco).trim() === '' || !Number.isFinite(preco) || preco <= 0) {
      return res.status(400).json({ error: 'Preço inválido' });
    }

    const response = await fetch(N8N_ATUALIZAR_PRECO_URL, {
      method: 'POST',
      headers: n8nHeaders({ 'Content-Type': 'application/json' }),
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ id, preco })
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
        error: 'Erro ao atualizar preço no n8n',
        status: response.status,
        details: data
      });
    }

    return res.json({ ok: true, produto: data });
  } catch (error) {
    return res.status(500).json({
      error: 'Falha ao atualizar preço',
      details: error.message
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Dashboard rodando na porta ${PORT}`);
});
