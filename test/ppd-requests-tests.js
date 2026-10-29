
import assert from 'assert';
import fs from 'fs';
import BetterSqlite3 from 'better-sqlite3';
import Dtajax2sql from '../dist/Dtajax2sql.js';


/*************************************************************************
  * Real-world requests, captured verbatim from ppd's browser UI
  * (see test/fixtures/ppd/requests.json for provenance).
  *
  * The fixture database is ppd's real schema with no rows, so every
  * generated statement is checked for validity against the real column
  * names and FTS5 tables (FTS5 parses its MATCH expression at run time,
  * which is why the statements are executed, not just prepared).
  */

const fixture = JSON.parse(fs.readFileSync('./test/fixtures/ppd/requests.json', 'utf8'));

const DB = new BetterSqlite3(':memory:');
DB.exec(fs.readFileSync('./test/fixtures/ppd/schema.sql', 'utf8'));

// exactly what ppd's handler does with a request
const toSQL = (rec) => {
  const table = fixture.tables[rec.table];
  const params = { ...rec.request, columns: table.columns };
  const inst = new Dtajax2sql(rec.table, 'sqlite', {});
  const mode = params.globalSearchMode;
  return (mode && mode !== 'classic')
    ? inst.toSQLThroughFtTable(mode, table.primaryKey, params)
    : inst.toSQL(params);
};


describe('requests captured from ppd', () => {

  it('covers all three tables and every search mode', () => {
    const tables = new Set(fixture.requests.map((r) => r.table));
    assert.deepStrictEqual([...tables].sort(), ['constituents', 'exhibitions', 'main']);
    const modes = new Set(fixture.requests.map((r) => r.request.globalSearchMode).filter(Boolean));
    assert.deepStrictEqual([...modes].sort(), ['classic', 'ftconstituents', 'ftglobal', 'fttitles']);
    assert.ok(fixture.requests.some((r) => r.request.searchBuilder?.criteria?.length > 0), 'has SearchBuilder criteria');
    assert.ok(fixture.requests.some((r) => r.request.searchBuilder && !r.request.searchBuilder.criteria), 'has the idle SearchBuilder {}');
  });

  for (const rec of fixture.requests) {
    const mode = rec.request.globalSearchMode ? ` [${rec.request.globalSearchMode}]` : '';

    if (rec.expect === 'no-such-column') {
      it(`#${rec.id}${mode} ${rec.label} -> fails at SQL time with "no such column"`, () => {
        const { query } = toSQL(rec);
        assert.throws(() => DB.prepare(query).all(), /no such column/);
      });
      continue;
    }

    it(`#${rec.id}${mode} ${rec.label}`, () => {
      const { query, countQuery, fusedQuery } = toSQL(rec);
      assert.deepStrictEqual(DB.prepare(query).all(), []);
      assert.deepStrictEqual(DB.prepare(countQuery).get(), { filteredCount: 0 });
      assert.deepStrictEqual(DB.prepare(fusedQuery).all(), []);
    });
  }

});
