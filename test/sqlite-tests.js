
import assert from 'assert';
import BetterSqlite3 from 'better-sqlite3';
import SQLiteAdapter from '../dist/adapters/SQLiteAdapter.js';


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

  //  TODO  expand on this!!!
  describe('all escaping (DB)', () => {
    const q = `SELECT * FROM songs WHERE ((${adapter.escapeID("Song title")} LIKE '%${adapter.escapeForLIKE("\\").str}%') OR (${adapter.escapeID("Song title")} LIKE '%${adapter.escapeForLIKE("%").str}%' ESCAPE '${adapter.escapeForLIKE("%").escape}') OR (${adapter.escapeID("Song title")}='${adapter.escapeString("Robert'); DROP TABLE songs;--")}'))`;
    assert.equal(q, `SELECT * FROM songs WHERE (("Song title" LIKE '%\\%') OR ("Song title" LIKE '%\\%%' ESCAPE '\\') OR ("Song title"='Robert''); DROP TABLE songs;--'))`);
  });

});



/*************************************************************************
  * LIMITs and OFFSETs
  */

describe('limits and offsets', () => {

  describe('getLimitSql', () => {
    it("should handle simple case", () => {
      assert.equal(adapter.getLimitSql({ length: "20" }), "LIMIT 20");
    });
    it("error on missing key", () => {
      assert.throws(() => { adapter.getLimitSql({ draw: "2" }) }, Error);
    });
    it("error if number can't be parsed", () => {
      assert.throws(() => { adapter.getLimitSql({ length: "the moon" }) }, Error);
    });
  });

  describe('getOffsetSql', () => {
    it("should handle simple case", () => {
      assert.equal(adapter.getOffsetSql({ start: "20" }), "OFFSET 20");
    });
    it("error on missing key", () => {
      assert.throws(() => { adapter.getOffsetSql({ draw: "2" }) }, Error);
    });
    it("error if number can't be parsed", () => {
      assert.throws(() => { adapter.getOffsetSql({ length: "the moon" }) }, Error);
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

});

describe('Search builder criteria', () => {

  /**** strings AND numbers */
  describe('getSBEqualsSql', () => {
    it("should handle simple case (string)", () => {
      const exs = { "condition": "=", "data": "Title", "origData": "Title", "type": "string", "value": [ "El sueño..." ], "value1": "El sueño..." };
      assert.equal(adapter.getSBCriterionSql(exs), `("main"."Title" = 'El sueño...')`);
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
      assert.equal(adapter.getSBCriterionSql(exs), `(NOT ("main"."Title" = 'El sueño...'))`);
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

    it("handle nested nested criteria", () => {
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
      //assert.equal(getSearchBuilderSql(nested), "((((ObjectID = 1) AND (Title = 'test')) OR (Department = 'testdep')) AND (Title = 'test'))");
    });
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

