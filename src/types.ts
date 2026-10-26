
export type DialectName = 'sqlite';

export type SQLFragment  = string;
export type SQLQuery     = string;
export type OrderClause  = SQLFragment;


/**
 * ColumnObj
 *
 * example:

  {
    data: 'ObjectID',
    name: '',
    searchable: 'true',
    orderable: 'false',
    search: [Object]
  }
 */

export interface ColumnObj {
  data: string;
  name: string;
  searchable?: 'true' | 'false' | true | false;
  orderable?: 'true' | 'false' | true | false;
  //  TODO  also has "search" property
}


/**
 * GlobalSearch
 *
 * example
  search: {
    value: 'global search',
    regex: 'false'
  },
  */
export interface GlobalSearch {
  value: string;
  regex: 'true' | 'false';
}


/** SBCriterion
 *
 * example:

    {
      "condition": "=",
      "data": "ObjectID",
      "origData": "ObjectID",
      "type": "num",
      "value": [
        "1"
      ],
      "value1": "1"
    }

 */

/*
 * a SearchBuilder row that hasn't been filled in yet (DataTables
 * sends e.g. `{ type: "" }` for these); `condition` is the
 * discriminant between the two shapes
 */
export interface SBIncompleteCriterion {
  condition?: undefined;
  data?: string;
  origData?: string;
  type: 'num' | 'string' | '';
  value?: Array<string>;
  value1?: string;
  value2?: string;
}

export interface SBCompleteCriterion {
  condition: '=' | '!=' | 'starts' | '!starts' | 'ends' |
             '!ends' | 'contains' | '!contains' |
             'null' | '!null' | '<' | '<=' | '>' | '>=' |
             'between' | '!between';
             //  TODO  OTHERS?!
  data: string;
  origData: string;
  type: 'num' | 'string';  //  TODO  others?!?!
  value?: Array<string>;
  value1?: string;
  value2?: string;
}

export type SBCriterion = SBIncompleteCriterion | SBCompleteCriterion;


/**
 * SearchBuilder
 *
 * example
  {
    "criteria": [
      {
        "criteria": [
          SBCriterion,
          SBCriterion,
        ],
        "logic": "AND"
      },
      {
        "criteria": [
          SBCriterion,
          SBCriterion,
        ],
        "logic": "AND"
      }
    ],
    "logic": "OR"
  }
*/

export interface SearchBuilder {
  //  NOTE  criteria and sub-groups can be MIXED at the same level
  //        (e.g. `(A AND B) OR C`)
  criteria: Array<SBCriterion | SearchBuilder>
  logic: 'AND' | 'OR'
}


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

export interface OrderDirective {
  //  NOTE  an index into `columns`; arrives as a string over GET
  //        (query string) and as a number over JSON (POST body)
  column: number | string;
  dir: 'asc' | 'desc';
  name?: string;
}

export type OrderSpec = Array<OrderDirective>;
  

/**
 * DTAJAXParams
 *
 * example

  {
    draw: '2',
    columns: [
      {
        data: 'Department',
        name: '',
        searchable: 'true',
        orderable: 'false',
        search: [Object]
      },
      {
        data: 'Title',
        name: '',
        searchable: 'false',
        orderable: 'false',
        search: [Object]
      }
    ],
    search: { value: 'global search', regex: 'false' },
    searchBuilder: {

      "criteria": [
        {
          "condition": "contains",
          "data": "Title",
          "origData": "Title",
          "type": "string",
          "value": [
            "q"
          ],
          "value1": "q"
        }
      ],
      "logic": "AND"

    },
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
    ],
    start: '10',
    length: '10',
    _: '1727689860063'
  }
 */

export interface DTAJAXParams {
  draw: string;
  columns: Array<ColumnObj>;
  //  NOTE  strings over GET (query string), numbers over JSON (POST
  //        body); `length: -1` means "all rows"
  start: string | number;
  length: string | number;
  search: GlobalSearch;
  searchBuilder?: SearchBuilder;
  order?: OrderSpec;
  globalSearchMode?: string;
  _: string;
}


export interface WhitespaceOpts {
  removeLeading: boolean;
  removeTrailing: boolean;
}

/**
 * PaginationOpts
 *
 * maxPageSize --- the largest `length` a request may ask for, or
 *                 `null` for no cap (the default). DataTables sends
 *                 `length: -1` to mean "all rows" (export buttons do
 *                 this); that is honoured as `LIMIT -1` when there is
 *                 no cap, and rejected (never silently truncated) when
 *                 there is one
 */
export interface PaginationOpts {
  maxPageSize: number | null;
}

/**
 * SearchBuilderOpts
 *
 * maxDepth    --- how deeply groups may nest (the top level is depth 1)
 * maxCriteria --- the total number of criteria + groups in one request
 *
 * both are generous relative to anything a person builds by hand in
 * the SearchBuilder UI; they exist so a hand-crafted request can't hand
 * the database a pathologically large WHERE clause
 */
export interface SearchBuilderOpts {
  maxDepth:    number;
  maxCriteria: number;
}

export interface ConfigOpts {
  whitespace:    WhitespaceOpts;
  pagination:    PaginationOpts;
  searchBuilder: SearchBuilderOpts;
}

/* what the constructor accepts: everything optional, at every level */
export interface ConfigInput {
  whitespace?:    Partial<WhitespaceOpts>;
  pagination?:    Partial<PaginationOpts>;
  searchBuilder?: Partial<SearchBuilderOpts>;
}

export interface EscapedLIKE {
  str: string;
  escape: string | undefined;
}

/**
 * Result
 *
 * query      --- the page query (LIMIT/OFFSET applied)
 * countQuery --- counts the whole filtered set (no LIMIT/OFFSET)
 * fusedQuery --- the page query with `filteredCount` riding along on
 *                every row (COUNT(*) OVER ()), so one execution gets
 *                the page AND recordsFiltered.
 *                NOTE: a page past the end returns zero rows and
 *                therefore no count --- fall back to countQuery then.
 *                NOTE: biggest win when the filter is selective
 *                (~50% per draw); for very broad filters the window
 *                defeats SQLite's top-k sorter and can be a wash
 */
export interface Result {
  query: SQLQuery;
  countQuery: SQLQuery;
  fusedQuery: SQLQuery;
}

