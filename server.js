require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const sharp = require('sharp');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const STORAGE_DIR = path.resolve(process.env.STORAGE_DIR || path.join(ROOT, 'storage'));
const DATA_FILE = path.join(STORAGE_DIR, 'articles.json');
const LIVE_FILE = path.join(STORAGE_DIR, 'live.json');
const SEED_LIVE_FILE = path.join(ROOT, 'data', 'live.json');
const MEDIA_DIR = path.join(STORAGE_DIR, 'media');
const SEED_DATA_FILE = path.join(ROOT, 'data', 'articles.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const COOKIE_SECRET = process.env.COOKIE_SECRET || '';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const META_HOST = 'https://graph.instagram.com'; // Instagram Login, não Facebook Login.
const META_VERSION = process.env.INSTAGRAM_GRAPH_VERSION || 'v25.0';

if (IS_PRODUCTION && (ADMIN_PASSWORD.length < 12 || COOKIE_SECRET.length < 32)) {
  throw new Error('Em produção, configure ADMIN_PASSWORD (12+) e COOKIE_SECRET (32+) no ambiente.');
}
if (!ADMIN_PASSWORD || !COOKIE_SECRET) {
  console.warn('[Sirene Zero] Defina ADMIN_PASSWORD e COOKIE_SECRET no .env para usar o Estúdio.');
}
app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : false);
app.use(helmet({ contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'"],
    scriptSrc: ["'self'"],
    imgSrc: ["'self'", 'data:'],
    connectSrc: ["'self'", 'https:'],
    frameSrc: ["'self'", 'https://www.youtube.com', 'https://www.youtube-nocookie.com'],
    mediaSrc: ["'self'", 'https:', 'blob:'],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    frameAncestors: ["'none'"],
    upgradeInsecureRequests: IS_PRODUCTION ? [] : null
  }
}, referrerPolicy: { policy: 'strict-origin-when-cross-origin' } }));
app.use(express.json({ limit: '750kb' }));
app.use(cookieParser());
app.use('/assets', express.static(path.join(ROOT, 'public/assets'), { maxAge: '1d' }));
app.use('/media', express.static(MEDIA_DIR, { maxAge: '1h' }));

function hash(value) { return crypto.createHmac('sha256', COOKIE_SECRET).update(value).digest('hex'); }
function constantEqual(a, b) {
  const x = Buffer.from(hash(String(a))); const y = Buffer.from(hash(String(b)));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function sessionToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 12 * 3600_000, nonce: crypto.randomBytes(12).toString('hex') })).toString('base64url');
  return payload + '.' + hash(payload);
}
function sessionValid(value) {
  if (!value || !COOKIE_SECRET) return false;
  const [payload, signature, extra] = String(value).split('.');
  if (!payload || !signature || extra || !constantEqual(signature, hash(payload))) return false;
  try { return Number(JSON.parse(Buffer.from(payload, 'base64url').toString()).exp) > Date.now(); }
  catch { return false; }
}
function requireAdmin(req, res, next) {
  if (!sessionValid(req.cookies.sz_session)) return res.status(401).json({ error: 'Acesso restrito. Entre no Estúdio.' });
  next();
}
function checkOrigin(req, res, next) {
  const origin = req.get('origin');
  if (origin) {
    try { if (new URL(origin).host !== req.get('host')) return res.status(403).json({ error: 'Origem não permitida.' }); }
    catch { return res.status(403).json({ error: 'Origem inválida.' }); }
  }
  next();
}
app.use('/api', (req, res, next) => req.method === 'GET' ? next() : checkOrigin(req, res, next));
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false });
const publishLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 12, standardHeaders: 'draft-7', legacyHeaders: false });

