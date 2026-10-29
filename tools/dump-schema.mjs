#!/usr/bin/env node
// Write the DDL (no data) of the ppd.db tables the dtajax endpoints touch to
// test/fixtures/ppd/schema.sql, and prove an empty in-memory database can be
// built from it.
//
//   PPD_DIR=~/path/to/ppd node tools/dump-schema.mjs [outFile=test/fixtures/ppd/schema.sql]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const PPD = process.env.PPD_DIR ?? `${process.env.HOME}/Library/CloudStorage/Dropbox/NYPL/ppd`;
const [, , out = 'test/fixtures/ppd/schema.sql'] = process.argv;
const Database = createRequire(PPD + '/package.json')('better-sqlite3');

const src = new Database(PPD + '/ppd.db', { readonly: true, fileMustExist: true });
const names = ['main', 'constituents', 'exhibitions', 'ftglobal', 'fttitles', 'ftconstituents'];
const rows = src.prepare(`SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name IN (${names.map(() => '?').join(',')})`).all(...names);
rows.sort((a, b) => names.indexOf(a.name) - names.indexOf(b.name));
const ddl = '-- Table definitions (no data) from NYPL ppd.db, used to check that\n'
  + '-- SQL generated for captured real-world requests is valid on the real schema.\n\n'
  + rows.map((r) => r.sql.trim() + ';').join('\n\n') + '\n';
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, ddl);

const mem = new Database(':memory:');
mem.exec(ddl);
const have = mem.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${names.map(() => '?').join(',')})`).all(...names).map((r) => r.name);
console.log(`wrote ${out} (${ddl.length} bytes); in-memory tables: ${have.join(', ')}`);
console.log('fts5 works in-memory:', mem.prepare('SELECT count(*) n FROM ftglobal WHERE ftglobal MATCH ?').get('kafka'));
