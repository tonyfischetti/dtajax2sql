
import DialectAdapter from '../DialectAdapter.js';

import {
  EscapedLIKE,
  SQLFragment,
  DTAJAXParams,
  SBCompleteCriterion,
  OrderDirective
} from '../types.js';

import {
  parenthisize,
  parseNumberHelper,
  parseNonNegativeIntegerHelper,
  withEsc,
} from '../utils.js';

import { toFts5Query } from '../fts5.js';


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

  //  NOTE  NUL bytes are stripped everywhere: they cannot be
  //        represented in SQL text (SQLite's tokenizer treats NUL as
  //        end-of-input, leaving an unterminated literal/identifier)

  public escapeID(s: string): string {
    if (typeof(s)!=='string') throw new Error ("escapeID expects a string");
    return `"${s.replaceAll(/\u0000/g, '').replaceAll(/"/g, '""')}"`;
  }

  public escapeString(s: string): string {
    return s.replaceAll(/\u0000/g, '').
             replaceAll(/'/g, "''");
  }

  //  NOTE  the search string becomes an FTS5 query expression that keeps
  //        the operators (prefix *, ^, col:, AND/OR/NOT, parentheses) but
  //        can never be malformed --- see fts5.ts. The result is NOT yet
  //        a SQL literal; getFtGlobalSearchSql quotes it
  public escapeStringForFtSearch(s: string): string {
    return toFts5Query(s);
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

  /*
   * choke-points (see DialectAdapter)
   *
   *  NOTE  normalization to NFD happens here---before escaping---so
   *        that `returnOkEscapeCharacter` sees the characters that
   *        actually end up in the SQL
   */

  public quoteString(s: string): SQLFragment {
    return `'${this.escapeString(s.normalize("NFD"))}'`;
  }

  public quoteForLIKE(s: string, prefix: string, suffix: string): SQLFragment {
    const { str, escape } = this.escapeForLIKE(s.normalize("NFD"));
    return withEsc(`'${prefix}${str}${suffix}'`, escape);
  }


  /***********************************************************
   * WHERE clause
   */

  public getGlobalSearchSql(params: DTAJAXParams): SQLFragment {
    let searchTerm = params.search.value;
    if (this.config.whitespace?.removeLeading)
      searchTerm = searchTerm.replace(/^\s+/, '');
    if (this.config.whitespace?.removeTrailing)
      searchTerm = searchTerm.replace(/\s+$/, '');
    const columnsToConcat = params.columns.
      filter(i => i.searchable===true || i.searchable==='true').
      map(i => i.data).
      filter(i => i !== "").
      map(i => this.qualifyColumn(i));
    //  NOTE  a search term with no searchable columns matches nothing
    //        (mirrors client-side DataTables); without this it would
    //        generate `CONCAT() LIKE ...` --- an error in SQLite
    if (columnsToConcat.length === 0)
      return parenthisize("False");
    return parenthisize(`CONCAT(${columnsToConcat.join(", ")}) LIKE ${this.quoteForLIKE(searchTerm, '%', '%')}`);
  };

  public getFtGlobalSearchSql(ftTableName: string, params: DTAJAXParams): SQLFragment {
    const ftQuery = this.escapeStringForFtSearch(params.search.value);
    //  NOTE  a search with nothing searchable in it (e.g. just `-`) can't
    //        be represented as an FTS5 query (`= ''` is a syntax error);
    //        match nothing, consistent with getGlobalSearchSql's
    //        no-searchable-columns case
    if (ftQuery === '')
      return parenthisize("False");
    return parenthisize(`${this.escapeID(ftTableName)} = ${this.quoteString(ftQuery)}`);
  };


  public getSBEqualsSql = (crit: SBCompleteCriterion): SQLFragment => {
    if (crit.type.match(/^string/))
      return `(${this.qualifyColumn(crit.origData)} = ${this.quoteString(crit.value1 ?? "")})`;
    //  TODO  is this really an ELSE condition? Is "string" or "num" exhaustive?
    const num = parseNumberHelper(crit.value1 ?? "");
    return `(${this.qualifyColumn(crit.origData)} = ${num})`;
  }

  //  NOTE  in SQLite, you can search for a number using a string
  //        but let's have different tests for other DBs (eventually)
  public getSBEmpty(crit: SBCompleteCriterion): SQLFragment {
    return `((${this.qualifyColumn(crit.origData)} IS NULL) OR (${this.qualifyColumn(crit.origData)} = ''))`;
  }

  public getSBContainsSql(crit: SBCompleteCriterion): SQLFragment {
    return parenthisize(`${this.qualifyColumn(crit.origData)} LIKE ${this.quoteForLIKE(crit.value1 ?? "", '%', '%')}`);
  }

  public getSBStartsWithSql(crit: SBCompleteCriterion): SQLFragment {
    return parenthisize(`${this.qualifyColumn(crit.origData)} LIKE ${this.quoteForLIKE(crit.value1 ?? "", '', '%')}`);
  }

  public getSBEndsWithSql(crit: SBCompleteCriterion): SQLFragment {
    return parenthisize(`${this.qualifyColumn(crit.origData)} LIKE ${this.quoteForLIKE(crit.value1 ?? "", '%', '')}`);
  }

  //  TODO  no error handling. write tests for it
  public getSBBetweenSql(crit: SBCompleteCriterion): SQLFragment {
    const v1 = parseNumberHelper(crit.value1 ?? "");
    const v2 = parseNumberHelper(crit.value2 ?? "");
    return `(${this.qualifyColumn(crit.origData)} BETWEEN ${v1} AND ${v2})`;
  }

  public getSBLessThanSql(crit: SBCompleteCriterion, orEqualTo=false): SQLFragment {
    const v1 = parseNumberHelper(crit.value1 ?? "");
    return `(${this.qualifyColumn(crit.origData)} <${orEqualTo ? "=" : ""} ${v1})`;
  }

  public getSBGreaterThanSql(crit: SBCompleteCriterion, orEqualTo=false): SQLFragment {
    const v1 = parseNumberHelper(crit.value1 ?? "");
    return `(${this.qualifyColumn(crit.origData)} >${orEqualTo ? "=" : ""} ${v1})`;
  }


  /***********************************************************
   * ORDER BY clause
   */

  public getOrderByClause(params: DTAJAXParams): SQLFragment {
    // configOpts; //  TODO  make NULL (FIRST|LAST) a configurable option
    if (!params.order?.length)
      return '';
    const columns = params.columns.map(i => this.qualifyColumn(i.data));
    const fieldAndAscOrDesc = params.order.
      // toReversed().
      map((i: OrderDirective) => {
        //  NOTE  `dir` is client-controlled and used to be interpolated
        //        as-is (after toUpperCase); only the two literals may
        //        ever reach the SQL
        if (i.dir !== 'asc' && i.dir !== 'desc')
          throw new Error("order direction must be 'asc' or 'desc'");
        //  NOTE  `column` is an index into `columns` (a string over
        //        GET, a number over JSON); out of range used to yield
        //        the literal text `undefined ASC`
        const columnIndex = parseNonNegativeIntegerHelper(i.column, 'order column');
        const column = columns[columnIndex];
        if (column === undefined)
          throw new Error(`order column ${columnIndex} is outside the columns array`);
        return `${column} ${i.dir === 'asc' ? 'ASC' : 'DESC'}`;
      });
    return `ORDER BY ${fieldAndAscOrDesc.join(', ')} NULLS LAST`;
  }

}

export default SQLiteAdapter;

