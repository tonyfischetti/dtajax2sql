
import { ConfigOpts, DTAJAXParams } from './types.js';
import { isRecord } from './utils.js';

/*
 * the minimum request shape the adapters need, checked AFTER
 * healParams has turned the query-string encodings back into arrays:
 * a malformed request fails here with a real message instead of an
 * incidental TypeError further down (or, worse, SQL that quietly
 * means something else)
 */

export function assertParamsObject(value: unknown): asserts value is Record<string, unknown> {
  if (!isRecord(value))
    throw new Error("DataTables parameters must be an object");
}

/*
 * `depth` and `counter` thread the complexity limits through the
 * recursion: the top-level group is depth 1, and every criterion and
 * every group counts once towards maxCriteria
 */
const validateSearchBuilderShape = (value: unknown,
                                    maxDepth: number,
                                    maxCriteria: number,
                                    depth = 1,
                                    counter = { value: 0 }): void => {
  if (depth > maxDepth)
    throw new Error(`searchBuilder exceeds the maximum depth of ${maxDepth}`);
  if (!isRecord(value))
    throw new Error("searchBuilder must be an object");
  const criteria = value['criteria'];
  //  NOTE  an empty group is legitimate and common, and arrives in
  //        several shapes: SearchBuilder's getDetails() returns a bare
  //        `{}` for a group with no criteria (so every JSON request from
  //        a table with an idle SearchBuilder carries `searchBuilder: {}`),
  //        an empty array can't be encoded in a query string (so a GET
  //        arrives as `{ logic: 'AND' }` alone), and `criteria: []` is
  //        what a hand-built request looks like. None of them filter
  //        anything, so there is nothing to check --- `logic` included
  if (criteria === undefined)
    return;
  if (!Array.isArray(criteria))
    throw new Error("searchBuilder.criteria must be an array");
  if (criteria.length === 0)
    return;
  if (value['logic'] !== 'AND' && value['logic'] !== 'OR')
    throw new Error("searchBuilder.logic must be 'AND' or 'OR'");
  criteria.forEach((criterion, index) => {
    counter.value++;
    if (counter.value > maxCriteria)
      throw new Error(`searchBuilder exceeds the maximum of ${maxCriteria} criteria`);
    if (!isRecord(criterion))
      throw new Error(`searchBuilder criterion ${index} must be an object`);
    if ('criteria' in criterion)
      validateSearchBuilderShape(criterion, maxDepth, maxCriteria, depth + 1, counter);
  });
};

export function validateDTAJAXParams(value: unknown,
                                     config: ConfigOpts): asserts value is DTAJAXParams {
  assertParamsObject(value);

  const columns = value['columns'];
  if (!Array.isArray(columns) || columns.length === 0)
    throw new Error("columns must be a non-empty array");
  columns.forEach((column, index) => {
    //  NOTE  "" is allowed: DataTables sends `data: ""` for columns
    //        with no data source (`data: null`), and the global search
    //        already skips those
    if (!isRecord(column) || typeof column['data'] !== 'string')
      throw new Error(`columns[${index}].data must be a string`);
    const searchable = column['searchable'];
    if (searchable !== undefined &&
        searchable !== true && searchable !== false &&
        searchable !== 'true' && searchable !== 'false')
      throw new Error(`columns[${index}].searchable must be true/false (or 'true'/'false')`);
  });

  const search = value['search'];
  if (!isRecord(search) || typeof search['value'] !== 'string')
    throw new Error("search.value must be a string");

  if (!('start' in value))
    throw new Error("start is required");
  if (!('length' in value))
    throw new Error("length is required");

  const order = value['order'];
  if (order !== undefined && !Array.isArray(order))
    throw new Error("order must be an array");

  if (value['searchBuilder'] !== undefined)
    validateSearchBuilderShape(value['searchBuilder'],
                               config.searchBuilder.maxDepth,
                               config.searchBuilder.maxCriteria);
}

