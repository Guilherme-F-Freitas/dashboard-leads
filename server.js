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
const N8N_CONFIRMAR_PEDIDO_URL = process.env.N8N_CONFIRMAR_PEDIDO_URL ||
  'https://n8n-production-a7337.up.railway.app/webhook/pedidos-confirmar';
const DASHBOARD_ORIGIN = process.env.DASHBOARD_ORIGIN || 'https://dashboard-leads-production.up.railway.app';

function n8nHeaders(extra = {}) {
  return {
    Accept: 'application/json',
    'X-Bona-Admin-Actor': DASHBOARD_USER,
    ...extra,
    ...(N8N_ADMIN_TOKEN ? { 'X-Bona-Admin-Token': N8N_ADMIN_TOKEN } : {})
  };
}

const SESSION_COOKIE = 'bona_dashboard_session';
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

app.set('trust proxy', 1);
app.use(express.json({ limit: '32kb' }));
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'same-origin');
  res.set('Cache-Control', 'no-store');
  if (req.method === 'POST' && (req.headers['sec-fetch-site'] === 'cross-site' ||
      (req.headers.origin && req.headers.origin !== DASHBOARD_ORIGIN &&
       !(process.env.NODE_ENV !== 'production' && /^http:\/\/localhost:\d+$/.test(req.headers.origin))))) {
    return res.status(403).json({ error: 'Origem não autorizada' });
  }
  next();
});
const loginAttempts = new Map();

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
    const now = Date.now();
    for (const [key, value] of loginAttempts) if (now >= value.until) loginAttempts.delete(key);
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    const attempt = loginAttempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
    if (attempt.count >= 10) {
      res.set('Retry-After', String(Math.ceil((attempt.until - now) / 1000)));
      return res.status(429).json({ error: 'Muitas tentativas. Aguarde antes de tentar novamente.' });
    }
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
      attempt.count++;
      loginAttempts.set(key, attempt);
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }

    const token = createSessionToken(DASHBOARD_USER);
    loginAttempts.delete(key);
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
    const pagina = Number(req.query?.pagina || 1);
    if (!Number.isSafeInteger(pagina) || pagina < 1 || pagina > 10000) {
      return res.status(400).json({ error: 'Página inválida' });
    }
    const url = new URL(N8N_DASHBOARD_URL);
    url.searchParams.set('pagina', String(pagina));
    const response = await fetch(url, {
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

    if (!/^\d{10,15}$/.test(telefone)) {
      return res.status(400).json({ error: 'Telefone inválido' });
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
      return res.status([400,404,409].includes(response.status) ? response.status : 502).json({
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

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID do produto inválido' });
    }

    if (req.body?.preco == null || String(req.body.preco).trim() === '' || !Number.isFinite(preco) || preco <= 0 || preco > 1000000) {
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
      return res.status([400,404,409].includes(response.status) ? response.status : 502).json({
        error: 'Erro ao atualizar preço no n8n',
        status: response.status,
        details: data
      });
    }

    return res.json({ ok: true, produto: data.produto || data });
  } catch (error) {
    return res.status(500).json({
      error: 'Falha ao atualizar preço',
      details: error.message
    });
  }
});

app.post('/api/pedidos/confirmar', async (req, res) => {
  const id = Number(req.body?.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'Pedido inválido' });
  try {
    const response = await fetch(N8N_CONFIRMAR_PEDIDO_URL, {
      method: 'POST', headers: n8nHeaders({ 'Content-Type': 'application/json' }),
      signal: AbortSignal.timeout(15000), body: JSON.stringify({ id })
    });
    if (!response.ok) return res.status([400,404,409].includes(response.status) ? response.status : 502)
      .json({ error: 'Pedido não confirmado. Atualize os dados e confira o status e a disponibilidade.' });
    const data = await response.json();
    return res.json(data);
  } catch {
    return res.status(502).json({ error: 'Não foi possível confirmar o pedido. Atualize antes de tentar novamente.' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Dashboard rodando na porta ${PORT}`);
});
