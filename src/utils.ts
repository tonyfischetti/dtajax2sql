
import { SQLFragment } from "./types";

export const negateClause = (clause: SQLFragment): SQLFragment => {
  return `(NOT ${clause})`;
};

export const parseNumberHelper = (str: string): number => {
  const num = parseInt(str, 10);
  if (isNaN(num)) throw new Error("couldn't parse number");
  return num;
};

// When you have a lot of columns, datatables sends the columns
// in a weird way. This converts it back to what's expected
export const convertColumnPropToArray = (columns: any) => {
  const thekeys = Object.keys(columns);
  const newcols = thekeys.map(i => columns[i]);
  return newcols;
};

export const withEsc = (base: string, escape: string | undefined) => {
  if (escape)
    return `${base} ESCAPE '${escape}'`;
  return base;
};

export const parenthisize = (s: string) => {
  return `(${s})`;
};

