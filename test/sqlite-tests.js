
import assert from 'assert';
import BetterSqlite3 from 'better-sqlite3';
import SQLiteAdapter from '../dist/adapters/SQLiteAdapter.js';
import {
  unflattenBracketKeys,
  healSearchBuilderTree
} from '../dist/utils.js';
import { toFts5Query } from '../dist/fts5.js';


/*************************************************************************
  * setup
  */

const DB = new BetterSqlite3("./test/music.db", {
  readonly: true,
  fileMustExist: true
});


const adapter = new SQLiteAdapter('main', {
  whitespace: {
    removeLeading: true,
    removeTrailing: true
  },
});

const configVariant1 = new SQLiteAdapter('main', {
  whitespace: {
    removeLeading: false,
    removeTrailing: true
  },
});

const configVariant2 = new SQLiteAdapter('main', {
  whitespace: {
    removeLeading: true,
    removeTrailing: false
  },
});

const exParams = {
  "draw": "6",
  "columns": [
    {
      "data": "song_id",
      "name": "",
      "searchable": "false",
      "orderable": "true",
      "search": {
        "value": "",
        "regex": "false"
      }
    },
    {
      "data": "Song title",
      "name": "",
      "searchable": "true",
      "orderable": "true",
      "search": {
        "value": "",
        "regex": "false"
      }
    },
    {
      "data": "Artist name",
      "name": "",
      "searchable": "true",
      "orderable": "true",
      "search": {
        "value": "",
        "regex": "false"
      }
    },
    {
      "data": "Tony's \"Notes\"",
      "name": "",
      "searchable": "true",
      "orderable": "false",
      "search": {
        "value": "",
        "regex": "false"
      }
    },
    {
      "data": "γρ'α`φ[έ]ς",
      "name": "",
      "searchable": "false",
      "orderable": "true",
      "search": {
        "value": "",
        "regex": "false"
      }
    }
  ],
  "start": "0",
  "length": "12",
  "search": {
    "value": "keep",
    "regex": "false"
  },
  "_": "1729015491120"
};


describe("checking test enviromnent", () => {
  describe("music.db test DB", () => {
    it("music.db hasn't changed", () => {
      const q = `SELECT COUNT(*) as N FROM songs`;
      assert.equal(DB.prepare(q).get()["N"], 19);
    });
  });
});



/*************************************************************************
  * sanitization
  */

describe('sanitization', () => {

  describe('returnOkEscapeCharacter', () => {
    it("simple", () => {
      assert.equal(adapter.returnOkEscapeCharacter("simple"), "\\");
    });
    it("no backslash", () => {
      assert.equal(adapter.returnOkEscapeCharacter("this\\that"), "@");
    });
    it("no @", () => {
      assert.equal(adapter.returnOkEscapeCharacter("this@that"), "\\");
    });
    it("handle the unthinkable case", () => {
      const s = "\\@!λ齆֎پ௺᭩uh oh!";
      assert.equal(adapter.returnOkEscapeCharacter(s), "¼");
    });
  });

  describe('escapeID (not DB)', () => {
    it("simple", () => {
      assert.equal(adapter.escapeID("song_id"), '"song_id"');
    });
    it("errors correctly", () => {
      assert.throws(() => adapter.escapeID(4), Error);
      assert.throws(() => adapter.escapeID({}), Error);
    });
    it("spaces in column name", () => {
      assert.equal(adapter.escapeID("Song title"), '"Song title"');
    });
    it("quotes in column name", () => {
      assert.equal(adapter.escapeID(`Tony's "Notes"`), `"Tony's ""Notes"""`);
      assert.equal(adapter.escapeID(`Tony's ""Notes""`), `"Tony's """"Notes"""""`);
    });
  });

  describe('escapeID using DB', () => {
    it("simple", () => {
      const q = `SELECT ${adapter.escapeID("song_id")} FROM songs WHERE ${adapter.escapeID("Song title")} = 'Electrobugs';`;
      assert.equal(DB.prepare(q).get()["song_id"], 5);
    });
    it("spaces in column name", () => {
      const q = `SELECT ${adapter.escapeID("Artist name")} FROM songs WHERE ${adapter.escapeID('Song title')} = '$ENV{''HOME''}'`;
      assert.equal(DB.prepare(q).get()["Artist name"], "Tony and the Moondogs");
    });
    it("quotes in column name", () => {
      const t = adapter.escapeID(`Tony's "Notes"`);
      const q = `SELECT COUNT(*) AS N FROM songs WHERE ${t} = '::sweats::'`;
      assert.equal(DB.prepare(q).get()["N"], 2);
    });
  });

  describe('escapeForLIKE', () => {
    it("simple", () => {
      assert.equal(adapter.escapeForLIKE("simple").str, "simple");
    });
    it("single quote", () => {
      assert.equal(adapter.escapeForLIKE("Ol'").str, "Ol''");
    });
    it("double quote", () => {
      assert.equal(adapter.escapeForLIKE('"Friends').str, '"Friends');
    });
    it("backslash", () => {
      assert.equal(adapter.escapeForLIKE('\\').str, '\\');
    });
    it("percent sign", () => {
      const r = adapter.escapeForLIKE('100%');
      assert.equal(r.str, '100\\%');
      assert.equal(r.escape, '\\');
    });
    it("underscore", () => {
      const r = adapter.escapeForLIKE('City_Vibes');
      assert.equal(r.str, 'City\\_Vibes');
      assert.equal(r.escape, '\\');
    });
    it("underscore 2", () => {
      const r = adapter.escapeForLIKE('C\\ity_Vibes');
      assert.equal(r.str, 'C\\ity@_Vibes');
      assert.equal(r.escape, '@');
    });

  });

  describe('quoteString (value choke-point)', () => {
    it("quotes and escapes", () => {
      assert.equal(adapter.quoteString("Ol' Dirty"), "'Ol'' Dirty'");
    });
    it("empty string", () => {
      assert.equal(adapter.quoteString(""), "''");
    });
  });

  describe('quoteForLIKE (LIKE choke-point)', () => {
    it("wraps the pattern in quotes with the given affixes", () => {
      assert.equal(adapter.quoteForLIKE("simple", '%', '%'), "'%simple%'");
      assert.equal(adapter.quoteForLIKE("simple", '', '%'), "'simple%'");
      assert.equal(adapter.quoteForLIKE("simple", '%', ''), "'%simple'");
    });
    it("appends an ESCAPE clause when wildcards need escaping", () => {
      assert.equal(adapter.quoteForLIKE("100%", '%', '%'), "'%100\\%%' ESCAPE '\\'");
    });
    it("escapes quotes inside the pattern", () => {
      assert.equal(adapter.quoteForLIKE("Ol'", '%', '%'), "'%Ol''%'");
    });
  });

  describe('qualifyColumn (identifier choke-point)', () => {
    it("qualifies with the (escaped) table name", () => {
      assert.equal(adapter.qualifyColumn("Song title"), '"main"."Song title"');
    });
    it("escapes quotes in the column name", () => {
      assert.equal(adapter.qualifyColumn(`Tony's "Notes"`), `"main"."Tony's ""Notes"""`);
    });
  });

  //  TODO  expand on this!!!
  describe('all escaping (DB)', () => {
    it("escaping composes into a well-formed query", () => {
      const q = `SELECT * FROM songs WHERE ((${adapter.escapeID("Song title")} LIKE '%${adapter.escapeForLIKE("\\").str}%') OR (${adapter.escapeID("Song title")} LIKE '%${adapter.escapeForLIKE("%").str}%' ESCAPE '${adapter.escapeForLIKE("%").escape}') OR (${adapter.escapeID("Song title")}='${adapter.escapeString("Robert'); DROP TABLE songs;--")}'))`;
      assert.equal(q, `SELECT * FROM songs WHERE (("Song title" LIKE '%\\%') OR ("Song title" LIKE '%\\%%' ESCAPE '\\') OR ("Song title"='Robert''); DROP TABLE songs;--'))`);
      assert.doesNotThrow(() => DB.prepare(q).all());
    });
  });

});



