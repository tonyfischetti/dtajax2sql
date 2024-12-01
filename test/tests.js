
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

const exParams = {
  "draw": "6",
  "columns": [
    {
      "data": "song_id",
      "name": "",
      "searchable": "true",
      "orderable": "false",
      "search": {
        "value": "",
        "regex": "false"
      }
    },
    {
      "data": "Song title",
      "name": "",
      "searchable": "true",
      "orderable": "false",
      "search": {
        "value": "",
        "regex": "false"
      }
    },
    {
      "data": "Artist name",
      "name": "",
      "searchable": "true",
      "orderable": "false",
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
      "searchable": "true",
      "orderable": "false",
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



// const res = inst.toSQL(params);

/**************************************************************************
 * Testing with a real DB
 */

describe('testing against a real (weird) DB', () => {

  describe('testing against valid (expected) input', () => {

    it("global search is case-insensitive by default", () => {
      const params = {"draw":"6","columns":[{"data":"song_id","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Song title","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Artist name","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Tony's \"Notes\"","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"γρ'α`φ[έ]ς","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}}],"start":"0","length":"12","search":{"value":"keep","regex":"false"},"_":"1729015491120"};
      const { query } = inst.toSQL(params);
      assert.equal(DB.prepare(query).get()["song_id"], 8);
    });

    it("global search takes quote", () => {
      const params = {"draw":"12","columns":[{"data":"song_id","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Song title","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Artist name","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Tony's \"Notes\"","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"γρ'α`φ[έ]ς","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}}],"start":"0","length":"11","search":{"value":"\"","regex":"false"},"searchBuilder":{"criteria":[{"type":""}],"logic":"AND"},"_":"1729015491126"};
      const { query } = inst.toSQL(params);
      assert.deepEqual(DB.prepare(query).all().map(i => i['song_id']), [1, 2, 13]);
    });
    it("global search removes leading and trailing whitespace", () => {
      const params = {"draw":"12","columns":[{"data":"song_id","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Song title","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Artist name","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Tony's \"Notes\"","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"γρ'α`φ[έ]ς","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}}],"start":"0","length":"11","search":{"value":" \" ","regex":"false"},"searchBuilder":{"criteria":[{"type":""}],"logic":"AND"},"_":"1729015491126"};
      const { query } = inst.toSQL(params);
      assert.deepEqual(DB.prepare(query).all().map(i => i['song_id']), [1, 2, 13]);
    });

    it("global search handles greek", () => {
      const params = {"draw":"23","columns":[{"data":"song_id","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Song title","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Artist name","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Tony's \"Notes\"","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"γρ'α`φ[έ]ς","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}}],"start":"0","length":"11","search":{"value":"Δημ","regex":"false"},"searchBuilder":{"criteria":[{"type":""}],"logic":"AND"},"_":"1729015491137"};
      const { query } = inst.toSQL(params);
      assert.equal(DB.prepare(query).get()['song_id'], 3);
    });

    it("global search handles arabic", () => {
      const params = {"draw":"23","columns":[{"data":"song_id","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Song title","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Artist name","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Tony's \"Notes\"","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"γρ'α`φ[έ]ς","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}}],"start":"0","length":"11","search":{"value":"ٱللَّٰهُ","regex":"false"},"searchBuilder":{"criteria":[{"type":""}],"logic":"AND"},"_":"1729015491137"};
      const { query } = inst.toSQL(params);
      assert.equal(DB.prepare(query).get()['song_id'], 9);
    });

    it("global search handles emojis", () => {
      const params = {"draw":"23","columns":[{"data":"song_id","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Song title","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Artist name","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Tony's \"Notes\"","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"γρ'α`φ[έ]ς","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}}],"start":"0","length":"11","search":{"value":"💯","regex":"false"},"searchBuilder":{"criteria":[{"type":""}],"logic":"AND"},"_":"1729015491137"};
      const { query } = inst.toSQL(params);
      assert.equal(DB.prepare(query).get()['song_id'], 8);
    });
    it("global search handles sql injections", () => {
      const params = {"draw":"3","columns":[{"data":"song_id","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Song title","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Artist name","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Tony's \"Notes\"","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"γρ'α`φ[έ]ς","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}}],"start":"0","length":"12","search":{"value":"Robert'); DROP TABLE songs;--","regex":"false"},"_":"1729017098493"};
      const { query } = inst.toSQL(params);
      assert.equal(DB.prepare(query).get()['song_id'], 10);
    });

    it("global search handles backslashes", () => {
      const params = {"draw":"6","columns":[{"data":"song_id","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Song title","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Artist name","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Tony's \"Notes\"","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"γρ'α`φ[έ]ς","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}}],"start":"0","length":"12","search":{"value":"\\","regex":"false"},"_":"1729017098496"};
      const { query } = inst.toSQL(params);
      assert.equal(DB.prepare(query).get()['song_id'], 18);
    });

    it("global search handles percent signs", () => {
      const params = {"draw":"9","columns":[{"data":"song_id","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Song title","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Artist name","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Tony's \"Notes\"","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"γρ'α`φ[έ]ς","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}}],"start":"0","length":"12","search":{"value":"% (","regex":"false"},"_":"1729017098499"};
      const { query } = inst.toSQL(params);
      assert.equal(DB.prepare(query).get()['song_id'], 17);
    });
    it("global search handles underscores and searches across all columns", () => {
      const params = {"draw":"14","columns":[{"data":"song_id","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Song title","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Artist name","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Tony's \"Notes\"","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"γρ'α`φ[έ]ς","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}}],"start":"0","length":"12","search":{"value":"_","regex":"false"},"_":"1729017098504"};
      const { query } = inst.toSQL(params);
      assert.deepEqual(DB.prepare(query).all().map(i => i['song_id']), [6, 11, 19]);
    });
    it("global search handles asterisks", () => {
      const params = {"draw":"3","columns":[{"data":"song_id","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Song title","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Artist name","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Tony's \"Notes\"","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"γρ'α`φ[έ]ς","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}}],"start":"0","length":"12","search":{"value":"*","regex":"false"},"_":"1729017570310"};
      const { query } = inst.toSQL(params);
      assert.equal(DB.prepare(query).get()['song_id'], 7);
    });

    // it("search builder number equals but empty field", () => {
    //   const params = {"draw":"6","columns":[{"data":"song_id","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Song title","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Artist name","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Tony's \"Notes\"","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"γρ'α`φ[έ]ς","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}}],"start":"0","length":"11","search":{"value":"","regex":"false"},"searchBuilder":{"criteria":[{"condition":"=","data":"Song ID","origData":"song_id","type":"num","value":[""],"value1":""}],"logic":"AND"},"_":"1729017570313"};
    //   const { query } = dtajax2sql(params, 'songs');
    //   assert.equal(DB.prepare(query).get()['song_id'], 7);
    // });

    it("ORDER BY works with one directive", () => {
      const params = {"draw":"14","columns":[{"data":"song_id","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Song title","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Artist name","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"Tony's \"Notes\"","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}},{"data":"γρ'α`φ[έ]ς","name":"","searchable":"true","orderable":"false","search":{"value":"","regex":"false"}}],"start":"0","length":"12","search":{"value":"_","regex":"false"},"_":"1729017098504", "order": [ { "column": "0", "dir": "desc", "name": "" } ]};
      const { query } = inst.toSQL(params);
      assert.equal(DB.prepare(query).get()['song_id'], 19);
    });

    it("ORDER BY works with two directives", () => {
      const params = {"draw": "14", "columns": [ { "data": "song_id", "name": "", "searchable": "true", "orderable": "false", "search": { "value": "", "regex": "false" } }, { "data": "Song title", "name": "", "searchable": "true", "orderable": "false", "search": { "value": "", "regex": "false" } }, { "data": "Artist name", "name": "", "searchable": "true", "orderable": "false", "search": { "value": "", "regex": "false" } }, { "data": "Tony's \"Notes\"", "name": "", "searchable": "true", "orderable": "false", "search": { "value": "", "regex": "false" } }, { "data": "\u03b3\u03c1'\u03b1`\u03c6[\u03ad]\u03c2", "name": "", "searchable": "true", "orderable": "false", "search": { "value": "", "regex": "false" } } ], "start": "0", "length": "7", "search": { "value": "", "regex": "false" }, "_": "1729017098504", "order": [ { "column": "2", "dir": "desc", "name": "" }, { "column": "1", "dir": "asc", "name": "" } ] };
      const { query } = inst.toSQL(params);
      assert.deepEqual(DB.prepare(query).all().map(i => i['song_id']), [3, 13, 12, 17, 8, 18, 9]);
    });

  });


});

