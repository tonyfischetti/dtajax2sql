
import assert from 'assert';

import BetterSqlite3 from 'better-sqlite3';

import { returnOkEscapeCharacter, escapeID, escapeString,
          escapeForLIKE }
  from '../dist/sanitization.js';

import {
  getSelectClause,
  getLimitSql,
  getOffsetSql,
  getSBCriterionSql,
  getSearchBuilderSql,
  getWhereClause,
} from '../dist/getSqlFragments.js';

import { dtajax2sql } from '../dist/dtajax2sql.js';


/**************************************************************************/

const DB = new BetterSqlite3("./test/music.db", {
  readonly: true,
  fileMustExist: true
});


/**************************************************************************/




/**************************************************************************/

describe('limits and offsets', () => {

  describe('getLimitSql', () => {
    it("should handle simple case", () => {
      assert.equal(getLimitSql({ length: "20" }), "LIMIT 20");
    });
    it("error on missing key", () => {
      assert.throws(() => { getLimitSql({ draw: "2" }) }, Error);
    });
    it("error if number can't be parsed", () => {
      assert.throws(() => { getLimitSql({ length: "the moon" }) }, Error);
    });
  });

  describe('getOffsetSql', () => {
    it("should handle simple case", () => {
      assert.equal(getOffsetSql({ start: "20" }), "OFFSET 20");
    });
    it("error on missing key", () => {
      assert.throws(() => { getOffsetSql({ draw: "2" }) }, Error);
    });
    it("error if number can't be parsed", () => {
      assert.throws(() => { getOffsetSql({ length: "the moon" }) }, Error);
    });
  });

});

/**************************************************************************/

