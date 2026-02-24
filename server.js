const express = require('express');
const fetch   = require('node-fetch');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin',  '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers',
    'Content-Type, Authorization, product, version, Application, patientid, account-id, x-libre-region');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'GlucoSnap Proxy', version: '1.2.0' });
});

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
    if (req.method === 'POST' && req.body && Object.keys(req.body).length > 0)
      options.body = JSON.stringify(req.body);
    const libreRes = await f
