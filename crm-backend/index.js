const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { evaluateSegment, parseSimpleRuleString } = require('./segmentEvaluator');
const { draftMessage, compileSegment, chatAgent, getApiKeys } = require('./aiHelper');

const AI_SETTINGS_PATH = path.join(__dirname, 'ai-settings.json');
let aiSettings = { model: 'gpt-4o-mini', temperature: 0.7, rateLimitPerMinute: 60 };
try{
  if(fs.existsSync(AI_SETTINGS_PATH)){
    const raw = fs.readFileSync(AI_SETTINGS_PATH,'utf8'); aiSettings = JSON.parse(raw);
  }
}catch(e){ console.warn('Failed to load ai-settings.json', e.message || e); }

function saveAiSettings(){ fs.writeFileSync(AI_SETTINGS_PATH, JSON.stringify(aiSettings, null, 2)); }

// Simple in-memory rate limiter per IP for AI endpoint
const aiRateMap = new Map(); // ip -> { count, windowStart }
function checkRateLimit(ip){
  const perMin = Number(process.env.OPENAI_RATE_LIMIT_PER_MINUTE || aiSettings.rateLimitPerMinute || 60);
  const windowMs = 60*1000;
  const now = Date.now();
  const entry = aiRateMap.get(ip) || { count:0, windowStart: now };
  if(now - entry.windowStart > windowMs){ entry.count = 0; entry.windowStart = now; }
  entry.count += 1;
  aiRateMap.set(ip, entry);
  return entry.count <= perMin;
}

function logOpenAI(entry){
  // redact sensitive fields before writing
  function redactItem(v){
    if(!v) return v;
    if(typeof v === 'string'){
      // redact API keys
      v = v.replace(/sk-[A-Za-z0-9_-]{8,}/g, '[REDACTED_API_KEY]');
      // redact emails
      v = v.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[REDACTED_EMAIL]');
      // redact phones
      v = v.replace(/\+?[0-9][0-9 \-()]{6,}[0-9]/g, '[REDACTED_PHONE]');
      // truncate long text
      if(v.length>200) v = v.slice(0,200) + '...[TRUNC]';
      return v;
    }
    return v;
  }
  function redact(obj){
    if(obj == null) return obj;
    if(typeof obj === 'string') return redactItem(obj);
    if(typeof obj !== 'object') return obj;
    if(Array.isArray(obj)) return obj.map(redact);
    const out = {};
    for(const k of Object.keys(obj)){
      if(k.toLowerCase().includes('key') || k.toLowerCase().includes('token') || k.toLowerCase().includes('authorization')){
        out[k] = '[REDACTED]';
        continue;
      }
      if(k.toLowerCase().includes('response') || k.toLowerCase().includes('raw')){
        // avoid storing full model output, keep length-limited summary
        try{ const s = JSON.stringify(obj[k]); out[k] = redactItem(s).slice(0,400); }catch(e){ out[k]='[UNSERIALIZABLE]'; }
        continue;
      }
      out[k] = redact(obj[k]);
    }
    return out;
  }
  const safe = redact(entry);
  const logLine = `[${new Date().toISOString()}] ${JSON.stringify(safe)}\n`;
  fs.appendFile(path.join(__dirname,'openai.log'), logLine, ()=>{});
}
 

const DB_PATH = path.join(__dirname, 'db.json');

let useMongo = false;
let mongoDb = null;

async function initDb(){
  if(process.env.USE_MONGO==='1'){
    try{
      const dbModule = require('./db');
      // db.js should export either `getDb()` returning a connected `db` or `connect()` returning a client
      if(dbModule.getDb) {
        mongoDb = await dbModule.getDb();
      } else if(dbModule.connect){
        const client = await dbModule.connect();
        mongoDb = client.db();
      }
      if(mongoDb) {
        useMongo = true;
        console.log('Using MongoDB backend');
        return;
      }
    }catch(e){
      console.log('MongoDB init failed, falling back to file DB:', e.message || e);
    }
  }
  console.log('Using file DB at', DB_PATH);
}