describe('Search builder criteria', () => {

  /**** strings AND numbers */
  describe('getSBEqualsSql', () => {
    it("should handle simple case (string)", () => {
      const exs = { "condition": "=", "data": "Title", "origData": "Title", "type": "string", "value": [ "El sueño..." ], "value1": "El sueño..." };
      assert.equal(getSBCriterionSql(exs), `("Title" = 'El sueño...')`);
    });
    it("should handle simple case (number)", () => {
      const exn = { "condition": "=", "data": "ObjectID", "origData": "ObjectID", "type": "num", "value": [ "1" ], "value1": "1" };
      assert.equal(getSBCriterionSql(exn), `("ObjectID" = 1)`);
    });
    it("error if number can't be parsed", () => {
      const exn = { "condition": "=", "data": "ObjectID", "origData": "ObjectID", "type": "num", "value": [ "one" ], "value1": "one" };
      assert.throws(() => { getSBCriterionSql(exn) }, Error);
    });
    it("should handle simple negative case (string)", () => {
      const exs = { "condition": "!=", "data": "Title", "origData": "Title", "type": "string", "value": [ "El sueño..." ], "value1": "El sueño..." };
      assert.equal(getSBCriterionSql(exs), `(NOT ("Title" = 'El sueño...'))`);
    });
    it("should handle simple negative case (number)", () => {
      const exn = { "condition": "!=", "data": "ObjectID", "origData": "ObjectID", "type": "num", "value": [ "1" ], "value1": "1" };
      assert.equal(getSBCriterionSql(exn), `(NOT ("ObjectID" = 1))`);
    });
    it("error if number can't be parsed", () => {
      const exn = { "condition": "!=", "data": "ObjectID", "origData": "ObjectID", "type": "num", "value": [ "one" ], "value1": "one" };
      assert.throws(() => { getSBCriterionSql(exn) }, Error);
    });
  });

  describe('getSBEmptySql', () => {
    it("should handle simple case (string)", () => {
      const exs = { "condition": "null", "data": "Title", "origData": "Title", "type": "string" };
      assert.equal(getSBCriterionSql(exs), `(("Title" IS NULL) OR ("Title" = ''))`);
    });
    //  NOTE  in SQLite, you can search for a number using a string
    //        but let's have different tests for other DBs (eventually)
    it("should handle simple case (number)", () => {
      const exn = { "condition": "null", "data": "Object ID", "origData": "ObjectID", "type": "num" };
      assert.equal(getSBCriterionSql(exn), `(("ObjectID" IS NULL) OR ("ObjectID" = ''))`);
    });
    it("should handle simple negative case (string)", () => {
      const exs = { "condition": "!null", "data": "Title", "origData": "Title", "type": "string" };
      assert.equal(getSBCriterionSql(exs), `(NOT (("Title" IS NULL) OR ("Title" = '')))`);
    });
    it("should handle simple negative case (number)", () => {
      const exn = { "condition": "!null", "data": "Object ID", "origData": "ObjectID", "type": "num" };
      assert.equal(getSBCriterionSql(exn), `(NOT (("ObjectID" IS NULL) OR ("ObjectID" = '')))`);
    });
  });

  /**** just strings */
  describe('getSBContainsSql', () => {
    it("should handle simple case", () => {
      const exs = { "condition": "contains", "data": "Title", "origData": "Title", "type": "string", "value": [ "robot boy" ], "value1": "robot boy" };
      assert.equal(getSBCriterionSql(exs), `("Title" LIKE '%robot boy%')`);
    });
  });

  describe('!getSBContainsSql', () => {
    it("should handle simple case", () => {
      const exs = { "condition": "!contains", "data": "Title", "origData": "Title", "type": "string", "value": [ "robot boy" ], "value1": "robot boy" };
      assert.equal(getSBCriterionSql(exs), `(NOT ("Title" LIKE '%robot boy%'))`);
    });
  });

  describe('getSBStartsWithSql', () => {
    it("should handle simple case", () => {
      const exs = { "condition": "starts", "data": "Title", "origData": "Title", "type": "string", "value": [ "gold star for" ], "value1": "gold star for" };
      assert.equal(getSBCriterionSql(exs), `("Title" LIKE 'gold star for%')`);
    });
  });

  describe('!getSBStartsWithSql', () => {
    it("should handle simple case", () => {
      const exs = { "condition": "!starts", "data": "Title", "origData": "Title", "type": "string", "value": [ "gold star for" ], "value1": "gold star for" };
      assert.equal(getSBCriterionSql(exs), `(NOT ("Title" LIKE 'gold star for%'))`);
    });
  });

  describe('getSBEndsWithSql', () => {
    it("should handle simple case", () => {
      const exs = { "condition": "ends", "data": "Title", "origData": "Title", "type": "string", "value": [ "robot boy" ], "value1": "robot boy" };
      assert.equal(getSBCriterionSql(exs), `("Title" LIKE '%robot boy')`);
    });
  });

  describe('!getSBEndsWithSql', () => {
    it("should handle simple case", () => {
      const exs = { "condition": "!ends", "data": "Title", "origData": "Title", "type": "string", "value": [ "robot boy" ], "value1": "robot boy" };
      assert.equal(getSBCriterionSql(exs), `(NOT ("Title" LIKE '%robot boy'))`);
    });
  });

  /**** just numbers */
  describe('getSBLessThan (and less than or equal to)', () => {
    it("should handle less than", () => {
      const ex = { "condition": "<", "data": "Object ID", "origData": "ObjectID", "type": "num", "value": [ "1" ], "value1": "1" };
      assert.equal(getSBCriterionSql(ex), `("ObjectID" < 1)`);
    });
    it("should handle less than or equal to", () => {
      const ex = { "condition": "<=", "data": "Object ID", "origData": "ObjectID", "type": "num", "value": [ "1" ], "value1": "1" };
      assert.equal(getSBCriterionSql(ex), `("ObjectID" <= 1)`);
    });
    it("error if number can't be parsed", () => {
      const exn = { "condition": "<=", "data": "ObjectID", "origData": "ObjectID", "type": "num", "value": [ "one" ], "value1": "one" };
      assert.throws(() => { getSBCriterionSql(exn) }, Error);
    });
  });

  describe('getSBGreaterThan (and greater than or equal to)', () => {
    it("should handle greater than", () => {
      const ex = { "condition": ">", "data": "Object ID", "origData": "ObjectID", "type": "num", "value": [ "1" ], "value1": "1" };
      assert.equal(getSBCriterionSql(ex), `("ObjectID" > 1)`);
    });
    it("should handle greater than or equal to", () => {
      const ex = { "condition": ">=", "data": "Object ID", "origData": "ObjectID", "type": "num", "value": [ "1" ], "value1": "1" };
      assert.equal(getSBCriterionSql(ex), `("ObjectID" >= 1)`);
    });
    it("error if number can't be parsed", () => {
      const exn = { "condition": ">=", "data": "ObjectID", "origData": "ObjectID", "type": "num", "value": [ "one" ], "value1": "one" };
      assert.throws(() => { getSBCriterionSql(exn) }, Error);
    });
  });

  describe('getSBBetweenSql', () => {
    it("should handle simple case", () => {
      const ex = { "condition": "between", "data": "Object ID", "origData": "ObjectID", "type": "num", "value": [ "1", "3" ], "value1": "1", "value2": "3" };
      assert.equal(getSBCriterionSql(ex), `("ObjectID" BETWEEN 1 AND 3)`);
    });
    it("should handle simple negative case", () => {
      const ex = { "condition": "!between", "data": "Object ID", "origData": "ObjectID", "type": "num", "value": [ "1", "3" ], "value1": "1", "value2": "3" };
      assert.equal(getSBCriterionSql(ex), `(NOT ("ObjectID" BETWEEN 1 AND 3))`);
    });
    it("error if FIRST number can't be parsed", () => {
      const ex = { "condition": "!between", "data": "Object ID", "origData": "ObjectID", "type": "num", "value": [ "one", "3" ], "value1": "one", "value2": "3" };
      assert.throws(() => { getSBCriterionSql(ex) }, Error);
    });
    it("error if SECOND number can't be parsed", () => {
      const ex = { "condition": "!between", "data": "Object ID", "origData": "ObjectID", "type": "num", "value": [ "1", "three" ], "value1": "1", "value2": "three" };
      assert.throws(() => { getSBCriterionSql(ex) }, Error);
    });
  });

  describe('error on unrecognized conditions', () => {
    it("error on unrecognized condition", () => {
      const ex = { "condition": "==", "data": "Title", "origData": "Title", "type": "string", "value": [ "El sueño..." ], "value1": "El sueño..." };
      assert.throws(() => { getSBCriterionSql(ex) }, Error);
    });
  });
});

