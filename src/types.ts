
export type TableName    = string;
export type SQLFragment  = string;
export type SelectClause = SQLFragment;
export type WhereClause  = SQLFragment;
export type SQLQuery     = string;


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
  searchable?: 'true' | 'false';
  orderable?: 'true' | 'false';
  // also has "search" property
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

export interface SBCriterion {
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
  criteria: Array<SBCriterion> | Array<SearchBuilder>
  logic: 'AND' | 'OR'
}


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
    start: '10',
    length: '10',
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
    _: '1727689860063'
  }
 */

export interface DTAJAXParams {
  draw: string;
  columns: Array<ColumnObj>;
  start: string;
  length: string;
  search: GlobalSearch;
  searchBuilder: SearchBuilder;
  _: string;
}


export interface WhitespaceOpts {
  removeLeadingWhitespace: boolean;
  removeTrailingWhitespace: boolean;
}

export interface ConfigOpts {
  globalSearch: WhitespaceOpts;
  allowedFields: Array<string> | undefined;
  //  TODO  really?
  // searchBuilder: WhitespaceOpts;
  //  TODO  there's more. think about it
}

export interface EscapedLIKE {
  str: string;
  escape: string | undefined;
}

export interface Result {
  query: SQLQuery;
  countQuery: SQLQuery;
}