/*************************************************************************
  * LIMITs and OFFSETs
  */

describe('limits and offsets', () => {

  const capped = new SQLiteAdapter('main', {
    whitespace: { removeLeading: true, removeTrailing: true },
    pagination: { maxPageSize: 25 }
  });

  describe('getLimitSql', () => {
    it("should handle simple case", () => {
      assert.equal(adapter.getLimitSql({ length: "20" }), "LIMIT 20");
    });
    it("accepts a number too (JSON bodies)", () => {
      assert.equal(adapter.getLimitSql({ length: 20 }), "LIMIT 20");
      assert.equal(adapter.getLimitSql({ length: 0 }), "LIMIT 0");
    });
    it("error on missing key", () => {
      assert.throws(() => { adapter.getLimitSql({ draw: "2" }) }, Error);
    });
    it("error if number can't be parsed", () => {
      assert.throws(() => { adapter.getLimitSql({ length: "the moon" }) }, Error);
    });
    it("rejects negative, fractional, and permissively parsed lengths", () => {
      for (const length of ['-2', '1.5', '10 rows', '', ' 10', '010', '+1', -2, 1.5, NaN, Infinity, null, true, {}, []])
        assert.throws(() => adapter.getLimitSql({ length }), /non-negative integer/,
                      `should have rejected ${JSON.stringify(length) ?? String(length)}`);
    });
    it("-1 (DataTables' \"all rows\") is the one negative value allowed: LIMIT -1", () => {
      assert.equal(adapter.getLimitSql({ length: "-1" }), "LIMIT -1");
      assert.equal(adapter.getLimitSql({ length: -1 }), "LIMIT -1");
    });
    it("enforces a configured maximum page size", () => {
      assert.equal(capped.getLimitSql({ length: '25' }), 'LIMIT 25');
      assert.throws(() => capped.getLimitSql({ length: '26' }), /maximum page size/);
    });
    it("...and then refuses -1 rather than silently truncating", () => {
      assert.throws(() => capped.getLimitSql({ length: '-1' }), /maximum page size/);
      assert.throws(() => capped.getLimitSql({ length: -1 }), /maximum page size/);
    });
  });

  describe('getOffsetSql', () => {
    it("should handle simple case", () => {
      assert.equal(adapter.getOffsetSql({ start: "20" }), "OFFSET 20");
      assert.equal(adapter.getOffsetSql({ start: 20 }), "OFFSET 20");
    });
    it("error on missing key", () => {
      assert.throws(() => { adapter.getOffsetSql({ draw: "2" }) }, Error);
    });
    it("error if number can't be parsed", () => {
      assert.throws(() => { adapter.getOffsetSql({ length: "the moon" }) }, Error);
    });
    it("rejects negative, fractional, and permissively parsed offsets (no -1 exception here)", () => {
      for (const start of ['-1', '1.5', '10 rows', -1, 1.5])
        assert.throws(() => adapter.getOffsetSql({ start }), /non-negative integer/);
    });
  });

});



/*************************************************************************
  * getSelectClause
  */