/**************************************************************************/


describe('getSearchBuilderSql', () => {

  describe('handle single criterion', () => {
    it("AND logic", () => {
      const ex = { "criteria": [ { "condition": "contains", "data": "Title", "origData": "Title", "type": "string", "value": [ "q" ], "value1": "q" } ], "logic": "AND" };
      assert.equal(getSearchBuilderSql(ex), `(("Title" LIKE '%q%') AND True)`);
    });
    it("OR logic", () => {
      const ex = { "criteria": [ { "condition": "contains", "data": "Title", "origData": "Title", "type": "string", "value": [ "q" ], "value1": "q" } ], "logic": "OR" };
      assert.equal(getSearchBuilderSql(ex), `(("Title" LIKE '%q%') OR False)`);
    });
  });

  describe('handle multiple criteria (2nd level)', () => {
    const ex = { "criteria": [ { "condition": "=", "data": "Department", "origData": "Department", "type": "string", "value": [ "english" ], "value1": "english" }, { "condition": "contains", "data": "Title", "origData": "Title", "type": "string", "value": [ "bovary" ], "value1": "bovary" } ], };
    it("AND logic", () => {
      assert.equal(getSearchBuilderSql({logic: "AND", ...ex}), `(("Department" = 'english') AND ("Title" LIKE '%bovary%'))`);
    });
    it("OR logic", () => {
      assert.equal(getSearchBuilderSql({logic: "OR", ...ex}), `(("Department" = 'english') OR ("Title" LIKE '%bovary%'))`);
    });
  });

  //  TODO  FAILING  TEST!
  describe('handle nested criteria (3rd level)', () => {
    it("Outer OR, inner ANDs", () => {
      const nested = { "criteria": [ { "criteria": [ { "condition": "=", "data": "Department", "origData": "Department", "type": "string", "value": { "[]": "Photography" }, "value1": "Photography" }, { "condition": "=", "data": "Last Name", "origData": "LastName", "type": "string", "value": { "[]": "Goldin" }, "value1": "Goldin" } ], "logic": "AND" }, { "criteria": [ { "condition": "=", "data": "Department", "origData": "Department", "type": "string", "value": { "[]": "Print" }, "value1": "Print" }, { "condition": "=", "data": "Last Name", "origData": "LastName", "type": "string", "value": { "[]": "Goya" }, "value1": "Goya" } ], "logic": "AND" } ], "logic": "OR" };
      assert.equal(getSearchBuilderSql(nested), `((("Department" = 'Photography') AND ("LastName" = 'Goldin')) OR (("Department" = 'Print') AND ("LastName" = 'Goya')))`);
    });
    it("Outer OR, ONE inner AND", () => {
      const nested = { "criteria": [ { "criteria": [ { "condition": "=", "data": "Department", "origData": "Department", "type": "string", "value": { "[]": "english" }, "value1": "english" }, { "condition": "contains", "data": "Title", "origData": "Title", "type": "string", "value": { "[]": "spanish" }, "value1": "spanish" } ], "logic": "AND" }, { "condition": "=", "data": "Department", "origData": "Department", "type": "string", "value": [ "spanish" ], "value1": "spanish" } ], "logic": "OR" };
      assert.equal(getSearchBuilderSql(nested), `((("Department" = 'english') AND ("Title" LIKE '%spanish%')) OR ("Department" = 'spanish'))`);
    });
    it("Outer AND, ONE inner OR", () => {
      const nested = { "criteria": [ { "criteria": [ { "condition": "=", "data": "Department", "origData": "Department", "type": "string", "value": { "[]": "english" }, "value1": "english" }, { "condition": "contains", "data": "Title", "origData": "Title", "type": "string", "value": { "[]": "spanish" }, "value1": "spanish" } ], "logic": "OR" }, { "condition": "=", "data": "Department", "origData": "Department", "type": "string", "value": [ "spanish" ], "value1": "spanish" } ], "logic": "AND" };
      assert.equal(getSearchBuilderSql(nested), `((("Department" = 'english') OR ("Title" LIKE '%spanish%')) AND ("Department" = 'spanish'))`);
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

/**************************************************************************/

describe('getWhereClause', () => {

  describe('simple cases', () => {
    it("both search AND searchBuilder", () => {
      const ex_simple1 = { draw: '2', columns: [ { data: 'Department', name: '', searchable: 'true', orderable: 'false' }, { data: 'Title', name: '', searchable: 'false', orderable: 'false' } ], search: { value: "global", regex: 'false' }, searchBuilder: { "criteria": [ { "condition": "contains", "data": "Title", "origData": "Title", "type": "string", "value": [ "q" ], "value1": "q" } ], "logic": "AND" }, start: '0', length: '30', _: '1727689860063' };
      assert.equal(getWhereClause(ex_simple1), `WHERE ((("Title" LIKE '%q%') AND True) AND (CONCAT("Department", "Title") LIKE '%global%'))`);
    });
    it("only globalSearch", () => {
      const ex_simple1 = { draw: '2', columns: [ { data: 'Department', name: '', searchable: 'true', orderable: 'false' }, { data: 'Title', name: '', searchable: 'false', orderable: 'false' } ], search: { value: "global", regex: 'false' }, start: '0', length: '30', _: '1727689860063' };
      assert.equal(getWhereClause(ex_simple1), `WHERE (True AND (CONCAT("Department", "Title") LIKE '%global%'))`);
    });

    it("only globalSearch does away with whitespace by default", () => {
      const ex_simple1 = { draw: '2', columns: [ { data: 'Department', name: '', searchable: 'true', orderable: 'false' }, { data: 'Title', name: '', searchable: 'false', orderable: 'false' } ], search: { value: " global ", regex: 'false' }, start: '0', length: '30', _: '1727689860063' };
      assert.equal(getWhereClause(ex_simple1), `WHERE (True AND (CONCAT("Department", "Title") LIKE '%global%'))`);
    });
    it("only globalSearch (leading whitespace)", () => {
      const opts = { globalSearch: { removeLeadingWhitespace: false, removeTrailingWhitespace: true }, allowedFields: undefined };
      const ex_simple1 = { draw: '2', columns: [ { data: 'Department', name: '', searchable: 'true', orderable: 'false' }, { data: 'Title', name: '', searchable: 'false', orderable: 'false' } ], search: { value: " global ", regex: 'false' }, start: '0', length: '30', _: '1727689860063' };
      assert.equal(getWhereClause(ex_simple1, opts), `WHERE (True AND (CONCAT("Department", "Title") LIKE '% global%'))`);
    });
    it("only globalSearch (trailing whitespace)", () => {
      const opts = { globalSearch: { removeLeadingWhitespace: true, removeTrailingWhitespace: false }, allowedFields: undefined };
      const ex_simple1 = { draw: '2', columns: [ { data: 'Department', name: '', searchable: 'true', orderable: 'false' }, { data: 'Title', name: '', searchable: 'false', orderable: 'false' } ], search: { value: " global ", regex: 'false' }, start: '0', length: '30', _: '1727689860063' };
      assert.equal(getWhereClause(ex_simple1, opts), `WHERE (True AND (CONCAT("Department", "Title") LIKE '%global %'))`);
    });
    it("only searchBuilder", () => {
      const ex_simple1 = { draw: '2', columns: [ { data: 'Department', name: '', searchable: 'true', orderable: 'false' }, { data: 'Title', name: '', searchable: 'false', orderable: 'false' } ], searchBuilder: { "criteria": [ { "condition": "contains", "data": "Title", "origData": "Title", "type": "string", "value": [ "q" ], "value1": "q" } ], "logic": "AND" }, start: '0', length: '30', _: '1727689860063' };
      assert.equal(getWhereClause(ex_simple1), `WHERE ((("Title" LIKE '%q%') AND True) AND True)`);
    });
    //  TODO  should search handler different opts
    it("neither", () => {
      const ex_simple1 = { draw: '2', columns: [ { data: 'Department', name: '', searchable: 'true', orderable: 'false' }, { data: 'Title', name: '', searchable: 'false', orderable: 'false' } ], start: '0', length: '30', _: '1727689860063' };
      assert.equal(getWhereClause(ex_simple1), "WHERE (True AND True)");
    });
  });

  // ....

});

/**************************************************************************/
/**************************************************************************/
/**************************************************************************/


describe("checking test enviromnent", () => {
  describe("music.db test DB", () => {
    it("music.db hasn't changed", () => {
      const q = `SELECT COUNT(*) as N FROM songs`;
      assert.equal(DB.prepare(q).get()["N"], 19);
    });
  });
});


/**************************************************************************/

describe('select', () => {

  describe('getSelectC', () => {
    it("should handle simple case", () => {
      assert.equal(getSelectClause({ columns: [{data: "dat 1"},{data: "dat 2"}] }), `SELECT "dat 1", "dat 2"`);
    });
    //  TODO  important
    it("should handle weird characters", () => {
      const example = { columns: [{data: "da`t1"},{data: "dat2"}] };
      assert.equal(getSelectClause(example), 'SELECT "da`t1", "dat2"');
    });
    it("should handle weird characters", () => {
      const example = { columns: [{data: "`"},{data: "dat2"}] };
      assert.equal(getSelectClause(example), 'SELECT "`", "dat2"');
    });
    it("this is actually legal in SQLite", () => {
      const example = { columns: [{data: " "},{data: "dat2"}] };
      assert.equal(getSelectClause(example), 'SELECT " ", "dat2"');
    });
    it("and, incredibly, this is too", () => {
      const example = { columns: [{data: ""},{data: "dat2"}] };
      assert.equal(getSelectClause(example), 'SELECT "", "dat2"');
    });
    it("and, incredibly, this is too", () => {
      assert.equal(getSelectClause({ columns: [{data: ""}] }), 'SELECT ""');
    });
    it("???", () => {
      assert.throws(() => { getLimitSql({ columns: [{data: null}] }) }, Error);
      assert.throws(() => { getLimitSql({ columns: [{data: []}] }) }, Error);
    });
  });

});

/**************************************************************************/


/**************************************************************************/

describe('sanitization', () => {

  describe('returnOkEscapeCharacter', () => {
    it("simple", () => {
      assert.equal(returnOkEscapeCharacter("simple"), "\\");
    });
    it("no backslash", () => {
      assert.equal(returnOkEscapeCharacter("this\\that"), "@");
    });
    it("no @", () => {
      assert.equal(returnOkEscapeCharacter("this@that"), "\\");
    });
    it("handle the unthinkable case", () => {
      const s = "\\@!λ齆֎پ௺᭩uh oh!";
      assert.equal(returnOkEscapeCharacter(s), "¼");
    });
  });

  describe('escapeID (not DB)', () => {
    it("simple", () => {
      assert.equal(escapeID("song_id"), '"song_id"');
    });
    it("errors correctly", () => {
      assert.throws(() => escapeID(4), Error);
      assert.throws(() => escapeID({}), Error);
    });
    it("spaces in column name", () => {
      assert.equal(escapeID("Song title"), '"Song title"');
    });
    it("quotes in column name", () => {
      assert.equal(escapeID(`Tony's "Notes"`), `"Tony's ""Notes"""`);
      assert.equal(escapeID(`Tony's ""Notes""`), `"Tony's """"Notes"""""`);
    });
  });

  describe('escapeID using DB', () => {
    it("simple", () => {
      const q = `SELECT ${escapeID("song_id")} FROM songs WHERE ${escapeID("Song title")} = 'Electrobugs';`;
      assert.equal(DB.prepare(q).get()["song_id"], 5);
    });
    it("spaces in column name", () => {
      const q = `SELECT ${escapeID("Artist name")} FROM songs WHERE ${escapeID('Song title')} = '$ENV{''HOME''}'`;
      assert.equal(DB.prepare(q).get()["Artist name"], "Tony and the Moondogs");
    });
    it("quotes in column name", () => {
      const t = escapeID(`Tony's "Notes"`);
      const q = `SELECT COUNT(*) AS N FROM songs WHERE ${t} = '::sweats::'`;
      assert.equal(DB.prepare(q).get()["N"], 2);
    });
  });

  describe('escapeForLIKE', () => {
    it("simple", () => {
      assert.equal(escapeForLIKE("simple").str, "simple");
    });
    it("single quote", () => {
      assert.equal(escapeForLIKE("Ol'").str, "Ol''");
    });
    it("double quote", () => {
      assert.equal(escapeForLIKE('"Friends').str, '"Friends');
    });
    it("backslash", () => {
      assert.equal(escapeForLIKE('\\').str, '\\');
    });
    it("percent sign", () => {
      const r = escapeForLIKE('100%');
      assert.equal(r.str, '100\\%');
      assert.equal(r.escape, '\\');
    });
    it("underscore", () => {
      const r = escapeForLIKE('City_Vibes');
      assert.equal(r.str, 'City\\_Vibes');
      assert.equal(r.escape, '\\');
    });
    it("underscore 2", () => {
      const r = escapeForLIKE('C\\ity_Vibes');
      assert.equal(r.str, 'C\\ity@_Vibes');
      assert.equal(r.escape, '@');
    });
    
  });

  //  TODO  expand!!!
  describe('expand!', () => {
    const q = `SELECT * FROM songs WHERE ((${escapeID("Song title")} LIKE '%${escapeForLIKE("\\").str}%') OR (${escapeID("Song title")} LIKE '%${escapeForLIKE("%").str}%' ESCAPE '${escapeForLIKE("%").escape}') OR (${escapeID("Song title")}='${escapeString("Robert'); DROP TABLE songs;--")}'))`;
    assert.equal(q, `SELECT * FROM songs WHERE (("Song title" LIKE '%\\%') OR ("Song title" LIKE '%\\%%' ESCAPE '\\') OR ("Song title"='Robert''); DROP TABLE songs;--'))`);
  });

});

/**************************************************************************/


/**************************************************************************
 * Testing with a real DB
 */


describe('testing against a real (weird) DB', () => {

  describe('testing against valid (expected) input', () => {

    it("global search is case-insensitive by default", () => {
      const params = {"draw":"6","columns":[{"data":"song_id","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Song title","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Artist name","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Tony's \"Notes\"","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"γρ'α`φ[έ]ς","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}}],"start":"0","length":"12","search":{"value":"keep","regex":"false"},"_":"1729015491120"};
      const { query } = dtajax2sql(params, 'songs');
      assert.equal(DB.prepare(query).get()["song_id"], 8);
    });
    it("global search takes quote", () => {
      const params = {"draw":"12","columns":[{"data":"song_id","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Song title","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Artist name","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Tony's \"Notes\"","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"γρ'α`φ[έ]ς","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}}],"start":"0","length":"11","search":{"value":"\"","regex":"false"},"searchBuilder":{"criteria":[{"type":""}],"logic":"AND"},"_":"1729015491126"};
      const { query } = dtajax2sql(params, 'songs');
      assert.deepEqual(DB.prepare(query).all().map(i => i['song_id']), [1, 2, 13]);
    });
    it("global search removes leading and trailing whitespace", () => {
      const params = {"draw":"12","columns":[{"data":"song_id","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Song title","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Artist name","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Tony's \"Notes\"","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"γρ'α`φ[έ]ς","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}}],"start":"0","length":"11","search":{"value":" \" ","regex":"false"},"searchBuilder":{"criteria":[{"type":""}],"logic":"AND"},"_":"1729015491126"};
      const { query } = dtajax2sql(params, 'songs');
      assert.deepEqual(DB.prepare(query).all().map(i => i['song_id']), [1, 2, 13]);
    });

    it("global search handles greek", () => {
      const params = {"draw":"23","columns":[{"data":"song_id","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Song title","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Artist name","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Tony's \"Notes\"","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"γρ'α`φ[έ]ς","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}}],"start":"0","length":"11","search":{"value":"Δημ","regex":"false"},"searchBuilder":{"criteria":[{"type":""}],"logic":"AND"},"_":"1729015491137"};
      const { query } = dtajax2sql(params, 'songs');
      assert.equal(DB.prepare(query).get()['song_id'], 3);
    });

    it("global search handles arabic", () => {
      const params = {"draw":"23","columns":[{"data":"song_id","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Song title","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Artist name","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Tony's \"Notes\"","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"γρ'α`φ[έ]ς","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}}],"start":"0","length":"11","search":{"value":"ٱللَّٰهُ","regex":"false"},"searchBuilder":{"criteria":[{"type":""}],"logic":"AND"},"_":"1729015491137"};
      const { query } = dtajax2sql(params, 'songs');
      assert.equal(DB.prepare(query).get()['song_id'], 9);
    });

    it("global search handles emojis", () => {
      const params = {"draw":"23","columns":[{"data":"song_id","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Song title","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Artist name","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Tony's \"Notes\"","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"γρ'α`φ[έ]ς","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}}],"start":"0","length":"11","search":{"value":"💯","regex":"false"},"searchBuilder":{"criteria":[{"type":""}],"logic":"AND"},"_":"1729015491137"};
      const { query } = dtajax2sql(params, 'songs');
      assert.equal(DB.prepare(query).get()['song_id'], 8);
    });
    it("global search handles sql injections", () => {
      const params = {"draw":"3","columns":[{"data":"song_id","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Song title","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Artist name","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Tony's \"Notes\"","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"γρ'α`φ[έ]ς","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}}],"start":"0","length":"12","search":{"value":"Robert'); DROP TABLE songs;--","regex":"false"},"_":"1729017098493"};
      const { query } = dtajax2sql(params, 'songs');
      assert.equal(DB.prepare(query).get()['song_id'], 10);
    });

    it("global search handles backslashes", () => {
      const params = {"draw":"6","columns":[{"data":"song_id","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Song title","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Artist name","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Tony's \"Notes\"","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"γρ'α`φ[έ]ς","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}}],"start":"0","length":"12","search":{"value":"\\","regex":"false"},"_":"1729017098496"};
      const { query } = dtajax2sql(params, 'songs');
      assert.equal(DB.prepare(query).get()['song_id'], 18);
    });

    it("global search handles percent signs", () => {
      const params = {"draw":"9","columns":[{"data":"song_id","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Song title","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Artist name","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Tony's \"Notes\"","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"γρ'α`φ[έ]ς","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}}],"start":"0","length":"12","search":{"value":"% (","regex":"false"},"_":"1729017098499"};
      const { query } = dtajax2sql(params, 'songs');
      assert.equal(DB.prepare(query).get()['song_id'], 17);
    });
    it("global search handles underscores and searches across all columns", () => {
      const params = {"draw":"14","columns":[{"data":"song_id","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Song title","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Artist name","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Tony's \"Notes\"","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"γρ'α`φ[έ]ς","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}}],"start":"0","length":"12","search":{"value":"_","regex":"false"},"_":"1729017098504"};
      const { query } = dtajax2sql(params, 'songs');
      assert.deepEqual(DB.prepare(query).all().map(i => i['song_id']), [6, 11, 19]);
    });
    it("global search handles asterisks", () => {
      const params = {"draw":"3","columns":[{"data":"song_id","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Song title","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Artist name","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Tony's \"Notes\"","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"γρ'α`φ[έ]ς","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}}],"start":"0","length":"12","search":{"value":"*","regex":"false"},"_":"1729017570310"};
      const { query } = dtajax2sql(params, 'songs');
      assert.equal(DB.prepare(query).get()['song_id'], 7);
    });

    // it("search builder number equals but empty field", () => {
    //   const params = {"draw":"6","columns":[{"data":"song_id","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Song title","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Artist name","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Tony's \"Notes\"","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"γρ'α`φ[έ]ς","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}}],"start":"0","length":"11","search":{"value":"","regex":"false"},"searchBuilder":{"criteria":[{"condition":"=","data":"Song ID","origData":"song_id","type":"num","value":[""],"value1":""}],"logic":"AND"},"_":"1729017570313"};
    //   const { query } = dtajax2sql(params, 'songs');
    //   assert.equal(DB.prepare(query).get()['song_id'], 7);
    // });


  });



});
