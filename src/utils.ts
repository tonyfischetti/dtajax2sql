
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
