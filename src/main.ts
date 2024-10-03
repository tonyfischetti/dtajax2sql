
//  TODO  sql injection protection


export const getSelectClause = (params: DTAJAXParams): SelectClause => {
  return `SELECT ${params.columns.map(i => i.data).join(", ")}`;
};




const negateClause = (clause: WhereClause): WhereClause => {
  return `(NOT ${clause})`;
};

const parseNumberHelper = (str: string): number => {
  const num = parseInt(str, 10);
  if (isNaN(num)) throw new Error("couldn't parse number");
  return num;
};

const getLorOhelper = (params: DTAJAXParams,
                       thekey: "length" | "start",
                       sqlKey: string): SQLFragment => {
  if (!(thekey in params))
    throw new Error(`${thekey} is not a property of ${params}`);
  const num = parseNumberHelper(params[thekey]);
  return `${sqlKey} ${num}`;
};

export const getLimitSql = (params: DTAJAXParams): SQLFragment => {
  return getLorOhelper(params, "length", "LIMIT");
};

export const getOffsetSql = (params: DTAJAXParams): SQLFragment => {
  return getLorOhelper(params, "start", "OFFSET");
};




export const getSBEqualsSql = (crit: SBCriterion): WhereClause => {
  if (crit.type === "string")
    return `(${crit.origData} = '${crit.value1}')`;
  //  TODO  is this really an ELSE condition? Is "string" or "num" exhaustive?
  const num = parseNumberHelper(crit.value1 ?? "");
  return `(${crit.origData} = ${num})`;
};

//  NOTE  in SQLite, you can search for a number using a string
//        but let's have different tests for other DBs (eventually)
export const getSBEmpty = (crit: SBCriterion): WhereClause => {
  // if (crit.type === "string")
  // if (crit.type === "num")
  return `((${crit.origData} IS NULL) OR (${crit.origData} = ''))`;
};

export const getSBContainsSql = (crit: SBCriterion): WhereClause => {
  return `(${crit.origData} LIKE '%${crit.value1 ?? ""}%')`;
};

export const getSBStartsWithSql = (crit: SBCriterion): WhereClause => {
  return `(${crit.origData} LIKE '${crit.value1 ?? ""}%')`;
};

export const getSBEndsWithSql = (crit: SBCriterion): WhereClause => {
  return `(${crit.origData} LIKE '%${crit.value1 ?? ""}')`;
};

//  TODO  no error handling. write tests for it
export const getSBBetweenSql = (crit: SBCriterion): WhereClause => {
  const v1 = parseNumberHelper(crit.value1 ?? "");
  const v2 = parseNumberHelper(crit.value2 ?? "");
  return `((${crit.origData} >= ${v1}) AND (${crit.origData} <= ${v2}))`;
};

export const getSBNotBetweenSql = (crit: SBCriterion): WhereClause => {
  const v1 = parseNumberHelper(crit.value1 ?? "");
  const v2 = parseNumberHelper(crit.value2 ?? "");
  return `((${crit.origData} < ${v1}) OR (${crit.origData} > ${v2}))`;
};

export const getSBLessThanSql = (crit: SBCriterion, orEqualTo=false): WhereClause => {
  const v1 = parseNumberHelper(crit.value1 ?? "");
  return `(${crit.origData} <${orEqualTo ? "=" : ""} ${v1})`;
};

export const getSBGreaterThanSql = (crit: SBCriterion, orEqualTo=false): WhereClause => {
  const v1 = parseNumberHelper(crit.value1 ?? "");
  return `(${crit.origData} >${orEqualTo ? "=" : ""} ${v1})`;
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
  if (crit.condition === "!between")   return getSBNotBetweenSql(crit);
  if (crit.condition === "<")          return getSBLessThanSql(crit);
  if (crit.condition === "<=")         return getSBLessThanSql(crit, true);
  if (crit.condition === ">")          return getSBGreaterThanSql(crit);
  if (crit.condition === ">=")         return getSBGreaterThanSql(crit, true);
  throw new Error("unrecognized condition");
};


export const getSearchBuilderSql = (params: SearchBuilder): SQLFragment => {
  if (!(params.criteria)) throw new Error("no criteria?");

  const isNestedP = (obj: SearchBuilder | SBCriterion): boolean => {
    return ("criteria" in obj);
  };

  const allCriteria = params['criteria'].map((i): string => {
    // @ts-ignore
    if (!isNestedP(i)) return getSBCriterionSql(i);
    // @ts-ignore
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


export const getGlobalSearchSql = (params: DTAJAXParams): SQLFragment => {
  //  TODO  check if missing the keys
  return `(CONCAT(${params.columns.map(i => i.data).join(", ")}) LIKE '%${params.search.value}%')`;
};





export const getWhereClause = (params: DTAJAXParams): WhereClause => {
  const fromSearchBuilder = ('searchBuilder' in params) ? 
                              getSearchBuilderSql(params.searchBuilder) :
                              "True";
  const fromGlobalSearch = ('search' in params && params.search.value !== '') ? 
                              getGlobalSearchSql(params) :
                              "True";
  return `WHERE (${ [fromSearchBuilder, fromGlobalSearch].join(" AND ") })`;
};






export const dtajax2sql = (params: DTAJAXParams, tblName: TableName) => {
  //  TODO  error checking...
  // if (!("columns" in params))
  //   throw new Error("params don't include a 'columns' property");
  const selectClause = getSelectClause(params);
  const fromClause = `FROM ${tblName}`;
  const limit = getLimitSql(params);
  const offset = getOffsetSql(params);
  const whereClause = getWhereClause(params);
  console.log(`where clause: <${whereClause}>`);
  const q = `${selectClause} ${fromClause} ${whereClause} ${limit} ${offset}`;
  return q;
};


// @ts-ignore
// console.log(dtajax2sql(ex_simple1, "default"));

export default dtajax2sql;
