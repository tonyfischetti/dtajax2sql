
import {
  SQLFragment,
  SelectClause,
  WhereClause,
  OrderClause,
  OrderDirective,
  SBCriterion,
  SearchBuilder,
  DTAJAXParams,
  ConfigOpts,
  WhitespaceOpts
} from "./types.js";

import {
         escapeID,
         escapeString,
         escapeForLIKE }      from "./sanitization.js";
import { negateClause,
         parseNumberHelper }  from "./utils.js";


/***********************************************************
 * helpers
 */
const getLorOhelper = (params: DTAJAXParams,
                       thekey: "length" | "start",
                       sqlKey: string): SQLFragment => {
  if (!(thekey in params))
    throw new Error(`${thekey} is not a property of ${params}`);
  const num = parseNumberHelper(params[thekey]);
  return `${sqlKey} ${num}`;
};


/***********************************************************
 * SELECT clause
 */
export const getSelectClause = (params: DTAJAXParams): SelectClause => {
  if (params.columns === undefined) throw new Error("malformed input");
  const columns = params.columns.
                    map(i => i.data).
                    map(escapeID);
  return `SELECT ${columns.join(", ")}`;
};


/***********************************************************
 * LIMIT and OFFSET
 */
export const getLimitSql = (params: DTAJAXParams): SQLFragment => {
  return getLorOhelper(params, "length", "LIMIT");
};

export const getOffsetSql = (params: DTAJAXParams): SQLFragment => {
  return getLorOhelper(params, "start", "OFFSET");
};


/***********************************************************
 * Global Search handler
 */
export const getGlobalSearchSql = (params: DTAJAXParams,
                                   wOpts: WhitespaceOpts): SQLFragment => {
  //  TODO  check if missing the keys
  let { str: finalStr, escape } = escapeForLIKE(params.search.value)
  if (wOpts.removeLeadingWhitespace)  { finalStr = finalStr.replace(/^\s+/, '') }
  if (wOpts.removeTrailingWhitespace) { finalStr = finalStr.replace(/\s+$/, '') }
  const withoutESCAPE = `(CONCAT(${params.columns.filter(i => i.data !== "").map(i => escapeID(i.data)).join(", ")}) LIKE '%${finalStr}%'`;
  if (escape)
    return `${withoutESCAPE} ESCAPE '${escape}')`;
  return `${withoutESCAPE})`;
};


/***********************************************************
 * Search Builder and helpers
 */
export const getSBEqualsSql = (crit: SBCriterion): WhereClause => {
  if (crit.type.match(/^string/))
    return `(${escapeID(crit.origData)} = '${escapeString(crit.value1 ?? "")}')`;
  //  TODO  is this really an ELSE condition? Is "string" or "num" exhaustive?
  const num = parseNumberHelper(crit.value1 ?? "");
  return `(${escapeID(crit.origData)} = ${num})`;
};

//  NOTE  in SQLite, you can search for a number using a string
//        but let's have different tests for other DBs (eventually)
export const getSBEmpty = (crit: SBCriterion): WhereClause => {
  return `((${escapeID(crit.origData)} IS NULL) OR (${escapeID(crit.origData)} = ''))`;
};

export const getSBContainsSql = (crit: SBCriterion): WhereClause => {
  let { str: finalStr, escape } = escapeForLIKE(crit.value1 ?? "");
  if (escape)
    return `(${escapeID(crit.origData)} LIKE '%${finalStr}%' ESCAPE '${escape}')`;
  return `(${escapeID(crit.origData)} LIKE '%${finalStr}%')`;
};

export const getSBStartsWithSql = (crit: SBCriterion): WhereClause => {
  let { str: finalStr, escape } = escapeForLIKE(crit.value1 ?? "");
  if (escape)
    return `(${escapeID(crit.origData)} LIKE '${finalStr}%' ESCAPE '${escape}')`;
  return `(${escapeID(crit.origData)} LIKE '${finalStr}%')`;
};

export const getSBEndsWithSql = (crit: SBCriterion): WhereClause => {
  let { str: finalStr, escape } = escapeForLIKE(crit.value1 ?? "");
  if (escape)
    return `(${escapeID(crit.origData)} LIKE '%${finalStr}' ESCAPE '${escape}')`;
  return `(${escapeID(crit.origData)} LIKE '%${finalStr}')`;
};

//  TODO  no error handling. write tests for it
export const getSBBetweenSql = (crit: SBCriterion): WhereClause => {
  const v1 = parseNumberHelper(crit.value1 ?? "");
  const v2 = parseNumberHelper(crit.value2 ?? "");
  return `(${escapeID(crit.origData)} BETWEEN ${v1} AND ${v2})`;
};

