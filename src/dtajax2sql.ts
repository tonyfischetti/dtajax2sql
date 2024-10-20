
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
  getWhereClause
} from "./getSqlFragments.js";

import {
  convertColumnPropToArray
} from './utils.js';

const defaultConfigOpts: ConfigOpts = {
  //  TODO  only for where clauses?!!?
  globalSearch: {
    removeLeadingWhitespace: true,
    removeTrailingWhitespace: true
  },
  allowedFields: undefined,
  gsFields: undefined
};

export const dtajax2sql = (params: DTAJAXParams, 
                           tblName: TableName,
                           configOpts=defaultConfigOpts): Result => {
  //  TODO  error checking...
  // if (!("columns" in params))
  //   throw new Error("params don't include a 'columns' property");

  //  TEST  WRITE TEST FOR THIS!!
  if (!Array.isArray(params.columns))
    params.columns =  convertColumnPropToArray(params.columns);

  const selectClause = getSelectClause(params);
  const fromClause   = `FROM ${tblName}`;
  const limit        = getLimitSql(params);
  const offset       = getOffsetSql(params);
  const whereClause  = getWhereClause(params, configOpts);
  const q            = `${selectClause} ${fromClause} ${whereClause} ${limit} ${offset}`;
  const cq           = `SELECT COUNT(*) as filteredCount ${fromClause} ${whereClause}`;
  return { query: q, countQuery: cq };
};

