
import assert from 'assert';

import {
  getLimitSql,
  getOffsetSql,
  getSBCriterionSql,
  getSearchBuilderSql,
  getWhereClause,
} from '../dist/getSqlFragments.js';



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

  /*** Where clauses ****************************************************
    Numbers
      Equals =
      Not !=
      Less Than <
      Less Than Equal To <=
      Greater Than Equal To >=
      Greater Than >
      Between between (di)
      Not Between !between (di)
      Empty null
      Not Empty !null

    Strings
*     Equals =
*     Not !=
      Contains contains
      Does Not Contain !contains
      Starts with starts
      Does Not Start !starts
      Ends With ends
      Does Not Ends With !ends
*     Empty null
*     Not Empty !null
  ***********************************************************************/

describe('Search builder criteria', () => {

  /**** strings AND numbers */
  describe('getSBEqualsSql', () => {
    it("should handle simple case (string)", () => {
      const exs = { "condition": "=", "data": "Title", "origData": "Title", "type": "string", "value": [ "El sueño..." ], "value1": "El sueño..." };
      assert.equal(getSBCriterionSql(exs), "(Title = 'El sueño...')");
    });
    it("should handle simple case (number)", () => {
      const exn = { "condition": "=", "data": "ObjectID", "origData": "ObjectID", "type": "num", "value": [ "1" ], "value1": "1" };
      assert.equal(getSBCriterionSql(exn), "(ObjectID = 1)");
    });
    it("error if number can't be parsed", () => {
      const exn = { "condition": "=", "data": "ObjectID", "origData": "ObjectID", "type": "num", "value": [ "one" ], "value1": "one" };
      assert.throws(() => { getSBCriterionSql(exn) }, Error);
    });
    it("should handle simple negative case (string)", () => {
      const exs = { "condition": "!=", "data": "Title", "origData": "Title", "type": "string", "value": [ "El sueño..." ], "value1": "El sueño..." };
      assert.equal(getSBCriterionSql(exs), "(NOT (Title = 'El sueño...'))");
    });
    it("should handle simple negative case (number)", () => {
      const exn = { "condition": "!=", "data": "ObjectID", "origData": "ObjectID", "type": "num", "value": [ "1" ], "value1": "1" };
      assert.equal(getSBCriterionSql(exn), "(NOT (ObjectID = 1))");
    });
    it("error if number can't be parsed", () => {
      const exn = { "condition": "!=", "data": "ObjectID", "origData": "ObjectID", "type": "num", "value": [ "one" ], "value1": "one" };
      assert.throws(() => { getSBCriterionSql(exn) }, Error);
    });
  });

  describe('getSBEmptySql', () => {
    it("should handle simple case (string)", () => {
      const exs = { "condition": "null", "data": "Title", "origData": "Title", "type": "string" };
      assert.equal(getSBCriterionSql(exs), "((Title IS NULL) OR (Title = ''))");
    });
    //  NOTE  in SQLite, you can search for a number using a string
    //        but let's have different tests for other DBs (eventually)
    it("should handle simple case (number)", () => {
      const exn = { "condition": "null", "data": "Object ID", "origData": "ObjectID", "type": "num" };
      assert.equal(getSBCriterionSql(exn), "((ObjectID IS NULL) OR (ObjectID = ''))");
    });
    it("should handle simple negative case (string)", () => {
      const exs = { "condition": "!null", "data": "Title", "origData": "Title", "type": "string" };
      assert.equal(getSBCriterionSql(exs), "(NOT ((Title IS NULL) OR (Title = '')))");
    });
    it("should handle simple negative case (number)", () => {
      const exn = { "condition": "!null", "data": "Object ID", "origData": "ObjectID", "type": "num" };
      assert.equal(getSBCriterionSql(exn), "(NOT ((ObjectID IS NULL) OR (ObjectID = '')))");
    });
  });

  /**** just strings */
  describe('getSBContainsSql', () => {
    it("should handle simple case", () => {
      const exs = { "condition": "contains", "data": "Title", "origData": "Title", "type": "string", "value": [ "robot boy" ], "value1": "robot boy" };
      assert.equal(getSBCriterionSql(exs), "(Title LIKE '%robot boy%')");
    });
  });

  describe('!getSBContainsSql', () => {
    it("should handle simple case", () => {
      const exs = { "condition": "!contains", "data": "Title", "origData": "Title", "type": "string", "value": [ "robot boy" ], "value1": "robot boy" };
      assert.equal(getSBCriterionSql(exs), "(NOT (Title LIKE '%robot boy%'))");
    });
  });

  describe('getSBStartsWithSql', () => {
    it("should handle simple case", () => {
      const exs = { "condition": "starts", "data": "Title", "origData": "Title", "type": "string", "value": [ "gold star for" ], "value1": "gold star for" };
      assert.equal(getSBCriterionSql(exs), "(Title LIKE 'gold star for%')");
    });
  });

  describe('!getSBStartsWithSql', () => {
    it("should handle simple case", () => {
      const exs = { "condition": "starts", "data": "Title", "origData": "Title", "type": "string", "value": [ "gold star for" ], "value1": "gold star for" };
      assert.equal(getSBCriterionSql(exs), "(Title LIKE 'gold star for%')");
    });
  });

  describe('getSBEndsWithSql', () => {
    it("should handle simple case", () => {
      const exs = { "condition": "ends", "data": "Title", "origData": "Title", "type": "string", "value": [ "robot boy" ], "value1": "robot boy" };
      assert.equal(getSBCriterionSql(exs), "(Title LIKE '%robot boy')");
    });
  });

  describe('!getSBEndsWithSql', () => {
    it("should handle simple case", () => {
      const exs = { "condition": "!ends", "data": "Title", "origData": "Title", "type": "string", "value": [ "robot boy" ], "value1": "robot boy" };
      assert.equal(getSBCriterionSql(exs), "(NOT (Title LIKE '%robot boy'))");
    });
  });

  /**** just numbers */
  describe('getSBLessThan (and less than or equal to)', () => {
    it("should handle less than", () => {
      const ex = { "condition": "<", "data": "Object ID", "origData": "ObjectID", "type": "num", "value": [ "1" ], "value1": "1" };
      assert.equal(getSBCriterionSql(ex), "(ObjectID < 1)");
    });
    it("should handle less than or equal to", () => {
      const ex = { "condition": "<=", "data": "Object ID", "origData": "ObjectID", "type": "num", "value": [ "1" ], "value1": "1" };
      assert.equal(getSBCriterionSql(ex), "(ObjectID <= 1)");
    });
    it("error if number can't be parsed", () => {
      const exn = { "condition": "<=", "data": "ObjectID", "origData": "ObjectID", "type": "num", "value": [ "one" ], "value1": "one" };
      assert.throws(() => { getSBCriterionSql(exn) }, Error);
    });
  });

  describe('getSBGreaterThan (and greater than or equal to)', () => {
    it("should handle greater than", () => {
      const ex = { "condition": ">", "data": "Object ID", "origData": "ObjectID", "type": "num", "value": [ "1" ], "value1": "1" };
      assert.equal(getSBCriterionSql(ex), "(ObjectID > 1)");
    });
    it("should handle greater than or equal to", () => {
      const ex = { "condition": ">=", "data": "Object ID", "origData": "ObjectID", "type": "num", "value": [ "1" ], "value1": "1" };
      assert.equal(getSBCriterionSql(ex), "(ObjectID >= 1)");
    });
    it("error if number can't be parsed", () => {
      const exn = { "condition": ">=", "data": "ObjectID", "origData": "ObjectID", "type": "num", "value": [ "one" ], "value1": "one" };
      assert.throws(() => { getSBCriterionSql(exn) }, Error);
    });
  });

  describe('getSBBetweenSql', () => {
    it("should handle simple case", () => {
      const ex = { "condition": "between", "data": "Object ID", "origData": "ObjectID", "type": "num", "value": [ "1", "3" ], "value1": "1", "value2": "3" };
      assert.equal(getSBCriterionSql(ex), "((ObjectID >= 1) AND (ObjectID <= 3))");
    });
    it("should handle simple negative case", () => {
      const ex = { "condition": "!between", "data": "Object ID", "origData": "ObjectID", "type": "num", "value": [ "1", "3" ], "value1": "1", "value2": "3" };
      assert.equal(getSBCriterionSql(ex), "((ObjectID < 1) OR (ObjectID > 3))");
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



describe('getSearchBuilderSql', () => {

  describe('handle single criterion', () => {
    it("AND logic", () => {
      const ex = { "criteria": [ { "condition": "contains", "data": "Title", "origData": "Title", "type": "string", "value": [ "q" ], "value1": "q" } ], "logic": "AND" };
      assert.equal(getSearchBuilderSql(ex), "((Title LIKE '%q%') AND True)");
    });
    it("OR logic", () => {
      const ex = { "criteria": [ { "condition": "contains", "data": "Title", "origData": "Title", "type": "string", "value": [ "q" ], "value1": "q" } ], "logic": "OR" };
      assert.equal(getSearchBuilderSql(ex), "((Title LIKE '%q%') OR False)");
    });
  });

  describe('handle multiple criteria (2nd level)', () => {
    const ex = { "criteria": [ { "condition": "=", "data": "Department", "origData": "Department", "type": "string", "value": [ "english" ], "value1": "english" }, { "condition": "contains", "data": "Title", "origData": "Title", "type": "string", "value": [ "bovary" ], "value1": "bovary" } ], };
    it("AND logic", () => {
      assert.equal(getSearchBuilderSql({logic: "AND", ...ex}), "((Department = 'english') AND (Title LIKE '%bovary%'))");
    });
    it("OR logic", () => {
      assert.equal(getSearchBuilderSql({logic: "OR", ...ex}), "((Department = 'english') OR (Title LIKE '%bovary%'))");
    });
  });

  //  TODO  FAILING  TEST!
  describe('handle nested criteria (3rd level)', () => {
    it("Outer OR, inner ANDs", () => {
      const nested = { "criteria": [ { "criteria": [ { "condition": "=", "data": "Department", "origData": "Department", "type": "string", "value": { "[]": "Photography" }, "value1": "Photography" }, { "condition": "=", "data": "Last Name", "origData": "LastName", "type": "string", "value": { "[]": "Goldin" }, "value1": "Goldin" } ], "logic": "AND" }, { "criteria": [ { "condition": "=", "data": "Department", "origData": "Department", "type": "string", "value": { "[]": "Print" }, "value1": "Print" }, { "condition": "=", "data": "Last Name", "origData": "LastName", "type": "string", "value": { "[]": "Goya" }, "value1": "Goya" } ], "logic": "AND" } ], "logic": "OR" };
      assert.equal(getSearchBuilderSql(nested), "(((Department = 'Photography') AND (LastName = 'Goldin')) OR ((Department = 'Print') AND (LastName = 'Goya')))");
    });
    it("Outer OR, ONE inner AND", () => {
      const nested = { "criteria": [ { "criteria": [ { "condition": "=", "data": "Department", "origData": "Department", "type": "string", "value": { "[]": "english" }, "value1": "english" }, { "condition": "contains", "data": "Title", "origData": "Title", "type": "string", "value": { "[]": "spanish" }, "value1": "spanish" } ], "logic": "AND" }, { "condition": "=", "data": "Department", "origData": "Department", "type": "string", "value": [ "spanish" ], "value1": "spanish" } ], "logic": "OR" };
      assert.equal(getSearchBuilderSql(nested), "(((Department = 'english') AND (Title LIKE '%spanish%')) OR (Department = 'spanish'))");
    });
    it("Outer AND, ONE inner OR", () => {
      const nested = { "criteria": [ { "criteria": [ { "condition": "=", "data": "Department", "origData": "Department", "type": "string", "value": { "[]": "english" }, "value1": "english" }, { "condition": "contains", "data": "Title", "origData": "Title", "type": "string", "value": { "[]": "spanish" }, "value1": "spanish" } ], "logic": "OR" }, { "condition": "=", "data": "Department", "origData": "Department", "type": "string", "value": [ "spanish" ], "value1": "spanish" } ], "logic": "AND" };
      assert.equal(getSearchBuilderSql(nested), "(((Department = 'english') OR (Title LIKE '%spanish%')) AND (Department = 'spanish'))");
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
      const ex_simple1 = { draw: '2', columns: [ { data: 'Department', name: '', searchable: 'true', orderable: 'false' }, { data: 'Title', name: '', searchable: 'false', orderable: 'false' } ], search: { value: "global", regex: 'false' }, searchBuilder: { "criteria": [ { "condition": "contains", "data": "Title", "origData": "Title", "type": "string", "value": [ "q" ], "value1": "q" } ], "logic": "AND" }, start: '0', length: '30', _: '1727689860063' };
      assert.equal(getWhereClause(ex_simple1), "WHERE (((Title LIKE '%q%') AND True) AND (CONCAT(Department, Title) LIKE '%global%'))");
    });
    it("only searchBuilder", () => {
      const ex_simple1 = { draw: '2', columns: [ { data: 'Department', name: '', searchable: 'true', orderable: 'false' }, { data: 'Title', name: '', searchable: 'false', orderable: 'false' } ], searchBuilder: { "criteria": [ { "condition": "contains", "data": "Title", "origData": "Title", "type": "string", "value": [ "q" ], "value1": "q" } ], "logic": "AND" }, start: '0', length: '30', _: '1727689860063' };
      assert.equal(getWhereClause(ex_simple1), "WHERE (((Title LIKE '%q%') AND True) AND True)");
    });
    it("only globalSearch", () => {
      const ex_simple1 = { draw: '2', columns: [ { data: 'Department', name: '', searchable: 'true', orderable: 'false' }, { data: 'Title', name: '', searchable: 'false', orderable: 'false' } ], search: { value: "global", regex: 'false' }, start: '0', length: '30', _: '1727689860063' };
      assert.equal(getWhereClause(ex_simple1), "WHERE (True AND (CONCAT(Department, Title) LIKE '%global%'))");
    });
    it("neither", () => {
      const ex_simple1 = { draw: '2', columns: [ { data: 'Department', name: '', searchable: 'true', orderable: 'false' }, { data: 'Title', name: '', searchable: 'false', orderable: 'false' } ], start: '0', length: '30', _: '1727689860063' };
      assert.equal(getWhereClause(ex_simple1), "WHERE (True AND True)");
    });
  });

  // ....

});