async function readDb(){
  if(useMongo){
    const customers = await mongoDb.collection('customers').find({}).toArray();
    const orders = await mongoDb.collection('orders').find({}).toArray();
    const campaigns = await mongoDb.collection('campaigns').find({}).toArray();
    const messages = await mongoDb.collection('messages').find({}).toArray();
    const segments = await mongoDb.collection('segments').find({}).toArray();
    return { customers, orders, campaigns, messages, segments };
  }
  return JSON.parse(fs.readFileSync(DB_PATH));
}

async function writeDb(db){
  if(useMongo){
    const mapping = { customers: db.customers||[], orders: db.orders||[], campaigns: db.campaigns||[], messages: db.messages||[], segments: db.segments||[] };
    await Promise.all(Object.entries(mapping).map(async ([name, arr])=>{
      const col = mongoDb.collection(name);
      await col.deleteMany({});
      if(arr.length) await col.insertMany(arr);
    }));
    return;
  }
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

const app = express();
app.use(cors());
app.use(bodyParser.json());

const CALLBACK_URL = process.env.CALLBACK_URL || 'http://localhost:3001/api/receipts';
const CHANNEL_STUB_URL = process.env.CHANNEL_STUB_URL || 'http://localhost:4001';

// Simulated campaign message delivery queue
const messageQueue = [];
let queueTimer = null;

async function processQueue() {
  if (messageQueue.length === 0) {
    queueTimer = null;
    return;
  }
  
  // Send a batch of up to 5 messages at a time (e.g. rate limit of 5 msgs/sec)
  const batch = messageQueue.splice(0, 5);
  const db = await readDb();
  
  batch.forEach(msg => {
    const dbMsg = (db.messages || []).find(m => m.id === msg.id);
    if (dbMsg) {
      dbMsg.status = 'sending';
      dbMsg.history = dbMsg.history || [];
      dbMsg.history.push({ event: { type: 'sending', detail: 'dispatched to queue' }, at: new Date().toISOString() });
    }
  });
  await writeDb(db);

  // Trigger dispatch to channel service
  batch.forEach(msg => {
    const payload = { 
      messageId: msg.id, 
      to: msg.recipient.phone || msg.recipient.email, 
      channel: msg.channel, 
      content: msg.content, 
      callback_url: CALLBACK_URL 
    };
    
    fetch(`${CHANNEL_STUB_URL}/send`, { 
      method: 'POST', 
      body: JSON.stringify(payload), 
      headers: { 'Content-Type': 'application/json' }
    }).catch(err => {
      console.error('Queue delivery failed for message:', msg.id, err.message);
      markFailed(msg.id, 'channel_stub_connection_error');
    });
  });

  queueTimer = setTimeout(processQueue, 1000);
}

async function markFailed(messageId, reason) {
  try {
    const db = await readDb();
    const msg = (db.messages || []).find(m => m.id === messageId);
    if (msg) {
      msg.status = 'failed';
      msg.history = msg.history || [];
      msg.history.push({ event: { type: 'failed', detail: reason }, at: new Date().toISOString() });
      await writeDb(db);
    }
  } catch (err) {
    console.error('Failed marking message as failed:', messageId, err);
  }
}

// endpoint to read recent OpenAI logs (admin)
app.get('/api/admin/openai/logs', (req,res)=>{
  const limit = Math.min(500, Number(req.query.limit||100));
  const p = path.join(__dirname,'openai.log');
  if(!fs.existsSync(p)) return res.json([]);
  const lines = fs.readFileSync(p,'utf8').trim().split('\n').filter(Boolean).slice(-limit);
  const parsed = lines.map(l=>{
    const m = l.match(/^\[(.*?)\]\s*(.*)$/);
    if(!m) return { raw: l };
    try{ return { at: m[1], entry: JSON.parse(m[2]) }; }catch(e){ return { at: m[1], raw: m[2] }; }
  });
  res.json(parsed.reverse());
});

// admin UI page to view logs
app.get('/admin/ai/logs', (req,res)=>{
  res.type('html').send(`
  <html><head><meta charset="utf-8"><title>AI Logs</title></head><body style="font-family:Arial,Helvetica,sans-serif;padding:20px">
    <h2>OpenAI Logs</h2>
    <div><button id="reload">Reload</button></div>
    <pre id="out" style="white-space:pre-wrap;background:#f5f5f5;padding:10px;border:1px solid #ddd;max-height:600px;overflow:auto"></pre>
    <script>
      async function load(){ const r=await fetch('/api/admin/openai/logs?limit=200'); const j=await r.json(); document.getElementById('out').innerText = JSON.stringify(j,null,2); }
      document.getElementById('reload').addEventListener('click', load);
      load();
    </script>
  </body></html>
  `);
});

function makeId(prefix){ return prefix + '_' + Date.now() + '_' + Math.floor(Math.random()*10000); }

app.get('/api/customers', async (req,res)=>{ const db = await readDb(); res.json(db.customers||[]); });
app.get('/api/orders', async (req,res)=>{ const db = await readDb(); res.json(db.orders||[]); });
app.get('/api/campaigns', async (req,res)=>{ const db = await readDb(); res.json(db.campaigns||[]); });
app.get('/api/messages', async (req,res)=>{ const db = await readDb(); res.json(db.messages||[]); });

app.post('/api/import/customers', async (req,res)=>{
  const {customers} = req.body;
  if(!Array.isArray(customers)) return res.status(400).json({error:'customers must be array'});
  const db = await readDb();
  db.customers = db.customers || [];
  customers.forEach(c=>{ if(!c.id) c.id = makeId('c'); db.customers.push(c); });
  await writeDb(db);
  res.json({imported: customers.length});
});

app.post('/api/import/orders', async (req,res)=>{
  const {orders} = req.body;
  if(!Array.isArray(orders)) return res.status(400).json({error:'orders must be array'});
  const db = await readDb();
  db.orders = db.orders || [];
  orders.forEach(o=>{ if(!o.id) o.id = makeId('o'); db.orders.push(o); });
  await writeDb(db);
  res.json({imported: orders.length});
});

// Simple analytics endpoint summarising campaign/message stats
app.get('/api/analytics', async (req,res)=>{
  const db = await readDb();
  const totalCustomers = (db.customers||[]).length;
  const totalOrders = (db.orders||[]).length;
  const campaigns = (db.campaigns||[]).map(camp=>{
    const msgs = (db.messages||[]).filter(m=>m.campaignId===camp.id);
    const stats = { sent: msgs.length, delivered: msgs.filter(m=>m.status==='delivered').length, failed: msgs.filter(m=>m.status==='failed').length, opened: msgs.filter(m=>m.history && m.history.some(h=>h.event && h.event.type==='opened')).length, clicked: msgs.filter(m=>m.history && m.history.some(h=>h.event && h.event.type==='clicked')).length };
    return { campaign: camp.name, id: camp.id, ...stats };
  });
  res.json({ totalCustomers, totalOrders, campaigns });
});

// Segments CRUD
app.get('/api/segments', async (req,res)=>{ const db = await readDb(); res.json(db.segments||[]); });
app.post('/api/segments', async (req,res)=>{ const { name, rule } = req.body; if(!name || !rule) return res.status(400).json({error:'missing'}); const db = await readDb(); const seg = { id: makeId('seg'), name, rule }; db.segments = db.segments||[]; db.segments.push(seg); await writeDb(db); res.json(seg); });
app.delete('/api/segments/:id', async (req,res)=>{ const id = req.params.id; const db = await readDb(); db.segments = (db.segments||[]).filter(s=>s.id!==id); await writeDb(db); res.json({ok:true}); });

// Retry sending a message (requeue -> queue processor)
app.post('/api/messages/:id/retry', async (req,res)=>{
  const id = req.params.id; const db = await readDb(); const msg = (db.messages||[]).find(m=>m.id===id); if(!msg) return res.status(404).json({error:'not found'});
  msg.status = 'queued'; msg.history = [];
  await writeDb(db);
  
  messageQueue.push(msg);
  if(!queueTimer){
    queueTimer = setTimeout(processQueue, 500);
  }
  res.json({ok:true});
});


// AI message suggest endpoint
app.post('/api/ai/suggest', async (req,res)=>{
  const { goal, sampleCustomer, tone, channel } = req.body;
  const clientIp = req.ip || req.headers['x-forwarded-for'] || 'local';
  if(!checkRateLimit(clientIp)) return res.status(429).json({ error: 'rate_limited' });
  
  const keys = getApiKeys();
  const hasKey = keys.geminiKey || keys.openaiKey;

  if (hasKey) {
    try {
      const suggestion = await draftMessage(goal, sampleCustomer, tone, channel, aiSettings);
      logOpenAI({ event: 'suggest', ip: clientIp, goal, tone, channel, suggestion });
      return res.json({ suggestion });
    } catch (err) {
      logOpenAI({ event: 'error', ip: clientIp, err: err.message });
      console.error('Suggest draft error', err);
    }
  }
  
  // fallback
  const name = sampleCustomer?.name || 'there';
  const suggestion = `Hi ${name}, ${goal || 'we have an exclusive offer for you — enjoy 20% off!'}`;
  res.json({ suggestion, note: 'fallback-no-configured-key' });
});

// AI segment compilation endpoint
app.post('/api/ai/compile-segment', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });
  try {
    const rule = await compileSegment(prompt, aiSettings);
    res.json({ rule });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Copilot chat agent endpoint
app.post('/api/ai/chat', async (req, res) => {
  const { message, history } = req.body;
  if (!message) return res.status(400).json({ error: 'Missing message' });
  const db = await readDb();
  
  const dbSummary = {
    customerCount: (db.customers || []).length,
    orderCount: (db.orders || []).length,
    campaignCount: (db.campaigns || []).length,
    segmentCount: (db.segments || []).length,
    recentCustomersSample: (db.customers || []).slice(0, 5).map(c => ({ id: c.id, name: c.name, ltv: c.lifetime_value, email: c.email })),
    savedSegments: (db.segments || []).map(s => ({ id: s.id, name: s.name, rule: s.rule })),
    campaigns: (db.campaigns || []).map(c => ({ id: id => c.id, name: c.name, audience: c.audience, channel: c.channel, message: c.message })),
    stats: {
      totalRevenue: (db.orders || []).reduce((sum, o) => sum + (o.amount || 0), 0)
    }
  };

  try {
    const response = await chatAgent(history, message, dbSummary, aiSettings);
    res.json(response);
  } catch (err) {
    console.error('Copilot chat error', err);
    res.status(500).json({ error: err.message });
  }
});

// Segment evaluation preview endpoint
app.post('/api/segments/evaluate-preview', async (req, res) => {
  const { rule } = req.body;
  const db = await readDb();
  const matched = evaluateSegment(db.customers || [], db.orders || [], rule);
  res.json({
    totalCount: (db.customers || []).length,
    matchCount: matched.length,
    customers: matched.slice(0, 100)
  });
});

// API keys availability status endpoint
app.get('/api/admin/api-keys', (req, res) => {
  const keys = getApiKeys();
  res.json({
    geminiKeySet: !!keys.geminiKey,
    openaiKeySet: !!keys.openaiKey,
    geminiKeyMasked: keys.geminiKey ? `${keys.geminiKey.slice(0, 4)}...${keys.geminiKey.slice(-4)}` : null,
    openaiKeyMasked: keys.openaiKey ? `${keys.openaiKey.slice(0, 4)}...${keys.openaiKey.slice(-4)}` : null
  });
});

// Admin endpoints to view/update AI settings
app.get('/api/admin/ai', (req,res)=>{ res.json(aiSettings); });
app.post('/api/admin/ai', (req,res)=>{
  const { model, temperature, rateLimitPerMinute } = req.body;
  if(model) aiSettings.model = String(model);
  if(typeof temperature !== 'undefined') aiSettings.temperature = Number(temperature);
  if(typeof rateLimitPerMinute !== 'undefined') aiSettings.rateLimitPerMinute = Number(rateLimitPerMinute);
  saveAiSettings();
  res.json(aiSettings);
});

// Minimal admin UI
app.get('/admin/ai', (req,res)=>{
  res.type('html').send(`
  <html><head><meta charset="utf-8"><title>AI Admin</title></head><body style="font-family:Arial,Helvetica,sans-serif;padding:20px">
  <h2>AI Settings</h2>
  <div id="status"></div>
  <form id="frm">
    <label>Model: <input name="model"/></label><br/><br/>
    <label>Temperature: <input name="temperature"/></label><br/><br/>
    <label>Rate Limit / min: <input name="rateLimitPerMinute"/></label><br/><br/>
    <button type="submit">Save</button>
  </form>
  <script>
    async function load(){ const r=await fetch('/api/admin/ai'); const j=await r.json(); document.frm.model.value=j.model; document.frm.temperature.value=j.temperature; document.frm.rateLimitPerMinute.value=j.rateLimitPerMinute; }
    document.frm.addEventListener('submit', async e=>{ e.preventDefault(); const body={ model:document.frm.model.value, temperature:parseFloat(document.frm.temperature.value), rateLimitPerMinute:parseInt(document.frm.rateLimitPerMinute.value,10)}; const r=await fetch('/api/admin/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); const j=await r.json(); document.getElementById('status').innerText='Saved'; setTimeout(()=>document.getElementById('status').innerText='',2000); });
    load();
  </script>
  </body></html>
  `);
});

app.post('/api/campaigns', async (req,res)=>{
  const {name, audience, message, channel} = req.body;
  if(!name || !audience || !message) return res.status(400).json({error:'missing fields'});
  const db = await readDb();
  db.campaigns = db.campaigns || [];
  const campaign = { id: makeId('camp'), name, audience, message, channel, created_at: new Date().toISOString() };
  db.campaigns.push(campaign);
  await writeDb(db);
  res.json(campaign);
});

app.post('/api/send', async (req,res)=>{
  const {campaignId} = req.body;
  const db = await readDb();
  const campaign = (db.campaigns||[]).find(c=>c.id===campaignId);
  if(!campaign) return res.status(404).json({error:'campaign not found'});
  
  // Resolve audience segment
  let recipients = [];
  let audienceRule = campaign.audience;
  
  if (typeof campaign.audience === 'string' && campaign.audience.startsWith('seg_')) {
    const segment = (db.segments || []).find(s => s.id === campaign.audience);
    if (segment) {
      audienceRule = segment.rule;
    }
  }

  try {
    recipients = evaluateSegment(db.customers || [], db.orders || [], audienceRule);
  } catch (err) {
    console.error('Failed evaluating segment for campaign send', err);
    return res.status(500).json({ error: 'Segment evaluation failed: ' + err.message });
  }

  // create messages and push to our rate-limited dispatch queue
  const createdMessages = [];
  db.messages = db.messages || [];

  for(const r of recipients){
    // render personalization tokens
    const rendered = campaign.message
      .replace(/{{\s*name\s*}}/g, r.name || 'there')
      .replace(/{{\s*lifetime_value\s*}}/g, r.lifetime_value || '0')
      .replace(/{{\s*email\s*}}/g, r.email || '');

    const msg = { 
      id: makeId('m'), 
      campaignId, 
      recipient: r, 
      channel: campaign.channel||'sms', 
      status: 'queued', 
      content: rendered, 
      history: [{ event: { type: 'created', detail: 'campaign launched' }, at: new Date().toISOString() }] 
    };
    
    db.messages.push(msg);
    createdMessages.push(msg);
  }
  
  await writeDb(db);

  // Add messages to processing queue and trigger processing if idle
  messageQueue.push(...createdMessages);
  if (!queueTimer) {
    queueTimer = setTimeout(processQueue, 100);
  }

  res.json({sent: createdMessages.length});
});

app.post('/api/receipts', async (req,res)=>{
  const { messageId, event } = req.body;
  if(!messageId || !event) return res.status(400).json({error:'invalid receipt'});
  const db = await readDb();
  db.messages = db.messages || [];
  const msg = db.messages.find(m=>m.id===messageId);
  if(!msg) return res.status(404).json({error:'message not found'});
  msg.history = msg.history || [];
  msg.history.push({ event, at: new Date().toISOString() });
  // map events to status
  if(event.type === 'delivered') msg.status = 'delivered';
  if(event.type === 'failed') msg.status = 'failed';
  if(event.type === 'opened') msg.status = 'opened';
  if(event.type === 'clicked') msg.status = 'clicked';
  // order attribution
  if(event.type === 'order'){
    // create an order attributed to this recipient and message
    db.orders = db.orders || [];
    const order = { id: makeId('o'), customer_id: msg.recipient.id, amount: event.amount || 0, created_at: new Date().toISOString(), attributed_message: msg.id };
    db.orders.push(order);
    msg.status = 'attributed';
  }
  await writeDb(db);
  res.json({ok:true});
});

// Admin DB Clear/Seed endpoint
app.post('/api/admin/clear-db', async (req, res) => {
  const defaultDb = {
    customers: [
      { id: "c1", name: "Alice Smith", email: "alice@example.com", phone: "+15550001", lifetime_value: 120 },
      { id: "c2", name: "Bob Jones", email: "bob@example.com", phone: "+15550002", lifetime_value: 45 },
      { id: "c3", name: "Charlie Miller", email: "charlie@example.com", phone: "+15550003", lifetime_value: 230 },
      { id: "c4", name: "Diana Prince", email: "diana@example.com", phone: "+15550004", lifetime_value: 15 },
      { id: "c5", name: "Ethan Hunt", email: "ethan@example.com", phone: "+15550005", lifetime_value: 450 }
    ],
    orders: [
      { id: "o1", customer_id: "c1", amount: 60, created_at: "2026-05-01" },
      { id: "o2", customer_id: "c1", amount: 60, created_at: "2026-06-01" },
      { id: "o3", customer_id: "c2", amount: 45, created_at: "2026-05-15" },
      { id: "o4", customer_id: "c3", amount: 130, created_at: "2026-05-20" },
      { id: "o5", customer_id: "c3", amount: 100, created_at: "2026-06-05" },
      { id: "o6", customer_id: "c5", amount: 250, created_at: "2026-04-10" },
      { id: "o7", customer_id: "c5", amount: 200, created_at: "2026-05-12" }
    ],
    campaigns: [],
    messages: [],
    segments: [
      { id: "seg_1", name: "VIP High LTV (>100)", rule: { type: "condition", field: "lifetime_value", operator: "gt", value: 100 } },
      { id: "seg_2", name: "Frequent Shoppers (>=2 orders)", rule: { type: "condition", field: "order_count", operator: "gte", value: 2 } }
    ]
  };
  await writeDb(defaultDb);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3001;

async function main(){
  await initDb();
  app.listen(PORT, ()=> console.log('CRM backend running on', PORT));
}

main().catch(err=>{ console.error('Failed to start', err); process.exit(1); });
