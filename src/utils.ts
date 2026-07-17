
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

/*
 * qs (which Express uses to parse query strings) only parses brackets
 * to a depth limit (default 5); everything past that arrives as
 * flattened literal keys, e.g.
 *
 *   { "[0][condition]": "=", "[0][value][]": "1", ... }
 *
 * these helpers convert that back into real arrays/objects
 */

const parseBracketPath = (key: string): Array<string> => {
  return [...key.matchAll(/\[([^\]]*)\]/g)].map(m => m[1] ?? '');
};

const isFlattenedBracketKeyObject = (obj: object): boolean => {
  const thekeys = Object.keys(obj);
  return thekeys.length > 0 && thekeys.every(k => /^(\[[^\]]*\])+$/.test(k));
};

export const unflattenBracketKeys = (flat: Record<string, any>): any => {
  //  NOTE  a flattened remainder always starts with an index ("[0]...")
  const root: any = [];
  for (const [key, value] of Object.entries(flat)) {
    const path = parseBracketPath(key);
    let node: any = root;
    for (let i = 0; i < path.length; i++) {
      const seg = path[i] ?? '';
      if (i === path.length - 1) {
        //  a trailing "[]" (e.g. "[0][value][]") means "append"
        if (seg === '') node.push(value);
        else node[seg] = value;
      } else {
        const nextSeg = path[i + 1] ?? '';
        if (node[seg] === undefined)
          node[seg] = (nextSeg === '' || /^\d+$/.test(nextSeg)) ? [] : {};
        node = node[seg];
      }
    }
  }
  return root;
};

// heals a SearchBuilder tree in place: at EVERY depth, converts
// criteria that arrived as objects (numeric-keyed, or flattened
// past qs's depth limit) back into proper arrays
export const healSearchBuilderTree = (sb: any): void => {
  if (!sb || typeof sb !== 'object' || !("criteria" in sb) || !sb.criteria)
    return;
  if (!Array.isArray(sb.criteria)) {
    sb.criteria = isFlattenedBracketKeyObject(sb.criteria)
      ? unflattenBracketKeys(sb.criteria)
      : convertColumnPropToArray(sb.criteria);
  }
  sb.criteria.forEach((c: any) => healSearchBuilderTree(c));
};

export const withEsc = (base: string, escape: string | undefined) => {
  if (escape)
    return `${base} ESCAPE '${escape}'`;
  return base;
};

export const parenthisize = (s: string) => {
  return `(${s})`;
};

