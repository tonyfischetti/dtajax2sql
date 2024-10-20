
import { WhereClause } from "./types";

export const negateClause = (clause: WhereClause): WhereClause => {
  return `(NOT ${clause})`;
};

export const parseNumberHelper = (str: string): number => {
  const num = parseInt(str, 10);
  if (isNaN(num)) throw new Error("couldn't parse number");
  return num;
};

//  TODO  LAZY
export const compose = (...fns: any[]) => {
  return (input: any) => {
    return fns.reduce((acc, i) => {
      return i(acc);
    }, input);
  };
};

// When you have a lot of columns, datatables sends the columns
// in a weird way. This converts it back to what's expected
export const convertColumnPropToArray = (columns: any) => {
  const thekeys = Object.keys(columns);
  const newcols = thekeys.map(i => columns[i]);
  return newcols;
};