describe('getSelectClause', () => {

  describe('getSelectClause', () => {
    it("should handle simple case", () => {
      assert.equal(adapter.getSelectClause({ columns: [{data: "dat 1"},{data: "dat 2"}] }), `SELECT "main"."dat 1", "main"."dat 2"`);
    });
    //  TODO  important
    it("should handle weird characters", () => {
      const example = { columns: [{data: "da`t1"},{data: "dat2"}] };
      assert.equal(adapter.getSelectClause(example), 'SELECT "main"."da`t1", "main"."dat2"');
    });
    it("should handle weird characters", () => {
      const example = { columns: [{data: "`"},{data: "dat2"}] };
      assert.equal(adapter.getSelectClause(example), 'SELECT "main"."`", "main"."dat2"');
    });
    it("this is actually legal in SQLite", () => {
      const example = { columns: [{data: " "},{data: "dat2"}] };
      assert.equal(adapter.getSelectClause(example), 'SELECT "main"." ", "main"."dat2"');
    });
    it("and, incredibly, this is too", () => {
      const example = { columns: [{data: ""},{data: "dat2"}] };
      assert.equal(adapter.getSelectClause(example), 'SELECT "main"."", "main"."dat2"');
    });
    it("and, incredibly, this is too", () => {
      assert.equal(adapter.getSelectClause({ columns: [{data: ""}] }), 'SELECT "main".""');
    });
    //  TODO  switch to more specific errors
    it("???", () => {
      assert.throws(() => { adapter.getLimitSql({ columns: [{data: null}] }) }, Error);
      assert.throws(() => { adapter.getLimitSql({ columns: [{data: []}] }) }, Error);
    });
  });

});



/*************************************************************************
  * getWhereClause
  */

describe('global search', () => {

  describe('respects "searchable" key`', () => {
    it("variant 0", () => {
      const params = { ...exParams };
      params.columns = [...exParams.columns];
      assert.equal(adapter.getGlobalSearchSql(params),
        `(CONCAT("main"."Song title", "main"."Artist name", "main"."Tony's ""Notes""") LIKE '%keep%')`);
    });
    it("variant 1", () => {
      const params = { ...exParams };
      params.columns = [...exParams.columns];
      params.columns[0] =  { "data": "song_id", "name": "", "searchable": "true", "orderable": "true", "search": { "value": "", "regex": "false" } };
      params.columns[4] =  { "data": "γρ'α`φ[έ]ς", "name": "", "searchable": "true", "orderable": "true", "search": { "value": "", "regex": "false" } };
      assert.equal(adapter.getGlobalSearchSql(params),
        `(CONCAT("main"."song_id", "main"."Song title", "main"."Artist name", "main"."Tony's ""Notes""", "` + 'main"."' + "γρ'α`φ[έ]ς" + `") LIKE '%keep%')`);
    });
    it("variant 2", () => {
      const params = { ...exParams };
      params.columns = [...exParams.columns];
      params.columns[4] =  { "data": "γρ'α`φ[έ]ς", "name": "", "searchable": "true", "orderable": "true", "search": { "value": "", "regex": "false" } };
      assert.equal(adapter.getGlobalSearchSql(params),
        `(CONCAT("main"."Song title", "main"."Artist name", "main"."Tony's ""Notes""", "` + 'main"."' + "γρ'α`φ[έ]ς" + `") LIKE '%keep%')`);
    });
  });

  describe('whitespace trimming', () => {
    it("strips ALL leading and trailing whitespace, not just one character", () => {
      const params = { ...exParams, search: { value: "   keep  \t ", regex: "false" } };
      assert.equal(adapter.getGlobalSearchSql(params),
        `(CONCAT("main"."Song title", "main"."Artist name", "main"."Tony's ""Notes""") LIKE '%keep%')`);
    });
  });

  describe('no searchable columns', () => {
    it("matches nothing, mirroring client-side DataTables (and avoids `CONCAT()`)", () => {
      const params = { ...exParams };
      params.columns = exParams.columns.map(c => ({ ...c, searchable: "false" }));
      assert.equal(adapter.getGlobalSearchSql(params), "(False)");
    });
  });

});

describe('full-text global search (getFtGlobalSearchSql)', () => {
  it("quotes the FTS table identifier", () => {
    const params = { search: { value: 'needle', regex: 'false' } };
    assert.equal(adapter.getFtGlobalSearchSql('full text "index"', params),
                 `("full text ""index""" = '"needle"')`);
  });
  it("ignores leading and trailing whitespace runs (only tokens matter)", () => {
    const params = { search: { value: '  needle \t  ', regex: 'false' } };
    assert.equal(adapter.getFtGlobalSearchSql('songs_fts', params),
                 `("songs_fts" = '"needle"')`);
  });
  it("the FTS5 expression is SQL-quoted (an apostrophe survives into the phrase, doubled for SQL)", () => {
    const params = { search: { value: `ol' dirty-bastard "quoted"`, regex: 'false' } };
    assert.equal(adapter.getFtGlobalSearchSql('songs_fts', params),
                 `("songs_fts" = '"ol''" "dirty-bastard" "quoted"')`);
  });
  it("nothing searchable -> matches nothing (never `= ''`)", () => {
    for (const value of ['-', '%', '""', '* *', '()', '^', ':-)', '   '])
      assert.equal(adapter.getFtGlobalSearchSql('songs_fts', { search: { value, regex: 'false' } }), '(False)',
                   `for ${JSON.stringify(value)}`);
  });
});

