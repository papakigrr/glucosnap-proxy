const express = require('express');
const fetch   = require('node-fetch');

const app  = express();
const PORT = process.env.PORT || 3000;

// CORS — επιτρέπουμε όλα
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin',  '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers',
    'Content-Type, Authorization, product, version, Application, patientid, account-id, x-libre-region, anthropic-version, x-api-key');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json({ limit: '10mb' })); // μεγαλύτερο limit για εικόνες

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'GlucoSnap Proxy', version: '1.2.0' });
});

// ── LibreView Proxy: /proxy/llu/* → api-XX.libreview.io/llu/*
app.all('/proxy/*', async (req, res) => {
  const region  = req.headers['x-libre-region'] || 'eu';
  const baseUrl = region ? `https://api-${region}.libreview.io` : 'https://api.libreview.io';
  const path    = req.path.replace(/^\/proxy/, '');
  const url     = baseUrl + path;

  const headers = {
    'Content-Type': 'application/json',
    'product':      'llu.android',
    'version':      '4.16.0',
    'Application':  'llu.android',
  };
  if (req.headers['authorization']) headers['Authorization'] = req.headers['authorization'];
  if (req.headers['patientid'])     headers['patientid']     = req.headers['patientid'];
  if (req.headers['account-id'])    headers['account-id']    = req.headers['account-id'];

  try {
    const options = { method: req.method, headers };
    if (req.method === 'POST' && req.body && Object.keys(req.body).length > 0) {
      options.body = JSON.stringify(req.body);
    }
    console.log(`[LibreView] ${req.method} ${url}`);
    const libreRes = await fetch(url, options);
    const data     = await libreRes.json();
    res.status(libreRes.status).json(data);
  } catch (err) {
    console.error('LibreView proxy error:', err.message);
    res.status(502).json({ error: 'Proxy error', message: err.message });
  }
});

// ── Anthropic Proxy: /anthropic/* → api.anthropic.com/*
// Το API key διαβάζεται από environment variable — ΔΕΝ μπαίνει στον κώδικα!
app.all('/anthropic/*', async (req, res) => {
  const path = req.path.replace(/^\/anthropic/, '');
  const url  = 'https://api.anthropic.com' + path;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured on server' });
  }

  const headers = {
    'Content-Type':      'application/json',
    'x-api-key':         apiKey,
    'anthropic-version': '2023-06-01',
  };

  try {
    const options = { method: req.method, headers };
    if (req.method === 'POST' && req.body && Object.keys(req.body).length > 0) {
      options.body = JSON.stringify(req.body);
    }
    console.log(`[Anthropic] ${req.method} ${url}`);
    const anthRes = await fetch(url, options);
    const data    = await anthRes.json();
    res.status(anthRes.status).json(data);
  } catch (err) {
    console.error('Anthropic proxy error:', err.message);
    res.status(502).json({ error: 'Anthropic proxy error', message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`GlucoSnap Proxy v1.2 running on port ${PORT}`);
});
