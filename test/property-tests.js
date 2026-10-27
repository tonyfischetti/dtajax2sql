
/*
 * Property-based tests (fast-check)
 *
 * Two invariants:
 *   1. PARSE-SAFETY: for any input, the generated SQL is well-formed
 *      (DB.prepare never throws)
 *   2. SEMANTIC: the generated SQL selects exactly the rows that a
 *      plain-javascript reimplementation of the filter selects
 *      (including SQL's three-valued logic around NULL)
 *
 * On failure, fast-check reports a *shrunk* (minimal) counterexample
 * and the seed to reproduce it.
 */

import assert from 'assert';
import fc from 'fast-check';
import BetterSqlite3 from 'better-sqlite3';

import Dtajax2sql from '../dist/Dtajax2sql.js';
import SQLiteAdapter from '../dist/adapters/SQLiteAdapter.js';


/*************************************************************************
  * setup
  */

const DB = new BetterSqlite3("./test/music.db", {
  readonly: true,
  fileMustExist: true
});

//  NOTE  these tests are about SQL semantics, not request limits: the
//        sbTree generator below can (in principle) produce up to 120
//        entries, past the default maxCriteria of 100
const inst = new Dtajax2sql('songs', 'sqlite', { searchBuilder: { maxCriteria: 1000 } });

const STR_COLS = ["Song title", "Artist name", "Tony's \"Notes\"", "γρ'α`φ[έ]ς"];
const ALL_COLS = ["song_id", ...STR_COLS];

const COLUMNS = ALL_COLS.map(c => (
  { "data": c, "name": "", "searchable": "true", "orderable": "true",
    "search": { "value": "", "regex": "false" } }
));

const ALL_ROWS = DB.prepare(`SELECT * FROM songs`).all();

const mkParams = (searchValue, extra = {}) => ({
  "draw": "1",
  "columns": COLUMNS,
  "start": "0",
  "length": "100",
  "search": { "value": searchValue, "regex": "false" },
  "order": [ { "column": "0", "dir": "asc", "name": "" } ],
  "_": "1729015491120",
  ...extra
});


/*************************************************************************
  * generators
  */

const nastyFrag = fc.constantFrom(
  '%', '_', "'", '"', '\\', '`', ';', '--', '*', '(', ')', '[', ']',
  ' ', '-', '\t', '\n', '\u0000', '\u200b',
  'λ', 'Δημήτρης', '齆', '💯', 'é', 'é', 'ñ', 'ٱللَّٰهُ',
  'keep', '100', 'the',
  // FTS5 query syntax
  'OR', 'NOT', 'AND', ':', '^', '"Song title":', 'keep*'
);

const bmpChar = fc.integer({ min: 0x20, max: 0xFFFF }).
  filter(c => c < 0xD800 || c > 0xDFFF).
  map(c => String.fromCodePoint(c));

const astralChar = fc.integer({ min: 0x10000, max: 0x10FFF }).
  map(c => String.fromCodePoint(c));

const controlChar = fc.integer({ min: 0x00, max: 0x1F }).
  map(c => String.fromCodePoint(c));

const anyText = fc.array(
  fc.oneof(fc.string(), nastyFrag, bmpChar, astralChar, controlChar),
  { maxLength: 6 }
).map(xs => xs.join(''));

const numStr = fc.integer({ min: -100, max: 100 }).map(String);

const strCriterion = fc.record({
  condition: fc.constantFrom('=', '!=', 'starts', '!starts', 'ends', '!ends',
                             'contains', '!contains', 'null', '!null'),
  data: fc.constantFrom(...STR_COLS),
  type: fc.constant('string'),
  value1: anyText
}).map(c => ({ ...c, origData: c.data, value: [c.value1] }));

const numCriterion = fc.record({
  condition: fc.constantFrom('=', '!=', '<', '<=', '>', '>=',
                             'between', '!between'),
  type: fc.constant('num'),
  value1: numStr,
  value2: numStr
}).map(c => ({ ...c, data: 'Song ID', origData: 'song_id',
               value: [c.value1, c.value2] }));

