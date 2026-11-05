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
const sessions = new Map();
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
  if (req.method === 'POST' && url.pathname === '/api/signup') {
    const body = await readBody(req);
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (name.length < 2 || name.length > 80) return sendJson(res, 400, { error: 'Enter a name between 2 and 80 characters.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return sendJson(res, 400, { error: 'Enter a valid email address.' });
    if (password.length < 8 || password.length > 128) return sendJson(res, 400, { error: 'Use a password between 8 and 128 characters.' });
    if (!validateFinance(body.finance)) return sendJson(res, 400, { error: 'The account data is missing or too large.' });
    const users = await readUsers();
    if (users.some(user => user.email === email)) return sendJson(res, 409, { error: 'An account with this email already exists. Try signing in.' });
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = (await passwordHash(password, salt)).toString('hex');
    const finance = structuredClone(body.finance);
    finance.account = { ...(finance.account || {}), name, email };
    const user = { id: crypto.randomUUID(), name, email, salt, hash, finance };
    users.push(user);
    await writeUsers(users);
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
    if (!user) return sendJson(res, 401, { error: 'Email or password is incorrect.' });
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
    if (!userId) return sendJson(res, 200, { user: null });
    const user = (await readUsers()).find(item => item.id === userId);
    if (!user) return sendJson(res, 200, { user: null });
    return sendJson(res, 200, { user: publicUser(user), finance: user.finance });
  }
  if (!userId) return sendJson(res, 401, { error: 'Sign in to access this account.' });
  if (req.method === 'PUT' && url.pathname === '/api/data') {
    const body = await readBody(req);
    if (!validateFinance(body.finance)) return sendJson(res, 400, { error: 'The account data is missing or too large.' });
    const users = await readUsers();
    const user = users.find(item => item.id === userId);
    if (!user) return sendJson(res, 401, { error: 'Sign in again to continue.' });
    user.finance = structuredClone(body.finance);
    user.finance.account = { ...(user.finance.account || {}), name: user.name, email: user.email };
    await writeUsers(users);
    return sendJson(res, 200, { ok: true });
  }
  return sendJson(res, 404, { error: 'API route not found.' });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self'; img-src 'self' data:; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
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

server.listen(PORT, '127.0.0.1', () => {
  console.log(`FinWise is running at http://127.0.0.1:${PORT}`);
  console.log('Account data is stored locally in the private .finwise folder.');
});
