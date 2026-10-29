#!/usr/bin/env node
// Replay captured dtajax requests (JSONL from capture-proxy.mjs or
// drive-ppd.mjs) through one or more dtajax2sql builds against ppd.db,
// mirroring ppd's handler (lib/api/make-dtajax-handler.ts), and compare
// each build with what the live server answered and with each other.
//
//   PPD_DIR=~/path/to/ppd node tools/replay-ppd-corpus.mjs captured.jsonl [report.json] name=path ...
//
// where each name=path names a build: a directory holding a package.json
// (an installed `node_modules/dtajax2sql`, or this repo after `npm run
// build`). The first two builds named are the pair whose SQL text is
// compared byte for byte. Exit status 1 if any build disagrees with the
// live answers.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const PPD = path.resolve(process.env.PPD_DIR ?? `${process.env.HOME}/Library/CloudStorage/Dropbox/NYPL/ppd`);
const PK = { main: 'Object_ID', constituents: 'Constituent_ID', exhibitions: 'Exhibition_ID' };

const [, , inFile, ...rest] = process.argv;
const reportFile = rest[0] && !rest[0].includes('=') ? rest.shift() : null;
const BUILDS = Object.fromEntries(rest.map((a) => { const [name, dir] = a.split('='); return [name, path.resolve(dir)]; }));
if (!inFile || !Object.keys(BUILDS).length) {
  console.error('usage: replay-ppd-corpus.mjs captured.jsonl [report.json] name=path [name=path ...]');
  process.exit(2);
}

const Database = createRequire(PPD + '/package.json')('better-sqlite3');
const DB = new Database(PPD + '/ppd.db', { readonly: true, fileMustExist: true });

const libs = {};
for (const [name, dir] of Object.entries(BUILDS)) {
  const pkg = JSON.parse(fs.readFileSync(dir + '/package.json', 'utf8'));
  const entry = dir + '/' + (pkg.exports?.['.']?.import ?? pkg.exports?.['.']?.default ?? pkg.module ?? pkg.main);
  libs[name] = { version: pkg.version, Dtajax2sql: (await import(entry)).Dtajax2sql };
}
const [first, second] = Object.keys(libs);