const incompleteCriterion = fc.constant({ type: '' });

const criterion = fc.oneof(
  { weight: 4, arbitrary: strCriterion },
  { weight: 3, arbitrary: numCriterion },
  { weight: 1, arbitrary: incompleteCriterion }
);

const { sbTree } = fc.letrec(tie => ({
  sbTree: fc.record({
    criteria: fc.array(
      fc.oneof({ maxDepth: 3, depthSize: 'small' }, criterion, tie('sbTree')),
      { maxLength: 3 }
    ),
    logic: fc.constantFrom('AND', 'OR')
  })
}));


/*************************************************************************
  * reference implementation (the "obviously correct" version)
  */

const asciiLower = s => s.replace(/[A-Z]/g, c => c.toLowerCase());
const stripNul   = s => s.replaceAll(/\u0000/g, '');

/* three-valued logic, as SQL does it (U = NULL/unknown) */
const T = true, F = false, U = null;
const not3 = x => x === U ? U : !x;
const and3 = (a, b) => (a === F || b === F) ? F : (a === U || b === U) ? U : T;
const or3  = (a, b) => (a === T || b === T) ? T : (a === U || b === U) ? U : F;

const refGlobalMatch = (row, rawValue) => {
  if (rawValue === '') return T;    // empty search is skipped entirely
  const term = stripNul(
    rawValue.replace(/^\s+/, '').replace(/\s+$/, '').normalize('NFD'));
  const hay = ALL_COLS.map(c => row[c] ?? '').map(String).join('');
  return asciiLower(hay).includes(asciiLower(term)) ? T : F;
};

const refCriterion = (row, c) => {
  if (c.condition === undefined) return T;    // incomplete criterion
  const base = c.condition.replace(/^!/, '');
  const v = row[c.origData];
  let res;
  if (c.type === 'num') {
    const n1 = parseInt(c.value1, 10);
    const n2 = parseInt(c.value2, 10);
    if (base === '=')       res = (v === n1);
    if (base === '<')       res = (v < n1);
    if (base === '<=')      res = (v <= n1);
    if (base === '>')       res = (v > n1);
    if (base === '>=')      res = (v >= n1);
    if (base === 'between') res = (v >= n1 && v <= n2);
  } else {
    const term = stripNul((c.value1 ?? '').normalize('NFD'));
    if (base === 'null') res = (v === null || v === '');
    else if (v === null) res = U;     /* comparisons with NULL are NULL */
    else {
      if (base === '=')        res = (v === term);
      if (base === 'contains') res = asciiLower(v).includes(asciiLower(term));
      if (base === 'starts')   res = asciiLower(v).startsWith(asciiLower(term));
      if (base === 'ends')     res = asciiLower(v).endsWith(asciiLower(term));
    }
  }
  return c.condition.startsWith('!') ? not3(res) : res;
};

const refSearchBuilder = (row, sb) => {
  if (!sb.criteria || sb.criteria.length === 0) return T;
  const vals = sb.criteria.map(c =>
    ('criteria' in c) ? refSearchBuilder(row, c) : refCriterion(row, c));
  return sb.logic === 'AND' ? vals.reduce(and3, T) : vals.reduce(or3, F);
};

const refFilter = (searchValue, searchBuilder) => {
  return ALL_ROWS.
    filter(row => {
      const sb = searchBuilder ? refSearchBuilder(row, searchBuilder) : T;
      return and3(sb, refGlobalMatch(row, searchValue)) === T;
    }).
    map(row => row['song_id']).
    sort((a, b) => a - b);
};


/*************************************************************************
  * invariant 1: parse-safety
  */

