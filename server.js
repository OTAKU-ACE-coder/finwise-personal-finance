const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);
const ROOT = __dirname;
const PRIVATE_DIR = path.join(ROOT, '.finwise');
const USERS_FILE = path.join(PRIVATE_DIR, 'users.json');
const PORT = Number(process.env.PORT || 3000);
const PHONE_PREVIEW = process.argv.includes('--phone-preview');
const HOST = PHONE_PREVIEW ? '0.0.0.0' : '127.0.0.1';
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleRedirect = process.env.GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/api/google/callback`;
const googleEnabled = Boolean(googleClientId && googleClientSecret);
const sessions = new Map();
let pendingUserWrite = Promise.resolve();
const staticFiles = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8']
};

async function readUsers() {
  try { return JSON.parse(await fs.readFile(USERS_FILE, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}
async function writeUsers(users) {
  await fs.mkdir(PRIVATE_DIR, { recursive: true });
  const temporaryFile = `${USERS_FILE}.tmp`;
  await fs.writeFile(temporaryFile, JSON.stringify(users, null, 2), { mode: 0o600 });
  await fs.rename(temporaryFile, USERS_FILE);
}
function updateUsers(update) {
  const result = pendingUserWrite.then(async () => {
    const users = await readUsers();
    const user = update(users);
    if (user) await writeUsers(users);
    return user;
  });
  pendingUserWrite = result.catch(() => {});
  return result;
}
function sendJson(res, status, body, extraHeaders = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders });
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (Buffer.byteLength(body) > 2_000_000) { reject(Object.assign(new Error('Request is too large.'), { status: 413 })); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { reject(Object.assign(new Error('Send valid JSON.'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}
function sessionId(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/(?:^|;\s*)finwise_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}
function sessionCookie(id, maxAge = 8 * 60 * 60) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `finwise_session=${encodeURIComponent(id)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`;
}
function publicUser(user) { return { id: user.id, name: user.name, email: user.email }; }
async function passwordHash(password, salt) {
  return scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}
function validateFinance(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const json = JSON.stringify(value);
  return Buffer.byteLength(json) <= 1_500_000;
}

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/google/start' && googleEnabled) {
    const state = crypto.randomBytes(32).toString('base64url');
    const authorization = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authorization.search = new URLSearchParams({
      client_id: googleClientId, redirect_uri: googleRedirect, response_type: 'code', scope: 'openid email profile', state
    });
    res.writeHead(302, {
      Location: authorization.href,
      'Cache-Control': 'no-store',
      'Set-Cookie': googleStateCookie(state, 600)
    });
    return res.end();
  }
  if (req.method === 'GET' && url.pathname === '/api/google/callback' && googleEnabled) {
    res.setHeader('Set-Cookie', googleStateCookie('', 0));
    const state = url.searchParams.get('state');
    const code = url.searchParams.get('code');
    const expected = (req.headers.cookie || '').match(/(?:^|;\s*)finwise_google_state=([\w-]+)/)?.[1];
    if (!code || !expected || state !== expected) return redirectHome(res, 'error');

    try {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        body: new URLSearchParams({ code, client_id: googleClientId, client_secret: googleClientSecret, redirect_uri: googleRedirect, grant_type: 'authorization_code' }),
        signal: AbortSignal.timeout(10000)
      });
      if (!tokenResponse.ok) return redirectHome(res, 'error');
      const { access_token: token } = await tokenResponse.json();
      if (!token) return redirectHome(res, 'error');
      const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10000)
      });
      if (!profileResponse.ok) return redirectHome(res, 'error');
      const profile = await profileResponse.json();
      if (!profile.sub || !profile.email || profile.email_verified !== true) return redirectHome(res, 'error');
      const email = profile.email.toLowerCase();
      const user = await updateUsers(users => {
        const existing = users.find(account => account.googleSubject === profile.sub);
        if (existing) return existing;
        if (users.some(account => account.email === email)) return null;
        const name = (profile.name || email.split('@')[0]).slice(0, 80);
        const finance = { account: { name, email }, balance: 0, transactions: [], budgets: [], pots: [], bills: [] };
        const account = { id: crypto.randomUUID(), googleSubject: profile.sub, name, email, finance };
        users.push(account);
        return account;
      });
      if (!user) return redirectHome(res, 'existing');
      const id = crypto.randomBytes(32).toString('base64url');
      sessions.delete(sessionId(req));
      sessions.set(id, user.id);
      res.setHeader('Set-Cookie', [googleStateCookie('', 0), sessionCookie(id)]);
      return redirectHome(res, 'success');
    } catch {
      return redirectHome(res, 'error');
    }
  }
  if (req.method === 'POST' && url.pathname === '/api/signup') {
    const body = await readBody(req);
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (name.length < 2 || name.length > 80) return sendJson(res, 400, { error: 'Enter a name between 2 and 80 characters.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return sendJson(res, 400, { error: 'Enter a valid email address.' });
    if (password.length < 8 || password.length > 128) return sendJson(res, 400, { error: 'Use a password between 8 and 128 characters.' });
    if (!validateFinance(body.finance)) return sendJson(res, 400, { error: 'The account data is missing or too large.' });
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = (await passwordHash(password, salt)).toString('hex');
    const finance = structuredClone(body.finance);
    finance.account = { ...(finance.account || {}), name, email };
    const user = { id: crypto.randomUUID(), name, email, salt, hash, finance };
    const created = await updateUsers(users => {
      if (users.some(existing => existing.email === email)) return null;
      users.push(user);
      return user;
    });
    if (!created) return sendJson(res, 409, { error: 'An account with this email already exists. Try signing in.' });
    const id = crypto.randomBytes(32).toString('base64url');
    sessions.set(id, user.id);
    return sendJson(res, 201, { user: publicUser(user), finance }, { 'Set-Cookie': sessionCookie(id) });
  }

  if (req.method === 'POST' && url.pathname === '/api/login') {
    const body = await readBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const users = await readUsers();
    const user = users.find(item => item.email === email);
    if (!user?.hash) return sendJson(res, 401, { error: 'Email or password is incorrect.' });
    const attempt = await passwordHash(password, user.salt);
    const expected = Buffer.from(user.hash, 'hex');
    if (attempt.length !== expected.length || !crypto.timingSafeEqual(attempt, expected)) return sendJson(res, 401, { error: 'Email or password is incorrect.' });
    const id = crypto.randomBytes(32).toString('base64url');
    sessions.set(id, user.id);
    return sendJson(res, 200, { user: publicUser(user), finance: user.finance }, { 'Set-Cookie': sessionCookie(id) });
  }

  const id = sessionId(req);
  const userId = sessions.get(id);
  if (req.method === 'POST' && url.pathname === '/api/logout') {
    sessions.delete(id);
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0) });
  }
  if (req.method === 'GET' && url.pathname === '/api/session') {
    if (!userId) return sendJson(res, 200, { user: null, googleEnabled });
    const user = (await readUsers()).find(item => item.id === userId);
    if (!user) return sendJson(res, 200, { user: null });
    return sendJson(res, 200, { user: publicUser(user), finance: user.finance, googleEnabled });
  }
  if (!userId) return sendJson(res, 401, { error: 'Sign in to access this account.' });
  if (req.method === 'PUT' && url.pathname === '/api/data') {
    const body = await readBody(req);
    if (!validateFinance(body.finance)) return sendJson(res, 400, { error: 'The account data is missing or too large.' });
    const user = await updateUsers(users => {
      const account = users.find(item => item.id === userId);
      if (!account) return null;
      account.finance = structuredClone(body.finance);
      account.finance.account = { ...(account.finance.account || {}), name: account.name, email: account.email };
      return account;
    });
    if (!user) return sendJson(res, 401, { error: 'Sign in again to continue.' });
    return sendJson(res, 200, { ok: true });
  }
  return sendJson(res, 404, { error: 'API route not found.' });
}

function googleStateCookie(value, maxAge) {
  const secure = new URL(googleRedirect).protocol === 'https:' ? '; Secure' : '';
  return `finwise_google_state=${value}; HttpOnly; SameSite=Lax; Path=/api/google; Max-Age=${maxAge}${secure}`;
}
function redirectHome(res, result) {
  res.writeHead(303, { Location: `/?google=${result}`, 'Cache-Control': 'no-store' });
  res.end();
}

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self'; img-src 'self' data:; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      if (PHONE_PREVIEW && req.method === 'GET' && url.pathname === '/api/session') return sendJson(res, 200, { user: null });
      if (PHONE_PREVIEW) return sendJson(res, 403, { error: 'Sign-in is disabled in phone preview mode.' });
      return await handleApi(req, res, url);
    }
    if (req.method !== 'GET' || !staticFiles[url.pathname]) return sendJson(res, 404, { error: 'Page not found.' });
    const [file, type] = staticFiles[url.pathname];
    const content = await fs.readFile(path.join(ROOT, file));
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    res.end(content);
  } catch (error) {
    if (!res.headersSent) sendJson(res, error.status || 500, { error: error.status ? error.message : 'Something went wrong on the server.' });
    else res.destroy();
  }
});

server.listen(PORT, HOST, () => {
  console.log(`FinWise is listening on ${HOST}:${PORT}`);
  if (PHONE_PREVIEW) console.log(`On the same Wi-Fi, open http://<this-computer-ip>:${PORT} on your phone. Sign-in is disabled; only sample data is available.`);
  else console.log('Open http://localhost:3000 in your browser. Account data is stored locally in .finwise.');
});
