
import {
  ConfigOpts,
  DialectName,
  DTAJAXParams,
  Result
} from './types.js';

import { convertColumnPropToArray } from './utils.js';

import { DialectAdapter, } from './DialectAdapter.js';
import { SQLiteAdapter } from './adapters/SQLiteAdapter.js';


const defaultConfigOpts: ConfigOpts = {
  whitespace: {
    removeLeading: true,
    removeTrailing: true
  },
  excludeFromGlobalSearch: []
};

const completeConfigurationObj = (config: ConfigOpts): ConfigOpts => {
  config = { ...defaultConfigOpts, ...config };
  config.whitespace = { ...defaultConfigOpts.whitespace, ...config.whitespace };
  return config;
};

const healParams = (params: DTAJAXParams): DTAJAXParams => {
  if (!Array.isArray(params.columns))
    params.columns =  convertColumnPropToArray(params.columns);

  if (params.order && !Array.isArray(params.order))
    params.order =  convertColumnPropToArray(params.order);

  if ("searchBuilder" in params && "criteria" in params.searchBuilder) {
    if ("0" in params?.searchBuilder?.criteria) {
      params.searchBuilder.criteria = convertColumnPropToArray(params.searchBuilder.criteria);
    }
  }
  return params;
};


export class Dtajax2sql {

  readonly tableName: string;
  readonly dialectAdapter: DialectAdapter;
  readonly config: ConfigOpts;

  constructor(tableName: string, dialect: DialectName, config?: ConfigOpts) {
    this.tableName = tableName;

    if (config)
      this.config = completeConfigurationObj(config);
    else
      this.config = defaultConfigOpts;

    switch (dialect) {
      case 'sqlite':
        this.dialectAdapter = new SQLiteAdapter(this.tableName, this.config);
        return;
      default: throw new Error("unrecognized SQL dialect");
    }
  }

  public toSQL(params: DTAJAXParams): Result {
    params = healParams(params);
    return this.dialectAdapter.toSQL(params);
  }
}

export default Dtajax2sql;