describe('property: generated SQL always parses', function () {
  this.timeout(30000);

  it("any global search value (LIKE path)", () => {
    fc.assert(fc.property(anyText, (searchValue) => {
      const { query, countQuery, fusedQuery } = inst.toSQL(mkParams(searchValue));
      DB.prepare(query);
      DB.prepare(countQuery);
      DB.prepare(fusedQuery);
    }), { numRuns: 300 });
  });

  it("any global search value (FTS5 path — its own query language)", () => {
    fc.assert(fc.property(anyText, (searchValue) => {
      const { query, countQuery, fusedQuery } =
        inst.toSQLThroughFtTable('songs_fts', 'song_id', mkParams(searchValue));
      //  NOTE  FTS5 parses its query expression when the statement RUNS,
      //        not when it is prepared, so these have to execute. The one
      //        run-time error the escaper lets through on purpose is an
      //        unknown column in a `name:phrase` filter (as in 0.3.10),
      //        and then the query must really contain that filter
      try {
        DB.prepare(query).all();
        DB.prepare(countQuery).get();
        DB.prepare(fusedQuery).all();
      } catch (e) {
        const m = /no such column: (.*)$/.exec(e.message);
        if (m === null || !countQuery.includes(`"${m[1].replaceAll('"', '""')}":`)) throw e;
      }
    }), { numRuns: 500 });
  });

  it("any searchBuilder tree (parses AND runs)", () => {
    fc.assert(fc.property(sbTree, anyText, (sb, searchValue) => {
      const { query, countQuery, fusedQuery } =
        inst.toSQL(mkParams(searchValue, { searchBuilder: sb }));
      DB.prepare(query).all();
      DB.prepare(countQuery).get();
      DB.prepare(fusedQuery).all();
    }), { numRuns: 200 });
  });

  it("any column name, searched and ordered by (own in-memory table)", () => {
    const adapter = new SQLiteAdapter('t', {});
    fc.assert(fc.property(anyText, (colName) => {
      const mem = new BetterSqlite3(':memory:');
      try {
        mem.prepare(`CREATE TABLE "t" (${adapter.escapeID(colName)} TEXT)`).run();
        const ins = mem.prepare(`INSERT INTO "t" VALUES (?)`);
        ins.run('hello world');
        ins.run(null);
        const inst2 = new Dtajax2sql('t', 'sqlite');
        const params = mkParams('hello');
        params.columns = [ { "data": colName, "name": "", "searchable": "true",
                             "orderable": "true",
                             "search": { "value": "", "regex": "false" } } ];
        const { query, countQuery } = inst2.toSQL(params);
        assert.equal(mem.prepare(query).all().length, colName === '' ? 0 : 1);
        assert.equal(mem.prepare(countQuery).get()['filteredCount'], colName === '' ? 0 : 1);
      } finally {
        mem.close();
      }
    }), { numRuns: 200 });
  });

});


/*************************************************************************
  * invariant 2: the SQL means what the reference implementation means
  */

describe('property: SQL result === reference implementation result', function () {
  this.timeout(30000);

  const checkAgainstRef = (result, expected) => {
    const { query, countQuery, fusedQuery } = result;
    const got = DB.prepare(query).all().map(r => r['song_id']);
    assert.deepEqual(got, expected);
    assert.equal(DB.prepare(countQuery).get()['filteredCount'], expected.length);
    const fusedRows = DB.prepare(fusedQuery).all();
    assert.deepEqual(fusedRows.map(r => r['song_id']), expected);
    fusedRows.forEach(r => assert.equal(r['filteredCount'], expected.length));
  };

  it("global search (LIKE path)", () => {
    fc.assert(fc.property(anyText, (searchValue) => {
      checkAgainstRef(inst.toSQL(mkParams(searchValue)),
                      refFilter(searchValue, undefined));
    }), { numRuns: 200 });
  });

  it("searchBuilder trees (with NULL three-valued logic)", () => {
    fc.assert(fc.property(sbTree, (sb) => {
      checkAgainstRef(inst.toSQL(mkParams('', { searchBuilder: sb })),
                      refFilter('', sb));
    }), { numRuns: 200 });
  });

  it("searchBuilder AND global search combined", () => {
    fc.assert(fc.property(sbTree, anyText, (sb, searchValue) => {
      checkAgainstRef(inst.toSQL(mkParams(searchValue, { searchBuilder: sb })),
                      refFilter(searchValue, sb));
    }), { numRuns: 200 });
  });

});