describe('toFts5Query (search box -> FTS5 query expression)', () => {
  const cases = [
    // plain words and punctuation: every phrase quoted, junk inside is just tokenizer input
    ['keepin',                          '"keepin"'],
    ['ol dirty',                        '"ol" "dirty"'],
    ['100%',                            '"100%"'],
    ['R&B',                             '"R&B"'],
    ['u.s.a',                           '"u.s.a"'],
    ["keepin'",                         `"keepin'"`],
    ['jean-paul',                       '"jean-paul"'],
    ['this \\ that',                    '"this" "that"'],
    ["Robert'); DROP TABLE songs;--",   `"Robert');" "DROP" "TABLE" "songs;--"`],
    ['💯',                              '"💯"'],
    ['ke\u0000ep',                      '"keep"'],
    // prefix
    ['keep*',                           '"keep"*'],
    ['"keep"*',                         '"keep"*'],
    ['"keepin it"*',                    '"keepin it"*'],
    ['keep**',                          '"keep"*'],
    ['keep *',                          '"keep"'],
    ['*69',                             '"*69"'],
    ['kaf*ka',                          '"kaf*ka"'],
    // operators: upper-case, whole word, operand on both sides
    ['bowie OR numan',                  '"bowie" OR "numan"'],
    ['bowie or numan',                  '"bowie" "or" "numan"'],
    ['bowie AND heroes',                '"bowie" AND "heroes"'],
    ['moondogs NOT made',               '"moondogs" NOT "made"'],
    ['a NOT b NOT c',                   '"a" NOT "b" NOT "c"'],
    ['bowie OR',                        '"bowie" "OR"'],
    ['OR bowie',                        '"OR" "bowie"'],
    ['NOT bowie',                       '"NOT" "bowie"'],
    ['bowie OR OR numan',               '"bowie" "OR" OR "numan"'],
    ['a OR NOT b',                      '"a" "OR" NOT "b"'],
    ['OR',                              '"OR"'],
    // column filters
    ['Title:kafka',                     '"Title":"kafka"'],
    ['"Song title":keepin',             '"Song title":"keepin"'],
    ['"Song title":"keepin it"',        '"Song title":"keepin it"'],
    ['Title:"new york"',                '"Title":"new york"'],
    ['Title:^kaf*',                     '"Title":^"kaf"*'],
    ['Title:OR',                        '"Title":"OR"'],
    ['3:16',                            '"3:16"'],
    ['re: foo',                         '"re:" "foo"'],
    ['http://x.y',                      '"http://x.y"'],
    ['Title:',                          '"Title:"'],
    ['Title:%',                         '"Title:%"'],       // `%` can't start a phrase, so no filter
    // first-token anchor
    ['^keepin',                         '^"keepin"'],
    ['^"keepin it"',                    '^"keepin it"'],
    ['2^3',                             '"2^3"'],
    // grouping (FTS5 needs an explicit AND next to a group)
    ['(bowie OR numan) electric',       '("bowie" OR "numan") AND "electric"'],
    ['electric (bowie OR numan)',       '"electric" AND ("bowie" OR "numan")'],
    ['(a) (b)',                         '("a") AND ("b")'],
    ['((bowie OR numan) AND electric) OR moondogs', '(("bowie" OR "numan") AND "electric") OR "moondogs"'],
    ['(bowie OR numan',                 '"(bowie" OR "numan"'],
    ['bowie OR numan)',                 '"bowie" OR "numan)"'],
    ['()',                              ''],
    ['(OR)',                            '"OR"'],
    ['(bowie OR) numan',                '("bowie" "OR") AND "numan"'],
    ['a (OR b)',                        '"a" AND ("OR" "b")'],
    // quotes
    ['"ol dirty"',                      '"ol dirty"'],
    ['"ol dirty',                       '"ol dirty"'],
    ['say ""hi""',                      '"say" "hi"'],
    ['"a ""quoted"" word"',             '"a ""quoted"" word"'],
    // NFC in, NFD out
    ['café',                       '"café"'],
  ];
  for (const [input, expected] of cases) {
    it(`${JSON.stringify(input)} -> ${JSON.stringify(expected)}`, () => {
      assert.equal(toFts5Query(input), expected);
    });
  }
  it("parentheses nested past the cap are just characters", () => {
    const deep = '('.repeat(40) + 'bowie' + ')'.repeat(40);
    assert.equal(toFts5Query(deep), `"${deep}"`);
  });
});

