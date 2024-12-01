
import DialectAdapter from '../DialectAdapter.js';

import {
  EscapedLIKE,
  SQLFragment,
  DTAJAXParams,
  SBCriterion
} from '../types.js';

import {
  parenthisize,
  parseNumberHelper,
  withEsc,
} from '../utils.js';


export class SQLiteAdapter extends DialectAdapter {

  /***********************************************************
   * helpers
   */

  public returnOkEscapeCharacter(s: string): string {
    if (!s.match(/\\/)) return '\\';
    if (!s.match(/@/))  return '@';
    if (!s.match(/!/))  return '!';
    if (!s.match(/λ/))  return 'λ';     // Greek
    if (!s.match(/齆/)) return '齆';    // Mandarin
    if (!s.match(/֎/))  return '֎';     // Armenian symbol
    if (!s.match(/پ/))  return 'پ';     // Farsi
    if (!s.match(/௺/))  return '௺';     // Tamil
    if (!s.match(/᭩/))  return '᭩';     // Balinese

    // this is for those times where you just need Greek, Chinese,
    // Persian, ... in one WHERE clause
    for (let i = 188; i <= 600; i++) {
      const c = String.fromCodePoint(i);
      if (!s.match(`${c}`)) return c;
    }
    throw new Error ("couldn't find escape character");
  }


  /***********************************************************
   * Sanitization functions
   */

  public escapeID(s: string): string {
    if (typeof(s)!=='string') throw new Error ("escapeID expects a string");
    return `"${s.replaceAll(/"/g, '""')}"`;
  }

  public escapeString(s: string): string {
    return s.replaceAll(/'/g, "''");
  }

  public escapeForLIKE(s: string): EscapedLIKE {
    const better = this.escapeString(s);
    const okEscapeCharacter = this.returnOkEscapeCharacter(s);
    let retEscape = undefined;
    const retStr = better.replaceAll(/[%_]/g, (c) => {
      /*  NOTE  just in case we have to treat them differently */
      switch (c) {
        case '%' :
        case '_' :
          retEscape = okEscapeCharacter;
          return `${okEscapeCharacter}${c}`;
        default  : return c;
      }
    });
    return { str: retStr, escape: retEscape };
  }


  /***********************************************************
   * WHERE clause
   */

  public getGlobalSearchSql(params: DTAJAXParams): SQLFragment {
    let { str: finalStr, escape } = this.escapeForLIKE(params.search.value);
    if (this.config.whitespace.removeLeading)
      finalStr = finalStr.replace(/^\s+/, '');
    if (this.config.whitespace.removeTrailing)
      finalStr = finalStr.replace(/\s$/, '');
    const columnsToConcat = params.columns.
      map(i => i.data).
      filter(i => i !== "").
      filter(i => !this.config.excludeFromGlobalSearch.includes(i)).
      map(this.escapeID);
    const withoutESCAPE = `CONCAT(${columnsToConcat.join(", ")}) LIKE '%${finalStr}%'`;
    return parenthisize(withEsc(withoutESCAPE, escape));
  };


  public getSBEqualsSql = (crit: SBCriterion): SQLFragment => {
    if (crit.type.match(/^string/))
      return `(${this.escapeID(crit.origData)} = '${this.escapeString(crit.value1 ?? "")}')`;
    //  TODO  is this really an ELSE condition? Is "string" or "num" exhaustive?
    const num = parseNumberHelper(crit.value1 ?? "");
    return `(${this.escapeID(crit.origData)} = ${num})`;
  }

  //  NOTE  in SQLite, you can search for a number using a string
  //        but let's have different tests for other DBs (eventually)
  public getSBEmpty(crit: SBCriterion): SQLFragment {
    return `((${this.escapeID(crit.origData)} IS NULL) OR (${this.escapeID(crit.origData)} = ''))`;
  }

  public getSBContainsSql(crit: SBCriterion): SQLFragment {
    let { str: finalStr, escape } = this.escapeForLIKE(crit.value1 ?? "");
    return parenthisize(withEsc(`${this.escapeID(crit.origData)} LIKE '%${finalStr}%'`, escape));
  }

  public getSBStartsWithSql(crit: SBCriterion): SQLFragment {
    let { str: finalStr, escape } = this.escapeForLIKE(crit.value1 ?? "");
    return parenthisize(withEsc(`${this.escapeID(crit.origData)} LIKE '${finalStr}%'`, escape));
  }

  public getSBEndsWithSql(crit: SBCriterion): SQLFragment {
    let { str: finalStr, escape } = this.escapeForLIKE(crit.value1 ?? "");
    return parenthisize(withEsc(`${this.escapeID(crit.origData)} LIKE '%${finalStr}'`, escape));
  }

  //  TODO  no error handling. write tests for it
  public getSBBetweenSql(crit: SBCriterion): SQLFragment {
    const v1 = parseNumberHelper(crit.value1 ?? "");
    const v2 = parseNumberHelper(crit.value2 ?? "");
    return `(${this.escapeID(crit.origData)} BETWEEN ${v1} AND ${v2})`;
  }

  public getSBLessThanSql(crit: SBCriterion, orEqualTo=false): SQLFragment {
    const v1 = parseNumberHelper(crit.value1 ?? "");
    return `(${this.escapeID(crit.origData)} <${orEqualTo ? "=" : ""} ${v1})`;
  }

  public getSBGreaterThanSql(crit: SBCriterion, orEqualTo=false): SQLFragment {
    const v1 = parseNumberHelper(crit.value1 ?? "");
    return `(${this.escapeID(crit.origData)} >${orEqualTo ? "=" : ""} ${v1})`;
  }


  /***********************************************************
   * ORDER BY clause
   */

  public getOrderByClause(params: DTAJAXParams): SQLFragment {
    console.log(params.draw);
    return "ORDER BY id";
  }

}

export default SQLiteAdapter;

