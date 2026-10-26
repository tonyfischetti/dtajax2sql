
import {
  ConfigInput,
  ConfigOpts,
  DialectName,
  DTAJAXParams,
  Result
} from './types.js';

import {
  convertColumnPropToArray,
  healSearchBuilderTree,
  isRecord
} from './utils.js';

import {
  assertParamsObject,
  validateDTAJAXParams
} from './validation.js';

import { DialectAdapter, } from './DialectAdapter.js';
import { SQLiteAdapter } from './adapters/SQLiteAdapter.js';


const defaultConfigOpts: ConfigOpts = {
  whitespace: {
    removeLeading: true,
    removeTrailing: true
  },
  //  NOTE  no page-size cap by default: DataTables' `length: -1` ("all
  //        rows", which export buttons rely on) has to keep working
  //        unless a consumer opts into a cap
  pagination: {
    maxPageSize: null
  },
  searchBuilder: {
    maxDepth:    8,
    maxCriteria: 100
  }
};

const completeConfigurationObj = (config: ConfigInput): ConfigOpts => {
  const requestedMax = config.pagination?.maxPageSize;
  const completed: ConfigOpts = {
    whitespace: {
      removeLeading:  config.whitespace?.removeLeading  ?? defaultConfigOpts.whitespace.removeLeading,
      removeTrailing: config.whitespace?.removeTrailing ?? defaultConfigOpts.whitespace.removeTrailing
    },
    pagination: {
      maxPageSize: requestedMax === undefined ? defaultConfigOpts.pagination.maxPageSize : requestedMax
    },
    searchBuilder: {
      maxDepth:    config.searchBuilder?.maxDepth    ?? defaultConfigOpts.searchBuilder.maxDepth,
      maxCriteria: config.searchBuilder?.maxCriteria ?? defaultConfigOpts.searchBuilder.maxCriteria
    }
  };
  const { maxPageSize } = completed.pagination;
  if (maxPageSize !== null && (!Number.isSafeInteger(maxPageSize) || maxPageSize < 1))
    throw new Error("pagination.maxPageSize must be a positive integer or null");
  const { maxDepth, maxCriteria } = completed.searchBuilder;
  if (!Number.isSafeInteger(maxDepth) || maxDepth < 1)
    throw new Error("searchBuilder.maxDepth must be a positive integer");
  if (!Number.isSafeInteger(maxCriteria) || maxCriteria < 1)
    throw new Error("searchBuilder.maxCriteria must be a positive integer");
  return completed;
};

/*
 * heals the shapes qs/DataTables produce (numeric-keyed objects where
 * arrays are meant --- see utils). Only object-shaped values are
 * converted; anything else is left alone for the validator to reject
 * with a real message instead of a TypeError out of Object.keys.
 *
 * Works on a copy: the caller's request object is never modified
 * (a consumer may well log it, or hand it to something else, after us)
 */
const healParams = (params: Record<string, unknown>): Record<string, unknown> => {
  const healed: Record<string, unknown> = { ...params };

  const columns = healed['columns'];
  if (Array.isArray(columns))   healed['columns'] = [...columns];
  else if (isRecord(columns))   healed['columns'] = convertColumnPropToArray(columns);

  const order = healed['order'];
  if (Array.isArray(order))     healed['order'] = [...order];
  else if (isRecord(order))     healed['order'] = convertColumnPropToArray(order);

  if ("searchBuilder" in healed)
    healed['searchBuilder'] = healSearchBuilderTree(healed['searchBuilder']);
  return healed;
};


export class Dtajax2sql {

  readonly tableName:       string;
  readonly dialectAdapter:  DialectAdapter;
  readonly config:          ConfigOpts;

  constructor(tableName: string, dialect: DialectName, config?: ConfigInput) {
    this.tableName = tableName;

    if (config) this.config = completeConfigurationObj(config);
    else this.config = defaultConfigOpts;

    switch (dialect) {
      case 'sqlite':
        this.dialectAdapter = new SQLiteAdapter(this.tableName, this.config);
        return;
      default: throw new Error("unrecognized SQL dialect");
    }
  }

  /* heal, then validate: the adapters only ever see params that passed both */
  private prepareParams(params: unknown): DTAJAXParams {
    assertParamsObject(params);
    const healed = healParams(params);
    validateDTAJAXParams(healed, this.config);
    return healed;
  }

  public toSQL(params: DTAJAXParams): Result {
    return this.dialectAdapter.toSQL(this.prepareParams(params));
  }

  public toSQLThroughFtTable(ftTableName: string,
                             rowidKey: string,
                             params: DTAJAXParams): Result {
    return this.dialectAdapter.toSQLThroughFtTable(ftTableName,
                                                   rowidKey,
                                                   this.prepareParams(params));
  }
}

export default Dtajax2sql;