describe('Search builder criteria', () => {

  /**** strings AND numbers */
  describe('getSBEqualsSql', () => {
    /* also showcases the conversion to NFD unicode form */
    it("should handle simple case (string)", () => {
      const exs = { "condition": "=", "data": "Title", "origData": "Title", "type": "string", "value": [ "El sueño..." ], "value1": "El sueño..." };
      assert.equal(adapter.getSBCriterionSql(exs), `("main"."Title" = 'El sueño...')`);
    });
    it("should handle simple case (number)", () => {
      const exn = { "condition": "=", "data": "ObjectID", "origData": "ObjectID", "type": "num", "value": [ "1" ], "value1": "1" };
      assert.equal(adapter.getSBCriterionSql(exn), `("main"."ObjectID" = 1)`);
    });
    it("error if number can't be parsed", () => {
      const exn = { "condition": "=", "data": "ObjectID", "origData": "ObjectID", "type": "num", "value": [ "one" ], "value1": "one" };
      assert.throws(() => { adapter.getSBCriterionSql(exn) }, Error);
    });
    it("should handle simple negative case (string)", () => {
      const exs = { "condition": "!=", "data": "Title", "origData": "Title", "type": "string", "value": [ "El sueño..." ], "value1": "El sueño..." };
      assert.equal(adapter.getSBCriterionSql(exs), `(NOT ("main"."Title" = 'El sueño...'))`);
    });
    it("should handle simple negative case (number)", () => {
      const exn = { "condition": "!=", "data": "ObjectID", "origData": "ObjectID", "type": "num", "value": [ "1" ], "value1": "1" };
      assert.equal(adapter.getSBCriterionSql(exn), `(NOT ("main"."ObjectID" = 1))`);
    });
    it("error if number can't be parsed", () => {
      const exn = { "condition": "!=", "data": "ObjectID", "origData": "ObjectID", "type": "num", "value": [ "one" ], "value1": "one" };
      assert.throws(() => { adapter.getSBCriterionSql(exn) }, Error);
    });
  });

  describe('getSBEmptySql', () => {
    it("should handle simple case (string)", () => {
      const exs = { "condition": "null", "data": "Title", "origData": "Title", "type": "string" };
      assert.equal(adapter.getSBCriterionSql(exs), `(("main"."Title" IS NULL) OR ("main"."Title" = ''))`);
    });
    //  NOTE  in SQLite, you can search for a number using a string
    //        but let's have different tests for other DBs (eventually)
    it("should handle simple case (number)", () => {
      const exn = { "condition": "null", "data": "Object ID", "origData": "ObjectID", "type": "num" };
      assert.equal(adapter.getSBCriterionSql(exn), `(("main"."ObjectID" IS NULL) OR ("main"."ObjectID" = ''))`);
    });
    it("should handle simple negative case (string)", () => {
      const exs = { "condition": "!null", "data": "Title", "origData": "Title", "type": "string" };
      assert.equal(adapter.getSBCriterionSql(exs), `(NOT (("main"."Title" IS NULL) OR ("main"."Title" = '')))`);
    });
    it("should handle simple negative case (number)", () => {
      const exn = { "condition": "!null", "data": "Object ID", "origData": "ObjectID", "type": "num" };
      assert.equal(adapter.getSBCriterionSql(exn), `(NOT (("main"."ObjectID" IS NULL) OR ("main"."ObjectID" = '')))`);
    });
  });

  /**** just strings */
  describe('getSBContainsSql', () => {
    it("should handle simple case", () => {
      const exs = { "condition": "contains", "data": "Title", "origData": "Title", "type": "string", "value": [ "robot boy" ], "value1": "robot boy" };
      assert.equal(adapter.getSBCriterionSql(exs), `("main"."Title" LIKE '%robot boy%')`);
    });
  });

  describe('!getSBContainsSql', () => {
    it("should handle simple case", () => {
      const exs = { "condition": "!contains", "data": "Title", "origData": "Title", "type": "string", "value": [ "robot boy" ], "value1": "robot boy" };
      assert.equal(adapter.getSBCriterionSql(exs), `(NOT ("main"."Title" LIKE '%robot boy%'))`);
    });
  });

  describe('getSBStartsWithSql', () => {
    it("should handle simple case", () => {
      const exs = { "condition": "starts", "data": "Title", "origData": "Title", "type": "string", "value": [ "gold star for" ], "value1": "gold star for" };
      assert.equal(adapter.getSBCriterionSql(exs), `("main"."Title" LIKE 'gold star for%')`);
    });
  });

  describe('!getSBStartsWithSql', () => {
    it("should handle simple case", () => {
      const exs = { "condition": "!starts", "data": "Title", "origData": "Title", "type": "string", "value": [ "gold star for" ], "value1": "gold star for" };
      assert.equal(adapter.getSBCriterionSql(exs), `(NOT ("main"."Title" LIKE 'gold star for%'))`);
    });
  });

  describe('getSBEndsWithSql', () => {
    it("should handle simple case", () => {
      const exs = { "condition": "ends", "data": "Title", "origData": "Title", "type": "string", "value": [ "robot boy" ], "value1": "robot boy" };
      assert.equal(adapter.getSBCriterionSql(exs), `("main"."Title" LIKE '%robot boy')`);
    });
  });

  describe('!getSBEndsWithSql', () => {
    it("should handle simple case", () => {
      const exs = { "condition": "!ends", "data": "Title", "origData": "Title", "type": "string", "value": [ "robot boy" ], "value1": "robot boy" };
      assert.equal(adapter.getSBCriterionSql(exs), `(NOT ("main"."Title" LIKE '%robot boy'))`);
    });
  });

  /**** just numbers */
  describe('getSBLessThan (and less than or equal to)', () => {
    it("should handle less than", () => {
      const ex = { "condition": "<", "data": "Object ID", "origData": "ObjectID", "type": "num", "value": [ "1" ], "value1": "1" };
      assert.equal(adapter.getSBCriterionSql(ex), `("main"."ObjectID" < 1)`);
    });
    it("should handle less than or equal to", () => {
      const ex = { "condition": "<=", "data": "Object ID", "origData": "ObjectID", "type": "num", "value": [ "1" ], "value1": "1" };
      assert.equal(adapter.getSBCriterionSql(ex), `("main"."ObjectID" <= 1)`);
    });
    it("error if number can't be parsed", () => {
      const exn = { "condition": "<=", "data": "ObjectID", "origData": "ObjectID", "type": "num", "value": [ "one" ], "value1": "one" };
      assert.throws(() => { adapter.getSBCriterionSql(exn) }, Error);
    });
  });

  describe('getSBGreaterThan (and greater than or equal to)', () => {
    it("should handle greater than", () => {
      const ex = { "condition": ">", "data": "Object ID", "origData": "ObjectID", "type": "num", "value": [ "1" ], "value1": "1" };
      assert.equal(adapter.getSBCriterionSql(ex), `("main"."ObjectID" > 1)`);
    });
    it("should handle greater than or equal to", () => {
      const ex = { "condition": ">=", "data": "Object ID", "origData": "ObjectID", "type": "num", "value": [ "1" ], "value1": "1" };
      assert.equal(adapter.getSBCriterionSql(ex), `("main"."ObjectID" >= 1)`);
    });
    it("error if number can't be parsed", () => {
      const exn = { "condition": ">=", "data": "ObjectID", "origData": "ObjectID", "type": "num", "value": [ "one" ], "value1": "one" };
      assert.throws(() => { adapter.getSBCriterionSql(exn) }, Error);
    });
  });

  describe('getSBBetweenSql', () => {
    it("should handle simple case", () => {
      const ex = { "condition": "between", "data": "Object ID", "origData": "ObjectID", "type": "num", "value": [ "1", "3" ], "value1": "1", "value2": "3" };
      assert.equal(adapter.getSBCriterionSql(ex), `("main"."ObjectID" BETWEEN 1 AND 3)`);
    });
    it("should handle simple negative case", () => {
      const ex = { "condition": "!between", "data": "Object ID", "origData": "ObjectID", "type": "num", "value": [ "1", "3" ], "value1": "1", "value2": "3" };
      assert.equal(adapter.getSBCriterionSql(ex), `(NOT ("main"."ObjectID" BETWEEN 1 AND 3))`);
    });
    it("error if FIRST number can't be parsed", () => {
      const ex = { "condition": "!between", "data": "Object ID", "origData": "ObjectID", "type": "num", "value": [ "one", "3" ], "value1": "one", "value2": "3" };
      assert.throws(() => { adapter.getSBCriterionSql(ex) }, Error);
    });
    it("error if SECOND number can't be parsed", () => {
      const ex = { "condition": "!between", "data": "Object ID", "origData": "ObjectID", "type": "num", "value": [ "1", "three" ], "value1": "1", "value2": "three" };
      assert.throws(() => { adapter.getSBCriterionSql(ex) }, Error);
    });
  });

  describe('error on unrecognized conditions', () => {
    it("error on unrecognized condition", () => {
      const ex = { "condition": "==", "data": "Title", "origData": "Title", "type": "string", "value": [ "El sueño..." ], "value1": "El sueño..." };
      assert.throws(() => { adapter.getSBCriterionSql(ex) }, Error);
    });
  });

  describe('incomplete criteria', () => {
    it("an empty criterion (unfilled SearchBuilder row) matches everything", () => {
      assert.equal(adapter.getSBCriterionSql({ "type": "" }), "(True = True)");
    });
    it("error when a criterion has a value but no condition (must not fail open)", () => {
      const ex = { "data": "Title", "origData": "Title", "type": "string", "value": [ "x" ], "value1": "x" };
      assert.throws(() => { adapter.getSBCriterionSql(ex) }, Error);
    });
  });
});



