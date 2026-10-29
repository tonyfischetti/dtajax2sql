#!/usr/bin/env node
// Turn a captured corpus (JSONL from drive-ppd.mjs / capture-proxy.mjs) into
// test/fixtures/ppd/requests.json: every request verbatim, with each table's
// (identical) columns array stored once. The schema next to it comes from
// dump-schema.mjs.
//
//   node tools/build-fixture.mjs captured.jsonl [outFile=test/fixtures/ppd/requests.json] [note]
import fs from 'node:fs';
import path from 'node:path';

const [, , inFile, outFile = 'test/fixtures/ppd/requests.json', note = ''] = process.argv;
const PK = { main: 'Object_ID', constituents: 'Constituent_ID', exhibitions: 'Exhibition_ID' };

// ppd's handler turns two SQLite errors into friendly text; classify both forms
const errKind = (m) => !m ? null
  : /fts5: syntax error|syntax error in your enhanced search|unknown special query|unterminated string/.test(m) ? 'fts-syntax'
  : /no such column|not included in the enhanced search modes/.test(m) ? 'no-such-column'
  : 'other';

const records = fs.readFileSync(inFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const tables = {};
const requests = [];
let nextId = 1;
for (const rec of records) {
  if (typeof rec.request !== 'object' || !Array.isArray(rec.request.columns)) { console.warn(`skipping #${rec.id}: request is not a DataTables object`); continue; }
  const t = tables[rec.table] ??= { primaryKey: PK[rec.table], columns: rec.request.columns };
  if (JSON.stringify(t.columns) !== JSON.stringify(rec.request.columns))
    throw new Error(`#${rec.id}: columns differ from the first ${rec.table} request; store them inline instead`);
  const { columns, ...rest } = rec.request;
  const kind = errKind(rec.response.error ?? (rec.response.status >= 400 ? `HTTP ${rec.response.status}` : null));
  // what the library must do with it now: the live 0.3.10 server's FTS5
  // syntax errors are inputs 0.4.x must turn into valid queries; an unknown
  // `col:` filter still has to fail at SQL time with "no such column"
  const expect = kind === null || kind === 'fts-syntax' ? 'ok'
    : kind === 'no-such-column' ? 'no-such-column'
    : (() => { throw new Error(`#${rec.id}: unexpected live error: ${rec.response.error}`); })();
  requests.push({
    id: nextId++, label: rec.label, table: rec.table, request: rest, expect,
    live: {
      status: rec.response.status,
      recordsFiltered: rec.response.recordsFiltered,
      error: rec.response.error ? String(rec.response.error).trim().split('\n')[0] : null
    }
  });
}

const fixture = {
  about: 'Server-side DataTables requests captured verbatim from the NYPL Prints & Photographs Discovery tool (ppd: Next.js, '
    + 'datatables.net 2.3.8 with SearchBuilder, FixedColumns, Buttons, Select) while its real UI was driven in headless Chrome. '
    + 'Each `request` is the JSON body the browser POSTed, minus the `columns` array, which is identical for every request on a '
    + 'table and stored once under `tables`. `live` is what the server (running dtajax2sql 0.3.10) answered at capture time; '
    + '`expect` is what the current library must do with the request against the schema in schema.sql.'
    + (note ? ' ' + note : ''),
  capturedOn: records[0]?.t?.slice(0, 10),
  tables, requests
};
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(fixture, null, 1) + '\n');
const byExpect = requests.reduce((m, r) => (m[r.expect] = (m[r.expect] ?? 0) + 1, m), {});
console.log(`${requests.length} requests -> ${outFile} (${fs.statSync(outFile).size} bytes); tables: ${Object.keys(tables).join(', ')}; expect: ${JSON.stringify(byExpect)}`);
