#!/usr/bin/env node
// Logging reverse proxy for DataTables server-side apps.
//
//   node capture-proxy.mjs [target=http://localhost:3000] [listen=3001] [out=captured-requests.jsonl]
//
// Browse http://localhost:<listen> instead of the app. Every POST whose
// path ends in /dtajax is appended to <out> as one JSON line:
//   { id, t, url, table, request, response: { status, draw, recordsTotal,
//     recordsFiltered, nData, dataKeys, error }, elapsedMs }
// Everything else (pages, assets, Next.js HMR websocket) passes through
// untouched. No dependencies; nothing in the app changes.
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';

const [, , target = 'http://localhost:3000', listen = '3001', outFile = 'captured-requests.jsonl'] = process.argv;
const T = new URL(target);
const tPort = T.port || 80;
const out = fs.createWriteStream(outFile, { flags: 'a' });
let n = 0;

const read = (s) => new Promise((res, rej) => {
  const chunks = [];
  s.on('data', (d) => chunks.push(d));
  s.on('end', () => res(Buffer.concat(chunks)));
  s.on('error', rej);
});

const summarize = (status, raw) => {
  try {
    const j = JSON.parse(raw.toString('utf8'));
    const keys = Array.isArray(j.data) && j.data.length
      ? Object.keys(j.data[0]).filter((k) => /_ID$/.test(k))
      : [];
    return {
      status, draw: j.draw, recordsTotal: j.recordsTotal, recordsFiltered: j.recordsFiltered,
      nData: Array.isArray(j.data) ? j.data.length : null,
      dataKeys: keys.length ? j.data.slice(0, 100).map((r) => r[keys[0]]) : undefined,
      error: j.error ?? null
    };
  } catch {
    return { status, raw: raw.toString('utf8').slice(0, 300) };
  }
};

const server = http.createServer(async (req, res) => {
  const isDt = req.method === 'POST' && /\/dtajax(\?|$)/.test(req.url);
  const headers = { ...req.headers, host: T.host };
  if (isDt) headers['accept-encoding'] = 'identity';   // so the JSON below is readable
  const body = isDt ? await read(req) : null;
  const t0 = Date.now();

  const preq = http.request({ host: T.hostname, port: tPort, method: req.method, path: req.url, headers }, async (pres) => {
    if (!isDt) { res.writeHead(pres.statusCode, pres.headers); pres.pipe(res); return; }
    const rbody = await read(pres);
    res.writeHead(pres.statusCode, pres.headers);
    res.end(rbody);

    let request;
    try { request = JSON.parse(body.toString('utf8')); } catch { request = body.toString('utf8'); }
    const response = summarize(pres.statusCode, rbody);
    const rec = {
      id: ++n, t: new Date(t0).toISOString(), url: req.url,
      table: req.url.match(/\/([^/]+)\/dtajax/)?.[1] ?? null,
      request, response, elapsedMs: Date.now() - t0
    };
    out.write(JSON.stringify(rec) + '\n');
    const err = response.error ? '  ERROR: ' + String(response.error).replace(/\s+/g, ' ').slice(0, 90) : '';
    console.log(`#${n} ${rec.table} ${response.status} draw=${response.draw} filtered=${response.recordsFiltered} rows=${response.nData} ${rec.elapsedMs}ms${err}`);
  });
  preq.on('error', (e) => { res.writeHead(502); res.end('proxy: ' + e.message); });
  if (isDt) preq.end(body); else req.pipe(preq);
});

// WebSocket upgrades (Next.js HMR) pass straight through
server.on('upgrade', (req, socket, head) => {
  const up = net.connect(tPort, T.hostname, () => {
    const hdrs = Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n');
    up.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${hdrs}\r\n\r\n`);
    if (head.length) up.write(head);
    socket.pipe(up).pipe(socket);
  });
  up.on('error', () => socket.destroy());
  socket.on('error', () => up.destroy());
});

server.listen(+listen, () => {
  console.log(`proxying http://localhost:${listen} -> ${T.origin}; dtajax requests appended to ${outFile}`);
});
