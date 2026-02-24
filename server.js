const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── CORS: επιτρέπουμε μόνο το GitHub Pages domain σου
// Άλλαξε το παρακάτω URL με το δικό σου GitHub Pages URL
const ALLOWED_ORIGINS = [
  'https://papakigrr.github.io',   // <-- άλλαξε αυτό
  'http://localhost:8080',              // για local testing
  'http://127.0.0.1:8080',
];

app.use(cors({
  origin: function(origin, callback) {
    // Επιτρέπουμε requests χωρίς origin (π.χ. Postman, mobile)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error('CORS: Origin not allowed — ' + origin));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'product', 'version',
                   'Application', 'patientid', 'account-id'],
}));

app.use(express.json({ limit: '1mb' }));

// ── Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'GlucoSnap LibreView Proxy', version: '1.0.0' });
});

// ── Proxy endpoint: POST /proxy/llu/*  και  GET /proxy/llu/*
// Το frontend στέλνει: POST /proxy/llu/auth/login
// Εμείς κάνουμε forward στο:  POST https://api-eu2.libreview.io/llu/auth/login
app.all('/proxy/*', async (req, res) => {
  // Εξάγουμε το region από header (default: eu2)
  const region  = req.headers['x-libre-region'] || 'eu2';
  const baseUrl = region ? `https://api-${region}.libreview.io` : 'https://api.libreview.io';

  // Το path μετά το /proxy/
  const path    = req.path.replace(/^\/proxy/, '');
  const url     = baseUrl + path;

  // Φτιάχνουμε τα headers για το LibreView API
  const headers = {
    'Content-Type':  'application/json',
    'product':       'llu.android',
    'version':       '4.9.0',
    'Application':   'llu.android',
  };

  // Περνάμε authorization αν υπάρχει
  if (req.headers['authorization']) {
    headers['Authorization'] = req.headers['authorization'];
  }
  if (req.headers['patientid']) {
    headers['patientid'] = req.headers['patientid'];
  }
  if (req.headers['account-id']) {
    headers['account-id'] = req.headers['account-id'];
  }

  try {
    const options = {
      method:  req.method,
      headers: headers,
    };

    // Προσθέτουμε body μόνο για POST
    if (req.method === 'POST' && req.body && Object.keys(req.body).length > 0) {
      options.body = JSON.stringify(req.body);
    }

    console.log(`[${new Date().toISOString()}] ${req.method} ${url}`);

    const libreRes  = await fetch(url, options);
    const data      = await libreRes.json();

    // Επιστρέφουμε το αποτέλεσμα στο frontend
    res.status(libreRes.status).json(data);

  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(502).json({ error: 'Proxy error', message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ GlucoSnap Proxy running on port ${PORT}`);
  console.log(`   Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
});
