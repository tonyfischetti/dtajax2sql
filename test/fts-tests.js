
import assert from 'assert';

import BetterSqlite3 from 'better-sqlite3';

import Dtajax2sql from '../dist/Dtajax2sql.js';


/*************************************************************************
  * setup
  */

const DB = new BetterSqlite3("./test/music.db", {
  readonly: true,
  fileMustExist: true
});

const inst = new Dtajax2sql('songs', 'sqlite', { });

const COLUMNS = [
  { "data": "song_id",         "name": "", "searchable": "true", "orderable": "true",  "search": { "value": "", "regex": "false" } },
  { "data": "Song title",      "name": "", "searchable": "true", "orderable": "false", "search": { "value": "", "regex": "false" } },
  { "data": "Artist name",     "name": "", "searchable": "true", "orderable": "false", "search": { "value": "", "regex": "false" } },
  { "data": "Tony's \"Notes\"", "name": "", "searchable": "true", "orderable": "false", "search": { "value": "", "regex": "false" } },
  { "data": "γρ'α`φ[έ]ς",      "name": "", "searchable": "true", "orderable": "false", "search": { "value": "", "regex": "false" } }
];

const mkParams = (searchValue, extra = {}) => ({
  "draw": "1",
  "columns": COLUMNS,
  "start": "0",
  "length": "20",
  "search": { "value": searchValue, "regex": "false" },
  "order": [ { "column": "0", "dir": "asc", "name": "" } ],
  "_": "1729015491120",
  ...extra
});

const ftSongIds = (searchValue, extra = {}) => {
  const { query } = inst.toSQLThroughFtTable('songs_fts', 'song_id', mkParams(searchValue, extra));
  return DB.prepare(query).all().map(i => i['song_id']);
};

const ftCount = (searchValue, extra = {}) => {
  const { countQuery } = inst.toSQLThroughFtTable('songs_fts', 'song_id', mkParams(searchValue, extra));
  return DB.prepare(countQuery).get()['filteredCount'];
};


describe("checking test enviromnent (FTS)", () => {
  it("songs_fts exists and is fully populated", () => {
    assert.equal(DB.prepare(`SELECT COUNT(*) as N FROM songs_fts`).get()["N"], 19);
  });
  it("songs (still) stores its text in NFD", () => {
    const title = DB.prepare(`SELECT "Artist name" as a FROM songs WHERE song_id = 3`).get()["a"];
    assert.equal(title, title.normalize("NFD"));
    assert.notEqual(title, title.normalize("NFC"));
  });
});


describe('toSQLThroughFtTable', () => {

  describe('generated SQL shape', () => {
    it("joins on the rowid key and matches through the ft table", () => {
      const params = mkParams("keepin");
      params.columns = COLUMNS.slice(0, 2);
      const { query, countQuery } = inst.toSQLThroughFtTable('songs_fts', 'song_id', params);
      assert.equal(query,
        `SELECT "songs"."song_id", "songs"."Song title" ` +
        `FROM "songs" ` +
        `INNER JOIN "songs_fts" ON ("songs_fts".rowid = "songs"."song_id") ` +
        `WHERE (True AND ("songs_fts" = '"keepin"')) ` +
        `ORDER BY "songs"."song_id" ASC NULLS LAST ` +
        `LIMIT 20 OFFSET 0`);
      assert.equal(countQuery,
        `SELECT COUNT(*) as filteredCount ` +
        `FROM "songs" ` +
        `INNER JOIN "songs_fts" ON ("songs_fts".rowid = "songs"."song_id") ` +
        `WHERE (True AND ("songs_fts" = '"keepin"'))`);
    });
  });

  describe('global search through the ft table', () => {
    it("simple term", () => {
      assert.deepEqual(ftSongIds("keepin"), [8]);
    });
    it("is case-insensitive", () => {
      assert.deepEqual(ftSongIds("BOWIE"), [2]);
    });
    it("multiple words are ANDed", () => {
      assert.deepEqual(ftSongIds("ol dirty"), [6]);
      assert.deepEqual(ftSongIds("100 cover"), [17]);
    });
    it("hyphens act as word separators", () => {
      assert.deepEqual(ftSongIds("k-the"), [5]);
    });
    it("apostrophes are stripped", () => {
      assert.deepEqual(ftSongIds("keepin'"), [8]);
    });
    it("greek (typed composed/NFC, stored decomposed/NFD)", () => {
      assert.deepEqual(ftSongIds("Δημήτρης".normalize("NFC")), [3]);
    });
    it("empty search returns everything (through the join)", () => {
      assert.equal(ftSongIds("").length, 19);
    });
  });

  describe('FTS5 query-syntax characters don\'t break the query', () => {
    it("percent signs (a bare `100%` is an fts5 syntax error)", () => {
      assert.deepEqual(ftSongIds("100%"), [16, 17]);
    });
    it("asterisks (a bare `*69` is an fts5 'unknown special query')", () => {
      assert.deepEqual(ftSongIds("*69"), [7]);
    });
    it("double quotes", () => {
      assert.doesNotThrow(() => ftSongIds('"heroes"'));
    });
    it("emoji (separator-only tokens match nothing, but don't throw)", () => {
      assert.deepEqual(ftSongIds("💯"), []);
    });
    it("a term with no tokens at all matches nothing (`= ''` would be a syntax error)", () => {
      assert.deepEqual(ftSongIds("-"), []);
    });
    it("sql injection attempts are inert (they just... find Bobby Tables)", () => {
      assert.deepEqual(ftSongIds("Robert'); DROP TABLE songs;--"), [10]);
      assert.equal(DB.prepare(`SELECT COUNT(*) as N FROM songs`).get()["N"], 19);
    });
  });

  describe('combined with searchBuilder', () => {
    const sb = {
      "criteria": [
        { "condition": ">=", "data": "Song ID", "origData": "song_id", "type": "num", "value": [ "13" ], "value1": "13" }
      ],
      "logic": "AND"
    };
    it("ft global search AND searchBuilder criteria", () => {
      assert.deepEqual(ftSongIds("moondogs", { searchBuilder: sb }), [13, 17, 18]);
    });
    it("searchBuilder alone (no global search) filters through the join", () => {
      assert.deepEqual(ftSongIds("", { searchBuilder: sb }), [13, 14, 15, 16, 17, 18, 19]);
    });
  });

  describe('countQuery', () => {
    it("counts the filtered set (ignoring LIMIT/OFFSET)", () => {
      assert.equal(ftCount("moondogs"), 6);
      assert.equal(ftCount(""), 19);
      assert.equal(ftCount("💯"), 0);
    });
    it("agrees with the main query when paging", () => {
      const params = mkParams("moondogs");
      params.length = "2";
      const { query, countQuery } = inst.toSQLThroughFtTable('songs_fts', 'song_id', params);
      assert.equal(DB.prepare(query).all().length, 2);
      assert.equal(DB.prepare(countQuery).get()['filteredCount'], 6);
    });
  });

});