async function prepareStorage() {
  await fs.mkdir(MEDIA_DIR, { recursive: true });
  // On first launch, copy the demo dataset to the persistent storage volume.
  // Never replace stored articles during updates or restarts.
  try { await fs.copyFile(SEED_DATA_FILE, DATA_FILE, require('node:fs').constants.COPYFILE_EXCL); }
  catch (e) { if (e.code !== 'EEXIST') throw e; }
  try { await fs.copyFile(SEED_LIVE_FILE, LIVE_FILE, require('node:fs').constants.COPYFILE_EXCL); }
  catch (e) { if (e.code !== 'EEXIST') throw e; }
}
async function loadLive() { return JSON.parse(await fs.readFile(LIVE_FILE, 'utf8')); }
async function saveLive(value) {
  const tmp = LIVE_FILE + '.' + crypto.randomBytes(6).toString('hex') + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8');
  await fs.rename(tmp, LIVE_FILE);
}
async function loadArticles() { return JSON.parse(await fs.readFile(DATA_FILE, 'utf8')); }
async function saveArticles(articles) {
  const tmp = DATA_FILE + '.' + crypto.randomBytes(6).toString('hex') + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(articles, null, 2) + '\n', 'utf8');
  await fs.rename(tmp, DATA_FILE);
}
function cleanedArticle(body, original) {
  const title = String(body.title || '').trim().slice(0, 160);
  const summary = String(body.summary || '').trim().slice(0, 350);
  const story = String(body.body || '').trim().slice(0, 20000);
  const sources = String(body.sources || '').trim().slice(0, 2000);
  const category = String(body.category || 'ANÁLISE').trim().toUpperCase().slice(0, 26);
  if (title.length < 10 || summary.length < 20 || story.length < 50) throw new Error('Informe título, resumo e texto com conteúdo suficiente.');
  if (body.status === 'published' && sources.length < 10) throw new Error('Para publicar, registre as fontes e a verificação editorial.');
  return {
    id: original?.id || crypto.randomUUID(), title, summary, category,
    eyebrow: String(body.eyebrow || 'RADAR GEOPOLÍTICO').trim().toUpperCase().slice(0, 28),
    region: String(body.region || 'Global').trim().slice(0, 60),
    body: story, sources,
    tags: String(body.tags || '').trim().slice(0, 250),
    highlight: Boolean(body.highlight),
    status: body.status === 'published' ? 'published' : 'draft',
    demo: original?.demo === true ? true : false,
    createdAt: original?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}
function safeError(error) { return error instanceof Error ? error.message : 'Erro inesperado'; }

app.get('/api/articles', async (_req, res) => {
  try { res.json((await loadArticles()).filter(a => a.status === 'published').sort((a,b) => b.createdAt.localeCompare(a.createdAt))); }
  catch { res.status(500).json({ error: 'Erro ao carregar as matérias.' }); }
});
app.get('/api/config', (_req, res) => res.json({ instagramConfigured: Boolean(process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_USER_ID), demoContent: true }));
app.post('/api/auth/login', loginLimiter, (req, res) => {
  if (!ADMIN_PASSWORD || !COOKIE_SECRET || !constantEqual(req.body?.password || '', ADMIN_PASSWORD)) return res.status(401).json({ error: 'Senha inválida ou não configurada.' });
  res.cookie('sz_session', sessionToken(), { httpOnly: true, sameSite: 'strict', secure: IS_PRODUCTION, path: '/', maxAge: 12 * 3600_000 });
  res.json({ ok: true });
});
app.post('/api/auth/logout', requireAdmin, (_req, res) => {
  res.clearCookie('sz_session', { httpOnly: true, sameSite: 'strict', secure: IS_PRODUCTION, path: '/' });
  res.json({ ok: true });
});
app.get('/api/auth/me', (req, res) => res.json({ loggedIn: sessionValid(req.cookies.sz_session) }));
app.get('/api/admin/articles', requireAdmin, async (_req, res) => {
  try { res.json((await loadArticles()).sort((a,b) => b.createdAt.localeCompare(a.createdAt))); }
  catch { res.status(500).json({ error: 'Erro ao carregar a fila.' }); }
});
app.post('/api/admin/articles', requireAdmin, async (req, res) => {
  try { const item = cleanedArticle(req.body); const list = await loadArticles(); list.unshift(item); await saveArticles(list); res.status(201).json(item); }
  catch (e) { res.status(400).json({ error: safeError(e) }); }
});
app.put('/api/admin/articles/:id', requireAdmin, async (req, res) => {
  try {
    const list = await loadArticles(); const i = list.findIndex(a => a.id === req.params.id);
    if (i < 0) return res.status(404).json({ error: 'Matéria não encontrada.' });
    const item = cleanedArticle(req.body, list[i]); list[i] = item; await saveArticles(list); res.json(item);
  } catch (e) { res.status(400).json({ error: safeError(e) }); }
});
app.delete('/api/admin/articles/:id', requireAdmin, async (req, res) => {
  const list = await loadArticles(); const next = list.filter(a => a.id !== req.params.id);
  if (next.length === list.length) return res.status(404).json({ error: 'Matéria não encontrada.' });
  await saveArticles(next); res.json({ ok: true });
});

function escapeXml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'); }
function wrapTitle(input, max = 22, lines = 6) {
  const words = String(input).trim().split(/\s+/);
  const out = []; let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > max && current) { out.push(current); current = word; }
    else current = (current + ' ' + word).trim();
  }
  if (current) out.push(current);
  if (out.length > lines) return [...out.slice(0, lines - 1), out.slice(lines - 1).join(' ').slice(0, max - 1) + '…'];
  return out;
}
function graphicSVG(title, category, label) {
  const lines = wrapTitle(title, 21, 6);
  const font = lines.length >= 6 ? 74 : lines.length >= 5 ? 84 : 96;
  const total = lines.length * (font + 12);
  const start = Math.max(510, 830 - total / 2);
  const text = lines.map((line, i) => `<text x="82" y="${start + i * (font + 12)}" class="headline">${escapeXml(line)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#151d25"/><stop offset=".65" stop-color="#0a1117"/><stop offset="1" stop-color="#240e12"/></linearGradient><pattern id="grid" width="75" height="75" patternUnits="userSpaceOnUse"><path d="M75 0H0V75" fill="none" stroke="#81909b" stroke-opacity=".11"/></pattern></defs>
  <style>.brand{font-family:'DejaVu Sans',sans-serif;font-size:60px;font-weight:900;fill:white;letter-spacing:-2px}.eyebrow{font-family:'DejaVu Sans',sans-serif;font-size:25px;font-weight:700;fill:#f26a6b;letter-spacing:4px}.headline{font-family:'DejaVu Sans',sans-serif;font-size:${font}px;font-weight:900;fill:#f6f3ea;letter-spacing:-3px}.small{font-family:'DejaVu Sans',sans-serif;font-size:25px;fill:#bac0c6;letter-spacing:2px}</style>
  <rect width="1080" height="1350" fill="url(#bg)"/><rect width="1080" height="1350" fill="url(#grid)"/>
  <circle cx="935" cy="440" r="355" fill="none" stroke="#a9b6be" stroke-opacity=".15" stroke-width="2"/><circle cx="935" cy="440" r="290" fill="none" stroke="#e94448" stroke-opacity=".16" stroke-width="2"/><circle cx="935" cy="440" r="200" fill="none" stroke="#aab6bb" stroke-opacity=".12" stroke-width="2"/><path d="M580 440h500M935 80v730" stroke="#aab6bb" stroke-opacity=".13" stroke-width="2"/>
  <rect x="0" y="0" width="1080" height="17" fill="#e43c3e"/><rect x="76" y="75" width="20" height="60" fill="#e43c3e"/><text x="113" y="126" class="brand">SIRENE ZERO</text><text x="82" y="225" class="eyebrow">${escapeXml(category.toUpperCase())} // ${escapeXml(label.toUpperCase())}</text>
  <path d="M82 310h916" stroke="#b8c5cd" stroke-opacity=".3"/>
  <rect x="63" y="440" width="15" height="620" fill="#e43c3e"/>${text}
  <path d="M82 1154h916" stroke="#b8c5cd" stroke-opacity=".3"/>
  <text x="82" y="1218" class="small">O MUNDO NÃO ESPERA. NÓS TAMBÉM NÃO.</text><text x="82" y="1275" class="eyebrow">SIRENEZERO.COM // GEOPOLÍTICA</text>
  <rect x="0" y="1333" width="1080" height="17" fill="#e43c3e"/>
  </svg>`;
}

app.post('/api/admin/graphic', requireAdmin, async (req, res) => {
  try {
    const title = String(req.body?.title || '').trim(); const category = String(req.body?.category || 'GEOPOLÍTICA').trim();
    if (title.length < 10 || title.length > 160) return res.status(400).json({ error: 'O título deve ter entre 10 e 160 caracteres.' });
    await fs.mkdir(MEDIA_DIR, { recursive: true });
    const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.jpg`;
    await sharp(Buffer.from(graphicSVG(title, category, String(req.body?.eyebrow || 'ALERTA GLOBAL').slice(0, 25)))).jpeg({ quality: 92, mozjpeg: true }).toFile(path.join(MEDIA_DIR, name));
    res.json({ imagePath: '/media/' + name, dimensions: '1080 × 1350', format: 'JPEG' });
  } catch (e) { console.error('graphic failed', e); res.status(500).json({ error: 'Não foi possível gerar a arte.' }); }
});

async function graphRequest(endpoint, params, method = 'POST') {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const base = `${META_HOST}/${META_VERSION}/${endpoint}`;
  const options = { method, headers: { Authorization: `Bearer ${token}` } };
  let url = base;
  if (method === 'POST') { options.body = new URLSearchParams(params); }
  else { url += '?' + new URLSearchParams(params).toString(); }
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(18000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error(data.error?.error_user_msg || data.error?.message || `Erro da Meta (${response.status})`);
  return data;
}
app.post('/api/admin/instagram/publish', requireAdmin, publishLimiter, async (req, res) => {
  const { imagePath, caption, confirmed } = req.body || {};
  if (confirmed !== true) return res.status(400).json({ error: 'Confirme a revisão editorial antes de publicar.' });
  if (!process.env.INSTAGRAM_USER_ID || !process.env.INSTAGRAM_ACCESS_TOKEN) return res.status(409).json({ error: 'Configure INSTAGRAM_USER_ID e INSTAGRAM_ACCESS_TOKEN no servidor.' });
  const publicUrl = String(process.env.PUBLIC_URL || '').replace(/\/$/, '');
  if (!/^https:\/\/[^/]+/.test(publicUrl)) return res.status(409).json({ error: 'Configure PUBLIC_URL com um domínio HTTPS acessível pela Meta.' });
  if (!/^\/media\/[0-9]+-[a-f0-9]{12}\.jpg$/.test(String(imagePath))) return res.status(400).json({ error: 'Gere uma arte JPEG pelo Estúdio antes de publicar.' });
  if (String(caption || '').trim().length < 15 || String(caption).length > 2200) return res.status(400).json({ error: 'A legenda deve ter de 15 a 2200 caracteres.' });
  try {
    await fs.access(path.join(MEDIA_DIR, path.basename(imagePath)));
    const ig = encodeURIComponent(process.env.INSTAGRAM_USER_ID);
    const container = await graphRequest(`${ig}/media`, { image_url: publicUrl + imagePath, caption: String(caption) });
    if (!container.id) throw new Error('A Meta não retornou um identificador da mídia.');
    let status = 'IN_PROGRESS';
    for (let i = 0; i < 9; i++) {
      await new Promise(r => setTimeout(r, 1500));
      const result = await graphRequest(encodeURIComponent(container.id), { fields: 'status_code' }, 'GET');
      status = result.status_code || status;
      if (status === 'FINISHED') break;
      if (['ERROR', 'EXPIRED'].includes(status)) throw new Error(`A Meta não processou a imagem (${status}).`);
    }
    if (status !== 'FINISHED') return res.status(202).json({ pending: true, containerId: container.id, message: 'A Meta ainda está processando a arte. Não houve publicação. Tente novamente depois.' });
    const published = await graphRequest(`${ig}/media_publish`, { creation_id: container.id });
    res.json({ ok: true, mediaId: published.id, message: 'Publicação confirmada pela Meta.' });
  } catch (e) { console.error('instagram publish:', safeError(e)); res.status(502).json({ error: safeError(e) }); }
});


app.post('/api/admin/instagram/finish', requireAdmin, publishLimiter, async (req, res) => {
  const { containerId, confirmed } = req.body || {};
  if (confirmed !== true || !/^\d{8,30}$/.test(String(containerId || ''))) return res.status(400).json({ error: 'Identificador inválido ou revisão não confirmada.' });
  if (!process.env.INSTAGRAM_USER_ID || !process.env.INSTAGRAM_ACCESS_TOKEN) return res.status(409).json({ error: 'Instagram não configurado.' });
  try {
    const statusResult = await graphRequest(encodeURIComponent(containerId), { fields: 'status_code' }, 'GET');
    const status = statusResult.status_code;
    if (status === 'ERROR' || status === 'EXPIRED') return res.status(409).json({ error: `A Meta rejeitou a mídia (${status}).` });
    if (status !== 'FINISHED') return res.status(202).json({ pending: true, containerId, message: 'A mídia ainda está sendo processada pela Meta. Nenhum post foi publicado.' });
    const ig = encodeURIComponent(process.env.INSTAGRAM_USER_ID);
    const published = await graphRequest(`${ig}/media_publish`, { creation_id: containerId });
    res.json({ ok: true, mediaId: published.id, message: 'Publicação confirmada pela Meta.' });
  } catch (e) { console.error('instagram finish:', safeError(e)); res.status(502).json({ error: safeError(e) }); }
});


// VIDEO / RÁDIO / REDES SOCIAIS: uma única configuração editorial persistente.
function safeHttps(value, allowEmpty = true) {
  const text = String(value || '').trim().slice(0, 800);
  if (!text && allowEmpty) return '';
  let u;
  try { u = new URL(text); } catch { throw new Error('Use uma URL HTTPS válida.'); }
  if (u.protocol !== 'https:' || !u.hostname || u.username || u.password) throw new Error('Use uma URL HTTPS válida e sem credenciais.');
  return u.toString();
}
function youtubeId(input) {
  if (!input) return '';
  const url = new URL(safeHttps(input));
  const host = url.hostname.toLowerCase();
  let id = '';
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
  else if (['youtube.com','www.youtube.com','m.youtube.com','www.youtube-nocookie.com'].includes(host)) {
    if (url.pathname === '/watch') id = url.searchParams.get('v') || '';
    else if (/^\/(embed|live|shorts)\//.test(url.pathname)) id = url.pathname.split('/')[2] || '';
  }
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) throw new Error('Insira o link de um vídeo/transmissão do YouTube (não apenas do canal).');
  return id;
}
function cleanedLiveConfig(body, original) {
  const b = body.broadcast || {};
  const r = body.radio || {};
  const social = body.social || {};
  const videoUrl = safeHttps(b.youtubeUrl);
  if (videoUrl) youtubeId(videoUrl);
  const status = ['standby','live','replay'].includes(b.status) ? b.status : 'standby';
  if (status !== 'standby' && !videoUrl) throw new Error('Adicione o vídeo do YouTube antes de ativar a transmissão.');
  const streamUrl = safeHttps(r.streamUrl);
  const apiUrl = safeHttps(r.nowPlayingApiUrl);
  const rawSchedule = String(r.schedule || '').trim();
  const schedule = rawSchedule ? rawSchedule.split(/\r?\n/).filter(Boolean).map(line => {
    const match = line.match(/^\s*([01]\d|2[0-3]):([0-5]\d)\s*\|\s*(.{3,100})\s*$/);
    if (!match) throw new Error('Grade inválida. Use HH:MM | Nome da atração em cada linha.');
    return {time:match[1]+':'+match[2],title:match[3].trim()};
  }).sort((a,b)=>a.time.localeCompare(b.time)) : [];
  if (schedule.length > 35) throw new Error('A grade aceita até 35 atrações diárias.');
  if (r.enabled && !streamUrl) throw new Error('Informe o link HTTPS do stream da rádio antes de ativar.');
  return {
    broadcast: {
      title: String(b.title || '').trim().slice(0,160),
      summary: String(b.summary || '').trim().slice(0,360),
      sourceName: String(b.sourceName || '').trim().slice(0,100),
      sourceUrl: safeHttps(b.sourceUrl), youtubeUrl: videoUrl, status,
      updatedAt: new Date().toISOString()
    },
    updates: original.updates,
    radio: {
      name: String(r.name || 'RÁDIO ZERO').trim().slice(0,70),
      tagline: String(r.tagline || '').trim().slice(0,90),
      enabled: Boolean(r.enabled), streamUrl, nowPlayingApiUrl: apiUrl,
      currentShow: String(r.currentShow || '').trim().slice(0,100),
      nowPlaying: String(r.nowPlaying || '').trim().slice(0,160),
      nextShow: String(r.nextShow || '').trim().slice(0,100),
      nextShowTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(r.nextShowTime) ? r.nextShowTime : '--:--', schedule
    },
    social: Object.fromEntries(['instagram','youtube','x','facebook','whatsapp'].map(k => [k, safeHttps(social[k])]))
  };
}
app.get('/api/live', async (_req,res) => {
  try { res.json(await loadLive()); }
  catch { res.status(500).json({error:'Erro ao carregar o sinal.'}); }
});
app.put('/api/admin/live', requireAdmin, async (req,res) => {
  try {
    const old = await loadLive();
    const config = cleanedLiveConfig(req.body,old);
    if (config.broadcast.title.length < 10 || config.broadcast.summary.length < 20)
      return res.status(400).json({error:'Informe título e linha fina da cobertura.'});
    await saveLive(config); res.json(config);
  } catch(e) { res.status(400).json({error:safeError(e)}); }
});
app.post('/api/admin/live/updates', requireAdmin, async (req,res) => {
  try {
    const headline = String(req.body?.headline || '').trim().slice(0,160);
    const body = String(req.body?.body || '').trim().slice(0,2500);
    const source = String(req.body?.source || '').trim().slice(0,500);
    if (headline.length < 5 || body.length < 20 || source.length < 8)
      return res.status(400).json({error:'Informe título, atualização e fonte verificável.'});
    const data = await loadLive();
    const update = {id:crypto.randomUUID(),headline,body,source,createdAt:new Date().toISOString(),demo:false};
    data.updates.unshift(update);
    data.updates = data.updates.slice(0,150);
    await saveLive(data); res.status(201).json(update);
  } catch(e) { res.status(400).json({error:safeError(e)}); }
});
app.delete('/api/admin/live/updates/:id', requireAdmin, async (req,res) => {
  try {
    const data = await loadLive();
    const size = data.updates.length;
    data.updates = data.updates.filter(u=>u.id !== req.params.id);
    if (size === data.updates.length) return res.status(404).json({error:'Atualização não encontrada.'});
    await saveLive(data); res.json({ok:true});
  } catch(e) { res.status(500).json({error:safeError(e)}); }
});

app.get('/ao-vivo', (_req, res) => res.sendFile(path.join(ROOT, 'public', 'index.html')));
app.get('/estudio', (_req, res) => res.sendFile(path.join(ROOT, 'public', 'estudio.html')));
app.get('/estudio/', (_req, res) => res.sendFile(path.join(ROOT, 'public', 'estudio.html')));
app.get('/', (_req, res) => res.sendFile(path.join(ROOT, 'public', 'index.html')));
app.use(express.static(path.join(ROOT, 'public')));
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: 'Erro interno do portal.' }); });

if (require.main === module) {
  prepareStorage()
    .then(() => app.listen(PORT, () => console.log(`SIRENE ZERO — http://localhost:${PORT}`)))
    .catch(error => { console.error('Falha ao iniciar armazenamento:', error); process.exitCode = 1; });
}
module.exports = { app, wrapTitle, escapeXml, cleanedArticle };
