
import {
  TableName,
  DTAJAXParams
} from "./types.js";

import { 
  getSelectClause,
  getLimitSql,
  getOffsetSql,
  getWhereClause
} from "./getSqlFragments.js";

//  TODO  sql injection protection

export const dtajax2sql = (params: DTAJAXParams, tblName: TableName) => {
  //  TODO  error checking...
  // if (!("columns" in params))
  //   throw new Error("params don't include a 'columns' property");
  const selectClause = getSelectClause(params);
  const fromClause = `FROM ${tblName}`;
  const limit = getLimitSql(params);
  const offset = getOffsetSql(params);
  const whereClause = getWhereClause(params);
  const q = `${selectClause} ${fromClause} ${whereClause} ${limit} ${offset}`;
  return q;
};

