
/*
 * request-shape validation (toSQL / toSQLThroughFtTable refuse
 * malformed requests with a real message instead of an incidental
 * TypeError or quietly-wrong SQL)
 */

import assert from 'assert';

import Dtajax2sql from '../dist/Dtajax2sql.js';


const inst = new Dtajax2sql('songs', 'sqlite');

const validParams = () => ({
  draw: '1',
  columns: [
    { data: 'song_id', name: '', searchable: 'true', orderable: 'true', search: { value: '', regex: 'false' } }
  ],
  start: '0',
  length: '10',
  search: { value: '', regex: 'false' },
  _: '0'
});


describe('DataTables request validation', () => {

  describe('accepts what DataTables actually sends', () => {
    it("a minimal valid request", () => {
      assert.doesNotThrow(() => inst.toSQL(validParams()));
    });
    it("JSON-body types: numbers and booleans", () => {
      const p = validParams();
      p.start = 0;
      p.length = 10;
      p.columns[0].searchable = true;
      p.order = [{ column: 0, dir: 'asc' }];
      assert.doesNotThrow(() => inst.toSQL(p));
    });
    it("query-string encodings: numeric-keyed objects for columns, order and criteria", () => {
      const p = validParams();
      p.columns = { 0: p.columns[0], 1: { data: 'Song title', name: '', searchable: 'true', orderable: 'true' } };
      p.order = { 0: { column: '1', dir: 'desc' } };
      p.searchBuilder = {
        criteria: { 0: { condition: '=', data: 'Song ID', origData: 'song_id', type: 'num', value: ['1'], value1: '1' } },
        logic: 'AND'
      };
      assert.doesNotThrow(() => inst.toSQL(p));
    });
    it("a searchBuilder with no criteria key (an empty array can't be encoded in a query string)", () => {
      const p = validParams();
      p.searchBuilder = { logic: 'AND' };
      assert.doesNotThrow(() => inst.toSQL(p));
    });
    it("an unfilled SearchBuilder row", () => {
      const p = validParams();
      p.searchBuilder = { criteria: [{ type: '' }], logic: 'AND' };
      assert.doesNotThrow(() => inst.toSQL(p));
    });
    it("a column with no data source (DataTables sends data: '' for data: null)", () => {
      const p = validParams();
      p.columns.push({ data: '', name: '', searchable: 'true', orderable: 'false' });
      assert.doesNotThrow(() => inst.toSQL(p));
    });
  });

  describe('rejects malformed requests with a real message', () => {
    for (const [name, change, message] of [
      ['null',                                 () => null,                                                  /parameters must be an object/],
      ['a string',                             () => 'draw=1&start=0',                                      /parameters must be an object/],
      ['an array',                             () => [validParams()],                                       /parameters must be an object/],
      ['missing columns',                      p => { delete p.columns; return p; },                        /columns must be a non-empty array/],
      ['empty columns',                        p => { p.columns = []; return p; },                          /columns must be a non-empty array/],
      ['columns as a string',                  p => { p.columns = 'song_id'; return p; },                   /columns must be a non-empty array/],
      ['a column that is not an object',       p => { p.columns = ['song_id']; return p; },                 /columns\[0\]\.data/],
      ['a column whose data is not a string',  p => { p.columns[0].data = {}; return p; },                  /columns\[0\]\.data/],
      ['a column whose data is null',          p => { p.columns[0].data = null; return p; },                /columns\[0\]\.data/],
      ['a column with a bogus searchable flag', p => { p.columns[0].searchable = 'yes'; return p; },        /columns\[0\]\.searchable/],
      ['missing search',                       p => { delete p.search; return p; },                         /search\.value/],
      ['search.value that is not a string',    p => { p.search = { value: ['x'], regex: 'false' }; return p; }, /search\.value/],
      ['missing start',                        p => { delete p.start; return p; },                          /start/],
      ['missing length',                       p => { delete p.length; return p; },                         /length/],
      ['order as a string',                    p => { p.order = 'nope'; return p; },                        /order must be an array/],
      ['searchBuilder as a string',            p => { p.searchBuilder = 'nope'; return p; },                /searchBuilder must be an object/],
      ['searchBuilder with bogus logic',       p => { p.searchBuilder = { criteria: [], logic: 'XOR' }; return p; }, /searchBuilder\.logic/],
      ['criteria that is not an array',        p => { p.searchBuilder = { criteria: 'x', logic: 'AND' }; return p; }, /criteria must be an array/],
      ['a criterion that is not an object',    p => { p.searchBuilder = { criteria: ['x'], logic: 'AND' }; return p; }, /criterion 0 must be an object/],
      ['a nested group with bogus logic',      p => { p.searchBuilder = { criteria: [{ criteria: [], logic: 'NAND' }], logic: 'AND' }; return p; }, /searchBuilder\.logic/]
    ]) {
      it(name, () => {
        assert.throws(() => inst.toSQL(change(validParams())), message);
      });
    }
  });

  describe('the same checks guard toSQLThroughFtTable', () => {
    it("null", () => {
      assert.throws(() => inst.toSQLThroughFtTable('songs_fts', 'song_id', null), /parameters must be an object/);
    });
    it("missing columns", () => {
      const p = validParams();
      delete p.columns;
      assert.throws(() => inst.toSQLThroughFtTable('songs_fts', 'song_id', p), /columns/);
    });
    it("a valid request passes", () => {
      assert.doesNotThrow(() => inst.toSQLThroughFtTable('songs_fts', 'song_id', validParams()));
    });
  });

  describe("never mutates the caller's request object", () => {
    it("arrays supplied by the caller stay the same objects", () => {
      const p = validParams();
      p.order = [{ column: '0', dir: 'asc' }];
      p.searchBuilder = { logic: 'AND', criteria: [] };
      const { columns, order, searchBuilder } = p;
      const criteria = p.searchBuilder.criteria;
      inst.toSQL(p);
      assert.strictEqual(p.columns, columns);
      assert.strictEqual(p.order, order);
      assert.strictEqual(p.searchBuilder, searchBuilder);
      assert.strictEqual(p.searchBuilder.criteria, criteria);
    });
    it("object-encoded properties are not replaced on the caller", () => {
      const p = validParams();
      p.columns = { 0: p.columns[0] };
      p.order = { 0: { column: '0', dir: 'asc' } };
      const { columns, order } = p;
      inst.toSQL(p);
      assert.strictEqual(p.columns, columns);
      assert.strictEqual(p.order, order);
      assert.ok(!Array.isArray(p.columns));
    });
    it("a searchBuilder tree that needs healing at depth is healed on a copy", () => {
      const p = validParams();
      p.searchBuilder = {
        logic: 'AND',
        criteria: { 0: { logic: 'OR', criteria: { '[0][condition]': '=', '[0][origData]': 'song_id', '[0][type]': 'num', '[0][value1]': '1' } } }
      };
      const before = JSON.stringify(p);
      inst.toSQL(p);
      assert.equal(JSON.stringify(p), before);
    });
  });

  describe('SearchBuilder complexity limits', () => {
    const group = (...criteria) => ({ logic: 'AND', criteria });
    const leaf  = () => ({ condition: '=', data: 'Song ID', origData: 'song_id', type: 'num', value: ['1'], value1: '1' });

    it("the defaults accept a realistic tree", () => {
      const p = validParams();
      p.searchBuilder = group(group(leaf(), group(leaf(), leaf())), leaf(), group(leaf()));
      assert.doesNotThrow(() => inst.toSQL(p));
    });
    it("limits nesting depth (the top level is depth 1)", () => {
      const shallow = new Dtajax2sql('songs', 'sqlite', { searchBuilder: { maxDepth: 2 } });
      const ok = validParams();
      ok.searchBuilder = group(group(leaf()));
      assert.doesNotThrow(() => shallow.toSQL(ok));
      const tooDeep = validParams();
      tooDeep.searchBuilder = group(group(group(leaf())));
      assert.throws(() => shallow.toSQL(tooDeep), /maximum depth of 2/);
    });
    it("limits the total number of criteria and groups", () => {
      const small = new Dtajax2sql('songs', 'sqlite', { searchBuilder: { maxCriteria: 3 } });
      const ok = validParams();
      ok.searchBuilder = group(leaf(), group(leaf()));             // leaf + group + leaf = 3
      assert.doesNotThrow(() => small.toSQL(ok));
      const tooMany = validParams();
      tooMany.searchBuilder = group(leaf(), leaf(), leaf(), leaf());
      assert.throws(() => small.toSQL(tooMany), /maximum of 3 criteria/);
      const tooManyNested = validParams();
      tooManyNested.searchBuilder = group(leaf(), group(leaf(), leaf()));   // = 4
      assert.throws(() => small.toSQL(tooManyNested), /maximum of 3 criteria/);
    });
    it("unfilled rows count too (the limit is on request size, not on filters)", () => {
      const small = new Dtajax2sql('songs', 'sqlite', { searchBuilder: { maxCriteria: 2 } });
      const p = validParams();
      p.searchBuilder = { logic: 'AND', criteria: [{ type: '' }, { type: '' }, { type: '' }] };
      assert.throws(() => small.toSQL(p), /maximum of 2 criteria/);
    });
    it("nonsensical limits are rejected when the instance is built", () => {
      for (const bad of [0, -1, 1.5, '8', NaN])
        assert.throws(() => new Dtajax2sql('songs', 'sqlite', { searchBuilder: { maxDepth: bad } }), /maxDepth/);
      for (const bad of [0, -1, 1.5, '100', NaN])
        assert.throws(() => new Dtajax2sql('songs', 'sqlite', { searchBuilder: { maxCriteria: bad } }), /maxCriteria/);
      assert.doesNotThrow(() => new Dtajax2sql('songs', 'sqlite', { searchBuilder: {} }));
    });
  });

  describe('ORDER BY validation runs end-to-end through toSQL', () => {
    it("an untrusted direction", () => {
      const p = validParams();
      p.order = [{ column: '0', dir: 'asc, random()' }];
      assert.throws(() => inst.toSQL(p), /order direction/);
    });
    it("an out-of-range column index", () => {
      const p = validParams();
      p.order = [{ column: '7', dir: 'asc' }];
      assert.throws(() => inst.toSQL(p), /order column/);
    });
  });

});