describe('getSearchBuilderSql', () => {

  describe('handle single criterion', () => {
    it("AND logic", () => {
      const ex = { "criteria": [ { "condition": "contains", "data": "Title", "origData": "Title", "type": "string", "value": [ "q" ], "value1": "q" } ], "logic": "AND" };
      assert.equal(adapter.getSearchBuilderSql(ex), `(("main"."Title" LIKE '%q%') AND True)`);
    });
    it("OR logic", () => {
      const ex = { "criteria": [ { "condition": "contains", "data": "Title", "origData": "Title", "type": "string", "value": [ "q" ], "value1": "q" } ], "logic": "OR" };
      assert.equal(adapter.getSearchBuilderSql(ex), `(("main"."Title" LIKE '%q%') OR False)`);
    });
  });

  describe('handle empty criteria', () => {
    it("an empty criteria array filters nothing (and is not a syntax error)", () => {
      assert.equal(adapter.getSearchBuilderSql({ "criteria": [], "logic": "AND" }), "(True AND True)");
      assert.equal(adapter.getSearchBuilderSql({ "criteria": [], "logic": "OR" }), "(True AND True)");
    });
    it("missing criteria behaves the same", () => {
      assert.equal(adapter.getSearchBuilderSql({ "logic": "AND" }), "(True AND True)");
    });
  });

  describe('handle multiple criteria (2nd level)', () => {
    const ex = { "criteria": [ { "condition": "=", "data": "Department", "origData": "Department", "type": "string", "value": [ "english" ], "value1": "english" }, { "condition": "contains", "data": "Title", "origData": "Title", "type": "string", "value": [ "bovary" ], "value1": "bovary" } ], };
    it("AND logic", () => {
      assert.equal(adapter.getSearchBuilderSql({logic: "AND", ...ex}), `(("main"."Department" = 'english') AND ("main"."Title" LIKE '%bovary%'))`);
    });
    it("OR logic", () => {
      assert.equal(adapter.getSearchBuilderSql({logic: "OR", ...ex}), `(("main"."Department" = 'english') OR ("main"."Title" LIKE '%bovary%'))`);
    });
  });

  //  TODO  FAILING  TEST!
  describe('handle nested criteria (3rd level)', () => {
    it("Outer OR, inner ANDs", () => {
      const nested = { "criteria": [ { "criteria": [ { "condition": "=", "data": "Department", "origData": "Department", "type": "string", "value": { "[]": "Photography" }, "value1": "Photography" }, { "condition": "=", "data": "Last Name", "origData": "LastName", "type": "string", "value": { "[]": "Goldin" }, "value1": "Goldin" } ], "logic": "AND" }, { "criteria": [ { "condition": "=", "data": "Department", "origData": "Department", "type": "string", "value": { "[]": "Print" }, "value1": "Print" }, { "condition": "=", "data": "Last Name", "origData": "LastName", "type": "string", "value": { "[]": "Goya" }, "value1": "Goya" } ], "logic": "AND" } ], "logic": "OR" };
      assert.equal(adapter.getSearchBuilderSql(nested), `((("main"."Department" = 'Photography') AND ("main"."LastName" = 'Goldin')) OR (("main"."Department" = 'Print') AND ("main"."LastName" = 'Goya')))`);
    });
    it("Outer OR, ONE inner AND", () => {
      const nested = { "criteria": [ { "criteria": [ { "condition": "=", "data": "Department", "origData": "Department", "type": "string", "value": { "[]": "english" }, "value1": "english" }, { "condition": "contains", "data": "Title", "origData": "Title", "type": "string", "value": { "[]": "spanish" }, "value1": "spanish" } ], "logic": "AND" }, { "condition": "=", "data": "Department", "origData": "Department", "type": "string", "value": [ "spanish" ], "value1": "spanish" } ], "logic": "OR" };
      assert.equal(adapter.getSearchBuilderSql(nested), `((("main"."Department" = 'english') AND ("main"."Title" LIKE '%spanish%')) OR ("main"."Department" = 'spanish'))`);
    });
    it("Outer AND, ONE inner OR", () => {
      const nested = { "criteria": [ { "criteria": [ { "condition": "=", "data": "Department", "origData": "Department", "type": "string", "value": { "[]": "english" }, "value1": "english" }, { "condition": "contains", "data": "Title", "origData": "Title", "type": "string", "value": { "[]": "spanish" }, "value1": "spanish" } ], "logic": "OR" }, { "condition": "=", "data": "Department", "origData": "Department", "type": "string", "value": [ "spanish" ], "value1": "spanish" } ], "logic": "AND" };
      assert.equal(adapter.getSearchBuilderSql(nested), `((("main"."Department" = 'english') OR ("main"."Title" LIKE '%spanish%')) AND ("main"."Department" = 'spanish'))`);
    });

    it("handle nested nested criteria (flattened past qs's depth limit)", () => {
      // if ('[0][condition]' in req.query?.searchBuilder.criteria[0].criteria[0].criteria) ...
      const nested = {
        "criteria": [
          {
            "criteria": [
              {
                "criteria": {
                  "[0][condition]": "=",
                  "[0][data]": "Object ID",
                  "[0][origData]": "ObjectID",
                  "[0][type]": "num",
                  "[0][value][]": "1",
                  "[0][value1]": "1",
                  "[1][condition]": "=",
                  "[1][data]": "Title",
                  "[1][origData]": "Title",
                  "[1][type]": "string",
                  "[1][value][]": "test",
                  "[1][value1]": "test"
                },
                "logic": "AND"
              },
              {
                "condition": "=",
                "data": "Department",
                "origData": "Department",
                "type": "string",
                "value": {
                  "[]": "testdep"
                },
                "value1": "testdep"
              }
            ],
            "logic": "OR"
          },
          {
            "condition": "=",
            "data": "Title",
            "origData": "Title",
            "type": "string",
            "value": [
              "test"
            ],
            "value1": "test"
          }
        ],
        "logic": "AND"
      };
      const healed = healSearchBuilderTree(nested);
      assert.equal(adapter.getSearchBuilderSql(healed), `(((("main"."ObjectID" = 1) AND ("main"."Title" = 'test')) OR ("main"."Department" = 'testdep')) AND ("main"."Title" = 'test'))`);
      // ...and the input is untouched: the deepest group still holds the flattened keys
      assert.ok('[0][condition]' in nested.criteria[0].criteria[0].criteria);
    });
  });
});


