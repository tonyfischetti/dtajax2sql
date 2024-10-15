import BetterSqlite3 from 'better-sqlite3';
import { dtajax2sql } from '../../../dist/dtajax2sql.js';
let DB;
DB = new BetterSqlite3("../../test/music.db", {
    readonly: true,
    fileMustExist: true
});
/*****
 * CRUD THINGS
 */

////  TODO  CHANGED THIS !!!
export const performAJAX = (params) => {
  return new Promise((resolve, reject) => {
    try {
      const { query, countQuery } = dtajax2sql(params, 'songs');
      console.log({ query, countQuery });
      //  TODO  this strikes me as inefficient
      //  HACK  this strikes me as inefficient
      const a = DB.prepare("SELECT COUNT(*) as totalRecords FROM songs").get();
      const r = DB.prepare(query).all();
      const c = DB.prepare(countQuery).get();
      if (r === undefined)
        reject("API error");
      const ret = {
        "draw": params.draw,
        "recordsTotal": a.totalRecords,
        "recordsFiltered": c.filteredCount,
        "data": r
      };
      resolve(ret);
    }
    catch (error) {
      reject(error);
    }
  });
};
