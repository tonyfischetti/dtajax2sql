
import {
  SQLFragment,
  DTAJAXParams,
  EscapedLIKE,
  Result,
  ConfigOpts,
  SBCriterion,
  SearchBuilder
} from './types.js';

import {
  parseNumberHelper,
  negateClause
} from './utils.js';


//  TODO  re-think what should go into children and what stays here

export abstract class DialectAdapter {
  readonly tableName: string;
  readonly config: ConfigOpts;

  constructor(tableName: string, config: ConfigOpts) {
    this.tableName = tableName;
    this.config = config;
  }

  /***********************************************************
   * helpers
   */

  public getLimitorOffsetHelper(params: DTAJAXParams,
                                thekey: "length" | "start",
                                sqlKey: string): SQLFragment {
    if (!(thekey in params))
      throw new Error(`${thekey} is not a property of ${params}`);
    const num = parseNumberHelper(params[thekey]);
    return `${sqlKey} ${num}`;
  };


  /***********************************************************
   * Sanitization functions
   */

  abstract escapeID(s: string):       string;
  abstract escapeString(s: string):   string;
  abstract escapeForLIKE(s: string):  EscapedLIKE;


  /***********************************************************
   * SELECT clause
   */

  public getSelectClause(params: DTAJAXParams): SQLFragment {
    if (params.columns === undefined) throw new Error("malformed input");
    const columns = params.columns.
                      map(i => i.data).
                      map(this.escapeID);
    return `SELECT ${columns.join(", ")}`;
  };


  /***********************************************************
   * FROM clause
   */

  public getFromClause(): SQLFragment {
    return `FROM ${this.escapeID(this.tableName)}`;
  }


  /***********************************************************
   * LIMIT and OFFSET
   */

  public getLimitSql(params: DTAJAXParams): SQLFragment {
    return this.getLimitorOffsetHelper(params, "length", "LIMIT");
  }

  public getOffsetSql(params: DTAJAXParams): SQLFragment {
    return this.getLimitorOffsetHelper(params, "start", "OFFSET");
  }


  /***********************************************************
   * WHERE clause
   */

  abstract getGlobalSearchSql  (params: DTAJAXParams): SQLFragment;

  abstract getSBEqualsSql      (crit: SBCriterion): SQLFragment;
  abstract getSBEmpty          (crit: SBCriterion): SQLFragment;
  abstract getSBContainsSql    (crit: SBCriterion): SQLFragment;
  abstract getSBStartsWithSql  (crit: SBCriterion): SQLFragment;
  abstract getSBEndsWithSql    (crit: SBCriterion): SQLFragment;
  abstract getSBBetweenSql     (crit: SBCriterion): SQLFragment;
  abstract getSBLessThanSql    (crit: SBCriterion, orEqualTo: boolean): SQLFragment;
  abstract getSBGreaterThanSql (crit: SBCriterion, orEqualTo: boolean): SQLFragment;

  public getSBCriterionSql(crit: SBCriterion): SQLFragment {
    //  TODO  no error checking
    //  TODO  use a object storing closures instead (?)
    if (crit.condition === "=")          return this.getSBEqualsSql(crit);
    if (crit.condition === "!=")         return negateClause(this.getSBEqualsSql(crit));
    if (crit.condition === "null")       return this.getSBEmpty(crit);
    if (crit.condition === "!null")      return negateClause(this.getSBEmpty(crit));
    if (crit.condition === "contains")   return this.getSBContainsSql(crit);
    if (crit.condition === "!contains")  return negateClause(this.getSBContainsSql(crit));
    if (crit.condition === "starts")     return this.getSBStartsWithSql(crit);
    if (crit.condition === "!starts")    return negateClause(this.getSBStartsWithSql(crit));
    if (crit.condition === "ends")       return this.getSBEndsWithSql(crit);
    if (crit.condition === "!ends")      return negateClause(this.getSBEndsWithSql(crit));
    if (crit.condition === "between")    return this.getSBBetweenSql(crit);
    if (crit.condition === "!between")   return negateClause(this.getSBBetweenSql(crit));
    if (crit.condition === "<")          return this.getSBLessThanSql(crit, false);
    if (crit.condition === "<=")         return this.getSBLessThanSql(crit, true);
    if (crit.condition === ">")          return this.getSBGreaterThanSql(crit, false);
    if (crit.condition === ">=")         return this.getSBGreaterThanSql(crit, true);
    if (crit.condition === undefined)    return "(True = True)";
    throw new Error("unrecognized condition");
  }

  public getSearchBuilderSql(params: SearchBuilder): SQLFragment {
    // if (!(params.criteria)) throw new Error("no criteria?");
    if (!(params.criteria)) {
      return '(True AND True)';
    }

    const isNestedP = (obj: SearchBuilder | SBCriterion): boolean => {
      return ("criteria" in obj);
    };

    const allCriteria = params['criteria'].map((i): string => {
      // @ts-ignore  TODO  
      if (!isNestedP(i)) return this.getSBCriterionSql(i);
      // @ts-ignore  TODO  
      return this.getSearchBuilderSql(i);
    }); 

    if (params['logic'] === 'AND') {
      if (allCriteria.length === 1) allCriteria.push("True")
      return `(${allCriteria.join(" AND ")})`;
    }

    if (params['logic'] === 'OR') {
      if (allCriteria.length === 1) allCriteria.push("False")
      return `(${allCriteria.join(" OR ")})`;
    }

    //  TODO  error handling like below
    // if (!(("criteria" in params) && ("logic" in params)))
    throw new Error("unrecognized logic");
  }

  public getWhereClause(params: DTAJAXParams): SQLFragment {
    const fromGlobalSearch = ('search' in params && params.search.value !== '') ? 
      this.getGlobalSearchSql(params) :
      "True";
    const fromSearchBuilder = ('searchBuilder' in params) ? 
      this.getSearchBuilderSql(params.searchBuilder) :
      "True";
    return `WHERE (${ [fromSearchBuilder, fromGlobalSearch].join(" AND ") })`;
  }

  /***********************************************************
   * ORDER BY clause
   */

  abstract getOrderByClause    (params: DTAJAXParams): SQLFragment;


  /***********************************************************
   * toSQL method
   */

  public toSQL(params: DTAJAXParams): Result {
    const selectClause = this.getSelectClause(params);
    const fromClause   = this.getFromClause();
    const whereClause  = this.getWhereClause(params);
    const orderClause  = this.getOrderByClause(params);
    const limit        = this.getLimitSql(params);
    const offset       = this.getOffsetSql(params);

    const q  = `${selectClause} ${fromClause} ${whereClause} ${orderClause} ${limit} ${offset}`;
    const cq = `SELECT COUNT(*) as filteredCount ${fromClause} ${whereClause}`;
    return { query: q, countQuery: cq };
  }

}

export default DialectAdapter;