describe('healSearchBuilderTree', () => {
  it("returns a new tree and leaves the input alone", () => {
    const input = { logic: 'AND', criteria: { 0: { logic: 'OR', criteria: { 0: { type: '' }, 1: { type: '' } } }, 1: { type: '' } } };
    const before = JSON.stringify(input);
    const healed = healSearchBuilderTree(input);
    assert.notStrictEqual(healed, input);
    assert.ok(Array.isArray(healed.criteria));
    assert.ok(Array.isArray(healed.criteria[0].criteria));
    assert.equal(healed.criteria[0].criteria.length, 2);
    assert.equal(JSON.stringify(input), before);
  });
  it("passes through things that aren't groups (criteria, non-objects)", () => {
    const criterion = { type: '' };
    assert.strictEqual(healSearchBuilderTree(criterion), criterion);
    assert.strictEqual(healSearchBuilderTree('nope'), 'nope');
    assert.strictEqual(healSearchBuilderTree(null), null);
    assert.strictEqual(healSearchBuilderTree(undefined), undefined);
  });
  it("leaves non-object criteria for the validator (no Object.keys surprises)", () => {
    assert.deepEqual(healSearchBuilderTree({ logic: 'AND', criteria: 'abc' }), { logic: 'AND', criteria: 'abc' });
    assert.deepEqual(healSearchBuilderTree({ logic: 'AND', criteria: 5 }), { logic: 'AND', criteria: 5 });
  });
});


describe('unflattenBracketKeys', () => {
  it("unflattens what qs leaves behind past its depth limit", () => {
    const flat = {
      "[0][condition]": "=",
      "[0][data]": "Object ID",
      "[0][origData]": "ObjectID",
      "[0][type]": "num",
      "[0][value][]": "1",
      "[0][value1]": "1",
      "[1][condition]": "null",
      "[1][origData]": "Title",
      "[1][type]": "string"
    };
    assert.deepEqual(unflattenBracketKeys(flat), [
      { condition: "=", data: "Object ID", origData: "ObjectID",
        type: "num", value: ["1"], value1: "1" },
      { condition: "null", origData: "Title", type: "string" }
    ]);
  });
  it("handles arbitrarily deep remainders (groups within the remainder)", () => {
    const flat = {
      "[0][criteria][0][condition]": "=",
      "[0][criteria][0][origData]": "song_id",
      "[0][criteria][0][type]": "num",
      "[0][criteria][0][value1]": "1",
      "[0][logic]": "AND",
      "[1][condition]": "null",
      "[1][origData]": "Title",
      "[1][type]": "string"
    };
    assert.deepEqual(unflattenBracketKeys(flat), [
      { criteria: [ { condition: "=", origData: "song_id",
                      type: "num", value1: "1" } ],
        logic: "AND" },
      { condition: "null", origData: "Title", type: "string" }
    ]);
  });
});


/*************************************************************************
  * getOrderByClause
  */

describe('getOrderByClause', () => {

  describe('direction', () => {
    it("accepts asc and desc (and emits only the literals)", () => {
      const params = { columns: [{ data: 'song_id' }], order: [{ column: 0, dir: 'asc' }] };
      assert.equal(adapter.getOrderByClause(params), 'ORDER BY "main"."song_id" ASC NULLS LAST');
      params.order[0].dir = 'desc';
      assert.equal(adapter.getOrderByClause(params), 'ORDER BY "main"."song_id" DESC NULLS LAST');
    });
    it("rejects an untrusted direction instead of interpolating it", () => {
      for (const dir of ['ASC, random()', 'asc; DROP TABLE songs', 'ASC', '', undefined, 1, {}]) {
        const params = { columns: [{ data: 'song_id' }], order: [{ column: 0, dir }] };
        assert.throws(() => adapter.getOrderByClause(params), /order direction/);
      }
    });
    it("no order directives -> no ORDER BY clause", () => {
      assert.equal(adapter.getOrderByClause({ columns: [{ data: 'song_id' }] }), '');
      assert.equal(adapter.getOrderByClause({ columns: [{ data: 'song_id' }], order: [] }), '');
    });
  });

  describe('column index', () => {
    const twoCols = [{ data: 'song_id' }, { data: 'Song title' }];
    it("accepts a numeric string (GET) or a number (JSON)", () => {
      assert.equal(adapter.getOrderByClause({ columns: twoCols, order: [{ column: '1', dir: 'asc' }] }),
                   'ORDER BY "main"."Song title" ASC NULLS LAST');
      assert.equal(adapter.getOrderByClause({ columns: twoCols, order: [{ column: 1, dir: 'asc' }] }),
                   'ORDER BY "main"."Song title" ASC NULLS LAST');
    });
    it("several directives", () => {
      assert.equal(adapter.getOrderByClause({ columns: twoCols, order: [{ column: '1', dir: 'desc' }, { column: 0, dir: 'asc' }] }),
                   'ORDER BY "main"."Song title" DESC, "main"."song_id" ASC NULLS LAST');
    });
    for (const column of [-1, 2, '2', 1.5, '1.5', '01', '1x', '', ' 1', {}, [], null, undefined, Number.MAX_VALUE, NaN, 'constructor']) {
      it(`rejects an invalid or out-of-range index: ${JSON.stringify(column) ?? String(column)}`, () => {
        assert.throws(() => adapter.getOrderByClause({ columns: twoCols, order: [{ column, dir: 'asc' }] }),
                      /order column/);
      });
    }
  });

});


