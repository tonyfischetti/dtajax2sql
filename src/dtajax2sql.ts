
import {
  TableName,
  DTAJAXParams,
  ConfigOpts,
  Result
} from "./types.js";

import { 
  getSelectClause,
  getLimitSql,
  getOffsetSql,
  getWhereClause,
  getOrderClause,
} from "./getSqlFragments.js";

import {
  convertColumnPropToArray
} from './utils.js';


const defaultConfigOpts: ConfigOpts = {
  //  TODO  only for where clauses?!!?
  whitespace: {
    removeLeading: true,
    removeTrailing: true
  },
  excludeFromGlobalSearch: []
};

export const DTajax2sql = (params: DTAJAXParams, 
                           tblName: TableName,
                           configOpts=defaultConfigOpts): Result => {
  //  TODO  error checking...
  // if (!("columns" in params))
  //   throw new Error("params don't include a 'columns' property");

  //  TEST  WRITE TEST FOR THIS!!
  if (!Array.isArray(params.columns))
    params.columns =  convertColumnPropToArray(params.columns);

/*
  *
  //  HACK  why in the world
  if ("0" in params.criteria)
    // @ts-ignore
    params.criteria = Object.keys(params.criteria).map( i => params.criteria[i] );
  */

  const selectClause = getSelectClause(params);
  const fromClause   = `FROM ${tblName}`;
  const whereClause  = getWhereClause(params, configOpts);
  const orderClause  = getOrderClause(params, configOpts);
  const limit        = getLimitSql(params);
  const offset       = getOffsetSql(params);
  const q            = `${selectClause} ${fromClause} ${whereClause} ${orderClause} ${limit} ${offset}`;
  const cq           = `SELECT COUNT(*) as filteredCount ${fromClause} ${whereClause}`;
  return { query: q, countQuery: cq };
};


export default DTajax2sql;