export const getSBLessThanSql = (crit: SBCriterion, orEqualTo=false): WhereClause => {
  const v1 = parseNumberHelper(crit.value1 ?? "");
  return `(${escapeID(crit.origData)} <${orEqualTo ? "=" : ""} ${v1})`;
};

export const getSBGreaterThanSql = (crit: SBCriterion, orEqualTo=false): WhereClause => {
  const v1 = parseNumberHelper(crit.value1 ?? "");
  return `(${escapeID(crit.origData)} >${orEqualTo ? "=" : ""} ${v1})`;
};

export const getSBCriterionSql = (crit: SBCriterion): SQLFragment => {
  //  TODO  no error checking
  if (crit.condition === "=")          return getSBEqualsSql(crit);
  if (crit.condition === "!=")         return negateClause(getSBEqualsSql(crit));
  if (crit.condition === "null")       return getSBEmpty(crit);
  if (crit.condition === "!null")      return negateClause(getSBEmpty(crit));
  if (crit.condition === "contains")   return getSBContainsSql(crit);
  if (crit.condition === "!contains")  return negateClause(getSBContainsSql(crit));
  if (crit.condition === "starts")     return getSBStartsWithSql(crit);
  if (crit.condition === "!starts")    return negateClause(getSBStartsWithSql(crit));
  if (crit.condition === "ends")       return getSBEndsWithSql(crit);
  if (crit.condition === "!ends")      return negateClause(getSBEndsWithSql(crit));
  if (crit.condition === "between")    return getSBBetweenSql(crit);
  if (crit.condition === "!between")   return negateClause(getSBBetweenSql(crit));
  if (crit.condition === "<")          return getSBLessThanSql(crit);
  if (crit.condition === "<=")         return getSBLessThanSql(crit, true);
  if (crit.condition === ">")          return getSBGreaterThanSql(crit);
  if (crit.condition === ">=")         return getSBGreaterThanSql(crit, true);
  if (crit.condition === undefined)    return "(True = True)";
  throw new Error("unrecognized condition");
};

export const getSearchBuilderSql = (params: SearchBuilder): SQLFragment => {
  if (!(params.criteria)) throw new Error("no criteria?");

  const isNestedP = (obj: SearchBuilder | SBCriterion): boolean => {
    return ("criteria" in obj);
  };

  //  HACK  why in the world
  if ("0" in params.criteria)
    // @ts-ignore
    params.criteria = Object.keys(params.criteria).map( i => params.criteria[i] );

  const allCriteria = params['criteria'].map((i): string => {
    // @ts-ignore  TODO  
    if (!isNestedP(i)) return getSBCriterionSql(i);
    // @ts-ignore  TODO  
    return getSearchBuilderSql(i);
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
};


/***********************************************************
 * WHERE clause
 */
export const getWhereClause = (params: DTAJAXParams, configOpts: ConfigOpts): WhereClause => {
  //  TODO  this is ugly. fix it
  const defaultGSWhitespaceOpts = { removeLeadingWhitespace: true, removeTrailingWhitespace: true };
  //  TODO  unused rn
  const defaultSBWhitespaceOpts = { removeLeadingWhitespace: false, removeTrailingWhitespace: false };
  let opts = configOpts ?? { globalSearch: defaultGSWhitespaceOpts, searchBuilder: defaultSBWhitespaceOpts };
  const fromGlobalSearch = ('search' in params && params.search.value !== '') ? 
                              getGlobalSearchSql(params, opts.globalSearch) :
                              "True";
  const fromSearchBuilder = ('searchBuilder' in params) ? 
                              getSearchBuilderSql(params.searchBuilder) :
                              "True";
  return `WHERE (${ [fromSearchBuilder, fromGlobalSearch].join(" AND ") })`;
};


/***********************************************************
 * ORDER BY clause
 */

/**
 * OrderSpec
 *
 * example

  "order": [
    {
      "column": "2",
      "dir": "asc",
      "name": ""
    },
    {
      "column": "3",
      "dir": "asc",
      "name": ""
    }
  ]
 */
export const getOrderClause = (params: DTAJAXParams, configOpts: ConfigOpts): OrderClause => {
  configOpts; //  TODO  make NULL (FIRST|LAST) a configurable option
  // console.log(params.order);
  if (!params.order?.length)
    return '';
  const columns = params.columns.
                    map(i => i.data).
                    map(escapeID);
  const fieldAndAscOrDesc = params.order.
    // toReversed().
    map((i: OrderDirective) => `${columns[i.column]} ${i.dir.toUpperCase()}`);
  return `ORDER BY ${fieldAndAscOrDesc.join(', ')} NULLS LAST`;
};

// export const getSelectClause = (params: DTAJAXParams): SelectClause => {
//   if (params.columns === undefined) throw new Error("malformed input");
//   const columns = params.columns.
//                     map(i => i.data).
//                     map(escapeID);
//   return `SELECT ${columns.join(", ")}`;
//