describe('getWhereClause', () => {

  describe('simple cases', () => {
    it("both search AND searchBuilder", () => {
      const ex_simple1 = { draw: '2', columns: [ { data: 'Department', name: '', searchable: 'true', orderable: 'false' }, { data: 'Title', name: '', searchable: 'true', orderable: 'false' } ], search: { value: "global", regex: 'false' }, searchBuilder: { "criteria": [ { "condition": "contains", "data": "Title", "origData": "Title", "type": "string", "value": [ "q" ], "value1": "q" } ], "logic": "AND" }, start: '0', length: '30', _: '1727689860063' };
      assert.equal(adapter.getWhereClause(ex_simple1), `WHERE ((("main"."Title" LIKE '%q%') AND True) AND (CONCAT("main"."Department", "main"."Title") LIKE '%global%'))`);
    });
    it("both search AND searchBuilder (with more excluded columns)", () => {
      const ex_simple1 = { draw: '2', columns: [ { data: 'Department', name: '', searchable: 'true', orderable: 'false' }, { data: 'Title', name: '', searchable: 'false', orderable: 'false' } ], search: { value: "global", regex: 'false' }, searchBuilder: { "criteria": [ { "condition": "contains", "data": "Title", "origData": "Title", "type": "string", "value": [ "q" ], "value1": "q" } ], "logic": "AND" }, start: '0', length: '30', _: '1727689860063' };
      assert.equal(adapter.getWhereClause(ex_simple1), `WHERE ((("main"."Title" LIKE '%q%') AND True) AND (CONCAT("main"."Department") LIKE '%global%'))`);
    });
    it("only globalSearch", () => {
      const ex_simple1 = { draw: '2', columns: [ { data: 'Department', name: '', searchable: 'true', orderable: 'false' }, { data: 'Title', name: '', searchable: 'true', orderable: 'false' } ], search: { value: "global", regex: 'false' }, start: '0', length: '30', _: '1727689860063' };
      assert.equal(adapter.getWhereClause(ex_simple1), `WHERE (True AND (CONCAT("main"."Department", "main"."Title") LIKE '%global%'))`);
    });

    it("only globalSearch does away with whitespace by default", () => {
      const ex_simple1 = { draw: '2', columns: [ { data: 'Department', name: '', searchable: 'true', orderable: 'false' }, { data: 'Title', name: '', searchable: 'true', orderable: 'false' } ], search: { value: " global ", regex: 'false' }, start: '0', length: '30', _: '1727689860063' };
      assert.equal(adapter.getWhereClause(ex_simple1), `WHERE (True AND (CONCAT("main"."Department", "main"."Title") LIKE '%global%'))`);
    });
    it("only globalSearch (leading whitespace)", () => {
      const ex_simple1 = { draw: '2', columns: [ { data: 'Department', name: '', searchable: 'true', orderable: 'false' }, { data: 'Title', name: '', searchable: 'true', orderable: 'false' } ], search: { value: " global ", regex: 'false' }, start: '0', length: '30', _: '1727689860063' };
      assert.equal(configVariant1.getWhereClause(ex_simple1), `WHERE (True AND (CONCAT("main"."Department", "main"."Title") LIKE '% global%'))`);
    });
    it("only globalSearch (trailing whitespace)", () => {
      const ex_simple1 = { draw: '2', columns: [ { data: 'Department', name: '', searchable: 'true', orderable: 'false' }, { data: 'Title', name: '', searchable: 'true', orderable: 'false' } ], search: { value: " global ", regex: 'false' }, start: '0', length: '30', _: '1727689860063' };
      assert.equal(configVariant2.getWhereClause(ex_simple1), `WHERE (True AND (CONCAT("main"."Department", "main"."Title") LIKE '%global %'))`);
    });
    it("only searchBuilder", () => {
      const ex_simple1 = { draw: '2', columns: [ { data: 'Department', name: '', searchable: 'true', orderable: 'false' }, { data: 'Title', name: '', searchable: 'true', orderable: 'false' } ], searchBuilder: { "criteria": [ { "condition": "contains", "data": "Title", "origData": "Title", "type": "string", "value": [ "q" ], "value1": "q" } ], "logic": "AND" }, start: '0', length: '30', _: '1727689860063' };
      assert.equal(adapter.getWhereClause(ex_simple1), `WHERE ((("main"."Title" LIKE '%q%') AND True) AND True)`);
    });
    //  TODO  should search handler different opts
    it("neither", () => {
      const ex_simple1 = { draw: '2', columns: [ { data: 'Department', name: '', searchable: 'true', orderable: 'false' }, { data: 'Title', name: '', searchable: 'true', orderable: 'false' } ], start: '0', length: '30', _: '1727689860063' };
      assert.equal(adapter.getWhereClause(ex_simple1), "WHERE (True AND True)");
    });
  });

  //  TODO  MORE!
  //  TODO  MORE!

});