// exactly what performAJAX does, minus the HTTP layer
const run = (lib, table, params) => {
  const d = new lib.Dtajax2sql(table, 'sqlite', {});
  try {
    const mode = params?.globalSearchMode;
    const a = mode && mode !== 'classic'
      ? d.toSQLThroughFtTable(mode, PK[table], params)
      : d.toSQL(params);
    const query = a.query.normalize('NFD'), countQuery = a.countQuery.normalize('NFD');
    const rows = DB.prepare(query).all();
    const count = DB.prepare(countQuery).get().filteredCount;
    return { ok: true, query, countQuery, count, keys: rows.map((r) => r[PK[table]]) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
};

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sameSet = (a, b) => a.length === b.length && same([...a].sort(), [...b].sort());
// ppd's handler rewrites two SQLite errors into friendly text; classify both forms alike
const errKind = (m) => !m ? null
  : /fts5: syntax error|syntax error in your enhanced search|unknown special query|unterminated string/.test(m) ? 'fts-syntax'
  : /no such column|not included in the enhanced search modes/.test(m) ? 'no-such-column'
  : 'other';

const records = fs.readFileSync(inFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const report = [];
const tally = {};
const bump = (k) => (tally[k] = (tally[k] ?? 0) + 1);

for (const rec of records) {
  const live = rec.response;
  const liveErr = live.error ?? (live.status >= 400 ? `HTTP ${live.status}` : null);
  const row = { id: rec.id, table: rec.table, label: rec.label, live: { count: live.recordsFiltered, nData: live.nData, error: liveErr }, builds: {} };
  for (const name of Object.keys(libs)) {
    const r = run(libs[name], rec.table, rec.request);
    let verdict;
    if (!liveErr && live.recordsFiltered === undefined) {
      verdict = r.ok ? 'ok (live body not captured)' : 'fails (live body not captured)';
    } else if (liveErr) {
      verdict = !r.ok && errKind(r.error) === errKind(liveErr) ? 'same-error'
              : !r.ok ? `different-error (${errKind(r.error)} vs ${errKind(liveErr)})`
              : 'succeeds-where-live-failed';
    } else if (!r.ok) {
      verdict = 'fails-where-live-succeeded';
    } else {
      const keysKnown = Array.isArray(live.dataKeys);
      const keysMatch = !keysKnown || same(live.dataKeys, r.keys.slice(0, live.dataKeys.length));
      verdict = r.count === live.recordsFiltered && r.keys.length === live.nData && keysMatch ? 'match'
              : r.count === live.recordsFiltered && r.keys.length === live.nData && keysKnown && sameSet(live.dataKeys, r.keys.slice(0, live.dataKeys.length)) ? 'match-reordered'
              : `MISMATCH count ${r.count} vs ${live.recordsFiltered}, rows ${r.keys.length} vs ${live.nData}${keysKnown && !keysMatch ? ', keys differ' : ''}`;
    }
    row.builds[name] = { ...r, nRows: r.keys?.length, verdict };
    bump(`${name}: ${verdict.split(' ')[0]}`);
  }
  if (second) {
    const a = row.builds[first], b = row.builds[second];
    row.sqlIdentical = a.ok && b.ok && a.query === b.query && a.countQuery === b.countQuery;
  }
  report.push(row);
}

// ---- print -------------------------------------------------------------
const pad = (s, n) => String(s ?? '').padEnd(n).slice(0, n);
console.log(`${records.length} captured requests; builds: ${Object.entries(libs).map(([n, l]) => `${n}=${l.version}`).join(', ')}\n`);
console.log(pad('#', 4) + pad('table', 13) + pad('label', 46) + pad('live', 20) + Object.keys(libs).map((n) => pad(n, 26)).join('') + (second ? 'sql=' : ''));
for (const row of report) {
  const live = row.live.error ? `ERR ${errKind(row.live.error)}` : `${row.live.count} / ${row.live.nData}`;
  console.log(pad(row.id, 4) + pad(row.table, 13) + pad(row.label, 46) + pad(live, 20)
    + Object.keys(libs).map((n) => pad(row.builds[n].verdict, 26)).join('') + (second ? (row.sqlIdentical ? 'same' : 'diff') : ''));
}
console.log('\nsummary:');
for (const [k, v] of Object.entries(tally).sort()) console.log(`  ${pad(k, 44)} ${v}`);
if (second) console.log(`  SQL byte-identical ${first} vs ${second}: ${report.filter((r) => r.sqlIdentical).length}/${report.length}`);

const problems = report.filter((r) => Object.values(r.builds).some((b) => !/^(match|same-error|ok \()/.test(b.verdict)));
if (problems.length) {
  console.log(`\n${problems.length} request(s) where some build disagrees with the live app:`);
  for (const r of problems) {
    const q = records.find((x) => x.id === r.id).request;
    console.log(`\n#${r.id} [${r.table}] ${r.label}`);
    console.log(`  request: mode=${q.globalSearchMode ?? '-'} search=${JSON.stringify(q.search?.value)} start=${q.start} length=${q.length} order=${JSON.stringify(q.order)} searchBuilder=${JSON.stringify(q.searchBuilder).slice(0, 200)}`);
    for (const [n, b] of Object.entries(r.builds)) console.log(`  ${pad(n, 8)} ${b.verdict}${b.error ? '  -- ' + b.error.replace(/\s+/g, ' ').slice(0, 160) : ''}`);
  }
}
if (reportFile) fs.writeFileSync(reportFile, JSON.stringify(report, null, 1));
process.exitCode = problems.length ? 1 : 0;
DB.close();
